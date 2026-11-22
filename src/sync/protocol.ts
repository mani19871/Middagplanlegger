// Felles typer og validering for synk-API-et (klient og server). Ingen nett eller klokke her.
import { isValidEvent, type InventoryEvent } from '../engine/inventory';
import { isValidListEvent, type ListEvent } from './list';
import { isValidChange, VERSION_REASONS, type ListChange, type PlanVersion } from '../engine/substitution';
import type { DocBody, DocName } from './docs';

/**
 * beholdning: kjøp, telling, rest, laget, hjemme · liste: avkrysning og manuelle linjer · endring: utsolgt / fant ikke ·
 * planversjon: godkjente lister og historikk («Endringer i listen»), uforanderlige og idempotente på id.
 */
export type Stream = 'beholdning' | 'liste' | 'endring' | 'planversjon';
export type Envelope =
  | { stream: 'beholdning'; event: InventoryEvent } | { stream: 'liste'; event: ListEvent } | { stream: 'endring'; event: ListChange }
  | { stream: 'planversjon'; event: PlanVersion };
export interface StoredEnvelope { seq: number; stream: Stream; event: InventoryEvent | ListEvent | ListChange | PlanVersion }

export type Role = 'eier' | 'voksen';
export interface MemberInfo { id: string; label: string; role: Role; createdAt: string; lastSeen: string | null; me: boolean;
  /** Fjernet eller forlatt. Beholdes i synk-svaret bare så gamle avkrysninger kan vises med etikett. */
  removed?: boolean }
export interface DocVersion { name: DocName; version: number; body: DocBody; updatedBy: string; updatedAt: string }
export interface SyncResponse {
  cursor: number; more: boolean; events: StoredEnvelope[]; docs: DocVersion[]; members: MemberInfo[];
  /** Husstandens nåværende `seq` (siste skriving). */
  head?: number;
  /**
   * Serveren har ikke det enheten har sett (cursor etter `head`, eller ankeret finnes ikke): databasen er gjenopprettet
   * fra en eldre kopi. Enheten begynner på nytt fra 0 og sender alt sitt eget på nytt (idempotent på id).
   */
  reset?: boolean;
}
export interface PushResponse { accepted: string[]; rejected: { id: string; code: string }[] }
export interface JoinResponse { token: string; member: MemberInfo }
export interface InviteResponse { code: string; expiresAt: string }
export interface HouseholdResponse { members: MemberInfo[]; invites: { id: string; expiresAt: string }[] }

/** Feilkoder fra serveren. Klienten viser norsk tekst for dem. */
export type ErrorCode =
  | 'ugyldig_forespørsel' | 'for_stor' | 'ikke_autentisert' | 'ingen_tilgang' | 'ikke_funnet' | 'for_mange_forespørsler'
  | 'ugyldig_kode' | 'enhet_finnes' | 'konflikt' | 'ugyldig_dokument' | 'serverfeil'
  /** Bare eieren kan lage og trekke tilbake invitasjoner (pilotbeslutning). */
  | 'bare_eier'
  /** Husstanden har nådd en kvote (medlemmer, invitasjoner eller lagrede hendelser). Se docs/sikkerhet.md. */
  | 'kvote_full';

export const LIMITS = {
  bodyBytes: 256 * 1024, batch: 500, eventBytes: 4096, docBytes: 64 * 1024, label: 24, pullPage: 1000,
  /** En planversjon er et øyeblikksbilde av hele lista (opptil ~60 linjer) og får større ramme enn andre hendelser. */
  versionBytes: 48 * 1024,
};
export const DEVICE_ID = /^enhet-[a-z0-9-]{4,40}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const str = (v: unknown, max: number) => typeof v === 'string' && v.length >= 1 && v.length <= max;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9;

/** Ekstra grenser på beholdningshendelser utover motorens egen sjekk (lengder, tall, ingen ekstra felt av betydning). */
function inventoryOk(e: InventoryEvent): boolean {
  if (!isValidEvent(e) || !str(e.id, 100) || !str(e.by, 60) || !ISO.test(e.at)) return false;
  switch (e.type) {
    case 'kjøp': return str(e.week, 10) && str(e.line, 300) && str(e.ingredient, 64) && (e.productId === null || str(e.productId, 64))
      && (e.storeId === null || str(e.storeId, 40)) && ['g', 'ml', 'stk'].includes(e.unit) && num(e.packs) && e.packs <= 1000 && num(e.packSize);
    case 'løs': return str(e.line, 300) && e.packs <= 1000;
    case 'angre': return str(e.line, 300);
    case 'laget': return str(e.week, 10) && str(e.recipeId, 64) && Array.isArray(e.uses) && e.uses.length <= 60
      && e.uses.every((u) => str(u.ingredient, 64) && num(u.amount));
    case 'telling': return str(e.ingredient, 64) && num(e.amount);
    case 'rest': return str(e.week, 10) && str(e.ingredient, 64) && num(e.amount);
    case 'hjemme': return str(e.week, 10) && str(e.line, 300) && str(e.ingredient, 64) && num(e.amount);
  }
}

function changeOk(e: ListChange): boolean {
  if (!isValidChange(e) || !str(e.id, 100) || !str(e.by, 60) || !ISO.test(e.at) || !str(e.week, 10) || !str(e.line, 300)) return false;
  if (e.prev !== undefined && !e.prev.every((p) => str(p, 100))) return false;
  if (e.type === 'angre-endring') return true;
  return (e.storeId === null || str(e.storeId, 40)) && str(e.ingredient, 64) && (e.fromProductId === null || str(e.fromProductId, 64))
    && e.soldOut.length <= 30 && e.soldOut.every((p) => str(p, 64)) && (e.type !== 'erstatt' || str(e.productId, 64));
}

// ---------- Planversjoner ----------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const onlyKeys = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));
const optStr = (v: unknown, max: number) => v === null || (typeof v === 'string' && v.length <= max);
const int = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const STATUSES = ['ordinær', 'tilbud', 'estimat', 'ukjent'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function originalOk(o: unknown): boolean {
  return o === null || (isObj(o) && onlyKeys(o, ['productId', 'productName', 'packs', 'packSize', 'costOre', 'status'])
    && optStr(o.productId, 64) && optStr(o.productName, 120) && int(o.packs, 0, 1000) && num(o.packSize) && (o.costOre === null || int(o.costOre, 0, 1e8))
    && STATUSES.includes(o.status as string));
}
function versionLineOk(l: unknown): boolean {
  if (!isObj(l) || !onlyKeys(l, ['key', 'ingredient', 'name', 'unit', 'storeId', 'productId', 'productName', 'packs', 'packSize', 'need',
    'costOre', 'status', 'observed', 'source', 'validUntil', 'change', 'choice', 'original'])) return false;
  return str(l.key, 64) && str(l.ingredient, 64) && str(l.name, 120) && ['g', 'ml', 'stk'].includes(l.unit as string)
    && optStr(l.storeId, 40) && optStr(l.productId, 64) && optStr(l.productName, 120) && int(l.packs, 0, 1000) && num(l.packSize) && num(l.need)
    && (l.costOre === null || int(l.costOre, 0, 1e8)) && STATUSES.includes(l.status as string) && optStr(l.observed, 10) && optStr(l.source, 120)
    && (l.validUntil === null || (typeof l.validUntil === 'string' && DATE.test(l.validUntil)))
    && [null, 'erstatt', 'fant-ikke', 'konflikt'].includes(l.change as string) && [null, 'uavklart', 'hopp-over', 'bruk-hjemme'].includes(l.choice as string)
    && originalOk(l.original);
}
function sideOk(x: unknown): boolean {
  return x === null || (isObj(x) && onlyKeys(x, ['productName', 'packs', 'costOre', 'status', 'validUntil']) && optStr(x.productName, 120)
    && int(x.packs, 0, 1000) && (x.costOre === null || int(x.costOre, 0, 1e8)) && STATUSES.includes(x.status as string) && optStr(x.validUntil, 10));
}
const DRIFT_REASONS = ['prisendring', 'utløpt-tilbud', 'annet-produkt', 'mengde', 'ny-vare', 'fjernet'];
/**
 * Planversjon: strengt skjema (ukjente felt avvises). Inneholder plan, produkter og priser, aldri kostkrav, allergier,
 * postnummer eller navn. `by` sjekkes mot avsenderen som for andre hendelser.
 */
export function versionOk(v: PlanVersion): boolean {
  const o = v as unknown as Record<string, unknown>;
  if (!isObj(o) || !onlyKeys(o, ['id', 'at', 'by', 'week', 'reason', 'note', 'slots', 'lines', 'skipped', 'totalOre', 'complete', 'unknownCount', 'priceBasis', 'declined', 'parents'])) return false;
  return str(v.id, 100) && ISO.test(v.at) && str(v.by, 60) && str(v.week, 10) && VERSION_REASONS.includes(v.reason) && typeof v.note === 'string' && v.note.length <= 1000
    && Array.isArray(v.slots) && v.slots.length <= 7 && v.slots.every((s) => isObj(s) && onlyKeys(s as unknown as Record<string, unknown>, ['day', 'recipeId', 'locked', 'extra', 'extraFor', 'lunchBox'])
      && int(s.day, 0, 6) && str(s.recipeId, 64) && typeof s.locked === 'boolean' && (s.extra === undefined || num(s.extra)) && (s.extraFor === undefined || int(s.extraFor, 0, 7))
      && (s.lunchBox === undefined || s.lunchBox === 'termos' || s.lunchBox === 'matboks'))
    && Array.isArray(v.lines) && v.lines.length <= 120 && v.lines.every(versionLineOk)
    && Array.isArray(v.skipped) && v.skipped.length <= 120 && v.skipped.every(versionLineOk)
    && int(v.totalOre, 0, 1e9) && typeof v.complete === 'boolean' && int(v.unknownCount, 0, 1000) && typeof v.priceBasis === 'string' && v.priceBasis.length <= 2000
    && Array.isArray(v.declined) && v.declined.length <= 200 && v.declined.every((d) => isObj(d) && onlyKeys(d as unknown as Record<string, unknown>, ['key', 'ingredient', 'name', 'reason', 'before', 'after'])
      && str(d.key, 64) && str(d.ingredient, 64) && str(d.name, 120) && DRIFT_REASONS.includes(d.reason) && sideOk(d.before) && sideOk(d.after))
    && (v.parents === undefined || (Array.isArray(v.parents) && v.parents.length <= 20 && v.parents.every((p) => str(p, 100) && p !== v.id)));
}

// ---------- Strenge feltlister ----------

const BASE_KEYS = ['id', 'at', 'by', 'type'];
/** Kjente felt per strøm og hendelsestype. Alt annet fjernes ved mottak (lagres og deles aldri). */
const KEYS: Record<string, Record<string, string[]>> = {
  beholdning: {
    'kjøp': ['week', 'line', 'ingredient', 'productId', 'storeId', 'packs', 'packSize', 'unit'],
    'løs': ['line', 'packs'], angre: ['line'], laget: ['week', 'line', 'day', 'recipeId', 'uses'],
    telling: ['ingredient', 'amount'], rest: ['week', 'ingredient', 'amount'], hjemme: ['week', 'line', 'ingredient', 'amount'],
  },
  liste: { kryss: ['week', 'key'], avkryss: ['week', 'key', 'seen'], manuell: ['line'], 'manuell-fjern': ['lineId'] },
  endring: {
    erstatt: ['week', 'line', 'storeId', 'ingredient', 'fromProductId', 'soldOut', 'productId', 'prev'],
    'fant-ikke': ['week', 'line', 'storeId', 'ingredient', 'fromProductId', 'soldOut', 'choice', 'prev'],
    'angre-endring': ['week', 'line', 'prev'],
  },
};
const pick = (o: Record<string, unknown>, keys: string[]) => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k];
  return out;
};
/**
 * Hendelsen med bare kjente felt (S13 i docs/sikkerhet.md). Brukes av serveren før lagring og ved utlevering (eldre
 * rader kan ha ekstra felt), og av klienten ved mottak. Planversjoner har strengt skjema og avvises i stedet.
 * Ukjent strøm eller type: uendret (valideringen avviser den).
 */
export function cleanEvent<E>(stream: Stream, event: E): E {
  const e = event as unknown as Record<string, unknown>;
  const keys = e && typeof e === 'object' ? KEYS[stream]?.[e.type as string] : undefined;
  if (!keys) return event;
  const out = pick(e, [...BASE_KEYS, ...keys]);
  if (stream === 'beholdning' && e.type === 'laget' && Array.isArray(e.uses)) out.uses = e.uses.map((u) => (u && typeof u === 'object' ? pick(u as Record<string, unknown>, ['ingredient', 'amount']) : u));
  if (stream === 'liste' && e.type === 'manuell' && e.line && typeof e.line === 'object') out.line = pick(e.line as Record<string, unknown>, ['id', 'text', 'note']);
  return out as E;
}

/** Gyldig konvolutt? Returnerer feilkode eller null. */
export function checkEnvelope(x: unknown): string | null {
  if (!x || typeof x !== 'object') return 'ugyldig_hendelse';
  const env = x as { stream?: unknown; event?: unknown };
  const size = JSON.stringify(env.event ?? null).length;
  if (env.stream === 'planversjon') {
    if (size > LIMITS.versionBytes) return 'for_stor';
    return versionOk(env.event as PlanVersion) ? null : 'ugyldig_hendelse';
  }
  if (size > LIMITS.eventBytes) return 'for_stor';
  if (env.stream === 'beholdning') return inventoryOk(env.event as InventoryEvent) ? null : 'ugyldig_hendelse';
  if (env.stream === 'endring') return changeOk(env.event as ListChange) ? null : 'ugyldig_hendelse';
  if (env.stream === 'liste') {
    const e = env.event as ListEvent;
    return isValidListEvent(e) && ISO.test(e.at) ? null : 'ugyldig_hendelse';
  }
  return 'ukjent_strøm';
}

/**
 * Ren etikett: NFC-normalisert, uten kontrolltegn, usynlige tegn og retningsstyring (kan snu teksten i UI), trimmet,
 * høyst 24 tegn (kodepunkter, så et emoji ikke deles i to). Tom gir null.
 */
export function cleanLabel(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g, '')
    .replace(/[\ud800-\udfff]/g, (c, i: number, all: string) => {
      // Behold gyldige surrogatpar, fjern enslige halvdeler.
      const code = c.charCodeAt(0);
      if (code < 0xdc00) { const next = all.charCodeAt(i + 1); return next >= 0xdc00 && next <= 0xdfff ? c : ''; }
      const prev = all.charCodeAt(i - 1); return prev >= 0xd800 && prev < 0xdc00 ? c : '';
    })
    .replace(/\s+/g, ' ').trim();
  const out = Array.from(s).slice(0, LIMITS.label).join('').trim();
  return out || null;
}
