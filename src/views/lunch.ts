import type { Slot } from '../engine/types';
/** Dagen en reservert matpakke er til: neste planlagte dag, ellers dagen etter. Søndag uten senere dag: undefined («Senere»). */
export function lunchDay(slots: Slot[], day: number): number | undefined {
  return slots.filter((x) => x.day > day).sort((a, b) => a.day - b.day)[0]?.day ?? (day < 6 ? day + 1 : undefined);
}
