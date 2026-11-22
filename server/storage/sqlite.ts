// SyncStorage med node:sqlite (innebygd i Node 22, ingen ekstern tjeneste). Skrivinger kjøres i BEGIN IMMEDIATE-
// transaksjoner, så samtidige skrivinger (også fra flere prosesser med WAL) serialiseres. I én Node-prosess er hver
// metode i tillegg synkron og dermed atomisk. `:memory:` brukes i tester.
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { LIMITS } from '../../src/sync/protocol';
import type { DocName } from '../../src/sync/docs';
import type { Role, Stream } from '../../src/sync/protocol';
import {
  QuotaExceededError, REMOVED_LABEL,
  type DeviceRow, type DocOut, type EventDump, type EventIn, type HouseholdDump, type EventQuota, type JoinResult, type MemberQuota, type NewDevice, type PutDocResult,
  type ReadResult, type SyncStorage,
} from './types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS households (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, seq INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL, label TEXT NOT NULL, role TEXT NOT NULL, token_hash TEXT UNIQUE,
  created_at TEXT NOT NULL, last_seen TEXT, revoked_at TEXT, UNIQUE (household_id, public_id));
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  used_at TEXT, used_by TEXT);
CREATE TABLE IF NOT EXISTS events (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, id TEXT NOT NULL, seq INTEGER NOT NULL,
  stream TEXT NOT NULL, body TEXT NOT NULL, device_id TEXT NOT NULL, received_at TEXT NOT NULL,
  PRIMARY KEY (household_id, id));
CREATE INDEX IF NOT EXISTS events_seq ON events (household_id, seq);
CREATE TABLE IF NOT EXISTS docs (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE, name TEXT NOT NULL, version INTEGER NOT NULL,
  body TEXT NOT NULL, seq INTEGER NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL,
  revs TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (household_id, name));
`;

/**
 * Versjons-id (rev) for en dokumentversjon: innholdsadressert, sha256 av forrige rev, versjonsnummer og innhold (12 hex).
 * Samme innhold på samme grunnlag gir samme rev, så en enhet som sender det samme igjen etter en gjenoppretting, ikke
 * lager en ny slekt. `revs` er de siste `LIMITS.docRevs` rev-ene (eldst først): slekten enhetene bruker til å se om
 * serveren har mistet en versjon de har sett, og om serverens versjon er eldre eller nyere enn deres (docs/synk.md).
 */
export const docRev = (prev: string, version: number, body: string) =>
  createHash('sha256').update(`${prev}\n${version}\n${body}`).digest('hex').slice(0, 12);
const parseRevs = (t: string | null | undefined): string[] => {
  try { const v = JSON.parse(t ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
};
interface DocDb { name: DocName; version: number; body: string; updated_by: string; updated_at: string; revs: string }
const DOC_COLS = 'name, version, body, updated_by, updated_at, revs';
const toDoc = (r: DocDb): DocOut => ({ name: r.name, version: r.version, body: r.body, updatedBy: r.updated_by, updatedAt: r.updated_at, revs: parseRevs(r.revs) });

interface DeviceDb { id: string; household_id: string; public_id: string; label: string; role: string; created_at: string; last_seen: string | null; revoked_at: string | null }
const toDevice = (r: DeviceDb): DeviceRow => ({
  id: r.id, householdId: r.household_id, publicId: r.public_id, label: r.label, role: r.role as Role,
  createdAt: r.created_at, lastSeen: r.last_seen, revokedAt: r.revoked_at,
});
const DEVICE_COLS = 'id, household_id, public_id, label, role, created_at, last_seen, revoked_at';
/** «Sist sett» lagres med minutt-oppløsning (også ved oppretting og innmelding; runde 2, S12). */
const toMinute = (iso: string) => `${iso.slice(0, 16)}:00.000Z`;

export class SqliteStorage implements SyncStorage {
  private db: DatabaseSync;
  private wal: boolean;
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.wal = path !== ':memory:';
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(SCHEMA);
    this.migrate();
  }

  private migrate() {
    const cols = (table: string) => (this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    // Slekt for dokumenter (S1/S2 i docs/kodegjennomgang.md): eldre rader får én rev regnet av gjeldende versjon og innhold.
    if (!cols('docs').includes('revs')) {
      this.tx(() => {
        this.db.exec("ALTER TABLE docs ADD COLUMN revs TEXT NOT NULL DEFAULT '[]'");
        const rows = this.db.prepare('SELECT household_id, name, version, body FROM docs').all() as { household_id: string; name: string; version: number; body: string }[];
        const upd = this.db.prepare('UPDATE docs SET revs = ? WHERE household_id = ? AND name = ?');
        for (const r of rows) upd.run(JSON.stringify([docRev('', r.version, r.body)]), r.household_id, r.name);
      });
    }
    // Tellere for kvoter (antall og byte hendelser per husstand). Legges til og fylles én gang i eldre databaser.
    if (cols('households').includes('event_bytes')) return;
    this.tx(() => {
      this.db.exec('ALTER TABLE households ADD COLUMN event_count INTEGER NOT NULL DEFAULT 0');
      this.db.exec('ALTER TABLE households ADD COLUMN event_bytes INTEGER NOT NULL DEFAULT 0');
      this.db.exec(`UPDATE households SET
        event_count = (SELECT COUNT(*) FROM events e WHERE e.household_id = households.id),
        event_bytes = (SELECT COALESCE(SUM(LENGTH(CAST(body AS BLOB))), 0) FROM events e WHERE e.household_id = households.id)`);
    });
  }

  private tx<T>(f: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const r = f(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  private nextSeq(householdId: string): number {
    this.db.prepare('UPDATE households SET seq = seq + 1 WHERE id = ?').run(householdId);
    return (this.db.prepare('SELECT seq FROM households WHERE id = ?').get(householdId) as { seq: number }).seq;
  }
  private device(id: string): DeviceRow {
    return toDevice(this.db.prepare(`SELECT ${DEVICE_COLS} FROM devices WHERE id = ?`).get(id) as unknown as DeviceDb);
  }

  async createHousehold(householdId: string, d: NewDevice, now: string): Promise<DeviceRow> {
    return this.tx(() => {
      this.db.prepare('INSERT INTO households (id, created_at) VALUES (?, ?)').run(householdId, now);
      this.db.prepare('INSERT INTO devices (id, household_id, public_id, label, role, token_hash, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(d.id, householdId, d.publicId, d.label, 'eier', d.tokenHash, now, toMinute(now));
      return this.device(d.id);
    });
  }

  async authenticate(tokenHash: string, now: string, idleBefore?: string): Promise<DeviceRow | null> {
    const r = this.db.prepare(`SELECT ${DEVICE_COLS} FROM devices WHERE token_hash = ? AND revoked_at IS NULL`).get(tokenHash) as DeviceDb | undefined;
    if (!r) return null;
    if (idleBefore && (r.last_seen ?? r.created_at) < idleBefore) {
      // Utløpt etter lang inaktivitet: enheten forlater husstanden (eierskap går videre; siste som går sletter alt).
      this.tx(() => this.leaveTx(r.household_id, r.id, now));
      this.scrub();
      return null;
    }
    // «Sist sett» lagres med minutt-oppløsning: nok til medlemslista, mindre bruksmønster lagret.
    const minute = toMinute(now);
    if (r.last_seen !== minute) this.db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').run(minute, r.id);
    return toDevice({ ...r, last_seen: minute });
  }

  async members(householdId: string): Promise<DeviceRow[]> {
    return (this.db.prepare(`SELECT ${DEVICE_COLS} FROM devices WHERE household_id = ? ORDER BY created_at, rowid`).all(householdId) as unknown as DeviceDb[]).map(toDevice);
  }

  async setLabel(householdId: string, deviceId: string, label: string): Promise<void> {
    this.db.prepare('UPDATE devices SET label = ? WHERE id = ? AND household_id = ?').run(label, deviceId, householdId);
  }

  async createInvite(householdId: string, i: { id: string; codeHash: string; createdBy: string; expiresAt: string }, now: string): Promise<void> {
    this.tx(() => {
      // Utløpte og brukte invitasjoner ryddes bort med en gang.
      this.db.prepare('DELETE FROM invites WHERE household_id = ? AND (used_at IS NOT NULL OR expires_at <= ?)').run(householdId, now);
      this.db.prepare('INSERT INTO invites (id, household_id, code_hash, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(i.id, householdId, i.codeHash, i.createdBy, now, i.expiresAt);
    });
  }

  async activeInvites(householdId: string, now: string) {
    return (this.db.prepare('SELECT id, expires_at FROM invites WHERE household_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY expires_at')
      .all(householdId, now) as { id: string; expires_at: string }[]).map((r) => ({ id: r.id, expiresAt: r.expires_at }));
  }

  async deleteInvite(householdId: string, id: string): Promise<boolean> {
    return Number(this.db.prepare('DELETE FROM invites WHERE household_id = ? AND id = ?').run(householdId, id).changes) > 0;
  }

  async join(codeHash: string, d: NewDevice, now: string, quota?: MemberQuota): Promise<JoinResult> {
    return this.tx((): JoinResult => {
      const inv = this.db.prepare('SELECT id, household_id FROM invites WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?')
        .get(codeHash, now) as { id: string; household_id: string } | undefined;
      if (!inv) return { ok: false, code: 'ugyldig_kode' };
      const existing = this.db.prepare('SELECT id, revoked_at FROM devices WHERE household_id = ? AND public_id = ?')
        .get(inv.household_id, d.publicId) as { id: string; revoked_at: string | null } | undefined;
      if (existing && existing.revoked_at === null) return { ok: false, code: 'enhet_finnes' };
      if (quota) {
        // Koden brukes ikke opp når husstanden er full.
        const n = this.db.prepare('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE revoked_at IS NULL) AS active FROM devices WHERE household_id = ?')
          .get(inv.household_id) as { total: number; active: number };
        if (n.active >= quota.active || (!existing && n.total >= quota.total)) return { ok: false, code: 'kvote_full' };
      }
      let id = d.id;
      if (existing) {
        // En fjernet enhet som blir invitert på nytt får tilbake sin offentlige id med nytt token.
        id = existing.id;
        this.db.prepare("UPDATE devices SET token_hash = ?, label = ?, role = 'voksen', revoked_at = NULL, last_seen = ? WHERE id = ?")
          .run(d.tokenHash, d.label, toMinute(now), id);
      } else {
        this.db.prepare("INSERT INTO devices (id, household_id, public_id, label, role, token_hash, created_at, last_seen) VALUES (?, ?, ?, ?, 'voksen', ?, ?, ?)")
          .run(d.id, inv.household_id, d.publicId, d.label, d.tokenHash, now, toMinute(now));
      }
      this.db.prepare('UPDATE invites SET used_at = ?, used_by = ? WHERE id = ?').run(now, id, inv.id);
      return { ok: true, device: this.device(id) };
    });
  }

  async revoke(householdId: string, deviceId: string, now: string): Promise<boolean> {
    const changed = this.tx(() => {
      const r = this.db.prepare("UPDATE devices SET token_hash = NULL, revoked_at = ?, role = 'voksen', label = ?, last_seen = NULL WHERE id = ? AND household_id = ? AND revoked_at IS NULL")
        .run(now, REMOVED_LABEL, deviceId, householdId);
      return Number(r.changes) > 0;
    });
    if (changed) this.scrub();
    return changed;
  }

  async leave(householdId: string, deviceId: string, now: string): Promise<{ deletedHousehold: boolean }> {
    const r = this.tx(() => this.leaveTx(householdId, deviceId, now));
    this.scrub();
    return r;
  }
  private leaveTx(householdId: string, deviceId: string, now: string): { deletedHousehold: boolean } {
    const me = this.device(deviceId);
    this.db.prepare("UPDATE devices SET token_hash = NULL, revoked_at = ?, role = 'voksen', label = ?, last_seen = NULL WHERE id = ? AND household_id = ?")
      .run(now, REMOVED_LABEL, deviceId, householdId);
    const rest = this.db.prepare('SELECT id, role FROM devices WHERE household_id = ? AND revoked_at IS NULL ORDER BY created_at, rowid')
      .all(householdId) as { id: string; role: string }[];
    if (rest.length === 0) {
      this.db.prepare('DELETE FROM households WHERE id = ?').run(householdId);
      return { deletedHousehold: true };
    }
    if (me.role === 'eier' && !rest.some((r) => r.role === 'eier')) this.db.prepare("UPDATE devices SET role = 'eier' WHERE id = ?").run(rest[0].id);
    return { deletedHousehold: false };
  }

  async deleteHousehold(householdId: string): Promise<void> {
    this.tx(() => { this.db.prepare('DELETE FROM households WHERE id = ?').run(householdId); });
    this.scrub();
  }

  /**
   * Etter sletting og anonymisering: `secure_delete` overskriver sidene i databasefilen først når WAL-filen skrives
   * tilbake (checkpoint). Til da ligger gamle sider (etiketter, hendelser) i `-wal`. TRUNCATE skriver alt tilbake og
   * tømmer WAL-filen med en gang. Gjelder ikke sikkerhetskopier (egen slettefrist, docs/sikkerhet.md).
   */
  private scrub() {
    if (!this.wal) return;
    try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch { /* opptatt av en leser: neste checkpoint tar det */ }
  }

  async appendEvents(householdId: string, deviceId: string, events: EventIn[], now: string, quota?: EventQuota): Promise<string[]> {
    return this.tx(() => {
      const has = this.db.prepare('SELECT 1 FROM events WHERE household_id = ? AND id = ?');
      const ins = this.db.prepare('INSERT INTO events (household_id, id, seq, stream, body, device_id, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const ids: string[] = [];
      const seen = new Set<string>();
      let count = 0, bytes = 0;
      for (const e of events) {
        ids.push(e.id);
        if (seen.has(e.id) || has.get(householdId, e.id)) continue;
        seen.add(e.id);
        const size = Buffer.byteLength(e.body, 'utf8');
        ins.run(householdId, e.id, this.nextSeq(householdId), e.stream, e.body, deviceId, now);
        count += 1; bytes += size;
      }
      if (count > 0) {
        this.db.prepare('UPDATE households SET event_count = event_count + ?, event_bytes = event_bytes + ? WHERE id = ?').run(count, bytes, householdId);
        if (quota) {
          const u = this.db.prepare('SELECT event_count, event_bytes FROM households WHERE id = ?').get(householdId) as { event_count: number; event_bytes: number };
          // Kaster inne i transaksjonen: alt over rulles tilbake.
          if (u.event_count > quota.events || u.event_bytes > quota.bytes) throw new QuotaExceededError();
          if (quota.totalBytes !== undefined) {
            const all = (this.db.prepare('SELECT COALESCE(SUM(event_bytes), 0) AS n FROM households').get() as { n: number }).n;
            if (all > quota.totalBytes) throw new QuotaExceededError();
          }
        }
      }
      return ids;
    });
  }

  /** Bruk per husstand (antall og byte hendelser). Til kvoter, drift og tester; inneholder ikke data. */
  usage(householdId: string): { events: number; bytes: number } {
    const u = this.db.prepare('SELECT event_count, event_bytes FROM households WHERE id = ?').get(householdId) as { event_count: number; event_bytes: number } | undefined;
    return { events: u?.event_count ?? 0, bytes: u?.event_bytes ?? 0 };
  }

  async readSince(householdId: string, after: number, limit: number): Promise<ReadResult> {
    const rows = this.db.prepare('SELECT seq, stream, body FROM events WHERE household_id = ? AND seq > ? ORDER BY seq LIMIT ?')
      .all(householdId, after, limit + 1) as { seq: number; stream: Stream; body: string }[];
    const more = rows.length > limit;
    const events = rows.slice(0, limit);
    const head = (this.db.prepare('SELECT seq FROM households WHERE id = ?').get(householdId) as { seq: number } | undefined)?.seq ?? 0;
    // Cursor står alltid på en hendelse (eller blir stående), aldri på en dokumentskriving: ankeret («seq:id» for siste
    // hendelse) dekker da hele cursoren, også etter en gjenoppretting (S2). Dokumenter sendes etter enhetens dokumentanker.
    const cursor = events.length > 0 ? events[events.length - 1].seq : after;
    // Eldre klienter uten dokumentanker: dokumenter skrevet etter `after` (de som er like, ignoreres av klienten).
    const docs = (this.db.prepare(`SELECT ${DOC_COLS} FROM docs WHERE household_id = ? AND seq > ? AND seq <= ? ORDER BY name`)
      .all(householdId, after, more ? cursor : head) as unknown as DocDb[]).map(toDoc);
    return { events, docs, cursor, more, head };
  }

  async currentDocs(householdId: string): Promise<DocOut[]> {
    return (this.db.prepare(`SELECT ${DOC_COLS} FROM docs WHERE household_id = ? ORDER BY name`).all(householdId) as unknown as DocDb[]).map(toDoc);
  }

  async eventIdAt(householdId: string, seq: number): Promise<string | null> {
    const r = this.db.prepare('SELECT id FROM events WHERE household_id = ? AND seq = ?').get(householdId, seq) as { id: string } | undefined;
    return r?.id ?? null;
  }

  async ping(): Promise<void> { this.db.prepare('SELECT 1').get(); }

  async exportHousehold(householdId: string): Promise<HouseholdDump | null> {
    // Én lesetransaksjon: medlemmer, invitasjoner og dokumenter hører sammen. Ingen await inne i den (samme tilkobling).
    this.db.exec('BEGIN');
    try {
      const h = this.db.prepare('SELECT created_at, seq FROM households WHERE id = ?').get(householdId) as { created_at: string; seq: number } | undefined;
      if (!h) return null;
      const invites = (this.db.prepare('SELECT created_at, expires_at, used_at, created_by, used_by FROM invites WHERE household_id = ? ORDER BY created_at, rowid')
        .all(householdId) as { created_at: string; expires_at: string; used_at: string | null; created_by: string; used_by: string | null }[])
        .map((r) => ({ createdAt: r.created_at, expiresAt: r.expires_at, usedAt: r.used_at, createdBy: r.created_by, usedBy: r.used_by }));
      const docs = (this.db.prepare(`SELECT ${DOC_COLS} FROM docs WHERE household_id = ? ORDER BY name`).all(householdId) as unknown as DocDb[]).map(toDoc);
      const devices = (this.db.prepare(`SELECT ${DEVICE_COLS} FROM devices WHERE household_id = ? ORDER BY created_at, rowid`).all(householdId) as unknown as DeviceDb[]).map(toDevice);
      return { createdAt: h.created_at, seq: h.seq, devices, invites, docs };
    } finally { this.db.exec('COMMIT'); }
  }

  async exportEvents(householdId: string, after: number, upTo: number, limit: number): Promise<EventDump[]> {
    return (this.db.prepare('SELECT seq, stream, body, received_at, device_id FROM events WHERE household_id = ? AND seq > ? AND seq <= ? ORDER BY seq LIMIT ?')
      .all(householdId, after, upTo, limit) as { seq: number; stream: Stream; body: string; received_at: string; device_id: string }[])
      .map((r) => ({ seq: r.seq, stream: r.stream, body: r.body, receivedAt: r.received_at, deviceId: r.device_id }));
  }

  async deleteInactive(before: string, limit: number): Promise<number> {
    const n = this.tx(() => {
      // Siste aktivitet: seneste «sist sett» blant enhetene (fjernede har ingen), ellers opprettet. ISO-tekst sorterer som tid.
      const ids = this.db.prepare(`SELECT h.id FROM households h
        WHERE MAX(h.created_at, COALESCE((SELECT MAX(d.last_seen) FROM devices d WHERE d.household_id = h.id), '')) < ? LIMIT ?`)
        .all(before, limit) as { id: string }[];
      const del = this.db.prepare('DELETE FROM households WHERE id = ?');
      for (const r of ids) del.run(r.id);
      return ids.length;
    });
    if (n > 0) this.scrub();
    return n;
  }

  /** Konsistent kopi mens serveren kjører (VACUUM INTO). Filen må ikke finnes fra før. */
  backupTo(path: string): void { this.db.prepare('VACUUM INTO ?').run(path); }

  async putDoc(householdId: string, name: DocName, baseVersion: number, body: string, updatedBy: string, now: string): Promise<PutDocResult> {
    return this.tx((): PutDocResult => {
      const row = this.db.prepare(`SELECT ${DOC_COLS} FROM docs WHERE household_id = ? AND name = ?`).get(householdId, name) as unknown as DocDb | undefined;
      const cur = row ? toDoc(row) : undefined;
      const version = cur?.version ?? 0;
      if (baseVersion !== version) return { ok: false, current: cur ?? null };
      const seq = this.nextSeq(householdId);
      const revs = [...(cur?.revs ?? []), docRev(cur?.revs.at(-1) ?? '', version + 1, body)].slice(-LIMITS.docRevs);
      this.db.prepare(`INSERT INTO docs (household_id, name, version, body, seq, updated_by, updated_at, revs) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (household_id, name) DO UPDATE SET version = excluded.version, body = excluded.body, seq = excluded.seq,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at, revs = excluded.revs`)
        .run(householdId, name, version + 1, body, seq, updatedBy, now, JSON.stringify(revs));
      return { ok: true, version: version + 1, revs };
    });
  }

  /** Antall rader per tabell (til tester og drift; inneholder ikke data). */
  counts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const t of ['households', 'devices', 'invites', 'events', 'docs']) out[t] = (this.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
    return out;
  }

  async close(): Promise<void> { this.db.close(); }
}
