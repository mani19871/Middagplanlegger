// Formprøven mot Tjek 2026-11-22 (phase0/tjek-formprøve.md): svarene har formen under. ALLE verdier er SYNTETISKE
// (oppdiktet id, overskrift, pris, adresser på example-/test-domener), aldri ekte tilbud eller ekte bildeadresser.
import { describe, expect, it } from 'vitest';
import { ingredients } from '../data/catalog';
import { matchOffer } from './match';
import { parseTjekCatalog, parseTjekOffer, parseTjekPages, TjekSource, TJEK_MAX_LIMIT, type RawTjekOffer } from './tjek';

/** Syntetisk tilbud i den formen /v2/offers/search faktisk har (feltene som ble sett i alle 413 treff). */
const syntetiskTilbud = (over: Record<string, unknown> = {}) => ({
  id: 'syntetisk-1', ern: 'ern:offer:syntetisk-1', heading: 'Syntetisk vare', description: '',
  catalog_id: 'synt-katalog', catalog_page: 1, catalog_url: 'https://api.syntetisk.test/v2/catalogs/synt-katalog', catalog_view_id: null,
  category_ids: [], dealer_id: 'synt-d', dealer_url: 'https://api.syntetisk.test/v2/dealers/synt-d', store_id: null, store_url: null,
  pricing: { price: 12.5, pre_price: null, currency: 'NOK' },
  quantity: { unit: { symbol: 'g', si: { symbol: 'kg', factor: 0.001 } }, size: { from: 400, to: 400 }, pieces: { from: 1, to: 1, min: null, max: null } },
  images: { thumb: 'https://bilder.syntetisk.test/t.jpg', view: 'https://bilder.syntetisk.test/v.jpg', zoom: 'https://bilder.syntetisk.test/z.jpg' },
  links: { webshop: null }, publish: '2026-11-20T10:00:00+0000', run_from: '2026-11-22T23:00:00+0000', run_till: '2026-11-29T22:59:59+0000', display_run_till: true,
  branding: { name: 'SYNTETISK KJEDE', color: '000000', description: '', website: 'https://kjede.syntetisk.test', logo: 'https://bilder.syntetisk.test/l.png', pageflip: { color: '000000', logo: 'https://bilder.syntetisk.test/p.png' } },
  dealer: { id: 'synt-d', ern: 'ern:dealer:synt-d', name: 'SYNTETISK KJEDE', country: { id: 'NO', unsubscribe_print_url: null }, category_ids: [], markets: [{ country_code: 'NO', slug: 'syntetisk' }], logo: 'https://bilder.syntetisk.test/l.png' },
  ...over,
}) as unknown as RawTjekOffer;

describe('formprøve Tjek: tilbud', () => {
  it('ekte form tolkes: kroner til øre, gram, én pakke, bilde, norsk dato fra «+0000»', () => {
    const o = parseTjekOffer(syntetiskTilbud(), '2026-11-23T08:00:00.000Z');
    expect(o).toMatchObject({ priceOre: 1250, prePriceOre: null, amount: 400, unit: 'g', pieces: 1, dealerName: 'SYNTETISK KJEDE',
      validFrom: '2026-11-23', validUntil: '2026-11-29', image: 'https://bilder.syntetisk.test/v.jpg' });
  });

  it('stykkvare med flere pakker (pcs og pieces > 1) er ukjent antall og går til kontroll', () => {
    const multi = parseTjekOffer(syntetiskTilbud({ heading: 'Syntetisk tortilla', quantity: { unit: { symbol: 'pcs', si: { symbol: 'pcs', factor: 1 } }, size: { from: 8, to: 8 }, pieces: { from: 2, to: 2, min: null, max: null } } }), 'x');
    expect(multi.pieces).toBeNull();
    const m = matchOffer({ ...multi, validFrom: '2026-11-23', validUntil: '2026-11-29' }, ingredients, '2026-11-24');
    expect(m?.ingredient).toBe('tortilla');
    expect(m?.reasons).toContain('mengde ukjent');
    // Én pakke med åtte stykk er fortsatt åtte.
    expect(parseTjekOffer(syntetiskTilbud({ quantity: { unit: { symbol: 'pcs', si: { symbol: 'pcs', factor: 1 } }, size: { from: 8, to: 8 }, pieces: { from: 1, to: 1, min: null, max: null } } }), 'x').pieces).toBe(8);
  });

  it(`søket ber alltid om ${TJEK_MAX_LIMIT} treff (Tjeks maks), fordi country_id ikke filtrerer: norske treff etter de første 60 kommer med`, async () => {
    // Tjek svarer med andre land først; de norske ligger på plass 61–70 av 100 (syntetisk).
    const all = [
      ...Array.from({ length: 60 }, (_, i) => syntetiskTilbud({ id: `dk-${i}`, dealer: { name: 'DK', country: { id: 'DK' } } })),
      ...Array.from({ length: 10 }, (_, i) => syntetiskTilbud({ id: `no-${i}` })),
      ...Array.from({ length: 30 }, (_, i) => syntetiskTilbud({ id: `se-${i}`, dealer: { name: 'SE', country: { id: 'SE' } } })),
    ];
    const urls: string[] = [];
    const src = new TjekSource(async (url) => {
      urls.push(url);
      const limit = Number(new URL(url).searchParams.get('limit'));
      if (limit > TJEK_MAX_LIMIT) return { ok: false, status: 400, json: async () => null };
      return { ok: true, status: 200, json: async () => all.slice(0, limit) };
    }, () => '2026-11-23T08:00:00.000Z', 'https://api.test/v2');
    const got = await src.searchOffers({ query: 'syntetisk', country: 'NO', limit: 20 });
    expect(got.map((o) => o.id)).toEqual(Array.from({ length: 10 }, (_, i) => `no-${i}`));
    expect(new URL(urls[0]).searchParams.get('limit')).toBe(String(TJEK_MAX_LIMIT));
    // Høyere ønsket antall gir aldri limit over Tjeks maks (limit=250 ga HTTP 400 i formprøven), og høyst `limit` tilbake.
    expect((await src.searchOffers({ query: 'syntetisk', country: 'NO', limit: 500 })).length).toBe(10);
    expect((await src.searchOffers({ query: 'syntetisk', country: 'NO', limit: 3 })).length).toBe(3);
    expect(urls.every((u) => new URL(u).searchParams.get('limit') === String(TJEK_MAX_LIMIT))).toBe(true);
    expect(urls).toHaveLength(3); // ett kall per søk, som før
  });
});

describe('formprøve Tjek: kundeaviser', () => {
  const syntetiskKatalog = (over: Record<string, unknown> = {}) => ({
    id: 'syntkat1', ern: 'ern:catalog:syntkat1', label: '', background: 'ffffff', all_stores: true, category_ids: ['synt'], tags: [], types: ['paged'],
    dealer_id: 'synt-d', dealer_url: 'https://kjede.syntetisk.test', store_id: null, store_url: null, incito_publication_id: null, pdf_url: null,
    branding: { name: 'SYNTETISK KJEDE' }, dealer: { id: 'synt-d', name: 'SYNTETISK KJEDE', country: { id: 'NO' } },
    dimensions: { width: 1, height: 1.4 }, offer_count: 3, page_count: 2,
    // Lista har et `pages`-objekt, men arrayene var tomme i alle 300 kataloger: sidene må hentes med /catalogs/:id/pages.
    pages: { thumb: [], view: [], zoom: [] },
    images: { thumb: 'https://bilder.syntetisk.test/c-t.jpg', view: 'https://bilder.syntetisk.test/c-v.jpg', zoom: 'https://bilder.syntetisk.test/c-z.jpg' },
    publish: '2026-11-20T10:00:00+0000', run_from: '2026-11-22T23:00:00+0000', run_till: '2026-11-29T22:59:59+0000', display_run_till: true,
    ...over,
  });

  it('ekte form tolkes: tom tittel blir null, sideantall, norsk dato; andre land avvises', () => {
    expect(parseTjekCatalog(syntetiskKatalog(), 'NO', 'obs')).toEqual({ id: 'syntkat1', source: 'tjek', dealerId: 'synt-d', dealerName: 'SYNTETISK KJEDE',
      label: null, validFrom: '2026-11-23', validUntil: '2026-11-29', pageCount: 2, observed: 'obs' });
    expect(parseTjekCatalog(syntetiskKatalog({ dealer: { id: 'x', name: 'DE', country: { id: 'DE' } } }), 'NO', 'obs')).toBeNull();
  });

  it('sidene er en liste med thumb/view/zoom (https) per side', () => {
    const pages = [1, 2].map((n) => ({ thumb: `https://bilder.syntetisk.test/${n}t.jpg`, view: `https://bilder.syntetisk.test/${n}v.jpg`, zoom: `https://bilder.syntetisk.test/${n}z.jpg` }));
    expect(parseTjekPages(pages).map((p) => [p.number, p.view])).toEqual([[1, 'https://bilder.syntetisk.test/1v.jpg'], [2, 'https://bilder.syntetisk.test/2v.jpg']]);
  });
});
