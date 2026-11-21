// Kobler et tilbud til en ingrediens og regner pris per standardenhet. Ren funksjon, ingen nettverk.
import type { Ingredient } from '../engine/types';
import type { NormalizedOffer } from './types';

/** Norske søkeord per ingrediens. Redaktøren utvider listen; tvetydige treff går til kontroll. */
export const OFFER_TERMS: Record<string, string[]> = {
  pasta: ['spagetti', 'pasta', 'penne'], tomat: ['hakkede tomater', 'tomat hakket'], kjottdeig: ['kjøttdeig'],
  lok: ['løk', 'gul løk'], ris: ['ris', 'jasminris'], kylling: ['kyllingfilet', 'kylling'], kokosmelk: ['kokosmelk'],
  torsk: ['torsk', 'torskefilet'], poteter: ['poteter'], gulrot: ['gulrot', 'gulrøtter'], fiskekaker: ['fiskekaker'],
  tortilla: ['tortilla'], mais: ['mais'], paprika: ['paprika'], ost: ['norvegia', 'ost'], romme: ['rømme'],
  egg: ['egg'], melk: ['lettmelk', 'melk'], mel: ['hvetemel'], brokkoli: ['brokkoli'], laks: ['laks', 'laksefilet'],
  spinat: ['spinat'], linser: ['linser'], bonner: ['kidneybønner', 'bønner'],
};

export interface MatchedOffer {
  offer: NormalizedOffer;
  ingredient: string;
  /** Pris per 1000 g/ml (øre), eller per stk. null hvis mengde ikke er kjent. */
  unitPriceOre: number | null;
  /** Uavklart: tilbudet mangler pris eller mengde, og kan ikke regnes som pakningspris. */
  needsReview: boolean;
}

const norm = (s: string) => s.toLowerCase();

/** Gyldig på handledatoen (ISO-datoer), ikke ved lesetidspunktet. */
export const validOn = (o: NormalizedOffer, shopDate: string) => o.validFrom.slice(0, 10) <= shopDate && o.validUntil.slice(0, 10) >= shopDate;

export function matchOffer(offer: NormalizedOffer, ingredients: Ingredient[], shopDate: string, terms = OFFER_TERMS): MatchedOffer | null {
  if (!validOn(offer, shopDate)) return null; // utløpte og kommende tilbud gir ingen rabatt
  const text = norm(`${offer.heading} ${offer.description ?? ''}`);
  const hits = ingredients.filter((i) => (terms[i.id] ?? []).some((t) => text.includes(norm(t))));
  if (hits.length === 0) return null;
  // Flere mulige ingredienser: velg den med lengst treff, men merk for kontroll hvis det er uavgjort.
  const score = (i: Ingredient) => Math.max(...(terms[i.id] ?? []).filter((t) => text.includes(norm(t))).map((t) => t.length));
  const sorted = [...hits].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const ambiguous = sorted.length > 1 && score(sorted[0]) === score(sorted[1]);
  const best = sorted[0];
  const unitPriceOre = offer.priceOre !== null && offer.amount ? Math.round((offer.priceOre / offer.amount) * 1000) : null;
  return { offer, ingredient: best.id, unitPriceOre, needsReview: ambiguous || offer.priceOre === null || (offer.amount === null && offer.pieces === null) };
}
