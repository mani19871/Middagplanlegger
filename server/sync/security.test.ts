// Sikkerhetstester: negative tester og fuzz mot synk-API-et og HTTP-laget (server/app.ts). Se docs/sikkerhet.md.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { connect } from 'node:net';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SyncApi, SyncError } from '../../src/sync/api';
import { cleanLabel, type Envelope } from '../../src/sync/protocol';
import { APP_CSP, createApp } from '../app';
import { SqliteStorage } from '../storage/sqlite';
import { createSyncApi, type SyncApiOptions } from './api';
import { runRetention } from '../retention';
import { ipKey } from './rateLimit';

const SECRET = 'HEMMELIG INNHOLD UTENFOR DIST';
let root: string;
let dist: string;
let srv: Awaited<ReturnType<typeof start>>;
const logs: string[] = [];

/** App (sikkerhetshoder, statiske filer) + synk-API på en tilfeldig port, med minnedatabase og styrbar klokke. */
async function start(opts: Partial<SyncApiOptions> = {}, appOpts: { hsts?: boolean } = {}) {
  const storage = new SqliteStorage(':memory:');
  let clock = Date.parse('2026-11-23T10:00:00.000Z');
  const sync = createSyncApi({
    storage, now: () => new Date(clock).toISOString(), secret: 'test-hemmelig', log: (m) => logs.push(m),
    limits: { ipPerMin: 100_000, devicePerMin: 100_000, createPerHour: 1000, createGlobalPerHour: 100_000, joinPer10Min: 1000 }, ...opts,
  });
  const app = createApp({ dist, handlers: [sync], log: (m) => logs.push(m), ...appOpts });
  const server: Server = createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  return {
    storage, base, port,
    advance: (ms: number) => { clock += ms; },
    now: () => new Date(clock).toISOString(),
    close: () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }),
  };
}

/** Rå HTTP-forespørsel over en socket (fetch normaliserer stier og nekter rare metoder og hoder). */
function rawHttp(port: number, request: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = connect(port, '127.0.0.1', () => sock.write(request));
    let data = '';
    sock.on('data', (d) => { data += d.toString('latin1'); });
    sock.on('end', () => resolve(data));
    sock.on('error', reject);
    setTimeout(() => { sock.destroy(); resolve(data); }, 2000);
  });
}
const rawGet = (port: number, target: string, method = 'GET') => rawHttp(port, `${method} ${target} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`);

const fetchFn = (url: string, init?: RequestInit) => fetch(url, init);
const anon = () => new SyncApi(srv.base, fetchFn);
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e) { return e instanceof SyncError ? `${e.status} ${e.code}` : String(e); } };
const req = (path: string, init: RequestInit = {}) => fetch(`${srv.base}${path}`, init);
const post = (path: string, body: string, headers: Record<string, string> = {}) =>
  req(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
const telling = (id: string, by: string, at = '2026-11-23T10:00:00.000Z'): Envelope =>
  ({ stream: 'beholdning', event: { type: 'telling', id, at, by, ingredient: 'pasta', amount: 100 } });

async function household() {
  const a = await anon().createHousehold('enhet-aaaa1111', 'Voksen 1');
  const A = anon().withToken(a.token);
  const inv = await A.invite();
  const b = await anon().join(inv.code, 'enhet-bbbb2222');
  return { A, B: anon().withToken(b.token), a, b };
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'middag-sikkerhet-'));
  dist = join(root, 'dist');
  mkdirSync(join(dist, 'assets'), { recursive: true });
  writeFileSync(join(dist, 'index.html'), '<!doctype html><title>app</title>');
  writeFileSync(join(dist, 'assets', 'index-abc.js'), 'console.log(1)');
  writeFileSync(join(dist, '.env'), SECRET);
  writeFileSync(join(root, 'secret.txt'), SECRET);
  writeFileSync(join(root, 'dist-secret.txt'), SECRET); // samme prefiks som dist: må heller ikke nås
  logs.length = 0;
  srv = await start();
});
afterEach(async () => { await srv.close(); rmSync(root, { recursive: true, force: true }); });

describe('statiske filer', () => {
  it('path traversal når aldri filer utenfor dist eller skjulte filer', async () => {
    const targets = [
      '/../secret.txt', '/../../secret.txt', '/%2e%2e/secret.txt', '/%2E%2E/%2E%2E/secret.txt', '/..%2fsecret.txt',
      '/assets/..%2f..%2fsecret.txt', '/..%5csecret.txt', '/..\\secret.txt', '/assets/../../secret.txt', '/.env',
      '/%2eenv', '/assets/%2e%2e/.env', '/../dist-secret.txt', '/secret.txt%00.html', '//secret.txt', '/./../secret.txt',
    ];
    for (const t of targets) {
      const res = await rawGet(srv.port, t);
      expect(res, t).not.toContain(SECRET);
      expect(res, t).toMatch(/^HTTP\/1\.1 (200|400|404)/);
    }
  });

  it('enkeltside-app: stier uten filendelse gir forsiden; manglende fil med endelse gir 404', async () => {
    const page = await req('/uka/noe');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toMatch(/^text\/html/);
    expect(page.headers.get('cache-control')).toBe('no-cache');
    expect((await req('/assets/gammel-123.js')).status).toBe(404);
    const js = await req('/assets/index-abc.js');
    expect(js.headers.get('content-type')).toMatch(/^text\/javascript/);
    expect(js.headers.get('cache-control')).toContain('immutable');
  });

  it('bare GET og HEAD; andre metoder gir 405 med Allow', async () => {
    for (const m of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
      const r = await req('/', { method: m });
      expect(r.status, m).toBe(405);
      expect(r.headers.get('allow')).toBe('GET, HEAD');
    }
    const head = await req('/', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await rawGet(srv.port, '/', 'TRACE')).toMatch(/^HTTP\/1\.1 (405|400)/);
  });

  it('ukjente API-stier gir 404 som JSON, ikke appens forside', async () => {
    const r = await req('/api/finnes-ikke');
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ error: 'ikke_funnet' });
  });
});

describe('robusthet', () => {
  it('en ugyldig URL i forespørselen krasjer ikke serveren', async () => {
    for (const t of ['http://[/x', 'http://a:b@[/', '//[::1']) {
      const res = await rawGet(srv.port, t);
      expect(res, t).toMatch(/^HTTP\/1\.1 400/);
    }
    // Serveren svarer fortsatt.
    expect((await req('/')).status).toBe(200);
  });

  it('ugyldig JSON, feil Content-Type, feil form og for store kropper gir 4xx, aldri 500', async () => {
    const cases: [string, Promise<Response>, number][] = [
      ['ugyldig JSON', post('/api/household', '{"deviceId":'), 400],
      ['tom', post('/api/household', ''), 400],
      ['liste', post('/api/household', '[1,2]'), 400],
      ['null', post('/api/household', 'null'), 400],
      ['streng', post('/api/household', '"hei"'), 400],
      ['feil type', req('/api/household', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' }), 415],
      ['deviceId som tall', post('/api/household', '{"deviceId":12345678}'), 400],
      ['deviceId med SQL', post('/api/household', `{"deviceId":"enhet-1'); DROP TABLE devices;--"}`), 400],
      ['dyp nesting', post('/api/household', '['.repeat(100_000) + ']'.repeat(100_000)), 400],
      ['for stor (oppgitt)', post('/api/household', 'x'.repeat(300 * 1024)), 413],
    ];
    for (const [name, p, status] of cases) expect((await p).status, name).toBe(status);
    // For stor kropp sendt i biter (uten Content-Length).
    const big = new ReadableStream({ start(c) { for (let i = 0; i < 40; i++) c.enqueue(new TextEncoder().encode('x'.repeat(10_000))); c.close(); } });
    const chunked = await req('/api/household', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: big, duplex: 'half' } as RequestInit);
    expect(chunked.status).toBe(413);
    expect(logs).toEqual([]);
  });

  it('ugyldige hendelser avvises enkeltvis med feil typer, for store felt og injeksjonsforsøk', async () => {
    const { A } = await household();
    const evil = [
      { stream: 'beholdning', event: { type: 'telling', id: 'x1', at: '2026-11-23T10:00:00Z', by: 'enhet-aaaa1111', ingredient: 'pasta', amount: '100' } },
      { stream: 'beholdning', event: { type: 'telling', id: 'x2', at: '2026-11-23T10:00:00Z', by: 'enhet-aaaa1111', ingredient: 'p'.repeat(5000), amount: 1 } },
      { stream: 'beholdning', event: { type: 'telling', id: 'x3', at: '2026-11-23T10:00:00Z', by: 'enhet-aaaa1111', ingredient: 'pasta', amount: 1e300 } },
      { stream: 'beholdning', event: { type: 'telling', id: 'x4', at: '2026-02-31T10:00:00Z', by: 'enhet-aaaa1111', ingredient: 'pasta', amount: 1 } },
      { stream: 'beholdning', event: { type: 'telling', id: 'x5', at: 'i morgen', by: 'enhet-aaaa1111', ingredient: 'pasta', amount: 1 } },
      { stream: 'liste', event: { type: 'kryss', id: 'x6', at: '2026-11-23T10:00:00Z', by: 'enhet-aaaa1111', week: '2026-11-23', key: ['a'] } },
      { stream: '../../etc', event: {} },
      { stream: 'beholdning', event: null },
      'ikke et objekt',
      null,
    ];
    const r = await A.push(evil as unknown as Envelope[]);
    expect(r.accepted).toEqual([]);
    expect(r.rejected.map((x) => x.code)).toEqual([
      'ugyldig_hendelse', 'for_stor', 'ugyldig_hendelse', 'ugyldig_hendelse', 'ugyldig_hendelse', 'ugyldig_hendelse', 'ukjent_strøm',
      'ugyldig_hendelse', 'ugyldig_hendelse', 'ugyldig_hendelse',
    ]);
    // SQL- og JSON-tegn i id og tekst lagres som tekst og gir ingen skade.
    const sqlId = "x'); DELETE FROM events; --";
    const json = { stream: 'liste', event: { type: 'manuell', id: sqlId, at: '2026-11-23T10:00:00Z', by: 'enhet-aaaa1111',
      line: { id: 'l1', text: '"},"role":"eier","x":{"', note: '<script>alert(1)</script>' } } };
    expect((await A.push([telling('ok-1', 'enhet-aaaa1111'), json as unknown as Envelope])).accepted).toEqual(['ok-1', sqlId]);
    const pulled = await A.pull(0);
    expect(pulled.events.map((e) => e.event.id)).toEqual(['ok-1', sqlId]);
    expect(pulled.members.find((m) => m.me)?.role).toBe('eier');
    expect(srv.storage.counts().events).toBe(2);
  });

  it('JSON-injeksjon og __proto__ i kroppen gir ikke roller eller andre felt', async () => {
    const r = await post('/api/household', '{"deviceId":"enhet-aaaa1111","label":"x\\",\\"role\\":\\"eier","__proto__":{"role":"eier"},"constructor":{"prototype":{"admin":true}}}');
    expect(r.status).toBe(201);
    const a = await r.json();
    const A = anon().withToken(a.token);
    const inv = await A.invite();
    const b = await post('/api/household/join', JSON.stringify({ code: inv.code, deviceId: 'enhet-bbbb2222', role: 'eier', __proto__: { role: 'eier' } }));
    expect((await b.json()).member.role).toBe('voksen');
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it('serverfeil gir 500 uten detaljer, og loggen får ikke token, kode, etikett eller feilmelding', async () => {
    const storage = new SqliteStorage(':memory:');
    const leaky = new Proxy(storage, {
      get(t, k) {
        if (k === 'members') return async () => { throw new Error('hemmelig: token=abc etikett=Mamma'); };
        const v = Reflect.get(t, k);
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    const mine: string[] = [];
    const sync = createSyncApi({ storage: leaky, secret: 's', log: (m) => mine.push(m) });
    const server = createServer(createApp({ dist, handlers: [sync], log: (m) => mine.push(m) }));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const a = await new SyncApi(base, fetchFn).createHousehold('enhet-aaaa1111', 'Mamma');
    const r = await fetch(`${base}/api/household`, { headers: { Authorization: `Bearer ${a.token}` } });
    expect(r.status).toBe(500);
    const body = await r.text();
    expect(body).not.toMatch(/hemmelig|token=|Mamma|at |\.ts:/);
    expect(JSON.parse(body)).toEqual({ error: 'serverfeil', message: 'Noe gikk galt på serveren.' });
    expect(mine.join('\n')).not.toMatch(/hemmelig|abc|Mamma|Bearer|enhet-/);
    expect(mine.join('\n')).toContain('synk-feil: Error');
    server.closeAllConnections(); server.close();
  });
});

describe('sikkerhetshoder, CORS og hodeinjeksjon', () => {
  it('appen får streng CSP og øvrige hoder; API-svar får CSP uten kilder', async () => {
    const page = await req('/');
    expect(page.headers.get('content-security-policy')).toBe(APP_CSP);
    expect(APP_CSP).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    const api = await req('/api/household');
    expect(api.headers.get('content-security-policy')).toMatch(/^default-src 'none'/);
    for (const r of [page, api]) {
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('referrer-policy')).toBe('no-referrer');
      expect(r.headers.get('x-frame-options')).toBe('DENY');
      expect(r.headers.get('permissions-policy')).toContain('geolocation=()');
      expect(r.headers.get('strict-transport-security')).toBeNull(); // bare med HSTS=1
      expect(r.headers.get('x-powered-by')).toBeNull();
    }
    expect(api.headers.get('cache-control')).toBe('no-store');
    const withHsts = await start({}, { hsts: true });
    expect((await fetch(`${withHsts.base}/`)).headers.get('strict-transport-security')).toContain('max-age=');
    await withHsts.close();
  });

  it('ingen CORS: andre opprinnelser får aldri Access-Control-Allow-*', async () => {
    const { a } = await household();
    const origin = { Origin: 'https://ond.example' };
    const pre = await req('/api/household', { method: 'OPTIONS', headers: { ...origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    const get = await req('/api/household', { headers: { ...origin, Authorization: `Bearer ${a.token}` } });
    for (const r of [pre, get]) for (const [k] of r.headers) expect(k).not.toMatch(/^access-control-/);
    expect(pre.status).toBe(401);
  });

  it('CR/LF og andre tegn i stien blir ikke til hoder', async () => {
    const { a } = await household();
    const res = await rawHttp(srv.port, `DELETE /api/household/invites/%0d%0aSet-Cookie:%20x=1 HTTP/1.1\r\nHost: x\r\nAuthorization: Bearer ${a.token}\r\nConnection: close\r\n\r\n`);
    expect(res).toMatch(/^HTTP\/1\.1 404/);
    expect(res.toLowerCase()).not.toContain('set-cookie');
    // Rå CR/LF i forespørselslinjen avvises av HTTP-parseren.
    expect(await rawHttp(srv.port, 'GET /a\rSet-Cookie: x=1 HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n')).toMatch(/^HTTP\/1\.1 400/);
  });
});

describe('autentisering og lekkasje', () => {
  it('uten gyldig token gir alle beskyttede stier samme 401, uansett om noe finnes', async () => {
    const { A } = await household();
    await A.invite();
    const invId = (await A.household()).invites[0].id;
    const paths: [string, string][] = [
      ['GET', '/api/household'], ['DELETE', `/api/household/invites/${invId}`], ['DELETE', '/api/household/invites/finnes-ikke'],
      ['DELETE', '/api/household/members/enhet-bbbb2222'], ['DELETE', '/api/household/members/enhet-zzzz9999'], ['GET', '/api/sync?after=0'],
      ['GET', '/api/household/hva-som-helst'], ['GET', '/api/household/export'], ['GET', '/api/household/export?id=1'],
    ];
    const bodies = new Set<string>();
    for (const auth of [undefined, 'Bearer feil', 'Bearer ' + 'A'.repeat(43), 'Basic abc', `bearer ${'A'.repeat(43)}`, 'Bearer ' + 'A'.repeat(43) + ' x']) {
      for (const [method, path] of paths) {
        const r = await req(path, { method, headers: auth ? { Authorization: auth } : {} });
        expect(r.status, `${auth} ${method} ${path}`).toBe(401);
        bodies.add(await r.text());
      }
    }
    expect(bodies.size).toBe(1);
  });

  it('et medlem ser ikke om noe finnes i en annen husstand: samme 404 som for noe som ikke finnes', async () => {
    const one = await household();
    const c = await anon().createHousehold('enhet-cccc3333');
    const C = anon().withToken(c.token);
    await one.A.invite();
    const foreignInvite = (await one.A.household()).invites[0].id;
    const r1 = await code(C.deleteInvite(foreignInvite));
    const r2 = await code(C.deleteInvite('00000000-0000-0000-0000-000000000000'));
    expect(r1).toBe('404 ikke_funnet');
    expect(r2).toBe(r1);
    expect(await code(C.removeMember('enhet-bbbb2222'))).toBe('404 ikke_funnet');
    expect(await code(C.removeMember('enhet-zzzz9999'))).toBe('404 ikke_funnet');
    expect((await one.A.household()).invites).toHaveLength(1);
  });

  it('tokenet utløper etter lang inaktivitet (glidende); bruk holder det i live; eierskap går videre', async () => {
    await srv.close();
    srv = await start({ tokenIdleMs: 30 * 86_400_000 });
    const { A, B } = await household();
    for (let i = 0; i < 3; i++) { srv.advance(20 * 86_400_000); await A.household(); } // A brukes jevnlig
    expect(await code(B.household())).toBe('401 ikke_autentisert'); // B har ikke vært brukt på 60 dager
    const members = (await A.pull(0)).members;
    expect(members.find((m) => m.id === 'enhet-bbbb2222')).toMatchObject({ removed: true, label: 'Tidligere medlem', lastSeen: null });
    srv.advance(31 * 86_400_000);
    expect(await code(A.household())).toBe('401 ikke_autentisert');
    expect(srv.storage.counts().households).toBe(0); // siste aktive enhet utløp: husstanden er slettet
  });
});

describe('dokumentanker (synk etter gjenoppretting)', () => {
  it('ugyldig dokumentanker gir 400 uten logg; gyldig gir 200', async () => {
    const { a } = await household();
    const h = { Authorization: `Bearer ${a.token}` };
    const bad = ['postnummer:1:abcdefabcdef', 'plan:x:abcdefabcdef', 'plan:1:ABCDEFABCDEF', 'plan:1:abc', 'plan:1:abcdefabcdef,plan:2:abcdefabcdef',
      'plan:1,innstillinger:1,plan:2', 'plan:-1', 'plan:1:abcdefabcdef:x', `plan:${'9'.repeat(20)}`, 'plan:1\n', 'x'.repeat(5000)];
    for (const v of bad) {
      const r = await req(`/api/sync?after=0&docs=${encodeURIComponent(v)}`, { headers: h });
      expect(r.status, v).toBe(400);
      expect((await r.json()).error).toBe('ugyldig_forespørsel');
    }
    for (const v of ['', 'plan:1', 'plan:1:abcdefabcdef,innstillinger:3:0123456789ab']) {
      expect((await req(`/api/sync?after=0&docs=${encodeURIComponent(v)}`, { headers: h })).status, v).toBe(200);
    }
    expect(logs).toEqual([]);
  });

  it('slekten (revs) er interne versjons-id-er: de er ikke med i eksporten', async () => {
    const { A } = await household();
    const r = await A.putDoc('plan', 0, { slots: [], approved: false, option: 'regular' });
    const x = JSON.stringify(await A.exportData());
    expect(x).not.toContain(r.revs![0]);
    expect(x).toContain('"versjon":1');
  });
});

describe('eksport', () => {
  it('ingen lekkasje mellom husstander, og loggen får aldri innhold', async () => {
    const one = await household();
    await one.A.setLabel('UnikEierEtikett');
    await one.A.push([telling('UnikHendelse', 'enhet-aaaa1111')]);
    const c = await anon().createHousehold('enhet-cccc3333', 'Annen');
    const x = await anon().withToken(c.token).exportData();
    expect(JSON.stringify(x)).not.toMatch(/UnikEierEtikett|UnikHendelse|enhet-aaaa1111|enhet-bbbb2222/);
    expect(JSON.stringify(await one.B.exportData())).toMatch(/UnikEierEtikett[\s\S]*UnikHendelse/);
    expect(logs).toEqual([]);
  });

  it('bare GET; samme 404 for andre metoder og ekstra stidel', async () => {
    const { a } = await household();
    const h = { Authorization: `Bearer ${a.token}` };
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) expect((await req('/api/household/export', { method, headers: h })).status).toBe(404);
    expect((await req('/api/household/export/x', { headers: h })).status).toBe(404);
  });

  it('en klient som kobler fra midt i en stor eksport, krasjer ikke serveren og gir ingen logg', async () => {
    const { A, a } = await household();
    for (let i = 0; i < 6; i++) await A.push(Array.from({ length: 500 }, (_, j) => telling(`t${i}-${j}-${'x'.repeat(60)}`, 'enhet-aaaa1111')));
    const ctl = new AbortController();
    const r = await req('/api/household/export', { headers: { Authorization: `Bearer ${a.token}` }, signal: ctl.signal });
    expect(r.status).toBe(200);
    ctl.abort();
    await new Promise((res) => setTimeout(res, 50));
    expect((await A.exportData()).hendelser).toHaveLength(3000);
    expect(logs).toEqual([]);
  });

  it('API-svaret har API-CSP og nosniff, så filen aldri tolkes som et dokument', async () => {
    const { a } = await household();
    const r = await req('/api/household/export', { headers: { Authorization: `Bearer ${a.token}` } });
    expect(r.headers.get('content-security-policy')).toMatch(/^default-src 'none'/);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });
});

describe('invitasjoner og gjetting', () => {
  it('per IP teller siste adresse i X-Forwarded-For; adresser klienten setter foran, hjelper ikke', async () => {
    await srv.close();
    srv = await start({ trustProxy: true, limits: { ipPerMin: 100_000, devicePerMin: 100_000, createPerHour: 1000, joinPer10Min: 3 } });
    const tries: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await post('/api/household/join', '{"code":"ZZZZZ-ZZZZZ","deviceId":"enhet-bbbb2222"}', { 'X-Forwarded-For': `10.0.0.${i}, 203.0.113.7` });
      tries.push(r.status);
    }
    expect(tries).toEqual([403, 403, 403, 429, 429]);
  });

  it('IPv6 grupperes på /64, så å bytte adresse i eget nett ikke gir nye forsøk', () => {
    expect(ipKey('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(ipKey('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(ipKey('[2001:db8::1]')).toBe('2001:db8:0:0::/64');
    expect(ipKey('::ffff:192.0.2.1')).toBe('192.0.2.1');
    expect(ipKey('192.0.2.1')).toBe('192.0.2.1');
    expect(ipKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(ipKey('ugyldig')).toBe('ugyldig');
  });

  it('samlet grense for feilede forsøk fra mange IP-er', async () => {
    await srv.close();
    srv = await start({ trustProxy: true, limits: { ipPerMin: 100_000, devicePerMin: 100_000, createPerHour: 1000, joinPer10Min: 1000, joinFailGlobalPer10Min: 4 } });
    const a = await anon().createHousehold('enhet-aaaa1111');
    const inv = await anon().withToken(a.token).invite();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push((await post('/api/household/join', '{"code":"ZZZZZ-ZZZZZ","deviceId":"enhet-bbbb2222"}', { 'X-Forwarded-For': `198.51.100.${i}` })).status);
    }
    expect(statuses).toEqual([403, 403, 403, 403, 429]);
    srv.advance(600_000);
    expect(await code(anon().join(inv.code, 'enhet-bbbb2222'))).toBe('ok');
  });

  it('kodeentropi: 10 tegn fra 32 (50 bit), og alle tegn i alfabetet brukes', async () => {
    const a = await anon().createHousehold('enhet-aaaa1111');
    const A = anon().withToken(a.token);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const inv = await A.invite();
      expect(inv.code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
      for (const ch of inv.code.replace('-', '')) seen.add(ch);
      await A.deleteInvite((await A.household()).invites[0].id);
    }
    expect(seen.size).toBeGreaterThan(28);
  });
});

describe('kvoter per husstand', () => {
  it('høyst 5 aktive invitasjoner', async () => {
    const a = await anon().createHousehold('enhet-aaaa1111');
    const A = anon().withToken(a.token);
    for (let i = 0; i < 5; i++) await A.invite();
    expect(await code(A.invite())).toBe('403 kvote_full');
    await A.deleteInvite((await A.household()).invites[0].id);
    expect(await code(A.invite())).toBe('ok');
  });

  it('full husstand: koden brukes ikke opp, og virker når noen har gått', async () => {
    await srv.close();
    srv = await start({ quotas: { activeMembers: 2 } });
    const { A, B } = await household();
    const inv = await A.invite();
    expect(await code(anon().join(inv.code, 'enhet-cccc3333'))).toBe('403 kvote_full');
    await B.leave();
    expect(await code(anon().join(inv.code, 'enhet-cccc3333'))).toBe('ok');
  });

  it('hendelser over kvoten avvises samlet (blir i utboksen); hendelser som finnes, kan sendes på nytt', async () => {
    await srv.close();
    srv = await start({ quotas: { events: 3 } });
    const { A } = await household();
    expect((await A.push([telling('e1', 'enhet-aaaa1111'), telling('e2', 'enhet-aaaa1111')])).accepted).toEqual(['e1', 'e2']);
    expect(await code(A.push([telling('e3', 'enhet-aaaa1111'), telling('e4', 'enhet-aaaa1111')]))).toBe('403 kvote_full');
    expect(srv.storage.counts().events).toBe(2); // ingenting av kallet lagret
    expect((await A.push([telling('e1', 'enhet-aaaa1111'), telling('e3', 'enhet-aaaa1111')])).accepted).toEqual(['e1', 'e3']);
    expect((await A.push([telling('e3', 'enhet-aaaa1111')])).accepted).toEqual(['e3']);
    expect(await code(A.push([telling('e4', 'enhet-aaaa1111')]))).toBe('403 kvote_full');
  });

  it('samlet tak for alle husstander og samlet grense for nye husstander per time', async () => {
    await srv.close();
    srv = await start({ quotas: { totalEventBytes: 250 }, trustProxy: true, limits: { ipPerMin: 100_000, devicePerMin: 100_000, createPerHour: 1000, createGlobalPerHour: 3, joinPer10Min: 1000 } });
    const make = (i: number) => post('/api/household', JSON.stringify({ deviceId: `enhet-${i}aaaaaaa` }), { 'X-Forwarded-For': `192.0.2.${i}` });
    const one = await (await make(1)).json();
    const two = await (await make(2)).json();
    expect((await make(3)).status).toBe(201);
    expect((await make(4)).status).toBe(429); // fra en ny IP, men over samlet grense
    const A = anon().withToken(one.token), B = anon().withToken(two.token);
    expect((await A.push([telling('a1', 'enhet-1aaaaaaa')])).accepted).toEqual(['a1']);
    expect(await code(B.push([telling('b1', 'enhet-2aaaaaaa'), telling('b2', 'enhet-2aaaaaaa')]))).toBe('403 kvote_full');
  });

  it('samlet størrelse teller i byte (UTF-8), og tellerne følger idempotens', async () => {
    await srv.close();
    srv = await start({ quotas: { eventBytes: 600 } });
    const { A } = await household();
    const e = telling('æøå-1', 'enhet-aaaa1111');
    await A.push([e, e]);
    const used = usageOf();
    expect(used.events).toBe(1);
    expect(used.bytes).toBe(Buffer.byteLength(JSON.stringify(e.event)));
    const big = { ...telling('stor', 'enhet-aaaa1111'), event: { ...telling('stor', 'enhet-aaaa1111').event, ingredient: 'ø'.repeat(60) } } as Envelope;
    expect(await code(A.push([big, telling('x', 'enhet-aaaa1111'), telling('y', 'enhet-aaaa1111'), telling('z', 'enhet-aaaa1111')]))).toBe('403 kvote_full');
    expect(usageOf().events).toBe(1);
  });
});

describe('klokke og rekkefølge', () => {
  it('tidspunkt langt fram i tid settes til mottakstid; tilbakedatering og 1970 (migrering) beholdes; idempotent', async () => {
    const { A, B } = await household();
    const future = telling('fram', 'enhet-aaaa1111', '2099-01-01T00:00:00.000Z');
    const nearFuture = telling('nesten', 'enhet-aaaa1111', '2026-11-23T10:05:00.000Z'); // innen 10 min toleranse
    const past = telling('bak', 'enhet-aaaa1111', '2026-11-01T08:00:00.000Z');
    const migrated = telling('migrert:pasta', 'migrering', '1970-01-01T00:00:00.000Z');
    expect((await A.push([future, nearFuture, past, migrated])).accepted).toEqual(['fram', 'nesten', 'bak', 'migrert:pasta']);
    expect((await A.push([future])).accepted).toEqual(['fram']); // samme id igjen: én rad
    const got = Object.fromEntries((await B.pull(0)).events.map((e) => [e.event.id, e.event.at]));
    expect(got).toEqual({
      fram: srv.now(), nesten: '2026-11-23T10:05:00.000Z', bak: '2026-11-01T08:00:00.000Z', 'migrert:pasta': '1970-01-01T00:00:00.000Z',
    });
    expect(srv.storage.counts().events).toBe(4);
  });
});

describe('dataminimering', () => {
  it('fjernet og forlatt medlem: etikett og «sist sett» fjernes, raden (offentlig id) beholdes', async () => {
    const { A, B } = await household();
    await B.setLabel('Mamma');
    await A.removeMember('enhet-bbbb2222');
    const gone = (await A.pull(0)).members.find((m) => m.id === 'enhet-bbbb2222');
    expect(gone).toMatchObject({ removed: true, label: 'Tidligere medlem', lastSeen: null });
    // Invitert på nytt: får ny etikett.
    const inv = await A.invite();
    const again = await anon().join(inv.code, 'enhet-bbbb2222', 'Pappa');
    expect(again.member.label).toBe('Pappa');
  });
});

describe('basisvarer: egne varenavn', () => {
  it('logges aldri, deles bare i husstanden, og kvoten for dokumentet gjelder', async () => {
    const { A, B } = await household();
    const settings = { eaters: [], days: Array.from({ length: 7 }, () => ({ enabled: true, maxMinutes: 30 })), budgetOre: 90_000, storeIds: ['demoA'], regularStoreId: 'demoA', maxStops: 1, extraStoreThresholdOre: 0 };
    const name = 'Glutenfritt mel';
    await A.putDoc('innstillinger', 0, { ...settings, staples: [{ id: 'egen:glutenfritt-mel', name }] } as never);
    await A.push([{ stream: 'beholdning', event: { type: 'nivå', id: 'n1', at: '2026-11-23T10:00:00.000Z', by: 'enhet-aaaa1111', staple: 'egen:glutenfritt-mel', level: 'tom' } as never }]);
    // Ugyldig navn (for langt, tall) og ugyldig nivå: avvises uten at innholdet havner i loggen.
    await code(A.putDoc('innstillinger', 1, { ...settings, staples: [{ id: 'egen:x', name: `${name} 12345678 ${'x'.repeat(40)}` }] } as never));
    expect(JSON.stringify((await B.pull(0)).docs)).toContain(name);
    const other = await anon().createHousehold('enhet-cccc3333');
    expect(JSON.stringify(await anon().withToken(other.token).pull(0))).not.toContain(name);
    expect(JSON.stringify(logs)).not.toMatch(/Glutenfritt|12345678|egen:/);
    // Hele lista med 40 egne varer på 30 tegn er godt under dokumentgrensen (64 KB).
    const many = Array.from({ length: 40 }, (_, i) => { const n = `${'a'.repeat(27)} ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`; return { id: `egen:${'a'.repeat(27)}-${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`, name: n }; });
    expect(JSON.stringify(many).length).toBeLessThan(4096);
    expect(await code(A.putDoc('innstillinger', 1, { ...settings, staples: many } as never))).toBe('ok');
  });
});

describe('sletting på disk (WAL)', () => {
  it('etter fjerning og sletting finnes etikett og hendelser verken i databasefilen eller i -wal', async () => {
    const file = join(root, 'middag.sqlite');
    const storage = new SqliteStorage(file);
    const dev = (id: string, label: string, tokenHash: string) => ({ id, publicId: `enhet-${id}`, label, tokenHash });
    const now = '2026-11-23T10:00:00.000Z';
    const owner = await storage.createHousehold('hh1', dev('aaaa1111', 'EierEtikettUnik', 'h1'), now);
    await storage.createInvite('hh1', { id: 'i1', codeHash: 'c1', createdBy: owner.id, expiresAt: '2026-11-24T10:00:00.000Z' }, now);
    const joined = await storage.join('c1', dev('bbbb2222', 'MammaEtikettUnik', 'h2'), now);
    if (!joined.ok) throw new Error('join');
    await storage.appendEvents('hh1', owner.id, [{ stream: 'liste', id: 'e1', by: 'enhet-aaaa1111', body: '{"tekst":"HendelseInnholdUnik"}' }], now);
    const onDisk = () => ['', '-wal'].map((s) => { try { return readFileSync(file + s).toString('latin1'); } catch { return ''; } }).join('');
    expect(onDisk()).toContain('MammaEtikettUnik');
    await storage.revoke('hh1', joined.device.id, now);
    expect(onDisk()).not.toContain('MammaEtikettUnik');
    expect(onDisk()).toContain('HendelseInnholdUnik');
    await storage.deleteHousehold('hh1');
    expect(onDisk()).not.toMatch(/EierEtikettUnik|HendelseInnholdUnik/);
    await storage.close();
  });
});

describe('oppbevaringstid på disk', () => {
  it('automatisk sletting fjerner etiketter og hendelser fra både databasefilen og -wal', async () => {
    const file = join(root, 'oppbevaring.sqlite');
    const storage = new SqliteStorage(file);
    const now = '2026-11-23T10:00:00.000Z';
    await storage.createHousehold('hh1', { id: 'd1', publicId: 'enhet-aaaa1111', label: 'GammelEtikettUnik', tokenHash: 'h1' }, now);
    await storage.appendEvents('hh1', 'd1', [{ stream: 'liste', id: 'e1', by: 'enhet-aaaa1111', body: '{"tekst":"GammelHendelseUnik"}' }], now);
    await storage.createHousehold('hh2', { id: 'd2', publicId: 'enhet-bbbb2222', label: 'NyEtikettUnik', tokenHash: 'h2' }, '2027-11-01T10:00:00.000Z');
    const onDisk = () => ['', '-wal'].map((s) => { try { return readFileSync(file + s).toString('latin1'); } catch { return ''; } }).join('');
    expect(onDisk()).toContain('GammelHendelseUnik');
    expect(await runRetention(storage, 365, '2027-11-24T10:00:00.000Z')).toBe(1);
    expect(onDisk()).not.toMatch(/GammelEtikettUnik|GammelHendelseUnik/);
    expect(onDisk()).toContain('NyEtikettUnik');
    expect(storage.counts()).toMatchObject({ households: 1, devices: 1, events: 0 });
    await storage.close();
  });
});

describe('etiketter', () => {
  it('Unicode: retningsstyring, usynlige tegn, kontrolltegn og enslige surrogater fjernes; emoji deles ikke', () => {
    expect(cleanLabel('Voksen‮1⁦')).toBe('Voksen1');
    expect(cleanLabel('a​b‍c﻿d­e')).toBe('abcde');
    expect(cleanLabel('a\u0000b\u001bc\u0085d e')).toBe('abcde');
    expect(cleanLabel('x\ud83dy')).toBe('xy');
    expect(cleanLabel('x\ude00y')).toBe('xy');
    expect(cleanLabel('😀'.repeat(30))).toBe('😀'.repeat(24));
    expect(cleanLabel('A'.repeat(23) + '😀')).toBe('A'.repeat(23) + '😀');
    expect(cleanLabel('é')).toBe('é'); // NFC
    expect(cleanLabel('  a \n\t b  ')).toBe('a b');
    expect(cleanLabel('‮​')).toBeNull();
    expect(cleanLabel({ toString: () => 'x' })).toBeNull();
    expect(cleanLabel('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert'); // vises som tekst (React)
  });

  it('serveren lagrer bare rensede etiketter', async () => {
    const a = await anon().createHousehold('enhet-aaaa1111', '‮Voksen\u0000 1😀😀');
    expect(a.member.label).toBe('Voksen 1😀😀');
    const A = anon().withToken(a.token);
    expect(await code(A.setLabel('​‮'))).toBe('400 ugyldig_forespørsel');
  });
});

/** Bruk for den eneste husstanden i databasen. */
function usageOf() {
  const s = srv.storage as SqliteStorage;
  const db = (s as unknown as { db: { prepare(q: string): { get(): { id: string } } } }).db;
  return s.usage(db.prepare('SELECT id FROM households LIMIT 1').get().id);
}
