// Matskapet: antatt rest, bekreftet beholdning og kjøp holdes adskilt. Rene funksjoner.
import type { Basket } from './types';

export interface RestItem { ingredient: string; name: string; unit: 'g' | 'ml' | 'stk'; amount: number }

/** Antatt rest fra kurven (overskudd fra pakker). Dette er ikke beholdning før brukeren bekrefter. */
export function expectedRest(basket: Basket): RestItem[] {
  return basket.lines.filter((l) => l.leftover > 0.5 && l.productId)
    .map((l) => ({ ingredient: l.ingredient, name: l.name, unit: l.unit, amount: l.leftover }));
}

/**
 * Bekrefter en rest: legger mengden (avrundet, aldri negativ) til beholdningen.
 * Endrer ikke inndata. En bekreftet pakke betyr ikke at retten er laget.
 */
export function confirmRest(pantry: Record<string, number>, rest: RestItem): Record<string, number> {
  const add = Math.max(0, Math.round(rest.amount));
  if (add === 0) return pantry;
  return { ...pantry, [rest.ingredient]: (pantry[rest.ingredient] ?? 0) + add };
}
