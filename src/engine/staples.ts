// Basisvarer med minstebeholdning (utvidelse B). Ren og deterministisk (regel 1): ingen klokke, tilfeldighet eller nett.
// Mengder i g/ml/stk.
//
// Husstanden velger basisvarer den alltid vil ha hjemme (`Settings.staples`, delt i innstillingsdokumentet) fra en
// generell liste (`src/data/staples.ts`) eller som egen vare med kort navn. En vare som kan telles i matskapet kan få en
// minstemengde; ellers brukes nivå («har», «snart tom», «tom») som markeres med `nivå`-hendelser i beholdningsloggen.
//
// Tilstand per vare (`stapleStatus`), avledet av hele loggen sortert på (at, id), så rekkefølgen hendelsene kom i ikke
// spiller noen rolle:
//  - Siste markering gjelder. «Snart tom» og «tom» står til varen er påfyllt: et kjøp av varen (markert som handlet),
//    en ny telling eller bekreftet rest, eller at basisvarelinja er krysset av i handlelista. Forbruk («laget») opphever
//    dem ikke. «Har» gjelder til beholdningen av varen endres (kjøp, telling, rest, laget, bruk hjemme).
//  - Uten gjeldende markering avgjør minstemengden: beholdningen (`deriveStock`: bekreftet hjemme + kjøpt og ikke brukt;
//    forventet rest er aldri med) under grensen gir forslag. En vare som aldri er telt eller kjøpt er ukjent, ikke null,
//    og gir ikke forslag.
//
// Forslag (`stapleSuggestions`) blir vanlige manuelle linjer i handlelista når brukeren godkjenner dem, med linje-id per
// (uke, vare) (`stapleLineId`): samme forslag godkjent to ganger eller fra to enheter gir én linje, og et avvist forslag
// (`manuell-fjern` på samme linje-id) kommer ikke igjen samme uke. Så lenge en basisvarelinje ligger åpen (ikke krysset
// av), foreslås varen ikke igjen. Forslag har aldri pris og er aldri med i beregnet sum.
//
// Basisvarer påvirker aldri planmotorens kurv, butikksum, sammenligning eller filtre (regel 1–4): planner.ts leser dem
// ikke, og allergi- og kostkrav brukes ikke her.
import type { Ingredient, Staple, StapleChoice, Unit } from './types';
import { deriveStock, lineStates, STAPLE_LEVELS, type InventoryLog, type StapleLevel } from './inventory';
import { amount } from './format';

export { STAPLE_LEVELS, STAPLE_ID, type StapleLevel } from './inventory';
export const STAPLE_PREFIX = 'basis:';
/** Høyst 40 basisvarer, egne navn høyst 30 tegn, minstemengde høyst 100 000 (g/ml/stk). */
export const STAPLE_LIMITS = { count: 40, name: 30, min: 100_000 };
export const stapleLineId = (week: string, id: string) => `${STAPLE_PREFIX}${week}|${id}`;
export function parseStapleLine(id: string): { week: string; staple: string } | null {
  if (!id.startsWith(STAPLE_PREFIX)) return null;
  const rest = id.slice(STAPLE_PREFIX.length);
  const bar = rest.indexOf('|');
  if (bar < 1 || bar === rest.length - 1) return null;
  return { week: rest.slice(0, bar), staple: rest.slice(bar + 1) };
}

/** Det motoren trenger fra handlelista (src/sync/list.ts `stapleListFacts`). */
export interface StapleListFacts {
  /** Basisvarelinjer som ligger på lista (ikke fjernet). */
  lines: string[];
  /** Basisvarelinjer som er fjernet eller avvist. */
  removed: string[];
  /** Aktive avkrysninger på basisvarelinjer. */
  checks: { key: string; at: string }[];
}
export interface StapleInfo { choices: StapleChoice[]; ingredients: Ingredient[] }
export type StapleState = 'ok' | 'snart-tom' | 'tom' | 'under-grense' | 'ikke-telt';
export interface StapleStatus {
  id: string; name: string;
  /** Katalogvaren den svarer til (null for egne varer og varer som ikke finnes i katalogen). */
  ingredient: string | null;
  /** Enhet når varen kan telles i matskapet, ellers null. */
  unit: Unit | null;
  /** Minstemengde (null: nivå). */
  min: number | null;
  /** Beholdning nå (null: ukjent eller ikke en vare som telles). */
  have: number | null;
  state: StapleState;
  /** Gjeldende manuelle markering (null: ingen, eller den er opphevet). */
  mark: StapleLevel | null;
  /** Varen bør på handlelista. */
  suggest: boolean;
  /** En basisvarelinje for varen som ligger åpen (ikke krysset av) på handlelista. */
  open: string | null;
}
export interface StapleSuggestion { id: string; name: string; lineId: string; text: string; note: string; state: StapleState }

const EPS = 1e-9;
const cmp = (a: { at: string; id: string }, b: { at: string; id: string }) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function definition(s: Staple, info: StapleInfo): { name: string; ingredient: string | null } | null {
  const c = info.choices.find((x) => x.id === s.id);
  if (c) return { name: c.name, ingredient: c.ingredient && info.ingredients.some((i) => i.id === c.ingredient) ? c.ingredient : null };
  if (s.id.startsWith('egen:') && typeof s.name === 'string' && s.name) return { name: s.name, ingredient: null };
  return null;
}
/** Kan varen få minstemengde? Bare valg fra lista som svarer til en vare som telles i matskapet (ikke salt og olje). */
export function countable(id: string, info: StapleInfo): boolean {
  const c = info.choices.find((x) => x.id === id);
  const ing = c?.ingredient ? info.ingredients.find((i) => i.id === c.ingredient) : undefined;
  return !!ing && !ing.staple;
}

type Step = { at: string; id: string; kind: 'mark'; level: StapleLevel } | { at: string; id: string; kind: 'påfyll' | 'endret' };

/** Status per basisvare, sortert etter navn. Se filhodet. Endrer aldri inndata. Ukjente varer hoppes over. */
export function stapleStatus(staples: Staple[], log: InventoryLog, facts: StapleListFacts, info: StapleInfo): StapleStatus[] {
  const stock = deriveStock(log).total;
  const { purchases } = lineStates(log);
  const checked = new Set(facts.checks.map((c) => c.key));
  const out: StapleStatus[] = [];
  const seen = new Set<string>();
  for (const s of staples) {
    if (seen.has(s.id)) continue;
    const d = definition(s, info);
    if (!d) continue;
    seen.add(s.id);
    const ing = d.ingredient;
    const canCount = countable(s.id, info);
    const steps: Step[] = [];
    let known = false;
    for (const e of log) {
      if (e.type === 'nivå') { if (e.staple === s.id && STAPLE_LEVELS.includes(e.level)) steps.push({ at: e.at, id: e.id, kind: 'mark', level: e.level }); continue; }
      if (!ing) continue;
      if ((e.type === 'telling' || e.type === 'rest') && e.ingredient === ing) { steps.push({ at: e.at, id: e.id, kind: 'påfyll' }); known = true; }
      else if (e.type === 'hjemme' && e.ingredient === ing) { steps.push({ at: e.at, id: e.id, kind: 'endret' }); known = true; }
      else if (e.type === 'laget' && e.uses.some((u) => u.ingredient === ing)) steps.push({ at: e.at, id: e.id, kind: 'endret' });
    }
    if (ing) for (const p of purchases.values()) if (p.ingredient === ing && p.status === 'kjøpt') { steps.push({ at: p.at, id: p.line, kind: 'påfyll' }); known = true; }
    for (const c of facts.checks) if (parseStapleLine(c.key)?.staple === s.id) steps.push({ at: c.at, id: c.key, kind: 'påfyll' });
    steps.sort(cmp);
    let mark: StapleLevel | null = null;
    for (const st of steps) {
      if (st.kind === 'mark') mark = st.level;
      else if (st.kind === 'påfyll') mark = null;
      else if (mark === 'har') mark = null; // beholdningen er endret: grensen avgjør igjen
    }
    const min = canCount && typeof s.min === 'number' && Number.isFinite(s.min) && s.min > 0 ? s.min : null;
    const have = canCount && ing ? (known ? stock[ing] ?? 0 : null) : null;
    const unit = canCount && ing ? info.ingredients.find((i) => i.id === ing)!.unit : null;
    let state: StapleState;
    if (mark === 'snart-tom' || mark === 'tom') state = mark;
    else if (mark === 'har' || min === null) state = 'ok';
    else if (have === null) state = 'ikke-telt';
    else state = have < min - EPS ? 'under-grense' : 'ok';
    const open = [...facts.lines].sort().find((l) => parseStapleLine(l)?.staple === s.id && !checked.has(l)) ?? null;
    out.push({ id: s.id, name: d.name, ingredient: ing, unit, min, have, state, mark, open,
      suggest: state === 'snart-tom' || state === 'tom' || state === 'under-grense' });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'nb') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const NOTE: Record<'snart-tom' | 'tom', string> = { 'snart-tom': 'Basisvare: snart tom', tom: 'Basisvare: tom' };
/**
 * Forslag til handlelista for uka: varer som bør kjøpes, uten åpen linje og uten linje (godkjent eller avvist) for uka
 * fra før. Ingen pris (ikke med i beregnet sum).
 */
export function stapleSuggestions(statuses: StapleStatus[], facts: StapleListFacts, week: string): StapleSuggestion[] {
  const taken = new Set([...facts.lines, ...facts.removed]);
  const out: StapleSuggestion[] = [];
  for (const s of statuses) {
    if (!s.suggest || s.open) continue;
    const lineId = stapleLineId(week, s.id);
    if (taken.has(lineId)) continue;
    const note = s.state === 'under-grense' && s.have !== null && s.min !== null && s.unit
      ? `Basisvare: ${amount(s.have, s.unit)} hjemme, minst ${amount(s.min, s.unit)}`
      : NOTE[s.state as 'snart-tom' | 'tom'] ?? 'Basisvare';
    out.push({ id: s.id, name: s.name, lineId, text: s.name, note, state: s.state });
  }
  return out;
}

// ---------- Egne varer og validering (delt med serveren, src/sync/docs.ts) ----------

// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g;
/**
 * Navn på en egen basisvare: NFC, uten kontroll- og usynlige tegn, bare bokstaver, mellomrom og enkle skilletegn (ikke tall,
 * så telefonnumre og lignende ikke kan skrives inn), høyst 30 tegn. Tomt gir null. Appen ber om varenavn, aldri navn på
 * personer eller helseopplysninger; navnet logges aldri.
 */
export function cleanStapleName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFC').replace(INVISIBLE, '').replace(/[^\p{L}\p{M} \-'.,&/()]/gu, ' ').replace(/\s+/g, ' ').trim();
  const out = Array.from(s).slice(0, STAPLE_LIMITS.name).join('').trim();
  return /\p{L}/u.test(out) ? out : null;
}
/** Id for en egen vare, avledet av navnet, så samme vare lagt inn på to enheter blir samme basisvare. */
export function customStapleId(name: string): string | null {
  const clean = cleanStapleName(name);
  if (!clean) return null;
  const slug = clean.toLowerCase().replace(/[^\p{L}\p{M}]+/gu, '-').replace(/^-+|-+$/g, '');
  return slug ? `egen:${slug}` : null;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Gyldig liste over basisvarer (innstillingsdokumentet)? Strengt: kjente id-er, ingen dubletter, ingen ukjente felt. */
export function isValidStaples(v: unknown, info: StapleInfo): boolean {
  if (v === undefined) return true;
  if (!Array.isArray(v) || v.length > STAPLE_LIMITS.count) return false;
  const ids = new Set<string>();
  for (const s of v) {
    if (!isObj(s) || !Object.keys(s).every((k) => k === 'id' || k === 'name' || k === 'min') || typeof s.id !== 'string' || ids.has(s.id)) return false;
    ids.add(s.id);
    const minOk = s.min === undefined || (typeof s.min === 'number' && Number.isFinite(s.min) && s.min > 0 && s.min <= STAPLE_LIMITS.min);
    if (!minOk) return false;
    if (info.choices.some((c) => c.id === s.id)) {
      if (s.name !== undefined || (s.min !== undefined && !countable(s.id, info))) return false;
    } else if (s.id.startsWith('egen:')) {
      if (typeof s.name !== 'string' || cleanStapleName(s.name) !== s.name || customStapleId(s.name) !== s.id || s.min !== undefined) return false;
    } else return false;
  }
  return true;
}
