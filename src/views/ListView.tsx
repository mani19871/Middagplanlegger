import { useMemo, useState } from 'react';
import { recordList, stamp, type AppState } from '../store';
import { checks, manualLines, toggleEvent, type ListEvent } from '../sync/list';
import { whoList } from '../sync/labels';
import { productAllergenText } from './allergenText';
import { lineStates, purchaseLineId, type InventoryEvent, type PurchaseState } from '../engine/inventory';
import type { Basket, BasketLine } from '../engine/types';
import { amount, kr } from '../engine/format';
import { catalog } from '../data/catalog';
import { DEPT_EMOJI, ING_EMOJI } from './art';
import { shopDate } from './dates';
import { norDate, priceStatusText, staleNote } from './priceText';
import OfferTotalNote from './OfferTotalNote';
import type { OfferTotal } from '../engine/offerTotal';
import { ChangePill, ChangeSheet, ChangesNote, DriftBanner, HistoryView, markable, SkippedLines, VersionConflictBanner, type ChangeKit } from './ListChanges';
import { changeBlocked, versionsFor, type AdjustedBasket, type AdjustedLine } from '../engine/substitution';
import { COOK_NOW_PREFIX } from '../engine/cookNow';

interface Props {
  state: AppState; update: (f: (s: AppState) => AppState) => void; record: (...e: InventoryEvent[]) => void; week: string;
  basket: Basket; offerTotal: OfferTotal; approvedHints: number;
  /** Synkstatus som tekst («✓ Synket med husstanden», «Venter på nett»). */
  syncText: string;
  /** «Utsolgt / fant ikke» og historikk. Uten den vises lista uten endringshandlinger. */
  kit?: ChangeKit;
}
const statusText: Record<BasketLine['status'], string> = { ordinær: 'Ordinær pris', tilbud: 'Tilbud', estimat: 'Estimert pris', ukjent: 'Ukjent pris' };
const storeName = (id: string | null) => catalog.stores.find((s) => s.id === id)?.name ?? 'Ukjent butikk';
const recipeName = (id: string) => catalog.recipes.find((r) => r.id === id)?.name ?? id;
/** Kjøpshendelse for en handlelinje. Linje-id-en gjør at to voksne som markerer samme linje gir ett kjøp. */
export function purchaseEvent(l: BasketLine, week: string, packs?: number): InventoryEvent {
  const known = l.productId !== null && l.packs > 0;
  return {
    type: 'kjøp', ...stamp(), week, line: purchaseLineId(week, l.storeId, l.ingredient, l.productId), ingredient: l.ingredient,
    productId: l.productId, storeId: l.storeId, unit: l.unit,
    // Uten kjent pakning antas det at mengden i planen ble kjøpt.
    packs: packs ?? (known ? l.packs : 1), packSize: known ? l.packSize : Math.max(1, Math.ceil(l.need)),
  };
}
const boughtPill = (p: PurchaseState | undefined, l: BasketLine) => {
  if (!p || p.status === 'angret') return null;
  if (p.status === 'konflikt') return <span className="pill warnp">⚠ Bekreft antall: {p.candidates.join(' eller ')} pakker</span>;
  const want = l.productId ? l.packs : 1;
  return (p.packs ?? 0) >= want ? <span className="pill ok">✓ Handlet</span> : <span className="pill warnp">Delvis handlet ({p.packs} av {want})</span>;
};
const lineText = (l: BasketLine) => (l.productId ? (l.packs > 1 ? `${l.packs} × ${l.productName}` : l.productName!) : `${l.name}: ${amount(l.need, l.unit)}`);

export default function ListView({ state, update, record, week, basket, offerTotal, approvedHints, syncText, kit }: Props) {
  // Detaljen holder bare varen; linja slås opp i gjeldende kurv ved hver gjengivelse, så et valg eller en synk mens
  // detaljen er åpen aldri gir kjøp på en gammel kopi av linja (f.eks. et utsolgt produkt).
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const detail = detailKey === null ? null : basket.lines.find((l) => l.ingredient === detailKey) ?? null;
  const setDetail = (l: BasketLine | null) => setDetailKey(l ? l.ingredient : null);
  const [shop, setShop] = useState(false);
  const marks = useMemo(() => checks(state.list, week), [state.list, week]);
  const manual = useMemo(() => manualLines(state.list), [state.list]);
  const isChecked = (key: string) => (marks.get(key)?.length ?? 0) > 0;
  const recordL = (...e: ListEvent[]) => update((s) => recordList(s, ...e));
  const [oos, setOos] = useState<AdjustedLine | null>(null);
  const [history, setHistory] = useState(false);
  const purchases = useMemo(() => lineStates(state.inventory).purchases, [state.inventory]);
  const purchaseOf = (l: BasketLine) => purchases.get(purchaseLineId(week, l.storeId, l.ingredient, l.productId));
  const isBought = (l: BasketLine) => { const p = purchaseOf(l); return !!p && p.status !== 'angret'; };
  // Hver avkrysning lagres med egen identitet. Å fjerne et kryss fjerner bare kryssene du har sett (src/sync/list.ts).
  const toggle = (key: string) => update((s) => recordList(s, toggleEvent(s.list, week, key, stamp())));
  const checkLabel = (name: string, key: string) => {
    const m = marks.get(key);
    return m && m.length > 0 ? `${name}, avkrysset av ${whoList(state, m.map((x) => x.by))}. Trykk for å fjerne krysset` : `Kryss av ${name}`;
  };
  const who = (key: string) => {
    const m = marks.get(key);
    return m && m.length > 0 ? <small className="who">✓ Avkrysset av {whoList(state, m.map((x) => x.by))}</small> : null;
  };
  // Manuelle linjer: fra kundeaviser og fra «Lag nå». Ikke kontrollert og ikke med i beregnet sum.
  const manualGroup = (title: string, ms: typeof manual) => ms.length > 0 && (
    <section key={title}>
      <div className="deptbar"><strong>{title}</strong></div>
      <ul className={`list ${shop ? 'shop' : ''}`}>
        {ms.map((m) => (
          <li key={m.id} className={isChecked(m.id) ? 'done' : ''}>
            <input type="checkbox" aria-label={checkLabel(m.text, m.id)} checked={isChecked(m.id)} onChange={() => toggle(m.id)} />
            <span className="main"><b>{m.text}</b><small>{m.note} · ikke med i beregnet sum</small>{who(m.id)}</span>
            <button className="x" aria-label={`Fjern ${m.text}`} onClick={() => recordL({ type: 'manuell-fjern', ...stamp(), lineId: m.id })}>✕</button>
          </li>
        ))}
      </ul>
    </section>
  );
  const manualSection = (
    <>
      {manualGroup('🍳 Fra «Lag nå» (ikke kontrollert)', manual.filter((m) => m.id.startsWith(COOK_NOW_PREFIX)))}
      {manualGroup('🏷 Fra kundeaviser (ikke kontrollert)', manual.filter((m) => !m.id.startsWith(COOK_NOW_PREFIX)))}
    </>
  );
  if (state.slots.length === 0) {
    return (
      <>
        <h1 className="page">Handleliste</h1>
        <section className="card"><p>Lag en ukeplan først.</p></section>
        {manualSection}
      </>
    );
  }
  if (kit && history) return <HistoryView kit={kit} onBack={() => setHistory(false)} />;
  const oosButton = (l: BasketLine) => kit && (
    <button className="ghost sm oos" aria-label={`Utsolgt eller fant ikke: ${l.name}`} onClick={() => setOos(l as AdjustedLine)}>Utsolgt / fant ikke</button>);
  const sheet = kit && oos && <ChangeSheet line={oos} kit={kit} blocked={changeBlocked(oos, week, purchases)} onClose={() => { setOos(null); setDetail(null); }} />;

  if (detail) {
    const l = detail;
    const unitPrice = l.costOre !== null && l.packs > 0 ? l.costOre / l.packs : null;
    const ageNote = staleNote(l.status, l.observed, kit?.ctx.shopDate ?? shopDate());
    return (
      <>
        <div className="pagehead"><button className="x" aria-label="Tilbake" onClick={() => setDetail(null)}>←</button></div>
        <h1 className="page">{l.costOre !== null ? `Hvorfor ${kr(l.costOre)}?` : `Hvorfor ukjent pris?`}</h1>
        <div className="card detailhead"><span className="bigemoji" aria-hidden>{ING_EMOJI[l.ingredient] ?? '🛒'}</span><h2>{l.productName ?? l.name}</h2></div>
        <div className="card">
          {l.costOre !== null && unitPrice !== null && <div className="drow"><span>📦 {l.packs} pakke{l.packs === 1 ? '' : 'r'} × {kr(unitPrice)}</span><b>{kr(l.costOre)}</b></div>}
          <div className="drow"><span>🍴 Behov i planen</span><b>{amount(l.need, l.unit)}</b></div>
          {l.costOre !== null && <div className="drow"><span>🫙 Beregnet til overs</span><b>{amount(l.leftover, l.unit)}</b></div>}
          <div className="drow"><span>🍽 Dekker</span><b className="wrap">{l.covers.map(recipeName).join(', ')}</b></div>
        </div>
        {l.costOre !== null ? (
          <div className="card"><div className="drow"><span>🏪 {storeName(l.storeId)}</span><span className={`pill ${l.status === 'estimat' ? 'warnp' : l.status === 'tilbud' ? 'up' : ''}`}>{statusText[l.status]}</span></div>
            <p className="fine">Kilde: {l.source}, observert {l.observed ? norDate(l.observed) : 'ukjent dato'}. Prisen er anslått og kan avvike i butikken.</p>
            {ageNote && <p className="fine warntext">{ageNote}</p>}</div>
        ) : <div className="banner warn">Ingen pris funnet i valgte butikker for denne varen. Den teller ikke i summen, og kurven kan ikke bekreftes innenfor budsjett. Du kan kjøpe den hvor som helst.</div>}
        {l.costOre !== null && <div className="card total2"><span>Sum</span><strong>{kr(l.costOre)}</strong></div>}
        {markable(l) && <PurchaseCard l={l} p={purchaseOf(l)} week={week} record={record} who={(bys) => whoList(state, bys)} />}
        {oosButton(l)}
        {sheet}
      </>
    );
  }

  const resetChecks = () => update((s) => {
    const cur = checks(s.list, week);
    return recordList(s, ...[...cur].map(([key, m]) => ({ type: 'avkryss' as const, ...stamp(), week, key, seen: m.map((x) => x.id) })));
  });
  const groups = new Map<string, BasketLine[]>();
  for (const l of basket.lines) groups.set(l.storeId ?? '—', [...(groups.get(l.storeId ?? '—') ?? []), l]);

  return (
    <>
      <div className="pagehead">
        <div><h1 className="page">Handleliste</h1><span className="fine" role="status">{syncText}</span></div>
        <div className="totalpill"><small>Anslått handel</small><strong>{kr(basket.totalOre)}</strong></div>
      </div>
      <button className={`ghost shoptoggle ${shop ? 'on' : ''}`} aria-pressed={shop} onClick={() => setShop(!shop)}>
        🛒 {shop ? 'Avslutt handlemodus' : 'Handlemodus: stor tekst og store felt'}</button>
      {!state.approved && <p className="fine">Planen er ikke godkjent ennå, listen kan endre seg.</p>}
      <OfferTotalNote total={offerTotal} approvedHints={approvedHints} className="card offertotal-card" />
      <ChangesNote basket={basket} />
      {kit && <VersionConflictBanner kit={kit} />}
      {kit && <DriftBanner kit={kit} />}
      {basket.unknownCount > 0 && <div className="banner warn">{basket.unknownCount} vare{basket.unknownCount === 1 ? '' : 'r'} mangler pris. Summen er en delsum.</div>}
      {[...groups].map(([storeId, lines]) => {
        const open = lines.filter((l) => !isBought(l) && markable(l));
        const picked = open.filter((l) => isChecked(`${storeId}:${l.ingredient}`));
        const toMark = picked.length > 0 ? picked : open;
        return (
        <section key={storeId}>
          <div className="storebar">🏪 <strong>{storeId === '—' ? 'Uten pris' : storeName(storeId)}</strong></div>
          {[...new Set(lines.map((l) => l.department))].sort().map((d) => (
            <div key={d}>
              <div className="deptbar">{DEPT_EMOJI[d] ?? '🛒'} <strong>{d}</strong></div>
              <ul className={`list ${shop ? 'shop' : ''}`}>
                {lines.filter((l) => l.department === d).map((l) => {
                  const key = `${storeId}:${l.ingredient}`;
                  return (
                    <li key={key} className={isChecked(key) ? 'done' : ''}>
                      <input type="checkbox" aria-label={checkLabel(l.name, key)} checked={isChecked(key)} onChange={() => toggle(key)} />
                      <button className="main" onClick={() => setDetail(l)}>
                        <b>{lineText(l)}</b>
                        <small>{l.productId ? `${amount(l.packs * l.packSize, l.unit)} · ${kr(l.costOre ?? 0)} · ${priceStatusText(l.status, l.observed)}` : 'ukjent pris'}</small>
                        <small className="allergen">{productAllergenText(l.productId, catalog)}</small>
                        {who(key)}
                        {boughtPill(purchaseOf(l), l)}
                        {'change' in l && <ChangePill line={l as AdjustedLine} />}
                      </button>
                      {oosButton(l) ?? <span className="ie" aria-hidden>{ING_EMOJI[l.ingredient] ?? '🛒'}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {toMark.length > 0 && (
            <button className="ghost markbought" onClick={() => record(...toMark.map((l) => purchaseEvent(l, week)))}>
              🧾 {picked.length > 0 ? `Marker ${picked.length} avkrysset${picked.length === 1 ? '' : 'e'} som handlet` : `Marker alt her som handlet (${open.length})`}
            </button>
          )}
        </section>
        );
      })}
      {kit && <SkippedLines basket={basket as AdjustedBasket} kit={kit} />}
      {kit && <button className="ghost" onClick={() => setHistory(true)}>🕘 Endringer i listen ({versionsFor(kit.history, week).length})</button>}
      {sheet}
      {manualSection}
      <p className="fine">Avkrysninger lagres på enheten og virker uten nett. I en delt husstand ser alle voksne hvem som har krysset av, og
        endringer gjort uten nett sendes når enheten er på nett igjen. «Marker som handlet» lagrer et kjøp i matskapet, også uten nett.
        Et kjøp registreres én gang selv om det trykkes to ganger eller to voksne markerer samme vare; er dere uenige om antall, må det bekreftes.
        Et kjøp betyr ikke at middagen er laget. Trykk på en vare for å se hvorfor den koster det den gjør.</p>
      <button className="ghost" onClick={resetChecks}>Nullstill avkrysninger</button>
    </>
  );
}

function PurchaseCard({ l, p, week, record, who }: { l: BasketLine; p: PurchaseState | undefined; week: string; record: (...e: InventoryEvent[]) => void; who: (bys: string[]) => string }) {
  const line = purchaseLineId(week, l.storeId, l.ingredient, l.productId);
  if (p?.status === 'konflikt') {
    return (
      <div className="card" role="group" aria-label={`Bekreft antall for ${l.name}`}><div className="banner warn" role="alert">To markeringer er uenige om antall pakker
        ({p.claims.map((c) => `${who([c.by])}: ${c.packs}`).join(', ')}). Velg det som stemmer:</div>
        {p.candidates.map((n) => (
          <button key={n} className="ghost" aria-label={`${n} pakke${n === 1 ? '' : 'r'} er riktig for ${l.name}`} onClick={() => record({ type: 'løs', ...stamp(), line, packs: n })}>{n} pakke{n === 1 ? '' : 'r'}</button>
        ))}
      </div>
    );
  }
  if (p && p.status === 'kjøpt') {
    return (
      <div className="card"><div className="drow"><span>🧾 Handlet</span><b>{p.packs} pakke{p.packs === 1 ? '' : 'r'}</b></div>
        <p className="fine">Markert av {who(p.claims.map((c) => c.by))}.</p>
        <button className="ghost" aria-label={`Angre «handlet» for ${l.name}`} onClick={() => record({ type: 'angre', ...stamp(), line })}>Angre «handlet»</button></div>
    );
  }
  return <button className="cta" aria-label={`Marker ${l.name} som handlet`} onClick={() => record(purchaseEvent(l, week))}>🧾 Marker som handlet</button>;
}
