import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { ALLERGENS, ALLERGEN_LABEL } from './allergens';
import type { OfferHint } from './deals';
import { alternatives, budgetAnswer, buildBasket, eligibleRecipes, generatePlan, type Ctx } from './planner';
import type { Allergen, Catalog, Settings, Slot } from './types';

const week = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 60 }));
const ctxOf = (over: Partial<Settings> = {}, cat: Catalog = catalog, offers?: OfferHint[]): Ctx => ({
  catalog: cat, settings: { ...defaultSettings, days: week, ...over }, offers, shopDate: '2026-11-24',
});
const recipe = (id: string) => catalog.recipes.find((r) => r.id === id)!;
const product = (id: string) => catalog.products.find((p) => p.id === id)!;
const slot = (day: number, recipeId: string): Slot => ({ day, recipeId, locked: false });
const hint = (over: Partial<OfferHint>): OfferHint => ({
  id: 'o', ingredient: 'laks', dealer: 'KIWI', priceOre: 1, prePriceOre: 90_000, amount: 400, unit: 'g',
  validFrom: '2026-11-23', validUntil: '2026-11-29', ...over,
});
/** Enorm rabatt på alle varer: tilbud skal aldri kunne overstyre et allergenfilter. */
const dealsOnEverything = (): OfferHint[] => catalog.ingredients.filter((i) => !i.staple)
  .map((i) => hint({ id: `o-${i.id}`, ingredient: i.id, unit: i.unit }));

describe('allergenmodell', () => {
  it('har alle 14 EU-allergener med norsk visningsnavn', () => {
    expect(ALLERGENS).toHaveLength(14);
    for (const a of ALLERGENS) expect(ALLERGEN_LABEL[a].length, a).toBeGreaterThan(2);
    for (const a of ['soya', 'sennep', 'selleri', 'sesam', 'notter', 'peanotter', 'blotdyr', 'lupin', 'sulfitt'] as Allergen[]) expect(ALLERGENS).toContain(a);
  });
});

describe('allergifilter i 7-dagers plan', () => {
  for (const a of ALLERGENS) {
    it(`aktivt filter for ${a}: ingen rett eller kurvvare med ${a}`, () => {
      const c = ctxOf({ avoid: [a] });
      const eligible = eligibleRecipes(c, 0);
      for (const r of eligible) expect(r.allergens, r.id).not.toContain(a);
      expect(eligible.length, `nok retter uten ${a}`).toBeGreaterThanOrEqual(7);
      const plan = generatePlan(c);
      expect(plan).toHaveLength(7);
      for (const s of plan) expect(recipe(s.recipeId).allergens, s.recipeId).not.toContain(a);
      const basket = buildBasket(plan, [c.settings.regularStoreId], c);
      for (const l of basket.lines) {
        if (!l.productId) continue;
        const p = product(l.productId);
        expect(p.allergenKnown, `${l.productId} har uavklart allergenstatus`).toBe(true);
        expect(p.allergens, l.productId).not.toContain(a);
      }
    });
  }
  it('flere filter samtidig: ingen valgt rett bryter noe av dem', () => {
    const avoid: Allergen[] = ['gluten', 'melk', 'egg', 'soya'];
    const c = ctxOf({ avoid });
    for (const s of generatePlan(c)) for (const a of avoid) expect(recipe(s.recipeId).allergens, `${s.recipeId} ${a}`).not.toContain(a);
  });
  it('med alle allergener unngått velges bare retter helt uten allergener', () => {
    const plan = generatePlan(ctxOf({ avoid: [...ALLERGENS] }));
    expect(plan.length).toBeGreaterThan(0);
    for (const s of plan) expect(recipe(s.recipeId).allergens, s.recipeId).toEqual([]);
  });
  it('finnes ingen trygg rett, gir planen ingen retter (heller enn en feil rett)', () => {
    const none: Catalog = { ...catalog, recipes: catalog.recipes.filter((r) => r.allergens.length > 0) };
    expect(generatePlan(ctxOf({ avoid: [...ALLERGENS] }, none))).toEqual([]);
  });
});

describe('uavklart allergenstatus godkjennes aldri som erstatning', () => {
  const cat = (products: Catalog['products']): Catalog => ({
    ...catalog, products: [...catalog.products.filter((p) => p.ingredient !== 'ris'), ...products],
    prices: [...catalog.prices.filter((p) => !catalog.products.find((x) => x.id === p.productId && x.ingredient === 'ris')),
      ...products.map((p, i) => ({ productId: p.id, storeId: 'demoA', ore: 1000 + i * 1000, status: 'ordinær' as const, source: 'Demodata', observed: '2026-11-17' }))],
  });
  const unknownCheap = { id: 'risX', ingredient: 'ris', name: 'Ris, ukjent innhold', size: 1000, allergens: [], allergenKnown: false };
  const knownDear = { id: 'risY', ingredient: 'ris', name: 'Ris, avklart', size: 1000, allergens: [], allergenKnown: true };
  const risLine = (c: Ctx) => buildBasket([slot(0, 'karri')], ['demoA'], c).lines.find((l) => l.ingredient === 'ris')!;

  it('uten filter kan den uavklarte varen brukes (kontroll)', () => {
    expect(risLine(ctxOf({}, cat([unknownCheap, knownDear]))).productId).toBe('risX');
  });
  it('med filter velges avklart vare, selv når den uavklarte er billigere og ikke har allergenet i listen', () => {
    for (const a of ALLERGENS) expect(risLine(ctxOf({ avoid: [a] }, cat([unknownCheap, knownDear]))).productId, a).toBe('risY');
  });
  it('er bare uavklarte varer igjen, blir linjen ukjent pris og kurven ufullstendig', () => {
    const c = ctxOf({ avoid: ['sennep'] }, cat([unknownCheap]));
    const line = risLine(c);
    expect(line.productId).toBeNull();
    expect(line.status).toBe('ukjent');
    expect(line.costOre).toBeNull();
    const b = buildBasket([slot(0, 'karri')], ['demoA'], c);
    expect(b.complete).toBe(false);
    expect(budgetAnswer(b, 10_000_000)).toBe('ufullstendig');
    expect(alternatives([slot(0, 'karri')], c).combo?.complete ?? false).toBe(false);
  });
  it('en avklart vare med det unngåtte allergenet godkjennes heller ikke', () => {
    const withSoya = { ...knownDear, allergens: ['soya' as const] };
    expect(risLine(ctxOf({ avoid: ['soya'] }, cat([withSoya]))).productId).toBeNull();
  });
  it('i den ekte katalogen brukes ingen vare med uavklart status ved noe aktivt filter', () => {
    const unknown = new Set(catalog.products.filter((p) => !p.allergenKnown).map((p) => p.id));
    expect(unknown.size).toBeGreaterThan(0);
    const all = catalog.recipes.map((r, i) => slot(i % 7, r.id));
    for (const a of ALLERGENS) {
      const b = buildBasket(all, ['demoA', 'demoB'], ctxOf({ avoid: [a] }));
      for (const l of b.lines) expect(unknown.has(l.productId ?? ''), `${a}: ${l.productId}`).toBe(false);
    }
  });
});

describe('allergifilter slår tilbud', () => {
  it('enorme tilbud på alt flytter aldri planen til retter med unngått allergen', () => {
    for (const a of ALLERGENS) {
      const c = ctxOf({ avoid: [a] }, catalog, dealsOnEverything());
      const plan = generatePlan(c);
      expect(plan, a).toHaveLength(7);
      for (const s of plan) expect(recipe(s.recipeId).allergens, `${a}: ${s.recipeId}`).not.toContain(a);
    }
  });
  it('tilbud på en vare med uavklart status gjør den ikke godkjent, og kurven forblir ufullstendig', () => {
    // Filteret «sennep» står ikke på makrelltomat, men varen er uavklart: tilbudet kan ikke gi den en pris.
    const c = ctxOf({ avoid: ['sennep'] }, catalog, [hint({ id: 'm', ingredient: 'makrell', unit: 'g', amount: 170 })]);
    const b = buildBasket([slot(0, 'makrelltomat')], ['demoA'], c);
    expect(b.lines.find((l) => l.ingredient === 'makrell')!.productId).toBeNull();
    expect(b.complete).toBe(false);
    expect(budgetAnswer(b, 10_000_000)).toBe('ufullstendig');
  });
  it('tilbud endrer ikke kurvsummen', () => {
    const base = ctxOf({ avoid: ['gluten'] });
    const deal = ctxOf({ avoid: ['gluten'] }, catalog, dealsOnEverything());
    const slots = [slot(0, 'karri'), slot(1, 'ovnstorsk')];
    expect(buildBasket(slots, ['demoA'], deal).totalOre).toBe(buildBasket(slots, ['demoA'], base).totalOre);
  });
});
