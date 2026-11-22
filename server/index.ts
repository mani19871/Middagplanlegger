// Liten server: henter tilbud fra Tjek, lagrer dem i en egen tilbudsdatabase (server/offers/, ikke synk-databasen) og
// serverer dem til appen (/api/offers/lagret), med live-visningen i minnet som reserve (/api/offers).
// Serverer også synk-API-et for delt husstand (server/sync/api.ts, docs/synk.md) og appen (dist/).
// Sikkerhetshoder, statiske filer og krasjvern ligger i server/app.ts (docs/sikkerhet.md).
// Start: npm run server  (NODE_USE_ENV_PROXY=1 hvis du er bak proxy). Port: PORT (standard 8787).
import { existsSync, mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { ingredients } from '../src/data/catalog';
import { collectHousehold } from '../src/offers/household';
import { collectOffers, type LiveOffer } from '../src/offers/service';
import type { NormalizedOffer } from '../src/offers/types';
import { TjekSource } from '../src/offers/tjek';
import { createApp } from './app';
import { createOffersApi } from './offers/api';
import { CallBudget, startOfferCollector, type OfferCollector } from './offers/collector';
import { offerConfigFrom } from './offers/config';
import { allowedImage, foreignHost, imageHostsFrom } from './offers/images';
import { createPapersApi } from './offers/papers';
import { SqliteOfferStore } from './offers/sqlite';
import { retentionDaysFrom, startRetention, tokenIdleMsFrom } from './retention';
import { SqliteStorage } from './storage/sqlite';
import { createSyncApi } from './sync/api';

const PORT = Number(process.env.PORT ?? 8787);
// Synk: husstand, hendelser og dokumenter i en lokal SQLite-fil (SYNC_DB, ellers $DATA_DIR/middag.sqlite,
// ellers data/middag.sqlite).
// Tilbud fra Tjek lagres aldri her, men i en egen fil (OFFER_DB, under).
const DB = process.env.SYNC_DB ?? join(process.env.DATA_DIR ?? join(process.cwd(), 'data'), 'middag.sqlite');
if (DB !== ':memory:') mkdirSync(dirname(DB), { recursive: true });
if (!process.env.SYNC_SECRET) console.warn('SYNC_SECRET mangler: invitasjonskoder blir ugyldige når serveren startes på nytt.');
// Token som ikke er brukt på SYNC_TOKEN_IDLE_DAYS dager slutter å virke (standard 730, 0 = aldri). Se server/retention.ts. SYNC_MAX_TOTAL_MB: tak for alle
// husstanders hendelser samlet (vern mot full disk). Se docs/sikkerhet.md.
const dbExisted = DB !== ':memory:' && existsSync(DB);
const totalMb = Number(process.env.SYNC_MAX_TOTAL_MB ?? 0);
// Husstander uten aktivitet i SYNC_RETENTION_DAYS dager slettes automatisk (standard 730, 0 = av). Se server/retention.ts.
const retentionDays = retentionDaysFrom(process.env.SYNC_RETENTION_DAYS);
const storage = new SqliteStorage(DB);
// Oppstartskontroll uten innhold: feil eller manglende volum gir ellers en stille, tom database.
if (DB === ':memory:') console.warn('Synk-databasen ligger bare i minnet (SYNC_DB=:memory:): alt forsvinner ved omstart.');
else if (!dbExisted) console.warn(`Synk-databasen fantes ikke og er opprettet tom: ${DB}. Er volumet montert riktig? (Ventet ved første oppstart.)`);
else console.log(`Synk-databasen: ${DB} (${storage.counts().households} husstander).`);
const syncApi = createSyncApi({
  storage, secret: process.env.SYNC_SECRET, trustProxy: process.env.TRUST_PROXY === '1',
  tokenIdleMs: tokenIdleMsFrom(process.env.SYNC_TOKEN_IDLE_DAYS),
  quotas: Number.isFinite(totalMb) && totalMb > 0 ? { totalEventBytes: totalMb * 1024 * 1024 } : undefined,
  retentionDays,
});
startRetention({ storage, days: retentionDays, now: () => new Date().toISOString() });
const TTL_MS = 6 * 60 * 60 * 1000;
/** Etter en feil mot Tjek venter vi før neste forsøk, så anonyme kall til /api/offers ikke kan hamre på Tjek. */
const RETRY_MS = 5 * 60 * 1000;
const oslo = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });

// Tilbud og priser fra Tjek: lagres i en egen SQLite-fil uten persondata (brukerens opplysning: avtalen tillater lagring
// av priser; phase0/tjek-avtale.md). Kallbudsjettet teller alle kall mot Tjek, også fra live-visningen.
const offerCfg = offerConfigFrom(process.env);
const budget = new CallBudget(offerCfg.maxCallsPerDay, oslo);
const source = new TjekSource(
  // Tidsavbrudd per kall: et Tjek som henger skal gi feil (og nedkjøling), ikke «loading» i mange minutter.
  (url, init) => { budget.take(); return fetch(url, { headers: { ...init?.headers, 'User-Agent': 'Middagsplanlegger/0.1' }, signal: AbortSignal.timeout(15_000) }); },
  () => new Date().toISOString(),
);
const collectNow = () => collectOffers(source, ingredients, { country: 'NO', today: oslo() });
// Husholdningstilbud (utvidelse C): ett søk per vare i src/data/household-rules.json, i samme runde og samme kallbudsjett.
const collectHouseNow = () => collectHousehold(source, { country: 'NO', today: oslo() });
// Produktbilder og avissider lastes av nettleseren direkte fra Tjek, bare fra verter i TJEK_IMAGE_HOSTS (CSP img-src).
// Tom liste: ingen bilder. Formprøven 2026-11-22 fant én vert, image-transformer-api.tjek.com (phase0/tjek-formprøve.md);
// serveren logger fortsatt vertsnavn den ser som ikke er tillatt.
const imageHosts = imageHostsFrom(process.env.TJEK_IMAGE_HOSTS);
const withImages = (list: LiveOffer[]) => list.map((l) => ({ ...l, offer: { ...l.offer, image: allowedImage(l.offer.image, imageHosts) } }));
const loggedHosts = new Set<string>();
function logForeignHosts(list: LiveOffer[]) {
  const fresh = new Set<string>();
  for (const l of list) { const h = foreignHost(l.offer.image, imageHosts); if (h && !loggedHosts.has(h)) fresh.add(h); }
  if (fresh.size) { for (const h of fresh) loggedHosts.add(h); console.log(`Tilbud: bilder fra verter som ikke er i TJEK_IMAGE_HOSTS (vises ikke): ${[...fresh].sort().join(', ')}`); }
}

interface Cache { offers: LiveOffer[]; other: NormalizedOffer[]; observed: string; day: string }
let cache: Cache | null = null;
let refreshing: Promise<void> | null = null;
let failedAt = 0;

if (offerCfg.db !== ':memory:' && offerCfg.store) mkdirSync(dirname(offerCfg.db), { recursive: true });
const offerStore = offerCfg.store ? new SqliteOfferStore(offerCfg.db) : null;
let collector: OfferCollector | null = null;
if (offerStore) {
  void offerStore.counts().then((n) => console.log(`Tilbudslagring: ${offerCfg.db === ':memory:' ? 'bare i minnet' : offerCfg.db} (${n.observations} observasjoner, ${n.chains} kjeder).`));
  if (offerCfg.fetch) {
    // Periodisk henting med bakoff; den holder også live-visningen i minnet oppdatert, så /api/offers ikke henter selv.
    collector = startOfferCollector({
      collect: collectNow, collectOther: collectHouseNow, store: offerStore, country: 'NO', now: () => new Date().toISOString(),
      intervalMs: offerCfg.refreshMs, retryMs: RETRY_MS, retentionDays: offerCfg.retentionDays,
      onCollected: (offers, at, other) => { cache = { offers, other, observed: at, day: oslo() }; logForeignHosts(offers); },
    });
  }
}
if (!offerCfg.fetch) console.log('Tilbud: henting fra Tjek er av (TJEK_FETCH=0).');

function refresh() {
  // Med innsamleren henter den; ellers hentes det ved behov (uten lagring, som før).
  if (collector || !offerCfg.fetch || refreshing || Date.now() - failedAt < RETRY_MS) return;
  const day = oslo();
  refreshing = collectNow()
    .then(async (offers) => {
      // Husholdningssøket er et tillegg: feiler det, vises mattilbudene likevel (bare feilens navn logges).
      const other = await collectHouseNow().catch((e: unknown) => { console.error(`tilbud-feil husholdning: ${e instanceof Error ? e.name : typeof e}`); return [] as NormalizedOffer[]; });
      cache = { offers, other, observed: new Date().toISOString(), day }; failedAt = 0; logForeignHosts(offers);
    })
    // Bare navnet på feilen logges (meldingen har statuskode og sti hos Tjek); ingenting av det sendes til appen.
    .catch((e: unknown) => { failedAt = Date.now(); console.error(`tilbud-feil: ${e instanceof Error ? e.name : typeof e}`); })
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
  const failed = !cache && (failedAt > 0 || (collector?.state().failures ?? 0) > 0 || !offerCfg.fetch);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    status: cache ? 'ok' : failed ? 'error' : 'loading', error: failed ? 'Tilbud er ikke tilgjengelige akkurat nå.' : null, source: 'tjek',
    observed: cache?.observed ?? null, offers: withImages(cache?.offers ?? []),
    other: (cache?.other ?? []).map((o) => ({ ...o, image: allowedImage(o.image, imageHosts) })),
  }));
  return true;
}

// Rekkefølge: synk-API, lagrede tilbud, live-tilbud (minnet), statiske filer. Tilbud når aldri synk-lagringen.
const handlers = [
  syncApi,
  ...(offerStore ? [createOffersApi({ store: offerStore, ingredients, imageHosts, collector: () => collector?.state() ?? { failures: offerCfg.fetch ? 0 : 1 }, trustProxy: process.env.TRUST_PROXY === '1' })] : []),
  offers,
  // Kundeaviser fra Tjek (lista og sidenes bildeadresser i minnet, ingen bildefiler hos oss). Med TJEK_FETCH=0: «error».
  createPapersApi({
    listCatalogs: () => (offerCfg.fetch ? source.listCatalogs('NO') : Promise.reject(new Error('av'))),
    catalogPages: (id) => (offerCfg.fetch ? source.catalogPages(id) : Promise.reject(new Error('av'))),
    imageHosts, trustProxy: process.env.TRUST_PROXY === '1',
    // Henting av: «error» er ventet og logges ikke (oppstarten sier allerede fra).
    log: offerCfg.fetch ? undefined : () => {},
  }),
];
const app = createApp({ dist: join(process.cwd(), 'dist'), handlers, hsts: process.env.HSTS === '1', imageHosts });
const server = createServer(app);
// Korte tidsavbrudd mot trege klienter (slowloris). Proxyen foran bør ha egne grenser i tillegg.
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;
server.listen(PORT, () => console.log(`Middagsplanlegger-server på http://localhost:${PORT}`));

// Ryddig avslutning på SIGTERM/SIGINT (docker stop, systemd). Som PID 1 i Docker får `node` ingen standard signalhåndtering,
// så uten dette venter `docker stop` ut fristen (10 s) og dreper prosessen midt i en skriving. Nye forbindelser avvises,
// åpne avsluttes, databasen lukkes (SQLite tømmer WAL ved siste lukking), og prosessen går ut med 0.
let stopping = false;
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    if (stopping) return;
    stopping = true;
    console.log(`${sig}: avslutter.`);
    const force = setTimeout(() => process.exit(1), 8_000);
    force.unref();
    collector?.stop();
    server.close(() => {
      const closing = [storage.close()];
      if (offerStore) closing.push(offerStore.close());
      Promise.allSettled(closing).finally(() => process.exit(0));
    });
    server.closeAllConnections();
  });
}
