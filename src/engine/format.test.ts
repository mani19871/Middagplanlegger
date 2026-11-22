import { describe, expect, it } from 'vitest';
import { amount, kr, krSigned, num } from './format';

// Intl bruker hardt mellomrom (U+00A0) som tusenskille på nb-NO; normaliser for lesbarhet.
const n = (s: string) => s.replace(/[  ]/g, ' ');

describe('norsk tallformat', () => {
  it('bruker komma som desimaltegn', () => {
    expect(num(8.8)).toBe('8,8');
    expect(num(2.25, 2)).toBe('2,25');
    expect(num(3)).toBe('3');
  });
  it('rundes og gir ikke «-0»', () => {
    expect(num(8.84)).toBe('8,8');
    expect(num(-0.04)).toBe('0');
  });
  it('bruker mellomrom som tusenskille', () => {
    expect(n(num(1234567, 0))).toBe('1 234 567');
    expect(n(kr(123456))).toBe('1 235 kr');
  });
  it('mengder: stk med komma, g/kg og ml/l', () => {
    expect(amount(8.8, 'stk')).toBe('8,8 stk');
    expect(amount(2, 'stk')).toBe('2 stk');
    expect(amount(400, 'g')).toBe('400 g');
    expect(amount(1500, 'g')).toBe('1,5 kg');
    expect(amount(1250, 'g')).toBe('1,25 kg');
    expect(amount(250, 'ml')).toBe('250 ml');
    expect(amount(1500, 'ml')).toBe('1,5 l');
    expect(n(amount(12500, 'g'))).toBe('12,5 kg');
  });
  it('kr og fortegn', () => {
    expect(kr(4150)).toBe('42 kr');
    expect(krSigned(0)).toBe('± 0 kr');
    expect(krSigned(30)).toBe('± 0 kr'); // under en halv krone: ikke «+0 kr»
    expect(krSigned(-49)).toBe('± 0 kr');
    expect(amount(999.6, 'g')).toBe('1 kg'); // avrundes før valg av enhet
    expect(amount(999.7, 'ml')).toBe('1 l');
    expect(krSigned(4100)).toBe('+41 kr');
    expect(krSigned(-4100)).toBe('−41 kr');
  });
});
