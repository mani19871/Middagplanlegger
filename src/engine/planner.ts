// Planmotor: ren, deterministisk beregning. Beløp i øre, mengder i standardenheter (g, ml, stk).
// Samme inndata og prisversjon gir alltid samme kurv, sum og begrunnelse.
import type {
  FoodTag,
  Alternatives, Basket, BasketLine, BudgetAnswer, Catalog, PriceObs, Product, Recipe, Settings, Slot,
} from './types';

const UNKNOWN_PENALTY_ORE = 100_000;
const EPS = 1e-9;
export const MAX_SAME_PROTEIN = 2;

/** Kosttagger for en rett, utledet fra ingrediensene. */
export function recipeTags(recipe: Recipe, ingredients: { id: string; tags?: FoodTag[] }[]): Set<FoodTag> {
  const tags = new Set<FoodTag>();
  for (const l of recipe.lines) for (const t of ingredients.find((i) => i.id === l.ingredient)?.tags ?? []) tags.add(t);
  return tags;
}

export const portionsOnDay = (s: Settings, day: number) =>
  s.eaters.filter((e) => e.daysHome[day]).reduce((sum, e) => sum + e.portion, 0);

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

import { hintsForChains, recipeDeals, type OfferHint, type RecipeDeals } from './deals';

export interface Ctx {
  catalog: Catalog; settings: Settings; offers?: OfferHint[]; shopDate?: string;
  /**
   * Beholdning som trekkes fra behovet (bekreftet hjemme + kjøpt og ikke brukt, se inventory.ts `deriveStock` med
   * `planWeek`). Mangler den, brukes `settings.pantry`. Forventet rest skal aldri inn her.
   */
  stock?: Record<string, number>;
}

/**
 * Tilbud for en rett på en bestemt dag (tomt hvis tilbudsplanlegging er av, dato mangler eller ingen kjede er valgt).
 * Bare tilbud fra kjeder i `settings.offerChains` teller.
 */
export function dealsFor(recipe: Recipe, day: number, ctx: Ctx): RecipeDeals {
  if (ctx.settings.useOffers === false || !ctx.offers?.length || !ctx.shopDate) return { lines: [], savingOre: 0 };
  const offers = hintsForChains(ctx.offers, ctx.settings.offerChains);
  if (offers.length === 0) return { lines: [], savingOre: 0 };
  const portions = portionsOnDay(ctx.settings, day);
  return recipeDeals(recipe, portions / recipe.baseServings, ctx.catalog.ingredients, offers, ctx.shopDate);
}

/**
 * En rett der hver vare har produkter i katalogen, men ingen som slipper gjennom det aktive allergifilteret
 * (uavklart allergenstatus eller treff på allergen). Alle varene ville blitt «ukjent pris».
 */
export function blockedByAllergenStatus(r: Recipe, ctx: Ctx): boolean {
  const s = ctx.settings;
  if (s.avoid.length === 0) return false;
  const lines = r.lines.filter((l) => !ctx.catalog.ingredients.find((i) => i.id === l.ingredient)?.staple);
  if (lines.length === 0) return false;
  return lines.every((l) => {
    const ps = ctx.catalog.products.filter((p) => p.ingredient === l.ingredient);
    return ps.length > 0 && !ps.some((p) => productAllowed(p, s));
  });
}

/** Hvilket absolutt krav en rett bryter: allergen (`avoid`), kost (`vegetarian`) eller råvare (`avoidFoods`). */
export type RequirementReason = 'allergen' | 'kost' | 'råvare';
export function requirementViolation(r: Recipe, ctx: Ctx): RequirementReason | null {
  const { catalog, settings } = ctx;
  if (r.allergens.some((a) => settings.avoid.includes(a))) return 'allergen';
  if (settings.vegetarian && !r.vegetarian) return 'kost';
  if ((settings.avoidFoods ?? []).some((t) => recipeTags(r, catalog.ingredients).has(t))) return 'råvare';
  return null;
}

/** Absolutte krav (vegetar, allergen, råvarer som skal unngås). Tidsgrensen hører ikke hit: en låst rett er et eksplisitt valg om tid. */
export const meetsAbsoluteRequirements = (r: Recipe, ctx: Ctx): boolean => requirementViolation(r, ctx) === null;

export interface LockedViolation { day: number; recipeId: string; reason: RequirementReason }
/**
 * Låste retter som bryter et absolutt krav (allergi, kost, råvare). Absolutte krav vinner over lås, så
 * `generatePlan` slipper disse ut og planlegger dagen på nytt. Tidsgrensen er unntatt: en låst rett er et
 * eksplisitt valg om tid. Sortert på dag.
 */
export function lockedViolations(slots: Slot[], ctx: Ctx): LockedViolation[] {
  return slotViolations(slots.filter((s) => s.locked), ctx);
}
/** Som `lockedViolations`, men for alle retter i planen (låst eller ikke). */
export function slotViolations(slots: Slot[], ctx: Ctx): LockedViolation[] {
  const out: LockedViolation[] = [];
  for (const s of slots) {
    const r = ctx.catalog.recipes.find((x) => x.id === s.recipeId);
    const reason = r ? requirementViolation(r, ctx) : null;
    if (reason) out.push({ day: s.day, recipeId: s.recipeId, reason });
  }
  return out.sort((a, b) => a.day - b.day || a.recipeId.localeCompare(b.recipeId));
}

/** Kostkrav: absolutte krav filtrerer oppskriftene; preferanser påvirker bare rangering. */
export function eligibleRecipes(ctx: Ctx, day: number): Recipe[] {
  const { catalog, settings } = ctx;
  const max = settings.days[day].maxMinutes;
  const ok = catalog.recipes
    .filter((r) => r.minutes <= max)
    .filter((r) => meetsAbsoluteRequirements(r, ctx))
    .sort((a, b) => a.id.localeCompare(b.id));
  // Hopp over retter som bare ville gitt ukjent pris på grunn av allergifilteret, så lenge det finnes andre.
  // Kurvregnskapet er uendret: velges en slik rett likevel (låst eller eneste mulighet), er prisen fortsatt ukjent.
  const priced = ok.filter((r) => !blockedByAllergenStatus(r, ctx));
  return priced.length > 0 ? priced : ok;
}

/** Et produkt kan leveres hvis det ikke bryter et aktivt allergifilter. Uavklart status godkjennes aldri. */
function productAllowed(p: Product, s: Settings): boolean {
  if (s.avoid.length === 0) return true;
  return p.allergenKnown && !p.allergens.some((a) => s.avoid.includes(a));
}

interface Need { amount: number; covers: Set<string> }

/** Mengdene en rett bruker en gitt dag (inkludert reserverte porsjoner), uten basisvarer. Brukes også som forbruk. */
export function slotUses(slot: Slot, ctx: Ctx): { ingredient: string; amount: number }[] {
  const r = ctx.catalog.recipes.find((x) => x.id === slot.recipeId);
  const base = portionsOnDay(ctx.settings, slot.day);
  if (!r || base <= 0) return [];
  const factor = (base + (slot.extra ?? 0)) / r.baseServings; // reserverte porsjoner (matpakke/rester)
  return r.lines
    .filter((l) => !ctx.catalog.ingredients.find((i) => i.id === l.ingredient)?.staple)
    .map((l) => ({ ingredient: l.ingredient, amount: l.amount * factor }));
}

function aggregateNeeds(slots: Slot[], ctx: Ctx): Map<string, Need> {
  const needs = new Map<string, Need>();
  for (const slot of slots) {
    for (const u of slotUses(slot, ctx)) {
      const n = needs.get(u.ingredient) ?? { amount: 0, covers: new Set<string>() };
      n.amount += u.amount; // summer på tvers av retter før avrunding
      n.covers.add(slot.recipeId);
      needs.set(u.ingredient, n);
    }
  }
  // Trekk fra beholdning én gang per vare, etter summering.
  const stock = ctx.stock ?? ctx.settings.pantry;
  for (const [ing, n] of needs) n.amount = Math.max(0, n.amount - (stock[ing] ?? 0));
  return needs;
}

interface Offer { storeId: string; product: Product; packs: number; costOre: number; obs: PriceObs }

function bestOffer(ing: string, need: number, storeIds: string[], ctx: Ctx): Offer | null {
  let best: Offer | null = null;
  for (const storeId of [...storeIds].sort()) {
    for (const obs of ctx.catalog.prices) {
      if (obs.storeId !== storeId) continue;
      // En pris med gyldighet som er ute på handledagen (utløpt tilbud) brukes aldri som dagens pris (regel 2).
      if (ctx.shopDate && obs.validUntil && obs.validUntil < ctx.shopDate) continue;
      const product = ctx.catalog.products.find((p) => p.id === obs.productId);
      if (!product || product.ingredient !== ing || !productAllowed(product, ctx.settings)) continue;
      const packs = Math.max(1, Math.ceil(need / product.size - EPS));
      const costOre = packs * obs.ore;
      const better =
        !best || costOre < best.costOre ||
        (costOre === best.costOre && (packs < best.packs || (packs === best.packs && product.id < best.product.id)));
      if (better) best = { storeId, product, packs, costOre, obs };
    }
  }
  return best;
}

export function buildBasket(slots: Slot[], storeIds: string[], ctx: Ctx): Basket {
  const ingredients = byId(ctx.catalog.ingredients);
  const needs = aggregateNeeds(slots, ctx);
  const lines: BasketLine[] = [];
  for (const [ing, n] of [...needs].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (n.amount <= 0) continue; // dekket av beholdning
    const info = ingredients.get(ing)!;
    const offer = bestOffer(ing, n.amount, storeIds, ctx);
    const base = {
      ingredient: ing, name: info.name, department: info.department, unit: info.unit,
      need: n.amount, covers: [...n.covers].sort(),
    };
    lines.push(
      offer
        ? {
            ...base, storeId: offer.storeId, productId: offer.product.id, productName: offer.product.name,
            packs: offer.packs, packSize: offer.product.size, costOre: offer.costOre,
            leftover: offer.packs * offer.product.size - n.amount, status: offer.obs.status,
            observed: offer.obs.observed, source: offer.obs.source,
          }
        : {
            ...base, storeId: null, productId: null, productName: null, packs: 0, packSize: 0, costOre: null,
            leftover: 0, status: 'ukjent', observed: null, source: null,
          },
    );
  }
  const priced = lines.filter((l) => l.costOre !== null);
  return {
    storeIds,
    lines,
    totalOre: priced.reduce((s, l) => s + (l.costOre ?? 0), 0),
    unknownCount: lines.length - priced.length,
    estimatedCount: lines.filter((l) => l.status === 'estimat').length,
    complete: lines.length === priced.length,
    stops: new Set(priced.map((l) => l.storeId)).size,
  };
}

const score = (b: Basket) => b.totalOre + b.unknownCount * UNKNOWN_PENALTY_ORE;

/** Velger middager dag for dag; hver kandidat vurderes på hele kurven, så delte pakninger lønner seg. */
export function generatePlan(ctx: Ctx, previous: Slot[] = []): Slot[] {
  const { settings } = ctx;
  const slots: Slot[] = [];
  // Absolutte krav vinner over lås: en låst rett som bryter allergi, kost eller råvarekrav slippes ut (se lockedViolations).
  const broken = new Set(lockedViolations(previous, ctx).map((v) => v.day));
  const locked = new Map(previous.filter((s) => s.locked && !broken.has(s.day)).map((s) => [s.day, s]));
  const enabled = settings.days.map((d, i) => (d.enabled && portionsOnDay(settings, i) > 0 ? i : -1)).filter((i) => i >= 0);
  for (const d of enabled) if (locked.has(d)) slots.push(locked.get(d)!);
  for (const day of enabled) {
    if (locked.has(day)) continue;
    const used = new Set(slots.map((s) => s.recipeId));
    const prevProtein = slots.find((s) => s.day === day - 1);
    const prevP = prevProtein ? ctx.catalog.recipes.find((r) => r.id === prevProtein.recipeId)?.protein : null;
    // Maks to retter med samme protein per uke (så lenge det finnes alternativer).
    const proteinCount = (p: string) => slots.filter((x) => ctx.catalog.recipes.find((r) => r.id === x.recipeId)?.protein === p).length;
    const all = eligibleRecipes(ctx, day);
    let pool = all.filter((r) => !used.has(r.id) && proteinCount(r.protein) < MAX_SAME_PROTEIN);
    if (pool.length === 0) pool = all.filter((r) => !used.has(r.id));
    if (pool.length === 0) pool = all;
    let best: { r: Recipe; s: number } | null = null;
    for (const r of pool) {
      const b = buildBasket([...slots, { day, recipeId: r.id, locked: false }], [settings.regularStoreId], ctx);
      const s = score(b) + (r.protein === prevP ? 3000 : 0) - dealsFor(r, day, ctx).savingOre;
      if (!best || s < best.s) best = { r, s };
    }
    if (best) slots.push({ day, recipeId: best.r.id, locked: false });
  }
  return slots.sort((a, b) => a.day - b.day);
}

/**
 * Én butikk mot beste kombinasjon. Motoren velger butikkombinasjonen på sine egne priser; `adjust` legger så brukerens
 * valg (utsolgt / fant ikke, godkjent liste) oppå begge kurvene, og anbefalingen regnes på de justerte kurvene, så
 * kortene viser samme sum som handlelista (se substitution.ts). En kurv med ukjent pris vinner aldri.
 * Standard: kurvene som de er.
 */
export function alternatives(slots: Slot[], ctx: Ctx, adjust: (b: Basket) => Basket = (b) => b): Alternatives {
  const { settings } = ctx;
  const rawRegular = buildBasket(slots, [settings.regularStoreId], ctx);
  let rawCombo: Basket | null = null;
  const others = settings.storeIds.filter((id) => id !== settings.regularStoreId).sort();
  if (settings.maxStops >= 2) {
    for (const o of others) {
      const b = buildBasket(slots, [settings.regularStoreId, o], ctx);
      // En kurv med ukjent pris vinner aldri sammenligningen.
      if (b.complete && (!rawCombo || b.totalOre < rawCombo.totalOre)) rawCombo = b;
    }
  }
  const regular = adjust(rawRegular);
  const combo = rawCombo ? adjust(rawCombo) : null;
  let recommended: 'regular' | 'combo' = 'regular';
  let savingOre: number | null = null;
  if (combo && combo.complete) {
    if (regular.complete) {
      savingOre = regular.totalOre - combo.totalOre;
      // Terskelen gjelder bare når kombinasjonen krever flere stopp enn vanlig butikk.
      if (savingOre > 0 && (combo.stops <= regular.stops || savingOre >= settings.extraStoreThresholdOre)) recommended = 'combo';
    } else recommended = 'combo';
  }
  return { regular, combo, recommended, savingOre };
}

export function budgetAnswer(b: Basket, budgetOre: number): BudgetAnswer {
  if (!b.complete) return 'ufullstendig';
  return b.totalOre <= budgetOre ? 'innenfor' : 'over';
}

export interface SwapOption { recipe: Recipe; deltaOre: number; complete: boolean }
/** Justering av en kurv for gitte middager (brukerens valg oppå motorens kurv). Standard: kurven som den er. */
export type BasketAdjust = (b: Basket, slots: Slot[]) => Basket;
const asIs: BasketAdjust = (b) => b;

/** Prisforskjell på hele kurven ved å bytte én dag til en annen rett. */
export function swapOptions(slots: Slot[], day: number, storeIds: string[], ctx: Ctx, adjust: BasketAdjust = asIs): SwapOption[] {
  const current = adjust(buildBasket(slots, storeIds, ctx), slots);
  const used = new Set(slots.filter((s) => s.day !== day).map((s) => s.recipeId));
  return eligibleRecipes(ctx, day)
    .filter((r) => !used.has(r.id))
    .map((recipe) => {
      const ss = slots.map((s) => (s.day === day ? { ...s, recipeId: recipe.id } : s));
      const next = adjust(buildBasket(ss, storeIds, ctx), ss);
      return { recipe, deltaOre: next.totalOre - current.totalOre, complete: next.complete };
    })
    .sort((a, b) => Number(b.complete) - Number(a.complete) || a.deltaOre - b.deltaOre || a.recipe.id.localeCompare(b.recipe.id));
}

/** Grep som får planen innenfor budsjett: bytt en middag til noe billigere (låste retter beholdes). */
export function budgetSuggestions(slots: Slot[], storeIds: string[], ctx: Ctx, limit = 3, adjust: BasketAdjust = asIs) {
  const out: { day: number; option: SwapOption; newTotalOre: number }[] = [];
  const base = adjust(buildBasket(slots, storeIds, ctx), slots).totalOre;
  for (const s of slots.filter((x) => !x.locked)) {
    const opt = swapOptions(slots, s.day, storeIds, ctx, adjust).find((o) => o.complete && o.deltaOre < 0);
    if (opt) out.push({ day: s.day, option: opt, newTotalOre: base + opt.deltaOre });
  }
  return out.sort((a, b) => a.newTotalOre - b.newTotalOre).slice(0, limit);
}
