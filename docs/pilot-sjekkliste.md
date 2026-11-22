# Pilotsjekkliste: før dere inviterer ekte familier

**Status: UTKAST, skrevet 2026-11-22.** For eieren av prosjektet, uten krav til teknisk bakgrunn. Dette er én samlet avkrysningsliste over alt som andre dokumenter sier må være på plass, pluss en testplan for selve pilotuka og hva som skal måles. Den er ikke juridisk rådgivning, og ingenting her er bestilt, avtalt eller utført hos noen leverandør.

**Hovedregel:** ingen ekte familie inviteres før alle punkter merket **STOPP** er krysset av. De andre punktene bør være gjort, men kan avtales bort med åpne øyne (skriv hvorfor i Merknad).

Kilder (les ved behov): [`synk.md`](synk.md) («Må på plass før ekte familier», «Kjente svakheter»), [`hosting.md`](hosting.md) (avsnitt 7 «Spørsmål eier må svare på», avsnitt 8 «Kjøre med Docker»), [`personvern/`](personvern/README.md) (seks utkast), [`fase1-status.md`](fase1-status.md) (kontroll mot godkjenningskriteriene), [`plan.md`](plan.md) (faser og kriterier), [`drift/`](drift/) (Compose-eksempel, Caddy, sikkerhetskopiskript).

## Slik bruker du listen

- **Ansvarlig:** *Eier* (du), *Drift* (den navngitte driftsansvarlige), *Utvikler*, *Fagperson* (jurist eller personvernrådgiver), *Redaktør* (den som kontrollerer varekoblinger og tilbud).
- **Status:** skriv ☐ ikke startet, ◐ pågår / utkast finnes, ☑ gjort. Forhåndsutfylt status viser hva som er gjort **i repoet** per 2026-11-22; ingenting er gjort i verden utenfor repoet med mindre det står.
- Der en kolonne sier «Navn», skriv en person, ikke en rolle. Et punkt uten navn er ikke eid.

## A. Beslutninger du må ta (Eier)

Ingen kan gjøre resten før disse er svart på. Hele listen med bakgrunn står i [`hosting.md`](hosting.md), avsnitt 7.

| # | Punkt | STOPP | Ansvarlig | Status | Merknad / svar |
| --- | --- | --- | --- | --- | --- |
| A1 | **Behandlingsansvarlig:** hvem er den juridiske parten (person, enkeltpersonforetak, AS)? Navn, organisasjonsnummer, adresse. Må tegne leverandøravtaler og stå i personvernerklæringen | STOPP | Eier | ☐ | |
| A2 | **Driftsansvarlig:** navn, og akseptabel responstid hvis appen er nede (samme dag / neste virkedag). Én person som får varsler og oppdaterer | STOPP | Eier | ☐ | |
| A3 | **Hosting:** velg leverandør og region i EØS (anbefalt: europeisk VPS, alternativ A i `hosting.md`; PaaS hvis ingen kan drifte). Månedlig tak i kroner | STOPP | Eier | ☐ | |
| A4 | **Konto og domene** eies av deg, ikke utvikleren. Hvilket domenenavn? To-faktor på begge kontoene | STOPP | Eier | ☐ | |
| A5 | **Personvernhenvendelser:** hvilken e-postadresse, og hvem svarer innen 30 dager? Opprett postkassen | STOPP | Eier | ☐ | |
| A6 | **Piloten:** lukket gruppe (invitasjon) eller åpen? Antall husstander, hvilke 3–5 områder, startdato. Betaling i piloten (anbefalt: nei) | | Eier | ☐ | |
| A7 | **Oppbevaringstid** for husstandsdata og hendelser etter siste bruk (forslag [12] måneder), loggtid ([14] dager), sikkerhetskopier ([30] dager). Se `personvern/01-oversikt-behandling.md`, avsnitt 4 | STOPP | Eier + Fagperson | ◐ forslag finnes | |
| A8 | **Aksepterer du pilotavgrensningen for allergier?** Kostkrav og allergier deles ikke mellom enheter (valg A). En voksen sin telefon uten filter kan lage en plan med allergener for hele husstanden; avbøtet med alltid synlig «Inneholder: …» og banner, ikke fjernet (`synk.md`, «Kostkrav og allergier»). Ja/nei, og at deltakerne får vite det | STOPP | Eier | ☐ | |
| A9 | **Nøkkel til sikkerhetskopiene:** hvem to personer holder den private nøkkelen (ikke på serveren), og hvor? | STOPP | Eier | ☐ | |
| A10 | **Tap av siste timer ved gjenoppretting:** er det akseptabelt at hver enhet må kobles på nytt etter en gjenoppretting som taper data (se C9)? Hvor ofte skal kopien tas (forslag: daglig)? | | Eier | ☐ | |
| A11 | **Tjek:** foreligger skriftlig avtale? Bruken er foreløpig bare live-visning i minnet, uten lagring. Legg avtalen i `phase0/tjek-avtale.md` når den finnes | | Eier | ☐ | Opplyst muntlig, ikke dokumentert i repoet |
| A12 | **Hvem kvalitetssikrer personverndokumentene** (jurist/rådgiver) og når? Se B1 | STOPP | Eier | ☐ | |

## B. Personvern og juss (Eier + Fagperson)

Alle personverndokumentene er **utkast skrevet av en utviklerassistent** og avstemt mot koden 2026-11-22. Ingenting er vurdert av en fagperson. Lovhenvisninger er fra generell kunnskap og merket «må verifiseres».

| # | Punkt | STOPP | Ansvarlig | Status | Se |
| --- | --- | --- | --- | --- | --- |
| B1 | **Fagperson har gjennomgått alle seks utkastene** og skriftlig sagt hva som må rettes | STOPP | Fagperson | ☐ | [personvern/README](personvern/README.md) |
| B2 | **Art. 9-vurdering:** (a) gjelder det kostkrav lagret bare på brukerens egen enhet i appen vår, og (b) kan plan, handleliste, beholdning og fritekst (etiketter, egne handlelinjer) indirekte avsløre helse eller livssyn slik at datasettet må behandles varsomt? | STOPP | Fagperson | ☐ | `01`, avsnitt 3 og 2b; `06` |
| B3 | **DPIA-terskelen** dokumentert og signert av behandlingsansvarlig (utkastet konkluderer trolig «ikke full DPIA i piloten, men DPIA-lett»). Datatilsynets fulle liste er ikke lest | STOPP | Eier + Fagperson | ◐ utkast | `03` |
| B4 | **Personvernerklæring** ferdig (fyll ut alle [hakeparenteser]), godkjent av fagperson og publisert på en fast adresse | STOPP | Eier + Fagperson | ◐ utkast | `02` |
| B5 | **Lenke til personvernerklæringen i appen** (på Husstand-skjermen, før opprettelse/innmelding). Finnes ikke i dag | STOPP | Utvikler | ☐ | `01`, avsnitt 6 |
| B6 | **Databehandleravtale** med hostingleverandør og med lagring av sikkerhetskopier, signert/godtatt, versjon og dato bevart. Underleverandørliste hentet. Overføringsgrunnlag hvis leverandøren har tilknytning utenfor EØS | STOPP | Eier | ☐ | `04` |
| B7 | **Register over databehandlere** opprettet | | Eier | ☐ | `04`, avsnitt 4 |
| B8 | **Behandlingsoversikt** (art. 30) er fylt ut med navn og kontakt, og listen over hvem som har tilgang er ført | | Eier | ◐ utkast | `01`, avsnitt 1 og 5 |
| B9 | **Rutine for innsyn, retting, sletting og avvik** er lest av den som svarer på henvendelser, og svarmal er klar. Merk: appen har ingen eksport, og identitetsbekreftelse uten konto er svak: fagperson må si om det holder | | Eier + Fagperson | ◐ utkast | `05` |
| B10 | **Ekomloven / lokal lagring:** fagperson bekrefter at lagring i nettleseren (inkl. enhetstoken) er innenfor unntaket, eller at samtykke trengs | | Fagperson | ☐ | `01`, avsnitt 6 |
| B11 | **Barn:** bekreft at piloten bare har voksne som brukere og at barn bare er etiketter uten navn (aldersgrensen for samtykke er ikke verifisert) | | Fagperson | ☐ | `06`, avsnitt 3 |
| B12 | **Deltakerinfo:** en kort tekst til pilotfamiliene om hva som lagres, at priser og butikker er demodata (D1), at filtre ikke deles, og at de kan slette alt. Be dem bruke etiketter, ikke navn | STOPP | Eier | ☐ | `02` |

## C. Drift og hosting (Drift)

Oppsettet er skrevet og prøvd i en sandkasse (Docker), **ikke hos en leverandør**. Se «Hva som er testet» i [`hosting.md`](hosting.md), avsnitt 8.

| # | Punkt | STOPP | Ansvarlig | Status | Se |
| --- | --- | --- | --- | --- | --- |
| C1 | **Server i EØS** bestilt (region bekreftet), med brannmur: bare 22 (fra kjente adresser), 80 og 443 åpne. Port 8787 skal **ikke** kunne nås utenfra | STOPP | Drift | ☐ | `hosting.md` 8 |
| C2 | **Domene** peker på serveren; **HTTPS** virker (Caddy henter sertifikat). Prøvd med ekte domene (ikke gjort: bare selvsignert `localhost`) | STOPP | Drift | ☐ | `drift/` |
| C3 | **`SYNC_SECRET`** laget (`openssl rand -hex 32`) og lagt i `.env.drift` (rettighet 600, ikke i git). **`TRUST_PROXY=1`** satt, og appen nås bare gjennom Caddy | STOPP | Drift | ◐ eksempel finnes | `hosting.md` 8; `synk.md` |
| C4 | **Varig volum** montert på `/data`; kontrollert at dataene overlever `docker restart` og at containeren kan byttes uten tap (prøvd i sandkasse: ja). **Kontroll etter hver omstart:** riktig volum (feil volum gir stille tom database) | STOPP | Drift | ◐ prøvd i sandkasse | `hosting.md` 8 |
| C5 | **Filrettigheter:** navngitt volum eller katalog eid av uid 1000, modus 700. Lokal disk, ikke nettverksdisk | | Drift | ◐ dokumentert | `hosting.md` 8 |
| C6 | **Daglig kryptert sikkerhetskopi** (`docs/drift/backup.sh` + cron), kopiert til separat lagring i EØS, med slettefrist. Privat nøkkel ikke på serveren | STOPP | Drift | ◐ skript prøvd lokalt | `hosting.md` 8 |
| C7 | **Gjenopprettingsøvelse** gjort på ekte server: fra kryptert kopi til kjørende app, tidtatt og skrevet ned (prosedyren er prøvd i sandkasse mot nytt volum) | STOPP | Drift | ☐ | `hosting.md` 8 |
| C8 | **Sletting i sikkerhetskopier:** rutine som sletter eller overskriver kopier innen fristen, og som sletter igjen husstander som er slettet etter kopitidspunktet hvis noe gjenopprettes | STOPP | Drift + Fagperson | ☐ | `05`, avsnitt 4 |
| C9 | **Gjenoppretting og enhetenes cursor:** etter en gjenoppretting som taper data slutter enheter å motta nye endringer uten feilmelding (funnet i test). Til klienten er rettet: skriv ned prosedyren «koble alle enheter fra og på igjen» og prøv den | STOPP | Drift + Utvikler | ☐ | `hosting.md` 8 |
| C10 | **Overvåking:** ekstern oppetidssjekk med varsel, diskvarsel, og varsel ved mange `5xx`. Uten innhold, token eller kode i varsler. Serveren har ingen helse-rute: sjekk `/` og (helst) en ny `GET /healthz` | STOPP | Drift | ☐ | `hosting.md` 3 |
| C11 | **Logger:** bekreft hva leverandøren, brannmuren og Caddy logger. Mål: ingen IP-adresser lagret mer enn [14] dager, ingen innhold | | Drift | ◐ eksempel uten tilgangslogg | `hosting.md` 3 |
| C12 | **Oppdateringer:** rutine for operativsystem og nytt image (ukentlig/månedlig), og regelen om å teste før Node-versjonen endres | | Drift | ◐ dokumentert | `hosting.md` 8 |
| C13 | **Node 22 og `node:sqlite` (eksperimentell):** versjonen er festet til 22.23.5. Beslutning om hva som gjøres før Node 22 går ut av støtte (hev, eller PostgreSQL) | | Eier + Utvikler | ◐ risiko dokumentert | `hosting.md` 8 |
| C14 | **Tilgang:** to-faktor på hosting-, domene- og GitHub-konto. Bare navngitte personer har serveren. Ingen delte passord | STOPP | Drift | ☐ | `personvern/01`, avsnitt 5 |
| C15 | **Rutine for personvernbrudd** kjent: hvem varsles, 72-timersfristen, avviksliste | | Drift + Eier | ◐ utkast | `05`, avsnitt 6 |

## D. Teknisk og sikkerhet (Utvikler)

Fra `synk.md` («Kjente svakheter» og «Må på plass før ekte familier») og funn under personvern- og driftsarbeidet. Disse er ikke utført av drift- og personvernøkta.

| # | Punkt | STOPP | Ansvarlig | Status | Se |
| --- | --- | --- | --- | --- | --- |
| D1 | **Demodata er merket.** Alle priser, butikker og aviser er demodata (CLAUDE.md regel 5), unntatt ekte tilbud fra Tjek. Piloten må ikke presentere noe av det som ekte pris eller sluttpris. Prismålene i planen (90 % ferske priser, ≤ 5 % avvik) **kan ikke måles** før ekte prisdata finnes (fase 0-porten) | STOPP | Eier + Utvikler | ◐ merket i appen | `fase1-status.md` |
| D2 | **Sikkerhetsgjennomgang** gjennomført (egen økt; `docs/sikkerhet.md` hvis den foreligger), inkl. **CSP-hode** mot XSS (tokenet ligger i `localStorage`), avhengigheter, og ratebegrensning (i minnet: bare én serverprosess) | STOPP | Utvikler | ☐ | `synk.md` |
| D3 | **Fjernede medlemmer:** rad med offentlig id og etikett beholdes til husstanden slettes. Tøm etikett ved fjerning, og slett gamle rader | | Utvikler | ☐ | `personvern/01`, avsnitt 8 |
| D4 | **Cursor etter gjenoppretting:** serveren oppgir siste løpenummer; klienten nullstiller cursor og legger lokal logg i utboksen på nytt når den er foran | | Utvikler | ☐ | `hosting.md` 8 |
| D5 | **Helse-rute** `GET /healthz` (`SELECT 1`, ingen innhold) til helsesjekk og oppetidsovervåking | | Utvikler | ☐ | `hosting.md` 8 |
| D6 | **Oppbevaring:** rutine som sletter husstander som er inaktive etter avtalt tid, og eventuelt komprimerer gamle uker; kvoter per husstand | STOPP hvis erklæringen lover det | Utvikler | ☐ | `synk.md`, `personvern/01` 4 |
| D7 | **Eksport** av husstandens data (JSON) for innsyn og portabilitet, eller en dokumentert manuell rutine som fagperson godtar | | Utvikler | ☐ | `personvern/05` 5 |
| D8 | **«Vis enhets-id»** på Husstand-skjermen, så brukere kan identifisere seg ved en henvendelse (eller annen bekreftelsesmåte) | | Utvikler | ☐ | `personvern/05` 3 |
| D9 | **Token-utløp/rotasjon** og/eller godkjenning av nye medlemmer (invitasjon uten godkjenning er en kjent svakhet) | | Utvikler | ☐ | `synk.md` |
| D10 | **Etiketter:** vurder faste forslag i stedet for fritekst for å redusere fare for navn og helseopplysninger | | Utvikler + Fagperson | ☐ | `personvern/01` 8 |
| D11 | **Sletting av lokale data** synlig også før første plan | | Utvikler | ☐ | `fase1-status.md` |
| D12 | **CI** grønn på hovedbranchen: typesjekk, vitest (inkl. synk-serveren), kontrast og bygg. Nettleserjobben (`e2e:sync`, `check:pwa`, `check:a11y`) er valgfri; kjør den for hånd før piloten | | Utvikler | ☑ jobbene finnes (ikke kjørt på GitHub-maskinene) | `.github/workflows/ci.yml` |
| D13 | **Skjermleser- og tastaturtest** av hele flyten på ekte telefon (automatiske sjekker finnes, men er ikke nok) | | Utvikler | ◐ automatiske sjekker | `fase1-status.md` |

## E. Produkt, innhold og avtaler (Eier + Redaktør)

| # | Punkt | STOPP | Ansvarlig | Status | Se |
| --- | --- | --- | --- | --- | --- |
| E1 | **Fase 0-porten:** er dekningen god nok til å love noe om pris i pilotområdene? Per `fase1-status.md` er det ingen ferske priser fra Rema 1000 og Coop, og Kiwi bare for 5 av 24 varer. Uten ekte prisdata: kjør piloten som test av plan, handleliste og synk, ikke av pris | STOPP | Eier | ◐ delvis | `phase0/RESULTS.md` |
| E2 | **Pilotområder** (3–5, by og distrikt) valgt | | Eier | ☐ | `plan.md` |
| E3 | **Rettigheter:** bare avtalte kilder; ingen kundeaviser hentes uten avtale (CLAUDE.md regel 6) | STOPP | Eier | ◐ bare Tjek live-visning | `THIRD_PARTY.md` |
| E4 | **Redaktør** har gått gjennom varekoblinger og regelfil for tilbud i pilotområdene | | Redaktør | ☐ | `CLAUDE.md` |

## F. Testplan for pilotuka: to telefoner, én handleuke

Før dere inviterer andre, kjører dere en uke selv, med to ekte telefoner. Den svarer på fase 1-kriteriet «planlegge, endre, handle offline og komme tilbake på nett uten doble kjøp» som i dag bare er bevist i test og på én maskin (`fase1-status.md`).

**Utstyr og oppsett**

- To telefoner (helst én iPhone og én Android), vanlig mobilnett (ikke bare wifi), appen installert på hjemskjermen. Én voksen på hver.
- Ferdig utrullet server (C1–C7), ny husstand, ingen ekte familiedata. Noen å ringe hvis noe går galt (Drift).
- Skriv logg underveis (felt i tabellene under). Ta skjermbilde av alt som ser feil ut, uten navn.
- Notér at nettleserlagring kan bli ryddet av telefonen hvis appen ikke åpnes på lenge, særlig i nettleser uten installasjon (må verifiseres per plattform); test at et token og lokale data overlever en dag uten bruk.

**Dag for dag**

| Dag | Hva som gjøres | Forventet resultat | Ok? | Notat |
| --- | --- | --- | --- | --- |
| 0 | Telefon A: åpne appen, lag ukeplan, opprett husstand («Husstand»). Telefon B: bli med via lenke eller kode | B vises i medlemslisten med etikett; koden virker én gang og utløper | | |
| 0 | **Begge** legger inn allergi/kostkrav hver for seg (også B uten filter til å begynne med) | Filtre deles ikke; B uten filter får banner; «Inneholder: …» vises på alle retter og handlelinjer | | |
| 1 | A planlegger uka og godkjenner listen; B ser planen og listen | Samme plan og samme handleliste på begge; samme sum | | |
| 1 | Begge endrer **samme dag** uten nett, så på nett igjen | Konflikt vises som tilstand, ingen stille overskriving; begge kan avgjøre | | |
| 1 | Begge endrer **ulike** dager | Flettes uten konflikt | | |
| 2–4 | Handling i butikk: A uten dekning krysser av og markerer «handlet»; B krysser av andre linjer samtidig | Etter at A er på nett igjen: alle avkrysninger hos begge, ingen dobbelte kjøp, tom utboks. «Avkrysset av …» viser riktig etikett | | |
| 2–4 | **Samme vare kjøpt av begge** (A og B markerer samme linje) | Ett kjøp. Ulikt antall gir «Konflikt» som må bekreftes | | |
| 2–4 | Ei vare er utsolgt: bruk «Utsolgt / fant ikke», velg erstatning på den ene og «hopp over» på den andre | Siste valg gjelder hos begge; ny pris eller ufullstendig kurv vises; ingen kjøp lages av «fant ikke» | | |
| 2–5 | Marker retter som «laget», bekreft rest, bruk «hjemme» | Beholdningen stemmer med det som faktisk er hjemme; neste ukes behov trekker fra riktig | | |
| 3 | A går i flymodus en hel dag og gjør 5–10 endringer, B gjør andre | Alt flettes ved gjenoppkobling; ingen tap, ingen duplikater; tid til synkronisert under ett minutt | | |
| 4 | Fjern B fra husstanden på A (eier), åpne appen på B | B får melding og kobles fra, beholder egne data | | |
| 5 | **Test av sletting:** A velger «Slett husstanden» (skriv SLETT). Kontroller på B og på serveren (Drift) | Husstanden er borte på serveren; B kobles fra; Drift bekrefter at radene er slettet (kaskade) | | |
| 6 | **Gjenopprettingsøvelse** (Drift), i tillegg: kopi → nytt volum → app | Gjenopprettet; enhetene slutter å motta nye endringer hvis kopien er eldre (C9): prøv prosedyren for å koble på igjen | | |
| 7 | Gjennomgang: hva forvirret, hva manglet, hvor mange feil | Skriv ned | | |

**Stoppregler under uka:** (1) alt som kan ha gitt feil allergeninformasjon, (2) tap av data (noe som var lagret, er borte), (3) en annens data synlig, (4) token eller kode i en logg eller skjermbilde. Stopp piloten og meld til Drift og Eier. Avvik skal føres i avviksliste (`personvern/05`, avsnitt 6).

## G. Hva som skal måles

Måltallene i planen er *mål som skal prøves, ikke målt ytelse*. Merk hva som kan måles nå og hva som ikke kan.

| Mål | Kilde | Hvordan måles | Forslag til terskel for å gå videre til flere familier | Kan måles med demodata? |
| --- | --- | --- | --- | --- |
| **Doble kjøp og tapte endringer** (fase 1: handle offline uten doble kjøp; fase 2: gjentatt bekreftelse dobler ikke beholdning) | `plan.md` fase 1–2 | Tell dubletter og manglende kjøp ved dagens og ukens slutt ved å sammenligne to telefoner og papirliste | 0 | Ja |
| **Synk etter frakobling** | `synk.md` | Sekunder fra nett til lik tilstand på begge; tom utboks | ≤ 60 s, 0 uløste feil | Ja |
| **Konflikter** | `synk.md` | Antall konflikter og om brukerne forsto dem uten hjelp | Alle løst uten tap av data | Ja |
| **Allergisikkerhet** | CLAUDE.md regel 4 | Tell planer laget på enhet uten filter som inneholdt allergen for noen i husstanden; om «Inneholder: …» og banneret ble sett (spør) | 0 uoppdagede tilfeller; ingen skade | Ja (allergendata er forenklet demodata: aldri en garanti) |
| **Ferskhet på priser** (≥ 90 % ferskt prisede linjer) | `plan.md` fase 2 | Andel handlelinjer med status annen enn «ukjent» og pris ikke eldre enn avtalt, per kjede og område | ≥ 90 % i pilotområdene | **Nei**: prisene er demodata. Ikke rapporter som ekte |
| **Prisavvik mot kassakjøp** (≤ 5 % median) | `plan.md` fase 2 | Familien noterer kvitteringsbeløp per varelinje for utvalgte handler; sammenlign med anslått | ≤ 5 % median, store avvik forklart | **Nei**: krever ekte prisdata og kvitteringer |
| **Butikk nummer to** | `plan.md` fase 2, risikotabellen | Hvor ofte familier faktisk besøker butikk nummer to når appen anbefaler det | Registrer; ingen fast terskel (tallet avgjør om fortrinnet holder) | Delvis (flyten, ikke prisen) |
| **Lokal avis og tilbud i planen** | `plan.md` fase 2 | Finner familien sin lokale avis, bruker et tilbud i planen, besøker butikk nummer to? Spør og observer | Flertallet klarer det uten hjelp | Delvis (aviser er demo; Tjek-tilbud er ekte) |
| **Bruk og forståelse** | `plan.md` | Tid til første godkjente plan; antall spørsmål til Eier; fem korte spørsmål til slutt (enkelt å bruke, forstod prisstatus, forstod «anslått», turte å stole på listen, ville brukt igjen) | Avgjøres av Eier etter første uke | Ja |
| **Drift** | `hosting.md` | Oppetid, antall `5xx`, databasestørrelse og vekst per uke, om sikkerhetskopi lyktes hver natt, tid brukt på gjenoppretting | Ingen uplanlagt nedetid > [avtalt] ; kopier hver natt; gjenoppretting innen [avtalt] | Ja |
| **Personvern** | `personvern/` | Antall som skrev navn eller helseopplysninger i etiketter eller egne linjer (spør deltakerne; ikke les produksjonsdata uten at de vet det), antall henvendelser om innsyn/sletting og svartid | 0 brudd; svar innen 30 dager | Ja |

**Ærlig rapportering:** skriv i sluttrapporten hva som ikke ble målt og hvorfor (særlig pris), og ikke la en vellykket synktest bli lest som «pilotkriteriene er oppfylt». Alle priser, butikker og de fleste aviser i appen er demodata inntil fase 0-porten er passert (`fase1-status.md`, `phase0/RESULTS.md`).

## H. Beslutning etter uka

| Spørsmål | Ja / Nei / Betinget | Dato | Hvem |
| --- | --- | --- | --- |
| Alle STOPP-punkter i A–E er krysset av eller avtalt bort skriftlig? | | | Eier |
| Testuka ga 0 tapte data, 0 doble kjøp, 0 allergisikkerhetsavvik? | | | Eier + Drift |
| Gjenoppretting er prøvd på ekte server, og tiden er akseptabel? | | | Drift |
| Fagperson har godkjent personverndokumentene (eller skrevet hva som må endres)? | | | Fagperson |
| Inviter en første, liten gruppe familier (forslag: 3–5 husstander) | | | Eier |
