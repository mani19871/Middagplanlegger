// Matskapet: forventet rest fra kurven. Ren funksjon. Selve beholdningen ligger i inventory.ts.
import type { Basket } from './types';

export interface RestItem { ingredient: string; name: string; unit: 'g' | 'ml' | 'stk'; amount: number }

/** Antatt rest fra kurven (overskudd fra pakker). Dette er ikke beholdning før brukeren bekrefter. */
export function expectedRest(basket: Basket): RestItem[] {
  return basket.lines.filter((l) => l.leftover > 0.5 && l.productId)
    .map((l) => ({ ingredient: l.ingredient, name: l.name, unit: l.unit, amount: l.leftover }));
}

// Bekreftelse av rest, kjøp og forbruk ligger i inventory.ts (hendelseslogg, idempotent).
