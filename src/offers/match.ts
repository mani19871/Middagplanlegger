// Kobler et tilbud til en ingrediens og regner pris per standardenhet. Ren funksjon, ingen nettverk.
import type { Ingredient } from '../engine/types';
import type { NormalizedOffer } from './types';

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
  blomkal: ['blomkål'], kalrot: ['kålrot'], nudler: ['hvetenudler'],
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

export function matchOffer(offer: NormalizedOffer, ingredients: Ingredient[], shopDate: string, terms = OFFER_TERMS): MatchedOffer | null {
  if (!validOn(offer, shopDate)) return null; // utløpte og kommende tilbud gir ingen rabatt
  const text = norm(offer.heading); // beskrivelsen er for støyende til å matche på
  if (EXCLUDE.some((w) => (w.length <= 3 ? new RegExp(`(^|[^${L}])${w}`).test(text) : text.includes(w)))) return null;
  const hits = ingredients.filter((i) => (terms[i.id] ?? []).some((t) => hasWord(text, norm(t))));
  if (hits.length === 0) return null;
  // Flere mulige ingredienser: velg den med lengst treff, men merk for kontroll hvis det er uavgjort.
  const score = (i: Ingredient) => Math.max(...(terms[i.id] ?? []).filter((t) => hasWord(text, norm(t))).map((t) => t.length));
  const sorted = [...hits].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const ambiguous = sorted.length > 1 && score(sorted[0]) === score(sorted[1]);
  const best = sorted[0];
  const unitPriceOre = offer.priceOre !== null && offer.amount ? Math.round((offer.priceOre / offer.amount) * 1000) : null;
  // Stykkpris kan bare brukes direkte for ingredienser målt i stykk; ellers trengs vekt.
  const unknownAmount = best.unit === 'stk' ? offer.pieces === null : offer.amount === null || offer.unit !== best.unit;
  const multipack = (offer.pieces ?? 1) > 1 && offer.unit !== null;
  return { offer, ingredient: best.id, unitPriceOre, needsReview: ambiguous || offer.priceOre === null || unknownAmount || multipack };
}
