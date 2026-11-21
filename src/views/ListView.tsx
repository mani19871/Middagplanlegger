import type { AppState } from '../store';
import type { Basket, BasketLine } from '../engine/types';
import { amount, kr } from '../engine/format';
import { catalog } from '../data/catalog';

interface Props { state: AppState; update: (f: (s: AppState) => AppState) => void; basket: Basket }
const statusText: Record<BasketLine['status'], string> = {
  ordinær: 'ordinær pris', tilbud: 'tilbud', estimat: 'estimert pris', ukjent: 'ukjent pris',
};

export default function ListView({ state, update, basket }: Props) {
  if (state.slots.length === 0) return <><h1 className="page">Handleliste</h1><section className="card"><p>Lag en ukeplan først.</p></section></>;
  const toggle = (key: string) => update((s) => ({ ...s, checked: { ...s.checked, [key]: !s.checked[key] } }));
  const groups = new Map<string, BasketLine[]>();
  for (const l of basket.lines) {
    const k = l.storeId ?? '—';
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const recipeName = (id: string) => catalog.recipes.find((r) => r.id === id)?.name ?? id;
  return (
    <>
      <h1 className="page">Handleliste</h1>
      {!state.approved && <p className="fine">Planen er ikke godkjent ennå, listen kan endre seg.</p>}
      {[...groups].map(([storeId, lines]) => {
        const store = catalog.stores.find((s) => s.id === storeId);
        const depts = [...new Set(lines.map((l) => l.department))].sort();
        return (
          <section key={storeId} className="card">
            <h2>{store ? store.name : 'Kjøpes hvor som helst – ukjent pris'}</h2>
            {depts.map((d) => (
              <div key={d}>
                <h4 className="dept">{d}</h4>
                <ul className="list">
                  {lines.filter((l) => l.department === d).map((l) => {
                    const key = `${storeId}:${l.ingredient}`;
                    return (
                      <li key={key} className={state.checked[key] ? 'done' : ''}>
                        <label>
                          <input type="checkbox" checked={!!state.checked[key]} onChange={() => toggle(key)} />
                          <span className="main">
                            {l.productId ? `${l.packs} × ${l.productName}` : `${l.name}: ${amount(l.need, l.unit)}`}
                            <small>
                              Dekker {l.covers.map(recipeName).join(', ')}
                              {l.costOre !== null && <> · {kr(l.costOre)} · {statusText[l.status]}{l.observed && ` (${l.source}, ${l.observed})`}</>}
                              {l.costOre === null && <> · {statusText[l.status]}: legg inn pris selv</>}
                            </small>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
      {state.manual.length > 0 && (
        <section className="card">
          <h2>Fra kundeaviser (ikke kontrollert)</h2>
          <ul className="list">
            {state.manual.map((m) => (
              <li key={m.id} className={state.checked[m.id] ? 'done' : ''}>
                <label><input type="checkbox" checked={!!state.checked[m.id]} onChange={() => toggle(m.id)} />
                  <span className="main">{m.text}<small>{m.note} · ikke med i beregnet sum</small></span></label>
                <button className="x" aria-label="Fjern" onClick={() => update((s) => ({ ...s, manual: s.manual.filter((x) => x.id !== m.id) }))}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="fine">Anslått sum for varer med pris: {kr(basket.totalOre)}. Avkrysninger lagres på enheten og virker uten nett.</p>
      <button className="ghost" onClick={() => update((s) => ({ ...s, checked: {} }))}>Nullstill avkrysninger</button>
    </>
  );
}
