// Sikkerhetskopi og gjenoppretting av begge databasene (docs/drift/backup.sh, docs/hosting.md avsnitt 8), uten Docker:
// en liten «docker»-erstatning på PATH kjører `docker compose … exec -T app KOMMANDO` lokalt mot en datakatalog. Den bygde
// serveren (dist-server/index.mjs) kjører mens kopien tas (WAL), med en husstand og én lagret tilbudsobservasjon. Kopiene
// krypteres med ekte `age`, dekrypteres til en ny katalog, og en ny server må lese begge: husstanden (token gir 200) og
// tilbudet (med opprinnelig observasjonsdato). Til slutt: manglende tilbudsdatabase hoppes over, manglende synk-database
// gir feil uten å opprette en tom fil. Ingen nettverk utenfor localhost; TJEK_FETCH=0.
// Kjør: npm run build:server && npm run check:backup   (krever age og age-keygen)
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

if (!existsSync('dist-server/index.mjs')) { console.error('Mangler dist-server/index.mjs. Kjør «npm run build:server» først.'); process.exit(2); }
for (const tool of ['age', 'age-keygen']) {
  if (spawnSync('sh', ['-c', `command -v ${tool}`]).status !== 0) { console.error(`Mangler ${tool} (verktøyet age). Sjekken kan ikke kjøres.`); process.exit(2); }
}
const work = mkdtempSync(join(tmpdir(), 'middag-backup-'));
const data = join(work, 'data'), restore = join(work, 'restore'), drift = join(work, 'drift'), bin = join(work, 'bin');
for (const d of [data, restore, drift, bin]) mkdirSync(d, { recursive: true });
copyFileSync('docs/drift/backup.sh', join(drift, 'backup.sh'));
chmodSync(join(drift, 'backup.sh'), 0o755);
writeFileSync(join(drift, '.env.drift'), '');
// «docker compose --env-file X exec -T app KOMMANDO …» → KOMMANDO lokalt, med DATA_DIR som i containeren.
writeFileSync(join(bin, 'docker'), '#!/usr/bin/env bash\nwhile [[ "$1" != "app" ]]; do shift; done; shift\nDATA_DIR="$FAKE_DATA" exec "$@"\n');
chmodSync(join(bin, 'docker'), 0o755);

let failures = 0;
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) failures++; };
let log = '';
const server = (dir, port) => {
  const p = spawn(process.execPath, [resolve('dist-server/index.mjs')], {
    cwd: work, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH, PORT: String(port), DATA_DIR: dir, SYNC_SECRET: 'backup-sjekk', TJEK_FETCH: '0' },
  });
  p.stdout.on('data', (d) => { log += d; });
  p.stderr.on('data', (d) => { log += d; });
  return p;
};
const stop = (p) => new Promise((r) => { if (p.exitCode !== null) return r(); p.once('exit', r); p.kill('SIGTERM'); });
const ready = async (base) => {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/healthz`)).ok) return; } catch { /* starter */ } await new Promise((r) => setTimeout(r, 100)); }
  throw new Error(`Serveren startet ikke:\n${log}`);
};
const runBackup = () => spawnSync('./backup.sh', [], {
  cwd: drift, encoding: 'utf8',
  env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_DATA: data, BACKUP_AGE_RECIPIENT: recipient },
});
let recipient = '';
const procs = [];
try {
  const keyOut = spawnSync('age-keygen', ['-o', join(work, 'nokkel.txt')], { encoding: 'utf8' });
  recipient = `${keyOut.stderr}${keyOut.stdout}`.match(/age1[0-9a-z]+/)?.[0] ?? '';
  check(!!recipient, 'age-nøkkelpar laget (privat nøkkel bare i den midlertidige katalogen)');

  // 1) Server med data: én husstand via API-et, én tilbudsobservasjon skrevet ved siden av (WAL, serveren kjører).
  const A = 'http://127.0.0.1:4311';
  const s1 = server(data, 4311); procs.push(s1);
  await ready(A);
  const created = await (await fetch(`${A}/api/household`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: 'enhet-backup-aaaa', label: 'Voksen 1' }) })).json();
  check(typeof created.token === 'string', 'husstand opprettet');
  const day = (n) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
  const seen = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const odb = new DatabaseSync(join(data, 'tilbud.sqlite'));
  odb.exec('PRAGMA busy_timeout = 5000');
  odb.prepare(`INSERT INTO offer_observations (source, id, chain, country, dealer_id, dealer_name, heading, description, price_ore, pre_price_ore,
    amount, unit, pieces, valid_from, valid_until, status, content, first_observed, last_observed) VALUES ('tjek', 'backup-1', 'KIWI', 'NO', 'd',
    'KIWI', 'Torskefilet', NULL, 7990, NULL, 400, 'g', NULL, ?, ?, 'tilbud', 'x', ?, ?)`).run(day(-3), day(3), seen, seen);
  odb.prepare("INSERT INTO offer_meta (key, value) VALUES ('last_fetch', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(seen);
  odb.close();

  // 2) Sikkerhetskopi mens serveren kjører.
  const b1 = runBackup();
  const files = readdirSync(join(drift, 'backup')).sort();
  check(b1.status === 0 && files.length === 2 && files[0].startsWith('middag-') && files[1].startsWith('tilbud-') && files.every((f) => f.endsWith('.sqlite.age')),
    `backup.sh laget to krypterte filer (${files.join(', ')})`);
  check(files.every((f) => execFileSync('head', ['-c', '21', join(drift, 'backup', f)]).toString() === 'age-encryption.org/v1'), 'filene er age-kryptert (ingen klartekst)');
  await stop(s1);

  // 3) Gjenoppretting til en ny katalog, og en ny server som må lese begge.
  for (const f of files) execFileSync('age', ['-d', '-i', join(work, 'nokkel.txt'), '-o', join(restore, f.replace(/-\d{8}T\d{6}Z\.sqlite\.age$/, '.sqlite')), join(drift, 'backup', f)]);
  check(existsSync(join(restore, 'middag.sqlite')) && existsSync(join(restore, 'tilbud.sqlite')), 'begge kopiene dekryptert til en ny katalog');
  const B = 'http://127.0.0.1:4312';
  const s2 = server(restore, 4312); procs.push(s2);
  await ready(B);
  const hh = await fetch(`${B}/api/household`, { headers: { Authorization: `Bearer ${created.token}` } });
  check(hh.status === 200 && (await hh.json()).members?.length === 1, 'gjenopprettet synk-database: tokenet gir 200 og medlemmet finnes');
  const lagret = await (await fetch(`${B}/api/offers/lagret`)).json();
  check(lagret.status === 'ok' && lagret.offers.length === 1 && lagret.offers[0].offer.id === 'backup-1' && lagret.offers[0].offer.observed === seen,
    'gjenopprettet tilbudsdatabase: tilbudet serveres med opprinnelig observasjonsdato');
  check(/Tilbudslagring: .*\(1 observasjoner, 1 kjeder\)/.test(log), 'oppstartslinjen viser tilbudslagringen');
  await stop(s2);

  // 4) Mangler: tilbudsdatabasen hoppes over; synk-databasen gir feil og opprettes ikke tom.
  for (const f of readdirSync(data)) if (f.startsWith('tilbud.sqlite')) rmSync(join(data, f));
  const b2 = runBackup();
  check(b2.status === 0 && /Hopper over tilbud/.test(b2.stdout), 'uten tilbudsdatabase: hoppes over med melding');
  for (const f of readdirSync(data)) if (f.startsWith('middag.sqlite')) rmSync(join(data, f));
  const b3 = runBackup();
  check(b3.status !== 0 && /Fant ikke middag-databasen/.test(b3.stderr) && !existsSync(join(data, 'middag.sqlite')), 'uten synk-database: feil, og ingen tom fil opprettet');
  check(!/Error/.test(log.replace(/ExperimentalWarning[^\n]*/g, '')), 'ingen feil i serverloggene');
} catch (e) {
  console.error(String(e instanceof Error ? e.message : e)); failures++;
} finally {
  for (const p of procs) await stop(p);
  rmSync(work, { recursive: true, force: true });
}
if (failures) { console.error(`\n${failures} sjekk(er) feilet.\n--- serverlogg ---\n${log}`); process.exit(1); }
console.log('\nSikkerhetskopi og gjenoppretting av begge databasene bestått.');
