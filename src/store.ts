import { useEffect, useState } from 'react';
import type { Settings, Slot } from './engine/types';
import { defaultSettings } from './data/defaults';

export interface ManualLine { id: string; text: string; note: string }
export interface AppState {
  settings: Settings; slots: Slot[]; approved: boolean; option: 'regular' | 'combo';
  checked: Record<string, boolean>; manual: ManualLine[]; postal: string;
}
export const initialState: AppState = {
  settings: defaultSettings, slots: [], approved: false, option: 'regular', checked: {}, manual: [], postal: '',
};
const KEY = 'middag-state-v1';

export function usePersistentState(): [AppState, (f: (s: AppState) => AppState) => void] {
  const [state, setState] = useState<AppState>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...initialState, ...JSON.parse(raw) };
    } catch { /* lagring kan mangle */ }
    return initialState;
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignorer */ }
  }, [state]);
  return [state, (f) => setState(f)];
}
