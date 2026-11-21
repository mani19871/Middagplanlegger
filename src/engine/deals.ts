// Tilbudsrangering: hvor mye en rett sparer på kontrollerte, gyldige tilbud. Ren funksjon, ingen nettverk eller klokke.
// Besparelsen regnes fra tilbudets egen førpris; tilbud uten førpris teller som dekning, ikke som besparelse.
import type { Ingredient, Recipe, Unit } from './types';

export interface OfferHint {
  id: string; ingredient: string; dealer: string; priceOre: number; prePriceOre: number | null;
  amount: number; unit: Unit; validFrom: string; validUntil: string; // ISO-datoer (YYYY-MM-DD)
}
export interface DealLine { ingredient: string; dealer: string; offerId: string; packs: number; savingOre: number }
export interface RecipeDeals { lines: DealLine[]; savingOre: number }

export const validOnDate = (h: OfferHint, date: string) => h.validFrom <= date && h.validUntil >= date;

/** Beste tilbud per ingrediensen på handledagen: størst besparelse, så lavest enhetspris, så id. */
export function bestHints(hints: OfferHint[], date: string): Map<string, OfferHint> {
  const best = new Map<string, OfferHint>();
  const key = (h: OfferHint) => [-(h.prePriceOre ?? h.priceOre) + h.priceOre, h.priceOre / h.amount] as const;
  for (const h of hints) {
    if (!validOnDate(h, date) || h.amount <= 0 || h.priceOre <= 0) continue;
    const cur = best.get(h.ingredient);
    if (!cur) { best.set(h.ingredient, h); continue; }
    const [a1, a2] = key(h);
    const [b1, b2] = key(cur);
    if (a1 < b1 || (a1 === b1 && (a2 < b2 || (a2 === b2 && h.id < cur.id)))) best.set(h.ingredient, h);
  }
  return best;
}

/** Tilbud en rett kan bruke ved gitt porsjonsfaktor (porsjoner / baseServings). */
export function recipeDeals(recipe: Recipe, factor: number, ingredients: Ingredient[], hints: OfferHint[], date: string): RecipeDeals {
  const best = bestHints(hints, date);
  const lines: DealLine[] = [];
  for (const line of recipe.lines) {
    const ing = ingredients.find((i) => i.id === line.ingredient);
    const h = best.get(line.ingredient);
    if (!ing || ing.staple || !h || h.unit !== ing.unit) continue;
    const packs = Math.max(1, Math.ceil((line.amount * factor) / h.amount - 1e-9));
    const savingOre = h.prePriceOre !== null && h.prePriceOre > h.priceOre ? packs * (h.prePriceOre - h.priceOre) : 0;
    lines.push({ ingredient: line.ingredient, dealer: h.dealer, offerId: h.id, packs, savingOre });
  }
  return { lines, savingOre: lines.reduce((s, l) => s + l.savingOre, 0) };
}
