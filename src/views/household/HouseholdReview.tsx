// Kontroll av husholdningstreff (utvidelse C, redaktør). Samme modell som kontrollen for mat (ReviewView.tsx): treffene
// vises live, og redaktøren lager et regelutkast (mønstre, aldri tilbud) som eksporteres og limes inn i
// src/data/household-rules.json. Bare regler i den innsjekkede filen gjelder i appen.
import { useMemo, useState } from 'react';
import { kr } from '../../engine/format';
import {
  classifyHousehold, householdOfferKey, householdRuleFileText, householdRuleKey, parseHouseholdRules, sortHouseholdRules,
  upsertHouseholdRule, type HouseholdRule, type HouseholdRuleSet,
} from '../../engine/household';
import { HOUSEHOLD_DESCRIPTION, HOUSEHOLD_RULES } from '../../data/household';
import { FOOD_TERMS } from '../../offers/household';
import { suggestPattern } from '../../offers/rules';
import type { NormalizedOffer } from '../../offers/types';
import type { HouseholdFeed } from './HouseholdCatch';
import { reasonText, validityText } from './householdText';

const DRAFT_KEY = 'household-rules-draft-v1'; // bare mønstre, aldri tilbud
const PAGE = 20;
type Filter = 'kontroll' | 'godkjent' | 'alle';

function loadDraft(): HouseholdRule[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return parseHouseholdRules({ ...JSON.parse(raw), version: 1, groups: HOUSEHOLD_RULES.groups, exclude: HOUSEHOLD_RULES.exclude, sensitive: HOUSEHOLD_RULES.sensitive }).rules;
  } catch { /* ugyldig eller manglende utkast: start fra regelfilen */ }
  return HOUSEHOLD_RULES.rules;
}
const items = HOUSEHOLD_RULES.groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.name })));
const itemName = (id?: string) => items.find((i) => i.id === id)?.name ?? 'alle varer';

export default function HouseholdReview({ feed }: { feed: HouseholdFeed | null }) {
  const [draft, setDraftState] = useState<HouseholdRule[]>(loadDraft);
  const [filter, setFilter] = useState<Filter>('kontroll');
  const [visible, setVisible] = useState(PAGE);
  const [copied, setCopied] = useState('');
  const set: HouseholdRuleSet = useMemo(() => ({ ...HOUSEHOLD_RULES, rules: draft }), [draft]);
  const setDraft = (f: (d: HouseholdRule[]) => HouseholdRule[]) => setDraftState((d) => {
    const next = f(d);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ rules: next })); } catch { /* lagring kan mangle */ }
    return next;
  });
  const rows = useMemo(() => (feed?.offers ?? []).map((o) => ({ o, m: classifyHousehold(o, set, FOOD_TERMS) }))
    .sort((a, b) => (householdOfferKey(a.o) < householdOfferKey(b.o) ? -1 : 1)), [feed, set]);
  const shown = rows.filter((r) => filter === 'alle' || (filter === 'godkjent' ? r.m?.status === 'godkjent' : r.m?.status !== 'godkjent'));
  const base = new Set(HOUSEHOLD_RULES.rules.map(householdRuleKey)), now = new Set(draft.map(householdRuleKey));
  const added = draft.filter((r) => !base.has(householdRuleKey(r))).length, removed = HOUSEHOLD_RULES.rules.filter((r) => !now.has(householdRuleKey(r))).length;
  const text = householdRuleFileText(set, HOUSEHOLD_DESCRIPTION);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied('Regelfil kopiert.'); } catch { setCopied('Kopiering ble blokkert; merk teksten og kopier selv.'); } };

  return (
    <>
      <h2>Kontroll av husholdningstreff</h2>
      <p className="fine">For redaktør. Godkjenn bare når overskriften entydig er varen. Avvis det som ikke er en husholdningsvare vi følger.
        Varer som kan avsløre helse eller barns alder (bleier, medisin, barneprodukter) er utelukket i regelfilen og vises aldri. Tilbudene vises live og
        lagres ikke; utkastet lagrer bare mønstre på denne enheten.</p>
      {(!feed || feed.status === 'loading') && <p className="card">Henter tilbud …</p>}
      {feed && feed.status !== 'ok' && feed.status !== 'loading' && <div className="banner warn">Tilbud fra Tjek er ikke tilgjengelige akkurat nå.</div>}
      <div className="chips tabs" role="group" aria-label="Filtrer husholdningstreff">
        {(['kontroll', 'godkjent', 'alle'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'chip on' : 'chip'} aria-pressed={filter === f} onClick={() => { setFilter(f); setVisible(PAGE); }}>
            {f === 'kontroll' ? 'Trenger kontroll' : f === 'godkjent' ? 'Godkjent' : 'Alle'}</button>
        ))}
      </div>
      <ul className="review">
        {shown.slice(0, visible).map(({ o, m }) => <Row key={householdOfferKey(o)} o={o} item={m?.item ?? null} status={m ? m.status : 'avvist'}
          why={m ? `${m.name}${m.rule ? ` · regel «${m.rule}»` : ''}${m.reasons.length ? ` · ${reasonText(m.reasons)}` : ''}` : 'Ingen kobling (avvist eller utelukket)'}
          onRule={(r) => setDraft((d) => upsertHouseholdRule(d, r))} />)}
      </ul>
      {feed?.status === 'ok' && <p className="fine" role="status">Viser {Math.min(visible, shown.length)} av {shown.length} treff.</p>}
      {shown.length > visible && <button className="ghost wide" onClick={() => setVisible((v) => v + PAGE)}>Vis flere ({shown.length - visible} igjen)</button>}
      <h3>Regelutkast</h3>
      <p className="fine">{draft.length} regler · {added} nye · {removed} fjernet i forhold til regelfilen.</p>
      <ul className="list">
        {sortHouseholdRules(draft).map((r) => (
          <li key={householdRuleKey(r)}>
            <span className="main"><b>«{r.pattern}»</b><small>{r.decision === 'godkjent' ? `godkjent som ${itemName(r.item)}` : r.decision === 'tillatt' ? `unntak fra utelukkelseslisten, forslag til ${itemName(r.item)}` : `avvist for ${itemName(r.item)}`}</small></span>
            <button className="x" aria-label={`Fjern husholdningsregel ${r.pattern}`} onClick={() => setDraft((d) => d.filter((x) => householdRuleKey(x) !== householdRuleKey(r)))}>✕</button>
          </li>
        ))}
      </ul>
      <details className="steps" open={added + removed > 0}>
        <summary>Eksporter regler</summary>
        <p className="fine">Kopier hele filen inn i <code>src/data/household-rules.json</code> og send endringen til gjennomgang.</p>
        <label className="lab" htmlFor="hfile" style={{ display: 'block' }}>Hel regelfil for husholdning</label>
        <textarea id="hfile" className="field" readOnly rows={8} value={text} />
        <button className="ghost" onClick={copy}>Kopier regelfil</button>
        <p className="fine" role="status">{copied}</p>
        <button className="ghost" disabled={added + removed === 0} onClick={() => setDraft(() => HOUSEHOLD_RULES.rules)}>Forkast utkastet</button>
      </details>
    </>
  );
}

function Row({ o, item, status, why, onRule }: { o: NormalizedOffer; item: string | null; status: 'godkjent' | 'kontroll' | 'avvist'; why: string; onRule: (r: HouseholdRule) => void }) {
  const [pattern, setPattern] = useState(() => suggestPattern(o.heading));
  const [pick, setPick] = useState(item ?? items[0].id);
  const valid = pattern.trim().length >= 2;
  return (
    <li className="card review-row">
      <div className="drow"><b>{o.heading}</b><span className={`pill ${status === 'godkjent' ? 'down' : status === 'avvist' ? 'warnp' : ''}`}>{status === 'godkjent' ? 'Godkjent' : status === 'avvist' ? 'Avvist' : 'Trenger kontroll'}</span></div>
      <small className="fine">{o.dealerName} · {o.priceOre !== null ? kr(o.priceOre) : 'pris ukjent'} · {validityText(o)}</small>
      <small className="fine">{why}</small>
      <div className="row-field">
        <input aria-label={`Mønster for ${o.heading}`} style={{ flex: 1, width: 'auto' }} value={pattern} onChange={(e) => setPattern(e.target.value)} />
        <select aria-label={`Vare for ${o.heading}`} className="field" style={{ width: 'auto' }} value={pick} onChange={(e) => setPick(e.target.value)}>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.group})</option>)}
        </select>
      </div>
      <div className="row-field">
        <button className="ghost sm" disabled={!valid} onClick={() => onRule({ pattern, decision: 'godkjent', item: pick })}>✓ Godkjenn som {itemName(pick).toLowerCase()}</button>
        <button className="ghost sm" disabled={!valid} onClick={() => onRule({ pattern, decision: 'avvist', item: pick })}>✕ Ikke {itemName(pick).toLowerCase()}</button>
        <button className="ghost sm" disabled={!valid} onClick={() => onRule({ pattern, decision: 'avvist' })}>✕ Avvis helt</button>
      </div>
    </li>
  );
}
