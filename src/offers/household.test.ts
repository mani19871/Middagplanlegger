// Henting av husholdningstilbud fra en tilbudskilde (utvidelse C). Ingen ekte kall: kilden er falsk.
import { describe, expect, it } from 'vitest';
import { HOUSEHOLD_RULES } from '../data/household';
import { collectHousehold, FOOD_TERMS, householdCandidates, householdQueries } from './household';
import type { NormalizedOffer, OfferSource } from './types';

const offer = (id: string, heading: string, over: Partial<NormalizedOffer> = {}): NormalizedOffer => ({
  id, source: 'tjek', heading, description: null, priceOre: 4990, prePriceOre: null, amount: null, unit: null, pieces: null,
  dealerId: 'd', dealerName: 'Kiwi', validFrom: '2026-11-23', validUntil: '2026-11-29', observed: '2026-11-23T08:00:00.000Z', ...over,
});
const opts = { country: 'NO', today: '2026-11-24', delayMs: 0, sleep: async () => {} };

describe('husholdningstilbud fra kilden', () => {
  it('ett søk per vare (første søkeord), så kallbruken er kjent og liten', () => {
    const q = householdQueries();
    const items = HOUSEHOLD_RULES.groups.flatMap((g) => g.items);
    expect(q).toHaveLength(items.length);
    expect(q).toEqual(items.map((i) => i.terms[0]));
    expect(q.length).toBeLessThanOrEqual(40);
  });
  it('tar bare med husholdningsvarer (ikke mat, ikke sensitive varer), gyldige nå eller innen 7 dager, uten dubletter', async () => {
    const all = [
      offer('a', 'Lambi Toalettpapir 8 rull'), offer('b', 'Kyllingfilet 400 g'), offer('c', 'Libero bleier str 4'),
      offer('d', 'Toalettpapir 24 rull', { validFrom: '2026-11-01', validUntil: '2026-11-08' }), offer('e', 'Oppvaskmiddel 500 ml'),
      offer('f', 'Bakepapir', { validFrom: '2027-01-10', validUntil: '2027-01-16' }), offer('g', 'Kattesand 10 l', { validFrom: '2026-11-30', validUntil: '2026-12-06' }),
    ];
    const queries: string[] = [];
    const src: OfferSource = { id: 'fake', listDealers: async () => [], searchOffers: async (q) => { queries.push(q.query); return all; } };
    const out = await collectHousehold(src, opts);
    expect(out.map((o) => o.id)).toEqual(['a', 'e', 'g']);
    expect(queries).toEqual(householdQueries());
  });
  it('kandidater for svaret: samme klassifisering, sortert på kilde og id', () => {
    const list = [offer('z', 'Oppvaskmiddel'), offer('b', 'Kyllingfilet'), offer('a', 'Toalettpapir')];
    expect(householdCandidates(list).map((o) => o.id)).toEqual(['a', 'z']);
    expect(FOOD_TERMS).toContain('kyllingfilet');
  });
  it('lar kildefeil boble opp (innsamleren håndterer dem)', async () => {
    const bad: OfferSource = { id: 'b', listDealers: async () => [], searchOffers: async () => { throw new Error('403'); } };
    await expect(collectHousehold(bad, opts)).rejects.toThrow('403');
  });
});
