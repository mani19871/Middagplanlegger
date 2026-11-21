import { useState } from 'react';
import type { AppState } from '../store';
import type { Alternatives, Basket } from '../engine/types';
import { budgetAnswer, budgetSuggestions, swapOptions, type Ctx } from '../engine/planner';
import { DAYS, kr } from '../engine/format';
import { dayDate, weekStart } from './dates';
import { Thumb } from './art';
import PlanForm from './PlanForm';

interface Props {
  state: AppState; update: (f: (s: AppState) => AppState) => void; ctx: Ctx; alts: Alternatives;
  basket: Basket; activeStores: string[]; regenerate: () => void; openList: () => void;
}
type Mode = 'home' | 'plan' | 'edit';
const storeName = (ctx: Ctx, id: string) => ctx.catalog.stores.find((s) => s.id === id)?.name ?? id;
const pill = (d: number) => (d === 0 ? { t: 'Samme pris', c: 'pill' } : d > 0 ? { t: `+${Math.round(d / 100)} kr på handelen`, c: 'pill up' } : { t: `−${Math.round(-d / 100)} kr på handelen`, c: 'pill down' });

export default function WeekView({ state, update, ctx, alts, basket, activeStores, regenerate, openList }: Props) {
  const { settings, slots } = state;
  const [mode, setMode] = useState<Mode>('home');
  const [sheet, setSheet] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const start = weekStart();
  const recipe = (id: string) => ctx.catalog.recipes.find((r) => r.id === id)!;
  const portions = (day: number) => settings.eaters.filter((e) => e.daysHome[day]).reduce((a, e) => a + e.portion, 0);
  const fmtP = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

  if (slots.length === 0 || mode === 'edit') {
    return <PlanForm state={state} update={update} hasPlan={slots.length > 0}
      onDone={() => { regenerate(); setMode('plan'); }} />;
  }
  const answer = budgetAnswer(basket, settings.budgetOre);
  const margin = settings.budgetOre - basket.totalOre;
  const sugg = answer === 'over' ? budgetSuggestions(slots, activeStores, ctx) : [];
  const { regular, combo } = alts;
  const hero = slots[0];
  const hr = recipe(hero.recipeId);
  const pct = Math.min(100, Math.round((basket.totalOre / settings.budgetOre) * 100));

  const summary = (
    <div className="card total">
      <div className="tcol"><span className="lab">Anslått handel</span>
        <strong className={answer === 'over' ? 'bad' : ''}>{kr(basket.totalOre)}</strong></div>
      <div className="tcol r"><span className="lab">Budsjett</span><strong className="sm">{kr(settings.budgetOre)}</strong></div>
      <div className="bar"><i style={{ width: `${pct}%` }} className={answer === 'over' ? 'over' : ''} /></div>
      <p className="fine">
        {answer === 'innenfor' && `Anslått innenfor budsjett · margin ${kr(margin)} · `}
        {answer === 'over' && `Anslått ${kr(-margin)} over budsjett · `}
        {answer === 'ufullstendig' && `Ufullstendig prisgrunnlag, kjent delsum · `}
        {basket.stops} butikk{basket.stops === 1 ? '' : 'er'} · {basket.estimatedCount} estimert · {basket.unknownCount} ukjent pris
      </p>
      {answer === 'ufullstendig' && <p className="fine">Mangler pris: {basket.lines.filter((l) => l.costOre === null).map((l) => l.name).join(', ')}. Kurven kan ikke bekreftes innenfor budsjett.</p>}
    </div>
  );

  if (mode === 'home') {
    return (
      <>
        <h1 className="page">Denne uka</h1>
        <div className="hero">
          <div className="heroart"><Thumb id={hr.id} size={120} /></div>
          <div className="herocap"><strong>{DAYS[hero.day]} · {hr.name}</strong><span>{hr.minutes} min · {fmtP(portions(hero.day))} porsjoner</span></div>
        </div>
        {summary}
        <button className="cta" onClick={() => setMode('plan')}>Se ukeplan ›</button>
        <button className="ghost" onClick={openList}>Åpne handlelista</button>
      </>
    );
  }

  const sheetSlot = sheet !== null ? slots.find((s) => s.day === sheet) : undefined;
  const opts = sheetSlot ? swapOptions(slots, sheetSlot.day, activeStores, ctx).filter((o) => o.recipe.id !== sheetSlot.recipeId) : [];
  const chosen = opts.find((o) => o.recipe.id === pick);
  const closeSheet = () => { setSheet(null); setPick(null); };
  const patchSlot = (day: number, patch: object) => update((s) => ({ ...s, approved: false, slots: s.slots.map((x) => (x.day === day ? { ...x, ...patch } : x)) }));
  const withExtra = slots.filter((s) => (s.extra ?? 0) > 0);

  return (
    <>
      <div className="pagehead"><h1 className="page">Ukeplan</h1><button className="ghost sm" onClick={() => setMode('edit')}>✎ Rediger uke</button></div>
      {slots.map((s) => {
        const r = recipe(s.recipeId);
        const d = dayDate(start, s.day);
        return (
          <button key={s.day} className="row card" onClick={() => { setSheet(s.day); setPick(null); }}>
            <span className="dchip"><small>{DAYS[s.day].slice(0, 3)}</small><b>{d.getDate()}.</b></span>
            <Thumb id={r.id} />
            <span className="rinfo"><strong>{r.name}{s.locked && ' 🔒'}</strong>
              <small>⏱ {r.minutes} min · 👥 {fmtP(portions(s.day) + (s.extra ?? 0))} porsjoner</small></span>
            <span aria-hidden>›</span>
          </button>
        );
      })}
      {withExtra.map((s) => (
        <div key={`m${s.day}`} className="card matpakke">🥪 <span><strong>Matpakker</strong><br />
          {s.extraFor !== undefined ? DAYS[s.extraFor] : 'Senere'} · {fmtP(s.extra ?? 0)} porsjon fra {DAYS[s.day].toLowerCase()}</span></div>
      ))}
      {summary}
      {sugg.length > 0 && (
        <ul className="sugg">{sugg.map((g) => (
          <li key={g.day}><button className="ghost" onClick={() => patchSlot(g.day, { recipeId: g.option.recipe.id, locked: true })}>
            Bytt {DAYS[g.day].toLowerCase()} til {g.option.recipe.name} → {kr(g.newTotalOre)}</button></li>))}</ul>
      )}
      <h3>Butikkvalg for samme meny</h3>
      <div className="altgrid">
        <button className={`card alt ${state.option === 'regular' ? 'sel' : ''}`} onClick={() => update((s) => ({ ...s, option: 'regular', approved: false }))}>
          <strong>Vanlig butikk</strong><span>{storeName(ctx, settings.regularStoreId)}</span>
          <span>{regular.complete ? kr(regular.totalOre) : `${kr(regular.totalOre)} + ${regular.unknownCount} ukjent`}</span>
          {alts.recommended === 'regular' && <em>Anbefalt</em>}
        </button>
        {combo ? (
          <button className={`card alt ${state.option === 'combo' ? 'sel' : ''}`} onClick={() => update((s) => ({ ...s, option: 'combo', approved: false }))}>
            <strong>Beste kombinasjon</strong>
            <span>{[...new Set(combo.lines.map((l) => l.storeId).filter((x): x is string => !!x))].map((id) => storeName(ctx, id)).join(' + ')} · {combo.stops} stopp</span>
            <span>{kr(combo.totalOre)}{alts.savingOre !== null && ` · ${kr(alts.savingOre)} lavere varekostnad`}</span>
            {alts.recommended === 'combo' && <em>Anbefalt</em>}
            {alts.recommended === 'regular' && alts.savingOre !== null && <small>Under grensen på {kr(settings.extraStoreThresholdOre)} for en ekstra butikk. Du kan likevel velge den.</small>}
          </button>
        ) : <div className="card alt muted"><strong>Beste kombinasjon</strong><span>Ingen komplett kombinasjon med priser for alle varer.</span></div>}
      </div>
      <p className="fine">«Laveste beregnede pris blant sammenlignede alternativer», ikke en garanti. Reisetid og drivstoff er ikke med.</p>
      <button className="cta" onClick={() => { update((s) => ({ ...s, approved: true })); openList(); }}>{state.approved ? 'Åpne handlelista' : 'Godkjenn og handle'} ›</button>
      <button className="ghost" onClick={regenerate}>Lag ny uke (låste beholdes)</button>

      {sheetSlot && (
        <div className="backdrop" onClick={closeSheet}>
          <div className="sheet" role="dialog" aria-label={`Bytt ${DAYS[sheetSlot.day].toLowerCase()}s middag`} onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <div className="pagehead"><h2>Bytt {DAYS[sheetSlot.day].toLowerCase()}s middag</h2><button className="x" aria-label="Lukk" onClick={closeSheet}>✕</button></div>
            <small className="lab">Dagens rett</small>
            <div className="row inner"><Thumb id={sheetSlot.recipeId} /><span className="rinfo"><strong>{recipe(sheetSlot.recipeId).name}</strong>
              <small>⏱ {recipe(sheetSlot.recipeId).minutes} min</small></span></div>
            <details className="steps"><summary>Fremgangsmåte</summary><ol>{recipe(sheetSlot.recipeId).steps.map((t) => <li key={t}>{t}</li>)}</ol></details>
            <div className="toggles">
              <label className="switch"><input type="checkbox" checked={sheetSlot.locked} onChange={() => patchSlot(sheetSlot.day, { locked: !sheetSlot.locked })} /> Lås denne retten</label>
              <label className="switch"><input type="checkbox" checked={(sheetSlot.extra ?? 0) > 0}
                onChange={(e) => patchSlot(sheetSlot.day, e.target.checked
                  ? { extra: 1, extraFor: slots.find((x) => x.day > sheetSlot.day)?.day ?? sheetSlot.day + 1 } : { extra: 0, extraFor: undefined })} /> Reserver 1 ekstra porsjon til matpakke</label>
            </div>
            <small className="lab">Velg ny middag</small>
            <div className="opts">
              {opts.map((o) => {
                const p = pill(o.deltaOre);
                return (
                  <label key={o.recipe.id} className={`row inner opt ${pick === o.recipe.id ? 'sel' : ''}`}>
                    <input type="radio" name="swap" checked={pick === o.recipe.id} onChange={() => setPick(o.recipe.id)} />
                    <Thumb id={o.recipe.id} size={48} />
                    <span className="rinfo"><strong>{o.recipe.name}</strong>
                      {o.complete ? <span className={p.c}>{p.t}</span> : <span className="pill warnp">ufullstendig pris</span>}</span>
                  </label>
                );
              })}
            </div>
            {chosen && <div className="card total2"><span>Ny anslått handel{chosen.complete ? '' : ' (delsum)'}</span><strong>{kr(basket.totalOre + chosen.deltaOre)}</strong></div>}
            <button className="cta" disabled={!chosen} onClick={() => { patchSlot(sheetSlot.day, { recipeId: pick!, locked: true }); closeSheet(); }}>
              {chosen ? `Velg ${chosen.recipe.name.toLowerCase()} ›` : 'Velg en middag'}</button>
          </div>
        </div>
      )}
    </>
  );
}
