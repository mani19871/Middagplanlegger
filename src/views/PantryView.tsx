import { useState } from 'react';
import type { AppState } from '../store';
import type { Basket } from '../engine/types';
import type { Ctx } from '../engine/planner';
import { amount } from '../engine/format';

interface Props { state: AppState; update: (f: (s: AppState) => AppState) => void; ctx: Ctx; basket: Basket }
export default function PantryView({ state, update, ctx, basket }: Props) {
  const { ingredients, recipes } = ctx.catalog;
  const items = ingredients.filter((i) => !i.staple);
  const pantry = state.settings.pantry;
  const [ing, setIng] = useState(items[0].id);
  const [qty, setQty] = useState(500);
  const setP = (id: string, v: number) => update((s) => ({ ...s, approved: false, settings: { ...s.settings, pantry: { ...s.settings.pantry, [id]: Math.max(0, v) } } }));
  const have = items.filter((i) => (pantry[i.id] ?? 0) > 0);
  const rest = basket.lines.filter((l) => l.leftover > 0.5 && l.productId);
  const doable = recipes.filter((r) => r.lines.filter((l) => !ingredients.find((i) => i.id === l.ingredient)?.staple).every((l) => (pantry[l.ingredient] ?? 0) >= l.amount));
  const unit = items.find((i) => i.id === ing)!.unit;
  return (
    <>
      <h1 className="page">Matskapet</h1>
      <p className="fine">Frivillig. Det du registrerer trekkes fra handelen én gang, etter at behov er summert på tvers av retter.</p>
      <div className="card">
        {have.length === 0 && <p>Ingen varer registrert.</p>}
        {have.map((i) => (
          <div key={i.id} className="prow"><strong>{i.name}</strong>
            <input type="number" min={0} value={pantry[i.id]} aria-label={`Mengde ${i.name}`} onChange={(e) => setP(i.id, Number(e.target.value))} /> <small>{i.unit}</small>
            <span className="pill ok">✓ Bekreftet</span>
            <button className="x" aria-label={`Fjern ${i.name}`} onClick={() => setP(i.id, 0)}>✕</button></div>
        ))}
        {rest.map((l) => (
          <div key={l.ingredient} className="prow"><strong>{l.name}</strong><span>{amount(l.leftover, l.unit)}</span>
            <span className="pill warnp">⏲ Forventet rest</span></div>
        ))}
      </div>
      <p className="fine">«Forventet rest» er antatt overskudd fra pakninger i denne handelen. Det regnes ikke som beholdning før du bekrefter det.</p>
      <h3>Kan lages med det du har</h3>
      {doable.length === 0 ? <p className="fine">Ingen retter kan lages bare med skapet ennå.</p>
        : doable.map((r) => <div key={r.id} className="card"><strong>{r.name}</strong><br /><small>{r.minutes} min · alle ingredienser finnes i skapet</small></div>)}
      <h3>Registrer vare</h3>
      <div className="row-field">
        <select value={ing} onChange={(e) => setIng(e.target.value)}>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
        <input type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="Mengde" /><small>{unit}</small>
      </div>
      <div className="two">
        <button className="cta" onClick={() => setP(ing, (pantry[ing] ?? 0) + qty)}>＋ Registrer vare</button>
        <button className="ghost" disabled title="Kvitteringslesing kommer i fase 4">📷 Les kvittering</button>
      </div>
    </>
  );
}
