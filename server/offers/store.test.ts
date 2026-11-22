// Lagring av tilbud og priser fra Tjek (server/offers/sqlite.ts). Egen database, ingen husstandsdata, ingen persondata.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { NormalizedOffer } from '../../src/offers/types';
import { SqliteOfferStore } from './sqlite';
import { OFFER_LIMITS } from './types';

const offer = (id: string, over: Partial<NormalizedOffer> = {}): NormalizedOffer => ({
  id, source: 'tjek', heading: 'Torskefilet', description: null, priceOre: 7990, prePriceOre: 9990, amount: 400, unit: 'g', pieces: null,
  dealerId: 'd1', dealerName: 'Coop Obs!', validFrom: '2026-11-23', validUntil: '2026-11-29', observed: '2026-11-23T08:00:00.000Z', ...over,
});

let dir: string | null = null;
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = null; });

describe('SqliteOfferStore', () => {
  it('lagrer kilde, kjede, dato observert, gyldighet, pris i øre, mengde og status', async () => {
    const s = new SqliteOfferStore(':memory:');
    await s.record([offer('a'), offer('b', { priceOre: null })], 'NO', '2026-11-23T08:00:05.000Z');
    const rows = await s.current({ today: '2026-11-24', observedSince: '2026-11-10', limit: 100 });
    expect(rows.map((r) => [r.id, r.source, r.chain, r.country, r.priceOre, r.amount, r.unit, r.status, r.validFrom, r.validUntil, r.firstObserved, r.lastObserved])).toEqual([
      ['a', 'tjek', 'COOP OBS', 'NO', 7990, 400, 'g', 'tilbud', '2026-11-23', '2026-11-29', '2026-11-23T08:00:00.000Z', '2026-11-23T08:00:00.000Z'],
      ['b', 'tjek', 'COOP OBS', 'NO', null, 400, 'g', 'ukjent', '2026-11-23', '2026-11-29', '2026-11-23T08:00:00.000Z', '2026-11-23T08:00:00.000Z'],
    ]);
    await s.close();
  });

  it('er idempotent på (kilde, id): samme tilbud to ganger gir én rad, og første observasjon står', async () => {
    const s = new SqliteOfferStore(':memory:');
    await s.record([offer('a')], 'NO', '2026-11-23T08:00:05.000Z');
    expect(await s.record([offer('a')], 'NO', '2026-11-23T08:00:05.000Z')).toEqual({ inserted: 0, updated: 0, seen: 0, skipped: 0 });
    const again = await s.record([offer('a', { observed: '2026-11-24T08:00:00.000Z' })], 'NO', '2026-11-24T08:00:05.000Z');
    expect(again).toEqual({ inserted: 0, updated: 0, seen: 1, skipped: 0 });
    const [r] = await s.current({ today: '2026-11-24', observedSince: '2026-11-10', limit: 100 });
    expect([r.firstObserved, r.lastObserved]).toEqual(['2026-11-23T08:00:00.000Z', '2026-11-24T08:00:00.000Z']);
    expect((await s.counts()).observations).toBe(1);
    // Samme id fra en annen kilde er en annen observasjon.
    await s.record([offer('a', { source: 'annen' })], 'NO', '2026-11-24T08:00:05.000Z');
    expect((await s.counts()).observations).toBe(2);
  });

  it('ny pris under samme id får sin egen observasjonsdato; en eldre observasjon overskriver aldri en nyere', async () => {
    const s = new SqliteOfferStore(':memory:');
    await s.record([offer('a')], 'NO', '2026-11-23T08:00:05.000Z');
    await s.record([offer('a', { priceOre: 6990, observed: '2026-11-25T08:00:00.000Z' })], 'NO', '2026-11-25T08:00:05.000Z');
    await s.record([offer('a', { priceOre: 1, observed: '2026-11-24T08:00:00.000Z' })], 'NO', '2026-11-25T09:00:00.000Z');
    const [r] = await s.current({ today: '2026-11-25', observedSince: '2026-11-10', limit: 100 });
    expect([r.priceOre, r.firstObserved, r.lastObserved]).toEqual([6990, '2026-11-25T08:00:00.000Z', '2026-11-25T08:00:00.000Z']);
  });

  it('observasjonsdato er når kilden så prisen (aldri lesetidspunktet), og klippes aldri fram i tid', async () => {
    const s = new SqliteOfferStore(':memory:');
    await s.record([offer('a', { observed: '2026-11-20T08:00:00.000Z' }), offer('b', { observed: '2027-01-01T00:00:00.000Z' }), offer('c', { observed: 'ikke en dato' })],
      'NO', '2026-11-23T08:00:05.000Z');
    const rows = await s.current({ today: '2026-11-24', observedSince: '2026-11-10', limit: 100 });
    expect(rows.map((r) => [r.id, r.lastObserved])).toEqual([['a', '2026-11-20T08:00:00.000Z'], ['b', '2026-11-23T08:00:05.000Z'], ['c', '2026-11-23T08:00:05.000Z']]);
  });

  it('current: bare gyldige i dag eller kommende innen 7 dager, og bare sett innenfor aldersgrensen', async () => {
    const s = new SqliteOfferStore(':memory:');
    await s.record([
      offer('na'), offer('utlopt', { validFrom: '2026-11-10', validUntil: '2026-11-16' }),
      offer('kommende', { validFrom: '2026-11-30', validUntil: '2026-12-06' }), offer('fjern', { validFrom: '2027-01-10', validUntil: '2027-01-16' }),
      offer('gammel', { observed: '2026-11-01T08:00:00.000Z', validFrom: '2026-11-01', validUntil: '2026-12-31' }),
    ], 'NO', '2026-11-23T08:00:05.000Z');
    const rows = await s.current({ today: '2026-11-24', observedSince: '2026-11-10', limit: 100 });
    expect(rows.map((r) => r.id).sort()).toEqual(['kommende', 'na']);
    expect((await s.current({ today: '2026-11-24', observedSince: '2026-11-10', limit: 1 })).length).toBe(1);
  });

  it('avviser ugyldige rader og korter ned lange tekster (størrelsesgrenser)', async () => {
    const s = new SqliteOfferStore(':memory:');
    const r = await s.record([
      offer('x'.repeat(OFFER_LIMITS.id + 1)), offer('dato', { validFrom: 'snart' }), offer('pris', { priceOre: -5 }), offer('flyt', { priceOre: 12.5 }),
      offer('lang', { heading: 'T'.repeat(5000), description: 'b'.repeat(5000), dealerName: 'K'.repeat(500) }),
    ], 'NO', '2026-11-23T08:00:05.000Z');
    expect(r).toEqual({ inserted: 1, updated: 0, seen: 0, skipped: 4 });
    const [row] = await s.current({ today: '2026-11-24', observedSince: '2026-11-10', limit: 100 });
    expect([row.heading.length, row.description!.length, row.dealerName.length]).toEqual([OFFER_LIMITS.heading, OFFER_LIMITS.description, OFFER_LIMITS.dealerName]);
  });

  it('kvote: over maks antall rader lagres ingen nye (eksisterende oppdateres fortsatt)', async () => {
    const s = new SqliteOfferStore(':memory:', { maxRows: 2 });
    await s.record([offer('a'), offer('b')], 'NO', '2026-11-23T08:00:05.000Z');
    const r = await s.record([offer('c'), offer('a', { observed: '2026-11-24T08:00:00.000Z' })], 'NO', '2026-11-24T08:00:05.000Z');
    expect(r).toEqual({ inserted: 0, updated: 0, seen: 1, skipped: 1 });
    expect((await s.counts()).observations).toBe(2);
  });

  it('oppbevaring: sletter bare utløpte rader som ikke er sett etter fristen', async () => {
    const s = new SqliteOfferStore(':memory:');
    await s.record([
      offer('gammel', { validFrom: '2026-01-01', validUntil: '2026-01-07', observed: '2026-01-02T08:00:00.000Z' }),
      offer('gyldig-lenge', { validFrom: '2026-01-01', validUntil: '2026-12-31', observed: '2026-01-02T08:00:00.000Z' }),
      offer('ny', { validFrom: '2026-11-01', validUntil: '2026-11-07', observed: '2026-11-02T08:00:00.000Z' }),
    ], 'NO', '2026-11-23T08:00:05.000Z');
    expect(await s.deleteBefore('2026-06-01T00:00:00.000Z', 100)).toBe(1);
    expect((await s.counts()).observations).toBe(2);
  });

  it('husker siste vellykkede henting over omstart (egen fil, ikke synk-databasen)', async () => {
    dir = mkdtempSync(join(tmpdir(), 'tilbud-'));
    const path = join(dir, 'tilbud.sqlite');
    let s = new SqliteOfferStore(path);
    await s.record([offer('a')], 'NO', '2026-11-23T08:00:05.000Z');
    await s.setLastFetch('2026-11-23T08:00:05.000Z');
    await s.close();
    s = new SqliteOfferStore(path);
    expect(await s.lastFetch()).toBe('2026-11-23T08:00:05.000Z');
    expect((await s.current({ today: '2026-11-24', observedSince: '2026-11-10', limit: 10 })).map((r) => r.id)).toEqual(['a']);
    await s.close();
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path).includes(Buffer.from('households'))).toBe(false);
  });

  it('tabellen har ingen husstands- eller persondata (ingen husstand, enhet, token, etikett, IP eller postnummer)', () => {
    const s = new SqliteOfferStore(':memory:');
    const db = (s as unknown as { db: DatabaseSync }).db;
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name).sort();
    expect(tables).toEqual(['offer_meta', 'offer_observations']);
    for (const t of tables) {
      const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name).join(' ');
      expect(cols).not.toMatch(/(^|[\s_])(household|device|token|label|ip|postal|user|member|address)s?([\s_]|$)/i);
    }
  });
});
