// Delte dokumenter: plan og innstillinger. Versjonert på serveren (PUT med baseVersion; utdatert base gir 409).
// Klienten fletter tre-veis mot sist synkede versjon (base):
//  - feltet er bare endret på én side: den endringen tas med,
//  - begge sider har samme verdi: ingen konflikt,
//  - begge har endret feltet ulikt: KONFLIKT. Lokal verdi beholdes inntil brukeren velger. Ingen siste-skriving-vinner.
// Felt: planen per dag («slot:<dag>»), «approved» og «option»; innstillingene per toppfelt.
// Ren og deterministisk. Validering deles med serveren (server/sync/api.ts).
import type { Settings, Slot } from '../engine/types';

export type DocName = 'plan' | 'innstillinger';
export const DOC_NAMES: DocName[] = ['plan', 'innstillinger'];
export interface PlanDoc { slots: Slot[]; approved: boolean; option: 'regular' | 'combo' }
/**
 * Kostkrav og allergier (`avoid`, `avoidFoods`, `vegetarian`) kan avsløre helseopplysninger (GDPR art. 9) og synkes
 * ikke: de blir på hver enhet (docs/personvern/06-samtykke-helsekost.md). Serveren avviser dem i dokumentet.
 */
export const LOCAL_ONLY_SETTINGS = ['avoid', 'avoidFoods', 'vegetarian'] as const;
export type SettingsDoc = Omit<Settings, 'pantry' | (typeof LOCAL_ONLY_SETTINGS)[number]>;
export type DocBody = PlanDoc | SettingsDoc;

/** Stabil JSON (sorterte nøkler), så like verdier alltid gir lik tekst. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

export function fieldsOf(name: DocName, body: DocBody): Record<string, unknown> {
  if (name === 'plan') {
    const p = body as PlanDoc;
    const out: Record<string, unknown> = { approved: p.approved, option: p.option };
    for (const s of p.slots) out[`slot:${s.day}`] = s;
    return out;
  }
  const rest: Record<string, unknown> = { ...(body as SettingsDoc) };
  for (const k of ['pantry', ...LOCAL_ONLY_SETTINGS]) delete rest[k];
  return rest;
}

export function fromFields(name: DocName, f: Record<string, unknown>): DocBody {
  if (name === 'plan') {
    const slots = Object.keys(f).filter((k) => k.startsWith('slot:') && f[k] !== undefined)
      .map((k) => f[k] as Slot).sort((a, b) => a.day - b.day);
    return { slots, approved: f.approved === true, option: f.option === 'combo' ? 'combo' : 'regular' };
  }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(f).sort()) if (f[k] !== undefined) out[k] = f[k];
  return out as unknown as SettingsDoc;
}

export interface MergeResult { merged: DocBody; conflicts: string[] }
/** Tre-veis fletting. `conflicts` er feltene begge sider har endret ulikt; der står lokal verdi i `merged`. */
export function merge3(name: DocName, base: DocBody, mine: DocBody, theirs: DocBody): MergeResult {
  const b = fieldsOf(name, base), m = fieldsOf(name, mine), t = fieldsOf(name, theirs);
  const keys = [...new Set([...Object.keys(b), ...Object.keys(m), ...Object.keys(t)])].sort();
  const out: Record<string, unknown> = {};
  const conflicts: string[] = [];
  for (const k of keys) {
    const sb = stable(b[k]), sm = stable(m[k]), st = stable(t[k]);
    if (sm === st || st === sb) out[k] = m[k];
    else if (sm === sb) out[k] = t[k];
    else { out[k] = m[k]; conflicts.push(k); }
  }
  return { merged: fromFields(name, out), conflicts };
}

/** Løser en konflikt: valgt side for konfliktfeltene, flettet verdi for resten. */
export function resolve(name: DocName, merged: DocBody, theirs: DocBody, fields: string[], choice: 'mine' | 'theirs'): DocBody {
  if (choice === 'mine') return merged;
  const f = fieldsOf(name, merged), t = fieldsOf(name, theirs);
  for (const k of fields) f[k] = t[k];
  return fromFields(name, f);
}

const DAY_NAMES = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'];
const FIELD_TEXT: Record<string, string> = {
  approved: 'godkjenning', option: 'valg av handletur', eaters: 'hvem som spiser', days: 'dager og tid', budgetOre: 'budsjett',
  storeIds: 'butikker', regularStoreId: 'vanlig butikk', maxStops: 'antall stopp', extraStoreThresholdOre: 'grense for ekstra butikk',
  useOffers: 'tilbud', offerChains: 'tilbudskjeder',
};
/** Lesbar tekst for et felt, til konfliktvisningen. */
export const fieldText = (k: string) => (k.startsWith('slot:') ? `middagen ${DAY_NAMES[Number(k.slice(5))] ?? k}` : FIELD_TEXT[k] ?? k);

// ---------- Validering (server og klient) ----------

/**
 * Feltene i innstillingsdokumentet. `Record<keyof SettingsDoc, true>` gjør at et nytt felt i `Settings` gir
 * kompileringsfeil her til det er tatt stilling til: synkes (legg til her og i valideringen) eller bare lokalt
 * (legg det i LOCAL_ONLY_SETTINGS). Ellers ville serveren avvise innstillingene og synken stoppe stille.
 */
const SETTINGS_KEYS: Record<keyof SettingsDoc, true> = {
  eaters: true, days: true, budgetOre: true, storeIds: true, regularStoreId: true, maxStops: true,
  extraStoreThresholdOre: true, useOffers: true, offerChains: true,
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const onlyKeys = (o: Record<string, unknown>, allowed: string[]) => Object.keys(o).every((k) => allowed.includes(k));
const str = (v: unknown, max: number) => typeof v === 'string' && v.length >= 1 && v.length <= max;
const int = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const bool = (v: unknown) => typeof v === 'boolean';

function validSlot(s: unknown): boolean {
  if (!isObj(s) || !onlyKeys(s, ['day', 'recipeId', 'locked', 'extra', 'extraFor', 'lunchBox'])) return false;
  return int(s.day, 0, 6) && str(s.recipeId, 64) && bool(s.locked)
    && (s.extra === undefined || num(s.extra, 0, 50)) && (s.extraFor === undefined || int(s.extraFor, 0, 6))
    && (s.lunchBox === undefined || s.lunchBox === 'termos' || s.lunchBox === 'matboks');
}

/**
 * Er dokumentet gyldig? Ukjente felt avvises (dataminimering: serveren lagrer bare det appen trenger).
 * Etiketter er begrenset til 40 tegn; appen ber om «Voksen 1», «Barn 1», ikke ekte navn.
 */
export function isValidDoc(name: string, body: unknown): body is DocBody {
  if (!isObj(body)) return false;
  if (name === 'plan') {
    if (!onlyKeys(body, ['slots', 'approved', 'option'])) return false;
    const slots = body.slots;
    return Array.isArray(slots) && slots.length <= 7 && slots.every(validSlot)
      && new Set(slots.map((s) => (s as Slot).day)).size === slots.length
      && bool(body.approved) && (body.option === 'regular' || body.option === 'combo');
  }
  if (name === 'innstillinger') {
    // Ingen kostkrav eller allergier (LOCAL_ONLY_SETTINGS) og ingen matskap: de lagres aldri på serveren.
    if (!onlyKeys(body, Object.keys(SETTINGS_KEYS))) return false;
    const eaters = body.eaters, days = body.days, stores = body.storeIds;
    return Array.isArray(eaters) && eaters.length <= 12 && eaters.every((e) => isObj(e) && onlyKeys(e, ['id', 'label', 'portion', 'daysHome'])
        && str(e.id, 40) && str(e.label, 40) && num(e.portion, 0, 5)
        && Array.isArray(e.daysHome) && e.daysHome.length === 7 && e.daysHome.every(bool))
      && Array.isArray(days) && days.length === 7 && days.every((d) => isObj(d) && onlyKeys(d, ['enabled', 'maxMinutes']) && bool(d.enabled) && int(d.maxMinutes, 0, 600))
      && int(body.budgetOre, 0, 100_000_000)
      && Array.isArray(stores) && stores.length <= 20 && stores.every((s) => str(s, 40)) && str(body.regularStoreId, 40)
      && (body.maxStops === 1 || body.maxStops === 2) && int(body.extraStoreThresholdOre, 0, 10_000_000)
      && (body.useOffers === undefined || bool(body.useOffers))
      // Kjeder for tilbud (valgfritt): kjedenavn, ingen persondata.
      && (body.offerChains === undefined || (Array.isArray(body.offerChains) && body.offerChains.length <= 40 && body.offerChains.every((c) => str(c, 40))));
  }
  return false;
}
