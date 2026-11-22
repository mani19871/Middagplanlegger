// Husholdningsvarer drevet av tilbudsavisene (utvidelse C). Skrevet før koden. Motoren er ren: samme tilbud, regler,
// handledag og kjeder gir samme fangst og samme «Andre varer»-sum, uansett rekkefølge i inndata, og endrer aldri inndata.
import { describe, expect, it } from 'vitest';
import {
  classifyHousehold, HOUSEHOLD_PREFIX, householdCatch, householdHighlight, householdLineId, householdOfferKey, householdTotal,
  isValidHouseholdGroups, parseHouseholdLine, parseHouseholdRules, type HouseholdOfferIn, type HouseholdRuleSet,
} from './household';
import rawRules from '../data/household-rules.json';
import { applyListEvents, householdListFacts, manualLines, type ListEvent } from '../sync/list';

const RULES: HouseholdRuleSet = parseHouseholdRules(rawRules);
const FOOD = ['melk', 'kaffe', 'ost', 'egg', 'kylling'];
const SHOP = '2026-11-25';
let n = 0;
const offer = (heading: string, over: Partial<HouseholdOfferIn> = {}): HouseholdOfferIn => ({
  id: `o${++n}`, source: 'tjek', heading, description: null, priceOre: 4990, prePriceOre: 6990, amount: null, unit: null, pieces: null,
  dealerName: 'Kiwi', validFrom: '2026-11-23', validUntil: '2026-11-29', observed: '2026-11-23T08:00:00.000Z', ...over,
});
const cls = (heading: string, rules = RULES, over: Partial<HouseholdOfferIn> = {}) => classifyHousehold(offer(heading, over), rules, FOOD);
/** Liten regelfil for presise tester av regelrekkefølgen. */
const mini = (rules: HouseholdRuleSet['rules'], extra: Partial<HouseholdRuleSet> = {}): HouseholdRuleSet => ({
  groups: [
    { id: 'papir', name: 'Papir', items: [{ id: 'toalettpapir', name: 'Toalettpapir', terms: ['toalettpapir', 'dopapir'] }, { id: 'kjokkenrull', name: 'Kjøkkenrull', terms: ['kjøkkenrull', 'tørkerull'] }] },
    { id: 'hygiene', name: 'Bad og hygiene', items: [{ id: 'saape', name: 'Såpe', terms: ['håndsåpe', 'såpe'] }] },
    { id: 'folie', name: 'Folie og poser', items: [{ id: 'poser', name: 'Poser', terms: ['pose', 'fryseposer'] }] },
  ],
  exclude: ['kaffe', 'sjokolade'], sensitive: ['bleie', 'baby', 'barne'], rules, ...extra,
});

describe('husholdning: klassifisering med ordgrenser', () => {
  it('helt ord gir treff; sammensatte ord og andre ord gjør det ikke', () => {
    expect(cls('Lambi Toalettpapir 8 rull')).toMatchObject({ item: 'toalettpapir', group: 'papir' });
    expect(cls('TOALETTPAPIR, 24-pk')).toMatchObject({ item: 'toalettpapir' });
    expect(cls('Toalettpapirholder i stål')).toBeNull(); // ikke en forbruksvare, og «toalettpapir» er ikke et helt ord her
    expect(cls('Skrivepapir A4')).toBeNull(); // «papir» alene er ikke et søkeord
    expect(cls('Bakepapir 10 m')).toMatchObject({ item: 'bakepapir', group: 'folie-poser' });
    expect(cls('Oppvaskmiddel sitron 500 ml')).toMatchObject({ item: 'oppvaskmiddel', group: 'oppvask-klesvask' });
  });
  it('vanlige norske endelser er med (pose → poser, posene)', () => {
    const r = mini([]);
    expect(cls('Poser til matpakke', r)).toMatchObject({ item: 'poser' });
    expect(cls('Posene fra i fjor', r)).toMatchObject({ item: 'poser' });
    expect(cls('Posebrett', r)).toBeNull();
  });
  it('lengste treff vinner; to like lange treff for ulike varer er tvetydig og må kontrolleres', () => {
    const r = mini([]);
    expect(cls('Såpe pose', r)).toMatchObject({ status: 'kontroll', reasons: expect.arrayContaining(['tvetydig']) });
    expect(cls('Toalettpapir pose', r)).toMatchObject({ item: 'toalettpapir', status: 'kontroll' });
    expect(cls('Toalettpapir pose', r)!.reasons).not.toContain('tvetydig');
  });
  it('mat og annet uten søkeord er ikke husholdning', () => {
    expect(cls('Kyllingfilet 400 g')).toBeNull();
    expect(cls('Joggesko')).toBeNull();
  });
});

describe('husholdning: utelukkelser, sensitive ord og regler', () => {
  it('utelukkelsesord stopper treffet, også som forledd («kaffefilter»), med mindre et «tillatt»-mønster gjelder', () => {
    const r = mini([]);
    expect(cls('Sjokolade med såpe-form', r)).toBeNull();
    expect(classifyHousehold(offer('Kaffefilter nr 4'), mini([]), FOOD)).toBeNull();
    // Regelfilen i repoet har «kaffefilter» som tillatt unntak.
    expect(cls('Kaffefilter nr 4')).toMatchObject({ item: 'kaffefilter', status: 'kontroll' });
  });
  it('sensitive ord (bleier, baby, barneprodukter, medisin) gir aldri treff, heller ikke med godkjent regel', () => {
    const withRule = mini([{ pattern: 'babysåpe', decision: 'godkjent', item: 'saape' }]);
    expect(cls('Babysåpe 250 ml', withRule)).toBeNull();
    expect(cls('Libero bleier str 4')).toBeNull();
    expect(cls('Barnetannkrem 50 ml')).toBeNull();
    expect(cls('Babyshampo')).toBeNull();
    expect(cls('Paracet 20 stk')).toBeNull();
    expect(cls('Vitamin D')).toBeNull();
  });
  it('bare en kuratert «godkjent»-regel godkjenner; søkeordtreff er alltid «trenger kontroll»', () => {
    expect(cls('Lambi Toalettpapir 8 rull')).toMatchObject({ status: 'kontroll', reasons: ['forslag'], rule: null });
    const r = mini([{ pattern: 'lambi toalettpapir', decision: 'godkjent', item: 'toalettpapir' }]);
    expect(cls('Lambi Toalettpapir 8 rull', r)).toMatchObject({ status: 'godkjent', item: 'toalettpapir', reasons: [], rule: 'lambi toalettpapir' });
  });
  it('avvisning vinner alltid: uten vare stopper den tilbudet, med vare stopper den bare den koblingen', () => {
    const r = mini([
      { pattern: 'lambi', decision: 'godkjent', item: 'toalettpapir' },
      { pattern: 'lambi toalettpapir', decision: 'avvist' },
    ]);
    expect(cls('Lambi Toalettpapir 8 rull', r)).toBeNull();
    const r2 = mini([{ pattern: 'såpe', decision: 'avvist', item: 'saape' }]);
    expect(cls('Såpe', r2)).toBeNull();
    expect(cls('Såpe og pose', r2)).toMatchObject({ item: 'poser' });
  });
  it('like lange godkjente mønstre for ulike varer: selvmotsigende regelfil, ingen godkjenning', () => {
    const r = mini([{ pattern: 'rull', decision: 'godkjent', item: 'toalettpapir' }, { pattern: 'rull', decision: 'godkjent', item: 'kjokkenrull' }]);
    expect(cls('Rull 4 pk', r)).toMatchObject({ status: 'kontroll', reasons: expect.arrayContaining(['tvetydig']) });
  });
  it('kan være mat: søkeordtreff som også treffer et matord går til kontroll med årsak «mat»', () => {
    expect(cls('Håndsåpe melk og honning')).toMatchObject({ status: 'kontroll', reasons: expect.arrayContaining(['mat']) });
  });
  it('pris ukjent og vilkår gir ikke brukbar pris', () => {
    expect(cls('Toalettpapir', RULES, { priceOre: null })).toMatchObject({ priceUsable: false, reasons: expect.arrayContaining(['pris ukjent']) });
    expect(cls('Toalettpapir Trumf-pris')).toMatchObject({ priceUsable: false, reasons: expect.arrayContaining(['vilkår']) });
    expect(cls('Toalettpapir', RULES, { description: '3 for 2' })).toMatchObject({ priceUsable: false });
    expect(cls('Toalettpapir', RULES, { priceOre: 49.5 })).toMatchObject({ priceUsable: false });
    expect(cls('Toalettpapir')).toMatchObject({ priceUsable: true, chain: 'KIWI' });
  });
  it('regelfilen valideres: ukjent vare, dobbel vare-id, ukjent beslutning eller tomt mønster kaster', () => {
    const base = { version: 1, groups: rawRules.groups, exclude: [], sensitive: [], rules: [] as unknown[] };
    expect(() => parseHouseholdRules({ ...base, rules: [{ pattern: 'x', decision: 'godkjent', item: 'finnes-ikke' }] })).toThrow();
    expect(() => parseHouseholdRules({ ...base, rules: [{ pattern: 'toalettpapir', decision: 'kanskje', item: 'toalettpapir' }] })).toThrow();
    expect(() => parseHouseholdRules({ ...base, rules: [{ pattern: ' ', decision: 'avvist' }] })).toThrow();
    expect(() => parseHouseholdRules({ ...base, groups: [...rawRules.groups, rawRules.groups[0]] })).toThrow();
    expect(() => parseHouseholdRules({ ...base, version: 2 })).toThrow();
  });
  it('gruppene i regelfilen er generelle: ingen bleier, medisin eller barneprodukter', () => {
    const all = JSON.stringify(RULES.groups).toLowerCase();
    for (const w of ['bleie', 'baby', 'barn', 'medisin', 'vitamin', 'tampong', 'bind', 'graviditet', 'inkontinens']) expect(all).not.toContain(w);
    expect(RULES.groups.map((g) => g.id)).toEqual(['rengjoring', 'oppvask-klesvask', 'hygiene', 'papir', 'folie-poser', 'batterier-paerer', 'kjaeledyr']);
  });
});

describe('husholdning: tilbudsfangst (valgte kjeder, gyldig på handledagen)', () => {
  const offers = [
    offer('Lambi Toalettpapir 8 rull', { id: 'a', dealerName: 'Kiwi' }),
    offer('Zalo Oppvaskmiddel 500 ml', { id: 'b', dealerName: 'REMA 1000' }),
    offer('Toalettpapir 24 rull', { id: 'c', dealerName: 'Coop Extra' }),
    offer('Kjøkkenrull 4 pk', { id: 'd', dealerName: 'Kiwi', validFrom: '2026-11-26', validUntil: '2026-12-02' }), // starter etter handledagen
    offer('Tørkerull 2 pk', { id: 'e', dealerName: 'Kiwi', validFrom: '2026-11-16', validUntil: '2026-11-24' }), // utløpt på handledagen
    offer('Dopapir 6 rull', { id: 'f', dealerName: 'Kiwi', observed: '2026-11-05T08:00:00.000Z', validFrom: '2026-11-01', validUntil: '2026-12-31' }), // gammel pris
    offer('Kyllingfilet', { id: 'g', dealerName: 'Kiwi' }),
  ];
  const all = (r: ReturnType<typeof householdCatch>) => [...r.approved, ...r.review].map((m) => m.offer.id).sort();
  it('ingen valgt kjede gir ingen tilbud (som ellers)', () => {
    for (const chains of [undefined, []]) expect(householdCatch(offers, RULES, FOOD, { shopDate: SHOP, chains })).toEqual({ blocked: 'kjede', approved: [], review: [] });
  });
  it('bare tilbud fra valgte kjeder, gyldige på handledagen og med pris sett innenfor aldersgrensen', () => {
    expect(all(householdCatch(offers, RULES, FOOD, { shopDate: SHOP, chains: ['KIWI'] }))).toEqual(['a']);
    expect(all(householdCatch(offers, RULES, FOOD, { shopDate: SHOP, chains: ['Kiwi', 'Rema'] }))).toEqual(['a', 'b']);
    expect(all(householdCatch(offers, RULES, FOOD, { shopDate: '2026-11-27', chains: ['KIWI'] }))).toEqual(['a', 'd']);
  });
  it('alt uten godkjent regel ligger under «trenger kontroll»; godkjent regel gir egen gruppe', () => {
    const r = householdCatch(offers, RULES, FOOD, { shopDate: SHOP, chains: ['KIWI', 'REMA 1000'] });
    expect(r.approved).toEqual([]);
    expect(r.review.map((m) => m.offer.id)).toEqual(['b', 'a']); // gruppenes rekkefølge: oppvask før papir
    const ok = { ...RULES, rules: [...RULES.rules, { pattern: 'lambi toalettpapir', decision: 'godkjent' as const, item: 'toalettpapir' }] };
    const r2 = householdCatch(offers, ok, FOOD, { shopDate: SHOP, chains: ['KIWI', 'REMA 1000'] });
    expect([r2.approved.map((m) => m.offer.id), r2.review.map((m) => m.offer.id)]).toEqual([['a'], ['b']]);
  });
  it('valgte varegrupper filtrerer; ingen valg = alle grupper', () => {
    expect(all(householdCatch(offers, RULES, FOOD, { shopDate: SHOP, chains: ['KIWI', 'REMA 1000'], groups: ['papir'] }))).toEqual(['a']);
    expect(all(householdCatch(offers, RULES, FOOD, { shopDate: SHOP, chains: ['KIWI', 'REMA 1000'], groups: [] }))).toEqual([]);
  });
  it('samme tilbud to ganger gir én rad; samme resultat i omvendt rekkefølge; inndata endres ikke', () => {
    const copy = JSON.parse(JSON.stringify(offers));
    const o = { shopDate: SHOP, chains: ['KIWI', 'REMA 1000', 'COOP EXTRA'] };
    const fwd = householdCatch([...offers, ...offers], RULES, FOOD, o);
    expect(fwd).toEqual(householdCatch([...offers].reverse(), RULES, FOOD, o));
    expect(all(fwd)).toEqual(['a', 'b', 'c']);
    expect(offers).toEqual(copy);
  });
});

describe('husholdning: linjer på handlelista og egen sum «Andre varer»', () => {
  const a = offer('Lambi Toalettpapir 8 rull', { id: 'a', priceOre: 8990 });
  const b = offer('Zalo Oppvaskmiddel 500 ml', { id: 'b', priceOre: 2990, dealerName: 'REMA 1000' });
  const later = offer('Kjøkkenrull 4 pk', { id: 'd', validFrom: '2026-11-26', validUntil: '2026-12-02' });
  const cond = offer('Tørkerull Trumf-medlemspris', { id: 'e' });
  const matches = [a, b, later, cond].map((o) => classifyHousehold(o, RULES, FOOD)!);
  const line = (o: HouseholdOfferIn, text: string) => ({ id: householdLineId(householdOfferKey(o), [])!, text, note: `tilbud hos ${o.dealerName}` });
  const chains = ['KIWI', 'REMA 1000'];

  it('linje-id er bundet til tilbudet; samme tilbud fra to enheter gir samme id; ny id etter fjerning', () => {
    const id = householdLineId(householdOfferKey(a), [])!;
    expect(id).toBe(`${HOUSEHOLD_PREFIX}tjek:a#0`);
    expect(parseHouseholdLine(id)).toEqual({ key: 'tjek:a', n: 0 });
    expect(householdLineId(householdOfferKey(a), [id])).toBe(`${HOUSEHOLD_PREFIX}tjek:a#1`);
    expect(householdLineId(householdOfferKey(a), [`${HOUSEHOLD_PREFIX}tjek:ab#0`])).toBe(id); // et annet tilbud
    expect(householdLineId(`tjek:${'x'.repeat(90)}`, [])).toBeNull(); // for lang til linje-id
    expect(parseHouseholdLine('basis:2026-11-23|kaffe')).toBeNull();
  });
  it('to mottak og to enheter gir én linje (regel 8); fjerning vinner', () => {
    const add = (by: string, id: string): ListEvent => ({ type: 'manuell', id, at: '2026-11-23T10:00:00.000Z', by, line: line(a, 'Toalettpapir') });
    const e1 = add('enhet-a', 'e1');
    const log = applyListEvents([], [e1, e1, add('enhet-b', 'e2')]);
    expect(log).toHaveLength(2);
    expect(householdListFacts(log).lines.map((l) => l.id)).toEqual([line(a, '').id]);
    const removed = applyListEvents(log, [{ type: 'manuell-fjern', id: 'r1', at: '2026-11-23T11:00:00.000Z', by: 'enhet-b', lineId: line(a, '').id }]);
    expect(householdListFacts(removed)).toMatchObject({ lines: [], removed: [line(a, '').id], history: ['Toalettpapir'] });
    expect(manualLines(removed)).toEqual([]);
  });
  it('pris bare for gyldig tilbud på handledagen, med kjent pris og uten vilkår, fra valgt kjede', () => {
    const lines = [line(a, 'Toalettpapir'), line(b, 'Oppvaskmiddel'), line(later, 'Kjøkkenrull'), line(cond, 'Kjøkkenrull'),
      { id: `${HOUSEHOLD_PREFIX}tjek:borte#0`, text: 'Batterier', note: 'tilbud hos Kiwi' }];
    const t = householdTotal(lines, matches, SHOP, chains);
    expect(t.lines.map((l) => [l.offerKey, l.state, l.priceOre])).toEqual([
      ['tjek:a', 'pris', 8990], ['tjek:b', 'pris', 2990], ['tjek:d', 'utenfor-gyldighet', null], ['tjek:e', 'vilkår', null], ['tjek:borte', 'ingen-tilbud', null],
    ]);
    expect([t.totalOre, t.priced, t.count, t.complete]).toEqual([11980, 2, 5, false]);
    expect(householdTotal(lines.slice(0, 2), matches, SHOP, chains)).toMatchObject({ totalOre: 11980, complete: true });
    // Kjeden er ikke valgt lenger: ingen pris.
    expect(householdTotal([line(b, 'Oppvaskmiddel')], matches, SHOP, ['KIWI']).lines[0]).toMatchObject({ state: 'kjede', priceOre: null });
    // Utløpt på handledagen: ingen pris.
    expect(householdTotal([line(a, 'Toalettpapir')], matches, '2026-11-30', chains).lines[0]).toMatchObject({ state: 'utenfor-gyldighet', priceOre: null });
    // Gammel pris (sett mer enn 14 dager før handledagen): ingen pris.
    expect(householdTotal([line(a, 'Toalettpapir')], matches, '2026-12-20', chains).lines[0].priceOre).toBeNull();
  });
  it('tom liste: sum 0, ingen linjer; ikke-husholdningslinjer ignoreres', () => {
    expect(householdTotal([], matches, SHOP, chains)).toEqual({ lines: [], totalOre: 0, priced: 0, count: 0, complete: true });
    expect(householdTotal([{ id: 'basis:2026-11-23|kaffe', text: 'Kaffe', note: '' }], matches, SHOP, chains).count).toBe(0);
  });
  it('deterministisk: omvendt rekkefølge på tilbud gir samme sum og linjer; inndata endres ikke', () => {
    const lines = [line(a, 'Toalettpapir'), line(b, 'Oppvaskmiddel')];
    const copy = JSON.parse(JSON.stringify({ lines, matches }));
    expect(householdTotal(lines, [...matches].reverse(), SHOP, chains)).toEqual(householdTotal(lines, matches, SHOP, chains));
    expect({ lines, matches }).toEqual(copy);
  });
});

describe('husholdning: fremheving (basisvarer og varer dere har lagt på lista før), aldri reklame', () => {
  const m = classifyHousehold(offer('Lambi Toalettpapir 8 rull'), RULES, FOOD)!;
  it('basisvare med samme navn eller et søkeord for varen', () => {
    expect(householdHighlight(m, RULES, { staples: ['Toalettpapir'], history: [] })).toBe('basisvare');
    expect(householdHighlight(m, RULES, { staples: ['dopapir'], history: [] })).toBe('basisvare');
    expect(householdHighlight(m, RULES, { staples: ['Kaffe'], history: ['Toalettpapir'] })).toBe('lagt-til-før');
    expect(householdHighlight(m, RULES, { staples: [], history: ['Oppvaskmiddel'] })).toBeNull();
  });
  it('gyldige varegrupper i innstillingene: kjente id-er, ingen dubletter', () => {
    expect(isValidHouseholdGroups(undefined, RULES)).toBe(true);
    expect(isValidHouseholdGroups(['papir', 'kjaeledyr'], RULES)).toBe(true);
    expect(isValidHouseholdGroups([], RULES)).toBe(true);
    for (const bad of [['papir', 'papir'], ['bleier'], 'papir', [1], new Array(30).fill('papir')]) expect(isValidHouseholdGroups(bad, RULES)).toBe(false);
  });
});
