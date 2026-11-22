// Lagring av tilbud og priser fra eksterne tilbudskilder (Tjek). Skilt helt fra synk-lagringen (server/storage/): egen
// database, ingen husstand, ingen enhet, ingen persondata. Async, så en annen database kan settes inn uten å endre API-et.
// Brukeren opplyser (2026-11-22) at Tjek-avtalen tillater lagring av priser; hvor lenge er ikke kjent for oss
// (phase0/tjek-avtale.md), så oppbevaringstiden er konfigurerbar (OFFER_RETENTION_DAYS).
import type { Unit } from '../../src/engine/types';
import type { NormalizedOffer } from '../../src/offers/types';

/** Status for en lagret prisobservasjon (CLAUDE.md regel 2): tilbud med kjent pris, ellers ukjent. */
export type ObservationStatus = 'tilbud' | 'ukjent';

/** Én observasjon av et tilbud. Nøkkel (kilde, id). Bare det som trengs for prishistorikk og dekningsmåling. */
export interface OfferObservation {
  source: string; id: string;
  /** Normalisert kjedenavn (`normalizeChain`), f.eks. «COOP OBS». */
  chain: string;
  /** Geografisk omfang: land. Tjek skiller ikke på utsalg, så omfanget er kjeden i hele landet. */
  country: string;
  dealerId: string; dealerName: string;
  heading: string; description: string | null;
  priceOre: number | null; prePriceOre: number | null;
  amount: number | null; unit: Unit | null; pieces: number | null;
  /** Gyldighet (ÅÅÅÅ-MM-DD, norsk dato), begge dager med. */
  validFrom: string; validUntil: string;
  status: ObservationStatus;
  /** Første gang denne prisen (dette innholdet) ble sett hos kilden. */
  firstObserved: string;
  /** Siste gang kilden viste prisen. Aldri tidspunktet noen leste den fra lagringen. */
  lastObserved: string;
  /** Adressen til produktbildet hos kilden (https), eller null. Bildet selv lagres ikke. */
  image: string | null;
}

/** Hva `record` gjorde: nye rader, rader med nytt innhold, rader sett på nytt, og avviste (ugyldige, eldre eller over kvoten). */
export interface RecordResult { inserted: number; updated: number; seen: number; skipped: number }

/** Grenser for lagrede felt (tegn) og antall. Lengre tekster kortes ned; for lange id-er avvises. */
export const OFFER_LIMITS = {
  id: 100, heading: 200, description: 500, dealerName: 100, dealerId: 100, source: 20,
  /** Høyst så mange rader totalt (vern mot full disk). */ maxRows: 200_000,
  /** Høyst så mange observasjoner per `record`-kall. */ perRecord: 5000,
};

export interface CurrentQuery {
  /** Dagens dato (ÅÅÅÅ-MM-DD, norsk tid). Gyldige i dag og kommende innen 7 dager tas med. */
  today: string;
  /** Bare observasjoner sist sett denne datoen eller senere (prisalder, se MAX_PRICE_AGE_DAYS i src/engine/prices.ts). */
  observedSince: string;
  limit: number;
}

export interface OfferStore {
  /**
   * Lagrer observasjonene idempotent på (kilde, id). `observed` i hvert tilbud er når kilden viste det; mangler det eller
   * ligger det etter `receivedAt`, brukes `receivedAt`. Samme innhold: siste observasjon flyttes fram. Nytt innhold (f.eks.
   * ny pris): raden får det nye innholdet og ny første observasjon. En eldre observasjon overskriver aldri en nyere.
   */
  record(offers: NormalizedOffer[], country: string, receivedAt: string): Promise<RecordResult>;
  /** Gjeldende og kommende observasjoner, sortert på (kilde, id). */
  current(q: CurrentQuery): Promise<OfferObservation[]>;
  /** Oppbevaring: sletter rader som er utløpt og ikke sett siden `before` (ISO). Høyst `limit`. Returnerer antall. */
  deleteBefore(before: string, limit: number): Promise<number>;
  /** Tidspunkt for siste vellykkede henting fra kilden, eller null. */
  lastFetch(): Promise<string | null>;
  setLastFetch(at: string): Promise<void>;
  /** Tellinger uten innhold (til oppstartslogg og dekningsmåling). */
  counts(): Promise<{ observations: number; chains: number }>;
  ping(): Promise<void>;
  close(): Promise<void>;
}
