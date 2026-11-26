// Introduksjon for nye brukere i piloten: fem korte steg øverst på siden, første gang appen åpnes på en enhet (markøren
// `introSeen` i AppState, lokal og aldri synket; se store.ts). Ikke en modal: appen under kan brukes hele tiden, og
// introduksjonen kan hoppes over. Åpnes igjen fra Husstand → «Hjelp og tilbakemelding».
// Tilgjengelighet: et navngitt område (region), «Steg n av N» som tekst, vanlige knapper, og fokus på stegets overskrift
// ved bytte av steg (focusAfterRender), så tastatur- og skjermleserbrukere hører det nye steget.
// Tekstene bygger på docs/pilot-deltakerinfo.md og sier bare det koden gjør: ingen garanti om allergener (regel 4),
// demodata merket (regel 5), ingen svarfrist, og personvern-arket omtales som utkast.
import { useState } from 'react';
import { focusAfterRender } from './focus';

export type IntroAction = 'filter' | 'husstand' | 'personvern';
export interface IntroStep { title: string; text: string[]; action?: { kind: IntroAction; label: string } }

export const INTRO_STEPS: IntroStep[] = [
  {
    title: 'Velkommen til Husvett',
    text: [
      'Husvett hjelper dere å planlegge middagene for uka: en ukeplan, én handleliste, et anslag over hva handlekurven koster, og tilbud fra kundeaviser.',
      'Flere voksne kan dele samme plan og liste. Appen virker også uten nett, og uten husstand lagres alt bare på denne enheten.',
    ],
  },
  {
    title: 'En pilot med demodata',
    text: [
      'Dette er en lukket pilot. Butikkene, prisene og avisene merket «demo» er DEMODATA, altså oppdiktet. Oppskriftene er demooppskrifter eller utkast skrevet for Husvett med hjelp av KI, og de er ikke testkokt.',
      'Summen er alltid anslått, ikke en pris du kan regne med i butikken.',
      'Tilbud og kundeaviser fra Tjek er ekte og vises med «Kilde: Tjek» og dato. De kan likevel være utgått eller ha vilkår, så sjekk i butikken.',
    ],
  },
  {
    title: 'Allergier: les dette',
    text: [
      'Appen kan aldri garantere at en rett eller vare er fri for allergener. Allergenene i oppskriftene er ikke kontrollert av en person. Les alltid varedeklarasjonen på varen.',
      'Allergier og kostkrav lagres bare på denne enheten og deles ikke i husstanden. Legg dem inn på hver enhet som lager planer.',
      'Når et allergi- eller kostfilter er på, skjules oppskrifter som ikke er kontrollert ennå, og appen sier hvor mange.',
    ],
    action: { kind: 'filter', label: 'Legg inn allergier og kostkrav' },
  },
  {
    title: 'Del med husstanden',
    text: [
      'Vil flere voksne dele plan og handleliste, trykker én av dere «Opprett husstand» under Husstand (🏠 øverst). Ingen konto, passord eller e-post.',
      'Bare eieren av husstanden kan invitere. Eieren lager en invitasjonskode som virker én gang og i 24 timer. Den andre skriver koden under «Bli med», eller åpner lenken.',
      'Bruk etiketter som «Voksen 1», ikke navn.',
    ],
    action: { kind: 'husstand', label: 'Gå til Husstand' },
  },
  {
    title: 'Personvern og dine data',
    text: [
      'På Husstand-skjermen finner du «Personvern» (hva som lagres hvor, og hvor lenge; teksten er et utkast), «Last ned mine data» og «Slett alt på denne enheten».',
      'Der, under «Hjelp og tilbakemelding», kan du også åpne denne introduksjonen igjen og gi oss tilbakemelding.',
    ],
    action: { kind: 'personvern', label: 'Les om personvern' },
  },
];

interface Props {
  onClose: () => void; goFilter: () => void; goHousehold: () => void; openPrivacy: () => void;
  /** Steget som vises først (tester og serverrendering). */
  initialStep?: number;
}

export default function Intro({ onClose, goFilter, goHousehold, openPrivacy, initialStep = 0 }: Props) {
  const [i, setI] = useState(() => Math.min(Math.max(0, initialStep), INTRO_STEPS.length - 1));
  const step = INTRO_STEPS[i];
  const last = i === INTRO_STEPS.length - 1;
  const go = (n: number) => { setI(n); focusAfterRender('intro-tittel'); };
  const act = { filter: goFilter, husstand: goHousehold, personvern: openPrivacy };
  return (
    <section className="card intro" aria-label="Introduksjon til Husvett">
      <p className="fine introstep">Steg {i + 1} av {INTRO_STEPS.length}</p>
      <h2 id="intro-tittel" tabIndex={-1}>{step.title}</h2>
      {step.text.map((t) => <p key={t}>{t}</p>)}
      {step.action && <button className="link" onClick={act[step.action.kind]}>{step.action.label}</button>}
      <div className="intronav">
        {i > 0 && <button className="ghost" onClick={() => go(i - 1)}>← Forrige</button>}
        {last
          ? <button className="ghost primary" onClick={onClose}>Ferdig</button>
          : <button className="ghost primary" onClick={() => go(i + 1)}>Neste →</button>}
        {!last && <button className="link skip" onClick={onClose}>Hopp over introduksjonen</button>}
      </div>
    </section>
  );
}
