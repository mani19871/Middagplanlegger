// Sjekker PWA: manifest med ikoner, service worker cacher skallet, appen åpner frakoblet og /api/ caches ikke.
// Bruk: npm run build && node scripts/checks/pwa.cjs   (bygger ikke selv; starter vite preview på port 4179)
// Med BUILT_SERVER=1 (etter npm run build:server) kjøres i stedet den bygde serveren: node dist-server/index.mjs på port 4179.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const URL_ = 'http://localhost:4179/';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FEIL'} ${m}`); if (!c) fails++; };
(async () => {
  const srv = process.env.BUILT_SERVER === '1'
    ? spawn(process.execPath, ['dist-server/index.mjs'], { stdio: 'ignore', env: { ...process.env, PORT: '4179', SYNC_DB: ':memory:', SYNC_SECRET: 'pwa-sjekk', OFFER_DB: ':memory:', TJEK_FETCH: '0' } })
    : spawn('npx', ['vite', 'preview', '--port', '4179', '--strictPort'], { stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(URL_)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
    const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
    const man = await (await fetch(URL_ + 'manifest.webmanifest')).json();
    ok(man.icons.some((i) => i.sizes === '192x192') && man.icons.some((i) => i.sizes === '512x512') && man.icons.some((i) => i.purpose === 'maskable'), 'manifest har 192, 512 og maskable-ikoner');
    for (const i of man.icons) { const r = await fetch(new URL(i.src, URL_)); ok(r.ok && r.headers.get('content-type') === 'image/png', `ikon ${i.src} lastes som PNG`); }
    await p.goto(URL_); await p.waitForFunction(() => navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller || true));
    await p.reload(); await p.waitForFunction(() => !!navigator.serviceWorker.controller);
    const cached = await p.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).map((r) => new URL(r.url).pathname));
    ok(cached.includes('/') && cached.some((u) => u.startsWith('/assets/') && u.endsWith('.js')) && cached.some((u) => u.endsWith('.css')), `skall cachet (${cached.length} filer, inkl. JS og CSS)`);
    await p.evaluate(() => fetch('/api/offers').catch(() => {}));
    const after = await p.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).map((r) => new URL(r.url).pathname));
    ok(!after.some((u) => u.startsWith('/api/')), '/api/ (tilbudsdata) lagres ikke i cache');
    await ctx.setOffline(true);
    const p2 = await ctx.newPage(); await p2.goto(URL_);
    ok(await p2.getByRole('heading', { name: /Denne uka|Familien|Ukeplan|plan/i }).first().isVisible().catch(() => false) || (await p2.locator('#root').innerText()).length > 50, 'appen åpner frakoblet');
    ok(await p2.getByRole('tab', { name: 'Handleliste' }).isVisible(), 'faner vises frakoblet');
    await b.close();
  } finally { srv.kill(); }
  process.exit(fails ? 1 : 0);
})();
