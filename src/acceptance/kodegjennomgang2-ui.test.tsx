// Kodegjennomgang runde 2 (docs/kodegjennomgang.md), visninger: V11–V17 (server-rendret, ingen nettleser). it.fails = åpent funn.
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { totalWithOffers } from '../engine/offerTotal';
import { cookNowLineId, cookNowLinePrefix } from '../engine/cookNow';
import type { Ctx } from '../engine/planner';
import { initialState, type AppState } from '../store';
import type { ListEvent } from '../sync/list';
import ListView from '../views/ListView';
import PapersView from '../views/PapersView';
import { parseStapleMin, STAPLE_INFO } from '../views/StaplesView';
import { isValidStaples } from '../engine/staples';

const html = (C: unknown, props: Record<string, unknown>) => renderToStaticMarkup(createElement(C as ComponentType<Record<string, unknown>>, props));
const text = (h: string) => h.replace(/<[^>]*>/g, ' ').replace(/&#x27;|&quot;|&amp;/g, ' ').replace(/\s+/g, ' ');
const noop = () => {};
const W = '2026-11-23';
const emptyBasket = { storeIds: [], lines: [], totalOre: 0, unknownCount: 0, estimatedCount: 0, complete: true, stops: 0 };
const list = (s: AppState, week = W) => html(ListView, {
  state: s, update: noop, record: noop, week, basket: emptyBasket, offerTotal: totalWithOffers(emptyBasket, [], week, s.settings), approvedHints: 0, syncText: '',
});
const manual = (evId: string, at: string, by: string, lineId: string, t: string, note: string): ListEvent =>
  ({ type: 'manuell', id: evId, at, by, line: { id: lineId, text: t, note } });

describe('kodegjennomgang runde 2: visninger', () => {
  it('V11 «Lag nå»: samme rett og vare lagt på lista fra to enheter gir én linje (én gang per rett og vare)', () => {
    // Før rettingen: linje-id = prefiks + enhetens egen hendelses-id (src/views/CookNowView.tsx), så to enheter som trykket
    // «Legg manglende på handlelista» før de hadde synket, fikk to linjer. Nå er id-en fast per rett og vare.
    const idA = cookNowLineId('bolognese', 'lok', []);
    const idB = cookNowLineId('bolognese', 'lok', []);
    expect(idA).toBe(idB);
    expect(idA.startsWith(cookNowLinePrefix('bolognese', 'lok'))).toBe(true);
    const s: AppState = {
      ...initialState,
      list: [
        manual('a1', '2026-11-22T10:00:00.000Z', 'enhet-a', idA, 'Løk: 1 stk', 'til Spagetti bolognese'),
        manual('b1', '2026-11-22T10:00:01.000Z', 'enhet-b', idB, 'Løk: 1 stk', 'til Spagetti bolognese'),
      ],
    };
    expect(text(list(s)).match(/Løk: 1 stk/g)).toHaveLength(1);
    // Etter fjerning kan den legges til på nytt med ny id.
    expect(cookNowLineId('bolognese', 'lok', [idA])).not.toBe(idA);
  });

  // ÅPENT (runde 2, V12, produktbeslutning): avkrysningen gjelder bare den aktive uka. Når det avgjøres, bytt it.fails.
  it.fails('V12 «Lag nå»-linje krysset av forrige uke står som ikke krysset av etter ukeskiftet (basisvarer beholder krysset)', () => {
    const p = cookNowLinePrefix('bolognese', 'lok');
    const lineId = `${p}a1`;
    const s: AppState = {
      ...initialState,
      list: [
        manual('a1', '2026-11-20T10:00:00.000Z', 'enhet-a', lineId, 'Løk: 1 stk', 'til Spagetti bolognese'),
        { type: 'kryss', id: 'k1', at: '2026-11-20T11:00:00.000Z', by: 'enhet-a', week: '2026-11-16', key: lineId },
      ],
    };
    // Uka linja ble handlet: krysset.
    expect(list(s, '2026-11-16')).toMatch(/<li class="done"><input type="checkbox" aria-label="Løk: 1 stk, avkrysset/);
    // Neste uke: linja ligger fortsatt på lista, men står som ikke handlet.
    expect(list(s, W)).toMatch(/<li class="done"><input type="checkbox" aria-label="Løk: 1 stk, avkrysset/);
  });

  it('V13 en «hus:»-linje som ikke kan tolkes (uten #n) vises under «Fra kundeaviser», så den kan fjernes', () => {
    // householdTotal hopper over linjer parseHouseholdLine ikke forstår, og «Fra kundeaviser» utelater alt med «hus:».
    const s: AppState = { ...initialState, list: [manual('h1', '2026-11-22T10:00:00.000Z', 'enhet-b', 'hus:tjek:abc', 'Toalettpapir', 'tilbud hos Kiwi')] };
    expect(text(list(s))).toContain('Toalettpapir');
  });

  it('V14 Kundeaviser: fanene øverst sier hvilken som er valgt (aria-pressed), som kontroll-fanene under', () => {
    const ctx: Ctx = { catalog, settings: defaultSettings, offers: [], shopDate: '2026-11-25' };
    const h = html(PapersView, { state: initialState, update: noop, ctx, goWeek: noop });
    expect(h).toMatch(/<button class="chip on" aria-pressed="true"[^>]*>Tilbud nå<\/button>/);
    expect(h).toMatch(/aria-pressed="false"[^>]*>Husholdning<\/button>/);
  });

  it('V17 basisvarer: en minstemengde som avrundes til 0 godtas ikke (innstillingene ville sluttet å synke)', () => {
    // Før rettingen: 0,4 > 0 ble godtatt og avrundet til 0; isValidStaples avviser min 0, så dokumentet var ugyldig.
    expect(isValidStaples([{ id: 'ris', min: 0 }], STAPLE_INFO)).toBe(false);
    expect(parseStapleMin('0,4')).toBeNull();
    expect(parseStapleMin('0,6')).toBe(1);
    expect(parseStapleMin('')).toBeUndefined();
    expect(parseStapleMin('100001')).toBeNull();
  });
});
