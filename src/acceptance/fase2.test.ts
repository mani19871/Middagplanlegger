// Akseptansetester for fase 2-kriteriene som kan prøves uten ekte data (docs/plan.md, «Godkjenningskriterier per fase»).
// Kriteriene om 90 % ferske priser, 5 % avvik mot kassakjøp og pilotbruk krever ekte data og er bare `todo` her.
import { describe, expect, it } from 'vitest';
import { recipeDeals } from '../engine/deals';
import { totalWithOffers } from '../engine/offerTotal';
import {
  alternatives, budgetAnswer, budgetSuggestions, buildBasket, dealsFor, generatePlan, swapOptions,
} from '../engine/planner';
import { catalog } from '../data/catalog';
import { CHAINS, fullWeek, slot, ctx, hint, miniCatalog, miniSettings, roundTrip, settings, SHOP_DAY } from './util';

const R1 = [slot(0, 'r1')];
const mini = (prices: Parameters<typeof miniCatalog>[0]['prices'], over = {}) => {
  const catalog = miniCatalog({ prices });
  return { catalog, settings: miniSettings(over) };
};

describe('F2: en kurv med ukjent pris vinner aldri butikksammenligningen', () => {
  it('kontroll: med komplette priser vinner den billigste kombinasjonen', () => {
    const c = mini([['pa', 'S1', 5000], ['pb', 'S1', 5000], ['pa', 'S2', 1000], ['pb', 'S2', 1000]]);
    const alt = alternatives(R1, c);
    expect(alt.regular.totalOre).toBe(10_000);
    expect(alt.combo!.totalOre).toBe(2_000);
    expect(alt.recommended).toBe('combo');
    expect(alt.savingOre).toBe(8_000);
  });
  it('en latterlig billig, men ufullstendig kombinasjon (S2 mangler vare B) blir aldri valgt eller tilbudt', () => {
    const c = mini([['pa', 'S1', 5000], ['pb', 'S1', 5000], ['pa', 'S2', 1]]);
    // Kombinasjonen [S1,S2] er komplett (S1 dekker B). Den virkelige faren er S2 alene som vanlig butikk:
    const alt = alternatives(R1, c);
    expect(alt.combo === null || alt.combo.complete).toBe(true);
    const onlyS2 = alternatives(R1, { ...c, settings: miniSettings({ regularStoreId: 'S2', storeIds: ['S2'], maxStops: 1 }) });
    expect(onlyS2.regular.complete).toBe(false);
    expect(onlyS2.regular.totalOre).toBe(1); // delsummen er latterlig lav …
    expect(onlyS2.combo).toBeNull(); // … men den kan ikke vinne eller sammenlignes
    expect(budgetAnswer(onlyS2.regular, 1_000_000)).toBe('ufullstendig');
  });
  it('vanlig butikk med ukjent pris kåres ikke billigst: en komplett kombinasjon anbefales, uten oppgitt besparelse', () => {
    const c = mini([['pa', 'S1', 1000], ['pa', 'S2', 9000], ['pb', 'S2', 9000]]); // S1 mangler vare B
    const alt = alternatives(R1, c);
    expect(alt.regular.complete).toBe(false);
    expect(alt.regular.totalOre).toBe(1000); // lavere enn kombinasjonen, men ufullstendig
    expect(alt.combo!.complete).toBe(true);
    expect(alt.recommended).toBe('combo');
    expect(alt.savingOre).toBeNull(); // ingen «du sparer»-tall mot en ufullstendig kurv
  });
  it('er både vanlig butikk og alle kombinasjoner ufullstendige, finnes ingen vinner', () => {
    const c = mini([['pa', 'S1', 1000], ['pa', 'S2', 1000]]); // ingen butikk har vare B
    const alt = alternatives(R1, c);
    expect(alt.combo).toBeNull();
    expect(alt.savingOre).toBeNull();
    expect(alt.recommended).toBe('regular');
    expect(budgetAnswer(alt.regular, 10_000_000)).toBe('ufullstendig');
  });
  it('ufullstendig kurv gir «Ufullstendig prisgrunnlag» uansett hvor lav delsummen er, og under budsjettet', () => {
    const b = buildBasket(R1, ['S1'], mini([['pa', 'S1', 1]]));
    expect(b.totalOre).toBe(1);
    expect(b.unknownCount).toBe(1);
    expect(budgetAnswer(b, 100_000)).toBe('ufullstendig');
    expect(budgetAnswer(b, 0)).toBe('ufullstendig');
  });
  it('byttealternativer med ukjent pris havner sist og foreslås aldri som billigere', () => {
    const c = ctx({ budgetOre: 1 });
    const plan = [slot(0, 'bolognese'), slot(1, 'taco')];
    const opts = swapOptions(plan, 1, ['demoA'], c);
    const firstIncomplete = opts.findIndex((o) => !o.complete);
    expect(firstIncomplete).toBeGreaterThan(0);
    expect(opts.slice(firstIncomplete).every((o) => !o.complete)).toBe(true);
    for (const g of budgetSuggestions(plan, ['demoA'], c, 10)) expect(g.option.complete).toBe(true);
  });
  it('planleggeren velger ikke retter med ukjent pris så lenge det finnes alternativer', () => {
    const plan = generatePlan(ctx());
    expect(buildBasket(plan, ['demoA'], ctx()).complete).toBe(true); // linsegryte (røde linser uten pris) velges ikke
    expect(plan.map((s) => s.recipeId)).not.toContain('linsegryte');
  });
  it('mot demokatalogen: for alle retter alene med regular=A blir ingen ufullstendig kurv anbefalt foran en komplett', () => {
    for (const r of catalog.recipes) {
      const c = ctx();
      const alt = alternatives([slot(0, r.id)], c);
      if (alt.recommended === 'combo') expect(alt.combo!.complete, r.id).toBe(true);
      if (alt.combo) expect(alt.combo.complete, r.id).toBe(true);
    }
  });
});

describe('F2: utløpte, utilgjengelige og geografisk feil rabatter gir ingen rabatt (tilbud på handledagen)', () => {
  const laks = buildBasket([slot(0, 'lakseris')], ['demoA'], ctx()); // 400 g laks, 99,90 kr, demodata
  // Husstanden har valgt kjedene tilbudene kommer fra, så «ingen rabatt» under skyldes regelen som testes, ikke kjedevalget.
  const S = settings({ offerChains: CHAINS });
  const total = (h = hint(), day = SHOP_DAY) => totalWithOffers(laks, [h], day, S);
  it('kontroll: et gyldig, godkjent tilbud gir rabatt fra førpris', () => {
    expect(total().savingOre).toBe(4000);
  });
  it('handledagen avgjør, ikke i dag: grensene er inkludert, dagen før og dagen etter gir ingenting', () => {
    const h = hint({ validFrom: '2026-11-23', validUntil: '2026-11-29' });
    expect(total(h, '2026-11-23').savingOre).toBe(4000);
    expect(total(h, '2026-11-29').savingOre).toBe(4000);
    expect(total(h, '2026-11-22').savingOre).toBe(0); // starter mandag: kommende på søndag
    expect(total(h, '2026-11-30').savingOre).toBe(0);
  });
  it('utløpt og kommende tilbud påvirker verken summen eller rangeringen av middager', () => {
    const lakseris = catalog.recipes.find((r) => r.id === 'lakseris')!;
    for (const h of [hint({ validFrom: '2026-11-15', validUntil: '2026-11-22' }), hint({ validFrom: '2026-11-25', validUntil: '2026-11-30' })]) {
      expect(total(h).savingOre).toBe(0);
      expect(recipeDeals(lakseris, 0.8, catalog.ingredients, [h], SHOP_DAY).lines).toEqual([]);
    }
  });
  it('utilgjengelige tilbud: uten pris, uten mengde, feil enhet, ikke regelgodkjent eller uten handledag gir ingen rabatt', () => {
    expect(total(hint({ priceOre: 0 })).savingOre).toBe(0);
    expect(total(hint({ amount: 0 })).savingOre).toBe(0);
    expect(total(hint({ unit: 'ml' })).savingOre).toBe(0);
    expect(total(hint({ approved: false })).savingOre).toBe(0);
    expect(total(hint({ approved: undefined })).savingOre).toBe(0);
    expect(total(hint({ priceOre: 5000.5 })).savingOre).toBe(0); // beløp er heltall i øre
  });
  it('allergifilter og «tilbud av» blokkerer alle rabatter', () => {
    expect(totalWithOffers(laks, [hint()], SHOP_DAY, { ...S, avoid: ['egg'] }).savingOre).toBe(0);
    expect(totalWithOffers(laks, [hint()], SHOP_DAY, { ...S, useOffers: false }).savingOre).toBe(0);
  });
  it('rabatten overstiger aldri linjens pris, og et tilbud gjør aldri en ukjent pris kjent', () => {
    expect(total(hint({ priceOre: 1, prePriceOre: 99_999 })).savingOre).toBe(laks.lines.find((l) => l.ingredient === 'laks')!.costOre);
    const unknown = buildBasket([slot(0, 'linsegryte')], ['demoA'], ctx());
    const t = totalWithOffers(unknown, [hint({ ingredient: 'linser', priceOre: 100, prePriceOre: 5000, amount: 500 })], SHOP_DAY, S);
    expect(t.savingOre).toBe(0);
    expect(t.complete).toBe(false);
  });
  it('tilbud endrer aldri basissummen, butikksammenligningen eller budsjettsvaret', () => {
    // Samme handledag i begge: bare tilbudene skiller (en utløpt katalogpris gjelder ikke uansett, se under).
    const c0 = ctx({ offerChains: CHAINS }, { shopDate: SHOP_DAY });
    const c1 = ctx({ offerChains: CHAINS }, { offers: [hint()], shopDate: SHOP_DAY });
    const plan = [slot(0, 'lakseris'), slot(1, 'bolognese')];
    expect(JSON.stringify(alternatives(plan, c1))).toBe(JSON.stringify(alternatives(plan, c0)));
  });

  // ---- Rettet hull og kjente hull. ----
  it('utløpt katalog-tilbud (PriceObs.validUntil < handledagen) brukes ikke som dagens pris, og uten handledag er oppførselen uendret', () => {
    const c = (shopDate?: string) => ({ catalog: miniCatalog({ prices: [['pa', 'S1', 3000, 'tilbud', '2026-11-23'], ['pb', 'S1', 2000]] }), settings: miniSettings(), shopDate });
    const line = (shopDate?: string) => buildBasket(R1, ['S1'], c(shopDate)).lines.find((x) => x.ingredient === 'a')!;
    expect(line('2026-11-23').status).toBe('tilbud'); // siste gyldige dag
    expect(line().status).toBe('tilbud'); // uten handledag: som før
    const expired = line('2026-11-24');
    expect(expired.status).toBe('ukjent'); // aldri «tilbud», og ikke nedgradert til estimat
    expect(expired.costOre).toBeNull();
    expect(buildBasket(R1, ['S1'], c('2026-11-24')).complete).toBe(false);
    expect(budgetAnswer(buildBasket(R1, ['S1'], c('2026-11-24')), 1_000_000)).toBe('ufullstendig');
  });
  it('demokatalogens laksetilbud er satt langt frem (demodata), så laks ikke forsvinner fra demoen', () => {
    const l = buildBasket([slot(0, 'lakseris')], ['demoA'], ctx({}, { shopDate: '2027-06-01' })).lines.find((x) => x.ingredient === 'laks')!;
    expect(l.status).toBe('tilbud');
  });
  it.todo('Tilbud med validFrom etter handledagen hoppes over: PriceObs har ingen validFrom i dag, så kommende katalogtilbud kan ikke uttrykkes ennå');

  // Geografisk feil rabatt: tilbud fra en kjede husstanden ikke har valgt (Settings.offerChains). Tjek oppgir kjede, ikke
  // utsalg, så valget gjelder kjeden. Demobutikkene har ingen kjede. (Var `it.todo`; lukket.)
  const meny = hint({ id: 'm1', dealer: 'MENY', priceOre: 1000, prePriceOre: 9000 });
  const lakseris = catalog.recipes.find((r) => r.id === 'lakseris')!;
  const dealsOn = (chains: string[] | undefined, offers = [meny]) =>
    dealsFor(lakseris, 0, ctx({ offerChains: chains }, { offers, shopDate: SHOP_DAY }));
  it('geografisk feil: tilbud fra en kjede som ikke er valgt gir ingen rabatt i summen og ingen rangering', () => {
    expect(totalWithOffers(laks, [meny], SHOP_DAY, settings({ offerChains: ['KIWI'] })).savingOre).toBe(0);
    expect(dealsOn(['KIWI']).lines).toEqual([]);
    expect(totalWithOffers(laks, [meny], SHOP_DAY, settings({ offerChains: ['KIWI', 'meny'] })).savingOre).toBe(8000); // kontroll
    expect(dealsOn(['Meny']).savingOre).toBe(8000);
  });
  it('standard uten valgt kjede: ingen tilbud brukes, og summen sier hvorfor («kjede»)', () => {
    for (const chains of [undefined, [], ['', ' ']]) {
      const t = totalWithOffers(laks, [hint(), meny], SHOP_DAY, settings({ offerChains: chains }));
      expect(t.savingOre).toBe(0);
      expect(dealsOn(chains, [hint(), meny]).lines).toEqual([]);
      expect(t.blocked).toBe('kjede');
    }
    expect(settings().offerChains).toBeUndefined();
  });
  it('kjedevalget flytter aldri valget av middager mot ikke-valgte kjeder, og er deterministisk', () => {
    const big = hint({ id: 'b1', ingredient: 'kokosmelk', dealer: 'Coop Extra', priceOre: 100, prePriceOre: 90_000, unit: 'ml' });
    const plan = (chains?: string[]) => JSON.stringify(generatePlan(ctx({ days: fullWeek(), offerChains: chains }, { offers: [big], shopDate: SHOP_DAY })));
    const without = JSON.stringify(generatePlan(ctx({ days: fullWeek() }, { shopDate: SHOP_DAY })));
    expect(plan(['KIWI', 'REMA 1000'])).toBe(without);
    expect(plan(undefined)).toBe(without);
    expect(plan(['COOP EXTRA'])).not.toBe(without); // kontroll: valgt kjede flytter valget
    expect(plan(['coop extra'])).toBe(plan(['COOP EXTRA']));
    expect(plan(['REMA 1000', 'COOP EXTRA'])).toBe(plan(['COOP EXTRA', 'REMA 1000'])); // rekkefølgen spiller ingen rolle
  });
  it('kjedevalget endrer aldri basissum, butikksammenligning eller budsjettsvar, og allergifilter blokkerer fortsatt', () => {
    const p = [slot(0, 'lakseris'), slot(1, 'bolognese')];
    const a0 = JSON.stringify(alternatives(p, ctx({}, { offers: [meny], shopDate: SHOP_DAY })));
    expect(JSON.stringify(alternatives(p, ctx({ offerChains: ['MENY'] }, { offers: [meny], shopDate: SHOP_DAY })))).toBe(a0);
    const t = totalWithOffers(laks, [meny], SHOP_DAY, settings({ offerChains: ['MENY'], avoid: ['egg'] }));
    expect(t.blocked).toBe('allergifilter');
    expect(t.totalOre).toBe(laks.totalOre);
  });
});

describe('F2: prisreglene kan gjenskapes fra en lagret uke', () => {
  // «Lagret uke» = alt motoren trenger, serialisert som JSON: innstillinger, plan, tilbud, handledag og beholdning.
  const stored = {
    settings: settings({ days: settings().days.map((d, i) => ({ ...d, enabled: i < 6 })), offerChains: ['MENY', 'KIWI'] }),
    slots: [] as ReturnType<typeof generatePlan>,
    offers: [hint(), hint({ id: 'o2', ingredient: 'ost', dealer: 'MENY', priceOre: 4900, prePriceOre: 8990, amount: 400 })],
    shopDate: SHOP_DAY, stock: { pasta: 300, ris: 500 } as Record<string, number>,
  };
  stored.slots = generatePlan({ catalog, ...stored });
  const compute = (w: typeof stored) => {
    const c = { catalog, settings: w.settings, offers: w.offers, shopDate: w.shopDate, stock: w.stock };
    const alts = alternatives(w.slots, c);
    const basket = alts.recommended === 'combo' && alts.combo ? alts.combo : alts.regular;
    return JSON.stringify({ alts, answer: budgetAnswer(basket, w.settings.budgetOre), offerTotal: totalWithOffers(basket, w.offers, w.shopDate, w.settings) });
  };
  it('lest tilbake fra lagret JSON gir uken byte-identisk kurv, sum, budsjettsvar og tilbudssum', () => {
    const original = compute(stored);
    expect(compute(roundTrip(stored))).toBe(original);
    expect(compute(roundTrip(roundTrip(stored)))).toBe(original);
  });
  it('hver linje bærer begrunnelsen som trengs for å gjenskape den: behov, pakke, pris, status, kilde, dato og hvilke retter den dekker', () => {
    const basket = alternatives(stored.slots, { catalog, ...stored }).regular;
    for (const l of basket.lines.filter((x) => x.costOre !== null)) {
      expect(l.need).toBeGreaterThan(0);
      expect(l.packs * l.packSize).toBeGreaterThanOrEqual(l.need - 1e-6);
      expect(l.leftover).toBeCloseTo(l.packs * l.packSize - l.need);
      expect(l.covers.length).toBeGreaterThan(0);
      expect(l.source && l.observed && l.status).toBeTruthy();
    }
  });
  it.todo('HULL: appen lagrer ikke prisgrunnlagets versjon, tilbudene eller beholdningen sammen med uka (AppState har bare settings og slots), så en eldre uke kan ikke gjenskapes i appen etter at tilbud eller beholdning har endret seg');
});

describe('F2: en avbrutt eller gjentatt kjøpsbekreftelse dobler ikke beholdningen', () => {
  // Bevist i src/engine/inventory.test.ts: «samme kjøp mottatt to ganger …», «endring mens enheten er frakoblet …»
  // (feilet levering, tapt svar og gjentatt levering) og i fase1.test.ts (tilfeldig rekkefølge og dubletter).
  it('(se inventory.test.ts og fase1.test.ts)', () => { expect(true).toBe(true); });
});

describe('F2: kriterier som krever ekte data eller ekte brukere', () => {
  it.todo('Minst 90 % ferskt prisede linjer i pilotområdene (krever prisavtale; fase 0 fant ingen ferske Rema/Coop-priser)');
  it.todo('Høyst 5 % median absolutt avvik mot kassakjøp, store enkeltavvik forklart (krever kvitteringer)');
  it.todo('Brukerne finner sin lokale avis, bruker et tilbud i planen og besøker butikk nummer to (krever pilot)');
});
