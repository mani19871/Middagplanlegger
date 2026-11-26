// Prøver docs/drift/driftstatus.sh uten Docker, systemd eller ekte sertifikat: en falsk «docker» (bash) som svarer med
// faste verdier og kjører det virkelige lese-programmet mot (a) den ekte, bygde serveren (dist-server/index.mjs, TJEK_FETCH=0) og
// (b) en falsk /healthz med valgfrie tall; falske sikkerhetskopier med satt alder; selvsignerte sertifikater med ulik levetid
// bak en lokal HTTPS-server. Sjekker nivå (OK/ADVARSEL/FEIL) per punkt, utgangskode, --journal og at utskriften aldri har
// hemmeligheter, IP-adresser eller innhold. Kjør: npm run build:server && npm run check:driftstatus
// Sett VIS=1 for å se to hele rapporter.
// Krever Linux, bash, openssl, curl og GNU find/date. Kaller ikke Tjek og ingen tjenester utenfor localhost.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { createServer as httpServer } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (process.platform !== 'linux') { console.log('hopper over: driftstatus.sh krever Linux (GNU find/date).'); process.exit(0); }
if (!existsSync('dist-server/index.mjs')) { console.error('Mangler dist-server/index.mjs. Kjør «npm run build:server» først.'); process.exit(2); }
for (const tool of ['bash', 'openssl', 'curl']) {
  if (spawnSync(tool, ['--version'], { stdio: 'ignore' }).error) { console.error(`Mangler ${tool}.`); process.exit(2); }
}

const SCRIPT = join(process.cwd(), 'docs/drift/driftstatus.sh');
const tmp = mkdtempSync(join(tmpdir(), 'husvett-drift-'));
const APP_DIR = join(tmp, 'app'); const DATA = join(tmp, 'data'); const DRIFT = join(tmp, 'drift'); const BACKUP = join(tmp, 'backup');
for (const d of [APP_DIR, DATA, DRIFT, BACKUP]) mkdirSync(d, { recursive: true });
cpSync('dist-server', join(APP_DIR, 'dist-server'), { recursive: true });
const HEMMELIG_VERDI = 'HEMMELIGHET-SKAL-ALDRI-VISES-' + Math.random().toString(36).slice(2);
const P_REAL = 4321, P_FAKE = 4322, P_TLS = 4323;

let failures = 0;
const check = (ok, what, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) { failures++; if (extra) console.log(extra.split('\n').map((l) => '    ' + l).join('\n')); } };

// ---- falsk docker --------------------------------------------------------------------------------------------------------
const FAKE = join(tmp, 'fakedocker');
writeFileSync(FAKE, `#!/usr/bin/env bash
# Falsk docker til prøving av driftstatus.sh. Styres av FAKE_*-variabler.
[[ -n "\${FAKE_DOCKER_DOWN:-}" ]] && exit 1
case "$1" in
  version) echo 29.0.0 ;;
  compose)
    # compose --env-file .env.drift ps -a -q <tjeneste>
    svc="\${@: -1}"
    if [[ "$svc" == app ]]; then echo abcdef0123456789; else [[ -n "\${FAKE_NO_CADDY:-}" ]] || echo 0123456789abcdef; fi ;;
  inspect)
    if [[ "$*" == *Health* ]]; then echo "\${FAKE_APP:-running|healthy|0|2026-11-24T08:00:00.000000000Z}"; else echo "\${FAKE_CADDY:-running}"; fi ;;
  exec) shift 2; exec env DATA_DIR="$FAKE_DATA" PORT="$FAKE_PORT" "$@" ;;
  stats) echo "\${FAKE_STATS:-3.52%|45.3MiB / 2GiB}" ;;
  logs) cat "\${FAKE_LOG:-/dev/null}" ;;
  *) exit 1 ;;
esac
`, { mode: 0o755 });

// ---- ekte server (bygget) og falsk helse ----------------------------------------------------------------------------------
const real = spawn(process.execPath, ['dist-server/index.mjs'], {
  cwd: APP_DIR, stdio: 'ignore',
  env: { PATH: process.env.PATH, PORT: String(P_REAL), DATA_DIR: DATA, SYNC_SECRET: HEMMELIG_VERDI, TJEK_FETCH: '0' },
});
process.on('exit', () => { real.kill('SIGKILL'); }); // ingen server blir liggende igjen, heller ikke ved feil
let fakeHealth = { status: 200, body: {} };
const fake = httpServer((req, res) => {
  res.statusCode = fakeHealth.status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(fakeHealth.body));
}).listen(P_FAKE, '127.0.0.1');
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${P_REAL}/healthz`)).ok) break; } catch { /* starter */ } await new Promise((r) => setTimeout(r, 100)); }

// ---- sertifikater ---------------------------------------------------------------------------------------------------------
function cert(days, name) {
  const key = join(tmp, `${name}.key`), crt = join(tmp, `${name}.crt`);
  const r = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-days', String(days), '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
  if (r.status !== 0) throw new Error('openssl kunne ikke lage sertifikat');
  return { key: readFileSync(key), cert: readFileSync(crt), crt };
}
let tls = null;
async function serveTls(c) {
  await stopTls();
  tls = httpsServer({ key: c.key, cert: c.cert }, (req, res) => { res.statusCode = req.url === '/healthz' ? 200 : 404; res.end('{"status":"ok"}'); });
  await new Promise((r) => tls.listen(P_TLS, '127.0.0.1', r));
}
const stopTls = () => new Promise((r) => { if (!tls) return r(); tls.closeAllConnections(); tls.close(() => r()); tls = null; });

// ---- kjøring ----------------------------------------------------------------------------------------------------------------
const AGE = (h) => Math.floor(Date.now() / 1000) - h * 3600;
function backupFile(name, ageHours, size = 1000) {
  const f = join(BACKUP, name);
  writeFileSync(f, Buffer.alloc(size, 1));
  utimesSync(f, AGE(ageHours), AGE(ageHours));
}
const resetBackups = (mid = 5, off = 5) => {
  rmSync(BACKUP, { recursive: true, force: true }); mkdirSync(BACKUP);
  if (mid !== null) backupFile('middag-20261126T031700Z.sqlite.age', mid);
  if (off !== null) backupFile('tilbud-20261126T031700Z.sqlite.age', off);
};
const envFile = (extra = '') => writeFileSync(join(DRIFT, '.env.drift'), `DOMENE=localhost\nSYNC_SECRET=${HEMMELIG_VERDI}\nSYNC_RETENTION_DAYS=730\n${extra}`, { mode: 0o600 });
writeFileSync(join(DRIFT, 'docker-compose.yml'), 'name: test\n');
const logFile = join(tmp, 'app.log');
writeFileSync(logFile, 'Synk-databasen: /data/middag.sqlite (3 husstander).\nTilbud: 10 hentet\n');

const GOOD_HEALTH = { status: 200, body: { status: 'ok', dbOk: true, offersFetch: true, offersLastRunAgeMinutes: 100, offersFailures: 0, offersDbOk: true, uptimeMinutes: 5000, hemmelig: 'tekstverdi-skal-ikke-vises' } };
const baseEnv = () => ({
  PATH: process.env.PATH, HOME: tmp, HUSVETT_DOCKER: FAKE, HUSVETT_DRIFT_DIR: DRIFT, BACKUP_DIR: BACKUP, HUSVETT_DOMENE: 'localhost',
  HUSVETT_TLS_PORT: String(P_TLS), HUSVETT_CA_FILE: join(tmp, 'good.crt'),
  FAKE_DATA: DATA, FAKE_PORT: String(P_FAKE), FAKE_LOG: logFile,
  // Sandkassens disk og minne skal ikke styre prøven; egne tester under setter terskler.
  HUSVETT_DISK_WARN_PCT: '101', HUSVETT_DISK_FAIL_PCT: '101', HUSVETT_DISK_WARN_FREE_MB: '0', HUSVETT_DISK_FAIL_FREE_MB: '0',
  HUSVETT_MEM_WARN_PCT: '0', HUSVETT_MEM_FAIL_PCT: '0',
});
/** Kjør skriptet (asynkront: de falske tjenestene ligger i denne prosessen); `lines` gir [nivå, tekst] per punkt. */
async function run(env = {}, args = [], health = GOOD_HEALTH) {
  fakeHealth = health;
  const child = spawn('bash', [SCRIPT, ...args], { env: { ...baseEnv(), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
  const code = await new Promise((r) => child.on('close', r));
  clearTimeout(timer);
  const lines = out.split('\n').map((l) => /^(?:<\d>)?(OK|ADVARSEL|FEIL) +(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]);
  return { code, out, lines, level: (prefix) => lines.find(([, t]) => t.startsWith(prefix))?.[0] ?? '(mangler)' };
}
const expectLevel = (r, prefix, level, what) => check(r.level(prefix) === level, `${what}: «${prefix}» er ${level}`, r.level(prefix) === level ? '' : `fikk ${r.level(prefix)}\n${r.out}`);

const good = cert(90, 'good');
await serveTls(good);
envFile();
resetBackups();

// 1. Alt i orden
{
  const r = await run();
  if (process.env.VIS) console.log(r.out);
  check(r.code === 0 && r.lines.at(-1)?.[0] === 'OK', 'alt i orden: utgangskode 0 og «Samlet: OK»', r.out);
  for (const p of ['Containere: app', 'Containere: Caddy', 'Helsesjekk', 'Disk (Husvetts datavolum)', 'Disk (sikkerhetskopimappen)', 'Minne (hele serveren', 'Minne (appen)',
    'Sikkerhetskopi (synk-databasen)', 'Sikkerhetskopi (tilbudsdatabasen)', 'Databaser', 'Tilbud fra Tjek', 'Feil i appens logg', 'TLS-sertifikat', 'Nettadressen']) expectLevel(r, p, 'OK', 'alt i orden');
  check(!r.out.includes(HEMMELIG_VERDI), 'utskriften har aldri SYNC_SECRET fra .env.drift');
  check(!r.out.includes('tekstverdi-skal-ikke-vises'), 'tekstfelt fra /healthz vises aldri');
  check(!/\b\d{1,3}(\.\d{1,3}){3}\b/.test(r.out) && !/127\.0\.0\.1|::1/.test(r.out), 'ingen IP-adresser i utskriften');
  check(!/3 husstander|middag\.sqlite/.test(r.out), 'ingenting fra loggen eller stier til databasen i utskriften');
}

// 2. Mot den ekte, bygde serveren (TJEK_FETCH=0): /healthz, størrelser og tilbudstall kommer fra serverens egne felt
{
  const r = await run({ FAKE_PORT: String(P_REAL) });
  if (process.env.VIS) console.log(r.out);
  expectLevel(r, 'Helsesjekk', 'OK', 'ekte server');
  expectLevel(r, 'Databaser', 'OK', 'ekte server');
  expectLevel(r, 'Tilbud fra Tjek', 'ADVARSEL', 'ekte server (henting av)');
  check(/henting er slått av/.test(r.out) && r.code === 1, 'ekte server: «henting er slått av» gir utgangskode 1');
  check(/Databaser: synk \d+ kB|Databaser: synk \d+,?\d* (kB|MB)/.test(r.out), 'ekte server: størrelsen på synk-databasen vises', r.out);
}

// 3. Docker og containere
{
  let r = await run({ FAKE_DOCKER_DOWN: '1' });
  expectLevel(r, 'Docker:', 'FEIL', 'docker kan ikke kjøres');
  check(r.code === 2, 'docker nede: utgangskode 2');
  expectLevel(r, 'Sikkerhetskopi (synk-databasen)', 'OK', 'docker nede: punkter uten docker sjekkes likevel');
  expectLevel(r, 'TLS-sertifikat', 'OK', 'docker nede: TLS sjekkes likevel');
  r = await run({ FAKE_APP: 'exited|ingen|0|2026-11-24T08:00:00Z' }); expectLevel(r, 'Containere: app', 'FEIL', 'app stoppet');
  r = await run({ FAKE_APP: 'running|unhealthy|0|2026-11-24T08:00:00Z' }); expectLevel(r, 'Containere: app', 'FEIL', 'app unhealthy');
  r = await run({ FAKE_APP: 'running|starting|0|2026-11-24T08:00:00Z' }); expectLevel(r, 'Containere: app', 'ADVARSEL', 'app starter');
  r = await run({ FAKE_APP: 'running|healthy|7|2026-11-24T08:00:00Z' }); expectLevel(r, 'Containere: app', 'ADVARSEL', 'app har startet på nytt mange ganger');
  r = await run({ FAKE_NO_CADDY: '1' }); expectLevel(r, 'Containere: Caddy', 'FEIL', 'Caddy mangler i vei A');
  envFile('COMPOSE_FILE=docker-compose.yml:docker-compose.bak-proxy.yml\n');
  r = await run({ FAKE_NO_CADDY: '1' }); expectLevel(r, 'Containere: ingen egen Caddy', 'OK', 'vei B uten Caddy');
  envFile();
  r = await run({ FAKE_CADDY: 'exited' }); expectLevel(r, 'Containere: Caddy', 'FEIL', 'Caddy stoppet');
  rmSync(join(DRIFT, '.env.drift')); r = await run(); expectLevel(r, 'Containere:', 'FEIL', 'mangler .env.drift'); envFile();
}

// 4. /healthz lokalt
{
  let r = await run({}, [], { status: 503, body: { status: 'feil', dbOk: false } }); expectLevel(r, 'Helsesjekk', 'FEIL', '503'); check(r.code === 2, '503: utgangskode 2');
  r = await run({}, [], { status: 429, body: { error: 'for_mange_forespørsler' } }); expectLevel(r, 'Helsesjekk', 'ADVARSEL', '429');
  r = await run({ FAKE_PORT: '4399' }); expectLevel(r, 'Helsesjekk', 'FEIL', 'appen svarer ikke');
  r = await run({}, [], { status: 200, body: { status: 'ok', dbOk: false } }); expectLevel(r, 'Helsesjekk', 'FEIL', 'svar 200 men dbOk false');
}

// 5. Tilbudshenting
{
  const h = (o) => ({ status: 200, body: { ...GOOD_HEALTH.body, ...o } });
  let r = await run({}, [], h({ offersLastRunAgeMinutes: 14 * 60 + 1 })); expectLevel(r, 'Tilbud fra Tjek', 'ADVARSEL', '14 timer');
  r = await run({}, [], h({ offersLastRunAgeMinutes: 13 * 60 })); expectLevel(r, 'Tilbud fra Tjek', 'OK', '13 timer');
  r = await run({}, [], h({ offersLastRunAgeMinutes: 50 * 60 })); expectLevel(r, 'Tilbud fra Tjek', 'FEIL', '50 timer');
  r = await run({}, [], h({ offersFailures: 3 })); expectLevel(r, 'Tilbud fra Tjek', 'ADVARSEL', '3 mislykkede på rad');
  r = await run({}, [], h({ offersLastRunAgeMinutes: undefined, uptimeMinutes: 5 })); expectLevel(r, 'Tilbud fra Tjek', 'OK', 'nystartet, ingen henting ennå');
  r = await run({}, [], h({ offersLastRunAgeMinutes: undefined, uptimeMinutes: 500 })); expectLevel(r, 'Tilbud fra Tjek', 'ADVARSEL', 'aldri vellykket henting');
  r = await run({}, [], h({ offersFetch: false })); expectLevel(r, 'Tilbud fra Tjek', 'ADVARSEL', 'henting av');
}

// 6. Sikkerhetskopier
{
  resetBackups(40, 5); let r = await run(); expectLevel(r, 'Sikkerhetskopi (synk-databasen)', 'ADVARSEL', '40 timer gammel'); check(r.code === 1, '40 timer: utgangskode 1');
  resetBackups(35, 5); expectLevel(await run(), 'Sikkerhetskopi (synk-databasen)', 'OK', '35 timer gammel');
  resetBackups(5 * 24, 5); r = await run(); expectLevel(r, 'Sikkerhetskopi (synk-databasen)', 'FEIL', '5 døgn gammel'); check(r.code === 2, '5 døgn: utgangskode 2');
  resetBackups(null, 5); expectLevel(await run(), 'Sikkerhetskopi (synk-databasen)', 'FEIL', 'ingen kopi av synk-databasen');
  resetBackups(5, null); expectLevel(await run(), 'Sikkerhetskopi (tilbudsdatabasen)', 'ADVARSEL', 'ingen kopi av tilbudsdatabasen');
  resetBackups(5, null);
  const noStore = { status: 200, body: { status: 'ok', dbOk: true, offersFetch: false, offersLastRunAgeMinutes: null, offersFailures: 0, uptimeMinutes: 900 } };
  expectLevel(await run({}, [], noStore), 'Sikkerhetskopi (tilbudsdatabasen)', 'OK', 'ingen tilbudslagring, ingen kopi nødvendig');
  rmSync(BACKUP, { recursive: true, force: true }); r = await run(); expectLevel(r, 'Sikkerhetskopi (synk-databasen)', 'FEIL', 'mappen finnes ikke');
  resetBackups(5, 5); backupFile('middag-20261126T031700Z.sqlite.age', 1, 0); expectLevel(await run(), 'Sikkerhetskopi (synk-databasen)', 'FEIL', 'tom kopifil');
  resetBackups(60, 5); backupFile('middag-20261126T041700Z.sqlite.gpg', 2); expectLevel(await run(), 'Sikkerhetskopi (synk-databasen)', 'OK', 'nyeste av flere (age og gpg)');
  resetBackups();
}

// 7. Disk, minne, databaser, feillogg
{
  let r = await run({ HUSVETT_DISK_WARN_PCT: '0', HUSVETT_DISK_FAIL_PCT: '101' }); expectLevel(r, 'Disk (Husvetts datavolum)', 'ADVARSEL', 'diskterskel advarsel'); expectLevel(r, 'Disk (sikkerhetskopimappen)', 'ADVARSEL', 'diskterskel advarsel (kopimappen)');
  r = await run({ HUSVETT_DISK_FAIL_PCT: '0' }); expectLevel(r, 'Disk (Husvetts datavolum)', 'FEIL', 'diskterskel feil');
  r = await run({ HUSVETT_DISK_FAIL_FREE_MB: '999999999' }); expectLevel(r, 'Disk (Husvetts datavolum)', 'FEIL', 'lite ledig plass');
  r = await run({ HUSVETT_MEM_WARN_PCT: '101' }); expectLevel(r, 'Minne (hele serveren', 'ADVARSEL', 'minneterskel advarsel');
  r = await run({ HUSVETT_MEM_FAIL_PCT: '101' }); expectLevel(r, 'Minne (hele serveren', 'FEIL', 'minneterskel feil');
  r = await run({ FAKE_STATS: '80.1%|1.6GiB / 2GiB' }); expectLevel(r, 'Minne (appen)', 'ADVARSEL', 'appminne 80 %');
  r = await run({ FAKE_STATS: '95.0%|1.9GiB / 2GiB' }); expectLevel(r, 'Minne (appen)', 'FEIL', 'appminne 95 %');
  r = await run({ FAKE_STATS: 'rart format' }); expectLevel(r, 'Minne (appen)', 'ADVARSEL', 'uleselig minne (vises ikke rått)'); check(!r.out.includes('rart format'), 'uleselig minneverdi vises ikke');
  r = await run({ HUSVETT_DB_WARN_MB: '0' }); expectLevel(r, 'Databaser', 'ADVARSEL', 'databaser over terskelen');
  r = await run({ FAKE_DATA: join(tmp, 'finnes-ikke') }); expectLevel(r, 'Databaser', 'FEIL', 'synk-databasen mangler i volumet');
  writeFileSync(logFile, 'serverfeil: TypeError\n'.repeat(7) + 'Tilbud: 3 hentet\n'); expectLevel(await run(), 'Feil i appens logg', 'ADVARSEL', '7 feillinjer');
  writeFileSync(logFile, 'synk-feil: Error\n'.repeat(150)); expectLevel(await run(), 'Feil i appens logg', 'FEIL', '150 feillinjer');
  writeFileSync(logFile, 'tilbud-feil: TimeoutError (forsøk 3)\n'.repeat(20)); expectLevel(await run(), 'Feil i appens logg', 'OK', 'tilbud-feil teller ikke som serverfeil (egen linje)');
  writeFileSync(logFile, 'serverfeil: TypeError\n'.repeat(7)); r = await run(); check(!r.out.includes('TypeError'), 'loggtekst vises aldri, bare antall');
  writeFileSync(logFile, '');
}

// 8. TLS og nettadressen
{
  let r = await run(); expectLevel(r, 'TLS-sertifikat', 'OK', '90 dager'); expectLevel(r, 'Nettadressen', 'OK', '90 dager');
  await serveTls(cert(15, 'k15')); r = await run({ HUSVETT_CA_FILE: join(tmp, 'k15.crt') }); expectLevel(r, 'TLS-sertifikat', 'ADVARSEL', '15 dager igjen');
  await serveTls(cert(5, 'k5')); r = await run({ HUSVETT_CA_FILE: join(tmp, 'k5.crt') }); expectLevel(r, 'TLS-sertifikat', 'FEIL', '5 dager igjen'); check(r.code === 2, '5 dager: utgangskode 2');
  await serveTls(good); r = await run({ HUSVETT_CA_FILE: '' }); expectLevel(r, 'TLS-sertifikat', 'FEIL', 'selvsignert og ikke betrodd'); expectLevel(r, 'Nettadressen', 'ADVARSEL', 'ikke betrodd sertifikat gir ingen forbindelse');
  r = await run({ HUSVETT_CERT_FAIL_DAYS: '200' }); expectLevel(r, 'TLS-sertifikat', 'FEIL', 'terskel for feil satt over levetiden');
  await stopTls(); r = await run(); expectLevel(r, 'TLS-sertifikat', 'ADVARSEL', 'ingen lytter'); expectLevel(r, 'Nettadressen', 'ADVARSEL', 'ingen lytter');
  await serveTls(good);
}

// 8b. Ytre sjekker kan slås av
{
  const r = await run({ HUSVETT_SKIP_EXTERNAL: '1' });
  check(r.level('TLS-sertifikat') === '(mangler)' && r.level('Nettadressen') === '(mangler)' && /ikke sjekket \(HUSVETT_SKIP_EXTERNAL=1\)/.test(r.out) && r.code === 0,
    'HUSVETT_SKIP_EXTERNAL=1 hopper over TLS og nettadresse, sier fra, og påvirker ikke utgangskoden', r.out);
}

// 9. --journal og valg
{
  let r = await run({}, ['--journal'], { ...GOOD_HEALTH, body: { ...GOOD_HEALTH.body, offersFetch: false } });
  check(/^<6>OK /m.test(r.out) && /^<4>ADVARSEL /m.test(r.out) && !/\x1b\[/.test(r.out), '--journal: prioritetsmerke <6> for OK og <4> for ADVARSEL, ingen farger');
  resetBackups(null, 5); r = await run({}, ['--journal']); check(/^<3>FEIL /m.test(r.out), '--journal: <3> for FEIL'); resetBackups();
  r = await run({}, ['--rart']); check(r.code === 2 && /Ukjent valg/.test(r.out), 'ukjent valg gir utgangskode 2 og forklaring');
  r = await run({}, ['--hjelp']); check(r.code === 0 && /driftsstatus/i.test(r.out), '--hjelp skriver hjelp og gir 0');
}

// 10. Skriveprøve: skriptet endrer ingenting i drift- eller kopimappen
{
  const before = spawnSync('bash', ['-c', `find ${DRIFT} ${BACKUP} -type f -printf '%p %s %T@\\n' | sort`], { encoding: 'utf8' }).stdout;
  await run();
  const after = spawnSync('bash', ['-c', `find ${DRIFT} ${BACKUP} -type f -printf '%p %s %T@\\n' | sort`], { encoding: 'utf8' }).stdout;
  check(before === after, 'skriptet endrer ingen filer i drift- eller kopimappen');
}

real.kill('SIGTERM'); fake.close(); await stopTls();
rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nDriftstatus: alle prøver bestått.' : `\nDriftstatus: ${failures} prøve(r) feilet.`);
process.exit(failures === 0 ? 0 : 1);
