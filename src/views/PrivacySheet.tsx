// «Personvern» i appen: hva som lagres på enheten, hva som deles med husstanden (serveren), hvor lenge og hva du kan gjøre.
// Bygger på docs/personvern/02-personvernerklaering.md, men sier bare det koden faktisk gjør. UTKAST til en fagperson har
// vurdert teksten og behandlingsansvarlig er fastsatt. Ingen inline-skript eller HTML-strenger (CSP med Trusted Types).
import { useEffect, useState } from 'react';
import { deviceId, type AppState } from '../store';
import { defaultApi } from '../sync/useSync';
import { Sheet } from './Sheet';
import { CONTACT_EMAIL } from './feedback';

interface Props {
  state: AppState; onClose: () => void;
  /** Serverens oppbevaringstid hvis den er kjent (Husstand-skjermen har den). Ellers hentes den når enheten er i en husstand. */
  retentionDays?: number;
}

/** Standard tokenutløp på serveren (`DEFAULT_TOKEN_IDLE_DAYS` i server/retention.ts; testet mot den). Serveren oppgir ikke tallet til appen. */
export const TOKEN_IDLE_DEFAULT_DAYS = 730;

/** Kontakt-e-post for personvern, oppgitt av eieren 2026-11-22 (felles adresse til nettopp dette bruket). Ikke bekreftet i drift: se draftNoticeText. Byttes i feedback.ts. */
export const PRIVACY_CONTACT_EMAIL = CONTACT_EMAIL;

/** Utkast-merket øverst i arket. Fjern «ikke bekreftet»-leddet først når postkassen er satt opp og prøvd (docs/pilot-sjekkliste.md, A5). */
export function draftNoticeText(): string {
  return 'Teksten er ikke ferdig vurdert av fagperson, og behandlingsansvarlig er ikke ført inn her ennå. Kontaktadressen er oppgitt av eieren, men det er ikke bekreftet at postkassen er i drift. Den beskriver hva appen gjør i dag. Appen er en pilot.';
}

/** Hvordan du kontakter oss om personvern. Lover ingen svartid; det er ikke bestemt. */
export function contactText(): string {
  return `Spørsmål om personvern, innsyn eller sletting du ikke får gjort i appen: skriv til ${PRIVACY_CONTACT_EMAIL} og oppgi enhets-id-en over. Send aldri nøkkelen eller invitasjonskoder.`;
}

/** Hva som skjer med en enhet som ikke har vært i kontakt med serveren på lenge. Sier bare standarden; serveren kan være satt opp annerledes. */
export function tokenIdleText(): string {
  return `En enhet som ikke har vært i kontakt med serveren på lenge, mister nøkkelen og forlater husstanden (standard ${TOKEN_IDLE_DEFAULT_DAYS} dager, om lag to år; serveren kan være satt opp annerledes).`;
}

/**
 * Hvor lenge serveren beholder husstanden. Sier bare det serveren har oppgitt; ellers forslaget og at det ikke er bestemt.
 * `pending`: svaret fra serveren er på vei (da står det ikke at hentingen feilet).
 */
export function retentionText(days: number | undefined, connected: boolean, pending = false): string {
  if (days === undefined) {
    if (connected && pending) return 'Henter serverens oppbevaringstid …';
    return connected
      ? 'Fikk ikke hentet serverens oppbevaringstid akkurat nå.'
      : 'Serveren kan være satt opp til å slette husstander som ikke har vært i bruk på en tid. Standard er 730 dager (om lag to år), men serveren kan være satt opp annerledes. Du ser hva som gjelder her når enheten er med i en husstand.';
  }
  if (days === 0) return 'Denne serveren sletter ikke husstander automatisk. Husstanden ligger der til eieren sletter den eller den siste forlater den.';
  const months = days % 365 === 0 ? `${days / 365 === 1 ? '12 måneder' : `${days / 365} år`} (${days} dager)` : `${days} dager`;
  return `Serveren sletter en husstand automatisk når ingen enhet i den har vært i kontakt med serveren på ${months}. Det er eneste kriterium. Vi har ingen kontaktinformasjon og kan ikke varsle på forhånd. Det som er lagret på enhetene, slettes ikke.`;
}

export default function PrivacySheet({ state, onClose, retentionDays }: Props) {
  const connected = !!state.sync;
  const [days, setDays] = useState<number | undefined>(retentionDays);
  const token = state.sync?.token;
  const [pending, setPending] = useState(retentionDays === undefined && !!token);
  useEffect(() => {
    if (retentionDays !== undefined || !token) return;
    let stop = false;
    setPending(true);
    defaultApi.withToken(token).household().then((r) => { if (!stop && typeof r.retentionDays === 'number') setDays(r.retentionDays); })
      .catch(() => { /* vises som ukjent */ })
      .finally(() => { if (!stop) setPending(false); });
    return () => { stop = true; };
  }, [token, retentionDays]);

  return (
    <Sheet label="Personvern" onClose={onClose}>
      <div className="pagehead"><h2>Personvern</h2><button className="x" aria-label="Lukk" onClick={onClose}>✕</button></div>
      <div className="banner warn" role="note">
        <b>UTKAST.</b> {draftNoticeText()}
      </div>

      <h3>Kort fortalt</h3>
      <ul className="plain">
        <li>Ingen konto, passord eller e-post. Vi spør ikke om navn, adresse eller hvor du er.</li>
        <li>Uten husstand lagres alt bare på denne enheten, i nettleseren.</li>
        <li><b>Postnummer, allergier og kostkrav blir alltid på denne enheten.</b> De sendes aldri til serveren, heller ikke når du
          deler husstand. Filteret virker bare på enheten der det er lagt inn: legg det inn på hver enhet som lager planer.</li>
        <li>Appen kan ikke garantere at en vare er fri for allergener. Les alltid varedeklarasjonen.</li>
        <li>Vi selger ikke opplysninger og bruker dem ikke til reklame. Appen har ingen sporing eller reklame.</li>
      </ul>

      <h3>Bare på denne enheten</h3>
      <ul className="plain">
        <li>Postnummer (for «Nær meg» i kundeavisene), allergier og kostkrav (vegetar, allergener, matvarer som skal unngås).</li>
        <li>En kopi av planen, innstillingene, handlelista, matskapet, valg i butikken og tidligere lister, så appen virker uten nett.</li>
        <li>Det du krysser av eller merker «må brukes snart» i «Lag nå». Det deles ikke med husstanden og endrer ikke matskapet.</li>
        <li>At introduksjonen er lukket her, så den ikke vises av seg selv igjen. Det deles ikke med husstanden.</li>
        <li>En tilfeldig enhets-id: <code>{deviceId()}</code>. Oppgi den hvis du kontakter oss om personvern (se «Det du kan gjøre»).</li>
        <li>Hvis enheten er med i en husstand: nøkkelen som viser at den er med. Den som får bruke en ulåst telefon eller
          nettleserprofil, kan bruke nøkkelen. Lås telefonen, og be eieren fjerne enheten hvis du mister den.</li>
      </ul>

      <h3>Delt med husstanden (lagres på serveren)</h3>
      <p className="fine">Bare hvis du oppretter eller blir med i en husstand.{connected ? ' Denne enheten er med i en husstand.' : ' Denne enheten er ikke med i en husstand.'}</p>
      <ul className="plain">
        <li>Ukeplanen: hvilke middager, og om lista er godkjent.</li>
        <li>Innstillinger uten allergier og kostkrav: hvem som spiser (etiketter som «Barn 1», porsjon, dager hjemme), dager og tid
          til matlaging, budsjett, butikker, antall butikkstopp, om tilbud brukes og hvilke kjeder.</li>
        <li>Handlelista: avkrysninger med hvem som krysset av, og egne linjer du skriver.</li>
        <li>Matskapet: kjøp, tellinger, rester, hva som er laget og «bruk noe vi har hjemme».</li>
        <li>Basisvarer: hvilke varer dere alltid vil ha hjemme (fra en fast liste, eller et eget varenavn på høyst 30 tegn),
          minstemengder og markeringene «har», «snart tom» og «tom». Forslag dere godkjenner eller avviser, lagres som linjer i handlelista.</li>
        <li>Husholdningsvarer («Andre varer»): hvilke varegrupper dere følger (fra en fast, generell liste uten helse- og barneprodukter)
          og varene dere legger på lista, med varenavn, kjede og en henvisning til tilbudet hos Tjek. Tilbudstekst, pris og gyldighet fra Tjek
          lagres ikke i husstandens data; de vises fra tilbudene når lista åpnes.</li>
        <li>Valg ved utsolgt eller fant ikke, og godkjente lister (planversjoner).</li>
        <li>Medlemmer: enhets-id, etiketten du velger, rolle, når enheten ble med og sist var i kontakt med serveren (avrundet til
          minutt). Nøkkelen og invitasjonskoder lagres bare i uleselig form.</li>
        <li>For hver endring: tidspunkt fra enhetens klokke, når serveren mottok den og hvilken enhet som sendte den.</li>
      </ul>
      <p className="fine">Etiketter, egne handlelinjer og egne basisvarer er fritekst. Skriv ikke navn eller helseopplysninger der. Planen og handlelista
        kan likevel si noe om hva dere spiser.</p>
      <p className="fine">Tilbud hentes av serveren fra Tjek og lagres der uten noe om deg eller husstanden. Ingenting om deg eller husstanden sendes til Tjek.
        Unntak: når du åpner et tilbud med bilde eller blar i en kundeavis fra Tjek, henter enheten din bildene direkte fra Tjek, som da ser
        IP-adressen din.</p>

      <h3>Hvem ser det</h3>
      <ul className="plain">
        <li>Alle voksne enheter i husstanden ser og kan endre alt som deles.</li>
        <li>Den som har en gyldig invitasjonskode (virker én gang, i 24 timer), kan bli med uten at eieren godkjenner. Del koden bare med
          den du vil invitere.</li>
        <li>De som drifter serveren, har tilgang ved behov for drift og feilretting. Leverandør er ikke valgt ennå.</li>
      </ul>

      <h3>Hvor lenge</h3>
      <ul className="plain">
        <li>Til eieren sletter husstanden, eller til den siste forlater den.</li>
        <li>{retentionText(days, connected, pending)}</li>
        <li>{tokenIdleText()}</li>
        <li>En fjernet enhet blir stående som «Tidligere medlem» med enhets-id, og endringene den gjorde blir liggende, til husstanden slettes.</li>
        <li>Sikkerhetskopier av serveren kan inneholde slettede data en tid etter slettingen. Hvor lenge er ikke endelig bestemt (forslag: 30 dager).</li>
      </ul>

      <h3>Det du kan gjøre</h3>
      <ul className="plain">
        <li><b>Se og ta med dataene:</b> «Last ned mine data» på Husstand-skjermen gir en fil (JSON) med alt på denne enheten og alt
          serveren har om husstanden. Nøkkelen er ikke med.</li>
        <li><b>Rette:</b> endre plan, innstillinger og etiketten din i appen.</li>
        <li><b>Slette:</b> eieren sletter husstanden og alle data på serveren (Husstand → Slett). Andre kan forlate husstanden.
          «Slett alt på denne enheten» på Husstand-skjermen fjerner det som er lagret her.</li>
        <li><b>Kontakt:</b> {contactText()}</li>
        <li><b>Tilbakemelding:</b> «Gi tilbakemelding» under Husstand → Hjelp åpner en e-post i din egen e-postapp. Appen sender
          ingenting selv og legger ingenting fra enheten inn i e-posten, men vi ser e-postadressen du sender fra.</li>
        <li><b>Klage:</b> du kan klage til Datatilsynet (datatilsynet.no).</li>
      </ul>
      <button className="ghost" onClick={onClose}>Lukk</button>
    </Sheet>
  );
}
