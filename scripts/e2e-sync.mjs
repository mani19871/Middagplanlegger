// Ende-til-ende: to nettleserkontekster («to enheter») i samme husstand mot en ekte server.
// Viser at en avkrysning vises hos den andre, og at en endring gjort uten nett flettes riktig ved gjenoppkobling.
// Deretter: godkjent liste deles, en erstatning («utsolgt») vises hos begge med samme sum i handlelista og ukeplanen,
// og ulike «fant ikke»-valg på samme vare (én enhet uten nett) blir en synlig konflikt som én voksen løser.
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
  for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', (e) => console.error(`[${n}] sidefeil: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') console.error(`[${n}] konsoll: ${m.text()}`); }); }

  step('Enhet A lager ukeplan og oppretter husstand');
  await A.goto(BASE);
  await A.getByRole('button', { name: 'Lag ukeplan ›' }).click();
  await A.getByRole('button', { name: /Husstand og deling/ }).click();
  await A.getByRole('button', { name: /Opprett husstand/ }).click();
  await A.getByRole('button', { name: /Lag invitasjon/ }).click();
  const code = (await A.locator('.code [aria-hidden]').textContent()).trim();
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
  // Etiketten endres når linja er avkrysset («Løk, avkrysset av deg …»), så vi finner boksen på varenavnet.
  const names = await boxes(A).evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute('aria-label').replace(/^Kryss av /, '')));
  const sel = (n) => `ul.list input[type=checkbox][aria-label="Kryss av ${n}"], ul.list input[type=checkbox][aria-label^="${n}, avkrysset"]`;
  const box = (p, i) => p.locator(sel(names[i]));
  const checkedOn = (p, i) => p.waitForFunction((q) => document.querySelector(q)?.checked === true, sel(names[i]), T);

  step(`A krysser av «${names[0]}»; B skal se det med A sin etikett`);
  await box(A, 0).check();
  await checkedOn(B, 0);
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
    for (const i of [0, 1, 2]) await checkedOn(p, i);
  }
  await A.getByText('Avkrysset av Voksen 2').first().waitFor(T);
  await B.getByText(/Synket med husstanden/).first().waitFor(T);
  const outbox = await B.evaluate(() => { const s = JSON.parse(localStorage.getItem('middag-state-v1')); return s.outbox.length + s.listOutbox.length; });
  if (outbox !== 0) throw new Error(`B har fortsatt ${outbox} hendelser i utboksen`);
  const counts = await A.evaluate(() => JSON.parse(localStorage.getItem('middag-state-v1')).list.length);
  step(`OK: ${counts} listehendelser hos A, tom utboks hos B`);

  // ---------- Godkjent liste, erstatning og konflikt ----------
  const state = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('middag-state-v1')));
  const total = async (p) => (await p.locator('.totalpill strong').textContent()).trim();
  const historyButton = (p, n) => p.getByRole('button', { name: `🕘 Endringer i listen (${n})` });

  step('A godkjenner lista; B skal få samme godkjente versjon');
  await A.getByRole('tab', { name: 'Uka' }).click();
  await A.getByRole('button', { name: /Godkjenn og velg handletur/ }).click();
  await A.getByRole('button', { name: /^Velg (én|to) butikk/ }).click();
  await historyButton(A, 1).waitFor(T);
  await historyButton(B, 1).waitFor(T);
  const vA = (await state(A)).planHistory.map((v) => v.id);
  const vB = (await state(B)).planHistory.map((v) => v.id);
  if (JSON.stringify(vA) !== JSON.stringify(vB)) throw new Error(`Ulike planversjoner: ${vA} / ${vB}`);
  if (!(await state(B)).approved) throw new Error('B ser ikke lista som godkjent');

  step('A melder en vare utsolgt og velger en erstatning');
  let replaced = null;
  for (const btn of await A.locator('button.oos').all()) {
    const label = (await btn.getAttribute('aria-label')).replace('Utsolgt eller fant ikke: ', '');
    await btn.click();
    const dialog = A.getByRole('dialog');
    const option = dialog.locator('button.choice', { hasText: 'på handelen' }).first();
    if (await option.count()) { await option.click(); replaced = label; break; }
    await dialog.getByRole('button', { name: 'Lukk' }).click();
  }
  if (!replaced) throw new Error('Fant ingen vare med en godkjent erstatning i demodataene');
  await A.getByText(/↺ Erstatter/).first().waitFor(T);
  await B.getByText(/↺ Erstatter/).first().waitFor(T);
  await historyButton(B, 2).waitFor(T);
  const tA = await total(A);
  await B.waitForFunction((t) => document.querySelector('.totalpill strong')?.textContent?.trim() === t, tA, T);
  step(`«${replaced}» erstattet; begge viser ${tA} og «Erstatter» på linja`);

  step('B ser samme sum i ukeplanen og på handletur-kortet, merket med erstatningen');
  await B.getByRole('tab', { name: 'Uka' }).click();
  await B.getByText(/Summen er med valgene fra handlelista: 1 erstatning/).first().waitFor(T);
  const weekTotal = (await B.locator('.card.total .tcol strong').first().textContent()).trim();
  if (weekTotal !== tA) throw new Error(`Ukeplanen viser ${weekTotal}, handlelista ${tA}`);
  const option = (await state(B)).option;
  await B.getByRole('button', { name: 'Se ukeplan ›' }).click();
  await B.getByRole('button', { name: /Velg handletur på nytt/ }).click();
  // Knappen foreslår anbefalt tur; velg den B allerede har, så resten av testen gjelder samme liste.
  await B.locator('[role=radio]').nth(option === 'combo' ? 1 : 0).click();
  const card = (await B.locator('[role=radio][aria-checked=true] .amt').textContent()).trim();
  if (card !== tA) throw new Error(`Handletur-kortet viser ${card}, handlelista ${tA}`);
  await B.getByText(/Summen er med valgene fra handlelista: 1 erstatning/).first().waitFor(T);
  await B.getByRole('button', { name: 'Tilbake' }).click();
  await B.getByRole('tab', { name: 'Handleliste' }).click();

  step('Ulike valg på samme vare: B uten nett velger «fant ikke», A velger «hopp over»');
  const other = A.locator('button.oos').filter({ hasNotText: replaced }).last();
  const target = (await other.getAttribute('aria-label')).replace('Utsolgt eller fant ikke: ', '');
  await ctxB.setOffline(true);
  await B.getByRole('button', { name: `Utsolgt eller fant ikke: ${target}` }).click();
  await B.getByRole('dialog').getByRole('button', { name: /Fant ikke – avklar senere/ }).click();
  await other.click();
  await A.getByRole('dialog').getByRole('button', { name: /Hopp over varen/ }).click();
  await A.waitForTimeout(1500);
  await ctxB.setOffline(false);
  for (const p of [A, B]) await p.getByText(/Ulike valg fra to enheter/).first().waitFor(T);
  step('Konflikten vises hos begge; A velger «hopp over»');
  await A.getByRole('button', { name: `Utsolgt eller fant ikke: ${target}` }).click();
  await A.getByRole('dialog').locator('button.choice', { hasText: 'Valgt av' }).filter({ hasText: 'Hopp over varen' }).click();
  for (const p of [A, B]) {
    await p.waitForFunction(() => !document.body.textContent.includes('Ulike valg fra to enheter'), null, T);
    await p.getByText('Ikke med i handelen').waitFor(T);
  }
  await B.getByText(/Synket med husstanden/).first().waitFor(T);
  const [sA, sB] = [await state(A), await state(B)];
  if (sA.listChanges.length !== sB.listChanges.length || (sB.changeOutbox ?? []).length || (sB.versionOutbox ?? []).length) throw new Error('Endringslogg eller utboks er ikke lik på begge');
  if (await total(A) !== await total(B)) throw new Error(`Ulik sum etter konflikten: ${await total(A)} / ${await total(B)}`);
  step(`OK: ${sA.planHistory.length} planversjoner og ${sA.listChanges.length} valg likt på begge, sum ${await total(B)}`);
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
