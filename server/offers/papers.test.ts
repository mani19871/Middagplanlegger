// Kundeaviser fra Tjek: GET /api/aviser og GET /api/aviser/:id/sider (server/offers/papers.ts). Ingen lagring av bilder;
// sidene er adresser hos Tjek, bare til verter i TJEK_IMAGE_HOSTS. Tjek kalles bare for kjente kataloger, med hurtigbuffer.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Catalog, CatalogPage } from '../../src/offers/types';
import { createApp } from '../app';
import { createPapersApi, type PapersApiOptions } from './papers';

const cat = (id: string, over: Partial<Catalog> = {}): Catalog => ({
  id, source: 'tjek', dealerId: 'd1', dealerName: 'KIWI', label: 'Uke 48', validFrom: '2026-11-23', validUntil: '2026-11-29', pageCount: 2, observed: '2026-11-24T09:00:00.000Z', ...over,
});
const pages = (): CatalogPage[] => [
  { number: 1, thumb: 'https://bilder.example.test/1t.jpg', view: 'https://bilder.example.test/1v.jpg', zoom: 'https://annen.example.test/1z.jpg' },
  { number: 2, thumb: null, view: 'https://bilder.example.test/2v.jpg', zoom: null },
];

let server: Server | null = null;
afterEach(async () => { if (server) await new Promise<void>((r) => { server!.closeAllConnections(); server!.close(() => r()); }); server = null; });

async function start(opts: Partial<PapersApiOptions> = {}, src: { catalogs?: () => Promise<Catalog[]>; pages?: (id: string) => Promise<CatalogPage[]> } = {}) {
  let clock = Date.parse('2026-11-24T10:00:00.000Z');
  const calls: string[] = [];
  const logs: string[] = [];
  const api = createPapersApi({
    listCatalogs: async () => { calls.push('kataloger'); return (src.catalogs ?? (async () => [cat('c1'), cat('utlopt', { validFrom: '2026-11-01', validUntil: '2026-11-07' }), cat('c2', { dealerName: 'Bunnpris', validFrom: '2026-11-26', validUntil: '2026-12-02' })]))(); },
    catalogPages: async (id) => { calls.push(`sider:${id}`); return (src.pages ?? (async () => pages()))(id); },
    imageHosts: ['bilder.example.test'], now: () => new Date(clock).toISOString(), log: (m) => logs.push(m), ...opts,
  });
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  server = createServer(createApp({ dist, handlers: [api] }));
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  const get = async (p: string, init?: RequestInit) => { const r = await fetch(base + p, init); return { status: r.status, headers: r.headers, body: r.status === 204 ? null : await r.json().catch(() => null) }; };
  return { get, calls, logs, advance: (ms: number) => { clock += ms; } };
}

describe('GET /api/aviser', () => {
  it('lister gjeldende og kommende aviser fra Tjek (utløpte ikke), med kilde og dato, og hurtigbuffer', async () => {
    const t = await start();
    const r = await t.get('/api/aviser');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect([r.body.status, r.body.source, r.body.observed, r.body.imagesAllowed]).toEqual(['ok', 'tjek', '2026-11-24T10:00:00.000Z', true]);
    expect(r.body.catalogs.map((c: Catalog) => c.id)).toEqual(['c2', 'c1']); // sortert på kjede (Bunnpris før KIWI)
    await t.get('/api/aviser');
    expect(t.calls).toEqual(['kataloger']);
    t.advance(7 * 3_600_000);
    await t.get('/api/aviser');
    expect(t.calls).toEqual(['kataloger', 'kataloger']);
  });
  it('feil hos Tjek: fast feiltekst, nedkjøling før nytt forsøk, og loggen får bare navnet på feilen', async () => {
    const t = await start({}, { catalogs: async () => { throw new Error('Tjek svarte 503 på /catalogs'); } });
    const r = await t.get('/api/aviser');
    expect([r.status, r.body.status, r.body.error, r.body.catalogs]).toEqual([200, 'error', 'Kundeavisene er ikke tilgjengelige akkurat nå.', []]);
    await t.get('/api/aviser');
    expect(t.calls).toEqual(['kataloger']);
    expect(t.logs.join('\n')).not.toMatch(/503|catalogs/);
    t.advance(6 * 60_000);
    await t.get('/api/aviser');
    expect(t.calls).toEqual(['kataloger', 'kataloger']);
  });
  it('bare GET/HEAD, ingen parametre, ratebegrenset per IP', async () => {
    const t = await start({ perMinute: 2 });
    expect((await t.get('/api/aviser', { method: 'POST' })).status).toBe(405);
    expect((await t.get('/api/aviser?x=1')).status).toBe(400);
    expect((await t.get('/api/aviser')).status).toBe(429);
  });
});

describe('GET /api/aviser/:id/sider', () => {
  it('gir sidene med bildeadresser bare til tillatte verter (ingen nedlasting hos oss)', async () => {
    const t = await start();
    await t.get('/api/aviser');
    const r = await t.get('/api/aviser/c1/sider');
    expect(r.status).toBe(200);
    expect(r.body.pages).toEqual([
      { number: 1, thumb: 'https://bilder.example.test/1t.jpg', view: 'https://bilder.example.test/1v.jpg', zoom: null },
      { number: 2, thumb: null, view: 'https://bilder.example.test/2v.jpg', zoom: null },
    ]);
    expect([r.body.catalog.id, r.body.source, r.body.observed]).toEqual(['c1', 'tjek', '2026-11-24T10:00:00.000Z']);
    await t.get('/api/aviser/c1/sider');
    expect(t.calls).toEqual(['kataloger', 'sider:c1']);
  });
  it('ukjent eller ugyldig katalog gir 404 uten kall til Tjek (ingen vilkårlige oppslag via oss)', async () => {
    const t = await start();
    expect((await t.get('/api/aviser/finnes-ikke/sider')).status).toBe(404);
    expect((await t.get('/api/aviser/..%2Fdealers/sider')).status).toBe(404);
    expect((await t.get('/api/aviser/c1/sider/x')).status).toBe(404);
    expect(t.calls).toEqual(['kataloger']);
  });
  it('uten tillatte bildeverter: ingen adresser, og imagesAllowed=false', async () => {
    const t = await start({ imageHosts: [] });
    expect((await t.get('/api/aviser')).body.imagesAllowed).toBe(false);
    const r = await t.get('/api/aviser/c1/sider');
    expect(r.body.pages.every((p: CatalogPage) => p.view === null && p.thumb === null && p.zoom === null)).toBe(true);
  });
  it('høyst maxPages sider, og hurtigbufferen har et tak på antall aviser', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ number: i + 1, thumb: null, view: `https://bilder.example.test/${i}.jpg`, zoom: null }));
    const t = await start({ maxPages: 3, maxCachedCatalogs: 1 }, { catalogs: async () => [cat('c1'), cat('c2')], pages: async () => many });
    expect((await t.get('/api/aviser/c1/sider')).body.pages.length).toBe(3);
    await t.get('/api/aviser/c2/sider');
    await t.get('/api/aviser/c1/sider');
    expect(t.calls).toEqual(['kataloger', 'sider:c1', 'sider:c2', 'sider:c1']);
  });
});
