import { describe, expect, it } from 'vitest';
import { expectedRest } from './pantry';
import type { Basket, BasketLine } from './types';

const line = (o: Partial<BasketLine>): BasketLine => ({ ingredient: 'pasta', name: 'Pasta', department: 'x', unit: 'g', need: 750, storeId: 's', productId: 'p',
  productName: 'Pasta 500 g', packs: 2, packSize: 500, costOre: 3600, leftover: 250, status: 'ordinary', observed: null, source: null, covers: [], ...o } as BasketLine);
const basket = (lines: BasketLine[]): Basket => ({ storeIds: ['s'], lines, totalOre: 0, unknownCount: 0, estimatedCount: 0, complete: true, stops: 1 });

describe('matskap: rest', () => {
  it('antatt rest hentes bare fra linjer med produkt og reell rest', () => {
    const r = expectedRest(basket([line({}), line({ ingredient: 'ris', leftover: 0 }), line({ ingredient: 'løk', productId: null, leftover: 300 })]));
    expect(r).toEqual([{ ingredient: 'pasta', name: 'Pasta', unit: 'g', amount: 250 }]);
  });
});
