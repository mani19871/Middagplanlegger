import { useEffect, useState } from 'react';
import type { Settings, Slot } from './engine/types';
import { defaultSettings } from './data/defaults';
import { applyEvent, type InventoryEvent, type InventoryLog } from './engine/inventory';
import { enqueue } from './sync/queue';

export interface ManualLine { id: string; text: string; note: string }
export interface AppState {
  settings: Settings; slots: Slot[]; approved: boolean; option: 'regular' | 'combo';
  checked: Record<string, boolean>; manual: ManualLine[]; postal: string;
  /** Beholdningshendelser (kjøp, bekreftet hjemme, rest, laget). Idempotent på id. */
  inventory: InventoryLog;
  /** Hendelser som ikke er levert videre ennå. Det finnes ingen server for dem ennå, så de blir liggende lokalt. */
  outbox: InventoryEvent[];
}
export const initialState: AppState = {
  settings: defaultSettings, slots: [], approved: false, option: 'regular', checked: {}, manual: [], postal: '',
  inventory: [], outbox: [],
};
const KEY = 'middag-state-v1';
const DEVICE_KEY = 'middag-enhet';

/**
 * Flytter gammel `settings.pantry` (fra før hendelsesloggen) til tellinger. Faste id-er, så en ny innlasting
 * ikke gir doble rader. Ren funksjon.
 */
export function migrateState(raw: Partial<AppState>): AppState {
  const s: AppState = { ...initialState, ...raw, settings: { ...initialState.settings, ...(raw.settings ?? {}) } };
  const old = s.settings.pantry ?? {};
  let inventory = s.inventory ?? [];
  let outbox = s.outbox ?? [];
  for (const ing of Object.keys(old).sort()) {
    if (!(old[ing] > 0)) continue;
    const e: InventoryEvent = { type: 'telling', id: `migrert:${ing}`, at: '1970-01-01T00:00:00.000Z', by: 'migrering', ingredient: ing, amount: old[ing] };
    inventory = applyEvent(inventory, e);
    outbox = enqueue(outbox, e);
  }
  return { ...s, inventory, outbox, settings: { ...s.settings, pantry: {} } };
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

export function usePersistentState(): [AppState, (f: (s: AppState) => AppState) => void] {
  const [state, setState] = useState<AppState>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return migrateState(JSON.parse(raw));
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

/** Ny hendelses-id og tidspunkt. Hører hjemme utenfor motoren. */
export const stamp = () => ({ id: crypto.randomUUID(), at: new Date().toISOString(), by: deviceId() });
