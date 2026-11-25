// Periodisk henting av tilbud til lagringen (server/offers/collector.ts): intervall, bakoff, kallbudsjett, oppbevaring.
import { describe, expect, it } from 'vitest';
import { PartialCollectError, type LiveOffer } from '../../src/offers/service';
import type { NormalizedOffer } from '../../src/offers/types';
import { BudgetExceededError, CallBudget, startOfferCollector } from './collector';
import { SqliteOfferStore } from './sqlite';

const offer = (id: string, observed: string, over: Partial<NormalizedOffer> = {}): NormalizedOffer => ({
  id, source: 'tjek', heading: 'Torskefilet', description: null, priceOre: 7990, prePriceOre: null, amount: 400, unit: 'g', pieces: null,
  dealerId: 'd1', dealerName: 'KIWI', validFrom: '2026-11-23', validUntil: '2026-11-29', observed, ...over,
});
const live = (o: NormalizedOffer): LiveOffer => ({ offer: o, ingredient: 'torsk', unitPriceOre: 19975, needsReview: false, reasons: [], approved: false, rule: null, phase: 'nå' });

function harness(collect: () => Promise<LiveOffer[]>, extra: { retentionDays?: number; store?: SqliteOfferStore; collectOther?: () => Promise<NormalizedOffer[]>; missingCountry?: () => number } = {}) {
  let clock = Date.parse('2026-11-23T08:00:00.000Z');
  const delays: number[] = [];
  let pending: (() => void) | null = null;
  const logs: string[] = [];
  const store = extra.store ?? new SqliteOfferStore(':memory:');
  const job = startOfferCollector({
    collect, collectOther: extra.collectOther, missingCountry: extra.missingCountry, store, country: 'NO', now: () => new Date(clock).toISOString(), log: (m) => logs.push(m),
    intervalMs: 6 * 3_600_000, retryMs: 5 * 60_000, retentionDays: extra.retentionDays ?? 180,
    schedule: (fn, ms) => { delays.push(ms); pending = fn; return () => { pending = null; }; },
  });
  return {
    job, store, delays, logs,
    advance: (ms: number) => { clock += ms; },
    /** Kjører neste planlagte runde og venter til den er ferdig. */
    tick: async () => { const f = pending; pending = null; f?.(); await job.idle(); },
  };
}

describe('startOfferCollector', () => {
  it('henter ved oppstart, lagrer med observasjonstiden fra kilden og planlegger neste runde etter intervallet', async () => {
    const h = harness(async () => [live(offer('a', '2026-11-23T07:59:30.000Z'))]);
    await h.job.idle();
    expect(h.delays).toEqual([6 * 3_600_000]);
    expect(h.job.state().lastOk).toBe('2026-11-23T08:00:00.000Z');
    expect(await h.store.lastFetch()).toBe('2026-11-23T08:00:00.000Z');
    // Tre dager senere uten ny henting: observasjonen har fortsatt dagen prisen ble sett.
    h.advance(3 * 86_400_000);
    const [r] = await h.store.current({ today: '2026-11-26', observedSince: '2026-11-12', limit: 10 });
    expect(r.lastObserved).toBe('2026-11-23T07:59:30.000Z');
  });

  it('pent bakoff ved feil: 5, 10, 20 … minutter, aldri over intervallet, og tilbake til intervallet etter suksess', async () => {
    let fail = true;
    const h = harness(async () => { if (fail) throw new Error('Tjek svarte 503 på /offers/search'); return []; });
    await h.job.idle();
    for (let i = 0; i < 8; i++) await h.tick();
    expect(h.delays).toEqual([5, 10, 20, 40, 80, 160, 320, 360, 360].map((m) => m * 60_000));
    expect(h.job.state().failures).toBe(9);
    fail = false;
    await h.tick();
    expect(h.delays.at(-1)).toBe(6 * 3_600_000);
    expect(h.job.state().failures).toBe(0);
    // Loggen får bare navnet på feilen, ikke meldingen (som kan ha sti og statuskode fra Tjek).
    expect(h.logs.join('\n')).not.toMatch(/503|offers\/search/);
  });

  it('kallbudsjettet: når dagens grense er nådd, venter innsamleren til neste intervall uten bakoff-hamring', async () => {
    const h = harness(async () => { throw new BudgetExceededError(); });
    await h.job.idle();
    expect(h.delays).toEqual([6 * 3_600_000]);
    expect(h.job.state().failures).toBe(0);
    expect(h.logs.some((l) => /kallgrense/.test(l))).toBe(true);
  });

  it('kjører aldri to runder samtidig, og stop() avlyser neste runde', async () => {
    let calls = 0;
    let release!: () => void;
    const h = harness(() => { calls++; return new Promise<LiveOffer[]>((r) => { release = () => r([]); }); });
    void h.job.runNow();
    void h.job.runNow();
    release();
    await h.job.idle();
    expect(calls).toBe(1);
    h.job.stop();
    await h.tick();
    expect(calls).toBe(1);
  });

  it('kaller onCollected med tilbudene og hentetidspunktet (for live-visningen i minnet)', async () => {
    const seen: [number, string][] = [];
    let clock = Date.parse('2026-11-23T08:00:00.000Z');
    const job = startOfferCollector({
      collect: async () => [live(offer('a', '2026-11-23T08:00:01.000Z'))], store: new SqliteOfferStore(':memory:'), country: 'NO',
      now: () => new Date(clock).toISOString(), log: () => {}, intervalMs: 1000, retryMs: 10, retentionDays: 180,
      schedule: () => () => {}, onCollected: (offers, at) => seen.push([offers.length, at]),
    });
    await job.idle();
    clock += 1;
    expect(seen).toEqual([[1, '2026-11-23T08:00:00.000Z']]);
  });

  it('oppbevaring kjøres etter hver vellykkede runde', async () => {
    const store = new SqliteOfferStore(':memory:');
    await store.record([offer('gammel', '2026-01-02T08:00:00.000Z', { validFrom: '2026-01-01', validUntil: '2026-01-07' })], 'NO', '2026-01-02T08:00:00.000Z');
    const h = harness(async () => [], { store, retentionDays: 180 });
    await h.job.idle();
    expect((await store.counts()).observations).toBe(0);
  });
});

describe('startOfferCollector: delvis runde (O5) og tilbud uten land (O4b)', () => {
  it('O5: det som ble hentet før feilen, lagres, men runden regnes som feilet (bakoff, ingen ny «sist hentet»)', async () => {
    const h = harness(async () => { throw new PartialCollectError(new Error('Tjek svarte 429 på /offers/search'), [live(offer('a', '2026-11-23T07:59:00.000Z'))]); });
    const job = h.job;
    await job.idle();
    expect(job.state().failures).toBe(1);
    expect(job.state().lastOk).toBeNull();
    expect(await h.store.lastFetch()).toBeNull();
    expect(h.delays).toEqual([5 * 60_000]);
    const rows = await h.store.current({ today: '2026-11-24', observedSince: '2026-11-12', limit: 10 });
    expect(rows.map((r) => r.id)).toEqual(['a']);
    expect(rows[0].lastObserved).toBe('2026-11-23T07:59:00.000Z');
    expect(h.logs.some((l) => /delvis runde, 1 hentet/.test(l))).toBe(true);
    expect(h.logs.join('\n')).not.toMatch(/429|offers\/search/); // bare feilens navn
  });

  it('O5: delvis runde som stoppet på kallgrensen lagrer det som er hentet og venter et helt intervall', async () => {
    const h = harness(async () => { throw new PartialCollectError(new BudgetExceededError(), [live(offer('b', '2026-11-23T07:00:00.000Z'))]); });
    await h.job.idle();
    expect(h.delays).toEqual([6 * 3_600_000]);
    expect(h.job.state().failures).toBe(0);
    expect((await h.store.current({ today: '2026-11-24', observedSince: '2026-11-12', limit: 10 })).map((r) => r.id)).toEqual(['b']);
  });

  it('O4b: antall tilbud uten land logges per runde, også null og også når runden feiler', async () => {
    let n = 0;
    let fail = false;
    const h = harness(async () => { if (fail) throw new Error('x'); return []; }, { missingCountry: () => n });
    await h.job.idle();
    expect(h.logs.at(-1)).toMatch(/, 0 uten land\.$/);
    n = 3; fail = true;
    await h.tick();
    expect(h.logs.some((l) => /3 uten land i runden/.test(l))).toBe(true);
  });
});

describe('CallBudget', () => {
  it('teller kall per norsk døgn og nullstiller ved ny dag', () => {
    let day = '2026-11-23';
    const b = new CallBudget(2, () => day);
    b.take(); b.take();
    expect(() => b.take()).toThrow(BudgetExceededError);
    expect(b.used()).toBe(2);
    day = '2026-11-24';
    expect(() => b.take()).not.toThrow();
    expect(b.used()).toBe(1);
  });
});

describe('startOfferCollector: husholdningstilbud (utvidelse C)', () => {
  const house = (id: string) => offer(id, '2026-11-23T07:59:00.000Z', { heading: 'Toalettpapir 24 rull', amount: null, unit: null });
  it('lagrer husholdningstilbudene i samme tilbudslager (ingen persondata) og gir dem til live-visningen', async () => {
    const h = harness(async () => [live(offer('a', '2026-11-23T07:59:30.000Z'))], { collectOther: async () => [house('h1'), house('h2')] });
    await h.job.idle();
    const rows = await h.store.current({ today: '2026-11-23', observedSince: '2026-11-09', limit: 10 });
    expect(rows.map((r) => r.id)).toEqual(['a', 'h1', 'h2']);
    expect(h.logs.at(-1)).toMatch(/1 hentet, 2 husholdning \(3 nye/);
  });
  it('feil i husholdningssøket stopper ikke runden: mattilbudene lagres, og loggen får bare feilens navn', async () => {
    const h = harness(async () => [live(offer('a', '2026-11-23T07:59:30.000Z'))], { collectOther: async () => { throw new BudgetExceededError(); } });
    await h.job.idle();
    expect((await h.store.current({ today: '2026-11-23', observedSince: '2026-11-09', limit: 10 })).map((r) => r.id)).toEqual(['a']);
    expect(h.job.state()).toMatchObject({ failures: 0, lastOk: '2026-11-23T08:00:00.000Z' });
    expect(h.logs.join('\n')).toMatch(/husholdning: BudgetExceededError/);
    expect(h.delays).toEqual([6 * 3_600_000]);
  });
});
