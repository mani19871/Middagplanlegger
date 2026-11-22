import { describe, expect, it } from 'vitest';
import { sourceLine } from './LiveOffers';

const base = { status: 'ok' as const, error: null, source: 'tjek', offers: [] };
describe('sourceLine («Kilde: Tjek» med dato)', () => {
  it('live: kilde og når tilbudene ble lest', () => {
    expect(sourceLine({ ...base, observed: '2026-11-23T08:00:00.000Z' })).toMatch(/^Kilde: Tjek \(ekte tilbud, ikke demodata\)\. Lest \d/);
  });
  it('lagret: når de sist ble hentet, og at noen priser er sett tidligere', () => {
    const s = sourceLine({ ...base, stored: true, observed: '2026-11-24T08:00:00.000Z', oldestObserved: '2026-11-20T08:00:00.000Z' });
    expect(s).toMatch(/^Kilde: Tjek .*Sist hentet \d.*Noen priser ble sist sett \d/);
    expect(sourceLine({ ...base, stored: true, observed: '2026-11-24T08:00:00.000Z', oldestObserved: '2026-11-24T07:00:00.000Z' })).not.toMatch(/Noen priser/);
  });
});
