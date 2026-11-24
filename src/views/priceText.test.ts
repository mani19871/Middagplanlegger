import { describe, expect, it } from 'vitest';
import { norDate, priceStatusText, staleNote } from './priceText';
import { priceAgeDays } from '../engine/prices';

describe('prisstatus i visningene (E7)', () => {
  it('estimat vises med dato; andre statuser uten', () => {
    expect(priceStatusText('estimat', '2026-10-01')).toBe('estimert pris, sist sett 01.10.2026');
    expect(priceStatusText('ordinær', '2026-11-20')).toBe('ordinær pris');
    expect(priceStatusText('tilbud', '2026-11-20')).toBe('tilbud');
    expect(priceStatusText('ukjent', null)).toBe('ukjent pris');
    expect(norDate('2026-11-17T08:00:00Z')).toBe('17.11.2026');
  });
  it('forklaringen vises bare for estimat som er eldre enn grensen', () => {
    expect(staleNote('estimat', '2026-10-01', '2026-11-23')).toContain('01.10.2026');
    expect(staleNote('estimat', '2026-11-20', '2026-11-23')).toBeNull(); // estimat fra kilden, ikke gammelt
    expect(staleNote('ordinær', '2026-10-01', '2026-11-23')).toBeNull();
  });
});

describe('alder i dager (ren kalenderregning)', () => {
  it('stemmer med kalenderen over månedsskifte, skuddår og årsskifte', () => {
    // Sammenligner med Date i testen (motoren selv bruker ingen Date).
    const ref = (a: string, b: string) => (Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000;
    for (const [a, b] of [['2026-11-08', '2026-11-23'], ['2024-02-28', '2024-03-01'], ['2023-02-28', '2023-03-01'], ['2025-12-20', '2026-01-03'], ['1999-12-31', '2000-03-01'], ['2026-11-23', '2026-11-20']]) {
      expect(priceAgeDays(a, b), `${a} → ${b}`).toBe(ref(a, b));
    }
    expect(priceAgeDays('2026-02-30', '2026-03-01')).toBeNull();
    // ISO-tid med sone regnes i norsk dato (kodegjennomgang M5): 23:59Z 17.11. er 00:59 18.11. norsk tid (før: 14, UTC-dato).
    expect(priceAgeDays('2026-11-17T23:59:00Z', '2026-12-01')).toBe(13);
    expect(priceAgeDays('2026-11-17T22:59:00Z', '2026-12-01')).toBe(14); // 23:59 17.11. norsk tid
  });
});
