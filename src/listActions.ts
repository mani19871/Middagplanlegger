// Handlinger på handlelista og den godkjente listen som tilstandsoverganger (AppState → AppState). Brukes av
// useChangeKit (views/ListChanges.tsx) og av synk-testene, så to simulerte enheter kjører samme kode som appen.
// Tid, id og enhet kommer fra `env.stamp` (utenfor motoren). Alt annet regnes fra tilstanden som sendes inn, ikke fra
// det som var vist da knappen ble tegnet, så en endring som kom inn via synk i mellomtiden blir med.
import { recordEvent, recordVersion, type AppState } from './store';
import { enqueue } from './sync/queue';
import { whoLabel } from './sync/labels';
import { buildBasket, type Ctx } from './engine/planner';
import type { Slot } from './engine/types';
import {
  activeChanges, adjustedWeek, applyChange, applyChanges, approvalVersion, chooseVersion, homeUseEvents, keepVersion, pinState,
  priceDrift, sameSlotList, snapshot, versionHeads, withPrev,
  type DriftItem, type ListChange, type PlanVersion, type VersionReason,
} from './engine/substitution';

export interface ActionEnv { ctx: Ctx; week: string; stamp: () => { id: string; at: string; by: string } }

/** Kurvene for tilstanden slik alle visninger viser dem (se adjustedWeek), med fastholdt liste og konflikt. */
export function weekState(s: AppState, env: ActionEnv, option: 'regular' | 'combo' = s.option) {
  const changes = activeChanges(s.listChanges ?? [], env.week);
  const ps = pinState(s.planHistory ?? [], env.week, s.slots, s.approved);
  const wk = adjustedWeek(s.slots, env.ctx, option, changes, env.week, ps.pin);
  const unpinned = applyChanges(wk.base, changes, env.week, env.ctx, null);
  const drift = ps.pin ? priceDrift(ps.pin, unpinned, env.ctx) : [];
  return { changes, ps, ...wk, unpinned, drift };
}

export const DRIFT_TEXT: Record<DriftItem['reason'], string> = {
  prisendring: 'ny pris', 'utløpt-tilbud': 'tilbudet er utløpt', 'annet-produkt': 'annet produkt', mengde: 'annen mengde',
  'ny-vare': 'ny vare', fjernet: 'ikke med lenger',
};
export const driftNote = (d: DriftItem[]) => d.map((x) => `${x.name}: ${DRIFT_TEXT[x.reason]}`).join('; ');
const heads = (s: AppState, week: string) => versionHeads(s.planHistory ?? [], week).map((v) => v.id);

/**
 * «Utsolgt / fant ikke»: hendelsen (med `prev` = valgene på linja enheten ser nå), eventuell matskaphendelse for
 * «bruk noe hjemme», og en ny planversjon med årsak. Et rettebytte (`slots`) opphever godkjenningen.
 */
export function recordChange(s: AppState, e: ListChange, reason: VersionReason, note: string, slots: Slot[] | undefined, env: ActionEnv): AppState {
  const { week, ctx } = env;
  const prevLog = s.listChanges ?? [];
  const ev = withPrev(prevLog, e);
  const nextLog = applyChange(prevLog, ev);
  if (nextLog === prevLog) return s; // samme hendelse to ganger: ingen endring
  const ss = slots ?? s.slots;
  const swapped = !sameSlotList(ss, s.slots);
  const cur = weekState(s, env);
  const before = activeChanges(prevLog, week);
  const after = activeChanges(nextLog, week);
  const b = applyChanges(buildBasket(ss, cur.storeIds, ctx), after, week, ctx, swapped ? null : cur.ps.pin);
  let next: AppState = { ...s, slots: ss, approved: swapped ? false : s.approved, listChanges: nextLog, changeOutbox: enqueue(s.changeOutbox ?? [], ev) };
  for (const ie of homeUseEvents(before.get(ev.line), after.get(ev.line), b, week, env.stamp())) next = recordEvent(next, ie);
  const parents = cur.ps.pin ? cur.ps.group.map((v) => v.id) : [];
  return recordVersion(next, snapshot(b, ss, { ...env.stamp(), week, reason, note, parents, declined: cur.ps.pin?.declined }, ctx));
}

/** Godkjenn listen slik den vises nå. Ny planversjon bare når grunnlaget er endret (middager, priser, valg, beholdning). */
export function approve(s: AppState, option: 'regular' | 'combo', env: ActionEnv): AppState {
  const w = weekState(s, env, option);
  const v = approvalVersion(s.planHistory ?? [], env.week, snapshot(w.basket, s.slots, { ...env.stamp(), week: env.week, reason: 'godkjent' }, env.ctx));
  const next: AppState = { ...s, approved: true, option };
  return v ? recordVersion(next, v) : next;
}

/** «Bruk nye priser»: ny versjon med motorens produkter nå. Bygger på alle gjeldende versjoner for uka. */
export function acceptPrices(s: AppState, env: ActionEnv): AppState {
  const w = weekState(s, env);
  return recordVersion(s, snapshot(w.unpinned, s.slots, { ...env.stamp(), week: env.week, reason: 'nye-priser', note: driftNote(w.drift), parents: heads(s, env.week) }, env.ctx));
}

/** «Behold godkjent liste»: samme produkter, avvikene er notert som sett. */
export function keepPrices(s: AppState, env: ActionEnv): AppState {
  const w = weekState(s, env);
  if (!w.ps.pin) return s;
  return recordVersion(s, keepVersion(w.ps.pin, w.drift, { ...env.stamp(), note: driftNote(w.drift), parents: heads(s, env.week) }));
}

/** Konflikt mellom godkjente lister: brukeren velger én. */
export function chooseList(s: AppState, v: PlanVersion, env: ActionEnv): AppState {
  return recordVersion(s, chooseVersion(s.planHistory ?? [], v, { ...env.stamp(), note: `Valgt liste fra ${whoLabel(s, v.by)}` }));
}
