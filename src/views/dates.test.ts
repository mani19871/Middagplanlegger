import { describe, expect, it } from 'vitest';
import { editionInPeriod, isoDate } from './dates';

const e = { validFrom: '2026-11-16', validTo: '2026-11-22' };
describe('editionInPeriod', () => {
  it('denne: gyldig på dagen, inkludert første og siste dag', () => {
    expect(editionInPeriod(e, 'denne', '2026-11-16')).toBe(true);
    expect(editionInPeriod(e, 'denne', '2026-11-22')).toBe(true);
    expect(editionInPeriod(e, 'denne', '2026-11-15')).toBe(false);
    expect(editionInPeriod(e, 'denne', '2026-11-23')).toBe(false);
  });
  it('kommende: starter etter dagen', () => {
    expect(editionInPeriod(e, 'kommende', '2026-11-15')).toBe(true);
    expect(editionInPeriod(e, 'kommende', '2026-11-16')).toBe(false);
  });
  it('flytter seg med injisert dato (ikke fast)', () => {
    const next = { validFrom: '2026-11-23', validTo: '2026-11-29' };
    expect(editionInPeriod(next, 'kommende', isoDate(new Date(2026, 10, 22)))).toBe(true);
    expect(editionInPeriod(next, 'denne', isoDate(new Date(2026, 10, 25)))).toBe(true);
  });
});
