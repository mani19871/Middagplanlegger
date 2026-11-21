// Dekningsprøve mot Kassalapp API v1 (https://kassal.app/api/docs, OpenAPI: https://kassal.app/docs/api.json).
// Verifisert 2026-11-21 mot gjeldende dokumentasjon og ekte svar:
//   GET /api/v1/products?search=&store=&size=(1-100)&page=  (search: min. 3 tegn; store: kjedekode, f.eks. KIWI, REMA_1000, COOP_NO)
//   felt brukt: name, current_price, weight, weight_unit, updated_at, store.code, store.name
//   (current_price_updated finnes ikke; updated_at er siste observasjon, den samme datoen som nyeste price_history)
//   GET /api/v1/physical-stores?search=&size=&page=  (felt: group, name, address)
//   Rate limit: 60 forespørsler per minutt per konto (Hobby). Vi bruker ~1,1 s mellom kall.
// Bak proxy: kjør med NODE_USE_ENV_PROXY=1 (og NODE_EXTRA_CA_CERTS ved egen CA). Nøkkel: miljøvariabelen KASSALAPP_TOKEN (aldri i git). Treffene vurderes automatisk (se baskets.json), ikke manuelt.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const token = process.env.KASSALAPP_TOKEN;
if (!token) { console.error('Sett KASSALAPP_TOKEN'); process.exit(1); }
const base = 'https://kassal.app/api/v1';
const cfg = JSON.parse(await readFile(new URL('./baskets.json', import.meta.url)));
const CHAINS = ['KIWI', 'REMA_1000', 'COOP_NO', 'MENY_NO', 'SPAR_NO', 'JOKER_NO', 'BUNNPRIS', 'ODA_NO', 'ENGROSSNETT_NO'];
const MAX_PAGES = 3;
const runAt = Date.now();
let calls = 0;
const errors = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(1100);
    calls++;
    let res;
    try { res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }); }
    catch (e) { errors.push(`${path} -> ${e.cause?.code ?? e.message}`); return null; }
    if (res.status === 429) { await sleep((Number(res.headers.get('retry-after')) || 30) * 1000); continue; }
    if (!res.ok) { errors.push(`${path} -> HTTP ${res.status}`); return null; }
    return res.json();
  }
  errors.push(`${path} -> 429 etter flere forsøk`);
  return null;
}

const words = (s) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
function relevant(item, name) {
  const w = new Set(words(name));
  const lower = name.toLowerCase();
  if (!item.must.every((group) => group.split('|').some((alt) => w.has(alt)))) return false;
  return !item.not.some((x) => lower.includes(x));
}
function packSize(p) {
  const u = { g: 1, kg: 1000, ml: 1, l: 1000, dl: 100, cl: 10 };
  const wu = (p.weight_unit ?? '').toLowerCase();
  if (p.weight != null && u[wu]) return { value: p.weight * u[wu], unit: wu === 'g' || wu === 'kg' ? 'g' : 'ml' };
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|g|l|dl|cl|ml)\b/i.exec(p.name ?? '');
  if (m) { const k = m[2].toLowerCase(); return { value: parseFloat(m[1].replace(',', '.')) * u[k], unit: k === 'g' || k === 'kg' ? 'g' : 'ml' }; }
  return null;
}
const ageDays = (iso) => (iso ? Math.max(0, Math.floor((runAt - Date.parse(iso)) / 86_400_000)) : null);

// Ett søk per (vare, kjede); gjenbrukes på tvers av kurver.
const cache = new Map();
async function lookup(itemId, chain) {
  const key = `${itemId}|${chain}`;
  if (cache.has(key)) return cache.get(key);
  const item = cfg.items[itemId];
  const matches = []; let failed = false; let seen = 0; let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const j = await api(`/products?search=${encodeURIComponent(item.query)}&store=${chain}&size=100&page=${page}`);
    if (!j) { failed = true; break; }
    const data = j.data ?? []; seen += data.length;
    for (const p of data) if (relevant(item, p.name) && typeof p.current_price === 'number' && p.current_price > 0) {
      const sz = packSize(p);
      const sizeOk = item.size != null && sz != null && sz.unit === item.unit && Math.abs(sz.value - item.size) <= item.size * 0.05;
      matches.push({ name: p.name, priceNok: p.current_price, ageDays: ageDays(p.updated_at), sizeOk });
    }
    if (data.length < 100) break;
    if (matches.length) break; // nok å vise dekning
    if (page === MAX_PAGES) truncated = true;
  }
  // beste treff: riktig pakning først, deretter ferskest
  matches.sort((a, b) => (b.sizeOk - a.sizeOk) || ((a.ageDays ?? 1e9) - (b.ageDays ?? 1e9)));
  const r = { failed, seen, truncated, matches: matches.length, best: matches[0] ?? null };
  cache.set(key, r);
  return r;
}

const rows = [];
for (const b of cfg.baskets) {
  const ids = [...new Set(b.recipes.flatMap((r) => cfg.recipes[r].items))];
  for (const itemId of ids) for (const chain of CHAINS) {
    const r = await lookup(itemId, chain);
    rows.push({ basket: b.id, region: b.region, item: itemId, chain, failed: r.failed, truncated: r.truncated, matches: r.matches,
      priced: r.matches > 0, sizeRequired: cfg.items[itemId].size != null, sizeOk: r.best?.sizeOk ?? false,
      priceNok: r.best?.priceNok ?? null, ageDays: r.best?.ageDays ?? null, product: r.best?.name ?? null });
  }
}

// Fysiske utsalg per sted (kjeden finnes i området?) – adresse må ende på stedsnavnet.
const COOP_GROUPS = (g) => (g.startsWith('COOP_') ? 'COOP_NO' : g);
const stores = {};
for (const b of cfg.baskets) {
  const counts = {}; let ok = true;
  for (let page = 1; page <= 8; page++) {
    const j = await api(`/physical-stores?search=${encodeURIComponent(b.place)}&size=100&page=${page}`);
    if (!j) { ok = false; break; }
    for (const s of j.data ?? []) {
      const town = (s.address ?? '').split(',').pop().trim().replace(/^\d{4}\s*/, '').toLowerCase(); // «9006 Tromsø» / «Kristiansand S»
      if (town === b.place.toLowerCase() || town.startsWith(`${b.place.toLowerCase()} `)) { const g = COOP_GROUPS(s.group); counts[g] = (counts[g] ?? 0) + 1; }
    }
    if ((j.data ?? []).length < 100 || !j.links?.next) break;
  }
  stores[b.id] = { place: b.place, ok, counts };
}

// Oppsummering
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : 'ukjent');
const bucket = (d) => (d == null ? 'ukjent' : d <= 2 ? '≤2 d' : d <= 7 ? '3–7 d' : d <= 30 ? '8–30 d' : d <= 365 ? '31–365 d' : '>365 d');
const BUCKETS = ['≤2 d', '3–7 d', '8–30 d', '31–365 d', '>365 d', 'ukjent'];
const stats = {};
for (const chain of CHAINS) {
  const r = rows.filter((x) => x.chain === chain && !x.failed);
  const priced = r.filter((x) => x.priced);
  const sized = r.filter((x) => x.sizeRequired);
  const ages = Object.fromEntries(BUCKETS.map((k) => [k, priced.filter((x) => bucket(x.ageDays) === k).length]));
  stats[chain] = { lines: r.length, failed: rows.filter((x) => x.chain === chain && x.failed).length, priced: priced.length,
    sizeLines: sized.length, sizeOk: sized.filter((x) => x.sizeOk).length, ages };
}
const itemStats = {};
for (const itemId of Object.keys(cfg.items)) {
  itemStats[itemId] = Object.fromEntries(CHAINS.map((c) => { const r = cache.get(`${itemId}|${c}`); return [c, r ? (r.failed ? 'feil' : r.matches > 0 ? (r.best.sizeOk ? 'pris+pakning' : 'pris') : 'ingen') : '-']; }));
}

const md = [];
md.push(`Kjørt ${new Date(runAt).toISOString()} · ${calls} API-kall · ${errors.length} feil`, '');
md.push('## Dekning per kjede (alle ti kurver, unike varelinjer per kurv)', '',
  '| Kjede | Linjer | Med pris | Pakning riktig (av linjer med krav) | ' + BUCKETS.join(' | ') + ' |',
  '| --- | --- | --- | --- | ' + BUCKETS.map(() => '---').join(' | ') + ' |',
  ...CHAINS.map((c) => { const s = stats[c]; return `| ${c} | ${s.lines} | ${s.priced} (${pct(s.priced, s.lines)}) | ${s.sizeOk}/${s.sizeLines} (${pct(s.sizeOk, s.sizeLines)}) | ${BUCKETS.map((k) => s.ages[k]).join(' | ')} |`; }));
md.push('', '## Dekning per kurv og kjede (andel varelinjer med pris)', '',
  '| Kurv | Sted | ' + CHAINS.join(' | ') + ' |', '| --- | --- | ' + CHAINS.map(() => '---').join(' | ') + ' |',
  ...cfg.baskets.map((b) => `| ${b.id} | ${b.region} (${b.type}) | ` + CHAINS.map((c) => { const r = rows.filter((x) => x.basket === b.id && x.chain === c && !x.failed); return pct(r.filter((x) => x.priced).length, r.length); }).join(' | ') + ' |'));
md.push('', '## Fysiske utsalg i området (Kassalapp /physical-stores, adresse slutter på stedsnavnet)', '',
  '| Sted | ' + CHAINS.join(' | ') + ' |', '| --- | ' + CHAINS.map(() => '---').join(' | ') + ' |',
  ...cfg.baskets.map((b) => { const s = stores[b.id]; return `| ${s.place}${s.ok ? '' : ' (kall feilet)'} | ` + CHAINS.map((c) => s.counts[c] ?? 0).join(' | ') + ' |'; }));
md.push('', '## Per vare og kjede (pris+pakning / pris / ingen treff / feil)', '',
  '| Vare | ' + CHAINS.join(' | ') + ' |', '| --- | ' + CHAINS.map(() => '---').join(' | ') + ' |',
  ...Object.keys(cfg.items).map((i) => `| ${cfg.items[i].label} | ` + CHAINS.map((c) => itemStats[i][c]).join(' | ') + ' |'));
if (errors.length) md.push('', '## Feil', '', ...errors.map((e) => `- ${e}`));

await mkdir(new URL('./out/', import.meta.url), { recursive: true });
await writeFile(new URL('./out/coverage.json', import.meta.url), JSON.stringify({ runAt: new Date(runAt).toISOString(), calls, errors, stats, itemStats, stores, rows }, null, 2));
await writeFile(new URL('./out/coverage.md', import.meta.url), md.join('\n') + '\n');
console.log(md.join('\n'));
