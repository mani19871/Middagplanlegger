// Rene hjelpefunksjoner for Kontroll-køen: «Vis flere» og tellere. Ingen klokke, nett eller lagring.
export const REVIEW_PAGE = 10;
export const RULES_PAGE = 20;

export interface Page<T> { items: T[]; shown: number; total: number; remaining: number; next: number }

/** De første `visible` elementene. Negativt eller ikke-endelig tall gir tom side; mer enn totalen gir alt. */
export function pageItems<T>(list: T[], visible: number, step = REVIEW_PAGE): Page<T> {
  const n = Number.isFinite(visible) ? Math.max(0, Math.floor(visible)) : 0;
  const items = list.slice(0, n);
  return { items, shown: items.length, total: list.length, remaining: list.length - items.length, next: n + step };
}

/** Søk i overskrift og kjede; tom søkestreng slipper alt gjennom. */
export function searchRows<T>(rows: T[], q: string, text: (r: T) => string): T[] {
  const needle = q.trim().toLowerCase();
  return needle ? rows.filter((r) => text(r).toLowerCase().includes(needle)) : rows;
}
