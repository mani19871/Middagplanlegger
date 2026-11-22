import type { Unit } from './types';

const NB = 'nb-NO';
/** Norsk tall: komma som desimaltegn, mellomrom (smalt/hardt) som tusenskille, ekte minustegn. */
export const num = (n: number, maxDecimals = 1): string => {
  const f = 10 ** maxDecimals;
  const r = Math.round(n * f) / f;
  return (Object.is(r, -0) ? 0 : r).toLocaleString(NB, { maximumFractionDigits: maxDecimals });
};
export const kr = (ore: number) => `${num(ore / 100, 0)} kr`;
export const krSigned = (ore: number) => (Math.round(Math.abs(ore) / 100) === 0 ? '± 0 kr' : `${ore > 0 ? '+' : '−'}${num(Math.abs(ore) / 100, 0)} kr`);
export function amount(n: number, unit: Unit): string {
  if (unit === 'stk') return `${num(n, 1)} stk`;
  const r = Math.round(n); // avrund før valg av enhet, så 999,6 g blir «1 kg», ikke «1 000 g»
  if (unit === 'g') return r >= 1000 ? `${num(n / 1000, 2)} kg` : `${num(n, 0)} g`;
  return r >= 1000 ? `${num(n / 1000, 2)} l` : `${num(n, 0)} ml`;
}
export const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
