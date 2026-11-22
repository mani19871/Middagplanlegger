// Lese-endepunkt for lagrede tilbud: GET /api/offers/lagret → samme form som live (/api/offers, LiveResponse) pluss
// `stored`, `oldestObserved` og `truncated`. Anonymt (tilbud er ikke husstandsdata), bare GET/HEAD, ingen parametre,
// ratebegrenset per IP, høyst `maxOffers` tilbud. Feilsvar er faste norske tekster; loggen får bare navnet på feilen.
// Se docs/sikkerhet.md (S21).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MAX_PRICE_AGE_DAYS } from '../../src/engine/prices';
import type { Ingredient } from '../../src/engine/types';
import type { LiveResponse } from '../../src/offers/client';
import { sortLive, toLiveOffer, type LiveOffer } from '../../src/offers/service';
import type { NormalizedOffer } from '../../src/offers/types';
import { ipKey, RateLimiter } from '../sync/rateLimit';
import { allowedImage } from './images';
import type { OfferObservation, OfferStore } from './types';

export const STORED_PATH = '/api/offers/lagret';
export interface OffersApiOptions {
  store: OfferStore;
  ingredients: Ingredient[];
  now?: () => string;
  /** Innsamlerens tilstand: feil uten noen vellykket henting gir «error» i stedet for «loading». */
  collector: () => { failures: number };
  /** Klientens IP fra siste adresse i X-Forwarded-For (bare bak én kjent proxy), som synk-API-et. */
  trustProxy?: boolean;
  /** Kall per IP per minutt. */ perMinute?: number;
  /** Høyst så mange tilbud i ett svar. */ maxOffers?: number;
  /** Tillatte bildeverter (TJEK_IMAGE_HOSTS). Andre bildeadresser fjernes fra svaret. Standard: ingen. */ imageHosts?: string[];
  log?: (m: string) => void;
}

const OSLO = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' });
const minusDays = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
/** Tilbake til kildens form: observasjonstiden er siste gang kilden viste prisen. Interne felt (status, første observasjon) holdes inne. */
const toOffer = (r: OfferObservation, hosts: string[]): NormalizedOffer => ({
  id: r.id, source: r.source, heading: r.heading, description: r.description, priceOre: r.priceOre, prePriceOre: r.prePriceOre,
  amount: r.amount, unit: r.unit, pieces: r.pieces, dealerId: r.dealerId, dealerName: r.dealerName,
  validFrom: r.validFrom, validUntil: r.validUntil, observed: r.lastObserved, image: allowedImage(r.image, hosts),
});

export function createOffersApi(o: OffersApiOptions) {
  const now = o.now ?? (() => new Date().toISOString());
  const log = o.log ?? ((m: string) => console.error(m));
  const perMinute = o.perMinute ?? 60;
  const maxOffers = o.maxOffers ?? 1500;
  const limiter = new RateLimiter();
  // Samme svar så lenge dagen og siste henting er de samme: ingen ny matching per kall.
  let memo: { key: string; body: string } | null = null;

  const send = (res: ServerResponse, status: number, body: unknown, head = false, extra: Record<string, string> = {}) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
    res.end(head ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  };

  async function build(today: string, last: string | null): Promise<string> {
    const failed = !last && o.collector().failures > 0;
    if (!last) {
      const r: LiveResponse = { status: failed ? 'error' : 'loading', error: failed ? 'Tilbud er ikke tilgjengelige akkurat nå.' : null, source: 'tjek', stored: true, observed: null, oldestObserved: null, offers: [], truncated: false };
      return JSON.stringify(r);
    }
    const key = `${today}|${last}`;
    if (memo?.key === key) return memo.body;
    // Bare priser sett innenfor aldersgrensen (src/engine/prices.ts); en eldre pris er ikke et tilbud i dag.
    const rows = await o.store.current({ today, observedSince: minusDays(today, MAX_PRICE_AGE_DAYS), limit: maxOffers * 4 });
    const live: LiveOffer[] = [];
    for (const r of rows) { const l = toLiveOffer(toOffer(r, o.imageHosts ?? []), o.ingredients, today); if (l) live.push(l); }
    sortLive(live);
    const shown = live.slice(0, maxOffers);
    const oldest = shown.reduce<string | null>((m, l) => (m === null || l.offer.observed < m ? l.offer.observed : m), null);
    const r: LiveResponse = { status: 'ok', error: null, source: 'tjek', stored: true, observed: last, oldestObserved: oldest, offers: shown, truncated: live.length > shown.length || rows.length >= maxOffers * 4 };
    memo = { key, body: JSON.stringify(r) };
    return memo.body;
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const raw = req.url ?? '/';
    const path = raw.split('?')[0];
    if (path !== STORED_PATH) return false;
    const fwd = o.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',').map((x) => x.trim()).filter(Boolean).pop() ?? '' : '';
    const t = Date.parse(now());
    if (!limiter.hit(`ip:${ipKey(fwd || req.socket.remoteAddress || 'ukjent')}`, perMinute, 60_000, t)) {
      send(res, 429, { error: 'for_mange_forespørsler', message: 'For mange forespørsler. Vent litt og prøv igjen.' }, false, { 'Retry-After': '60' });
      return true;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      send(res, 405, { error: 'ugyldig_forespørsel', message: 'Metoden er ikke tillatt.' }, false, { Allow: 'GET, HEAD' });
      return true;
    }
    if (raw.includes('?')) { send(res, 400, { error: 'ugyldig_forespørsel', message: 'Ugyldig forespørsel.' }); return true; }
    try {
      const body = await build(OSLO.format(new Date(t)), await o.store.lastFetch());
      send(res, 200, body, req.method === 'HEAD');
    } catch (e) {
      log(`tilbud-lager-feil: ${e instanceof Error ? e.name : typeof e}`);
      send(res, 500, { error: 'serverfeil', message: 'Noe gikk galt på serveren.' });
    }
    return true;
  };
}
