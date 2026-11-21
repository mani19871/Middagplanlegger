// Næring per porsjon, regnet ut fra Matvaretabellen (generelle matvarer, ikke ferdigvarer).
// Ren funksjon. Sier ingenting om allergener, og salt/olje/krydder er ikke med.
import type { Ingredient, Recipe } from './types';

export interface NutritionItem {
  foodId: string; foodName: string; kcalPer100g: number; proteinPer100g: number | null; fatPer100g: number | null;
  carbsPer100g: number | null; fiberPer100g: number | null; saltPer100g: number | null; ediblePercent: number;
  gramsPerPiece?: number; gramsPerMl?: number;
}
export type NutritionTable = Record<string, NutritionItem>;
export interface Nutrition { kcal: number; protein: number; fat: number; carbs: number; fiber: number; salt: number }
export interface RecipeNutrition extends Nutrition {
  /** Ingredienser uten næringsdata eller uten dokumentert omregning til gram. */
  missing: string[];
  /** Ingredienser regnet om fra ml til g uten dokumentert tetthet (antatt 1 g/ml). */
  assumed: string[];
}

function grams(item: NutritionItem, amount: number, unit: Ingredient['unit']): number | null {
  if (unit === 'g') return amount;
  if (unit === 'stk') return item.gramsPerPiece ? amount * item.gramsPerPiece : null;
  return amount * (item.gramsPerMl ?? 1); // ml
}

/** Næring per porsjon (en voksen porsjon = oppskriftens baseServings). */
export function recipeNutrition(recipe: Recipe, ingredients: Ingredient[], table: NutritionTable): RecipeNutrition {
  const total: Nutrition = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, salt: 0 };
  const missing: string[] = [];
  const assumed: string[] = [];
  for (const line of recipe.lines) {
    const ing = ingredients.find((i) => i.id === line.ingredient);
    if (!ing || ing.staple) continue;
    const item = table[line.ingredient];
    const g = item ? grams(item, line.amount, ing.unit) : null;
    if (!item || g === null) { missing.push(line.ingredient); continue; }
    if (ing.unit === 'ml' && item.gramsPerMl === undefined) assumed.push(line.ingredient);
    const edible = (g * item.ediblePercent) / 100 / 100; // i enheter av 100 g
    total.kcal += item.kcalPer100g * edible;
    total.protein += (item.proteinPer100g ?? 0) * edible;
    total.fat += (item.fatPer100g ?? 0) * edible;
    total.carbs += (item.carbsPer100g ?? 0) * edible;
    total.fiber += (item.fiberPer100g ?? 0) * edible;
    total.salt += (item.saltPer100g ?? 0) * edible;
  }
  const n = recipe.baseServings;
  const r = (x: number) => Math.round((x / n) * 10) / 10;
  return { kcal: Math.round(total.kcal / n), protein: r(total.protein), fat: r(total.fat), carbs: r(total.carbs), fiber: r(total.fiber), salt: r(total.salt), missing, assumed };
}
