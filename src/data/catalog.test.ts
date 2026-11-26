import { describe, expect, it } from 'vitest';
import table from './nutrition.json';
import { catalog, ingredients, products, recipes } from './catalog';
import { defaultSettings } from './defaults';
import { recipeNutrition, type NutritionTable } from '../engine/nutrition';
import { generatePlan, recipeTags } from '../engine/planner';
import { ALLERGENS } from '../engine/allergens';
import type { FoodTag, Recipe, Settings } from '../engine/types';
import { readFileSync } from 'node:fs';
import { originProblems } from './recipeOrigin';
import { recipeBaseText } from '../views/RecipeOrigin';

const t = table.items as unknown as NutritionTable;
const week = defaultSettings.days.map(() => ({ enabled: true, maxMinutes: 60 }));
const plan = (over: Partial<Settings>) => generatePlan({ catalog, settings: { ...defaultSettings, days: week, ...over } });
const uniq = (xs: string[]) => new Set(xs).size === xs.length;

describe('katalog (demodata)', () => {
  it('har minst 28 retter og ingen duplikate id-er', () => {
    expect(recipes.length).toBeGreaterThanOrEqual(28);
    expect(uniq(recipes.map((r) => r.id))).toBe(true);
    expect(uniq(ingredients.map((i) => i.id))).toBe(true);
    expect(uniq(products.map((p) => p.id))).toBe(true);
  });
  it('hver ingrediens i en oppskrift finnes i katalogen, og hvert produkt peker på en ingrediens', () => {
    const ids = new Set(ingredients.map((i) => i.id));
    for (const r of recipes) for (const l of r.lines) expect(ids.has(l.ingredient), `${r.id}: ${l.ingredient}`).toBe(true);
    for (const p of products) expect(ids.has(p.ingredient), p.id).toBe(true);
  });
  it('alle ikke-basisingredienser i oppskrifter har et produkt, og alle oppskrifter har fire porsjoner', () => {
    const withProduct = new Set(products.map((p) => p.ingredient));
    const staples = new Set(ingredients.filter((i) => i.staple).map((i) => i.id));
    for (const r of recipes) {
      expect(r.baseServings).toBe(4);
      for (const l of r.lines) if (!staples.has(l.ingredient)) expect(withProduct.has(l.ingredient), `${r.id}: ${l.ingredient}`).toBe(true);
    }
  });
  it('allergenene til en rett dekker produktenes allergener', () => {
    for (const r of recipes) for (const l of r.lines) for (const p of products.filter((x) => x.ingredient === l.ingredient))
      for (const a of p.allergens) expect(r.allergens, `${r.id} mangler ${a} fra ${p.id}`).toContain(a);
  });
  it('bare gyldige allergener brukes, og alle 14 finnes i modellen', () => {
    const valid = new Set<string>(ALLERGENS);
    for (const r of recipes) for (const a of r.allergens) expect(valid.has(a), `${r.id}: ${a}`).toBe(true);
    for (const p of products) for (const a of p.allergens) expect(valid.has(a), `${p.id}: ${a}`).toBe(true);
  });
  it('merking av kjente allergener: soya, gluten, fisk, skalldyr, egg og melk', () => {
    const al = (id: string) => products.find((p) => p.id === id)!.allergens;
    expect(al('soya150')).toEqual(expect.arrayContaining(['soya', 'gluten']));
    expect(al('tofu400')).toContain('soya');
    expect(al('nud250')).toEqual(expect.arrayContaining(['gluten', 'egg']));
    expect(al('reker300')).toContain('skalldyr');
    expect(al('egg12')).toContain('egg');
    expect(al('melk1')).toContain('melk');
    for (const id of ['svinewok', 'tofuwok', 'kyllingnudler']) {
      const r = recipes.find((x) => x.id === id);
      if (r) expect(r.allergens, id).toContain('soya');
    }
  });
  it('sammensatte og tvilsomme varer er uavklart (aldri gjettet trygge)', () => {
    const unknown = new Set(products.filter((p) => !p.allergenKnown).map((p) => p.id));
    for (const id of ['fk500', 'mak170', 'tort8', 'reker300', 'kokos400', 'nud250']) expect(unknown.has(id), id).toBe(true);
    // Rene råvarer er avklart.
    for (const id of ['egg12', 'melk1', 'laks400', 'kd400', 'tofu400', 'soya150']) expect(unknown.has(id), id).toBe(false);
  });
  it('en uke på 7 dager kan planlegges med hvert enkelt kostkrav uten tomme dager', () => {
    const cases: Partial<Settings>[] = [
      {}, { avoidFoods: ['storfe'] }, { avoidFoods: ['fisk'] }, { avoidFoods: ['svin'] }, { avoidFoods: ['lam'] },
      { avoidFoods: ['skalldyr'] }, { avoidFoods: ['kylling'] }, { avoidFoods: ['belgvekster'] }, { vegetarian: true },
      { avoidFoods: ['storfe', 'svin', 'fisk'] }, { avoidFoods: ['svin', 'lam', 'skalldyr'] },
    ];
    for (const c of cases) {
      const p = plan(c);
      expect(p, JSON.stringify(c)).toHaveLength(7);
      for (const s of p) {
        const r = recipes.find((x) => x.id === s.recipeId)!;
        const tags = recipeTags(r, ingredients);
        for (const f of (c.avoidFoods ?? []) as FoodTag[]) expect(tags.has(f), `${r.id} ${f}`).toBe(false);
        if (c.vegetarian) expect(r.vegetarian).toBe(true);
      }
    }
  });
  it('rettene har rimelig næringsdata', () => {
    for (const r of recipes) {
      const n = recipeNutrition(r, ingredients, t);
      expect(n.missing, r.id).toEqual([]);
      expect(n.kcal, r.id).toBeGreaterThan(150);
      expect(n.kcal, r.id).toBeLessThan(1100);
    }
  });
});

describe('egne oppskrifter, omgang 2 (2026-11-26)', () => {
  // 25 nye egne KI-utkast. Testet før de ble skrevet inn i katalogen (røde, så grønne).
  const ROUND2 = [
    'ertesuppe', 'spinatsuppe', 'blomkalgrateng', 'tofuris', 'bonnesuppe', 'byggotto', 'rotgronnsaker', 'brokkolipasta', 'purresuppe',
    'plukkfisk', 'fiskeboller', 'tunfiskpasta', 'stektlaks', 'rekewok',
    'kjottsuppe', 'brunlapskaus', 'karbonader', 'lasagne', 'helkylling', 'kyllinggryte', 'kyllingwrap', 'kalruletter', 'lammegryte',
    'eggekake', 'svinefiletwok',
  ];
  const NEW_INGREDIENTS = ['gulerter', 'byggryn', 'lasagneplater', 'storfegryte', 'helkylling', 'fiskeboller', 'tunfisk'];
  const round2 = () => ROUND2.map((id) => recipes.find((r) => r.id === id));
  const ANIMAL: FoodTag[] = ['storfe', 'svin', 'lam', 'kylling', 'fisk', 'skalldyr'];
  const prods = (ing: string) => products.filter((p) => p.ingredient === ing);

  it('alle 25 finnes, med gyldig opphav: egen, KI-utkast (Claude), 2026-11-26, utkast, uten kilde eller lenke', () => {
    expect(new Set(ROUND2).size).toBe(25);
    for (const [i, r] of round2().entries()) {
      expect(r, ROUND2[i]).toBeDefined();
      expect(r!.origin, r!.id).toEqual({ kind: 'egen', by: 'KI-utkast (Claude)', date: '2026-11-26', status: 'utkast' });
    }
    // Ingen oppskrift er satt til testkokt eller godkjent.
    expect(recipes.filter((r) => r.origin?.status !== 'utkast').map((r) => r.id)).toEqual([]);
    expect(recipes.filter((r) => r.origin?.kind === 'egen')).toHaveLength(50);
    expect(recipes).toHaveLength(81);
  });
  it('ingen duplikate id-er eller navn i hele katalogen', () => {
    expect(uniq(recipes.map((r) => r.id))).toBe(true);
    expect(uniq(recipes.map((r) => r.name.toLowerCase()))).toBe(true);
  });
  it('hver linje peker på en vare i katalogen med mengde > 0, og hver rett har tid, fire porsjoner og fremgangsmåte', () => {
    const ids = new Set(ingredients.map((i) => i.id));
    for (const r of round2().map((x) => x!)) {
      expect(r.minutes, r.id).toBeGreaterThan(0);
      expect(r.baseServings, r.id).toBe(4);
      expect(r.steps.length, r.id).toBeGreaterThanOrEqual(2);
      for (const s of r.steps) expect(s.trim().length, r.id).toBeGreaterThan(5);
      expect(uniq(r.lines.map((l) => l.ingredient)), `${r.id}: samme vare to ganger`).toBe(true);
      for (const l of r.lines) {
        expect(ids.has(l.ingredient), `${r.id}: ${l.ingredient}`).toBe(true);
        expect(l.amount, `${r.id}: ${l.ingredient}`).toBeGreaterThan(0);
        expect(Number.isFinite(l.amount)).toBe(true);
      }
    }
  });
  it('allergenene er utledet fra varene: nøyaktig foreningen av produktenes allergener, ingen gjettet fra teksten', () => {
    for (const r of round2().map((x) => x!)) {
      const fromProducts = new Set(r.lines.flatMap((l) => prods(l.ingredient).flatMap((p) => p.allergens)));
      expect(new Set(r.allergens), r.id).toEqual(fromProducts);
      expect(uniq(r.allergens), r.id).toBe(true);
    }
  });
  it('uavklart allergenstatus (sammensatte varer) er uavklart, ikke «fri»', () => {
    const unknownIn = (r: Recipe) => r.lines.flatMap((l) => prods(l.ingredient)).filter((p) => !p.allergenKnown).map((p) => p.id).sort();
    const withUnknown = Object.fromEntries(round2().map((r) => [r!.id, unknownIn(r!)]).filter(([, ps]) => ps.length > 0));
    expect(withUnknown).toEqual({
      fiskeboller: ['fbol560'], kyllingwrap: ['tort8'], lasagne: ['lasag500'], rekewok: ['reker300'],
    });
    // Fiskeboller og lasagneplater er sammensatte/ulike mellom merker: uavklart.
    for (const id of ['fbol560', 'lasag500']) expect(products.find((p) => p.id === id)!.allergenKnown, id).toBe(false);
    // Rene råvarer og enkle tørrvarer er avklart.
    for (const id of ['guler500', 'bygg600', 'storf600', 'helkyl1200', 'tun185']) expect(products.find((p) => p.id === id)!.allergenKnown, id).toBe(true);
    expect(products.find((p) => p.id === 'bygg600')!.allergens).toContain('gluten');
    expect(products.find((p) => p.id === 'tun185')!.allergens).toContain('fisk');
  });
  it('vegetar stemmer med varene, og kjøtt-, fisk- og skalldyrvarer har kosttagg', () => {
    for (const r of round2().map((x) => x!)) {
      const tags = recipeTags(r, ingredients);
      expect(r.vegetarian, r.id).toBe(!ANIMAL.some((t) => tags.has(t)));
      if (!r.vegetarian && (ANIMAL as string[]).includes(r.protein)) expect(tags.has(r.protein as FoodTag), r.id).toBe(true);
    }
    const tag = (id: string) => ingredients.find((i) => i.id === id)!.tags;
    expect(tag('gulerter')).toContain('belgvekster');
    expect(tag('storfegryte')).toContain('storfe');
    expect(tag('helkylling')).toContain('kylling');
    expect(tag('fiskeboller')).toContain('fisk');
    expect(tag('tunfisk')).toContain('fisk');
  });
  it('nye varer har produkt, demopris merket «Demodata» og næring fra Matvaretabellen', () => {
    for (const id of NEW_INGREDIENTS) {
      expect(ingredients.find((i) => i.id === id), id).toBeDefined();
      const ps = prods(id);
      expect(ps.length, id).toBeGreaterThan(0);
      const obs = catalog.prices.filter((o) => ps.some((p) => p.id === o.productId));
      expect(obs.length, id).toBeGreaterThan(0);
      for (const o of obs) expect(o.source, id).toBe('Demodata');
      expect(t[id], id).toBeDefined();
      expect(t[id].kcalPer100g, id).toBeGreaterThan(0);
    }
    // Næringsfilen krediterer kilden.
    expect(table.source).toContain('Matvaretabellen');
  });
  it('øker variasjonen: vegetar, fisk, raske og lange retter, uten gluten og melk, og flere proteiner', () => {
    const rs = round2().map((x) => x!);
    const free = (r: Recipe) => !r.allergens.includes('gluten') && !r.allergens.includes('melk');
    expect(rs.filter((r) => r.vegetarian).length).toBeGreaterThanOrEqual(8);
    expect(rs.filter((r) => ['fisk', 'skalldyr'].includes(r.protein)).length).toBeGreaterThanOrEqual(4);
    expect(rs.filter((r) => r.minutes < 30).length).toBeGreaterThanOrEqual(8);
    expect(rs.filter((r) => r.minutes >= 60).length).toBeGreaterThanOrEqual(5);
    expect(rs.filter(free).length).toBeGreaterThanOrEqual(10);
    expect(new Set(rs.map((r) => r.protein)).size).toBeGreaterThanOrEqual(10);
    // Hele katalogen: minst 20 vegetarretter og 30 uten gluten.
    expect(recipes.filter((r) => r.vegetarian).length).toBeGreaterThanOrEqual(20);
    expect(recipes.filter((r) => !r.allergens.includes('gluten')).length).toBeGreaterThanOrEqual(30);
  });
  it('fremgangsmåten lover aldri allergenfrihet, og ingen rett har sesam (forutsetning i planner.test.ts)', () => {
    for (const r of round2().map((x) => x!)) {
      expect([r.name, ...r.steps].join(' '), r.id).not.toMatch(/(allergen|gluten|laktose|melke|egg)fri/i);
    }
    expect(recipes.filter((r) => r.allergens.includes('sesam'))).toEqual([]);
  });
});

describe('opphav (regel 6)', () => {
  const thirdParty = readFileSync(new URL('../../THIRD_PARTY.md', import.meta.url), 'utf8');
  const licensed: Recipe = { ...recipes[0], id: 'x', origin: { kind: 'lisensiert', by: 'Eksempelkilden AS', date: '2026-12-01', status: 'utkast',
    credit: 'Oppskriften er hentet fra Eksempelkilden.', url: 'https://example.com/oppskrift', license: 'Skriftlig avtale 2026-12-01' } };

  it('hver oppskrift har gyldig opphav, og ingen er lisensiert uten oppføring i THIRD_PARTY.md', () => {
    for (const r of recipes) expect(originProblems(r, thirdParty), r.id).toEqual([]);
  });
  it('de egne oppskriftene er merket som KI-utkast som ikke er testkokt, og ingen har kilde eller lenke', () => {
    const own = recipes.filter((r) => r.origin?.kind === 'egen');
    expect(own.length).toBeGreaterThanOrEqual(50);
    for (const r of own) {
      expect(r.origin, r.id).toMatchObject({ by: 'KI-utkast (Claude)', status: 'utkast' });
      expect(r.origin?.url, r.id).toBeUndefined();
    }
  });
  it('en lisensiert oppskrift avvises uten kreditering, https-lenke, vilkår eller rettighetshaver i THIRD_PARTY.md', () => {
    expect(originProblems(licensed, 'Eksempelkilden AS: avtale')).toEqual([]);
    expect(originProblems(licensed, thirdParty).join()).toContain('står ikke i THIRD_PARTY.md');
    const o = licensed.origin!;
    expect(originProblems({ ...licensed, origin: { ...o, credit: '' } }, o.by).join()).toContain('uten kreditering');
    expect(originProblems({ ...licensed, origin: { ...o, url: 'http://example.com/x' } }, o.by).join()).toContain('https-lenke');
    expect(originProblems({ ...licensed, origin: { ...o, license: undefined } }, o.by).join()).toContain('uten vilkår');
    expect(originProblems({ ...recipes[0], origin: undefined }, '').join()).toContain('mangler opphav');
    expect(originProblems({ ...recipes[0], origin: { ...recipes[0].origin!, url: 'https://example.com/x' } }, '').join()).toContain('skal ikke ha kilde');
  });
  it('teksten om oppskriftsbasen sier hvor mange som er utkast og om noen er fra andre kilder', () => {
    expect(recipeBaseText(recipes)).toBe(`Oppskriftsbasen er liten: ${recipes.length} oppskrifter skrevet for Husvett, ingen fra andre kilder. ${recipes.length} av dem er utkast som ikke er testkokt.`);
    expect(recipeBaseText([...recipes, licensed])).toContain('og 1 fra kilder med tillatelse.');
  });
});
