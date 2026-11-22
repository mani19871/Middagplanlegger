// Beholdning som hendelseslogg. Ren og deterministisk: tidspunkt (`at`), id og enhet (`by`) kommer fra kalleren,
// aldri fra klokke eller tilfeldighet her. Mengder i g/ml/stk.
//
// Fire ting holdes adskilt:
//  (a) forventet rest   – beregnes fra kurven (pantry.ts), er aldri beholdning
//  (b) kjøpshendelse    – «Marker som handlet» på en linje i handlelista
//  (c) bekreftet hjemme – brukerens egen telling, eller en bekreftet rest etter en uke
//  (d) forbruk          – en middag er markert som laget; en kjøpt pakke betyr ikke at retten er laget
//  (e) brukt hjemmefra  – «fant ikke» → «bruk noe vi har hjemme»: mengden finnes hjemme og er øremerket ukas plan
//                         (`hjemme`). Den legges til bekreftet hjemme og brukes opp når retten markeres som laget.
//
// Idempotens: hver hendelse har en id. Samme id to ganger gir én rad (applyEvent). I tillegg har kjøp og «laget» en
// linje-id avledet av hva det gjelder (uke, butikk, vare, produkt / uke, dag). To voksne som markerer samme linje gir
// derfor ett kjøp, ikke to. Er de uenige om antall pakker, blir linja en konflikt som må bekreftes (`løs`).
// Tilstanden avledes alltid av hele loggen sortert på (at, id), så rekkefølgen hendelsene kommer inn i spiller ingen rolle.
import type { Unit } from './types';

export interface Use { ingredient: string; amount: number }
interface Base { id: string; at: string; by: string }
export type InventoryEvent =
  | (Base & {
      type: 'kjøp'; week: string; line: string; ingredient: string; productId: string | null; storeId: string | null;
      packs: number; packSize: number; unit: Unit;
    })
  /** Bekrefter antall pakker på en linje i konflikt. */
  | (Base & { type: 'løs'; line: string; packs: number })
  /** Trekker tilbake et kjøp eller en «laget»-markering. */
  | (Base & { type: 'angre'; line: string })
  /** Middagen er laget. `uses` er mengdene som gikk med, regnet ut da den ble markert. */
  | (Base & { type: 'laget'; week: string; line: string; day: number; recipeId: string; uses: Use[] })
  /** Brukerbekreftet mengde hjemme (utenom kjøp registrert i appen). Erstatter forrige telling for varen. */
  | (Base & { type: 'telling'; ingredient: string; amount: number })
  /** Bekreftet rest etter ukas middager: total mengde igjen av varen. Erstatter ukas kjøp og forbruk av varen. */
  | (Base & { type: 'rest'; week: string; ingredient: string; amount: number })
  /**
   * Varen tas fra matskapet i stedet for å kjøpes («bruk noe vi har hjemme» i handlelista). Linje-id per (uke, vare), så
   * to voksne som velger det samme gir én registrering; ulik mengde gir den største (uavhengig av rekkefølge).
   * Angres med `angre` på samme linje.
   */
  | (Base & { type: 'hjemme'; week: string; line: string; ingredient: string; amount: number })
  /**
   * Basisvare markert som «har», «snart tom» eller «tom» (engine/staples.ts). Endrer aldri beholdningen (mengdene) og
   * aldri ukas kurv; gir bare forslag på handlelista. Siste markering per vare etter (at, id) gjelder, som for `telling`.
   */
  | (Base & { type: 'nivå'; staple: string; level: StapleLevel });

export type InventoryLog = InventoryEvent[];

/** Nivå for en basisvare (engine/staples.ts). */
export type StapleLevel = 'har' | 'snart-tom' | 'tom';
export const STAPLE_LEVELS: readonly StapleLevel[] = ['har', 'snart-tom', 'tom'];
/** Id for en basisvare: id fra den generelle lista (små bokstaver) eller «egen:» + navn med små bokstaver og bindestrek. */
// Egen vare: alle bokstaver (også \p{Lm} som «ʻ» og tegn der små bokstaver blir lengre, som «İ» → «i̇»), så hver id
// customStapleId kan lage, godtas også i `nivå` (runde 2, M2). 30 tegn i navnet gir høyst 60 i id-en.
export const STAPLE_ID = /^(?:[a-z]{1,20}|egen:[\p{L}\p{M}-]{1,80})$/u;

export const purchaseLineId = (week: string, storeId: string | null, ingredient: string, productId: string | null) =>
  `kjøp|${week}|${storeId ?? '-'}|${ingredient}|${productId ?? '-'}`;
export const madeLineId = (week: string, day: number) => `laget|${week}|${day}`;
export const homeLineId = (week: string, ingredient: string) => `hjemme|${week}|${ingredient}`;

const cmp = (a: InventoryEvent, b: InventoryEvent) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const okAmount = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const okPacks = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1;

export function isValidEvent(e: InventoryEvent): boolean {
  if (!e || typeof e.id !== 'string' || !e.id || typeof e.at !== 'string' || !e.at || typeof e.by !== 'string') return false;
  switch (e.type) {
    case 'kjøp': return okPacks(e.packs) && okAmount(e.packSize) && e.packSize > 0 && e.line === purchaseLineId(e.week, e.storeId, e.ingredient, e.productId);
    case 'løs': return okPacks(e.packs) && !!e.line;
    case 'angre': return !!e.line;
    case 'laget': return Number.isInteger(e.day) && e.line === madeLineId(e.week, e.day) && e.uses.every((u) => okAmount(u.amount));
    case 'telling': return okAmount(e.amount) && !!e.ingredient;
    case 'rest': return okAmount(e.amount) && !!e.ingredient && !!e.week;
    case 'hjemme': return okAmount(e.amount) && e.amount > 0 && !!e.ingredient && e.line === homeLineId(e.week, e.ingredient);
    case 'nivå': return typeof e.staple === 'string' && STAPLE_ID.test(e.staple) && STAPLE_LEVELS.includes(e.level);
    default: return false;
  }
}

/**
 * Legger en hendelse inn i loggen. Idempotent: en id som allerede finnes, eller en ugyldig hendelse, gir samme logg
 * tilbake (samme objekt). Loggen holdes sortert på (at, id). Endrer aldri inndata.
 */
export function applyEvent(log: InventoryLog, e: InventoryEvent): InventoryLog {
  if (!isValidEvent(e) || log.some((x) => x.id === e.id)) return log;
  const next = [...log, e];
  next.sort(cmp);
  return next;
}

export const applyEvents = (log: InventoryLog, events: InventoryEvent[]) => events.reduce(applyEvent, log);

// ---------- Linjetilstand: kjøp og «laget» ----------

export interface Claim { id: string; by: string; packs: number; at: string }
export interface PurchaseState {
  line: string; week: string; ingredient: string; productId: string | null; storeId: string | null; unit: Unit;
  packSize: number; status: 'kjøpt' | 'konflikt' | 'angret';
  /** Antall pakker når status er «kjøpt», ellers null. */
  packs: number | null;
  /** Ulike antall som er meldt for linja (sortert); mer enn ett betyr konflikt. */
  candidates: number[];
  claims: Claim[]; at: string;
}
export interface MadeState { line: string; week: string; day: number; recipeId: string; uses: Use[]; at: string; active: boolean }
export interface HomeState { line: string; week: string; ingredient: string; amount: number; at: string; active: boolean }

export function lineStates(log: InventoryLog): { purchases: Map<string, PurchaseState>; made: Map<string, MadeState>; home: Map<string, HomeState> } {
  const purchases = new Map<string, PurchaseState>();
  const made = new Map<string, MadeState>();
  const home = new Map<string, HomeState>();
  for (const e of [...log].sort(cmp)) {
    if (e.type === 'kjøp') {
      const p = purchases.get(e.line);
      const claim: Claim = { id: e.id, by: e.by, packs: e.packs, at: e.at };
      if (!p || p.status === 'angret') {
        purchases.set(e.line, {
          line: e.line, week: e.week, ingredient: e.ingredient, productId: e.productId, storeId: e.storeId, unit: e.unit,
          packSize: e.packSize, status: 'kjøpt', packs: e.packs, candidates: [e.packs], claims: [claim], at: e.at,
        });
      } else if (p.status === 'kjøpt' && p.packs === e.packs) {
        p.claims.push(claim); // samme kjøp meldt av flere: ett kjøp
      } else if (p.status === 'kjøpt' && p.claims.every((c) => c.by === e.by)) {
        p.packs = e.packs; p.candidates = [e.packs]; p.claims = [claim]; // samme person retter sitt eget antall
      } else {
        p.claims.push(claim);
        p.status = 'konflikt'; p.packs = null;
        p.candidates = [...new Set(p.claims.map((c) => c.packs))].sort((a, b) => a - b);
      }
    } else if (e.type === 'løs') {
      const p = purchases.get(e.line);
      if (p && p.status !== 'angret') { p.status = 'kjøpt'; p.packs = e.packs; p.candidates = [e.packs]; p.claims = [{ id: e.id, by: e.by, packs: e.packs, at: e.at }]; }
    } else if (e.type === 'angre') {
      const p = purchases.get(e.line);
      if (p) { p.status = 'angret'; p.packs = null; }
      const m = made.get(e.line);
      if (m) m.active = false;
      const h = home.get(e.line);
      if (h) h.active = false;
    } else if (e.type === 'hjemme') {
      const h = home.get(e.line);
      if (!h || !h.active) home.set(e.line, { line: e.line, week: e.week, ingredient: e.ingredient, amount: e.amount, at: e.at, active: true });
      else h.amount = Math.max(h.amount, e.amount); // samme registrering fra flere: én, største mengde
    } else if (e.type === 'laget') {
      const m = made.get(e.line);
      if (!m || !m.active) made.set(e.line, { line: e.line, week: e.week, day: e.day, recipeId: e.recipeId, uses: e.uses, at: e.at, active: true });
    }
  }
  return { purchases, made, home };
}

// ---------- Beholdning ----------

export interface Lot { ingredient: string; kind: 'bekreftet' | 'kjøpt'; amount: number; source: 'telling' | 'rest' | 'kjøp' | 'hjemme'; week: string | null }
export interface Stock {
  /** Sum per vare: bekreftet hjemme + kjøpt og ikke brukt. Dette er det eneste som trekkes fra behovet. */
  total: Record<string, number>;
  lots: Lot[];
}

type Op =
  | { at: string; id: string; kind: 'telling'; ingredient: string; amount: number }
  | { at: string; id: string; kind: 'rest'; week: string; ingredient: string; amount: number }
  | { at: string; id: string; kind: 'kjøp'; week: string; ingredient: string; amount: number }
  | { at: string; id: string; kind: 'laget'; week: string; uses: Use[] }
  | { at: string; id: string; kind: 'hjemme'; week: string; ingredient: string; amount: number };

export interface StockOptions {
  /** Uka planen gjelder. Ukas egne kjøp, forbruk og rest holdes utenfor, så handelen ikke krymper seg selv. */
  planWeek?: string;
}

/**
 * Beholdning avledet av loggen. Uten `planWeek`: alt som er kjent nå (til visning i matskapet og neste uke).
 * Med `planWeek`: beholdningen planen for den uka skal trekke fra, altså det som fantes før ukas handel:
 *  - ukas egne kjøp, «laget» og bekreftede rester telles ikke (de er handelen og forbruket fra den),
 *  - og etter første kjøp for uka endrer nye hendelser ikke ukas handleliste.
 * Forventet rest er aldri med. Uavklarte konflikter teller ikke før antallet er bekreftet.
 */
export function deriveStock(fullLog: InventoryLog, opts: StockOptions = {}): Stock {
  let cutoff: string | null = null;
  if (opts.planWeek) {
    for (const e of fullLog) if (e.type === 'kjøp' && e.week === opts.planWeek && (cutoff === null || e.at < cutoff)) cutoff = e.at;
  }
  // Etter ukas første kjøp gjelder nye hendelser neste handel. Tilstanden regnes derfor bare av hendelsene før, også
  // når en senere `løs`, `angre`, rest eller større `hjemme` gjelder en linje som startet før.
  const c = cutoff;
  const log = c === null ? fullLog : fullLog.filter((e) => e.at < c);
  const { purchases, made, home } = lineStates(log);
  const lastRest = new Map<string, Extract<InventoryEvent, { type: 'rest' }>>();
  for (const e of [...log].sort(cmp)) if (e.type === 'rest') lastRest.set(`${e.week}|${e.ingredient}`, e);

  const ops: Op[] = [];
  for (const e of log) if (e.type === 'telling') ops.push({ at: e.at, id: e.id, kind: 'telling', ingredient: e.ingredient, amount: e.amount });
  for (const r of lastRest.values()) ops.push({ at: r.at, id: r.id, kind: 'rest', week: r.week, ingredient: r.ingredient, amount: r.amount });
  for (const p of purchases.values()) {
    if (p.status === 'kjøpt' && p.packs) ops.push({ at: p.at, id: p.line, kind: 'kjøp', week: p.week, ingredient: p.ingredient, amount: p.packs * p.packSize });
  }
  for (const m of made.values()) if (m.active) ops.push({ at: m.at, id: m.line, kind: 'laget', week: m.week, uses: m.uses });
  for (const h of home.values()) if (h.active) ops.push({ at: h.at, id: h.line, kind: 'hjemme', week: h.week, ingredient: h.ingredient, amount: h.amount });
  ops.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const included = (o: Op) => {
    if (!opts.planWeek) return true;
    if ('week' in o && o.week === opts.planWeek) return false;
    return cutoff === null || o.at < cutoff;
  };
  // En bekreftet rest for (uke, vare) erstatter ukas kjøp og forbruk av varen, uansett rekkefølge.
  const restKeys = new Set([...lastRest.values()].filter((r) => included({ ...r, kind: 'rest' })).map((r) => `${r.week}|${r.ingredient}`));

  const confirmed = new Map<string, Lot>();
  const bought = new Map<string, Lot[]>(); // per vare, eldste uke først
  for (const o of ops) {
    if (!included(o)) continue;
    if (o.kind === 'telling') {
      confirmed.set(o.ingredient, { ingredient: o.ingredient, kind: 'bekreftet', amount: o.amount, source: 'telling', week: null });
    } else if (o.kind === 'rest') {
      confirmed.set(o.ingredient, { ingredient: o.ingredient, kind: 'bekreftet', amount: o.amount, source: 'rest', week: o.week });
      bought.set(o.ingredient, (bought.get(o.ingredient) ?? []).filter((l) => l.week! > o.week));
    } else if (o.kind === 'kjøp') {
      if (restKeys.has(`${o.week}|${o.ingredient}`)) continue;
      const lots = bought.get(o.ingredient) ?? [];
      const same = lots.find((l) => l.week === o.week);
      if (same) same.amount += o.amount;
      else lots.push({ ingredient: o.ingredient, kind: 'kjøpt', amount: o.amount, source: 'kjøp', week: o.week });
      lots.sort((a, b) => (a.week! < b.week! ? -1 : a.week! > b.week! ? 1 : 0));
      bought.set(o.ingredient, lots);
    } else if (o.kind === 'hjemme') {
      // Finnes hjemme og er øremerket ukas plan: kommer i tillegg til det som er bekreftet. En senere telling eller en
      // bekreftet rest for uka erstatter den; «laget» bruker den opp.
      if (restKeys.has(`${o.week}|${o.ingredient}`)) continue;
      const c = confirmed.get(o.ingredient);
      if (c) c.amount += o.amount;
      else confirmed.set(o.ingredient, { ingredient: o.ingredient, kind: 'bekreftet', amount: o.amount, source: 'hjemme', week: o.week });
    } else {
      for (const u of o.uses) {
        if (restKeys.has(`${o.week}|${u.ingredient}`)) continue;
        // Det som har ligget lengst brukes først: bekreftet hjemme, deretter kjøp etter uke.
        let left = u.amount;
        const queue = [confirmed.get(u.ingredient), ...(bought.get(u.ingredient) ?? [])].filter((l): l is Lot => !!l);
        for (const l of queue) {
          const take = Math.min(l.amount, left);
          l.amount -= take; left -= take;
          if (left <= 0) break;
        }
      }
    }
  }
  const lots = [...confirmed.values(), ...[...bought.values()].flat()]
    .filter((l) => l.amount > 1e-9)
    .sort((a, b) => (a.ingredient < b.ingredient ? -1 : a.ingredient > b.ingredient ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : (a.week ?? '') < (b.week ?? '') ? -1 : 1));
  const total: Record<string, number> = {};
  for (const l of lots) total[l.ingredient] = (total[l.ingredient] ?? 0) + l.amount;
  return { total, lots };
}

/** Bekreftet rest for uka (uke|vare → mengde), siste verdi gjelder. */
export function confirmedRests(log: InventoryLog, week: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of [...log].sort(cmp)) if (e.type === 'rest' && e.week === week) out[e.ingredient] = e.amount;
  return out;
}

/** Konflikter som må bekreftes av brukeren. */
export const conflicts = (log: InventoryLog) => [...lineStates(log).purchases.values()].filter((p) => p.status === 'konflikt');
