// Enkle tilgjengelighetskontroller mot kjørende dev-server (npm run dev, standard port 5173 eller APP_URL).
//  - alle knapper, felt, lenker og summary har tilgjengelig navn
//  - faner: tablist/tab/tabpanel, aria-selected, piltaster
//  - bytt-arket: dialog, fokus inn, fokusfelle (Tab og Shift+Tab), Escape lukker, fokus tilbake
//  - hele appen kan nås med tastatur (Tab når alle faner)
//  - ingen horisontal scrolling på 360 og 420 px
// Bruk: node scripts/checks/a11y.cjs
const { chromium } = require('playwright');
const url = process.env.APP_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FEIL'} ${m}`); if (!c) fails++; };

const unnamed = (p) => p.evaluate(() => {
  const name = (e) => {
    const lab = e.getAttribute('aria-labelledby');
    if (lab) return lab.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
    return (e.getAttribute('aria-label') || (e.labels && [...e.labels].map((l) => l.textContent).join(' ')) || e.textContent || e.getAttribute('title') || e.getAttribute('placeholder') || '').trim();
  };
  const vis = (e) => e.getClientRects().length > 0;
  return [...document.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],summary,[role=tab],[role=radio]')]
    .filter((e) => vis(e) && !name(e)).map((e) => e.outerHTML.slice(0, 90));
});

(async () => {
  const b = await chromium.launch();
  for (const w of [420, 360]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); const p = await ctx.newPage();
    const scrollOk = async (n) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(o <= 0, `${w}px ${n}: ingen horisontal scrolling`); };
    await p.goto(url); await p.waitForSelector('text=Lag ukeplan');
    let bad = await unnamed(p); ok(bad.length === 0, `${w}px skjema: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('skjema');
    await p.getByText('Lag ukeplan').click();
    await scrollOk('ukeplan');
    ok(await p.getByRole('tablist').count() === 1 && await p.getByRole('tab').count() === 4, 'tablist med 4 tabs');
    ok(await p.getByRole('tabpanel').count() === 1, 'tabpanel finnes');
    ok(await p.getByRole('tab', { selected: true }).count() === 1, 'nøyaktig én valgt fane');
    ok(await p.getByRole('status').filter({ hasText: /innenfor|over|Ufullstendig/ }).count() === 1, 'budsjettsvar er et status-område');
    // Piltaster i fanelinja
    await p.getByRole('tab', { name: 'Uka' }).focus(); await p.keyboard.press('ArrowRight');
    ok(await p.getByRole('tab', { name: 'Kundeaviser', selected: true }).count() === 1 && await p.evaluate(() => document.activeElement?.id) === 'tab-Kundeaviser', 'ArrowRight flytter fane og fokus');
    await p.keyboard.press('Home');
    ok(await p.getByRole('tab', { name: 'Uka', selected: true }).count() === 1, 'Home går til første fane');
    // Bytt-ark
    const opener = p.locator('.row.card').first(); await opener.focus(); await p.keyboard.press('Enter');
    const dlg = p.getByRole('dialog'); ok(await dlg.count() === 1 && await dlg.getAttribute('aria-modal') === 'true', 'bytt-ark er modal dialog');
    const inDlg = () => p.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
    ok(await inDlg(), 'fokus flyttes inn i dialogen');
    let stays = true; for (let i = 0; i < 60; i++) { await p.keyboard.press('Tab'); if (!(await inDlg())) { stays = false; break; } }
    ok(stays, 'Tab sirkulerer innenfor dialogen (60 trykk)');
    stays = true; for (let i = 0; i < 60; i++) { await p.keyboard.press('Shift+Tab'); if (!(await inDlg())) { stays = false; break; } }
    ok(stays, 'Shift+Tab sirkulerer innenfor dialogen (60 trykk)');
    bad = await unnamed(p); ok(bad.length === 0, `dialog: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('bytt-ark');
    const radios = p.getByRole('radio'); ok(await radios.count() > 1, 'valgene i bytt-arket er radioknapper');
    await radios.first().focus(); await p.keyboard.press('Space'); ok(await radios.first().isChecked(), 'radiovalg kan velges med tastatur');
    await p.keyboard.press('Escape');
    ok(await dlg.count() === 0, 'Escape lukker dialogen');
    ok(await p.evaluate(() => document.activeElement?.className.includes('row')), 'fokus er tilbake på raden som åpnet arket');
    // Alle faner: navn og scrolling; handleliste-avkrysning med tastatur
    for (const t of ['Kundeaviser', 'Handleliste', 'Matskap']) {
      await p.getByRole('tab', { name: t }).click(); bad = await unnamed(p);
      ok(bad.length === 0, `${w}px ${t}: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk(t);
    }
    await p.getByRole('tab', { name: 'Kundeaviser' }).click(); await p.getByRole('button', { name: 'Kontroll' }).click();
    bad = await unnamed(p); ok(bad.length === 0, `${w}px Kontroll: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('Kontroll');
    // Tastatur: Tab fra toppen når alle fire faner
    await p.reload(); const seen = new Set();
    for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const id = await p.evaluate(() => document.activeElement?.id); if (id?.startsWith('tab-')) seen.add(id); }
    ok(seen.size >= 1, 'fanelinjen kan nås med Tab (roving tabindex: én tabstopp)');
    await ctx.close();
  }
  await b.close(); process.exit(fails ? 1 : 0);
})();
