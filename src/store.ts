import { useEffect, useState } from 'react';
import type { Settings, Slot } from './engine/types';
import { defaultSettings } from './data/defaults';
import { applyEvent, type InventoryEvent, type InventoryLog } from './engine/inventory';
import { enqueue } from './sync/queue';
import { applyListEvent, type ListEvent, type ListLog } from './sync/list';
import type { DocBody, DocName } from './sync/docs';
import type { MemberInfo } from './sync/protocol';
import { addVersion, type ListChange, type PlanVersion } from './engine/substitution';

/** Sist synkede versjon av et delt dokument (basen for tre-veis fletting). */
export interface DocMeta {
  version: number; base: DocBody;
  /** Serveren er gjenopprettet fra en eldre kopi: neste versjon fra serveren tas som base, og lokal verdi sendes. */
  restored?: boolean;
}
/** Felt i et dokument som er endret ulikt på to enheter. Lokal verdi gjelder til brukeren har valgt. */
export interface DocConflict { theirs: DocBody; version: number; fields: string[]; by: string; at: string }
export interface SyncMeta {
  /** Enhetstoken (bare hash på serveren). */
  token: string; me: MemberInfo; cursor: number;
  /** Siste hendelse enheten har sett («seq:id»), så serveren kan oppdage at den er gjenopprettet fra en eldre kopi. */
  anchor?: string;
  docs: Partial<Record<DocName, DocMeta>>; conflicts: Partial<Record<DocName, DocConflict>>;
  members: MemberInfo[];
  /** Antall hendelser serveren har avvist (ugyldige). */
  rejected: number; lastSync: string | null;
}
export interface AppState {
  settings: Settings; slots: Slot[]; approved: boolean; option: 'regular' | 'combo';
  /** Postnummer for «Nær meg» i kundeavisene. Bare på denne enheten, synkes ikke (dataminimering). */
  postal: string;
  /** Beholdningshendelser (kjøp, bekreftet hjemme, rest, laget). Idempotent på id. */
  inventory: InventoryLog;
  /** Beholdningshendelser som ikke er levert til husstanden ennå. */
  outbox: InventoryEvent[];
  /** Delt handleliste: avkrysninger per person og manuelle linjer (src/sync/list.ts). Idempotent på id. */
  list: ListLog;
  listOutbox: ListEvent[];
  /** Tilkobling til en delt husstand. null: bare denne enheten (som før). */
  sync: SyncMeta | null;
  /** Melding til brukeren om synk (f.eks. at enheten er fjernet fra husstanden). */
  syncNotice: string | null;
  /** «Utsolgt / fant ikke»-valg i handlelista (idempotent på id) og planversjoner med årsak. Se engine/substitution.ts. */
  listChanges?: ListChange[]; planHistory?: PlanVersion[];
  /** «Utsolgt / fant ikke»-valg som ikke er levert til husstanden ennå. */
  changeOutbox?: ListChange[];
  /** Banneret «ingen allergi- eller kostfilter på denne enheten» er avvist her. Lokalt, synkes ikke. */
  filterBannerDismissed?: boolean;
  /** Planversjoner (godkjente lister og historikk) som ikke er levert til husstanden ennå. */
  versionOutbox?: PlanVersion[];
}
export const initialState: AppState = {
  settings: defaultSettings, slots: [], approved: false, option: 'regular', postal: '',
  inventory: [], outbox: [], list: [], listOutbox: [], sync: null, syncNotice: null, listChanges: [], planHistory: [], changeOutbox: [], versionOutbox: [],
};
type OldState = Partial<AppState> & { checked?: Record<string, boolean>; manual?: { id: string; text: string; note: string }[] };
const KEY = 'middag-state-v1';
const DEVICE_KEY = 'middag-enhet';

/**
 * Flytter gammel tilstand inn i hendelseslogger: `settings.pantry` blir tellinger, `manual` blir manuelle linjer og
 * `checked` blir avkrysninger for `week`. Faste id-er, så en ny innlasting (eller samme migrering på en annen
 * enhet) ikke gir doble rader. Ren funksjon.
 */
export function migrateState(raw: OldState, week = '1970-01-05', by = 'migrering'): AppState {
  const { checked, manual, ...rest } = raw;
  const s: AppState = { ...initialState, ...rest, settings: { ...initialState.settings, ...(raw.settings ?? {}) } };
  let list = s.list ?? [];
  let listOutbox = s.listOutbox ?? [];
  const at = '1970-01-01T00:00:00.000Z';
  const addList = (e: ListEvent) => {
    const next = applyListEvent(list, e);
    if (next !== list) { list = next; listOutbox = enqueue(listOutbox, e); }
  };
  for (const m of manual ?? []) addList({ type: 'manuell', id: `migrert-manuell:${m.id}`.slice(0, 100), at, by, line: { id: m.id.slice(0, 100), text: m.text.slice(0, 200), note: (m.note ?? '').slice(0, 200) } });
  for (const key of Object.keys(checked ?? {}).sort()) if (checked![key]) addList({ type: 'kryss', id: `migrert-kryss:${week}:${key}`.slice(0, 100), at, by, week, key: key.slice(0, 200) });
  const old = s.settings.pantry ?? {};
  let inventory = s.inventory ?? [];
  let outbox = s.outbox ?? [];
  for (const ing of Object.keys(old).sort()) {
    if (!(old[ing] > 0)) continue;
    const e: InventoryEvent = { type: 'telling', id: `migrert:${ing}`, at: '1970-01-01T00:00:00.000Z', by: 'migrering', ingredient: ing, amount: old[ing] };
    inventory = applyEvent(inventory, e);
    outbox = enqueue(outbox, e);
  }
  // Eldre versjoner kunne lagre matpakke «til dag 7» (søndag + 1). Det er ikke en dag i uka og stoppet plansynken.
  const slots = (s.slots ?? []).map((x) => {
    if (x.extraFor === undefined || (Number.isInteger(x.extraFor) && x.extraFor >= 0 && x.extraFor <= 6)) return x;
    const { extraFor: _drop, ...keep } = x;
    return keep;
  });
  return { ...s, slots, inventory, outbox, list, listOutbox, settings: { ...s.settings, pantry: {} } };
}

/** Tilfeldig enhets-id (ikke persondata), så hver avkrysning lagres med egen identitet. */
export function deviceId(): string {
  try {
    const have = localStorage.getItem(DEVICE_KEY);
    if (have) return have;
    const id = `enhet-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch { return 'enhet-ukjent'; }
}

export function usePersistentState(week: string): [AppState, (f: (s: AppState) => AppState) => void] {
  const [state, setState] = useState<AppState>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return migrateState(JSON.parse(raw), week, deviceId());
    } catch { /* lagring kan mangle */ }
    return initialState;
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignorer */ }
  }, [state]);
  return [state, (f) => setState(f)];
}

/** Legger en hendelse i loggen og utboksen. En id som finnes fra før gir ingen endring. */
export function recordEvent(s: AppState, e: InventoryEvent): AppState {
  const inventory = applyEvent(s.inventory, e);
  if (inventory === s.inventory) return s;
  return { ...s, inventory, outbox: enqueue(s.outbox, e) };
}

/** Har enheten et absolutt kost- eller allergikrav? (Synkes ikke; se docs/synk.md.) */
export const hasDietFilter = (s: Settings) => s.vegetarian || s.avoid.length > 0 || (s.avoidFoods ?? []).length > 0;

/** Legger hendelser i handlelista og utboksen. En id som finnes fra før gir ingen endring. */
export function recordList(s: AppState, ...events: ListEvent[]): AppState {
  let list = s.list, listOutbox = s.listOutbox;
  for (const e of events) {
    const next = applyListEvent(list, e);
    if (next !== list) { list = next; listOutbox = enqueue(listOutbox, e); }
  }
  return list === s.list ? s : { ...s, list, listOutbox };
}

/** Legger en planversjon i historikken og utboksen. En id som finnes fra før gir ingen endring. */
export function recordVersion(s: AppState, v: PlanVersion): AppState {
  const prev = s.planHistory ?? [];
  const planHistory = addVersion(prev, v);
  return planHistory === prev ? s : { ...s, planHistory, versionOutbox: enqueue(s.versionOutbox ?? [], v) };
}

/** Ny hendelses-id og tidspunkt. Hører hjemme utenfor motoren. */
export const stamp = () => ({ id: crypto.randomUUID(), at: new Date().toISOString(), by: deviceId() });
