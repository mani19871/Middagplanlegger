// Oppfølging til form-probe.ts (samme regler: høyst 40 kall samlet for begge, ≥1 s mellom, stopp ved 401/403/429, bare
// aggregater til stdout). Spørsmål: (a) hvor mange sider /catalogs har, og hvor mange norske aviser som ligger etter side 5;
// (b) hvordan quantity.pieces ser ut per enhet (stykkvarer); (c) om et fast punkt (Oslo sentrum, ingen brukerposisjon)
// med r_lat/r_lng/r_radius begrenser treffene til Norge.
// Kjøres: `NODE_USE_ENV_PROXY=1 npx tsx phase0/tjek-probe/form-probe-oppfolging.ts <kall brukt før>`.
const BASE = 'https://api.etilbudsavis.dk/v2';
const before = Number(process.argv[2] ?? 0);
const MAX = 40 - before;
let calls = 0, last = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
class Stop extends Error {}
const statuses: string[] = [];
async function get(path: string): Promise<unknown> {
  if (calls >= MAX) throw new Stop('kallgrensen nådd');
  const wait = last + 1500 - Date.now();
  if (wait > 0) await sleep(wait);
  calls++; last = Date.now();
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': 'form-probe/0.1' } });
  statuses.push(`${path.split('?')[0]} -> ${res.status}`);
  if (res.status === 401 || res.status === 403 || res.status === 429) throw new Stop(`HTTP ${res.status}`);
  if (!res.ok) { await res.arrayBuffer(); return null; }
  return res.json();
}
type O = { dealer?: { country?: { id?: string } }; quantity?: { unit?: { symbol?: string }; pieces?: { from?: number; to?: number }; size?: { from?: number; to?: number } }; run_from?: string };
const tally = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const show = (m: Map<string, number>) => JSON.stringify(Object.fromEntries([...m].sort()));
const OSLO = 'r_lat=59.9139&r_lng=10.7522&r_radius=700000';

try {
  // (a) Katalogsider etter de tre første (offset 300 …), til en side har under 100 eller vi har sett 10 sider.
  const perPage: string[] = [];
  let noAfter5 = 0;
  for (let page = 3; page < 10; page++) {
    const raw = await get(`/catalogs?country_id=NO&limit=100&offset=${page * 100}`);
    const list = (Array.isArray(raw) ? raw : []) as O[];
    const no = list.filter((c) => c.dealer?.country?.id === 'NO').length;
    if (page >= 5) noAfter5 += no;
    perPage.push(`side ${page + 1}: ${list.length} (NO ${no})`);
    if (list.length < 100) break;
  }
  console.log(`Kataloger videre: ${perPage.join('; ')}; norske etter side 5: ${noAfter5}`);

  // (b) Stykkvarer.
  for (const q of ['egg', 'tortilla']) {
    const raw = await get(`/offers/search?query=${encodeURIComponent(q)}&country_id=NO&limit=100`);
    const list = ((Array.isArray(raw) ? raw : []) as O[]).filter((o) => o.dealer?.country?.id === 'NO');
    const pieces = new Map<string, number>(), sizes = new Map<string, number>();
    for (const o of list) {
      const sym = o.quantity?.unit?.symbol ?? '?';
      tally(pieces, `${sym} pieces ${o.quantity?.pieces?.from === o.quantity?.pieces?.to ? `=${o.quantity?.pieces?.from}` : 'spenn'}`);
      if (sym === 'pcs') tally(sizes, `size ${o.quantity?.size?.from === o.quantity?.size?.to ? (o.quantity?.size?.from ?? 0) > 1 ? '>1' : '=1' : 'spenn'}`);
    }
    console.log(`Stykk «${q}»: norske ${list.length}; ${show(pieces)}; pcs-størrelse ${show(sizes)}`);
  }

  // (c) Fast punkt i Oslo.
  const geo = await get(`/offers/search?query=laks&country_id=NO&limit=100&${OSLO}`);
  const g = (Array.isArray(geo) ? geo : []) as O[];
  const gc = new Map<string, number>(); for (const o of g) tally(gc, o.dealer?.country?.id ?? '?');
  console.log(`Søk «laks» med fast punkt Oslo: ${g.length} treff; land ${show(gc)}`);
  const gcat = await get(`/catalogs?country_id=NO&limit=100&${OSLO}`);
  const c = (Array.isArray(gcat) ? gcat : []) as O[];
  const cc = new Map<string, number>(); for (const o of c) tally(cc, o.dealer?.country?.id ?? '?');
  console.log(`Kataloger med fast punkt Oslo: ${c.length}; land ${show(cc)}`);
} catch (e) {
  console.log(e instanceof Stop ? `STOPP: ${e.message}` : `FEIL: ${e instanceof Error ? e.name : typeof e}`);
}
console.log(`Status: ${statuses.join('; ')}\nKall i oppfølgingen: ${calls} (samlet ${before + calls})`);
