// Basisvarer med minstebeholdning (utvidelse B). Skrevet før koden. Motoren er ren: samme logg og samme liste gir samme
// forslag, uansett rekkefølge hendelsene kom i, og hendelser som kommer to ganger gir ingen doble linjer (regel 8).
import { describe, expect, it } from 'vitest';
import { applyEvents, deriveStock, isValidEvent, purchaseLineId, type InventoryEvent, type InventoryLog } from './inventory';
import {
  cleanStapleName, countable, customStapleId, isValidStaples, parseStapleLine, stapleLineId, stapleStatus, stapleSuggestions,
  STAPLE_LIMITS, type StapleInfo, type StapleStatus,
} from './staples';
import { applyListEvents, stapleListFacts, type ListEvent, type ListLog } from '../sync/list';
import { catalog } from '../data/catalog';
import { stapleChoices } from '../data/staples';
import type { Staple } from './types';

const info: StapleInfo = { choices: stapleChoices, ingredients: catalog.ingredients };
const W = '2026-11-23';
const W2 = '2026-11-30';
let n = 0;
const t = (min: number) => `2026-11-2${Math.floor(min / 60)}T10:${String(min % 60).padStart(2, '0')}:00.000Z`;
const base = (by = 'enhet-a', at = t(60 + n)) => { n += 1; return { id: `${by}-${n}`, at, by }; };
const tell = (ingredient: string, amount: number, at: string, by = 'enhet-a'): InventoryEvent => ({ type: 'telling', ...base(by, at), ingredient, amount });
const mark = (staple: string, level: 'har' | 'snart-tom' | 'tom', at: string, by = 'enhet-a'): InventoryEvent => ({ type: 'nivå', ...base(by, at), staple, level });
const made = (ingredient: string, amount: number, at: string): InventoryEvent =>
  ({ type: 'laget', ...base('enhet-a', at), week: W, line: `laget|${W}|0`, day: 0, recipeId: 'x', uses: [{ ingredient, amount }] });
const buy = (ingredient: string, packSize: number, at: string, by = 'enhet-a'): InventoryEvent =>
  ({ type: 'kjøp', ...base(by, at), week: W, line: purchaseLineId(W, 'demoA', ingredient, `${ingredient}-p`), ingredient, productId: `${ingredient}-p`, storeId: 'demoA', packs: 1, packSize, unit: 'g' });
const approve = (lineId: string, by = 'enhet-a', at = t(++n)): ListEvent => ({ type: 'manuell', id: `${by}-g-${at}`, at, by, line: { id: lineId, text: 'x', note: 'y' } });
const reject = (lineId: string, by = 'enhet-a', at = t(++n)): ListEvent => ({ type: 'manuell-fjern', id: `${by}-a-${at}`, at, by, lineId });
const check = (lineId: string, at: string, by = 'enhet-a'): ListEvent => ({ type: 'kryss', id: `${by}-k-${at}`, at, by, week: parseStapleLine(lineId)!.week, key: lineId });

const RIS: Staple = { id: 'ris', min: 500 };
const KAFFE: Staple = { id: 'kaffe' };
const status = (staples: Staple[], log: InventoryLog, list: ListLog = []) => stapleStatus(staples, applyEvents([], log), stapleListFacts(list), info);
const byId = (s: StapleStatus[], id: string) => s.find((x) => x.id === id)!;
const suggestions = (staples: Staple[], log: InventoryLog, list: ListLog = [], week = W) => {
  const facts = stapleListFacts(list);
  return stapleSuggestions(stapleStatus(staples, applyEvents([], log), facts, info), facts, week);
};

describe('basisvarer: terskel', () => {
  it('under minstegrensen etter at noe er brukt: foreslås med linje-id per uke og vare', () => {
    const log = [tell('ris', 800, t(1))];
    expect(byId(status([RIS], log), 'ris')).toMatchObject({ state: 'ok', have: 800, min: 500, suggest: false });
    const after = [...log, made('ris', 400, t(2))];
    expect(byId(status([RIS], after), 'ris')).toMatchObject({ state: 'under-grense', have: 400, suggest: true });
    expect(suggestions([RIS], after)).toEqual([expect.objectContaining({ id: 'ris', lineId: stapleLineId(W, 'ris'), state: 'under-grense' })]);
    expect(stapleLineId(W, 'ris')).toBe('basis:2026-11-23|ris');
    expect(parseStapleLine(stapleLineId(W, 'egen:kaffe-filter'))).toEqual({ week: W, staple: 'egen:kaffe-filter' });
  });
  it('akkurat på grensen er nok; bruker samme beholdning som matskapet (deriveStock)', () => {
    const log = [tell('ris', 900, t(1)), made('ris', 400, t(2))];
    expect(deriveStock(applyEvents([], log)).total.ris).toBe(500);
    expect(byId(status([RIS], log), 'ris')).toMatchObject({ state: 'ok', have: 500, suggest: false });
  });
  it('kjøpt og ikke brukt teller som hjemme', () => {
    expect(byId(status([RIS], [tell('ris', 0, t(1)), buy('ris', 1000, t(2))]), 'ris')).toMatchObject({ state: 'ok', have: 1000 });
  });
  it('aldri telt er ukjent, ikke null: ingen forslag før beholdningen er kjent', () => {
    expect(byId(status([RIS], []), 'ris')).toMatchObject({ state: 'ikke-telt', have: null, suggest: false });
    expect(byId(status([RIS], [tell('ris', 0, t(1))]), 'ris')).toMatchObject({ state: 'under-grense', have: 0, suggest: true });
  });
  it('forventet rest er aldri beholdning (bare hendelsesloggen teller)', () => {
    // Ingen telling, bare et forslag om rest i kurven: fortsatt ukjent.
    expect(byId(status([RIS], []), 'ris').have).toBeNull();
  });
});

describe('basisvarer: «snart tom» og «tom» manuelt', () => {
  it('nivåvare uten mengde: «snart tom» og «tom» foreslås, «har» opphever', () => {
    expect(byId(status([KAFFE], []), 'kaffe')).toMatchObject({ state: 'ok', mark: null, suggest: false, unit: null, min: null });
    expect(byId(status([KAFFE], [mark('kaffe', 'snart-tom', t(1))]), 'kaffe')).toMatchObject({ state: 'snart-tom', mark: 'snart-tom', suggest: true });
    expect(byId(status([KAFFE], [mark('kaffe', 'tom', t(1))]), 'kaffe')).toMatchObject({ state: 'tom', suggest: true });
    expect(byId(status([KAFFE], [mark('kaffe', 'tom', t(1)), mark('kaffe', 'har', t(2))]), 'kaffe')).toMatchObject({ state: 'ok', suggest: false });
  });
  it('mengdevare kan også markeres «snart tom» selv om tellingen er over grensen', () => {
    expect(byId(status([RIS], [tell('ris', 2000, t(1)), mark('ris', 'snart-tom', t(2))]), 'ris')).toMatchObject({ state: 'snart-tom', suggest: true });
  });
  it('et kjøp eller en ny telling etter markeringen opphever den; bruk gjør ikke det', () => {
    const tom = mark('ris', 'tom', t(2));
    expect(byId(status([RIS], [tell('ris', 2000, t(1)), tom, made('ris', 100, t(3))]), 'ris').state).toBe('tom');
    expect(byId(status([RIS], [tom, buy('ris', 1000, t(3))]), 'ris')).toMatchObject({ state: 'ok', mark: null });
    expect(byId(status([RIS], [tom, tell('ris', 300, t(3))]), 'ris')).toMatchObject({ state: 'under-grense', mark: null });
  });
  it('«har» gjelder til beholdningen endres; deretter avgjør grensen igjen', () => {
    const log = [tell('ris', 300, t(1)), mark('ris', 'har', t(2))];
    expect(byId(status([RIS], log), 'ris')).toMatchObject({ state: 'ok', suggest: false });
    expect(byId(status([RIS], [...log, made('ris', 50, t(3))]), 'ris')).toMatchObject({ state: 'under-grense', suggest: true });
  });
  it('en avkrysset basisvarelinje i handlelista opphever markeringen; fjernes krysset, gjelder den igjen', () => {
    const line = stapleLineId(W, 'kaffe');
    const log = [mark('kaffe', 'tom', t(1))];
    const k = check(line, t(3));
    const list = [approve(line, 'enhet-a', t(2)), k];
    expect(byId(status([KAFFE], log, list), 'kaffe')).toMatchObject({ state: 'ok', mark: null, open: null });
    const unchecked: ListLog = [...list, { type: 'avkryss', id: 'u1', at: t(4), by: 'enhet-a', week: W, key: line, seen: [k.id] }];
    expect(byId(status([KAFFE], log, unchecked), 'kaffe')).toMatchObject({ state: 'tom', open: line });
    // Ny markering etter avkrysningen: ny linje for den nye uka.
    expect(suggestions([KAFFE], [...log, mark('kaffe', 'tom', t(5))], list, W2).map((s) => s.lineId)).toEqual([stapleLineId(W2, 'kaffe')]);
  });
});

describe('basisvarer: forslag, godkjenning og avvisning (idempotent)', () => {
  const log = [mark('kaffe', 'tom', t(1))];
  const line = stapleLineId(W, 'kaffe');
  it('godkjent forslag ligger på lista og foreslås ikke igjen, heller ikke neste uke mens linja er åpen', () => {
    expect(suggestions([KAFFE], log).map((s) => s.lineId)).toEqual([line]);
    expect(suggestions([KAFFE], log, [approve(line)])).toEqual([]);
    expect(suggestions([KAFFE], log, [approve(line)], W2)).toEqual([]);
    expect(byId(status([KAFFE], log, [approve(line)]), 'kaffe').open).toBe(line);
  });
  it('avvist forslag kommer ikke igjen samme uke, men neste uke hvis varen fortsatt mangler', () => {
    expect(suggestions([KAFFE], log, [reject(line)])).toEqual([]);
    expect(suggestions([KAFFE], log, [reject(line)], W2).map((s) => s.lineId)).toEqual([stapleLineId(W2, 'kaffe')]);
  });
  it('to mottak av samme hendelser gir samme tilstand og ingen doble linjer (regel 8)', () => {
    const a = approve(line, 'enhet-a');
    const twice = applyListEvents([], [a, a, a]);
    expect(twice).toHaveLength(1);
    const logTwice = applyEvents([], [...log, ...log]);
    expect(logTwice).toHaveLength(1);
    expect(stapleListFacts(twice).lines).toEqual([line]);
  });
  it('to enheter godkjenner samme forslag: én linje', () => {
    const list = applyListEvents([], [approve(line, 'enhet-a'), approve(line, 'enhet-b')]);
    expect(stapleListFacts(list).lines).toEqual([line]);
    expect(suggestions([KAFFE], log, list)).toEqual([]);
  });
  it('én godkjenner og én avviser samtidig: fjerning vinner, uansett rekkefølge', () => {
    const g = approve(line, 'enhet-a'), r = reject(line, 'enhet-b');
    for (const order of [[g, r], [r, g]]) {
      const facts = stapleListFacts(applyListEvents([], order));
      expect(facts.lines).toEqual([]);
      expect(facts.removed).toEqual([line]);
      expect(suggestions([KAFFE], log, order)).toEqual([]);
    }
  });
  it('forslaget har kort tekst og forklaring; aldri pris', () => {
    const [s] = suggestions([RIS], [tell('ris', 200, t(1))]);
    expect(s).toMatchObject({ name: 'Ris', text: 'Ris' });
    expect(s.note).toMatch(/Basisvare/);
    expect(s.note).toMatch(/200 g/);
    expect(s.note).toMatch(/minst 500 g/);
    expect(JSON.stringify(s)).not.toMatch(/kr|øre|Ore/);
  });
});

describe('basisvarer: determinisme og flere enheter', () => {
  const events: InventoryEvent[] = [
    tell('ris', 900, t(1), 'enhet-a'), mark('kaffe', 'tom', t(2), 'enhet-b'), made('ris', 500, t(3)), mark('kaffe', 'snart-tom', t(4), 'enhet-a'),
    mark('mel', 'tom', t(5), 'enhet-b'), buy('mel', 1000, t(6), 'enhet-a'), mark('salt', 'snart-tom', t(7), 'enhet-b'),
  ];
  const staples: Staple[] = [RIS, KAFFE, { id: 'mel', min: 200 }, { id: 'salt' }];
  const list: ListLog = [approve(stapleLineId(W, 'salt'), 'enhet-b')];
  it('samme resultat i omvendt hendelsesrekkefølge og omvendt rekkefølge på basisvarene', () => {
    const fwd = suggestions(staples, events, list);
    expect(suggestions([...staples].reverse(), [...events].reverse(), [...list].reverse())).toEqual(fwd);
    expect(fwd.map((s) => [s.id, s.state])).toEqual([['kaffe', 'snart-tom'], ['ris', 'under-grense']]);
  });
  it('to enheter markerer ulikt: siste markering etter (tid, id) gjelder hos begge', () => {
    const a = mark('kaffe', 'tom', t(10), 'enhet-a'), b = mark('kaffe', 'har', t(11), 'enhet-b');
    expect(byId(status([KAFFE], [a, b]), 'kaffe').state).toBe('ok');
    expect(byId(status([KAFFE], [b, a]), 'kaffe').state).toBe('ok');
    // Samme tidspunkt: id avgjør, likt overalt.
    const c = { ...mark('kaffe', 'tom', t(20), 'enhet-a'), id: 'b' }, d = { ...mark('kaffe', 'har', t(20), 'enhet-b'), id: 'a' };
    expect(byId(status([KAFFE], [c, d]), 'kaffe').state).toBe(byId(status([KAFFE], [d, c]), 'kaffe').state);
  });
  it('endrer aldri inndata og sorterer etter navn', () => {
    const copy = JSON.parse(JSON.stringify({ staples, events, list }));
    const s = status(staples, events, list);
    expect({ staples, events, list }).toEqual(copy);
    expect(s.map((x) => x.name)).toEqual(['Hvetemel', 'Kaffe', 'Ris', 'Salt']);
  });
});

describe('basisvarer: gyldige verdier (delt med serveren)', () => {
  it('nivå-hendelsen er gyldig bare med kjent nivå og vare-id', () => {
    expect(isValidEvent(mark('kaffe', 'tom', t(1)))).toBe(true);
    expect(isValidEvent({ ...mark('kaffe', 'tom', t(1)), level: 'halvfull' } as never)).toBe(false);
    expect(isValidEvent({ ...mark('kaffe', 'tom', t(1)), staple: '' } as never)).toBe(false);
    expect(isValidEvent({ ...mark('kaffe', 'tom', t(1)), staple: 'Kaffe med mer' } as never)).toBe(false);
  });
  it('egen vare: kort, renset navn uten tall og kontrolltegn; id avledet av navnet', () => {
    expect(cleanStapleName('  Kaffe​  filter ')).toBe('Kaffe filter');
    expect(cleanStapleName('Tlf 99887766')).toBe('Tlf');
    expect(cleanStapleName('x'.repeat(50))).toHaveLength(STAPLE_LIMITS.name);
    expect(cleanStapleName('123')).toBeNull();
    expect(customStapleId('Kaffe filter')).toBe('egen:kaffe-filter');
    expect(customStapleId('Grønnsaksbuljong')).toBe('egen:grønnsaksbuljong');
  });
  it('mengde bare for varer som kan telles i matskapet', () => {
    expect(countable('ris', info)).toBe(true);
    expect(countable('kaffe', info)).toBe(false);
    expect(countable('olje', info)).toBe(false); // katalogens basisvare telles ikke i matskapet
    expect(countable('egen:kaffe', info)).toBe(false);
  });
  it('lista valideres strengt: kjente id-er, ingen dubletter, ingen ukjente felt, lengdegrenser', () => {
    expect(isValidStaples(undefined, info)).toBe(true);
    expect(isValidStaples([RIS, KAFFE, { id: 'egen:kaffe-filter', name: 'Kaffe filter' }], info)).toBe(true);
    for (const bad of [
      [{ id: 'ukjent' }], [RIS, RIS], [{ id: 'ris', min: 0 }], [{ id: 'ris', min: STAPLE_LIMITS.min + 1 }], [{ id: 'kaffe', min: 100 }],
      [{ id: 'ris', name: 'Ris' }], [{ id: 'ris', ekstra: 1 }], [{ id: 'egen:x' }], [{ id: 'egen:kaffe', name: 'Te' }],
      [{ id: 'egen:kaffe', name: 'Kaffe', min: 2 }], [{ id: `egen:${'a'.repeat(31)}`, name: 'a'.repeat(31) }],
      Array.from({ length: STAPLE_LIMITS.count + 1 }, (_, i) => ({ id: customStapleId(`vare ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`)!, name: `vare ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}` })),
      'ris', [null],
    ]) expect(isValidStaples(bad, info), JSON.stringify(bad).slice(0, 80)).toBe(false);
  });
});
