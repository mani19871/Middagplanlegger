// Periodisk henting av tilbud fra Tjek til tilbudslagringen (server/offers/sqlite.ts). Én runde ved oppstart, deretter hver
// `intervalMs` (OFFER_REFRESH_HOURS, standard 6 t). Ved feil: pent bakoff (5, 10, 20 … minutter, aldri lenger enn
// intervallet). Kallbudsjettet (CallBudget, OFFER_MAX_CALLS_PER_DAY) stopper runden før grensen; da ventes et helt
// intervall. Tjeks offentlige tak er 8 000 000 kall per måned per land (§ 8.5); vår avtales grense er ikke kjent for oss
// (phase0/tjek-avtale.md), så standarden ligger langt under. Klokke og timer settes inn, så alt kan testes uten nett.
import type { LiveOffer } from '../../src/offers/service';
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
  store: OfferStore;
  country: string;
  now: () => string;
  log?: (m: string) => void;
  /** Tid mellom vellykkede runder. */ intervalMs: number;
  /** Første ventetid etter en feil; dobles for hver feil, aldri over `intervalMs`. */ retryMs: number;
  /** Lagrede, utløpte tilbud som ikke er sett på så mange dager, slettes etter hver vellykkede runde. 0 = aldri. */ retentionDays: number;
  /** Planlegg neste runde. Standard: setTimeout som ikke holder prosessen i live. Returnerer avlysning. */
  schedule?: (fn: () => void, ms: number) => () => void;
  /** Etter en vellykket runde: tilbudene og hentetidspunktet (live-visningen i minnet bruker dem). */
  onCollected?: (offers: LiveOffer[], at: string) => void;
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

export function startOfferCollector(o: CollectorOptions): OfferCollector {
  const log = o.log ?? ((m: string) => console.log(m));
  const schedule = o.schedule ?? ((fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return () => clearTimeout(t); });
  const st: CollectorState = { lastOk: null, failures: 0, running: false };
  let current: Promise<void> | null = null;
  let cancel: (() => void) | null = null;
  let stopped = false;
  let budgetLogged = '';

  const next = (ms: number) => { if (!stopped) cancel = schedule(() => { void run(); }, ms); };

  async function round() {
    const at = o.now();
    try {
      const offers = await o.collect();
      const r = await o.store.record(offers.map((l) => l.offer), o.country, o.now());
      await o.store.setLastFetch(at);
      st.lastOk = at; st.failures = 0;
      o.onCollected?.(offers, at);
      let deleted = 0;
      if (o.retentionDays > 0) {
        const before = new Date(Date.parse(o.now()) - o.retentionDays * DAY_MS).toISOString();
        for (let n = BATCH; n === BATCH;) { n = await o.store.deleteBefore(before, BATCH); deleted += n; }
      }
      log(`Tilbud: ${offers.length} hentet (${r.inserted} nye, ${r.updated} endret, ${r.seen} sett igjen${r.skipped ? `, ${r.skipped} avvist` : ''})${deleted ? `, ${deleted} gamle slettet` : ''}.`);
      next(o.intervalMs);
    } catch (e) {
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
