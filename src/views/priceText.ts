// Prisstatus i visningene: status og dato der prisen vises (regel 2: anslått, aldri løfte om sluttpris).
import { isStale, MAX_PRICE_AGE_DAYS } from '../engine/prices';
import type { PriceStatus } from '../engine/types';

/** ÅÅÅÅ-MM-DD (eller ISO-tid) som «17.11.2026». Ukjent format vises som det er. */
export const norDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
};

/** Kort status for en prislinje, med dato når prisen bare er et estimat: «estimert pris, sist sett 17.11.2026». */
export function priceStatusText(status: PriceStatus, observed: string | null): string {
  if (status === 'estimat') return `estimert pris${observed ? `, sist sett ${norDate(observed)}` : ''}`;
  return status === 'tilbud' ? 'tilbud' : status === 'ordinær' ? 'ordinær pris' : 'ukjent pris';
}

/** Forklaring når prisen er et estimat fordi observasjonen er for gammel (samme grense som motoren). */
export function staleNote(status: PriceStatus, observed: string | null, shopDay: string): string | null {
  if (status !== 'estimat' || !observed || !isStale(observed, shopDay)) return null;
  return `Siste observerte pris er fra ${norDate(observed)}, mer enn ${MAX_PRICE_AGE_DAYS} dager før handledagen. Den brukes bare som estimat og taper alltid mot en nyere pris.`;
}
