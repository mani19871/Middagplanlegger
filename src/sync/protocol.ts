// Felles typer og validering for synk-API-et (klient og server). Ingen nett eller klokke her.
import { isValidEvent, type InventoryEvent } from '../engine/inventory';
import { isValidListEvent, type ListEvent } from './list';
import { isValidChange, type ListChange } from '../engine/substitution';
import type { DocBody, DocName } from './docs';

/** beholdning: kjøp, telling, rest, laget · liste: avkrysning og manuelle linjer · endring: utsolgt / fant ikke. */
export type Stream = 'beholdning' | 'liste' | 'endring';
export type Envelope =
  | { stream: 'beholdning'; event: InventoryEvent } | { stream: 'liste'; event: ListEvent } | { stream: 'endring'; event: ListChange };
export interface StoredEnvelope { seq: number; stream: Stream; event: InventoryEvent | ListEvent | ListChange }

export type Role = 'eier' | 'voksen';
export interface MemberInfo { id: string; label: string; role: Role; createdAt: string; lastSeen: string | null; me: boolean;
  /** Fjernet eller forlatt. Beholdes i synk-svaret bare så gamle avkrysninger kan vises med etikett. */
  removed?: boolean }
export interface DocVersion { name: DocName; version: number; body: DocBody; updatedBy: string; updatedAt: string }
export interface SyncResponse {
  cursor: number; more: boolean; events: StoredEnvelope[]; docs: DocVersion[]; members: MemberInfo[];
}
export interface PushResponse { accepted: string[]; rejected: { id: string; code: string }[] }
export interface JoinResponse { token: string; member: MemberInfo }
export interface InviteResponse { code: string; expiresAt: string }
export interface HouseholdResponse { members: MemberInfo[]; invites: { id: string; expiresAt: string }[] }

/** Feilkoder fra serveren. Klienten viser norsk tekst for dem. */
export type ErrorCode =
  | 'ugyldig_forespørsel' | 'for_stor' | 'ikke_autentisert' | 'ingen_tilgang' | 'ikke_funnet' | 'for_mange_forespørsler'
  | 'ugyldig_kode' | 'enhet_finnes' | 'konflikt' | 'ugyldig_dokument' | 'serverfeil';

export const LIMITS = {
  bodyBytes: 256 * 1024, batch: 500, eventBytes: 4096, docBytes: 64 * 1024, label: 24, pullPage: 1000,
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
  }
}

function changeOk(e: ListChange): boolean {
  if (!isValidChange(e) || !str(e.id, 100) || !str(e.by, 60) || !ISO.test(e.at) || !str(e.week, 10) || !str(e.line, 300)) return false;
  if (e.type === 'angre-endring') return true;
  return (e.storeId === null || str(e.storeId, 40)) && str(e.ingredient, 64) && (e.fromProductId === null || str(e.fromProductId, 64))
    && e.soldOut.length <= 30 && e.soldOut.every((p) => str(p, 64)) && (e.type !== 'erstatt' || str(e.productId, 64));
}

/** Gyldig konvolutt? Returnerer feilkode eller null. */
export function checkEnvelope(x: unknown): string | null {
  if (!x || typeof x !== 'object') return 'ugyldig_hendelse';
  const env = x as { stream?: unknown; event?: unknown };
  if (JSON.stringify(env.event ?? null).length > LIMITS.eventBytes) return 'for_stor';
  if (env.stream === 'beholdning') return inventoryOk(env.event as InventoryEvent) ? null : 'ugyldig_hendelse';
  if (env.stream === 'endring') return changeOk(env.event as ListChange) ? null : 'ugyldig_hendelse';
  if (env.stream === 'liste') {
    const e = env.event as ListEvent;
    return isValidListEvent(e) && ISO.test(e.at) ? null : 'ugyldig_hendelse';
  }
  return 'ukjent_strøm';
}

/** Ren etikett: uten kontrolltegn, trimmet, høyst 24 tegn. Tom gir null. */
export function cleanLabel(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]/g, '').trim().slice(0, LIMITS.label);
  return s || null;
}
