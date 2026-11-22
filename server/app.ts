// HTTP-laget for serveren: sikkerhetshoder på alle svar, synk-API, egne ruter (tilbud) og en trygg statisk filtjener.
// Skilt ut fra server/index.ts så det kan testes uten å starte Tjek-oppslag (server/sync/security.test.ts).
// Se docs/sikkerhet.md.
import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';

/**
 * Streng CSP for appen. Vite-bygget har ingen inline-skript eller -stiler (React setter stiler via CSSOM, som CSP ikke
 * stopper). Alt lastes fra samme opprinnelse; eneste mulige tredjepart er bilder (produktbilder og avissider) fra Tjeks
 * verter i `imageHosts` (TJEK_IMAGE_HOSTS, server/offers/images.ts), bare i img-src og bare over https. Trusted Types
 * hindrer at strenger blir HTML/skript (DOM-XSS) i nettlesere som støtter det. Testet med Playwright: scripts/checks/csp.cjs.
 */
export function appCsp(imageHosts: string[] = []): string {
  // Bare eksakte vertsnavn: en verdi med mellomrom, semikolon eller jokertegn ville kunnet utvide andre direktiver.
  for (const h of imageHosts) if (!/^[a-z0-9.-]+\.[a-z]{2,63}$/.test(h)) throw new Error('ugyldig bildevert i CSP');
  const img = ["img-src 'self' data:", ...imageHosts.map((h) => `https://${h}`)].join(' ');
  return [
    "default-src 'self'", "script-src 'self'", "style-src 'self'", img, "font-src 'self'",
    "connect-src 'self'", "manifest-src 'self'", "worker-src 'self'", "object-src 'none'", "base-uri 'none'",
    "form-action 'self'", "frame-ancestors 'none'", "require-trusted-types-for 'script'", 'trusted-types sw',
  ].join('; ');
}
export const APP_CSP = appCsp();
/** API-svar er bare JSON og skal aldri tolkes som et dokument. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.map': 'application/json; charset=utf-8',
};

export type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean> | boolean;
export interface AppOptions {
  /** Katalog med produksjonsbygget (dist/). */
  dist: string;
  /** Ruter som prøves i rekkefølge før statiske filer (synk-API, tilbud). Returnerer true når de har svart. */
  handlers?: Handler[];
  /** Strict-Transport-Security. Bare når appen alltid nås over HTTPS (f.eks. bak Caddy). Miljøvariabel HSTS=1. */
  hsts?: boolean;
  /** Feillogg. Får aldri URL, hoder, kropp, token eller koder; bare navnet på feilen. */
  log?: (msg: string) => void;
  /** Tillatte bildeverter hos Tjek (img-src). Tom: bare egne bilder. */
  imageHosts?: string[];
}

function json(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  if (res.headersSent) { res.destroy(); return; }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

/** Filen under `dist` som stien peker på, eller null. Aldri utenfor `dist`, aldri skjulte filer (segment som starter med punktum). */
export function staticFile(dist: string, pathname: string): string | null {
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.includes('%')) return null;
  const segs = pathname.split('/').filter(Boolean);
  if (segs.some((s) => s.startsWith('.'))) return null;
  const root = resolve(dist);
  const file = resolve(root, ...segs);
  if (file !== root && !file.startsWith(root + sep)) return null;
  try { return existsSync(file) && statSync(file).isFile() ? file : null; } catch { return null; }
}

export function createApp(opts: AppOptions) {
  const log = opts.log ?? ((m: string) => console.error(m));
  const handlers = opts.handlers ?? [];
  const dist = resolve(opts.dist);
  const csp = appCsp(opts.imageHosts ?? []);

  function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL) {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') { json(res, 405, { error: 'ugyldig_forespørsel', message: 'Metoden er ikke tillatt.' }, { Allow: 'GET, HEAD' }); return; }
    // Ukjente API-stier gir 404 som JSON, ikke appens forside.
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) { json(res, 404, { error: 'ikke_funnet', message: 'Fant ikke det du ba om.' }); return; }
    let file = staticFile(dist, url.pathname);
    // Appen er en enkeltside-app: stier uten filendelse får forsiden. En manglende fil (f.eks. gammelt JS-bunt) gir 404.
    if (!file && !extname(url.pathname)) file = staticFile(dist, '/index.html');
    if (!file) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(existsSync(resolve(dist, 'index.html')) ? 'Fant ikke filen.' : 'Ikke bygget. Kjør npm run build.');
      return;
    }
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    // Filer under /assets/ har innholdshash i navnet og endres aldri. Resten (index.html, sw.js, manifest) sjekkes hver gang.
    res.setHeader('Cache-Control', url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    const stream = createReadStream(file);
    stream.on('error', (e) => {
      log(`statisk fil: ${e.name}`);
      if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end('Noe gikk galt.'); } else res.destroy();
    });
    stream.pipe(res);
  }

  return async function app(req: IncomingMessage, res: ServerResponse): Promise<void> {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    if (opts.hsts) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    try {
      let url: URL;
      // req.url kan være hva som helst (f.eks. «http://[»). new URL kaster da; uten denne sjekken krasjet hele prosessen.
      try { url = new URL(req.url ?? '/', 'http://localhost'); } catch { json(res, 400, { error: 'ugyldig_forespørsel', message: 'Ugyldig forespørsel.' }); return; }
      const isApi = url.pathname === '/api' || url.pathname.startsWith('/api/');
      res.setHeader('Content-Security-Policy', isApi ? API_CSP : csp);
      for (const h of handlers) if (await h(req, res)) return;
      serveStatic(req, res, url);
    } catch (e) {
      log(`serverfeil: ${e instanceof Error ? e.name : typeof e}`);
      json(res, 500, { error: 'serverfeil', message: 'Noe gikk galt på serveren.' });
    }
  };
}
