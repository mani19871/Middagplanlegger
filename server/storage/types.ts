// Lagringsgrensesnitt for synk. Alt er avgrenset til én husstand. Async, så en PostgreSQL-implementasjon kan settes
// inn uten å endre API-et (se docs/synk.md). Hver metode er én transaksjon.
// Ingen tilbudsinnhold fra Tjek lagres her (se CLAUDE.md og THIRD_PARTY.md).
import type { DocName } from '../../src/sync/docs';
import type { Role, Stream } from '../../src/sync/protocol';

export interface DeviceRow {
  /** Intern id (aldri sendt til andre medlemmer). */
  id: string; householdId: string;
  /** Offentlig enhets-id: brukes som `by` i hendelser og vises som etikett. */
  publicId: string; label: string; role: Role; createdAt: string; lastSeen: string | null; revokedAt: string | null;
}
export interface NewDevice { id: string; publicId: string; label: string; tokenHash: string }
export interface EventIn { stream: Stream; id: string; by: string; body: string }
export interface EventOut { seq: number; stream: Stream; body: string }
export interface DocOut { name: DocName; version: number; body: string; updatedBy: string; updatedAt: string }
export interface ReadResult { events: EventOut[]; docs: DocOut[]; cursor: number; more: boolean }
export type JoinResult = { ok: true; device: DeviceRow } | { ok: false; code: 'ugyldig_kode' | 'enhet_finnes' };
export type PutDocResult = { ok: true; version: number } | { ok: false; current: DocOut | null };

export interface SyncStorage {
  createHousehold(householdId: string, device: NewDevice, now: string): Promise<DeviceRow>;
  /** Aktiv enhet med denne tokenhashen, ellers null. Oppdaterer «sist sett». */
  authenticate(tokenHash: string, now: string): Promise<DeviceRow | null>;
  /** Alle enheter som har vært medlem (også fjernede, så etiketter og offentlige id-er ikke kan gjenbrukes av andre). */
  members(householdId: string): Promise<DeviceRow[]>;
  setLabel(householdId: string, deviceId: string, label: string): Promise<void>;
  createInvite(householdId: string, invite: { id: string; codeHash: string; createdBy: string; expiresAt: string }, now: string): Promise<void>;
  activeInvites(householdId: string, now: string): Promise<{ id: string; expiresAt: string }[]>;
  deleteInvite(householdId: string, id: string): Promise<boolean>;
  /** Bruker invitasjonen og legger til enheten i én transaksjon. Koden virker bare én gang og bare før utløp. */
  join(codeHash: string, device: NewDevice, now: string): Promise<JoinResult>;
  /** Tilbakekaller tokenet. Raden beholdes (uten tokenhash) så den offentlige id-en ikke kan tas av en annen. */
  revoke(householdId: string, deviceId: string, now: string): Promise<boolean>;
  /** Enheten forlater. Eier som går gir eierskap til eldste gjenværende; siste som går sletter husstanden. */
  leave(householdId: string, deviceId: string, now: string): Promise<{ deletedHousehold: boolean }>;
  /** Sletter husstanden og alle data (medlemmer, invitasjoner, hendelser, dokumenter). */
  deleteHousehold(householdId: string): Promise<void>;
  /** Lagrer hendelser idempotent på (husstand, id). Returnerer id-ene som nå finnes (nye og gamle). */
  appendEvents(householdId: string, deviceId: string, events: EventIn[], now: string): Promise<string[]>;
  readSince(householdId: string, after: number, limit: number): Promise<ReadResult>;
  /** Skriver dokumentet hvis baseVersion er gjeldende versjon (0 = finnes ikke). Ellers returneres gjeldende versjon. */
  putDoc(householdId: string, name: DocName, baseVersion: number, body: string, updatedBy: string, now: string): Promise<PutDocResult>;
  close(): Promise<void>;
}
