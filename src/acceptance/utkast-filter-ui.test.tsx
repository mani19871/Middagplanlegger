// KI-utkast og aktive krav i brukergrensesnittet (eierens beslutning 2026-11-22, spørsmål 45), server-rendret.
// Med allergi-, kost- eller råvarefilter skjules egne oppskrifter som ikke er testkokt, og appen sier det tydelig,
// uten å love allergenfrihet og uten å skjule at oppskriftene finnes.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import type { InventoryEvent } from '../engine/inventory';
import { alternatives, generatePlan, type Ctx } from '../engine/planner';
import { totalWithOffers } from '../engine/offerTotal';
import type { Settings, Slot } from '../engine/types';
import { initialState, type AppState } from '../store';
import CookNowView from '../views/CookNowView';
import WeekView from '../views/WeekView';

const html = (C: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(C as ComponentType<Record<string, unknown>>, props));
const text = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&quot;|&amp;/g, ' ').replace(/\s+/g, ' ');
const noop = () => {};
const SHOP = '2026-11-23';
const count = (ingredient: string, amount: number, i: number): InventoryEvent =>
  ({ type: 'telling', id: `t${i}`, at: `2026-11-20T10:00:0${i}.000Z`, by: 'enhet-test', ingredient, amount });
const NOTICE = /(\d+) oppskrifter? er skjult fordi de(n)? ikke er allergen-kontrollert av en person ennå/;
const promisesAreNegated = (t: string) => {
  for (const x of t.split(/(?<=[.!?])\s+/).filter((s) => /garant|allergenfri|fri for allergener/i.test(s))) expect(x).toMatch(/\b(ikke|aldri|uten)\b/i);
};

function cook(over: Partial<Settings>) {
  const settings = { ...defaultSettings, ...over };
  const inventory = [count('kjottdeig', 400, 1), count('bonner', 400, 2), count('tomat', 800, 3), count('ris', 1000, 4)];
  const state: AppState = { ...initialState, settings, inventory };
  const ctx: Ctx = { catalog, settings, offers: [], shopDate: SHOP };
  return text(html(CookNowView, { state, update: noop, ctx }));
}
function week(over: Partial<Settings>, slots?: Slot[]) {
  const settings = { ...defaultSettings, ...over };
  const ctx: Ctx = { catalog, settings, offers: [], shopDate: SHOP };
  const ss = slots ?? generatePlan(ctx);
  const alts = alternatives(ss, ctx);
  const state: AppState = { ...initialState, settings, slots: ss, approved: true };
  return text(html(WeekView, {
    state, update: noop, ctx, alts, basket: alts.regular, activeStores: [settings.regularStoreId], regenerate: noop, openList: noop,
    offerTotal: totalWithOffers(alts.regular, [], SHOP, settings), approvedHints: 0, mode: 'plan', setMode: noop,
  }));
}

describe('Lag nå: KI-utkast ved aktive krav', () => {
  it('uten filter: Chili con carne (KI-utkast) foreslås med utkast-merket, og ingen skjult-melding', () => {
    const t = cook({});
    expect(t).toContain('Chili con carne');
    expect(t).toContain('Husvett-oppskrift (utkast, ikke testkokt)');
    expect(t).not.toMatch(NOTICE);
  });
  it('med allergifilter: utkastet vises ikke, antallet skjulte står i teksten, uten løfte om allergenfrihet', () => {
    const t = cook({ avoid: ['sesam'] });
    expect(t).not.toContain('Chili con carne');
    expect(t.match(NOTICE)?.[1]).toBe('50');
    expect(t).toMatch(/vises igjen når de er testkokt og kontrollert/);
    promisesAreNegated(t);
  });
  it('med vegetarfilter: de vegetariske utkastene telles', () => {
    const n = catalog.recipes.filter((r) => r.vegetarian && r.origin?.kind === 'egen' && r.origin.status === 'utkast').length;
    expect(cook({ vegetarian: true }).match(NOTICE)?.[1]).toBe(String(n));
  });
});

describe('Ukeplan: KI-utkast ved aktive krav', () => {
  it('uten filter: ingen skjult-melding', () => {
    expect(week({})).not.toMatch(NOTICE);
  });
  it('med råvarefilter: melding om skjulte utkast i ukeplanen, uten løfte om allergenfrihet', () => {
    const t = week({ avoidFoods: ['svin'] });
    expect(t).toMatch(NOTICE);
    promisesAreNegated(t);
  });
  it('et utkast i planen under aktivt filter flagges med forklaring og kan ikke beholdes uten videre', () => {
    const t = week({ avoid: ['sesam'] }, [{ day: 0, recipeId: 'chili', locked: true }, { day: 1, recipeId: 'bolognese', locked: false }]);
    expect(t).toMatch(/Chili con carne bryter .*ikke allergen-kontrollert av en person/);
    expect(t).toContain('Lag ny uke uten disse');
    promisesAreNegated(t);
  });
});
