// Rene hjelpefunksjoner for «Tilbud nå»: filtrering, gruppering, paginering og id for manuelle avislinjer.
// Ingen klokke, nett eller lagring her. Tilbudene lagres aldri; de er bare visningsdata.
import type { LiveOffer } from '../../offers/service';

export type GroupBy = 'kjede' | 'vare';
export const PAGE_SIZE = 16;

export interface OfferGroup { key: string; label: string; items: LiveOffer[] }

/** Søk i overskrift, kjede og varenavn; tom søkestreng slipper alt gjennom. */
export function filterOffers(list: LiveOffer[], q: string, ingName: (id: string) => string): LiveOffer[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return list;
  return list.filter((l) => `${l.offer.heading} ${l.offer.dealerName} ${ingName(l.ingredient)}`.toLowerCase().includes(needle));
}

/** Grupper per kjede eller vare. Grupper sorteres på navn (nb), og tilbud i gruppen på overskrift og id, så rekkefølgen er stabil. */
export function groupOffers(list: LiveOffer[], by: GroupBy, ingName: (id: string) => string): OfferGroup[] {
  const map = new Map<string, OfferGroup>();
  for (const l of list) {
    const key = by === 'kjede' ? l.offer.dealerId : l.ingredient;
    const g = map.get(key) ?? { key, label: by === 'kjede' ? l.offer.dealerName : ingName(l.ingredient), items: [] };
    g.items.push(l);
    map.set(key, g);
  }
  const cmp = (a: string, b: string) => a.localeCompare(b, 'nb') || (a < b ? -1 : a > b ? 1 : 0);
  const groups = [...map.values()].sort((a, b) => cmp(a.label, b.label) || cmp(a.key, b.key));
  for (const g of groups) g.items.sort((a, b) => cmp(a.offer.heading, b.offer.heading) || cmp(a.offer.id, b.offer.id));
  return groups;
}

/** De første `visible` tilbudene totalt, fordelt på gruppene i rekkefølge. Tomme grupper utelates. */
export function pageGroups(groups: OfferGroup[], visible: number): { groups: OfferGroup[]; shown: number; total: number } {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  let left = Math.max(0, visible);
  const out: OfferGroup[] = [];
  for (const g of groups) {
    if (left <= 0) break;
    const items = g.items.slice(0, left);
    left -= items.length;
    out.push({ ...g, items });
  }
  return { groups: out, shown: Math.min(total, Math.max(0, visible)), total };
}

/** Linje-id for en manuell avislinje: bundet til tilbudet (`tilbud:<tilbud-id>:`) pluss en unik del, laget utenfor render. */
export const MANUAL_PREFIX = 'tilbud:';
export function manualLineId(offerKey: string, unique: string): string {
  return `${MANUAL_PREFIX}${offerKey}:${unique}`.slice(0, 100);
}
/** Har brukeren allerede en (ikke fjernet) linje for dette tilbudet? */
export function hasManualLine(lines: { id: string }[], offerKey: string): boolean {
  const p = `${MANUAL_PREFIX}${offerKey}:`.slice(0, 100 - 8);
  return lines.some((l) => l.id.startsWith(p));
}
/** Nøkkel for et tilbud: live-tilbudets id, ellers utgave + tekst for demotilbud. */
export const offerKey = (o: { editionId: string; text: string }, liveId?: string) => liveId ?? `${o.editionId}|${o.text}`;
