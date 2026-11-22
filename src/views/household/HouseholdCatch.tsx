// «Tilbudsfangst» (utvidelse C): husholdningstilbud fra Tjek i kjedene husstanden har valgt, gyldige på handledagen.
// Klassifiseringen er ren og deterministisk (engine/household.ts); alt som ikke er godkjent av en kuratert regel står under
// «Trenger kontroll». «Legg på lista» lager en vanlig manuell linje med bare varenavn og kjede; pris og gyldighet vises
// live fra tilbudene og lagres aldri i lista eller synkdata.
import { useMemo, useState } from 'react';
import { recordList, stamp, type AppState } from '../../store';
import {
  householdCatch, householdHighlight, householdLineId, householdOfferKey, parseHouseholdLine, type HouseholdMatch,
} from '../../engine/household';
import { HOUSEHOLD_RULES } from '../../data/household';
import { FOOD_TERMS } from '../../offers/household';
import type { NormalizedOffer } from '../../offers/types';
import { householdListFacts } from '../../sync/list';
import { stapleChoices } from '../../data/staples';
import { catchPriceText, HIGHLIGHT_TEXT, reasonText, seenText, validityText } from './householdText';

export interface HouseholdFeed { status: 'ok' | 'loading' | 'error' | 'av'; offers: NormalizedOffer[]; observed: string | null }
interface Props { state: AppState; update: (f: (s: AppState) => AppState) => void; feed: HouseholdFeed | null; shopDate: string }
const PAGE = 12;
/** Kort gruppenavn uten forklaringen i parentes («Papir (kjøkkenrull, toalettpapir)» → «Papir»). */
const groupName = (id: string) => (HOUSEHOLD_RULES.groups.find((g) => g.id === id)?.name ?? id).replace(/\s*\(.*\)$/, '');
const dayText = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

export default function HouseholdCatch({ state, update, feed, shopDate }: Props) {
  const [visible, setVisible] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState('');
  const settings = state.settings;
  const result = useMemo(() => householdCatch(feed?.offers ?? [], HOUSEHOLD_RULES, FOOD_TERMS, { shopDate, chains: settings.offerChains, groups: settings.householdGroups }),
    [feed, shopDate, settings.offerChains, settings.householdGroups]);
  const facts = useMemo(() => householdListFacts(state.list), [state.list]);
  const onList = new Set(facts.lines.map((l) => parseHouseholdLine(l.id)?.key));
  const staples = (settings.staples ?? []).map((s) => s.name ?? stapleChoices.find((c) => c.id === s.id)?.name ?? '').filter(Boolean);
  const chosen = new Set(settings.householdGroups ?? HOUSEHOLD_RULES.groups.map((g) => g.id));
  const toggleGroup = (id: string) => update((s) => {
    const cur = new Set(s.settings.householdGroups ?? HOUSEHOLD_RULES.groups.map((g) => g.id));
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    const next = HOUSEHOLD_RULES.groups.map((g) => g.id).filter((g) => cur.has(g));
    return { ...s, settings: { ...s.settings, householdGroups: next.length === HOUSEHOLD_RULES.groups.length ? undefined : next } };
  });
  // Samme tilbud lagt til to ganger, på to enheter eller mottatt to ganger gir én linje (linje-id per tilbud, regel 8).
  const add = (m: HouseholdMatch<NormalizedOffer>) => {
    const st = stamp();
    update((s) => {
      const f = householdListFacts(s.list);
      const key = householdOfferKey(m.offer);
      if (f.lines.some((l) => parseHouseholdLine(l.id)?.key === key)) return s;
      const id = householdLineId(key, f.removed);
      // Bare varenavn og kjede i den delte lista: Tjek-overskrift, pris og gyldighet lagres ikke (vises live).
      return id ? recordList(s, { type: 'manuell', ...st, line: { id, text: m.name.slice(0, 200), note: `tilbud hos ${m.offer.dealerName}`.slice(0, 200) } }) : s;
    });
    setMsg(`${m.name} (${m.offer.dealerName}) er lagt på handlelista under «Andre varer».`);
  };

  const tile = (m: HouseholdMatch<NormalizedOffer>, review: boolean) => {
    const key = householdOfferKey(m.offer);
    const hl = householdHighlight(m, HOUSEHOLD_RULES, { staples, history: facts.history });
    const listed = onList.has(key);
    // Søkeordtreff er forklart i overskriften for «Trenger kontroll»; her bare det som gjør treffet ekstra usikkert.
    const extra = review ? reasonText(m.reasons.filter((r) => r === 'tvetydig' || r === 'mat')) : '';
    return (
      <li key={key} className="housecard">
        <b>{m.offer.heading}</b>
        <small>{m.name}{review ? ` (${groupName(m.group)})` : ''} · {m.offer.dealerName}</small>
        <span className="price">{catchPriceText(m)}</span>
        <small>{validityText(m.offer)} · {seenText(m.offer.observed)}</small>
        {extra && <small className="warntext">Sjekk: {extra}</small>}
        {hl && !listed && <span className="pill">{HIGHLIGHT_TEXT[hl]}</span>}
        <button className="ghost sm" disabled={listed} aria-label={listed ? `${m.name} fra ${m.offer.dealerName} ligger på handlelista` : `Legg ${m.name} fra ${m.offer.dealerName} på handlelista`}
          onClick={() => add(m)}>{listed ? '✓ På lista' : '＋ Legg på lista'}</button>
      </li>
    );
  };
  const section = (id: string, title: string, items: HouseholdMatch<NormalizedOffer>[], review: boolean, intro?: string) => {
    if (items.length === 0) return null;
    const n = visible[id] ?? PAGE;
    return (
      <section key={id} className="offergroup" aria-labelledby={`hus-${id}`}>
        <h3 id={`hus-${id}`}>{title} <small className="fine">({items.length})</small></h3>
        {intro && <p className="fine">{intro}</p>}
        <ul className="housegrid">{items.slice(0, n).map((m) => tile(m, review))}</ul>
        {items.length > n && <button className="ghost wide" onClick={() => setVisible((v) => ({ ...v, [id]: n + PAGE }))}>Vis flere ({items.length - n} igjen)</button>}
      </section>
    );
  };
  const approvedGroups = HOUSEHOLD_RULES.groups.map((g) => ({ g, items: result.approved.filter((m) => m.group === g.id) })).filter((x) => x.items.length > 0);

  return (
    <>
      <p className="fine">Husholdningsvarer på tilbud hos Tjek i kjedene dere har valgt, gyldige på handledagen {dayText(shopDate)}. Prisen er tilbudets
        egen og bare anslått; den kan avvike i butikken. Varer du legger på lista får en egen sum, «Andre varer», som aldri er med i
        middagssummen, butikksammenligningen eller budsjettet. Tilbudet gjelder kjeden, ikke nødvendigvis ditt utsalg.</p>
      <fieldset className="housegroups">
        <legend>Varegrupper dere følger</legend>
        {HOUSEHOLD_RULES.groups.map((g) => (
          <label key={g.id} className="pill pick"><input type="checkbox" checked={chosen.has(g.id)} onChange={() => toggleGroup(g.id)} /> {g.name}</label>
        ))}
        <p className="fine">Valget deles med de andre voksne i husstanden. Gruppene er generelle; appen spør ikke om helse eller barn.</p>
      </fieldset>
      <p className="fine" role="status">{msg}</p>
      {result.blocked === 'kjede' && <div className="banner warn">Ingen kjede valgt: ingen tilbud vises. Velg kjedene dere handler hos under «Rediger uke» → «Flere valg».</div>}
      {!result.blocked && (!feed || feed.status === 'loading') && <p className="card">Henter tilbud …</p>}
      {!result.blocked && feed && (feed.status === 'error' || feed.status === 'av') && <div className="banner warn">Tilbud fra Tjek er ikke tilgjengelige akkurat nå. Varer på lista vises uten pris.</div>}
      {!result.blocked && feed?.status === 'ok' && (
        <p className="fine">Kilde: Tjek (ekte tilbud, ikke demodata). {result.approved.length + result.review.length} husholdningstilbud passer valgene.
          {result.approved.length + result.review.length === 0 ? ' Ingen tilbud i valgte grupper og kjeder på handledagen.' : ''}</p>
      )}
      {approvedGroups.map(({ g, items }) => section(g.id, g.name, items, false))}
      {section('kontroll', 'Trenger kontroll', result.review, true,
        'Kategorien er ikke godkjent av en redaktør ennå (søkeordtreff). Sjekk at det er varen du vil ha før du legger den på lista.')}
      <p className="fine">Ingen kjedelogoer og ingen bilder her. Lista får bare varenavn og kjede; prisen og gyldigheten vises fra tilbudene
        og lagres ikke i husstandens data.</p>
    </>
  );
}
