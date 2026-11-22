// Klienten bruker lagrede tilbud (/api/offers/lagret) når serveren har dem, ellers live (/api/offers).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ingredients } from '../data/catalog';
import { fetchLiveOffers, type LiveResponse } from './client';
import { toHints } from './hints';
import type { LiveOffer } from './service';

const resp = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const ok = (over: Partial<LiveResponse> = {}): LiveResponse => ({ status: 'ok', error: null, source: 'tjek', observed: '2026-11-23T08:00:00.000Z', offers: [], ...over });

afterEach(() => vi.unstubAllGlobals());

function stub(routes: Record<string, () => unknown>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    const r = routes[url];
    if (!r) throw new TypeError('nettverksfeil');
    return r();
  }));
  return calls;
}

describe('fetchLiveOffers', () => {
  it('bruker lagrede tilbud når endepunktet svarer ok', async () => {
    const calls = stub({ '/api/offers/lagret': () => resp(200, ok({ stored: true })) });
    expect((await fetchLiveOffers()).stored).toBe(true);
    expect(calls).toEqual(['/api/offers/lagret']);
  });
  it('faller tilbake til live når lagring ikke finnes (404), feiler, eller ikke har data ennå', async () => {
    for (const lagret of [() => resp(404, {}), () => resp(500, {}), () => resp(429, {}), () => resp(200, ok({ status: 'loading', stored: true })), () => { throw new TypeError('x'); }]) {
      const calls = stub({ '/api/offers/lagret': lagret, '/api/offers': () => resp(200, ok()) });
      const r = await fetchLiveOffers();
      expect([r.status, r.stored]).toEqual(['ok', undefined]);
      expect(calls).toEqual(['/api/offers/lagret', '/api/offers']);
    }
  });
  it('lagret «error» og live nede: svaret fra lagringen vises (ingen ny feil oppfunnet)', async () => {
    stub({ '/api/offers/lagret': () => resp(200, ok({ status: 'error', error: 'Tilbud er ikke tilgjengelige akkurat nå.', stored: true })), '/api/offers': () => resp(503, {}) });
    expect((await fetchLiveOffers()).status).toBe('error');
  });
  it('kaster når begge er nede (appen planlegger da uten tilbud)', async () => {
    stub({});
    await expect(fetchLiveOffers()).rejects.toThrow();
  });
});

describe('toHints og prisalder', () => {
  const live = (id: string, observed: string): LiveOffer => ({
    offer: { id, source: 'tjek', heading: 'Torskefilet', description: null, priceOre: 7990, prePriceOre: 9990, amount: 400, unit: 'g', pieces: null,
      dealerId: 'd', dealerName: 'KIWI', validFrom: '2026-11-01', validUntil: '2026-12-31', observed },
    ingredient: 'torsk', unitPriceOre: 19975, needsReview: false, reasons: [], approved: false, rule: null, phase: 'nå',
  });
  it('et lagret tilbud som sist ble sett mer enn MAX_PRICE_AGE_DAYS før handledagen, gir ikke hint', () => {
    const hints = toHints([live('fersk', '2026-11-20T08:00:00.000Z'), live('gammel', '2026-11-05T08:00:00.000Z')], ingredients, undefined, '2026-11-24');
    expect(hints.map((h) => h.id)).toEqual(['fersk']);
  });
  it('uten handledag er alt med (som før)', () => {
    expect(toHints([live('gammel', '2026-11-05T08:00:00.000Z')], ingredients).length).toBe(1);
  });
});
