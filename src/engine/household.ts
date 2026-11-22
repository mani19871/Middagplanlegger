// Husholdningsvarer drevet av tilbudsavisene (utvidelse C). Ren og deterministisk (regel 1): ingen klokke, tilfeldighet
// eller nett. Beløp i øre.
//
// Klassifisering (`classifyHousehold`): er et tilbud fra Tjek en husholdningsvare, og hvilken? Tjeks data har ingen
// kategori vi bruker (src/offers/tjek.ts leser ingen), så vi avgjør det selv ut fra overskriften, med en menneskekuratert
// regelfil (src/data/household-rules.json, samme modell som offer-rules.json):
//  1. Sensitive ord (bleier, baby, medisin …) gir aldri treff, uansett regel. Appen skal ikke gjøre slike varer til en
//     del av husstandens delte liste via denne veien.
//  2. «avvist» uten vare stopper hele tilbudet; «avvist» med vare stopper bare den koblingen. Avvisning vinner alltid.
//  3. «godkjent»: mønsteret (hel frase) er varen. Bare dette gir status «godkjent». Lengste mønster vinner; like lange
//     mønstre for ulike varer er en selvmotsigende regelfil og gir «kontroll» (tvetydig).
//  4. Ellers søkeord med ordgrenser (vanlige endelser): treffet er bare et forslag og har alltid status «kontroll».
//     Utelukkelsesord (også som forledd, f.eks. «kaffe» i «kaffefilter») stopper treffet, med mindre et «tillatt»-mønster
//     gjelder. Treffer overskriften også et matord, får den årsaken «mat».
// Alt som ikke er godkjent av en regel, går til «trenger kontroll». Ingenting godkjennes automatisk.
//
// «Andre varer» (`householdTotal`): linjer brukeren har lagt på handlelista fra tilbudsfangsten. Linja i den delte lista
// har bare varenavn og kjede (`hus:<kilde>:<tilbud>#<n>`); pris og gyldighet slås opp i tilbudene som vises nå. En linje
// får pris bare når tilbudet finnes, er fra en valgt kjede, er gyldig på handledagen, prisen er sett innenfor
// MAX_PRICE_AGE_DAYS før handledagen, prisen er kjent i hele øre og overskriften ikke har vilkårsord. Summen er egen og
// blandes aldri inn i middagskurven, butikksammenligningen, «Med kontrollerte tilbud» eller budsjettsvaret: planner.ts,
// offerTotal.ts og deals.ts leser ikke dette.
import type { Unit } from './types';
import { chainSet, normalizeChain } from './chains';
import { hasConditionText } from './conditions';
import { isStale } from './prices';

export interface HouseholdItem { id: string; name: string; terms: string[] }
export interface HouseholdGroup { id: string; name: string; items: HouseholdItem[] }
export type HouseholdDecision = 'godkjent' | 'avvist' | 'tillatt';
export interface HouseholdRule { pattern: string; decision: HouseholdDecision; item?: string; note?: string }
export interface HouseholdRuleSet {
  groups: HouseholdGroup[];
  /** Ord som viser at det ikke er en husholdningsvare vi følger (mat, drikke, utstyr). Treffer ved ordstart. */
  exclude: string[];
  /** Ord som kan avsløre helse eller barns alder. Treffer hvor som helst i overskriften og kan ikke overstyres. */
  sensitive: string[];
  rules: HouseholdRule[];
}
export interface HouseholdRuleFile extends HouseholdRuleSet { version: 1; description?: string }

/** Det motoren trenger fra et normalisert tilbud (src/offers/types.ts `NormalizedOffer` passer). */
export interface HouseholdOfferIn {
  id: string; source: string; heading: string; description: string | null;
  priceOre: number | null; prePriceOre: number | null; amount: number | null; unit: Unit | null; pieces: number | null;
  dealerName: string; validFrom: string; validUntil: string; observed: string;
}
export type HouseholdReason = 'forslag' | 'tvetydig' | 'mat' | 'pris ukjent' | 'vilkår';
export interface HouseholdMatch<O extends HouseholdOfferIn = HouseholdOfferIn> {
  offer: O;
  /** Varen (id i regelfilen) og gruppen; ved tvetydig treff er det beste gjett. */
  item: string; group: string; name: string;
  /** «godkjent» bare med en kuratert regel; alt annet er «kontroll». */
  status: 'godkjent' | 'kontroll';
  reasons: HouseholdReason[];
  /** Mønsteret som avgjorde (godkjent eller tillatt), ellers null. */
  rule: string | null;
  /** Normalisert kjedenavn (chains.ts). */
  chain: string;
  /** Prisen kan brukes i «Andre varer»: kjent pris i hele øre og ingen vilkårsord. Gyldighet og alder sjekkes mot handledagen. */
  priceUsable: boolean;
}

// ---------- Regelfil ----------

const L = 'a-zæøåäöüé0-9';
export const normText = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Mønsteret som hel frase (ingen endelser). */
export const patternMatches = (text: string, pattern: string) => new RegExp(`(^|[^${L}])${esc(normText(pattern))}($|[^${L}])`).test(normText(text));
/** Helt ord med vanlige norske endelser: «pose» treffer «poser» og «posene», ikke «posebrett». */
const hasWord = (text: string, term: string) => new RegExp(`(^|[^${L}])${esc(normText(term))}(e|en|er|ene|et|r|n|ne)?($|[^${L}])`).test(text);
/** Ordet ved ordstart (også som forledd): «kaffe» treffer «kaffefilter», ikke «iskaffe». */
const startsWord = (text: string, w: string) => new RegExp(`(^|[^${L}])${esc(normText(w))}`).test(text);

const ID = /^[a-z0-9-]{1,40}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const words = (v: unknown, where: string): string[] => {
  if (!Array.isArray(v) || !v.every((w) => typeof w === 'string' && normText(w).length >= 2)) throw new Error(`Husholdningsregler: ${where} må være ord med minst to tegn`);
  return v.map(normText);
};

/** Sjekker og normaliserer regelfilen. Kaster ved feil, så en feil i filen stopper bygget og testene. */
export function parseHouseholdRules(x: unknown): HouseholdRuleSet {
  if (!isObj(x) || x.version !== 1 || !Array.isArray(x.groups) || !Array.isArray(x.rules)) throw new Error('Husholdningsregler: mangler version 1, groups[] eller rules[]');
  const groupIds = new Set<string>(), itemIds = new Set<string>();
  const groups: HouseholdGroup[] = x.groups.map((g, i) => {
    if (!isObj(g) || typeof g.id !== 'string' || !ID.test(g.id) || groupIds.has(g.id) || typeof g.name !== 'string' || !g.name.trim() || !Array.isArray(g.items) || g.items.length === 0) {
      throw new Error(`Husholdningsregler: gruppe ${i + 1} er ugyldig eller dobbel`);
    }
    groupIds.add(g.id);
    return { id: g.id, name: g.name.trim(), items: g.items.map((it, j) => {
      if (!isObj(it) || typeof it.id !== 'string' || !ID.test(it.id) || itemIds.has(it.id) || typeof it.name !== 'string' || !it.name.trim()) {
        throw new Error(`Husholdningsregler: vare ${j + 1} i ${g.id} er ugyldig eller dobbel`);
      }
      itemIds.add(it.id);
      const terms = words(it.terms, `søkeordene for ${it.id}`);
      if (terms.length === 0) throw new Error(`Husholdningsregler: ${it.id} mangler søkeord`);
      return { id: it.id, name: it.name.trim(), terms };
    }) };
  });
  const rules: HouseholdRule[] = x.rules.map((r, i) => {
    const where = `Husholdningsregel ${i + 1}`;
    if (!isObj(r) || typeof r.pattern !== 'string' || normText(r.pattern).length < 2) throw new Error(`${where}: mønsteret må ha minst to tegn`);
    if (r.decision !== 'godkjent' && r.decision !== 'avvist' && r.decision !== 'tillatt') throw new Error(`${where}: decision må være «godkjent», «avvist» eller «tillatt»`);
    if (r.decision !== 'avvist' && typeof r.item !== 'string') throw new Error(`${where}: ${r.decision} regel må ha vare`);
    if (r.item !== undefined && (typeof r.item !== 'string' || !itemIds.has(r.item))) throw new Error(`${where}: ukjent vare «${String(r.item)}»`);
    return { pattern: normText(r.pattern), decision: r.decision, ...(r.item ? { item: r.item as string } : {}), ...(typeof r.note === 'string' && r.note ? { note: r.note } : {}) };
  });
  const keys = rules.map(householdRuleKey);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) throw new Error(`Husholdningsregler: dobbel regel ${dup}`);
  return { groups, exclude: words(x.exclude ?? [], 'exclude'), sensitive: words(x.sensitive ?? [], 'sensitive'), rules: sortHouseholdRules(rules) };
}
export const householdRuleKey = (r: HouseholdRule) => `${r.decision}:${normText(r.pattern)}:${r.item ?? '*'}`;
export const sortHouseholdRules = (rules: HouseholdRule[]) =>
  [...rules].sort((a, b) => cmp(a.pattern, b.pattern) || cmp(a.item ?? '', b.item ?? '') || cmp(a.decision, b.decision));
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Legger til eller erstatter en regel for samme mønster (samme modell som offers/rules.ts). Idempotent. */
export function upsertHouseholdRule(rules: HouseholdRule[], rule: HouseholdRule): HouseholdRule[] {
  const r: HouseholdRule = { pattern: normText(rule.pattern), decision: rule.decision, ...(rule.item ? { item: rule.item } : {}), ...(rule.note ? { note: rule.note } : {}) };
  const clash = (x: HouseholdRule) => x.pattern === r.pattern && ((x.decision === 'godkjent' && r.decision === 'godkjent') || !x.item || !r.item || x.item === r.item);
  return sortHouseholdRules([...rules.filter((x) => !clash(x)), r]);
}
/** Hele regelfilen som tekst, klar til å lime inn i src/data/household-rules.json. */
export function householdRuleFileText(set: HouseholdRuleSet, description?: string): string {
  const file: HouseholdRuleFile = { version: 1, ...(description ? { description } : {}), groups: set.groups, exclude: set.exclude, sensitive: set.sensitive, rules: sortHouseholdRules(set.rules) };
  return `${JSON.stringify(file, null, 2)}\n`;
}

// ---------- Klassifisering ----------

interface ItemRef { item: HouseholdItem; group: HouseholdGroup; index: number }
const itemIndex = (rules: HouseholdRuleSet): Map<string, ItemRef> => {
  const m = new Map<string, ItemRef>();
  rules.groups.forEach((group, index) => { for (const item of group.items) m.set(item.id, { item, group, index }); });
  return m;
};

/** Klassifiserer ett tilbud. Null: ikke en husholdningsvare vi følger (eller utelukket). Se filhodet. */
export function classifyHousehold<O extends HouseholdOfferIn>(offer: O, rules: HouseholdRuleSet, foodTerms: readonly string[]): HouseholdMatch<O> | null {
  const text = normText(offer.heading ?? '');
  if (!text) return null;
  if (rules.sensitive.some((w) => text.includes(w))) return null;
  if (rules.rules.some((r) => r.decision === 'avvist' && !r.item && patternMatches(text, r.pattern))) return null;
  const items = itemIndex(rules);
  const blocked = new Set(rules.rules.filter((r) => r.decision === 'avvist' && r.item && patternMatches(text, r.pattern)).map((r) => r.item!));
  const open = (id: string | undefined) => !!id && items.has(id) && !blocked.has(id);

  let pick: { id: string; ambiguous: boolean; approved: boolean; rule: string | null } | null = null;
  const approved = rules.rules.filter((r) => r.decision === 'godkjent' && open(r.item) && patternMatches(text, r.pattern))
    .sort((a, b) => b.pattern.length - a.pattern.length || cmp(a.item!, b.item!));
  if (approved.length > 0) {
    const top = approved[0];
    const ambiguous = approved.some((r) => r.pattern.length === top.pattern.length && r.item !== top.item);
    pick = { id: top.item!, ambiguous, approved: !ambiguous, rule: top.pattern };
  } else {
    // «tillatt»-mønstre teller ikke mot utelukkelseslisten, men resten av overskriften gjør det.
    const allows = rules.rules.filter((r) => r.decision === 'tillatt' && open(r.item) && patternMatches(text, r.pattern));
    let rest = text;
    for (const a of allows) rest = rest.split(a.pattern).join(' ');
    if (rules.exclude.some((w) => startsWord(rest, w))) return null;
    const scored: { id: string; score: number; index: number }[] = [];
    for (const [id, ref] of items) {
      if (!open(id)) continue;
      const terms = [...ref.item.terms, ...allows.filter((a) => a.item === id).map((a) => a.pattern)];
      const hit = terms.filter((t) => hasWord(text, t));
      if (hit.length > 0) scored.push({ id, score: Math.max(...hit.map((t) => t.length)), index: ref.index });
    }
    if (scored.length === 0) return null;
    scored.sort((a, b) => b.score - a.score || a.index - b.index || cmp(a.id, b.id));
    const ambiguous = scored.length > 1 && scored[1].score === scored[0].score;
    pick = { id: scored[0].id, ambiguous, approved: false, rule: allows.find((a) => a.item === scored[0].id)?.pattern ?? null };
  }
  const ref = items.get(pick.id)!;
  const reasons: HouseholdReason[] = [];
  if (!pick.approved && approved.length === 0) reasons.push('forslag');
  if (pick.ambiguous) reasons.push('tvetydig');
  if (!pick.approved && foodTerms.some((t) => normText(t).length >= 2 && hasWord(text, t))) reasons.push('mat');
  const priceKnown = offer.priceOre !== null && Number.isInteger(offer.priceOre) && offer.priceOre > 0;
  if (!priceKnown) reasons.push('pris ukjent');
  const conditions = hasConditionText(`${offer.heading} ${offer.description ?? ''}`);
  if (conditions) reasons.push('vilkår');
  return {
    offer, item: ref.item.id, group: ref.group.id, name: ref.item.name, status: pick.approved ? 'godkjent' : 'kontroll', reasons,
    rule: pick.rule, chain: normalizeChain(offer.dealerName), priceUsable: priceKnown && !conditions,
  };
}

/** Gyldig på handledagen (ÅÅÅÅ-MM-DD, begge dager med). */
const validOnDay = (o: HouseholdOfferIn, day: string) => o.validFrom.slice(0, 10) <= day && o.validUntil.slice(0, 10) >= day;
const priceOrder = (m: HouseholdMatch) => (m.offer.priceOre !== null && Number.isFinite(m.offer.priceOre) ? m.offer.priceOre : Number.MAX_SAFE_INTEGER);

export interface CatchOptions {
  shopDate: string;
  /** Valgte kjeder (`Settings.offerChains`). Ingen valgt: ingen tilbud. */
  chains: readonly string[] | undefined;
  /** Valgte varegrupper (`Settings.householdGroups`). Mangler: alle grupper. */
  groups?: readonly string[];
}
export interface HouseholdCatch<O extends HouseholdOfferIn = HouseholdOfferIn> {
  /** `kjede`: ingen kjede er valgt, så ingen tilbud kan knyttes til husstanden. */
  blocked: 'kjede' | null;
  /** Godkjent av en kuratert regel, i gruppenes rekkefølge. */
  approved: HouseholdMatch<O>[];
  /** «Trenger kontroll»: alt annet (søkeordtreff, tvetydig, kan være mat). */
  review: HouseholdMatch<O>[];
}

/**
 * Tilbudsfangst: husholdningstilbud fra valgte kjeder, gyldige på handledagen, med pris sett innenfor aldersgrensen,
 * i valgte varegrupper. Samme tilbud (kilde, id) bare én gang. Fast rekkefølge: gruppe, varenavn, pris, id.
 */
export function householdCatch<O extends HouseholdOfferIn>(offers: readonly O[], rules: HouseholdRuleSet, foodTerms: readonly string[], o: CatchOptions): HouseholdCatch<O> {
  const chains = chainSet(o.chains);
  if (chains.size === 0) return { blocked: 'kjede', approved: [], review: [] };
  const groups = o.groups ? new Set(o.groups) : null;
  const order = new Map(rules.groups.map((g, i) => [g.id, i]));
  const seen = new Set<string>();
  const out: HouseholdMatch<O>[] = [];
  // Nyeste observasjon av samme tilbud gjelder, som i householdTotal; en eldre pris vises aldri (runde 2, M4).
  const sorted = [...offers].sort((a, b) => cmp(householdOfferKey(a), householdOfferKey(b)) || cmp(b.observed, a.observed));
  for (const offer of sorted) {
    const key = householdOfferKey(offer);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!validOnDay(offer, o.shopDate) || isStale(offer.observed, o.shopDate)) continue;
    const m = classifyHousehold(offer, rules, foodTerms);
    if (!m || !chains.has(m.chain) || (groups && !groups.has(m.group))) continue;
    out.push(m);
  }
  out.sort((a, b) => order.get(a.group)! - order.get(b.group)! || a.name.localeCompare(b.name, 'nb') || priceOrder(a) - priceOrder(b)
    || cmp(householdOfferKey(a.offer), householdOfferKey(b.offer)));
  return { blocked: null, approved: out.filter((m) => m.status === 'godkjent'), review: out.filter((m) => m.status !== 'godkjent') };
}

// ---------- Linjer på handlelista og egen sum ----------

export const HOUSEHOLD_PREFIX = 'hus:';
const MAX_KEY = 80;
/** Nøkkel for et tilbud: kilde og kildens id. */
export const householdOfferKey = (o: { source: string; id: string }) => `${o.source}:${o.id}`;
/**
 * Linje-id for et tilbud på handlelista: `hus:<kilde>:<id>#<n>`, der n er antall linjer for samme tilbud som er fjernet.
 * Samme tilbud lagt til fra to enheter eller mottatt to ganger gir samme id (én linje); etter fjerning kan det legges til
 * på nytt med ny id. Null hvis nøkkelen er for lang.
 */
export function householdLineId(offerKey: string, removed: readonly string[]): string | null {
  if (!offerKey || offerKey.length > MAX_KEY || offerKey.includes('#')) return null;
  const prefix = `${HOUSEHOLD_PREFIX}${offerKey}#`;
  const n = new Set(removed.filter((id) => id.startsWith(prefix) && /^\d+$/.test(id.slice(prefix.length)))).size;
  return `${prefix}${n}`;
}
export function parseHouseholdLine(id: string): { key: string; n: number } | null {
  if (!id.startsWith(HOUSEHOLD_PREFIX)) return null;
  const rest = id.slice(HOUSEHOLD_PREFIX.length);
  const hash = rest.lastIndexOf('#');
  if (hash < 1 || !/^\d+$/.test(rest.slice(hash + 1))) return null;
  return { key: rest.slice(0, hash), n: Number(rest.slice(hash + 1)) };
}

/** Hvorfor en linje har eller ikke har pris. */
export type HouseholdLineState = 'pris' | 'ingen-tilbud' | 'kjede' | 'utenfor-gyldighet' | 'gammel-pris' | 'pris-ukjent' | 'vilkår';
export interface HouseholdLineIn { id: string; text: string; note: string }
export interface HouseholdLine<O extends HouseholdOfferIn = HouseholdOfferIn> {
  id: string; name: string; note: string; offerKey: string;
  state: HouseholdLineState;
  /** Anslått tilbudspris (øre), bare når `state` er «pris». */
  priceOre: number | null;
  /** Tilbudet linja viser til, når det finnes blant tilbudene som vises nå. */
  match: HouseholdMatch<O> | null;
}
export interface HouseholdTotal<O extends HouseholdOfferIn = HouseholdOfferIn> {
  lines: HouseholdLine<O>[];
  /** Sum av linjer med pris. Egen sum, aldri med i middagskurven. */
  totalOre: number;
  priced: number; count: number;
  /** Alle linjer har pris. Ellers er summen en delsum (påvirker aldri middagssammenligningen). */
  complete: boolean;
}

/** «Andre varer» på handlelista: én pakke av hvert tilbud, med pris etter reglene i filhodet. Linjer i inndataenes rekkefølge. */
export function householdTotal<O extends HouseholdOfferIn>(lines: readonly HouseholdLineIn[], matches: readonly HouseholdMatch<O>[], shopDate: string, chains: readonly string[] | undefined): HouseholdTotal<O> {
  const set = chainSet(chains);
  const byKey = new Map<string, HouseholdMatch<O>>();
  for (const m of [...matches].sort((a, b) => cmp(a.offer.observed, b.offer.observed))) byKey.set(householdOfferKey(m.offer), m); // nyeste observasjon vinner
  const out: HouseholdLine<O>[] = [];
  for (const l of lines) {
    const parsed = parseHouseholdLine(l.id);
    if (!parsed) continue;
    const m = byKey.get(parsed.key) ?? null;
    let state: HouseholdLineState;
    if (!m) state = 'ingen-tilbud';
    else if (!set.has(m.chain)) state = 'kjede';
    else if (!validOnDay(m.offer, shopDate)) state = 'utenfor-gyldighet';
    else if (isStale(m.offer.observed, shopDate)) state = 'gammel-pris';
    else if (m.offer.priceOre === null || !Number.isInteger(m.offer.priceOre) || m.offer.priceOre <= 0) state = 'pris-ukjent';
    else if (!m.priceUsable) state = 'vilkår';
    else state = 'pris';
    out.push({ id: l.id, name: l.text, note: l.note, offerKey: parsed.key, state, priceOre: state === 'pris' ? m!.offer.priceOre : null, match: m });
  }
  const priced = out.filter((l) => l.priceOre !== null);
  return { lines: out, totalOre: priced.reduce((s, l) => s + l.priceOre!, 0), priced: priced.length, count: out.length, complete: priced.length === out.length };
}

// ---------- Fremheving og innstillinger ----------

/**
 * Nøktern fremheving i tilbudsfangsten: varen står på basisvarene (samme navn eller et søkeord for varen), eller dere har
 * lagt den på lista før. Aldri en oppfordring til å kjøpe mer.
 */
export function householdHighlight(m: HouseholdMatch, rules: HouseholdRuleSet, known: { staples: readonly string[]; history: readonly string[] }): 'basisvare' | 'lagt-til-før' | null {
  const item = itemIndex(rules).get(m.item)?.item;
  const names = new Set([normText(m.name), ...(item?.terms ?? []).map(normText)]);
  if (known.staples.some((s) => names.has(normText(s)))) return 'basisvare';
  if (known.history.some((h) => normText(h) === normText(m.name))) return 'lagt-til-før';
  return null;
}

/** Gyldige varegrupper i innstillingene (`Settings.householdGroups`): kjente id-er, ingen dubletter. Mangler = alle. */
export function isValidHouseholdGroups(v: unknown, rules: HouseholdRuleSet): boolean {
  if (v === undefined) return true;
  if (!Array.isArray(v) || v.length > rules.groups.length) return false;
  const ids = new Set(rules.groups.map((g) => g.id));
  return v.every((g) => typeof g === 'string' && ids.has(g)) && new Set(v).size === v.length;
}
