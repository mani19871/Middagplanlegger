import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { alternatives, budgetAnswer, buildBasket, generatePlan, swapOptions } from './planner';
import type { Basket, Catalog, PriceObs, Settings, Slot } from './types';
import type { Ctx } from './planner';
import { MAX_PRICE_AGE_DAYS } from './prices';
import { priceIn } from './substitution';
import { miniCatalog, miniSettings } from '../acceptance/util';
import { recipeDeals, type OfferHint } from './deals';
import { totalWithOffers } from './offerTotal';
import { cookNow } from './cookNow';
import { applyEvents, isValidEvent, type InventoryEvent } from './inventory';
import { cleanStapleName, customStapleId, isValidStaples, stapleStatus, type StapleInfo } from './staples';
import { classifyHousehold, householdCatch, householdTotal, householdOfferKey, parseHouseholdRules, type HouseholdOfferIn, type HouseholdRuleSet } from './household';
import { isStale, priceAgeDays, priceReferenceDate } from './prices';
import { stapleListFacts } from '../sync/list';
import { stapleChoices } from '../data/staples';
import rawRules from '../data/household-rules.json';

const ctx = (over: Partial<Settings> = {}) => ({ catalog, settings: { ...defaultSettings, ...over } });
const slot = (day: number, recipeId: string, locked = false): Slot => ({ day, recipeId, locked });

describe('planmotor', () => {
  it('to retter som deler pasta gir én handlelinje', () => {
    const b = buildBasket([slot(0, 'bolognese'), slot(1, 'pastaspinat')], ['demoA'], ctx());
    const pasta = b.lines.filter((l) => l.ingredient === 'pasta');
    expect(pasta).toHaveLength(1);
    expect(pasta[0].covers).toEqual(['bolognese', 'pastaspinat']);
    expect(pasta[0].packs).toBe(2); // 3,2 porsjoner / 4 × 400 g × 2 = 640 g → 2 × 500 g
  });
  it('er deterministisk', () => {
    const c = ctx();
    expect(JSON.stringify(generatePlan(c))).toBe(JSON.stringify(generatePlan(c)));
    const p = generatePlan(c);
    expect(JSON.stringify(alternatives(p, c))).toBe(JSON.stringify(alternatives(p, c)));
  });
  it('trekker fra beholdning én gang', () => {
    const b = buildBasket([slot(0, 'bolognese'), slot(1, 'pastaspinat')], ['demoA'], ctx({ pantry: { pasta: 400 } }));
    expect(b.lines.find((l) => l.ingredient === 'pasta')!.packs).toBe(1);
  });
  it('ukjent pris gir ufullstendig svar og vinner aldri sammenligningen', () => {
    const slots = [slot(0, 'linsegryte')];
    const b = buildBasket(slots, ['demoA'], ctx());
    expect(b.complete).toBe(false);
    expect(budgetAnswer(b, 10_000_000)).toBe('ufullstendig');
    const alt = alternatives([slot(0, 'bolognese')], ctx());
    expect(alt.combo === null || alt.combo.complete).toBe(true);
  });
  it('en pris med utløpt gyldighet (utløpt tilbud) brukes aldri på handledagen', () => {
    // Demokatalogens laksetilbud er satt til 2099; her gjøres det om til et tilbud som utløper 23.11. (ingen annen pris i butikken).
    const expiring = { ...catalog, prices: catalog.prices.map((p) => (p.productId === 'laks400' && p.storeId === 'demoA' ? { ...p, validUntil: '2026-11-23' } : p)) };
    const laks = (shopDate: string) => buildBasket([slot(0, 'lakseris')], ['demoA'], { ...ctx(), catalog: expiring, shopDate }).lines.find((l) => l.ingredient === 'laks')!;
    expect(laks('2026-11-23')).toMatchObject({ status: 'tilbud', costOre: 9990 });
    expect(laks('2026-11-24')).toMatchObject({ status: 'ukjent', costOre: null });
  });
  it('låste retter beholdes ved ny generering', () => {
    const c = ctx();
    const locked = [slot(2, 'taco', true)];
    const plan = generatePlan(c, locked);
    expect(plan.find((s) => s.day === 2)!.recipeId).toBe('taco');
    expect(plan).toHaveLength(5);
  });
  it('allergifilter fjerner retter, og uavklart produktstatus godkjennes aldri', () => {
    const c = ctx({ avoid: ['gluten'] });
    const plan = generatePlan(c);
    for (const s of plan) expect(catalog.recipes.find((r) => r.id === s.recipeId)!.allergens).not.toContain('gluten');
    const b = buildBasket([slot(0, 'fiskekaker')], ['demoA', 'demoB'], ctx({ avoid: ['egg'] }));
    expect(b.lines.find((l) => l.ingredient === 'fiskekaker')!.status).toBe('ukjent');
  });
  it('anbefaler én butikk når besparelsen er under terskelen', () => {
    const slots = [slot(0, 'ovnstorsk')];
    const hi = ctx({ regularStoreId: 'demoB', extraStoreThresholdOre: 10_000_000 });
    const altHi = alternatives(slots, hi);
    expect(altHi.combo!.stops).toBe(2);
    expect(altHi.recommended).toBe('regular');
    const lo = ctx({ regularStoreId: 'demoB', extraStoreThresholdOre: 0 });
    expect(alternatives(slots, lo).recommended).toBe('combo');
  });
  it('bytte-forskjell regnes på hele kurven', () => {
    const c = ctx();
    const slots = [slot(0, 'bolognese'), slot(1, 'taco')];
    const opts = swapOptions(slots, 1, ['demoA'], c);
    const cur = buildBasket(slots, ['demoA'], c).totalOre;
    const o = opts.find((x) => x.recipe.id === 'pastaspinat')!;
    const direct = buildBasket([slot(0, 'bolognese'), slot(1, 'pastaspinat')], ['demoA'], c).totalOre;
    expect(cur + o.deltaOre).toBe(direct);
  });
  it('reserverte ekstra porsjoner øker behovet', () => {
    const plain = buildBasket([slot(0, 'bolognese')], ['demoA'], ctx());
    const extra = buildBasket([{ ...slot(0, 'bolognese'), extra: 4 }], ['demoA'], ctx());
    const n = (b: typeof plain) => b.lines.find((l) => l.ingredient === 'pasta')!.need;
    expect(n(extra)).toBeCloseTo(n(plain) * (3.2 + 4) / 3.2);
  });
  it('maks to retter med samme protein per uke', () => {
    const days = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 60 }));
    const c = ctx({ days });
    const plan = generatePlan(c);
    expect(plan).toHaveLength(7);
    const counts = new Map<string, number>();
    for (const s of plan) {
      const p = catalog.recipes.find((r) => r.id === s.recipeId)!.protein;
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(2);
  });
});

describe('kostmodell', () => {
  it('råvarekrav filtrerer bort retter med taggen, og taggene utledes fra ingrediensene', async () => {
    const { recipeTags } = await import('./planner');
    const days = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 60 }));
    const c = ctx({ days, avoidFoods: ['storfe', 'fisk'] });
    for (const s of generatePlan(c)) {
      const tags = recipeTags(catalog.recipes.find((r) => r.id === s.recipeId)!, catalog.ingredients);
      expect(tags.has('storfe')).toBe(false);
      expect(tags.has('fisk')).toBe(false);
    }
    expect(recipeTags(catalog.recipes.find((r) => r.id === 'taco')!, catalog.ingredients).has('storfe')).toBe(true);
  });
  it('vegetarretter har ingen kjøtt- eller fisketagger', async () => {
    const { recipeTags } = await import('./planner');
    for (const r of catalog.recipes.filter((x) => x.vegetarian)) {
      const t = recipeTags(r, catalog.ingredients);
      for (const bad of ['storfe', 'svin', 'lam', 'kylling', 'fisk', 'skalldyr'] as const) expect(t.has(bad), `${r.id} ${bad}`).toBe(false);
    }
  });
});

describe('regresjon: «Med kontrollerte tilbud» er en egen sum', () => {
  it('basissum og budsjettsvar er uendret; ukjent pris gir fortsatt ufullstendig', async () => {
    const { totalWithOffers } = await import('./offerTotal');
    const hint = { id: 'o', ingredient: 'tomat', dealer: 'X', priceOre: 100, prePriceOre: 1490, amount: 400, unit: 'g' as const, validFrom: '2026-11-23', validUntil: '2026-11-29', approved: true };
    const slots = [slot(0, 'linsegryte')];
    const b = buildBasket(slots, ['demoA'], { ...ctx(), offers: [hint], shopDate: '2026-11-24' });
    const t = totalWithOffers(b, [hint], '2026-11-24', { ...defaultSettings, offerChains: ['X'] });
    expect(t.savingOre).toBeGreaterThan(0);
    expect(b.totalOre).toBe(buildBasket(slots, ['demoA'], ctx()).totalOre);
    expect(budgetAnswer(b, 1)).toBe('ufullstendig');
    expect(t.complete).toBe(false);
  });
});

describe('allergifilter og uavklart allergenstatus', () => {
  // Testrett der alle varer bare finnes som produkter med uavklart allergenstatus (kokosmelk i demokatalogen).
  const kokos = { id: 'aaa-kokossuppe', name: 'Kokossuppe (test)', minutes: 10, baseServings: 4, vegetarian: true, protein: 'test',
    allergens: [], steps: [], lines: [{ ingredient: 'kokosmelk', amount: 800 }, { ingredient: 'salt', amount: 5 }] };
  const withKokos = { ...catalog, recipes: [...catalog.recipes, kokos] };
  it('hopper over retter der alle varer ville blitt ukjent pris, så lenge det finnes andre', async () => {
    const { blockedByAllergenStatus, eligibleRecipes } = await import('./planner');
    const c = { catalog: withKokos, settings: { ...defaultSettings, avoid: ['egg' as const] } };
    expect(blockedByAllergenStatus(kokos, c)).toBe(true);
    expect(eligibleRecipes(c, 0).map((r) => r.id)).not.toContain(kokos.id);
    for (const s of generatePlan(c)) expect(s.recipeId).not.toBe(kokos.id);
    // Uten allergifilter er retten med som før.
    const free = { catalog: withKokos, settings: defaultSettings };
    expect(blockedByAllergenStatus(kokos, free)).toBe(false);
    expect(eligibleRecipes(free, 0).map((r) => r.id)).toContain(kokos.id);
  });
  it('er den eneste muligheten, beholdes den, og prisen er fortsatt ukjent', async () => {
    const { eligibleRecipes } = await import('./planner');
    const only = { ...catalog, recipes: [kokos] };
    const c = { catalog: only, settings: { ...defaultSettings, avoid: ['egg' as const] } };
    expect(eligibleRecipes(c, 0).map((r) => r.id)).toEqual([kokos.id]);
    const plan = generatePlan(c);
    const b = buildBasket(plan, ['demoA', 'demoB'], c);
    expect(b.lines.every((l) => l.status === 'ukjent')).toBe(true);
    expect(budgetAnswer(b, 10_000_000)).toBe('ufullstendig');
    expect(alternatives(plan, c).combo).toBeNull(); // ukjent pris vinner aldri
  });
  it('en låst rett med bare ukjente priser beholdes og telles fortsatt som ukjent', () => {
    const c = { catalog: withKokos, settings: { ...defaultSettings, avoid: ['egg' as const] } };
    const plan = generatePlan(c, [slot(0, kokos.id, true)]);
    expect(plan.find((s) => s.day === 0)!.recipeId).toBe(kokos.id);
    expect(buildBasket(plan, ['demoA'], c).complete).toBe(false);
  });
});

describe('regresjon: absolutte krav vinner over låste retter', () => {
  const days = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 60 }));
  it('låst rett som bryter allergi, kost eller råvare slippes ut; lockedViolations sier hvorfor', async () => {
    const { lockedViolations } = await import('./planner');
    const prev = [slot(0, 'bolognese', true), slot(1, 'lakseris', true), slot(2, 'taco', true), slot(3, 'omelett', true)];
    const c = ctx({ days, avoid: ['gluten'], avoidFoods: ['fisk'] });
    expect(lockedViolations(prev, c)).toEqual([
      { day: 0, recipeId: 'bolognese', reason: 'allergen' }, { day: 1, recipeId: 'lakseris', reason: 'råvare' },
      { day: 2, recipeId: 'taco', reason: 'allergen' },
    ]);
    const plan = generatePlan(c, prev);
    expect(plan.map((s) => s.recipeId)).not.toContain('bolognese');
    expect(plan.map((s) => s.recipeId)).not.toContain('lakseris');
    expect(plan.find((s) => s.day === 3)).toEqual(slot(3, 'omelett', true));
    expect(plan).toHaveLength(7);
    expect(lockedViolations(prev, ctx({ days, vegetarian: true })).map((v) => v.reason)).toEqual(['kost', 'kost', 'kost']);
    expect(lockedViolations(prev.map((s) => ({ ...s, locked: false })), c)).toEqual([]); // bare låste
  });
  it('tidsgrensen er unntatt: låst rett over maks tid beholdes', () => {
    const c = ctx({ days: days.map((d) => ({ ...d, maxMinutes: 15 })) });
    expect(generatePlan(c, [slot(0, 'kjottkaker', true)])[0]).toEqual(slot(0, 'kjottkaker', true));
  });
});

describe('regresjon: tilbud teller bare fra valgte kjeder', () => {
  const DAY = '2026-11-24';
  const h = (dealer: string, over: object = {}) => ({
    id: `o-${dealer}`, ingredient: 'kokosmelk', dealer, priceOre: 100, prePriceOre: 90_000, amount: 400, unit: 'ml' as const,
    validFrom: '2026-11-23', validUntil: '2026-11-29', approved: true, ...over,
  });
  const two = defaultSettings.days.map((x, i) => ({ ...x, enabled: i < 2 }));
  const c = (offerChains: string[] | undefined, offers = [h('MENY')]) => ({ ...ctx({ days: two, offerChains }), offers, shopDate: DAY });
  const karri = catalog.recipes.find((r) => r.id === 'karri')!;
  it('tilbud fra ikke-valgt kjede gir verken rangering eller sum; valgt kjede gir begge', async () => {
    const { dealsFor } = await import('./planner');
    const { totalWithOffers } = await import('./offerTotal');
    const none = generatePlan(c(undefined, []));
    expect(dealsFor(karri, 0, c(['KIWI'])).lines).toEqual([]);
    expect(JSON.stringify(generatePlan(c(['KIWI'])))).toBe(JSON.stringify(none)); // rangeringen flyttes ikke
    expect(JSON.stringify(generatePlan(c(undefined)))).toBe(JSON.stringify(none)); // standard: ingen kjede valgt
    expect(JSON.stringify(generatePlan(c([])))).toBe(JSON.stringify(none));
    expect(dealsFor(karri, 0, c(['Meny'])).savingOre).toBeGreaterThan(0);
    expect(JSON.stringify(generatePlan(c(['MENY'])))).not.toBe(JSON.stringify(none)); // kontroll: valgt kjede flytter valget
    const plan = [slot(0, 'karri')];
    const b = buildBasket(plan, ['demoA'], c(undefined));
    expect(totalWithOffers(b, [h('MENY')], DAY, c(['KIWI']).settings).savingOre).toBe(0);
    expect(totalWithOffers(b, [h('MENY')], DAY, c(undefined).settings).blocked).toBe('kjede');
    expect(totalWithOffers(b, [h('MENY')], DAY, c(['MENY']).settings).savingOre).toBeGreaterThan(0);
    // basissummen er uendret av kjedevalget
    expect(buildBasket(plan, ['demoA'], c(['MENY'])).totalOre).toBe(b.totalOre);
  });
  it('normalisert chain på hintet går foran visningsnavnet', async () => {
    const { dealsFor } = await import('./planner');
    expect(dealsFor(karri, 0, c(['COOP OBS'], [h('Coop Obs!')])).lines).toHaveLength(1);
    expect(dealsFor(karri, 0, c(['COOP EXTRA'], [h('Noe annet', { chain: 'COOP EXTRA' })])).lines).toHaveLength(1);
    expect(dealsFor(karri, 0, c(['COOP EXTRA'], [h('Coop Extra', { chain: 'COOP PRIX' })])).lines).toEqual([]);
  });
});

describe('regresjon: alternativer med brukerens valg oppå (samme kurv i alle visninger)', () => {
  const week = [slot(0, 'bolognese'), slot(1, 'pastaspinat'), slot(2, 'karri')];
  it('uten justering er svaret som før; motoren velger butikkene, valgene endrer bare summene og anbefalingen', () => {
    const c = ctx();
    const raw = alternatives(week, c);
    expect(alternatives(week, c, (b) => b)).toEqual(raw);
    // En justering som gjør en linje ukjent (som «fant ikke»): kombinasjonen beholdes, men vinner aldri.
    const unknownFirst = (b: ReturnType<typeof buildBasket>) => {
      const lines = b.lines.map((l, i) => (i === 0 ? { ...l, costOre: null, status: 'ukjent' as const } : l));
      const priced = lines.filter((l) => l.costOre !== null);
      return { ...b, lines, totalOre: priced.reduce((s, l) => s + (l.costOre ?? 0), 0), unknownCount: lines.length - priced.length, complete: false };
    };
    const adj = alternatives(week, c, unknownFirst);
    expect(adj.combo?.storeIds).toEqual(raw.combo?.storeIds);
    expect(adj.recommended).toBe('regular');
    expect(adj.savingOre).toBeNull();
    expect(raw).toEqual(alternatives(week, c)); // motorens kurver er uendret
  });
});

// Reproduksjoner fra kodegjennomgangen 2026-11-22 (docs/kodegjennomgang.md).
const recipeById = (id: string) => catalog.recipes.find((r) => r.id === id)!;
const reviewHint = (over: Partial<OfferHint> = {}): OfferHint => ({
  id: 'o1', ingredient: 'laks', dealer: 'KIWI', priceOre: 5000, prePriceOre: 9000, amount: 400, unit: 'g',
  validFrom: '2026-11-23', validUntil: '2026-11-29', approved: true, ...over,
});

describe('kodegjennomgang: motor', () => {
  it('et tilbud i feil enhet skygger ikke for et gyldig tilbud i riktig enhet', () => {
    const wrongUnit = reviewHint({ id: 'a', unit: 'stk', amount: 1, prePriceOre: 20000 });
    const right = reviewHint({ id: 'b' });
    const d = recipeDeals(recipeById('lakseris'), 0.8, catalog.ingredients, [wrongUnit, right], '2026-11-24');
    expect(d.lines.map((l) => l.offerId)).toEqual(['b']);
    expect(d.savingOre).toBe(4000);
  });
  it('førpris som ikke er heltall øre gir ingen besparelse (beløp i hele øre)', () => {
    const d = recipeDeals(recipeById('lakseris'), 0.8, catalog.ingredients, [reviewHint({ prePriceOre: 9000.5 })], '2026-11-24');
    expect(Number.isInteger(d.savingOre)).toBe(true);
    const laks = buildBasket([slot(0, 'lakseris')], ['demoA'], { catalog, settings: defaultSettings, shopDate: '2026-11-23' });
    const t = totalWithOffers(laks, [reviewHint({ prePriceOre: 9000.5 })], '2026-11-24', { ...defaultSettings, offerChains: ['KIWI'] });
    expect(Number.isInteger(t.totalOre)).toBe(true);
    expect(Number.isInteger(t.savingOre)).toBe(true);
  });
  it('en pris på 0 øre eller produktstørrelse 0 regnes ikke som kjent pris', () => {
    const zero = { ...catalog, prices: catalog.prices.map((p) => (p.storeId === 'demoA' && catalog.products.find((x) => x.id === p.productId)?.ingredient === 'pasta' ? { ...p, ore: 0 } : p)) };
    const b = buildBasket([slot(0, 'bolognese')], ['demoA'], { catalog: zero, settings: defaultSettings });
    const pasta = b.lines.find((l) => l.ingredient === 'pasta')!;
    expect(pasta.costOre).not.toBe(0);
    const noSize = { ...catalog, products: catalog.products.map((p) => (p.ingredient === 'pasta' ? { ...p, size: 0 } : p)) };
    const b2 = buildBasket([slot(0, 'bolognese')], ['demoA'], { catalog: noSize, settings: defaultSettings });
    expect(Number.isFinite(b2.totalOre)).toBe(true);
    expect(b2.complete).toBe(false);
  });
  it('bytteforslag mot en kurv med ukjent pris markeres som ufullstendige', () => {
    const ctx = { catalog, settings: defaultSettings };
    const slots = [slot(0, 'linsegryte')];
    expect(buildBasket(slots, ['demoA'], ctx).complete).toBe(false);
    for (const o of swapOptions(slots, 0, ['demoA'], ctx)) expect(o.complete).toBe(false);
  });
});

describe('regresjon: gamle prisobservasjoner er estimat (E7)', () => {
  // Liten katalog: én rett med vare a (pa) og b (pb), butikk S1 (vanlig) og S2. Handledag 2026-11-23.
  const SHOP = '2026-11-23';
  type Row = [productId: string, storeId: string, ore: number, observed: string, status?: PriceObs['status'], validUntil?: string];
  const cat = (rows: Row[]): Catalog => ({
    ...miniCatalog({ prices: [] }),
    prices: rows.map(([productId, storeId, ore, observed, status = 'ordinær', validUntil]) =>
      ({ productId, storeId, ore, status, source: 'Test', observed, ...(validUntil ? { validUntil } : {}) })),
  });
  const c = (rows: Row[], shopDate: string | undefined = SHOP, over: Partial<Settings> = {}): Ctx =>
    ({ catalog: cat(rows), settings: miniSettings(over), ...(shopDate ? { shopDate } : {}) });
  const R1 = [slot(0, 'r1')];
  const lineA = (b: Basket) => b.lines.find((l) => l.ingredient === 'a')!;

  it('aldersgrensen er en navngitt konstant på 14 dager', () => {
    expect(MAX_PRICE_AGE_DAYS).toBe(14);
  });
  it('ny observasjon vinner over en gammel og lavere (også et gammelt tilbud uten gyldighet)', () => {
    const rows: Row[] = [
      ['pa', 'S1', 1490, '2025-11-20', 'tilbud'], // tilbud fra i fjor, uten validUntil (eksempelet i E7)
      ['pa', 'S1', 1990, '2026-10-01'], // gammel ordinær pris
      ['pa', 'S1', 2290, '2026-11-20'], // ny ordinær pris
      ['pb', 'S1', 1000, '2026-11-20'],
    ];
    const a = lineA(buildBasket(R1, ['S1'], c(rows)));
    expect(a.costOre).toBe(2290);
    expect(a.status).toBe('ordinær');
    expect(a.observed).toBe('2026-11-20');
    // Utsolgt / fant ikke bruker samme prisvalg.
    expect(priceIn('pa', 'S1', c(rows))).toMatchObject({ ore: 2290, status: 'ordinær', observed: '2026-11-20' });
  });
  it('gammel observasjon alene blir estimat med dato og kilde; grensen er 14 dager', () => {
    const at = (observed: string) => lineA(buildBasket(R1, ['S1'], c([['pa', 'S1', 1490, observed], ['pb', 'S1', 1000, '2026-11-20']])));
    const old = at('2026-10-01');
    expect(old).toMatchObject({ costOre: 1490, status: 'estimat', observed: '2026-10-01', source: 'Test' });
    const b = buildBasket(R1, ['S1'], c([['pa', 'S1', 1490, '2026-10-01'], ['pb', 'S1', 1000, '2026-11-20']]));
    expect(b.complete).toBe(true); // et estimat er en pris, men aldri et løfte (regel 2)
    expect(b.estimatedCount).toBe(1);
    expect(at('2026-11-09').status).toBe('ordinær'); // 14 dager før handledagen: fortsatt kjent pris
    expect(at('2026-11-08').status).toBe('estimat'); // 15 dager: estimat
    expect(at('ikke-en-dato').status).toBe('estimat'); // uten lesbar dato kan alderen ikke bekreftes
    // Et gammelt tilbud uten gyldighet er bare historikk: aldri dagens tilbud, heller ikke estimat.
    const histOffer = lineA(buildBasket(R1, ['S1'], c([['pa', 'S1', 990, '2026-10-01', 'tilbud'], ['pb', 'S1', 1000, '2026-11-20']])));
    expect(histOffer.status).toBe('ukjent');
    expect(histOffer.costOre).toBeNull();
    // Blant gamle observasjoner er det den nyeste som er estimatet, ikke den laveste.
    const newestOld = lineA(buildBasket(R1, ['S1'], c([['pa', 'S1', 990, '2026-09-01'], ['pa', 'S1', 1490, '2026-10-01'], ['pb', 'S1', 1000, '2026-11-20']])));
    expect(newestOld).toMatchObject({ costOre: 1490, status: 'estimat', observed: '2026-10-01' });
  });
  it('blanding av gammel og ny: en gammel, lavere pris i en annen butikk gir verken valg eller besparelse', () => {
    const rows: Row[] = [
      ['pa', 'S1', 2290, '2026-11-20'], ['pa', 'S2', 1490, '2026-10-01'], // a: ny i S1, gammel og billigere i S2
      ['pb', 'S1', 1000, '2026-11-20'], ['pb', 'S2', 900, '2026-11-21'], // b: ny i begge
    ];
    const ctx2 = c(rows, SHOP, { maxStops: 2 });
    const combo = buildBasket(R1, ['S1', 'S2'], ctx2);
    expect(lineA(combo)).toMatchObject({ storeId: 'S1', costOre: 2290, status: 'ordinær' });
    expect(combo.estimatedCount).toBe(0);
    const alt = alternatives(R1, ctx2);
    expect(alt.savingOre).toBe(100); // bare den nye prisen på b (1000 → 900) teller
    // Når S1 mangler a, er S2s gamle pris et estimat (ikke ukjent og ikke «ordinær»).
    const onlyOld = buildBasket(R1, ['S1', 'S2'], c(rows.filter((r) => !(r[0] === 'pa' && r[1] === 'S1'))));
    expect(lineA(onlyOld)).toMatchObject({ storeId: 'S2', costOre: 1490, status: 'estimat', observed: '2026-10-01' });
  });
  it('er deterministisk: rekkefølgen i katalogen avgjør aldri, og uten handledag måles alder mot nyeste observasjon', () => {
    const rows: Row[] = [
      ['pa', 'S1', 2290, '2026-11-20'], ['pa', 'S1', 2290, '2026-11-20', 'estimat'], ['pa', 'S2', 1490, '2026-10-01'],
      ['pa', 'S2', 1490, '2026-10-01', 'tilbud', '2026-12-31'], ['pb', 'S1', 1000, '2026-11-20'], ['pb', 'S2', 900, '2026-10-02'],
    ];
    const ctx2 = c(rows, SHOP, { maxStops: 2 });
    const rev: Ctx = { ...ctx2, catalog: { ...ctx2.catalog, prices: [...ctx2.catalog.prices].reverse() } };
    const run = (x: Ctx) => JSON.stringify([buildBasket(R1, ['S1', 'S2'], x), alternatives(R1, x), generatePlan(x)]);
    expect(run(ctx2)).toBe(run(ctx2));
    expect(run(rev)).toBe(run(ctx2));
    // Uten handledag er referansen nyeste observasjon i katalogen (2026-11-20): S2s priser er fortsatt estimat.
    const noDate = c(rows, undefined, { maxStops: 2 });
    expect(buildBasket(R1, ['S2'], noDate).lines.map((l) => l.status)).toEqual(['estimat', 'estimat']);
    expect(run(noDate)).toBe(run({ ...noDate, catalog: { ...noDate.catalog, prices: [...noDate.catalog.prices].reverse() } }));
  });
  it('ukjent pris vinner aldri: et gammelt tilbud uten gyldighet fyller ikke et hull, og en kurv med hull anbefales ikke', () => {
    // S1 mangler b. S2 har bare et gammelt tilbud på b uten gyldighet.
    const rows: Row[] = [['pa', 'S1', 2290, '2026-11-20'], ['pa', 'S2', 2290, '2026-11-20'], ['pb', 'S2', 500, '2026-10-01', 'tilbud']];
    const ctx2 = c(rows, SHOP, { maxStops: 2 });
    const alt = alternatives(R1, ctx2);
    expect(alt.regular.complete).toBe(false);
    expect(alt.combo).toBeNull();
    expect(alt.recommended).toBe('regular');
    expect(alt.savingOre).toBeNull();
    expect(budgetAnswer(alt.regular, 1_000_000)).toBe('ufullstendig');
    // Med en gammel ordinær pris i S2 er b et estimat: kombinasjonen er komplett og vinner over kurven med ukjent pris.
    const est = alternatives(R1, c([...rows, ['pb', 'S2', 1200, '2026-10-01']], SHOP, { maxStops: 2 }));
    expect(est.combo?.complete).toBe(true);
    expect(est.combo?.estimatedCount).toBe(1);
    expect(est.recommended).toBe('combo');
    expect(est.regular.complete).toBe(false);
  });
});

describe('regresjon: «Lag nå» (cookNow.ts) følger planmotorens regler', () => {
  it('allergi vinner over dekning og «må brukes snart», og ukjent pris blir aldri en kjent sum', () => {
    const c = { ...ctx({ avoid: ['egg'] }), shopDate: '2026-11-23' };
    const have = [{ ingredient: 'egg', amount: 12, soon: true }, { ingredient: 'poteter', amount: 1000, soon: false }];
    const r = cookNow(have, c, { portions: 4, storeIds: ['demoA'] });
    for (const s of r.suggestions) expect(s.recipe.allergens).not.toContain('egg');
    // Samme pris som ukeplanen: hver manglende vare har samme status og beløp som i en kurv for retten alene.
    const first = r.suggestions[0];
    for (const l of first.missing) expect(['ordinær', 'tilbud', 'estimat', 'ukjent']).toContain(l.status);
    if (!first.priceComplete) expect(first.missing.some((l) => l.costOre === null)).toBe(true);
    expect(JSON.stringify(cookNow(have, c, { portions: 4, storeIds: ['demoA'] }))).toBe(JSON.stringify(r));
  });
});

describe('regresjon: basisvarer (staples.ts) påvirker aldri kurv, sum, sammenligning eller filtre', () => {
  it('samme plan, kurv, sum og alternativer med og uten basisvarer; allergi- og kostkrav uendret', () => {
    const staples = [{ id: 'ris', min: 5000 }, { id: 'kaffe' }, { id: 'mel', min: 1000 }];
    for (const over of [{}, { avoid: ['gluten' as const] }, { vegetarian: true }, { avoidFoods: ['svin' as const] }]) {
      const without = { ...ctx(over), shopDate: '2026-11-23' };
      const withStaples = { ...ctx({ ...over, staples }), shopDate: '2026-11-23' };
      const slots = generatePlan(without);
      expect(generatePlan(withStaples)).toEqual(slots);
      expect(JSON.stringify(buildBasket(slots, ['demoA', 'demoB'], withStaples))).toBe(JSON.stringify(buildBasket(slots, ['demoA', 'demoB'], without)));
      expect(JSON.stringify(alternatives(slots, withStaples))).toBe(JSON.stringify(alternatives(slots, without)));
    }
  });
});

describe('regresjon: husholdningsvarer (household.ts) påvirker aldri middagskurv, sum, sammenligning, tilbudssum eller budsjett', () => {
  it('samme plan, kurv, alternativer, «Med kontrollerte tilbud» og budsjettsvar med og uten varegrupper og husholdningstilbud', async () => {
    const { classifyHousehold, householdTotal, parseHouseholdRules } = await import('./household');
    const rules = parseHouseholdRules((await import('../data/household-rules.json')).default);
    const house = { id: 'h1', source: 'tjek', heading: 'Toalettpapir 24 rull', description: null, priceOre: 9990, prePriceOre: null, amount: null, unit: null, pieces: null,
      dealerName: 'Kiwi', validFrom: '2026-11-23', validUntil: '2026-11-29', observed: '2026-11-23T08:00:00.000Z' };
    const m = classifyHousehold(house, rules, [])!;
    const hint: OfferHint = { id: 't1', ingredient: 'torsk', dealer: 'Kiwi', chain: 'KIWI', priceOre: 5000, prePriceOre: 8000, amount: 400, unit: 'g', validFrom: '2026-11-23', validUntil: '2026-11-29', approved: true };
    for (const over of [{}, { avoid: ['gluten' as const] }, { vegetarian: true }, { offerChains: ['KIWI'] }]) {
      const without = { ...ctx(over), shopDate: '2026-11-23', offers: [hint] };
      const withHouse = { ...ctx({ ...over, householdGroups: ['papir', 'kjaeledyr'] }), shopDate: '2026-11-23', offers: [hint] };
      const slots = generatePlan(without);
      expect(generatePlan(withHouse)).toEqual(slots);
      const a = buildBasket(slots, ['demoA', 'demoB'], without), b = buildBasket(slots, ['demoA', 'demoB'], withHouse);
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      expect(JSON.stringify(alternatives(slots, withHouse))).toBe(JSON.stringify(alternatives(slots, without)));
      expect(totalWithOffers(b, [hint], '2026-11-23', withHouse.settings)).toEqual(totalWithOffers(a, [hint], '2026-11-23', without.settings));
      expect(budgetAnswer(b, withHouse.settings.budgetOre)).toBe(budgetAnswer(a, without.settings.budgetOre));
      // «Andre varer» har egen sum, og en husholdningsvare uten gyldig pris gjør ikke middagskurven ufullstendig.
      const other = householdTotal([{ id: 'hus:tjek:h1#0', text: 'Toalettpapir', note: 'tilbud hos Kiwi' }, { id: 'hus:tjek:borte#0', text: 'Batterier', note: '' }], [m], '2026-11-23', ['KIWI']);
      expect([other.totalOre, other.complete]).toEqual([9990, false]);
      expect([b.totalOre, b.complete, b.unknownCount]).toEqual([a.totalOre, a.complete, a.unknownCount]);
    }
  });
});

// ---------- Kodegjennomgang runde 2 (docs/kodegjennomgang.md): M1–M5 ----------
const r2info: StapleInfo = { choices: stapleChoices, ingredients: catalog.ingredients };
const R2RULES: HouseholdRuleSet = parseHouseholdRules(rawRules);
const R2FOOD = ['melk', 'kaffe', 'ost', 'egg'];
let r2n = 0;
const r2offer = (heading: string, over: Partial<HouseholdOfferIn> = {}): HouseholdOfferIn => ({
  id: `o${++r2n}`, source: 'tjek', heading, description: null, priceOre: 4990, prePriceOre: 6990, amount: null, unit: null, pieces: null,
  dealerName: 'Kiwi', validFrom: '2026-11-23', validUntil: '2026-11-29', observed: '2026-11-23T08:00:00.000Z', ...over,
});

describe('regresjon: kodegjennomgang runde 2, M1 basisvare: «tom» oppheves av en telling som sier 0', () => {
  it('nivåvare (uten minstemengde) markert tom og så telt til 0 skal fortsatt foreslås', () => {
    const log: InventoryEvent[] = [
      { type: 'nivå', id: 'a1', at: '2026-11-21T10:00:00.000Z', by: 'a', staple: 'ris', level: 'tom' },
      { type: 'telling', id: 'a2', at: '2026-11-21T11:00:00.000Z', by: 'a', ingredient: 'ris', amount: 0 },
    ];
    const s = stapleStatus([{ id: 'ris' }], applyEvents([], log), stapleListFacts([]), r2info)[0];
    expect(s.suggest).toBe(true); // før rettingen: state 'ok'
  });
});

describe('regresjon: kodegjennomgang runde 2, M2 egen basisvare: id fra customStapleId godtas ikke av nivå-hendelsen', () => {
  it('hvert navn som cleanStapleName godtar, gir en id som STAPLE_ID (nivå) godtar', () => {
    for (const name of ['ʻAhi', 'İ'.repeat(30)]) {
      const clean = cleanStapleName(name)!;
      const id = customStapleId(clean)!;
      expect(isValidStaples([{ id, name: clean }], r2info)).toBe(true);
      const e: InventoryEvent = { type: 'nivå', id: 'x', at: '2026-11-21T10:00:00.000Z', by: 'a', staple: id, level: 'tom' };
      expect(isValidEvent(e), `${name} → ${id}`).toBe(true); // før rettingen: avvist
    }
  });
});

describe('regresjon: kodegjennomgang runde 2, M3 husholdning: barneprodukter uten ordet «barne»', () => {
  it('«Tannkrem barn 0-6 år» og «Kids sjampo» gir ikke treff', () => {
    expect(classifyHousehold(r2offer('Zendium tannkrem barn 0-6 år'), R2RULES, R2FOOD)).toBeNull(); // før rettingen: tannkrem
    expect(classifyHousehold(r2offer('Shampoo for barn'), R2RULES, R2FOOD)).toBeNull();
    expect(classifyHousehold(r2offer('Colgate Kids tannkrem'), R2RULES, R2FOOD)).toBeNull();
  });
});

describe('regresjon: kodegjennomgang runde 2, M4 husholdning: samme tilbud to ganger, eldste observasjon vises i fangsten', () => {
  it('fangsten og «Andre varer» bruker samme (nyeste) observasjon', () => {
    const old = r2offer('Toalettpapir 24 rull', { id: 'same', priceOre: 5990, observed: '2026-11-20T08:00:00.000Z' });
    const neu = { ...old, priceOre: 7990, observed: '2026-11-24T08:00:00.000Z' };
    const c = householdCatch([neu, old], R2RULES, R2FOOD, { shopDate: '2026-11-25', chains: ['KIWI'] });
    const shown = [...c.approved, ...c.review][0];
    const total = householdTotal([{ id: `hus:${householdOfferKey(old)}#0`, text: 'Toalettpapir', note: 'KIWI' }], [...c.approved, ...c.review], '2026-11-25', ['KIWI']);
    expect(shown.offer.priceOre).toBe(total.lines[0].priceOre ?? -1);
    expect(shown.offer.priceOre).toBe(7990); // før rettingen: 5990
  });
});

describe('regresjon: kodegjennomgang runde 2, M5 prisalder: observasjonstid i UTC gir én dag for mye alder rett etter norsk midnatt', () => {
  // Rettet (var it.fails): observasjonstiden regnes om til norsk dato med fast regel (src/engine/oslo.ts, ingen klokke).
  it('observert 00:30 norsk tid 9. nov (23:30Z 8. nov) er 14 dager før 23. nov, ikke 15', () => {
    expect(priceAgeDays('2026-11-08T23:30:00.000Z', '2026-11-23')).toBe(14); // før rettingen: 15
    expect(isStale('2026-11-08T23:30:00.000Z', '2026-11-23')).toBe(false);
  });
  it('grensen går ved norsk midnatt, også om sommeren (+2) og med annen sone i teksten', () => {
    expect(priceAgeDays('2026-11-08T22:59:59.000Z', '2026-11-23')).toBe(15); // 8.11. 23:59 norsk tid
    expect(isStale('2026-11-08T22:59:59.000Z', '2026-11-23')).toBe(true);
    expect(priceAgeDays('2026-06-08T22:30:00.000Z', '2026-06-23')).toBe(14); // 9.6. 00:30 sommertid
    expect(priceAgeDays('2026-06-08T21:30:00.000Z', '2026-06-23')).toBe(15); // 8.6. 23:30 sommertid
    expect(priceAgeDays('2026-11-09T00:30:00+01:00', '2026-11-23')).toBe(14);
    expect(priceAgeDays('2026-11-09', '2026-11-23')).toBe(14); // katalogpriser (bare dato) er uendret
  });
  it('referansedatoen uten handledag er nyeste norske observasjonsdato', () => {
    const obs = (observed: string) => ({ productId: 'p', storeId: 's', ore: 100, status: 'ordinær' as const, source: 'x', observed });
    expect(priceReferenceDate([obs('2026-11-20'), obs('2026-11-20T23:30:00.000Z')])).toBe('2026-11-21');
  });
});

describe('regresjon: KI-utkast skjules ved aktive krav (eierens beslutning 2026-11-22, spørsmål 45)', () => {
  // Egne oppskrifter skrevet av KI og ikke testkokt (`egen` + `utkast`) er ikke allergen-kontrollert av en person.
  // Med aktivt allergi-, kost- eller råvarefilter er de et absolutt brudd (`'utkast'`), uten filter vises de som før.
  const long = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 300 }));
  const drafts = catalog.recipes.filter((r) => r.origin?.kind === 'egen' && r.origin.status === 'utkast');
  const draftIds = new Set(drafts.map((r) => r.id));
  const noDraft = (ids: string[]) => ids.filter((id) => draftIds.has(id));
  // Sesam står ikke i noen rett: filteret er aktivt, men bare utkastregelen kan slå inn.
  const sesam = ctx({ days: long, avoid: ['sesam'] });
  const withStatus = (id: string, status: 'testkokt' | 'godkjent'): Catalog => ({
    ...catalog, recipes: catalog.recipes.map((r) => (r.id === id ? { ...r, origin: { ...r.origin!, status } } : r)),
  });

  it('forutsetning: katalogen har 50 KI-utkast (egen, utkast; omgang 1 og 2)', () => {
    expect(drafts).toHaveLength(50);
    expect(drafts.every((r) => r.origin!.by === 'KI-utkast (Claude)')).toBe(true);
  });
  it('aktivt allergifilter: ingen utkast i plan, valgbare retter, bytteforslag, budsjettforslag eller tilbudsretter', async () => {
    const { eligibleRecipes, budgetSuggestions, requirementViolation, isUnreviewedDraft } = await import('./planner');
    const { offerRecipes } = await import('../views/papers/offerList');
    for (const d of [0, 3, 6]) expect(noDraft(eligibleRecipes(sesam, d).map((r) => r.id))).toEqual([]);
    const plan = generatePlan(sesam);
    expect(plan).toHaveLength(7);
    expect(noDraft(plan.map((s) => s.recipeId))).toEqual([]);
    for (const s of plan) expect(noDraft(swapOptions(plan, s.day, ['demoA', 'demoB'], sesam).map((o) => o.recipe.id))).toEqual([]);
    const tight = { ...sesam, settings: { ...sesam.settings, budgetOre: 1 } };
    expect(noDraft(budgetSuggestions(plan, ['demoA'], tight, 7).map((x) => x.option.recipe.id))).toEqual([]);
    for (const ing of ['purre', 'kjottdeig', 'sotpotet', 'kikerter']) expect(noDraft(offerRecipes(ing, sesam).map((r) => r.id))).toEqual([]);
    for (const r of drafts) {
      expect(isUnreviewedDraft(r)).toBe(true);
      expect(requirementViolation(r, sesam)).toBe('utkast');
    }
  });
  it('vegetar og råvarekrav utelukker også utkast, også vegetariske utkast', async () => {
    const { eligibleRecipes, requirementViolation } = await import('./planner');
    const veg = ctx({ days: long, vegetarian: true });
    const vegDrafts = drafts.filter((r) => r.vegetarian);
    expect(vegDrafts.length).toBeGreaterThan(0);
    for (const r of vegDrafts) expect(requirementViolation(r, veg)).toBe('utkast');
    expect(noDraft(eligibleRecipes(veg, 0).map((r) => r.id))).toEqual([]);
    expect(noDraft(generatePlan(veg).map((s) => s.recipeId))).toEqual([]);
    const pork = ctx({ days: long, avoidFoods: ['svin'] });
    expect(requirementViolation(catalog.recipes.find((r) => r.id === 'chili')!, pork)).toBe('utkast'); // storfe, ikke svin
    expect(noDraft(eligibleRecipes(pork, 0).map((r) => r.id))).toEqual([]);
    expect(noDraft(generatePlan(pork).map((s) => s.recipeId))).toEqual([]);
  });
  it('uten aktive krav vises utkastene som før', async () => {
    const { eligibleRecipes, requirementViolation, hiddenUnreviewed } = await import('./planner');
    const free = ctx({ days: long });
    expect(eligibleRecipes(free, 0).filter((r) => draftIds.has(r.id))).toHaveLength(drafts.length);
    for (const r of drafts) expect(requirementViolation(r, free)).toBeNull();
    expect(hiddenUnreviewed(free)).toEqual([]);
    expect(generatePlan(free, [slot(0, 'chili', true)])[0]).toEqual(slot(0, 'chili', true)); // lås beholdes
  });
  it('testkokt og godkjent slippes inn under aktivt filter', async () => {
    const { eligibleRecipes, requirementViolation } = await import('./planner');
    for (const status of ['testkokt', 'godkjent'] as const) {
      const c = { catalog: withStatus('chili', status), settings: sesam.settings };
      expect(requirementViolation(c.catalog.recipes.find((r) => r.id === 'chili')!, c)).toBeNull();
      expect(eligibleRecipes(c, 0).map((r) => r.id)).toContain('chili');
      expect(generatePlan(c, [slot(0, 'chili', true)])[0]).toEqual(slot(0, 'chili', true));
    }
  });
  it('demooppskrifter påvirkes ikke av utkastregelen (de er merket som demodata)', async () => {
    const { eligibleRecipes, requirementViolation } = await import('./planner');
    const demo = catalog.recipes.filter((r) => r.origin?.kind === 'demo');
    for (const r of demo) expect(requirementViolation(r, sesam)).toBeNull();
    expect(eligibleRecipes(sesam, 0).length).toBeGreaterThan(0);
  });
  it('er deterministisk', async () => {
    const { hiddenUnreviewed } = await import('./planner');
    expect(JSON.stringify(generatePlan(sesam))).toBe(JSON.stringify(generatePlan(sesam)));
    expect(hiddenUnreviewed(sesam).map((r) => r.id)).toEqual(hiddenUnreviewed(sesam).map((r) => r.id));
    expect(hiddenUnreviewed(sesam).map((r) => r.id)).toEqual([...draftIds].sort());
  });
  it('låst utkast under aktivt filter flagges med årsak «utkast» og slippes ut av planen', async () => {
    const { lockedViolations, slotViolations } = await import('./planner');
    const prev = [slot(0, 'chili', true), slot(1, 'bolognese', true), slot(2, 'frittata', false)];
    expect(lockedViolations(prev, sesam)).toEqual([{ day: 0, recipeId: 'chili', reason: 'utkast' }]);
    expect(slotViolations(prev, sesam)).toEqual([
      { day: 0, recipeId: 'chili', reason: 'utkast' }, { day: 2, recipeId: 'frittata', reason: 'utkast' },
    ]);
    const plan = generatePlan(sesam, prev);
    expect(plan.find((s) => s.day === 0)!.recipeId).not.toBe('chili');
    expect(plan.find((s) => s.day === 1)).toEqual(slot(1, 'bolognese', true));
    // Et mer konkret brudd vinner som årsak: fiskegrateng har gluten.
    expect(lockedViolations([slot(0, 'fiskegrateng', true)], ctx({ days: long, avoid: ['gluten'] }))[0].reason).toBe('allergen');
    expect(lockedViolations(prev, ctx({ days: long }))).toEqual([]);
  });
  it('hiddenUnreviewed teller bare utkast som ellers ville passert kravene', async () => {
    const { hiddenUnreviewed } = await import('./planner');
    const veg = hiddenUnreviewed(ctx({ days: long, vegetarian: true }));
    expect(veg.length).toBe(drafts.filter((r) => r.vegetarian).length);
    expect(hiddenUnreviewed(ctx({ days: long, avoid: ['gluten'] })).every((r) => !r.allergens.includes('gluten'))).toBe(true);
  });
  it('ukjent og uavklart allergenstatus fortsetter som før for retter som ikke er utkast', async () => {
    const { eligibleRecipes, blockedByAllergenStatus } = await import('./planner');
    // Karri (demo) har kokosmelk med uavklart innhold: med filter er linja fortsatt ukjent pris.
    const karri = catalog.recipes.find((r) => r.id === 'karri')!;
    expect(eligibleRecipes(sesam, 0).map((r) => r.id)).toContain('karri');
    expect(blockedByAllergenStatus(karri, sesam)).toBe(false);
    const b = buildBasket([slot(0, 'karri')], ['demoA'], sesam);
    expect(b.lines.find((l) => l.ingredient === 'kokosmelk')!.status).toBe('ukjent');
    expect(budgetAnswer(b, 10_000_000)).toBe('ufullstendig');
    // Uten filter har kokosmelken pris.
    expect(buildBasket([slot(0, 'karri')], ['demoA'], ctx({ days: long })).complete).toBe(true);
  });
});

describe('regresjon: egne oppskrifter omgang 2 (2026-11-26)', () => {
  // 25 nye KI-utkast. Planmotoren skal fortsatt gi gyldige, deterministiske planer med og uten filter, og utkastene
  // skal fortsatt skjules når et absolutt krav er aktivt (CLAUDE.md, «Oppskrifter»).
  const long = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 300 }));
  const round2 = catalog.recipes.filter((r) => r.origin?.kind === 'egen' && r.origin.date === '2026-11-26');
  const byId = (id: string) => catalog.recipes.find((r) => r.id === id)!;
  const isDraft = (id: string) => byId(id).origin?.kind === 'egen' && byId(id).origin?.status === 'utkast';
  const valid = (plan: Slot[], c: Ctx, unique = true) => {
    if (unique) expect(new Set(plan.map((s) => s.recipeId)).size, 'samme rett to ganger').toBe(plan.length);
    for (const s of plan) {
      const r = byId(s.recipeId);
      expect(r, s.recipeId).toBeDefined();
      expect(r.minutes, r.id).toBeLessThanOrEqual(c.settings.days[s.day].maxMinutes);
      for (const a of c.settings.avoid) expect(r.allergens, `${r.id} ${a}`).not.toContain(a);
      if (c.settings.vegetarian) expect(r.vegetarian, r.id).toBe(true);
    }
  };
  const perProtein = (plan: Slot[]) => {
    const m = new Map<string, number>();
    for (const s of plan) m.set(byId(s.recipeId).protein, (m.get(byId(s.recipeId).protein) ?? 0) + 1);
    return m;
  };
  const approved = (): Catalog => ({
    ...catalog, recipes: catalog.recipes.map((r) => (round2.includes(r) ? { ...r, origin: { ...r.origin!, status: 'godkjent' as const } } : r)),
  });

  it('forutsetning: 25 nye utkast, og Spagetti bolognese (brukt i e2e:sync) er uendret demodata', () => {
    expect(round2).toHaveLength(25);
    const b = byId('bolognese');
    expect(b.origin?.kind).toBe('demo');
    expect(b.lines).toEqual([
      { ingredient: 'pasta', amount: 400 }, { ingredient: 'kjottdeig', amount: 400 }, { ingredient: 'tomat', amount: 800 },
      { ingredient: 'lok', amount: 1 }, { ingredient: 'olje', amount: 20 }, { ingredient: 'salt', amount: 5 },
    ]);
  });
  it('uten filter: gyldig og deterministisk plan med standardinnstillinger og med lange dager, maks to per protein', async () => {
    const { eligibleRecipes } = await import('./planner');
    for (const c of [ctx(), ctx({ days: long })]) {
      const plan = generatePlan(c);
      expect(plan).toHaveLength(c.settings.days.filter((d) => d.enabled).length);
      valid(plan, c);
      expect(JSON.stringify(generatePlan(c))).toBe(JSON.stringify(plan));
      for (const n of perProtein(plan).values()) expect(n).toBeLessThanOrEqual(2);
    }
    // Uten filter kan alle de nye rettene velges når tiden strekker til.
    const ids = eligibleRecipes(ctx({ days: long }), 0).map((r) => r.id);
    for (const r of round2) expect(ids, r.id).toContain(r.id);
  });
  it('med filter for gluten, melk (laktose), vegetar og gluten + melk: gyldig plan på 7 dager uten utkast, deterministisk', () => {
    const cases: Partial<Settings>[] = [{ avoid: ['gluten'] }, { avoid: ['melk'] }, { vegetarian: true }, { avoid: ['gluten', 'melk'] }];
    for (const over of cases) {
      const c = ctx({ days: long, ...over });
      const plan = generatePlan(c);
      expect(plan, JSON.stringify(over)).toHaveLength(7);
      valid(plan, c);
      expect(plan.filter((s) => isDraft(s.recipeId)).map((s) => s.recipeId), JSON.stringify(over)).toEqual([]);
      expect(JSON.stringify(generatePlan(c))).toBe(JSON.stringify(plan));
    }
  });
  it('vegetar uten melk: bare demoretter er igjen (utkast skjules), så planen gjentar retter, men alle er gyldige', async () => {
    const { eligibleRecipes } = await import('./planner');
    const c = ctx({ days: long, vegetarian: true, avoid: ['melk'] });
    const plan = generatePlan(c);
    expect(plan).toHaveLength(7);
    valid(plan, c, false);
    const pool = eligibleRecipes(c, 0).map((r) => r.id);
    expect(pool.every((id) => !isDraft(id))).toBe(true);
    expect(new Set(plan.map((s) => s.recipeId)).size).toBe(Math.min(7, pool.length));
  });
  it('når omgang 2 en gang er kontrollert (simulert godkjent), gir de variasjon med filter: maks to per protein', async () => {
    const { eligibleRecipes } = await import('./planner');
    for (const over of [{ avoid: ['gluten', 'melk'] }, { vegetarian: true }] as Partial<Settings>[]) {
      const c: Ctx = { catalog: approved(), settings: { ...defaultSettings, days: long, ...over } };
      const pool = eligibleRecipes(c, 0);
      expect(pool.filter((r) => round2.some((x) => x.id === r.id)).length, JSON.stringify(over)).toBeGreaterThanOrEqual(8);
      const plan = generatePlan(c);
      expect(plan).toHaveLength(7);
      valid(plan, c);
      for (const n of perProtein(plan).values()) expect(n, JSON.stringify(over)).toBeLessThanOrEqual(2);
      expect(perProtein(plan).size, JSON.stringify(over)).toBeGreaterThanOrEqual(4);
    }
  });
  it('kurven for hver ny rett har én linje per vare, og ukjent eller uavklart pris gjør den aldri komplett', () => {
    for (const r of round2) {
      const b = buildBasket([slot(0, r.id)], ['demoA', 'demoB'], ctx({ days: long }));
      const ids = b.lines.map((l) => l.ingredient);
      expect(new Set(ids).size, r.id).toBe(ids.length);
      expect(b.complete, r.id).toBe(b.lines.every((l) => l.status !== 'ukjent'));
      expect(b.totalOre, r.id).toBe(b.lines.reduce((s, l) => s + (l.costOre ?? 0), 0));
    }
    // Med aktivt allergifilter gir en uavklart vare ukjent pris (aldri godkjent som trygg).
    const wrap = buildBasket([slot(0, 'kyllingwrap')], ['demoA'], ctx({ days: long, avoid: ['sesam'] }));
    expect(wrap.lines.find((l) => l.ingredient === 'tortilla')!.status).toBe('ukjent');
    expect(wrap.complete).toBe(false);
  });
});
