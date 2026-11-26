// Tall til /healthz (driftsstatus, docs/drift/driftstatus.sh). Bare tall og ja/nei, aldri tekst, antall husstander eller innhold.
import { describe, expect, it } from 'vitest';
import { createHealthExtra, healthFields } from './health';
import { SqliteOfferStore } from './offers/sqlite';

const NOW = Date.parse('2026-11-26T12:00:00.000Z');
const store = async (lastFetch: string | null) => {
  const s = new SqliteOfferStore(':memory:');
  if (lastFetch) await s.setLastFetch(lastFetch);
  return s;
};

describe('healthFields: bare tall og ja/nei slipper ut', () => {
  it('beholder tall, boolske verdier og null; fjerner tekst, objekter, lister, negative og ugyldige tall og rare nøkler', () => {
    const out = healthFields({
      ok: true, minutes: 12.9, none: null, text: 'hemmelig', obj: { a: 1 }, list: [1], neg: -1, nan: Number.NaN, inf: Infinity,
      'a b': 1, '1x': 1, ['x'.repeat(41)]: 1, fn: () => 1, big: 1e12,
    } as unknown as Record<string, unknown>);
    expect(out).toEqual({ ok: true, minutes: 12, none: null });
  });
  it('gir tomt svar for noe som ikke er et objekt', () => {
    expect(healthFields(null)).toEqual({});
    expect(healthFields('tekst' as unknown as Record<string, unknown>)).toEqual({});
    expect(healthFields([1, 2] as unknown as Record<string, unknown>)).toEqual({});
  });
});

describe('createHealthExtra', () => {
  it('regner alder på siste vellykkede henting i hele minutter fra den lagrede tiden, og oppetid i minutter', async () => {
    const s = await store('2026-11-26T09:30:30.000Z');
    const extra = createHealthExtra({ offerStore: s, fetchOn: true, collector: () => ({ failures: 0 }), now: () => NOW, startedAtMs: NOW - 90 * 60_000 });
    expect(await extra()).toEqual({ offersFetch: true, offersLastRunAgeMinutes: 149, offersFailures: 0, offersDbOk: true, uptimeMinutes: 90 });
  });
  it('null når ingen henting er gjort; feilteller fra innsamleren', async () => {
    const s = await store(null);
    const extra = createHealthExtra({ offerStore: s, fetchOn: true, collector: () => ({ failures: 3 }), now: () => NOW, startedAtMs: NOW });
    expect(await extra()).toEqual({ offersFetch: true, offersLastRunAgeMinutes: null, offersFailures: 3, offersDbOk: true, uptimeMinutes: 0 });
  });
  it('en hentetid fram i tid (klokkeavvik) gir 0, aldri negativt tall; en ugyldig lagret tid gir null', async () => {
    const future = createHealthExtra({ offerStore: await store('2026-11-26T13:00:00.000Z'), fetchOn: true, collector: () => null, now: () => NOW, startedAtMs: NOW });
    expect((await future()).offersLastRunAgeMinutes).toBe(0);
    const bad = createHealthExtra({ offerStore: await store('ikke en tid'), fetchOn: true, collector: () => null, now: () => NOW, startedAtMs: NOW });
    expect((await bad()).offersLastRunAgeMinutes).toBeNull();
  });
  it('uten tilbudslagring: offersDbOk er null; henting av (TJEK_FETCH=0) gir offersFetch false', async () => {
    const extra = createHealthExtra({ offerStore: null, fetchOn: false, collector: () => null, now: () => NOW, startedAtMs: NOW });
    expect(await extra()).toEqual({ offersFetch: false, offersLastRunAgeMinutes: null, offersFailures: 0, offersDbOk: null, uptimeMinutes: 0 });
  });
  it('tilbudsdatabasen som ikke svarer gir offersDbOk false og alder null, uten å kaste', async () => {
    const s = await store('2026-11-26T11:00:00.000Z');
    await s.close();
    const extra = createHealthExtra({ offerStore: s, fetchOn: true, collector: () => ({ failures: 0 }), now: () => NOW, startedAtMs: NOW });
    expect(await extra()).toMatchObject({ offersDbOk: false, offersLastRunAgeMinutes: null });
  });
  it('svaret har bare tall og ja/nei', async () => {
    const extra = createHealthExtra({ offerStore: await store('2026-11-26T11:00:00.000Z'), fetchOn: true, collector: () => ({ failures: 1 }), now: () => NOW, startedAtMs: NOW });
    for (const v of Object.values(await extra())) expect(['number', 'boolean', 'object']).toContain(typeof v);
  });
});
