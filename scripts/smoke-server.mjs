// Røyktest av produksjonsbygget (npm run build:server + npm run build): kopierer dist-server/ og dist/ til en tom
// midlertidig katalog (uten node_modules, uten src/ og uten tsx), starter `node dist-server/index.mjs` der, og sjekker
// /healthz, appen og CSP, oppretter husstand, inviterer og blir med fra en annen enhet, sender én hendelse to ganger
// (idempotent), leser den fra den andre enheten, og at data overlever en omstart av serveren. Tilbudslagringen (egen fil,
// TJEK_FETCH=0) fylles med én rad mens serveren står, og må serveres med opprinnelig observasjonsdato etter omstart.
// Kjør: npm run smoke:server   Ingen nettleser og ingen nettverk utenfor localhost. Kaller ikke Tjek.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

for (const p of ['dist-server/index.mjs', 'dist/index.html']) {
  if (!existsSync(p)) { console.error(`Mangler ${p}. Kjør «npm run build && npm run build:server» først.`); process.exit(2); }
}
const work = mkdtempSync(join(tmpdir(), 'middag-smoke-'));
cpSync('dist-server', join(work, 'dist-server'), { recursive: true });
cpSync('dist', join(work, 'dist'), { recursive: true });
const PORT = Number(process.env.SMOKE_PORT ?? 4301);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = join(work, 'data', 'smoke.sqlite');
const OFFER_DB = join(work, 'data', 'tilbud.sqlite');
const SECRET = randomBytes(16).toString('hex');
let log = '';
let proc;
const start = () => {
  proc = spawn(process.execPath, ['dist-server/index.mjs'], {
    cwd: work, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, NODE_ENV: 'production', PORT: String(PORT), SYNC_DB: DB, SYNC_SECRET: SECRET, OFFER_DB, TJEK_FETCH: '0' },
  });
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
};
let lastExit = null;
const stop = () => new Promise((r) => { if (!proc || proc.exitCode !== null) return r(); proc.once('exit', (code) => { lastExit = code; r(); }); proc.kill('SIGTERM'); });
async function ready() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(BASE + '/healthz')).ok) return; } catch { /* starter */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Serveren startet ikke:\n' + log);
}
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failures++; };
const api = (path, { token, method = 'GET', body } = {}) => fetch(BASE + path, {
  method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

try {
  start();
  await ready();
  const h = await fetch(BASE + '/healthz');
  check(h.status === 200 && (await h.json()).status === 'ok', '/healthz gir 200 {"status":"ok"}');
  const root = await fetch(BASE + '/');
  const html = await root.text();
  check(root.status === 200 && html.includes('<div id="root"'), 'GET / serverer den bygde appen');
  check((root.headers.get('content-security-policy') ?? '').includes("script-src 'self'"), 'streng CSP på appen');
  const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  check(!!asset && (await fetch(BASE + asset)).status === 200, 'JS-pakken fra dist/assets serveres');
  // POST gir 405 uten å starte noe oppslag mot Tjek (GET ville gjort det): røyktesten kaller ikke eksterne tjenester.
check((await api('/api/offers', { method: 'POST' })).status === 405, '/api/offers er koblet inn (POST gir 405; Tjek ikke kalt)');
  check((await fetch(BASE + '/api/household')).status === 401, 'husstands-API uten token gir 401');
  const lagret0 = await fetch(BASE + '/api/offers/lagret');
  const l0 = await lagret0.json();
  check(lagret0.status === 200 && l0.stored === true && l0.status === 'error' && l0.offers.length === 0, '/api/offers/lagret svarer (tom lagring, henting av: «error»)');
  check(existsSync(OFFER_DB), 'tilbudslagringen er en egen fil ved siden av synk-databasen');

  const a = await (await api('/api/household', { method: 'POST', body: { deviceId: 'enhet-smoke-aaaa', label: 'Voksen 1' } })).json();
  check(typeof a.token === 'string', 'opprett husstand (A)');
  const inv = await (await api('/api/household/invites', { method: 'POST', token: a.token, body: {} })).json();
  const joined = await api('/api/household/join', { method: 'POST', body: { code: inv.code, deviceId: 'enhet-smoke-bbbb' } });
  const b = await joined.json();
  check(joined.status === 200 && typeof b.token === 'string', 'enhet B blir med via engangsinvitasjon');

  const env = { stream: 'beholdning', event: { type: 'telling', id: 'smoke-1', at: '2026-11-23T10:00:00.000Z', by: 'enhet-smoke-aaaa', ingredient: 'pasta', amount: 100 } };
  const push1 = await (await api('/api/sync/events', { method: 'POST', token: a.token, body: { events: [env] } })).json();
  const push2 = await (await api('/api/sync/events', { method: 'POST', token: a.token, body: { events: [env] } })).json();
  check(push1.accepted?.length === 1 && push1.rejected?.length === 0, 'hendelse fra A godtatt');
  const pull = await (await api('/api/sync?after=0', { token: b.token })).json();
  check(pull.events?.length === 1 && pull.events[0].event.id === 'smoke-1', 'B leser hendelsen (sendt to ganger: én rad)');
  check(Array.isArray(push2.accepted), 'sending to ganger gir ikke feil');

  const t0 = Date.now();
  await stop();
  check(lastExit === 0 && Date.now() - t0 < 3000 && log.includes('avslutter'), `SIGTERM avslutter ryddig (kode ${lastExit}, ${Date.now() - t0} ms)`);
  // Én lagret observasjon (sett for to dager siden) mens serveren står: må serveres med den datoen, ikke lesetiden.
  const day = (n) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
  const seen = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const odb = new DatabaseSync(OFFER_DB);
  odb.prepare(`INSERT INTO offer_observations (source, id, chain, country, dealer_id, dealer_name, heading, description, price_ore, pre_price_ore,
    amount, unit, pieces, valid_from, valid_until, status, content, first_observed, last_observed) VALUES ('tjek', 'smoke-1', 'KIWI', 'NO', 'd', 'KIWI',
    'Torskefilet', NULL, 7990, NULL, 400, 'g', NULL, ?, ?, 'tilbud', 'x', ?, ?)`).run(day(-3), day(3), seen, seen);
  odb.prepare("INSERT INTO offer_meta (key, value) VALUES ('last_fetch', ?)").run(seen);
  odb.close();
  start();
  await ready();
  const l1 = await (await fetch(BASE + '/api/offers/lagret')).json();
  check(l1.status === 'ok' && l1.offers.length === 1 && l1.offers[0].offer.observed === seen && l1.observed === seen, 'lagret tilbud serveres etter omstart med dagen prisen ble sett');
  const after = await api('/api/sync?after=0', { token: b.token });
  const pull2 = await after.json();
  check(after.status === 200 && pull2.events?.length === 1, 'husstand og hendelse overlever omstart (SQLite på disk)');
  check(!/Error|tsx/.test(log.replace(/ExperimentalWarning[^\n]*/g, '')), 'ingen feil i serverloggen');
} catch (e) {
  console.error(String(e instanceof Error ? e.message : e)); failures++;
} finally {
  await stop();
  rmSync(work, { recursive: true, force: true });
}
if (failures) { console.error(`\n${failures} sjekk(er) feilet.\n--- serverlogg ---\n${log}`); process.exit(1); }
console.log('\nRøyktest av produksjonsbygget bestått.');
