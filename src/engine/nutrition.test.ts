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
