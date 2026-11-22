// Basisvarer med minstebeholdning (utvidelse B): husstanden velger varer den alltid vil ha hjemme, med minstemengde eller
// nivå («har / snart tom / tom»). Beregningen ligger i engine/staples.ts (ren og deterministisk). Basisvarene er delt
// husstandsdata (innstillingsdokumentet), markeringene er hendelser i beholdningsloggen. Forslagene godkjennes eller
// avvises i handlelista og er aldri med i beregnet sum.
import { useMemo, useState } from 'react';
import { stamp, type AppState } from '../store';
import type { InventoryEvent } from '../engine/inventory';
import {
  cleanStapleName, countable, customStapleId, STAPLE_LIMITS, stapleStatus, stapleSuggestions, type StapleLevel, type StapleStatus,
} from '../engine/staples';
import type { Staple, Unit } from '../engine/types';
import { amount } from '../engine/format';
import { stapleListFacts } from '../sync/list';
import { normalizeStaples } from '../sync/docs';
import { catalog } from '../data/catalog';
import { stapleChoices } from '../data/staples';

interface Props {
  state: AppState; update: (f: (s: AppState) => AppState) => void; record: (...e: InventoryEvent[]) => void; week: string;
  openList?: () => void;
}
export const STAPLE_INFO = { choices: stapleChoices, ingredients: catalog.ingredients };
const unitWord = (u: Unit) => (u === 'stk' ? 'stykk' : u);
const LEVELS: { level: StapleLevel; text: string }[] = [{ level: 'har', text: 'Har' }, { level: 'snart-tom', text: 'Snart tom' }, { level: 'tom', text: 'Tom' }];

/** Kort tekst om tilstanden til en basisvare (brukes også i «Lag nå»). */
export function stapleStateText(s: StapleStatus): string {
  switch (s.state) {
    case 'snart-tom': return 'Snart tom';
    case 'tom': return 'Tom';
    case 'under-grense': return `Under grensen: ${amount(s.have ?? 0, s.unit!)} hjemme, minst ${amount(s.min!, s.unit!)}`;
    case 'ikke-telt': return `Ikke telt i matskapet ennå (minst ${amount(s.min!, s.unit!)})`;
    default: return s.min !== null && s.have !== null && s.unit ? `Har ${amount(s.have, s.unit)} (minst ${amount(s.min, s.unit)})` : 'Har';
  }
}

export default function StaplesView({ state, update, record, week, openList }: Props) {
  const staples = state.settings.staples ?? [];
  const facts = useMemo(() => stapleListFacts(state.list), [state.list]);
  const statuses = useMemo(() => stapleStatus(staples, state.inventory, facts, STAPLE_INFO), [staples, state.inventory, facts]);
  const suggestions = useMemo(() => stapleSuggestions(statuses, facts, week), [statuses, facts, week]);
  const [pick, setPick] = useState('');
  const [pickMin, setPickMin] = useState('');
  const [own, setOwn] = useState('');
  const [msg, setMsg] = useState('');
  const unitOf = (id: string): Unit | null => {
    const ing = stapleChoices.find((c) => c.id === id)?.ingredient;
    return countable(id, STAPLE_INFO) ? catalog.ingredients.find((i) => i.id === ing)?.unit ?? null : null;
  };
  const setStaples = (f: (cur: Staple[]) => Staple[]) => update((s) => ({ ...s, settings: { ...s.settings, staples: normalizeStaples(f(s.settings.staples ?? [])) } }));
  const parseMin = (raw: string): number | undefined | null => {
    if (raw.trim() === '') return undefined;
    const v = Number(raw.replace(',', '.'));
    return Number.isFinite(v) && v > 0 && v <= STAPLE_LIMITS.min ? Math.round(v) : null;
  };
  const addable = stapleChoices.filter((c) => !staples.some((s) => s.id === c.id)).sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  const full = staples.length >= STAPLE_LIMITS.count;
  const addPick = () => {
    if (!pick || full) return;
    const min = unitOf(pick) ? parseMin(pickMin) : undefined;
    if (min === null) { setMsg('Minstemengden må være et tall over 0.'); return; }
    setStaples((cur) => [...cur.filter((s) => s.id !== pick), min === undefined ? { id: pick } : { id: pick, min }]);
    setMsg(`${stapleChoices.find((c) => c.id === pick)?.name} er lagt til.`);
    setPick(''); setPickMin('');
  };
  const ownName = cleanStapleName(own);
  const ownId = ownName ? customStapleId(ownName) : null;
  const addOwn = () => {
    if (!ownName || !ownId || full) return;
    if (staples.some((s) => s.id === ownId)) { setMsg(`${ownName} finnes allerede.`); return; }
    setStaples((cur) => [...cur, { id: ownId, name: ownName }]);
    setMsg(`${ownName} er lagt til.`);
    setOwn('');
  };
  const remove = (s: StapleStatus) => { setStaples((cur) => cur.filter((x) => x.id !== s.id)); setMsg(`${s.name} er fjernet fra basisvarene.`); };
  const setMin = (id: string, raw: string) => {
    const min = parseMin(raw);
    if (min === null) return;
    setStaples((cur) => cur.map((s) => (s.id !== id ? s : min === undefined ? { id: s.id, ...(s.name ? { name: s.name } : {}) } : { ...s, min })));
  };
  const markAs = (s: StapleStatus, level: StapleLevel) => record({ type: 'nivå', ...stamp(), staple: s.id, level });

  return (
    <>
      <h1 className="page">Basisvarer</h1>
      <p className="fine">Varer dere alltid vil ha hjemme. Når en vare er under minstemengden i matskapet, eller dere trykker «Snart tom» eller
        «Tom», foreslås den i handlelista. Dere godkjenner eller avviser forslaget der. Forslagene har ingen pris og er ikke med i
        beregnet sum. Basisvarene og markeringene deles med de andre voksne i husstanden.</p>

      <div role="status" aria-live="polite">
        {suggestions.length > 0 && (
          <div className="notice">{suggestions.length} forslag venter i handlelista: {suggestions.map((s) => s.name).join(', ')}.
            {openList && <div><button className="ghost sm" onClick={openList}>Åpne handlelista</button></div>}</div>
        )}
        <span className="sr">{msg}</span>
      </div>

      <h2 id="basis-mine">Våre basisvarer</h2>
      <div className="card" role="group" aria-labelledby="basis-mine">
        {statuses.length === 0 && <p className="fine">Ingen basisvarer ennå. Velg fra lista nedenfor.</p>}
        <ul className="plainlist">
          {statuses.map((s) => {
            const st = staples.find((x) => x.id === s.id);
            const u = unitOf(s.id);
            return (
              <li key={s.id} className="haverow staplerow">
                <div className="stapletop"><b>{s.name}</b>
                  <button className="x" aria-label={`Fjern basisvare ${s.name}`} onClick={() => remove(s)}>✕</button></div>
                <small className={`sub ${s.suggest ? 'warntext' : ''}`}>{stapleStateText(s)}{s.open ? ' · ligger på handlelista' : ''}</small>
                <div className="haveopts">
                  {LEVELS.map((l) => (
                    <button key={l.level} type="button" className={`pill pick ${s.mark === l.level ? 'on' : ''}`} aria-pressed={s.mark === l.level}
                      aria-label={`${s.name}: ${l.text.toLowerCase()}`} onClick={() => markAs(s, l.level)}>{l.text}</button>
                  ))}
                  {u && (
                    <label className="amt"><span className="sr">Minstemengde for {s.name} i {unitWord(u)} (tom: bare nivå)</span>
                      <span aria-hidden>Minst</span>
                      <input type="number" inputMode="decimal" min={1} placeholder="–" key={`${s.id}:${st?.min ?? ''}`} defaultValue={st?.min ?? ''}
                        onBlur={(e) => { if (e.target.value !== String(st?.min ?? '')) setMin(s.id, e.target.value); }} />
                      <small aria-hidden>{u}</small></label>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="fine">Mengden hjemme er det som er bekreftet i matskapet pluss det som er markert som handlet og ikke brukt (ikke forventet rest).
          En vare som aldri er telt, regnes som ukjent og foreslås ikke ut fra mengden. «Snart tom» og «Tom» gjelder til varen er kjøpt, telt
          på nytt eller krysset av i handlelista.</p>
      </div>

      <h2>Legg til</h2>
      <div className="card">
        {full && <p className="fine">Dere har {STAPLE_LIMITS.count} basisvarer, som er det høyeste. Fjern en for å legge til en ny.</p>}
        <div className="row-field wrapfield">
          <select aria-label="Velg basisvare" value={pick} onChange={(e) => { setPick(e.target.value); setPickMin(''); }} disabled={full}>
            <option value="">Velg vare …</option>
            {addable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {pick && unitOf(pick) && (
            <>
              <input type="number" inputMode="decimal" min={1} placeholder="minst" value={pickMin} onChange={(e) => setPickMin(e.target.value)}
                aria-label={`Minstemengde i ${unitWord(unitOf(pick)!)} (tom: bare nivå)`} />
              <small aria-hidden>{unitOf(pick)}</small>
            </>
          )}
        </div>
        <button className="ghost" disabled={!pick || full} onClick={addPick}>＋ Legg til</button>
        {pick && !unitOf(pick) && <p className="fine">Denne varen telles ikke i matskapet. Bruk «Snart tom» og «Tom».</p>}
        <label className="ownstaple" htmlFor="basis-egen">Egen vare (bare varenavn)
          <input id="basis-egen" type="text" maxLength={STAPLE_LIMITS.name} autoComplete="off" value={own} onChange={(e) => setOwn(e.target.value)}
            aria-describedby="basis-egen-hjelp" disabled={full} /></label>
        <p className="fine" id="basis-egen-hjelp">Høyst {STAPLE_LIMITS.name} tegn, uten tall. Skriv bare hva varen heter, ikke navn på personer eller
          hvorfor dere trenger den (for eksempel helse eller allergi). Navnet deles med husstanden.</p>
        <button className="ghost" disabled={!ownId || full} onClick={addOwn}>＋ Legg til egen vare{ownName && ownName !== own.trim() ? ` («${ownName}»)` : ''}</button>
      </div>
      <p className="fine">Lista over varer er en generell liste over vanlige basisvarer, uten priser. Basisvarer endrer aldri ukeplanen, kurven,
        summen eller sammenligningen av butikker, og de endrer ikke allergi- eller kostfilteret.</p>
    </>
  );
}
