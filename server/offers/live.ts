// GET /api/offers: live tilbud fra minnet (hentet fra Tjek av server/index.ts). Ratebegrensning per IP før svaret bygges og
// før et eventuelt nytt oppslag startes (kodegjennomgang O8; samme mønster som /api/offers/lagret). Ingen IP i loggen.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ipKey, RateLimiter } from '../sync/rateLimit';

export const LIVE_PATH = '/api/offers';

export interface LiveOffersOptions {
  /** Svaret (allerede uten interne felt). Kalles bare for godkjente GET/HEAD. */
  body: () => unknown;
  /** Kalles før svaret bygges, f.eks. for å starte en ny henting når hurtigbufferen er gammel. */
  onRequest?: () => void;
  /** Kall per minutt per IP. Standard 60. */
  perMinute?: number;
  /** Bak en proxy: siste adresse i X-Forwarded-For (TRUST_PROXY=1). */
  trustProxy?: boolean;
  /** Klokke i ms (tester). */
  now?: () => number;
}

export function createLiveOffersHandler(o: LiveOffersOptions) {
  const limiter = new RateLimiter();
  const perMinute = o.perMinute ?? 60;
  const now = o.now ?? (() => Date.now());
  const json = (res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}, head = false) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
    res.end(head ? undefined : JSON.stringify(body));
  };
  return function handle(req: IncomingMessage, res: ServerResponse): boolean {
    if ((req.url ?? '').split('?')[0] !== LIVE_PATH) return false;
    const fwd = o.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',').map((x) => x.trim()).filter(Boolean).pop() ?? '' : '';
    if (!limiter.hit(`ip:${ipKey(fwd || req.socket.remoteAddress || 'ukjent')}`, perMinute, 60_000, now())) {
      json(res, 429, { error: 'for_mange_forespørsler', message: 'For mange forespørsler. Vent litt og prøv igjen.' }, { 'Retry-After': '60' });
      return true;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      json(res, 405, { error: 'ugyldig_forespørsel', message: 'Metoden er ikke tillatt.' }, { Allow: 'GET, HEAD' });
      return true;
    }
    o.onRequest?.();
    json(res, 200, o.body(), {}, req.method === 'HEAD');
    return true;
  };
}
