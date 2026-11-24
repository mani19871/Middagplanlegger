// Prisvalg: hvilken prisobservasjon som gjelder for et produkt i en butikk. Ren og deterministisk (regel 1–3).
// Planmotoren (planner.ts `bestOffer`) og utsolgt / fant ikke (substitution.ts `priceIn`) bruker begge denne.
import type { PriceObs } from './types';
import { civilDay, osloDate } from './oslo';

/**
 * Aldersgrense for kjent pris. En observasjon som er mer enn så mange dager eldre enn referansedatoen (handledagen)
 * teller ikke som kjent pris: den vises som estimat med datoen sin og taper alltid mot en nyere observasjon.
 */
export const MAX_PRICE_AGE_DAYS = 14;

/**
 * Dagnummer (dager siden 1970-01-01) for den norske datoen til en dato eller ISO-tid. En tid med sone (Tjek-observasjoner
 * lagres i UTC) regnes om til norsk dato (`osloDate`, ren kalenderregning, ingen klokke). Ugyldig dato gir null.
 */
function dayNumber(iso: string): number | null {
  const d = osloDate(iso);
  return d === null ? null : civilDay(Number(d.slice(0, 4)), Number(d.slice(5, 7)), Number(d.slice(8, 10)));
}

/**
 * Datoen alder måles mot: handledagen når den er oppgitt. Uten handledag brukes nyeste observasjonsdato i
 * katalogen (prisversjonen), så resultatet bare avhenger av inndata.
 */
export function priceReferenceDate(prices: PriceObs[], shopDate?: string): string | null {
  if (shopDate) return shopDate;
  let max: string | null = null;
  for (const o of prices) {
    const d = osloDate(o.observed);
    if (d !== null && (max === null || d > max)) max = d;
  }
  return max;
}

/** Alder i hele dager fra observasjonen til referansedatoen (negativ hvis observert etter). Null hvis datoen er ugyldig. */
export function priceAgeDays(observed: string, reference: string | null): number | null {
  if (!reference) return null;
  const a = dayNumber(observed), r = dayNumber(reference);
  return a === null || r === null ? null : r - a;
}

/** For gammel til å være kjent pris. Uten referansedato kan ingenting måles; uten lesbar observasjonsdato er prisen gammel. */
export function isStale(observed: string, reference: string | null): boolean {
  if (!reference || dayNumber(reference) === null) return false;
  const age = priceAgeDays(observed, reference);
  return age === null || age > MAX_PRICE_AGE_DAYS;
}

/** En prisobservasjon gjelder ikke etter `validUntil` (et utløpt tilbud blir aldri dagens pris). */
export const obsValidOn = (o: PriceObs, shopDate?: string) => !(shopDate && o.validUntil && o.validUntil < shopDate);

/** Gyldig beløp: hele øre over null. */
const validOre = (o: PriceObs) => Number.isInteger(o.ore) && o.ore > 0;

/** Fast rekkefølge for observasjoner som ellers er like, så rekkefølgen i katalogen aldri avgjør. */
const tail = (a: PriceObs, b: PriceObs) =>
  a.status.localeCompare(b.status) || a.source.localeCompare(b.source) || (a.validUntil ?? '').localeCompare(b.validUntil ?? '');

export interface ResolvedPrice {
  /** Observasjonen slik motoren bruker den. En gammel observasjon har status `estimat` (dato og kilde beholdes). */
  obs: PriceObs;
  /** Observasjonen er eldre enn `MAX_PRICE_AGE_DAYS`: bare estimat. */
  stale: boolean;
}

/**
 * Prisen som gjelder for produktet i butikken på handledagen.
 * - Bare observasjoner innenfor aldersgrensen er kjent pris. Blant dem velges laveste gyldige pris (likhet: nyeste,
 *   så status, kilde, gyldighet).
 * - Finnes ingen ny nok observasjon, brukes den nyeste gamle som estimat. Et gammelt tilbud uten gyldighet er bare et
 *   historisk tilbud og brukes aldri, heller ikke som estimat (regel 2).
 * - Utløpte observasjoner og ugyldige beløp brukes aldri.
 */
export function resolvePrice(
  productId: string, storeId: string, ctx: { catalog: { prices: PriceObs[] }; shopDate?: string },
): ResolvedPrice | null {
  const ref = priceReferenceDate(ctx.catalog.prices, ctx.shopDate);
  let fresh: PriceObs | null = null;
  let old: PriceObs | null = null;
  for (const o of ctx.catalog.prices) {
    if (o.productId !== productId || o.storeId !== storeId || !obsValidOn(o, ctx.shopDate) || !validOre(o)) continue;
    if (!isStale(o.observed, ref)) {
      const better = !fresh || o.ore < fresh.ore ||
        (o.ore === fresh.ore && (o.observed > fresh.observed || (o.observed === fresh.observed && tail(o, fresh) < 0)));
      if (better) fresh = o;
    } else {
      if (o.status === 'tilbud' && !o.validUntil) continue;
      const better = !old || o.observed > old.observed ||
        (o.observed === old.observed && (o.ore < old.ore || (o.ore === old.ore && tail(o, old) < 0)));
      if (better) old = o;
    }
  }
  if (fresh) return { obs: fresh, stale: false };
  if (old) return { obs: { ...old, status: 'estimat' }, stale: true };
  return null;
}
