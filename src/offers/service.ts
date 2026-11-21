// Samler gyldige tilbud fra en OfferSource og kobler dem til ingredienser. Ingen lagring; kilden og klokken sendes inn.
import type { Ingredient } from '../engine/types';
import { matchOffer, OFFER_TERMS, validOn, type MatchedOffer } from './match';
import type { OfferSource } from './types';

export interface LiveOffer extends MatchedOffer { phase: 'nå' | 'kommende' }
export interface CollectOptions {
  country: string; today: string; termsPerIngredient?: number; limit?: number; delayMs?: number;
  sleep?: (ms: number) => Promise<void>; terms?: Record<string, string[]>;
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function collectOffers(source: OfferSource, ingredients: Ingredient[], o: CollectOptions): Promise<LiveOffer[]> {
  const terms = o.terms ?? OFFER_TERMS;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const out = new Map<string, LiveOffer>();
  for (const ing of ingredients) {
    if (ing.staple) continue;
    for (const term of (terms[ing.id] ?? []).slice(0, o.termsPerIngredient ?? 2)) {
      const offers = await source.searchOffers({ query: term, country: o.country, limit: o.limit ?? 20 });
      for (const offer of offers) {
        if (out.has(offer.id)) continue;
        const from = offer.validFrom.slice(0, 10);
        const phase: LiveOffer['phase'] | null = validOn(offer, o.today) ? 'nå' : from > o.today && from <= addDays(o.today, 7) ? 'kommende' : null;
        if (!phase) continue; // utløpte og fjerne tilbud tas ikke med
        const m = matchOffer(offer, ingredients, phase === 'nå' ? o.today : from, terms);
        if (m) out.set(offer.id, { ...m, phase });
      }
      await sleep(o.delayMs ?? 500); // vær snill mot kilden
    }
  }
  return [...out.values()].sort((a, b) => Number(a.needsReview) - Number(b.needsReview) || a.ingredient.localeCompare(b.ingredient) || (a.unitPriceOre ?? 1e9) - (b.unitPriceOre ?? 1e9) || a.offer.id.localeCompare(b.offer.id));
}
