// Kundeaviser fra Tjek: GET /api/aviser (gjeldende og kommende aviser) og GET /api/aviser/:id/sider (sidenes bildeadresser).
// Brukeren opplyser (2026-11-22) at Tjek-avtalen tillater avissider (phase0/tjek-avtale.md). Vi laster ikke ned og lagrer
// ikke bildene: svaret har bare adresser hos Tjek, og bare til verter i TJEK_IMAGE_HOSTS (ellers null). Lista holdes i minnet
// (6 t), sidene per avis likeså, med tak på antall aviser. Tjek kalles bare for aviser som står i lista, så ingen kan bruke
// oss til vilkårlige oppslag. Anonymt, bare GET/HEAD, ingen parametre, ratebegrenset per IP. Se docs/sikkerhet.md (S22).
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Catalog, CatalogPage } from '../../src/offers/types';
import { ipKey, RateLimiter } from '../sync/rateLimit';
import { allowedImage } from './images';

export interface PapersApiOptions {
  listCatalogs: () => Promise<Catalog[]>;
  catalogPages: (id: string) => Promise<CatalogPage[]>;
  imageHosts: string[];
  now?: () => string;
  log?: (m: string) => void;
  trustProxy?: boolean;
  /** Kall per IP per minutt (begge endepunktene samlet). */ perMinute?: number;
  /** Hvor lenge lista og sidene holdes i minnet. */ ttlMs?: number;
  /** Ventetid etter en feil hos Tjek før nytt forsøk. */ retryMs?: number;
  /** Høyst så mange aviser i lista og sider per avis. */ maxCatalogs?: number; maxPages?: number;
  /** Høyst så mange avisers sider i minnet samtidig (eldste kastes). */ maxCachedCatalogs?: number;
}
export interface PapersResponse {
  status: 'ok' | 'loading' | 'error'; error: string | null; source: 'tjek';
  /** Når lista ble hentet fra Tjek. */ observed: string | null;
  /** Har driften tillatt bildeverter? Uten dem kan sidene ikke vises. */ imagesAllowed: boolean;
  catalogs: Catalog[];
}
export interface PagesResponse { status: 'ok' | 'error'; error: string | null; source: 'tjek'; observed: string | null; imagesAllowed: boolean; catalog: Catalog | null; pages: CatalogPage[] }

const OSLO = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' });
const plusDays = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const LIST_ERROR = 'Kundeavisene er ikke tilgjengelige akkurat nå.';
const PAGES_ERROR = 'Avissidene er ikke tilgjengelige akkurat nå.';
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function createPapersApi(o: PapersApiOptions) {
  const now = o.now ?? (() => new Date().toISOString());
  const log = o.log ?? ((m: string) => console.error(m));
  const ttl = o.ttlMs ?? 6 * 3_600_000;
  const retry = o.retryMs ?? 5 * 60_000;
  const maxCatalogs = o.maxCatalogs ?? 400, maxPages = o.maxPages ?? 200, maxCached = o.maxCachedCatalogs ?? 100;
  const limiter = new RateLimiter();
  const imagesAllowed = o.imageHosts.length > 0;
  let list: { at: string; catalogs: Catalog[] } | null = null;
  let listFailedAt = 0;
  let listLoading: Promise<void> | null = null;
  const pages = new Map<string, { at: number; pages: CatalogPage[] }>();
  const pagesFailedAt = new Map<string, number>();
  const pagesLoading = new Map<string, Promise<void>>();

  const t = () => Date.parse(now());
  const today = () => OSLO.format(new Date(t()));
  /** Gjeldende og kommende (fra innen 7 dager), sortert på kjede, start og id. */
  const visible = (cs: Catalog[]) => {
    const d = today(), horizon = plusDays(d, 7);
    return cs.filter((c) => c.validUntil >= d && c.validFrom <= horizon)
      .sort((a, b) => a.dealerName.localeCompare(b.dealerName, 'nb') || a.validFrom.localeCompare(b.validFrom) || a.id.localeCompare(b.id))
      .slice(0, maxCatalogs);
  };

  async function loadList(): Promise<void> {
    const fresh = list && t() - Date.parse(list.at) < ttl;
    if (fresh || t() - listFailedAt < retry) return;
    if (!listLoading) {
      const at = now();
      listLoading = o.listCatalogs()
        .then((cs) => { list = { at, catalogs: cs }; listFailedAt = 0; })
        // Bare navnet på feilen: meldingen kan ha sti og statuskode fra Tjek (docs/sikkerhet.md, S10).
        .catch((e: unknown) => { listFailedAt = t(); log(`aviser-feil: ${e instanceof Error ? e.name : typeof e}`); })
        .finally(() => { listLoading = null; });
    }
    await listLoading;
  }

  async function loadPages(id: string): Promise<boolean> {
    const hit = pages.get(id);
    if (hit && t() - hit.at < ttl) return true;
    if (t() - (pagesFailedAt.get(id) ?? 0) < retry) return false;
    let p = pagesLoading.get(id);
    if (!p) {
      p = o.catalogPages(id)
        .then((ps) => {
          pages.delete(id);
          pages.set(id, { at: t(), pages: ps.slice(0, maxPages) });
          while (pages.size > maxCached) pages.delete(pages.keys().next().value!);
          pagesFailedAt.delete(id);
        })
        .catch((e: unknown) => { pagesFailedAt.set(id, t()); log(`avisside-feil: ${e instanceof Error ? e.name : typeof e}`); })
        .finally(() => { pagesLoading.delete(id); });
      pagesLoading.set(id, p);
    }
    await p;
    return pages.has(id);
  }

  const send = (res: ServerResponse, status: number, body: unknown, head = false, extra: Record<string, string> = {}) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
    res.end(head ? undefined : JSON.stringify(body));
  };
  const notFound = (res: ServerResponse) => send(res, 404, { error: 'ikke_funnet', message: 'Fant ikke det du ba om.' });

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const raw = req.url ?? '/';
    const path = raw.split('?')[0];
    if (path !== '/api/aviser' && !path.startsWith('/api/aviser/')) return false;
    const fwd = o.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',').map((x) => x.trim()).filter(Boolean).pop() ?? '' : '';
    if (!limiter.hit(`ip:${ipKey(fwd || req.socket.remoteAddress || 'ukjent')}`, o.perMinute ?? 60, 60_000, t())) {
      send(res, 429, { error: 'for_mange_forespørsler', message: 'For mange forespørsler. Vent litt og prøv igjen.' }, false, { 'Retry-After': '60' });
      return true;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, { error: 'ugyldig_forespørsel', message: 'Metoden er ikke tillatt.' }, false, { Allow: 'GET, HEAD' });
      return true;
    }
    if (raw.includes('?')) { send(res, 400, { error: 'ugyldig_forespørsel', message: 'Ugyldig forespørsel.' }); return true; }
    const head = req.method === 'HEAD';
    try {
      if (path === '/api/aviser') {
        await loadList();
        const failed = !list && listFailedAt > 0;
        const body: PapersResponse = {
          status: list ? 'ok' : failed ? 'error' : 'loading', error: failed ? LIST_ERROR : null, source: 'tjek',
          observed: list?.at ?? null, imagesAllowed, catalogs: list ? visible(list.catalogs) : [],
        };
        send(res, 200, body, head);
        return true;
      }
      const m = /^\/api\/aviser\/([^/]+)\/sider$/.exec(path);
      if (!m || !ID.test(m[1])) { notFound(res); return true; }
      await loadList();
      // Bare aviser som står i lista: ingen vilkårlige oppslag hos Tjek via oss (kallbudsjett, § 8.4).
      const catalog = list ? visible(list.catalogs).find((c) => c.id === m[1]) ?? null : null;
      if (!catalog) { notFound(res); return true; }
      const ok = await loadPages(catalog.id);
      const ps = (pages.get(catalog.id)?.pages ?? []).map((p) => ({
        number: p.number, thumb: allowedImage(p.thumb, o.imageHosts), view: allowedImage(p.view, o.imageHosts), zoom: allowedImage(p.zoom, o.imageHosts),
      }));
      const at = pages.get(catalog.id)?.at;
      const body: PagesResponse = {
        status: ok ? 'ok' : 'error', error: ok ? null : PAGES_ERROR, source: 'tjek', observed: at ? new Date(at).toISOString() : null,
        imagesAllowed, catalog, pages: ps,
      };
      send(res, 200, body, head);
    } catch (e) {
      log(`aviser-feil: ${e instanceof Error ? e.name : typeof e}`);
      send(res, 500, { error: 'serverfeil', message: 'Noe gikk galt på serveren.' });
    }
    return true;
  };
}
