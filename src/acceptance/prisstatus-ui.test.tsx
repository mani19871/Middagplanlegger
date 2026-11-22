// «Alle varer har synlig prisstatus» i brukergrensesnittet (fase 1), og «prisstatus skal kunne leses som tekst».
// Komponentene server-rendres til HTML (ingen nettleser), så testen ser nøyaktig den teksten en skjermleser får.
// Detaljvisningen («Hvorfor …?») åpnes bare ved klikk; den prøves i nettleserkjøringen beskrevet i docs/fase1-status.md.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { alternatives, generatePlan, type Ctx } from '../engine/planner';
import { totalWithOffers } from '../engine/offerTotal';
import type { Basket } from '../engine/types';
import { initialState, type AppState } from '../store';
import ListView from '../views/ListView';
import WeekView from '../views/WeekView';
import { ctx, fullWeek, settings, SHOP_DAY, slot } from './util';

const html = (C: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(C as ComponentType<Record<string, unknown>>, props));
const noop = () => {};
const text = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&quot;|&amp;/g, ' ').replace(/\s+/g, ' ');

function setup(over: Parameters<typeof settings>[0], slots = generatePlan(ctx(over)), store: 'demoA' | 'demoB' = 'demoA') {
  const s = settings({ ...over, regularStoreId: store, storeIds: [store] });
  const c: Ctx = { catalog, settings: s, offers: [], shopDate: SHOP_DAY };
  const alts = alternatives(slots, c);
  const basket: Basket = alts.regular;
  const state: AppState = { ...initialState, settings: s, slots, approved: true };
  const offerTotal = totalWithOffers(basket, [], SHOP_DAY, s);
  return { state, basket, alts, c, offerTotal, slots };
}

describe('handlelisten viser prisstatus som tekst for hver linje', () => {
  const week = '2026-11-23';
  const render = (x: ReturnType<typeof setup>) =>
    html(ListView, { state: x.state, update: noop, record: noop, week, basket: x.basket, offerTotal: x.offerTotal, approvedHints: 0 });

  it('ordinær, estimert og ukjent pris står i teksten på hver linje (butikk B har estimat, linser mangler pris)', () => {
    const x = setup({}, [slot(0, 'linsegryte'), slot(1, 'pastaspinat'), slot(2, 'bolognese')], 'demoB');
    expect(x.basket.lines.some((l) => l.status === 'ukjent')).toBe(true);
    expect(x.basket.lines.some((l) => l.status === 'estimat')).toBe(true);
    const out = render(x);
    const items = [...out.matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
    expect(items.length).toBe(x.basket.lines.length);
    for (const li of items) expect(li, li).toMatch(/ordinær pris|estimert pris|tilbud|ukjent pris/i);
    expect(out).toContain('ukjent pris');
    expect(out).toMatch(/estimert pris/i);
    expect(out).toMatch(/mangler pris/); // advarsel om delsum
  });
  it('tilbudslinjer (katalogens laks i butikk A) merkes «tilbud», ikke «ordinær»', () => {
    const x = setup({}, [slot(0, 'lakseris')]);
    const li = [...render(x).matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => text(m[0])).find((t) => /Laksefilet/.test(t))!;
    expect(li).toMatch(/tilbud/i);
    expect(li).not.toMatch(/ordinær/i);
  });
  it('for hvert aktivt filter og hver butikk har alle linjer en statusetikett', () => {
    for (const over of [{}, { vegetarian: true }, { avoid: ['gluten' as const] }, { avoid: ['egg' as const, 'melk' as const] }, { days: fullWeek() }]) {
      for (const store of ['demoA', 'demoB'] as const) {
        const x = setup(over, undefined, store);
        const items = [...render(x).matchAll(/<li[\s\S]*?<\/li>/g)].map((m) => text(m[0]));
        for (const li of items) expect(li, `${JSON.stringify(over)} ${store}: ${li}`).toMatch(/ordinær pris|estimert pris|tilbud|ukjent pris/i);
      }
    }
  });
  it('summen kalles «anslått», og ingen tekst lover sluttpris', () => {
    const out = text(render(setup({})));
    expect(out).toMatch(/Anslått handel/);
    expect(out).not.toMatch(/sluttpris|garantert|billigste butikk/i);
  });
});

describe('ukeplanen viser budsjettsvar og antall estimerte og ukjente linjer som tekst', () => {
  const render = (x: ReturnType<typeof setup>, mode: 'home' | 'plan' = 'plan') =>
    text(html(WeekView, {
      state: x.state, update: noop, ctx: x.c, alts: x.alts, basket: x.basket, activeStores: [x.state.settings.regularStoreId],
      regenerate: noop, openList: noop, offerTotal: x.offerTotal, approvedHints: 0, mode, setMode: noop,
    }));
  it('komplett kurv: «Anslått innenfor/over budsjett» og tall for estimert og ukjent', () => {
    const out = render(setup({}));
    expect(out).toMatch(/Anslått (innenfor|\d[\d\s  ]* kr over) budsjett/);
    expect(out).toMatch(/\d+ estimert · \d+ ukjent pris/);
  });
  it('ufullstendig kurv: «Ufullstendig prisgrunnlag», varene som mangler, og at kurven ikke kan bekreftes innenfor budsjett', () => {
    const out = render(setup({}, [slot(0, 'linsegryte'), slot(1, 'bolognese')]));
    expect(out).toMatch(/Ufullstendig prisgrunnlag/);
    expect(out).toMatch(/Mangler pris: .*røde linser/i);
    expect(out).toMatch(/kan ikke bekreftes innenfor budsjett/);
    expect(out).not.toMatch(/Anslått innenfor budsjett/);
  });
  it('hjem-visningen har samme prisoppsummering', () => {
    expect(render(setup({}), 'home')).toMatch(/Anslått handel/);
    expect(render(setup({}, [slot(0, 'linsegryte')]), 'home')).toMatch(/Ufullstendig prisgrunnlag/);
  });
});
