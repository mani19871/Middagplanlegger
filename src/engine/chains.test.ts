import { describe, expect, it } from 'vitest';
import { chainSet, COMMON_CHAINS, normalizeChain } from './chains';

describe('normalizeChain', () => {
  it.each([
    ['KIWI', 'KIWI'], ['Kiwi', 'KIWI'], ['  kiwi  ', 'KIWI'],
    ['REMA 1000', 'REMA 1000'], ['Rema 1000', 'REMA 1000'], ['REMA1000', 'REMA 1000'], ['Rema', 'REMA 1000'], ['REMA  1000', 'REMA 1000'],
    ['Coop Extra', 'COOP EXTRA'], ['Extra', 'COOP EXTRA'], ['Coop Obs!', 'COOP OBS'], ['Obs', 'COOP OBS'], ['Coop Prix', 'COOP PRIX'],
    ['Coop Mega', 'COOP MEGA'], ['Coop Marked', 'COOP MARKED'],
    ['MENY', 'MENY'], ['Meny', 'MENY'], ['SPAR', 'SPAR'], ['Eurospar', 'SPAR'], ['Joker', 'JOKER'], ['Bunnpris', 'BUNNPRIS'],
    ['Europris', 'EUROPRIS'], ['Nærbutikken', 'NÆRBUTIKKEN'], ['Price Lagerbutikk', 'PRICE LAGERBUTIKK'],
  ])('%s → %s', (inn, ut) => expect(normalizeChain(inn)).toBe(ut));
  it('Coop-formatene holdes atskilt (ulike priser)', () => {
    expect(new Set(['Coop Extra', 'Coop Prix', 'Coop Mega', 'Coop Obs', 'Coop Marked'].map(normalizeChain)).size).toBe(5);
  });
  it('tomt eller manglende navn gir tom streng, som aldri regnes som valgt', () => {
    for (const x of ['', '   ', '!!', null, undefined]) expect(normalizeChain(x)).toBe('');
    expect(chainSet(['', '  ']).size).toBe(0);
    expect(chainSet(undefined).size).toBe(0);
  });
  it('idempotent, og den faste listen er allerede normalisert', () => {
    for (const { chain } of COMMON_CHAINS) expect(normalizeChain(chain)).toBe(chain);
    for (const x of ['Coop Obs!', 'Rema', 'kiwi']) expect(normalizeChain(normalizeChain(x))).toBe(normalizeChain(x));
  });
});
