// SyncStorage med node:sqlite (innebygd i Node 22, ingen ekstern tjeneste). Skrivinger kjøres i BEGIN IMMEDIATE-
// transaksjoner, så samtidige skrivinger (også fra flere prosesser med WAL) serialiseres. I én Node-prosess er hver
// metode i tillegg synkron og dermed atomisk. `:memory:` brukes i tester.
import { DatabaseSync } from 'node:sqlite';
import type { DocName } from '../../src/sync/docs';
import type { Role, Stream } from '../../src/sync/protocol';
import type { DeviceRow, DocOut, EventIn, JoinResult, NewDevice, PutDocResult, ReadResult, SyncStorage } from './types';

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
  PRIMARY KEY (household_id, name));
`;

interface DeviceDb { id: string; household_id: string; public_id: string; label: string; role: string; created_at: string; last_seen: string | null; revoked_at: string | null }
const toDevice = (r: DeviceDb): DeviceRow => ({
  id: r.id, householdId: r.household_id, publicId: r.public_id, label: r.label, role: r.role as Role,
  createdAt: r.created_at, lastSeen: r.last_seen, revokedAt: r.revoked_at,
});
const DEVICE_COLS = 'id, household_id, public_id, label, role, created_at, last_seen, revoked_at';

export class SqliteStorage implements SyncStorage {
  private db: DatabaseSync;
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(SCHEMA);
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
        .run(d.id, householdId, d.publicId, d.label, 'eier', d.tokenHash, now, now);
      return this.device(d.id);
    });
  }

  async authenticate(tokenHash: string, now: string): Promise<DeviceRow | null> {
    const r = this.db.prepare(`SELECT ${DEVICE_COLS} FROM devices WHERE token_hash = ? AND revoked_at IS NULL`).get(tokenHash) as DeviceDb | undefined;
    if (!r) return null;
    // «Sist sett» lagres med minutt-oppløsning: nok til medlemslista, mindre bruksmønster lagret.
    const minute = `${now.slice(0, 16)}:00.000Z`;
    if (r.last_seen !== minute) this.db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').run(minute, r.id);
    return toDevice({ ...r, last_seen: minute });
  }

  async members(householdId: string): Promise<DeviceRow[]> {
    return (this.db.prepare(`SELECT ${DEVICE_COLS} FROM devices WHERE household_id = ? ORDER BY created_at, id`).all(householdId) as unknown as DeviceDb[]).map(toDevice);
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

  async join(codeHash: string, d: NewDevice, now: string): Promise<JoinResult> {
    return this.tx((): JoinResult => {
      const inv = this.db.prepare('SELECT id, household_id FROM invites WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?')
        .get(codeHash, now) as { id: string; household_id: string } | undefined;
      if (!inv) return { ok: false, code: 'ugyldig_kode' };
      const existing = this.db.prepare('SELECT id, revoked_at FROM devices WHERE household_id = ? AND public_id = ?')
        .get(inv.household_id, d.publicId) as { id: string; revoked_at: string | null } | undefined;
      if (existing && existing.revoked_at === null) return { ok: false, code: 'enhet_finnes' };
      let id = d.id;
      if (existing) {
        // En fjernet enhet som blir invitert på nytt får tilbake sin offentlige id med nytt token.
        id = existing.id;
        this.db.prepare("UPDATE devices SET token_hash = ?, label = ?, role = 'voksen', revoked_at = NULL, last_seen = ? WHERE id = ?")
          .run(d.tokenHash, d.label, now, id);
      } else {
        this.db.prepare("INSERT INTO devices (id, household_id, public_id, label, role, token_hash, created_at, last_seen) VALUES (?, ?, ?, ?, 'voksen', ?, ?, ?)")
          .run(d.id, inv.household_id, d.publicId, d.label, d.tokenHash, now, now);
      }
      this.db.prepare('UPDATE invites SET used_at = ?, used_by = ? WHERE id = ?').run(now, id, inv.id);
      return { ok: true, device: this.device(id) };
    });
  }

  async revoke(householdId: string, deviceId: string, now: string): Promise<boolean> {
    return this.tx(() => {
      const r = this.db.prepare("UPDATE devices SET token_hash = NULL, revoked_at = ?, role = 'voksen' WHERE id = ? AND household_id = ? AND revoked_at IS NULL")
        .run(now, deviceId, householdId);
      return Number(r.changes) > 0;
    });
  }

  async leave(householdId: string, deviceId: string, now: string): Promise<{ deletedHousehold: boolean }> {
    return this.tx(() => {
      const me = this.device(deviceId);
      this.db.prepare("UPDATE devices SET token_hash = NULL, revoked_at = ?, role = 'voksen' WHERE id = ? AND household_id = ?").run(now, deviceId, householdId);
      const rest = this.db.prepare('SELECT id, role FROM devices WHERE household_id = ? AND revoked_at IS NULL ORDER BY created_at, id')
        .all(householdId) as { id: string; role: string }[];
      if (rest.length === 0) {
        this.db.prepare('DELETE FROM households WHERE id = ?').run(householdId);
        return { deletedHousehold: true };
      }
      if (me.role === 'eier' && !rest.some((r) => r.role === 'eier')) this.db.prepare("UPDATE devices SET role = 'eier' WHERE id = ?").run(rest[0].id);
      return { deletedHousehold: false };
    });
  }

  async deleteHousehold(householdId: string): Promise<void> {
    this.tx(() => { this.db.prepare('DELETE FROM households WHERE id = ?').run(householdId); });
  }

  async appendEvents(householdId: string, deviceId: string, events: EventIn[], now: string): Promise<string[]> {
    return this.tx(() => {
      const has = this.db.prepare('SELECT 1 FROM events WHERE household_id = ? AND id = ?');
      const ins = this.db.prepare('INSERT INTO events (household_id, id, seq, stream, body, device_id, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const ids: string[] = [];
      for (const e of events) {
        if (!has.get(householdId, e.id)) ins.run(householdId, e.id, this.nextSeq(householdId), e.stream, e.body, deviceId, now);
        ids.push(e.id);
      }
      return ids;
    });
  }

  async readSince(householdId: string, after: number, limit: number): Promise<ReadResult> {
    const rows = this.db.prepare('SELECT seq, stream, body FROM events WHERE household_id = ? AND seq > ? ORDER BY seq LIMIT ?')
      .all(householdId, after, limit + 1) as { seq: number; stream: Stream; body: string }[];
    const more = rows.length > limit;
    const events = rows.slice(0, limit);
    const head = (this.db.prepare('SELECT seq FROM households WHERE id = ?').get(householdId) as { seq: number } | undefined)?.seq ?? 0;
    const cursor = more ? events[events.length - 1].seq : Math.max(after, head);
    const docs = (this.db.prepare('SELECT name, version, body, updated_by, updated_at FROM docs WHERE household_id = ? AND seq > ? AND seq <= ? ORDER BY name')
      .all(householdId, after, cursor) as { name: DocName; version: number; body: string; updated_by: string; updated_at: string }[])
      .map((r): DocOut => ({ name: r.name, version: r.version, body: r.body, updatedBy: r.updated_by, updatedAt: r.updated_at }));
    return { events, docs, cursor, more };
  }

  async putDoc(householdId: string, name: DocName, baseVersion: number, body: string, updatedBy: string, now: string): Promise<PutDocResult> {
    return this.tx((): PutDocResult => {
      const cur = this.db.prepare('SELECT name, version, body, updated_by, updated_at FROM docs WHERE household_id = ? AND name = ?')
        .get(householdId, name) as { name: DocName; version: number; body: string; updated_by: string; updated_at: string } | undefined;
      const version = cur?.version ?? 0;
      if (baseVersion !== version) {
        return { ok: false, current: cur ? { name, version, body: cur.body, updatedBy: cur.updated_by, updatedAt: cur.updated_at } : null };
      }
      const seq = this.nextSeq(householdId);
      this.db.prepare(`INSERT INTO docs (household_id, name, version, body, seq, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (household_id, name) DO UPDATE SET version = excluded.version, body = excluded.body, seq = excluded.seq,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at`).run(householdId, name, version + 1, body, seq, updatedBy, now);
      return { ok: true, version: version + 1 };
    });
  }

  async close(): Promise<void> { this.db.close(); }
}
