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

describe('opphav (regel 6)', () => {
  const thirdParty = readFileSync(new URL('../../THIRD_PARTY.md', import.meta.url), 'utf8');
  const licensed: Recipe = { ...recipes[0], id: 'x', origin: { kind: 'lisensiert', by: 'Eksempelkilden AS', date: '2026-12-01', status: 'utkast',
    credit: 'Oppskriften er hentet fra Eksempelkilden.', url: 'https://example.com/oppskrift', license: 'Skriftlig avtale 2026-12-01' } };

  it('hver oppskrift har gyldig opphav, og ingen er lisensiert uten oppføring i THIRD_PARTY.md', () => {
    for (const r of recipes) expect(originProblems(r, thirdParty), r.id).toEqual([]);
  });
  it('de egne oppskriftene er merket som KI-utkast som ikke er testkokt, og ingen har kilde eller lenke', () => {
    const own = recipes.filter((r) => r.origin?.kind === 'egen');
    expect(own.length).toBeGreaterThanOrEqual(25);
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
