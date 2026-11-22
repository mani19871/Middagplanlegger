// Rene tekster for kundeaviser og bilder fra Tjek: kreditering med dato, periode og alternativ tekst. Ingen klokke her.
import type { Catalog } from '../../offers/types';

const OSLO = new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', day: '2-digit', month: '2-digit', year: 'numeric' });

/** «Kilde: Tjek, hentet dd.mm.åååå» (norsk dato). Uten lesbar dato: bare «Kilde: Tjek». Vises der Tjek-data vises. */
export function credit(observed: string | null | undefined): string {
  const t = observed ? Date.parse(observed) : NaN;
  return Number.isFinite(t) ? `Kilde: Tjek, hentet ${OSLO.format(new Date(t))}` : 'Kilde: Tjek';
}

/** «23.11.–29.11.» fra ÅÅÅÅ-MM-DD. */
export const periodText = (c: Pick<Catalog, 'validFrom' | 'validUntil'>) =>
  `${c.validFrom.slice(8, 10)}.${c.validFrom.slice(5, 7)}.–${c.validUntil.slice(8, 10)}.${c.validUntil.slice(5, 7)}.`;

/** Alternativ tekst for en avisside: kjede, tittel og sidetall. */
export const pageAlt = (c: Pick<Catalog, 'dealerName' | 'label'>, n: number, total: number | null) =>
  `${c.dealerName}${c.label ? `, ${c.label}` : ''}: side ${n}${total ? ` av ${total}` : ''}`;

/** Merknad når bilder lastes fra Tjek: nettleseren henter dem direkte, så Tjek (eller deres bildetjeneste) ser IP-adressen. */
export const IMAGE_NOTE = 'Bildene lastes direkte fra Tjek. Tjek ser da IP-adressen til enheten din, men ingenting annet fra appen.';
