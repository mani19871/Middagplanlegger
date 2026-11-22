// Kontrollkø for tilbudsmatching (redaktør). Viser live treff fra tilbudsserveren med forslag, og lar redaktøren
// godkjenne, avvise eller endre ingrediens. Resultatet er et regelutkast (mønstre, aldri tilbud) som eksporteres
// som JSON og limes inn i src/data/offer-rules.json. Tilbudsinnholdet vises bare live og lagres ikke.
import { useEffect, useMemo, useState } from 'react';
import type { Ingredient } from '../engine/types';
import { amount, kr } from '../engine/format';
import { fetchLiveOffers, type LiveResponse } from '../offers/client';
import { matchOffer, OFFER_TERMS, rejectedBy, type MatchedOffer } from '../offers/match';
import {
  OFFER_RULES, parseRules, removeRule, ruleDiff, ruleFileText, ruleKey, suggestPattern, upsertRule, type OfferRule,
} from '../offers/rules';
import type { LiveOffer } from '../offers/service';
import { pageItems, REVIEW_PAGE, RULES_PAGE, searchRows } from './reviewList';

const DRAFT_KEY = 'offer-rules-draft-v1'; // bare mønstre, aldri tilbud
type Status = 'forslag' | 'godkjent' | 'avvist';
type Filter = Status | 'alle';
interface Row { live: LiveOffer; match: MatchedOffer | null; status: Status; by: string | null }

function loadDraft(ids: string[]): OfferRule[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return parseRules(JSON.parse(raw), ids);
  } catch { /* ugyldig eller manglende utkast: start fra regelfilen */ }
  return OFFER_RULES;
}

export default function ReviewView({ ingredients }: { ingredients: Ingredient[] }) {
  const ids = useMemo(() => ingredients.map((i) => i.id), [ingredients]);
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [err, setErr] = useState(false);
  const [draft, setDraft] = useState<OfferRule[]>(() => loadDraft(ids));
  const [filter, setFilter] = useState<Filter>('forslag');
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState('');
  const [visible, setVisible] = useState(REVIEW_PAGE);
  const [rulesVisible, setRulesVisible] = useState(RULES_PAGE);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const r = await fetchLiveOffers();
        if (stop) return;
        setLive(r); setErr(false);
        if (r.status === 'loading') timer = setTimeout(load, 4000);
      } catch { if (!stop) setErr(true); }
    };
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, ruleFileText(draft)); } catch { /* lagring kan mangle */ }
  }, [draft]);

  const rows: Row[] = useMemo(() => (live?.offers ?? []).map((l) => {
    const match = matchOffer(l.offer, ingredients, l.offer.validFrom.slice(0, 10), OFFER_TERMS, draft);
    const rej = rejectedBy(l.offer.heading, draft);
    const status: Status = !match ? 'avvist' : match.approved ? 'godkjent' : 'forslag';
    return { live: l, match, status, by: rej?.pattern ?? match?.rule ?? null };
  }), [live, draft, ingredients]);
  const count = (f: Filter) => rows.filter((r) => f === 'alle' || r.status === f).length;
  const filtered = searchRows(rows.filter((r) => filter === 'alle' || r.status === filter), q, (r) => `${r.live.offer.heading} ${r.live.offer.dealerName}`);
  const page = pageItems(filtered, visible);
  const rulePage = pageItems(draft, rulesVisible, RULES_PAGE);
  const diff = ruleDiff(OFFER_RULES, draft);
  const changed = diff.added.length + diff.removed.length > 0;
  const add = (r: OfferRule) => setDraft((d) => upsertRule(d, r));
  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); } catch { setCopied('Kopiering ble blokkert; merk teksten og kopier selv.'); }
  };
  const ingName = (id?: string) => (id ? ingredients.find((i) => i.id === id)?.name ?? id : 'alle ingredienser');

  return (
    <>
      <h2>Kontroll av tilbudstreff</h2>
      <p className="fine">For redaktør. Godkjenn bare når overskriften entydig er ingrediensen. Avvis det som er bearbeidet, har annet innhold
        (f.eks. svin i kjøttdeig) eller ikke er mat vi planlegger med. Bare regelgodkjente tilbud kan senke «Med kontrollerte tilbud»-summen,
        og bare når pris, mengde og vilkår er kjent. Tilbudene vises live og lagres ikke; utkastet lagrer bare mønstre på denne enheten.</p>
      {err && <div className="banner warn">Fikk ikke kontakt med tilbudsserveren. Start den med <code>npm run server</code>.</div>}
      {!err && (!live || live.status === 'loading') && <p className="card">Henter tilbud …</p>}
      {live?.status === 'error' && <div className="banner warn">Tilbudskilden svarte ikke ({live.error}).</div>}
      <div className="chips tabs">
        {(['forslag', 'godkjent', 'avvist', 'alle'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'chip on' : 'chip'} aria-pressed={filter === f} onClick={() => { setFilter(f); setVisible(REVIEW_PAGE); }}>{f[0].toUpperCase() + f.slice(1)} ({count(f)})</button>
        ))}
      </div>
      <div className="row-field"><input style={{ flex: 1, width: 'auto' }} type="search" aria-label="Søk i treff" placeholder="🔍 Søk i treff" value={q} onChange={(e) => { setQ(e.target.value); setVisible(REVIEW_PAGE); }} /></div>
      {live?.status === 'ok' && filtered.length === 0 && <p className="fine">Ingen treff her.</p>}
      <ul className="review">
        {page.items.map((r) => <ReviewRow key={r.live.offer.id} row={r} ingredients={ingredients} onRule={add} />)}
      </ul>
      {filtered.length > 0 && <p className="fine" role="status">Viser {page.shown} av {page.total} treff.</p>}
      {page.remaining > 0 && <button className="ghost wide" onClick={() => setVisible(page.next)}>Vis flere ({page.remaining} igjen)</button>}

      <h3>Regelutkast</h3>
      <p className="fine">{draft.length} regler i utkastet · {diff.added.length} nye · {diff.removed.length} fjernet i forhold til regelfilen.</p>
      <ul className="list">
        {rulePage.items.map((r) => (
          <li key={ruleKey(r)}>
            <span className="main"><b>«{r.pattern}»</b><small>{r.decision === 'godkjent' ? `godkjent som ${ingName(r.ingredient)}` : r.decision === 'tillatt' ? `unntak fra utelukkelseslisten, forslag til ${ingName(r.ingredient)}` : `avvist for ${ingName(r.ingredient)}`}</small></span>
            <button className="x" aria-label={`Fjern regel ${r.pattern}`} onClick={() => setDraft((d) => removeRule(d, r))}>✕</button>
          </li>
        ))}
      </ul>
      {rulePage.remaining > 0 && <button className="ghost wide" onClick={() => setRulesVisible(rulePage.next)}>Vis flere regler ({rulePage.remaining} igjen)</button>}
      <AllowForm ingredients={ingredients} onRule={add} />
      <details className="steps" open={changed}>
        <summary>Eksporter regler</summary>
        <p className="fine">Kopier hele filen inn i <code>src/data/offer-rules.json</code> og send endringen til gjennomgang. Diffen viser bare endringene.</p>
        <label className="lab" htmlFor="rdiff" style={{ display: 'block' }}>Regeldiff (JSON)</label>
        <textarea id="rdiff" className="field" readOnly rows={6} value={JSON.stringify(diff, null, 2)} />
        <button className="ghost" onClick={() => copy('Regeldiff kopiert.', JSON.stringify(diff, null, 2))}>Kopier regeldiff</button>
        <label className="lab" htmlFor="rfile" style={{ display: 'block', marginTop: 8 }}>Hel regelfil</label>
        <textarea id="rfile" className="field" readOnly rows={8} value={ruleFileText(draft)} />
        <button className="ghost" onClick={() => copy('Regelfil kopiert.', ruleFileText(draft))}>Kopier regelfil</button>
        <p className="fine" role="status">{copied}</p>
        <button className="ghost" disabled={!changed} onClick={() => setDraft(OFFER_RULES)}>Forkast utkastet</button>
      </details>
    </>
  );
}

function ReviewRow({ row, ingredients, onRule }: { row: Row; ingredients: Ingredient[]; onRule: (r: OfferRule) => void }) {
  const o = row.live.offer;
  const [pattern, setPattern] = useState(() => suggestPattern(o.heading));
  const [ing, setIng] = useState(row.match?.ingredient ?? row.live.ingredient);
  const valid = pattern.trim().length >= 2;
  const pack = o.amount ? amount(o.amount, o.unit ?? 'g') : o.pieces ? `${o.pieces} stk` : 'mengde ukjent';
  const label = { forslag: 'Forslag', godkjent: 'Godkjent', avvist: 'Avvist' }[row.status];
  return (
    <li className="card review-row">
      <div className="drow"><b>{o.heading}</b><span className={`pill ${row.status === 'godkjent' ? 'down' : row.status === 'avvist' ? 'warnp' : ''}`}>{label}</span></div>
      <small className="fine">{o.dealerName} · {o.priceOre !== null ? kr(o.priceOre) : 'pris ukjent'}{o.prePriceOre ? ` (før ${kr(o.prePriceOre)})` : ''} · {pack} ·
        {` ${o.validFrom.slice(8, 10)}.${o.validFrom.slice(5, 7)}.–${o.validUntil.slice(8, 10)}.${o.validUntil.slice(5, 7)}.`}</small>
      {o.description && <small className="fine">{o.description}</small>}
      <small className="fine">
        {row.match ? `Kobles til ${ingredients.find((i) => i.id === row.match!.ingredient)?.name ?? row.match.ingredient}` : 'Ingen kobling'}
        {row.by ? ` · regel «${row.by}»` : row.match ? ' · søkeordforslag' : ''}
        {row.match && row.match.reasons.length > 0 ? ` · må kontrolleres: ${row.match.reasons.join(', ')}` : ''}
      </small>
      <div className="row-field">
        <input aria-label="Mønster" style={{ flex: 1, width: 'auto' }} value={pattern} onChange={(e) => setPattern(e.target.value)} />
        <select aria-label="Ingrediens" className="field" style={{ width: 'auto' }} value={ing} onChange={(e) => setIng(e.target.value)}>
          {ingredients.filter((i) => !i.staple).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div className="row-field">
        <button className="ghost sm" disabled={!valid} onClick={() => onRule({ pattern, decision: 'godkjent', ingredient: ing })}>✓ Godkjenn som {ingredients.find((i) => i.id === ing)?.name.toLowerCase()}</button>
        <button className="ghost sm" disabled={!valid} onClick={() => onRule({ pattern, decision: 'avvist', ingredient: ing })}>✕ Ikke {ingredients.find((i) => i.id === ing)?.name.toLowerCase()}</button>
        <button className="ghost sm" disabled={!valid} onClick={() => onRule({ pattern, decision: 'avvist' })}>✕ Avvis helt</button>
      </div>
    </li>
  );
}

/** Unntak fra utelukkelseslisten. Tilbud som stoppes av den (f.eks. «saus» i «soyasaus») når aldri køen, så unntaket legges inn her. */
function AllowForm({ ingredients, onRule }: { ingredients: Ingredient[]; onRule: (r: OfferRule) => void }) {
  const choices = ingredients.filter((i) => !i.staple);
  const [pattern, setPattern] = useState('');
  const [ing, setIng] = useState(choices[0]?.id ?? '');
  return (
    <details className="steps">
      <summary>Legg til unntak fra utelukkelseslisten</summary>
      <p className="fine">Bruk når et søkeord inneholder et utelukket ord, f.eks. «soyasaus» (saus) eller «fiskekaker» (kake). Resten av overskriften sjekkes fortsatt,
        og treffene havner i køen som forslag, ikke som godkjent.</p>
      <div className="row-field wrapfield">
        <input aria-label="Unntaksmønster" placeholder="f.eks. soyasaus" style={{ flex: 1, width: 'auto' }} value={pattern} onChange={(e) => setPattern(e.target.value)} />
        <select aria-label="Ingrediens for unntak" className="field" style={{ width: 'auto' }} value={ing} onChange={(e) => setIng(e.target.value)}>
          {choices.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <button className="ghost sm" disabled={pattern.trim().length < 2 || !ing} onClick={() => { onRule({ pattern, decision: 'tillatt', ingredient: ing }); setPattern(''); }}>Tillat</button>
      </div>
    </details>
  );
}
