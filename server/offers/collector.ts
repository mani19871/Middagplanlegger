// Periodisk henting av tilbud fra Tjek til tilbudslagringen (server/offers/sqlite.ts). Én runde ved oppstart, deretter hver
// `intervalMs` (OFFER_REFRESH_HOURS, standard 6 t). Ved feil: pent bakoff (5, 10, 20 … minutter, aldri lenger enn
// intervallet). Kallbudsjettet (CallBudget, OFFER_MAX_CALLS_PER_DAY) stopper runden før grensen; da ventes et helt
// intervall. Tjeks offentlige tak er 8 000 000 kall per måned per land (§ 8.5); vår avtales grense er ikke kjent for oss
// (phase0/tjek-avtale.md), så standarden ligger langt under. Klokke og timer settes inn, så alt kan testes uten nett.
import { PartialCollectError, type LiveOffer } from '../../src/offers/service';
import type { NormalizedOffer } from '../../src/offers/types';
import type { OfferStore } from './types';

/** Kastes av kallbudsjettet når dagens grense er nådd. Ingen kall er da sendt. */
export class BudgetExceededError extends Error { constructor() { super('kallgrense'); this.name = 'BudgetExceededError'; } }

/** Teller kall mot kilden per døgn (norsk dato fra `day`). `take()` før hvert kall; kaster når grensen er nådd. */
export class CallBudget {
  private dayKey = '';
  private n = 0;
  constructor(private readonly maxPerDay: number, private readonly day: () => string) {}
  take() {
    const d = this.day();
    if (d !== this.dayKey) { this.dayKey = d; this.n = 0; }
    if (this.n >= this.maxPerDay) throw new BudgetExceededError();
    this.n++;
  }
  used() { return this.day() === this.dayKey ? this.n : 0; }
}

export interface CollectorOptions {
  /** Én hel innsamling (collectOffers mot Tjek). Observasjonstiden er satt av kilden per tilbud. */
  collect: () => Promise<LiveOffer[]>;
  /**
   * Husholdningstilbud (utvidelse C, src/offers/household.ts), hentet etter mattilbudene i samme runde og lagret i samme
   * tilbudslager. En feil her (også kallgrensen) stopper ikke runden: mattilbudene lagres, og bare feilens navn logges.
   */
  collectOther?: () => Promise<NormalizedOffer[]>;
  store: OfferStore;
  country: string;
  now: () => string;
  log?: (m: string) => void;
  /** Tid mellom vellykkede runder. */ intervalMs: number;
  /** Første ventetid etter en feil; dobles for hver feil, aldri over `intervalMs`. */ retryMs: number;
  /** Lagrede, utløpte tilbud som ikke er sett på så mange dager, slettes i hver runde, også når hentingen feiler. 0 = aldri. */ retentionDays: number;
  /** Planlegg neste runde. Standard: setTimeout som ikke holder prosessen i live. Returnerer avlysning. */
  schedule?: (fn: () => void, ms: number) => () => void;
  /** Antall tilbud uten land siden sist (TjekSource.takeMissingCountry, O4b). Logges per runde, også når runden feiler. */
  missingCountry?: () => number;
  /** Etter en vellykket runde: tilbudene og hentetidspunktet (live-visningen i minnet bruker dem). */
  onCollected?: (offers: LiveOffer[], at: string, other: NormalizedOffer[]) => void;
}
export interface CollectorState { lastOk: string | null; failures: number; running: boolean }
export interface OfferCollector {
  state(): CollectorState;
  /** Starter en runde nå hvis ingen kjører. */ runNow(): Promise<void>;
  /** Venter til en pågående runde er ferdig. */ idle(): Promise<void>;
  stop(): void;
}

const DAY_MS = 86_400_000;
const BATCH = 1000;
/** Lengste ventetid setTimeout tåler; lengre blir 1 ms i Node (runde 2, O13). */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Oppbevaring (OFFER_RETENTION_DAYS): sletter utløpte tilbud som ikke er sett på `days` dager. 0 = aldri. Uavhengig av om
 * hentingen lykkes, så lagrede priser ikke blir liggende når hentingen feiler over tid eller er slått av (runde 2, O12).
 */
export async function pruneOffers(store: OfferStore, days: number, now: string): Promise<number> {
  if (!(days > 0)) return 0;
  const before = new Date(Date.parse(now) - days * DAY_MS).toISOString();
  let deleted = 0;
  for (let n = BATCH; n === BATCH;) { n = await store.deleteBefore(before, BATCH); deleted += n; }
  return deleted;
}

/** Oppbevaring uten innsamler (TJEK_FETCH=0): én runde nå og deretter hver `intervalMs` (standard 6 t). */
export function startOfferRetention(o: { store: OfferStore; days: number; now: () => string; log?: (m: string) => void; intervalMs?: number }) {
  const log = o.log ?? ((m: string) => console.log(m));
  const round = () => pruneOffers(o.store, o.days, o.now())
    .then((n) => { if (n) log(`Tilbud: ${n} gamle slettet.`); return n; })
    .catch((e: unknown) => { log(`tilbud-oppbevaring-feil: ${e instanceof Error ? e.name : typeof e}`); return 0; });
  if (!(o.days > 0)) return { first: Promise.resolve(0), stop: () => {} };
  const first = round();
  const timer = setInterval(() => { void round(); }, Math.min(o.intervalMs ?? 6 * 3_600_000, MAX_TIMEOUT_MS));
  timer.unref?.();
  return { first, stop: () => clearInterval(timer) };
}

export function startOfferCollector(o: CollectorOptions): OfferCollector {
  const log = o.log ?? ((m: string) => console.log(m));
  const schedule = o.schedule ?? ((fn, ms) => { const t = setTimeout(fn, Math.min(ms, MAX_TIMEOUT_MS)); t.unref?.(); return () => clearTimeout(t); });
  const st: CollectorState = { lastOk: null, failures: 0, running: false };
  let current: Promise<void> | null = null;
  let cancel: (() => void) | null = null;
  let stopped = false;
  let budgetLogged = '';

  const next = (ms: number) => { if (!stopped) cancel = schedule(() => { void run(); }, ms); };

  /** Oppbevaringen kjører i hver runde, også når hentingen feiler, og stopper aldri runden. */
  async function prune(): Promise<number> {
    try { return await pruneOffers(o.store, o.retentionDays, o.now()); } catch (e) { log(`tilbud-oppbevaring-feil: ${e instanceof Error ? e.name : typeof e}`); return 0; }
  }

  async function round() {
    const at = o.now();
    const noCountry = () => (o.missingCountry ? `, ${o.missingCountry()} uten land` : '');
    try {
      const offers = await o.collect();
      let other: NormalizedOffer[] = [];
      if (o.collectOther) {
        try { other = await o.collectOther(); } catch (e) { log(`tilbud-feil husholdning: ${e instanceof Error ? e.name : typeof e}`); }
      }
      const r = await o.store.record([...offers.map((l) => l.offer), ...other], o.country, o.now());
      await o.store.setLastFetch(at);
      st.lastOk = at; st.failures = 0;
      o.onCollected?.(offers, at, other);
      const deleted = await prune();
      log(`Tilbud: ${offers.length} hentet${o.collectOther ? `, ${other.length} husholdning` : ''} (${r.inserted} nye, ${r.updated} endret, ${r.seen} sett igjen${r.skipped ? `, ${r.skipped} avvist` : ''})${deleted ? `, ${deleted} gamle slettet` : ''}${noCountry()}.`);
      next(o.intervalMs);
    } catch (err) {
      // Delvis innsamling (O5): det som ble hentet før feilen, er ekte observasjoner og lagres (idempotent på kilde og id).
      // Runden regnes likevel som feilet: ingen ny «sist hentet», ingen oppdatering av live-visningen, og bakoff som før.
      let e = err;
      if (err instanceof PartialCollectError) {
        e = err.cause;
        try {
          const r = await o.store.record(err.offers.map((l) => l.offer), o.country, o.now());
          log(`Tilbud: delvis runde, ${err.offers.length} hentet før feilen (${r.inserted} nye, ${r.updated} endret, ${r.seen} sett igjen).`);
        } catch (se) { log(`tilbud-lagringsfeil: ${se instanceof Error ? se.name : typeof se}`); }
      }
      if (o.missingCountry) log(`Tilbud: ${o.missingCountry()} uten land i runden.`);
      // Også når hentingen feiler eller kallgrensen er nådd: gamle priser skal ikke bli liggende (runde 2, O12).
      await prune();
      if (e instanceof BudgetExceededError) {
        // Dagens kallgrense er nådd: ingen bakoff-hamring, vent et helt intervall. Logges én gang per dag.
        if (budgetLogged !== at.slice(0, 10)) { budgetLogged = at.slice(0, 10); log('Tilbud: dagens kallgrense mot Tjek er nådd (OFFER_MAX_CALLS_PER_DAY); venter.'); }
        next(o.intervalMs);
        return;
      }
      st.failures++;
      // Bare navnet på feilen: meldingen kan ha sti og statuskode fra Tjek (docs/sikkerhet.md, S10).
      log(`tilbud-feil: ${e instanceof Error ? e.name : typeof e} (forsøk ${st.failures})`);
      next(Math.min(o.retryMs * 2 ** (st.failures - 1), o.intervalMs));
    }
  }

  function run(): Promise<void> {
    if (current || stopped) return current ?? Promise.resolve();
    cancel?.(); cancel = null;
    st.running = true;
    current = round().finally(() => { st.running = false; current = null; });
    return current;
  }

  void run();
  return {
    state: () => ({ ...st }),
    runNow: run,
    idle: async () => { while (current) await current; },
    stop: () => { stopped = true; cancel?.(); cancel = null; },
  };
}
