import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { buildBasket, slotUses, type Ctx } from './planner';
import { expectedRest } from './pantry';
import {
  applyEvent, applyEvents, conflicts, deriveStock, homeLineId, lineStates, madeLineId, purchaseLineId,
  type InventoryEvent, type InventoryLog,
} from './inventory';
import { enqueue, flush, type EventTransport } from '../sync/queue';
import type { BasketLine, Settings, Slot } from './types';

const W = '2026-11-23';
const W2 = '2026-11-30';
const ctx = (over: Partial<Settings> = {}, stock?: Record<string, number>): Ctx => ({ catalog, settings: { ...defaultSettings, ...over }, stock });
const slot = (day: number, recipeId: string, extra?: number): Slot => ({ day, recipeId, locked: false, ...(extra ? { extra, extraFor: day + 1 } : {}) });
const t = (n: number) => `2026-11-23T10:${String(n).padStart(2, '0')}:00.000Z`;

const buy = (l: BasketLine, id: string, at: string, by = 'A', packs = l.packs, week = W): InventoryEvent => ({
  type: 'kjøp', id, at, by, week, line: purchaseLineId(week, l.storeId, l.ingredient, l.productId), ingredient: l.ingredient,
  productId: l.productId, storeId: l.storeId, packs, packSize: l.packSize, unit: l.unit,
});
const made = (s: Slot, c: Ctx, id: string, at: string, week = W): InventoryEvent => ({
  type: 'laget', id, at, by: 'A', week, line: madeLineId(week, s.day), day: s.day, recipeId: s.recipeId, uses: slotUses(s, c),
});
const lineOf = (slots: Slot[], ing: string, c = ctx()) => buildBasket(slots, ['demoA'], c).lines.find((l) => l.ingredient === ing)!;

/** En tenkt server som lagrer hendelser idempotent på id. */
function memoryServer() {
  let log: InventoryLog = [];
  let failNext = false;
  let dropAck = false;
  const transport: EventTransport = {
    async push(events) {
      if (failNext) { failNext = false; throw new Error('frakoblet'); }
      log = applyEvents(log, events);
      if (dropAck) { dropAck = false; throw new Error('svaret kom aldri fram'); }
      return events.map((e) => e.id);
    },
  };
  return { transport, get log() { return log; }, fail() { failNext = true; }, loseAck() { dropAck = true; } };
}

describe('beholdning: idempotent logg', () => {
  it('samme hendelse to ganger gir én rad og samme objekt tilbake', () => {
    const l = lineOf([slot(0, 'bolognese')], 'pasta');
    const e = buy(l, 'e1', t(1));
    const once = applyEvent([], e);
    const twice = applyEvent(once, e);
    expect(twice).toBe(once);
    expect(twice).toHaveLength(1);
    expect(applyEvent(twice, { ...e })).toHaveLength(1); // samme id, kopi fra nettverket
  });
  it('samme kjøp mottatt to ganger dobler ikke beholdningen', () => {
    const l = lineOf([slot(0, 'bolognese')], 'pasta');
    const e = buy(l, 'e1', t(1));
    const once = deriveStock(applyEvent([], e)).total.pasta;
    expect(once).toBe(l.packs * l.packSize);
    expect(deriveStock(applyEvents([], [e, e, { ...e }])).total.pasta).toBe(once);
  });
  it('ugyldige hendelser ignoreres og inndata endres aldri', () => {
    const l = lineOf([slot(0, 'bolognese')], 'pasta');
    const log: InventoryLog = [];
    expect(applyEvent(log, { ...buy(l, 'x', t(1)), packs: 0 } as InventoryEvent)).toBe(log);
    expect(applyEvent(log, { ...buy(l, 'x', t(1)), line: 'feil' } as InventoryEvent)).toBe(log);
    expect(applyEvent(log, { type: 'telling', id: 'y', at: t(1), by: 'A', ingredient: 'pasta', amount: -1 })).toBe(log);
    expect(log).toEqual([]);
  });
  it('rekkefølgen hendelser kommer inn i påvirker ikke tilstanden', () => {
    const slots = [slot(0, 'bolognese'), slot(1, 'pastaspinat')];
    const c = ctx();
    const l = lineOf(slots, 'pasta');
    const events = [buy(l, 'k1', t(1)), made(slots[0], c, 'm1', t(5)), { type: 'telling', id: 'h1', at: t(0), by: 'B', ingredient: 'ris', amount: 300 } as InventoryEvent,
      { type: 'angre', id: 'a1', at: t(6), by: 'A', line: madeLineId(W, 0) } as InventoryEvent, made(slots[1], c, 'm2', t(7))];
    const a = deriveStock(applyEvents([], events));
    const b = deriveStock(applyEvents([], [...events].reverse()));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('beholdning: to voksne og frakobling', () => {
  it('to voksne som krysser av samme linje samtidig gir ett kjøp', () => {
    const l = lineOf([slot(0, 'bolognese')], 'pasta');
    const log = applyEvents([], [buy(l, 'fra-A', t(1), 'A'), buy(l, 'fra-B', t(1), 'B')]);
    expect(log).toHaveLength(2); // begge avkrysningene lagres med egen identitet …
    const p = [...lineStates(log).purchases.values()];
    expect(p).toHaveLength(1); // … men det er ett kjøp
    expect(p[0].claims.map((c) => c.by)).toEqual(['A', 'B']);
    expect(deriveStock(log).total.pasta).toBe(l.packs * l.packSize);
  });
  it('uenighet om antall blir en konflikt som må bekreftes, uten gjetting', () => {
    const l = lineOf([slot(0, 'bolognese')], 'pasta');
    let log = applyEvents([], [buy(l, 'fra-A', t(1), 'A', 1), buy(l, 'fra-B', t(2), 'B', 2)]);
    const c = conflicts(log);
    expect(c).toHaveLength(1);
    expect(c[0].candidates).toEqual([1, 2]);
    expect(c[0].packs).toBeNull();
    expect(deriveStock(log).total.pasta ?? 0).toBe(0); // teller ikke før antallet er bekreftet
    log = applyEvent(log, { type: 'løs', id: 'løs1', at: t(3), by: 'A', line: c[0].line, packs: 2 });
    expect(conflicts(log)).toHaveLength(0);
    expect(deriveStock(log).total.pasta).toBe(2 * l.packSize);
  });
  it('samme person som retter sitt eget antall er ikke en konflikt', () => {
    const l = lineOf([slot(0, 'bolognese')], 'pasta');
    const log = applyEvents([], [buy(l, 'a1', t(1), 'A', 1), buy(l, 'a2', t(2), 'A', 3)]);
    expect(conflicts(log)).toHaveLength(0);
    expect(deriveStock(log).total.pasta).toBe(3 * l.packSize);
  });
  it('endring mens enheten er frakoblet: utboksen spilles av uten doble kjøp, og enhetene ender likt', async () => {
    const slots = [slot(0, 'bolognese'), slot(1, 'pastaspinat')];
    const c = ctx();
    const pasta = lineOf(slots, 'pasta');
    const tomat = lineOf(slots, 'tomat');
    const server = memoryServer();
    // Enhet A er frakoblet: markerer pasta og tomat og lager mandagens middag.
    let logA: InventoryLog = [];
    let outA: InventoryEvent[] = [];
    for (const e of [buy(pasta, 'A1', t(1), 'A'), buy(tomat, 'A2', t(2), 'A'), made(slots[0], c, 'A3', t(30), W)]) {
      logA = applyEvent(logA, e); outA = enqueue(outA, e);
    }
    outA = enqueue(outA, outA[0]); // dobbelttrykk
    expect(outA).toHaveLength(3);
    // Enhet B er på nett og markerer pasta samtidig.
    let logB = applyEvent([], buy(pasta, 'B1', t(1), 'B'));
    await flush(logB, server.transport);
    // A kommer på nett: første forsøk feiler, andre lagres men svaret går tapt, tredje lykkes.
    server.fail();
    let r = await flush(outA, server.transport);
    expect(r.outbox).toHaveLength(3);
    server.loseAck();
    r = await flush(r.outbox, server.transport);
    expect(r.outbox).toHaveLength(3);
    r = await flush(r.outbox, server.transport);
    expect(r.outbox).toHaveLength(0);
    expect(server.log).toHaveLength(4); // A1, A2, A3, B1 — ingen dubletter
    // Begge enheter henter serverloggen og får samme beholdning.
    logA = applyEvents(logA, server.log);
    logB = applyEvents(logB, server.log);
    expect(JSON.stringify(deriveStock(logA))).toBe(JSON.stringify(deriveStock(logB)));
    const used = slotUses(slots[0], c).find((u) => u.ingredient === 'pasta')!.amount;
    expect(deriveStock(logA).total.pasta).toBeCloseTo(pasta.packs * pasta.packSize - used);
  });
});

describe('beholdning: forbruk og rest', () => {
  it('en kjøpt pakke betyr ikke at retten er laget; «laget» trekker fra, angre legger tilbake', () => {
    const slots = [slot(0, 'bolognese')];
    const c = ctx();
    const l = lineOf(slots, 'kjottdeig');
    let log = applyEvent([], buy(l, 'k', t(1)));
    expect(deriveStock(log).total.kjottdeig).toBe(l.packs * l.packSize);
    log = applyEvent(log, made(slots[0], c, 'm', t(10)));
    expect(deriveStock(log).total.kjottdeig ?? 0).toBeCloseTo(l.leftover);
    log = applyEvent(log, made(slots[0], c, 'm-igjen', t(11))); // markert to ganger: ett forbruk
    expect(deriveStock(log).total.kjottdeig ?? 0).toBeCloseTo(l.leftover);
    log = applyEvent(log, { type: 'angre', id: 'u', at: t(12), by: 'A', line: madeLineId(W, 0) });
    expect(deriveStock(log).total.kjottdeig).toBe(l.packs * l.packSize);
  });
  it('bruker det som har ligget lengst først: bekreftet hjemme før kjøp', () => {
    const slots = [slot(0, 'bolognese'), slot(1, 'pastaspinat')];
    const c0 = ctx();
    let log = applyEvent([], { type: 'telling', id: 'h', at: t(0), by: 'A', ingredient: 'pasta', amount: 400 });
    const c = ctx({}, deriveStock(log, { planWeek: W }).total);
    const l = lineOf(slots, 'pasta', c);
    log = applyEvents(log, [buy(l, 'k', t(1)), made(slots[0], c0, 'm0', t(10))]);
    const s = deriveStock(log);
    const used0 = slotUses(slots[0], c0).find((u) => u.ingredient === 'pasta')!.amount;
    expect(s.lots.find((x) => x.kind === 'bekreftet')!.amount).toBeCloseTo(400 - used0);
    expect(s.lots.find((x) => x.kind === 'kjøpt')!.amount).toBe(l.packs * l.packSize);
  });
  it('delt rispose mellom to retter: én linje, ett kjøp, og resten etter begge rettene er den forventede resten', () => {
    const slots = [slot(0, 'lakseris'), slot(2, 'kyllingwok')];
    const c = ctx();
    const b = buildBasket(slots, ['demoA'], c);
    const ris = b.lines.filter((l) => l.ingredient === 'ris');
    expect(ris).toHaveLength(1);
    expect(ris[0].covers).toEqual(['kyllingwok', 'lakseris']);
    let log = applyEvent([], buy(ris[0], 'k', t(1)));
    log = applyEvent(log, made(slots[0], c, 'm0', t(10)));
    expect(deriveStock(log).total.ris).toBeGreaterThan(ris[0].leftover); // halvveis
    log = applyEvent(log, made(slots[1], c, 'm2', t(20)));
    expect(deriveStock(log).total.ris).toBeCloseTo(ris[0].leftover);
    expect(expectedRest(b).find((r) => r.ingredient === 'ris')!.amount).toBeCloseTo(ris[0].leftover);
  });
  it('bekreftet rest krymper ikke samme handel, kan bekreftes én gang og gjelder fra neste uke', () => {
    const slots = [slot(0, 'bolognese'), slot(1, 'pastaspinat')];
    const before = buildBasket(slots, ['demoA'], ctx({}, deriveStock([], { planWeek: W }).total));
    const l = before.lines.find((x) => x.ingredient === 'pasta')!;
    expect(l.leftover).toBeGreaterThan(0);
    const rest = (id: string, at: string): InventoryEvent => ({ type: 'rest', id, at, by: 'A', week: W, ingredient: 'pasta', amount: Math.round(l.leftover) });
    let log = applyEvents([], [buy(l, 'k', t(1)), rest('r1', t(2))]);
    log = applyEvent(log, rest('r2', t(3))); // bekreftet to ganger
    const after = buildBasket(slots, ['demoA'], ctx({}, deriveStock(log, { planWeek: W }).total));
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    // Neste uke: resten er beholdning, én gang, og ukas kjøp telles ikke i tillegg.
    expect(deriveStock(log).total.pasta).toBe(Math.round(l.leftover));
    expect(deriveStock(log, { planWeek: W2 }).total.pasta).toBe(Math.round(l.leftover));
    // Middagene markeres som laget etter at resten er bekreftet: resten trekkes ikke fra en gang til.
    log = applyEvents(log, [made(slots[0], ctx(), 'm0', t(30)), made(slots[1], ctx(), 'm1', t(31))]);
    expect(deriveStock(log).total.pasta).toBe(Math.round(l.leftover));
  });
  it('handlet og laget denne uka endrer ikke ukas handleliste; nye registreringer etter første kjøp gjelder neste handel', () => {
    const slots = [slot(0, 'bolognese'), slot(1, 'pastaspinat')];
    const c = ctx();
    const before = buildBasket(slots, ['demoA'], ctx({}, deriveStock([], { planWeek: W }).total));
    const l = before.lines.find((x) => x.ingredient === 'pasta')!;
    const log = applyEvents([], [buy(l, 'k', t(1)), made(slots[0], c, 'm', t(10)),
      { type: 'telling', id: 'h', at: t(20), by: 'A', ingredient: 'pasta', amount: 2000 }]);
    const stockW = deriveStock(log, { planWeek: W }).total;
    expect(stockW.pasta ?? 0).toBe(0);
    expect(JSON.stringify(buildBasket(slots, ['demoA'], ctx({}, stockW)))).toBe(JSON.stringify(before));
    expect(deriveStock(log, { planWeek: W2 }).total.pasta).toBeGreaterThanOrEqual(2000);
  });
  it('kjøpt og ikke brukt fra forrige uke trekkes fra behovet én gang, på tvers av dagene', () => {
    const prev = lineOf([slot(0, 'bolognese')], 'pasta');
    const log = applyEvent([], buy(prev, 'k', t(1), 'A', 1, W)); // 500 g kjøpt forrige uke, ikke laget
    const stock = deriveStock(log, { planWeek: W2 }).total;
    expect(stock.pasta).toBe(prev.packSize);
    const slots = [slot(0, 'bolognese'), slot(1, 'pastaspinat')];
    const withStock = buildBasket(slots, ['demoA'], ctx({}, stock)).lines.find((x) => x.ingredient === 'pasta')!;
    const without = lineOf(slots, 'pasta');
    expect(withStock.need).toBeCloseTo(without.need - prev.packSize);
  });
  it('matpakke flyttet før middagen er laget: forbruket følger der porsjonen faktisk lages', () => {
    const c = ctx();
    const original = [slot(0, 'bolognese', 1), slot(1, 'pastaspinat')];
    const moved = [slot(0, 'bolognese'), slot(1, 'pastaspinat', 1)];
    const l = lineOf(original, 'pasta');
    let log = applyEvent([], buy(l, 'k', t(1)));
    // Flyttingen skjer før noe er laget: beholdningen er uendret, ingen forbruk er registrert.
    expect(deriveStock(log).total.pasta).toBe(l.packs * l.packSize);
    log = applyEvents(log, [made(moved[0], c, 'm0', t(10)), made(moved[1], c, 'm1', t(20))]);
    const used = [...slotUses(moved[0], c), ...slotUses(moved[1], c)].filter((u) => u.ingredient === 'pasta').reduce((s, u) => s + u.amount, 0);
    expect(deriveStock(log).total.pasta ?? 0).toBeCloseTo(l.packs * l.packSize - used);
    expect(used).toBeCloseTo([...slotUses(original[0], c), ...slotUses(original[1], c)].filter((u) => u.ingredient === 'pasta').reduce((s, u) => s + u.amount, 0)); // like mye pasta totalt
    // Kjøttdeigen følger bolognese, som nå lages uten ekstra porsjon; spinaten følger matpakka.
    const amt = (xs: { ingredient: string; amount: number }[], ing: string) => xs.find((u) => u.ingredient === ing)?.amount ?? 0;
    expect(amt(slotUses(moved[0], c), 'kjottdeig')).toBeLessThan(amt(slotUses(original[0], c), 'kjottdeig'));
    expect(amt(slotUses(moved[1], c), 'spinat')).toBeGreaterThan(amt(slotUses(original[1], c), 'spinat'));
  });
});

describe('«bruk noe vi har hjemme» (hjemme)', () => {
  const home = (id: string, at: string, amount: number, by = 'A', week = W): InventoryEvent =>
    ({ type: 'hjemme', id, at, by, week, line: homeLineId(week, 'pasta'), ingredient: 'pasta', amount });
  const cook = (id: string, at: string, amount: number, week = W): InventoryEvent =>
    ({ type: 'laget', id, at, by: 'A', week, line: madeLineId(week, 0), day: 0, recipeId: 'bolognese', uses: [{ ingredient: 'pasta', amount }] });

  it('registrerer mengden som bekreftet hjemme, og «laget» bruker den opp uten dobbel trekk', () => {
    const tell: InventoryEvent = { type: 'telling', id: 't1', at: t(1), by: 'A', ingredient: 'pasta', amount: 200 };
    const log = applyEvents([], [tell, home('h1', t(2), 300)]);
    expect(deriveStock(log).total.pasta).toBe(500);
    expect(deriveStock(log).lots.find((l) => l.ingredient === 'pasta')).toMatchObject({ kind: 'bekreftet', amount: 500 });
    // Retten bruker 500 g: 200 g fra tellingen og 300 g som var øremerket. Ikke trukket to ganger.
    expect(deriveStock(applyEvent(log, cook('c1', t(3), 500))).total.pasta).toBeUndefined();
  });

  it('to voksne som velger det samme gir én registrering; dobbel levering gir ingen ekstra rad', () => {
    const a = home('h-a', t(2), 300, 'A');
    const b = home('h-b', t(3), 300, 'B');
    const log = applyEvents([], [a, b, a, b]);
    expect(log).toHaveLength(2);
    expect(deriveStock(log).total.pasta).toBe(300);
    expect([...lineStates(log).home.values()]).toEqual([expect.objectContaining({ amount: 300, active: true })]);
    // Ulik mengde: den største gjelder, uavhengig av rekkefølge.
    const c = home('h-c', t(1), 450, 'B');
    expect(deriveStock(applyEvents([], [a, c])).total.pasta).toBe(450);
    expect(deriveStock(applyEvents([], [c, a])).total.pasta).toBe(450);
  });

  it('angre fjerner registreringen; en senere telling erstatter den', () => {
    const log = applyEvents([], [home('h1', t(2), 300), { type: 'angre', id: 'u1', at: t(3), by: 'A', line: homeLineId(W, 'pasta') }]);
    expect(deriveStock(log).total.pasta).toBeUndefined();
    const counted = applyEvents([], [home('h1', t(2), 300), { type: 'telling', id: 't2', at: t(4), by: 'A', ingredient: 'pasta', amount: 100 }]);
    expect(deriveStock(counted).total.pasta).toBe(100);
  });

  it('ukas egen kurv endres ikke (holdes utenfor som ukas andre hendelser), men neste uke ser varen', () => {
    const log = applyEvents([], [home('h1', t(2), 300)]);
    expect(deriveStock(log, { planWeek: W }).total.pasta).toBeUndefined();
    expect(deriveStock(log, { planWeek: W2 }).total.pasta).toBe(300);
  });

  it('avviser ugyldige registreringer', () => {
    expect(applyEvent([], { ...home('h1', t(2), 300), line: 'feil' } as InventoryEvent)).toEqual([]);
    expect(applyEvent([], home('h1', t(2), 0))).toEqual([]);
  });
});
