import { useMemo, useState } from 'react';
import { catalog } from './data/catalog';
import { alternatives, generatePlan } from './engine/planner';
import { usePersistentState } from './store';
import WeekView from './views/WeekView';
import ListView from './views/ListView';
import PapersView from './views/PapersView';
import SettingsView from './views/SettingsView';

const TABS = ['Denne uka', 'Handleliste', 'Kundeaviser', 'Innstillinger'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [state, update] = usePersistentState();
  const [tab, setTab] = useState<Tab>('Denne uka');
  const ctx = useMemo(() => ({ catalog, settings: state.settings }), [state.settings]);
  const slots = state.slots;
  const alts = useMemo(() => alternatives(slots, ctx), [slots, ctx]);
  const activeStores = state.option === 'combo' && alts.combo ? alts.combo.storeIds : [state.settings.regularStoreId];
  const basket = state.option === 'combo' && alts.combo ? alts.combo : alts.regular;

  const regenerate = () => update((s) => ({ ...s, slots: generatePlan({ catalog, settings: s.settings }, s.slots), approved: false }));

  return (
    <div className="app">
      <header>
        <h1>Middagsplanlegger</h1>
        <p className="demo">Demodata: butikker, priser og aviser er oppdiktet for å vise hvordan appen virker.</p>
      </header>
      <nav role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      <main>
        {tab === 'Denne uka' && (
          <WeekView state={state} update={update} ctx={ctx} alts={alts} basket={basket} activeStores={activeStores}
            regenerate={regenerate} openList={() => setTab('Handleliste')} />
        )}
        {tab === 'Handleliste' && <ListView state={state} update={update} basket={basket} />}
        {tab === 'Kundeaviser' && <PapersView state={state} update={update} ctx={ctx} goWeek={() => setTab('Denne uka')} />}
        {tab === 'Innstillinger' && <SettingsView state={state} update={update} regenerate={regenerate} />}
      </main>
    </div>
  );
}
