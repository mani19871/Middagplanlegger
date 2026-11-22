// Planens faste regresjonstester (docs/plan.md, «Planmotoren»): sju scenarier. Der en eksisterende test dekker
// scenariet, peker `INDEX` til den (og testen under sjekker at den testen fortsatt finnes). Resten er skrevet her.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ingredients, stores as demoStores } from '../data/catalog';
import { totalWithOffers } from '../engine/offerTotal';
import { alternatives, buildBasket, slotUses } from '../engine/planner';
import { applyEvents, deriveStock, madeLineId, type InventoryEvent } from '../engine/inventory';
import { matchOffer } from '../offers/match';
import { toHints } from '../offers/hints';
import { parseTjekOffer, type RawTjekOffer } from '../offers/tjek';
import type { LiveOffer } from '../offers/service';
import { ctx, miniCatalog, miniSettings, settings, SHOP_DAY, slot } from './util';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/** Scenario fra planen → testen som beviser det (fil og testnavn, ordrett). */
const INDEX: [scenario: string, file: string, testName: string][] = [
  ['delt rispose', '../engine/inventory.test.ts', 'delt rispose mellom to retter: én linje, ett kjøp'],
  ['samme kjøp mottatt to ganger', '../engine/inventory.test.ts', 'samme kjøp mottatt to ganger dobler ikke beholdningen'],
  ['to voksne som krysser av samtidig', '../engine/inventory.test.ts', 'to voksne som krysser av samme linje samtidig gir ett kjøp'],
  ['to voksne som krysser av samtidig (uenig antall)', '../engine/inventory.test.ts', 'uenighet om antall blir en konflikt'],
  ['endring mens enheten er frakoblet', '../engine/inventory.test.ts', 'endring mens enheten er frakoblet: utboksen spilles av uten doble kjøp'],
  ['matpakke flyttet før middagen er laget', '../engine/inventory.test.ts', 'matpakke flyttet før middagen er laget'],
  ['delt pakning gir én handlelinje', '../engine/planner.test.ts', 'to retter som deler pasta gir én handlelinje'],
];
describe('regresjonslisten: eksisterende bevis finnes fortsatt', () => {
  it.each(INDEX)('%s → %s «%s»', (_s, file, name) => {
    expect(read(file)).toContain(name);
  });
});

describe('regresjon: delt rispose (hele kurven)', () => {
  it('lakseris og kyllingwok deler 1 kg ris: én linje, én pakke, resten regnes mot summen av begge', () => {
    const c = ctx();
    const b = buildBasket([slot(0, 'lakseris'), slot(2, 'kyllingwok')], ['demoA'], c);
    const ris = b.lines.filter((l) => l.ingredient === 'ris');
    expect(ris).toHaveLength(1);
    // 3,2 porsjoner × (300 + 300) g / 4 = 480 g ris → én pakke à 1 kg, 520 g til overs
    expect(ris[0].need).toBeCloseTo(480);
    expect(ris[0].packs).toBe(1);
    expect(ris[0].leftover).toBeCloseTo(520);
    // To separate kurver ville gitt to pakker: avrunding skjer først etter summering.
    const alone = buildBasket([slot(0, 'lakseris')], ['demoA'], c).lines.find((l) => l.ingredient === 'ris')!;
    expect(alone.packs + buildBasket([slot(0, 'kyllingwok')], ['demoA'], c).lines.find((l) => l.ingredient === 'ris')!.packs).toBe(2);
  });
});

describe('regresjon: prosenttilbud uten kjent grunnpris', () => {
  const raw = (over: Partial<RawTjekOffer> = {}): RawTjekOffer => ({
    id: 'p1', heading: 'Kyllingfilet 600 g – 40 % avslag', description: null,
    pricing: { price: null, pre_price: null, currency: 'NOK' },
    quantity: { unit: { symbol: 'g' }, size: { from: 600, to: 600 }, pieces: { from: 1, to: 1 } },
    dealer_id: 'd1', dealer: { name: 'Testkjede', country: { id: 'NO' } }, run_from: '2026-11-23T00:00:00+0100', run_till: '2026-11-29T23:59:59+0100', ...over,
  });
  const live = (r: RawTjekOffer): LiveOffer[] => {
    const offer = parseTjekOffer(r, '2026-11-22T10:00:00.000Z');
    const m = matchOffer(offer, ingredients, SHOP_DAY);
    return m ? [{ ...m, phase: 'nå' }] : [];
  };
  const hintsOf = (r: RawTjekOffer) => toHints(live(r), ingredients);
  const basket = buildBasket([slot(0, 'karri')], ['demoA'], ctx()); // kylling 500 g × 0,8 = 400 g → 1 pakke à 600 g

  it('uten kjent pris og førpris: går til kontroll, blir ikke hint og gir ingen rabatt', () => {
    const l = live(raw());
    expect(l).toHaveLength(1);
    expect(l[0].needsReview).toBe(true);
    expect(l[0].reasons).toEqual(expect.arrayContaining(['pris ukjent', 'vilkår']));
    expect(l[0].approved).toBe(false);
    expect(hintsOf(raw())).toEqual([]);
    expect(totalWithOffers(basket, hintsOf(raw()), SHOP_DAY, settings({ offerChains: ['TESTKJEDE'] })).savingOre).toBe(0);
  });
  it('med sluttpris, men uten grunnpris: prosentvilkåret gjør at tilbudet må kontrolleres, og det gir ingen rabatt', () => {
    const r = raw({ pricing: { price: 59.9, pre_price: null } });
    const l = live(r);
    expect(l[0].needsReview).toBe(true);
    expect(l[0].reasons).toContain('vilkår');
    expect(hintsOf(r)).toEqual([]);
    expect(totalWithOffers(basket, hintsOf(r), SHOP_DAY, settings({ offerChains: ['TESTKJEDE'] })).savingOre).toBe(0);
  });
  it('prosent bare i beskrivelsen (ikke overskriften) fanges også som vilkår', () => {
    const r = raw({ heading: 'Kyllingfilet 600 g', description: 'Spar 40 % denne uka', pricing: { price: 59.9, pre_price: null } });
    expect(live(r)[0].reasons).toContain('vilkår');
    expect(hintsOf(r)).toEqual([]);
  });
  it('en vanlig prisnedsettelse uten prosentord og uten førpris gir dekning, men ingen besparelse', () => {
    const r = raw({ heading: 'Kyllingfilet 600 g', pricing: { price: 59.9, pre_price: null } });
    const hints = hintsOf(r);
    expect(hints).toHaveLength(1);
    expect(hints[0].prePriceOre).toBeNull();
    expect(totalWithOffers(basket, hints, SHOP_DAY, settings({ offerChains: ['TESTKJEDE'] })).savingOre).toBe(0);
  });
  it('kontroll: kjent pris og førpris, uten vilkår, men ikke regelgodkjent, gir heller ingen rabatt i summen', () => {
    const r = raw({ heading: 'Kyllingfilet 600 g', pricing: { price: 59.9, pre_price: 99.9 } });
    const hints = hintsOf(r);
    expect(hints).toHaveLength(1);
    expect(hints[0].approved).toBe(false);
    expect(totalWithOffers(basket, hints, SHOP_DAY, settings({ offerChains: ['TESTKJEDE'] })).savingOre).toBe(0);
    expect(totalWithOffers(basket, [{ ...hints[0], approved: true }], SHOP_DAY, settings({ offerChains: ['Testkjede'] })).savingOre).toBe(4000);
  });
});

describe('regresjon: ulike priser i samme kjede', () => {
  const stores = [
    { id: 'X-oslo', name: 'Kjede X Oslo', scope: 'utsalg' as const },
    { id: 'X-bergen', name: 'Kjede X Bergen', scope: 'utsalg' as const },
    { id: 'X-kjede', name: 'Kjede X (kjedepris)', scope: 'kjede' as const },
  ];
  const cat = miniCatalog({
    stores,
    prices: [
      ['pa', 'X-oslo', 3000], ['pb', 'X-oslo', 2000],
      ['pa', 'X-bergen', 2500], ['pb', 'X-bergen', 2600, 'estimat'],
      ['pa', 'X-kjede', 1000, 'estimat'], ['pb', 'X-kjede', 1000, 'estimat'],
    ],
  });
  const c = (regular: string, ids: string[]) => ({ catalog: cat, settings: miniSettings({ regularStoreId: regular, storeIds: ids }) });

  it('hver butikk bruker sin egen pris, også innen samme kjede', () => {
    expect(buildBasket([slot(0, 'r1')], ['X-oslo'], c('X-oslo', ['X-oslo'])).totalOre).toBe(5000);
    expect(buildBasket([slot(0, 'r1')], ['X-bergen'], c('X-bergen', ['X-bergen'])).totalOre).toBe(5100);
  });
  it('en kombinasjon henter hver vare fra butikken der den er billigst, og linjen sier hvilken butikk', () => {
    const b = buildBasket([slot(0, 'r1')], ['X-oslo', 'X-bergen'], c('X-oslo', ['X-oslo', 'X-bergen']));
    expect(b.lines.map((l) => [l.ingredient, l.storeId, l.costOre])).toEqual([['a', 'X-bergen', 2500], ['b', 'X-oslo', 2000]]);
    expect(b.stops).toBe(2);
    expect(b.totalOre).toBe(4500);
  });
  it('en estimert kjedepris vinner butikksammenligningen bare med statusen «estimat» synlig på linjen, aldri som ordinær pris', () => {
    const alt = alternatives([slot(0, 'r1')], c('X-oslo', ['X-oslo', 'X-kjede']));
    expect(alt.combo!.lines.every((l) => l.storeId === 'X-kjede' && l.status === 'estimat')).toBe(true);
    expect(alt.combo!.estimatedCount).toBe(2);
    expect(alt.combo!.stops).toBe(1);
  });
  it('lik pris i to butikker gir alltid samme butikk (id-rekkefølge), uansett rekkefølge i inndata', () => {
    const tie = miniCatalog({ stores, prices: [['pa', 'X-oslo', 1000], ['pb', 'X-oslo', 1000], ['pa', 'X-bergen', 1000], ['pb', 'X-bergen', 1000]] });
    // `storeIds` i svaret er ekko av inndata og utelates; linjer og sum skal være like.
    const run = (cat2: typeof tie, ids: string[]) => { const { storeIds: _ids, ...rest } = buildBasket([slot(0, 'r1')], ids, { catalog: cat2, settings: miniSettings() }); return JSON.stringify(rest); };
    const rev = { ...tie, prices: [...tie.prices].reverse(), stores: [...tie.stores].reverse() };
    expect(run(rev, ['X-oslo', 'X-bergen'])).toBe(run(tie, ['X-oslo', 'X-bergen']));
    expect(run(tie, ['X-bergen', 'X-oslo'])).toBe(run(tie, ['X-oslo', 'X-bergen']));
    expect(JSON.parse(run(tie, ['X-oslo', 'X-bergen'])).lines.every((l: { storeId: string }) => l.storeId === 'X-bergen')).toBe(true);
  });
  it('demokatalogen: butikkene har eksplisitt omfang (utsalg, region eller kjede)', () => {
    for (const s of demoStores) expect(['utsalg', 'region', 'kjede']).toContain(s.scope);
  });
});

describe('regresjon: matpakke flyttet etter at middagen er laget', () => {
  const W = '2026-11-23';
  it('forbruket som ble registrert da middagen ble laget endres ikke av at matpakka flyttes i planen etterpå', () => {
    const c = ctx();
    const original = slot(0, 'bolognese', false, 1);
    const bought = buildBasket([original, slot(1, 'pastaspinat')], ['demoA'], c).lines.find((l) => l.ingredient === 'pasta')!;
    const log: InventoryEvent[] = [
      { type: 'kjøp', id: 'k', at: '2026-11-23T10:00:00.000Z', by: 'A', week: W, line: `kjøp|${W}|demoA|pasta|${bought.productId}`, ingredient: 'pasta', productId: bought.productId, storeId: 'demoA', packs: bought.packs, packSize: bought.packSize, unit: 'g' },
      { type: 'laget', id: 'm0', at: '2026-11-23T18:00:00.000Z', by: 'A', week: W, line: madeLineId(W, 0), day: 0, recipeId: 'bolognese', uses: slotUses(original, c) },
    ];
    const stockBefore = JSON.stringify(deriveStock(applyEvents([], log)));
    // Brukeren flytter matpakka til tirsdag i planen. Planen er ikke hendelsesloggen: beholdningen skal ikke flytte seg.
    slotUses({ ...original, extra: 0 }, c); slotUses(slot(1, 'pastaspinat', false, 1), c);
    expect(JSON.stringify(deriveStock(applyEvents([], log)))).toBe(stockBefore);
    const used = slotUses(original, c).find((u) => u.ingredient === 'pasta')!.amount;
    expect(deriveStock(applyEvents([], log)).total.pasta).toBeCloseTo(bought.packs * bought.packSize - used);
  });
  it('en uløst reservasjon: planen bruker «extra» på den dagen matpakka lages, og summen er uavhengig av hvilken dag matpakka spises', () => {
    const c = ctx();
    const a = buildBasket([{ ...slot(0, 'bolognese', false, 1), extraFor: 1 }, slot(1, 'pastaspinat')], ['demoA'], c);
    const b = buildBasket([{ ...slot(0, 'bolognese', false, 1), extraFor: 3 }, slot(1, 'pastaspinat')], ['demoA'], c);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a)); // extraFor er bare visning; motoren regner på extra
  });
});
