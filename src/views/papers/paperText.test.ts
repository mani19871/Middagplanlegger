import { describe, expect, it } from 'vitest';
import { credit, pageAlt, periodText } from './paperText';

describe('tekster for kundeaviser fra Tjek', () => {
  it('kreditering: «Kilde: Tjek» med dato (norsk dato, Oslo-tid)', () => {
    expect(credit('2026-11-23T23:30:00.000Z')).toBe('Kilde: Tjek, hentet 24.11.2026');
    expect(credit(null)).toBe('Kilde: Tjek');
    expect(credit('tull')).toBe('Kilde: Tjek');
  });
  it('periode og alternativ tekst for en side', () => {
    expect(periodText({ validFrom: '2026-11-23', validUntil: '2026-11-29' })).toBe('23.11.–29.11.');
    expect(pageAlt({ dealerName: 'KIWI', label: 'Uke 48' }, 3, 24)).toBe('KIWI, Uke 48: side 3 av 24');
    expect(pageAlt({ dealerName: 'KIWI', label: null }, 1, null)).toBe('KIWI: side 1');
  });
});
