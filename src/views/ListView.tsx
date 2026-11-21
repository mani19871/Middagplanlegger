import { useState } from 'react';
import type { AppState } from '../store';
import type { Basket, BasketLine } from '../engine/types';
import { amount, kr } from '../engine/format';
import { catalog } from '../data/catalog';
import { DEPT_EMOJI, ING_EMOJI } from './art';

interface Props { state: AppState; update: (f: (s: AppState) => AppState) => void; basket: Basket }
const statusText: Record<BasketLine['status'], string> = { ordinær: 'Ordinær pris', tilbud: 'Tilbud', estimat: 'Estimert pris', ukjent: 'Ukjent pris' };
const storeName = (id: string | null) => catalog.stores.find((s) => s.id === id)?.name ?? 'Ukjent butikk';
const recipeName = (id: string) => catalog.recipes.find((r) => r.id === id)?.name ?? id;
const lineText = (l: BasketLine) => (l.productId ? (l.packs > 1 ? `${l.packs} × ${l.productName}` : l.productName!) : `${l.name}: ${amount(l.need, l.unit)}`);

export default function ListView({ state, update, basket }: Props) {
  const [detail, setDetail] = useState<BasketLine | null>(null);
  if (state.slots.length === 0) return <><h1 className="page">Handleliste</h1><section className="card"><p>Lag en ukeplan først.</p></section></>;

  if (detail) {
    const l = detail;
    const unitPrice = l.costOre !== null && l.packs > 0 ? l.costOre / l.packs : null;
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
            <p className="fine">Kilde: {l.source}, observert {l.observed}. Prisen er anslått og kan avvike i butikken.</p></div>
        ) : <div className="banner warn">Ingen pris funnet i valgte butikker for denne varen. Den teller ikke i summen, og kurven kan ikke bekreftes innenfor budsjett. Du kan kjøpe den hvor som helst.</div>}
        {l.costOre !== null && <div className="card total2"><span>Sum</span><strong>{kr(l.costOre)}</strong></div>}
      </>
    );
  }

  const toggle = (key: string) => update((s) => ({ ...s, checked: { ...s.checked, [key]: !s.checked[key] } }));
  const groups = new Map<string, BasketLine[]>();
  for (const l of basket.lines) groups.set(l.storeId ?? '—', [...(groups.get(l.storeId ?? '—') ?? []), l]);

  return (
    <>
      <div className="pagehead">
        <div><h1 className="page">Handleliste</h1><span className="fine">✓ Lagret på mobilen</span></div>
        <div className="totalpill"><small>Anslått handel</small><strong>{kr(basket.totalOre)}</strong></div>
      </div>
      {!state.approved && <p className="fine">Planen er ikke godkjent ennå, listen kan endre seg.</p>}
      {basket.unknownCount > 0 && <div className="banner warn">{basket.unknownCount} vare{basket.unknownCount === 1 ? '' : 'r'} mangler pris. Summen er en delsum.</div>}
      {[...groups].map(([storeId, lines]) => (
        <section key={storeId}>
          <div className="storebar">🏪 <strong>{storeId === '—' ? 'Uten pris' : storeName(storeId)}</strong></div>
          {[...new Set(lines.map((l) => l.department))].sort().map((d) => (
            <div key={d}>
              <div className="deptbar">{DEPT_EMOJI[d] ?? '🛒'} <strong>{d}</strong></div>
              <ul className="list">
                {lines.filter((l) => l.department === d).map((l) => {
                  const key = `${storeId}:${l.ingredient}`;
                  return (
                    <li key={key} className={state.checked[key] ? 'done' : ''}>
                      <input type="checkbox" aria-label={`Kryss av ${l.name}`} checked={!!state.checked[key]} onChange={() => toggle(key)} />
                      <button className="main" onClick={() => setDetail(l)}>
                        <b>{lineText(l)}</b>
                        <small>{l.productId ? `${amount(l.packs * l.packSize, l.unit)} · ${kr(l.costOre ?? 0)} · ${statusText[l.status].toLowerCase()}` : 'ukjent pris'}</small>
                      </button>
                      <span className="ie" aria-hidden>{ING_EMOJI[l.ingredient] ?? '🛒'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
      {state.manual.length > 0 && (
        <section>
          <div className="deptbar">🏷 <strong>Fra kundeaviser (ikke kontrollert)</strong></div>
          <ul className="list">
            {state.manual.map((m) => (
              <li key={m.id} className={state.checked[m.id] ? 'done' : ''}>
                <input type="checkbox" aria-label={`Kryss av ${m.text}`} checked={!!state.checked[m.id]} onChange={() => toggle(m.id)} />
                <span className="main"><b>{m.text}</b><small>{m.note} · ikke med i beregnet sum</small></span>
                <button className="x" aria-label="Fjern" onClick={() => update((s) => ({ ...s, manual: s.manual.filter((x) => x.id !== m.id) }))}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="fine">Avkrysninger lagres på enheten og virker uten nett. Trykk på en vare for å se hvorfor den koster det den gjør.</p>
      <button className="ghost" onClick={() => update((s) => ({ ...s, checked: {} }))}>Nullstill avkrysninger</button>
    </>
  );
}
