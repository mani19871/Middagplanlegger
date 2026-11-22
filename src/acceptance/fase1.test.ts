// Akseptansetester for godkjenningskriteriene i fase 1 (docs/plan.md, «Godkjenningskriterier per fase»).
// Se docs/fase1-status.md for hva som er bevist her og hva som ikke lar seg teste uten ekte data.
import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { totalWithOffers } from '../engine/offerTotal';
import {
  alternatives, budgetAnswer, budgetSuggestions, buildBasket, generatePlan, lockedViolations, meetsAbsoluteRequirements, slotUses, swapOptions,
} from '../engine/planner';
import type { PriceStatus, Settings, Slot } from '../engine/types';
import { applyEvent, deriveStock, type InventoryEvent, type InventoryLog } from '../engine/inventory';
import { initialState, migrateState, recordEvent, type AppState } from '../store';
import { CHAINS, ctx, fullWeek, hint, roundTrip, settings, SHOP_DAY, slot } from './util';

const STATUSES: PriceStatus[] = ['ordinær', 'tilbud', 'estimat', 'ukjent'];

/** Innstillinger som dekker ulike deler av demokatalogen, inkludert aktive allergi- og kostkrav. */
const SCENARIOS: [string, Partial<Settings>][] = [
  ['standard', {}],
  ['sju dager', { days: fullWeek() }],
  ['vegetar', { vegetarian: true, days: fullWeek() }],
  ['gluten unngått', { avoid: ['gluten'], days: fullWeek() }],
  ['egg og melk unngått', { avoid: ['egg', 'melk'], days: fullWeek() }],
  ['uten fisk og storfe', { avoidFoods: ['fisk', 'storfe'], days: fullWeek() }],
  ['bare butikk B', { regularStoreId: 'demoB', storeIds: ['demoB'] }],
  ['en voksen', { eaters: [defaultSettings.eaters[0]] }],
];

describe('F1: alle varer har synlig prisstatus', () => {
  it.each(SCENARIOS)('%s: hver handlelinje har gyldig status, og kilde og dato når prisen er kjent', (_n, over) => {
    const c = ctx(over);
    const plan = generatePlan(c);
    expect(plan.length).toBeGreaterThan(0);
    for (const stores of [['demoA'], ['demoB'], ['demoA', 'demoB']]) {
      for (const l of buildBasket(plan, stores, c).lines) {
        expect(STATUSES, `${l.ingredient}`).toContain(l.status);
        if (l.status === 'ukjent') {
          expect(l.costOre, l.ingredient).toBeNull();
          expect(l.productId, l.ingredient).toBeNull();
        } else {
          expect(l.costOre, l.ingredient).toBeGreaterThan(0);
          expect(Number.isInteger(l.costOre), `${l.ingredient} er heltall i øre`).toBe(true);
          expect(l.source, l.ingredient).toBeTruthy();
          expect(l.observed, l.ingredient).toMatch(/^\d{4}-\d{2}-\d{2}/);
          expect(l.storeId, l.ingredient).toBeTruthy();
        }
      }
    }
  });
  it('sammendraget teller estimerte og ukjente linjer riktig, og «komplett» betyr ingen ukjente', () => {
    const c = ctx();
    // linsegryte: røde linser mangler pris i demodata. pastaspinat/spinat er «estimat» i butikk B.
    const b = buildBasket([slot(0, 'linsegryte'), slot(1, 'pastaspinat')], ['demoB'], c);
    expect(b.unknownCount).toBe(b.lines.filter((l) => l.status === 'ukjent').length);
    expect(b.unknownCount).toBeGreaterThan(0);
    expect(b.estimatedCount).toBe(b.lines.filter((l) => l.status === 'estimat').length);
    expect(b.estimatedCount).toBeGreaterThan(0);
    expect(b.complete).toBe(false);
  });
  it('en linje uten pris tas aldri med i summen, og delsummen er summen av de kjente linjene', () => {
    const b = buildBasket([slot(0, 'linsegryte')], ['demoA'], ctx());
    expect(b.totalOre).toBe(b.lines.reduce((s, l) => s + (l.costOre ?? 0), 0));
    expect(b.lines.some((l) => l.status === 'ukjent')).toBe(true);
  });
  // Visning i handleliste og skjermbilder: se prisstatus-ui.test.tsx.
});

describe('F1: to retter som deler én pakning gir én handlelinje', () => {
  const recipes = catalog.recipes;
  const staple = (id: string) => catalog.ingredients.find((i) => i.id === id)?.staple;
  it('for alle par av retter i katalogen: én linje per vare, begge rettene i «covers», og summert behov før avrunding', () => {
    let pairsWithShared = 0;
    for (let i = 0; i < recipes.length; i++) {
      for (let j = i + 1; j < recipes.length; j++) {
        const [a, b] = [recipes[i], recipes[j]];
        const c = ctx();
        const basket = buildBasket([slot(0, a.id), slot(1, b.id)], ['demoA'], c);
        const ids = basket.lines.map((l) => l.ingredient);
        expect(new Set(ids).size, `${a.id}+${b.id}: dobbel linje`).toBe(ids.length);
        const shared = a.lines.filter((l) => !staple(l.ingredient) && b.lines.some((m) => m.ingredient === l.ingredient));
        for (const s of shared) {
          pairsWithShared++;
          const line = basket.lines.find((l) => l.ingredient === s.ingredient)!;
          expect(line.covers, `${a.id}+${b.id}/${s.ingredient}`).toEqual(expect.arrayContaining([a.id, b.id]));
          // Behovet er summen av begge rettene, ikke to avrundede pakker.
          const need = [...slotUses(slot(0, a.id), c), ...slotUses(slot(1, b.id), c)].filter((u) => u.ingredient === s.ingredient).reduce((x, u) => x + u.amount, 0);
          expect(line.need).toBeCloseTo(need);
          if (line.productId) expect(line.packs).toBe(Math.max(1, Math.ceil(need / line.packSize - 1e-9)));
        }
      }
    }
    expect(pairsWithShared).toBeGreaterThan(100); // testen går faktisk gjennom mange delte varer
  });
  it('å dele pakning er aldri dyrere enn to separate kurver', () => {
    const c = ctx();
    for (const [a, b] of [['bolognese', 'pastaspinat'], ['lakseris', 'kyllingwok'], ['ovnstorsk', 'fiskekaker']]) {
      const both = buildBasket([slot(0, a), slot(1, b)], ['demoA'], c);
      const apart = buildBasket([slot(0, a)], ['demoA'], c).totalOre + buildBasket([slot(0, b)], ['demoA'], c).totalOre;
      expect(both.totalOre, `${a}+${b}`).toBeLessThanOrEqual(apart);
    }
  });
});

describe('F1: tre beregninger med samme inndata og prisversjon gir lik kurv, sum og begrunnelse', () => {
  const offers = [hint(), hint({ id: 'o2', ingredient: 'tomat', dealer: 'REMA 1000', priceOre: 900, prePriceOre: 1490, amount: 400 })];
  /** Alt motoren svarer for én uke, som tekst. Begrunnelsen per linje (covers, kilde, dato, rest) er med i kurven. */
  const everything = (over: Partial<Settings>, stock?: Record<string, number>, cat = catalog) => {
    const c = { catalog: cat, settings: settings(over), offers, shopDate: SHOP_DAY, stock };
    const plan = generatePlan(c);
    const alts = alternatives(plan, c);
    const basket = alts.recommended === 'combo' && alts.combo ? alts.combo : alts.regular;
    return JSON.stringify({
      plan, alts, answer: budgetAnswer(basket, c.settings.budgetOre),
      offerTotal: totalWithOffers(basket, offers, SHOP_DAY, c.settings),
      swaps: plan.map((s) => swapOptions(plan, s.day, [c.settings.regularStoreId], c).map((o) => [o.recipe.id, o.deltaOre, o.complete])),
      suggestions: budgetSuggestions(plan, [c.settings.regularStoreId], c).map((g) => [g.day, g.option.recipe.id, g.newTotalOre]),
    });
  };
  it.each(SCENARIOS)('%s: tre kjøringer gir byte-identisk JSON', (_n, over) => {
    const stock = { pasta: 500, lok: 2 };
    const runs = [0, 1, 2].map(() => everything({ ...over, budgetOre: 60_000 }, stock));
    expect(runs[1]).toBe(runs[0]);
    expect(runs[2]).toBe(runs[0]);
  });
  it('lik kurv, sum og begrunnelse når inndata er dype kopier (slik en lagret uke leses tilbake)', () => {
    const c = ctx({ days: fullWeek() }, { offers, shopDate: SHOP_DAY, stock: { pasta: 500 } });
    const plan = generatePlan(c);
    const c2 = roundTrip(c);
    expect(JSON.stringify(buildBasket(plan, ['demoA', 'demoB'], c2))).toBe(JSON.stringify(buildBasket(roundTrip(plan), ['demoA', 'demoB'], c)));
    expect(JSON.stringify(generatePlan(c2))).toBe(JSON.stringify(plan));
  });
  it('rekkefølgen på oppføringene i katalogen påvirker ikke svaret', () => {
    const reversed = {
      ingredients: [...catalog.ingredients].reverse(), recipes: [...catalog.recipes].reverse(),
      products: [...catalog.products].reverse(), prices: [...catalog.prices].reverse(), stores: [...catalog.stores].reverse(),
    };
    for (const [, over] of SCENARIOS) expect(everything(over, undefined, reversed)).toBe(everything(over));
  });
  it('motoren endrer aldri inndata', () => {
    const c = ctx({ days: fullWeek() }, { offers, shopDate: SHOP_DAY, stock: { pasta: 500 } });
    const before = JSON.stringify(c);
    const plan = generatePlan(c);
    const planBefore = JSON.stringify(plan);
    alternatives(plan, c); budgetSuggestions(plan, ['demoA'], c); plan.forEach((s) => swapOptions(plan, s.day, ['demoA'], c));
    expect(JSON.stringify(c)).toBe(before);
    expect(JSON.stringify(plan)).toBe(planBefore);
  });
  it('en endret pris gir et annet svar (testen er følsom, ikke bare konstant)', () => {
    const c = ctx();
    const plan = [slot(0, 'bolognese')];
    const cheaper = { ...catalog, prices: catalog.prices.map((p) => (p.productId === 'pasta500' && p.storeId === 'demoA' ? { ...p, ore: p.ore - 500 } : p)) };
    expect(buildBasket(plan, ['demoA'], { ...c, catalog: cheaper }).totalOre).toBe(buildBasket(plan, ['demoA'], c).totalOre - 500);
  });
});

describe('F1: rettbytte bevarer låste retter', () => {
  /** Det WeekView gjør når brukeren velger en ny middag: bare den dagen får ny rett, og den låses. */
  const swap = (slots: Slot[], day: number, recipeId: string): Slot[] => slots.map((s) => (s.day === day ? { ...s, recipeId, locked: true } : s));
  const locks = (slots: Slot[]) => JSON.stringify(slots.filter((s) => s.locked).sort((a, b) => a.day - b.day));

  it('et bytte rører ingen andre dager, og alle låste retter er uendret', () => {
    const c = ctx({ days: fullWeek() });
    const start = generatePlan(c, [slot(1, 'taco', true), slot(4, 'lakseris', true)]);
    for (const target of start.filter((s) => !s.locked)) {
      const opt = swapOptions(start, target.day, ['demoA'], c)[0];
      const next = swap(start, target.day, opt.recipe.id);
      expect(next.filter((s) => s.day !== target.day)).toEqual(start.filter((s) => s.day !== target.day));
      expect(next.find((s) => s.day === 1)).toEqual(slot(1, 'taco', true));
      expect(next.find((s) => s.day === 4)).toEqual(slot(4, 'lakseris', true));
    }
  });
  it('bytteforslag inneholder aldri en rett som en annen dag (låst eller ikke) allerede bruker', () => {
    const c = ctx({ days: fullWeek() });
    const start = generatePlan(c, [slot(1, 'taco', true), slot(4, 'lakseris', true)]);
    for (const s of start) {
      const others = new Set(start.filter((x) => x.day !== s.day).map((x) => x.recipeId));
      for (const o of swapOptions(start, s.day, ['demoA'], c)) expect(others.has(o.recipe.id)).toBe(false);
    }
  });
  it('«Lag ny uke» etter bytte beholder både byttet og tidligere låste retter, også med tilbud og beholdning', () => {
    const c = ctx({ days: fullWeek(), offerChains: CHAINS }, { offers: [hint()], shopDate: SHOP_DAY, stock: { ris: 1000 } });
    let plan = generatePlan(c, [slot(1, 'taco', true)]);
    const first = swapOptions(plan, 3, ['demoA'], c)[0].recipe.id;
    plan = swap(plan, 3, first);
    const again = generatePlan(c, plan);
    expect(locks(again)).toBe(locks(plan));
    expect(locks(generatePlan(c, again))).toBe(locks(plan)); // stabilt over flere runder
    expect(again).toHaveLength(7);
  });
  it('budsjettforslag foreslår aldri å bytte en låst middag', () => {
    const c = ctx({ days: fullWeek(), budgetOre: 1 });
    const start = generatePlan(c, [slot(0, 'lakseris', true), slot(2, 'ovnstorsk', true)]);
    const lockedDays = new Set(start.filter((s) => s.locked).map((s) => s.day));
    const sugg = budgetSuggestions(start, ['demoA'], c, 10);
    expect(sugg.length).toBeGreaterThan(0);
    for (const g of sugg) expect(lockedDays.has(g.day)).toBe(false);
  });
  it('generatePlan bytter aldri ut en låst rett, uansett dag, tid eller tilbud', () => {
    for (const maxMinutes of [15, 30, 60]) {
      const days = defaultSettings.days.map(() => ({ enabled: true, maxMinutes }));
      const c = ctx({ days, offerChains: CHAINS }, { offers: [hint({ ingredient: 'kylling', priceOre: 1000, prePriceOre: 11990, amount: 600 })], shopDate: SHOP_DAY });
      const plan = generatePlan(c, [slot(0, 'kjottkaker', true)]); // 45 min: gjelder selv når dagens tidsgrense er lavere
      expect(plan.find((s) => s.day === 0)).toEqual(slot(0, 'kjottkaker', true));
    }
  });
});

describe('F1: absolutte krav slår låste retter (regel 4)', () => {
  // WeekView låser hver rett brukeren bytter til. Aktiveres et krav etterpå, slipper generatePlan ut låste retter som
  // bryter det (tidligere hull, rettet). Tidsgrensen er unntatt: en låst rett er et eksplisitt valg om tid.
  const recipe = (id: string) => catalog.recipes.find((r) => r.id === id)!;
  const cases: [string, Partial<Settings>, string][] = [
    ['allergen (gluten)', { avoid: ['gluten'] }, 'bolognese'],
    ['allergen (fisk)', { avoid: ['fisk'] }, 'lakseris'],
    ['vegetar', { vegetarian: true }, 'taco'],
    ['råvare (storfe)', { avoidFoods: ['storfe'] }, 'kjottkaker'],
  ];
  it.each(cases)('%s: den låste retten (%s) slippes ut, og planen får like mange dager uten brudd', (_n, over, id) => {
    const c = ctx({ ...over, days: fullWeek() });
    const prev = [slot(0, id, true), slot(2, 'pastaspinat', false)];
    expect(lockedViolations(prev, c).map((s) => s.recipeId)).toEqual([id]);
    const plan = generatePlan(c, prev);
    expect(plan).toHaveLength(7);
    expect(plan.every((s) => meetsAbsoluteRequirements(recipe(s.recipeId), c))).toBe(true);
    expect(plan.some((s) => s.recipeId === id)).toBe(false);
    expect(buildBasket(plan, ['demoA'], c).lines.filter((l) => l.status === 'ukjent').length).toBe(
      buildBasket(generatePlan(c), ['demoA'], c).lines.filter((l) => l.status === 'ukjent').length); // ingen ukjent pris fra den utslupne retten
  });
  it('låste retter som oppfyller kravene beholdes, også ved siden av en som slippes ut', () => {
    const c = ctx({ avoid: ['gluten'], days: fullWeek() });
    const prev = [slot(0, 'bolognese', true), slot(1, 'lakseris', true), slot(3, 'karri', true)];
    const plan = generatePlan(c, prev);
    expect(plan.find((s) => s.day === 1)).toEqual(slot(1, 'lakseris', true));
    expect(plan.find((s) => s.day === 3)).toEqual(slot(3, 'karri', true));
    expect(lockedViolations(plan, c)).toEqual([]);
  });
  it('tidsgrensen slipper ikke ut en låst rett (eksplisitt valg om tid)', () => {
    const days = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 15 }));
    const c = ctx({ days });
    expect(recipe('kjottkaker').minutes).toBeGreaterThan(15);
    expect(lockedViolations([slot(0, 'kjottkaker', true)], c)).toEqual([]);
    expect(generatePlan(c, [slot(0, 'kjottkaker', true)]).find((s) => s.day === 0)!.recipeId).toBe('kjottkaker');
  });
  it('lockedViolations rapporterer bare låste slots, og er tom uten krav', () => {
    const c = ctx({ avoid: ['gluten'] });
    expect(lockedViolations([slot(0, 'bolognese', false)], c)).toEqual([]); // ikke låst
    expect(lockedViolations([slot(0, 'bolognese', true)], ctx())).toEqual([]);
    expect(lockedViolations([slot(0, 'bolognese', true)], c)).toHaveLength(1);
  });
  it('resultatet er deterministisk', () => {
    const c = ctx({ avoid: ['gluten'], days: fullWeek() });
    const prev = [slot(0, 'bolognese', true)];
    expect(JSON.stringify(generatePlan(c, prev))).toBe(JSON.stringify(generatePlan(c, prev)));
  });
  // lockedViolations gir {day, recipeId, reason}, så UI kan varsle «Låst rett X ble fjernet fordi den bryter …».
  const recipeOf = recipe;
  it('en låst rett med et allergen som nå er unngått blir ikke liggende i planen (var `it.fails`)', () => {
    const c = ctx({ avoid: ['gluten'] });
    const plan = generatePlan(c, [slot(0, 'bolognese', true)]); // bolognese har gluten
    expect(plan.every((s) => !recipeOf(s.recipeId).allergens.includes('gluten'))).toBe(true);
    expect(plan.find((s) => s.day === 0)?.recipeId).not.toBe('bolognese'); // dagen er planlagt på nytt, ikke tom
    expect(lockedViolations([slot(0, 'bolognese', true)], c)).toEqual([{ day: 0, recipeId: 'bolognese', reason: 'allergen' }]);
  });
  it('vegetar: en låst kjøttrett slippes ut med grunn «kost»', () => {
    const c = ctx({ vegetarian: true, days: fullWeek() });
    const prev = [slot(1, 'taco', true), slot(3, 'omelett', true)];
    const plan = generatePlan(c, prev);
    expect(plan.every((s) => recipeOf(s.recipeId).vegetarian)).toBe(true);
    expect(plan.find((s) => s.day === 3)).toEqual(slot(3, 'omelett', true)); // låst og lovlig: beholdes
    expect(lockedViolations(prev, c)).toEqual([{ day: 1, recipeId: 'taco', reason: 'kost' }]);
  });
  it('råvarekrav: en låst fiskerett slippes ut med grunn «råvare»', () => {
    const c = ctx({ avoidFoods: ['fisk'], days: fullWeek() });
    const prev = [slot(2, 'lakseris', true)];
    expect(generatePlan(c, prev).some((s) => s.recipeId === 'lakseris')).toBe(false);
    expect(lockedViolations(prev, c)).toEqual([{ day: 2, recipeId: 'lakseris', reason: 'råvare' }]);
  });
  it('slipp-ut er deterministisk og stabilt over flere runder', () => {
    const c = ctx({ avoid: ['gluten'], days: fullWeek() }, { offers: [hint()], shopDate: SHOP_DAY });
    const prev = [slot(0, 'bolognese', true), slot(4, 'lakseris', true)];
    const a = generatePlan(c, prev);
    expect(JSON.stringify(generatePlan(c, prev))).toBe(JSON.stringify(a));
    expect(JSON.stringify(generatePlan(roundTrip(c), roundTrip(prev)))).toBe(JSON.stringify(a));
    expect(a.find((s) => s.day === 4)).toEqual(slot(4, 'lakseris', true));
    expect(JSON.stringify(generatePlan(c, a))).toBe(JSON.stringify(a));
  });
  it('avgrensing: en kurv med den bruddretten blir aldri «komplett», så summen kåres aldri billigst', () => {
    const c = ctx({ avoid: ['gluten'] });
    const plan = [slot(0, 'bolognese', true)];
    const b = buildBasket(plan, ['demoA', 'demoB'], c);
    expect(b.complete).toBe(false);
    expect(budgetAnswer(b, 100_000_000)).toBe('ufullstendig');
    expect(alternatives(plan, c).combo).toBeNull();
  });
});

describe('F1: en familie kan planlegge, endre, handle offline og komme tilbake på nett uten doble kjøp', () => {
  // Beholdningslogg, utboks og idempotens er bevist i src/engine/inventory.test.ts («endring mens enheten er frakoblet»,
  // «samme kjøp mottatt to ganger …») og src/store.test.ts. Her: hele tilstanden overlever lagring og innlasting
  // (localStorage er JSON), og en gjentatt registrering etter innlasting gir fortsatt én rad.
  const l = buildBasket([slot(0, 'bolognese')], ['demoA'], ctx()).lines.find((x) => x.ingredient === 'pasta')!;
  const buy = (id: string, at: string): InventoryEvent => ({
    type: 'kjøp', id, at, by: 'enhet-test', week: '2026-11-23', line: `kjøp|2026-11-23|demoA|pasta|${l.productId}`, ingredient: 'pasta',
    productId: l.productId, storeId: l.storeId, unit: l.unit, packs: l.packs, packSize: l.packSize,
  });
  it('plan, endring, kjøp: lagres som JSON, leses inn igjen og gir identisk tilstand', () => {
    let s: AppState = { ...initialState, slots: generatePlan(ctx()), approved: true };
    s = { ...s, slots: s.slots.map((x, i) => (i === 1 ? { ...x, locked: true } : x)) }; // endring offline
    s = recordEvent(s, buy('k1', '2026-11-23T10:00:00.000Z'));
    const loaded = migrateState(roundTrip(s));
    expect(loaded).toEqual(s);
    expect(migrateState(roundTrip(loaded))).toEqual(loaded); // innlasting er idempotent
  });
  it('samme kjøp registrert to ganger (dobbelttrykk og etter innlasting) gir én rad i logg og utboks', () => {
    let s = recordEvent(initialState, buy('k1', '2026-11-23T10:00:00.000Z'));
    s = recordEvent(s, buy('k1', '2026-11-23T10:00:00.000Z'));
    s = recordEvent(migrateState(roundTrip(s)), buy('k1', '2026-11-23T10:00:00.000Z'));
    expect(s.inventory).toHaveLength(1);
    expect(s.outbox).toHaveLength(1);
  });
  it('rekkefølge og dubletter i mottatte hendelser påvirker ikke beholdningen (tilfeldig, men fast sekvens)', () => {
    const events: InventoryEvent[] = [
      buy('k1', '2026-11-23T10:00:00.000Z'), { ...buy('k2', '2026-11-23T10:00:01.000Z'), by: 'enhet-b' } as InventoryEvent,
      { type: 'telling', id: 't1', at: '2026-11-23T09:00:00.000Z', by: 'enhet-a', ingredient: 'ris', amount: 300 },
      { type: 'rest', id: 'r1', at: '2026-11-24T09:00:00.000Z', by: 'enhet-a', week: '2026-11-23', ingredient: 'pasta', amount: 100 },
    ];
    const empty: InventoryLog = [];
    const reference = JSON.stringify(deriveStock(events.reduce(applyEvent, empty)));
    let seed = 42;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let run = 0; run < 50; run++) {
      const deliveries = [...events, ...events.filter(() => rnd() < 0.5)].sort(() => rnd() - 0.5);
      const log = deliveries.reduce(applyEvent, empty);
      expect(JSON.stringify(deriveStock(log))).toBe(reference);
    }
  });
});
