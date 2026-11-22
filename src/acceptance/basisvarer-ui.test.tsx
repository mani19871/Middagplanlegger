// Basisvarer i brukergrensesnittet, server-rendret (ingen nettleser): teksten en skjermleser får.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import type { InventoryEvent } from '../engine/inventory';
import type { Ctx } from '../engine/planner';
import type { Settings } from '../engine/types';
import { stapleLineId } from '../engine/staples';
import { initialState, type AppState } from '../store';
import type { ListEvent } from '../sync/list';
import StaplesView from '../views/StaplesView';
import ListView from '../views/ListView';
import CookNowView from '../views/CookNowView';
import PrivacySheet from '../views/PrivacySheet';
import { totalWithOffers } from '../engine/offerTotal';

const html = (C: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(C as ComponentType<Record<string, unknown>>, props));
const text = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&quot;|&amp;/g, ' ').replace(/\s+/g, ' ');
const noop = () => {};
const W = '2026-11-23';
const ev = (i: number, e: Record<string, unknown>) => ({ id: `e${i}`, at: `2026-11-20T10:00:0${i}.000Z`, by: 'enhet-test', ...e }) as unknown as InventoryEvent;
const staples: Settings['staples'] = [{ id: 'kaffe' }, { id: 'ris', min: 500 }, { id: 'egen:kaffe-filter', name: 'Kaffe filter' }];
const inventory = [ev(1, { type: 'telling', ingredient: 'ris', amount: 200 }), ev(2, { type: 'nivå', staple: 'kaffe', level: 'tom' })];
const state = (extra: Partial<AppState> = {}): AppState => ({ ...initialState, settings: { ...defaultSettings, staples }, inventory, ...extra });
const basket = { storeIds: [], lines: [], totalOre: 0, unknownCount: 0, estimatedCount: 0, complete: true, stops: 0 };
const list = (s: AppState) => text(html(ListView, { state: s, update: noop, record: noop, week: W, basket, offerTotal: totalWithOffers(basket, [], W, s.settings), approvedHints: 0, syncText: '' }));

describe('Basisvarer (visning)', () => {
  it('uten basisvarer: tom tilstand, ærlig om hva lista er og om deling', () => {
    const h = html(StaplesView, { state: initialState, update: noop, record: noop, week: W });
    const t = text(h);
    expect(t).toContain('Ingen basisvarer ennå');
    expect(t).toContain('ikke med i beregnet sum');
    expect(t).toContain('deles med de andre voksne');
    expect(t).toContain('uten priser');
    expect(t).toMatch(/ikke navn på personer/);
    expect(h).toContain(`maxLength="30"`);
  });
  it('med basisvarer: tilstand som tekst, nivåknapper med aria-pressed og navn, minstemengde med etikett', () => {
    const h = html(StaplesView, { state: state(), update: noop, record: noop, week: W });
    const t = text(h);
    expect(t).toContain('Kaffe filter');
    expect(t).toContain('Under grensen: 200 g hjemme, minst 500 g');
    expect(t).toMatch(/Kaffe ✕ Tom Har Snart tom Tom/);
    expect(h).toMatch(/aria-pressed="true" aria-label="Kaffe: tom"/);
    expect(h).toContain('aria-label="Fjern basisvare Ris"');
    expect(t).toContain('Minstemengde for Ris i g');
    expect(t).not.toContain('Minstemengde for Kaffe');
    expect(t).toContain('2 forslag venter i handlelista: Kaffe, Ris');
  });
  it('handlelista viser forslag med godkjenn/avvis, også uten ukeplan, og godkjente linjer i egen gruppe uten sum', () => {
    const t = list(state());
    expect(t).toContain('Forslag: basisvarer');
    expect(t).toContain('Basisvare: tom · ingen pris, ikke med i beregnet sum');
    expect(t).toContain('Legg på lista');
    expect(t).toContain('Ikke nå');
    const approved: ListEvent = { type: 'manuell', id: 'g1', at: '2026-11-20T11:00:00.000Z', by: 'enhet-test', line: { id: stapleLineId(W, 'kaffe'), text: 'Kaffe', note: 'Basisvare: tom' } };
    const rejected: ListEvent = { type: 'manuell-fjern', id: 'a1', at: '2026-11-20T11:00:01.000Z', by: 'enhet-test', lineId: stapleLineId(W, 'ris') };
    const t2 = list(state({ list: [approved, rejected] }));
    expect(t2).not.toContain('Forslag: basisvarer');
    expect(t2).toContain('Basisvarer (ikke kontrollert)');
    expect(t2).toContain('Basisvare: tom · ikke med i beregnet sum');
    expect(t2).not.toContain('Fra kundeaviser');
  });
  it('«Lag nå» viser basisvarer som informasjon, og forslagene er de samme med og uten basisvarer', () => {
    const ctx = (s: AppState): Ctx => ({ catalog, settings: s.settings, offers: [], shopDate: W });
    const inv = [...inventory, ev(3, { type: 'telling', ingredient: 'egg', amount: 8 }), ev(4, { type: 'telling', ingredient: 'ost', amount: 200 })];
    const withS = state({ inventory: inv });
    const without: AppState = { ...withS, settings: { ...withS.settings, staples: undefined } };
    const a = text(html(CookNowView, { state: withS, update: noop, ctx: ctx(withS) }));
    const b = text(html(CookNowView, { state: without, update: noop, ctx: ctx(without) }));
    expect(a).toContain('Basisvarer');
    expect(a).toContain('Kaffe filter Finnes');
    const forslag = (t: string) => t.slice(t.indexOf('Forslag'));
    expect(forslag(a)).toBe(forslag(b));
  });
  it('personvernarket sier at basisvarer og markeringer deles med husstanden, og at egne varenavn er fritekst', () => {
    const t = text(html(PrivacySheet, { state: initialState, onClose: noop }));
    expect(t).toMatch(/Delt med husstanden.*Basisvarer: hvilke varer dere alltid vil ha hjemme/);
    expect(t).toContain('egne basisvarer er fritekst');
  });
});
