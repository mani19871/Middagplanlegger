import { describe, expect, it } from 'vitest';
import { ingredients, recipes } from '../data/catalog';
import table from '../data/nutrition.json';
import { recipeNutrition, type NutritionTable } from './nutrition';

const t = table.items as unknown as NutritionTable;
const byId = (id: string) => recipes.find((r) => r.id === id)!;

describe('næring', () => {
  it('regner kcal og protein per porsjon for pannekaker', () => {
    // 300 g mel, 4 egg (4 × 55 g, 88 % spiselig), 600 ml melk, delt på 4
    const n = recipeNutrition(byId('pannekaker'), ingredients, t);
    const kcal = (300 * 3.43 + 4 * 55 * 0.88 * 1.49 + 600 * 0.39) / 4;
    expect(n.kcal).toBe(Math.round(kcal));
    expect(n.missing).toEqual([]);
    expect(n.assumed).toEqual(['melk']); // ml → g uten dokumentert tetthet
  });
  it('alle oppskrifter har næringsdata for alle ingredienser', () => {
    for (const r of recipes) expect(recipeNutrition(r, ingredients, t).missing, r.id).toEqual([]);
  });
  it('er deterministisk og gir rimelige verdier', () => {
    for (const r of recipes) {
      const a = recipeNutrition(r, ingredients, t);
      expect(a).toEqual(recipeNutrition(r, ingredients, t));
      expect(a.kcal).toBeGreaterThan(150);
      expect(a.kcal).toBeLessThan(1100);
    }
  });
});

import { scaleNutrition, weekNutrition } from './nutrition';
import type { Eater, Slot } from './types';

describe('næring per spiser', () => {
  const per = (id: string) => ({ kcal: id === 'a' ? 600 : 400, protein: id === 'a' ? 30 : 20, fat: 10, carbs: 50, fiber: 5, salt: 1 });
  const all = [true, true, true, true, true, true, true];
  const eaters: Eater[] = [
    { id: 'v', label: 'Voksen', portion: 1, daysHome: all },
    { id: 'b', label: 'Barn', portion: 0.6, daysHome: [true, false, true, false, false, false, false] },
    { id: 't', label: 'Bortreist', portion: 0.3, daysHome: [false, false, false, false, false, false, false] },
  ];
  const slots: Slot[] = [{ day: 0, recipeId: 'a', locked: false }, { day: 1, recipeId: 'b', locked: false, extra: 2 }, { day: 2, recipeId: 'a', locked: false }];
  it('skalerer med portion-faktor', () => {
    expect(scaleNutrition(per('a'), 0.6)).toMatchObject({ kcal: 360, protein: 18 });
    expect(scaleNutrition(per('a'), 1)).toMatchObject({ kcal: 600, protein: 30 });
  });
  it('snitter per dag bare over dager spiseren er hjemme', () => {
    const w = weekNutrition(slots, eaters, per);
    expect(w.eaters[0]).toMatchObject({ days: 3, kcalTotal: 1600, kcalPerDay: 533, proteinPerDay: 26.7 });
    expect(w.eaters[1]).toMatchObject({ days: 2, kcalTotal: 720, kcalPerDay: 360, proteinPerDay: 18 });
  });
  it('gir null for spiser som aldri er hjemme', () => {
    expect(weekNutrition(slots, eaters, per).eaters[2]).toMatchObject({ days: 0, kcalPerDay: null, proteinPerDay: null });
  });
  it('tar reserverte porsjoner separat, ikke på person', () => {
    expect(weekNutrition(slots, eaters, per).reserved).toEqual({ portions: 2, kcal: 800, protein: 40 });
  });
  it('er deterministisk', () => {
    expect(weekNutrition(slots, eaters, per)).toEqual(weekNutrition(slots, eaters, per));
  });
});
