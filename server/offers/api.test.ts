// Lese-endepunktet for lagrede tilbud: GET /api/offers/lagret (server/offers/api.ts). Se docs/sikkerhet.md (S21).
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ingredients } from '../../src/data/catalog';
import type { LiveResponse } from '../../src/offers/client';
import type { NormalizedOffer } from '../../src/offers/types';
import { API_CSP, createApp } from '../app';
import { createOffersApi, type OffersApiOptions } from './api';
import { SqliteOfferStore } from './sqlite';

const offer = (id: string, over: Partial<NormalizedOffer> = {}): NormalizedOffer => ({
  id, source: 'tjek', heading: 'Torskefilet', description: null, priceOre: 7990, prePriceOre: 9990, amount: 400, unit: 'g', pieces: null,
  dealerId: 'd1', dealerName: 'KIWI', validFrom: '2026-11-23', validUntil: '2026-11-29', observed: '2026-11-23T08:00:00.000Z', ...over,
});

let server: Server | null = null;
afterEach(async () => { if (server) await new Promise<void>((r) => { server!.closeAllConnections(); server!.close(() => r()); }); server = null; });

async function start(opts: Partial<OffersApiOptions> = {}) {
  const store = opts.store ?? new SqliteOfferStore(':memory:');
  let clock = Date.parse('2026-11-24T10:00:00.000Z');
  const logs: string[] = [];
  const api = createOffersApi({ store, ingredients, now: () => new Date(clock).toISOString(), collector: () => ({ failures: 0 }), log: (m) => logs.push(m), ...opts });
  const dist = mkdtempSync(join(tmpdir(), 'dist-'));
  server = createServer(createApp({ dist, handlers: [api], log: (m) => logs.push(m) }));
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  return { store, base, logs, advance: (ms: number) => { clock += ms; } };
}

describe('GET /api/offers/lagret', () => {
  it('serverer lagrede tilbud i samme form som live, med observasjonsdatoen fra da prisen ble sett', async () => {
    const t = await start();
    await t.store.record([offer('a'), offer('b', { heading: 'Kjøttdeig', validFrom: '2026-11-28', validUntil: '2026-12-04', observed: '2026-11-22T07:00:00.000Z' })], 'NO', '2026-11-23T08:00:05.000Z');
    await t.store.setLastFetch('2026-11-23T08:00:05.000Z');
    const res = await fetch(`${t.base}/api/offers/lagret`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-security-policy')).toBe(API_CSP);
    const body = (await res.json()) as LiveResponse;
    expect([body.status, body.source, body.stored, body.observed, body.oldestObserved, body.truncated]).toEqual(['ok', 'tjek', true, '2026-11-23T08:00:05.000Z', '2026-11-22T07:00:00.000Z', false]);
    expect(body.offers.map((l) => [l.offer.id, l.phase, l.ingredient, l.offer.observed])).toEqual([
      ['b', 'kommende', 'kjottdeig', '2026-11-22T07:00:00.000Z'], ['a', 'nå', 'torsk', '2026-11-23T08:00:00.000Z'],
    ]);
    // Samme felt som et normalisert tilbud: ingen interne felt (status, første observasjon) lekker ut.
    expect(Object.keys(body.offers[0].offer).sort()).toEqual(Object.keys(offer('x')).sort());
  });

  it('tar ikke med tilbud som ikke kobles til en ingrediens, utløpte, eller priser eldre enn aldersgrensen', async () => {
    const t = await start();
    await t.store.record([
      offer('sko', { heading: 'Joggesko' }), offer('utlopt', { validFrom: '2026-11-10', validUntil: '2026-11-16' }),
      offer('gammel', { validFrom: '2026-11-01', validUntil: '2026-12-31', observed: '2026-11-05T08:00:00.000Z' }), offer('ok'),
    ], 'NO', '2026-11-23T08:00:05.000Z');
    await t.store.setLastFetch('2026-11-23T08:00:05.000Z');
    const body = (await (await fetch(`${t.base}/api/offers/lagret`)).json()) as LiveResponse;
    expect(body.offers.map((l) => l.offer.id)).toEqual(['ok']);
  });

  it('uten vellykket henting: «loading», eller «error» etter feil, med fast feiltekst', async () => {
    let failures = 0;
    const t = await start({ collector: () => ({ failures }) });
    expect(((await (await fetch(`${t.base}/api/offers/lagret`)).json()) as LiveResponse).status).toBe('loading');
    failures = 2;
    const body = (await (await fetch(`${t.base}/api/offers/lagret`)).json()) as LiveResponse;
    expect([body.status, body.error, body.offers]).toEqual(['error', 'Tilbud er ikke tilgjengelige akkurat nå.', []]);
  });

  it('størrelsesgrense: høyst maxOffers tilbud, og truncated sier fra', async () => {
    const t = await start({ maxOffers: 2 });
    await t.store.record(['a', 'b', 'c'].map((id) => offer(id)), 'NO', '2026-11-23T08:00:05.000Z');
    await t.store.setLastFetch('2026-11-23T08:00:05.000Z');
    const body = (await (await fetch(`${t.base}/api/offers/lagret`)).json()) as LiveResponse;
    expect([body.offers.length, body.truncated]).toEqual([2, true]);
  });

  it('bare GET og HEAD, ingen spørreparametre, og ratebegrensning per IP med norsk feilkode', async () => {
    const t = await start({ perMinute: 3 });
    const post = await fetch(`${t.base}/api/offers/lagret`, { method: 'POST', body: '{}' });
    expect([post.status, post.headers.get('allow')]).toEqual([405, 'GET, HEAD']);
    expect((await fetch(`${t.base}/api/offers/lagret?q=1`)).status).toBe(400);
    expect((await fetch(`${t.base}/api/offers/lagret`, { method: 'HEAD' })).status).toBe(200);
    const limited = await fetch(`${t.base}/api/offers/lagret`);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'for_mange_forespørsler', message: 'For mange forespørsler. Vent litt og prøv igjen.' });
    t.advance(60_000);
    expect((await fetch(`${t.base}/api/offers/lagret`)).status).toBe(200);
  });

  it('andre stier slipper gjennom (live /api/offers og ukjente /api/offers/* gir ikke dette endepunktet)', async () => {
    const t = await start();
    expect((await fetch(`${t.base}/api/offers`)).status).toBe(404);
    expect((await fetch(`${t.base}/api/offers/lagret/x`)).status).toBe(404);
  });

  it('lagringsfeil gir 500 uten detaljer, og loggen får bare navnet på feilen', async () => {
    const store = new SqliteOfferStore(':memory:');
    store.current = async () => { throw new Error('SQLITE hemmelig sti /data/tilbud.sqlite'); };
    await store.setLastFetch('2026-11-23T08:00:05.000Z');
    const t = await start({ store });
    const res = await fetch(`${t.base}/api/offers/lagret`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'serverfeil', message: 'Noe gikk galt på serveren.' });
    expect(t.logs.join('\n')).not.toMatch(/hemmelig|tilbud\.sqlite/);
  });
});
