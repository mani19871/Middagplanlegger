// Kodegjennomgang runde 2 (docs/kodegjennomgang.md), tilbud på serveren: O11–O13. Alle feilet før rettingen.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import type { LiveOffer } from '../../src/offers/service';
import type { Catalog, NormalizedOffer } from '../../src/offers/types';
import { CallBudget, startOfferCollector, startOfferRetention } from './collector';
import { offerConfigFrom, paperCallsPerDay } from './config';
import { createPapersApi } from './papers';
import { SqliteOfferStore } from './sqlite';

const cat = (id: string): Catalog => ({
  id, source: 'tjek', dealerId: 'd1', dealerName: 'KIWI', label: 'Uke 48', validFrom: '2026-11-23', validUntil: '2026-11-29', pageCount: 2, observed: '2026-11-24T09:00:00.000Z',
});
function call(handler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>, url: string) {
  let status = 0;
  const req = { url, method: 'GET', headers: {}, socket: { remoteAddress: '203.0.113.7' } } as unknown as IncomingMessage;
  const res = { set statusCode(s: number) { status = s; }, get statusCode() { return status; }, setHeader() {}, end() {} } as unknown as ServerResponse;
  return handler(req, res).then(() => status);
}
function callBody(handler: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>, url: string) {
  let status = 0; let text = '';
  const req = { url, method: 'GET', headers: {}, socket: { remoteAddress: '203.0.113.7' } } as unknown as IncomingMessage;
  const res = { set statusCode(s: number) { status = s; }, get statusCode() { return status; }, setHeader() {}, end(b?: string) { text = b ?? ''; } } as unknown as ServerResponse;
  return handler(req, res).then(() => ({ status, body: JSON.parse(text) as unknown }));
}

describe('runde 2: kallbudsjettet mot Tjek og avissider', () => {
  it('O11: avissidene har eget delbudsjett; når det er brukt opp, svarer de «error» uten kall til Tjek', async () => {
    let clock = Date.parse('2026-11-24T10:00:00.000Z');
    const ids = Array.from({ length: 150 }, (_, i) => `c${i}`);
    let pageCalls = 0;
    const api = createPapersApi({
      listCatalogs: async () => ids.map(cat), catalogPages: async () => { pageCalls++; return []; },
      imageHosts: ['bilder.example.test'], now: () => new Date(clock).toISOString(), log: () => {},
      budget: new CallBudget(50, () => '2026-11-24'),
    });
    // To runder gjennom alle avisene (mer enn hurtigbufferens 100), innenfor 60 kall/min per IP.
    const statuses: string[] = [];
    for (let round = 0; round < 2; round++) for (const id of ids) {
      clock += 1100;
      const r = await callBody(api, `/api/aviser/${id}/sider`);
      expect(r.status).toBe(200);
      statuses.push((r.body as { status: string }).status);
    }
    // Ett kall går til lista; resten av delbudsjettet til sidene. De 49 hentede avisene svarer fra minnet også i runde to.
    expect(pageCalls).toBe(49);
    expect(statuses.filter((s) => s === 'ok').length).toBe(2 * 49);
    expect(statuses.filter((s) => s === 'error').length).toBe(300 - 2 * 49);
  });

  it('O11: anonyme oppslag på avissider kan ikke bruke opp kallbudsjettet som innsamleren trenger', async () => {
    let clock = Date.parse('2026-11-24T10:00:00.000Z');
    const budget = new CallBudget(1000, () => '2026-11-24');
    const ids = Array.from({ length: 150 }, (_, i) => `c${i}`);
    const api = createPapersApi({
      // Som i server/index.ts: hvert kall til Tjek tar fra det felles budsjettet; avisene har i tillegg sitt eget (en femdel).
      listCatalogs: async () => { budget.take(); return ids.map(cat); }, catalogPages: async () => { budget.take(); return []; },
      imageHosts: ['bilder.example.test'], now: () => new Date(clock).toISOString(), log: () => {},
      budget: new CallBudget(paperCallsPerDay(1000), () => '2026-11-24'),
    });
    // Én IP, 55 kall i minuttet, i ca. 20 minutter.
    for (let round = 0; round < 8; round++) for (const id of ids) { clock += 1100; await call(api, `/api/aviser/${id}/sider`); }
    // Innsamleren (samme budsjett, server/index.ts) skal fortsatt kunne kalle Tjek samme dag.
    expect(budget.used()).toBeLessThanOrEqual(200);
    expect(() => budget.take()).not.toThrow();
  });
});

describe('runde 2: oppbevaring av lagrede tilbud', () => {
  it('O12: utløpte tilbud slettes etter OFFER_RETENTION_DAYS også når hentingen feiler (f.eks. avtalen er slutt)', async () => {
    let clock = Date.parse('2026-11-23T08:00:00.000Z');
    const store = new SqliteOfferStore(':memory:');
    const old: NormalizedOffer = {
      id: 'gammel', source: 'tjek', heading: 'Torskefilet', description: null, priceOre: 7990, prePriceOre: null, amount: 400, unit: 'g', pieces: null,
      dealerId: 'd1', dealerName: 'KIWI', validFrom: '2026-01-05', validUntil: '2026-01-11', observed: '2026-01-05T08:00:00.000Z',
    };
    await store.record([old], 'NO', '2026-01-05T08:00:00.000Z');
    let pending: (() => void) | null = null;
    const job = startOfferCollector({
      collect: async (): Promise<LiveOffer[]> => { throw new Error('Tjek svarte 403'); }, store, country: 'NO', now: () => new Date(clock).toISOString(), log: () => {},
      intervalMs: 6 * 3_600_000, retryMs: 5 * 60_000, retentionDays: 180,
      schedule: (fn) => { pending = fn; return () => { pending = null; }; },
    });
    for (let i = 0; i < 5; i++) { await job.idle(); clock += 6 * 3_600_000; const f = pending; pending = null; (f as (() => void) | null)?.(); }
    await job.idle();
    job.stop();
    // Sist sett 2026-01-05, utløpt 2026-01-11: mer enn 180 dager før 2026-11-23.
    expect((await store.counts()).observations).toBe(0);
  });
});

describe('runde 2: oppbevaring uten henting', () => {
  it('O12: med henting av (TJEK_FETCH=0) slettes utløpte tilbud likevel ved oppstart og periodisk', async () => {
    const store = new SqliteOfferStore(':memory:');
    const old: NormalizedOffer = {
      id: 'gammel', source: 'tjek', heading: 'Torskefilet', description: null, priceOre: 7990, prePriceOre: null, amount: 400, unit: 'g', pieces: null,
      dealerId: 'd1', dealerName: 'KIWI', validFrom: '2026-01-05', validUntil: '2026-01-11', observed: '2026-01-05T08:00:00.000Z',
    };
    await store.record([old], 'NO', '2026-01-05T08:00:00.000Z');
    const job = startOfferRetention({ store, days: 180, now: () => '2026-11-23T08:00:00.000Z', log: () => {} });
    expect(await job.first).toBe(1);
    job.stop();
    expect((await store.counts()).observations).toBe(0);
    // 0 = aldri.
    await store.record([old], 'NO', '2026-01-05T08:00:00.000Z');
    const off = startOfferRetention({ store, days: 0, now: () => '2026-11-23T08:00:00.000Z', log: () => {} });
    expect(await off.first).toBe(0);
    expect((await store.counts()).observations).toBe(1);
  });
});

describe('runde 2: intervall i konfigurasjonen', () => {
  it('O13: OFFER_REFRESH_HOURS over ca. 596 timer gir ikke et intervall setTimeout gjør om til 1 ms', async () => {
    const cfg = offerConfigFrom({ OFFER_REFRESH_HOURS: '720' }, () => {});
    expect(cfg.refreshMs).toBeLessThanOrEqual(2 ** 31 - 1);
    expect(cfg.refreshMs).toBe(6 * 3_600_000);
    // Med standard planlegger (setTimeout): én runde ved oppstart, ingen ny runde etter 200 ms.
    let rounds = 0;
    const job = startOfferCollector({
      collect: async () => { rounds++; return []; }, store: new SqliteOfferStore(':memory:'), country: 'NO', now: () => new Date().toISOString(), log: () => {},
      intervalMs: cfg.refreshMs, retryMs: 5 * 60_000, retentionDays: 0,
    });
    const warn = process.emitWarning;
    process.emitWarning = () => {};
    try { await new Promise((r) => setTimeout(r, 200)); } finally { process.emitWarning = warn; job.stop(); }
    expect(rounds).toBe(1);
  });
});
