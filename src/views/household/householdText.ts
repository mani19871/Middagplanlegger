// Rene tekster for husholdningsvarer (utvidelse C): status, årsaker, gyldighet og kildelinje. Ingen klokke her.
import type { HouseholdLineState, HouseholdMatch, HouseholdReason } from '../../engine/household';
import { kr } from '../../engine/format';

const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const OSLO = new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', day: '2-digit', month: '2-digit', year: 'numeric' });

/** «Gyldig 23.11.–29.11.» */
export const validityText = (o: { validFrom: string; validUntil: string }) => `Gyldig ${dm(o.validFrom)}–${dm(o.validUntil)}`;
/** «Kilde: Tjek, pris sett 23.11.2026» (når Tjek viste prisen, ikke når appen leste den). */
export function seenText(observed: string | null | undefined): string {
  const t = observed ? Date.parse(observed) : NaN;
  return Number.isFinite(t) ? `Kilde: Tjek, pris sett ${OSLO.format(new Date(t))}` : 'Kilde: Tjek';
}

const REASON: Record<HouseholdReason, string> = {
  forslag: 'kategorien er et søkeordtreff, ikke kontrollert', tvetydig: 'passer flere varer', mat: 'kan være mat',
  'pris ukjent': 'pris ukjent', vilkår: 'har vilkår (f.eks. medlemspris eller «3 for 2»)',
};
/** Årsakene som tekst, i fast rekkefølge. Tom liste: tom streng. */
export const reasonText = (reasons: readonly HouseholdReason[]) => reasons.map((r) => REASON[r]).join(', ');

/** Pristekst i tilbudsfangsten: anslått tilbudspris, eller hvorfor prisen ikke kan regnes med. */
export const catchPriceText = (m: HouseholdMatch) =>
  m.priceUsable && m.offer.priceOre !== null ? `${kr(m.offer.priceOre)}, anslått` : m.offer.priceOre === null ? 'Pris ukjent' : 'Pris ikke regnet med (vilkår)';

/** Hvorfor en linje under «Andre varer» har eller mangler pris. */
export const LINE_STATE: Record<HouseholdLineState, string> = {
  pris: 'anslått tilbudspris', 'ingen-tilbud': 'tilbudet vises ikke nå, ingen pris', kjede: 'kjeden er ikke valgt lenger, ingen pris',
  'utenfor-gyldighet': 'tilbudet gjelder ikke på handledagen, ingen pris', 'gammel-pris': 'prisen er for gammel, ingen pris',
  'pris-ukjent': 'pris ukjent', vilkår: 'tilbudet har vilkår, pris ikke regnet med',
};

/** Nøktern fremheving: aldri en oppfordring til å kjøpe mer. */
export const HIGHLIGHT_TEXT = { basisvare: 'Står på basisvarene deres', 'lagt-til-før': 'Dere har hatt den på lista før' } as const;
