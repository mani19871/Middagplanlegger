import { useState } from 'react';
import type { AppState } from '../store';
import type { Allergen, Eater, FoodTag } from '../engine/types';
import { DAYS, kr } from '../engine/format';
import { catalog } from '../data/catalog';

interface Props { state: AppState; update: (f: (s: AppState) => AppState) => void; onDone: () => void; hasPlan: boolean }
const ALLERGENS: Allergen[] = ['gluten', 'melk', 'egg', 'fisk', 'skalldyr'];
const FOODS: [FoodTag, string][] = [['storfe', 'storfe'], ['svin', 'svin'], ['lam', 'lam'], ['kylling', 'kylling'], ['fisk', 'fisk'], ['skalldyr', 'skalldyr'], ['belgvekster', 'belgvekster']];
const ALL = [true, true, true, true, true, true, true];

export default function PlanForm({ state, update, onDone, hasPlan }: Props) {
  const s = state.settings;
  const [timeDay, setTimeDay] = useState(() => Math.max(0, s.days.findIndex((d) => d.enabled)));
  const [more, setMore] = useState(false);
  const set = (patch: Partial<typeof s>) => update((st) => ({ ...st, settings: { ...st.settings, ...patch }, approved: false }));
  const adults = s.eaters.filter((e) => e.portion >= 1);
  const kids = s.eaters.filter((e) => e.portion < 1);
  const setCount = (kind: 'v' | 'b', n: number) => {
    const list = kind === 'v' ? adults : kids;
    const next: Eater[] = list.slice(0, n);
    while (next.length < n) next.push({ id: `${kind}${Date.now()}${next.length}`, label: `${kind === 'v' ? 'Voksen' : 'Barn'} ${next.length + 1}`, portion: kind === 'v' ? 1 : 0.6, daysHome: [...ALL] });
    set({ eaters: kind === 'v' ? [...next, ...kids] : [...adults, ...next] });
  };
  const setEater = (id: string, patch: Partial<Eater>) => set({ eaters: s.eaters.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const Step = ({ label, n, on }: { label: string; n: number; on: (n: number) => void }) => (
    <div className="step"><span>{label}</span>
      <button aria-label={`Færre ${label}`} onClick={() => on(Math.max(0, n - 1))}>−</button><b>{n}</b>
      <button aria-label={`Flere ${label}`} onClick={() => on(n + 1)}>+</button></div>
  );

  return (
    <>
      <h1 className="page">{hasPlan ? 'Rediger uke' : 'Planlegg uka'}</h1>
      <h3>Hvem spiser?</h3>
      <div className="field"><Step label="voksne" n={adults.length} on={(n) => setCount('v', n)} /><Step label="barn" n={kids.length} on={(n) => setCount('b', n)} /></div>
      <h3>Budsjett for uka</h3>
      <label className="field row-field"><input type="number" min={0} value={s.budgetOre / 100} onChange={(e) => set({ budgetOre: Math.round(Number(e.target.value) * 100) })} /> <span>kr til middager</span></label>
      <h3>Hvilke hverdager vil du planlegge?</h3>
      <div className="chips">
        {DAYS.map((d, i) => (
          <button key={d} className={`chip ${s.days[i].enabled ? 'on' : ''}`} aria-pressed={s.days[i].enabled}
            onClick={() => set({ days: s.days.map((x, j) => (j === i ? { ...x, enabled: !x.enabled } : x)) })}>{d.slice(0, 3)}{s.days[i].enabled && ' ✓'}</button>
        ))}
      </div>
      <h3>Maks tid på <select className="inl" value={timeDay} onChange={(e) => setTimeDay(Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i}>{d.toLowerCase()}</option>)}</select></h3>
      <select className="field" value={s.days[timeDay].maxMinutes}
        onChange={(e) => set({ days: s.days.map((x, j) => (j === timeDay ? { ...x, maxMinutes: Number(e.target.value) } : x)) })}>
        {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
      </select>
      <h3>Foretrukket butikk</h3>
      <select className="field" value={s.regularStoreId} onChange={(e) => set({ regularStoreId: e.target.value, storeIds: [...new Set([...s.storeIds, e.target.value])] })}>
        {catalog.stores.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
      </select>
      <button className="link" onClick={() => setMore(!more)}>{more ? 'Skjul flere valg' : 'Flere valg (kost, allergener, flere butikker)'}</button>
      {more && (
        <div className="more">
          <label><input type="checkbox" checked={s.useOffers !== false} onChange={() => set({ useOffers: s.useOffers === false })} /> Planlegg rundt tilbud (når tilbudsdata er tilgjengelig)</label>
          <label><input type="checkbox" checked={s.vegetarian} onChange={() => set({ vegetarian: !s.vegetarian })} /> Bare vegetar (absolutt krav)</label>
          <p>Unngå allergener (absolutt krav):</p>
          {ALLERGENS.map((a) => (
            <label key={a} className="mini"><input type="checkbox" checked={s.avoid.includes(a)}
              onChange={() => set({ avoid: s.avoid.includes(a) ? s.avoid.filter((x) => x !== a) : [...s.avoid, a] })} /> {a}</label>
          ))}
          <p>Unngå råvarer (absolutt krav):</p>
          {FOODS.map(([t, label]) => (
            <label key={t} className="mini"><input type="checkbox" checked={(s.avoidFoods ?? []).includes(t)}
              onChange={() => set({ avoidFoods: (s.avoidFoods ?? []).includes(t) ? (s.avoidFoods ?? []).filter((x) => x !== t) : [...(s.avoidFoods ?? []), t] })} /> {label}</label>
          ))}
          <p className="fine">Appen garanterer aldri at en vare er allergenfri. Uavklart allergenstatus godkjennes aldri når et filter er aktivt.</p>
          <p>Butikker som sammenlignes:</p>
          {catalog.stores.map((st) => (
            <label key={st.id}><input type="checkbox" checked={s.storeIds.includes(st.id)} disabled={st.id === s.regularStoreId}
              onChange={() => set({ storeIds: s.storeIds.includes(st.id) ? s.storeIds.filter((x) => x !== st.id) : [...s.storeIds, st.id] })} /> {st.name} <small>(priser gjelder {st.scope})</small></label>
          ))}
          <label>Maks antall stopp <select value={s.maxStops} onChange={(e) => set({ maxStops: Number(e.target.value) as 1 | 2 })}><option value={1}>1</option><option value={2}>2</option></select></label>
          <label>Min. besparelse for en ekstra butikk: {kr(s.extraStoreThresholdOre)}
            <input type="range" min={0} max={20000} step={500} value={s.extraStoreThresholdOre} onChange={(e) => set({ extraStoreThresholdOre: Number(e.target.value) })} /></label>
          <p>Hvem er hjemme hvilke dager:</p>
          {s.eaters.map((e) => (
            <div key={e.id} className="eater">
              <input value={e.label} aria-label="Etikett" onChange={(ev) => setEater(e.id, { label: ev.target.value })} />
              <div>{DAYS.map((d, i) => (
                <label key={d} className="mini"><input type="checkbox" checked={e.daysHome[i]} onChange={() => setEater(e.id, { daysHome: e.daysHome.map((v, j) => (j === i ? !v : v)) })} />{d.slice(0, 2)}</label>
              ))}</div>
            </div>
          ))}
        </div>
      )}
      <button className="cta" onClick={onDone}>Lag ukeplan ›</button>
      {hasPlan && <button className="link" onClick={() => { try { localStorage.clear(); } catch { /* */ } location.reload(); }}>Slett lokale data</button>}
    </>
  );
}
