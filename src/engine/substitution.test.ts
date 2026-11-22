import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { budgetAnswer, buildBasket, type Ctx } from './planner';
import { applyEvent, deriveStock, lineStates, purchaseLineId, type InventoryEvent, type InventoryLog } from './inventory';
import {
  activeChanges, activePin, addVersion, applyChange, applyChanges, canMarkBought, changeBlocked, changeLineId, findSubstitutes,
  keepVersion, latestVersion, needsApprovalVersion, notFoundEvent, notFoundOptions, priceDrift, snapshot, substituteEvent,
  undoChangeEvent, versionsFor, type AdjustedLine, type ListChange, type PlanHistory,
} from './substitution';
import type { Catalog, PriceObs, Product, Settings, Slot } from './types';

const W = '2026-11-23';
const t = (n: number) => `2026-11-23T10:${String(n).padStart(2, '0')}:00.000Z`;
const m = (n: number, by = 'A') => ({ id: `e${n}`, at: t(n), by });

// Testkatalog: demokatalogen pluss flere pastaprodukter i Demo Nærbutikk (demoA).
const P = (id: string, name: string, size: number, allergens: Product['allergens'], allergenKnown = true): Product =>
  ({ id, ingredient: 'pasta', name, size, allergens, allergenKnown });
const obs = (productId: string, ore: number, storeId = 'demoA', over: Partial<PriceObs> = {}): PriceObs =>
  ({ productId, storeId, ore, status: 'ordinær', source: 'Test', observed: '2026-11-17', ...over });
const testCatalog: Catalog = {
  ...catalog,
  products: [
    ...catalog.products,
    P('pastaFull', 'Fullkornspasta 1 kg', 1000, ['gluten']),
    P('pastaGF', 'Glutenfri pasta 400 g', 400, []),
    P('pastaEgg', 'Eggpasta 500 g', 500, ['gluten', 'egg']),
    P('pastaFersk', 'Fersk pasta 250 g', 250, ['gluten', 'egg'], false), // sammensatt, innhold ikke avklart
    P('pastaB', 'Pasta bare i Storsenter 500 g', 500, ['gluten']),
  ],
  prices: [...catalog.prices, obs('pastaFull', 4990), obs('pastaGF', 3490), obs('pastaEgg', 2590), obs('pastaFersk', 3990), obs('pastaB', 1000, 'demoB')],
};
const ctx = (over: Partial<Settings> = {}, extra: Partial<Ctx> = {}): Ctx =>
  ({ catalog: testCatalog, settings: { ...defaultSettings, ...over }, shopDate: W, ...extra });
const slot = (day: number, recipeId: string, locked = false): Slot => ({ day, recipeId, locked });
const pastaWeek = [slot(0, 'bolognese'), slot(1, 'pastaspinat'), slot(2, 'karri')];

function setup(log: ListChange[] = [], c = ctx(), slots = pastaWeek) {
  const base = buildBasket(slots, ['demoA'], c);
  const changes = activeChanges(log, W);
  const adj = applyChanges(base, changes, W, c);
  const line = (ing: string) => adj.lines.find((l) => l.ingredient === ing) as AdjustedLine;
  return { base, changes, adj, line, c, slots };
}

describe('utsolgt: erstatning', () => {
  it('gir godkjente erstatninger i samme butikk med pakningsregning og prisforskjell på hele kurven', () => {
    const { base, changes, adj, line, c } = setup();
    const pasta = line('pasta');
    expect(pasta.productId).toBe('pasta500');
    expect(pasta.packs).toBe(2); // 640 g → 2 × 500 g à 22,90
    const s = findSubstitutes(base, changes, pasta, W, c);
    expect(s.options.map((o) => o.product.id)).toEqual(['pastaFull', 'pastaEgg', 'pastaGF', 'pastaFersk']);
    const full = s.options[0];
    expect(full.packs).toBe(1); // 640 g → én pakke på 1 kg
    expect(full.costOre).toBe(4990);
    expect(full.leftover).toBeCloseTo(360);
    expect(full.lineDeltaOre).toBe(4990 - 2 * 2290);
    expect(full.deltaOre).toBe(full.newTotalOre - adj.totalOre);
    expect(full.deltaOre).toBe(410);
    const gf = s.options.find((o) => o.product.id === 'pastaGF')!;
    expect(gf.packs).toBe(2); // 640 g → 2 × 400 g
    expect(gf.costOre).toBe(6980);
    const fersk = s.options.find((o) => o.product.id === 'pastaFersk')!;
    expect(fersk.packs).toBe(3); // 640 g → 3 × 250 g
    expect(fersk.allergenUnknown).toBe(true);
    // Eggpasta: egg er ikke merket på rettene den dekker, så det vises som advarsel.
    expect(s.options.find((o) => o.product.id === 'pastaEgg')!.newAllergens).toEqual(['egg']);
    // Det utsolgte produktet og produkter uten pris i butikken er ikke erstatninger.
    expect(s.rejected).toEqual(expect.arrayContaining([
      expect.objectContaining({ product: expect.objectContaining({ id: 'pasta500' }), reason: 'utsolgt' }),
      expect.objectContaining({ product: expect.objectContaining({ id: 'pastaB' }), reason: 'ingen-pris' }),
    ]));
  });

  it('valgt erstatning gir ny kurv og sum; linja beholder opprinnelig produkt og pris', () => {
    const { line } = setup();
    const e = substituteEvent(line('pasta'), W, 'pastaFull', m(1));
    const { adj, base } = setup([e]);
    const pasta = adj.lines.find((l) => l.ingredient === 'pasta')!;
    expect(pasta.productId).toBe('pastaFull');
    expect(pasta.packs).toBe(1);
    expect(pasta.costOre).toBe(4990);
    expect(pasta.change).toMatchObject({ type: 'erstatt', soldOut: ['pasta500'], original: { productId: 'pasta500', packs: 2, costOre: 4580 } });
    expect(adj.totalOre).toBe(base.totalOre - 4580 + 4990);
    expect(base.lines.find((l) => l.ingredient === 'pasta')!.productId).toBe('pasta500'); // basiskurven er uendret
  });

  it('erstatning som bryter aktivt allergifilter avvises', () => {
    const c = ctx({ avoid: ['egg'] });
    const { base, changes, line } = setup([], c);
    const s = findSubstitutes(base, changes, line('pasta'), W, c);
    expect(s.options.map((o) => o.product.id)).toEqual(['pastaFull', 'pastaGF']);
    expect(s.rejected.find((r) => r.product.id === 'pastaEgg')!.reason).toBe('allergifilter');
    expect(s.rejected.find((r) => r.product.id === 'pastaFersk')!.reason).toBe('allergifilter');
    // Selv om noen har lagret valget før filteret ble slått på, blir det aldri levert.
    const forced: ListChange = { ...(substituteEvent(line('pasta'), W, 'pastaFull', m(1)) as Extract<ListChange, { type: 'erstatt' }>), productId: 'pastaEgg' };
    const adj = applyChanges(base, activeChanges([forced], W), W, c);
    const pasta = adj.lines.find((l) => l.ingredient === 'pasta')!;
    expect(pasta.productId).toBeNull();
    expect(pasta.costOre).toBeNull();
    expect(pasta.change!.problem).toBe('erstatning-ugyldig');
    expect(adj.complete).toBe(false);
  });

  it('uavklart allergenstatus (sammensatt vare) godkjennes aldri ved aktivt filter', () => {
    const c = ctx({ avoid: ['sesam'] });
    const { base, changes, line } = setup([], c);
    const s = findSubstitutes(base, changes, line('pasta'), W, c);
    expect(s.options.map((o) => o.product.id)).not.toContain('pastaFersk');
    expect(s.rejected.find((r) => r.product.id === 'pastaFersk')!.reason).toBe('uavklart-allergen');
    expect(s.options.map((o) => o.product.id)).toEqual(['pastaFull', 'pastaEgg', 'pastaGF']);
  });

  it('en erstatning som også er utsolgt avvises, og valget kan byttes på samme linje', () => {
    const first = substituteEvent(setup().line('pasta'), W, 'pastaFull', m(1));
    const s1 = setup([first]);
    const now = s1.line('pasta');
    expect(now.lineKey).toBe(changeLineId(W, 'demoA', 'pasta', 'pasta500')); // samme linje som før erstatningen
    const subs = findSubstitutes(s1.base, s1.changes, now, W, s1.c);
    expect(subs.options.map((o) => o.product.id)).not.toContain('pastaFull');
    expect(subs.rejected.filter((r) => r.reason === 'utsolgt').map((r) => r.product.id)).toEqual(['pasta500', 'pastaFull']);
    const second = substituteEvent(now, W, 'pastaGF', m(2));
    expect(second).toMatchObject({ fromProductId: 'pasta500', soldOut: ['pasta500', 'pastaFull'] });
    const s2 = setup([first, second]);
    expect(s2.line('pasta').productId).toBe('pastaGF');
    expect(s2.line('pasta').change!.original.productId).toBe('pasta500');
  });
});

describe('fant ikke', () => {
  it('gir ukjent pris og berørte retter, og alternativer med ny kurv og sum', () => {
    const { base, changes, line, c, adj } = setup();
    const plan = notFoundOptions(pastaWeek, ['demoA'], changes, line('pasta'), W, c);
    expect(plan.affected.map((a) => a.recipeId)).toEqual(['bolognese', 'pastaspinat']);
    expect(plan.reference).toEqual({ totalOre: adj.totalOre, complete: true });
    expect(plan.notFound.complete).toBe(false); // varen uten pris: ufullstendig, kan ikke bekreftes
    const skip = plan.options.find((o) => o.kind === 'hopp-over')!;
    expect(skip.totalOre).toBe(adj.totalOre - 4580);
    expect(skip.deltaOre).toBe(-4580);
    expect(plan.options.find((o) => o.kind === 'bruk-hjemme')!.totalOre).toBe(skip.totalOre);
    // Bytte én av to pastaretter løser ikke mangelen: den andre trenger fortsatt pasta.
    const swaps = plan.options.filter((o) => o.kind === 'bytt-rett');
    expect(swaps.length).toBeGreaterThan(0);
    for (const o of swaps) {
      expect(o.complete).toBe(false);
      expect(o.deltaOre).toBeNull();
      expect(testCatalog.recipes.find((r) => r.id === o.recipeId)!.lines.some((l) => l.ingredient === 'pasta')).toBe(false);
    }
    // Den uavklarte linja lagres som hendelse og gjør kurven ufullstendig.
    const e = notFoundEvent(line('pasta'), W, 'uavklart', m(1));
    const after = applyChanges(base, activeChanges([e], W), W, c);
    expect(after.complete).toBe(false);
    expect(budgetAnswer(after, 10_000_000)).toBe('ufullstendig');
    expect(after.lines.find((l) => l.ingredient === 'pasta')!.costOre).toBeNull();
  });

  it('ukjent pris vinner aldri: komplette alternativer rangeres først og ufullstendige får ingen prisforskjell', () => {
    // Kokosmelk dekker bare karri. Linsegryte har ukjent pris i Demo Nærbutikk (se planner.test.ts).
    const { changes, line, c } = setup();
    const plan = notFoundOptions(pastaWeek, ['demoA'], changes, line('kokosmelk'), W, c, null, 50);
    expect(plan.affected.map((a) => a.recipeId)).toEqual(['karri']);
    const firstIncomplete = plan.options.findIndex((o) => !o.complete);
    const lastComplete = plan.options.map((o) => o.complete).lastIndexOf(true);
    expect(firstIncomplete === -1 || lastComplete < firstIncomplete).toBe(true);
    for (const o of plan.options) if (!o.complete) expect(o.deltaOre).toBeNull();
    const lins = plan.options.find((o) => o.recipeId === 'linsegryte');
    if (lins) { expect(lins.complete).toBe(false); expect(lins.deltaOre).toBeNull(); }
    expect(plan.options.some((o) => o.kind === 'bytt-rett' && o.complete)).toBe(true);
  });

  it('låste retter byttes ikke, men vises som berørt', () => {
    const slots = [slot(0, 'bolognese', true), slot(1, 'karri')];
    const { changes, line, c } = setup([], ctx(), slots);
    const plan = notFoundOptions(slots, ['demoA'], changes, line('kjottdeig'), W, c);
    expect(plan.affected).toEqual([{ day: 0, recipeId: 'bolognese', name: 'Spagetti bolognese', locked: true }]);
    expect(plan.options.filter((o) => o.kind === 'bytt-rett')).toEqual([]);
  });

  it('hopp over tar linja ut av handelen uten å lage kjøp eller beholdning', () => {
    const { base, line, c } = setup();
    const e = notFoundEvent(line('pasta'), W, 'hopp-over', m(1));
    const adj = applyChanges(base, activeChanges([e], W), W, c);
    expect(adj.lines.find((l) => l.ingredient === 'pasta')).toBeUndefined();
    expect(adj.skipped.map((l) => l.ingredient)).toEqual(['pasta']);
    expect(adj.complete).toBe(true);
    expect(adj.totalOre).toBe(base.totalOre - 4580);
  });

  it('en linje meldt «fant ikke» kan ikke markeres som handlet; angre gir motorens linje tilbake', () => {
    const { base, line, c } = setup();
    const e = notFoundEvent(line('pasta'), W, 'uavklart', m(1));
    const adj = applyChanges(base, activeChanges([e], W), W, c);
    const pasta = adj.lines.find((l) => l.ingredient === 'pasta')!;
    expect(canMarkBought(pasta)).toBe(false);
    const undo = undoChangeEvent(pasta, W, m(2));
    const back = applyChanges(base, activeChanges([e, undo], W), W, c);
    expect(back.lines.find((l) => l.ingredient === 'pasta')!.productId).toBe('pasta500');
    expect(back.totalOre).toBe(base.totalOre);
  });
});

describe('beholdning og idempotens', () => {
  const purchase = (l: AdjustedLine, id: string, at: string, by = 'A'): InventoryEvent => ({
    type: 'kjøp', id, at, by, week: W, line: purchaseLineId(W, l.storeId, l.ingredient, l.productId), ingredient: l.ingredient,
    productId: l.productId, storeId: l.storeId, packs: l.packs, packSize: l.packSize, unit: l.unit,
  });

  it('samme endring mottatt to ganger gir én rad; ankomstrekkefølge spiller ingen rolle', () => {
    const l = setup().line('pasta');
    const a = substituteEvent(l, W, 'pastaFull', m(1, 'A'));
    const b = substituteEvent(l, W, 'pastaGF', m(2, 'B'));
    const log1 = [a, a, b, b].reduce(applyChange, [] as ListChange[]);
    const log2 = [b, a, b, a].reduce(applyChange, [] as ListChange[]);
    expect(log1).toHaveLength(2);
    expect(JSON.stringify(log1)).toBe(JSON.stringify(log2));
    expect(applyChange(log1, a)).toBe(log1); // samme objekt tilbake
    expect((activeChanges(log2, W).get(l.lineKey) as Extract<ListChange, { type: 'erstatt' }>).productId).toBe('pastaGF'); // siste valg gjelder
    // Ugyldige hendelser avvises.
    expect(applyChange([], { ...a, line: 'feil' })).toEqual([]);
    expect(applyChange([], { ...(a as Extract<ListChange, { type: 'erstatt' }>), productId: 'pasta500' })).toEqual([]);
  });

  it('erstattet produkt som markeres handlet kjøpes som det nye produktet, én gang selv om to voksne markerer', () => {
    const e = substituteEvent(setup().line('pasta'), W, 'pastaFull', m(1));
    const pasta = setup([e]).line('pasta');
    let log: InventoryLog = [];
    log = applyEvent(log, purchase(pasta, 'k1', t(5), 'A'));
    log = applyEvent(log, purchase(pasta, 'k2', t(6), 'B'));
    log = applyEvent(log, purchase(pasta, 'k1', t(5), 'A'));
    const p = [...lineStates(log).purchases.values()];
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ productId: 'pastaFull', packs: 1, packSize: 1000, status: 'kjøpt' });
    expect(deriveStock(log).total.pasta).toBe(1000);
    // Linja er nå handlet: den kan ikke meldes utsolgt eller angres uten å angre kjøpet først.
    expect(changeBlocked(pasta, W, lineStates(log).purchases)).toBe(true);
  });

  it('en linje der det opprinnelige produktet alt er handlet kan ikke erstattes (ingen doble kjøp)', () => {
    const { line } = setup();
    const log = applyEvent([], purchase(line('pasta'), 'k1', t(5)));
    expect(changeBlocked(line('pasta'), W, lineStates(log).purchases)).toBe(true);
    expect(changeBlocked(line('tomat'), W, lineStates(log).purchases)).toBe(false);
    const undone = applyEvent(log, { type: 'angre', id: 'u1', at: t(6), by: 'A', line: purchaseLineId(W, 'demoA', 'pasta', 'pasta500') });
    expect(changeBlocked(line('pasta'), W, lineStates(undone).purchases)).toBe(false);
  });

  it('er deterministisk', () => {
    const e = substituteEvent(setup().line('pasta'), W, 'pastaGF', m(1));
    const run = () => {
      const s = setup([e]);
      return JSON.stringify([s.adj, findSubstitutes(s.base, s.changes, s.line('tomat'), W, s.c), notFoundOptions(pastaWeek, ['demoA'], s.changes, s.line('kokosmelk'), W, s.c)]);
    };
    expect(run()).toBe(run());
  });
});

describe('historikk og planversjoner', () => {
  // Laks i Demo Nærbutikk er demotilbud til 23.11. og har ingen annen pris der.
  const fishWeek = [slot(0, 'lakseris'), slot(1, 'bolognese')];
  const v = (c: Ctx, id: string, at: string, reason: Parameters<typeof snapshot>[2]['reason'], log: ListChange[] = [], pin: PlanHistory[number] | null = null) => {
    const adj = applyChanges(buildBasket(fishWeek, ['demoA'], c), activeChanges(log, W), W, c, pin);
    return snapshot(adj, fishWeek, { id, at, by: 'A', week: W, reason }, c);
  };

  it('utløpt tilbud: opprinnelig anslag står i historikken, nytt anslag vises som avvik til brukeren velger', () => {
    // Demokatalogens laksetilbud er satt til 2099; her utløper det 23.11.
    const expiring: Catalog = { ...testCatalog, prices: testCatalog.prices.map((p) => (p.productId === 'laks400' && p.storeId === 'demoA' ? { ...p, validUntil: '2026-11-23' } : p)) };
    const before = ctx({}, { catalog: expiring, shopDate: '2026-11-23' });
    const after = ctx({}, { catalog: expiring, shopDate: '2026-11-24' });
    const v1 = v(before, 'v1', t(1), 'godkjent');
    const laks1 = v1.lines.find((l) => l.ingredient === 'laks')!;
    expect(laks1).toMatchObject({ status: 'tilbud', costOre: 9990, validUntil: '2026-11-23' });
    let h = addVersion([], v1);
    // Neste dag: tilbudet er utløpt og blir aldri dagens pris.
    const now = applyChanges(buildBasket(fishWeek, ['demoA'], after), new Map(), W, after);
    expect(now.lines.find((l) => l.ingredient === 'laks')!.costOre).toBeNull();
    const drift = priceDrift(v1, now, after);
    expect(drift).toEqual([expect.objectContaining({
      ingredient: 'laks', reason: 'utløpt-tilbud',
      before: expect.objectContaining({ costOre: 9990, status: 'tilbud', validUntil: '2026-11-23' }),
      after: expect.objectContaining({ costOre: null, status: 'ukjent' }),
    })]);
    // Brukeren velger «Bruk nye priser»: ny versjon, den gamle er uendret.
    const v2 = snapshot(now, fishWeek, { id: 'v2', at: t(2), by: 'A', week: W, reason: 'nye-priser' }, after);
    h = addVersion(h, v2);
    expect(versionsFor(h, W).map((x) => x.id)).toEqual(['v1', 'v2']);
    expect(h[0].lines.find((l) => l.ingredient === 'laks')!.costOre).toBe(9990);
    expect(h[0].totalOre).toBe(v1.totalOre);
    expect(v2.complete).toBe(false);
    expect(priceDrift(v2, now, after)).toEqual([]);
    expect(addVersion(h, v2)).toBe(h); // samme versjon to ganger gir én rad
  });

  it('ny prisimport endrer ikke en godkjent liste: produktet holdes fast til brukeren velger nye priser', () => {
    // Bolognese bruker 320 g kjøttdeig (én 400 g-pakke). Ny import: 800 g-pakken blir billigere enn 400 g-pakken.
    const v1 = v(ctx(), 'v1', t(1), 'godkjent');
    expect(v1.lines.find((l) => l.ingredient === 'kjottdeig')).toMatchObject({ productId: 'kd400', packs: 1, costOre: 5490 });
    const cheaper: Catalog = { ...testCatalog, prices: testCatalog.prices.map((o) => (o.productId === 'kd800' && o.storeId === 'demoA' ? { ...o, ore: 4990, observed: '2026-11-22' } : o)) };
    const c2 = ctx({}, { catalog: cheaper });
    const h = addVersion([], v1);
    const pin = activePin(h, W, fishWeek, true);
    expect(pin?.id).toBe('v1');
    const base = buildBasket(fishWeek, ['demoA'], c2);
    expect(base.lines.find((l) => l.ingredient === 'kjottdeig')!.productId).toBe('kd800');
    const shown = applyChanges(base, new Map(), W, c2, pin);
    expect(shown.lines.find((l) => l.ingredient === 'kjottdeig')).toMatchObject({ productId: 'kd400', packs: 1, costOre: 5490, pinned: true });
    const drift = priceDrift(v1, applyChanges(base, new Map(), W, c2), c2);
    expect(drift.map((d) => [d.ingredient, d.reason])).toEqual([['kjottdeig', 'annet-produkt']]);
    // «Behold godkjent liste»: avviket er sett og vises ikke igjen; listen er fortsatt den godkjente.
    const kept = keepVersion(v1, drift, { id: 'v2', at: t(2), by: 'A' });
    expect(kept.lines).toEqual(v1.lines);
    expect(priceDrift(kept, applyChanges(base, new Map(), W, c2), c2)).toEqual([]);
    // Uten godkjenning eller med andre middager holdes ingenting fast.
    expect(activePin(h, W, fishWeek, false)).toBeNull();
    expect(activePin(h, W, [slot(0, 'karri')], true)).toBeNull();
    expect(needsApprovalVersion(h, W, [slot(0, 'karri')], true)).toBe(true);
    expect(needsApprovalVersion(h, W, fishWeek, true)).toBe(false);
  });

  it('en erstatning lagres som ny versjon med årsak og opprinnelig pris', () => {
    const c = ctx();
    const v1 = v(c, 'v1', t(1), 'godkjent');
    const h1 = addVersion([], v1);
    const pin = latestVersion(h1, W);
    const before = applyChanges(buildBasket(fishWeek, ['demoA'], c), new Map(), W, c, pin);
    const e = substituteEvent(before.lines.find((l) => l.ingredient === 'pasta')!, W, 'pastaFull', m(3));
    const v2 = v(c, 'v2', t(3), 'erstatning', [e], pin);
    const h2 = addVersion(h1, v2);
    const line = latestVersion(h2, W)!.lines.find((l) => l.ingredient === 'pasta')!;
    expect(line).toMatchObject({ productId: 'pastaFull', change: 'erstatt', original: { productId: 'pasta500', costOre: 2290 } });
    expect(h2[0].lines.find((l) => l.ingredient === 'pasta')!.productId).toBe('pasta500');
    expect(v2.reason).toBe('erstatning');
    // Når erstatningsversjonen er den godkjente listen, holdes motorens produkt fast og valget ligger oppå: linja er
    // fortsatt merket som erstattet, med samme linjenøkkel, og angre gir det opprinnelige produktet tilbake.
    const pin2 = activePin(h2, W, fishWeek, true)!;
    const shown = applyChanges(buildBasket(fishWeek, ['demoA'], c), activeChanges([e], W), W, c, pin2).lines.find((l) => l.ingredient === 'pasta')!;
    expect(shown).toMatchObject({ productId: 'pastaFull', lineKey: changeLineId(W, 'demoA', 'pasta', 'pasta500'), change: { type: 'erstatt' } });
    const undone = applyChanges(buildBasket(fishWeek, ['demoA'], c), activeChanges([e, undoChangeEvent(shown, W, m(4))], W), W, c, pin2);
    expect(undone.lines.find((l) => l.ingredient === 'pasta')!.productId).toBe('pasta500');
  });
});
