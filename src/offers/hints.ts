import type { Ingredient } from '../engine/types';
import type { OfferHint } from '../engine/deals';
import type { LiveOffer } from './service';

/** Bare kontrollerte tilbud med pris og mengde i samme enhet som ingrediensen kan påvirke planen. */
export function toHints(live: LiveOffer[], ingredients: Ingredient[]): OfferHint[] {
  const out: OfferHint[] = [];
  for (const l of live) {
    const o = l.offer;
    const ing = ingredients.find((i) => i.id === l.ingredient);
    if (l.needsReview || !ing || o.priceOre === null || !o.amount || o.unit !== ing.unit) continue;
    out.push({
      id: o.id, ingredient: l.ingredient, dealer: o.dealerName, priceOre: o.priceOre, prePriceOre: o.prePriceOre,
      amount: o.amount, unit: o.unit, validFrom: o.validFrom.slice(0, 10), validUntil: o.validUntil.slice(0, 10),
    });
  }
  return out;
}
