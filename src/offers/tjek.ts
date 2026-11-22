// Tjek (etilbudsavis) som tilbudskilde. Grensesnittet og tolkingen av svaret er inspirert av
// tilbudstrolden-mcp (MIT, © 2026 Olga Safonova), se THIRD_PARTY.md.
// Bruk forutsetter skriftlig avtale/vilkår fra Tjek om visnings- og viderebruksrett.
import type { Unit } from '../engine/types';
import type { Dealer, NormalizedOffer, OfferQuery, OfferSource } from './types';

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
}

const toOre = (kr: number | null | undefined) => (typeof kr !== 'number' || !Number.isFinite(kr) ? null : Math.round(kr * 100));

/**
 * Dato (YYYY-MM-DD) i norsk tid for et tidspunkt fra Tjek. Tjek oppgir tid med sone (ofte UTC), så de ti første tegnene
 * er ikke nødvendigvis den norske datoen. Slutt nøyaktig ved midnatt er eksklusiv og gjelder ikke den nye dagen.
 */
const OSLO = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' });
export function osloDate(iso: string, end = false): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso.slice(0, 10);
  return OSLO.format(new Date(end ? t - 1000 : t));
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
  const pieces = sym === 'pcs' || sym === 'stk' ? exact(raw.quantity?.size) : exact(raw.quantity?.pieces);
  // Pris i annen valuta enn NOK kan ikke regnes om til øre her: ukjent pris (tilbudet går til kontroll).
  const nok = !raw.pricing?.currency || raw.pricing.currency.toUpperCase() === 'NOK';
  return {
    id: raw.id, source: 'tjek', heading: raw.heading, description: raw.description ?? null,
    priceOre: nok ? toOre(raw.pricing?.price) : null, prePriceOre: nok ? toOre(raw.pricing?.pre_price) : null,
    amount, unit, pieces: pieces !== null && pieces > 0 ? pieces : null,
    dealerId: raw.dealer_id, dealerName: raw.branding?.name ?? raw.dealer?.name ?? 'Ukjent',
    validFrom: osloDate(raw.run_from), validUntil: osloDate(raw.run_till, true), observed,
  };
}

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
    const params: Record<string, string> = { query: q.query, country_id: q.country, limit: String(limit * 3) };
    if (q.dealerIds?.length) params.dealer_ids = q.dealerIds.join(',');
    const raw = await this.get<RawTjekOffer[]>('/offers/search', params);
    const observed = this.now();
    return raw
      .filter((o) => !o.dealer?.country?.id || o.dealer.country.id === q.country)
      .map((o) => parseTjekOffer(o, observed))
      .slice(0, limit);
  }
}
