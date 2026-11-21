import type { Unit } from './types';
export const kr = (ore: number) => `${Math.round(ore / 100).toLocaleString('nb-NO')} kr`;
export const krSigned = (ore: number) => (ore === 0 ? '± 0 kr' : `${ore > 0 ? '+' : '−'}${Math.round(Math.abs(ore) / 100)} kr`);
export function amount(n: number, unit: Unit): string {
  if (unit === 'stk') return `${Math.round(n * 10) / 10} stk`;
  if (unit === 'g') return n >= 1000 ? `${Math.round(n / 10) / 100} kg` : `${Math.round(n)} g`;
  return n >= 1000 ? `${Math.round(n / 10) / 100} l` : `${Math.round(n)} ml`;
}
export const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
