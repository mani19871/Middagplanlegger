import { describe, expect, it } from 'vitest';
import { pageItems, REVIEW_PAGE, searchRows } from './reviewList';

describe('Kontroll: paginering og søk', () => {
  const list = Array.from({ length: 25 }, (_, i) => i);
  it('viser de første N og teller resten', () => {
    const p = pageItems(list, 10);
    expect(p.items).toHaveLength(10); expect(p.shown).toBe(10); expect(p.total).toBe(25); expect(p.remaining).toBe(15); expect(p.next).toBe(10 + REVIEW_PAGE);
  });
  it('mer enn totalen gir alt, uten rest', () => {
    const p = pageItems(list, 99);
    expect(p.items).toHaveLength(25); expect(p.remaining).toBe(0);
  });
  it('ugyldig antall gir tom side, ikke feil', () => {
    expect(pageItems(list, -3).items).toEqual([]); expect(pageItems(list, NaN).items).toEqual([]); expect(pageItems([], 10).total).toBe(0);
  });
  it('er deterministisk og endrer ikke inndata', () => {
    const copy = [...list]; pageItems(list, 5); expect(list).toEqual(copy);
  });
  it('søker uavhengig av store/små bokstaver; tom streng slipper alt gjennom', () => {
    const rows = [{ t: 'Kjøttdeig 400 g' }, { t: 'Laks' }];
    expect(searchRows(rows, 'KJØTT', (r) => r.t)).toEqual([rows[0]]);
    expect(searchRows(rows, '  ', (r) => r.t)).toEqual(rows);
    expect(searchRows(rows, 'xyz', (r) => r.t)).toEqual([]);
  });
});
