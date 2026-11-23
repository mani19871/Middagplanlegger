// «Lag nå»: middagsforslag fra det husstanden har hjemme akkurat nå. Ren og deterministisk.
import { describe, expect, it } from 'vitest';
import { catalog as demoCatalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { cookNow, cookNowLinePrefix, mergeHave, type HaveItem } from './cookNow';
import type { Ctx } from './planner';
import type { Catalog, Ingredient, PriceObs, Product, Recipe, Settings } from './types';

const SHOP = '2026-11-23';
const ing = (id: string, unit: Ingredient['unit'] = 'g', extra: Partial<Ingredient> = {}): Ingredient =>
  ({ id, name: `Vare ${id}`, unit, department: 'Test', ...extra });
const rec = (id: string, lines: [string, number][], extra: Partial<Recipe> = {}): Recipe => ({
  id, name: `Rett ${id}`, minutes: 20, baseServings: 4, vegetarian: true, protein: id, allergens: [], steps: [],
  lines: lines.map(([ingredient, amount]) => ({ ingredient, amount })), ...extra,
});
const prod = (id: string, ingredient: string, size: number, extra: Partial<Product> = {}): Product =>
  ({ id, ingredient, name: `${id} ${size}`, size, allergens: [], allergenKnown: true, ...extra });
const price = (productId: string, ore: number, extra: Partial<PriceObs> = {}): PriceObs =>
  ({ productId, storeId: 'S1', ore, status: 'ordinær', source: 'Test', observed: '2026-11-20', ...extra });

/** Liten katalog: hver regel testes uten demodata. Alle retter er for 4 porsjoner. */
function mini(): Catalog {
  return {
    ingredients: [
      ing('a'), ing('b'), ing('c', 'stk'), ing('d', 'ml'), ing('e'), ing('fisk', 'g', { tags: ['fisk'] }),
      ing('salt', 'g', { staple: true }), ing('x'),
    ],
    recipes: [
      rec('ab', [['a', 400], ['b', 400], ['salt', 5]]),
      rec('ac', [['a', 400], ['c', 2]]),
      rec('ad', [['a', 400], ['d', 400]], { minutes: 50 }),
      rec('afisk', [['a', 400], ['fisk', 400]], { vegetarian: false, allergens: ['fisk'] }),
      rec('ae', [['a', 400], ['e', 400]]),
    ],
    products: [
      prod('pa', 'a', 500), prod('pb', 'b', 400), prod('pc', 'c', 6), prod('pd', 'd', 1000), prod('pfisk', 'fisk', 400),
      // Vare e har bare et produkt med uavklart allergenstatus.
      prod('pe', 'e', 400, { allergenKnown: false }),
    ],
    prices: [price('pa', 2000), price('pb', 3000), price('pc', 1500), price('pd', 2500), price('pfisk', 8000), price('pe', 1000)],
    stores: [{ id: 'S1', name: 'Butikk 1', scope: 'utsalg' }, { id: 'S2', name: 'Butikk 2', scope: 'utsalg' }],
  };
}
const settings = (over: Partial<Settings> = {}): Settings => ({ ...defaultSettings, storeIds: ['S1'], regularStoreId: 'S1', ...over });
const ctx = (over: Partial<Settings> = {}, cat: Catalog = mini()): Ctx => ({ catalog: cat, settings: settings(over), shopDate: SHOP });
const have = (ingredient: string, amount: number | null, soon = false): HaveItem => ({ ingredient, amount, soon });
const opts = { portions: 4, storeIds: ['S1'] };
const ids = (r: ReturnType<typeof cookNow>) => r.suggestions.map((s) => s.recipe.id);

describe('Lag nå: forslag fra det som finnes hjemme', () => {
  it('rangerer etter andel som finnes, mengdebevisst, og viser hva som finnes og mangler', () => {
    const r = cookNow([have('a', 400), have('b', 100)], ctx(), opts);
    const ab = r.suggestions.find((s) => s.recipe.id === 'ab')!;
    // a dekket helt, b 100 av 400 g: (1 + 0,25) / 2. Salt er basisvare og teller ikke.
    expect(ab.coverage).toBeCloseTo(0.625);
    expect(ab.lines.map((l) => [l.ingredient, l.state])).toEqual([['a', 'har'], ['b', 'delvis']]);
    expect(ab.missing.map((l) => [l.ingredient, l.need, l.packs, l.costOre])).toEqual([['b', 300, 1, 3000]]);
    expect(ab.missingCostOre).toBe(3000);
    expect(ab.priceComplete).toBe(true);
    expect(ab.minutes).toBe(20);
    expect(ab.portions).toBe(4);
    expect(ids(r)[0]).toBe('ab');
  });

  it('skalerer behovet til porsjonene: 400 g pasta holder til 4 porsjoner, ikke til 8', () => {
    const four = cookNow([have('a', 400), have('b', 400)], ctx(), opts).suggestions.find((s) => s.recipe.id === 'ab')!;
    expect(four.coverage).toBe(1);
    expect(four.missing).toEqual([]);
    expect(four.missingCostOre).toBe(0);
    const eight = cookNow([have('a', 400), have('b', 400)], ctx(), { ...opts, portions: 8 }).suggestions.find((s) => s.recipe.id === 'ab')!;
    expect(eight.coverage).toBeCloseTo(0.5);
    expect(eight.missing.map((l) => [l.ingredient, l.need])).toEqual([['a', 400], ['b', 400]]);
  });

  it('en vare med ukjent mengde regnes som funnet, men merkes', () => {
    const s = cookNow([have('a', null), have('c', 2)], ctx(), opts).suggestions.find((x) => x.recipe.id === 'ac')!;
    expect(s.coverage).toBe(1);
    expect(s.lines.find((l) => l.ingredient === 'a')).toMatchObject({ state: 'har', have: null });
    expect(s.unknownAmounts).toEqual(['a']);
    expect(s.missing).toEqual([]);
  });

  it('er deterministisk: samme inndata gir samme svar, uavhengig av rekkefølge i inndata og katalog', () => {
    const h = [have('a', 300, true), have('b', 400), have('c', 1), have('d', null)];
    const first = JSON.stringify(cookNow(h, ctx(), opts));
    expect(JSON.stringify(cookNow(h, ctx(), opts))).toBe(first);
    expect(JSON.stringify(cookNow(h, ctx(), opts))).toBe(first);
    const m = mini();
    const reversed: Catalog = {
      ingredients: [...m.ingredients].reverse(), recipes: [...m.recipes].reverse(), products: [...m.products].reverse(),
      prices: [...m.prices].reverse(), stores: [...m.stores].reverse(),
    };
    expect(JSON.stringify(cookNow([...h].reverse(), ctx({}, reversed), opts))).toBe(first);
  });

  it('endrer aldri inndata', () => {
    const h = [have('a', 300, true), have('b', 400)];
    const c = ctx();
    const before = JSON.stringify({ h, c });
    cookNow(h, c, opts);
    expect(JSON.stringify({ h, c })).toBe(before);
  });

  it('«må brukes snart» løfter en rett som bruker varen', () => {
    // ab og ac har samme dekning: a finnes, og bare en ubetydelig rest av b og c. Uten «snart» avgjør prisen på det
    // som mangler (c 15 kr < b 30 kr), så ac kommer før ab.
    const base = [have('a', 400), have('b', 0.0001), have('c', 0.0001)];
    const without = ids(cookNow(base, ctx(), opts));
    expect(without.indexOf('ac')).toBeLessThan(without.indexOf('ab'));
    const soonB = ids(cookNow([have('a', 400), have('b', 0.0001, true), have('c', 0.0001)], ctx(), opts));
    expect(soonB.indexOf('ab')).toBeLessThan(soonB.indexOf('ac'));
    const s = cookNow([have('a', 400), have('b', 0.0001, true)], ctx(), opts).suggestions.find((x) => x.recipe.id === 'ab')!;
    expect(s.soonUsed).toEqual(['b']);
    expect(s.lines.find((l) => l.ingredient === 'b')!.soon).toBe(true);
  });

  it('«må brukes snart» kan løfte en rett over en med litt høyere dekning', () => {
    // ae: a + e (e finnes litt og må brukes). ab: a finnes, b finnes 40 %. Uten «snart» vinner ab.
    const h = (soon: boolean) => [have('a', 400), have('b', 160), have('e', 40, soon)];
    expect(ids(cookNow(h(false), ctx(), opts))[0]).toBe('ab');
    expect(ids(cookNow(h(true), ctx(), opts))[0]).toBe('ae');
  });

  it('allergi vinner: en rett med et allergen i filteret foreslås aldri, heller ikke med full dekning og «snart»', () => {
    const h = [have('a', 400), have('fisk', 400, true)];
    expect(ids(cookNow(h, ctx(), opts))[0]).toBe('afisk');
    const r = cookNow(h, ctx({ avoid: ['fisk'] }), opts);
    expect(ids(r)).not.toContain('afisk');
    expect(r.excludedByRequirement).toBe(1);
  });

  it('kost og råvarer er absolutte filtre', () => {
    const h = [have('a', 400), have('fisk', 400)];
    expect(ids(cookNow(h, ctx({ vegetarian: true }), opts))).not.toContain('afisk');
    expect(ids(cookNow(h, ctx({ avoidFoods: ['fisk'] }), opts))).not.toContain('afisk');
  });

  it('uavklart allergenstatus godkjennes aldri ved aktivt filter: varen får ukjent pris', () => {
    const h = [have('a', 400)];
    const free = cookNow(h, ctx(), opts).suggestions.find((s) => s.recipe.id === 'ae')!;
    expect(free.missing[0]).toMatchObject({ ingredient: 'e', status: 'ordinær', costOre: 1000 });
    const filtered = cookNow(h, ctx({ avoid: ['melk'] }), opts).suggestions.find((s) => s.recipe.id === 'ae')!;
    expect(filtered.missing[0]).toMatchObject({ ingredient: 'e', status: 'ukjent', costOre: null });
    expect(filtered.priceComplete).toBe(false);
    expect(filtered.unknownCount).toBe(1);
  });

  it('ukjent pris vinner aldri: lik dekning, men ufullstendig prisgrunnlag rangeres etter kjent pris', () => {
    // ab (b koster 30 kr) og ae (e har ukjent pris ved allergifilter, delsum 0 kr). Samme dekning og antall mangler.
    const r = cookNow([have('a', 400)], ctx({ avoid: ['melk'] }), opts);
    const order = ids(r);
    expect(order.indexOf('ab')).toBeLessThan(order.indexOf('ae'));
    const ae = r.suggestions.find((s) => s.recipe.id === 'ae')!;
    expect(ae.missingCostOre).toBe(0); // kjent delsum, ikke en pris
    expect(ae.priceComplete).toBe(false);
  });

  it('en vare uten pris i butikken gir ufullstendig prisgrunnlag', () => {
    const c = mini();
    c.prices = c.prices.filter((p) => p.productId !== 'pc');
    const s = cookNow([have('a', 400)], ctx({}, c), opts).suggestions.find((x) => x.recipe.id === 'ac')!;
    expect(s.priceComplete).toBe(false);
    expect(s.missing[0]).toMatchObject({ ingredient: 'c', status: 'ukjent', costOre: null });
  });

  it('en gammel pris er bare estimat', () => {
    const c = mini();
    c.prices = c.prices.map((p) => (p.productId === 'pb' ? { ...p, observed: '2026-10-01' } : p));
    const s = cookNow([have('a', 400)], ctx({}, c), opts).suggestions.find((x) => x.recipe.id === 'ab')!;
    expect(s.missing[0]).toMatchObject({ ingredient: 'b', status: 'estimat', costOre: 3000 });
    expect(s.estimatedCount).toBe(1);
    expect(s.priceComplete).toBe(true);
  });

  it('prisen på det som mangler hentes bare fra butikkene som er oppgitt', () => {
    const c = mini();
    c.prices = c.prices.map((p) => (p.productId === 'pb' ? { ...p, storeId: 'S2' } : p));
    const s1 = cookNow([have('a', 400)], ctx({}, c), opts).suggestions.find((x) => x.recipe.id === 'ab')!;
    expect(s1.priceComplete).toBe(false);
    const s2 = cookNow([have('a', 400)], ctx({}, c), { ...opts, storeIds: ['S2'] }).suggestions.find((x) => x.recipe.id === 'ab')!;
    expect(s2.missing[0]).toMatchObject({ storeId: 'S2', costOre: 3000 });
  });

  it('tidsvalget filtrerer', () => {
    const r = cookNow([have('a', 400), have('d', 400)], ctx(), { ...opts, maxMinutes: 30 });
    expect(ids(r)).not.toContain('ad');
    expect(r.excludedByTime).toBe(1);
  });

  it('tom tilstand: ingen varer, ingen dekning og ingen porsjoner gir tydelig grunn og ingen forslag', () => {
    expect(cookNow([], ctx(), opts)).toMatchObject({ suggestions: [], empty: 'ingen-varer' });
    expect(cookNow([have('x', 500)], ctx(), opts)).toMatchObject({ suggestions: [], empty: 'ingen-dekning' });
    // Bare basisvarer eller mengde 0 teller ikke som varer.
    expect(cookNow([have('salt', 500), have('a', 0)], ctx(), opts)).toMatchObject({ suggestions: [], empty: 'ingen-varer' });
    expect(cookNow([have('a', 400)], ctx(), { ...opts, portions: 0 })).toMatchObject({ suggestions: [], empty: 'ingen-porsjoner' });
    // Bare fisk hjemme og fiskeallergi: den eneste retten med fisk er filtrert bort, så ingenting dekkes.
    expect(cookNow([have('fisk', 400)], ctx({ avoid: ['fisk'] }), opts)).toMatchObject({ suggestions: [], empty: 'ingen-dekning' });
    // Alle retter filtrert bort av tidsvalget.
    expect(cookNow([have('a', 400)], ctx(), { ...opts, maxMinutes: 5 })).toMatchObject({ suggestions: [], empty: 'ingen-retter' });
  });

  it('ugyldige mengder brukes ikke', () => {
    const r = cookNow([have('a', Number.NaN), have('b', -5)], ctx(), opts);
    expect(r.empty).toBe('ingen-varer');
  });

  it('demokatalogen: allergi vinner og alle forslag har synlig prisstatus', () => {
    const c: Ctx = { catalog: demoCatalog, settings: { ...defaultSettings, avoid: ['gluten'] }, shopDate: SHOP };
    const r = cookNow([have('kjottdeig', 400), have('tomat', 800), have('pasta', 400, true)], c, { portions: 4, storeIds: ['demoA'] });
    expect(r.recipeCount).toBe(demoCatalog.recipes.length);
    for (const s of r.suggestions) {
      expect(s.recipe.allergens).not.toContain('gluten');
      for (const l of s.missing) expect(['ordinær', 'tilbud', 'estimat', 'ukjent']).toContain(l.status);
    }
    expect(ids(r)).not.toContain('bolognese');
  });
});

describe('Lag nå: hva som finnes hjemme', () => {
  const stock = { a: 400, b: 200, salt: 50, c: 1e-12 };
  it('bruker bekreftet beholdning, legger til egne varer og retter mengder bare i denne visningen', () => {
    const h = mergeHave(stock, { added: { b: 50, d: null }, removed: [], soon: ['d'] }, mini().ingredients);
    expect(h).toEqual([have('a', 400), have('b', 50), have('d', null, true)]);
  });
  it('en fjernet beholdningsvare regnes ikke med; basisvarer og ukjente varer tas aldri med', () => {
    const h = mergeHave({ ...stock, ukjent: 5 }, { added: {}, removed: ['a'], soon: ['a', 'b'] }, mini().ingredients);
    expect(h).toEqual([have('b', 200, true)]);
  });
  it('er deterministisk og sortert', () => {
    const a = mergeHave(stock, { added: { e: 10, d: 5 }, removed: [], soon: [] }, mini().ingredients);
    expect(a.map((x) => x.ingredient)).toEqual(['a', 'b', 'd', 'e']);
  });
  it('linjeprefiks for «Legg manglende på handlelista» er bundet til rett og vare', () => {
    expect(cookNowLinePrefix('bolognese', 'lok')).toBe('lagnå:bolognese|lok:');
  });
});

describe('Lag nå: KI-utkast skjules ved aktive krav (eierens beslutning 2026-11-22)', () => {
  const DRAFT = { kind: 'egen', by: 'KI-utkast (Claude)', date: '2026-11-22', status: 'utkast' } as const;
  const withDraft = (status: 'utkast' | 'testkokt' | 'godkjent' = 'utkast', kind: 'egen' | 'demo' = 'egen'): Catalog => {
    const c = mini();
    return { ...c, recipes: [...c.recipes, rec('autkast', [['a', 400]], { origin: { ...DRAFT, kind, status } })] };
  };
  const h = [have('a', 400)];

  it('uten filter foreslås utkastet som før (full dekning, øverst)', () => {
    const r = cookNow(h, ctx({}, withDraft()), opts);
    expect(ids(r)[0]).toBe('autkast');
    expect(r.excludedUnreviewed).toBe(0);
  });
  it('aktivt allergifilter: utkastet foreslås aldri, og antallet står for seg', () => {
    const r = cookNow(h, ctx({ avoid: ['sesam'] }, withDraft()), opts);
    expect(ids(r)).not.toContain('autkast');
    expect(r.excludedUnreviewed).toBe(1);
    expect(r.excludedByRequirement).toBe(0); // allergi, kost og råvarer telles for seg
  });
  it('vegetar og råvarekrav utelukker også utkast', () => {
    for (const over of [{ vegetarian: true }, { avoidFoods: ['svin' as const] }]) {
      const r = cookNow(h, ctx(over, withDraft()), opts);
      expect(ids(r)).not.toContain('autkast');
      expect(r.excludedUnreviewed).toBe(1);
    }
  });
  it('testkokt og godkjent slippes inn; demooppskrifter påvirkes ikke', () => {
    for (const cat of [withDraft('testkokt'), withDraft('godkjent'), withDraft('utkast', 'demo')]) {
      const r = cookNow(h, ctx({ avoid: ['sesam'] }, cat), opts);
      expect(ids(r)[0]).toBe('autkast');
      expect(r.excludedUnreviewed).toBe(0);
    }
  });
  it('er deterministisk', () => {
    const c = ctx({ avoid: ['sesam'] }, withDraft());
    expect(JSON.stringify(cookNow(h, c, opts))).toBe(JSON.stringify(cookNow(h, c, opts)));
  });
  it('uavklart allergenstatus gir fortsatt ukjent pris for retter som ikke er utkast', () => {
    const r = cookNow([have('a', 400)], ctx({ avoid: ['sesam'] }, withDraft()), opts);
    const ae = r.suggestions.find((s) => s.recipe.id === 'ae')!;
    expect(ae.priceComplete).toBe(false);
    expect(ae.missing.find((l) => l.ingredient === 'e')!.status).toBe('ukjent');
  });
  it('demokatalogen med filter: ingen av de 25 KI-utkastene foreslås', () => {
    const c: Ctx = { catalog: demoCatalog, settings: { ...defaultSettings, avoid: ['sesam'] }, shopDate: SHOP };
    const r = cookNow([have('kjottdeig', 400), have('bonner', 400), have('purre', 300), have('sotpotet', 800)], c, { portions: 4, storeIds: ['demoA'] });
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions.every((s) => !(s.recipe.origin?.kind === 'egen' && s.recipe.origin.status === 'utkast'))).toBe(true);
    expect(r.excludedUnreviewed).toBe(25);
  });
});
