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
  /** Produktbilde hos kilden (https-adresse), eller null. Vises bare fra verter driften har tillatt (TJEK_IMAGE_HOSTS). */
  image?: string | null;
}
/** En kundeavis (katalog) hos kilden. Sidene hentes for seg (`catalogPages`). */
export interface Catalog {
  id: string; source: string; dealerId: string; dealerName: string; label: string | null;
  validFrom: string; validUntil: string; // ÅÅÅÅ-MM-DD, norsk dato, begge med
  pageCount: number | null;
  observed: string; // ISO, når kilden viste katalogen
}
/** Én avisside: bildeadresser hos kilden (https) i tre størrelser, eller null. Lastes aldri ned og lagres ikke av oss. */
export interface CatalogPage { number: number; thumb: string | null; view: string | null; zoom: string | null }
export interface Dealer { id: string; name: string; country: string }
export interface OfferQuery { query: string; country: string; dealerIds?: string[]; limit?: number }

/** Alle tilbudskilder implementerer dette. Planmotoren kjenner ikke kildene; den får ferdig matchede priser. */
export interface OfferSource {
  readonly id: string;
  listDealers(country: string): Promise<Dealer[]>;
  searchOffers(q: OfferQuery): Promise<NormalizedOffer[]>;
  /** Kundeaviser i landet (bare kilder som har dem). */
  listCatalogs?(country: string): Promise<Catalog[]>;
  catalogPages?(catalogId: string): Promise<CatalogPage[]>;
}
