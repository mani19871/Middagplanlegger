import { lunchDay } from './lunch';
import { useState } from 'react';
import type { AppState } from '../store';
import type { Alternatives, Basket } from '../engine/types';
import {
  budgetAnswer, budgetSuggestions, dealsFor, lockedViolations, portionsOnDay, recipeTags, requirementViolation, slotViolations, swapOptions,
  type Ctx, type LockedViolation,
} from '../engine/planner';
import { ALLERGEN_LABEL } from '../engine/allergens';
import { chainSet, COMMON_CHAINS, normalizeChain } from '../engine/chains';
import { hintChain } from '../engine/deals';
import { DAYS, kr, num } from '../engine/format';
import { dayDate, weekStart } from './dates';
import { Thumb } from './art';
import { recipeAllergenText } from './allergenText';
import PlanForm from './PlanForm';
import OfferTotalNote from './OfferTotalNote';
import { ChangesNote, type ChangeKit } from './ListChanges';
import { Sheet } from './Sheet';
import type { OfferTotal } from '../engine/offerTotal';
import { recipeNutrition, scaleNutrition, weekNutrition, type NutritionTable } from '../engine/nutrition';
import nutritionData from '../data/nutrition.json';

const NUTRITION = nutritionData.items as unknown as NutritionTable;

interface Props {
  state: AppState; update: (f: (s: AppState) => AppState) => void; ctx: Ctx; alts: Alternatives;
  basket: Basket; activeStores: string[]; regenerate: () => void; openList: () => void;
  offerTotal: OfferTotal; approvedHints: number;
  mode: Mode; setMode: (m: Mode) => void;
  /** Brukerens valg fra handlelista: samme justering i bytteforslag, godkjenning som lager planversjon. */
  kit: ChangeKit;
}
export type Mode = 'home' | 'plan' | 'edit' | 'trip';
const storeName = (ctx: Ctx, id: string) => ctx.catalog.stores.find((s) => s.id === id)?.name ?? id;
/** «allergikravet ditt (gluten)», «kostkravet ditt (bare vegetar)», «råvarekravet ditt (fisk)». */
function requirementText(v: LockedViolation, ctx: Ctx): string {
  const r = ctx.catalog.recipes.find((x) => x.id === v.recipeId);
  const s = ctx.settings;
  if (v.reason === 'allergen') return `allergikravet ditt (${(r?.allergens ?? []).filter((a) => s.avoid.includes(a)).map((a) => ALLERGEN_LABEL[a].toLowerCase()).join(', ')})`;
  if (v.reason === 'kost') return 'kostkravet ditt (bare vegetar)';
  const tags = r ? recipeTags(r, ctx.catalog.ingredients) : new Set();
  return `råvarekravet ditt (${(s.avoidFoods ?? []).filter((t) => tags.has(t)).join(', ')})`;
}
/** Kjeder å velge for tilbud: de vanligste pluss kjedene i live-tilbudene, med visningsnavn fra kilden. */
function chainOptions(ctx: Ctx): { chain: string; label: string }[] {
  const m = new Map(COMMON_CHAINS.map((c) => [c.chain, c.label]));
  for (const h of ctx.offers ?? []) { const c = hintChain(h); if (c && !m.has(c)) m.set(c, h.dealer); }
  for (const c of ctx.settings.offerChains ?? []) { const n = normalizeChain(c); if (n && !m.has(n)) m.set(n, c); }
  return [...m].map(([chain, label]) => ({ chain, label })).sort((a, b) => a.label.localeCompare(b.label, 'nb'));
}
const pill = (d: number) => (d === 0 ? { t: 'Samme pris', c: 'pill' } : d > 0 ? { t: `+${num(d / 100, 0)} kr på handelen`, c: 'pill up' } : { t: `−${num(-d / 100, 0)} kr på handelen`, c: 'pill down' });

export default function WeekView({ state, update, ctx, alts, basket, activeStores, regenerate, openList, mode, setMode, offerTotal, approvedHints, kit }: Props) {
  const { settings, slots } = state;
  const [sheet, setSheet] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  /**
   * Låste retter som `generatePlan` slipper ut: brudd på absolutte krav, eller dagen er slått av / ingen spiser hjemme.
   * `future`: varsel før «Lag ukeplan»; ellers etter. Beregnes fra planen og innstillingene FØR ny plan lages.
   */
  const lockNotes = (future: boolean): string[] => {
    const broken = lockedViolations(slots, ctx);
    const off = slots.filter((x) => x.locked && !broken.some((v) => v.day === x.day)
      && (!settings.days[x.day]?.enabled || portionsOnDay(settings, x.day) <= 0));
    const head = (id: string, day: number) => `Låst rett ${recipe(id).name} (${DAYS[day].toLowerCase()})`;
    return [
      ...broken.map((v) => `${head(v.recipeId, v.day)} ${future ? `bryter ${requirementText(v, ctx)} og blir fjernet når du lager ukeplan` : `ble fjernet fordi den bryter ${requirementText(v, ctx)}`}.`),
      ...off.map((x) => {
        const why = settings.days[x.day]?.enabled ? 'ingen spiser hjemme den dagen' : 'dagen er slått av';
        return `${head(x.recipeId, x.day)} ${future ? `blir fjernet når du lager ukeplan fordi ${why}` : `ble fjernet fordi ${why}`}.`;
      }),
    ];
  };
  const [dropped, setDropped] = useState<string[]>([]);
  const regen = () => { setDropped(lockNotes(false)); regenerate(); };
  /** En rett låses aldri automatisk hvis den bryter et absolutt krav (allergi, kost, råvare). */
  const lockable = (id: string) => requirementViolation(recipe(id), ctx) === null;
  const broken = slotViolations(slots, ctx);
  const noChains = settings.useOffers !== false && (ctx.offers ?? []).some((h) => h.approved) && chainSet(settings.offerChains).size === 0;
  const start = weekStart();
  const recipe = (id: string) => ctx.catalog.recipes.find((r) => r.id === id)!;
  const portions = (day: number) => settings.eaters.filter((e) => e.daysHome[day]).reduce((a, e) => a + e.portion, 0);
  const allergens = (id: string) => recipeAllergenText(recipe(id), ctx.catalog);
  const nutr = (id: string) => recipeNutrition(recipe(id), ctx.catalog.ingredients, NUTRITION);
  const dealText = (id: string, day: number) => {
    const d = dealsFor(recipe(id), day, ctx);
    if (d.lines.length === 0) return null;
    const names = d.lines.map((l) => `${ctx.catalog.ingredients.find((i) => i.id === l.ingredient)?.name.toLowerCase()} hos ${l.dealer}`);
    return `🏷 På tilbud: ${names.join(', ')}${d.savingOre > 0 ? ` · spar ca. ${kr(d.savingOre)}` : ''}`;
  };
  const weekSaving = slots.reduce((sum, x) => sum + dealsFor(recipe(x.recipeId), x.day, ctx).savingOre, 0);
  const weekDealLines = slots.reduce((sum, x) => sum + dealsFor(recipe(x.recipeId), x.day, ctx).lines.length, 0);
  const fmtP = (n: number) => num(n, 1);

  if (slots.length === 0 || mode === 'edit') {
    return <PlanForm state={state} update={update} hasPlan={slots.length > 0} chains={chainOptions(ctx)}
      lockWarnings={lockNotes(true)}
      onDone={() => { regen(); setMode('plan'); }} />;
  }
  const answer = budgetAnswer(basket, settings.budgetOre);
  const margin = settings.budgetOre - basket.totalOre;
  const sugg = answer === 'over' ? budgetSuggestions(slots, activeStores, ctx, 3, kit.swapAdjust) : [];
  const { regular, combo } = alts;
  const hero = slots[0];
  const hr = recipe(hero.recipeId);
  const pct = Math.min(100, Math.round((basket.totalOre / settings.budgetOre) * 100));

  const warnings = (
    <>
      {dropped.length > 0 && (
        <div className="banner warn" role="alert">
          {dropped.map((d) => <p key={d}>⚠ {d}</p>)}
          <button className="ghost sm" onClick={() => setDropped([])}>OK</button>
        </div>
      )}
      {broken.length > 0 && (
        <div className="banner warn" role="alert">
          {broken.map((v) => <p key={v.day}>⚠ {DAYS[v.day]}: {recipe(v.recipeId).name} bryter {requirementText(v, ctx)}.</p>)}
          <button className="ghost sm" onClick={regen}>Lag ny uke uten disse</button>
        </div>
      )}
      {noChains && (
        <div className="banner">🏷 Tilbud regnes ikke inn før du velger kjedene du handler hos.{' '}
          <button className="ghost sm" onClick={() => setMode('edit')}>Velg kjeder</button></div>
      )}
    </>
  );
  const summary = (
    <div className="card total">
      <div className="tcol"><span className="lab">Anslått handel</span>
        <strong className={answer === 'over' ? 'bad' : ''}>{kr(basket.totalOre)}</strong></div>
      <div className="tcol r"><span className="lab">Budsjett</span><strong className="sm">{kr(settings.budgetOre)}</strong></div>
      <p className="sr">Anslått handel {kr(basket.totalOre)} av budsjett {kr(settings.budgetOre)}. Anslått pris, ikke en garanti for sluttpris.</p>
      <div className="bar" aria-hidden><i style={{ width: `${pct}%` }} className={answer === 'over' ? 'over' : ''} /></div>
      <p className="fine" role="status">
        {answer === 'innenfor' && `Anslått innenfor budsjett · margin ${kr(margin)} · `}
        {answer === 'over' && `Anslått ${kr(-margin)} over budsjett · `}
        {answer === 'ufullstendig' && `Ufullstendig prisgrunnlag, kjent delsum · `}
        {basket.stops} butikk{basket.stops === 1 ? '' : 'er'} · {basket.estimatedCount} estimert · {basket.unknownCount} ukjent pris
      </p>
      {answer === 'ufullstendig' && <p className="fine">Mangler pris: {basket.lines.filter((l) => l.costOre === null).map((l) => l.name).join(', ')}. Kurven kan ikke bekreftes innenfor budsjett.</p>}
      <ChangesNote basket={basket} />
      <OfferTotalNote total={offerTotal} approvedHints={approvedHints} />
    </div>
  );

  if (mode === 'home') {
    return (
      <>
        <h1 className="page">Denne uka</h1>
        <div className="hero">
          <div className="heroart"><Thumb id={hr.id} size={120} /></div>
          <div className="herocap"><strong>{DAYS[hero.day]} · {hr.name}</strong><span>{hr.minutes} min · {fmtP(portions(hero.day))} porsjoner</span>
            <small className="allergen">{allergens(hr.id)}</small></div>
        </div>
        {warnings}
        {summary}
        <button className="cta" onClick={() => setMode('plan')}>Se ukeplan ›</button>
        <button className="ghost" onClick={openList}>Åpne handlelista</button>
      </>
    );
  }

  if (mode === 'trip') {
    const usedStores = (b: Basket) => [...new Set(b.lines.map((l) => l.storeId).filter((x): x is string => !!x))].map((id) => storeName(ctx, id));
    const sel = state.option === 'combo' && combo ? 'combo' : 'regular';
    const saving = alts.savingOre;
    const extraStop = combo ? combo.stops > regular.stops : false;
    return (
      <>
        <div className="pagehead"><button className="x" aria-label="Tilbake" onClick={() => setMode('plan')}>←</button></div>
        <h1 className="page">Velg handletur</h1>
        <p className="fine">Samme {slots.length} middager.</p>
        <ChangesNote basket={basket} />
        <div role="radiogroup" aria-label="Handletur">
        <button role="radio" aria-checked={sel === 'regular'} className={`card alt big ${sel === 'regular' ? 'sel' : ''}`} onClick={() => update((s) => ({ ...s, option: 'regular' }))}>
          <span className="radio" aria-hidden>{sel === 'regular' ? '◉' : '○'}</span>
          <span className="rinfo"><strong>Én butikk</strong><small>{storeName(ctx, settings.regularStoreId)}</small></span>
          <strong className="amt">{regular.complete ? kr(regular.totalOre) : `${kr(regular.totalOre)}+`}</strong>
        </button>
        {combo ? (
          <button role="radio" aria-checked={sel === 'combo'} className={`card alt big ${sel === 'combo' ? 'sel' : ''}`} onClick={() => update((s) => ({ ...s, option: 'combo' }))}>
            <span className="radio" aria-hidden>{sel === 'combo' ? '◉' : '○'}</span>
            <span className="rinfo"><strong>{combo.stops >= 2 ? 'To butikker' : 'Annen butikk'}</strong><small>{usedStores(combo).join(' + ')}</small></span>
            <strong className="amt">{combo.complete ? kr(combo.totalOre) : `${kr(combo.totalOre)}+`}</strong>
          </button>
        ) : <div className="card alt muted"><strong>Ingen komplett kombinasjon</strong><span>Ikke alle varer har pris i flere butikker.</span></div>}
        </div>
        {combo && saving !== null && saving > 0 && (
          <div className="banner">🏷 Du sparer <b>{kr(saving)}</b> {extraStop ? 'med et ekstra stopp' : 'ved å bytte butikk'}.</div>
        )}
        {!regular.complete && <div className="banner warn">Vanlig butikk mangler pris på {regular.unknownCount} vare{regular.unknownCount === 1 ? '' : 'r'}, og kan ikke kåres billigst.</div>}
        {combo && !combo.complete && <div className="banner warn">Kombinasjonen mangler pris på {combo.unknownCount} vare{combo.unknownCount === 1 ? '' : 'r'}, og kan ikke kåres billigst.</div>}
        <label className="thr">Minste besparelse for ekstra stopp
          <select value={settings.extraStoreThresholdOre} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, extraStoreThresholdOre: Number(e.target.value) } }))}>
            {[0, 2500, 5000, 10000, 20000].map((v) => <option key={v} value={v}>{kr(v)}</option>)}
          </select></label>
        <p className="fine">Anbefaling: {alts.recommended === 'combo' ? 'kombinasjonen' : 'én butikk'}. «Laveste beregnede pris blant sammenlignede alternativer», ikke en garanti. Reisetid og drivstoff er ikke med.</p>
        <button className="cta" onClick={() => { kit.approve(sel); setMode('plan'); openList(); }}>
          {sel === 'combo' && combo && combo.stops >= 2 ? 'Velg to butikker' : 'Velg én butikk'}</button>
      </>
    );
  }

  const sheetSlot = sheet !== null ? slots.find((s) => s.day === sheet) : undefined;
  const opts = sheetSlot ? swapOptions(slots, sheetSlot.day, activeStores, ctx, kit.swapAdjust).filter((o) => o.recipe.id !== sheetSlot.recipeId) : [];
  const chosen = opts.find((o) => o.recipe.id === pick);
  const closeSheet = () => { setSheet(null); setPick(null); };
  const patchSlot = (day: number, patch: object) => update((s) => ({ ...s, approved: false, slots: s.slots.map((x) => (x.day === day ? { ...x, ...patch } : x)) }));
  const withExtra = slots.filter((s) => (s.extra ?? 0) > 0);
  const weekN = weekNutrition(slots, settings.eaters, (id) => nutr(id));
  const groups = [...new Map(settings.eaters.map((e) => [e.portion, e.portion])).keys()].sort((a, b) => b - a)
    .map((f) => ({ f, names: settings.eaters.filter((e) => e.portion === f).map((e) => e.label).join(', ') }));

  return (
    <>
      <div className="pagehead"><h1 className="page">Ukeplan</h1><button className="ghost sm" onClick={() => setMode('edit')}>✎ Rediger uke</button></div>
      {warnings}
      {slots.map((s) => {
        const r = recipe(s.recipeId);
        const d = dayDate(start, s.day);
        return (
          <button key={s.day} className="row card" onClick={() => { setSheet(s.day); setPick(null); }}>
            <span className="dchip"><small>{DAYS[s.day].slice(0, 3)}</small><b>{d.getDate()}.</b></span>
            <Thumb id={r.id} />
            <span className="rinfo"><strong>{r.name}{s.locked && ' 🔒'}</strong>
              <small>⏱ {r.minutes} min · 👥 {fmtP(portions(s.day) + (s.extra ?? 0))} porsjoner</small>
              <small className="allergen">{allergens(r.id)}</small>
              {dealText(r.id, s.day) && <small className="dealtxt">{dealText(r.id, s.day)}</small>}</span>
            <span aria-hidden>›</span>
          </button>
        );
      })}
      {withExtra.map((s) => (
        <div key={`m${s.day}`} className="card matpakke">🥪 <span><strong>Matpakker</strong><br />
          {s.extraFor !== undefined ? DAYS[s.extraFor] : 'Senere'} · {fmtP(s.extra ?? 0)} porsjon fra {DAYS[s.day].toLowerCase()}
          <span className="pills" role="group" aria-label={`Pakkes i, matpakke fra ${DAYS[s.day].toLowerCase()}`}>
            {(['termos', 'matboks'] as const).map((b) => (
              <button key={b} className={`pill pick ${s.lunchBox === b ? 'on' : ''}`} aria-pressed={s.lunchBox === b}
                onClick={() => patchSlot(s.day, { lunchBox: s.lunchBox === b ? undefined : b })}>{b === 'termos' ? 'Termos' : 'Matboks'}</button>
            ))}
          </span></span></div>
      ))}
      <details className="card weeknutr">
        <summary>Næring i uka (veiledende)</summary>
        {weekN.eaters.map((e) => (
          <div key={e.id} className="nrow"><span>{e.label} <small>({fmtP(e.portion)} porsjon)</small></span>
            <span>{e.kcalPerDay === null ? 'ikke hjemme på middag' : `ca. ${num(e.kcalPerDay, 0)} kcal · ${fmtP(e.proteinPerDay ?? 0)} g protein per middagsdag`}</span></div>
        ))}
        {weekN.reserved.portions > 0 && <div className="nrow"><span>Reserverte porsjoner</span>
          <span>{fmtP(weekN.reserved.portions)} porsjon, ca. {num(weekN.reserved.kcal, 0)} kcal totalt. Ikke fordelt på person.</span></div>}
        <p className="fine">Gjelder bare middagene i planen, regnet fra generelle matvarer i Matvaretabellen, uten salt, olje og krydder. Veiledende tall for planlegging. Ikke kostråd eller anbefalt inntak.</p>
      </details>
      {summary}
      {weekDealLines > 0 && <div className="banner deal">🏷 {weekDealLines} varer i uka er på tilbud{weekSaving > 0 ? `, ca. ${kr(weekSaving)} lavere enn førpris` : ''}. Bare regelgodkjente tilbud med kjent pris, mengde og vilkår regnes inn i «Med kontrollerte tilbud»; summen over er uendret.</div>}
      {sugg.length > 0 && (
        <ul className="sugg">{sugg.map((g) => (
          <li key={g.day}><button className="ghost" onClick={() => patchSlot(g.day, { recipeId: g.option.recipe.id, locked: lockable(g.option.recipe.id) })}>
            Bytt {DAYS[g.day].toLowerCase()} til {g.option.recipe.name} → {kr(g.newTotalOre)}</button></li>))}</ul>
      )}
      <button className="cta" onClick={() => { update((s) => ({ ...s, option: alts.recommended })); setMode('trip'); }}>{state.approved ? 'Velg handletur på nytt' : 'Godkjenn og velg handletur'} ›</button>
      <button className="ghost" onClick={regen}>Lag ny uke (låste beholdes)</button>

      {sheetSlot && (
        <Sheet label={`Bytt ${DAYS[sheetSlot.day].toLowerCase()}s middag`} onClose={closeSheet}>
            <div className="grab" aria-hidden />
            <div className="pagehead"><h2>Bytt {DAYS[sheetSlot.day].toLowerCase()}s middag</h2><button className="x" data-autofocus aria-label="Lukk" onClick={closeSheet}>✕</button></div>
            <small className="lab">Dagens rett</small>
            <div className="row inner"><Thumb id={sheetSlot.recipeId} /><span className="rinfo"><strong>{recipe(sheetSlot.recipeId).name}</strong>
              <small>⏱ {recipe(sheetSlot.recipeId).minutes} min</small>
              <small className="allergen">{allergens(sheetSlot.recipeId)}</small></span></div>
            <details className="steps"><summary>Fremgangsmåte</summary><ol>{recipe(sheetSlot.recipeId).steps.map((t) => <li key={t}>{t}</li>)}</ol></details>
            {(() => { const n = nutr(sheetSlot.recipeId); return (
              <div className="fine">Næring per porsjonstype, ca. (veiledende):
                {groups.map((g) => { const x = scaleNutrition(n, g.f); return (
                  <div key={g.f} className="nrow"><span>{g.names} <small>({fmtP(g.f)} porsjon)</small></span>
                    <span>{num(x.kcal, 0)} kcal · {fmtP(x.protein)} g protein · {fmtP(x.fat)} g fett · {fmtP(x.carbs)} g karbohydrat</span></div>); })}
                {n.assumed.length > 0 && <div>Omtrentlig (mengde i ml regnet som gram).</div>}
              </div>); })()}
            <div className="toggles">
              <label className="switch"><input type="checkbox" checked={sheetSlot.locked} disabled={!sheetSlot.locked && !lockable(sheetSlot.recipeId)}
                onChange={() => patchSlot(sheetSlot.day, { locked: !sheetSlot.locked && lockable(sheetSlot.recipeId) })} /> Lås denne retten
                {!lockable(sheetSlot.recipeId) && <small> (kan ikke låses: bryter kravene dine)</small>}</label>
              <label className="switch"><input type="checkbox" checked={(sheetSlot.extra ?? 0) > 0}
                onChange={(e) => patchSlot(sheetSlot.day, e.target.checked
                  ? { extra: 1, extraFor: lunchDay(slots, sheetSlot.day) } : { extra: 0, extraFor: undefined })} /> Reserver 1 ekstra porsjon til matpakke</label>
            </div>
            <small className="lab" id="swaplab">Velg ny middag</small>
            <div className="opts" role="radiogroup" aria-labelledby="swaplab">
              {opts.map((o) => {
                const p = pill(o.deltaOre);
                return (
                  <label key={o.recipe.id} className={`row inner opt ${pick === o.recipe.id ? 'sel' : ''}`}>
                    <input type="radio" name="swap" checked={pick === o.recipe.id} onChange={() => setPick(o.recipe.id)} />
                    <Thumb id={o.recipe.id} size={48} />
                    <span className="rinfo"><strong>{o.recipe.name}</strong>
                      <small>ca. {num(nutr(o.recipe.id).kcal, 0)} kcal · {fmtP(nutr(o.recipe.id).protein)} g protein</small>
                      <small className="allergen">{allergens(o.recipe.id)}</small>
                      {dealText(o.recipe.id, sheetSlot.day) && <small className="dealtxt">{dealText(o.recipe.id, sheetSlot.day)}</small>}
                      {o.complete ? <span className={p.c}>{p.t}</span> : <span className="pill warnp">ufullstendig pris</span>}</span>
                  </label>
                );
              })}
            </div>
            {chosen && <div className="card total2"><span>Ny anslått handel{chosen.complete ? '' : ' (delsum)'}</span><strong>{kr(basket.totalOre + chosen.deltaOre)}</strong></div>}
            <p className="fine">Næringsdata: Matvaretabellen (Mattilsynet). Generelle matvarer, ikke en bestemt vare; uten salt, olje og krydder. Veiledende tall, ikke kostråd eller anbefalt inntak. Sier ingenting om allergener.</p>
            <button className="cta" disabled={!chosen} onClick={() => { patchSlot(sheetSlot.day, { recipeId: pick!, locked: lockable(pick!) }); closeSheet(); }}>
              {chosen ? `Velg ${chosen.recipe.name.toLowerCase()} ›` : 'Velg en middag'}</button>
        </Sheet>
      )}
    </>
  );
}
