// Synlig allergentekst på hver rett og handlelinje, uansett om et filter er satt. Kostkrav og allergier synkes ikke
// mellom enheter (docs/synk.md), så en voksen på en enhet uten filter må kunne se innholdet selv. Garanterer aldri
// allergenfrihet (CLAUDE.md regel 4).
import { ALLERGEN_LABEL } from '../engine/allergens';
import type { Allergen, Catalog, Recipe } from '../engine/types';

const short = (a: Allergen) => ALLERGEN_LABEL[a].split(' (')[0];
const list = (as: Allergen[]) => as.map(short).join(', ');

/** «Inneholder: gluten, melk. Noen varer kan også inneholde: egg. Sjekk pakningen.» */
export function recipeAllergenText(r: Recipe, catalog: Catalog): string {
  const ings = new Set(r.lines.map((l) => l.ingredient));
  const products = catalog.products.filter((p) => ings.has(p.ingredient));
  const extra = [...new Set(products.flatMap((p) => p.allergens))].filter((a) => !r.allergens.includes(a)).sort();
  const parts = [r.allergens.length > 0 ? `Inneholder: ${list(r.allergens)}` : 'Ingen av de 14 allergenene er oppgitt for retten'];
  if (extra.length > 0) parts.push(`Noen varer kan også inneholde: ${list(extra)}`);
  if (products.some((p) => !p.allergenKnown)) parts.push('Innholdet i noen varer er ikke avklart');
  return `${parts.join('. ')}. Sjekk pakningen.`;
}

/** Allergentekst for en vare i handlelista. Uten kjent produkt er innholdet ukjent. */
export function productAllergenText(productId: string | null, catalog: Catalog): string {
  const p = productId ? catalog.products.find((x) => x.id === productId) : undefined;
  if (!p) return 'Innhold ukjent. Sjekk pakningen.';
  if (!p.allergenKnown) return 'Innholdet er ikke avklart. Sjekk pakningen.';
  return p.allergens.length > 0 ? `Inneholder: ${list(p.allergens)}` : 'Ingen av de 14 allergenene er oppgitt';
}
