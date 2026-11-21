import { describe, expect, it } from 'vitest';
import { ingredients } from '../data/catalog';
import { matchOffer } from './match';
import { parseTjekOffer, TjekSource, type RawTjekOffer } from './tjek';

const raw = (over: Partial<RawTjekOffer> = {}): RawTjekOffer => ({
  id: 'o1', heading: 'Torskefilet', description: null,
  pricing: { price: 79.9, pre_price: 99.9, currency: 'NOK' },
  quantity: { unit: { symbol: 'g', si: { symbol: 'kg', factor: 0.001 } }, size: { from: 400, to: 400 }, pieces: { from: 1, to: 1 } },
  dealer_id: 'd1', dealer: { name: 'Butikk', country: { id: 'NO' } }, run_from: '2026-11-23T00:00:00+0100', run_till: '2026-11-29T23:59:59+0100', ...over,
});

describe('tilbud', () => {
  it('normaliserer kroner til øre og kg til g', () => {
    const o = parseTjekOffer(raw({ quantity: { unit: { symbol: 'kg', si: { symbol: 'kg', factor: 1 } }, size: { from: 1.5, to: null }, pieces: null } }), '2026-11-21');
    expect(o.priceOre).toBe(7990);
    expect(o.amount).toBe(1500);
    expect(o.unit).toBe('g');
  });
  it('kobler til ingrediens og regner pris per kg', () => {
    const m = matchOffer(parseTjekOffer(raw(), '2026-11-21'), ingredients, '2026-11-24')!;
    expect(m.ingredient).toBe('torsk');
    expect(m.unitPriceOre).toBe(19975);
    expect(m.needsReview).toBe(false);
  });
  it('utløpte og kommende tilbud gir ingen treff på handledagen', () => {
    const o = parseTjekOffer(raw(), '2026-11-21');
    expect(matchOffer(o, ingredients, '2026-11-30')).toBeNull();
    expect(matchOffer(o, ingredients, '2026-11-22')).toBeNull();
  });
  it('tilbud uten mengde eller pris går til kontroll', () => {
    const m = matchOffer(parseTjekOffer(raw({ quantity: null }), 'x'), ingredients, '2026-11-24')!;
    expect(m.unitPriceOre).toBeNull();
    expect(m.needsReview).toBe(true);
  });
  it('kilden filtrerer på land og feiler tydelig ved HTTP-feil', async () => {
    const ok = new TjekSource(async () => ({ ok: true, status: 200, json: async () => [raw(), raw({ id: 'o2', dealer: { name: 'SE', country: { id: 'SE' } } })] }), () => '2026-11-21');
    expect((await ok.searchOffers({ query: 'torsk', country: 'NO' })).map((o) => o.id)).toEqual(['o1']);
    const bad = new TjekSource(async () => ({ ok: false, status: 403, json: async () => ({}) }), () => 'x');
    await expect(bad.searchOffers({ query: 'torsk', country: 'NO' })).rejects.toThrow('403');
  });
  it('matcher hele ord og avviser bearbeidede varer', () => {
    const h = (heading: string) => matchOffer(parseTjekOffer(raw({ heading }), 'x'), ingredients, '2026-11-24');
    expect(h('Ostekake')).toBeNull();
    expect(h('FRIELE FROKOSTKAFFE 500 G')).toBeNull();
    expect(h('Norvegia')?.ingredient).toBe('ost');
    expect(h('Hvite bønner øko')?.ingredient).toBe('bonner');
    expect(h('Gulrøtter 1 kg')?.ingredient).toBe('gulrot');
  });
  it('stykkvare for gram-ingrediens må kontrolleres', () => {
    const o = parseTjekOffer(raw({ heading: 'Brokkoli', quantity: { unit: { symbol: 'pcs' }, size: { from: 1, to: 1 }, pieces: { from: 2, to: 2 } } }), 'x');
    expect(matchOffer(o, ingredients, '2026-11-24')!.needsReview).toBe(true);
  });
});
