// Sjekker at appen virker bak den ekte serveren med streng CSP og sikkerhetshoder (server/app.ts, docs/sikkerhet.md):
// ingen CSP-brudd eller konsollfeil når alle faner åpnes, en husstand opprettes og service workeren registreres.
// Bruk: npm run build && node scripts/checks/csp.cjs   (starter server/index.ts på port 4180 med minnedatabase)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const PORT = 4180;
const URL_ = `http://127.0.0.1:${PORT}/`;
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FEIL'} ${m}`); if (!c) fails++; };
(async () => {
  // Direkte med node (ikke npx), så kill() stopper selve serveren og porten blir ledig.
  const srv = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { stdio: 'ignore', env: { ...process.env, PORT: String(PORT), SYNC_DB: ':memory:', SYNC_SECRET: 'csp-sjekk' } });
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(URL_)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
    const head = await fetch(URL_);
    const csp = head.headers.get('content-security-policy') || '';
    ok(/script-src 'self'/.test(csp) && !/unsafe-inline|unsafe-eval/.test(csp), `CSP uten unsafe-*: ${csp.slice(0, 60)}…`);
    ok(head.headers.get('x-frame-options') === 'DENY' && head.headers.get('x-content-type-options') === 'nosniff', 'X-Frame-Options og nosniff');
    const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
    const problems = [];
    p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Trusted Type/i.test(m.text())) problems.push(`${m.type()}: ${m.text()}`); });
    p.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    await p.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP-brudd: ${e.violatedDirective} ${e.blockedURI}`)));
    await p.goto(URL_);
    await p.waitForSelector('#root *');
    for (const name of ['Kundeaviser', 'Handleliste', 'Matskap', 'Uka']) {
      await p.getByRole('tab', { name }).click(); await p.waitForTimeout(250);
    }
    ok((await p.locator('#root').innerText()).length > 50, 'appen rendres');
    // Husstand: opprett (synk-API under CSP connect-src 'self').
    const chip = p.getByRole('button', { name: /Husstand og deling/ });
    if (await chip.count()) {
      await chip.first().click();
      await p.getByRole('button', { name: /Opprett husstand/ }).click();
      await p.getByText(/Synket|Synker|Inviter/).first().waitFor({ timeout: 10_000 }).catch(() => {});
      ok(await p.evaluate(() => !!JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => localStorage.getItem(k).includes('"sync"')) || 'null') || 'null')?.sync), 'husstand opprettet og synket');
    } else ok(false, 'fant ikke knappen «Husstand og deling»');
    const sw = await p.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 8000))]));
    ok(sw, 'service worker registrert');
    await p.reload(); await p.waitForSelector('#root *'); await p.waitForTimeout(500);
    ok(problems.length === 0, `ingen CSP-brudd eller konsollfeil${problems.length ? `: ${problems.join(' | ')}` : ''}`);
    await b.close();
  } finally { srv.kill(); }
  process.exit(fails ? 1 : 0);
})();
