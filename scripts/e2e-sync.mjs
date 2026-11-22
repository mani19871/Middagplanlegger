// Ende-til-ende: to nettleserkontekster («to enheter») i samme husstand mot en ekte server.
// Viser at en avkrysning vises hos den andre, og at en endring gjort uten nett flettes riktig ved gjenoppkobling.
// Kjør: npm run e2e:sync   (bygger appen først). Krever Playwright med Chromium.
// Serveren startes med egen midlertidig database og egen hemmelighet; ingenting skrives i repoet.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

let chromium;
// require() følger NODE_PATH, så en globalt installert Playwright også virker.
try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch {
  console.error('Fant ikke Playwright. Installer med «npm i -D playwright && npx playwright install chromium».');
  process.exit(2);
}
const PORT = Number(process.env.E2E_PORT ?? 8899);
const BASE = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'middag-e2e-'));
const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], {
  env: { ...process.env, PORT: String(PORT), SYNC_DB: join(dir, 'e2e.sqlite'), SYNC_SECRET: randomBytes(16).toString('hex') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => { log += d; });
server.stderr.on('data', (d) => { log += d; });
const stop = () => { server.kill(); rmSync(dir, { recursive: true, force: true }); };

const step = (s) => console.log(`• ${s}`);
async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(BASE + '/')).ok) return; } catch { /* starter */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Serveren startet ikke:\n' + log);
}

const browser = await chromium.launch();
let failed = false;
try {
  await waitForServer();
  const ctxA = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const T = { timeout: 25_000 };

  step('Enhet A lager ukeplan og oppretter husstand');
  await A.goto(BASE);
  await A.getByRole('button', { name: 'Lag ukeplan ›' }).click();
  await A.getByRole('button', { name: /Husstand og deling/ }).click();
  await A.getByRole('button', { name: /Opprett husstand/ }).click();
  await A.getByRole('button', { name: /Lag invitasjon/ }).click();
  const code = (await A.locator('.code').textContent()).trim();
  step(`Invitasjonskode laget (${code.length} tegn)`);

  step('Enhet B åpner invitasjonslenken og blir med');
  await B.goto(`${BASE}/#bli-med=${code}`);
  await B.getByRole('button', { name: 'Bli med', exact: true }).click();
  await B.getByText('Medlemmer').waitFor(T);
  await B.getByText('Voksen 1').first().waitFor(T);

  const boxes = (p) => p.locator('ul.list input[type=checkbox]');
  await A.getByRole('tab', { name: 'Handleliste' }).click();
  await B.getByRole('tab', { name: 'Handleliste' }).click();
  await boxes(B).first().waitFor(T); // B har fått husstandens plan
  const names = await boxes(A).evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute('aria-label')));
  const box = (p, i) => p.getByLabel(names[i], { exact: true });

  step(`A krysser av «${names[0]}»; B skal se det med A sin etikett`);
  await box(A, 0).check();
  await B.waitForFunction((n) => document.querySelector(`input[aria-label="${n}"]`)?.checked === true, names[0], T);
  await B.getByText('Avkrysset av Voksen 1').first().waitFor(T);

  step('B går uten nett og krysser av en linje; A krysser av en annen samtidig');
  await ctxB.setOffline(true);
  await box(B, 1).check();
  await B.getByText(/Venter på nett/).first().waitFor(T);
  await box(A, 2).check();
  await A.waitForTimeout(1500);
  if (await box(A, 1).isChecked()) throw new Error('A så B sin frakoblede endring før B var på nett');

  step('B kommer på nett igjen: begge endringene skal finnes på begge enheter');
  await ctxB.setOffline(false);
  for (const p of [A, B]) {
    for (const i of [0, 1, 2]) await p.waitForFunction((n) => document.querySelector(`input[aria-label="${n}"]`)?.checked === true, names[i], T);
  }
  await A.getByText('Avkrysset av Voksen 2').first().waitFor(T);
  await B.getByText(/Synket med husstanden/).first().waitFor(T);
  const outbox = await B.evaluate(() => { const s = JSON.parse(localStorage.getItem('middag-state-v1')); return s.outbox.length + s.listOutbox.length; });
  if (outbox !== 0) throw new Error(`B har fortsatt ${outbox} hendelser i utboksen`);
  const counts = await A.evaluate(() => JSON.parse(localStorage.getItem('middag-state-v1')).list.length);
  step(`OK: ${counts} listehendelser hos A, tom utboks hos B`);
  if (process.env.E2E_SCREENSHOT_DIR) {
    await A.screenshot({ path: join(process.env.E2E_SCREENSHOT_DIR, 'enhet-a.png') });
    await B.screenshot({ path: join(process.env.E2E_SCREENSHOT_DIR, 'enhet-b.png') });
    await B.getByRole('button', { name: /Husstand og deling/ }).click();
    await B.getByText('Medlemmer').waitFor(T);
    await B.screenshot({ path: join(process.env.E2E_SCREENSHOT_DIR, 'husstand-b.png'), fullPage: true });
  }
} catch (e) {
  failed = true;
  console.error('FEIL:', e.message);
} finally {
  await browser.close();
  stop();
}
console.log(failed ? 'E2E synk: FEILET' : 'E2E synk: bestått');
process.exit(failed ? 1 : 0);
