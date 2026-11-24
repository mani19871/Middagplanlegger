// Norsk dato uten klokke eller Intl i motoren (kodegjennomgang runde 2, M5). Regelen sammenlignes med tidssonedatabasen.
import { describe, expect, it } from 'vitest';
import { civilDay, dayToIso, osloDate, osloMidnightUtc } from './oslo';

const intl = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' });

describe('osloDate (ren regel for norsk dato)', () => {
  it('gir samme dato som Europe/Oslo i tidssonedatabasen hver 20. minutt rundt alle sommertidsskifter 2000–2040', () => {
    let checked = 0;
    for (let y = 2000; y <= 2040; y++) {
      for (const mo of [3, 10]) {
        for (let d = 24; d <= 31; d++) {
          for (let m = -120; m < 24 * 60 + 120; m += 20) {
            const t = Date.UTC(y, mo - 1, d) + m * 60_000;
            const iso = new Date(t).toISOString();
            expect(osloDate(iso), iso).toBe(intl.format(new Date(t)));
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(50_000);
  });
  it('gir samme dato som Europe/Oslo gjennom hele 2024–2027 (hver 7. time og 13. minutt)', () => {
    for (let t = Date.UTC(2024, 0, 1); t < Date.UTC(2028, 0, 1); t += (7 * 60 + 13) * 60_000) {
      const iso = new Date(t).toISOString();
      expect(osloDate(iso), iso).toBe(intl.format(new Date(t)));
    }
  });
  it('tid med annen sone, bare dato og tid uten sone', () => {
    expect(osloDate('2026-11-22T23:00:00+0000')).toBe('2026-11-23');
    expect(osloDate('2026-11-23T00:30:00+01:00')).toBe('2026-11-23');
    expect(osloDate('2026-11-22T18:30:00-05:00')).toBe('2026-11-23');
    expect(osloDate('2026-11-22')).toBe('2026-11-22');
    expect(osloDate('2026-11-22T23:30:00')).toBe('2026-11-22'); // uten sone: allerede lokal tid
    expect(osloDate('2026-12-31T23:30:00.000Z')).toBe('2027-01-01');
  });
  it('ugyldig tekst gir null', () => {
    for (const bad of ['', 'i går', '2026-02-30', '2026-13-01', '2026-11-22T25:00:00Z', '2026-11-22T10:61:00Z', '2026-11-22T10:00:00+25:00']) {
      expect(osloDate(bad), bad).toBeNull();
    }
  });
  it('norsk midnatt i UTC, vinter og sommer', () => {
    expect(osloMidnightUtc('2026-11-10')).toBe('2026-11-09T23:00:00.000Z');
    expect(osloMidnightUtc('2026-06-10')).toBe('2026-06-09T22:00:00.000Z');
    expect(osloMidnightUtc('2026-03-29')).toBe('2026-03-28T23:00:00.000Z'); // skiftedagen: midnatt er fortsatt vintertid
    expect(osloMidnightUtc('2026-10-25')).toBe('2026-10-24T22:00:00.000Z');
    expect(osloMidnightUtc('2026-02-30')).toBeNull();
    for (let d = civilDay(2025, 1, 1)!; d < civilDay(2027, 1, 1)!; d++) {
      const day = dayToIso(d);
      const t = Date.parse(osloMidnightUtc(day)!);
      expect(intl.format(new Date(t)), day).toBe(day);
      expect(intl.format(new Date(t - 1000)), day).toBe(dayToIso(d - 1));
    }
  });
  it('dayToIso og civilDay er omvendte', () => {
    for (let d = -700_000; d < 800_000; d += 997) {
      const iso = dayToIso(d);
      expect(civilDay(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)))).toBe(d);
    }
    expect(dayToIso(0)).toBe('1970-01-01');
  });
});
