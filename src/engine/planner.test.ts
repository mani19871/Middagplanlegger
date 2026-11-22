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
