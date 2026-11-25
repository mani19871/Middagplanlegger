// Samler gyldige tilbud fra en OfferSource og kobler dem til ingredienser. Ingen lagring her (lagringen er server/offers/);
// kilden og klokken sendes inn.
import type { Ingredient } from '../engine/types';
import { matchOffer, OFFER_TERMS, validOn, type MatchedOffer } from './match';
import type { NormalizedOffer, OfferSource } from './types';
import { OFFER_RULES, type OfferRule } from './rules';

export interface LiveOffer extends MatchedOffer { phase: 'nå' | 'kommende' }
export interface CollectOptions {
  country: string; today: string; termsPerIngredient?: number; limit?: number; delayMs?: number;
  sleep?: (ms: number) => Promise<void>; terms?: Record<string, string[]>; rules?: OfferRule[];
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * En innsamling som stoppet på en kildefeil etter at noen søk hadde lykkes (O5). `cause` er den opprinnelige feilen
 * (f.eks. 429 eller kallgrensen), `offers` er det som var hentet før feilen. Innsamleren lagrer dem, men regner runden
 * som feilet (bakoff, ingen ny «sist hentet»). Uten noe hentet kastes den opprinnelige feilen uendret.
 */
export class PartialCollectError extends Error {
  constructor(readonly cause: unknown, readonly offers: LiveOffer[]) { super('delvis innsamling'); this.name = 'PartialCollectError'; }
}

export async function collectOffers(source: OfferSource, ingredients: Ingredient[], o: CollectOptions): Promise<LiveOffer[]> {
  const terms = o.terms ?? OFFER_TERMS;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const out = new Map<string, LiveOffer>();
  for (const ing of ingredients) {
    if (ing.staple) continue;
    for (const term of (terms[ing.id] ?? []).slice(0, o.termsPerIngredient ?? 2)) {
      let offers: NormalizedOffer[];
      // Stopp ved første feil (ikke hamre på en kilde som svarer 429), men behold det som er hentet.
      try { offers = await source.searchOffers({ query: term, country: o.country, limit: o.limit ?? 20 }); } catch (e) {
        if (out.size === 0) throw e;
        throw new PartialCollectError(e, sortLive([...out.values()]));
      }
      for (const offer of offers) {
        if (out.has(offer.id)) continue;
        const l = toLiveOffer(offer, ingredients, o.today, terms, o.rules ?? OFFER_RULES);
        if (l) out.set(offer.id, l);
      }
      await sleep(o.delayMs ?? 500); // vær snill mot kilden
    }
  }
  return sortLive([...out.values()]);
}

/**
 * Et tilbud som treff for «Tilbud nå»: gyldig i dag («nå») eller fra innen 7 dager («kommende»), koblet til en ingrediens.
 * Utløpte, fjerne og ukoblede gir null. Brukes både ved henting og når serveren leser lagrede tilbud (server/offers/api.ts).
 */
export function toLiveOffer(offer: NormalizedOffer, ingredients: Ingredient[], today: string, terms = OFFER_TERMS, rules: OfferRule[] = OFFER_RULES): LiveOffer | null {
  const from = offer.validFrom.slice(0, 10);
  const phase: LiveOffer['phase'] | null = validOn(offer, today) ? 'nå' : from > today && from <= addDays(today, 7) ? 'kommende' : null;
  if (!phase) return null; // utløpte og fjerne tilbud tas ikke med
  const m = matchOffer(offer, ingredients, phase === 'nå' ? today : from, terms, rules);
  return m ? { ...m, phase } : null;
}

/** Fast rekkefølge: uavklarte sist, så ingrediens, enhetspris og id. */
export const sortLive = (list: LiveOffer[]) =>
  list.sort((a, b) => Number(a.needsReview) - Number(b.needsReview) || a.ingredient.localeCompare(b.ingredient) || (a.unitPriceOre ?? 1e9) - (b.unitPriceOre ?? 1e9) || a.offer.id.localeCompare(b.offer.id));
