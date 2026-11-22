// «Utsolgt / fant ikke» i handlelista: erstatning, «fant ikke»-alternativer, prisavvik mot godkjent liste og historikk.
// All beregning skjer i src/engine/substitution.ts; her er bare tilstand (hendelser og versjoner) og visning.
import { useMemo } from 'react';
import { recordEvent, recordVersion, stamp, type AppState } from '../store';
import { enqueue } from '../sync/queue';
import { whoLabel } from '../sync/labels';
import { buildBasket, type BasketAdjust, type Ctx } from '../engine/planner';
import type { Alternatives, Basket, BasketLine, Slot } from '../engine/types';
import {
  activeChanges, adjustedWeek, applyChange, applyChanges, approvalVersion, canMarkBought, changeSummary, chooseVersion, diffLines,
  findSubstitutes, homeUseEvents, keepVersion, notFoundEvent, notFoundOptions, pinState, priceDrift, sameSlotList, snapshot,
  substituteEvent, undoChangeEvent, versionHeads, versionsFor, withPrev,
  type AdjustedBasket, type AdjustedLine, type ChangeMap, type DriftItem, type DriftReason, type LineSide, type ListChange,
  type NotFoundChoice, type PlanVersion, type VersionReason,
} from '../engine/substitution';
import { ALLERGEN_LABEL } from '../engine/allergens';
import { amount, DAYS, kr, krSigned } from '../engine/format';
import { Sheet } from './Sheet';

export interface ChangeKit {
  week: string; ctx: Ctx; storeIds: string[]; slots: Slot[]; base: Basket; changes: ChangeMap;
  pin: PlanVersion | null; unpinned: AdjustedBasket; drift: DriftItem[]; history: PlanVersion[];
  /** Godkjente lister laget samtidig på ulike enheter med ulike produkter (én per liste). Tom: ingen konflikt. */
  conflict: PlanVersion[];
  /** Samme justering som kurven (brukerens valg, og godkjent liste for de samme middagene) for et tenkt rettebytte. */
  swapAdjust: BasketAdjust;
  who: (by: string) => string;
  record: (e: ListChange, reason: VersionReason, note: string, slots?: Slot[]) => void;
  approve: (option: 'regular' | 'combo') => void;
  acceptPrices: () => void; keepPrices: () => void; choose: (v: PlanVersion) => void;
}

/**
 * Kurven med brukerens valg og den godkjente listens produkter, pluss handlingene som endrer dem. Alternativene
 * (én butikk / kombinasjon) regnes med de samme valgene, så alle visninger viser samme sum.
 * Hver endring lagres som en idempotent hendelse og en ny planversjon med årsak; begge deles i husstanden.
 */
export function useChangeKit(
  state: AppState, update: (f: (s: AppState) => AppState) => void, ctx: Ctx, week: string,
): { alts: Alternatives; basket: AdjustedBasket; activeStores: string[]; kit: ChangeKit } {
  const log = useMemo(() => state.listChanges ?? [], [state.listChanges]);
  const history = useMemo(() => state.planHistory ?? [], [state.planHistory]);
  const changes = useMemo(() => activeChanges(log, week), [log, week]);
  const ps = useMemo(() => pinState(history, week, state.slots, state.approved), [history, week, state.slots, state.approved]);
  const pin = ps.pin;
  const wk = useMemo(() => adjustedWeek(state.slots, ctx, state.option, changes, week, pin), [state.slots, ctx, state.option, changes, week, pin]);
  const { base, basket, storeIds } = wk;
  const unpinned = useMemo(() => applyChanges(base, changes, week, ctx, null), [base, changes, week, ctx]);
  const drift = useMemo(() => (pin ? priceDrift(pin, unpinned, ctx) : []), [pin, unpinned, ctx]);
  const swapAdjust: BasketAdjust = (b, ss) => applyChanges(b, changes, week, ctx, sameSlotList(ss, state.slots) ? pin : null);
  const headIds = (s: AppState) => versionHeads(s.planHistory ?? [], week).map((v) => v.id);

  const record: ChangeKit['record'] = (e, reason, note, slots) => update((s) => {
    const prevLog = s.listChanges ?? [];
    const ev = withPrev(prevLog, e); // valget erstatter valgene enheten ser på linja nå
    const nextLog = applyChange(prevLog, ev);
    if (nextLog === prevLog) return s; // samme hendelse to ganger: ingen endring
    const ss = slots ?? s.slots;
    // Et rettebytte opphever godkjenningen; listen må godkjennes på nytt (og får da en ny versjon).
    const swapped = !sameSlotList(ss, s.slots);
    const cur = pinState(s.planHistory ?? [], week, s.slots, s.approved);
    const before = activeChanges(prevLog, week);
    const after = activeChanges(nextLog, week);
    const b = applyChanges(buildBasket(ss, storeIds, ctx), after, week, ctx, swapped ? null : cur.pin);
    let next: AppState = { ...s, slots: ss, approved: swapped ? false : s.approved, listChanges: nextLog, changeOutbox: enqueue(s.changeOutbox ?? [], ev) };
    // «Bruk noe vi har hjemme»: mengden registreres som tatt fra matskapet (og angres når valget endres).
    for (const ie of homeUseEvents(before.get(ev.line), after.get(ev.line), b, week, stamp())) next = recordEvent(next, ie);
    const meta = { ...stamp(), week, reason, note, parents: cur.pin ? cur.group.map((v) => v.id) : [], declined: cur.pin?.declined };
    return recordVersion(next, snapshot(b, ss, meta, ctx));
  });
  /** Godkjenn listen slik den vises nå. Ny versjon bare når grunnlaget er endret (priser, valg, beholdning, middager). */
  const approve = (option: 'regular' | 'combo') => update((s) => {
    const shown = pinState(s.planHistory ?? [], week, s.slots, s.approved).pin;
    const w = adjustedWeek(s.slots, ctx, option, activeChanges(s.listChanges ?? [], week), week, shown);
    const v = approvalVersion(s.planHistory ?? [], week, snapshot(w.basket, s.slots, { ...stamp(), week, reason: 'godkjent' }, ctx));
    const next: AppState = { ...s, approved: true, option };
    return v ? recordVersion(next, v) : next;
  });
  const acceptPrices = () => update((s) => recordVersion(s,
    snapshot(unpinned, s.slots, { ...stamp(), week, reason: 'nye-priser', note: driftNote(drift), parents: headIds(s) }, ctx)));
  const keepPrices = () => { if (pin) update((s) => recordVersion(s, keepVersion(pin, drift, { ...stamp(), note: driftNote(drift), parents: headIds(s) }))); };
  const choose = (v: PlanVersion) => update((s) => recordVersion(s, chooseVersion(s.planHistory ?? [], v, { ...stamp(), note: `Valgt liste fra ${whoLabel(s, v.by)}` })));
  const who = (by: string) => whoLabel(state, by);
  return {
    alts: wk.alts, basket, activeStores: storeIds,
    kit: { week, ctx, storeIds, slots: state.slots, base, changes, pin, unpinned, drift, history, conflict: ps.conflict, swapAdjust, who, record, approve, acceptPrices, keepPrices, choose },
  };
}

// ---------- Tekster ----------

const REASON: Record<VersionReason, string> = {
  godkjent: 'Liste godkjent', erstatning: 'Utsolgt – erstattet', 'fant-ikke': 'Fant ikke', angret: 'Endring angret',
  'bytt-rett': 'Rett byttet (vare manglet)', 'nye-priser': 'Nye priser tatt inn', beholdt: 'Godkjent liste beholdt',
  valgt: 'Valgt mellom to godkjente lister',
};
const DRIFT: Record<DriftReason, string> = {
  prisendring: 'ny pris', 'utløpt-tilbud': 'tilbudet er utløpt', 'annet-produkt': 'annet produkt', mengde: 'annen mengde',
  'ny-vare': 'ny vare', fjernet: 'ikke med lenger',
};
const CHOICE: Record<NotFoundChoice, string> = { uavklart: 'fant ikke', 'hopp-over': 'hoppet over', 'bruk-hjemme': 'bruker noe vi har hjemme' };
const ddmm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'numeric' })} kl. ${d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
};
const sideText = (s: LineSide | null) => {
  if (!s) return '–';
  const what = s.productName ? `${s.packs > 1 ? `${s.packs} × ` : ''}${s.productName}` : 'uten produkt';
  const price = s.costOre === null ? 'ukjent pris' : `${kr(s.costOre)}${s.status === 'tilbud' ? ` (tilbud${s.validUntil ? ` til ${ddmm(s.validUntil)}` : ''})` : ''}`;
  return `${what}, ${price}`;
};
const driftNote = (d: DriftItem[]) => d.map((x) => `${x.name}: ${DRIFT[x.reason]}`).join('; ');
const sumText = (ore: number, complete: boolean) => (complete ? kr(ore) : `${kr(ore)} (delsum, ukjent pris)`);

/** Liten etikett på en linje som er endret i butikken. */
export function ChangePill({ line }: { line: AdjustedLine }) {
  const c = line.change;
  if (!c) return null;
  if (c.type === 'konflikt') return <span className="pill warnp">⚠ Ulike valg fra to enheter – velg hva som gjelder</span>;
  if (c.problem) return <span className="pill warnp">⚠ Erstatningen kan ikke brukes lenger</span>;
  if (c.type === 'erstatt') return <span className="pill">↺ Erstatter {c.original.productName ?? line.name} (utsolgt)</span>;
  return <span className="pill warnp">✕ Fant ikke – ukjent pris</span>;
}

// ---------- Utsolgt / fant ikke ----------

export function ChangeSheet({ line, kit, blocked, onClose }: { line: AdjustedLine; kit: ChangeKit; blocked: boolean; onClose: () => void }) {
  const subs = useMemo(() => findSubstitutes(kit.base, kit.changes, line, kit.week, kit.ctx, kit.pin), [kit, line]);
  const nf = useMemo(() => notFoundOptions(kit.slots, kit.storeIds, kit.changes, line, kit.week, kit.ctx, kit.pin), [kit, line]);
  const shown = line.change ? line.change.original.productName ?? line.name : line.productName ?? line.name;
  const done = (e: ListChange, reason: VersionReason, note: string, slots?: Slot[]) => { kit.record(e, reason, note, slots); onClose(); };
  const swaps = nf.options.filter((o) => o.kind === 'bytt-rett').slice(0, 4);
  const other = nf.options.filter((o) => o.kind !== 'bytt-rett');
  const rejectedText: Record<string, string> = {
    allergifilter: 'stoppes av allergifilteret', 'uavklart-allergen': 'innhold ikke avklart (allergifilter er på)', 'ingen-pris': 'ingen pris i butikken', 'feil-enhet': 'ukjent pakning',
  };
  const rejected = subs.rejected.filter((r) => r.reason !== 'utsolgt');
  return (
    <Sheet label={`Utsolgt eller fant ikke: ${line.name}`} onClose={onClose}>
      <div className="grab" aria-hidden />
      <div className="pagehead"><h2>Utsolgt / fant ikke</h2><button className="x" data-autofocus aria-label="Lukk" onClick={onClose}>✕</button></div>
      <p><b>{shown}</b><br /><small className="fine">Behov: {amount(line.need, line.unit)}. {nf.affected.length > 0 ? `Brukes ${nf.affected.map((a) => `${DAYS[a.day].toLowerCase()} (${a.name})`).join(', ')}.` : 'Brukes ikke i noen rett.'}</small></p>
      {blocked ? (
        <div className="banner warn">Varen er markert som handlet. Angre «handlet» først, så samme vare ikke registreres kjøpt to ganger.</div>
      ) : (
        <>
          {line.change?.type === 'konflikt' && (
            <div className="banner warn" role="status">
              <b>To enheter har valgt ulikt for denne varen.</b> Prisen er ukjent til dere velger hva som gjelder.
              {line.change.heads.map((h) => (
                <button key={h.id} className="ghost bigbtn choice" onClick={() => done(resolveWith(h, line, kit.week),
                  h.type === 'erstatt' ? 'erstatning' : h.type === 'fant-ikke' ? 'fant-ikke' : 'angret', `${shown}: valgt «${headText(h, kit)}»`)}>
                  <b>{headText(h, kit)}</b><small>Valgt av {kit.who(h.by)} {when(h.at)}</small>
                </button>
              ))}
            </div>
          )}
          {line.change && line.change.type !== 'konflikt' && (
            <button className="ghost bigbtn" onClick={() => done(undoChangeEvent(line, kit.week, stamp()), 'angret', `${line.name}: tilbake til ${shown}`)}>
              ↩ Angre endringen (tilbake til {shown})
            </button>
          )}
          <h3>Velg et annet produkt</h3>
          {!line.storeId && <p className="fine">Varen har ingen pris i valgte butikker, så det finnes ingen hylle å velge fra.</p>}
          {line.storeId && subs.options.length === 0 && <p className="fine">Ingen godkjente erstatninger i denne butikken.</p>}
          {subs.options.map((o) => (
            <button key={o.product.id} className="ghost bigbtn choice"
              onClick={() => done(substituteEvent(line, kit.week, o.product.id, stamp()), 'erstatning', `${shown} utsolgt → ${o.product.name}`)}>
              <b>{o.packs} × {o.product.name}</b>
              <small>{amount(o.packs * o.packSize, line.unit)} · {kr(o.costOre)} · {o.obs.status === 'tilbud' ? 'tilbud' : o.obs.status === 'estimat' ? 'estimert pris' : 'ordinær pris'}
                {' · '}{o.deltaOre === null ? 'kan ikke sammenlignes (kurven har ukjent pris)' : `${krSigned(o.deltaOre)} på handelen`}</small>
              {o.newAllergens.length > 0 && <small className="warntext">⚠ Inneholder {o.newAllergens.map((a) => ALLERGEN_LABEL[a]).join(', ')}, som ikke er oppgitt for retten.</small>}
              {o.allergenUnknown && <small className="warntext">⚠ Innholdet er ikke avklart. Sjekk pakningen.</small>}
            </button>
          ))}
          {rejected.length > 0 && <p className="fine">Ikke foreslått: {rejected.map((r) => `${r.product.name} (${rejectedText[r.reason]})`).join(', ')}.</p>}

          <h3>Fant ikke</h3>
          <button className="ghost bigbtn choice" onClick={() => done(notFoundEvent(line, kit.week, 'uavklart', stamp()), 'fant-ikke', `${shown}: fant ikke`)}>
            <b>Fant ikke – avklar senere</b>
            <small>Prisen blir ukjent: ny delsum {kr(nf.notFound.totalOre)}, kan ikke bekreftes innenfor budsjett.</small>
          </button>
          {other.map((o) => (
            <button key={o.kind} className="ghost bigbtn choice" onClick={() => done(notFoundEvent(line, kit.week, o.kind as NotFoundChoice, stamp()), 'fant-ikke', `${shown}: ${CHOICE[o.kind as NotFoundChoice]}`)}>
              <b>{o.kind === 'bruk-hjemme' ? 'Bruk noe vi har hjemme' : 'Hopp over varen'}</b>
              <small>Ny sum {sumText(o.totalOre, o.complete)}{o.deltaOre !== null ? ` (${krSigned(o.deltaOre)})` : ''}
                {o.kind === 'bruk-hjemme' ? ` · ${amount(line.need, line.unit)} registreres som tatt fra matskapet` : ''}</small>
            </button>
          ))}
          {swaps.map((o) => (
            <button key={`${o.day}-${o.recipeId}`} className="ghost bigbtn choice"
              onClick={() => done(notFoundEvent(line, kit.week, 'uavklart', stamp()), 'bytt-rett', `${shown} manglet: ${DAYS[o.day!].toLowerCase()} byttet til ${o.recipeName}`, o.slots)}>
              <b>Bytt {DAYS[o.day!].toLowerCase()} til {o.recipeName}</b>
              <small>{o.complete ? `Ny sum ${kr(o.totalOre)}${o.deltaOre !== null ? ` (${krSigned(o.deltaOre)})` : ''}` : `Ufullstendig prisgrunnlag: delsum ${kr(o.totalOre)}`}
                {nf.affected.length > 1 ? ' · varen trengs fortsatt i en annen rett' : ''}</small>
            </button>
          ))}
          {nf.affected.some((a) => a.locked) && <p className="fine">Låste retter byttes ikke.</p>}
          {swaps.length > 0 && <p className="fine">Et rettebytte opphever godkjenningen: listen må godkjennes på nytt.</p>}
          <p className="fine">Prisene er anslått. «Fant ikke», «hopp over» og «bruk hjemme» registrerer ikke noe kjøp.</p>
        </>
      )}
    </Sheet>
  );
}

/** Nytt valg som gjentar et av valgene i en konflikt; `prev` settes til alle valgene på linja, så konflikten løses. */
function resolveWith(h: ListChange, line: AdjustedLine, week: string): ListChange {
  if (h.type === 'erstatt') return substituteEvent(line, week, h.productId, stamp());
  if (h.type === 'fant-ikke') return notFoundEvent(line, week, h.choice, stamp());
  return undoChangeEvent(line, week, stamp());
}
function headText(h: ListChange, kit: ChangeKit): string {
  if (h.type === 'erstatt') return `Erstatt med ${kit.ctx.catalog.products.find((p) => p.id === h.productId)?.name ?? h.productId}`;
  if (h.type === 'fant-ikke') return h.choice === 'uavklart' ? 'Fant ikke – avklar senere' : h.choice === 'hopp-over' ? 'Hopp over varen' : 'Bruk noe vi har hjemme';
  return 'Ingen endring (opprinnelig vare)';
}

/** Viser når summen inneholder brukerens valg fra handlelista (erstatning, fant ikke, hoppet over, konflikt). */
export function ChangesNote({ basket }: { basket: Basket }) {
  if (!('skipped' in basket)) return null;
  const c = changeSummary(basket as AdjustedBasket);
  if (c.total === 0) return null;
  const parts = [
    c.erstatt > 0 && `${c.erstatt} erstatning${c.erstatt === 1 ? '' : 'er'}`,
    c.fantIkke > 0 && `${c.fantIkke} fant ikke`,
    c.skipped > 0 && `${c.skipped} tatt ut av handelen`,
    c.konflikt > 0 && `${c.konflikt} med ulike valg fra to enheter`,
  ].filter(Boolean);
  return <p className="fine changesnote">↺ Summen er med valgene fra handlelista: {parts.join(', ')}.</p>;
}

// ---------- Konflikt mellom godkjente lister ----------

export function VersionConflictBanner({ kit }: { kit: ChangeKit }) {
  if (kit.conflict.length < 2) return null;
  const [a] = kit.conflict;
  return (
    <div className="banner warn" role="alert">
      <b>To voksne har godkjent ulike handlelister samtidig.</b>
      <p className="fine">Ingen av dem holdes fast før dere velger. Til da viser listen varene og prisene slik de er nå.</p>
      {kit.conflict.map((v) => {
        const diff = v === a ? [] : diffLines(a.lines, v.lines, kit.ctx.shopDate);
        return (
          <div key={v.id} className="card">
            <div className="drow"><span><b>{REASON[v.reason]} av {kit.who(v.by)}</b><br /><small className="fine">{when(v.at)}</small></span><b>{sumText(v.totalOre, v.complete)}</b></div>
            {diff.length > 0 && <ul className="driftlist">{diff.map((d) => <li key={d.key}>{d.name}: {sideText(d.after)} <i>(i stedet for {sideText(d.before)})</i></li>)}</ul>}
            <button className="ghost" onClick={() => kit.choose(v)}>Bruk denne listen</button>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Prisavvik mot godkjent liste ----------

export function DriftBanner({ kit }: { kit: ChangeKit }) {
  if (!kit.pin || kit.drift.length === 0) return null;
  return (
    <div className="banner warn" role="status">
      <b>Prisgrunnlaget er endret siden listen ble godkjent.</b>
      <ul className="driftlist">
        {kit.drift.map((d) => <li key={d.key}>{d.name}: {sideText(d.before)} → {sideText(d.after)} <i>({DRIFT[d.reason]})</i></li>)}
      </ul>
      <p className="fine">Listen beholder de godkjente varene til dere velger. Opprinnelig anslag står i «Endringer i listen».</p>
      <div className="two">
        <button className="ghost" onClick={kit.acceptPrices}>Bruk nye priser</button>
        <button className="ghost" onClick={kit.keepPrices}>Behold godkjent liste</button>
      </div>
    </div>
  );
}

/** Varer tatt ut av handelen («hopp over», «bruk hjemme»), med angre. */
export function SkippedLines({ basket, kit }: { basket: AdjustedBasket; kit: ChangeKit }) {
  if (basket.skipped.length === 0) return null;
  return (
    <section>
      <div className="deptbar">⤼ <strong>Ikke med i handelen</strong></div>
      <ul className="list">
        {basket.skipped.map((l) => (
          <li key={l.lineKey}>
            <span className="main"><b>{l.change?.original.productName ?? l.name}</b><small>{CHOICE[l.change!.choice!]} · ikke med i summen</small></span>
            <button className="ghost sm" aria-label={`Angre: ta ${l.change?.original.productName ?? l.name} med i handelen igjen`} onClick={() => kit.record(undoChangeEvent(l, kit.week, stamp()), 'angret', `${l.name}: med i handelen igjen`)}>Angre</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Historikk ----------

export function HistoryView({ kit, onBack }: { kit: ChangeKit; onBack: () => void }) {
  const versions = versionsFor(kit.history, kit.week);
  return (
    <>
      <div className="pagehead"><button className="x" aria-label="Tilbake" onClick={onBack}>←</button></div>
      <h1 className="page">Endringer i listen</h1>
      {versions.length === 0 && <section className="card"><p>Ingen endringer ennå. Når listen godkjennes eller en vare er utsolgt, lagres en ny versjon her.</p></section>}
      {[...versions].reverse().map((v) => {
        const i = versions.indexOf(v);
        const prev = i > 0 ? versions[i - 1] : null;
        const items = prev ? diffLines(prev.lines, v.lines, kit.ctx.shopDate) : [];
        const why = (d: DriftItem) => {
          const l = v.lines.find((x) => x.key === d.key);
          if (l?.change === 'erstatt') return 'utsolgt, erstattet';
          if (l?.change === 'konflikt') return 'ulike valg fra to enheter';
          if (l?.change === 'fant-ikke') return 'fant ikke';
          const sk = v.skipped.find((x) => x.key === d.key);
          if (sk?.choice) return CHOICE[sk.choice];
          return DRIFT[d.reason];
        };
        return (
          <section key={v.id} className="card">
            <div className="drow"><span><b>{REASON[v.reason]}</b><br /><small className="fine">{when(v.at)} · {kit.who(v.by)}</small></span><b>{sumText(v.totalOre, v.complete)}</b></div>
            {prev && prev.totalOre !== v.totalOre && prev.complete && v.complete && <p className="fine">Før: {kr(prev.totalOre)} ({krSigned(v.totalOre - prev.totalOre)})</p>}
            {v.note && <p className="fine">{v.note}</p>}
            {items.length > 0 && (
              <ul className="driftlist">
                {items.map((d) => <li key={d.key}>{d.name}: {sideText(d.before)} → {sideText(d.after)} <i>({why(d)})</i></li>)}
              </ul>
            )}
            {v.reason === 'beholdt' && v.declined.length > 0 && (
              <ul className="driftlist">{v.declined.map((d) => <li key={d.key}>Ikke tatt inn: {d.name}: {sideText(d.after)} <i>({DRIFT[d.reason]})</i></li>)}</ul>
            )}
            {!prev && v.lines.length > 0 && <p className="fine">{v.lines.length} varer. Prisgrunnlag: {v.priceBasis || 'ukjent'}.</p>}
          </section>
        );
      })}
      <p className="fine">Eldre versjoner endres aldri: opprinnelig pris og anslag står igjen, også når et tilbud har gått ut. Alle beløp er anslått.</p>
    </>
  );
}

/** Kan linja markeres som handlet? (Ikke når den er meldt «fant ikke».) */
export const markable = (l: BasketLine) => !('change' in l) || canMarkBought(l as AdjustedLine);
