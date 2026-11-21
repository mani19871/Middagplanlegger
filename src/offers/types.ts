import type { Unit } from '../engine/types';

/** Et tilbud fra en ekstern kilde, normalisert til øre og standardenheter. */
export interface NormalizedOffer {
  id: string;
  source: string; // «tjek», «demo» …
  heading: string;
  description: string | null;
  priceOre: number | null;
  prePriceOre: number | null;
  amount: number | null; // mengde i standardenhet (g, ml)
  unit: Unit | null;
  pieces: number | null;
  dealerId: string;
  dealerName: string;
  validFrom: string; // ISO
  validUntil: string; // ISO
  observed: string; // ISO, når vi leste tilbudet
}
export interface Dealer { id: string; name: string; country: string }
export interface OfferQuery { query: string; country: string; dealerIds?: string[]; limit?: number }

/** Alle tilbudskilder implementerer dette. Planmotoren kjenner ikke kildene; den får ferdig matchede priser. */
export interface OfferSource {
  readonly id: string;
  listDealers(country: string): Promise<Dealer[]>;
  searchOffers(q: OfferQuery): Promise<NormalizedOffer[]>;
}
