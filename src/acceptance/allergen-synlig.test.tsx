// Kostkrav og allergier synkes ikke (docs/synk.md, pilotavgrensning A). Avbøtende tiltak: alle retter i ukeplan,
// bytt-ark, kundeaviser og handleliste viser alltid allergentekst, uansett filter, så en voksen på en enhet uten
// filter kan se innholdet.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { alternatives, type Ctx } from '../engine/planner';
import { totalWithOffers } from '../engine/offerTotal';
import { hasDietFilter, initialState, type AppState } from '../store';
import ListView from '../views/ListView';
import WeekView from '../views/WeekView';
import { productAllergenText, recipeAllergenText } from '../views/allergenText';
import { settings, SHOP_DAY, slot } from './util';

const html = (C: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(C as ComponentType<Record<string, unknown>>, props));
const text = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&quot;|&amp;/g, ' ').replace(/\s+/g, ' ');
const noop = () => {};

describe('allergentekst er alltid synlig', () => {
  it('hver rett har tekst: «Inneholder: …» eller «Ingen av de 14 …», og alltid «Sjekk pakningen»', () => {
    for (const r of catalog.recipes) {
      const t = recipeAllergenText(r, catalog);
      expect(t, r.id).toMatch(r.allergens.length > 0 ? /^Inneholder: / : /^Ingen av de 14 allergenene er oppgitt/);
      expect(t, r.id).toMatch(/Sjekk pakningen\.$/);
      expect(t).not.toMatch(/allergenfri|garantert/i);
    }
    const bolognese = catalog.recipes.find((r) => r.id === 'bolognese')!;
    expect(recipeAllergenText(bolognese, catalog)).toMatch(/gluten/);
  });
  it('vare med uavklart innhold og vare uten produkt sier det', () => {
    expect(productAllergenText('kokos400', catalog)).toMatch(/ikke avklart/);
    expect(productAllergenText(null, catalog)).toMatch(/Innhold ukjent/);
    expect(productAllergenText('pasta500', catalog)).toBe('Inneholder: gluten');
  });
  it('ukeplan og handleliste viser allergentekst uten noe filter satt', () => {
    const s = settings({ regularStoreId: 'demoA', storeIds: ['demoA'] });
    expect(hasDietFilter(s)).toBe(false);
    const slots = [slot(0, 'bolognese'), slot(1, 'karri'), slot(2, 'taco')];
    const c: Ctx = { catalog, settings: s, offers: [], shopDate: SHOP_DAY };
    const alts = alternatives(slots, c);
    const state: AppState = { ...initialState, settings: s, slots, approved: true };
    const offerTotal = totalWithOffers(alts.regular, [], SHOP_DAY, s);
    const week = text(html(WeekView, { state, update: noop, ctx: c, alts, basket: alts.regular, activeStores: ['demoA'], regenerate: noop, openList: noop, offerTotal, approvedHints: 0, mode: 'plan', setMode: noop }));
    expect(week.match(/Inneholder: |Ingen av de 14 allergenene/g)?.length).toBeGreaterThanOrEqual(3);
    const list = html(ListView, { state, update: noop, record: noop, week: '2026-11-23', basket: alts.regular, offerTotal, approvedHints: 0, syncText: '' });
    const items = [...list.matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
    expect(items.length).toBeGreaterThan(3);
    for (const i of items) expect(i).toMatch(/Inneholder: |Ingen av de 14 allergenene|ikke avklart|Innhold ukjent/);
  });
  it('filterbanneret: et hvilket som helst absolutt krav teller som filter', () => {
    const s = settings({});
    expect(hasDietFilter({ ...s, vegetarian: true })).toBe(true);
    expect(hasDietFilter({ ...s, avoid: ['melk'] })).toBe(true);
    expect(hasDietFilter({ ...s, avoidFoods: ['svin'] })).toBe(true);
  });
});
