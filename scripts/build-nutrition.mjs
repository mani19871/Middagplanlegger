// Bygger src/data/nutrition.json fra Matvaretabellens åpne API (https://www.matvaretabellen.no/api/).
// Kilde skal krediteres. Tallene gjelder generelle matvarer, ikke en bestemt ferdigvare, og sier ikke noe om allergenstatus.
// Kjør: node scripts/build-nutrition.mjs
import { readFile, writeFile } from 'node:fs/promises';

const MAP = {
  pasta: '05.016', tomat: '06.070', kjottdeig: '03.397', lok: '06.042', ris: '05.306', kylling: '03.205',
  kokosmelk: '06.701', torsk: '04.327', poteter: '06.004', gulrot: '06.036', fiskekaker: '04.061', tortilla: '05.381',
  mais: '06.736', paprika: '06.047', ost: '01.039', romme: '01.087', egg: '02.001', melk: '01.292', mel: '05.010',
  brokkoli: '06.018', laks: '04.220', spinat: '06.211', linser: '06.184', bonner: '06.133',
  // Rå/tørr/hermetisk slik varen kjøpes. Svinekotelett = nakkekotelett (med ben), reker = skallfrie i lake.
  svinekotelett: '03.083', svinedeig: '03.348', flesk: '03.090', lammedeig: '03.479', reker: '04.098', sei: '04.029',
  hyse: '04.110', sild: '04.382', makrell: '04.378', kikerter: '06.128', tofu: '06.704', sopp: '06.062', blomkal: '06.016',
  kalrot: '06.041', soyasaus: '10.126', nudler: '05.222',
  // Egne oppskrifter, omgang 1. Kyllinglår og fårikålkjøtt er med ben (spiselig andel fra Matvaretabellen).
  hodekal: '06.037', purre: '06.284', erter: '06.027', sotpotet: '06.136', kyllinglar: '03.332', svinefilet: '03.209',
  farikalkjott: '03.218', kjottpolse: '03.145', matflote: '01.175', tomatpure: '06.080',
  // Egne oppskrifter, omgang 2. Lasagneplater = tørr pasta; hel kylling med skinn og ben (spiselig andel fra Matvaretabellen);
  // fiskeboller og tunfisk avrent; grytekjøtt = storfekjøtt, rått.
  gulerter: '06.029', byggryn: '05.001', lasagneplater: '05.016', storfegryte: '03.476', helkylling: '03.006',
  fiskeboller: '04.079', tunfisk: '04.108',
};
// Omregning til gram, hentet fra matvarens egne porsjonsopplysninger der de finnes.
// Oppskriftene bruker filet, ikke hel fisk, så spiselig andel settes til 100 %.
const EDIBLE_OVERRIDE = { torsk: 100, sei: 100, hyse: 100, sild: 100 };
const PORTION = { lok: ['stk', 'stk'], paprika: ['stk', 'stk'], egg: ['stk', 'stk'], tortilla: ['stk (liten)', 'stk'], kokosmelk: ['desiliter', 'dl'], romme: ['desiliter', 'dl'], soyasaus: ['desiliter', 'dl'], matflote: ['desiliter', 'dl'] };

// FOODS_JSON=<fil> bruker en lokal kopi av foods.json (nyttig bak proxy der Node-fetch ikke virker).
let data;
if (process.env.FOODS_JSON) data = JSON.parse(await readFile(process.env.FOODS_JSON, 'utf8'));
else {
  const res = await fetch('https://www.matvaretabellen.no/api/nb/foods.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  data = await res.json();
}
const { foods } = data;
const byId = new Map(foods.map((f) => [f.foodId, f]));
const q = (f, id) => f.constituents.find((c) => c.nutrientId === id)?.quantity ?? null;

const items = {};
for (const [ing, foodId] of Object.entries(MAP)) {
  const f = byId.get(foodId);
  if (!f) throw new Error(`Fant ikke ${foodId} for ${ing}`);
  const entry = {
    foodId, foodName: f.foodName, kcalPer100g: f.calories.quantity, proteinPer100g: q(f, 'Protein'), fatPer100g: q(f, 'Fett'),
    carbsPer100g: q(f, 'Karbo'), fiberPer100g: q(f, 'Fiber'), saltPer100g: q(f, 'NaCl'), ediblePercent: EDIBLE_OVERRIDE[ing] ?? f.ediblePart?.percent ?? 100,
  };
  const p = PORTION[ing];
  if (p) {
    const portion = f.portions.find((x) => x.portionName === p[0]);
    if (!portion) throw new Error(`Mangler porsjon ${p[0]} for ${ing}`);
    if (p[1] === 'dl') entry.gramsPerMl = portion.quantity / 100;
    else entry.gramsPerPiece = portion.quantity;
  }
  items[ing] = entry;
}
await writeFile(new URL('../src/data/nutrition.json', import.meta.url), JSON.stringify({
  source: 'Matvaretabellen (Mattilsynet)', url: 'https://www.matvaretabellen.no/', note: 'Per 100 g spiselig del. Genererte data, se scripts/build-nutrition.mjs.', items,
}, null, 2) + '\n');
console.log(`Skrev ${Object.keys(items).length} ingredienser`);
