import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import type { OfferHint } from './deals';
import { totalWithOffers } from './offerTotal';
import { alternatives, buildBasket, generatePlan, type Ctx } from './planner';
import type { Slot } from './types';

const DAY = '2026-11-24';
const hint = (over: Partial<OfferHint> = {}): OfferHint => ({
  id: 'o1', ingredient: 'laks', dealer: 'KIWI', priceOre: 5000, prePriceOre: 9000, amount: 400, unit: 'g',
  validFrom: '2026-11-23', validUntil: '2026-11-29', approved: true, ...over,
});
const ctx = (offers: OfferHint[] = [], over: Partial<typeof defaultSettings> = {}): Ctx => ({
  catalog, settings: { ...defaultSettings, ...over }, offers, shopDate: DAY,
});
const slot = (day: number, recipeId: string): Slot => ({ day, recipeId, locked: false });
// Kurven prises 23.11., siste dag for demotilbudet på laks i Demo Nærbutikk; utløpte priser brukes ikke (regel 2).
const basketFor = (slots: Slot[]) => buildBasket(slots, ['demoA'], { ...ctx(), shopDate: '2026-11-23' });
const laks = basketFor([slot(0, 'lakseris')]); // 4 spisere × 0,8 → 400 g laks, én pakke à 99,90 kr
// Husstanden har valgt KIWI; tilbud fra andre kjeder teller ikke (se egne tester for kjedevalg).
const S = { ...defaultSettings, offerChains: ['KIWI'] };
const total = (hints: OfferHint[], basket = laks, settings = S) => totalWithOffers(basket, hints, DAY, settings);

describe('«Med kontrollerte tilbud»-sum', () => {
  it('godkjent tilbud senker summen med førpris minus tilbudspris per pakke', () => {
    const t = total([hint()]);
    expect(t.savingOre).toBe(4000);
    expect(t.totalOre).toBe(laks.totalOre - 4000);
    expect(t.baseOre).toBe(laks.totalOre);
    expect(t.lines).toEqual([{ ingredient: 'laks', offerId: 'o1', dealer: 'KIWI', packs: 1, packSize: 400, priceOre: 5000, prePriceOre: 9000, savingOre: 4000 }]);
  });
  it('bare regelgodkjente tilbud teller', () => {
    expect(total([hint({ approved: false })]).savingOre).toBe(0);
    expect(total([hint({ approved: undefined })]).savingOre).toBe(0);
  });
  it('utløpte og kommende tilbud på handledagen teller ikke', () => {
    expect(total([hint({ validUntil: '2026-11-23' })]).savingOre).toBe(0);
    expect(total([hint({ validFrom: '2026-11-25' })]).savingOre).toBe(0);
    expect(total([hint({ validFrom: DAY, validUntil: DAY })]).savingOre).toBe(4000); // gyldig akkurat den dagen
  });
  it('feil enhet teller ikke', () => {
    expect(total([hint({ unit: 'ml' })]).savingOre).toBe(0);
  });
  it('regner pakkeantall mot hele behovet i kurven', () => {
    const two = basketFor([slot(0, 'lakseris'), slot(1, 'lakseris')]); // 800 g laks
    const t = total([hint({ amount: 300 })], two); // 3 pakker à 300 g
    expect(t.lines[0].packs).toBe(3);
    expect(t.savingOre).toBe(3 * 4000);
  });
  it('besparelsen på en linje overstiger aldri linjens pris', () => {
    const line = laks.lines.find((l) => l.ingredient === 'laks')!;
    expect(total([hint({ prePriceOre: 900_000 })]).savingOre).toBe(line.costOre);
  });
  it('tilbud uten førpris gir dekning, men ingen besparelse', () => {
    const t = total([hint({ prePriceOre: null })]);
    expect(t.savingOre).toBe(0);
    expect(t.coveredOnly).toEqual(['laks']);
  });
  it('velger tilbudet med størst besparelse, deterministisk uansett rekkefølge', () => {
    const hs = [hint({ id: 'b', priceOre: 6000 }), hint({ id: 'a', priceOre: 4000 }), hint({ id: 'c', priceOre: 4000 })];
    const a = total(hs);
    expect(a.lines[0].offerId).toBe('a');
    expect(JSON.stringify(total([...hs].reverse()))).toBe(JSON.stringify(a));
  });
  it('ukjent pris fylles aldri av et tilbud, og ufullstendig kurv forblir ufullstendig', () => {
    const b = basketFor([slot(0, 'linsegryte')]);
    expect(b.complete).toBe(false);
    const t = total([hint({ ingredient: 'linser', approved: true })], b);
    expect(t.lines).toEqual([]);
    expect(t.coveredOnly).toEqual([]);
    expect(t.complete).toBe(false);
  });
  it('aktivt allergifilter: tilbudsvarer har uavklart allergenstatus og regnes ikke med', () => {
    const t = total([hint()], laks, { ...S, avoid: ['gluten'] });
    expect(t.blocked).toBe('allergifilter');
    expect(t.totalOre).toBe(laks.totalOre);
  });
  it('tilbud av gir ingen tilbudssum', () => {
    expect(total([hint()], laks, { ...S, useOffers: false }).blocked).toBe('av');
  });
  it('basissum, kurv og butikksammenligning er uendret av tilbud', () => {
    const slots = generatePlan(ctx());
    const big = [hint({ ingredient: 'kokosmelk', unit: 'ml', priceOre: 100, prePriceOre: 90_000 }), hint()];
    const before = JSON.stringify(alternatives(slots, ctx()));
    expect(JSON.stringify(alternatives(slots, ctx(big)))).toBe(before);
    const basket = buildBasket(slots, ['demoA'], ctx(big));
    const snap = JSON.stringify(basket);
    totalWithOffers(basket, big, DAY, S);
    expect(JSON.stringify(basket)).toBe(snap); // ingen mutasjon
  });
});
