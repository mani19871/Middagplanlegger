// «Lag nå»: hva kan vi lage av det vi har hjemme akkurat nå? Beregningen ligger i engine/cookNow.ts (ren og
// deterministisk). Egne avkrysninger her lagres bare på enheten (`AppState.cookNow`) og synkes ikke; beholdningen
// (matskapet) endres aldri herfra. «Legg manglende på handlelista» bruker de vanlige manuelle linjene i handlelista.
import { useMemo, useState } from 'react';
import { recordList, stamp, type AppState } from '../store';
import { deriveStock } from '../engine/inventory';
import { cookNow, cookNowLineId, cookNowLinePrefix, emptyCookNowLocal, mergeHave, type CookNowLocal, type CookNowSuggestion } from '../engine/cookNow';
import { hiddenUnreviewed, portionsOnDay, type Ctx } from '../engine/planner';
import { amount, kr, num } from '../engine/format';
import { manualLines } from '../sync/list';
import { recipeAllergenText } from './allergenText';
import { RecipeOriginNote, recipeBaseText, unreviewedHiddenText } from './RecipeOrigin';
import { isoDate } from './dates';
import { priceStatusText } from './priceText';
import { ING_EMOJI } from './art';
import { stapleStatus } from '../engine/staples';
import { stapleListFacts } from '../sync/list';
import { STAPLE_INFO, stapleStateText } from './StaplesView';

interface Props { state: AppState; update: (f: (s: AppState) => AppState) => void; ctx: Ctx }

const SHOWN = 8;
const TIMES = [15, 20, 30, 45, 60];
const unitWord = (u: 'g' | 'ml' | 'stk') => (u === 'stk' ? 'stykk' : u);

export default function CookNowView({ state, update, ctx }: Props) {
  const { catalog, settings } = ctx;
  const local: CookNowLocal = state.cookNow ?? emptyCookNowLocal();
  const setLocal = (f: (l: CookNowLocal) => CookNowLocal) => update((s) => ({ ...s, cookNow: f(s.cookNow ?? emptyCookNowLocal()) }));
  const today = isoDate(new Date());
  const dow = (new Date().getDay() + 6) % 7;
  const defaultPortions = (() => {
    const p = portionsOnDay(settings, dow) || settings.eaters.reduce((sum, e) => sum + e.portion, 0);
    return p > 0 ? Math.round(p * 10) / 10 : 4;
  })();
  const [portions, setPortions] = useState(defaultPortions);
  const [maxMinutes, setMaxMinutes] = useState<number | undefined>(undefined);
  const [addIng, setAddIng] = useState('');
  const [addQty, setAddQty] = useState('');
  const [added, setAdded] = useState<string | null>(null);

  const name = (id: string) => catalog.ingredients.find((i) => i.id === id)?.name ?? id;
  const unitOf = (id: string) => catalog.ingredients.find((i) => i.id === id)?.unit ?? 'g';
  // Alt som er kjent hjemme nå: bekreftet hjemme + kjøpt og ikke brukt (forventet rest er aldri med).
  const stock = useMemo(() => deriveStock(state.inventory).total, [state.inventory]);
  const have = useMemo(() => mergeHave(stock, local, catalog.ingredients), [stock, local, catalog.ingredients]);
  const stockIds = Object.keys(stock).filter((id) => stock[id] > 1e-9 && catalog.ingredients.some((i) => i.id === id && !i.staple)).sort((a, b) => name(a).localeCompare(name(b), 'nb'));
  const addedIds = Object.keys(local.added).filter((id) => !(id in stock)).sort((a, b) => name(a).localeCompare(name(b), 'nb'));
  const addable = catalog.ingredients.filter((i) => !i.staple && !stockIds.includes(i.id) && !addedIds.includes(i.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  const storeId = settings.regularStoreId;
  const storeName = catalog.stores.find((s) => s.id === storeId)?.name ?? 'vanlig butikk';
  // Det som mangler prises for handel i dag hos vanlig butikk.
  const result = useMemo(() => cookNow(have, { ...ctx, shopDate: today }, { portions, storeIds: [storeId], maxMinutes }),
    [have, ctx, today, portions, storeId, maxMinutes]);
  // KI-utkast skjult av allergi-, kost- eller råvarefilteret: antallet vises, så det er tydelig at de finnes.
  const draftNote = unreviewedHiddenText(hiddenUnreviewed(ctx).length);
  const lines = useMemo(() => manualLines(state.list), [state.list]);
  // Basisvarer vises bare som «finnes» / «snart tom» / «tom». De endrer ikke hva som regnes som hjemme her eller rangeringen.
  const staples = useMemo(() => stapleStatus(settings.staples ?? [], state.inventory, stapleListFacts(state.list), STAPLE_INFO),
    [settings.staples, state.inventory, state.list]);

  const toggleHave = (id: string, on: boolean) => setLocal((l) => {
    if (id in stock) {
      const removed = on ? l.removed.filter((x) => x !== id) : [...new Set([...l.removed, id])].sort();
      const { [id]: _drop, ...rest } = l.added;
      return { ...l, removed, added: on ? l.added : rest };
    }
    const { [id]: _drop, ...rest } = l.added;
    return { ...l, added: rest, soon: l.soon.filter((x) => x !== id) };
  });
  const toggleSoon = (id: string) => setLocal((l) => ({ ...l, soon: l.soon.includes(id) ? l.soon.filter((x) => x !== id) : [...l.soon, id].sort() }));
  const setAmount = (id: string, raw: string) => {
    const v = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
    if (v !== null && !(Number.isFinite(v) && v >= 0)) return;
    setLocal((l) => ({ ...l, added: { ...l.added, [id]: v === null ? null : Math.round(v) } }));
  };
  const addItem = () => {
    if (!addIng) return;
    const v = addQty.trim() === '' ? null : Number(addQty.replace(',', '.'));
    if (v !== null && !(Number.isFinite(v) && v > 0)) return;
    setLocal((l) => ({ ...l, added: { ...l.added, [addIng]: v === null ? null : Math.round(v) }, removed: l.removed.filter((x) => x !== addIng) }));
    setAddIng(''); setAddQty('');
  };
  const reset = () => setLocal(() => emptyCookNowLocal());

  const onList = (s: CookNowSuggestion, ingredient: string) => lines.some((m) => m.id.startsWith(cookNowLinePrefix(s.recipe.id, ingredient)));
  const addMissing = (s: CookNowSuggestion) => {
    const todo = s.missing.filter((l) => !onList(s, l.ingredient));
    if (todo.length === 0) return;
    update((st) => {
      const cur = manualLines(st.list);
      const removed = st.list.flatMap((e) => (e.type === 'manuell-fjern' ? [e.lineId] : []));
      const events = todo.filter((l) => !cur.some((m) => m.id.startsWith(cookNowLinePrefix(s.recipe.id, l.ingredient)))).map((l) => {
        const e = stamp();
        return {
          type: 'manuell' as const, ...e,
          line: {
            // Fast id per rett og vare (ikke hendelsens id): to enheter gir én linje.
            id: cookNowLineId(s.recipe.id, l.ingredient, removed).slice(0, 100),
            text: `${l.name}: ${amount(l.need, l.unit)}`.slice(0, 200),
            note: `til ${s.recipe.name}`.slice(0, 200),
          },
        };
      });
      return recordList(st, ...events);
    });
    setAdded(s.recipe.id);
  };

  const row = (id: string, fromStock: boolean) => {
    const included = fromStock ? !local.removed.includes(id) : true;
    const amt = id in local.added ? local.added[id] : fromStock ? stock[id] : null;
    const soon = local.soon.includes(id);
    const n = name(id);
    return (
      <li key={id} className="haverow">
        <label className="chk"><input type="checkbox" checked={included} onChange={(e) => toggleHave(id, e.target.checked)} />
          <span><b>{n}</b>{fromStock && <small className="sub">i matskapet: {amount(stock[id], unitOf(id))}</small>}</span></label>
        {included && (
          <div className="haveopts">
            <label className="amt"><span className="sr">Mengde {n} nå i {unitWord(unitOf(id))}</span>
              <input type="number" inputMode="decimal" min={0} placeholder="ukjent" key={`${id}:${amt ?? ''}`} defaultValue={amt === null ? '' : Math.round(amt)}
                onBlur={(e) => { const cur = amt === null ? '' : String(Math.round(amt)); if (e.target.value !== cur) setAmount(id, e.target.value); }} />
              <small aria-hidden>{unitOf(id)}</small></label>
            <button type="button" className={`pill pick ${soon ? 'on' : ''}`} aria-pressed={soon} aria-label={`${n} må brukes snart`} onClick={() => toggleSoon(id)}>⏰ Bruk snart</button>
          </div>
        )}
      </li>
    );
  };

  const shown = result.suggestions.slice(0, SHOWN);
  return (
    <>
      <h1 className="page">Lag nå</h1>
      <p className="fine">Hva kan dere lage av det som finnes hjemme akkurat nå? Kryss av og rett mengdene. Det du gjør her gjelder bare denne
        visningen og lagres på denne enheten. Det endrer ikke matskapet og deles ikke med husstanden.</p>

      <h2 id="lagna-hjemme">Hjemme nå</h2>
      <div className="card" role="group" aria-labelledby="lagna-hjemme">
        {stockIds.length === 0 && addedIds.length === 0 && <p className="fine">Ingenting er bekreftet hjemme eller markert som handlet. Legg til det dere har nedenfor.</p>}
        <ul className="plainlist">
          {stockIds.map((id) => row(id, true))}
          {addedIds.map((id) => row(id, false))}
        </ul>
        <p className="fine">Fra matskapet: det som er bekreftet hjemme og det som er markert som handlet og ikke brukt, også varer kjøpt til ukas plan.
          Forventet rest er ikke med. Tom mengde betyr at varen finnes, men at mengden er ukjent.</p>
        <div className="row-field wrapfield">
          <select aria-label="Legg til vare" value={addIng} onChange={(e) => setAddIng(e.target.value)}>
            <option value="">Velg vare …</option>
            {addable.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <input type="number" inputMode="decimal" min={0} placeholder="mengde" value={addQty} onChange={(e) => setAddQty(e.target.value)}
            aria-label={`Mengde${addIng ? ` i ${unitWord(unitOf(addIng))}` : ''} (tom: ukjent)`} />
          {addIng && <small aria-hidden>{unitOf(addIng)}</small>}
        </div>
        <button className="ghost" disabled={!addIng} onClick={addItem}>＋ Legg til</button>
        {(local.removed.length > 0 || Object.keys(local.added).length > 0 || local.soon.length > 0) &&
          <button className="ghost" onClick={reset}>Nullstill valgene her</button>}
      </div>

      {staples.length > 0 && (
        <>
          <h2 id="lagna-basis">Basisvarer</h2>
          <div className="card" role="group" aria-labelledby="lagna-basis">
            <ul className="plainlist">
              {staples.map((b) => (
                <li key={b.id}><b>{b.name}</b><small className="sub">{b.state === 'ok' ? `Finnes · ${stapleStateText(b)}` : stapleStateText(b)}</small></li>
              ))}
            </ul>
            <p className="fine">Basisvarer vises her bare som informasjon. De regnes ikke med i forslagene utover det som står i matskapet.</p>
          </div>
        </>
      )}

      <div className="cookopts">
        <label htmlFor="lagna-porsjoner">Porsjoner
          <input id="lagna-porsjoner" type="number" inputMode="decimal" min={0.5} step={0.5} value={portions}
            onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0) setPortions(v); }} /></label>
        <label htmlFor="lagna-tid">Tid
          <select id="lagna-tid" value={maxMinutes ?? ''} onChange={(e) => setMaxMinutes(e.target.value === '' ? undefined : Number(e.target.value))}>
            <option value="">Ingen grense</option>
            {TIMES.map((t) => <option key={t} value={t}>Høyst {t} min</option>)}
          </select></label>
      </div>

      <h2>Forslag</h2>
      <p className="fine">{recipeBaseText(catalog.recipes)}
        {' '}Forslagene blir derfor få.{result.excludedByRequirement > 0 && ` ${result.excludedByRequirement} rett${result.excludedByRequirement === 1 ? '' : 'er'} er skjult av allergi- eller kostfilteret.`}
        {result.excludedByTime > 0 && ` ${result.excludedByTime} tar for lang tid.`}</p>
      {draftNote && <p className="notice" role="note">ℹ {draftNote}</p>}
      <div role="status" aria-live="polite">
        {result.empty === 'ingen-varer' && <div className="notice">Ingen varer er krysset av. Kryss av eller legg til det dere har hjemme, så kommer forslagene.</div>}
        {result.empty === 'ingen-porsjoner' && <div className="notice">Velg hvor mange porsjoner dere skal lage.</div>}
        {result.empty === 'ingen-retter' && <div className="notice">Ingen retter i oppskriftsbasen passer tidsvalget og kravene deres (allergi, kost, råvarer). Prøv en lengre tidsgrense.</div>}
        {result.empty === 'ingen-dekning' && <div className="notice">Ingen av rettene som passer kravene deres bruker varene dere har krysset av. Legg til flere varer, eller lag en ukeplan.</div>}
        {!result.empty && <span className="sr">{result.suggestions.length} forslag.</span>}
      </div>

      {shown.map((s) => {
        const present = s.lines.filter((l) => l.state !== 'mangler');
        const pct = Math.round(s.coverage * 100);
        const allOn = s.missing.length > 0 && s.missing.every((l) => onList(s, l.ingredient));
        return (
          <article key={s.recipe.id} className="card cooksugg" aria-labelledby={`lagna-${s.recipe.id}`}>
            <h3 id={`lagna-${s.recipe.id}`}>{s.recipe.name}</h3>
            <p className="fine">⏱ {s.minutes} min · {num(s.portions)} porsjon{s.portions === 1 ? '' : 'er'} · {pct} % av varene finnes</p>
            {s.soonUsed.length > 0 && <p><span className="pill ok">⏰ Bruker {s.soonUsed.map(name).join(', ')}</span></p>}
            <h4>Finnes</h4>
            <ul className="plainlist">
              {present.map((l) => (
                <li key={l.ingredient}><span aria-hidden>{ING_EMOJI[l.ingredient] ?? '•'}</span> {l.name}: {amount(l.need, l.unit)}
                  {l.have === null ? <small className="sub">mengde ikke oppgitt, sjekk at det holder</small>
                    : l.state === 'delvis' ? <small className="sub">bare {amount(l.have, l.unit)} hjemme</small> : null}</li>
              ))}
            </ul>
            {s.missing.length > 0 ? (
              <>
                <h4>Mangler</h4>
                <ul className="plainlist">
                  {s.missing.map((l) => (
                    <li key={l.ingredient}>{l.name}: {amount(l.need, l.unit)}
                      <small className="sub">{l.costOre !== null
                        ? `${l.packs > 1 ? `${l.packs} × ` : ''}${l.productName} · ${kr(l.costOre)} · ${priceStatusText(l.status, l.observed)}`
                        : 'ukjent pris'}</small></li>
                  ))}
                </ul>
                {s.priceComplete
                  ? <p><b>Anslått {kr(s.missingCostOre)}</b> for det som mangler hos {storeName}{s.estimatedCount > 0 ? ` (${s.estimatedCount} estimert)` : ''}. Demopriser, ikke en garanti for sluttpris.</p>
                  : <div className="banner warn"><b>Ufullstendig prisgrunnlag.</b> {s.unknownCount} vare{s.unknownCount === 1 ? '' : 'r'} mangler pris hos {storeName}.
                    {s.missingCostOre > 0 && ` Kjent delsum: ${kr(s.missingCostOre)}.`}</div>}
                <button className="ghost" disabled={allOn} aria-label={`Legg manglende for ${s.recipe.name} på handlelista`} onClick={() => addMissing(s)}>
                  {allOn ? '✓ Ligger på handlelista' : '🛒 Legg manglende på handlelista'}</button>
                <p className="fine" role="status">{added === s.recipe.id ? 'Lagt i handlelista under «Fra Lag nå». Ikke med i beregnet sum.' : ''}</p>
              </>
            ) : <p className="pill ok">Alt finnes hjemme</p>}
            <p className="allergen">{recipeAllergenText(s.recipe, catalog)}</p>
            <RecipeOriginNote recipe={s.recipe} />
            {s.recipe.steps.length > 0 && (
              <details className="steps"><summary>Slik lager du den</summary>
                <ol>{s.recipe.steps.map((t, i) => <li key={i}>{t}</li>)}</ol></details>
            )}
          </article>
        );
      })}
      {result.suggestions.length > SHOWN && <p className="fine">Viser de {SHOWN} beste av {result.suggestions.length} forslag.</p>}
      <p className="fine">Rekkefølgen: hvor mye av retten som finnes (mengde der den er kjent), varer som må brukes snart, hvor lite som mangler
        og anslått pris på det som mangler. En rett med ukjent pris rangeres aldri foran en med kjent pris når resten er likt. Allergi- og
        kostkrav på denne enheten filtrerer alltid. Appen kan ikke garantere at en rett er fri for allergener: les varedeklarasjonen,
        også på det dere har hjemme.</p>
    </>
  );
}
