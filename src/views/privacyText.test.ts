// Personvern-arket skal ikke love mer enn koden gjør: tallene må stemme med standardene i server/retention.ts (730 dager).
import { describe, expect, it } from 'vitest';
import { DEFAULT_TOKEN_IDLE_DAYS } from '../../server/retention';
import { retentionText, tokenIdleText, TOKEN_IDLE_DEFAULT_DAYS } from './PrivacySheet';

describe('personvern-arket: tidsfrister', () => {
  it('reservetekst uten kjent oppbevaringstid foreslår 730 dager, ikke «12 måneder»', () => {
    const t = retentionText(undefined, false);
    expect(t).toMatch(/730 dager/);
    expect(t).not.toMatch(/12 måneder/);
    expect(t).toMatch(/ikke endelig bestemt|ikke bestemt/);
  });

  it('serverens oppgitte oppbevaringstid vises ordrett; 730 dager = «2 år (730 dager)»; 0 = ingen automatisk sletting', () => {
    expect(retentionText(730, true)).toMatch(/2 år \(730 dager\)/);
    expect(retentionText(365, true)).toMatch(/12 måneder \(365 dager\)/);
    expect(retentionText(90, true)).toMatch(/90 dager/);
    expect(retentionText(0, true)).toMatch(/sletter ikke husstander automatisk/);
  });

  it('tokenutløpet i arket er det samme som standarden i serveren (730 dager) og nevner at serveren kan ha en annen verdi', () => {
    expect(TOKEN_IDLE_DEFAULT_DAYS).toBe(DEFAULT_TOKEN_IDLE_DAYS);
    const t = tokenIdleText();
    expect(t).toMatch(/730 dager/);
    expect(t).not.toMatch(/180/);
    expect(t).toMatch(/annerledes/);
  });
});
