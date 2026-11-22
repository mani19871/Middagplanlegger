// Enkel ratebegrensning i minnet (fast vindu per nøkkel). Holder bare tellere, ingen innhold.
// Med flere serverprosesser må dette flyttes til felles lagring (se docs/synk.md).
export class RateLimiter {
  private hits = new Map<string, { start: number; n: number }>();
  /** Teller et treff. Returnerer false når grensen er nådd i vinduet. */
  hit(key: string, limit: number, windowMs: number, now: number): boolean {
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (now - v.start >= windowMs) this.hits.delete(k);
    const cur = this.hits.get(key);
    if (!cur || now - cur.start >= windowMs) { this.hits.set(key, { start: now, n: 1 }); return true; }
    cur.n += 1;
    return cur.n <= limit;
  }
}
