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
import { docRev, SqliteStorage } from '../storage/sqlite';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_RETENTION_DAYS, DEFAULT_TOKEN_IDLE_DAYS, retentionDaysFrom, runRetention, startRetention, tokenIdleDaysFrom, tokenIdleMsFrom } from '../retention';

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

describe('helsesjekk, invitasjoner, gjenoppretting og strenge feltlister', () => {
  it('GET /healthz svarer uten autentisering og uten innhold; 503 når databasen ikke svarer', async () => {
    const r = await raw('/healthz');
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: 'ok' });
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect((await raw('/healthz', { method: 'HEAD' })).status).toBe(200);
    await srv.storage.close();
    expect((await raw('/healthz')).status).toBe(503);
  });

  it('bare eieren kan lage og trekke tilbake invitasjoner (403 bare_eier)', async () => {
    const { A, B } = await household();
    expect(await code(B.invite())).toBe('403 bare_eier');
    const inv = await A.invite();
    const { invites } = await A.household();
    expect(inv.code).toBeTruthy();
    expect(await code(B.deleteInvite(invites[0].id))).toBe('403 bare_eier');
    expect(await code(A.deleteInvite(invites[0].id))).toBe('ok');
  });

  it('sync-svaret har head; cursor etter head eller et anker som ikke finnes gir reset', async () => {
    const { A } = await household();
    await A.push([telling('t1', 'enhet-aaaa1111'), telling('t2', 'enhet-aaaa1111')]);
    const r = await A.pull(0);
    expect(r.head).toBe(r.cursor);
    expect(r.reset).toBeUndefined();
    const anchor = `${r.events[1].seq}:t2`;
    expect((await A.pull(r.cursor, anchor)).reset).toBeUndefined();
    expect(await A.pull(r.cursor + 5)).toMatchObject({ reset: true, events: [], cursor: 0 });
    expect(await A.pull(r.cursor, `${r.events[1].seq}:noe-annet`)).toMatchObject({ reset: true });
    expect(await code(A.pull(0, 'feil-format'))).toBe('400 ugyldig_forespørsel');
  });

  it('cursor står alltid på en hendelse (ankeret), også når dokumenter er skrevet etterpå (S2)', async () => {
    const { A } = await household();
    await A.push([telling('t1', 'enhet-aaaa1111')]);
    const e = (await A.pull(0)).events[0].seq;
    await A.putDoc('plan', 0, { slots: [], approved: false, option: 'regular' });
    const r = await A.pull(e, `${e}:t1`);
    expect(r.head).toBe(e + 1);
    expect(r.cursor).toBe(e); // ikke head: dokumentet på e + 1 er ikke en hendelse ankeret kan sjekke
  });

  it('dokumenter har en slekt (revs); med dokumentanker sendes bare dokumenter som er ulike enhetens (S1, S2)', async () => {
    const { A, B } = await household();
    const plan = (recipeId: string) => ({ slots: [{ day: 1, recipeId, locked: false }], approved: false, option: 'regular' as const });
    const v1 = await A.putDoc('plan', 0, plan('taco'));
    const v2 = await A.putDoc('plan', 1, plan('laks'));
    expect(v1.revs).toHaveLength(1);
    expect(v2.revs).toEqual([...v1.revs!, v2.revs!.at(-1)]);
    expect(v2.revs!.at(-1)).toMatch(/^[0-9a-f]{12}$/);
    expect(v2.updatedAt).toBe(srv.now());
    // Uten anker for planen: dokumentet sendes. Med samme versjon og rev: ikke sendt igjen.
    const all = await B.pull(0, undefined, []);
    expect(all.docs.map((d) => [d.name, d.version, d.revs])).toEqual([['plan', 2, v2.revs]]);
    expect((await B.pull(0, undefined, [`plan:2:${v2.revs!.at(-1)}`])).docs).toEqual([]);
    // Annen rev eller annen versjon enn serverens: sendes, så enheten kan oppdage at serveren har mistet noe.
    expect((await B.pull(0, undefined, ['plan:2:000000000000'])).docs.map((d) => d.version)).toEqual([2]);
    expect((await B.pull(0, undefined, [`plan:3:${v2.revs!.at(-1)}`])).docs.map((d) => d.version)).toEqual([2]);
    // Samme innhold på samme grunnlag gir samme rev (innholdsadressert): en enhet som sender det samme igjen etter en
    // gjenoppretting, lager ikke en ny slekt.
    const c = await anon().createHousehold('enhet-cccc3333');
    const C = anon().withToken(c.token);
    await C.putDoc('plan', 0, plan('taco'));
    expect((await C.putDoc('plan', 1, plan('laks'))).revs).toEqual(v2.revs);
  });

  it('eldre database uten slekt for dokumenter får revs ved oppstart; neste versjon bygger videre på den', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'middag-revs-'));
    try {
      const file = join(dir, 'db.sqlite');
      const old = new SqliteStorage(file);
      await old.createHousehold('h1', { id: 'd1', publicId: 'enhet-aaaa1111', label: 'A', tokenHash: 'x'.repeat(64) }, srv.now());
      await old.putDoc('h1', 'plan', 0, '{"approved":false,"option":"regular","slots":[]}', 'enhet-aaaa1111', srv.now());
      await old.close();
      // Som før denne endringen: uten kolonnen revs.
      const db = new DatabaseSync(file);
      db.exec('ALTER TABLE docs DROP COLUMN revs');
      db.close();
      const st = new SqliteStorage(file);
      const [d] = await st.currentDocs('h1');
      expect(d.revs).toEqual([docRev('', 1, d.body)]);
      const r = await st.putDoc('h1', 'plan', 1, d.body, 'enhet-aaaa1111', srv.now());
      expect(r).toEqual({ ok: true, version: 2, revs: [d.revs[0], docRev(d.revs[0], 2, d.body)] });
      await st.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('et hendelses-id med linjeskift låser ikke andre enheters synk (ankeret godtas)', async () => {
    const { A, B } = await household();
    const r = await A.push([telling('a\nb', 'enhet-aaaa1111'), telling('c\u2028d', 'enhet-aaaa1111')]);
    expect(r.accepted).toHaveLength(2);
    const p = await B.pull(0);
    for (const e of p.events) {
      const id = (e.event as { id: string }).id;
      expect(await code(B.pull(p.cursor, `${e.seq}:${id}`))).toBe('ok');
    }
  });

  it('ukjente felt i beholdning, liste og endring fjernes før lagring og deling (ikke avvist)', async () => {
    const { A, B } = await household();
    const r = await A.push([
      { stream: 'beholdning', event: { type: 'telling', id: 'x1', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', ingredient: 'pasta', amount: 5, navn: 'Kari', allergi: 'gluten' } as never },
      { stream: 'liste', event: { type: 'manuell', id: 'x2', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', line: { id: 'm1', text: 'Torsk', note: '', skjult: 'x' }, ekstra: 1 } as never },
      { stream: 'endring', event: { type: 'angre-endring', id: 'x3', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', week: '2026-11-23', line: 'endring|x', posisjon: '59.9,10.7' } as never },
    ]);
    expect(r.accepted).toEqual(['x1', 'x2', 'x3']);
    const got = (await B.pull(0)).events.map((e) => e.event);
    expect(got).toEqual([
      { type: 'telling', id: 'x1', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', ingredient: 'pasta', amount: 5 },
      { type: 'manuell', id: 'x2', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', line: { id: 'm1', text: 'Torsk', note: '' } },
      { type: 'angre-endring', id: 'x3', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', week: '2026-11-23', line: 'endring|x' },
    ]);
    // Også i databasen: feltene er aldri lagret.
    const hh = (await srv.storage.authenticate(sha((A as unknown as { token: string }).token), srv.now()))!.householdId;
    expect((await srv.storage.readSince(hh, 0, 10)).events.map((e) => e.body).join('')).not.toMatch(/Kari|gluten|skjult|ekstra|posisjon/);
  });
});

describe('eksport (innsyn og dataportabilitet)', () => {
  const plan = { slots: [{ day: 1, recipeId: 'taco', locked: false }], approved: false, option: 'regular' as const };
  it('et medlem (også ikke-eier) får alt om husstanden: medlemmer, invitasjoner, dokumenter og hendelser', async () => {
    const { A, B, a } = await household();
    await A.putDoc('plan', 0, plan);
    await A.push([telling('t1', 'enhet-aaaa1111')]);
    await B.push([kjop('k1', 'enhet-bbbb2222', 2)]);
    for (const X of [A, B]) {
      const x = await X.exportData();
      expect(x).toMatchObject({ format: 'middagsplanlegger-servereksport', versjon: 1, eksportert: srv.now() });
      expect(x.medlemmer.map((m) => [m.enhetsId, m.etikett, m.rolle])).toEqual([['enhet-aaaa1111', 'Voksen 1', 'eier'], ['enhet-bbbb2222', 'Voksen 2', 'voksen']]);
      expect(x.medlemmer.filter((m) => m.denneEnheten)).toHaveLength(1);
      // Brukte og utløpte invitasjoner ryddes når en ny lages; her finnes den B brukte.
      expect(x.invitasjoner).toEqual([{ laget: srv.now(), utløper: '2026-11-24T10:00:00.000Z', brukt: srv.now(), lagetAv: 'enhet-aaaa1111', bruktAv: 'enhet-bbbb2222' }]);
      expect(x.dokumenter).toEqual([{ navn: 'plan', versjon: 1, endretAv: 'enhet-aaaa1111', endret: srv.now(), innhold: plan }]);
      expect(x.hendelser.map((h) => [h.strøm, (h.hendelse as { id: string }).id, h.levertAv])).toEqual([
        ['beholdning', 't1', 'enhet-aaaa1111'], ['beholdning', 'k1', 'enhet-bbbb2222']]);
      expect(x.husstand.antallLagringer).toBe(3);
    }
    // Rå HTTP: lastes ned som fil, aldri lagret i mellomlager.
    const r = await raw('/api/household/export', { headers: { Authorization: `Bearer ${a.token}` } });
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="middagsplanlegger-server-2026-11-23.json"');
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it('aldri token, tokenhash, invitasjonskode, kodens HMAC eller interne id-er', async () => {
    const { A, a, b } = await household();
    const inv = await A.invite();
    await A.push([telling('t1', 'enhet-aaaa1111')]);
    const text = JSON.stringify(await A.exportData());
    const hh = (await srv.storage.authenticate(sha(a.token), srv.now()))!.householdId;
    const internal = (await srv.storage.members(hh)).map((m) => m.id);
    const { createHmac } = await import('node:crypto');
    const hmac = (c: string) => createHmac('sha256', 'testhemmelighet').update(c.replace(/[^A-Z0-9]/gi, '').toUpperCase()).digest('hex');
    for (const secret of [a.token, b.token, sha(a.token), sha(b.token), inv.code, inv.code.replace('-', ''), hmac(inv.code), hh, ...internal]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(/"(token|tokenHash|token_hash|codeHash|code_hash|householdId|household_id|deviceId|device_id)"/);
  });

  it('bare egen husstand: tokenet bestemmer husstanden, og en annen husstands data er aldri med', async () => {
    const one = await household();
    await one.A.push([telling('hemmelig-hendelse', 'enhet-aaaa1111')]);
    await one.A.putDoc('plan', 0, plan);
    const c = await anon().createHousehold('enhet-cccc3333', 'Annen');
    const C = anon().withToken(c.token);
    const x = await C.exportData();
    expect(x.medlemmer.map((m) => m.enhetsId)).toEqual(['enhet-cccc3333']);
    expect(x.hendelser).toEqual([]);
    expect(x.dokumenter).toEqual([]);
    expect(JSON.stringify(x)).not.toMatch(/hemmelig-hendelse|enhet-aaaa1111|enhet-bbbb2222|Voksen/);
    // Ingen id i stien kan peke på en annen husstand: ekstra stidel eller spørring gir 404 eller samme svar.
    expect((await raw('/api/household/export/annen', { headers: { Authorization: `Bearer ${c.token}` } })).status).toBe(404);
    const q = await (await raw('/api/household/export?husstand=1&id=enhet-aaaa1111', { headers: { Authorization: `Bearer ${c.token}` } })).json();
    expect(q.hendelser).toEqual([]);
  });

  it('fjernet medlem og slettet husstand: 401; uten token: 401', async () => {
    const { A, B } = await household();
    await A.removeMember('enhet-bbbb2222');
    expect(await code(B.exportData())).toBe('401 ikke_autentisert');
    expect(await code(anon().exportData())).toBe('401 ikke_autentisert');
    await A.deleteHousehold();
    expect(await code(A.exportData())).toBe('401 ikke_autentisert');
  });

  it('mange hendelser strømmes side for side og blir én gyldig JSON-fil', async () => {
    const { A } = await household();
    for (let i = 0; i < 5; i++) await A.push(Array.from({ length: 500 }, (_, j) => telling(`t${i}-${j}`, 'enhet-aaaa1111')));
    const x = await A.exportData();
    expect(x.hendelser).toHaveLength(2500);
    expect(x.hendelser.map((h) => h.nr)).toEqual(Array.from({ length: 2500 }, (_, i) => i + 1));
  });

  it('ratebegrenset per enhet (10 per time)', async () => {
    await srv.close();
    srv = await startTestServer({ limits: { ipPerMin: 100_000, devicePerMin: 100_000, createPerHour: 1000, createGlobalPerHour: 100_000, joinPer10Min: 1000 } });
    const { A, B } = await household();
    for (let i = 0; i < 10; i++) expect(await code(A.exportData())).toBe('ok');
    expect(await code(A.exportData())).toBe('429 for_mange_forespørsler');
    expect(await code(B.exportData())).toBe('ok'); // egen teller per enhet
    srv.advance(3_600_001);
    expect(await code(A.exportData())).toBe('ok');
  });
});

describe('oppbevaringstid (automatisk sletting etter inaktivitet)', () => {
  const DAY = 86_400_000;
  it('sletter husstander uten aktivitet i N dager, med alt innhold; aktive husstander står', async () => {
    const one = await household(); // aktiv
    const two = await household(); // inaktiv
    await two.A.invite();
    await two.A.putDoc('plan', 0, { slots: [], approved: false, option: 'regular' });
    await two.B.push([telling('gammel', 'enhet-bbbb2222')]);
    const before = srv.storage.counts();
    srv.advance(200 * DAY);
    await one.B.household(); // én autentisert synk fra hvilket som helst medlem holder husstanden i live
    srv.advance(200 * DAY);
    expect(await runRetention(srv.storage, 365, srv.now())).toBe(1);
    expect(await code(one.A.pull(0))).toBe('ok');
    expect(await code(two.A.pull(0))).toBe('401 ikke_autentisert');
    expect(await code(two.B.exportData())).toBe('401 ikke_autentisert');
    const after = srv.storage.counts();
    expect(after).toEqual({ households: 1, devices: 2, invites: 1, events: 0, docs: 0 });
    expect(before.events).toBe(1);
    // Grensen: aktiv for nøyaktig N dager siden står; ett minutt over slettes.
    srv.advance(365 * DAY); // one ble sist sett ved pull(0) over
    expect(await runRetention(srv.storage, 365, srv.now())).toBe(0);
    srv.advance(60_001);
    expect(await runRetention(srv.storage, 365, srv.now())).toBe(1);
    expect(srv.storage.counts().households).toBe(0);
  });

  it('0 = av; standard 730; ugyldig verdi gir standard (aldri av ved en skrivefeil)', async () => {
    await household();
    srv.advance(10_000 * DAY);
    expect(await runRetention(srv.storage, 0, srv.now())).toBe(0);
    expect(srv.storage.counts().households).toBe(1);
    const warn: string[] = [];
    expect(retentionDaysFrom(undefined)).toBe(DEFAULT_RETENTION_DAYS);
    expect(DEFAULT_RETENTION_DAYS).toBe(730);
    expect(retentionDaysFrom('')).toBe(730);
    expect(retentionDaysFrom('0')).toBe(0);
    expect(retentionDaysFrom(' 90 ')).toBe(90);
    for (const v of ['-1', 'av', '1.5', 'NaN']) expect(retentionDaysFrom(v, (m) => warn.push(m))).toBe(730);
    expect(warn).toHaveLength(4);
    expect(warn[0]).toMatch(/SYNC_RETENTION_DAYS.*730/);
  });

  it('standarden (730 dager) styrer slettingen: 729 dager uten aktivitet står, 731 slettes', async () => {
    await household();
    const days = retentionDaysFrom(undefined);
    srv.advance(729 * DAY);
    expect(await runRetention(srv.storage, days, srv.now())).toBe(0);
    expect(srv.storage.counts().households).toBe(1);
    srv.advance(2 * DAY);
    expect(await runRetention(srv.storage, days, srv.now())).toBe(1);
    expect(srv.storage.counts().households).toBe(0);
  });

  it('jobben kjører ved oppstart og periodisk med injisert klokke; loggen får bare antall', async () => {
    const { A } = await household();
    await A.setLabel('UnikEtikett');
    let clock = Date.parse(srv.now());
    const logs: string[] = [];
    const job = startRetention({ storage: srv.storage, days: 30, now: () => new Date(clock).toISOString(), log: (m) => logs.push(m), intervalMs: 20 });
    expect(await job.first).toBe(0);
    clock += 31 * DAY;
    for (let i = 0; i < 50 && srv.storage.counts().households > 0; i++) await new Promise((r) => setTimeout(r, 10));
    job.stop();
    expect(srv.storage.counts().households).toBe(0);
    expect(logs).toEqual(['Oppbevaring: slettet 1 husstand uten aktivitet på 30 dager.']);
    const off: string[] = [];
    expect(await startRetention({ storage: srv.storage, days: 0, now: () => '', log: (m) => off.push(m) }).first).toBe(0);
    expect(off[0]).toMatch(/er av/);
  });

  it('oppbevaringstiden vises til medlemmene', async () => {
    await srv.close();
    srv = await startTestServer({ retentionDays: 365 });
    const { B } = await household();
    expect((await B.household()).retentionDays).toBe(365);
    expect((await B.exportData()).husstand.oppbevaringDager).toBe(365);
  });
});

describe('tokenutløp (SYNC_TOKEN_IDLE_DAYS, glidende)', () => {
  const D = 86_400_000;

  it('standard er 730 dager (samme som oppbevaringstiden for inaktive husstander i piloten); 0 = av; ugyldig verdi gir standard', () => {
    const warn: string[] = [];
    expect(DEFAULT_TOKEN_IDLE_DAYS).toBe(730);
    expect(tokenIdleDaysFrom(undefined)).toBe(730);
    expect(tokenIdleDaysFrom('  ')).toBe(730);
    expect(tokenIdleDaysFrom('0')).toBe(0);
    expect(tokenIdleDaysFrom(' 30 ')).toBe(30);
    for (const v of ['-1', 'av', '1.5', 'NaN']) expect(tokenIdleDaysFrom(v, (m) => warn.push(m))).toBe(730);
    expect(warn).toHaveLength(4);
    expect(warn[0]).toMatch(/SYNC_TOKEN_IDLE_DAYS/);
    // Millisekunder til serveren; 0 betyr «aldri utløp» (undefined).
    expect(tokenIdleMsFrom(undefined)).toBe(730 * D);
    expect(tokenIdleMsFrom('30')).toBe(30 * D);
    expect(tokenIdleMsFrom('0')).toBeUndefined();
  });

  it('standardverdien: tokenet virker i 729 dager uten bruk og er ugyldig etter 731', async () => {
    await srv.close();
    srv = await startTestServer({ tokenIdleMs: tokenIdleMsFrom(undefined) });
    const { A, B } = await household();
    srv.advance(729 * D);
    expect(await code(A.household())).toBe('ok'); // bruk forlenger
    srv.advance(729 * D);
    expect(await code(A.household())).toBe('ok'); // glidende: 1458 dager etter opprettelsen, men aldri 730 uten bruk
    expect(await code(B.household())).toBe('401 ikke_autentisert'); // B har ikke vært brukt på 1458 dager
  });

  it('utløpet følger konfigurasjonen: 731 dager uten bruk gir 401 med standard; 31 dager med SYNC_TOKEN_IDLE_DAYS=30', async () => {
    await srv.close();
    srv = await startTestServer({ tokenIdleMs: tokenIdleMsFrom(undefined) });
    let h = await household();
    srv.advance(731 * D);
    expect(await code(h.A.household())).toBe('401 ikke_autentisert');
    await srv.close();
    srv = await startTestServer({ tokenIdleMs: tokenIdleMsFrom('30') });
    h = await household();
    srv.advance(29 * D);
    expect(await code(h.A.household())).toBe('ok');
    srv.advance(31 * D);
    expect(await code(h.A.household())).toBe('401 ikke_autentisert');
    await srv.close();
    srv = await startTestServer({ tokenIdleMs: tokenIdleMsFrom('0') });
    h = await household();
    srv.advance(5000 * D);
    expect(await code(h.A.household())).toBe('ok'); // 0 = aldri utløp
  });
});
