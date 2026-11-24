// Personvern-arket skal ikke love mer enn koden gjør: tallene må stemme med standardene i server/retention.ts (730 dager).
import { describe, expect, it } from 'vitest';
import { DEFAULT_RETENTION_DAYS, DEFAULT_TOKEN_IDLE_DAYS } from '../../server/retention';
import { contactText, draftNoticeText, PRIVACY_CONTACT_EMAIL, retentionText, tokenIdleText, TOKEN_IDLE_DEFAULT_DAYS } from './PrivacySheet';

describe('personvern-arket: tidsfrister', () => {
  it('reservetekst uten kjent oppbevaringstid sier standard 730 dager (samme som serverens standard), ikke «12 måneder»', () => {
    const t = retentionText(undefined, false);
    expect(t).toMatch(/Standard er 730 dager/);
    expect(t).not.toMatch(/12 måneder/);
    expect(t).toMatch(/annerledes/); // serveren kan være satt opp med en annen frist; arket lover ikke mer enn det
    expect(DEFAULT_RETENTION_DAYS).toBe(730);
  });

  it('serverens oppgitte oppbevaringstid vises ordrett; 730 dager = «2 år (730 dager)»; 0 = ingen automatisk sletting', () => {
    expect(retentionText(730, true)).toMatch(/2 år \(730 dager\)/);
    expect(retentionText(365, true)).toMatch(/12 måneder \(365 dager\)/);
    expect(retentionText(90, true)).toMatch(/90 dager/);
    expect(retentionText(0, true)).toMatch(/sletter ikke husstander automatisk/);
    // Mens svaret er på vei, står det ikke at hentingen feilet (fantes i npm run check:csp: kappløp, 2026-11-24).
    expect(retentionText(undefined, true, true)).toBe('Henter serverens oppbevaringstid …');
    expect(retentionText(undefined, true, false)).toMatch(/^Fikk ikke hentet/);
  });

  it('tokenutløpet i arket er det samme som standarden i serveren (730 dager) og nevner at serveren kan ha en annen verdi', () => {
    expect(TOKEN_IDLE_DEFAULT_DAYS).toBe(DEFAULT_TOKEN_IDLE_DAYS);
    const t = tokenIdleText();
    expect(t).toMatch(/730 dager/);
    expect(t).not.toMatch(/180/);
    expect(t).toMatch(/annerledes/);
  });
});

describe('personvern-arket: kontakt og utkast-merke', () => {
  it('kontaktadressen er den eieren oppga (2026-11-22), og kontakttekst nevner den og enhets-id-en, men lover ikke svartid', () => {
    expect(PRIVACY_CONTACT_EMAIL).toBe('kontakt@husvett.no');
    const t = contactText();
    expect(t).toContain('kontakt@husvett.no');
    expect(t).toMatch(/enhets-id/);
    expect(t).not.toMatch(/innen \d+|svarer vi|garanter/i); // ingen svarfrist eller løfte om svar
  });

  it('utkast-merket består: ikke vurdert av fagperson, og postkassen er ikke bekreftet i drift', () => {
    const t = draftNoticeText();
    expect(t).toMatch(/ikke ferdig vurdert av fagperson/);
    expect(t).toMatch(/ikke bekreftet/);
    expect(t).not.toMatch(/ikke fastsatt/); // gammel tekst om at kontaktadressen ikke er bestemt
  });
});
