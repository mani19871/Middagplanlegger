// Utboks for hendelser. Hendelser legges i loggen lokalt med en gang (virker uten nett) og i utboksen til de er
// levert. `EventTransport` implementeres mot synk-serveren i src/sync/api.ts. Mottakeren er idempotent på
// hendelses-id (som `applyEvent`), så en levering som avbrytes og sendes på nytt ikke gir doble rader.
import type { InventoryEvent } from '../engine/inventory';

export interface EventTransport<E extends { id: string } = InventoryEvent> {
  /** Sender hendelser i rekkefølge. Returnerer id-ene mottakeren har lagret (også de den hadde fra før). */
  push(events: E[]): Promise<string[]>;
}

/** Legger en hendelse i utboksen. Samme id to ganger gir én rad. */
export function enqueue<E extends { id: string }>(outbox: E[], e: E): E[] {
  return outbox.some((x) => x.id === e.id) ? outbox : [...outbox, e];
}

/**
 * Spiller av utboksen i rekkefølge. Bekreftede hendelser fjernes; resten blir liggende til neste forsøk.
 * Feiler leveringen, beholdes hele utboksen uendret.
 */
export async function flush<E extends { id: string }>(outbox: E[], transport: EventTransport<E> | null): Promise<{ outbox: E[]; sent: string[] }> {
  if (!transport || outbox.length === 0) return { outbox, sent: [] };
  try {
    const accepted = new Set(await transport.push(outbox));
    return { outbox: outbox.filter((e) => !accepted.has(e.id)), sent: outbox.filter((e) => accepted.has(e.id)).map((e) => e.id) };
  } catch {
    return { outbox, sent: [] };
  }
}
