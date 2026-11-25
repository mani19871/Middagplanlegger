import { describe, expect, it } from 'vitest';
import { ingredients } from '../data/catalog';
import { collectOffers, PartialCollectError } from './service';
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
  it('O5: feil etter noen vellykkede søk gir PartialCollectError med det som er hentet og den opprinnelige feilen, og stopper søkene', async () => {
    let calls = 0;
    const cause = new Error('429');
    const src: OfferSource = {
      id: 'f', listDealers: async () => [],
      searchOffers: async (q) => { calls++; if (calls > 1) throw cause; return [offer('a', `${q.query} tilbud`, '2026-11-23', '2026-11-29')]; },
    };
    const err = await collectOffers(src, ingredients, opts).then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(PartialCollectError);
    const p = err as PartialCollectError;
    expect(p.cause).toBe(cause);
    expect(p.offers.map((o) => o.offer.id)).toEqual(['a']);
    expect(calls).toBe(2); // ingen nye kall etter feilen
  });
});
