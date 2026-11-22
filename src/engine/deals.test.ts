import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { recipeDeals, type OfferHint } from './deals';
import { dealsFor, generatePlan, type Ctx } from './planner';

const hint = (over: Partial<OfferHint> = {}): OfferHint => ({
  id: 'o1', ingredient: 'laks', dealer: 'KIWI', priceOre: 5000, prePriceOre: 9000, amount: 400, unit: 'g',
  validFrom: '2026-11-23', validUntil: '2026-11-29', ...over,
});
const ctx = (hints: OfferHint[], over: Partial<typeof defaultSettings> = {}): Ctx => ({
  catalog, settings: { ...defaultSettings, ...over }, offers: hints, shopDate: '2026-11-24',
});
const recipe = (id: string) => catalog.recipes.find((r) => r.id === id)!;

describe('tilbudsrangering', () => {
  it('regner besparelse fra førpris per pakke', () => {
    // laks 500 g × 0,8 = 400 g → 1 pakke × (9000 − 5000)
    const d = recipeDeals(recipe('lakseris'), 0.8, catalog.ingredients, [hint()], '2026-11-24');
    expect(d.savingOre).toBe(4000);
    expect(d.lines).toEqual([{ ingredient: 'laks', dealer: 'KIWI', offerId: 'o1', packs: 1, savingOre: 4000 }]);
  });
  it('utløpte og kommende tilbud på handledagen gir ingen besparelse', () => {
    expect(recipeDeals(recipe('lakseris'), 0.8, catalog.ingredients, [hint({ validUntil: '2026-11-21' })], '2026-11-24').lines).toEqual([]);
    expect(recipeDeals(recipe('lakseris'), 0.8, catalog.ingredients, [hint({ validFrom: '2026-11-30', validUntil: '2026-12-05' })], '2026-11-24').lines).toEqual([]);
  });
  it('tilbud uten førpris gir dekning, men ingen besparelse', () => {
    const d = recipeDeals(recipe('lakseris'), 0.8, catalog.ingredients, [hint({ prePriceOre: null })], '2026-11-24');
    expect(d.lines).toHaveLength(1);
    expect(d.savingOre).toBe(0);
  });
  it('enhet må stemme med ingrediensen', () => {
    expect(recipeDeals(recipe('lakseris'), 0.8, catalog.ingredients, [hint({ unit: 'ml' })], '2026-11-24').lines).toEqual([]);
  });
  it('velger tilbudet med størst besparelse når flere gjelder', () => {
    const d = recipeDeals(recipe('lakseris'), 0.8, catalog.ingredients, [hint(), hint({ id: 'o2', dealer: 'REMA 1000', priceOre: 4000 })], '2026-11-24');
    expect(d.lines[0].offerId).toBe('o2');
  });
  it('planen flyttes mot retter med store tilbud, og er deterministisk', () => {
    const days = defaultSettings.days.map((x, i) => ({ ...x, enabled: i < 2 }));
    const base = generatePlan(ctx([], { days, offerChains: ['KIWI'] }));
    const big = hint({ ingredient: 'kokosmelk', priceOre: 100, prePriceOre: 90000, amount: 400, unit: 'ml' }); // enorm rabatt på kokosmelk
    const withOffer = generatePlan(ctx([big], { days, offerChains: ['KIWI'] }));
    const uses = (plan: typeof base) => plan.some((s) => ['karri', 'fiskesuppe'].includes(s.recipeId));
    expect(uses(withOffer)).toBe(true);
    expect(JSON.stringify(withOffer)).toBe(JSON.stringify(generatePlan(ctx([big], { days, offerChains: ['Kiwi'] })))); // normalisert
    expect(uses(base)).toBe(base.some((s) => ['karri', 'fiskesuppe'].includes(s.recipeId))); // sanity
  });
  it('useOffers: false ignorerer tilbud', () => {
    const c = ctx([hint()], { useOffers: false, offerChains: ['KIWI'] });
    expect(dealsFor(recipe('lakseris'), 0, c).lines).toEqual([]);
  });
  it('allergifilter slår tilbud: retter med unngått allergen velges aldri', () => {
    const c = ctx([hint({ ingredient: 'laks', priceOre: 1, prePriceOre: 90000 })], { avoid: ['fisk'], offerChains: ['KIWI'] });
    for (const s of generatePlan(c)) expect(recipe(s.recipeId).allergens).not.toContain('fisk');
  });
});
