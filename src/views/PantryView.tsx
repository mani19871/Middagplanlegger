import { useMemo, useState } from 'react';
import { stamp, type AppState } from '../store';
import type { Basket } from '../engine/types';
import { slotUses, type Ctx } from '../engine/planner';
import { amount } from '../engine/format';
import { expectedRest } from '../engine/pantry';
import {
  confirmedRests, conflicts, deriveStock, lineStates, madeLineId, purchaseLineId, type InventoryEvent,
} from '../engine/inventory';

const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const weekText = (w: string | null, current: string) => {
  if (!w || w === current) return 'denne uka';
  const [, m, d] = w.split('-').map(Number);
  return `uka fra ${d}.${m}.`;
};

interface Props { state: AppState; record: (...e: InventoryEvent[]) => void; week: string; ctx: Ctx; basket: Basket; openCookNow?: () => void }
export default function PantryView({ state, record, week, ctx, basket, openCookNow }: Props) {
  const { ingredients, recipes } = ctx.catalog;
  const items = ingredients.filter((i) => !i.staple);
  const name = (id: string) => ingredients.find((i) => i.id === id)?.name ?? id;
  const unitOf = (id: string) => ingredients.find((i) => i.id === id)?.unit ?? 'g';
  const log = state.inventory;
  const now = useMemo(() => deriveStock(log), [log]);
  const { purchases, made } = useMemo(() => lineStates(log), [log]);
  const rests = useMemo(() => confirmedRests(log, week), [log, week]);
  const open = useMemo(() => conflicts(log), [log]);
  const [ing, setIng] = useState(items[0].id);
  const [qty, setQty] = useState(500);

  const confirmed = now.lots.filter((l) => l.kind === 'bekreftet');
  const bought = now.lots.filter((l) => l.kind === 'kjøpt');
  const confirmedAmount = (id: string) => confirmed.find((l) => l.ingredient === id)?.amount ?? 0;
  const count = (id: string, v: number) => record({ type: 'telling', ...stamp(), ingredient: id, amount: Math.max(0, Math.round(v)) });
  // Forventet rest fra denne ukas kurv. Kan bekreftes når linja er markert som handlet, og bare én gang per vare og uke.
  const rest = expectedRest(basket).filter((r) => rests[r.ingredient] === undefined);
  const boughtThisWeek = (ingredient: string) => basket.lines.some((l) => l.ingredient === ingredient
    && purchases.get(purchaseLineId(week, l.storeId, l.ingredient, l.productId))?.status === 'kjøpt');

  return (
    <>
      <h1 className="page">Matskapet</h1>
      <p className="fine">Frivillig. Tre ting holdes adskilt: det du har bekreftet hjemme, det som er markert som handlet og ikke brukt,
        og forventet rest. Bare de to første trekkes fra handelen, én gang per vare etter at behovet er summert på tvers av dagene.
        Denne ukas egne kjøp og rester endrer ikke denne ukas handleliste.</p>

      {open.map((p) => (
        <div key={p.line} className="banner warn">⚠ {name(p.ingredient)}: to markeringer er uenige om antall pakker ({p.candidates.join(' eller ')}).
          Teller ikke før det er bekreftet.
          <div>{p.candidates.map((n) => (
            <button key={n} className="ghost sm" onClick={() => record({ type: 'løs', ...stamp(), line: p.line, packs: n })}>{n} pakke{n === 1 ? '' : 'r'}</button>
          ))}</div>
        </div>
      ))}

      <h3>✓ Bekreftet hjemme</h3>
      <div className="card">
        {confirmed.length === 0 && <p className="fine">Ingenting bekreftet ennå.</p>}
        {confirmed.map((l) => (
          <div key={l.ingredient} className="prow"><strong>{name(l.ingredient)}{l.source === 'rest' && <small className="sub">rest fra {weekText(l.week, week)}</small>}</strong>
            <input type="number" min={0} key={`${l.ingredient}:${Math.round(l.amount)}`} defaultValue={Math.round(l.amount)} aria-label={`Mengde ${name(l.ingredient)}`}
              onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && Math.round(v) !== Math.round(l.amount)) count(l.ingredient, v); }} />
            <small>{unitOf(l.ingredient)}</small>
            <button className="x" aria-label={`Fjern ${name(l.ingredient)}`} onClick={() => count(l.ingredient, 0)}>✕</button></div>
        ))}
      </div>

      <h3>🧾 Kjøpt (ikke brukt)</h3>
      <div className="card">
        {bought.length === 0 && <p className="fine">Ingen kjøp markert. Bruk «Marker som handlet» i handlelista.</p>}
        {bought.map((l) => (
          <div key={`${l.ingredient}:${l.week}`} className="prow"><strong>{name(l.ingredient)}</strong><span>{amount(l.amount, unitOf(l.ingredient))}</span>
            <span className="pill">Kjøpt {weekText(l.week, week)}</span></div>
        ))}
      </div>

      <h3>⏲ Forventet rest</h3>
      <div className="card">
        {rest.length === 0 && <p className="fine">Ingen forventet rest fra denne ukas handel.</p>}
        {rest.map((l) => (
          <div key={l.ingredient} className="prow"><strong>{l.name}</strong><span>{amount(l.amount, l.unit)}</span>
            {boughtThisWeek(l.ingredient)
              ? <button className="ghost sm" onClick={() => record({ type: 'rest', ...stamp(), week, ingredient: l.ingredient, amount: Math.max(0, Math.round(l.amount)) })}>Bekreft rest</button>
              : <span className="pill warnp">Ikke handlet ennå</span>}
          </div>
        ))}
      </div>
      <p className="fine">Forventet rest er beregnet overskudd fra hele pakninger i denne ukas handel. Den er ikke beholdning.
        Når du bekrefter en rest, regnes den som det som er igjen av varen etter ukas middager. Den gjelder fra neste handel,
        erstatter ukas kjøp av varen og kan bare bekreftes én gang per vare og uke.</p>

      {state.slots.length > 0 && (
        <>
          <h3>🍽 Middager denne uka</h3>
          <div className="card">
            {state.slots.map((s) => {
              const m = made.get(madeLineId(week, s.day));
              const done = !!m && m.active;
              const r = recipes.find((x) => x.id === s.recipeId);
              return (
                <div key={s.day} className="prow"><strong>{DAYS[s.day]}: {r?.name ?? s.recipeId}</strong>
                  {done
                    ? <button className="ghost sm" onClick={() => record({ type: 'angre', ...stamp(), line: madeLineId(week, s.day) })}>✓ Laget · angre</button>
                    : <button className="ghost sm" onClick={() => record({ type: 'laget', ...stamp(), week, line: madeLineId(week, s.day), day: s.day, recipeId: s.recipeId, uses: slotUses(s, ctx) })}>Marker som laget</button>}
                </div>
              );
            })}
          </div>
          <p className="fine">En kjøpt pakke betyr ikke at retten er laget. Når du markerer en middag som laget, trekkes mengdene den brukte
            fra matskapet (det som har ligget lengst brukes først).</p>
        </>
      )}

      <h3>Hva kan vi lage nå?</h3>
      <div className="card"><p>«Lag nå» foreslår middager ut fra det som finnes hjemme, med mengder for porsjonene dere skal lage og hva som mangler.</p>
        {openCookNow && <button className="ghost" onClick={openCookNow}>🍳 Åpne «Lag nå»</button>}</div>
      <h3>Registrer vare hjemme</h3>
      <div className="row-field">
        <select aria-label="Vare" value={ing} onChange={(e) => setIng(e.target.value)}>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
        <input type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label={`Mengde i ${unitOf(ing) === 'stk' ? 'stykk' : unitOf(ing)}`} /><small aria-hidden>{unitOf(ing)}</small>
      </div>
      <div className="two">
        <button className="cta" onClick={() => count(ing, confirmedAmount(ing) + qty)}>＋ Registrer vare</button>
        <button className="ghost" disabled title="Kvitteringslesing kommer i fase 4">📷 Les kvittering</button>
      </div>
      <p className="fine">Registrer det du hadde fra før, ikke det du har markert som handlet. Etter at noe er markert som handlet denne uka,
        gjelder nye registreringer fra neste handel. {state.outbox.length > 0 && `${state.outbox.length} endring${state.outbox.length === 1 ? '' : 'er'} er lagret på denne enheten${state.sync ? ' og sendes til husstanden ved neste synk' : ''}.`}</p>
    </>
  );
}
