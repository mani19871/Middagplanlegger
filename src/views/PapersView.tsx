import { useEffect, useState } from 'react';
import { fetchLiveOffers, type LiveResponse } from '../offers/client';
import type { LiveOffer } from '../offers/service';
import { amount } from '../engine/format';
import { recordList, stamp, type AppState } from '../store';
import { requirementViolation, type Ctx } from '../engine/planner';
import { editions, offers, type Edition, type Offer } from '../data/newspapers';
import { DAYS, kr } from '../engine/format';
import { ING_EMOJI } from './art';
import { dayDate, editionInPeriod, isoDate, weekStart } from './dates';
import ReviewView from './ReviewView';
import { recipeAllergenText } from './allergenText';
import LiveOffers from './papers/LiveOffers';
import { hasManualLine, manualLineId, offerKey, offerRecipes } from './papers/offerList';
import { manualLines } from '../sync/list';

interface Props { state: AppState; update: (f: (s: AppState) => AppState) => void; ctx: Ctx; goWeek: () => void;
  /** Økes av App når brukeren trykker på den aktive fanen: lukker åpen utgave eller tilbudsdetalj. */
  resetKey?: number }
type View = 'Hele Norge' | 'Nær meg' | 'Mine butikker';
const COVERS = ['#1f5a46', '#b4532a', '#2b5d6b', '#6b4a2b', '#4b3a63'];
const cover = (id: string) => COVERS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COVERS.length];
const period = (e: Edition) => `${e.validFrom.slice(8)}.–${e.validTo.slice(8)}.${e.validTo.slice(5, 7)}.`;
const place = (e: Edition) => (e.scope === 'nasjonal' ? 'Hele landet' : e.scope === 'regional' ? 'Regional utgave' : 'Lokal utgave');

export default function PapersView({ state, update, ctx, goWeek, resetKey = 0 }: Props) {
  const [view, setView] = useState<View>('Hele Norge');
  const [q, setQ] = useState('');
  const [when, setWhen] = useState<'denne' | 'kommende'>('denne');
  const [edition, setEdition] = useState<Edition | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [recipeId, setRecipeId] = useState<string>('');
  const [day, setDay] = useState<number>(-1);
  const [mode, setMode] = useState<'live' | 'aviser' | 'kontroll'>('live');
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [liveErr, setLiveErr] = useState(false);
  const [liveId, setLiveId] = useState<string | undefined>();
  const [justAdded, setJustAdded] = useState(false);
  useEffect(() => { if (resetKey > 0) { setEdition(null); setOffer(null); setRecipeId(''); setDay(-1); setLiveId(undefined); setJustAdded(false); } }, [resetKey]);

  useEffect(() => {
    if (mode !== 'live') return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const r = await fetchLiveOffers();
        if (stop) return;
        setLive(r); setLiveErr(false);
        if (r.status === 'loading') timer = setTimeout(load, 4000);
      } catch { if (!stop) setLiveErr(true); }
    };
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [mode]);
  const pickLive = (l: LiveOffer) => {
    const o = l.offer;
    setLiveId(o.id); setJustAdded(false);
    const pack = o.amount ? amount(o.amount, o.unit ?? 'g') : o.pieces ? `${o.pieces} stk` : 'mengde ukjent';
    const terms = `Gyldig ${o.validFrom.slice(8, 10)}.${o.validFrom.slice(5, 7)}.–${o.validUntil.slice(8, 10)}.${o.validUntil.slice(5, 7)}.${o.prePriceOre ? ` Før ${kr(o.prePriceOre)}.` : ''}`;
    setEdition({ id: o.dealerId, sender: o.dealerName, title: 'Tilbud', scope: 'nasjonal', validFrom: o.validFrom.slice(0, 10), validUntil: o.validUntil.slice(0, 10), validTo: o.validUntil.slice(0, 10), branch: 'dagligvare', rights: 'lenke' } as unknown as Edition);
    setOffer({ editionId: 'live', text: o.heading, ingredient: l.ingredient, priceOre: o.priceOre, pack, terms });
  };

  if (offer && edition) {
    const ing = ctx.catalog.ingredients.find((i) => i.id === offer.ingredient)!;
    // Bare retter som oppfyller absolutte krav (allergi, kost, råvarer). Et tilbud slår aldri disse (regel 4).
    const matches = offerRecipes(offer.ingredient, ctx);
    const rid = matches.some((r) => r.id === recipeId) ? recipeId : matches[0]?.id;
    const recipeOf = (id: string) => ctx.catalog.recipes.find((r) => r.id === id)!;
    const days = state.slots.map((s) => s.day);
    const d = day >= 0 && days.includes(day) ? day : days[0];
    const start = weekStart();
    // Fra et levende tilbud går ← tilbake til lista, ikke til en kunstig avisside (den er bare et bærelag for detaljen).
    const back = () => { if (liveId) setEdition(null); setOffer(null); setRecipeId(''); setDay(-1); setLiveId(undefined); setJustAdded(false); };
    const priceText = offer.priceOre !== null ? kr(offer.priceOre) : 'pris ukjent';
    const key = offerKey(offer, liveId);
    const already = hasManualLine(manualLines(state.list), key);
    // Idempotent per tilbud: er tilbudet allerede lagt i handlelista (og ikke fjernet), legges det ikke til på nytt.
    const addManual = () => {
      if (already) return;
      const st = stamp();
      update((s) => hasManualLine(manualLines(s.list), key) ? s
        : recordList(s, { type: 'manuell', ...st, line: liveId
          // Tilbud fra Tjek lagres og synkes ikke (bare live-visning): lista får varen og kjeden, ikke overskrift eller pris.
          ? { id: manualLineId(key, st.id), text: ing.name.slice(0, 200), note: `tilbud hos ${edition.sender}`.slice(0, 200) }
          : { id: manualLineId(key, st.id), text: offer.text.slice(0, 200), note: `${edition.sender}, ${priceText}`.slice(0, 200) } }));
      setJustAdded(true);
    };
    return (
      <>
        <div className="pagehead"><button className="x" aria-label="Tilbake" onClick={back}>←</button><h2>Bruk tilbudet</h2><span /></div>
        <div className="card row"><span className="bigemoji" aria-hidden>{ING_EMOJI[ing.id] ?? '🛒'}</span>
          <span className="rinfo"><strong className="big">{offer.text}</strong><span><b className="price">{priceText}</b> · {offer.pack}</span><small>{offer.terms}</small></span></div>
        <h3>Velg en middag</h3>
        {matches.length === 0 && <p className="fine">Ingen middager med denne varen passer kravene dine (allergi, kost eller råvarer).</p>}
        {matches.map((r) => (
          <label key={r.id} className={`row inner opt ${rid === r.id ? 'sel' : ''}`}>
            <input type="radio" name="m" checked={rid === r.id} onChange={() => setRecipeId(r.id)} />
            <span className="rinfo"><strong>{r.name}</strong><small>{r.minutes} min</small>
              <small className="allergen">{recipeAllergenText(r, ctx.catalog)}</small></span></label>
        ))}
        <h3>Velg dag</h3>
        {days.length === 0 ? <p className="fine">Lag ukeplanen først for å bruke tilbudet i planen.</p> : (
          <select className="field" value={d} onChange={(e) => setDay(Number(e.target.value))}>
            {days.map((x) => <option key={x} value={x}>{DAYS[x]} {dayDate(start, x).getDate()}.</option>)}</select>
        )}
        <button className="cta" disabled={days.length === 0 || !rid} onClick={() => {
          update((s) => ({ ...s, approved: false, slots: s.slots.map((x) => (x.day === d ? { ...x, recipeId: rid!, locked: requirementViolation(recipeOf(rid!), ctx) === null } : x)) }));
          back(); setEdition(null); goWeek();
        }}>Legg i ukeplan</button>
        <button className="ghost wide" disabled={already} onClick={addManual}>{already ? '✓ Allerede i handlelista' : 'Bare legg i handlelista'}</button>
        <p className="fine" role="status">{already ? (justAdded ? 'Lagt i handlelista under «Fra kundeaviser (ikke kontrollert)».' : 'Dette tilbudet ligger allerede i handlelista. Fjern det der for å legge det til på nytt.') : ''}</p>
        <p className="fine">Tilbudsprisen regnes ikke inn i summen før vare, pris, omfang og vilkår er kontrollert. Linjen i handlelista er merket «ikke kontrollert».</p>
      </>
    );
  }

  if (edition) {
    const eOffers = offers.filter((o) => o.editionId === edition.id);
    return (
      <>
        <div className="pagehead"><button className="x" aria-label="Tilbake" onClick={() => setEdition(null)}>←</button>
          <div className="center"><h2>{edition.sender}</h2><small className="fine">{edition.title} · {period(edition)}</small></div><span /></div>
        <div className="coverbig" style={{ background: cover(edition.id) }}><b>{edition.sender}</b><span>{edition.title}</span></div>
        <p className="fine">{place(edition)} · {edition.branch} · demodata, ikke kontrollert mot en ekte avis. Visningsrett: {edition.rights === 'visning' ? 'bla i appen (avtale kreves)' : 'les hos kjeden'}. Selve avissidene vises først når vi har avtale.</p>
        <button className="ghost wide" disabled title="Lenke avklares i fase 0">Les hos kjeden ↗</button>
        <h3>Tilbud koblet til varer</h3>
        {eOffers.length === 0 && <p className="fine">Ingen tilbud er koblet til varer i denne utgaven ennå. Du kan fortsatt lese den hos kjeden.</p>}
        <div className="tiles">
          {eOffers.map((o) => (
            <button key={o.text} className="tile" onClick={() => { setOffer(o); setRecipeId(''); setLiveId(undefined); setJustAdded(false); }}>
              <span className="bigemoji" aria-hidden>{ING_EMOJI[o.ingredient] ?? '🛒'}</span>
              <b>{o.text}</b><span className="price">{o.priceOre !== null ? kr(o.priceOre) : 'pris ukjent'}</span><small>{o.terms}</small><span className="plus" aria-hidden>＋</span></button>
          ))}
        </div>
      </>
    );
  }

  const ingName = (id: string) => ctx.catalog.ingredients.find((i) => i.id === id)?.name ?? id;
  const today = isoDate(new Date());
  const inPeriod = (e: Edition) => editionInPeriod(e, when, today);
  const local = (e: Edition) => e.scope === 'nasjonal' || (e.postalPrefixes ?? []).some((p) => state.postal.startsWith(p));
  const shown = editions.filter(inPeriod).filter((e) => `${e.sender} ${e.title}`.toLowerCase().includes(q.toLowerCase())).filter((e) => {
    if (view === 'Nær meg') return state.postal.length >= 1 && local(e);
    if (view === 'Mine butikker') return !!e.storeId && state.settings.storeIds.includes(e.storeId);
    return true;
  });
  return (
    <>
      <h1 className="page">Kundeaviser</h1>
      <div className="chips tabs">
        <button className={mode === 'live' ? 'chip on' : 'chip'} onClick={() => setMode('live')}>Tilbud nå</button>
        <button className={mode === 'aviser' ? 'chip on' : 'chip'} onClick={() => setMode('aviser')}>Aviser (demo)</button>
        <button className={mode === 'kontroll' ? 'chip on' : 'chip'} onClick={() => setMode('kontroll')}>Kontroll</button>
      </div>
      {mode === 'kontroll' && <ReviewView ingredients={ctx.catalog.ingredients} />}
      {mode === 'live' && <LiveOffers live={live} err={liveErr} ingName={ingName} onPick={pickLive} />}
      {mode === 'aviser' && (<>
      <div className="row-field"><input style={{ flex: 1, width: 'auto' }} placeholder="🔍 Søk etter kjede eller sted" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips tabs">
        {(['Hele Norge', 'Nær meg', 'Mine butikker'] as View[]).map((v) => <button key={v} className={view === v ? 'chip on' : 'chip'} onClick={() => setView(v)}>{v}</button>)}
      </div>
      <div className="row-field">
        <button className={when === 'denne' ? 'chip on' : 'chip'} onClick={() => setWhen('denne')}>Denne uka</button>
        <button className={when === 'kommende' ? 'chip on' : 'chip'} onClick={() => setWhen('kommende')}>Kommende</button>
        <input style={{ width: 120 }} placeholder="Postnummer" inputMode="numeric" maxLength={4} value={state.postal} onChange={(e) => update((s) => ({ ...s, postal: e.target.value.replace(/\D/g, '') }))} />
      </div>
      {view === 'Nær meg' && !state.postal && <p className="fine">Skriv inn postnummer, eller bruk «Hele Norge». Posisjonstillatelse trengs ikke.</p>}
      {shown.length === 0 && <p className="card">Ingen aviser funnet. Nasjonale aviser vises alltid; lokale utgaver kan mangle i ditt område.</p>}
      <div className="covers">
        {shown.map((e) => (
          <button key={e.id} className="ecard" onClick={() => setEdition(e)}>
            <span className="cvr" style={{ background: cover(e.id) }}><b>{e.sender}</b><small>{e.title}</small></span>
            <span className="cap"><span>{period(e)}<br /><small>{place(e)}</small></span><span aria-hidden>›</span></span>
          </button>
        ))}
      </div>
      <p className="fine">Demodata. Avisene er oppdiktet; visning av ekte aviser krever egen avtale.</p>
      </>)}
    </>
  );
}
