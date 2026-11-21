// Planmotor: ren, deterministisk beregning. Beløp i øre, mengder i standardenheter (g, ml, stk).
// Samme inndata og prisversjon gir alltid samme kurv, sum og begrunnelse.
import type {
  Alternatives, Basket, BasketLine, BudgetAnswer, Catalog, PriceObs, Product, Recipe, Settings, Slot,
} from './types';

const UNKNOWN_PENALTY_ORE = 100_000;
const EPS = 1e-9;
export const MAX_SAME_PROTEIN = 2;

export const portionsOnDay = (s: Settings, day: number) =>
  s.eaters.filter((e) => e.daysHome[day]).reduce((sum, e) => sum + e.portion, 0);

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

export interface Ctx { catalog: Catalog; settings: Settings }

/** Kostkrav: absolutte krav filtrerer oppskriftene; preferanser påvirker bare rangering. */
export function eligibleRecipes(ctx: Ctx, day: number): Recipe[] {
  const { catalog, settings } = ctx;
  const max = settings.days[day].maxMinutes;
  return catalog.recipes
    .filter((r) => r.minutes <= max)
    .filter((r) => !settings.vegetarian || r.vegetarian)
    .filter((r) => !r.allergens.some((a) => settings.avoid.includes(a)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Et produkt kan leveres hvis det ikke bryter et aktivt allergifilter. Uavklart status godkjennes aldri. */
function productAllowed(p: Product, s: Settings): boolean {
  if (s.avoid.length === 0) return true;
  return p.allergenKnown && !p.allergens.some((a) => s.avoid.includes(a));
}

interface Need { amount: number; covers: Set<string> }

function aggregateNeeds(slots: Slot[], ctx: Ctx): Map<string, Need> {
  const recipes = byId(ctx.catalog.recipes);
  const ingredients = byId(ctx.catalog.ingredients);
  const needs = new Map<string, Need>();
  for (const slot of slots) {
    const r = recipes.get(slot.recipeId);
    const base = portionsOnDay(ctx.settings, slot.day);
    if (!r || base <= 0) continue;
    const portions = base + (slot.extra ?? 0); // reserverte porsjoner (matpakke/rester)
    const factor = portions / r.baseServings;
    for (const line of r.lines) {
      if (ingredients.get(line.ingredient)?.staple) continue;
      const n = needs.get(line.ingredient) ?? { amount: 0, covers: new Set<string>() };
      n.amount += line.amount * factor; // summer på tvers av retter før avrunding
      n.covers.add(r.id);
      needs.set(line.ingredient, n);
    }
  }
  // Trekk fra beholdning én gang per vare, etter summering.
  for (const [ing, n] of needs) n.amount = Math.max(0, n.amount - (ctx.settings.pantry[ing] ?? 0));
  return needs;
}

interface Offer { storeId: string; product: Product; packs: number; costOre: number; obs: PriceObs }

function bestOffer(ing: string, need: number, storeIds: string[], ctx: Ctx): Offer | null {
  let best: Offer | null = null;
  for (const storeId of [...storeIds].sort()) {
    for (const obs of ctx.catalog.prices) {
      if (obs.storeId !== storeId) continue;
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
  const locked = new Map(previous.filter((s) => s.locked).map((s) => [s.day, s]));
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
      const s = score(b) + (r.protein === prevP ? 3000 : 0);
      if (!best || s < best.s) best = { r, s };
    }
    if (best) slots.push({ day, recipeId: best.r.id, locked: false });
  }
  return slots.sort((a, b) => a.day - b.day);
}

export function alternatives(slots: Slot[], ctx: Ctx): Alternatives {
  const { settings } = ctx;
  const regular = buildBasket(slots, [settings.regularStoreId], ctx);
  let combo: Basket | null = null;
  const others = settings.storeIds.filter((id) => id !== settings.regularStoreId).sort();
  if (settings.maxStops >= 2) {
    for (const o of others) {
      const b = buildBasket(slots, [settings.regularStoreId, o], ctx);
      // En kurv med ukjent pris vinner aldri sammenligningen.
      if (b.complete && (!combo || b.totalOre < combo.totalOre)) combo = b;
    }
  }
  let recommended: 'regular' | 'combo' = 'regular';
  let savingOre: number | null = null;
  if (combo) {
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
/** Prisforskjell på hele kurven ved å bytte én dag til en annen rett. */
export function swapOptions(slots: Slot[], day: number, storeIds: string[], ctx: Ctx): SwapOption[] {
  const current = buildBasket(slots, storeIds, ctx);
  const used = new Set(slots.filter((s) => s.day !== day).map((s) => s.recipeId));
  return eligibleRecipes(ctx, day)
    .filter((r) => !used.has(r.id))
    .map((recipe) => {
      const next = buildBasket(slots.map((s) => (s.day === day ? { ...s, recipeId: recipe.id } : s)), storeIds, ctx);
      return { recipe, deltaOre: next.totalOre - current.totalOre, complete: next.complete };
    })
    .sort((a, b) => Number(b.complete) - Number(a.complete) || a.deltaOre - b.deltaOre || a.recipe.id.localeCompare(b.recipe.id));
}

/** Grep som får planen innenfor budsjett: bytt en middag til noe billigere (låste retter beholdes). */
export function budgetSuggestions(slots: Slot[], storeIds: string[], ctx: Ctx, limit = 3) {
  const out: { day: number; option: SwapOption; newTotalOre: number }[] = [];
  const base = buildBasket(slots, storeIds, ctx).totalOre;
  for (const s of slots.filter((x) => !x.locked)) {
    const opt = swapOptions(slots, s.day, storeIds, ctx).find((o) => o.complete && o.deltaOre < 0);
    if (opt) out.push({ day: s.day, option: opt, newTotalOre: base + opt.deltaOre });
  }
  return out.sort((a, b) => a.newTotalOre - b.newTotalOre).slice(0, limit);
}
