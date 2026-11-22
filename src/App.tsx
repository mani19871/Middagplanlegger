import { useEffect, useMemo, useState } from 'react';
import { catalog } from './data/catalog';
import { alternatives, generatePlan } from './engine/planner';
import { recordEvent, usePersistentState } from './store';
import { conflicts, deriveStock, type InventoryEvent } from './engine/inventory';
import HouseholdView from './views/HouseholdView';
import { useSync } from './sync/useSync';
import { pendingCount, syncStatus, type SyncStatus } from './sync/engine';
import WeekView from './views/WeekView';
import ListView from './views/ListView';
import PapersView from './views/PapersView';
import PantryView from './views/PantryView';
import { Leaf, icons } from './views/art';
import { isoDate, shopDate, weekLabel, weekStart } from './views/dates';
import { fetchLiveOffers } from './offers/client';
import { toHints } from './offers/hints';
import type { OfferHint } from './engine/deals';
import { totalWithOffers } from './engine/offerTotal';
import type { Mode } from './views/WeekView';

const TABS = ['Uka', 'Kundeaviser', 'Handleliste', 'Matskap'] as const;
type Tab = (typeof TABS)[number] | 'Husstand';

/** Invitasjonslenke: /#bli-med=KODE. Koden ligger i fragmentet, så den sendes aldri til serveren i en URL. */
const inviteFromHash = () => {
  const m = /^#bli-med=([A-Za-z0-9-]{1,20})$/.exec(typeof location === 'undefined' ? '' : location.hash);
  if (m) history.replaceState(null, '', location.pathname + location.search);
  return m ? m[1] : '';
};
const STATUS_TEXT: Record<SyncStatus, string> = {
  lokal: '✓ Lagret på denne enheten', synket: '✓ Synket med husstanden', synker: '↻ Synker …',
  venter: '⏳ Venter på nett', konflikt: '⚠ Konflikt – må avklares',
};

const CHIP_TEXT: Record<SyncStatus, string> = {
  lokal: 'Del med husstanden', synket: '✓ Synket', synker: '↻ Synker', venter: '⏳ Venter på nett', konflikt: '⚠ Konflikt',
};

export default function App() {
  const [state, update] = usePersistentState(isoDate(weekStart()));
  const [inviteCode] = useState(inviteFromHash);
  const [tab, setTab] = useState<Tab>(inviteCode ? 'Husstand' : 'Uka');
  const runtime = useSync(state, update);
  const purchaseConflicts = useMemo(() => conflicts(state.inventory).length, [state.inventory]);
  const status = syncStatus(state, runtime, purchaseConflicts);
  const pending = pendingCount(state);
  const statusText = status === 'venter' && pending > 0 ? `${STATUS_TEXT.venter} (${pending} endring${pending === 1 ? '' : 'er'} lagret her)` : STATUS_TEXT[status];
  const docConflicts = state.sync ? Object.keys(state.sync.conflicts).length : 0;
  const [mode, setMode] = useState<Mode>('home');
  const [papersReset, setPapersReset] = useState(0); // trykk på aktiv fane nullstiller åpen utgave/detalj
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
  const week = isoDate(weekStart());
  // Beholdningen planen trekker fra: bekreftet hjemme + kjøpt og ikke brukt, uten ukas egen handel (se inventory.ts).
  const stockJson = JSON.stringify(deriveStock(state.inventory, { planWeek: week }).total);
  const ctx = useMemo(() => ({ catalog, settings: state.settings, offers: hints, shopDate: day, stock: JSON.parse(stockJson) as Record<string, number> }),
    [state.settings, hints, day, stockJson]);
  /** Lagrer beholdningshendelser lokalt og i utboksen. Endres planens beholdning, må planen godkjennes på nytt. */
  const record = (...events: InventoryEvent[]) => update((s) => {
    const next = events.reduce(recordEvent, s);
    const changed = JSON.stringify(deriveStock(next.inventory, { planWeek: week }).total) !== JSON.stringify(deriveStock(s.inventory, { planWeek: week }).total);
    return changed ? { ...next, approved: false } : next;
  });
  const alts = useMemo(() => alternatives(state.slots, ctx), [state.slots, ctx]);
  const useCombo = state.option === 'combo' && alts.combo;
  const activeStores = useCombo ? alts.combo!.storeIds : [state.settings.regularStoreId];
  const basket = useCombo ? alts.combo! : alts.regular;
  // Egen sum med regelgodkjente tilbud; basissummen og butikksammenligningen over er uendret.
  const offerTotal = useMemo(() => totalWithOffers(basket, hints, day, state.settings), [basket, hints, day, state.settings]);
  const approvedHints = hints.filter((h) => h.approved).length;
  const regenerate = () => update((s) => ({ ...s, slots: generatePlan({ ...ctx, settings: s.settings }, s.slots), approved: false }));

  return (
    <div className="app">
      <header>
        <span className="logo"><Leaf /><span><b>Matuke</b><small>{weekLabel(weekStart())}</small></span></span>
        <div className="headchips">
          <button className="household" aria-label="Endre hvem som spiser" onClick={() => { setTab('Uka'); setMode('edit'); }}>
            👥 {adults} voksne, {kids} barn ⌄</button>
          <button className={`syncchip ${status}`} aria-label={`Husstand og deling. ${statusText}`} onClick={() => setTab('Husstand')}>
            🏠 {CHIP_TEXT[status]}</button>
        </div>
      </header>
      <p className="demo">Demodata: butikker, priser og aviser er oppdiktet, og rettene har emoji i stedet for bilder.</p>
      <main id="panel" role="tabpanel" {...(tab === 'Husstand' ? { 'aria-label': 'Husstand' } : { 'aria-labelledby': `tab-${tab}` })} tabIndex={-1}>
        {docConflicts > 0 && tab !== 'Husstand' && (
          <div className="banner warn" role="alert">⚠ Planen eller innstillingene ble endret på to enheter samtidig.{' '}
            <button className="ghost sm" onClick={() => setTab('Husstand')}>Velg hva som skal gjelde</button></div>
        )}
        {tab === 'Uka' && <WeekView mode={mode} setMode={setMode} state={state} update={update} ctx={ctx} alts={alts} basket={basket} activeStores={activeStores}
          offerTotal={offerTotal} approvedHints={approvedHints}
          regenerate={regenerate} openList={() => setTab('Handleliste')} />}
        {tab === 'Kundeaviser' && <PapersView state={state} update={update} ctx={ctx} goWeek={() => setTab('Uka')} resetKey={papersReset} />}
        {tab === 'Handleliste' && <ListView state={state} update={update} record={record} week={week} basket={basket} offerTotal={offerTotal} approvedHints={approvedHints} syncText={statusText} />}
        {tab === 'Husstand' && <HouseholdView state={state} update={update} runtime={runtime} status={status} statusText={statusText}
          purchaseConflicts={purchaseConflicts} initialCode={inviteCode} openList={() => setTab('Handleliste')} />}
        {tab === 'Matskap' && <PantryView state={state} record={record} week={week} ctx={ctx} basket={basket} />}
      </main>
      <nav role="tablist" aria-label="Hovedmeny" onKeyDown={(e) => {
        // Piltaster flytter mellom faner (roving tabindex), Home/End til første/siste.
        const i = TABS.indexOf(tab as (typeof TABS)[number]);
        const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
        if (next < 0) return;
        e.preventDefault(); setTab(TABS[next]); document.getElementById(`tab-${TABS[next]}`)?.focus();
      }}>
        {TABS.map((t) => (
          <button key={t} id={`tab-${t}`} role="tab" aria-selected={tab === t} aria-controls="panel" tabIndex={tab === t ? 0 : -1} className={tab === t ? 'on' : ''} onClick={() => { if (t === tab) setPapersReset((n) => n + 1); setTab(t); }}>
            <span aria-hidden>{icons[t]}</span><span>{t}</span></button>
        ))}
      </nav>
    </div>
  );
}
