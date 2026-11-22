import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { offerConfigFrom } from './config';

describe('offerConfigFrom', () => {
  it('standard: lagring på, henting på, egen fil i DATA_DIR, 6 t, 180 dager, 1000 kall per døgn', () => {
    expect(offerConfigFrom({ DATA_DIR: '/data' })).toEqual({
      store: true, fetch: true, db: join('/data', 'tilbud.sqlite'), refreshMs: 6 * 3_600_000, retentionDays: 180, maxCallsPerDay: 1000,
    });
  });
  it('kan slås av og settes', () => {
    const c = offerConfigFrom({ OFFER_STORE: '0', TJEK_FETCH: '0', OFFER_DB: ':memory:', OFFER_REFRESH_HOURS: '12', OFFER_RETENTION_DAYS: '0', OFFER_MAX_CALLS_PER_DAY: '50' });
    expect(c).toEqual({ store: false, fetch: false, db: ':memory:', refreshMs: 12 * 3_600_000, retentionDays: 0, maxCallsPerDay: 50 });
  });
  it('ugyldige verdier gir standard og advarsel (aldri hyppigere enn hver time, aldri ubegrenset)', () => {
    const warns: string[] = [];
    const c = offerConfigFrom({ OFFER_REFRESH_HOURS: '0.1', OFFER_RETENTION_DAYS: '-1', OFFER_MAX_CALLS_PER_DAY: 'mange' }, (m) => warns.push(m));
    expect([c.refreshMs, c.retentionDays, c.maxCallsPerDay]).toEqual([6 * 3_600_000, 180, 1000]);
    expect(warns.length).toBe(3);
  });
});
