// Klienttester av synk-logikken mot en ekte synk-server (minnedatabase). Hver «enhet» har egen tilstand og eget nett.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initialState, migrateState, recordEvent, recordList, type AppState } from '../store';
import { conflicts, deriveStock, lineStates, purchaseLineId, type InventoryEvent } from '../engine/inventory';
import { checks, manualLines, toggleEvent } from './list';
import { SyncApi, syncErrorText } from './api';
import { connect, isDirty, receiveDoc, resolveConflict, syncOnce, syncStatus } from './engine';
import { merge3 } from './docs';
import { activeChanges, applyChange, changeLineId, notFoundEvent, substituteEvent, versionsFor, type AdjustedLine, type ListChange } from '../engine/substitution';
import * as act from '../listActions';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import type { Catalog } from '../engine/types';
import { startTestServer } from '../../server/sync/testkit';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStorage } from '../../server/storage/sqlite';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

type Srv = Awaited<ReturnType<typeof startTestServer>>;
let srv: Srv;
beforeEach(async () => { srv = await startTestServer(); });
afterEach(async () => { await srv.close(); });

const WEEK = '2026-11-23';
const LINE = purchaseLineId(WEEK, 'demoA', 'pasta', 'pasta500');

class Device {
  state: AppState;
  online = true;
  /** Mister svaret etter at forespørselen er levert (simulerer brudd midt i en levering). */
  dropNextResponse = false;
  private n = 0;
  private clock = Date.parse('2026-11-23T10:00:00.000Z');
  readonly api: SyncApi;
  constructor(public id: string, state: AppState = initialState) {
    this.state = state;
    this.api = new SyncApi(srv.base, async (url, init) => {
      if (!this.online) throw new TypeError('Failed to fetch');
      const res = await fetch(url, init);
      if (this.dropNextResponse) { this.dropNextResponse = false; throw new TypeError('connection reset'); }
      return res;
    });
  }
  io = { get: () => this.state, set: (f: (s: AppState) => AppState) => { this.state = f(this.state); } };
  stamp(atMs?: number) {
    this.n += 1;
    return { id: `${this.id}-${this.n}`, at: new Date(atMs ?? (this.clock += 1000)).toISOString(), by: this.id };
  }
  sync() { return syncOnce(this.io, this.api, () => '2026-11-23T12:00:00.000Z'); }
  record(e: InventoryEvent) { this.state = recordEvent(this.state, e); }
  toggle(key: string) { this.state = recordList(this.state, toggleEvent(this.state.list, WEEK, key, this.stamp())); }
  async create(label?: string) { const r = await this.api.createHousehold(this.id, label); this.state = connect(this.state, r.token, r.member); }
  async join(code: string) { const r = await this.api.join(code, this.id); this.state = connect(this.state, r.token, r.member); }
  async invite() { return (await this.api.withToken(this.state.sync!.token).invite()).code; }
}
const buy = (d: Device, packs: number, at?: number): InventoryEvent => ({
  type: 'kjøp', ...d.stamp(at), week: WEEK, line: LINE, ingredient: 'pasta', productId: 'pasta500', storeId: 'demoA', unit: 'g', packs, packSize: 500,
});
const tell = (d: Device, amount: number, at?: number): InventoryEvent => ({ type: 'telling', ...d.stamp(at), ingredient: 'ris', amount });

async function pair() {
  const a = new Device('enhet-aaaa1111');
  const b = new Device('enhet-bbbb2222');
  await a.create('Voksen 1');
  await b.join(await a.invite());
  await a.sync(); await b.sync();
  return { a, b };
}
const ids = (s: AppState) => s.inventory.map((e) => e.id).sort();

describe('synk mellom to enheter', () => {
  it('en avkrysning vises hos den andre med hvem som krysset av', async () => {
    const { a, b } = await pair();
    a.toggle('demoA:pasta');
    await a.sync(); await b.sync();
    expect(checks(b.state.list, WEEK).get('demoA:pasta')?.map((m) => m.by)).toEqual(['enhet-aaaa1111']);
    expect(b.state.sync!.members.find((m) => m.id === 'enhet-aaaa1111')?.label).toBe('Voksen 1');
    expect(syncStatus(b.state, { offline: false, busy: false }, 0)).toBe('synket');
  });

  it('to voksne krysser av samme linje samtidig: begge avkrysningene står, og «fjern» fjerner bare det som var sett', async () => {
    const { a, b } = await pair();
    a.toggle('demoA:pasta');
    b.toggle('demoA:pasta');
    await a.sync(); await b.sync(); await a.sync();
    for (const d of [a, b]) expect(checks(d.state.list, WEEK).get('demoA:pasta')!.map((m) => m.by).sort()).toEqual(['enhet-aaaa1111', 'enhet-bbbb2222']);
    // A fjerner krysset (ser begge). Samtidig, uten å ha sett det, krysser B av igjen.
    a.toggle('demoA:pasta');
    b.online = false;
    b.state = recordList(b.state, { type: 'kryss', ...b.stamp(), week: WEEK, key: 'demoA:pasta' });
    await a.sync();
    b.online = true;
    await b.sync(); await a.sync();
    for (const d of [a, b]) expect(checks(d.state.list, WEEK).get('demoA:pasta')!.map((m) => m.by)).toEqual(['enhet-bbbb2222']);
  });

  it('samme kjøp fra to voksne gir ett kjøp; ulikt antall blir en konflikt som må bekreftes, likt hos begge', async () => {
    const { a, b } = await pair();
    a.record(buy(a, 2));
    b.record(buy(b, 2));
    await a.sync(); await b.sync(); await a.sync();
    expect(deriveStock(a.state.inventory).total.pasta).toBe(1000);
    expect(deriveStock(b.state.inventory).total.pasta).toBe(1000);
    // Ny linje: uenighet om antall.
    const line2 = purchaseLineId(WEEK, 'demoA', 'tomat', 'tomat400');
    const t = (d: Device, packs: number): InventoryEvent => ({ type: 'kjøp', ...d.stamp(), week: WEEK, line: line2, ingredient: 'tomat', productId: 'tomat400', storeId: 'demoA', unit: 'g', packs, packSize: 400 });
    a.record(t(a, 2)); b.record(t(b, 3));
    await a.sync(); await b.sync(); await a.sync();
    for (const d of [a, b]) {
      expect(conflicts(d.state.inventory).map((p) => p.candidates)).toEqual([[2, 3]]);
      expect(deriveStock(d.state.inventory).total.tomat).toBeUndefined();
      expect(syncStatus(d.state, { offline: false, busy: false }, conflicts(d.state.inventory).length)).toBe('konflikt');
    }
    b.record({ type: 'løs', ...b.stamp(), line: line2, packs: 3 });
    await b.sync(); await a.sync();
    for (const d of [a, b]) expect(lineStates(d.state.inventory).purchases.get(line2)).toMatchObject({ status: 'kjøpt', packs: 3 });
  });

  it('endring mens en enhet er frakoblet flettes riktig ved gjenoppkobling, uavhengig av rekkefølge', async () => {
    const { a, b } = await pair();
    b.online = false;
    // B handler uten nett kl. 10:30; A teller ris kl. 11:00 og handler samme linje kl. 11:30 med annet antall.
    b.record(buy(b, 1, Date.parse('2026-11-23T10:30:00.000Z')));
    b.toggle('demoA:pasta');
    expect((await b.sync()).offline).toBe(true);
    expect(syncStatus(b.state, { offline: true, busy: false }, 0)).toBe('venter');
    expect(b.state.outbox).toHaveLength(1);
    a.record(tell(a, 300, Date.parse('2026-11-23T11:00:00.000Z')));
    await a.sync();
    b.online = true;
    await b.sync(); await a.sync();
    expect(ids(a.state)).toEqual(ids(b.state));
    expect(deriveStock(a.state.inventory)).toEqual(deriveStock(b.state.inventory));
    expect(deriveStock(a.state.inventory).total).toEqual({ pasta: 500, ris: 300 });
    expect(checks(a.state.list, WEEK).get('demoA:pasta')?.[0].by).toBe('enhet-bbbb2222');
    expect(b.state.outbox).toEqual([]);
    expect(b.state.listOutbox).toEqual([]);
  });

  it('avbrutt levering (svaret kom aldri) sendes på nytt uten doble rader', async () => {
    const { a, b } = await pair();
    a.record(buy(a, 2));
    a.dropNextResponse = true;
    const r = await a.sync();
    expect(r.ok).toBe(false);
    expect(a.state.outbox).toHaveLength(1); // fortsatt i utboksen
    await a.sync(); await a.sync();
    expect(a.state.outbox).toEqual([]);
    await b.sync();
    expect(b.state.inventory).toHaveLength(1);
    expect(srv.storage.counts().events).toBe(1);
  });

  it('flytter eksisterende lokal tilstand inn i husstanden ved første tilkobling, uten duplikater', async () => {
    // A har brukt appen alene: gammel pantry, manuelle linjer og avkrysninger (gammelt format).
    const old = migrateState({
      ...initialState, settings: { ...initialState.settings, pantry: { pasta: 400 } },
      manual: [{ id: 'm0', text: 'Torsk 400 g', note: 'Demo' }], checked: { 'demoA:pasta': true },
    } as never, WEEK, 'enhet-aaaa1111');
    const a = new Device('enhet-aaaa1111', { ...old, outbox: [] });
    a.record(tell(a, 200));
    await a.create();
    expect(a.state.outbox).toHaveLength(2); // hele loggen, også det som var levert «før»
    await a.sync(); await a.sync();
    // B har også gammel pantry (samme faste migrerings-id) og egne data.
    const b = new Device('enhet-bbbb2222', migrateState({ ...initialState, settings: { ...initialState.settings, pantry: { pasta: 999 } } } as never, WEEK, 'enhet-bbbb2222'));
    b.record(tell(b, 50, Date.parse('2026-11-22T09:00:00.000Z')));
    await b.join(await a.invite());
    await b.sync(); await a.sync(); await b.sync();
    expect(ids(a.state)).toEqual(ids(b.state));
    expect(a.state.inventory).toHaveLength(3); // migrert:pasta én gang + to tellinger
    expect(srv.storage.counts().events).toBe(3 + 2); // + manuell linje og avkrysning
    expect(manualLines(b.state.list).map((m) => m.text)).toEqual(['Torsk 400 g']);
    expect(checks(b.state.list, WEEK).has('demoA:pasta')).toBe(true);
    // B overtar husstandens plan og innstillinger (budsjettet fra A).
    a.state = { ...a.state, settings: { ...a.state.settings, budgetOre: 123_400 } };
    await a.sync(); await b.sync();
    expect(b.state.settings.budgetOre).toBe(123_400);
  });

  it('«utsolgt / fant ikke» deles: samme valg gjelder hos begge, også uten nett først', async () => {
    const { a, b } = await pair();
    const line = changeLineId(WEEK, 'demoA', 'pasta', 'pasta500');
    const e: ListChange = { type: 'fant-ikke', ...a.stamp(), week: WEEK, line, storeId: 'demoA', ingredient: 'pasta', fromProductId: 'pasta500', soldOut: ['pasta500'], choice: 'hopp-over' };
    a.online = false;
    a.state = { ...a.state, listChanges: applyChange(a.state.listChanges ?? [], e), changeOutbox: [e] };
    expect((await a.sync()).offline).toBe(true);
    a.online = true;
    await a.sync(); await a.sync(); await b.sync();
    expect(a.state.changeOutbox).toEqual([]);
    expect(activeChanges(b.state.listChanges ?? [], WEEK).get(line)).toMatchObject({ type: 'fant-ikke', choice: 'hopp-over', by: 'enhet-aaaa1111' });
    // Levert to ganger: én rad.
    expect((await b.api.withToken(b.state.sync!.token).pull(0)).events.filter((x) => x.stream === 'endring')).toHaveLength(1);
  });

  it('en fjernet enhet kobles fra og beholder dataene sine', async () => {
    const { a, b } = await pair();
    b.record(tell(b, 10));
    await a.api.withToken(a.state.sync!.token).removeMember('enhet-bbbb2222');
    const r = await b.sync();
    expect(r.ok).toBe(false);
    expect(b.state.sync).toBeNull();
    expect(b.state.syncNotice).toMatch(/ikke lenger med/);
    expect(b.state.inventory).toHaveLength(1);
    expect(syncStatus(b.state, { offline: false, busy: false }, 0)).toBe('lokal');
  });
});

describe('plan og innstillinger', () => {
  const slot = (day: number, recipeId: string) => ({ day, recipeId, locked: false });
  async function withPlan() {
    const { a, b } = await pair();
    a.state = { ...a.state, slots: [slot(0, 'bolognese'), slot(1, 'taco'), slot(2, 'karri')] };
    await a.sync(); await b.sync();
    expect(b.state.slots.map((s) => s.recipeId)).toEqual(['bolognese', 'taco', 'karri']);
    return { a, b };
  }
  it('endringer på ulike dager flettes uten konflikt', async () => {
    const { a, b } = await withPlan();
    a.state = { ...a.state, slots: a.state.slots.map((s) => (s.day === 0 ? slot(0, 'ovnstorsk') : s)) };
    b.state = { ...b.state, slots: b.state.slots.map((s) => (s.day === 2 ? slot(2, 'taco') : s)) };
    await a.sync(); await b.sync(); await a.sync();
    for (const d of [a, b]) {
      expect(d.state.slots.map((s) => s.recipeId)).toEqual(['ovnstorsk', 'taco', 'taco']);
      expect(d.state.sync!.conflicts).toEqual({});
    }
  });
  it('samme dag endret ulikt gir konflikt; ingenting overskrives før brukeren velger', async () => {
    const { a, b } = await withPlan();
    a.state = { ...a.state, slots: a.state.slots.map((s) => (s.day === 1 ? slot(1, 'ovnstorsk') : s)) };
    b.state = { ...b.state, settings: { ...b.state.settings, budgetOre: 80_000 }, slots: b.state.slots.map((s) => (s.day === 1 ? slot(1, 'karri') : s.day === 2 ? slot(2, 'bolognese') : s)) };
    await a.sync(); await b.sync();
    const c = b.state.sync!.conflicts.plan!;
    expect(c.fields).toEqual(['slot:1']);
    expect(c.by).toBe('enhet-aaaa1111');
    expect(b.state.slots.map((s) => s.recipeId)).toEqual(['bolognese', 'karri', 'bolognese']); // egen verdi står
    expect(syncStatus(b.state, { offline: false, busy: false }, 0)).toBe('konflikt');
    await b.sync(); await a.sync();
    expect(a.state.slots[1].recipeId).toBe('ovnstorsk'); // B sendte ikke planen mens konflikten var åpen
    expect(a.state.settings.budgetOre).toBe(80_000); // men innstillingene gikk gjennom
    b.state = resolveConflict(b.state, 'plan', 'theirs');
    await b.sync(); await a.sync();
    for (const d of [a, b]) expect(d.state.slots.map((s) => s.recipeId)).toEqual(['bolognese', 'ovnstorsk', 'bolognese']);
  });
  it('«behold min» sender egen verdi til de andre', async () => {
    const { a, b } = await withPlan();
    a.state = { ...a.state, slots: a.state.slots.map((s) => (s.day === 1 ? slot(1, 'ovnstorsk') : s)) };
    b.state = { ...b.state, slots: b.state.slots.map((s) => (s.day === 1 ? slot(1, 'karri') : s)) };
    await a.sync(); await b.sync();
    b.state = resolveConflict(b.state, 'plan', 'mine');
    await b.sync(); await a.sync();
    for (const d of [a, b]) expect(d.state.slots[1].recipeId).toBe('karri');
  });
  it('en åpen konflikt forsvinner ikke når den andre enheten endrer noe annet', async () => {
    const { a, b } = await withPlan();
    a.state = { ...a.state, slots: a.state.slots.map((s) => (s.day === 1 ? slot(1, 'ovnstorsk') : s)) };
    b.state = { ...b.state, slots: b.state.slots.map((s) => (s.day === 1 ? slot(1, 'karri') : s)) };
    await a.sync(); await b.sync();
    a.state = { ...a.state, option: 'combo' };
    await a.sync(); await b.sync();
    expect(b.state.sync!.conflicts.plan!.fields).toEqual(['slot:1']);
    expect(b.state.option).toBe('combo');
  });
  it('tre-veis fletting er ren: samme verdi på begge sider er ingen konflikt', () => {
    const base = { slots: [slot(0, 'taco')], approved: true, option: 'regular' as const };
    const mine = { ...base, approved: false };
    const theirs = { ...base, approved: false, option: 'combo' as const };
    expect(merge3('plan', base, mine, theirs)).toEqual({ merged: { ...base, approved: false, option: 'combo' }, conflicts: [] });
  });
  it('kostkrav og allergier synkes ikke: de blir på hver enhet og når aldri serveren', async () => {
    const { a, b } = await pair();
    a.state = { ...a.state, settings: { ...a.state.settings, avoid: ['melk'], avoidFoods: ['svin'], vegetarian: true, budgetOre: 70_000 } };
    b.state = { ...b.state, settings: { ...b.state.settings, avoid: ['peanotter'] } };
    await a.sync(); await b.sync(); await a.sync();
    expect(b.state.settings.budgetOre).toBe(70_000);
    expect(b.state.settings).toMatchObject({ avoid: ['peanotter'], vegetarian: false });
    expect(a.state.settings).toMatchObject({ avoid: ['melk'], avoidFoods: ['svin'], vegetarian: true });
    const household = (await srv.storage.authenticate(sha(a.state.sync!.token), srv.now()))!.householdId;
    const stored = await srv.storage.readSince(household, 0, 100);
    expect(stored.docs.map((d) => d.name).sort()).toEqual(['innstillinger', 'plan']);
    expect(stored.docs.map((d) => d.body).join('')).not.toMatch(/melk|svin|peanotter|vegetarian|avoid/);
  });
  it('en plan fra en annen enhet endrer aldri filteret på denne enheten', async () => {
    const { a, b } = await pair();
    b.state = { ...b.state, settings: { ...b.state.settings, avoid: ['gluten'], avoidFoods: ['svin'] } };
    a.state = { ...a.state, slots: [slot(0, 'bolognese'), slot(1, 'taco')], approved: true };
    await b.sync(); await a.sync(); await b.sync();
    expect(b.state.slots.map((s) => s.recipeId)).toEqual(['bolognese', 'taco']);
    expect(b.state.settings).toMatchObject({ avoid: ['gluten'], avoidFoods: ['svin'], vegetarian: false });
    expect(a.state.settings).toMatchObject({ avoid: [], vegetarian: false });
  });
  it('alle synkede innstillingsfelt godtas av serveren (også valgfrie som tilbudskjeder)', async () => {
    const { a, b } = await pair();
    a.state = { ...a.state, settings: { ...a.state.settings, useOffers: false, offerChains: ['KIWI', 'MENY'] } };
    await a.sync(); await b.sync();
    expect(isDirty(a.state, 'innstillinger')).toBe(false);
    expect(b.state.settings).toMatchObject({ useOffers: false, offerChains: ['KIWI', 'MENY'] });
  });
  it('ignorerer ugyldige eller eldre dokumentversjoner', async () => {
    const { b } = await withPlan();
    const before = b.state;
    expect(receiveDoc(b.state, { name: 'plan', version: 99, body: { slots: 'x' } as never, updatedBy: 'x', updatedAt: 'x' })).toBe(before);
    expect(receiveDoc(b.state, { name: 'plan', version: 1, body: { slots: [], approved: false, option: 'regular' }, updatedBy: 'x', updatedAt: 'x' })).toBe(before);
  });
});

describe('godkjent liste og «utsolgt / fant ikke» i husstanden', () => {
  const slots = [{ day: 0, recipeId: 'lakseris', locked: false }, { day: 1, recipeId: 'bolognese', locked: false }];
  // Ny prisimport: 800 g kjøttdeig blir billigere enn 400 g (motoren ville byttet produkt).
  const cheaper: Catalog = { ...catalog, prices: catalog.prices.map((o) => (o.productId === 'kd800' && o.storeId === 'demoA' ? { ...o, ore: 4990, observed: '2026-11-22' } : o)) };
  const env = (d: Device, cat: Catalog = catalog): act.ActionEnv =>
    ({ ctx: { catalog: cat, settings: defaultSettings, shopDate: WEEK }, week: WEEK, stamp: () => d.stamp() });
  const view = (d: Device, cat: Catalog = catalog) => act.weekState(d.state, env(d, cat));
  const lineOf = (d: Device, ing: string) => view(d).basket.lines.find((l) => l.ingredient === ing) as AdjustedLine;
  const product = (d: Device, ing: string, cat: Catalog = catalog) => view(d, cat).basket.lines.find((l) => l.ingredient === ing)?.productId;
  const versionIds = (d: Device) => versionsFor(d.state.planHistory ?? [], WEEK).map((v) => v.id);
  async function approvedPair() {
    const { a, b } = await pair();
    a.state = act.approve({ ...a.state, slots }, 'regular', env(a));
    await a.sync(); await b.sync();
    return { a, b };
  }

  it('en godkjent liste deles: samme fastholdte produkter, samme sum og samme historikk hos begge', async () => {
    const { a, b } = await approvedPair();
    expect(b.state.approved).toBe(true);
    expect(versionIds(b)).toEqual(versionIds(a));
    expect(versionIds(a)).toHaveLength(1);
    expect(a.state.versionOutbox).toEqual([]);
    // Etter ny prisimport holder begge enhetene den godkjente pakken, og viser samme avvik.
    expect(product(a, 'kjottdeig', cheaper)).toBe('kd400');
    expect(product(b, 'kjottdeig', cheaper)).toBe('kd400');
    expect(view(b, cheaper).basket.totalOre).toBe(view(a, cheaper).basket.totalOre);
    expect(view(b, cheaper).drift).toEqual(view(a, cheaper).drift);
    expect(view(a, cheaper).drift.map((d) => d.ingredient)).toEqual(['kjottdeig']);
    // Godkjent på nytt på B uten endret grunnlag: ingen ny versjon (ingen duplikat).
    b.state = act.approve(b.state, 'regular', env(b));
    expect(versionIds(b)).toHaveLength(1);
  });

  it('to voksne som fastholder ulikt samtidig (uten nett) får samme konflikt, og et valg løser den hos begge', async () => {
    const { a, b } = await approvedPair();
    a.online = false; b.online = false;
    a.state = act.acceptPrices(a.state, env(a, cheaper)); // «Bruk nye priser»
    b.state = act.keepPrices(b.state, env(b, cheaper)); // «Behold godkjent liste»
    a.online = true; b.online = true;
    await a.sync(); await b.sync(); await a.sync();
    const ca = view(a, cheaper).ps;
    const cb = view(b, cheaper).ps;
    expect(ca.pin).toBeNull();
    expect(ca.conflict.map((v) => v.reason).sort()).toEqual(['beholdt', 'nye-priser']);
    expect(cb.conflict.map((v) => v.id)).toEqual(ca.conflict.map((v) => v.id));
    // Ingen side vinner stille: begge viser motorens produkt nå, med samme sum.
    expect(product(a, 'kjottdeig', cheaper)).toBe('kd800');
    expect(view(b, cheaper).basket.totalOre).toBe(view(a, cheaper).basket.totalOre);
    // B velger listen A tok inn. Etter synk er det én liste hos begge.
    b.state = act.chooseList(b.state, cb.conflict.find((v) => v.reason === 'nye-priser')!, env(b, cheaper));
    await b.sync(); await a.sync();
    for (const d of [a, b]) {
      const ps = view(d, cheaper).ps;
      expect(ps.conflict).toEqual([]);
      expect(ps.pin?.reason).toBe('valgt');
      expect(product(d, 'kjottdeig', cheaper)).toBe('kd800');
    }
    expect(versionIds(a)).toEqual(versionIds(b));
  });

  it('ulike valg på samme linje fra to enheter blir konflikt hos begge; et valg løser den og rydder matskapet', async () => {
    const { a, b } = await approvedPair();
    const pasta = lineOf(a, 'pasta');
    a.online = false; b.online = false;
    a.state = act.recordChange(a.state, notFoundEvent(pasta, WEEK, 'hopp-over', a.stamp()), 'fant-ikke', 'hopp over', undefined, env(a));
    b.state = act.recordChange(b.state, notFoundEvent(lineOf(b, 'pasta'), WEEK, 'bruk-hjemme', b.stamp()), 'fant-ikke', 'bruk hjemme', undefined, env(b));
    expect(deriveStock(b.state.inventory).total.pasta).toBe(pasta.need); // «bruk hjemme» registrert i matskapet
    a.online = true; b.online = true;
    await a.sync(); await b.sync(); await a.sync();
    for (const d of [a, b]) {
      const l = lineOf(d, 'pasta');
      expect(l.change?.type).toBe('konflikt');
      expect(l.costOre).toBeNull();
      expect(view(d).basket.complete).toBe(false);
    }
    expect(view(a).basket.totalOre).toBe(view(b).basket.totalOre);
    // A velger «hopp over»: valget bygger på begge, og B sin registrering i matskapet angres.
    a.state = act.recordChange(a.state, notFoundEvent(lineOf(a, 'pasta'), WEEK, 'hopp-over', a.stamp()), 'fant-ikke', 'valgt', undefined, env(a));
    await a.sync(); await b.sync();
    for (const d of [a, b]) {
      expect(view(d).basket.skipped.map((l) => l.ingredient)).toEqual(['pasta']);
      expect([...view(d).changes.values()].some((c) => c.type === 'konflikt')).toBe(false);
      expect(deriveStock(d.state.inventory).total.pasta).toBeUndefined();
    }
  });

  it('en erstatning gjort uten nett flettes med den andres valg; dobbel levering gir ingen doble rader', async () => {
    const { a, b } = await approvedPair();
    b.online = false;
    const kd = lineOf(b, 'kjottdeig');
    b.state = act.recordChange(b.state, substituteEvent(kd, WEEK, 'kd800', b.stamp()), 'erstatning', 'kd400 utsolgt', undefined, env(b));
    a.state = act.recordChange(a.state, notFoundEvent(lineOf(a, 'pasta'), WEEK, 'uavklart', a.stamp()), 'fant-ikke', 'fant ikke', undefined, env(a));
    await a.sync();
    b.online = true;
    b.dropNextResponse = true; // serveren lagrer, men svaret kommer aldri fram
    expect((await b.sync()).ok).toBe(false);
    expect(b.state.versionOutbox).toHaveLength(1);
    await b.sync(); await a.sync();
    expect(b.state.changeOutbox).toEqual([]);
    expect(b.state.versionOutbox).toEqual([]);
    const pulled = (await a.api.withToken(a.state.sync!.token).pull(0)).events;
    expect(pulled.filter((x) => x.stream === 'endring')).toHaveLength(2);
    expect(pulled.filter((x) => x.stream === 'planversjon')).toHaveLength(3); // godkjent + én endring fra hver
    for (const d of [a, b]) {
      const w = view(d);
      expect(w.ps.conflict).toEqual([]);
      expect(w.basket.lines.find((l) => l.ingredient === 'kjottdeig')).toMatchObject({ productId: 'kd800', change: { type: 'erstatt' } });
      expect(w.basket.lines.find((l) => l.ingredient === 'pasta')?.change?.type).toBe('fant-ikke');
    }
    expect(JSON.stringify(view(a).basket)).toBe(JSON.stringify(view(b).basket));
    expect(versionIds(a)).toEqual(versionIds(b));
  });

  it('et rettebytte ved «fant ikke» opphever godkjenningen hos begge', async () => {
    const { a, b } = await approvedPair();
    const next = slots.map((s) => (s.day === 0 ? { ...s, recipeId: 'taco' } : s));
    a.state = act.recordChange(a.state, notFoundEvent(lineOf(a, 'laks'), WEEK, 'uavklart', a.stamp()), 'bytt-rett', 'laks manglet', next, env(a));
    expect(a.state.approved).toBe(false);
    await a.sync(); await b.sync();
    expect(b.state.approved).toBe(false);
    expect(b.state.slots.map((s) => s.recipeId)).toEqual(['taco', 'bolognese']);
    expect(view(b).ps.pin).toBeNull();
  });
});

describe('gjenoppretting av serveren fra en eldre kopi', () => {
  // Filbasert database som kan kopieres (VACUUM INTO) og legges tilbake; serveren startes på nytt på samme port.
  let dir = '';
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'middag-restore-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });
  async function fileServer() {
    await srv.close();
    srv = await startTestServer({ storage: new SqliteStorage(join(dir, 'db.sqlite')) });
  }
  async function restore(backup: string) {
    const port = Number(new URL(srv.base).port);
    await srv.close();
    await srv.storage.close();
    for (const f of ['db.sqlite', 'db.sqlite-wal', 'db.sqlite-shm']) rmSync(join(dir, f), { force: true });
    copyFileSync(backup, join(dir, 'db.sqlite'));
    srv = await startTestServer({ storage: new SqliteStorage(join(dir, 'db.sqlite')), port });
  }
  // Etter omstart kan første kall treffe en lukket keep-alive-forbindelse; appen prøver bare igjen ved neste runde.
  const retry = async <T,>(f: () => Promise<T>) => { try { return await f(); } catch { return f(); } };
  const serverIds = (d: Device) => retry(async () => (await d.api.withToken(d.state.sync!.token).pull(0)).events.map((e) => (e.event as { id: string }).id).sort());
  const syncOk = async (d: Device) => { for (let i = 0; i < 3; i++) if ((await d.sync()).ok) return; throw new Error('synk feilet'); };

  it('enheter som har sett mer enn kopien, sender sitt eget på nytt: ingenting går tapt, ingen doble rader', async () => {
    await fileServer();
    const { a, b } = await pair();
    a.toggle('demoA:pasta');
    await a.sync(); await b.sync();
    const backup = join(dir, 'kopi.sqlite');
    srv.storage.backupTo(backup);
    // Etter kopien: nye hendelser fra begge og et nytt budsjett. Alt er levert, utboksene er tomme.
    a.record(tell(a, 300));
    b.toggle('demoA:ris');
    a.state = { ...a.state, settings: { ...a.state.settings, budgetOre: 111_100 } };
    await a.sync(); await b.sync(); await a.sync();
    const before = await serverIds(a);
    expect(b.state.settings.budgetOre).toBe(111_100);
    expect(a.state.outbox).toEqual([]);

    await restore(backup);
    expect((await serverIds(a)).length).toBeLessThan(before.length); // serveren har mistet det siste
    await syncOk(b); await syncOk(a); await syncOk(b);
    expect(await serverIds(a)).toEqual(before);
    expect(srv.storage.counts().events).toBe(before.length);
    for (const d of [a, b]) {
      expect(d.state.settings.budgetOre).toBe(111_100);
      expect(Object.keys(d.state.sync!.conflicts)).toEqual([]);
      expect(d.state.sync!.rejected).toBe(0); // bare egne hendelser sendes på nytt
      expect(syncStatus(d.state, { offline: false, busy: false }, 0)).toBe('synket');
    }
    // En ny enhet ser alt, også det som kom etter kopien.
    const c = new Device('enhet-cccc3333');
    await c.join(await a.invite());
    await c.sync();
    expect(c.state.settings.budgetOre).toBe(111_100);
    expect(c.state.inventory.map((e) => e.id)).toEqual(a.state.inventory.map((e) => e.id));
    expect(checks(c.state.list, WEEK).has('demoA:ris')).toBe(true);
  });

  it('oppdages også når andre har skrevet forbi enhetens cursor etter gjenopprettingen (anker)', async () => {
    await fileServer();
    const { a, b } = await pair();
    const backup = join(dir, 'kopi.sqlite');
    srv.storage.backupTo(backup);
    a.record(tell(a, 1));
    await a.sync(); await b.sync();
    const lost = a.state.inventory[0].id;
    await restore(backup);
    // B skriver mye før A synker, så serverens seq går forbi A sin cursor.
    for (let i = 0; i < 5; i++) b.toggle(`demoA:x${i}`);
    await syncOk(b);
    expect((await srv.storage.readSince((await srv.storage.authenticate(sha(a.state.sync!.token), srv.now()))!.householdId, 0, 1000)).head)
      .toBeGreaterThanOrEqual(a.state.sync!.cursor);
    await syncOk(a); await syncOk(b);
    expect(await serverIds(b)).toContain(lost);
    expect(b.state.inventory.map((e) => e.id)).toContain(lost);
  });
});

describe('synkstatus ved feil', () => {
  it('feil som ikke bare er manglende nett vises som «feil» med norsk tekst, ikke som «synker»', async () => {
    const { a } = await pair();
    expect(syncStatus(a.state, { offline: false, busy: false, lastError: 'kvote_full' }, 0)).toBe('feil');
    expect(syncStatus(a.state, { offline: true, busy: false, lastError: 'nett' }, 0)).toBe('venter');
    expect(syncStatus(a.state, { offline: false, busy: true, lastError: 'serverfeil' }, 0)).toBe('synker');
    expect(syncErrorText('kvote_full')).toMatch(/grense/);
    expect(syncErrorText('nett')).toBeNull();
    expect(syncErrorText('noe-nytt')).toMatch(/lagret på denne enheten/);
  });
});
