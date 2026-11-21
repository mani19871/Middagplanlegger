import { describe, expect, it } from 'vitest';
import table from './nutrition.json';
import { catalog, ingredients, products, recipes } from './catalog';
import { defaultSettings } from './defaults';
import { recipeNutrition, type NutritionTable } from '../engine/nutrition';
import { generatePlan, recipeTags } from '../engine/planner';
import type { FoodTag, Settings } from '../engine/types';

const t = table.items as unknown as NutritionTable;
const week = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 60 }));
const plan = (over: Partial<Settings>) => generatePlan({ catalog, settings: { ...defaultSettings, days: week, ...over } });
const uniq = (xs: string[]) => new Set(xs).size === xs.length;

describe('katalog (demodata)', () => {
  it('har minst 28 retter og ingen duplikate id-er', () => {
    expect(recipes.length).toBeGreaterThanOrEqual(28);
    expect(uniq(recipes.map((r) => r.id))).toBe(true);
    expect(uniq(ingredients.map((i) => i.id))).toBe(true);
    expect(uniq(products.map((p) => p.id))).toBe(true);
  });
  it('hver ingrediens i en oppskrift finnes i katalogen, og hvert produkt peker på en ingrediens', () => {
    const ids = new Set(ingredients.map((i) => i.id));
    for (const r of recipes) for (const l of r.lines) expect(ids.has(l.ingredient), `${r.id}: ${l.ingredient}`).toBe(true);
    for (const p of products) expect(ids.has(p.ingredient), p.id).toBe(true);
  });
  it('alle ikke-basisingredienser i oppskrifter har et produkt, og alle oppskrifter har fire porsjoner', () => {
    const withProduct = new Set(products.map((p) => p.ingredient));
    const staples = new Set(ingredients.filter((i) => i.staple).map((i) => i.id));
    for (const r of recipes) {
      expect(r.baseServings).toBe(4);
      for (const l of r.lines) if (!staples.has(l.ingredient)) expect(withProduct.has(l.ingredient), `${r.id}: ${l.ingredient}`).toBe(true);
    }
  });
  it('allergenene til en rett dekker produktenes allergener', () => {
    for (const r of recipes) for (const l of r.lines) for (const p of products.filter((x) => x.ingredient === l.ingredient))
      for (const a of p.allergens) expect(r.allergens, `${r.id} mangler ${a} fra ${p.id}`).toContain(a);
  });
  it('en uke på 7 dager kan planlegges med hvert enkelt kostkrav uten tomme dager', () => {
    const cases: Partial<Settings>[] = [
      {}, { avoidFoods: ['storfe'] }, { avoidFoods: ['fisk'] }, { avoidFoods: ['svin'] }, { avoidFoods: ['lam'] },
      { avoidFoods: ['skalldyr'] }, { avoidFoods: ['kylling'] }, { avoidFoods: ['belgvekster'] }, { vegetarian: true },
      { avoidFoods: ['storfe', 'svin', 'fisk'] }, { avoidFoods: ['svin', 'lam', 'skalldyr'] },
    ];
    for (const c of cases) {
      const p = plan(c);
      expect(p, JSON.stringify(c)).toHaveLength(7);
      for (const s of p) {
        const r = recipes.find((x) => x.id === s.recipeId)!;
        const tags = recipeTags(r, ingredients);
        for (const f of (c.avoidFoods ?? []) as FoodTag[]) expect(tags.has(f), `${r.id} ${f}`).toBe(false);
        if (c.vegetarian) expect(r.vegetarian).toBe(true);
      }
    }
  });
  it('rettene har rimelig næringsdata', () => {
    for (const r of recipes) {
      const n = recipeNutrition(r, ingredients, t);
      expect(n.missing, r.id).toEqual([]);
      expect(n.kcal, r.id).toBeGreaterThan(150);
      expect(n.kcal, r.id).toBeLessThan(1100);
    }
  });
});
