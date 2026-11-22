// Oppbevaringstid: sletter husstander uten aktivitet i SYNC_RETENTION_DAYS dager (standard 365, 0 = av). Samme sletting
// som «Slett husstanden» (kaskade, secure_delete, WAL-checkpoint; se SqliteStorage.deleteInactive). Kjøres ved oppstart og
// deretter periodisk. Klokken settes inn (ingen Date.now her), så jobben kan testes med injisert klokke.
//
// «Sist aktiv» er siste gang en enhet i husstanden gjorde et autentisert kall mot serveren (synk, Husstand-skjermen):
// seneste «sist sett» (minutt-oppløsning), ellers når husstanden ble opprettet. Inaktivitet er eneste kriterium. Det finnes
// ingen kontaktinformasjon, så ingen kan varsles før slettingen. Loggen får bare antall, aldri hvilke husstander.
import type { SyncStorage } from './storage/types';

export const DEFAULT_RETENTION_DAYS = 365;
/** Tokenutløp (SYNC_TOKEN_IDLE_DAYS): samme som oppbevaringstiden for inaktive husstander i piloten (730 dager), så en
 *  husstand kan åpnes, eksporteres og slettes i appen så lenge den ligger på serveren. */
export const DEFAULT_TOKEN_IDLE_DAYS = 730;
const DAY_MS = 86_400_000;
/** Høyst så mange husstander per transaksjon, så en stor opprydding ikke holder skrivelåsen lenge. */
const BATCH = 500;

/** Leser SYNC_RETENTION_DAYS. Tom: standard. 0: av. Ugyldig verdi gir standard og en advarsel (aldri «av» ved en skrivefeil). */
export function retentionDaysFrom(value: string | undefined, warn: (m: string) => void = console.warn): number {
  if (value === undefined || value.trim() === '') return DEFAULT_RETENTION_DAYS;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    warn(`SYNC_RETENTION_DAYS er ugyldig; bruker ${DEFAULT_RETENTION_DAYS} dager.`);
    return DEFAULT_RETENTION_DAYS;
  }
  return n;
}

/** Leser SYNC_TOKEN_IDLE_DAYS (dager uten bruk før et enhetstoken slutter å virke). Tom: standard. 0: aldri utløp. Ugyldig
 *  verdi gir standard og en advarsel (aldri «aldri utløp» ved en skrivefeil). */
export function tokenIdleDaysFrom(value: string | undefined, warn: (m: string) => void = console.warn): number {
  if (value === undefined || value.trim() === '') return DEFAULT_TOKEN_IDLE_DAYS;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    warn(`SYNC_TOKEN_IDLE_DAYS er ugyldig; bruker ${DEFAULT_TOKEN_IDLE_DAYS} dager.`);
    return DEFAULT_TOKEN_IDLE_DAYS;
  }
  return n;
}

/** Tokenutløpet i millisekunder for synk-API-et; `undefined` (= aldri) når dagene er 0. */
export function tokenIdleMsFrom(value: string | undefined, warn: (m: string) => void = console.warn): number | undefined {
  const days = tokenIdleDaysFrom(value, warn);
  return days > 0 ? days * DAY_MS : undefined;
}

/** Én runde: sletter alle husstander som sist var aktive før `now - days`. Returnerer antall. `days` 0 gjør ingenting. */
export async function runRetention(storage: SyncStorage, days: number, now: string): Promise<number> {
  if (!(days > 0)) return 0;
  const before = new Date(Date.parse(now) - days * DAY_MS).toISOString();
  let total = 0;
  for (;;) {
    const n = await storage.deleteInactive(before, BATCH);
    total += n;
    if (n < BATCH) return total;
  }
}

export interface RetentionJob { /** Første runde (ved oppstart). */ first: Promise<number>; stop: () => void }

/** Kjører en runde nå og deretter hver `intervalMs` (standard 6 t). Timeren holder ikke prosessen i live. */
export function startRetention(opts: {
  storage: SyncStorage; days: number; now: () => string; log?: (m: string) => void; intervalMs?: number;
}): RetentionJob {
  const log = opts.log ?? ((m: string) => console.log(m));
  if (!(opts.days > 0)) {
    log('Oppbevaring: automatisk sletting av inaktive husstander er av (SYNC_RETENTION_DAYS=0).');
    return { first: Promise.resolve(0), stop: () => {} };
  }
  let running = false;
  const round = async () => {
    if (running) return 0;
    running = true;
    try {
      const n = await runRetention(opts.storage, opts.days, opts.now());
      if (n > 0) log(`Oppbevaring: slettet ${n} husstand${n === 1 ? '' : 'er'} uten aktivitet på ${opts.days} dager.`);
      return n;
    } catch (e) {
      log(`oppbevaring-feil: ${e instanceof Error ? e.name : typeof e}`);
      return 0;
    } finally { running = false; }
  };
  const first = round();
  const timer = setInterval(() => { void round(); }, opts.intervalMs ?? 6 * 3_600_000);
  timer.unref?.();
  return { first, stop: () => clearInterval(timer) };
}
