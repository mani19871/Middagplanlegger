// Liten server: henter tilbud live fra Tjek, holder dem i minnet (ingen lagring) og serverer dem til appen.
// Start: npm run server  (NODE_USE_ENV_PROXY=1 hvis du er bak proxy). Port: PORT (standard 8787).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { ingredients } from '../src/data/catalog';
import { collectOffers, type LiveOffer } from '../src/offers/service';
import { TjekSource } from '../src/offers/tjek';

const PORT = Number(process.env.PORT ?? 8787);
const TTL_MS = 6 * 60 * 60 * 1000;
const oslo = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });

const source = new TjekSource(
  (url, init) => fetch(url, { headers: { ...init?.headers, 'User-Agent': 'Middagsplanlegger/0.1' } }),
  () => new Date().toISOString(),
);

interface Cache { offers: LiveOffer[]; observed: string; day: string }
let cache: Cache | null = null;
let refreshing: Promise<void> | null = null;
let lastError: string | null = null;

function refresh() {
  if (refreshing) return;
  const day = oslo();
  refreshing = collectOffers(source, ingredients, { country: 'NO', today: day })
    .then((offers) => { cache = { offers, observed: new Date().toISOString(), day }; lastError = null; })
    .catch((e: unknown) => { lastError = e instanceof Error ? e.message : String(e); })
    .finally(() => { refreshing = null; });
}

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const DIST = join(process.cwd(), 'dist');

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/offers') {
    if (!cache || Date.now() - Date.parse(cache.observed) > TTL_MS || cache.day !== oslo()) refresh();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      status: cache ? 'ok' : lastError ? 'error' : 'loading', error: cache ? null : lastError, source: 'tjek',
      observed: cache?.observed ?? null, offers: cache?.offers ?? [],
    }));
    return;
  }
  // Statiske filer (produksjonsbygg)
  const rel = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  let file = join(DIST, rel);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  if (!existsSync(file)) { res.statusCode = 404; res.end('Ikke bygget. Kjør npm run build.'); return; }
  res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Middagsplanlegger-server på http://localhost:${PORT}`));
