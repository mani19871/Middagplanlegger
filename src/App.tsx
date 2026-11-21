import { useMemo, useState } from 'react';
import { catalog } from './data/catalog';
import { alternatives, generatePlan } from './engine/planner';
import { usePersistentState } from './store';
import WeekView from './views/WeekView';
import ListView from './views/ListView';
import PapersView from './views/PapersView';
import PantryView from './views/PantryView';
import { Leaf, icons } from './views/art';
import { weekLabel, weekStart } from './views/dates';

const TABS = ['Uka', 'Kundeaviser', 'Handleliste', 'Matskap'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [state, update] = usePersistentState();
  const [tab, setTab] = useState<Tab>('Uka');
  const ctx = useMemo(() => ({ catalog, settings: state.settings }), [state.settings]);
  const alts = useMemo(() => alternatives(state.slots, ctx), [state.slots, ctx]);
  const useCombo = state.option === 'combo' && alts.combo;
  const activeStores = useCombo ? alts.combo!.storeIds : [state.settings.regularStoreId];
  const basket = useCombo ? alts.combo! : alts.regular;
  const regenerate = () => update((s) => ({ ...s, slots: generatePlan({ catalog, settings: s.settings }, s.slots), approved: false }));

  return (
    <div className="app">
      <header>
        <span className="logo"><Leaf /><span><b>Matuke</b><small>{weekLabel(weekStart())}</small></span></span>
      </header>
      <p className="demo">Demodata: butikker, priser og aviser er oppdiktet, og rettene har emoji i stedet for bilder.</p>
      <main>
        {tab === 'Uka' && <WeekView state={state} update={update} ctx={ctx} alts={alts} basket={basket} activeStores={activeStores}
          regenerate={regenerate} openList={() => setTab('Handleliste')} />}
        {tab === 'Kundeaviser' && <PapersView state={state} update={update} ctx={ctx} goWeek={() => setTab('Uka')} />}
        {tab === 'Handleliste' && <ListView state={state} update={update} basket={basket} />}
        {tab === 'Matskap' && <PantryView state={state} update={update} ctx={ctx} basket={basket} />}
      </main>
      <nav role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {icons[t]}<span>{t}</span></button>
        ))}
      </nav>
    </div>
  );
}
