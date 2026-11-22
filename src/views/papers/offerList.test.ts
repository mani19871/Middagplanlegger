import { describe, expect, it } from 'vitest';
import type { LiveOffer } from '../../offers/service';
import { filterOffers, groupOffers, hasManualLine, manualLineId, pageGroups } from './offerList';

const mk = (id: string, heading: string, dealerId: string, dealerName: string, ingredient: string) =>
  ({ offer: { id, heading, dealerId, dealerName }, ingredient, phase: 'nå', needsReview: false }) as unknown as LiveOffer;
const L = [
  mk('3', 'Melk 1 l', 'b', 'Bunnpris', 'melk'), mk('1', 'Laks', 'a', 'Ærlig', 'laks'),
  mk('2', 'Helmelk', 'a', 'Ærlig', 'melk'), mk('4', 'Egg', 'c', 'Coop', 'egg'),
];
const name = (id: string) => ({ melk: 'Melk', laks: 'Laks', egg: 'Egg' } as Record<string, string>)[id] ?? id;

describe('filterOffers', () => {
  it('søker i overskrift, kjede og varenavn', () => {
    expect(filterOffers(L, 'coop', name)).toHaveLength(1);
    expect(filterOffers(L, 'MELK', name)).toHaveLength(2);
    expect(filterOffers(L, '  ', name)).toHaveLength(4);
  });
});
describe('groupOffers', () => {
  it('grupperer per kjede, sortert og stabilt uavhengig av inndatarekkefølge', () => {
    const a = groupOffers(L, 'kjede', name), b = groupOffers([...L].reverse(), 'kjede', name);
    expect(a).toEqual(b);
    expect(a.map((g) => g.label)).toEqual(['Bunnpris', 'Coop', 'Ærlig']);
    expect(a[2].items.map((i) => i.offer.id)).toEqual(['2', '1']);
  });
  it('grupperer per vare', () => {
    const g = groupOffers(L, 'vare', name);
    expect(g.map((x) => [x.label, x.items.length])).toEqual([['Egg', 1], ['Laks', 1], ['Melk', 2]]);
  });
});
describe('pageGroups', () => {
  const g = groupOffers(L, 'kjede', name);
  it('kutter midt i en gruppe og teller riktig', () => {
    const p = pageGroups(g, 2);
    expect(p.shown).toBe(2); expect(p.total).toBe(4);
    expect(p.groups.map((x) => x.items.length)).toEqual([1, 1]);
  });
  it('viser alt når grensen er større, og ingenting ved 0', () => {
    expect(pageGroups(g, 99).shown).toBe(4);
    expect(pageGroups(g, 0).groups).toEqual([]);
  });
});
describe('manuelle avislinjer', () => {
  it('to like tekster med ulike tilbud gir ulike id-er; samme tilbud gjenkjennes', () => {
    const a = manualLineId('t1', 'u1'), b = manualLineId('t2', 'u2');
    expect(a).not.toBe(b);
    expect(hasManualLine([{ id: a }], 't1')).toBe(true);
    expect(hasManualLine([{ id: a }], 't2')).toBe(false);
    expect(hasManualLine([{ id: a }], 't')).toBe(false);
  });
  it('id-en holder seg under 100 tegn', () => {
    expect(manualLineId('x'.repeat(200), 'u').length).toBeLessThanOrEqual(100);
  });
});

describe('kodegjennomgang: tilbud til ukeplan', () => {
  it('foreslår aldri retter som bryter allergi- eller kostkrav (regel 4)', async () => {
    const { catalog } = await import('../../data/catalog');
    const { defaultSettings } = await import('../../data/defaults');
    const { requirementViolation } = await import('../../engine/planner');
    const { offerRecipes } = await import('./offerList');
    const ctx = { catalog, settings: { ...defaultSettings, avoid: ['fisk' as const], vegetarian: true } };
    const all = catalog.recipes.filter((r) => r.lines.some((l) => l.ingredient === 'laks'));
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((r) => requirementViolation(r, ctx) !== null)).toBe(true);
    expect(offerRecipes('laks', ctx)).toEqual([]);
    expect(offerRecipes('pasta', ctx).every((r) => requirementViolation(r, ctx) === null)).toBe(true);
  });
});
