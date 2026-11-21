import { describe, expect, it } from 'vitest';
import { ingredients } from '../data/catalog';
import { collectOffers } from './service';
import type { NormalizedOffer, OfferSource } from './types';

const offer = (id: string, heading: string, from: string, to: string, over: Partial<NormalizedOffer> = {}): NormalizedOffer => ({
  id, source: 'fake', heading, description: null, priceOre: 7990, prePriceOre: null, amount: 400, unit: 'g', pieces: null,
  dealerId: 'd', dealerName: 'Butikk', validFrom: `${from}T00:00:00Z`, validUntil: `${to}T23:59:59Z`, observed: 'x', ...over,
});
const fake = (all: NormalizedOffer[]): OfferSource => ({
  id: 'fake', listDealers: async () => [],
  searchOffers: async (q) => all.filter((o) => o.heading.toLowerCase().includes(q.query.toLowerCase())),
});
const opts = { country: 'NO', today: '2026-11-24', delayMs: 0, sleep: async () => {} };

describe('collectOffers', () => {
  it('tar med gyldige og kommende, dropper utløpte og fjerne, og dedupliserer', async () => {
    const src = fake([
      offer('a', 'Torskefilet', '2026-11-23', '2026-11-29'), offer('b', 'Torsk gammel', '2026-11-01', '2026-11-08'),
      offer('c', 'Torsk neste uke', '2026-11-30', '2026-12-06'), offer('d', 'Torsk i januar', '2027-01-10', '2027-01-16'),
    ]);
    const out = await collectOffers(src, ingredients, opts);
    expect(out.map((o) => [o.offer.id, o.phase])).toEqual([['a', 'nå'], ['c', 'kommende']]);
  });
  it('merker tilbud uten pris eller mengde for kontroll og sorterer dem sist', async () => {
    const src = fake([offer('x', 'Torsk uten pris', '2026-11-23', '2026-11-29', { priceOre: null }), offer('y', 'Torsk', '2026-11-23', '2026-11-29')]);
    const out = await collectOffers(src, ingredients, opts);
    expect(out.map((o) => [o.offer.id, o.needsReview])).toEqual([['y', false], ['x', true]]);
  });
  it('lar kildefeil boble opp', async () => {
    const bad: OfferSource = { id: 'b', listDealers: async () => [], searchOffers: async () => { throw new Error('403'); } };
    await expect(collectOffers(bad, ingredients, opts)).rejects.toThrow('403');
  });
});
