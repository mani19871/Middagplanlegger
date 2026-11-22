// DEMODATA: oppdiktede butikker og priser for å vise hvordan appen fungerer.
// Ekte prisdata avklares i fase 0 (Kassalapp, Tjek, kjedeavtaler).
import type { Catalog, FoodTag, Ingredient, PriceObs, Product, Recipe, Store } from '../engine/types';

const I = (id: string, name: string, unit: Ingredient['unit'], department: string, staple = false, tags: FoodTag[] = []): Ingredient =>
  ({ id, name, unit, department, staple, tags });
export const ingredients: Ingredient[] = [
  I('pasta', 'Pasta', 'g', 'Tørrvarer'), I('tomat', 'Hakkede tomater', 'g', 'Hermetikk'),
  I('kjottdeig', 'Kjøttdeig', 'g', 'Kjøtt og fisk', false, ['storfe']), I('lok', 'Løk', 'stk', 'Frukt og grønt'),
  I('ris', 'Ris', 'g', 'Tørrvarer'), I('kylling', 'Kyllingfilet', 'g', 'Kjøtt og fisk', false, ['kylling']),
  I('kokosmelk', 'Kokosmelk', 'ml', 'Hermetikk'), I('torsk', 'Torsk', 'g', 'Kjøtt og fisk', false, ['fisk']),
  I('poteter', 'Poteter', 'g', 'Frukt og grønt'), I('gulrot', 'Gulrot', 'g', 'Frukt og grønt'),
  I('fiskekaker', 'Fiskekaker', 'g', 'Kjøtt og fisk', false, ['fisk']), I('tortilla', 'Tortillalefser', 'stk', 'Tørrvarer'),
  I('mais', 'Mais', 'g', 'Hermetikk'), I('paprika', 'Paprika', 'stk', 'Frukt og grønt'),
  I('ost', 'Ost', 'g', 'Meieri'), I('romme', 'Rømme', 'ml', 'Meieri'), I('egg', 'Egg', 'stk', 'Meieri'),
  I('melk', 'Melk', 'ml', 'Meieri'), I('mel', 'Hvetemel', 'g', 'Tørrvarer'),
  I('brokkoli', 'Brokkoli', 'g', 'Frukt og grønt'), I('laks', 'Laks', 'g', 'Kjøtt og fisk', false, ['fisk']),
  I('spinat', 'Spinat', 'g', 'Frukt og grønt'), I('linser', 'Røde linser', 'g', 'Tørrvarer', false, ['belgvekster']),
  I('bonner', 'Kidneybønner', 'g', 'Hermetikk', false, ['belgvekster']),
  I('svinekotelett', 'Svinekoteletter (nakke, med ben)', 'g', 'Kjøtt og fisk', false, ['svin']),
  I('svinedeig', 'Svinekjøttdeig', 'g', 'Kjøtt og fisk', false, ['svin']), I('flesk', 'Sideflesk', 'g', 'Kjøtt og fisk', false, ['svin']),
  I('lammedeig', 'Lammekjøttdeig', 'g', 'Kjøtt og fisk', false, ['lam']), I('reker', 'Reker, skallfrie', 'g', 'Kjøtt og fisk', false, ['skalldyr']),
  I('sei', 'Seifilet', 'g', 'Kjøtt og fisk', false, ['fisk']), I('hyse', 'Hysefilet', 'g', 'Kjøtt og fisk', false, ['fisk']),
  I('sild', 'Sildefilet', 'g', 'Kjøtt og fisk', false, ['fisk']), I('makrell', 'Makrell i tomat (hermetisk)', 'g', 'Hermetikk', false, ['fisk']),
  I('kikerter', 'Kikerter (hermetiske)', 'g', 'Hermetikk', false, ['belgvekster']), I('tofu', 'Tofu', 'g', 'Meieri', false, ['belgvekster']),
  I('sopp', 'Sjampinjong', 'g', 'Frukt og grønt'), I('blomkal', 'Blomkål', 'g', 'Frukt og grønt'),
  I('kalrot', 'Kålrot', 'g', 'Frukt og grønt'), I('soyasaus', 'Soyasaus', 'ml', 'Krydder'),
  I('nudler', 'Hvetenudler (tørre)', 'g', 'Tørrvarer'),
  I('salt', 'Salt og pepper', 'g', 'Krydder', true), I('olje', 'Matolje', 'ml', 'Tørrvarer', true),
];

// Allergenmerking (demodata): `allergens` er typiske allergener etter EUs 14-liste. `allergenKnown: false` betyr at
// innholdet ikke er avklart og kan ha flere allergener enn oppgitt; slike varer godkjennes aldri ved aktivt allergifilter.
// En rett skal alltid dekke allergenene til alle varer den bruker (testet i catalog.test.ts). Ved tvil: allergenKnown=false.
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
  R('fiskekaker', 'Fiskekaker med poteter og gulrot', 25, false, 'fisk', ['fisk', 'gluten', 'melk', 'egg'],
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
  // Kjøttkaker lages vanligvis med mel/brødsmuler (ikke ført opp som vare her): gluten er tatt med for sikkerhets skyld.
  R('kjottkaker', 'Kjøttkaker med poteter', 45, false, 'storfe', ['gluten', 'melk'],
    [['kjottdeig', 600], ['poteter', 1000], ['gulrot', 400], ['melk', 200]],
    ['Form kjøttkaker og stek.', 'Kok poteter og gulrot.']),
  R('fiskesuppe', 'Fiskesuppe', 40, false, 'fisk', ['fisk'],
    [['torsk', 400], ['poteter', 500], ['gulrot', 300], ['kokosmelk', 400]],
    ['Kok poteter og gulrot.', 'Tilsett kokosmelk og torsk, la trekke 8 min.']),
  R('svinekotelett', 'Svinekoteletter med poteter og gulrot', 35, false, 'svin', [],
    [['svinekotelett', 800], ['poteter', 800], ['gulrot', 300], ['olje', 20], ['salt', 5]],
    ['Kok poteter og gulrot.', 'Krydre koteletter og stek 4–5 min på hver side.', 'La kjøttet hvile et par minutter før servering.']),
  R('fleskkalrot', 'Stekt flesk med kålrotstappe', 40, false, 'svin', [],
    [['flesk', 600], ['kalrot', 800], ['poteter', 600], ['gulrot', 300]],
    ['Skrell og kok kålrot, poteter og gulrot møre.', 'Stek fleskeskivene sprø i panne eller ovn.', 'Stapp grønnsakene og server med flesket.']),
  R('svinewok', 'Svinekjøttdeig-wok med ris', 20, false, 'svin', ['gluten', 'soya'],
    [['svinedeig', 500], ['ris', 300], ['paprika', 2], ['gulrot', 200], ['soyasaus', 40]],
    ['Sett ris på koking.', 'Stek svinekjøttdeigen smuldrende.', 'Tilsett strimlet grønnsaker og soyasaus, wok i 5 min.', 'Server med ris.']),
  R('lammeboller', 'Lammekjøttboller med ris og rømmesaus', 35, false, 'lam', ['melk'],
    [['lammedeig', 500], ['ris', 300], ['romme', 200], ['gulrot', 200], ['lok', 1], ['salt', 5]],
    ['Bland lammedeig med revet løk og krydder, form små boller.', 'Stek bollene gjennom.', 'Kok ris og gulrot.', 'Server med rømme som saus.']),
  R('lammepasta', 'Pasta med lammedeig og tomat', 30, false, 'lam', ['gluten'],
    [['lammedeig', 400], ['pasta', 400], ['tomat', 800], ['lok', 1], ['olje', 20]],
    ['Stek løk og lammedeig.', 'Tilsett tomat og la småkoke i 15 min.', 'Kok pasta og bland.']),
  R('rekepasta', 'Rekepasta med spinat', 20, false, 'skalldyr', ['gluten', 'skalldyr'],
    [['pasta', 400], ['reker', 300], ['spinat', 200], ['tomat', 400], ['olje', 10]],
    ['Kok pasta.', 'Varm tomat med spinat i en panne.', 'Vend inn rekene til de er varme og bland med pasta.']),
  R('rekekokos', 'Reker i kokossaus med ris', 20, false, 'skalldyr', ['skalldyr'],
    [['reker', 400], ['kokosmelk', 400], ['ris', 300], ['paprika', 1], ['lok', 1]],
    ['Kok ris.', 'Fres løk og paprika, tilsett kokosmelk og la putre 5 min.', 'Vend inn reker og server over ris.']),
  R('seigryte', 'Ovnsbakt sei med blomkål og poteter', 30, false, 'fisk', ['fisk'],
    [['sei', 600], ['poteter', 800], ['blomkal', 500], ['olje', 20]],
    ['Del poteter og blomkål i biter og bak 20 min på 200 °C.', 'Legg seifilet på toppen og bak 10 min til.']),
  R('stektsild', 'Stekt sild med poteter og gulrot', 30, false, 'fisk', ['fisk', 'gluten'],
    [['sild', 500], ['mel', 80], ['poteter', 800], ['gulrot', 300], ['olje', 40]],
    ['Kok poteter og gulrot.', 'Vend sildefiletene i mel og salt.', 'Stek gyllen på middels varme, 2–3 min per side.']),
  R('makrelltomat', 'Makrell i tomat med poteter', 20, false, 'fisk', ['fisk', 'gluten'],
    [['makrell', 510], ['poteter', 800], ['gulrot', 300], ['lok', 1]],
    ['Kok poteter.', 'Riv gulrot og skjær løk.', 'Server makrell i tomat med poteter og rå grønnsaker.']),
  R('hyseris', 'Hyse med ris og brokkoli', 25, false, 'fisk', ['fisk'],
    [['hyse', 600], ['ris', 300], ['brokkoli', 300], ['olje', 15]],
    ['Kok ris og brokkoli.', 'Stek hysefilet 3–4 min på hver side.', 'Server sammen.']),
  R('kyllingnudler', 'Kyllingnudler', 20, false, 'kylling', ['gluten', 'soya', 'egg'],
    [['kylling', 400], ['nudler', 250], ['gulrot', 200], ['paprika', 1], ['soyasaus', 40]],
    ['Kok nudler etter anvisning på pakken.', 'Stek kylling i strimler, tilsett grønnsaker og soyasaus.', 'Vend inn nudlene.']),
  R('ovnskylling', 'Ovnsbakt kylling med blomkål og poteter', 40, false, 'kylling', [],
    [['kylling', 600], ['poteter', 800], ['blomkal', 400], ['olje', 20]],
    ['Del poteter og blomkål i biter og bak 15 min på 200 °C.', 'Legg kyllingen på og bak 20 min til.']),
  R('kikertcurry', 'Kikertcurry med spinat og ris', 30, true, 'belgvekster', [],
    [['kikerter', 800], ['kokosmelk', 400], ['tomat', 400], ['lok', 1], ['spinat', 200], ['ris', 300]],
    ['Fres løk og karri.', 'Tilsett kikerter, tomat og kokosmelk, la putre 15 min.', 'Vend inn spinat og server med ris.']),
  R('tofuwok', 'Tofuwok med ris', 20, true, 'tofu', ['gluten', 'soya'],
    [['tofu', 400], ['ris', 300], ['brokkoli', 300], ['gulrot', 200], ['soyasaus', 40]],
    ['Kok ris.', 'Stek tofu i terninger gylden.', 'Tilsett grønnsaker og soyasaus, wok i 5 min.', 'Server med ris.']),
  R('soppasta', 'Pasta med sopp og rømme', 25, true, 'sopp', ['gluten', 'melk'],
    [['pasta', 400], ['sopp', 300], ['romme', 200], ['lok', 1], ['olje', 15]],
    ['Kok pasta.', 'Stek skivet sopp og løk gyllen.', 'Rør inn rømme, varm forsiktig og bland med pasta.']),
  R('ovnsblomkal', 'Ovnsbakt blomkål og poteter med ost', 40, true, 'ost', ['melk'],
    [['blomkal', 600], ['poteter', 800], ['ost', 150], ['olje', 20]],
    ['Del blomkål og poteter i biter og bak 25 min på 200 °C.', 'Strø over revet ost og bak 8 min til.']),
];

const P = (id: string, ingredient: string, name: string, size: number, allergens: Product['allergens'] = [], allergenKnown = true): Product =>
  ({ id, ingredient, name, size, allergens, allergenKnown });
export const products: Product[] = [
  P('pasta500', 'pasta', 'Spagetti 500 g', 500, ['gluten']), P('tomat400', 'tomat', 'Hakkede tomater 400 g', 400),
  P('kd400', 'kjottdeig', 'Kjøttdeig 400 g', 400), P('kd800', 'kjottdeig', 'Kjøttdeig 800 g', 800),
  P('lok3', 'lok', 'Gul løk 3-pk', 3), P('ris1000', 'ris', 'Jasminris 1 kg', 1000),
  P('kyl600', 'kylling', 'Kyllingfilet 600 g', 600), // Kokosmelk: noen merker har tilsatt sulfitt (konserveringsmiddel), så innhold er ikke avklart.
  P('kokos400', 'kokosmelk', 'Kokosmelk 400 ml', 400, [], false),
  P('torsk400', 'torsk', 'Torskefilet 400 g', 400, ['fisk']), P('pot1500', 'poteter', 'Poteter 1,5 kg', 1500),
  P('gul1000', 'gulrot', 'Gulrot 1 kg', 1000), // Fiskekaker: typisk fisk, hvetemel, melk og egg, ofte også soya; innholdet varierer mellom merker og er ikke avklart.
  P('fk500', 'fiskekaker', 'Fiskekaker 500 g', 500, ['fisk', 'gluten', 'melk', 'egg'], false),
  // Tortillalefser: hvete, men noen merker har også melk eller soya; ikke avklart.
  P('tort8', 'tortilla', 'Tortillalefser 8 stk', 8, ['gluten'], false), P('mais200', 'mais', 'Mais 200 g', 200),
  P('pap3', 'paprika', 'Paprika 3-pk', 3), P('ost400', 'ost', 'Norvegia 400 g', 400, ['melk']),
  P('rom300', 'romme', 'Rømme 300 ml', 300, ['melk']), P('egg12', 'egg', 'Egg 12 stk', 12, ['egg']),
  P('melk1', 'melk', 'Lettmelk 1 l', 1000, ['melk']), P('mel1000', 'mel', 'Hvetemel 1 kg', 1000, ['gluten']),
  P('brok400', 'brokkoli', 'Brokkoli 400 g', 400), P('laks400', 'laks', 'Laksefilet 400 g', 400, ['fisk']),
  P('spin200', 'spinat', 'Spinat 200 g', 200), P('bonne400', 'bonner', 'Kidneybønner 400 g', 400),
  // Ingen pris for røde linser noe sted: viser «ukjent pris» i appen.
  P('linser500', 'linser', 'Røde linser 500 g', 500),
  P('kots600', 'svinekotelett', 'Svinekoteletter 600 g', 600), P('svd400', 'svinedeig', 'Svinekjøttdeig 400 g', 400),
  P('flesk500', 'flesk', 'Sideflesk 500 g', 500), P('lamd400', 'lammedeig', 'Lammekjøttdeig 400 g', 400),
  // Skallfrie reker: sulfitt brukes ofte mot mørkfarging, så innhold er ikke avklart.
  P('reker300', 'reker', 'Reker, skallfrie 300 g', 300, ['skalldyr'], false), P('sei400', 'sei', 'Seifilet 400 g', 400, ['fisk']),
  P('hyse400', 'hyse', 'Hysefilet 400 g', 400, ['fisk']), P('sild400', 'sild', 'Sildefilet 400 g', 400, ['fisk']),
  // Hermetikk: tomatsausen kan ha gluten (stivelse) og andre tilsetninger; ikke avklart, så den godkjennes aldri ved aktivt allergifilter.
  P('mak170', 'makrell', 'Makrell i tomat 170 g', 170, ['fisk', 'gluten'], false),
  P('kik400', 'kikerter', 'Kikerter 400 g', 400), P('tofu400', 'tofu', 'Tofu naturell 400 g', 400, ['soya']),
  P('sopp250', 'sopp', 'Sjampinjong 250 g', 250), P('blk600', 'blomkal', 'Blomkål 1 stk (ca. 600 g)', 600),
  P('kal1000', 'kalrot', 'Kålrot 1 kg', 1000), P('soya150', 'soyasaus', 'Soyasaus 150 ml', 150, ['soya', 'gluten']),
  // Hvetenudler: ofte eggnudler; egg er ikke avklart.
  P('nud250', 'nudler', 'Hvetenudler 250 g', 250, ['gluten', 'egg'], false),
];

export const stores: Store[] = [
  { id: 'demoA', name: 'Demo Nærbutikk (utsalg)', scope: 'utsalg' },
  { id: 'demoB', name: 'Demo Storsenter (region)', scope: 'region' },
];

const OBS = '2026-11-17';
// Demodata: laksetilbudet er oppdiktet og settes langt frem, så demoen ikke mister laks når handledagen passerer. Ekte tilbud har ekte utløpsdato.
const DEMO_OFFER_UNTIL = '2099-12-31';
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
  ['kots600', 7990, 6990], ['svd400', 4990, 4490], ['flesk500', 6490, 5490], ['lamd400', 7990, null],
  ['reker300', 8990, null], ['sei400', 7490, 6990], ['hyse400', 8490, 7990], ['sild400', 5490, null],
  ['mak170', 2790, 2290], ['kik400', 1590, 1190], ['tofu400', 3290, null], ['sopp250', 3290, 2790],
  ['blk600', 3490, 2990], ['kal1000', 2290, 1890], ['soya150', 2490, 2190], ['nud250', 1990, 1590],
];
export const prices: PriceObs[] = priceTable.flatMap(([p, a, b]) => [
  o(p, 'demoA', a, p === 'laks400' ? 'tilbud' : 'ordinær', p === 'laks400' ? DEMO_OFFER_UNTIL : undefined),
  ...(b === null ? [] : [o(p, 'demoB', b, p === 'spin200' ? 'estimat' : 'ordinær')]),
]);

export const catalog: Catalog = { ingredients, recipes, products, prices, stores };
