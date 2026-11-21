// Tjek-dekningsmåling for Norge. Se README.md (tillatelse er IKKE dokumentert; bare aggregater lagres).
// Endepunkter og felt etter olgasafonova/tilbudstrolden-mcp (src/api.ts, src/offer-parsing.ts), observert 2026-11-21.
// Observert: /dealers returnerer ingen norske dealere (bare DK/DE), så norske dealere oppdages via
// /offers/search?country_id=NO (dealer.name, dealer.country.id, dealer_id i hvert tilbud).
// Ett kall per sekund, generisk User-Agent. 401/403 stopper kjøringen (vi prøver ikke å komme rundt).
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const base = 'https://api.etilbudsavis.dk/v2';
const UA = 'coverage-probe/0.1';
const cfg = JSON.parse(await readFile(new URL('../kassalapp-import/baskets.json', import.meta.url)));
const now = Date.now();
const PAGE = 100, MAX_PAGES = 5;
let calls = 0;
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(1100);
    calls++;
    let res;
    try { res = await fetch(`${base}${path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } }); }
    catch (e) { errors.push(`${path.split('?')[0]} -> ${e.cause?.code ?? e.message}`); return null; }
    if (res.status === 401 || res.status === 403) {
      console.error(`STOPP: HTTP ${res.status} fra ${path.split('?')[0]} – endepunktet avviser oss. Rapporter, ikke omgå.`);
      process.exit(2);
    }
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * 2 ** attempt); continue; }
    if (!res.ok) { errors.push(`${path.split('?')[0]} -> HTTP ${res.status}`); return null; }
    return res.json();
  }
  errors.push(`${path.split('?')[0]} -> avbrutt etter forsøk`);
  return null;
}

// Kjedegrupper ut fra dealernavn (offentlige firmanavn). Alt annet blir «andre» og telles per navn.
const GROUPS = [
  ['REMA 1000', /^rema\s*1000/i], ['KIWI', /^kiwi/i], ['Coop Extra', /^(coop\s+)?extra$/i], ['Coop Prix', /^coop\s+prix/i],
  ['Coop Mega', /^coop\s+mega/i], ['Coop Obs', /^(coop\s+)?obs(?!\s*bygg)/i], ['Coop Marked', /^coop\s+marked/i],
  ['Meny', /^meny/i], ['SPAR', /^spar(\s|$)/i], ['Joker', /^joker/i], ['Bunnpris', /^bunnpris/i],
];
const groupOf = (name) => GROUPS.find(([, re]) => re.test(name))?.[0] ?? 'andre';

const words = (s) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
function relevant(item, heading) {
  const w = new Set(words(heading)); const lower = heading.toLowerCase();
  return item.must.every((g) => g.split('|').some((a) => w.has(a))) && !item.not.some((x) => lower.includes(x));
}
const hasQty = (o) => (o.quantity?.size?.from > 0 && !!o.quantity?.unit?.symbol) || o.quantity?.pieces?.from > 0;
const validNow = (o) => Date.parse(o.run_from) <= now && now < Date.parse(o.run_till);

const itemIds = [...new Set(cfg.baskets.flatMap((b) => b.recipes.flatMap((r) => cfg.recipes[r].items)))];
const dealersSeen = new Map(); // dealer_id -> { name, country }
const perItem = {}; // itemId -> { failed, raw, truncated, byGroup: {group: counts} }
const emptyCounts = () => ({ raw: 0, relevant: 0, validNow: 0, pricedValid: 0, packValid: 0, upcoming: 0, expired: 0 });

for (const itemId of itemIds) {
  const item = cfg.items[itemId];
  const rec = (perItem[itemId] = { failed: false, raw: 0, truncated: false, nonNO: 0, byGroup: {} });
  for (let page = 0; page < MAX_PAGES; page++) {
    const j = await api(`/offers/search?query=${encodeURIComponent(item.query)}&country_id=NO&limit=${PAGE}&offset=${page * PAGE}`);
    if (!j) { rec.failed = true; break; }
    for (const o of j) {
      const country = o.dealer?.country?.id ?? '?';
      if (country !== 'NO') { rec.nonNO++; continue; }
      rec.raw++;
      const name = o.dealer?.name ?? o.branding?.name ?? 'ukjent';
      dealersSeen.set(o.dealer_id, { name, country });
      const c = (rec.byGroup[groupOf(name)] ??= emptyCounts());
      c.raw++;
      if (!relevant(item, o.heading ?? '')) continue;
      c.relevant++;
      const priced = o.pricing?.price > 0;
      if (validNow(o)) { c.validNow++; if (priced) c.pricedValid++; if (priced && hasQty(o)) c.packValid++; }
      else if (Date.parse(o.run_from) > now) c.upcoming++; else c.expired++;
    }
    if (j.length < PAGE) break;
    if (page === MAX_PAGES - 1) rec.truncated = true;
  }
}

// Dealere sett i treffene, per gruppe/navn (bare firmanavn og antall).
const dealerNames = {};
for (const d of dealersSeen.values()) dealerNames[d.name] = (dealerNames[d.name] ?? 0) + 1;
const groupDealers = {};
for (const d of dealersSeen.values()) { const g = groupOf(d.name); groupDealers[g] = (groupDealers[g] ?? 0) + 1; }
const groupsFound = GROUPS.map(([g]) => g);

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : 'ukjent');
const cell = (itemId, g) => perItem[itemId].byGroup[g] ?? emptyCounts();
const perChain = {}; const perBasket = {};
for (const g of [...groupsFound, 'andre']) {
  const s = (perChain[g] = { lines: 0, failed: 0, anyRelevant: 0, validNow: 0, pricedValid: 0, packValid: 0, offersRelevant: 0, offersValid: 0 });
  for (const b of cfg.baskets) {
    const ids = [...new Set(b.recipes.flatMap((r) => cfg.recipes[r].items))];
    let valid = 0;
    for (const i of ids) {
      s.lines++;
      if (perItem[i].failed) { s.failed++; continue; }
      const c = cell(i, g);
      if (c.relevant) s.anyRelevant++;
      if (c.validNow) { s.validNow++; valid++; }
      if (c.pricedValid) s.pricedValid++;
      if (c.packValid) s.packValid++;
      s.offersRelevant += c.relevant; s.offersValid += c.validNow;
    }
    (perBasket[b.id] ??= {})[g] = pct(valid, ids.length);
  }
}
const itemRows = Object.fromEntries(itemIds.map((i) => [i, Object.fromEntries(groupsFound.map((g) => { const c = cell(i, g); return [g, perItem[i].failed ? 'feil' : `${c.validNow}/${c.relevant}/${c.raw}`]; }))]));
const all = { raw: 0, relevant: 0, validNow: 0, pricedValid: 0, packValid: 0, upcoming: 0, expired: 0 };
for (const i of itemIds) for (const c of Object.values(perItem[i].byGroup)) for (const k of Object.keys(all)) all[k] += c[k];

const md = [];
md.push(`Kjørt ${new Date(now).toISOString()} · ${calls} API-kall · ${errors.length} feil · ${Object.values(perItem).filter((r) => r.truncated).length} søk avkortet (maks ${MAX_PAGES * PAGE} treff)`, '');
md.push('## Norske dealere sett i søketreffene', '',
  `Totalt ${dealersSeen.size} ulike norske dealere ga treff på minst ett av ${itemIds.length} søkeord (nedre grense: dealere uten treff på våre varer er ikke sett). Treff fra ikke-norske dealere ignorert: ${Object.values(perItem).reduce((a, r) => a + r.nonNO, 0)}.`, '',
  '| Kjedegruppe | Dealere sett |', '| --- | --- |',
  ...[...groupsFound, 'andre'].map((g) => `| ${g} | ${groupDealers[g] ?? 0} |`));
md.push('', `Andre dealere sett (navn): ${Object.keys(dealerNames).filter((n) => groupOf(n) === 'andre').sort().join(', ') || 'ingen'}`);
md.push('', `Alle treff fra norske dealere på tvers av søkeord: ${all.raw}; relevante etter ordregler: ${all.relevant}; gyldige nå: ${all.validNow} (med pris ${all.pricedValid}, med pris og mengde ${all.packValid}); kommende: ${all.upcoming}; utløpt: ${all.expired}.`);
md.push('', '## Dekning per kjedegruppe (alle kurver; varelinjer = unike varer per kurv)', '',
  '| Kjede | Linjer | ≥1 relevant tilbud | ≥1 gyldig nå | ≥1 gyldig med pris | ≥1 gyldig med pris og mengde | Relevante tilbud | Gyldige nå |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...[...groupsFound, 'andre'].map((g) => { const s = perChain[g]; return `| ${g} | ${s.lines} | ${s.anyRelevant} (${pct(s.anyRelevant, s.lines)}) | ${s.validNow} (${pct(s.validNow, s.lines)}) | ${s.pricedValid} (${pct(s.pricedValid, s.lines)}) | ${s.packValid} (${pct(s.packValid, s.lines)}) | ${s.offersRelevant} | ${s.offersValid} |`; }));
md.push('', '## Per kurv: andel varelinjer med gyldig relevant tilbud nå', '',
  '| Kurv | Sted | ' + groupsFound.join(' | ') + ' |', '| --- | --- | ' + groupsFound.map(() => '---').join(' | ') + ' |',
  ...cfg.baskets.map((b) => `| ${b.id} | ${b.region} | ${groupsFound.map((g) => perBasket[b.id][g]).join(' | ')} |`));
md.push('', '## Per vare og kjede (gyldige nå / relevante / treff totalt)', '',
  '| Vare | ' + groupsFound.join(' | ') + ' |', '| --- | ' + groupsFound.map(() => '---').join(' | ') + ' |',
  ...itemIds.map((i) => `| ${cfg.items[i].label} | ${groupsFound.map((g) => itemRows[i][g]).join(' | ')} |`));
if (errors.length) md.push('', '## Feil', '', ...errors.map((e) => `- ${e}`));

await mkdir(new URL('./out/', import.meta.url), { recursive: true });
await writeFile(new URL('./out/coverage.json', import.meta.url), JSON.stringify({ runAt: new Date(now).toISOString(), calls, errors, dealersSeen: dealersSeen.size, groupDealers, dealerNames,
  all, perChain, perBasket, itemRows, truncated: Object.entries(perItem).filter(([, r]) => r.truncated).map(([i]) => i) }, null, 2));
await writeFile(new URL('./out/coverage.md', import.meta.url), md.join('\n') + '\n');
console.log(md.join('\n'));
