// Tjek: produktbilder og kundeaviser (kataloger og sider). Formen på katalog- og sidesvarene er IKKE prøvd mot ekte
// Tjek-svar (se docs/synk.md, «Kundeaviser fra Tjek»); tolkningen er derfor forsiktig: alt ukjent gir null eller ingen rad.
import { describe, expect, it } from 'vitest';
import { parseTjekCatalog, parseTjekOffer, parseTjekPages, TjekSource, type RawTjekOffer } from './tjek';

const raw = (over: Partial<RawTjekOffer> = {}): RawTjekOffer => ({
  id: 'o1', heading: 'Torskefilet', description: null, pricing: { price: 79.9, pre_price: null, currency: 'NOK' },
  quantity: { unit: { symbol: 'g' }, size: { from: 400, to: 400 }, pieces: null },
  dealer_id: 'd1', dealer: { name: 'KIWI', country: { id: 'NO' } }, run_from: '2026-11-23T00:00:00+0100', run_till: '2026-11-29T23:59:59+0100', ...over,
});

describe('produktbilde', () => {
  it('bruker images.view (ellers zoom, så thumb), bare https', () => {
    expect(parseTjekOffer(raw({ images: { view: 'https://bilder.example.test/v.jpg', thumb: 'https://bilder.example.test/t.jpg' } }), 'x').image).toBe('https://bilder.example.test/v.jpg');
    expect(parseTjekOffer(raw({ images: { thumb: 'https://bilder.example.test/t.jpg' } }), 'x').image).toBe('https://bilder.example.test/t.jpg');
    expect(parseTjekOffer(raw({ images: { view: 'http://bilder.example.test/v.jpg' } }), 'x').image).toBeNull();
    expect(parseTjekOffer(raw({ images: { view: 'javascript:alert(1)' } }), 'x').image).toBeNull();
    expect(parseTjekOffer(raw({ images: null }), 'x').image).toBeNull();
    expect(parseTjekOffer(raw(), 'x').image).toBeNull();
  });
});

describe('kundeaviser', () => {
  it('katalog: id, kjede, tittel, gyldighet i norsk tid og antall sider; ukjent form gir null', () => {
    const c = parseTjekCatalog({ id: 'c1', label: 'Uke 48', dealer_id: 'd1', branding: { name: 'KIWI' }, run_from: '2026-11-22T23:00:00+0000', run_till: '2026-11-29T22:59:59+0000', page_count: 24 }, 'NO', '2026-11-23T08:00:00.000Z');
    expect(c).toEqual({ id: 'c1', source: 'tjek', dealerId: 'd1', dealerName: 'KIWI', label: 'Uke 48', validFrom: '2026-11-23', validUntil: '2026-11-29', pageCount: 24, observed: '2026-11-23T08:00:00.000Z' });
    expect(parseTjekCatalog({ id: 'c2', dealer_id: 'd', run_from: 'x', run_till: 'y' }, 'NO', 'x')).toBeNull();
    expect(parseTjekCatalog({ id: 'c3', dealer_id: 'd', dealer: { name: 'Netto', country: { id: 'DK' } }, run_from: '2026-11-22T23:00:00+0000', run_till: '2026-11-29T22:59:59+0000' }, 'NO', 'x')).toBeNull();
    expect(parseTjekCatalog({ id: '../x', dealer_id: 'd', run_from: '2026-11-22T23:00:00+0000', run_till: '2026-11-29T22:59:59+0000' }, 'NO', 'x')).toBeNull();
    expect(parseTjekCatalog(null, 'NO', 'x')).toBeNull();
  });
  it('sider: nummerert fra 1, bare https-adresser', () => {
    expect(parseTjekPages([{ thumb: 'https://a.test/1t.jpg', view: 'https://a.test/1v.jpg', zoom: 'https://a.test/1z.jpg' }, { view: 'http://a.test/2.jpg' }, 'tull'])).toEqual([
      { number: 1, thumb: 'https://a.test/1t.jpg', view: 'https://a.test/1v.jpg', zoom: 'https://a.test/1z.jpg' },
      { number: 2, thumb: null, view: null, zoom: null },
    ]);
    expect(parseTjekPages({ ikke: 'liste' })).toEqual([]);
  });
  it('kilden henter kataloger per land og sider per katalog-id (kodet i stien)', async () => {
    const urls: string[] = [];
    const src = new TjekSource(async (url) => { urls.push(url); return { ok: true, status: 200, json: async () => (url.includes('/pages') ? [{ view: 'https://a.test/1.jpg' }] : [{ id: 'c1', dealer_id: 'd', branding: { name: 'KIWI' }, run_from: '2026-11-22T23:00:00+0000', run_till: '2026-11-29T22:59:59+0000' }]) }; }, () => '2026-11-23T08:00:00.000Z', 'https://api.test/v2');
    expect((await src.listCatalogs('NO')).map((c) => c.id)).toEqual(['c1']);
    expect((await src.catalogPages('c1')).length).toBe(1);
    expect(urls[0]).toMatch(/^https:\/\/api\.test\/v2\/catalogs\?country_id=NO&limit=100&offset=0$/);
    expect(urls[1]).toBe('https://api.test/v2/catalogs/c1/pages');
    await expect(src.catalogPages('../dealers')).rejects.toThrow();
  });
});
