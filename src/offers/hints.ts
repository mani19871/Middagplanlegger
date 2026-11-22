import type { Ingredient } from '../engine/types';
import type { OfferHint } from '../engine/deals';
import { normalizeChain } from '../engine/chains';
import { isStale } from '../engine/prices';
import { matchOffer, OFFER_TERMS } from './match';
import { OFFER_RULES, type OfferRule } from './rules';
import type { LiveOffer } from './service';

/**
 * Gjør live treff om til hint for planmotoren. Treffene matches på nytt med appens egne regler, så
 * godkjenningen følger regelfilen i bygget og ikke det serveren tilfeldigvis kjørte med.
 * Bare treff med kjent pris, mengde i samme enhet og uten vilkår tas med; `approved` sier om en regel har godkjent koblingen.
 * Med `shopDate`: et tilbud kilden sist viste mer enn MAX_PRICE_AGE_DAYS før handledagen (lagret, ikke sett igjen) gir ikke
 * hint; en gammel pris blir aldri dagens tilbud (regel 2, src/engine/prices.ts).
 */
export function toHints(live: LiveOffer[], ingredients: Ingredient[], rules: OfferRule[] = OFFER_RULES, shopDate?: string): OfferHint[] {
  const out: OfferHint[] = [];
  for (const l of live) {
    const o = l.offer;
    if (shopDate && isStale(o.observed, shopDate)) continue;
    const m = matchOffer(o, ingredients, o.validFrom.slice(0, 10), OFFER_TERMS, rules);
    const ing = m && ingredients.find((i) => i.id === m.ingredient);
    if (!m || m.needsReview || !ing || o.priceOre === null || !o.amount || o.unit !== ing.unit) continue;
    out.push({
      id: o.id, ingredient: m.ingredient, dealer: o.dealerName, chain: normalizeChain(o.dealerName), priceOre: o.priceOre, prePriceOre: o.prePriceOre,
      amount: o.amount, unit: o.unit, validFrom: o.validFrom.slice(0, 10), validUntil: o.validUntil.slice(0, 10), approved: m.approved,
    });
  }
  return out;
}
