import type { LiveOffer } from './service';
export interface LiveResponse { status: 'ok' | 'loading' | 'error'; error: string | null; source: string; observed: string | null; offers: LiveOffer[] }
export async function fetchLiveOffers(signal?: AbortSignal): Promise<LiveResponse> {
  const res = await fetch('/api/offers', { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as LiveResponse;
}
