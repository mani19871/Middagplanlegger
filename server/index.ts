// Liten server: henter tilbud live fra Tjek, holder dem i minnet (ingen lagring) og serverer dem til appen.
// Serverer også synk-API-et for delt husstand (server/sync/api.ts, docs/synk.md) og appen (dist/).
// Sikkerhetshoder, statiske filer og krasjvern ligger i server/app.ts (docs/sikkerhet.md).
// Start: npm run server  (NODE_USE_ENV_PROXY=1 hvis du er bak proxy). Port: PORT (standard 8787).
import { mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { ingredients } from '../src/data/catalog';
import { collectOffers, type LiveOffer } from '../src/offers/service';
import { TjekSource } from '../src/offers/tjek';
import { createApp } from './app';
import { SqliteStorage } from './storage/sqlite';
import { createSyncApi } from './sync/api';

const PORT = Number(process.env.PORT ?? 8787);
// Synk: husstand, hendelser og dokumenter i en lokal SQLite-fil (SYNC_DB, ellers $DATA_DIR/middag.sqlite,
// ellers data/middag.sqlite).
// Tilbud fra Tjek lagres aldri her; de holdes bare i minnet under.
const DB = process.env.SYNC_DB ?? join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'middag.sqlite');
if (DB !== ':memory:') mkdirSync(dirname(DB), { recursive: true });
if (!process.env.SYNC_SECRET) console.warn('SYNC_SECRET mangler: invitasjonskoder blir ugyldige når serveren startes på nytt.');
// Token som ikke er brukt på SYNC_TOKEN_IDLE_DAYS dager slutter å virke (0 = av). SYNC_MAX_TOTAL_MB: tak for alle
// husstanders hendelser samlet (vern mot full disk). Se docs/sikkerhet.md.
const idleDays = Number(process.env.SYNC_TOKEN_IDLE_DAYS ?? 180);
const totalMb = Number(process.env.SYNC_MAX_TOTAL_MB ?? 0);
const syncApi = createSyncApi({
  storage: new SqliteStorage(DB), secret: process.env.SYNC_SECRET, trustProxy: process.env.TRUST_PROXY === '1',
  tokenIdleMs: Number.isFinite(idleDays) && idleDays > 0 ? idleDays * 86_400_000 : undefined,
  quotas: Number.isFinite(totalMb) && totalMb > 0 ? { totalEventBytes: totalMb * 1024 * 1024 } : undefined,
});
const TTL_MS = 6 * 60 * 60 * 1000;
/** Etter en feil mot Tjek venter vi før neste forsøk, så anonyme kall til /api/offers ikke kan hamre på Tjek. */
const RETRY_MS = 5 * 60 * 1000;
const oslo = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });

const source = new TjekSource(
  (url, init) => fetch(url, { headers: { ...init?.headers, 'User-Agent': 'Middagsplanlegger/0.1' } }),
  () => new Date().toISOString(),
);

interface Cache { offers: LiveOffer[]; observed: string; day: string }
let cache: Cache | null = null;
let refreshing: Promise<void> | null = null;
let failedAt = 0;

function refresh() {
  if (refreshing || Date.now() - failedAt < RETRY_MS) return;
  const day = oslo();
  refreshing = collectOffers(source, ingredients, { country: 'NO', today: day })
    .then((offers) => { cache = { offers, observed: new Date().toISOString(), day }; failedAt = 0; })
    // Detaljen (statuskode og sti hos Tjek) logges her, men sendes ikke til appen.
    .catch((e: unknown) => { failedAt = Date.now(); console.error('tilbud-feil:', e instanceof Error ? e.message : String(e)); })
    .finally(() => { refreshing = null; });
}

function offers(req: IncomingMessage, res: ServerResponse): boolean {
  if ((req.url ?? '').split('?')[0] !== '/api/offers') return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD'); res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'ugyldig_forespørsel', message: 'Metoden er ikke tillatt.' }));
    return true;
  }
  if (!cache || Date.now() - Date.parse(cache.observed) > TTL_MS || cache.day !== oslo()) refresh();
  const failed = !cache && failedAt > 0;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    status: cache ? 'ok' : failed ? 'error' : 'loading', error: failed ? 'Tilbud er ikke tilgjengelige akkurat nå.' : null, source: 'tjek',
    observed: cache?.observed ?? null, offers: cache?.offers ?? [],
  }));
  return true;
}

// Rekkefølge: synk-API, så tilbud (bare i minnet), så statiske filer. Tilbud når aldri synk-lagringen.
const handlers = [
  syncApi,
  offers,
];
const app = createApp({ dist: join(process.cwd(), 'dist'), handlers, hsts: process.env.HSTS === '1' });
const server = createServer(app);
// Korte tidsavbrudd mot trege klienter (slowloris). Proxyen foran bør ha egne grenser i tillegg.
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;
server.listen(PORT, () => console.log(`Middagsplanlegger-server på http://localhost:${PORT}`));
