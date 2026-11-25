// Personvern-arket skal ikke love mer enn koden gjør: tallene må stemme med standardene i server/retention.ts (730 dager).
import { describe, expect, it } from 'vitest';
import { DEFAULT_RETENTION_DAYS, DEFAULT_TOKEN_IDLE_DAYS } from '../../server/retention';
import { contactText, controllerText, draftNoticeText, hostingText, PRIVACY_CONTACT_EMAIL, retentionText, tokenIdleText, TOKEN_IDLE_DEFAULT_DAYS } from './PrivacySheet';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import PrivacySheet from './PrivacySheet';
import { initialState } from '../store';

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

describe('personvern-arket: avstemt mot erklæringen (docs/personvern/02, B5 2026-11-25)', () => {
  const decl = readFileSync('docs/personvern/02-personvernerklaering.md', 'utf8');
  const sheet = renderToStaticMarkup(createElement(PrivacySheet, { state: initialState, onClose: () => {} })).replace(/<[^>]+>/g, ' ');

  it('nevner behandlingsansvarlig slik erklæringen gjør, og utkast-merket sier ikke lenger at den mangler', () => {
    expect(controllerText()).toMatch(/AVVR AS \(org\.nr\. 935941644\)/);
    expect(decl).toContain('AVVR AS (org.nr. 935941644), Smedalsvegen 14, 2067 Jessheim');
    expect(sheet).toContain('AVVR AS');
    expect(draftNoticeText()).not.toMatch(/behandlingsansvarlig er ikke/);
  });

  it('hosting: one.com i Europa, aldri «EØS» før landet er bekreftet, og den delte serveren nevnes', () => {
    const t = hostingText();
    expect(t).toMatch(/one\.com/);
    expect(t).toMatch(/Europa/);
    expect(t).not.toMatch(/EØS/);
    expect(t).toMatch(/administratortilgang/);
    expect(sheet).not.toMatch(/Leverandør er ikke valgt/);
  });

  it('nevner IP-adressen i minnet, barn og at oppskriftene ikke er kontrollert av en person', () => {
    expect(sheet).toMatch(/IP-adressen din kort i minnet/);
    expect(sheet).toMatch(/Barn/);
    expect(sheet).toMatch(/ikke navn eller alder/);
    expect(sheet).toMatch(/ingen person har kontrollert\s+allergenene/);
  });
});
