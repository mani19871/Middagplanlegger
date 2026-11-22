// Innstillingsdokumentet godtar kjedevalget for tilbud (Settings.offerChains), men bare som korte kjedenavn.
import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../data/defaults';
import { fieldsOf, fromFields, isValidDoc, type SettingsDoc } from './docs';

const doc = (over: object = {}) => fromFields('innstillinger', fieldsOf('innstillinger', { ...defaultSettings, ...over } as SettingsDoc));

describe('innstillinger: offerChains', () => {
  it('uten felt og med gyldige kjedenavn er dokumentet gyldig, og feltet synkes', () => {
    expect(isValidDoc('innstillinger', doc())).toBe(true);
    const d = doc({ offerChains: ['KIWI', 'COOP EXTRA'] });
    expect(isValidDoc('innstillinger', d)).toBe(true);
    expect((d as SettingsDoc).offerChains).toEqual(['KIWI', 'COOP EXTRA']);
  });
  it('feil type, tomme eller for lange navn avvises', () => {
    for (const bad of ['KIWI', [1], [''], ['x'.repeat(41)], Array.from({ length: 41 }, (_, i) => `K${i}`)]) {
      expect(isValidDoc('innstillinger', doc({ offerChains: bad }))).toBe(false);
    }
  });
});
