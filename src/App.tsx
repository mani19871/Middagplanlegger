import { useEffect, useMemo, useState } from 'react';
import { catalog } from './data/catalog';
import { alternatives, generatePlan } from './engine/planner';
import { usePersistentState } from './store';
import WeekView from './views/WeekView';
import ListView from './views/ListView';
import PapersView from './views/PapersView';
import PantryView from './views/PantryView';
import { Leaf, icons } from './views/art';
import { shopDate, weekLabel, weekStart } from './views/dates';
import { fetchLiveOffers } from './offers/client';
import { toHints } from './offers/hints';
import type { OfferHint } from './engine/deals';
import type { Mode } from './views/WeekView';

const TABS = ['Uka', 'Kundeaviser', 'Handleliste', 'Matskap'] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [state, update] = usePersistentState();
  const [tab, setTab] = useState<Tab>('Uka');
  const [mode, setMode] = useState<Mode>('home');
  const adults = state.settings.eaters.filter((e) => e.portion >= 1).length;
  const kids = state.settings.eaters.length - adults;
  const [hints, setHints] = useState<OfferHint[]>([]);
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const r = await fetchLiveOffers();
        if (stop) return;
        if (r.status === 'ok') setHints(toHints(r.offers, catalog.ingredients));
        else if (r.status === 'loading') timer = setTimeout(load, 5000);
      } catch { /* ingen tilbudsserver: planlegg uten tilbud */ }
    };
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, []);
  const day = shopDate();
  const ctx = useMemo(() => ({ catalog, settings: state.settings, offers: hints, shopDate: day }), [state.settings, hints, day]);
  const alts = useMemo(() => alternatives(state.slots, ctx), [state.slots, ctx]);
  const useCombo = state.option === 'combo' && alts.combo;
  const activeStores = useCombo ? alts.combo!.storeIds : [state.settings.regularStoreId];
  const basket = useCombo ? alts.combo! : alts.regular;
  const regenerate = () => update((s) => ({ ...s, slots: generatePlan({ ...ctx, settings: s.settings }, s.slots), approved: false }));

  return (
    <div className="app">
      <header>
        <span className="logo"><Leaf /><span><b>Matuke</b><small>{weekLabel(weekStart())}</small></span></span>
        <button className="household" aria-label="Endre hvem som spiser" onClick={() => { setTab('Uka'); setMode('edit'); }}>
          👥 {adults} voksne, {kids} barn ⌄</button>
      </header>
      <p className="demo">Demodata: butikker, priser og aviser er oppdiktet, og rettene har emoji i stedet for bilder.</p>
      <main>
        {tab === 'Uka' && <WeekView mode={mode} setMode={setMode} state={state} update={update} ctx={ctx} alts={alts} basket={basket} activeStores={activeStores}
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
