import type { LiveOffer } from './service';
export interface LiveResponse {
  status: 'ok' | 'loading' | 'error'; error: string | null; source: string;
  /** Når tilbudene sist ble hentet fra kilden (ikke når de ble lest). */
  observed: string | null; offers: LiveOffer[];
  /** Svaret kommer fra serverens tilbudslagring (/api/offers/lagret), ikke bare minnet. */
  stored?: boolean;
  /** Eldste observasjonstid blant tilbudene i svaret (lagret: et tilbud kan være sett ved en tidligere henting). */
  oldestObserved?: string | null;
  /** Flere tilbud enn svaret har plass til. */
  truncated?: boolean;
}

async function get(url: string, signal?: AbortSignal): Promise<LiveResponse> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as LiveResponse;
}

/**
 * Tilbud til appen. Lagrede tilbud fra serveren (/api/offers/lagret) brukes når de finnes; ellers live (/api/offers).
 * Lagres aldri i appens tilstand eller synkdata. Er begge nede, vises svaret fra lagringen hvis det kom et; ellers kastes feilen.
 */
export async function fetchLiveOffers(signal?: AbortSignal): Promise<LiveResponse> {
  let stored: LiveResponse | null = null;
  try {
    stored = await get('/api/offers/lagret', signal);
    if (stored.status === 'ok') return stored;
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  try {
    return await get('/api/offers', signal);
  } catch (e) {
    if (stored && !signal?.aborted) return stored;
    throw e;
  }
}
