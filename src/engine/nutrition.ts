// Næring per porsjon, regnet ut fra Matvaretabellen (generelle matvarer, ikke ferdigvarer).
// Ren funksjon. Sier ingenting om allergener, og salt/olje/krydder er ikke med.
import type { Eater, Ingredient, Recipe, Slot } from './types';

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

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Næring for én spiser: oppskriftens verdier per voksenporsjon ganget med spiserens portion-faktor. */
export function scaleNutrition(n: Nutrition, portion: number): Nutrition {
  return { kcal: Math.round(n.kcal * portion), protein: r1(n.protein * portion), fat: r1(n.fat * portion), carbs: r1(n.carbs * portion), fiber: r1(n.fiber * portion), salt: r1(n.salt * portion) };
}

export interface EaterWeekNutrition {
  id: string; label: string; portion: number;
  /** Antall middagsdager i planen der spiseren er hjemme. */
  days: number;
  /** Sum for planlagte middager i uka. */
  kcalTotal: number; proteinTotal: number;
  /** Snitt per middagsdag spiseren er hjemme; null når spiseren ikke er hjemme noen planlagte dager. */
  kcalPerDay: number | null; proteinPerDay: number | null;
}
export interface WeekNutrition {
  eaters: EaterWeekNutrition[];
  /** Reserverte ekstra porsjoner (matpakke/rester). Ikke fordelt på person, fordi planen ikke sier hvem som spiser dem. */
  reserved: { portions: number; kcal: number; protein: number };
}

/**
 * Veiledende næring i uka, bare for middagene i planen (ikke frokost, lunsj eller mellommåltid).
 * Ren og deterministisk. `perPortion` gir næring per voksenporsjon for en rett.
 */
export function weekNutrition(
  slots: Slot[], eaters: Eater[], perPortion: (recipeId: string) => Nutrition,
): WeekNutrition {
  const out: EaterWeekNutrition[] = eaters.map((e) => {
    let days = 0, kcal = 0, protein = 0;
    for (const s of slots) {
      if (!e.daysHome[s.day]) continue;
      const n = scaleNutrition(perPortion(s.recipeId), e.portion);
      days += 1; kcal += n.kcal; protein += n.protein;
    }
    return { id: e.id, label: e.label, portion: e.portion, days, kcalTotal: kcal, proteinTotal: r1(protein),
      kcalPerDay: days > 0 ? Math.round(kcal / days) : null, proteinPerDay: days > 0 ? r1(protein / days) : null };
  });
  let portions = 0, kcal = 0, protein = 0;
  for (const s of slots) {
    const x = s.extra ?? 0;
    if (x <= 0) continue;
    const n = perPortion(s.recipeId);
    portions += x; kcal += n.kcal * x; protein += n.protein * x;
  }
  return { eaters: out, reserved: { portions, kcal: Math.round(kcal), protein: r1(protein) } };
}
