// Formprøve mot Tjek (api.etilbudsavis.dk/v2): bekrefter eller avkrefter antakelsene i src/offers/tjek.ts og server/offers/.
// Kjøres for hånd: `NODE_USE_ENV_PROXY=1 npx tsx phase0/tjek-probe/form-probe.ts` (proxy-flagget bare bak proxy).
// Regler (se phase0/tjek-formprøve.md): høyst 40 GET-kall, minst 1 s mellom, ingen parallellitet, ingen nøkkel eller
// innlogging, stopp ved første 401/403/429. Skriver BARE felt- og typebeskrivelser, antall, andeler og vertsnavn til
// stdout. Ingen tilbudstekst, priser, bilde-URL-er eller rådata lagres eller skrives ut.
import { parseTjekCatalog, parseTjekOffer, parseTjekPages, type RawTjekOffer } from '../../src/offers/tjek';
import { classifyHousehold } from '../../src/engine/household';
import { HOUSEHOLD_RULES } from '../../src/data/household';
import { FOOD_TERMS } from '../../src/offers/household';

const BASE = 'https://api.etilbudsavis.dk/v2';
const MAX_CALLS = 40;
const GAP_MS = 1500;
let calls = 0;
let last = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const headerNames = new Set<string>();
const numericHeaders = new Map<string, Set<string>>();
const linkRels = new Set<string>();
const statuses: string[] = [];

class Stop extends Error {}

async function get(path: string): Promise<unknown> {
  if (calls >= MAX_CALLS) throw new Stop(`kallgrensen ${MAX_CALLS} nådd`);
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  calls++;
  last = Date.now();
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': 'form-probe/0.1' } });
  const label = path.split('?')[0].replace(/\/catalogs\/[^/]+/, '/catalogs/:id');
  statuses.push(`${label} -> ${res.status}`);
  res.headers.forEach((v, k) => {
    headerNames.add(k);
    if (/rate|limit|remaining|reset|retry|total|count|page|quota/i.test(k) && /^\d+(\.\d+)?$/.test(v.trim())) {
      (numericHeaders.get(k) ?? numericHeaders.set(k, new Set()).get(k)!).add(v.trim());
    }
    if (k === 'link') for (const m of v.matchAll(/rel="?([^";,]+)"?/g)) linkRels.add(m[1]);
  });
  if (res.status === 401 || res.status === 403 || res.status === 429) throw new Stop(`HTTP ${res.status} på ${label}`);
  if (!res.ok) { await res.arrayBuffer(); return null; }
  return res.json();
}

// ---------- Formbeskrivelse (bare typer, aldri verdier) ----------
type Info = { n: number; types: Set<string>; hosts: Set<string>; enums: Map<string, number> };
/** Stier der vi skriver ut verdiene (enheter, valuta, land, typer): ingen pris, tekst eller adresse. */
const ENUM_PATHS = /(^|\.)(currency|symbol|factor|country\.id|unit|type|types|locale|source|status|category|categories|dimensions\.(width|height)|aspect_ratio|orientation|is_[a-z_]+|has_[a-z_]+|all_stores)$/;
function describe(values: unknown[], out = new Map<string, Info>(), prefix = '') {
  for (const v of values) walk(v, prefix, out);
  return out;
}
function kind(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'dec';
  if (typeof v === 'string') {
    if (/^https?:\/\//.test(v)) return v.startsWith('https:') ? 'url(https)' : 'url(http)';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) return `dato(${v.replace(/\d/g, '9')})`;
    return 'string';
  }
  return typeof v;
}
function walk(v: unknown, path: string, out: Map<string, Info>) {
  const p = path || '(rot)';
  const i = out.get(p) ?? { n: 0, types: new Set(), hosts: new Set(), enums: new Map() };
  out.set(p, i);
  i.n++;
  const k = kind(v);
  i.types.add(k);
  if (k.startsWith('url(')) { try { i.hosts.add(new URL(v as string).hostname); } catch { /* ugyldig */ } }
  if (ENUM_PATHS.test(path) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && !k.startsWith('url(')) {
    const key = String(v).slice(0, 20);
    i.enums.set(key, (i.enums.get(key) ?? 0) + 1);
  }
  if (Array.isArray(v)) { i.types.add(`len≤${v.length}`); for (const x of v.slice(0, 50)) walk(x, `${path}[]`, out); }
  else if (v && typeof v === 'object') for (const [key, x] of Object.entries(v)) walk(x, path ? `${path}.${key}` : key, out);
}
function print(title: string, m: Map<string, Info>, total: number) {
  console.log(`\n### ${title} (n=${total})\n\n| Felt | Andel | Typer | Verdier (enum) / verter |\n| --- | --- | --- | --- |`);
  for (const [p, i] of [...m.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const types = [...i.types].filter((t) => !t.startsWith('len≤')).sort().join(', ');
    const enums = [...i.enums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k}:${n}`).join(' ');
    const hosts = [...i.hosts].sort().join(', ');
    console.log(`| ${p} | ${i.n}/${total} | ${types} | ${[enums, hosts].filter(Boolean).join(' · ')} |`);
  }
}

// ---------- Prøven ----------
const FOOD = ['kjøttdeig', 'laks', 'pasta'];
const HOUSE = ['oppvask', 'toalettpapir', 'batterier', 'vaskemiddel'];
const now = new Date().toISOString();
const offerShape = new Map<string, Info>();
let offerTotal = 0;
const perQuery: string[] = [];
const parsedStats = { n: 0, price: 0, amount: 0, pieces: 0, image: 0, nonNok: 0, rangeSize: 0, unknownUnit: new Map<string, number>() };

async function main() {
  for (const q of [...FOOD, ...HOUSE]) {
    const raw = await get(`/offers/search?query=${encodeURIComponent(q)}&country_id=NO&limit=100`);
    const list = Array.isArray(raw) ? (raw as RawTjekOffer[]) : [];
    const no = list.filter((o) => o.dealer?.country?.id === 'NO');
    describe(list, offerShape);
    offerTotal += list.length;
    let house = 0, food = 0, valid = 0;
    const dealers = new Set<string>();
    for (const o of no) {
      const n = parseTjekOffer(o, now);
      parsedStats.n++;
      if (n.priceOre !== null) parsedStats.price++;
      if (n.amount !== null) parsedStats.amount++;
      if (n.pieces !== null) parsedStats.pieces++;
      if (n.image) parsedStats.image++;
      if (o.pricing?.currency && o.pricing.currency.toUpperCase() !== 'NOK') parsedStats.nonNok++;
      if (o.quantity?.size?.to != null && o.quantity.size.to !== o.quantity.size.from) parsedStats.rangeSize++;
      const sym = o.quantity?.unit?.symbol;
      if (sym && n.amount === null && n.pieces === null) parsedStats.unknownUnit.set(sym, (parsedStats.unknownUnit.get(sym) ?? 0) + 1);
      dealers.add(n.dealerName);
      const today = now.slice(0, 10);
      if (n.validFrom <= today && n.validUntil >= today) valid++;
      const h = classifyHousehold(n, HOUSEHOLD_RULES, FOOD_TERMS);
      if (h && !h.reasons.includes('mat')) house++;
      else if (FOOD_TERMS.some((t) => new RegExp(`(^|[^a-zæøå])${t}`, 'i').test(n.heading))) food++;
    }
    perQuery.push(`| ${q} | ${FOOD.includes(q) ? 'mat' : 'husholdning'} | ${list.length} | ${no.length} | ${valid} | ${house} | ${food} | ${no.length - house - food} | ${dealers.size} |`);
  }

  // Paginering: offset og høyere limit.
  const p2 = await get(`/offers/search?query=${encodeURIComponent('pasta')}&country_id=NO&limit=100&offset=100`);
  const big = await get(`/offers/search?query=${encodeURIComponent('pasta')}&country_id=NO&limit=250`);
  const pageInfo = { offset100: Array.isArray(p2) ? p2.length : `ikke liste (${kind(p2)})`, limit250: Array.isArray(big) ? big.length : `ikke liste (${kind(big)})` };

  // Kataloger.
  const cats: unknown[] = [];
  const catPages: (number | string)[] = [];
  for (let page = 0; page < 3; page++) {
    const raw = await get(`/catalogs?country_id=NO&limit=100&offset=${page * 100}`);
    const list = Array.isArray(raw) ? raw : [];
    catPages.push(Array.isArray(raw) ? list.length : `ikke liste (${kind(raw)})`);
    cats.push(...list);
    if (list.length < 100) break;
  }
  const catShape = describe(cats);
  const parsedCats = cats.map((c) => parseTjekCatalog(c, 'NO', now)).filter((c) => c !== null);
  const countries = new Map<string, number>();
  for (const c of cats as { dealer?: { country?: { id?: string } } }[]) { const k = c?.dealer?.country?.id ?? '(mangler)'; countries.set(k, (countries.get(k) ?? 0) + 1); }
  const today = now.slice(0, 10);
  const current = parsedCats.filter((c) => c.validFrom <= today && c.validUntil >= today);

  let pagesShape = new Map<string, Info>(), pagesCount: number | string = 'ikke hentet', parsedPages = 0, parsedWithView = 0;
  const pick = current[0] ?? parsedCats[0];
  let singleShape = new Map<string, Info>();
  if (pick) {
    const raw = await get(`/catalogs/${encodeURIComponent(pick.id)}/pages`);
    pagesShape = describe([raw]);
    pagesCount = Array.isArray(raw) ? raw.length : `ikke liste (${kind(raw)})`;
    const pp = parseTjekPages(raw);
    parsedPages = pp.length; parsedWithView = pp.filter((p) => p.view).length;
    const one = await get(`/catalogs/${encodeURIComponent(pick.id)}`);
    singleShape = describe([one]);
  }

  console.log(`# Formprøve Tjek ${now}\n\nKall: ${calls}. Status: ${statuses.join('; ')}`);
  console.log(`\n## Søk\n\n| Søkeord | Type | Treff | Norske | Gyldige i dag | Husholdning (klassifisert) | Mat (matord) | Annet | Kjeder |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${perQuery.join('\n')}`);
  console.log(`\nParset (norske): ${JSON.stringify({ ...parsedStats, unknownUnit: Object.fromEntries(parsedStats.unknownUnit) })}`);
  console.log(`Paginering: ${JSON.stringify(pageInfo)}`);
  print('Tilbud (/offers/search)', offerShape, offerTotal);
  console.log(`\n## Kataloger\n\nSider: ${JSON.stringify(catPages)}; totalt ${cats.length}; land: ${JSON.stringify(Object.fromEntries(countries))}; parset NO: ${parsedCats.length}; gyldige i dag: ${current.length}; med pageCount: ${parsedCats.filter((c) => c.pageCount).length}; med label: ${parsedCats.filter((c) => c.label).length}`);
  print('Kataloger (/catalogs)', catShape, cats.length);
  print('Én katalog (/catalogs/:id)', singleShape, 1);
  console.log(`\nSider for én katalog: ${JSON.stringify(pagesCount)}; parset: ${parsedPages}; med view: ${parsedWithView}; pageCount i lista: ${pick?.pageCount ?? 'null'}`);
  print('Sider (/catalogs/:id/pages)', pagesShape, 1);
}

try { await main(); } catch (e) {
  if (e instanceof Stop) console.log(`\nSTOPP: ${e.message}`); else console.log(`\nFEIL: ${e instanceof Error ? `${e.name}: ${(e as { cause?: { code?: string } }).cause?.code ?? e.message}` : typeof e}`);
}
console.log(`\n## Svarhoder\n\nNavn: ${[...headerNames].sort().join(', ')}\nTallverdier (rate/limit/…): ${JSON.stringify(Object.fromEntries([...numericHeaders].map(([k, v]) => [k, [...v]])))}\nLink rel: ${[...linkRels].join(', ') || 'ingen'}\nKall totalt: ${calls}`);
