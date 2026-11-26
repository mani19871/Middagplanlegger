// Husstand → «Hjelp og tilbakemelding»: åpne introduksjonen igjen, og gi tilbakemelding med e-post fra brukerens egen
// e-postapp (mailto). mailto er upålitelig (ingen e-postapp, nettleser som blokkerer), så adressen står også som tekst
// med kopier-knapp. Appen sender ingenting selv og legger ingen opplysninger fra enheten i e-posten (feedback.ts).
import { useState } from 'react';
import { CONTACT_EMAIL, feedbackMailto } from './feedback';

export function HelpCard({ openIntro }: { openIntro?: () => void }) {
  const [copied, setCopied] = useState('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(CONTACT_EMAIL); setCopied('Adressen er kopiert.'); }
    catch { setCopied('Kopiering ble blokkert. Merk adressen og kopier selv.'); }
  };
  return (
    <>
      <h3 id="hjelp-tittel" tabIndex={-1}>Hjelp og tilbakemelding</h3>
      <div className="card">
        {openIntro && <>
          <button id="intro-igjen" className="ghost" onClick={openIntro}>Vis introduksjonen igjen</button>
          <p className="fine">Kort om demodata, allergier, husstand og personvern.</p>
        </>}
        <a className="ghost mail" href={feedbackMailto()}>✉ Gi tilbakemelding</a>
        <p className="fine">Åpner en ferdig påbegynt e-post i din egen e-postapp: hva du gjorde, hva som skjedde og hva du forventet.
          Appen sender ingenting selv, og ingenting fra enheten legges inn i e-posten. Du ser og kan endre alt før du sender, og vi ser e-postadressen du sender fra. Skriv
          ikke navn, allergier, nøkler eller invitasjonskoder.</p>
        <p className="fine">Åpnes ingen e-post, skriv til <b className="addr">{CONTACT_EMAIL}</b></p>
        <button className="ghost" onClick={copy}>📋 Kopier adressen</button>
        <p className="fine copied" role="status" aria-live="polite">{copied && `✓ ${copied}`}</p>
      </div>
    </>
  );
}
