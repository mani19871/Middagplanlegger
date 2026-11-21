import type { Allergen } from './types';

/** Norsk visning av de 14 EU-allergenene. Record gjør at en ny verdi i `Allergen` gir kompileringsfeil til den får navn her. */
export const ALLERGEN_LABEL: Record<Allergen, string> = {
  gluten: 'gluten (hvete, rug, bygg, havre)',
  melk: 'melk (inkl. laktose)',
  egg: 'egg',
  fisk: 'fisk',
  skalldyr: 'skalldyr (reker, krabbe, hummer)',
  blotdyr: 'bløtdyr (skjell, blekksprut)',
  soya: 'soya',
  peanotter: 'peanøtter',
  notter: 'nøtter (mandel, hasselnøtt, valnøtt m.fl.)',
  selleri: 'selleri',
  sennep: 'sennep',
  sesam: 'sesam',
  lupin: 'lupin',
  sulfitt: 'svoveldioksid og sulfitt',
};

/** Rekkefølgen i valglisten: de vanligste først. */
export const ALLERGENS = Object.keys(ALLERGEN_LABEL) as Allergen[];
