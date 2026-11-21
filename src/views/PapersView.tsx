import { useState } from 'react';
import type { AppState } from '../store';
import type { Ctx } from '../engine/planner';
import { editions, offers, type Edition } from '../data/newspapers';
import { kr } from '../engine/format';

interface Props { state: AppState; update: (f: (s: AppState) => AppState) => void; ctx: Ctx; goWeek: () => void }
type View = 'Hele Norge' | 'Nær meg' | 'Mine butikker';
const TODAY = '2026-11-21';

export default function PapersView({ state, update, ctx, goWeek }: Props) {
  const [view, setView] = useState<View>('Hele Norge');
  const [q, setQ] = useState('');
  const [when, setWhen] = useState<'denne' | 'kommende'>('denne');
  const [open, setOpen] = useState<string | null>(null);

  const inPeriod = (e: Edition) => (when === 'denne' ? e.validFrom <= TODAY && e.validTo >= TODAY : e.validFrom > TODAY);
  const local = (e: Edition) => e.scope === 'nasjonal' || (e.postalPrefixes ?? []).some((p) => state.postal.startsWith(p));
  const shown = editions.filter(inPeriod).filter((e) => `${e.sender} ${e.title}`.toLowerCase().includes(q.toLowerCase())).filter((e) => {
    if (view === 'Nær meg') return state.postal.length >= 1 && local(e);
    if (view === 'Mine butikker') return !!e.storeId && state.settings.storeIds.includes(e.storeId);
    return true;
  });

  const useInPlan = (recipeId: string) => {
    update((s) => {
      const day = s.slots.find((x) => !x.locked)?.day;
      if (day === undefined) return s;
      return { ...s, approved: false, slots: s.slots.map((x) => (x.day === day ? { ...x, recipeId, locked: true } : x)) };
    });
    goWeek();
  };

  return (
    <>
      <h1 className="page">Kundeaviser</h1>
      <div className="chips">
        {(['Hele Norge', 'Nær meg', 'Mine butikker'] as View[]).map((v) => (
          <button key={v} className={view === v ? 'chip on' : 'chip'} onClick={() => setView(v)}>{v}</button>
        ))}
      </div>
      <div className="row-field">
        <input placeholder="Søk på kjede, butikk eller sted" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="postal" placeholder="Postnummer" inputMode="numeric" maxLength={4} value={state.postal}
          onChange={(e) => update((s) => ({ ...s, postal: e.target.value.replace(/\D/g, '') }))} />
      </div>
      <div className="chips">
        <button className={when === 'denne' ? 'chip on' : 'chip'} onClick={() => setWhen('denne')}>Denne uka</button>
        <button className={when === 'kommende' ? 'chip on' : 'chip'} onClick={() => setWhen('kommende')}>Kommende</button>
      </div>
      {view === 'Nær meg' && !state.postal && <p className="fine">Skriv inn postnummer eller bruk «Hele Norge». Posisjonstillatelse trengs ikke.</p>}
      {shown.length === 0 && <p className="card">Ingen aviser funnet. Nasjonale aviser vises alltid; lokale utgaver kan mangle i ditt område.</p>}
      {shown.map((e) => {
        const eOffers = offers.filter((o) => o.editionId === e.id);
        return (
          <article key={e.id} className="card">
            <h4>{e.title}</h4>
            <p>{e.sender} · {e.scope} · gyldig {e.validFrom} – {e.validTo} · {e.branch}</p>
            <p className="fine">Sist kontrollert {TODAY} · visningsrett: {e.rights === 'visning' ? 'bla i appen' : 'les hos kjeden'}</p>
            <button className="ghost" disabled title="Lenke avklares i fase 0">Les hos kjeden</button>
            {eOffers.length > 0 && (
              <button className="ghost" onClick={() => setOpen(open === e.id ? null : e.id)}>Tilbud ({eOffers.length})</button>
            )}
            {open === e.id && eOffers.map((o) => {
              const matches = ctx.catalog.recipes.filter((r) => r.lines.some((l) => l.ingredient === o.ingredient));
              return (
                <div key={o.text} className="offer">
                  <strong>{o.text}</strong> · {kr(o.priceOre)} · {o.pack}<br /><small>{o.terms}</small>
                  <div>
                    <button onClick={() => update((s) => ({ ...s, manual: [...s.manual, { id: `m${Date.now()}`, text: o.text, note: `${e.sender}, ${kr(o.priceOre)}` }] }))}>Legg i handlelista</button>
                  </div>
                  <small>Middager med {ctx.catalog.ingredients.find((i) => i.id === o.ingredient)?.name.toLowerCase()}:</small>
                  <div>{matches.map((r) => (
                    <button key={r.id} className="chip" disabled={state.slots.length === 0} onClick={() => useInPlan(r.id)}>Bruk {r.name}</button>
                  ))}</div>
                  {state.slots.length === 0 && <small>Lag ukeplanen først for å bruke tilbudet i planen.</small>}
                </div>
              );
            })}
          </article>
        );
      })}
    </>
  );
}
