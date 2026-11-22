// «Lag nå»: middagsforslag fra det husstanden har hjemme akkurat nå. Ren og deterministisk (regel 1): ingen klokke,
// tilfeldighet eller nettverk. Mengder i g/ml/stk, beløp i øre.
//
// Hva som finnes hjemme (`mergeHave`): bekreftet beholdning (inventory.ts `deriveStock`: bekreftet hjemme + kjøpt og
// ikke brukt; forventet rest er aldri med) pluss det brukeren legger til eller retter i denne visningen. Egne valg her
// er lokale og endrer aldri beholdningsloggen.
//
// Forslag (`cookNow`):
//  - Absolutte krav (allergi, kost, råvarer) filtrerer med samme regel som planmotoren (`requirementViolation`).
//    «Må brukes snart» eller full dekning slår aldri et krav (regel 4).
//  - Dekning per vare er mengdebevisst: har / behov, høyst 1. Ukjent mengde regnes som funnet og merkes.
//    Basisvarer (salt, olje) teller ikke.
//  - Det som mangler prises med samme regler som ukeplanen (`basketForNeeds` → `resolvePrice`): estimat er anslått,
//    ukjent pris gir ufullstendig prisgrunnlag. Allergifilteret gjelder produktene, så uavklart status gir ukjent pris.
//  - Rangering (fast rekkefølge): poeng = dekning i promille + bonus for hver vare som må brukes snart; så færrest
//    manglende varer; så kjent prisgrunnlag foran ufullstendig (ukjent pris vinner aldri); så lavest kjent pris på det
//    som mangler; så kortest tid; så id.
import type { Catalog, BasketLine, Recipe, Unit } from './types';
import { basketForNeeds, requirementViolation, type Ctx } from './planner';

/** En vare som finnes hjemme nå. `amount: null` betyr at varen finnes, men mengden er ukjent. */
export interface HaveItem { ingredient: string; amount: number | null; soon: boolean }

/** Brukerens egne valg i «Lag nå». Lagres bare på enheten og synkes ikke. */
export interface CookNowLocal {
  /** Lagt til eller rettet i denne visningen (vare → mengde, eller null: finnes, mengde ukjent). Går foran beholdningen. */
  added: Record<string, number | null>;
  /** Varer i beholdningen som ikke skal regnes med her (f.eks. brukt opp siden sist). */
  removed: string[];
  /** Varer som må brukes snart. */
  soon: string[];
}
export const emptyCookNowLocal = (): CookNowLocal => ({ added: {}, removed: [], soon: [] });

const EPS = 1e-9;
/** Vekt for en vare som må brukes snart, i promille dekning (200 = som 20 prosentpoeng mer dekning). */
export const SOON_BONUS_PERMILLE = 200;

const validAmount = (n: number | null): n is number | null => n === null || (typeof n === 'number' && Number.isFinite(n) && n > EPS);
const usable = (catalog: Pick<Catalog, 'ingredients'>, id: string) => {
  const i = catalog.ingredients.find((x) => x.id === id);
  return !!i && !i.staple;
};

/**
 * Det som finnes hjemme i denne visningen: beholdningen (uten fjernede varer) med brukerens tillegg og rettelser oppå.
 * Bare kjente varer som ikke er basisvarer, med gyldig mengde. Sortert på vare-id.
 */
export function mergeHave(stock: Record<string, number>, local: CookNowLocal, ingredients: Catalog['ingredients']): HaveItem[] {
  const cat = { ingredients };
  const removed = new Set(local.removed);
  const soon = new Set(local.soon);
  const out = new Map<string, HaveItem>();
  for (const id of Object.keys(stock)) {
    const amount = stock[id];
    if (removed.has(id) || !usable(cat, id) || !validAmount(amount)) continue;
    out.set(id, { ingredient: id, amount, soon: soon.has(id) });
  }
  for (const id of Object.keys(local.added)) {
    const amount = local.added[id];
    if (!usable(cat, id) || !validAmount(amount)) continue;
    out.set(id, { ingredient: id, amount, soon: soon.has(id) });
  }
  return [...out.values()].sort((a, b) => a.ingredient.localeCompare(b.ingredient));
}

export interface CookNowLine {
  ingredient: string; name: string; unit: Unit;
  /** Behov for porsjonene. */
  need: number;
  /** Mengde hjemme (null: finnes, mengde ukjent; 0: finnes ikke). */
  have: number | null;
  state: 'har' | 'delvis' | 'mangler';
  soon: boolean;
}
export interface CookNowSuggestion {
  recipe: Recipe; portions: number; minutes: number;
  /** Andel av varene som finnes (0–1), mengdebevisst. */
  coverage: number;
  /** Poeng brukt i rangeringen (dekning i promille + bonus for «må brukes snart»). */
  points: number;
  /** Hver vare i retten (uten basisvarer), sortert på vare-id. */
  lines: CookNowLine[];
  /** Det som må kjøpes (nettobehov), priset som i ukeplanen. */
  missing: BasketLine[];
  /** Kjent pris på det som mangler. Med ukjent pris er dette bare en delsum. */
  missingCostOre: number;
  /** Alle manglende varer har pris (ordinær, tilbud eller estimat). Ellers: «Ufullstendig prisgrunnlag». */
  priceComplete: boolean;
  unknownCount: number; estimatedCount: number;
  /** Varer som må brukes snart og som retten bruker. */
  soonUsed: string[];
  /** Varer regnet som funnet uten kjent mengde. */
  unknownAmounts: string[];
}
export type CookNowEmpty = 'ingen-varer' | 'ingen-porsjoner' | 'ingen-retter' | 'ingen-dekning';
export interface CookNowResult {
  suggestions: CookNowSuggestion[];
  /** Antall retter i oppskriftsbasen. */
  recipeCount: number;
  /** Retter som oppfyller absolutte krav og tidsvalget. */
  eligibleCount: number;
  excludedByRequirement: number;
  excludedByTime: number;
  /** Hvorfor det ikke er noen forslag (null når det finnes forslag). */
  empty: CookNowEmpty | null;
}
export interface CookNowOptions {
  /** Porsjoner som skal lages nå. */
  portions: number;
  /** Butikkene det manglende prises i (vanligvis vanlig butikk). */
  storeIds: string[];
  /** Brukerens tidsvalg for akkurat nå (valgfritt). */
  maxMinutes?: number;
}

/** Forslag rangert etter hvor mye som finnes hjemme. Se filhodet for regler og rekkefølge. Endrer aldri inndata. */
export function cookNow(haveIn: HaveItem[], ctx: Ctx, opts: CookNowOptions): CookNowResult {
  const { catalog } = ctx;
  const have = new Map<string, HaveItem>();
  for (const h of haveIn) {
    if (!usable(catalog, h.ingredient) || !validAmount(h.amount)) continue;
    const prev = have.get(h.ingredient);
    // Samme vare to ganger: ukjent mengde vinner (finnes), ellers største mengde; «snart» hvis én av dem sier det.
    const amount = !prev ? h.amount : prev.amount === null || h.amount === null ? null : Math.max(prev.amount, h.amount);
    have.set(h.ingredient, { ingredient: h.ingredient, amount, soon: h.soon || !!prev?.soon });
  }
  const recipes = [...catalog.recipes].sort((a, b) => a.id.localeCompare(b.id));
  const result = (over: Partial<CookNowResult>): CookNowResult => ({
    suggestions: [], recipeCount: recipes.length, eligibleCount: 0, excludedByRequirement: 0, excludedByTime: 0, empty: null, ...over,
  });
  if (have.size === 0) return result({ empty: 'ingen-varer' });
  const portions = opts.portions;
  if (!(Number.isFinite(portions) && portions > EPS)) return result({ empty: 'ingen-porsjoner' });

  let excludedByRequirement = 0, excludedByTime = 0;
  const eligible: Recipe[] = [];
  for (const r of recipes) {
    if (requirementViolation(r, ctx)) { excludedByRequirement++; continue; }
    if (opts.maxMinutes !== undefined && r.minutes > opts.maxMinutes) { excludedByTime++; continue; }
    eligible.push(r);
  }
  const counts = { eligibleCount: eligible.length, excludedByRequirement, excludedByTime };
  if (eligible.length === 0) return result({ ...counts, empty: 'ingen-retter' });

  const ingredient = new Map(catalog.ingredients.map((i) => [i.id, i]));
  const storeIds = [...opts.storeIds].sort();
  const suggestions: CookNowSuggestion[] = [];
  for (const r of eligible) {
    // Summer per vare (en rett kan i prinsippet ha samme vare på to linjer).
    const needBy = new Map<string, number>();
    for (const l of r.lines) {
      if (!usable(catalog, l.ingredient)) continue;
      needBy.set(l.ingredient, (needBy.get(l.ingredient) ?? 0) + (l.amount * portions) / r.baseServings);
    }
    if (needBy.size === 0) continue;
    const lines: CookNowLine[] = [];
    const missingNeeds = new Map<string, { amount: number; covers: Set<string> }>();
    let cov = 0, soonCount = 0;
    for (const id of [...needBy.keys()].sort()) {
      const need = needBy.get(id)!;
      const h = have.get(id);
      const info = ingredient.get(id)!;
      const amount = h ? h.amount : 0;
      const share = amount === null ? 1 : need <= EPS ? 1 : Math.min(1, amount / need);
      const short = amount === null ? 0 : Math.max(0, need - amount);
      const state: CookNowLine['state'] = short <= EPS ? 'har' : amount === 0 ? 'mangler' : 'delvis';
      const soon = !!h?.soon;
      if (soon) soonCount++;
      cov += share;
      lines.push({ ingredient: id, name: info.name, unit: info.unit, need, have: amount, state, soon });
      if (short > EPS) missingNeeds.set(id, { amount: short, covers: new Set([r.id]) });
    }
    const coverage = cov / lines.length;
    if (coverage <= EPS) continue; // ingenting av retten finnes hjemme
    const basket = basketForNeeds(missingNeeds, storeIds, ctx);
    suggestions.push({
      recipe: r, portions, minutes: r.minutes, coverage,
      points: Math.round(coverage * 1000) + SOON_BONUS_PERMILLE * soonCount,
      lines, missing: basket.lines, missingCostOre: basket.totalOre, priceComplete: basket.complete,
      unknownCount: basket.unknownCount, estimatedCount: basket.estimatedCount,
      soonUsed: lines.filter((l) => l.soon).map((l) => l.ingredient),
      unknownAmounts: lines.filter((l) => l.have === null).map((l) => l.ingredient),
    });
  }
  suggestions.sort((a, b) =>
    b.points - a.points
    || a.missing.length - b.missing.length
    || Number(b.priceComplete) - Number(a.priceComplete) // ukjent pris vinner aldri
    || (a.priceComplete && b.priceComplete ? a.missingCostOre - b.missingCostOre : 0)
    || a.minutes - b.minutes
    || a.recipe.id.localeCompare(b.recipe.id));
  return result({ ...counts, suggestions, empty: suggestions.length === 0 ? 'ingen-dekning' : null });
}

/**
 * Prefiks for en manuell linje i handlelista fra «Legg manglende på handlelista»: bundet til rett og vare, så samme
 * vare for samme rett bare legges inn én gang (så lenge linja ikke er fjernet). Resten av id-en lages utenfor motoren.
 */
export const COOK_NOW_PREFIX = 'lagnå:';
export const cookNowLinePrefix = (recipeId: string, ingredient: string) => `${COOK_NOW_PREFIX}${recipeId}|${ingredient}:`;
