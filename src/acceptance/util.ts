// Felles hjelpere for akseptansetestene (src/acceptance/). Ingen produksjonskode.
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import type { OfferHint } from '../engine/deals';
import type { Ctx } from '../engine/planner';
import type { Catalog, Ingredient, PriceObs, Product, Recipe, Settings, Slot, Store } from '../engine/types';

export const SHOP_DAY = '2026-11-24';
export const slot = (day: number, recipeId: string, locked = false, extra?: number): Slot =>
  ({ day, recipeId, locked, ...(extra ? { extra, extraFor: day + 1 } : {}) });
export const settings = (over: Partial<Settings> = {}): Settings => ({ ...defaultSettings, ...over });
export const ctx = (over: Partial<Settings> = {}, extra: Partial<Ctx> = {}): Ctx => ({ catalog, settings: settings(over), ...extra });
export const hint = (over: Partial<OfferHint> = {}): OfferHint => ({
  id: 'o1', ingredient: 'laks', dealer: 'KIWI', priceOre: 5000, prePriceOre: 9000, amount: 400, unit: 'g',
  validFrom: '2026-11-23', validUntil: '2026-11-29', approved: true, ...over,
});
/** Alle sju dager på med romslig tid, så planene blir lange nok til å teste noe. */
export const fullWeek = () => defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 60 }));
/** Dyp kopi via JSON, slik en lagret uke i localStorage ville blitt lest tilbake. */
export const roundTrip = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Liten, helt kontrollert katalog for tester av prisregler. Ingen demodata fra appen. */
export interface MiniOpts { prices: [productId: string, storeId: string, ore: number, status?: PriceObs['status'], validUntil?: string][]; stores?: Store[] }
export function miniCatalog(o: MiniOpts): Catalog {
  const ingredients: Ingredient[] = [
    { id: 'a', name: 'Vare A', unit: 'g', department: 'Test' }, { id: 'b', name: 'Vare B', unit: 'g', department: 'Test' },
  ];
  const recipes: Recipe[] = [{
    id: 'r1', name: 'Testrett', minutes: 10, baseServings: 4, vegetarian: true, protein: 'test', allergens: [], steps: [],
    lines: [{ ingredient: 'a', amount: 400 }, { ingredient: 'b', amount: 400 }],
  }];
  const products: Product[] = [
    { id: 'pa', ingredient: 'a', name: 'A 400 g', size: 400, allergens: [], allergenKnown: true },
    { id: 'pb', ingredient: 'b', name: 'B 400 g', size: 400, allergens: [], allergenKnown: true },
  ];
  const stores: Store[] = o.stores ?? [{ id: 'S1', name: 'Butikk 1', scope: 'utsalg' }, { id: 'S2', name: 'Butikk 2', scope: 'utsalg' }];
  const prices: PriceObs[] = o.prices.map(([productId, storeId, ore, status = 'ordinær', validUntil]) =>
    ({ productId, storeId, ore, status, source: 'Test', observed: '2026-11-20', validUntil }));
  return { ingredients, recipes, products, prices, stores };
}
/** Innstillinger for én rett (r1) for fire spisere én dag. */
export const miniSettings = (over: Partial<Settings> = {}): Settings => settings({
  eaters: [{ id: 'v1', label: 'Voksen 1', portion: 1, daysHome: [true, true, true, true, true, true, true] },
    { id: 'v2', label: 'Voksen 2', portion: 1, daysHome: [true, true, true, true, true, true, true] },
    { id: 'v3', label: 'Voksen 3', portion: 1, daysHome: [true, true, true, true, true, true, true] },
    { id: 'v4', label: 'Voksen 4', portion: 1, daysHome: [true, true, true, true, true, true, true] }],
  days: defaultSettings.days.map((d, i) => ({ ...d, enabled: i === 0 })), regularStoreId: 'S1', storeIds: ['S1', 'S2'],
  extraStoreThresholdOre: 0, ...over,
});
