// Lager docs/allergen-gjennomgang.md: ark for at en person skal kontrollere allergenmerking og kosttagger for alle oppskrifter.
// Leser bare koden (src/data/catalog.ts). Ingen nettverk. Kjør: npm run allergen-ark
//   --stdout    skriv arket til skjermen i stedet for til filen
//   --overstyr  overskriv filen selv om noen har krysset av (ta vare på den gamle først)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { catalog } from '../src/data/catalog';
import { allergenSheet, hasReviewEntries, possibleDeviations } from '../src/data/allergenSheet';

const target = new URL('../docs/allergen-gjennomgang.md', import.meta.url);
const md = allergenSheet(catalog);

if (process.argv.includes('--stdout')) {
  process.stdout.write(md);
} else {
  if (existsSync(target) && !process.argv.includes('--overstyr') && hasReviewEntries(readFileSync(target, 'utf8'))) {
    console.error('FEIL: docs/allergen-gjennomgang.md har utfylte felt. Skriptet overskriver ikke utfylt arbeid.');
    console.error('Ta vare på filen først, og kjør så på nytt med --overstyr.');
    process.exit(1);
  }
  writeFileSync(target, md);
  console.log(`ok   ${catalog.recipes.length} oppskrifter skrevet til docs/allergen-gjennomgang.md; ${possibleDeviations(catalog).length} mulige avvik`);
}
