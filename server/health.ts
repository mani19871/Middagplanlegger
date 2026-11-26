// Ekstra tall i GET /healthz til driftsstatus (docs/drift/driftstatus.sh, docs/sikkerhet.md «Driftsstatus»). Åpent og anonymt,
// derfor bare tall og ja/nei om serveren selv: aldri antall husstander, enheter eller hendelser, aldri tekst, id-er, adresser
// eller innhold. `healthFields` er sperren som sørger for det, uansett hva kilden sender inn.
import type { OfferStore } from './offers/types';

export type HealthValue = number | boolean | null;

const KEY = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
/** Øvre grense for et tall i svaret (minutter og tellere ligger langt under). */
const MAX_NUMBER = 1_000_000_000;

/** Slipper bare gjennom tall (hele, 0 til 1 mrd.), ja/nei og null, med enkle nøkler. Alt annet (tekst, objekter, lister) droppes. */
export function healthFields(raw: unknown): Record<string, HealthValue> {
  const out: Record<string, HealthValue> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KEY.test(k)) continue;
    if (typeof v === 'boolean' || v === null) out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_NUMBER) out[k] = Math.floor(v);
  }
  return out;
}

export interface HealthExtraOptions {
  /** Tilbudslagringen (null når OFFER_STORE=0). Bare `lastFetch` og `ping` brukes. */
  offerStore: Pick<OfferStore, 'lastFetch' | 'ping'> | null;
  /** Om henting fra Tjek er på (TJEK_FETCH ikke 0). */
  fetchOn: boolean;
  /** Innsamlerens tilstand (antall feil på rad), eller null uten innsamler. */
  collector: () => { failures: number } | null;
  now: () => number;
  /** Når serverprosessen startet (ms). */
  startedAtMs: number;
}

/**
 * Tallene driftsstatus trenger utover «databasen svarer»:
 * - `offersFetch`: henting fra Tjek er på.
 * - `offersLastRunAgeMinutes`: hele minutter siden siste vellykkede henting (lagret, så den overlever omstart), null = aldri.
 * - `offersFailures`: antall mislykkede hentinger på rad.
 * - `offersDbOk`: tilbudsdatabasen svarer (null uten tilbudslagring).
 * - `uptimeMinutes`: minutter siden serveren startet.
 */
export function createHealthExtra(o: HealthExtraOptions): () => Promise<Record<string, HealthValue>> {
  return async () => {
    let age: number | null = null;
    let dbOk: boolean | null = null;
    if (o.offerStore) {
      try {
        const last = await o.offerStore.lastFetch();
        const t = last ? Date.parse(last) : NaN;
        if (Number.isFinite(t)) age = Math.max(0, Math.floor((o.now() - t) / 60_000));
        await o.offerStore.ping();
        dbOk = true;
      } catch { dbOk = false; age = null; }
    }
    return {
      offersFetch: o.fetchOn,
      offersLastRunAgeMinutes: age,
      offersFailures: o.collector()?.failures ?? 0,
      offersDbOk: dbOk,
      uptimeMinutes: Math.max(0, Math.floor((o.now() - o.startedAtMs) / 60_000)),
    };
  };
}
