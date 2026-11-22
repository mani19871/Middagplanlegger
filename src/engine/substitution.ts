// «Utsolgt / fant ikke»: erstatning, berørte retter og historikk. Ren og deterministisk: tid, id og enhet kommer fra
// kalleren (som i inventory.ts), aldri fra klokke eller tilfeldighet her. Beløp i øre, mengder i g/ml/stk.
//
// Modellen:
//  - Basiskurven fra planmotoren (buildBasket) endres aldri. Brukerens valg i butikken lagres som en egen hendelseslogg
//    (`ListChange`) og legges oppå med `applyChanges`. Loggen er idempotent på id, og tilstanden avledes av hele loggen
//    sortert på (at, id), så ankomstrekkefølgen spiller ingen rolle. Siste valg per linje gjelder.
//  - En linje identifiseres av (uke, butikk, vare, produktet som var utsolgt). Endres planen slik at motoren velger et
//    annet produkt, gjelder ikke valget lenger (det var for et bestemt produkt).
//  - «Fant ikke» uten videre valg gir ukjent pris: kurven blir ufullstendig og kan ikke kåres eller bekreftes (regel 3).
//    «Hopp over» og «bruk noe hjemme» tar linja ut av handelen. Ingen av dem lager kjøp eller endrer beholdningen.
//  - En erstatning prises med butikkens egen gyldige pris på det nye produktet; pakker regnes mot nettobehovet.
//    Ved aktivt allergifilter godkjennes aldri et produkt med treff eller uavklart allergenstatus (regel 4).
//  - Historikk: hver endring lagres som en ny planversjon med årsak. Eldre versjoner endres aldri, så opprinnelig pris og
//    anslag (også et utløpt tilbud) står igjen. En godkjent liste holder på produktvalgene sine til brukeren selv velger
//    «Bruk nye priser»; nye priser vises som avvik (`priceDrift`) og endrer aldri en aktiv liste uten at brukeren ser det.
import type { Allergen, Basket, BasketLine, PriceObs, PriceStatus, Product, Recipe, Slot, Unit } from './types';
import { buildBasket, eligibleRecipes, type Ctx } from './planner';
import { purchaseLineId, type PurchaseState } from './inventory';

const EPS = 1e-9;
const byAtId = <T extends { at: string; id: string }>(a: T, b: T) =>
  a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

// ---------- Endringshendelser ----------

interface Base { id: string; at: string; by: string }
/** «Fant ikke»: uavklart (ukjent pris), hopp over varen, eller bruk noe dere har hjemme. */
export type NotFoundChoice = 'uavklart' | 'hopp-over' | 'bruk-hjemme';
export type ListChange =
  | (Base & {
      type: 'erstatt'; week: string; line: string; storeId: string; ingredient: string; fromProductId: string;
      /** Produkter som er meldt utsolgt på linja (minst `fromProductId`). */
      soldOut: string[]; productId: string;
    })
  | (Base & {
      type: 'fant-ikke'; week: string; line: string; storeId: string | null; ingredient: string; fromProductId: string | null;
      soldOut: string[]; choice: NotFoundChoice;
    })
  /** Tar bort brukerens valg på linja; motorens produkt gjelder igjen. */
  | (Base & { type: 'angre-endring'; week: string; line: string });
export type ActiveChange = Exclude<ListChange, { type: 'angre-endring' }>;
export type ChangeMap = Map<string, ActiveChange>;

export const changeLineId = (week: string, storeId: string | null, ingredient: string, fromProductId: string | null) =>
  `endring|${week}|${storeId ?? '-'}|${ingredient}|${fromProductId ?? '-'}`;

const CHOICES: NotFoundChoice[] = ['uavklart', 'hopp-over', 'bruk-hjemme'];

export function isValidChange(e: ListChange): boolean {
  if (!e || typeof e.id !== 'string' || !e.id || typeof e.at !== 'string' || !e.at || typeof e.by !== 'string') return false;
  if (typeof e.week !== 'string' || !e.week || typeof e.line !== 'string') return false;
  switch (e.type) {
    case 'erstatt':
      return !!e.productId && e.productId !== e.fromProductId && Array.isArray(e.soldOut) && !e.soldOut.includes(e.productId) &&
        e.line === changeLineId(e.week, e.storeId, e.ingredient, e.fromProductId);
    case 'fant-ikke':
      return CHOICES.includes(e.choice) && Array.isArray(e.soldOut) && e.line === changeLineId(e.week, e.storeId, e.ingredient, e.fromProductId);
    case 'angre-endring': return !!e.line;
    default: return false;
  }
}

/** Idempotent: kjent id eller ugyldig hendelse gir samme logg tilbake (samme objekt). Holdes sortert på (at, id). */
export function applyChange(log: ListChange[], e: ListChange): ListChange[] {
  if (!isValidChange(e) || log.some((x) => x.id === e.id)) return log;
  return [...log, e].sort(byAtId);
}

/** Gjeldende valg per linje for uka. Siste hendelse etter (at, id) gjelder; «angre-endring» fjerner valget. */
export function activeChanges(log: ListChange[], week: string): ChangeMap {
  const out: ChangeMap = new Map();
  for (const e of [...log].sort(byAtId)) {
    if (e.week !== week) continue;
    if (e.type === 'angre-endring') out.delete(e.line);
    else out.set(e.line, e);
  }
  return out;
}

// ---------- Priser og allergener ----------

/** En prisobservasjon gjelder ikke etter `validUntil` (et utløpt tilbud blir aldri dagens pris). */
export const obsValidOn = (o: PriceObs, shopDate?: string) => !(shopDate && o.validUntil && o.validUntil < shopDate);

/** Laveste gyldige pris på produktet i butikken. Fast regel ved likhet: nyeste observasjon, så status. */
export function priceIn(productId: string, storeId: string, ctx: Ctx): PriceObs | null {
  let best: PriceObs | null = null;
  for (const o of ctx.catalog.prices) {
    if (o.productId !== productId || o.storeId !== storeId || !obsValidOn(o, ctx.shopDate)) continue;
    if (!Number.isInteger(o.ore) || o.ore <= 0) continue;
    const better = !best || o.ore < best.ore || (o.ore === best.ore && (o.observed > best.observed || (o.observed === best.observed && o.status < best.status)));
    if (better) best = o;
  }
  return best;
}

export type AllergenCheck = 'ok' | 'allergifilter' | 'uavklart-allergen';
/** Ved aktivt filter: treff på allergen avvises, og uavklart status (typisk sammensatte varer) avvises alltid. */
export function allergenCheck(p: Product, avoid: Allergen[]): AllergenCheck {
  if (avoid.length === 0) return 'ok';
  if (p.allergens.some((a) => avoid.includes(a))) return 'allergifilter';
  if (!p.allergenKnown) return 'uavklart-allergen';
  return 'ok';
}

function priceLine<T extends BasketLine>(l: T, p: Product, obs: PriceObs, storeId: string): T {
  const packs = Math.max(1, Math.ceil(l.need / p.size - EPS));
  return {
    ...l, storeId, productId: p.id, productName: p.name, packs, packSize: p.size, costOre: packs * obs.ore,
    leftover: packs * p.size - l.need, status: obs.status, observed: obs.observed, source: obs.source,
  };
}

/** Et produkt kan brukes på linja: samme vare, gyldig pakning, gyldig pris i butikken og godkjent mot allergifilteret. */
function usable(p: Product | undefined, l: BasketLine, storeId: string, ctx: Ctx): { p: Product; obs: PriceObs } | null {
  if (!p || p.ingredient !== l.ingredient || !(p.size > 0) || !Number.isFinite(p.size)) return null;
  if (allergenCheck(p, ctx.settings.avoid) !== 'ok') return null;
  const obs = priceIn(p.id, storeId, ctx);
  return obs ? { p, obs } : null;
}

// ---------- Kurv med brukerens valg ----------

export interface LineOriginal { productId: string | null; productName: string | null; packs: number; packSize: number; costOre: number | null; status: PriceStatus }
export interface LineChangeInfo {
  line: string; changeId: string; type: 'erstatt' | 'fant-ikke'; choice: NotFoundChoice | null; soldOut: string[];
  /** Linja slik den var før valget (det utsolgte produktet og prisen det hadde). */
  original: LineOriginal;
  /** Erstatningen kan ikke brukes lenger (ingen gyldig pris, utsolgt eller stoppet av allergifilteret): linja er ukjent. */
  problem: 'erstatning-ugyldig' | null;
}
export interface AdjustedLine extends BasketLine {
  /** Nøkkelen brukerens valg lagres under: (uke, butikk, vare, produktet før valget). */
  lineKey: string;
  /** Produktet er holdt fast fra den godkjente listen i stedet for motorens nye valg. */
  pinned: boolean;
  change: LineChangeInfo | null;
}
export interface AdjustedBasket extends Basket {
  lines: AdjustedLine[];
  /** «Hopp over» og «bruk noe hjemme»: ikke med i handelen eller summen. */
  skipped: AdjustedLine[];
}

const originalOf = (l: BasketLine): LineOriginal =>
  ({ productId: l.productId, productName: l.productName, packs: l.packs, packSize: l.packSize, costOre: l.costOre, status: l.status });
const unknownLine = <T extends BasketLine>(l: T): T =>
  ({ ...l, productId: null, productName: null, packs: 0, packSize: 0, costOre: null, leftover: 0, status: 'ukjent', observed: null, source: null });
/** Kurven har én linje per vare (beste butikk velges per vare), så varen identifiserer linja på tvers av versjoner. */
export const versionKey = (ingredient: string) => ingredient;

/**
 * Legger brukerens valg (og eventuelt produktvalgene fra en godkjent versjon, `pin`) oppå basiskurven.
 * Rekkefølge: basiskurv → godkjente produktvalg → brukerens valg. Summer regnes på nytt som i buildBasket.
 */
export function applyChanges(base: Basket, changes: ChangeMap, week: string, ctx: Ctx, pin: PlanVersion | null = null): AdjustedBasket {
  const products = new Map(ctx.catalog.products.map((p) => [p.id, p]));
  // Fastholdt produkt er motorens produkt i versjonen, før brukerens valg (de legges på igjen som hendelser under).
  const pinned = new Map([...(pin?.lines ?? []), ...(pin?.skipped ?? [])].map((v) => [v.key, v]));
  const lines: AdjustedLine[] = [];
  const skipped: AdjustedLine[] = [];
  for (const b of base.lines) {
    let l: AdjustedLine = { ...b, lineKey: '', pinned: false, change: null };
    // En godkjent liste beholder produktet sitt når motoren nå ville valgt et annet (f.eks. etter ny prisimport).
    const v = pinned.get(versionKey(b.ingredient));
    const pid = v ? (v.original ? v.original.productId : v.productId) : null;
    if (pid && b.storeId && v!.storeId === b.storeId && pid !== b.productId) {
      const u = usable(products.get(pid), b, b.storeId, ctx);
      if (u) l = { ...priceLine(l, u.p, u.obs, b.storeId), pinned: true };
    }
    l.lineKey = changeLineId(week, l.storeId, l.ingredient, l.productId);
    const c = changes.get(l.lineKey);
    if (!c) { lines.push(l); continue; }
    const info: LineChangeInfo = {
      line: l.lineKey, changeId: c.id, type: c.type, choice: c.type === 'fant-ikke' ? c.choice : null,
      soldOut: [...new Set(c.soldOut)].sort(), original: originalOf(l), problem: null,
    };
    if (c.type === 'erstatt') {
      const u = c.soldOut.includes(c.productId) ? null : usable(products.get(c.productId), l, c.storeId, ctx);
      if (u) lines.push({ ...priceLine(l, u.p, u.obs, c.storeId), change: info });
      else lines.push({ ...unknownLine(l), change: { ...info, problem: 'erstatning-ugyldig' } });
    } else if (c.choice === 'uavklart') {
      lines.push({ ...unknownLine(l), change: info });
    } else {
      skipped.push({ ...l, change: info });
    }
  }
  const priced = lines.filter((l) => l.costOre !== null);
  return {
    storeIds: base.storeIds, lines, skipped,
    totalOre: priced.reduce((s, l) => s + (l.costOre ?? 0), 0),
    unknownCount: lines.length - priced.length,
    estimatedCount: lines.filter((l) => l.status === 'estimat').length,
    complete: lines.length === priced.length,
    stops: new Set(priced.map((l) => l.storeId)).size,
  };
}

/** En linje som er meldt «fant ikke» (eller har en ugyldig erstatning) kan ikke markeres som handlet. */
export const canMarkBought = (l: AdjustedLine) => !(l.change && (l.change.type === 'fant-ikke' || l.change.problem));

/**
 * Er linja allerede handlet (eller i konflikt)? Da kan den ikke meldes utsolgt eller angres før kjøpet er angret,
 * ellers kunne samme vare bli kjøpt to ganger (først det gamle produktet, så erstatningen).
 */
export function changeBlocked(l: AdjustedLine, week: string, purchases: Map<string, PurchaseState>): boolean {
  const ids = new Set([l.productId, l.change?.original.productId ?? null]);
  return [...ids].some((pid) => {
    const p = purchases.get(purchaseLineId(week, l.storeId, l.ingredient, pid));
    return !!p && p.status !== 'angret';
  });
}

const withChange = (changes: ChangeMap, line: string, c: ActiveChange | null): ChangeMap => {
  const m = new Map(changes);
  if (c) m.set(line, c); else m.delete(line);
  return m;
};
/** Produktet linja gjaldt før brukerens valg (det som var utsolgt). */
const fromProduct = (l: AdjustedLine) => (l.change ? l.change.original.productId : l.productId);
const soldOutOn = (l: AdjustedLine) => [...new Set([...(l.change?.soldOut ?? []), fromProduct(l), l.productId].filter((x): x is string => !!x))].sort();

// ---------- Erstatninger ----------

export type RejectReason = 'utsolgt' | 'allergifilter' | 'uavklart-allergen' | 'ingen-pris' | 'feil-enhet';
export interface SubstituteOption {
  product: Product; storeId: string; obs: PriceObs; packs: number; packSize: number; costOre: number; leftover: number;
  /** Mot linjas opprinnelige pris; null hvis den var ukjent. */
  lineDeltaOre: number | null;
  newTotalOre: number; newComplete: boolean;
  /** Mot hele kurven før varen var utsolgt; null hvis en av kurvene er ufullstendig (ukjent pris sammenlignes ikke). */
  deltaOre: number | null;
  /** Allergener i erstatningen som rettene den dekker ikke er merket med (advarsel når filteret er av). */
  newAllergens: Allergen[];
  /** Innholdet er ikke avklart (vises som advarsel; avvises alltid ved aktivt filter). */
  allergenUnknown: boolean;
}
export interface Substitutes { line: string; storeId: string | null; options: SubstituteOption[]; rejected: { product: Product; reason: RejectReason }[] }

/** Lager hendelsen for et valgt produkt (tid, id og enhet fra kalleren). */
export function substituteEvent(l: AdjustedLine, week: string, productId: string, meta: Base): ListChange {
  return {
    type: 'erstatt', ...meta, week, line: l.lineKey, storeId: l.storeId!, ingredient: l.ingredient, fromProductId: fromProduct(l)!,
    soldOut: soldOutOn(l).filter((p) => p !== productId), productId,
  };
}
export function notFoundEvent(l: AdjustedLine, week: string, choice: NotFoundChoice, meta: Base): ListChange {
  return { type: 'fant-ikke', ...meta, week, line: l.lineKey, storeId: l.storeId, ingredient: l.ingredient, fromProductId: fromProduct(l), soldOut: soldOutOn(l), choice };
}
export const undoChangeEvent = (l: AdjustedLine, week: string, meta: Base): ListChange => ({ type: 'angre-endring', ...meta, week, line: l.lineKey });

/**
 * Godkjente erstatninger for en linje i samme butikk: samme vare, gyldig pakning og pris, ikke utsolgt, og aldri et
 * produkt med allergentreff eller uavklart status når allergifilteret er aktivt. Billigst først, fast regel ved likhet.
 */
export function findSubstitutes(base: Basket, changes: ChangeMap, line: AdjustedLine, week: string, ctx: Ctx, pin: PlanVersion | null = null): Substitutes {
  const out: Substitutes = { line: line.lineKey, storeId: line.storeId, options: [], rejected: [] };
  const storeId = line.storeId;
  if (!storeId) return out; // uten butikk finnes ingen hylle å velge fra
  const soldOut = new Set(soldOutOn(line));
  const reference = applyChanges(base, withChange(changes, line.lineKey, null), week, ctx, pin);
  const refLine = reference.lines.find((l) => l.lineKey === line.lineKey);
  const originalCost = line.change ? line.change.original.costOre : line.costOre;
  const recipeAllergens = new Set(line.covers.flatMap((id) => ctx.catalog.recipes.find((r) => r.id === id)?.allergens ?? []));
  const candidates = ctx.catalog.products.filter((p) => p.ingredient === line.ingredient).sort((a, b) => a.id.localeCompare(b.id));
  for (const p of candidates) {
    if (soldOut.has(p.id)) { out.rejected.push({ product: p, reason: 'utsolgt' }); continue; }
    if (!(p.size > 0) || !Number.isFinite(p.size)) { out.rejected.push({ product: p, reason: 'feil-enhet' }); continue; }
    const a = allergenCheck(p, ctx.settings.avoid);
    if (a !== 'ok') { out.rejected.push({ product: p, reason: a }); continue; }
    const obs = priceIn(p.id, storeId, ctx);
    if (!obs) { out.rejected.push({ product: p, reason: 'ingen-pris' }); continue; }
    const ev = substituteEvent(line, week, p.id, { id: '-', at: '-', by: '-' }) as ActiveChange;
    const next = applyChanges(base, withChange(changes, line.lineKey, ev), week, ctx, pin);
    const nl = next.lines.find((l) => l.lineKey === line.lineKey && l.productId === p.id);
    if (!nl || nl.costOre === null) { out.rejected.push({ product: p, reason: 'ingen-pris' }); continue; }
    out.options.push({
      product: p, storeId, obs, packs: nl.packs, packSize: nl.packSize, costOre: nl.costOre, leftover: nl.leftover,
      lineDeltaOre: originalCost === null ? null : nl.costOre - originalCost,
      newTotalOre: next.totalOre, newComplete: next.complete,
      deltaOre: reference.complete && next.complete && refLine ? next.totalOre - reference.totalOre : null,
      newAllergens: p.allergens.filter((x) => !recipeAllergens.has(x)).sort(),
      allergenUnknown: !p.allergenKnown,
    });
  }
  out.options.sort((a, b) => a.costOre - b.costOre || a.packs - b.packs || a.product.id.localeCompare(b.product.id));
  return out;
}

// ---------- «Fant ikke»: berørte retter og alternativer ----------

export interface AffectedDish { day: number; recipeId: string; name: string; locked: boolean }
export interface NotFoundOption {
  kind: 'hopp-over' | 'bruk-hjemme' | 'bytt-rett';
  day: number | null; recipeId: string | null; recipeName: string | null; fromRecipeId: string | null;
  /** Planen etter valget (uendret for «hopp over» og «bruk noe hjemme»). */
  slots: Slot[];
  totalOre: number; complete: boolean; unknownCount: number;
  /** Mot kurven før varen manglet; null når en av dem har ukjent pris. */
  deltaOre: number | null;
}
export interface NotFoundPlan {
  line: string; affected: AffectedDish[];
  /** Kurven før varen manglet. */
  reference: { totalOre: number; complete: boolean };
  /** Kurven med varen som «fant ikke» og ingen andre grep: alltid med ukjent pris på varen. */
  notFound: { totalOre: number; complete: boolean };
  /** Komplette alternativer først; et alternativ med ukjent pris får aldri en prisforskjell og rangeres aldri foran. */
  options: NotFoundOption[];
}

/**
 * Hva «fant ikke» betyr for uka: hvilke retter varen inngår i, og hva som kan gjøres (bytte en berørt rett, bruke noe
 * hjemme, hoppe over varen) med ny kurv og sum. Låste retter byttes ikke.
 */
export function notFoundOptions(
  slots: Slot[], storeIds: string[], changes: ChangeMap, line: AdjustedLine, week: string, ctx: Ctx,
  pin: PlanVersion | null = null, perDay = 3,
): NotFoundPlan {
  const meta = { id: '-', at: '-', by: '-' };
  const asChoice = (choice: NotFoundChoice) => withChange(changes, line.lineKey, notFoundEvent(line, week, choice, meta) as ActiveChange);
  const adjusted = (ss: Slot[], ch: ChangeMap) => applyChanges(buildBasket(ss, storeIds, ctx), ch, week, ctx, pin);
  const reference = adjusted(slots, withChange(changes, line.lineKey, null));
  const missing = adjusted(slots, asChoice('uavklart'));
  const recipes = new Map(ctx.catalog.recipes.map((r) => [r.id, r]));
  const affected: AffectedDish[] = slots
    .filter((s) => line.covers.includes(s.recipeId))
    .map((s) => ({ day: s.day, recipeId: s.recipeId, name: recipes.get(s.recipeId)?.name ?? s.recipeId, locked: s.locked }))
    .sort((a, b) => a.day - b.day);
  const delta = (b: Basket) => (reference.complete && b.complete ? b.totalOre - reference.totalOre : null);
  const options: NotFoundOption[] = [];
  for (const kind of ['bruk-hjemme', 'hopp-over'] as const) {
    const b = adjusted(slots, asChoice(kind));
    options.push({ kind, day: null, recipeId: null, recipeName: null, fromRecipeId: null, slots, totalOre: b.totalOre, complete: b.complete, unknownCount: b.unknownCount, deltaOre: delta(b) });
  }
  const notFoundChanges = asChoice('uavklart');
  for (const a of affected.filter((x) => !x.locked)) {
    const used = new Set(slots.filter((s) => s.day !== a.day).map((s) => s.recipeId));
    const cands: NotFoundOption[] = eligibleRecipes(ctx, a.day)
      .filter((r: Recipe) => r.id !== a.recipeId && !used.has(r.id) && !r.lines.some((x) => x.ingredient === line.ingredient))
      .map((r) => {
        const next = slots.map((s) => (s.day === a.day ? { ...s, recipeId: r.id } : s));
        const b = adjusted(next, notFoundChanges);
        return {
          kind: 'bytt-rett' as const, day: a.day, recipeId: r.id, recipeName: r.name, fromRecipeId: a.recipeId, slots: next,
          totalOre: b.totalOre, complete: b.complete, unknownCount: b.unknownCount, deltaOre: delta(b),
        };
      })
      .sort(rankOption)
      .slice(0, perDay);
    options.push(...cands);
  }
  options.sort(rankOption);
  return {
    line: line.lineKey, affected,
    reference: { totalOre: reference.totalOre, complete: reference.complete },
    notFound: { totalOre: missing.totalOre, complete: missing.complete },
    options,
  };
}

const KIND_ORDER: Record<NotFoundOption['kind'], number> = { 'bytt-rett': 0, 'bruk-hjemme': 1, 'hopp-over': 2 };
/** Komplett før ufullstendig, så færrest ukjente, så type, så sum, så dag og rett-id. */
function rankOption(a: NotFoundOption, b: NotFoundOption): number {
  return Number(b.complete) - Number(a.complete) || a.unknownCount - b.unknownCount || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    a.totalOre - b.totalOre || (a.day ?? -1) - (b.day ?? -1) || (a.recipeId ?? '').localeCompare(b.recipeId ?? '');
}

// ---------- Planversjoner og historikk ----------

export type VersionReason = 'godkjent' | 'erstatning' | 'fant-ikke' | 'angret' | 'bytt-rett' | 'nye-priser' | 'beholdt';
export interface VersionLine {
  key: string; ingredient: string; name: string; unit: Unit; storeId: string | null;
  productId: string | null; productName: string | null; packs: number; packSize: number; need: number;
  costOre: number | null; status: PriceStatus; observed: string | null; source: string | null;
  /** Siste gyldighetsdag for prisen (tilbud). */
  validUntil: string | null;
  change: 'erstatt' | 'fant-ikke' | null; choice: NotFoundChoice | null;
  /** Før brukerens valg på linja (det utsolgte produktet og prisen). */
  original: LineOriginal | null;
}
export type DriftReason = 'prisendring' | 'utløpt-tilbud' | 'annet-produkt' | 'mengde' | 'ny-vare' | 'fjernet';
export interface LineSide { productName: string | null; packs: number; costOre: number | null; status: PriceStatus; validUntil: string | null }
export interface DriftItem { key: string; ingredient: string; name: string; reason: DriftReason; before: LineSide | null; after: LineSide | null }
export interface PlanVersion {
  id: string; at: string; by: string; week: string; reason: VersionReason; note: string;
  slots: Slot[]; lines: VersionLine[]; skipped: VersionLine[];
  totalOre: number; complete: boolean; unknownCount: number;
  /** Prisgrunnlaget: kilde og observasjonsdato for prisene som er brukt. */
  priceBasis: string;
  /** Nye priser brukeren har sett og valgt å ikke ta inn («Behold godkjent liste»). */
  declined: DriftItem[];
}
export type PlanHistory = PlanVersion[];

function validUntilOf(l: BasketLine, ctx: Ctx): string | null {
  if (!l.productId || !l.storeId || l.costOre === null || l.packs <= 0) return null;
  const unit = l.costOre / l.packs;
  const o = ctx.catalog.prices.find((x) => x.productId === l.productId && x.storeId === l.storeId && x.ore === unit && x.status === l.status && x.observed === l.observed);
  return o?.validUntil ?? null;
}
function versionLine(l: AdjustedLine, ctx: Ctx): VersionLine {
  return {
    key: versionKey(l.ingredient), ingredient: l.ingredient, name: l.name, unit: l.unit, storeId: l.storeId,
    productId: l.productId, productName: l.productName, packs: l.packs, packSize: l.packSize, need: l.need,
    costOre: l.costOre, status: l.status, observed: l.observed, source: l.source, validUntil: validUntilOf(l, ctx),
    change: l.change?.type ?? null, choice: l.change?.choice ?? null, original: l.change ? l.change.original : null,
  };
}

export interface VersionMeta { id: string; at: string; by: string; week: string; reason: VersionReason; note?: string; declined?: DriftItem[] }
/** Fryser kurven slik den er nå. Endres aldri senere; nye endringer gir nye versjoner. */
export function snapshot(basket: AdjustedBasket, slots: Slot[], meta: VersionMeta, ctx: Ctx): PlanVersion {
  const lines = basket.lines.map((l) => versionLine(l, ctx)).sort((a, b) => a.key.localeCompare(b.key));
  const skipped = basket.skipped.map((l) => versionLine(l, ctx)).sort((a, b) => a.key.localeCompare(b.key));
  const basis = [...new Set(lines.filter((l) => l.source).map((l) => `${l.source} ${l.observed}`))].sort();
  return {
    id: meta.id, at: meta.at, by: meta.by, week: meta.week, reason: meta.reason, note: meta.note ?? '',
    slots: [...slots].sort((a, b) => a.day - b.day).map((s) => ({ ...s })), lines, skipped,
    totalOre: basket.totalOre, complete: basket.complete, unknownCount: basket.unknownCount,
    priceBasis: basis.join('; '), declined: meta.declined ?? [],
  };
}

/** Legger til en versjon. Idempotent på id; eldre versjoner endres aldri. Holdes sortert på (at, id). */
export function addVersion(history: PlanHistory, v: PlanVersion): PlanHistory {
  if (!v || !v.id || !v.at || !v.week || history.some((x) => x.id === v.id)) return history;
  return [...history, v].sort(byAtId);
}
export const versionsFor = (history: PlanHistory, week: string) => history.filter((v) => v.week === week).sort(byAtId);
export const latestVersion = (history: PlanHistory, week: string): PlanVersion | null => versionsFor(history, week).at(-1) ?? null;

const sameSlots = (a: Slot[], b: Slot[]) => {
  const k = (ss: Slot[]) => JSON.stringify([...ss].sort((x, y) => x.day - y.day).map((s) => [s.day, s.recipeId, s.extra ?? 0]));
  return k(a) === k(b);
};
/**
 * Versjonen en godkjent liste holdes fast til: siste versjon for uka, når planen er godkjent og middagene er de samme.
 * Endres middagene, må planen godkjennes på nytt og får en ny versjon.
 */
export const activePin = (history: PlanHistory, week: string, slots: Slot[], approved: boolean): PlanVersion | null => {
  const v = approved ? latestVersion(history, week) : null;
  return v && sameSlots(v.slots, slots) ? v : null;
};
/** Trengs en ny «godkjent»-versjon? (Godkjent, og ingen versjon med disse middagene finnes for uka.) */
export const needsApprovalVersion = (history: PlanHistory, week: string, slots: Slot[], approved: boolean) =>
  approved && slots.length > 0 && !activePin(history, week, slots, approved);

const side = (l: VersionLine | AdjustedLine, validUntil: string | null): LineSide =>
  ({ productName: l.productName, packs: l.packs, costOre: l.costOre, status: l.status, validUntil });

/** Forskjeller mellom to sett linjer (før → etter), med årsak. Sortert på nøkkel. */
export function diffLines(before: VersionLine[], after: VersionLine[], shopDate?: string): DriftItem[] {
  const a = new Map(before.map((l) => [l.key, l]));
  const b = new Map(after.map((l) => [l.key, l]));
  const out: DriftItem[] = [];
  for (const key of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const x = a.get(key); const y = b.get(key);
    const base = { key, ingredient: (x ?? y)!.ingredient, name: (x ?? y)!.name };
    if (!x) { out.push({ ...base, reason: 'ny-vare', before: null, after: side(y!, y!.validUntil) }); continue; }
    if (!y) { out.push({ ...base, reason: 'fjernet', before: side(x, x.validUntil), after: null }); continue; }
    if (x.productId === y.productId && x.packs === y.packs && x.costOre === y.costOre && x.status === y.status) continue;
    const expired = x.status === 'tilbud' && !!x.validUntil && !!shopDate && x.validUntil < shopDate;
    const reason: DriftReason = expired ? 'utløpt-tilbud' : x.productId !== y.productId ? 'annet-produkt' : x.packs !== y.packs ? 'mengde' : 'prisendring';
    out.push({ ...base, reason, before: side(x, x.validUntil), after: side(y, y.validUntil) });
  }
  return out;
}

const sameDrift = (a: DriftItem, b: DriftItem) => a.key === b.key && a.reason === b.reason && JSON.stringify(a.after) === JSON.stringify(b.after);

/**
 * Hva motoren ville gitt nå sammenlignet med den godkjente versjonen: nye priser, utløpte tilbud, andre produkter.
 * `current` skal være kurven uten fastholdte produkter (det motoren ville valgt). Avvik brukeren allerede har valgt
 * å ikke ta inn, vises ikke på nytt. Tomt resultat: ingenting å ta stilling til.
 */
export function priceDrift(v: PlanVersion, current: AdjustedBasket, ctx: Ctx): DriftItem[] {
  const now = snapshot(current, v.slots, { id: '-', at: '-', by: '-', week: v.week, reason: v.reason }, ctx);
  return diffLines(v.lines, now.lines, ctx.shopDate).filter((d) => !v.declined.some((x) => sameDrift(x, d)));
}

/** «Behold godkjent liste»: ny versjon med samme linjer, der avvikene brukeren har sett er notert. */
export function keepVersion(v: PlanVersion, drift: DriftItem[], meta: Omit<VersionMeta, 'week' | 'reason'>): PlanVersion {
  return {
    ...v, id: meta.id, at: meta.at, by: meta.by, reason: 'beholdt', note: meta.note ?? '',
    declined: [...v.declined, ...drift.filter((d) => !v.declined.some((x) => sameDrift(x, d)))],
  };
}
