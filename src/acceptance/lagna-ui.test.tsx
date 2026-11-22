// «Lag nå» i brukergrensesnittet, server-rendret (ingen nettleser): teksten en skjermleser får.
// Ligger i src/acceptance/ (ikke src/views/), så regel-skanningen i regler.test.ts bare ser produksjonskoden.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import type { InventoryEvent } from '../engine/inventory';
import type { Ctx } from '../engine/planner';
import type { Settings } from '../engine/types';
import { initialState, type AppState } from '../store';
import CookNowView from '../views/CookNowView';
import ListView from '../views/ListView';
import { totalWithOffers } from '../engine/offerTotal';

const html = (C: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(C as ComponentType<Record<string, unknown>>, props));
const text = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&quot;|&amp;/g, ' ').replace(/\s+/g, ' ');
const noop = () => {};
const count = (ingredient: string, amount: number, i: number): InventoryEvent =>
  ({ type: 'telling', id: `t${i}`, at: `2026-11-20T10:00:0${i}.000Z`, by: 'enhet-test', ingredient, amount });

function render(over: Partial<Settings> = {}, inventory: InventoryEvent[] = [], extra: Partial<AppState> = {}) {
  const settings = { ...defaultSettings, ...over };
  const state: AppState = { ...initialState, settings, inventory, ...extra };
  const ctx: Ctx = { catalog, settings, offers: [], shopDate: '2026-11-23' };
  return text(html(CookNowView, { state, update: noop, ctx }));
}

describe('Lag nå (visning)', () => {
  it('uten varer: tydelig tom tilstand og ærlig om den lille oppskriftsbasen', () => {
    const t = render();
    expect(t).toContain('Ingen varer er krysset av');
    expect(t).toContain(`Oppskriftsbasen er liten: ${catalog.recipes.length} enkle demooppskrifter`);
    expect(t).toContain('lagres på denne enheten');
  });

  it('med bekreftet beholdning: forslag med tid, porsjoner, hva som finnes og mangler, anslått pris og knapp til handlelista', () => {
    const t = render({}, [count('kjottdeig', 400, 1), count('pasta', 500, 2), count('tomat', 800, 3)]);
    expect(t).toContain('Spagetti bolognese');
    expect(t).toMatch(/\d+ min · [\d,]+ porsjoner · \d+ % av varene finnes/);
    expect(t).toContain('Finnes');
    expect(t).toContain('Mangler');
    expect(t).toContain('Anslått');
    expect(t).toContain('Demopriser, ikke en garanti for sluttpris');
    expect(t).toContain('Legg manglende på handlelista');
    expect(t).toContain('Inneholder: gluten'); // allergentekst på hver rett
    // Samme regel som regler.test.ts, men på teksten brukeren faktisk ser: løfteord står bare i benektende setninger.
    const promises = t.split(/(?<=[.!?])\s+/).filter((x) => /garant|allergenfri|fri for allergener|sluttpris|billigst/i.test(x));
    expect(promises.length).toBeGreaterThan(0);
    for (const x of promises) expect(x).toMatch(/\b(ikke|aldri|uten)\b/i);
  });

  it('allergi vinner: retter med allergenet vises aldri, og antallet skjulte står i teksten', () => {
    const t = render({ avoid: ['gluten'] }, [count('kjottdeig', 400, 1), count('pasta', 500, 2)]);
    expect(t).not.toContain('Spagetti bolognese');
    expect(t).toMatch(/\d+ retter er skjult av allergi- eller kostfilteret/);
  });

  it('en manglende vare uten godkjent produkt gir «Ufullstendig prisgrunnlag»', () => {
    // Linsegryte: linser har ingen pris i demobutikk A.
    const t = render({ regularStoreId: 'demoA' }, [count('tomat', 400, 1), count('gulrot', 300, 2), count('ris', 200, 3), count('lok', 1, 4)]);
    expect(t).toContain('Linsegryte');
    expect(t).toContain('Ufullstendig prisgrunnlag');
  });

  it('egne valg her: fjernet vare og «må brukes snart» gjelder bare visningen', () => {
    const inv = [count('egg', 8, 1), count('ost', 100, 2)];
    const t = render({}, inv, { cookNow: { added: { paprika: null }, removed: [], soon: ['egg'] } });
    expect(t).toContain('Omelett med grønnsaker');
    expect(t).toContain('⏰ Bruker Egg');
    expect(t).toContain('mengde ikke oppgitt');
  });

  it('handlelista viser linjer fra «Lag nå» i egen gruppe, også uten ukeplan', () => {
    const state: AppState = {
      ...initialState,
      list: [{ type: 'manuell', id: 'e1', at: '2026-11-22T10:00:00.000Z', by: 'enhet-test', line: { id: 'lagnå:bolognese|lok:e1', text: 'Løk: 1 stk', note: 'til Spagetti bolognese' } }],
    };
    const basket = { storeIds: [], lines: [], totalOre: 0, unknownCount: 0, estimatedCount: 0, complete: true, stops: 0 };
    const t = text(html(ListView, { state, update: noop, record: noop, week: '2026-11-23', basket, offerTotal: totalWithOffers(basket, [], '2026-11-23', state.settings), approvedHints: 0, syncText: '' }));
    expect(t).toContain('Lag en ukeplan først');
    expect(t).toContain('Fra «Lag nå» (ikke kontrollert)');
    expect(t).toContain('Løk: 1 stk');
    expect(t).toContain('ikke med i beregnet sum');
    expect(t).not.toContain('Fra kundeaviser');
  });
});
