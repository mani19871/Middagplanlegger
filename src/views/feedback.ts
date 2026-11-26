// «Gi tilbakemelding» (pilot): en mailto-lenke som åpner brukerens egen e-postapp med emne og en kort mal. Appen sender
// ingenting selv, og teksten har ingen opplysninger fra enheten (ingen enhets-id, etiketter, allergier, postnummer eller
// nøkler): lenken bygges uten tilstand. Ren modul.

/**
 * Kontaktadressen for personvern og tilbakemelding, oppgitt av eieren 2026-11-22. **Ikke bekreftet at postkassen er
 * opprettet eller virker** (docs/pilot-sjekkliste.md, A5). Byttes her; personvern-arket bruker samme konstant.
 */
export const CONTACT_EMAIL = 'kontakt@husvett.no';

export const FEEDBACK_SUBJECT = 'Tilbakemelding om Husvett (pilot)';

/** Malen i e-posten. Lover ikke svar eller svartid: hvem som leser innboksen er ikke avgjort. */
export const FEEDBACK_BODY = [
  'Hva gjorde du?', '', '',
  'Hva skjedde?', '', '',
  'Hva forventet du?', '', '',
  '(Skriv ikke navn, allergier, postnummer, nøkler eller invitasjonskoder her. Skjermbilder er velkomne, men uten slike opplysninger.)',
].join('\n');

/** mailto-adressen med forhåndsutfylt emne og mal (RFC 6068: linjeskift som %0D%0A). */
export function feedbackMailto(): string {
  const enc = (s: string) => encodeURIComponent(s.replace(/\n/g, '\r\n'));
  return `mailto:${CONTACT_EMAIL}?subject=${enc(FEEDBACK_SUBJECT)}&body=${enc(FEEDBACK_BODY)}`;
}
