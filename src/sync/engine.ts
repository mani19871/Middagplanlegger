// Synk-runde for én enhet: lever utboksene, hent alt nytt etter cursor, flett, og send endrede dokumenter.
// Offline-first: all skriving skjer lokalt først (store.ts); denne koden flytter bare data mellom enheten og serveren.
// Hver tilstandsendring gjøres som en funksjon av siste tilstand (`io.set`), så brukerens endringer underveis
// aldri overskrives.
import { applyEvents, type InventoryEvent } from '../engine/inventory';
import { applyChange, type ListChange } from '../engine/substitution';
import type { AppState, DocConflict } from '../store';
import { applyListEvents, type ListEvent } from './list';
import { DOC_NAMES, fieldsOf, fromFields, isValidDoc, merge3, stable, type DocBody, type DocName, type PlanDoc, type SettingsDoc } from './docs';
import { HttpTransport, SyncError, type SyncApi } from './api';
import { LIMITS, type DocVersion, type Envelope, type MemberInfo } from './protocol';
import { defaultSettings } from '../data/defaults';

export interface SyncIO { get(): AppState; set(f: (s: AppState) => AppState): void }

export function docBody(s: AppState, name: DocName): DocBody {
  if (name === 'plan') return { slots: s.slots, approved: s.approved, option: s.option };
  // Uten matskap og uten kostkrav/allergier (LOCAL_ONLY_SETTINGS): de blir på enheten.
  const { pantry: _p, avoid: _a, avoidFoods: _f, vegetarian: _v, ...rest } = s.settings;
  void _p; void _a; void _f; void _v;
  return rest;
}
export function withDoc(s: AppState, name: DocName, body: DocBody): AppState {
  if (name === 'plan') { const p = body as PlanDoc; return { ...s, slots: p.slots, approved: p.approved, option: p.option }; }
  const local = { avoid: s.settings.avoid, avoidFoods: s.settings.avoidFoods, vegetarian: s.settings.vegetarian };
  return { ...s, settings: { ...defaultSettings, ...(body as SettingsDoc), ...local, pantry: {} } };
}
export const isDirty = (s: AppState, name: DocName) => {
  const m = s.sync?.docs[name];
  return !m || stable(docBody(s, name)) !== stable(m.base);
};

/**
 * Tar inn en dokumentversjon fra serveren. Ikke endret lokalt: overta. Endret lokalt: tre-veis fletting.
 * Felt begge har endret ulikt blir en konflikt; lokal verdi beholdes og ingenting sendes før brukeren har valgt.
 */
export function receiveDoc(s: AppState, d: DocVersion): AppState {
  const sync = s.sync;
  if (!sync || !isValidDoc(d.name, d.body)) return s;
  const meta = sync.docs[d.name];
  if (meta && meta.version >= d.version) return s;
  const local = docBody(s, d.name);
  const docs = { ...sync.docs, [d.name]: { version: d.version, base: d.body } };
  // Første gang (nettopp med i husstanden) eller uendret lokalt: husstandens versjon gjelder.
  if (!meta || stable(local) === stable(meta.base)) {
    const conflicts = { ...sync.conflicts };
    delete conflicts[d.name];
    return withDoc({ ...s, sync: { ...sync, docs, conflicts } }, d.name, d.body);
  }
  const { merged, conflicts: fields } = merge3(d.name, meta.base, local, d.body);
  const prev = sync.conflicts[d.name];
  const theirsFields = diffKeys(d.name, merged, d.body);
  // En konflikt som ikke er løst, forsvinner ikke fordi den andre enheten har endret noe annet.
  const all = [...new Set([...fields, ...(prev?.fields ?? []).filter((f) => theirsFields.has(f))])].sort();
  const conflicts = { ...sync.conflicts };
  if (all.length > 0) conflicts[d.name] = { theirs: d.body, version: d.version, fields: all, by: d.updatedBy, at: d.updatedAt } satisfies DocConflict;
  else delete conflicts[d.name];
  return withDoc({ ...s, sync: { ...sync, docs, conflicts } }, d.name, merged);
}
/** Felt der to versjoner av et dokument er ulike. */
function diffKeys(name: DocName, a: DocBody, b: DocBody): Set<string> {
  const fa = fieldsOf(name, a), fb = fieldsOf(name, b);
  return new Set([...Object.keys(fa), ...Object.keys(fb)].filter((k) => stable(fa[k]) !== stable(fb[k])));
}

/** Brukerens valg i en konflikt. «mine»: lokal verdi gjelder; «theirs»: den andre enhetens verdi i konfliktfeltene. */
export function resolveConflict(s: AppState, name: DocName, choice: 'mine' | 'theirs'): AppState {
  const c = s.sync?.conflicts[name];
  if (!s.sync || !c) return s;
  const conflicts = { ...s.sync.conflicts };
  delete conflicts[name];
  let next: AppState = { ...s, sync: { ...s.sync, conflicts } };
  if (choice === 'theirs') {
    const f = fieldsOf(name, docBody(s, name));
    const t = fieldsOf(name, c.theirs);
    for (const k of c.fields) f[k] = t[k];
    next = withDoc(next, name, fromFields(name, f));
  }
  return next;
}

const toEnvelopes = (s: AppState): (Envelope & { id: string })[] => [
  ...s.outbox.map((event) => ({ stream: 'beholdning' as const, event, id: event.id })),
  ...s.listOutbox.map((event) => ({ stream: 'liste' as const, event, id: event.id })),
  ...(s.changeOutbox ?? []).map((event) => ({ stream: 'endring' as const, event, id: event.id })),
];

/** Kobler tilstanden til en husstand. Alt lokalt legges i utboksene (uten duplikater) så det kommer med. */
export function connect(s: AppState, token: string, me: MemberInfo): AppState {
  const ids = new Set(s.outbox.map((e) => e.id));
  const listIds = new Set(s.listOutbox.map((e) => e.id));
  const changeIds = new Set((s.changeOutbox ?? []).map((e) => e.id));
  return {
    ...s, syncNotice: null,
    outbox: [...s.outbox, ...s.inventory.filter((e) => !ids.has(e.id))],
    listOutbox: [...s.listOutbox, ...s.list.filter((e) => !listIds.has(e.id))],
    changeOutbox: [...(s.changeOutbox ?? []), ...(s.listChanges ?? []).filter((e) => !changeIds.has(e.id))],
    sync: { token, me, cursor: 0, docs: {}, conflicts: {}, members: [me], rejected: 0, lastSync: null },
  };
}
/** Kobler fra husstanden. Data på enheten beholdes; enheten blir en enkelt-enhets husstand igjen. */
export const disconnect = (s: AppState, notice: string | null): AppState => ({ ...s, sync: null, syncNotice: notice });

export interface SyncResult { ok: boolean; offline: boolean; error?: string }

/** Én synk-runde. Kaster aldri; feil gis i resultatet. 401 kobler enheten fra. */
export async function syncOnce(io: SyncIO, apiBase: SyncApi, now: () => string): Promise<SyncResult> {
  const start = io.get().sync;
  if (!start) return { ok: true, offline: false };
  const api = apiBase.withToken(start.token);
  const same = (s: AppState) => s.sync?.token === start.token;
  try {
    // 1. Lever utboksene (i biter).
    for (let round = 0; round < 20; round++) {
      const envs = toEnvelopes(io.get()).slice(0, LIMITS.batch);
      if (envs.length === 0) break;
      const t = new HttpTransport(api);
      const done = new Set(await t.push(envs));
      io.set((s) => same(s) ? {
        ...s, outbox: s.outbox.filter((e) => !done.has(e.id)), listOutbox: s.listOutbox.filter((e) => !done.has(e.id)),
        changeOutbox: (s.changeOutbox ?? []).filter((e) => !done.has(e.id)),
        sync: { ...s.sync!, rejected: s.sync!.rejected + t.rejected.length },
      } : s);
    }
    // 2. Hent alt nytt etter cursor og flett.
    for (let round = 0; round < 50; round++) {
      const cursor = io.get().sync?.cursor ?? 0;
      const r = await api.pull(cursor);
      io.set((s) => {
        if (!same(s) || s.sync!.cursor !== cursor) return s;
        const inv = r.events.filter((e) => e.stream === 'beholdning').map((e) => e.event as InventoryEvent);
        const lst = r.events.filter((e) => e.stream === 'liste').map((e) => e.event as ListEvent);
        const chg = r.events.filter((e) => e.stream === 'endring').map((e) => e.event as ListChange);
        let next: AppState = {
          ...s, inventory: applyEvents(s.inventory, inv), list: applyListEvents(s.list, lst), listChanges: chg.reduce(applyChange, s.listChanges ?? []),
        };
        for (const d of r.docs) next = receiveDoc(next, d);
        const me = r.members.find((m) => m.me) ?? next.sync!.me;
        return { ...next, sync: { ...next.sync!, cursor: r.cursor, members: r.members, me } };
      });
      if (!r.more) break;
    }
    // 3. Send endrede dokumenter. Utdatert base gir 409 med gjeldende versjon, som flettes før nytt forsøk.
    for (const name of DOC_NAMES) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const s = io.get();
        if (!same(s) || s.sync!.conflicts[name] || !isDirty(s, name)) break;
        const body = docBody(s, name);
        if (!isValidDoc(name, body)) break; // ugyldig lokalt (f.eks. tomt budsjettfelt): sendes når det er rettet
        const baseVersion = s.sync!.docs[name]?.version ?? 0;
        try {
          const r = await api.putDoc(name, baseVersion, body);
          io.set((x) => same(x) ? { ...x, sync: { ...x.sync!, docs: { ...x.sync!.docs, [name]: { version: r.version, base: body } } } } : x);
          break;
        } catch (e) {
          if (!(e instanceof SyncError) || e.status !== 409) throw e;
          const cur = e.current;
          if (cur) io.set((x) => same(x) ? receiveDoc(x, cur) : x);
          else io.set((x) => {
            if (!same(x)) return x;
            const docs = { ...x.sync!.docs };
            delete docs[name];
            return { ...x, sync: { ...x.sync!, docs } };
          });
        }
      }
    }
    io.set((s) => same(s) ? { ...s, sync: { ...s.sync!, lastSync: now() } } : s);
    return { ok: true, offline: false };
  } catch (e) {
    if (e instanceof SyncError && e.unauthorized) {
      io.set((s) => same(s) ? disconnect(s, 'Denne enheten er ikke lenger med i husstanden (fjernet, forlatt eller slettet). Dataene på enheten er beholdt.') : s);
      return { ok: false, offline: false, error: e.code };
    }
    const offline = e instanceof SyncError ? e.offline : true;
    return { ok: false, offline, error: e instanceof SyncError ? e.code : 'ukjent' };
  }
}

export type SyncStatus = 'lokal' | 'synket' | 'synker' | 'venter' | 'konflikt';
export function syncStatus(s: AppState, runtime: { offline: boolean; busy: boolean }, purchaseConflicts: number): SyncStatus {
  if (!s.sync) return 'lokal';
  if (Object.keys(s.sync.conflicts).length > 0 || purchaseConflicts > 0) return 'konflikt';
  const pending = pendingCount(s);
  if (runtime.offline) return 'venter';
  if (pending > 0 || runtime.busy) return 'synker';
  return 'synket';
}
export const pendingCount = (s: AppState) => s.outbox.length + s.listOutbox.length + (s.changeOutbox?.length ?? 0)
  + (s.sync ? DOC_NAMES.filter((n) => isDirty(s, n)).length : 0);
