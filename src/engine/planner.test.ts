import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { alternatives, budgetAnswer, buildBasket, generatePlan, swapOptions } from './planner';
import type { Settings, Slot } from './types';

const ctx = (over: Partial<Settings> = {}) => ({ catalog, settings: { ...defaultSettings, ...over } });
const slot = (day: number, recipeId: string, locked = false): Slot => ({ day, recipeId, locked });

describe('planmotor', () => {
  it('to retter som deler pasta gir én handlelinje', () => {
    const b = buildBasket([slot(0, 'bolognese'), slot(1, 'pastaspinat')], ['demoA'], ctx());
    const pasta = b.lines.filter((l) => l.ingredient === 'pasta');
    expect(pasta).toHaveLength(1);
    expect(pasta[0].covers).toEqual(['bolognese', 'pastaspinat']);
    expect(pasta[0].packs).toBe(2); // 3,2 porsjoner / 4 × 400 g × 2 = 640 g → 2 × 500 g
  });
  it('er deterministisk', () => {
    const c = ctx();
    expect(JSON.stringify(generatePlan(c))).toBe(JSON.stringify(generatePlan(c)));
    const p = generatePlan(c);
    expect(JSON.stringify(alternatives(p, c))).toBe(JSON.stringify(alternatives(p, c)));
  });
  it('trekker fra beholdning én gang', () => {
    const b = buildBasket([slot(0, 'bolognese'), slot(1, 'pastaspinat')], ['demoA'], ctx({ pantry: { pasta: 400 } }));
    expect(b.lines.find((l) => l.ingredient === 'pasta')!.packs).toBe(1);
  });
  it('ukjent pris gir ufullstendig svar og vinner aldri sammenligningen', () => {
    const slots = [slot(0, 'linsegryte')];
    const b = buildBasket(slots, ['demoA'], ctx());
    expect(b.complete).toBe(false);
    expect(budgetAnswer(b, 10_000_000)).toBe('ufullstendig');
    const alt = alternatives([slot(0, 'bolognese')], ctx());
    expect(alt.combo === null || alt.combo.complete).toBe(true);
  });
  it('låste retter beholdes ved ny generering', () => {
    const c = ctx();
    const locked = [slot(2, 'taco', true)];
    const plan = generatePlan(c, locked);
    expect(plan.find((s) => s.day === 2)!.recipeId).toBe('taco');
    expect(plan).toHaveLength(5);
  });
  it('allergifilter fjerner retter, og uavklart produktstatus godkjennes aldri', () => {
    const c = ctx({ avoid: ['gluten'] });
    const plan = generatePlan(c);
    for (const s of plan) expect(catalog.recipes.find((r) => r.id === s.recipeId)!.allergens).not.toContain('gluten');
    const b = buildBasket([slot(0, 'fiskekaker')], ['demoA', 'demoB'], ctx({ avoid: ['egg'] }));
    expect(b.lines.find((l) => l.ingredient === 'fiskekaker')!.status).toBe('ukjent');
  });
  it('anbefaler én butikk når besparelsen er under terskelen', () => {
    const slots = [slot(0, 'ovnstorsk')];
    const hi = ctx({ regularStoreId: 'demoB', extraStoreThresholdOre: 10_000_000 });
    const altHi = alternatives(slots, hi);
    expect(altHi.combo!.stops).toBe(2);
    expect(altHi.recommended).toBe('regular');
    const lo = ctx({ regularStoreId: 'demoB', extraStoreThresholdOre: 0 });
    expect(alternatives(slots, lo).recommended).toBe('combo');
  });
  it('bytte-forskjell regnes på hele kurven', () => {
    const c = ctx();
    const slots = [slot(0, 'bolognese'), slot(1, 'taco')];
    const opts = swapOptions(slots, 1, ['demoA'], c);
    const cur = buildBasket(slots, ['demoA'], c).totalOre;
    const o = opts.find((x) => x.recipe.id === 'pastaspinat')!;
    const direct = buildBasket([slot(0, 'bolognese'), slot(1, 'pastaspinat')], ['demoA'], c).totalOre;
    expect(cur + o.deltaOre).toBe(direct);
  });
  it('reserverte ekstra porsjoner øker behovet', () => {
    const plain = buildBasket([slot(0, 'bolognese')], ['demoA'], ctx());
    const extra = buildBasket([{ ...slot(0, 'bolognese'), extra: 4 }], ['demoA'], ctx());
    const n = (b: typeof plain) => b.lines.find((l) => l.ingredient === 'pasta')!.need;
    expect(n(extra)).toBeCloseTo(n(plain) * (3.2 + 4) / 3.2);
  });
  it('maks to retter med samme protein per uke', () => {
    const days = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 60 }));
    const c = ctx({ days });
    const plan = generatePlan(c);
    expect(plan).toHaveLength(7);
    const counts = new Map<string, number>();
    for (const s of plan) {
      const p = catalog.recipes.find((r) => r.id === s.recipeId)!.protein;
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(2);
  });
});

describe('kostmodell', () => {
  it('råvarekrav filtrerer bort retter med taggen, og taggene utledes fra ingrediensene', async () => {
    const { recipeTags } = await import('./planner');
    const days = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 60 }));
    const c = ctx({ days, avoidFoods: ['storfe', 'fisk'] });
    for (const s of generatePlan(c)) {
      const tags = recipeTags(catalog.recipes.find((r) => r.id === s.recipeId)!, catalog.ingredients);
      expect(tags.has('storfe')).toBe(false);
      expect(tags.has('fisk')).toBe(false);
    }
    expect(recipeTags(catalog.recipes.find((r) => r.id === 'taco')!, catalog.ingredients).has('storfe')).toBe(true);
  });
  it('vegetarretter har ingen kjøtt- eller fisketagger', async () => {
    const { recipeTags } = await import('./planner');
    for (const r of catalog.recipes.filter((x) => x.vegetarian)) {
      const t = recipeTags(r, catalog.ingredients);
      for (const bad of ['storfe', 'svin', 'lam', 'kylling', 'fisk', 'skalldyr'] as const) expect(t.has(bad), `${r.id} ${bad}`).toBe(false);
    }
  });
});

describe('regresjon: «Med kontrollerte tilbud» er en egen sum', () => {
  it('basissum og budsjettsvar er uendret; ukjent pris gir fortsatt ufullstendig', async () => {
    const { totalWithOffers } = await import('./offerTotal');
    const hint = { id: 'o', ingredient: 'tomat', dealer: 'X', priceOre: 100, prePriceOre: 1490, amount: 400, unit: 'g' as const, validFrom: '2026-11-23', validUntil: '2026-11-29', approved: true };
    const slots = [slot(0, 'linsegryte')];
    const b = buildBasket(slots, ['demoA'], { ...ctx(), offers: [hint], shopDate: '2026-11-24' });
    const t = totalWithOffers(b, [hint], '2026-11-24', defaultSettings);
    expect(t.savingOre).toBeGreaterThan(0);
    expect(b.totalOre).toBe(buildBasket(slots, ['demoA'], ctx()).totalOre);
    expect(budgetAnswer(b, 1)).toBe('ufullstendig');
    expect(t.complete).toBe(false);
  });
});
