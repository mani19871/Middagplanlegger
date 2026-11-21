import type { AppState } from '../store';
import type { Alternatives, Basket } from '../engine/types';
import { budgetAnswer, budgetSuggestions, swapOptions, type Ctx } from '../engine/planner';
import { DAYS, kr } from '../engine/format';

interface Props {
  state: AppState; update: (f: (s: AppState) => AppState) => void; ctx: Ctx; alts: Alternatives;
  basket: Basket; activeStores: string[]; regenerate: () => void; openList: () => void;
}
const swapText = (d: number) => (d === 0 ? 'handelen blir lik' : d > 0 ? `handelen blir ${kr(d)} dyrere` : `handelen blir ${kr(-d)} billigere`);
const storeName = (ctx: Ctx, id: string) => ctx.catalog.stores.find((s) => s.id === id)?.name ?? id;

export default function WeekView({ state, update, ctx, alts, basket, activeStores, regenerate, openList }: Props) {
  const { settings, slots } = state;
  if (slots.length === 0) {
    return (
      <section className="card">
        <h2>Lag din første uke</h2>
        <p>Appen foreslår middager innenfor {kr(settings.budgetOre)} for {settings.days.filter((d) => d.enabled).length} dager.
          Du kan endre budsjett, hvem som spiser og butikker under Innstillinger.</p>
        <button className="primary" onClick={regenerate}>Lag min første uke</button>
      </section>
    );
  }
  const answer = budgetAnswer(basket, settings.budgetOre);
  const margin = settings.budgetOre - basket.totalOre;
  const sugg = answer === 'over' ? budgetSuggestions(slots, activeStores, ctx) : [];
  const { regular, combo } = alts;

  return (
    <>
      <section className="card summary">
        {answer === 'innenfor' && <h2 className="ok">Anslått {kr(basket.totalOre)} av {kr(settings.budgetOre)}</h2>}
        {answer === 'over' && <h2 className="bad">Anslått {kr(basket.totalOre)} · {kr(-margin)} over {kr(settings.budgetOre)}</h2>}
        {answer === 'ufullstendig' && <h2 className="warn">Ufullstendig prisgrunnlag · kjent delsum {kr(basket.totalOre)}</h2>}
        <p>
          {basket.stops} butikk{basket.stops === 1 ? '' : 'er'} · {basket.lines.length} varelinjer ·{' '}
          {basket.estimatedCount} estimert pris · {basket.unknownCount} ukjent pris
          {answer === 'innenfor' && <> · margin {kr(margin)}</>}
        </p>
        {answer === 'ufullstendig' && (
          <p>Mangler pris: {basket.lines.filter((l) => l.costOre === null).map((l) => l.name).join(', ')}. Kurven kan ikke kåres billigst
            eller bekreftes innenfor budsjett.</p>
        )}
        {sugg.length > 0 && (
          <ul className="sugg">
            {sugg.map((g) => (
              <li key={g.day}>
                <button onClick={() => update((s) => ({ ...s, approved: false, slots: s.slots.map((x) => (x.day === g.day ? { ...x, recipeId: g.option.recipe.id } : x)) }))}>
                  Bytt {DAYS[g.day].toLowerCase()} til {g.option.recipe.name} → {kr(g.newTotalOre)}
                </button>
              </li>
            ))}
            {answer === 'over' && combo && <li>Tillat en butikk til (se alternativer under).</li>}
          </ul>
        )}
      </section>

      <section className="alts">
        <h3>Alternativer for samme meny</h3>
        <div className="altgrid">
          <button className={`card alt ${state.option === 'regular' ? 'sel' : ''}`} onClick={() => update((s) => ({ ...s, option: 'regular', approved: false }))}>
            <strong>Vanlig butikk</strong>
            <span>{storeName(ctx, settings.regularStoreId)}</span>
            <span>{regular.complete ? kr(regular.totalOre) : `${kr(regular.totalOre)} + ${regular.unknownCount} ukjent`}</span>
            {alts.recommended === 'regular' && <em>Anbefalt</em>}
          </button>
          {combo ? (
            <button className={`card alt ${state.option === 'combo' ? 'sel' : ''}`} onClick={() => update((s) => ({ ...s, option: 'combo', approved: false }))}>
              <strong>Beste kombinasjon</strong>
              <span>{[...new Set(combo.lines.map((l) => l.storeId).filter((x): x is string => !!x))].map((id) => storeName(ctx, id)).join(' + ')} · {combo.stops} stopp</span>
              <span>{kr(combo.totalOre)}{alts.savingOre !== null && ` · ${kr(alts.savingOre)} lavere varekostnad`}</span>
              {alts.recommended === 'combo' && <em>Anbefalt</em>}
              {alts.recommended === 'regular' && alts.savingOre !== null && (
                <small>Under familiens grense på {kr(settings.extraStoreThresholdOre)} for en ekstra butikk. Du kan likevel velge den.</small>
              )}
            </button>
          ) : (
            <div className="card alt muted"><strong>Beste kombinasjon</strong><span>Ingen komplett kombinasjon med priser for alle varer.</span></div>
          )}
        </div>
        <p className="fine">«Laveste beregnede pris blant sammenlignede alternativer» – ikke en garanti. Reisetid og drivstoff er ikke med.</p>
      </section>

      <section>
        <h3>Middager</h3>
        {slots.map((slot) => {
          const r = ctx.catalog.recipes.find((x) => x.id === slot.recipeId)!;
          const swaps = swapOptions(slots, slot.day, activeStores, ctx);
          return (
            <article key={slot.day} className="card day">
              <div className="dayhead">
                <span className="dname">{DAYS[slot.day]}</span>
                <button className={`lock ${slot.locked ? 'on' : ''}`} aria-pressed={slot.locked}
                  onClick={() => update((s) => ({ ...s, slots: s.slots.map((x) => (x.day === slot.day ? { ...x, locked: !x.locked } : x)) }))}>
                  {slot.locked ? '🔒 Låst' : 'Lås'}
                </button>
              </div>
              <h4>{r.name}</h4>
              <p>{r.minutes} min · {Math.round(settings.eaters.filter((e) => e.daysHome[slot.day]).reduce((a, e) => a + e.portion, 0) * 10) / 10} porsjoner</p>
              <details>
                <summary>Fremgangsmåte</summary>
                <ol>{r.steps.map((st) => <li key={st}>{st}</li>)}</ol>
              </details>
              <label className="swap">Bytt rett
                <select value="" onChange={(e) => {
                  if (!e.target.value) return;
                  update((s) => ({ ...s, approved: false, slots: s.slots.map((x) => (x.day === slot.day ? { ...x, recipeId: e.target.value, locked: true } : x)) }));
                }}>
                  <option value="">Velg…</option>
                  {swaps.map((o) => (
                    <option key={o.recipe.id} value={o.recipe.id}>
                      {o.recipe.name} · {o.complete ? swapText(o.deltaOre) : 'ufullstendig pris'}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          );
        })}
      </section>

      <div className="actions">
        <button onClick={regenerate}>Lag ny uke (låste beholdes)</button>
        <button className="primary" onClick={() => { update((s) => ({ ...s, approved: true })); openList(); }}>
          {state.approved ? 'Åpne handlelista' : 'Godkjenn og handle'}
        </button>
      </div>
    </>
  );
}
