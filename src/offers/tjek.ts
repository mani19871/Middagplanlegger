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

const toOre = (kr: number | null | undefined) => (kr === null || kr === undefined ? null : Math.round(kr * 100));

/** Mengde i g/ml via SI-faktor (kg → g, dl → ml). Andre enheter blir ukjent mengde. */
function readAmount(q: RawTjekOffer['quantity']): { amount: number | null; unit: Unit | null } {
  const size = q?.size?.from ?? null;
  const unit = q?.unit;
  if (size === null || size <= 0 || !unit) return { amount: null, unit: null };
  const si = unit.si?.symbol ?? unit.symbol;
  const factor = unit.si?.factor ?? 1;
  if (si === 'g') return { amount: size * factor, unit: 'g' };
  if (si === 'ml' || si === 'l') return { amount: si === 'l' ? size * factor * 1000 : size * factor, unit: 'ml' };
  return { amount: null, unit: null };
}

export function parseTjekOffer(raw: RawTjekOffer, observed: string): NormalizedOffer {
  const { amount, unit } = readAmount(raw.quantity);
  const pieces = raw.quantity?.pieces?.from ?? null;
  return {
    id: raw.id, source: 'tjek', heading: raw.heading, description: raw.description ?? null,
    priceOre: toOre(raw.pricing?.price), prePriceOre: toOre(raw.pricing?.pre_price),
    amount, unit, pieces: pieces !== null && pieces > 0 ? pieces : null,
    dealerId: raw.dealer_id, dealerName: raw.branding?.name ?? raw.dealer?.name ?? 'Ukjent',
    validFrom: raw.run_from, validUntil: raw.run_till, observed,
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
