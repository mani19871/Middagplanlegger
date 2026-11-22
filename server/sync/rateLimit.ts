// Enkel ratebegrensning i minnet (fast vindu per nøkkel). Holder bare tellere, ingen innhold.
// Virker bare med én serverprosess. Med flere prosesser eller maskiner må tellerne flyttes til felles lagring (Redis,
// databasen) eller til proxyen foran (se docs/sikkerhet.md).
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
  /** Antall treff i gjeldende vindu, uten å telle. */
  count(key: string, windowMs: number, now: number): number {
    const cur = this.hits.get(key);
    return !cur || now - cur.start >= windowMs ? 0 : cur.n;
  }
}

/**
 * Nøkkel for ratebegrensning per klient. IPv4 (også IPv4 i IPv6-form) brukes som den er. IPv6 grupperes på /64: én
 * kunde får vanligvis et helt /64-nett og kan ellers bytte adresse for hvert forsøk.
 */
export function ipKey(raw: string): string {
  let ip = raw.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (ip.startsWith('::ffff:') && ip.includes('.')) ip = ip.slice(7);
  if (!ip.includes(':')) return ip.slice(0, 64);
  const [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  if (!ip.includes('::') && h.length !== 8) return ip.slice(0, 64);
  const groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return ip.slice(0, 64);
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}
