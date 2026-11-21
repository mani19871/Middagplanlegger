// DEMODATA: oppdiktede butikker og priser for å vise hvordan appen fungerer.
// Ekte prisdata avklares i fase 0 (Kassalapp, Tjek, kjedeavtaler).
import type { Catalog, Ingredient, PriceObs, Product, Recipe, Store } from '../engine/types';

const I = (id: string, name: string, unit: Ingredient['unit'], department: string, staple = false): Ingredient =>
  ({ id, name, unit, department, staple });
export const ingredients: Ingredient[] = [
  I('pasta', 'Pasta', 'g', 'Tørrvarer'), I('tomat', 'Hakkede tomater', 'g', 'Hermetikk'),
  I('kjottdeig', 'Kjøttdeig', 'g', 'Kjøtt og fisk'), I('lok', 'Løk', 'stk', 'Frukt og grønt'),
  I('ris', 'Ris', 'g', 'Tørrvarer'), I('kylling', 'Kyllingfilet', 'g', 'Kjøtt og fisk'),
  I('kokosmelk', 'Kokosmelk', 'ml', 'Hermetikk'), I('torsk', 'Torsk', 'g', 'Kjøtt og fisk'),
  I('poteter', 'Poteter', 'g', 'Frukt og grønt'), I('gulrot', 'Gulrot', 'g', 'Frukt og grønt'),
  I('fiskekaker', 'Fiskekaker', 'g', 'Kjøtt og fisk'), I('tortilla', 'Tortillalefser', 'stk', 'Tørrvarer'),
  I('mais', 'Mais', 'g', 'Hermetikk'), I('paprika', 'Paprika', 'stk', 'Frukt og grønt'),
  I('ost', 'Ost', 'g', 'Meieri'), I('romme', 'Rømme', 'ml', 'Meieri'), I('egg', 'Egg', 'stk', 'Meieri'),
  I('melk', 'Melk', 'ml', 'Meieri'), I('mel', 'Hvetemel', 'g', 'Tørrvarer'),
  I('brokkoli', 'Brokkoli', 'g', 'Frukt og grønt'), I('laks', 'Laks', 'g', 'Kjøtt og fisk'),
  I('spinat', 'Spinat', 'g', 'Frukt og grønt'), I('linser', 'Røde linser', 'g', 'Tørrvarer'),
  I('bonner', 'Kidneybønner', 'g', 'Hermetikk'),
  I('salt', 'Salt og pepper', 'g', 'Krydder', true), I('olje', 'Matolje', 'ml', 'Tørrvarer', true),
];

const R = (
  id: string, name: string, minutes: number, vegetarian: boolean, protein: string,
  allergens: Recipe['allergens'], lines: [string, number][], steps: string[],
): Recipe => ({ id, name, minutes, baseServings: 4, vegetarian, protein, allergens, steps,
  lines: lines.map(([ingredient, amount]) => ({ ingredient, amount })) });

export const recipes: Recipe[] = [
  R('bolognese', 'Spagetti bolognese', 35, false, 'storfe', ['gluten'],
    [['pasta', 400], ['kjottdeig', 400], ['tomat', 800], ['lok', 1], ['olje', 20], ['salt', 5]],
    ['Stek løk og kjøttdeig.', 'Tilsett tomat og la småkoke i 20 min.', 'Kok pasta og server.']),
  R('taco', 'Fredagstaco', 30, false, 'storfe', ['gluten', 'melk'],
    [['kjottdeig', 400], ['tortilla', 8], ['mais', 200], ['paprika', 1], ['ost', 150], ['romme', 200]],
    ['Stek kjøttdeig med krydder.', 'Del opp grønnsaker.', 'Sett frem og la alle bygge sin egen.']),
  R('karri', 'Kylling i karri', 40, false, 'kylling', [],
    [['kylling', 500], ['kokosmelk', 400], ['ris', 300], ['lok', 1]],
    ['Brun kylling og løk.', 'Tilsett kokosmelk og karri, la putre.', 'Server med ris.']),
  R('ovnstorsk', 'Ovnsbakt torsk med rotgrønnsaker', 30, false, 'fisk', ['fisk'],
    [['torsk', 600], ['poteter', 800], ['gulrot', 300], ['olje', 20]],
    ['Skjær poteter og gulrot, bak i 15 min.', 'Legg torsken oppå og bak 12 min til.']),
  R('fiskekaker', 'Fiskekaker med poteter og gulrot', 25, false, 'fisk', ['fisk', 'gluten'],
    [['fiskekaker', 500], ['poteter', 800], ['gulrot', 300]],
    ['Kok poteter og gulrot.', 'Stek fiskekakene.']),
  R('linsegryte', 'Linsegryte', 35, true, 'belgvekster', [],
    [['linser', 300], ['tomat', 400], ['lok', 1], ['gulrot', 300], ['ris', 200]],
    ['Kok linser med løk og gulrot.', 'Tilsett tomat og server med ris.']),
  R('pastaspinat', 'Pasta med spinat og ost', 20, true, 'ost', ['gluten', 'melk'],
    [['pasta', 400], ['spinat', 200], ['ost', 150]],
    ['Kok pasta.', 'Bland inn spinat og revet ost.']),
  R('omelett', 'Omelett med grønnsaker', 20, true, 'egg', ['egg', 'melk'],
    [['egg', 8], ['paprika', 1], ['ost', 100]],
    ['Pisk egg, stek grønnsaker, hell over egg.', 'Topp med ost.']),
  R('lakseris', 'Laks med ris og brokkoli', 30, false, 'fisk', ['fisk'],
    [['laks', 500], ['ris', 300], ['brokkoli', 300]],
    ['Bak laks i 12 min.', 'Kok ris og brokkoli.']),
  R('kyllingwok', 'Kyllingwok', 25, false, 'kylling', [],
    [['kylling', 500], ['ris', 300], ['paprika', 2], ['brokkoli', 300], ['gulrot', 200]],
    ['Stek kylling.', 'Tilsett grønnsaker og wok i 6 min.', 'Server med ris.']),
  R('pannekaker', 'Pannekaker', 25, true, 'egg', ['gluten', 'egg', 'melk'],
    [['mel', 300], ['egg', 4], ['melk', 600]],
    ['Rør røren og la den hvile.', 'Stek tynne pannekaker.']),
  R('bonnechili', 'Bønnechili med ris', 40, true, 'belgvekster', [],
    [['bonner', 500], ['tomat', 800], ['mais', 200], ['lok', 1], ['ris', 300]],
    ['Fres løk, tilsett bønner, tomat og mais.', 'Småkok 25 min og server med ris.']),
  R('kjottkaker', 'Kjøttkaker med poteter', 45, false, 'storfe', ['gluten', 'melk'],
    [['kjottdeig', 600], ['poteter', 1000], ['gulrot', 400], ['melk', 200]],
    ['Form kjøttkaker og stek.', 'Kok poteter og gulrot.']),
  R('fiskesuppe', 'Fiskesuppe', 40, false, 'fisk', ['fisk'],
    [['torsk', 400], ['poteter', 500], ['gulrot', 300], ['kokosmelk', 400]],
    ['Kok poteter og gulrot.', 'Tilsett kokosmelk og torsk, la trekke 8 min.']),
];

const P = (id: string, ingredient: string, name: string, size: number, allergens: Product['allergens'] = [], allergenKnown = true): Product =>
  ({ id, ingredient, name, size, allergens, allergenKnown });
export const products: Product[] = [
  P('pasta500', 'pasta', 'Spagetti 500 g', 500, ['gluten']), P('tomat400', 'tomat', 'Hakkede tomater 400 g', 400),
  P('kd400', 'kjottdeig', 'Kjøttdeig 400 g', 400), P('kd800', 'kjottdeig', 'Kjøttdeig 800 g', 800),
  P('lok3', 'lok', 'Gul løk 3-pk', 3), P('ris1000', 'ris', 'Jasminris 1 kg', 1000),
  P('kyl600', 'kylling', 'Kyllingfilet 600 g', 600), P('kokos400', 'kokosmelk', 'Kokosmelk 400 ml', 400),
  P('torsk400', 'torsk', 'Torskefilet 400 g', 400, ['fisk']), P('pot1500', 'poteter', 'Poteter 1,5 kg', 1500),
  P('gul1000', 'gulrot', 'Gulrot 1 kg', 1000), P('fk500', 'fiskekaker', 'Fiskekaker 500 g', 500, ['fisk', 'gluten'], false),
  P('tort8', 'tortilla', 'Tortillalefser 8 stk', 8, ['gluten']), P('mais200', 'mais', 'Mais 200 g', 200),
  P('pap3', 'paprika', 'Paprika 3-pk', 3), P('ost400', 'ost', 'Norvegia 400 g', 400, ['melk']),
  P('rom300', 'romme', 'Rømme 300 ml', 300, ['melk']), P('egg12', 'egg', 'Egg 12 stk', 12, ['egg']),
  P('melk1', 'melk', 'Lettmelk 1 l', 1000, ['melk']), P('mel1000', 'mel', 'Hvetemel 1 kg', 1000, ['gluten']),
  P('brok400', 'brokkoli', 'Brokkoli 400 g', 400), P('laks400', 'laks', 'Laksefilet 400 g', 400, ['fisk']),
  P('spin200', 'spinat', 'Spinat 200 g', 200), P('bonne400', 'bonner', 'Kidneybønner 400 g', 400),
  // Ingen pris for røde linser noe sted: viser «ukjent pris» i appen.
  P('linser500', 'linser', 'Røde linser 500 g', 500),
];

export const stores: Store[] = [
  { id: 'demoA', name: 'Demo Nærbutikk (utsalg)', scope: 'utsalg' },
  { id: 'demoB', name: 'Demo Storsenter (region)', scope: 'region' },
];

const OBS = '2026-11-17';
const o = (productId: string, storeId: string, ore: number, status: PriceObs['status'] = 'ordinær', validUntil?: string): PriceObs =>
  ({ productId, storeId, ore, status, source: 'Demodata', observed: OBS, validUntil });
const priceTable: [string, number, number | null][] = [
  // [produkt, pris A, pris B] i øre; null = ikke i sortimentet
  ['pasta500', 2290, 1790], ['tomat400', 1490, 1190], ['kd400', 5490, 4990], ['kd800', 9990, 8990],
  ['lok3', 2490, 2290], ['ris1000', 3490, 2990], ['kyl600', 11990, 9990], ['kokos400', 2290, 1890],
  ['torsk400', 8990, 10990], ['pot1500', 3290, 2990], ['gul1000', 2490, 1990], ['fk500', 5990, 4990],
  ['tort8', 2990, 2490], ['mais200', 1790, 1390], ['pap3', 4990, 4490], ['ost400', 8990, 7990],
  ['rom300', 2490, 1990], ['egg12', 3990, 3490], ['melk1', 2090, 1890], ['mel1000', 2490, 1790],
  ['brok400', 2990, 2490], ['laks400', 9990, 8990], ['spin200', 2290, 1990], ['bonne400', 1890, 1490],
];
export const prices: PriceObs[] = priceTable.flatMap(([p, a, b]) => [
  o(p, 'demoA', a, p === 'laks400' ? 'tilbud' : 'ordinær', p === 'laks400' ? '2026-11-23' : undefined),
  ...(b === null ? [] : [o(p, 'demoB', b, p === 'spin200' ? 'estimat' : 'ordinær')]),
]);

export const catalog: Catalog = { ingredients, recipes, products, prices, stores };
