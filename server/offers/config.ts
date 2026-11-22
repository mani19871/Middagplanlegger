// Innstillinger for tilbudslagring og henting fra Tjek, lest fra miljøvariabler (docs/synk.md, «Tilbud fra Tjek»).
// Ugyldige verdier gir standard og en advarsel, aldri «av» eller «uendelig» ved en skrivefeil.
import { join } from 'node:path';

export interface OfferConfig {
  /** OFFER_STORE=0 slår av lagringen; tilbud holdes da bare i minnet (som før). */ store: boolean;
  /** TJEK_FETCH=0 slår av alle kall til Tjek (tester, røyktest, frakoblet drift). */ fetch: boolean;
  /** OFFER_DB: egen databasefil (standard $DATA_DIR/tilbud.sqlite). Aldri synk-databasen. */ db: string;
  /** OFFER_REFRESH_HOURS: timer mellom henting (standard 6, minst 1, høyst 168: lengre ventetid enn setTimeout tåler ga 1 ms). */ refreshMs: number;
  /** OFFER_RETENTION_DAYS: utløpte tilbud som ikke er sett på så mange dager, slettes (standard 180, 0 = aldri). */ retentionDays: number;
  /** OFFER_MAX_CALLS_PER_DAY: kallbudsjett mot Tjek per norsk døgn (standard 1000, minst 1). */ maxCallsPerDay: number;
}
export const OFFER_DEFAULTS = { refreshHours: 6, retentionDays: 180, maxCallsPerDay: 1000 };

function num(env: Record<string, string | undefined>, name: string, def: number, min: number, warn: (m: string) => void, max = Infinity): number {
  const v = env[name];
  if (v === undefined || v.trim() === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) { warn(`${name} er ugyldig; bruker ${def}.`); return def; }
  return n;
}

export function offerConfigFrom(env: Record<string, string | undefined>, warn: (m: string) => void = console.warn): OfferConfig {
  const dataDir = env.DATA_DIR ?? join(process.cwd(), 'data');
  return {
    store: env.OFFER_STORE !== '0',
    fetch: env.TJEK_FETCH !== '0',
    db: env.OFFER_DB ?? join(dataDir, 'tilbud.sqlite'),
    refreshMs: num(env, 'OFFER_REFRESH_HOURS', OFFER_DEFAULTS.refreshHours, 1, warn, 168) * 3_600_000,
    retentionDays: Math.floor(num(env, 'OFFER_RETENTION_DAYS', OFFER_DEFAULTS.retentionDays, 0, warn)),
    maxCallsPerDay: Math.floor(num(env, 'OFFER_MAX_CALLS_PER_DAY', OFFER_DEFAULTS.maxCallsPerDay, 1, warn)),
  };
}

/**
 * Delbudsjett for kundeaviser (lista og sidene, GET /api/aviser*): en femdel av dagens kallbudsjett mot Tjek. Avisoppslag
 * styres av anonyme kall, og uten eget tak kunne de bruke opp budsjettet innsamleren trenger (runde 2, O11). Fordelingen er
 * et skjønn, ikke en avtalt grense.
 */
export function paperCallsPerDay(maxCallsPerDay: number): number { return Math.max(1, Math.floor(maxCallsPerDay / 5)); }
