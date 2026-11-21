export type Unit = 'g' | 'ml' | 'stk';
export type PriceStatus = 'ordinær' | 'tilbud' | 'estimat' | 'ukjent';
export type Allergen = 'gluten' | 'melk' | 'egg' | 'fisk';

/** Kosttagger på ingrediensnivå. En rett arver taggene til ingrediensene sine. */
export type FoodTag = 'storfe' | 'svin' | 'lam' | 'kylling' | 'fisk' | 'skalldyr' | 'belgvekster' | 'notter';
export interface Ingredient { id: string; name: string; unit: Unit; department: string; staple?: boolean; tags?: FoodTag[] }
export interface RecipeLine { ingredient: string; amount: number }
export interface Recipe {
  id: string; name: string; minutes: number; baseServings: number;
  vegetarian: boolean; protein: string; allergens: Allergen[]; steps: string[]; lines: RecipeLine[];
}
export interface Product { id: string; ingredient: string; name: string; size: number; allergens: Allergen[]; allergenKnown: boolean }
export interface PriceObs {
  productId: string; storeId: string; ore: number; status: Exclude<PriceStatus, 'ukjent'>;
  source: string; observed: string; validUntil?: string;
}
export interface Store { id: string; name: string; scope: 'utsalg' | 'region' | 'kjede' }
export interface Catalog { ingredients: Ingredient[]; recipes: Recipe[]; products: Product[]; prices: PriceObs[]; stores: Store[] }

export interface Eater { id: string; label: string; portion: number; daysHome: boolean[] }
export interface DayPlan { enabled: boolean; maxMinutes: number }
export interface Settings {
  eaters: Eater[]; days: DayPlan[]; budgetOre: number; storeIds: string[]; regularStoreId: string;
  maxStops: 1 | 2; extraStoreThresholdOre: number; vegetarian: boolean; avoid: Allergen[];
  pantry: Record<string, number>;
  /** Planlegg rundt kontrollerte tilbud når de er tilgjengelige. */
  useOffers?: boolean;
  /** Absolutte kostkrav: retter med disse ingrediensene filtreres bort. */
  avoidFoods?: FoodTag[];
}
export interface Slot { day: number; recipeId: string; locked: boolean; extra?: number; extraFor?: number }

export interface BasketLine {
  ingredient: string; name: string; department: string; unit: Unit; need: number;
  storeId: string | null; productId: string | null; productName: string | null;
  packs: number; packSize: number; costOre: number | null; leftover: number;
  status: PriceStatus; observed: string | null; source: string | null; covers: string[];
}
export interface Basket {
  storeIds: string[]; lines: BasketLine[]; totalOre: number; unknownCount: number;
  estimatedCount: number; complete: boolean; stops: number;
}
export type BudgetAnswer = 'innenfor' | 'over' | 'ufullstendig';
export interface Alternatives {
  regular: Basket; combo: Basket | null; recommended: 'regular' | 'combo'; savingOre: number | null;
}
