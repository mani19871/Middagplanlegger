import type { Settings } from '../engine/types';
const all = [true, true, true, true, true, true, true];
export const defaultSettings: Settings = {
  eaters: [
    { id: 'v1', label: 'Voksen 1', portion: 1, daysHome: [...all] },
    { id: 'v2', label: 'Voksen 2', portion: 1, daysHome: [...all] },
    { id: 'b1', label: 'Barn 1', portion: 0.6, daysHome: [...all] },
    { id: 'b2', label: 'Barn 2', portion: 0.6, daysHome: [...all] },
  ],
  days: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ enabled: i < 5, maxMinutes: 45 })),
  budgetOre: 90_000, storeIds: ['demoA', 'demoB'], regularStoreId: 'demoA', maxStops: 2,
  extraStoreThresholdOre: 5_000, vegetarian: false, avoid: [], pantry: {},
};
