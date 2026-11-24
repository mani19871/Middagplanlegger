// Tjek (etilbudsavis) som tilbudskilde. Grensesnittet og tolkingen av svaret er inspirert av
// tilbudstrolden-mcp (MIT, © 2026 Olga Safonova), se THIRD_PARTY.md.
// Bruk forutsetter skriftlig avtale/vilkår fra Tjek om visnings- og viderebruksrett.
import type { Unit } from '../engine/types';
import { osloDate as osloDay } from '../engine/oslo';
import type { Catalog, CatalogPage, Dealer, NormalizedOffer, OfferQuery, OfferSource } from './types';

/**
 * Formen er prøvd mot ekte svar 2026-11-22 (phase0/tjek-formprøve.md): alle feltene under fantes i alle 413 treff.
 * `description` er en streng (ofte tom), `quantity.size`/`pieces`/`unit` er alltid med, tidspunkter har sone «+0000».
 * Svarene har også felt vi ikke leser (bl.a. `catalog_id`, `catalog_page`, `category_ids` som var tom i alle treff,
 * `links.webshop` og kjedelogoer i `branding`/`dealer`; logoer brukes ikke før Tjek bekrefter at de er med).
 */
export interface RawTjekOffer {
  id: string;
  heading: string;
  description: string | null;
  pricing: { price: number | null; pre_price: number | null; currency?: string } | null;
  quantity: {
    unit: { symbol: string; si?: { symbol: string; factor: number } } | null;
    size: { from: number | null; to: number | null } | null;
    pieces: { from: number | null; to: number | null } | null;
  } | null;
  branding?: { name: string } | null;
  dealer_id: string;
  dealer?: { name: string; country?: { id: string } } | null;
  run_from: string;
  run_till: string;
  /** Produktbilde i flere størrelser (tilbudstrolden-mcp bruker `images.view`). */
  images?: { thumb?: string | null; view?: string | null; zoom?: string | null } | null;
}

/** En https-adresse (høyst 500 tegn), ellers null. Hvilke verter som vises, avgjør serveren (TJEK_IMAGE_HOSTS). */
export function httpsUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 500) return null;
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}

const toOre = (kr: number | null | undefined) => (typeof kr !== 'number' || !Number.isFinite(kr) ? null : Math.round(kr * 100));

/**
 * Dato (YYYY-MM-DD) i norsk tid for et tidspunkt fra Tjek. Tjek oppgir tid med sone (ofte UTC), så de ti første tegnene
 * er ikke nødvendigvis den norske datoen. Slutt nøyaktig ved midnatt er eksklusiv og gjelder ikke den nye dagen.
 */
export function osloDate(iso: string, end = false): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.slice(0, 10);
  // Samme regel som motoren (src/engine/oslo.ts), så klient og server gir samme dato (M5). Date.parse normaliserer formatet.
  return osloDay(new Date(end ? t - 1000 : t).toISOString()) ?? iso.slice(0, 10);
}

const TO_G: Record<string, number> = { g: 1, kg: 1000, hg: 100 };
const TO_ML: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000 };

/** Én kjent verdi. Et spenn («400–700 g») er ikke en kjent mengde og gir null (tilbudet går til kontroll). */
function exact(r: { from: number | null; to: number | null } | null | undefined): number | null {
  const from = r?.from ?? null;
  if (from === null || !Number.isFinite(from)) return null;
  return r?.to === null || r?.to === undefined || r.to === from ? from : null;
}

/** Mengde i g/ml fra enhetssymbolet (Tjeks «si»-felt er basisenhet i kg/l og brukes ikke). Stykk gir ukjent vekt. */
function readAmount(q: RawTjekOffer['quantity']): { amount: number | null; unit: Unit | null } {
  const size = exact(q?.size);
  const sym = q?.unit?.symbol?.toLowerCase();
  if (size === null || size <= 0 || !sym) return { amount: null, unit: null };
  // Avrundet til tidels gram/ml, så 2,3 hg blir 230 g og ikke 229,99999999999997.
  if (sym in TO_G) return { amount: Math.round(size * TO_G[sym] * 10) / 10, unit: 'g' };
  if (sym in TO_ML) return { amount: Math.round(size * TO_ML[sym] * 10) / 10, unit: 'ml' };
  return { amount: null, unit: null };
}

export function parseTjekOffer(raw: RawTjekOffer, observed: string): NormalizedOffer {
  const { amount, unit } = readAmount(raw.quantity);
  const sym = raw.quantity?.unit?.symbol?.toLowerCase();
  // «pcs»: antallet står i `size`. Med `pieces` over 1 er det flere pakker à `size` stykk (formprøven: f.eks. 2 × 8); hva
  // prisen da gjelder, vet vi ikke, så antallet er ukjent og tilbudet går til kontroll. Vektvarer med pieces > 1 merkes som
  // flerpakning i match.ts.
  const packs = exact(raw.quantity?.pieces);
  const pieces = sym === 'pcs' || sym === 'stk' ? (packs !== null && packs > 1 ? null : exact(raw.quantity?.size)) : packs;
  // Pris i annen valuta enn NOK kan ikke regnes om til øre her: ukjent pris (tilbudet går til kontroll).
  const nok = !raw.pricing?.currency || raw.pricing.currency.toUpperCase() === 'NOK';
  return {
    id: raw.id, source: 'tjek', heading: raw.heading, description: raw.description ?? null,
    priceOre: nok ? toOre(raw.pricing?.price) : null, prePriceOre: nok ? toOre(raw.pricing?.pre_price) : null,
    amount, unit, pieces: pieces !== null && pieces > 0 ? pieces : null,
    dealerId: raw.dealer_id, dealerName: raw.branding?.name ?? raw.dealer?.name ?? 'Ukjent',
    validFrom: osloDate(raw.run_from), validUntil: osloDate(raw.run_till, true), observed,
    image: httpsUrl(raw.images?.view) ?? httpsUrl(raw.images?.zoom) ?? httpsUrl(raw.images?.thumb),
  };
}

// Kundeaviser (kataloger) og sider. Formen (`/v2/catalogs`, `/v2/catalogs/:id/pages`, feltene under) er prøvd mot ekte svar
// 2026-11-22 (phase0/tjek-formprøve.md): lista har `id`, `label` (kan være tom), `branding.name`, `dealer.name`,
// `dealer.country.id`, `run_from`/`run_till` med sone og `page_count`; `pages` i lista har tomme arrayer, så sidene hentes
// for seg som en liste med `thumb`/`view`/`zoom`. `country_id` filtrerer ikke (lista har andre land), så vi filtrerer selv.
// Tolkningen er fortsatt forsiktig: ukjent form gir ingen katalog eller tomme bildeadresser, aldri en feil i appen.
const CATALOG_ID = /^[A-Za-z0-9_-]{1,64}$/;
type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? [...v.trim()].slice(0, max).join('') : null);

export function parseTjekCatalog(raw: unknown, country: string, observed: string): Catalog | null {
  const r = rec(raw);
  if (!r || typeof r.id !== 'string' || !CATALOG_ID.test(r.id)) return null;
  const c = rec(rec(r.dealer)?.country)?.id;
  if (typeof c === 'string' && c !== country) return null;
  if (typeof r.run_from !== 'string' || typeof r.run_till !== 'string' || !Number.isFinite(Date.parse(r.run_from)) || !Number.isFinite(Date.parse(r.run_till))) return null;
  const validFrom = osloDate(r.run_from), validUntil = osloDate(r.run_till, true);
  if (validUntil < validFrom) return null;
  const pc = typeof r.page_count === 'number' && Number.isInteger(r.page_count) && r.page_count > 0 && r.page_count < 1000 ? r.page_count : null;
  return {
    id: r.id, source: 'tjek', dealerId: str(r.dealer_id, 100) ?? '', dealerName: str(rec(r.branding)?.name, 100) ?? str(rec(r.dealer)?.name, 100) ?? 'Ukjent',
    label: str(r.label, 120), validFrom, validUntil, pageCount: pc, observed,
  };
}

export function parseTjekPages(raw: unknown): CatalogPage[] {
  if (!Array.isArray(raw)) return [];
  const out: CatalogPage[] = [];
  for (const p of raw.slice(0, 500)) {
    const r = rec(p);
    if (!r) continue;
    out.push({ number: out.length + 1, thumb: httpsUrl(r.thumb), view: httpsUrl(r.view), zoom: httpsUrl(r.zoom) });
  }
  return out;
}

/** Høyeste `limit` Tjek godtar (formprøven: 100 ga 100 treff, 250 ga HTTP 400). */
export const TJEK_MAX_LIMIT = 100;

type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class TjekSource implements OfferSource {
  readonly id = 'tjek';
  constructor(
    private readonly fetchImpl: Fetch,
    private readonly now: () => string,
    private readonly baseUrl = 'https://api.etilbudsavis.dk/v2',
  ) {}

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}?${new URLSearchParams(params)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Tjek svarte ${res.status} på ${path}`);
    return (await res.json()) as T;
  }

  async listDealers(country: string): Promise<Dealer[]> {
    const byId = new Map<string, Dealer>();
    for (let page = 0; page < 20; page++) {
      const raw = await this.get<{ id: string; name: string; country?: { id: string } }[]>('/dealers', {
        country_id: country, limit: '100', offset: String(page * 100),
      });
      for (const d of raw) byId.set(d.id, { id: d.id, name: d.name, country: d.country?.id ?? country });
      if (raw.length < 100) break;
    }
    // /dealers ignorerer country_id for noen land, så vi filtrerer selv.
    return [...byId.values()].filter((d) => d.country === country);
  }

  async searchOffers(q: OfferQuery): Promise<NormalizedOffer[]> {
    const limit = q.limit ?? 20;
    // `country_id` filtrerer ikke søket (formprøven: 98 av 413 treff var norske, mange søk hadde 100 treff med 12–18 norske),
    // så vi ber om Tjeks maks i ett kall og filtrerer selv. Samme antall kall som før.
    const params: Record<string, string> = { query: q.query, country_id: q.country, limit: String(TJEK_MAX_LIMIT) };
    if (q.dealerIds?.length) params.dealer_ids = q.dealerIds.join(',');
    const raw = await this.get<RawTjekOffer[]>('/offers/search', params);
    const observed = this.now();
    return raw
      .filter((o) => !o.dealer?.country?.id || o.dealer.country.id === q.country)
      .map((o) => parseTjekOffer(o, observed))
      .slice(0, limit);
  }

  /** Gjeldende kundeaviser i landet, høyst fem sider à 100. */
  async listCatalogs(country: string): Promise<Catalog[]> {
    const byId = new Map<string, Catalog>();
    for (let page = 0; page < 5; page++) {
      const raw = await this.get<unknown>('/catalogs', { country_id: country, limit: '100', offset: String(page * 100) });
      const list = Array.isArray(raw) ? raw : [];
      const observed = this.now();
      for (const r of list) { const c = parseTjekCatalog(r, country, observed); if (c && !byId.has(c.id)) byId.set(c.id, c); }
      if (list.length < 100) break;
    }
    return [...byId.values()];
  }

  /** Sidene i en kundeavis (bildeadresser hos Tjek). Ett kall per avis («1 publication open equals 1 API call», § 8.5). */
  async catalogPages(catalogId: string): Promise<CatalogPage[]> {
    if (!CATALOG_ID.test(catalogId)) throw new Error('ugyldig katalog-id');
    const res = await this.fetchImpl(`${this.baseUrl}/catalogs/${encodeURIComponent(catalogId)}/pages`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Tjek svarte ${res.status} på /catalogs/:id/pages`);
    return parseTjekPages(await res.json());
  }
}
