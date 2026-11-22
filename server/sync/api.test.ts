// Integrasjonstester for synk-API-et: ekte HTTP-server, minnedatabase, to (eller flere) simulerte enheter.
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SyncApi, SyncError } from '../../src/sync/api';
import type { Envelope } from '../../src/sync/protocol';
import type { InventoryEvent } from '../../src/engine/inventory';
import { homeLineId, purchaseLineId } from '../../src/engine/inventory';
import { applyChanges, changeLineId, snapshot } from '../../src/engine/substitution';
import { buildBasket } from '../../src/engine/planner';
import { catalog } from '../../src/data/catalog';
import { defaultSettings } from '../../src/data/defaults';
import { startTestServer } from './testkit';

type Srv = Awaited<ReturnType<typeof startTestServer>>;
let srv: Srv;
const fetchFn = (url: string, init?: RequestInit) => fetch(url, init);
const anon = () => new SyncApi(srv.base, fetchFn);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

async function household() {
  const a = await anon().createHousehold('enhet-aaaa1111', 'Voksen 1');
  const A = anon().withToken(a.token);
  const inv = await A.invite();
  const b = await anon().join(inv.code, 'enhet-bbbb2222');
  const B = anon().withToken(b.token);
  return { A, B, a, b };
}
const telling = (id: string, by: string, amount = 100, at = '2026-11-23T10:00:00.000Z'): Envelope =>
  ({ stream: 'beholdning', event: { type: 'telling', id, at, by, ingredient: 'pasta', amount } });
const kjop = (id: string, by: string, packs: number, at = '2026-11-23T10:00:00.000Z'): Envelope => ({
  stream: 'beholdning', event: {
    type: 'kjøp', id, at, by, week: '2026-11-23', line: purchaseLineId('2026-11-23', 'demoA', 'pasta', 'p-pasta'), ingredient: 'pasta',
    productId: 'p-pasta', storeId: 'demoA', unit: 'g', packs, packSize: 500,
  } as InventoryEvent,
});
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return e instanceof SyncError ? `${e.status} ${e.code}` : String(e); } };
const raw = (path: string, init: RequestInit = {}) => fetch(`${srv.base}${path}`, init);

beforeEach(async () => { srv = await startTestServer(); });
afterEach(async () => { await srv.close(); });

describe('husstand og invitasjon', () => {
  it('opprett, bli med og se medlemmer; tokenet lagres bare som hash', async () => {
    const { A, B, a, b } = await household();
    const ma = await A.household();
    const mb = await B.household();
    expect(ma.members.map((m) => [m.label, m.role, m.me])).toEqual([['Voksen 1', 'eier', true], ['Voksen 2', 'voksen', false]]);
    expect(mb.members.find((m) => m.me)?.id).toBe('enhet-bbbb2222');
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Klartekst-tokenet finnes ikke i databasen, bare hashen.
    expect(await srv.storage.authenticate(a.token, srv.now())).toBeNull();
    expect(await srv.storage.authenticate(sha(b.token), srv.now())).not.toBeNull();
  });

  it('en invitasjon virker bare én gang', async () => {
    const a = await anon().createHousehold('enhet-aaaa1111');
    const inv = await a && await anon().withToken(a.token).invite();
    expect(await code(anon().join(inv.code, 'enhet-bbbb2222'))).toBe('ok');
    expect(await code(anon().join(inv.code, 'enhet-cccc3333'))).toBe('403 ugyldig_kode');
  });

  it('en invitasjon utløper etter 24 timer', async () => {
    const a = await anon().createHousehold('enhet-aaaa1111');
    const inv = await anon().withToken(a.token).invite();
    srv.advance(24 * 3600_000 + 1);
    expect(await code(anon().join(inv.code, 'enhet-bbbb2222'))).toBe('403 ugyldig_kode');
  });

  it('koden tåler mellomrom og små bokstaver; feil kode avvises', async () => {
    const a = await anon().createHousehold('enhet-aaaa1111');
    const inv = await anon().withToken(a.token).invite();
    expect(await code(anon().join('ZZZZZ-ZZZZZ', 'enhet-bbbb2222'))).toBe('403 ugyldig_kode');
    expect(await code(anon().join(` ${inv.code.toLowerCase().replace('-', ' ')} `, 'enhet-bbbb2222'))).toBe('ok');
  });

  it('samme enhet kan ikke bli med to ganger, og tilbaketrukket invitasjon virker ikke', async () => {
    const { A } = await household();
    const inv = await A.invite();
    expect(await code(anon().join(inv.code, 'enhet-bbbb2222'))).toBe('409 enhet_finnes');
    // Invitasjonen ble ikke brukt opp av forsøket over.
    const list = await A.household();
    expect(list.invites).toHaveLength(1);
    await A.deleteInvite(list.invites[0].id);
    expect(await code(anon().join(inv.code, 'enhet-cccc3333'))).toBe('403 ugyldig_kode');
  });

  it('tilbakekalt token mister tilgang med en gang', async () => {
    const { A, B } = await household();
    await A.removeMember('enhet-bbbb2222');
    expect(await code(B.pull(0))).toBe('401 ikke_autentisert');
    expect(await code(B.push([telling('t1', 'enhet-bbbb2222')]))).toBe('401 ikke_autentisert');
    expect(await code(B.household())).toBe('401 ikke_autentisert');
    expect((await A.household()).members).toHaveLength(1);
  });

  it('bare eieren kan fjerne medlemmer og slette husstanden', async () => {
    const { A, B } = await household();
    expect(await code(B.removeMember('enhet-aaaa1111'))).toBe('403 ingen_tilgang');
    expect(await code(B.deleteHousehold())).toBe('403 ingen_tilgang');
    expect(await code(A.removeMember('enhet-aaaa1111'))).toBe('400 ugyldig_forespørsel');
    expect(await code(A.removeMember('enhet-finnesikke'))).toBe('404 ikke_funnet');
    const token = (A as unknown as { token: string }).token;
    expect((await raw('/api/household/members/%E0%A4%A', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).status).toBe(400);
  });

  it('eier som forlater gir eierskapet videre; siste som forlater sletter alt', async () => {
    const { A, B } = await household();
    await A.leave();
    expect(await code(A.pull(0))).toBe('401 ikke_autentisert');
    expect((await B.household()).members.map((m) => m.role)).toEqual(['eier']);
    await B.push([telling('t1', 'enhet-bbbb2222')]);
    await B.leave();
    expect(srv.storage.counts()).toEqual({ households: 0, devices: 0, invites: 0, events: 0, docs: 0 });
  });

  it('en fjernet enhet kan inviteres på nytt og får nytt token', async () => {
    const { A, B } = await household();
    await A.removeMember('enhet-bbbb2222');
    const inv = await A.invite();
    const again = await anon().join(inv.code, 'enhet-bbbb2222', 'Voksen 2');
    expect(await code(B.pull(0))).toBe('401 ikke_autentisert');
    expect(await code(anon().withToken(again.token).pull(0))).toBe('ok');
  });

  it('sletting fjerner husstanden og alle data, og alle tokener slutter å virke', async () => {
    const { A, B } = await household();
    const other = await anon().createHousehold('enhet-dddd4444');
    await A.push([telling('t1', 'enhet-aaaa1111'), { stream: 'liste', event: { type: 'kryss', id: 'k1', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', week: '2026-11-23', key: 'demoA:pasta' } }]);
    await A.putDoc('plan', 0, { slots: [], approved: false, option: 'regular' });
    await A.invite();
    await A.deleteHousehold();
    expect(await code(A.pull(0))).toBe('401 ikke_autentisert');
    expect(await code(B.pull(0))).toBe('401 ikke_autentisert');
    // Bare den andre husstanden (én enhet, ingen data) er igjen.
    expect(srv.storage.counts()).toEqual({ households: 1, devices: 1, invites: 0, events: 0, docs: 0 });
    expect(await code(anon().withToken(other.token).pull(0))).toBe('ok');
  });
});

describe('hendelser og synk', () => {
  it('samme hendelse to ganger gir én rad; begge leveringer bekreftes', async () => {
    const { A, B } = await household();
    const e = telling('t1', 'enhet-aaaa1111');
    expect((await A.push([e])).accepted).toEqual(['t1']);
    expect((await A.push([e, e])).accepted).toEqual(['t1', 't1']);
    const r = await B.pull(0);
    expect(r.events.map((x) => x.event.id)).toEqual(['t1']);
  });

  it('cursor gir bare det som er nytt, og to enheter ser hverandres hendelser', async () => {
    const { A, B } = await household();
    await A.push([telling('t1', 'enhet-aaaa1111')]);
    const r1 = await B.pull(0);
    await B.push([telling('t2', 'enhet-bbbb2222')]);
    const r2 = await A.pull(r1.cursor);
    expect(r2.events.map((x) => x.event.id)).toEqual(['t2']);
    expect((await A.pull(r2.cursor)).events).toEqual([]);
  });

  it('avkrysning samtidig fra to enheter: begge lagres med egen identitet', async () => {
    const { A, B } = await household();
    const k = (id: string, by: string): Envelope => ({ stream: 'liste', event: { type: 'kryss', id, at: '2026-11-23T10:00:00.000Z', by, week: '2026-11-23', key: 'demoA:pasta' } });
    await Promise.all([A.push([k('ka', 'enhet-aaaa1111')]), B.push([k('kb', 'enhet-bbbb2222')])]);
    const r = await A.pull(0);
    expect(r.events.map((x) => [x.event.id, x.event.by]).sort()).toEqual([['ka', 'enhet-aaaa1111'], ['kb', 'enhet-bbbb2222']]);
  });

  it('konflikt om antall lagres som to hendelser (tilstanden avledes på klienten)', async () => {
    const { A, B } = await household();
    await A.push([kjop('ka', 'enhet-aaaa1111', 2)]);
    await B.push([kjop('kb', 'enhet-bbbb2222', 3)]);
    const r = await A.pull(0);
    expect(r.events.map((x) => (x.event as { packs: number }).packs)).toEqual([2, 3]);
  });

  it('en enhet kan ikke utgi seg for et annet medlem', async () => {
    const { B } = await household();
    const r = await B.push([telling('t1', 'enhet-aaaa1111'), telling('t2', 'enhet-bbbb2222'), telling('t3', 'migrering')]);
    expect(r.accepted).toEqual(['t2', 't3']);
    expect(r.rejected).toEqual([{ id: 't1', code: 'feil_identitet' }]);
  });

  it('data fra en annen husstand er aldri synlig', async () => {
    const { A } = await household();
    const other = anon().withToken((await anon().createHousehold('enhet-eeee5555')).token);
    await A.push([telling('hemmelig', 'enhet-aaaa1111')]);
    await A.putDoc('plan', 0, { slots: [{ day: 0, recipeId: 'taco', locked: true }], approved: true, option: 'regular' });
    const r = await other.pull(0);
    expect(r.events).toEqual([]);
    expect(r.docs).toEqual([]);
    expect(r.members.map((m) => m.id)).toEqual(['enhet-eeee5555']);
    // Samme hendelses-id i en annen husstand er en egen rad.
    expect((await other.push([telling('hemmelig', 'enhet-eeee5555')])).accepted).toEqual(['hemmelig']);
    expect(await code(other.removeMember('enhet-aaaa1111'))).toBe('404 ikke_funnet');
    expect(await code(other.putDoc('plan', 0, { slots: [], approved: false, option: 'regular' }))).toBe('ok');
    expect((await A.pull(0)).docs[0].body).toEqual({ slots: [{ day: 0, recipeId: 'taco', locked: true }], approved: true, option: 'regular' });
  });

  it('henter i sider når det er mange hendelser', async () => {
    const { A, B } = await household();
    for (let b = 0; b < 3; b++) await A.push(Array.from({ length: 500 }, (_, i) => telling(`t${b}-${i}`, 'enhet-aaaa1111')));
    const p1 = await B.pull(0);
    expect(p1.events).toHaveLength(1000);
    expect(p1.more).toBe(true);
    const p2 = await B.pull(p1.cursor);
    expect(p2.events).toHaveLength(500);
    expect(p2.more).toBe(false);
  });
});

describe('dokumenter', () => {
  const plan = (recipeId: string) => ({ slots: [{ day: 1, recipeId, locked: false }], approved: false, option: 'regular' as const });
  it('versjoneres; utdatert base gir 409 med gjeldende versjon', async () => {
    const { A, B } = await household();
    expect((await A.putDoc('plan', 0, plan('taco'))).version).toBe(1);
    expect((await B.putDoc('plan', 1, plan('laks'))).version).toBe(2);
    try {
      await A.putDoc('plan', 1, plan('pasta'));
      throw new Error('skulle feilet');
    } catch (e) {
      expect(e).toBeInstanceOf(SyncError);
      expect((e as SyncError).status).toBe(409);
      expect((e as SyncError).current).toMatchObject({ version: 2, body: plan('laks'), updatedBy: 'enhet-bbbb2222' });
    }
    const r = await A.pull(0);
    expect(r.docs).toMatchObject([{ name: 'plan', version: 2 }]);
  });
  it('ugyldige dokumenter avvises', async () => {
    const { A } = await household();
    expect(await code(A.putDoc('plan', 0, { slots: [{ day: 9, recipeId: 'x', locked: false }], approved: false, option: 'regular' }))).toBe('400 ugyldig_dokument');
    expect(await code(A.putDoc('plan', 0, { ...plan('x'), ekstra: 'felt' } as never))).toBe('400 ugyldig_dokument');
    expect(await code(A.putDoc('innstillinger', 0, { eaters: [{ id: 'b1', label: 'x'.repeat(41), portion: 1, daysHome: [true, true, true, true, true, true, true] }] } as never))).toBe('400 ugyldig_dokument');
    expect(await code(A.putDoc('postnummer' as never, 0, plan('x')))).toBe('404 ikke_funnet');
    // Kostkrav og allergier (mulige helseopplysninger) og matskap lagres aldri på serveren.
    const settings = { eaters: [], days: Array.from({ length: 7 }, () => ({ enabled: true, maxMinutes: 30 })), budgetOre: 90_000, storeIds: ['demoA'], regularStoreId: 'demoA', maxStops: 1, extraStoreThresholdOre: 0 };
    expect(await code(A.putDoc('innstillinger', 0, settings as never))).toBe('ok');
    for (const extra of [{ avoid: ['melk'] }, { avoidFoods: ['svin'] }, { vegetarian: true }, { pantry: {} }]) {
      expect(await code(A.putDoc('innstillinger', 1, { ...settings, ...extra } as never))).toBe('400 ugyldig_dokument');
    }
  });
});

describe('ugyldige inndata og grenser', () => {
  it('avviser manglende token, feil format og ukjente stier', async () => {
    await anon().createHousehold('enhet-aaaa1111');
    expect((await raw('/api/sync?after=0')).status).toBe(401);
    expect((await raw('/api/sync?after=0', { headers: { Authorization: 'Bearer ' + 'x'.repeat(43) } })).status).toBe(401);
    expect((await raw('/api/household', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"deviceId":"hei"}' })).status).toBe(400);
    expect((await raw('/api/household', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(415);
    expect((await raw('/api/household', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ikke json' })).status).toBe(400);
    expect((await raw('/api/household', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: 'enhet-aaaa1111', x: 'y'.repeat(300_000) }) })).status).toBe(413);
  });
  it('avviser ugyldige hendelser enkeltvis og for store batcher', async () => {
    const { A } = await household();
    const r = await A.push([
      telling('ok', 'enhet-aaaa1111'),
      { stream: 'beholdning', event: { type: 'telling', id: 'neg', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', ingredient: 'pasta', amount: -5 } },
      { stream: 'beholdning', event: { type: 'telling', id: 'tid', at: 'i går', by: 'enhet-aaaa1111', ingredient: 'pasta', amount: 5 } },
      { stream: 'liste', event: { type: 'kryss', id: 'lang', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', week: '2026-11-23', key: 'x'.repeat(500) } },
      { stream: 'annet', event: { id: 'strøm' } } as never,
      { stream: 'endring', event: { type: 'fant-ikke', id: 'feil-linje', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', week: '2026-11-23', line: 'x', storeId: null, ingredient: 'pasta', fromProductId: null, soldOut: [], choice: 'hopp-over' } },
    ]);
    expect(r.accepted).toEqual(['ok']);
    expect(r.rejected.map((x) => x.code)).toEqual(['ugyldig_hendelse', 'ugyldig_hendelse', 'ugyldig_hendelse', 'ukjent_strøm', 'ugyldig_hendelse']);
    expect(await code(A.push(Array.from({ length: 501 }, (_, i) => telling(`x${i}`, 'enhet-aaaa1111'))))).toBe('400 ugyldig_forespørsel');
    expect((await raw('/api/sync?after=-1', { headers: { Authorization: `Bearer ${(A as unknown as { token: string }).token}` } })).status).toBe(400);
  });
  it('etiketter renses og kortes ned', async () => {
    const a = await anon().createHousehold('enhet-aaaa1111', '  Voksen\u0000 1 med et altfor langt navn her  ');
    expect(a.member.label).toBe('Voksen 1 med et altfor l');
  });
  it('ratebegrensning på forsøk på å bli med', async () => {
    await srv.close();
    srv = await startTestServer({ limits: { ipPerMin: 1000, devicePerMin: 1000, createPerHour: 10, joinPer10Min: 3 } });
    const tries = [];
    for (let i = 0; i < 4; i++) tries.push(await code(anon().join('AAAAA-AAAAA', 'enhet-bbbb2222')));
    expect(tries).toEqual(['403 ugyldig_kode', '403 ugyldig_kode', '403 ugyldig_kode', '429 for_mange_forespørsler']);
    srv.advance(600_001);
    expect(await code(anon().join('AAAAA-AAAAA', 'enhet-bbbb2222'))).toBe('403 ugyldig_kode');
  });
});

describe('planversjoner (strøm planversjon)', () => {
  const ctx = { catalog, settings: defaultSettings, shopDate: '2026-11-23' };
  const week = [{ day: 0, recipeId: 'lakseris', locked: false }, { day: 1, recipeId: 'bolognese', locked: false }, { day: 2, recipeId: 'karri', locked: false }];
  const version = (id: string, by: string, extra: Record<string, unknown> = {}) => ({
    stream: 'planversjon', event: {
      ...snapshot(applyChanges(buildBasket(week, ['demoA'], ctx), new Map(), '2026-11-23', ctx), week,
        { id, at: '2026-11-23T10:00:00.000Z', by, week: '2026-11-23', reason: 'godkjent', parents: [] }, ctx),
      ...extra,
    },
  }) as Envelope;

  it('lagres én gang, deles med de andre i husstanden og tåler dobbel levering', async () => {
    const { A, B } = await household();
    expect((await A.push([version('v1', 'enhet-aaaa1111')])).accepted).toEqual(['v1']);
    expect((await A.push([version('v1', 'enhet-aaaa1111')])).accepted).toEqual(['v1']); // samme id igjen: ingen ny rad
    const r = await B.pull(0);
    const got = r.events.filter((e) => e.stream === 'planversjon');
    expect(got).toHaveLength(1);
    expect(got[0].event).toEqual(version('v1', 'enhet-aaaa1111').event);
    expect(srv.storage.counts().events).toBe(1);
  });

  it('avviser ukjente felt, helseopplysninger, feil identitet og for store versjoner', async () => {
    const { A } = await household();
    const big = version('stor', 'enhet-aaaa1111', { note: 'x'.repeat(1000), priceBasis: 'y'.repeat(2000) });
    const lines = (big.event as { lines: unknown[] }).lines;
    const r = await A.push([
      version('ok', 'enhet-aaaa1111'),
      version('allergi', 'enhet-aaaa1111', { avoid: ['gluten'] }),
      version('ekstra', 'enhet-aaaa1111', { navn: 'Kari' }),
      version('forfalsket', 'enhet-bbbb2222'),
      version('egen-forelder', 'enhet-aaaa1111', { parents: ['egen-forelder'] }),
      version('årsak', 'enhet-aaaa1111', { reason: 'hva som helst' }),
      { ...big, event: { ...big.event, lines: Array.from({ length: 120 }, () => lines[0]), skipped: Array.from({ length: 120 }, () => lines[0]) } } as Envelope,
    ]);
    expect(r.accepted).toEqual(['ok']);
    expect(r.rejected.map((x) => [x.id, x.code])).toEqual([
      ['allergi', 'ugyldig_hendelse'], ['ekstra', 'ugyldig_hendelse'], ['forfalsket', 'feil_identitet'],
      ['egen-forelder', 'ugyldig_hendelse'], ['årsak', 'ugyldig_hendelse'], ['stor', 'for_stor'],
    ]);
  });

  it('«bruk noe hjemme» (hjemme) og valg med prev godtas; ugyldig prev avvises', async () => {
    const { A } = await household();
    const line = changeLineId('2026-11-23', 'demoA', 'pasta', 'pasta500');
    const change = (id: string, prev: unknown) => ({ stream: 'endring', event: {
      type: 'fant-ikke', id, at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', week: '2026-11-23', line, storeId: 'demoA', ingredient: 'pasta',
      fromProductId: 'pasta500', soldOut: ['pasta500'], choice: 'bruk-hjemme', prev } }) as Envelope;
    const r = await A.push([
      { stream: 'beholdning', event: { type: 'hjemme', id: 'h1', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', week: '2026-11-23', line: homeLineId('2026-11-23', 'pasta'), ingredient: 'pasta', amount: 300 } },
      change('c1', []), change('c2', ['c1']), change('c3', ['c3']), change('c4', 'c1'),
    ]);
    expect(r.accepted).toEqual(['h1', 'c1', 'c2']);
    expect(r.rejected.map((x) => x.id)).toEqual(['c3', 'c4']);
  });
});
