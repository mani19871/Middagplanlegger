// OfferStore med node:sqlite i en egen databasefil (OFFER_DB, standard $DATA_DIR/tilbud.sqlite), ikke synk-databasen.
// Ingen husstand, ingen enhet, ingen persondata: bare tilbud og priser slik kilden viste dem, med når de ble sett.
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { normalizeChain } from '../../src/engine/chains';
import type { Unit } from '../../src/engine/types';
import { httpsUrl } from '../../src/offers/tjek';
import type { NormalizedOffer } from '../../src/offers/types';
import { OFFER_LIMITS, type CurrentQuery, type OfferObservation, type OfferStore, type RecordResult } from './types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS offer_observations (
  source TEXT NOT NULL, id TEXT NOT NULL, chain TEXT NOT NULL, country TEXT NOT NULL,
  dealer_id TEXT NOT NULL, dealer_name TEXT NOT NULL, heading TEXT NOT NULL, description TEXT,
  price_ore INTEGER, pre_price_ore INTEGER, amount REAL, unit TEXT, pieces INTEGER,
  valid_from TEXT NOT NULL, valid_until TEXT NOT NULL, status TEXT NOT NULL,
  content TEXT NOT NULL, first_observed TEXT NOT NULL, last_observed TEXT NOT NULL, image TEXT,
  PRIMARY KEY (source, id));
CREATE INDEX IF NOT EXISTS offer_observations_valid ON offer_observations (valid_until, valid_from);
CREATE TABLE IF NOT EXISTS offer_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UNITS: Unit[] = ['g', 'ml', 'stk'];
const cut = (s: string, n: number) => [...s].slice(0, n).join('');
const okOre = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n < 100_000_000);
const okNum = (n: number | null) => n === null || (Number.isFinite(n) && n > 0 && n < 1e7);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

interface Row {
  source: string; id: string; chain: string; country: string; dealer_id: string; dealer_name: string; heading: string; description: string | null;
  price_ore: number | null; pre_price_ore: number | null; amount: number | null; unit: string | null; pieces: number | null;
  valid_from: string; valid_until: string; status: string; content: string; first_observed: string; last_observed: string;
  /** Adressen til produktbildet hos kilden (tekst; bildet lastes aldri ned eller lagres her). */
  image: string | null;
}
const toObs = (r: Row): OfferObservation => ({
  source: r.source, id: r.id, chain: r.chain, country: r.country, dealerId: r.dealer_id, dealerName: r.dealer_name, heading: r.heading,
  description: r.description, priceOre: r.price_ore, prePriceOre: r.pre_price_ore, amount: r.amount, unit: (r.unit as Unit | null) ?? null,
  pieces: r.pieces, validFrom: r.valid_from, validUntil: r.valid_until, status: r.status === 'tilbud' ? 'tilbud' : 'ukjent',
  firstObserved: r.first_observed, lastObserved: r.last_observed, image: r.image ?? null,
});

/** Et tilbud som rad, eller null hvis det ikke kan lagres (ugyldig id, dato eller tall). Tekster kortes ned. */
function toRow(o: NormalizedOffer, country: string, receivedAt: string): Omit<Row, 'first_observed' | 'last_observed'> & { observed: string } | null {
  const L = OFFER_LIMITS;
  if (typeof o.id !== 'string' || !o.id || [...o.id].length > L.id || typeof o.source !== 'string' || !o.source || o.source.length > L.source) return null;
  const from = String(o.validFrom ?? '').slice(0, 10), until = String(o.validUntil ?? '').slice(0, 10);
  if (!DATE.test(from) || !DATE.test(until) || until < from) return null;
  if (!okOre(o.priceOre) || !okOre(o.prePriceOre) || !okNum(o.amount) || !okNum(o.pieces)) return null;
  if (o.unit !== null && !UNITS.includes(o.unit)) return null;
  const t = Date.parse(o.observed), r = Date.parse(receivedAt);
  // Observasjonstiden er når kilden viste tilbudet. Ugyldig eller fram i tid: mottakstiden (aldri senere enn den).
  const observed = Number.isFinite(t) && t <= r ? new Date(t).toISOString() : new Date(r).toISOString();
  const dealerName = cut(String(o.dealerName ?? ''), L.dealerName);
  const row = {
    source: o.source, id: o.id, chain: normalizeChain(dealerName), country: cut(country, 2), dealer_id: cut(String(o.dealerId ?? ''), L.dealerId),
    dealer_name: dealerName, heading: cut(String(o.heading ?? ''), L.heading), description: o.description == null ? null : cut(String(o.description), L.description),
    price_ore: o.priceOre, pre_price_ore: o.prePriceOre, amount: o.amount, unit: o.unit, pieces: o.pieces === null ? null : Math.round(o.pieces),
    valid_from: from, valid_until: until, status: o.priceOre === null ? 'ukjent' : 'tilbud', image: httpsUrl(o.image),
  };
  // Innholdet som avgjør om det er «samme pris»: alt unntatt observasjonstidene og bildeadressen (et nytt bilde er ikke en
  // ny pris, og gir ikke ny første observasjon).
  const { image: _image, ...priced } = row;
  const content = createHash('sha256').update(JSON.stringify(priced)).digest('hex').slice(0, 16);
  return { ...row, content, observed };
}

export class SqliteOfferStore implements OfferStore {
  private db: DatabaseSync;
  private maxRows: number;
  constructor(path = ':memory:', opts: { maxRows?: number } = {}) {
    this.db = new DatabaseSync(path);
    this.maxRows = opts.maxRows ?? OFFER_LIMITS.maxRows;
    this.db.exec('PRAGMA busy_timeout = 5000;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(SCHEMA);
    // Eldre tilbudsdatabase uten bildekolonne (før kundeaviser fra Tjek): legg den til.
    const cols = (this.db.prepare('PRAGMA table_info(offer_observations)').all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes('image')) this.db.exec('ALTER TABLE offer_observations ADD COLUMN image TEXT');
  }

  private tx<T>(f: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const r = f(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }

  async record(offers: NormalizedOffer[], country: string, receivedAt: string): Promise<RecordResult> {
    const out: RecordResult = { inserted: 0, updated: 0, seen: 0, skipped: 0 };
    const get = this.db.prepare('SELECT content, last_observed FROM offer_observations WHERE source = ? AND id = ?');
    const count = this.db.prepare('SELECT COUNT(*) AS n FROM offer_observations');
    const ins = this.db.prepare(`INSERT INTO offer_observations (source, id, chain, country, dealer_id, dealer_name, heading, description,
      price_ore, pre_price_ore, amount, unit, pieces, valid_from, valid_until, status, image, content, first_observed, last_observed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const upd = this.db.prepare(`UPDATE offer_observations SET chain = ?, country = ?, dealer_id = ?, dealer_name = ?, heading = ?, description = ?,
      price_ore = ?, pre_price_ore = ?, amount = ?, unit = ?, pieces = ?, valid_from = ?, valid_until = ?, status = ?, image = ?, content = ?,
      first_observed = ?, last_observed = ? WHERE source = ? AND id = ?`);
    const seen = this.db.prepare('UPDATE offer_observations SET last_observed = ?, image = ? WHERE source = ? AND id = ?');
    this.tx(() => {
      let rows = (count.get() as { n: number }).n;
      for (const o of offers.slice(0, OFFER_LIMITS.perRecord)) {
        const r = toRow(o, country, receivedAt);
        if (!r) { out.skipped++; continue; }
        const cur = get.get(r.source, r.id) as { content: string; last_observed: string } | undefined;
        const vals = [r.chain, r.country, r.dealer_id, r.dealer_name, r.heading, r.description, r.price_ore, r.pre_price_ore, r.amount, r.unit, r.pieces,
          r.valid_from, r.valid_until, r.status, r.image, r.content] as const;
        if (!cur) {
          if (rows >= this.maxRows) { out.skipped++; continue; }
          ins.run(r.source, r.id, ...vals, r.observed, r.observed);
          rows++; out.inserted++;
        } else if (r.observed <= cur.last_observed) {
          if (r.content !== cur.content) out.skipped++; // eldre observasjon med annet innhold: den nyere står
        } else if (r.content === cur.content) {
          seen.run(r.observed, r.image, r.source, r.id); out.seen++;
        } else {
          upd.run(...vals, r.observed, r.observed, r.source, r.id); out.updated++;
        }
      }
      out.skipped += Math.max(0, offers.length - OFFER_LIMITS.perRecord);
    });
    return out;
  }

  async current(q: CurrentQuery): Promise<OfferObservation[]> {
    const limit = Math.max(0, Math.min(Math.floor(q.limit), OFFER_LIMITS.maxRows));
    const rows = this.db.prepare(`SELECT * FROM offer_observations WHERE valid_until >= ? AND valid_from <= ? AND last_observed >= ?
      ORDER BY source, id LIMIT ?`).all(q.today, addDays(q.today, 7), q.observedSince, limit) as unknown as Row[];
    return rows.map(toObs);
  }

  async deleteBefore(before: string, limit: number): Promise<number> {
    const day = before.slice(0, 10);
    return this.tx(() => Number(this.db.prepare(`DELETE FROM offer_observations WHERE rowid IN (
      SELECT rowid FROM offer_observations WHERE valid_until < ? AND last_observed < ? LIMIT ?)`).run(day, before, limit).changes));
  }

  async lastFetch(): Promise<string | null> {
    return (this.db.prepare("SELECT value FROM offer_meta WHERE key = 'last_fetch'").get() as { value: string } | undefined)?.value ?? null;
  }
  async setLastFetch(at: string): Promise<void> {
    this.db.prepare("INSERT INTO offer_meta (key, value) VALUES ('last_fetch', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(at);
  }
  async counts() {
    const r = this.db.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT chain) AS c FROM offer_observations').get() as { n: number; c: number };
    return { observations: r.n, chains: r.c };
  }
  async ping() { this.db.prepare('SELECT 1').get(); }
  async close() { this.db.close(); }
}
