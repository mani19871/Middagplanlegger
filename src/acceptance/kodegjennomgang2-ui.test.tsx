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
import HouseholdView from '../views/HouseholdView';
import { parseStapleMin, STAPLE_INFO } from '../views/StaplesView';
import { COOK_QTY_ADD_INVALID, cookQtyChangeInvalid, parseCookQty } from '../views/CookNowView';
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
  it('V17 «Lag nå»: ugyldig mengde forkastes ikke stille, men gir melding (0,4 blir ikke 0)', () => {
    // Før rettingen: setAmount/addItem returnerte uten melding, og 0,4 ble lagt til som 0 (mergeHave overså det, så feltet
    // viste 0 mens forslagene brukte matskapets mengde). Meldingen vises i et status-område (sjekket i npm run check:a11y).
    expect(parseCookQty('')).toBeNull();
    expect(parseCookQty('  ')).toBeNull();
    expect(parseCookQty('8')).toBe(8);
    expect(parseCookQty('2,6')).toBe(3);
    for (const bad of ['-3', '0', '0,4', 'abc', 'Infinity']) expect(parseCookQty(bad), bad).toBe('ugyldig');
    expect(parseCookQty('', true)).toBe('ugyldig'); // tekst nettleseren ikke kunne lese som tall (validity.badInput)
    expect(COOK_QTY_ADD_INVALID).toMatch(/^Mengden er ikke lagt til: .*over 0/);
    expect(cookQtyChangeInvalid('Egg')).toMatch(/^Mengden for Egg er ikke endret/);
  });

  it('V10 Husstand forklarer også konflikter i handlelista (som chipen «⚠ Konflikt» teller), med vei til handlelista', () => {
    // Før rettingen: chipen talte valg på linjer og godkjente lister, men Husstand-siden viste bare dokument- og kjøpskonflikter.
    const me = { id: 'enhet-a', label: 'A', role: 'eier' as const, createdAt: '', lastSeen: null, me: true };
    const s: AppState = { ...initialState, sync: { token: 't', me, cursor: 0, docs: {}, conflicts: {}, members: [me], rejected: 0, lastSync: null } };
    const view = (listConflicts?: { lines: number; approved: boolean }) => text(html(HouseholdView, {
      state: s, update: noop, runtime: { offline: false, busy: false, lastError: null, syncNow: noop }, status: 'konflikt', statusText: 'Konflikt',
      purchaseConflicts: 0, initialCode: '', openList: noop, listConflicts,
    }));
    expect(view({ lines: 2, approved: false })).toMatch(/To enheter har valgt ulikt for 2 varer i handlelista\..*Åpne handlelista/);
    expect(view({ lines: 1, approved: false })).toMatch(/for 1 vare i handlelista/);
    expect(view({ lines: 0, approved: true })).toMatch(/To voksne har godkjent ulike handlelister\..*Åpne handlelista/);
    expect(view({ lines: 0, approved: false })).not.toMatch(/handlelista\./);
    expect(view()).not.toMatch(/valgt ulikt|ulike handlelister/);
  });
});
