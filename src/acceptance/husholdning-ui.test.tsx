// Husholdningsvarer (utvidelse C) i brukergrensesnittet, server-rendret (ingen nettleser): teksten en skjermleser får.
import { createElement, type ComponentType } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { HOUSEHOLD_RULES } from '../data/household';
import { buildBasket, generatePlan } from '../engine/planner';
import { classifyHousehold } from '../engine/household';
import { totalWithOffers } from '../engine/offerTotal';
import { FOOD_TERMS } from '../offers/household';
import type { NormalizedOffer } from '../offers/types';
import { initialState, type AppState } from '../store';
import type { ListEvent } from '../sync/list';
import HouseholdCatch from '../views/household/HouseholdCatch';
import ListView from '../views/ListView';
import PrivacySheet from '../views/PrivacySheet';

const html = (C: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(C as ComponentType<Record<string, unknown>>, props));
const text = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&quot;|&amp;/g, ' ').replace(/\s+/g, ' ');
const noop = () => {};
const W = '2026-11-23';
const SHOP = '2026-11-25';
const offer = (id: string, heading: string, over: Partial<NormalizedOffer> = {}): NormalizedOffer => ({
  id, source: 'tjek', heading, description: null, priceOre: 8990, prePriceOre: null, amount: null, unit: null, pieces: null,
  dealerId: 'd', dealerName: 'Kiwi', validFrom: '2026-11-23', validUntil: '2026-11-29', observed: '2026-11-23T08:00:00.000Z', ...over,
});
const offers = [offer('a', 'Lambi Toalettpapir 8 rull'), offer('b', 'Libero bleier str 4'), offer('c', 'Zalo Oppvaskmiddel', { dealerName: 'REMA 1000', priceOre: 2990 })];
const feed = { status: 'ok' as const, offers, observed: '2026-11-23T08:00:05.000Z' };
const withChains = (extra: Partial<AppState> = {}): AppState => ({ ...initialState, settings: { ...defaultSettings, offerChains: ['KIWI'] }, ...extra });
const add = (i: number, id: string, name: string, note = 'tilbud hos Kiwi'): ListEvent => ({ type: 'manuell', id: `m${i}`, at: `2026-11-23T10:00:0${i}.000Z`, by: 'enhet-test', line: { id, text: name, note } });
const matches = offers.flatMap((o) => classifyHousehold(o, HOUSEHOLD_RULES, FOOD_TERMS) ?? []);

describe('Tilbudsfangst (Kundeaviser → Husholdning)', () => {
  it('uten valgt kjede: ingen tilbud, og appen ber om å velge kjede', () => {
    const t = text(html(HouseholdCatch, { state: initialState, update: noop, feed, shopDate: SHOP }));
    expect(t).toContain('Ingen kjede valgt');
    expect(t).not.toContain('Toalettpapir 8 rull');
  });
  it('med valgt kjede: bare den kjeden, «trenger kontroll», anslått pris, gyldighet og kilde; aldri sensitive varer', () => {
    const h = html(HouseholdCatch, { state: withChains(), update: noop, feed, shopDate: SHOP });
    const t = text(h);
    expect(t).toContain('Lambi Toalettpapir 8 rull');
    expect(t).not.toContain('Zalo'); // Rema er ikke valgt
    expect(t).not.toMatch(/bleier/i);
    expect(t).toContain('Trenger kontroll');
    expect(t).toMatch(/90 kr, anslått/);
    expect(t).toContain('Gyldig 23.11.–29.11.');
    expect(t).toContain('Kilde: Tjek, pris sett 23.11.2026');
    expect(t).toContain('aldri er med i middagssummen');
    expect(h).toContain('aria-label="Legg Toalettpapir fra Kiwi på handlelista"');
    expect(h.match(/type="checkbox"/g)).toHaveLength(HOUSEHOLD_RULES.groups.length);
    expect(t).toContain('Varegrupper dere følger');
  });
  it('vare som allerede ligger på lista: «På lista», og basisvare fremheves nøkternt', () => {
    const settings = { ...defaultSettings, offerChains: ['KIWI'], staples: [{ id: 'egen:toalettpapir', name: 'Toalettpapir' }] };
    const listed = html(HouseholdCatch, { state: withChains({ list: [add(1, 'hus:tjek:a#0', 'Toalettpapir')], settings }), update: noop, feed, shopDate: SHOP });
    expect(listed).toContain('✓ På lista');
    expect(text(listed)).not.toContain('Står på basisvarene deres'); // «På lista» sier nok
    expect(text(html(HouseholdCatch, { state: withChains({ settings }), update: noop, feed, shopDate: SHOP }))).toContain('Står på basisvarene deres');
    // Lagt på lista før og fjernet: nøktern merknad, ingen oppfordring.
    const before = withChains({ list: [add(1, 'hus:tjek:a#0', 'Toalettpapir'), { type: 'manuell-fjern', id: 'r1', at: '2026-11-23T11:00:00.000Z', by: 'enhet-test', lineId: 'hus:tjek:a#0' }] });
    expect(text(html(HouseholdCatch, { state: before, update: noop, feed, shopDate: SHOP }))).toContain('Dere har hatt den på lista før');
  });
  it('aldri reklame eller kjøpspress i tekstene (kildeskanning)', () => {
    for (const f of ['src/views/household/HouseholdCatch.tsx', 'src/views/household/householdText.ts', 'src/views/ListView.tsx']) {
      const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/kjøp (ekstra|mer|flere)|ikke gå glipp|hamstr|lurt å kjøpe|bør kjøpe|fyll opp|kupp|sluttpris/i);
    }
  });
});

describe('Handleliste: «Andre varer»', () => {
  const slots = generatePlan({ catalog, settings: defaultSettings });
  const ctx = { catalog, settings: { ...defaultSettings, offerChains: ['KIWI'] } };
  const basket = buildBasket(slots, ['demoA'], ctx);
  const list = (s: AppState, m = matches) => html(ListView, {
    state: s, update: noop, record: noop, week: W, basket, offerTotal: totalWithOffers(basket, [], W, s.settings), approvedHints: 0, syncText: '', houseMatches: m,
  });
  const lines = [add(1, 'hus:tjek:a#0', 'Toalettpapir'), add(2, 'hus:tjek:borte#0', 'Batterier')];
  it('egen gruppe med egen sum; varer uten gyldig tilbud uten pris; «Anslått handel» er uendret', () => {
    const base = { ...withChains({ slots }), settings: { ...defaultSettings, offerChains: ['KIWI'] } };
    const without = text(list(base));
    const withH = text(list({ ...base, list: lines }));
    expect(withH).toContain('Andre varer');
    expect(withH).toContain('Toalettpapir tilbud hos Kiwi · 90 kr, anslått tilbudspris');
    expect(withH).toContain('Batterier tilbud hos Kiwi · tilbudet vises ikke nå, ingen pris');
    expect(withH).toContain('Andre varer, anslått (delsum: 1 av 2 med pris) 90 kr');
    expect(withH).toContain('ikke med i «Anslått handel», butikksammenligningen eller budsjettet');
    expect(withH).not.toContain('Fra kundeaviser');
    const total = (t: string) => t.match(/Anslått handel ([\d\s]+ kr)/)?.[1];
    expect(total(withH)).toBe(total(without));
    expect(without).not.toContain('Andre varer');
  });
  it('på handledagen etter tilbudets slutt: ingen pris; uten tilbud fra serveren: ingen pris, også uten ukeplan', () => {
    const s = { ...withChains(), list: lines };
    const t = text(list(s, []));
    expect(t).toContain('Lag en ukeplan først');
    expect(t).toContain('Andre varer, anslått (delsum: 0 av 2 med pris) 0 kr');
  });
  it('personvernarket nevner «Andre varer» og at Tjek-pris og tilbudstekst ikke lagres i husstandens data', () => {
    const t = text(html(PrivacySheet, { state: initialState, onClose: noop }));
    expect(t).toMatch(/Husholdningsvarer \(«Andre varer»\)/);
    expect(t).toContain('lagres ikke i husstandens data');
  });
});
