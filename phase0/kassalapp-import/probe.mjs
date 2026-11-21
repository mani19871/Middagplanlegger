// Dekningsprøve mot Kassalapp. Kontroller endepunkt og feltnavn mot gjeldende API-dokumentasjon.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const token = process.env.KASSALAPP_TOKEN;
if (!token) { console.error('Sett KASSALAPP_TOKEN'); process.exit(1); }
const base = 'https://kassal.app/api/v1';
const { baskets } = JSON.parse(await readFile(new URL('./baskets.json', import.meta.url)));
const today = Date.now();
const rows = [];

for (const b of baskets) for (const item of b.items) {
  const res = await fetch(`${base}/products?search=${encodeURIComponent(item.query)}&size=20`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) { rows.push({ basket: b.id, query: item.query, error: `HTTP ${res.status}` }); continue; }
  const { data = [] } = await res.json();
  for (const p of data) {
    const store = p.store?.name ?? 'ukjent';
    const price = p.current_price ?? null;
    const updated = p.current_price_updated ?? p.updated_at ?? null;
    rows.push({ basket: b.id, region: b.region, query: item.query, store, product: p.name, priceNok: price,
      ageDays: updated ? Math.round((today - Date.parse(updated)) / 86_400_000) : null });
  }
  await new Promise((r) => setTimeout(r, 1000)); // vær snill mot API-et
}

const stats = {};
for (const r of rows.filter((x) => !x.error)) {
  const s = (stats[r.store] ??= { products: 0, priced: 0, fresh: 0 });
  s.products++; if (r.priceNok != null) s.priced++; if (r.priceNok != null && r.ageDays != null && r.ageDays <= 2) s.fresh++;
}
await mkdir(new URL('./out/', import.meta.url), { recursive: true });
await writeFile(new URL('./out/coverage.json', import.meta.url), JSON.stringify({ rows, stats }, null, 2));
const md = ['| Kjede | Produkter | Med pris | Fersk (≤2 d) |', '| --- | --- | --- | --- |',
  ...Object.entries(stats).map(([k, v]) => `| ${k} | ${v.products} | ${v.priced} | ${v.fresh} |`)].join('\n');
await writeFile(new URL('./out/coverage.md', import.meta.url), md + '\n');
console.log(md);
