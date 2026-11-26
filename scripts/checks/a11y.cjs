// Enkle tilgjengelighetskontroller mot kjørende dev-server (npm run dev, standard port 5173 eller APP_URL).
//  - alle knapper, felt, lenker og summary har tilgjengelig navn
//  - faner: tablist/tab/tabpanel, aria-selected, piltaster
//  - bytt-arket: dialog, fokus inn, fokusfelle (Tab og Shift+Tab), Escape lukker, fokus tilbake
//  - hele appen kan nås med tastatur (Tab når alle faner)
//  - ingen horisontal scrolling på 360 og 420 px
//  - Matskap → Lag nå og Basisvarer (forslag i handlelista én gang), handleliste (også handlemodus), Husstand og Kontroll: navn, 44 px trykkflater i handlemodus, dialog for «Slett», ingen overflyt
//  - Kundeaviser → Husholdning (utvidelse C): uten kjede, med kjede, navn, 44 px, varegrupper med tastatur, «Legg på lista» én gang, «Andre varer» i handlelista
//    Tilbudene her er oppdiktede testdata som bare finnes i denne sjekken (ruting i Playwright), aldri i appen.
//  - fokus (V16): etter handlinger som fjerner eller deaktiverer knappen havner fokus aldri på <body> (Åpne «Lag nå», Legg manglende,
//    Åpne handlelista, godkjenn basisvare, Legg på lista, siste avisside, ← Tilbake fra en avis)
//  - «Lag nå» (V17): ugyldig mengde gir en melding i et status-område
//  - introduksjon (pilot): vises første gang som navngitt område (ikke modal), steg med tastatur og fokus på stegets overskrift,
//    44 px, «Hopp over» lukker og den kommer ikke igjen etter omlasting; Hjelp nederst → Husstand, «Gi tilbakemelding» er en
//    mailto-lenke uten enhets-id, kopier adressen gir en melding, «Vis introduksjonen igjen» og «Ferdig» gir fokus tilbake
// Bruk: node scripts/checks/a11y.cjs
const { chromium } = require('playwright');
const url = process.env.APP_URL || 'http://localhost:5173/';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FEIL'} ${m}`); if (!c) fails++; };
// V16: fokus etter neste bilde (appen flytter det i requestAnimationFrame). Gir beskrivelse av aktivt element.
const focused = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const a = document.activeElement; r(!a || a === document.body ? 'body' : `${a.tagName.toLowerCase()}:${(a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40)}`);
}))));

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
    // Oppdiktede husholdningstilbud (testdata, bare i denne sjekken): gyldige fra i dag i seks dager.
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const fake = (id, heading, dealerName, priceOre) => ({ id, source: 'tjek', heading, description: null, priceOre, prePriceOre: null, amount: null, unit: null, pieces: null,
      dealerId: 'd', dealerName, validFrom: day(-1), validUntil: day(8), observed: new Date().toISOString(), image: null });
    await p.route('**/api/offers/lagret', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', error: null, source: 'tjek', stored: true,
      observed: new Date().toISOString(), oldestObserved: null, offers: [], truncated: false,
      other: [fake('t1', 'Testtilbud Toalettpapir 8 rull med et ganske langt navn', 'Kiwi', 8990), fake('t2', 'Testtilbud Oppvaskmiddel', 'REMA 1000', 2990), fake('t3', 'Testtilbud bleier', 'Kiwi', 9990)] }) }));
    // Oppdiktede kundeaviser (testdata, bare i denne sjekken) for fokus i avisleseren. Sidene har ingen bildeadresse.
    const cat = { id: 'testavis', source: 'tjek', dealerId: 'd', dealerName: 'Testkjede', label: 'Testavis', validFrom: day(-1), validUntil: day(6), pageCount: 2, observed: new Date().toISOString() };
    await p.route('**/api/aviser', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', error: null, source: 'tjek', observed: new Date().toISOString(), imagesAllowed: true, catalogs: [cat] }) }));
    await p.route('**/api/aviser/testavis/sider', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', error: null, source: 'tjek', observed: new Date().toISOString(), imagesAllowed: true, catalog: cat,
      pages: [1, 2].map((number) => ({ number, thumb: null, view: null, zoom: null })) }) }));
    const scrollOk = async (n) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(o <= 0, `${w}px ${n}: ingen horisontal scrolling`); };
    await p.goto(url); await p.waitForSelector('text=Lag ukeplan');
    let bad = await unnamed(p); ok(bad.length === 0, `${w}px skjema: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('skjema');
    // Introduksjon (pilot): første gang på enheten, ikke modal, kan brukes med tastatur, hoppes over og åpnes igjen fra Hjelp.
    const intro = p.getByRole('region', { name: 'Introduksjon til Husvett' });
    ok(await intro.count() === 1, `${w}px introduksjon: vises første gang på enheten`);
    ok(await p.getByRole('dialog').count() === 0 && await p.getByRole('tablist').count() === 1, 'introduksjon: ikke en modal, fanene er der');
    ok(await intro.getByText('Steg 1 av 5').count() === 1, 'introduksjon: «Steg 1 av 5» som tekst');
    await scrollOk('introduksjon');
    const smallI = await p.evaluate(() => [...document.querySelectorAll('.intro button')].filter((e) => e.getClientRects().length).map((e) => ({ c: e.textContent, h: e.getBoundingClientRect().height })).filter((r) => r.h < 43.5));
    ok(smallI.length === 0, `${w}px introduksjon: trykkflater minst 44 px høye ${JSON.stringify(smallI.slice(0, 3))}`);
    await intro.getByRole('button', { name: /Neste/ }).focus(); await p.keyboard.press('Enter');
    let f0 = await focused(p); ok(f0 === 'h2:En pilot med demodata', `introduksjon: «Neste» gir fokus på stegets overskrift (${f0})`);
    ok(await intro.getByText('Steg 2 av 5').count() === 1 && await intro.getByText(/DEMODATA/).count() === 1, 'introduksjon: steg 2 sier DEMODATA');
    await intro.getByRole('button', { name: /Forrige/ }).focus(); await p.keyboard.press('Enter');
    f0 = await focused(p); ok(f0 === 'h2:Velkommen til Husvett', `introduksjon: «Forrige» gir fokus på overskriften (${f0})`);
    bad = await unnamed(p); ok(bad.length === 0, `${w}px introduksjon: alle kontroller har navn ${bad.join(' | ')}`);
    await intro.getByRole('button', { name: 'Hopp over introduksjonen' }).focus(); await p.keyboard.press('Enter');
    ok(await intro.count() === 0, 'introduksjon: «Hopp over» lukker');
    f0 = await focused(p); ok(f0.startsWith('main:'), `introduksjon: etter «Hopp over» er fokus i innholdet, ikke på body (${f0.slice(0, 20)})`);
    await p.reload(); await p.waitForSelector('text=Lag ukeplan');
    ok(await intro.count() === 0, 'introduksjon: vises ikke igjen etter omlasting');
    await p.getByRole('button', { name: 'Hjelp', exact: true }).focus(); await p.keyboard.press('Enter');
    f0 = await focused(p); ok(f0 === 'h3:Hjelp og tilbakemelding', `Hjelp nederst: Husstand åpnes med fokus på «Hjelp og tilbakemelding» (${f0})`);
    const mail = p.getByRole('link', { name: /Gi tilbakemelding/ });
    const href = (await mail.getAttribute('href')) ?? '';
    const devId = await p.evaluate(() => localStorage.getItem('middag-enhet') ?? 'enhet-');
    ok(href.startsWith('mailto:kontakt@husvett.no?subject=') && !href.includes(devId) && !decodeURIComponent(href).includes('enhet-'), 'Gi tilbakemelding: mailto med emne, uten enhets-id');
    ok(await p.getByText('kontakt@husvett.no', { exact: true }).count() === 1, 'Gi tilbakemelding: adressen står som tekst');
    await p.getByRole('button', { name: /Kopier adressen/ }).click();
    ok(await p.getByRole('status').filter({ hasText: /Adressen er kopiert|Kopiering ble blokkert/ }).waitFor({ timeout: 4000 }).then(() => true, () => false), 'Kopier adressen: melding i et status-område');
    bad = await unnamed(p); ok(bad.length === 0, `${w}px Husstand med Hjelp: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('Husstand med Hjelp');
    await p.getByRole('button', { name: 'Vis introduksjonen igjen' }).focus(); await p.keyboard.press('Enter');
    f0 = await focused(p); ok(f0 === 'h2:Velkommen til Husvett', `«Vis introduksjonen igjen»: fokus på første steg (${f0})`);
    for (let i = 0; i < 4; i++) { await intro.getByRole('button', { name: /Neste/ }).focus(); await p.keyboard.press('Enter'); }
    ok(await intro.getByText('Steg 5 av 5').count() === 1 && await intro.getByRole('button', { name: /Neste/ }).count() === 0, 'introduksjon: siste steg har «Ferdig», ikke «Neste»');
    await intro.getByRole('button', { name: 'Ferdig' }).focus(); await p.keyboard.press('Enter');
    f0 = await focused(p); ok(await intro.count() === 0 && f0 === 'button:Vis introduksjonen igjen', `«Ferdig» lukker, fokus tilbake på knappen som åpnet (${f0})`);
    await p.getByRole('tab', { name: 'Uka' }).click(); await p.waitForSelector('text=Lag ukeplan');
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
    // Matskap → Lag nå: navn, overflyt, tom tilstand som status, avkrysning og «bruk snart» med tastatur, 44 px trykkflater
    await p.getByRole('tab', { name: 'Matskap' }).click();
    await p.getByRole('button', { name: 'Matskapet', exact: false }).first().click();
    await p.getByRole('button', { name: /Åpne «Lag nå»/ }).focus(); await p.keyboard.press('Enter');
    let f = await focused(p); ok(f === 'h1:Lag nå', `V16 «Åpne «Lag nå»»: fokus på overskriften (${f})`);
    ok(await p.getByRole('heading', { level: 1, name: 'Lag nå' }).count() === 1, `${w}px Lag nå: overskrift`);
    ok(await p.getByRole('button', { name: /Lag nå/, pressed: true }).count() === 1, 'Lag nå-valget har aria-pressed');
    bad = await unnamed(p); ok(bad.length === 0, `${w}px Lag nå (tom): alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('Lag nå (tom)');
    ok(await p.getByRole('status').filter({ hasText: 'Ingen varer er krysset av' }).count() === 1, 'Lag nå: tom tilstand er et status-område');
    await p.getByRole('combobox', { name: 'Legg til vare' }).selectOption({ label: 'Egg' });
    await p.getByRole('spinbutton', { name: /^Mengde i stykk/ }).fill('-3');
    await p.getByRole('button', { name: '＋ Legg til' }).click();
    ok(await p.getByRole('status').filter({ hasText: 'Mengden er ikke lagt til' }).count() === 1, 'V17 Lag nå: ugyldig mengde gir melding i et status-område');
    ok(await p.getByRole('checkbox', { name: 'Egg' }).count() === 0, 'V17 Lag nå: ugyldig mengde legges ikke til');
    await p.getByRole('spinbutton', { name: /^Mengde i stykk/ }).fill('8');
    await p.getByRole('button', { name: '＋ Legg til' }).click();
    await p.getByRole('combobox', { name: 'Legg til vare' }).selectOption({ label: 'Ost' });
    await p.getByRole('button', { name: '＋ Legg til' }).click();
    const soonBtn = p.getByRole('button', { name: 'Egg må brukes snart' }); await soonBtn.focus(); await p.keyboard.press('Enter');
    ok(await soonBtn.getAttribute('aria-pressed') === 'true', 'Lag nå: «bruk snart» kan slås på med tastatur (aria-pressed)');
    ok(await p.getByRole('article').count() > 0, 'Lag nå: forslag vises som artikler med overskrift');
    ok(await p.getByRole('checkbox', { name: 'Egg' }).isChecked(), 'Lag nå: avkrysningsboks har varenavn');
    bad = await unnamed(p); ok(bad.length === 0, `${w}px Lag nå (forslag): alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('Lag nå (forslag)');
    const smallLn = await p.evaluate(() => [...document.querySelectorAll('.haverow input[type=checkbox], .haveopts .pill.pick, .cooksugg .ghost')].filter((e) => e.getClientRects().length).map((e) => { const el = e.closest('label') ?? e; const r = el.getBoundingClientRect(); return { c: e.className || e.tagName, h: r.height }; }).filter((r) => r.h < 43.5));
    ok(smallLn.length === 0, `${w}px Lag nå: trykkflater minst 44 px høye ${JSON.stringify(smallLn.slice(0, 3))}`);
    const addBtn = p.getByRole('button', { name: /^Legg manglende for / }).first();
    if (await addBtn.count()) {
      await addBtn.focus(); await p.keyboard.press('Enter'); ok(await addBtn.isDisabled(), 'Lag nå: «Legg manglende på handlelista» kan ikke legge samme varer inn to ganger');
      f = await focused(p); ok(f.startsWith('p:Lagt i handlelista'), `V16 «Legg manglende»: fokus på bekreftelsen (${f})`);
    } else ok(false, 'Lag nå: fant ingen «Legg manglende»-knapp å sjekke fokus på');
    await p.getByRole('button', { name: 'Nullstill valgene her' }).click();
    // Matskap → Basisvarer: navn, overflyt, tom tilstand, legg til, «Tom» med tastatur (aria-pressed), 44 px, forslag i handlelista én gang
    await p.getByRole('button', { name: /Basisvarer/ }).first().click();
    ok(await p.getByRole('heading', { level: 1, name: 'Basisvarer' }).count() === 1, `${w}px Basisvarer: overskrift`);
    ok(await p.getByRole('button', { name: /Basisvarer/, pressed: true }).count() === 1, 'Basisvarer-valget har aria-pressed');
    bad = await unnamed(p); ok(bad.length === 0, `${w}px Basisvarer (tom): alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('Basisvarer (tom)');
    await p.getByRole('combobox', { name: 'Velg basisvare' }).selectOption({ label: 'Kaffe' });
    await p.getByRole('button', { name: '＋ Legg til', exact: true }).click();
    await p.getByRole('combobox', { name: 'Velg basisvare' }).selectOption({ label: 'Ris' });
    await p.getByRole('spinbutton', { name: /^Minstemengde i g/ }).fill('500');
    await p.getByRole('button', { name: '＋ Legg til', exact: true }).click();
    await p.getByRole('textbox', { name: /Egen vare/ }).fill('Knekkebrød');
    await p.getByRole('button', { name: /Legg til egen vare/ }).click();
    ok(await p.getByRole('button', { name: 'Fjern basisvare Knekkebrød' }).count() === 1, 'Basisvarer: egen vare lagt til');
    const tomBtn = p.getByRole('button', { name: 'Kaffe: tom' }); await tomBtn.focus(); await p.keyboard.press('Enter');
    ok(await tomBtn.getAttribute('aria-pressed') === 'true', 'Basisvarer: «Tom» kan velges med tastatur (aria-pressed)');
    ok(await p.getByRole('status').filter({ hasText: 'forslag venter i handlelista' }).count() === 1, 'Basisvarer: forslag meldes i et status-område');
    bad = await unnamed(p); ok(bad.length === 0, `${w}px Basisvarer (med varer): alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('Basisvarer (med varer)');
    const smallSt = await p.evaluate(() => [...document.querySelectorAll('.haveopts .pill.pick, .stapletop .x')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { c: e.className || e.tagName, h: r.height }; }).filter((r) => r.h < 43.5));
    ok(smallSt.length === 0, `${w}px Basisvarer: trykkflater minst 44 px høye ${JSON.stringify(smallSt.slice(0, 3))}`);
    await p.getByRole('button', { name: 'Åpne handlelista' }).focus(); await p.keyboard.press('Enter');
    f = await focused(p); ok(f === 'h1:Handleliste', `V16 «Åpne handlelista»: fokus på overskriften i handlelista (${f})`);
    ok(await p.getByText('Forslag: basisvarer').count() === 1, `${w}px handleliste: forslag om basisvarer vises`);
    const approveBtn = p.getByRole('button', { name: 'Legg Kaffe på handlelista' });
    await approveBtn.focus(); await p.keyboard.press('Enter');
    ok(await approveBtn.count() === 0, 'handleliste: godkjent forslag forsvinner (kan ikke legges inn to ganger)');
    f = await focused(p); ok(f !== 'body', `V16 godkjent basisvareforslag: fokus havner ikke på body (${f})`);
    ok(await p.getByRole('checkbox', { name: 'Kryss av Kaffe' }).count() === 1, 'handleliste: basisvaren ligger én gang på lista med navn');
    bad = await unnamed(p); ok(bad.length === 0, `${w}px handleliste med basisvarer: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('handleliste med basisvarer');
    await p.getByRole('button', { name: 'Fjern Kaffe' }).click();
    await p.getByRole('tab', { name: 'Matskap' }).click();
    for (const n of ['Kaffe', 'Ris', 'Knekkebrød']) await p.getByRole('button', { name: `Fjern basisvare ${n}` }).click();
    await p.getByRole('button', { name: /Matskapet/ }).first().click();
    // Kundeaviser → Husholdning (utvidelse C)
    const openHouse = async () => { await p.getByRole('tab', { name: 'Kundeaviser' }).click(); await p.getByRole('button', { name: 'Husholdning', exact: true }).click(); };
    await openHouse();
    ok(await p.getByText('Ingen kjede valgt').count() === 1, `${w}px Husholdning: uten valgt kjede vises ingen tilbud og appen ber om kjede`);
    ok(await p.getByText(/Testtilbud/).count() === 0, 'Husholdning: ingen tilbud uten kjede');
    await p.evaluate(() => { const k = 'middag-state-v1'; const st = JSON.parse(localStorage.getItem(k)); st.settings.offerChains = ['KIWI']; localStorage.setItem(k, JSON.stringify(st)); });
    await p.reload(); await p.waitForSelector('[role=tablist]'); await openHouse();
    await p.getByRole('heading', { name: /Trenger kontroll/ }).waitFor();
    ok(await p.getByText(/Testtilbud Oppvaskmiddel/).count() === 0 && await p.getByText(/Testtilbud bleier/).count() === 0, 'Husholdning: bare valgt kjede, og aldri sensitive varer');
    bad = await unnamed(p); ok(bad.length === 0, `${w}px Husholdning: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('Husholdning');
    const smallH = await p.evaluate(() => [...document.querySelectorAll('.housecard .ghost.sm, .housegroups label')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { c: e.className || e.tagName, h: r.height }; }).filter((r) => r.h < 43.5));
    ok(smallH.length === 0, `${w}px Husholdning: trykkflater minst 44 px høye ${JSON.stringify(smallH.slice(0, 3))}`);
    const grp = p.getByRole('checkbox', { name: /Kjæledyr/ }); await grp.focus(); await p.keyboard.press('Space');
    ok(!(await grp.isChecked()), 'Husholdning: varegruppe kan slås av med tastatur'); await p.keyboard.press('Space'); ok(await grp.isChecked(), 'Husholdning: og på igjen');
    const addH = p.getByRole('button', { name: 'Legg Toalettpapir fra Kiwi på handlelista' }); await addH.focus(); await p.keyboard.press('Enter');
    ok(await p.getByRole('button', { name: 'Toalettpapir fra Kiwi ligger på handlelista' }).isDisabled(), 'Husholdning: samme tilbud kan ikke legges på lista to ganger');
    f = await focused(p); ok(f.startsWith('p:Toalettpapir'), `V16 «Legg på lista»: fokus på bekreftelsen (${f})`);
    ok(await p.getByRole('status').filter({ hasText: 'er lagt på handlelista' }).count() === 1, 'Husholdning: bekreftelse i et status-område');
    await p.getByRole('tab', { name: 'Handleliste' }).click();
    ok(await p.getByText(/Andre varer, anslått/).count() === 1, `${w}px handleliste: egen sum «Andre varer»`);
    ok(await p.getByRole('checkbox', { name: 'Kryss av Toalettpapir' }).count() === 1, 'handleliste: husholdningsvaren ligger én gang på lista med navn');
    bad = await unnamed(p); ok(bad.length === 0, `${w}px handleliste med andre varer: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('handleliste med andre varer');
    await p.getByRole('button', { name: 'Fjern Toalettpapir' }).click();
    ok(await p.getByText(/Andre varer, anslått/).count() === 0, 'handleliste: «Andre varer» forsvinner når siste vare er fjernet');
    // Kundeaviser → Aviser fra Tjek (oppdiktet testavis): fokus inn i avisen, på siste side og tilbake til avisen man åpnet
    await p.getByRole('tab', { name: 'Kundeaviser' }).click(); await p.getByRole('button', { name: 'Aviser fra Tjek' }).click();
    const cover = p.getByRole('button', { name: /^Testkjede, Testavis/ }); await cover.focus(); await p.keyboard.press('Enter');
    f = await focused(p); ok(f.startsWith('h2:Testkjede'), `V16 åpnet avis: fokus på avisens overskrift (${f})`);
    await p.getByRole('button', { name: 'Neste →' }).focus(); await p.keyboard.press('Enter');
    f = await focused(p); ok(f !== 'body', `V16 «Neste →» til siste side: fokus havner ikke på body (${f})`);
    await p.getByRole('button', { name: 'Tilbake' }).focus(); await p.keyboard.press('Enter');
    f = await focused(p); ok(f.startsWith('button:Testkjede, Testavis'), `V16 «← Tilbake» fra avis: fokus tilbake på avisen (${f})`);
    await p.getByRole('tab', { name: 'Kundeaviser' }).click(); await p.getByRole('button', { name: 'Kontroll' }).click();
    await p.getByRole('button', { name: 'Husholdningstreff', exact: true }).click();
    ok(await p.getByRole('heading', { name: 'Kontroll av husholdningstreff' }).count() === 1, `${w}px Kontroll → Husholdning: overskrift`);
    bad = await unnamed(p); ok(bad.length === 0, `${w}px Kontroll (husholdning): alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('Kontroll (husholdning)');
    await p.getByRole('button', { name: 'Mattreff', exact: true }).click();
    bad = await unnamed(p); ok(bad.length === 0, `${w}px Kontroll: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('Kontroll');
    // Handleliste: avkrysning med tastatur og tilgjengelig navn, handlemodus med 44 px trykkflater
    await p.getByRole('tab', { name: 'Handleliste' }).click();
    const cb = p.getByRole('checkbox').first(); await cb.focus(); const nm0 = await cb.getAttribute('aria-label');
    ok(/^Kryss av .+/.test(nm0 ?? ''), `${w}px avkryssingsboks har varenavn (${nm0})`);
    await p.keyboard.press('Space'); ok(await cb.isChecked(), 'avkrysning med Space');
    ok(/avkrysset av/.test((await cb.getAttribute('aria-label')) ?? ''), 'avkrysset boks navngir hvem som krysset av');
    await p.getByRole('button', { name: /Handlemodus/ }).click();
    const small = await p.evaluate(() => [...document.querySelectorAll('.list.shop input[type=checkbox], .list.shop .main, .list.shop .oos, .list.shop .x, .shoptoggle, .markbought')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { c: e.className || e.tagName, w: r.width, h: r.height }; }).filter((r) => r.h < 43.5 || r.w < 43.5));
    ok(small.length === 0, `${w}px handlemodus: trykkflater minst 44 px ${JSON.stringify(small.slice(0, 3))}`); await scrollOk('handlemodus');
    const oosBtn = p.getByRole('button', { name: /^Utsolgt eller fant ikke/ }).first();
    if (await oosBtn.count()) {
      await oosBtn.focus(); await p.keyboard.press('Enter'); ok(await p.getByRole('dialog').count() === 1, 'utsolgt-ark er dialog');
      await scrollOk('utsolgt-ark'); bad = await unnamed(p); ok(bad.length === 0, `utsolgt-ark: alle kontroller har navn ${bad.join(' | ')}`);
      await p.keyboard.press('Escape'); ok(await p.getByRole('dialog').count() === 0 && await p.evaluate(() => document.activeElement?.className.includes('oos')), 'Escape lukker utsolgt-arket og fokus går tilbake');
    }
    // Husstand: status som tekst, aria-live, skjema med etiketter
    await p.locator('.syncchip').click();
    bad = await unnamed(p); ok(bad.length === 0, `${w}px Husstand: alle kontroller har navn ${bad.join(' | ')}`); await scrollOk('Husstand');
    ok(await p.locator('.syncchip').innerText().then((t) => t.replace(/[^\p{L}]/gu, '').length > 3), 'synkstatus i header er tekst, ikke bare ikon');
    // Tastatur: Tab fra toppen når alle fire faner
    await p.reload(); const seen = new Set();
    for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); const id = await p.evaluate(() => document.activeElement?.id); if (id?.startsWith('tab-')) seen.add(id); }
    ok(seen.size >= 1, 'fanelinjen kan nås med Tab (roving tabindex: én tabstopp)');
    await ctx.close();
  }
  await b.close(); process.exit(fails ? 1 : 0);
})();
