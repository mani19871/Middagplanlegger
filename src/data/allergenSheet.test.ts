import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { catalog, recipes } from './catalog';
import { ALLERGENS } from '../engine/allergens';
import { allergenSheet, hasReviewEntries, possibleDeviations, sheetRecipeIds } from './allergenSheet';
import type { Catalog } from '../engine/types';

const root = new URL('../../', import.meta.url);

describe('allergenark (docs/allergen-gjennomgang.md)', () => {
  const md = allergenSheet(catalog);
  const sectionOf = (id: string) => md.split(/^### \d+\. /m).find((s) => s.split('\n')[0].endsWith(`(\`${id}\`)`));

  it('dekker alle oppskrifter, hver med en egen seksjon og tomme felt for gjennomgangen', () => {
    expect(sheetRecipeIds(md)).toEqual(recipes.map((r) => r.id));
    expect(recipes.length).toBeGreaterThanOrEqual(56);
    for (const r of recipes) {
      const section = sectionOf(r.id);
      expect(section, r.id).toBeDefined();
      for (const field of ['Allergener stemmer:', 'Kosttagger stemmer:', 'Kommentar:', 'Gjennomgått av (rolle, ikke navn):', 'Dato (ÅÅÅÅ-MM-DD):'])
        expect(section, `${r.id}: ${field}`).toContain(field);
      expect(section, r.id).toContain('[ ] ja');
      expect(section, r.id).not.toMatch(/\[[xX]\]/);
    }
  });

  it('viser hver vare med mengde og allergener fra koden, og navngir uavklarte varer', () => {
    for (const r of recipes) {
      const section = sectionOf(r.id)!;
      for (const l of r.lines) {
        const ing = catalog.ingredients.find((i) => i.id === l.ingredient)!;
        expect(section, `${r.id}: ${ing.name}`).toContain(`| ${ing.name} | ${l.amount} ${ing.unit} |`);
      }
    }
    // Uavklarte varer er merket i tabellen og samlet i en egen oversikt.
    const unknown = catalog.products.filter((p) => !p.allergenKnown);
    expect(unknown.length).toBeGreaterThan(0);
    for (const p of unknown) expect(md, p.id).toContain(p.name);
    expect(md).toContain('uavklart');
  });

  it('har forklaring på norsk i toppen, og nevner at origin.status bare settes til godkjent etter kontroll av en person', () => {
    const top = md.slice(0, md.indexOf('\n## Oversikt'));
    expect(top).toContain('Slik gjennomgår du arket');
    expect(top).toContain('uavklart');
    expect(top).toContain('Mulige avvik funnet av skriptet');
    expect(top).toContain('origin.status');
    expect(top).toContain('godkjent');
    expect(top).toMatch(/ikke endre koden/i);
    // Alle 14 allergener står i forklaringen.
    for (const a of ALLERGENS) expect(top, a).toContain(`\`${a}\``);
  });

  it('inneholder ikke personnavn eller e-post, og lover ikke allergenfrihet', () => {
    expect(md).not.toMatch(/@[a-z]+\./i);
    expect(md).not.toMatch(/mani/i);
    expect(md).not.toMatch(/allergenfri\b(?!het)/i);
    expect(md).toMatch(/garanterer aldri allergenfrihet/);
  });

  it('et blankt ark regnes ikke som utfylt, men avkrysning, kommentar, rolle eller dato gjør det (skriptet overskriver ikke utfylt arbeid)', () => {
    expect(hasReviewEntries(md)).toBe(false);
    expect(hasReviewEntries(md.replace('- Allergener stemmer: [ ] ja', '- Allergener stemmer: [x] ja'))).toBe(true);
    expect(hasReviewEntries(md.replace('- Kommentar:\n', '- Kommentar: sjekk karri\n'))).toBe(true);
    expect(hasReviewEntries(md.replace('- Gjennomgått av (rolle, ikke navn):\n', '- Gjennomgått av (rolle, ikke navn): redaktør\n'))).toBe(true);
    expect(hasReviewEntries(md.replace('- Dato (ÅÅÅÅ-MM-DD):\n', '- Dato (ÅÅÅÅ-MM-DD): 2026-12-01\n'))).toBe(true);
    expect(hasReviewEntries(md.replace('| [ ] |\n', '| [x] |\n'))).toBe(true);
  });

  it('er deterministisk (samme katalog gir samme ark)', () => {
    expect(allergenSheet(catalog)).toBe(md);
  });

  it('finner mulige avvik: vare uten merking, vegetarflagg mot kosttagger og ord i fremgangsmåten som ikke er vare', () => {
    const bad: Catalog = JSON.parse(JSON.stringify(catalog));
    const r = bad.recipes.find((x) => x.id === 'linsegryte')!;
    r.vegetarian = false; // ingen dyretagger, men ikke vegetar
    const t = bad.recipes.find((x) => x.id === 'tofuwok')!;
    t.lines.push({ ingredient: 'kjottdeig', amount: 100 }); // vegetar med storfe
    const k = bad.recipes.find((x) => x.id === 'karri')!;
    k.steps.push('Smak til med buljong.');
    const found = possibleDeviations(bad).map((d) => `${d.recipeId}:${d.kind}`);
    expect(found).toContain('linsegryte:vegetar-uten-dyretagg');
    expect(found).toContain('tofuwok:vegetar-med-dyretagg');
    expect(found).toContain('karri:ord-i-steg');
    const m = bad.recipes.find((x) => x.id === 'taco')!;
    m.allergens = ['gluten']; // melk fra ost og rømme mangler
    expect(possibleDeviations(bad).map((d) => `${d.recipeId}:${d.kind}`)).toContain('taco:allergen-mangler-i-rett');
    const e = bad.recipes.find((x) => x.id === 'ovnstorsk')!;
    e.allergens = ['fisk', 'sesam']; // sesam finnes ikke i noen vare
    expect(possibleDeviations(bad).map((d) => `${d.recipeId}:${d.kind}`)).toContain('ovnstorsk:allergen-uten-vare');
  });

  it('skriptet kjører uten nettverk og uten feil på nåværende katalog, og arket i docs/ dekker alle oppskrifter', () => {
    const out = execFileSync('npx', ['tsx', 'scripts/allergen-ark.ts', '--stdout'], { cwd: root, encoding: 'utf8', timeout: 60_000 });
    expect(sheetRecipeIds(out)).toEqual(recipes.map((r) => r.id));
    const file = new URL('docs/allergen-gjennomgang.md', root);
    expect(existsSync(file), 'kjør npm run allergen-ark').toBe(true);
    expect(sheetRecipeIds(readFileSync(file, 'utf8'))).toEqual(recipes.map((r) => r.id));
  });
});
