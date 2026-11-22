// Delt handleliste: avkrysninger og manuelle linjer som hendelser. Ren og deterministisk (ingen klokke, id eller nett
// her; `stamp()` i store.ts setter id, tid og enhet).
//
// Avkrysning er et «observed-remove»-sett per (uke, linje):
//  - `kryss` legger til én avkrysning med egen id og egen identitet (`by`). To voksne som krysser av samme linje
//    gir to avkrysninger, og begge vises («Voksen 1 og Voksen 2»).
//  - `avkryss` fjerner bare de avkrysningene enheten hadde sett (`seen`). En avkrysning som kom samtidig fra en annen
//    enhet blir stående. Ingen siste-skriving-vinner, og ingen avkrysning forsvinner uten at noen så den.
// Tilstanden er en ren mengdeoperasjon over hele loggen, så rekkefølgen hendelsene kommer i spiller ingen rolle.
//
// Manuelle linjer (fra kundeaviser, «Lag nå», basisvarer og husholdningsvarer): `manuell` legger til en linje med egen id, `manuell-fjern` fjerner den for godt.

import { STAPLE_PREFIX, type StapleListFacts } from '../engine/staples';
import { HOUSEHOLD_PREFIX } from '../engine/household';

interface Base { id: string; at: string; by: string }
export interface ManualLineData { id: string; text: string; note: string }
export type ListEvent =
  | (Base & { type: 'kryss'; week: string; key: string })
  | (Base & { type: 'avkryss'; week: string; key: string; seen: string[] })
  | (Base & { type: 'manuell'; line: ManualLineData })
  | (Base & { type: 'manuell-fjern'; lineId: string });
export type ListLog = ListEvent[];

const str = (v: unknown, max: number, min = 1) => typeof v === 'string' && v.length >= min && v.length <= max;
const WEEK = /^\d{4}-\d{2}-\d{2}$/;

export function isValidListEvent(e: ListEvent): boolean {
  if (!e || typeof e !== 'object' || !str(e.id, 100) || !str(e.at, 40) || !str(e.by, 60)) return false;
  switch (e.type) {
    case 'kryss': return str(e.week, 10) && WEEK.test(e.week) && str(e.key, 200);
    case 'avkryss': return str(e.week, 10) && WEEK.test(e.week) && str(e.key, 200) && Array.isArray(e.seen)
      && e.seen.length <= 50 && e.seen.every((s) => str(s, 100));
    case 'manuell': return !!e.line && typeof e.line === 'object' && str(e.line.id, 100) && str(e.line.text, 200) && str(e.line.note, 200, 0);
    case 'manuell-fjern': return str(e.lineId, 100);
    default: return false;
  }
}

/** Legger en hendelse inn i loggen. Samme id to ganger, eller en ugyldig hendelse, gir samme logg tilbake. */
export function applyListEvent(log: ListLog, e: ListEvent): ListLog {
  if (!isValidListEvent(e) || log.some((x) => x.id === e.id)) return log;
  return [...log, e];
}
export const applyListEvents = (log: ListLog, events: ListEvent[]) => events.reduce(applyListEvent, log);

export interface CheckMark { id: string; by: string; at: string }
/** Aktive avkrysninger for uka: linje → avkrysninger (sortert på tid og id). */
export function checks(log: ListLog, week: string): Map<string, CheckMark[]> {
  const removed = new Set<string>();
  for (const e of log) if (e.type === 'avkryss' && e.week === week) for (const s of e.seen) removed.add(s);
  const out = new Map<string, CheckMark[]>();
  for (const e of log) {
    if (e.type !== 'kryss' || e.week !== week || removed.has(e.id)) continue;
    out.set(e.key, [...(out.get(e.key) ?? []), { id: e.id, by: e.by, at: e.at }]);
  }
  for (const marks of out.values()) marks.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
  return out;
}

/** Hendelsen et trykk på avkrysningsfeltet gir. `stamp` er id, tid og enhet. */
export function toggleEvent(log: ListLog, week: string, key: string, stamp: Base): ListEvent {
  const active = checks(log, week).get(key) ?? [];
  return active.length > 0
    ? { type: 'avkryss', ...stamp, week, key, seen: active.map((m) => m.id) }
    : { type: 'kryss', ...stamp, week, key };
}

/** Manuelle linjer som ikke er fjernet, i den rekkefølgen de ble lagt til (tid, id). */
export function manualLines(log: ListLog): ManualLineData[] {
  const gone = new Set(log.filter((e) => e.type === 'manuell-fjern').map((e) => (e as Extract<ListEvent, { type: 'manuell-fjern' }>).lineId));
  const seen = new Set<string>();
  const adds = log.filter((e): e is Extract<ListEvent, { type: 'manuell' }> => e.type === 'manuell')
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
  const out: ManualLineData[] = [];
  for (const e of adds) {
    if (gone.has(e.line.id) || seen.has(e.line.id)) continue;
    seen.add(e.line.id);
    out.push(e.line);
  }
  return out;
}

// ---------- Basisvarer (engine/staples.ts) ----------

/**
 * Basisvarelinjer i lista for motoren: linjer som ligger der, linjer som er fjernet eller avvist, og aktive avkrysninger
 * på dem (alle uker: en basisvarelinje krysses av for sin egen uke). Uavhengig av rekkefølge.
 */
export function stapleListFacts(log: ListLog): StapleListFacts {
  const isStaple = (id: string) => id.startsWith(STAPLE_PREFIX);
  const lines = manualLines(log).map((m) => m.id).filter(isStaple).sort();
  const removed = [...new Set(log.flatMap((e) => (e.type === 'manuell-fjern' && isStaple(e.lineId) ? [e.lineId] : [])))].sort();
  const unchecked = new Set(log.flatMap((e) => (e.type === 'avkryss' ? e.seen : [])));
  const checks = log.filter((e): e is Extract<ListEvent, { type: 'kryss' }> => e.type === 'kryss' && isStaple(e.key) && !unchecked.has(e.id))
    .map((e) => ({ key: e.key, at: e.at, id: e.id }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1)).map(({ key, at }) => ({ key, at }));
  return { lines, removed, checks };
}

// ---------- Husholdningsvarer, «Andre varer» (engine/household.ts) ----------

/**
 * Husholdningslinjer i lista: linjer som ligger der (i rekkefølgen de ble lagt til), linje-id-er som er fjernet (til ny
 * linje-id for samme tilbud) og varenavn som har vært lagt på lista før (til nøktern fremheving). Uavhengig av rekkefølge.
 * Linjene har bare varenavn og «tilbud hos ‹kjede›»; pris og gyldighet ligger aldri i lista.
 */
export function householdListFacts(log: ListLog): { lines: ManualLineData[]; removed: string[]; history: string[] } {
  const isHouse = (id: string) => id.startsWith(HOUSEHOLD_PREFIX);
  const lines = manualLines(log).filter((m) => isHouse(m.id));
  const removed = [...new Set(log.flatMap((e) => (e.type === 'manuell-fjern' && isHouse(e.lineId) ? [e.lineId] : [])))].sort();
  const history = [...new Set(log.flatMap((e) => (e.type === 'manuell' && isHouse(e.line.id) ? [e.line.text] : [])))].sort();
  return { lines, removed, history };
}
