import type { AppState } from '../store';
import type { Allergen, Eater } from '../engine/types';
import { DAYS } from '../engine/format';
import { catalog } from '../data/catalog';

interface Props { state: AppState; update: (f: (s: AppState) => AppState) => void; regenerate: () => void }
const ALLERGENS: Allergen[] = ['gluten', 'melk', 'egg', 'fisk'];

export default function SettingsView({ state, update, regenerate }: Props) {
  const s = state.settings;
  const set = (patch: Partial<typeof s>) => update((st) => ({ ...st, settings: { ...st.settings, ...patch }, approved: false }));
  const setEater = (id: string, patch: Partial<Eater>) => set({ eaters: s.eaters.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  return (
    <>
      <section className="card">
        <h2>Budsjett</h2>
        <label>Middager denne uka (kr)
          <input type="number" min={0} value={s.budgetOre / 100} onChange={(e) => set({ budgetOre: Math.round(Number(e.target.value) * 100) })} /></label>
      </section>
      <section className="card">
        <h2>Hvem spiser</h2>
        {s.eaters.map((e) => (
          <div key={e.id} className="eater">
            <input value={e.label} onChange={(ev) => setEater(e.id, { label: ev.target.value })} aria-label="Etikett" />
            <select value={e.portion} onChange={(ev) => setEater(e.id, { portion: Number(ev.target.value) })} aria-label="Porsjon">
              <option value={1}>Voksen (1 porsjon)</option><option value={0.6}>Barn (0,6)</option><option value={0.3}>Småbarn (0,3)</option>
            </select>
            <div className="dayrow">
              {DAYS.map((d, i) => (
                <label key={d} className="mini"><input type="checkbox" checked={e.daysHome[i]}
                  onChange={() => setEater(e.id, { daysHome: e.daysHome.map((v, j) => (j === i ? !v : v)) })} />{d.slice(0, 2)}</label>
              ))}
            </div>
            <button className="x" aria-label="Fjern" onClick={() => set({ eaters: s.eaters.filter((x) => x.id !== e.id) })}>×</button>
          </div>
        ))}
        <button onClick={() => set({ eaters: [...s.eaters, { id: `p${Date.now()}`, label: `Person ${s.eaters.length + 1}`, portion: 1, daysHome: [true, true, true, true, true, true, true] }] })}>Legg til person</button>
      </section>
      <section className="card">
        <h2>Hverdagsrytme</h2>
        {DAYS.map((d, i) => (
          <div key={d} className="rowline">
            <label><input type="checkbox" checked={s.days[i].enabled}
              onChange={() => set({ days: s.days.map((x, j) => (j === i ? { ...x, enabled: !x.enabled } : x)) })} /> {d}</label>
            <label>maks <input type="number" min={10} step={5} value={s.days[i].maxMinutes} style={{ width: 70 }}
              onChange={(e) => set({ days: s.days.map((x, j) => (j === i ? { ...x, maxMinutes: Number(e.target.value) } : x)) })} /> min</label>
          </div>
        ))}
      </section>
      <section className="card">
        <h2>Kost</h2>
        <label><input type="checkbox" checked={s.vegetarian} onChange={() => set({ vegetarian: !s.vegetarian })} /> Bare vegetar (absolutt krav)</label>
        <p>Unngå allergener (absolutt krav):</p>
        {ALLERGENS.map((a) => (
          <label key={a} className="mini"><input type="checkbox" checked={s.avoid.includes(a)}
            onChange={() => set({ avoid: s.avoid.includes(a) ? s.avoid.filter((x) => x !== a) : [...s.avoid, a] })} /> {a}</label>
        ))}
        <p className="fine">Appen garanterer aldri at en vare er allergenfri. Varer med uavklart allergenstatus godkjennes aldri når et filter er aktivt.</p>
      </section>
      <section className="card">
        <h2>Butikker</h2>
        {catalog.stores.map((st) => (
          <div key={st.id} className="rowline">
            <label><input type="checkbox" checked={s.storeIds.includes(st.id)} disabled={st.id === s.regularStoreId}
              onChange={() => set({ storeIds: s.storeIds.includes(st.id) ? s.storeIds.filter((x) => x !== st.id) : [...s.storeIds, st.id] })} /> {st.name}</label>
            <label><input type="radio" name="reg" checked={s.regularStoreId === st.id}
              onChange={() => set({ regularStoreId: st.id, storeIds: [...new Set([...s.storeIds, st.id])] })} /> vanlig</label>
          </div>
        ))}
        <p className="fine">Prisene gjelder: {catalog.stores.map((x) => `${x.name.split('(')[0].trim()} → ${x.scope}`).join('; ')}.</p>
        <label>Maks antall stopp
          <select value={s.maxStops} onChange={(e) => set({ maxStops: Number(e.target.value) as 1 | 2 })}><option value={1}>1</option><option value={2}>2</option></select></label>
        <label>Min. besparelse for en ekstra butikk (kr)
          <input type="number" min={0} value={s.extraStoreThresholdOre / 100} onChange={(e) => set({ extraStoreThresholdOre: Math.round(Number(e.target.value) * 100) })} /></label>
      </section>
      <section className="card">
        <h2>Matskap (valgfritt)</h2>
        <p className="fine">Mengder du allerede har trekkes fra én gang, etter at behov er summert på tvers av retter.</p>
        {catalog.ingredients.filter((i) => !i.staple).map((i) => (
          <label key={i.id} className="pantry">{i.name} ({i.unit})
            <input type="number" min={0} value={s.pantry[i.id] ?? 0} onChange={(e) => set({ pantry: { ...s.pantry, [i.id]: Number(e.target.value) } })} /></label>
        ))}
      </section>
      <div className="actions">
        <button className="primary" onClick={regenerate}>Lag ny uke med disse valgene</button>
        <button onClick={() => { if (confirm('Slette alle lagrede data på denne enheten?')) { try { localStorage.clear(); } catch { /* */ } location.reload(); } }}>Slett lokale data</button>
      </div>
    </>
  );
}
