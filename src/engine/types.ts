export type Unit = 'g' | 'ml' | 'stk';
export type PriceStatus = 'ordinær' | 'tilbud' | 'estimat' | 'ukjent';
/** De 14 allergenene som skal deklareres i EU. «skalldyr» er krepsdyr (reker, krabbe), «blotdyr» er bløtdyr (blåskjell, blekksprut). */
export type Allergen =
  | 'gluten' | 'melk' | 'egg' | 'fisk' | 'skalldyr' | 'blotdyr' | 'soya' | 'peanotter' | 'notter'
  | 'selleri' | 'sennep' | 'sesam' | 'lupin' | 'sulfitt';

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
  /**
   * Kjeder husstanden handler hos, normalisert (chains.ts `normalizeChain`). Bare tilbud fra disse kjedene brukes i
   * rangering og «Med kontrollerte tilbud». Mangler eller tom: ingen tilbud brukes.
   */
  offerChains?: string[];
  /**
   * Basisvarer husstanden alltid vil ha hjemme (engine/staples.ts). Delt i innstillingsdokumentet, flettet per vare.
   * Påvirker aldri planmotorens kurv, butikksum eller sammenligning; gir bare forslag på handlelista.
   */
  staples?: Staple[];
  /**
   * Husholdningsvaregrupper husstanden følger i tilbudsfangsten (engine/household.ts, id-er fra
   * src/data/household-rules.json). Mangler: alle grupper. Delt i innstillingsdokumentet. Påvirker aldri planmotorens
   * kurv, butikksum, sammenligning eller filtre.
   */
  householdGroups?: string[];
}
/**
 * En basisvare: valg fra den generelle lista (`src/data/staples.ts`) eller egen vare (`egen:<navn>`, med `name`).
 * `min` (i varens enhet) bare for varer som kan telles i matskapet; uten `min` brukes nivå («har / snart tom / tom»).
 */
export interface Staple { id: string; name?: string; min?: number }
/** En vare i den generelle lista over basisvarer. `ingredient`: katalogvaren den svarer til, når den finnes. */
export interface StapleChoice { id: string; name: string; department: string; ingredient?: string }
export type LunchBox = 'termos' | 'matboks';
export interface Slot { day: number; recipeId: string; locked: boolean; extra?: number; extraFor?: number; /** Hvordan den reserverte matpakken pakkes. Påvirker ikke planmotoren. */ lunchBox?: LunchBox }

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
