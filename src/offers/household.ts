// Husholdningstilbud fra en tilbudskilde (utvidelse C). Tjeks data har ingen kategori vi bruker (tjek.ts leser ingen), så
// vi søker på våre egne husholdningsord (ett søk per vare i src/data/household-rules.json) og klassifiserer overskriften
// med den rene motoren (engine/household.ts). Ingen lagring her (lagringen er server/offers/); kilden og klokken sendes inn.
import { HOUSEHOLD_RULES } from '../data/household';
import { classifyHousehold, householdOfferKey, type HouseholdRuleSet } from '../engine/household';
import { OFFER_TERMS } from './match';
import { addDays } from './service';
import type { NormalizedOffer, OfferSource } from './types';

/** Matord fra tilbudsmatchingen: et husholdningstreff som også treffer et matord, går til kontroll («mat»). */
export const FOOD_TERMS: string[] = [...new Set(Object.values(OFFER_TERMS).flat())].sort();

/** Søkeord mot kilden: første søkeord per vare. Ett kall per vare og runde (se kallbudsjettet i server/offers/collector.ts). */
export const householdQueries = (rules: HouseholdRuleSet = HOUSEHOLD_RULES) => rules.groups.flatMap((g) => g.items.map((i) => i.terms[0]));

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Tilbud klassifiseringen kjenner igjen som husholdningsvarer, sortert på (kilde, id), uten dubletter. */
export function householdCandidates(offers: readonly NormalizedOffer[], rules: HouseholdRuleSet = HOUSEHOLD_RULES): NormalizedOffer[] {
  const out = new Map<string, NormalizedOffer>();
  for (const o of offers) if (!out.has(householdOfferKey(o)) && classifyHousehold(o, rules, FOOD_TERMS)) out.set(householdOfferKey(o), o);
  return [...out.values()].sort((a, b) => cmp(householdOfferKey(a), householdOfferKey(b)));
}

export interface HouseholdCollectOptions {
  country: string; today: string; limit?: number; delayMs?: number; sleep?: (ms: number) => Promise<void>; rules?: HouseholdRuleSet;
}
/** Henter husholdningstilbud gyldige i dag eller fra innen 7 dager (som «Tilbud nå»). Kildefeil bobler opp. */
export async function collectHousehold(source: OfferSource, o: HouseholdCollectOptions): Promise<NormalizedOffer[]> {
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const rules = o.rules ?? HOUSEHOLD_RULES;
  const until = addDays(o.today, 7);
  const found: NormalizedOffer[] = [];
  for (const query of householdQueries(rules)) {
    const offers = await source.searchOffers({ query, country: o.country, limit: o.limit ?? 20 });
    for (const offer of offers) {
      const from = offer.validFrom.slice(0, 10), to = offer.validUntil.slice(0, 10);
      if (to >= o.today && from <= until) found.push(offer);
    }
    await sleep(o.delayMs ?? 500); // vær snill mot kilden
  }
  return householdCandidates(found, rules);
}
