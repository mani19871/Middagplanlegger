// Kobler et tilbud til en ingrediens og regner pris per standardenhet. Ren funksjon, ingen nettverk.
import type { Ingredient } from '../engine/types';
import type { NormalizedOffer } from './types';
import { normText, OFFER_RULES, patternMatches, type OfferRule } from './rules';

/** Norske søkeord per ingrediens. Redaktøren utvider listen; tvetydige treff går til kontroll. */
export const OFFER_TERMS: Record<string, string[]> = {
  pasta: ['spagetti', 'pasta', 'penne'], tomat: ['hakkede tomater', 'tomat hakket'], kjottdeig: ['kjøttdeig'],
  lok: ['løk', 'gul løk'], ris: ['ris', 'jasminris'], kylling: ['kyllingfilet', 'kyllingbryst', 'kylling'], kokosmelk: ['kokosmelk'],
  torsk: ['torsk', 'torskefilet'], poteter: ['poteter'], gulrot: ['gulrot', 'gulrøtter'], fiskekaker: ['fiskekaker'],
  tortilla: ['tortilla'], mais: ['mais'], paprika: ['paprika'], ost: ['norvegia', 'ost'], romme: ['rømme'],
  egg: ['egg'], melk: ['lettmelk', 'melk'], mel: ['hvetemel'], brokkoli: ['brokkoli'], laks: ['laks', 'laksefilet'],
  spinat: ['spinat'], linser: ['linser'], bonner: ['kidneybønner', 'bønner'],
  svinekotelett: ['svinekotelett', 'nakkekotelett', 'kotelett'], svinedeig: ['svinekjøttdeig', 'svinedeig'], flesk: ['sideflesk', 'flesk'],
  lammedeig: ['lammekjøttdeig', 'lammedeig'], reker: ['reker'], sei: ['seifilet', 'sei'], hyse: ['hysefilet', 'hyse'],
  sild: ['sildefilet', 'sild'], makrell: ['makrell'], kikerter: ['kikerter'], tofu: ['tofu'], sopp: ['sjampinjong', 'champignon'],
  blomkal: ['blomkål'], kalrot: ['kålrot'], nudler: ['hvetenudler'], soyasaus: ['soyasaus'],
};

/** Hvorfor et treff må kontrolleres før det kan brukes i en sum. */
export type ReviewReason = 'tvetydig' | 'pris ukjent' | 'mengde ukjent' | 'flerpakning' | 'vilkår';

export interface MatchedOffer {
  offer: NormalizedOffer;
  ingredient: string;
  /** Pris per 1000 g/ml (øre), eller per stk. null hvis mengde ikke er kjent. */
  unitPriceOre: number | null;
  /** Uavklart: tilbudet mangler pris, mengde eller har vilkår, og kan ikke regnes som pakningspris. */
  needsReview: boolean;
  reasons: ReviewReason[];
  /** Koblingen er godkjent av en kuratert regel (src/data/offer-rules.json), ikke bare et søkeordforslag. */
  approved: boolean;
  /** Mønsteret i regelen som avgjorde koblingen, ellers null. */
  rule: string | null;
}

const norm = (s: string) => s.toLowerCase();
const L = 'a-zæøåäö';
/** Ord som viser at det er en bearbeidet vare eller ikke mat vi planlegger med (kaffe, chips, saus …). */
export const EXCLUDE = ['kaffe', 'chips', 'saus', 'suppe', 'kake', 'pålegg', 'snacks', 'drikke', 'juice', 'sjokolade', 'godteri', 'pulver', 'dressing', 'bolle', 'brød', 'baby', 'hundemat', 'kattemat', 'øl', 'vin', 'iskrem', 'pizza', 'ferdigrett', 'gryte', 'salat', 'smoothie', 'pringles', 'koker', 'gratin', 'kjeks', 'nudler', 'krydder',
  // fra tilbudstrolden-mcp (MIT), norske ikke-ingrediens- og bearbeidingsord:
  'røkt', 'røykt', 'marinert', 'panert', 'gravet', 'tørket', 'postei', 'spekemat', 'spekepølse', 'spekeskinke', 'grateng', 'omelett', 'gryterett', 'instant', 'kopnudler', 'brus', 'energidrikk', 'sjampo', 'såpe', 'oppvask', 'vaselin', 'blomsterløk', 'hundesnacks', 'treningsbiter', 'pai'];
/** Hele ord (med vanlige norske endelser). «ost» treffer ikke «kost» eller «ostekake». */
const hasWord = (text: string, term: string) =>
  new RegExp(`(^|[^${L}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(e|en|er|ene|et)?($|[^${L}])`).test(text);

/** Gyldig på handledatoen (ISO-datoer), ikke ved lesetidspunktet. */
export const validOn = (o: NormalizedOffer, shopDate: string) => o.validFrom.slice(0, 10) <= shopDate && o.validUntil.slice(0, 10) >= shopDate;

/** Ord som tyder på kampanjevilkår vi ikke kan regne med (medlemspris, «3 for 2», kupong, mengdetak …). */
const CONDITIONS = [/medlem/, /trumf/, /kupong/, /ved kjøp av/, /\d+\s*for\s*\d+/, /\d+\s*%/, /maks\.?\s*\d/, /(per|pr\.?)\s*kunde/, /app-?pris/, /i appen/, /æ-?pris/];
export const hasConditions = (o: NormalizedOffer) => {
  const text = norm(`${o.heading} ${o.description ?? ''}`);
  return CONDITIONS.some((r) => r.test(text));
};

/** Avvisningsregelen som stopper hele tilbudet (regel uten ingrediens), eller null. */
export const rejectedBy = (heading: string, rules: OfferRule[] = OFFER_RULES) =>
  rules.find((r) => r.decision === 'avvist' && !r.ingredient && patternMatches(heading, r.pattern)) ?? null;

interface Pick { ingredient: Ingredient; ambiguous: boolean; approved: boolean; rule: string | null }

/** Kobler en overskrift til en ingrediens: avvisning, så godkjente regler, så søkeord (med «tillatt»-unntak fra utelukkelseslisten). */
function pickIngredient(heading: string, ingredients: Ingredient[], terms: Record<string, string[]>, rules: OfferRule[]): Pick | null {
  if (rejectedBy(heading, rules)) return null;
  const blocked = new Set(rules.filter((r) => r.decision === 'avvist' && r.ingredient && patternMatches(heading, r.pattern)).map((r) => r.ingredient!));
  const allowed = ingredients.filter((i) => !blocked.has(i.id));
  const approved = rules
    .filter((r) => r.decision === 'godkjent' && patternMatches(heading, r.pattern))
    .map((r) => ({ r, ing: allowed.find((i) => i.id === r.ingredient) }))
    .filter((x): x is { r: OfferRule; ing: Ingredient } => !!x.ing)
    .sort((a, b) => b.r.pattern.length - a.r.pattern.length || a.ing.id.localeCompare(b.ing.id));
  if (approved.length > 0) {
    const [top, next] = approved;
    // Like lange godkjente mønstre for ulike ingredienser: regelfilen er selvmotsigende, så ingen godkjenning.
    const ambiguous = !!next && next.r.pattern.length === top.r.pattern.length && next.ing.id !== top.ing.id;
    return { ingredient: top.ing, ambiguous, approved: !ambiguous, rule: top.r.pattern };
  }
  const text = norm(heading); // beskrivelsen er for støyende til å matche på
  // «tillatt»-mønstre teller ikke mot utelukkelseslisten («soyasaus» er ikke «saus»), men resten av overskriften gjør det.
  const allows = rules.filter((r) => r.decision === 'tillatt' && allowed.some((i) => i.id === r.ingredient) && patternMatches(heading, r.pattern));
  let rest = normText(text);
  for (const a of allows) rest = rest.split(a.pattern).join(' ');
  if (EXCLUDE.some((w) => (w.length <= 3 ? new RegExp(`(^|[^${L}])${w}`).test(rest) : rest.includes(w)))) return null;
  const all: Record<string, string[]> = { ...terms };
  for (const a of allows) all[a.ingredient!] = [...(all[a.ingredient!] ?? []), a.pattern];
  const hits = allowed.filter((i) => (all[i.id] ?? []).some((t) => hasWord(text, norm(t))));
  if (hits.length === 0) return null;
  // Flere mulige ingredienser: velg den med lengst treff, men merk for kontroll hvis det er uavgjort.
  const score = (i: Ingredient) => Math.max(...(all[i.id] ?? []).filter((t) => hasWord(text, norm(t))).map((t) => t.length));
  const sorted = [...hits].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const rule = allows.find((a) => a.ingredient === sorted[0].id)?.pattern ?? null;
  return { ingredient: sorted[0], ambiguous: sorted.length > 1 && score(sorted[0]) === score(sorted[1]), approved: false, rule };
}

export function matchOffer(offer: NormalizedOffer, ingredients: Ingredient[], shopDate: string, terms = OFFER_TERMS, rules: OfferRule[] = OFFER_RULES): MatchedOffer | null {
  if (!validOn(offer, shopDate)) return null; // utløpte og kommende tilbud gir ingen rabatt
  const pick = pickIngredient(offer.heading, ingredients, terms, rules);
  if (!pick) return null;
  const best = pick.ingredient;
  const unitPriceOre = offer.priceOre !== null && offer.amount ? Math.round((offer.priceOre / offer.amount) * 1000) : null;
  // Stykkpris kan bare brukes direkte for ingredienser målt i stykk; ellers trengs vekt i samme enhet.
  const unknownAmount = best.unit === 'stk' ? offer.pieces === null : offer.amount === null || offer.unit !== best.unit;
  const multipack = (offer.pieces ?? 1) > 1 && offer.unit !== null;
  const reasons: ReviewReason[] = [];
  if (pick.ambiguous) reasons.push('tvetydig');
  if (offer.priceOre === null) reasons.push('pris ukjent');
  if (unknownAmount) reasons.push('mengde ukjent');
  if (multipack) reasons.push('flerpakning');
  if (hasConditions(offer)) reasons.push('vilkår');
  return { offer, ingredient: best.id, unitPriceOre, needsReview: reasons.length > 0, reasons, approved: pick.approved, rule: pick.rule };
}
