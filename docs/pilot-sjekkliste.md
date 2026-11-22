# Pilotsjekkliste: før dere inviterer ekte familier

**Status: UTKAST, skrevet 2026-11-22; eierens beslutninger fra samme dag er ført inn i del A (se «Beslutninger 2026-11-22» under).** For eieren av prosjektet, uten krav til teknisk bakgrunn. Dette er én samlet avkrysningsliste over alt som andre dokumenter sier må være på plass, pluss en testplan for selve pilotuka og hva som skal måles. Den er ikke juridisk rådgivning, og ingenting her er bestilt, avtalt eller utført hos noen leverandør.

**Hovedregel:** ingen ekte familie inviteres før alle punkter merket **STOPP** er krysset av. De andre punktene bør være gjort, men kan avtales bort med åpne øyne (skriv hvorfor i Merknad).

Kilder (les ved behov): [`synk.md`](synk.md) («Må på plass før ekte familier», «Kjente svakheter»), [`hosting.md`](hosting.md) (avsnitt 7 «Spørsmål eier må svare på», avsnitt 8 «Kjøre med Docker»), [`personvern/`](personvern/README.md) (seks utkast), [`fase1-status.md`](fase1-status.md) (kontroll mot godkjenningskriteriene), [`plan.md`](plan.md) (faser og kriterier), [`drift/`](drift/) (Compose-eksempel, Caddy, sikkerhetskopiskript).

## Beslutninger 2026-11-22 (kort)

Kilde: eierens svar i koordineringschatten 2026-11-22. Ført inn i A og E under.

| Spørsmål | Svar | Uavklart |
| --- | --- | --- |
| Behandlingsansvarlig | **AVVR AS, org.nr. 935941644**, Smedalsvegen 14, 2067 Jessheim (Ullensaker) | Adressen er slått opp 2026-11-22 (forretningsadresse fra Enhetsregisteret (data.brreg.no, `/enhetsregisteret/api/enheter/935941644`), oppslag 2026-11-22); eier bør bekrefte at den skal stå i erklæringen |
| Driftsansvarlig | **«Admin» (rolle).** Rollen navngis ikke i dokumentene | Responstid er ikke bestemt (la stå uavklart) |
| Kontakt-e-post for personvern | **kontakt@husvett.no** (felles adresse oppgitt av eieren 2026-11-22 til personvern og innsyn) | **Ikke bekreftet at postkassen er opprettet eller virker.** Hvem som svarer og responstid er ikke bestemt |
| Domene | **husvett.no** (eierens beslutning 2026-11-22). Appen kan ligge på `husvett.no` og/eller `www.husvett.no`: **husvett.no er hovedadresse, `www.` omdirigeres dit** (`docs/drift/Caddyfile`) | **Ikke bekreftet at domenet er kjøpt** (ingenting er bestilt av oss), at det står i AVVR AS sitt navn, eller at DNS peker på serveren. **Appens navn er «Husvett»** (eierens beslutning 2026-11-22), ført inn i appen; navnetilgjengelighet og varemerke er **ikke sjekket av oss** (se E5). Veiledning: `hosting.md`, «Slik velger og kjøper du et .no-domene» |
| Hosting | Ikke valgt. Eier spurte om «webhotel» | Se [`hosting.md`](hosting.md), avsnitt 0 «Webhotel eller VPS?» |
| Pilot | **Lukket pilot, hele Norge** | Antall husstander, startdato |
| Oppbevaring av inaktive husstander | **730 dager** (`SYNC_RETENTION_DAYS=730`) | Logger og sikkerhetskopier |
| Innloggingens levetid (enhetstoken) | **730 dager** uten bruk (`SYNC_TOKEN_IDLE_DAYS`, standard i koden 730), samme som oppbevaringstiden. Avgjort, se D15 | – |
| Nøkkel til sikkerhetskopiene | Eier vil ha hjelp til oppsett | Hvem de to personene er |
| Allergi-begrensningen (valg A) | **Godtatt** for piloten | – |
| Fagperson-gjennomgang | **Ikke nå;** bare lukket pilot | Se B1: punktet er fortsatt STOPP |
| Eier godkjenner nye medlemmer | **Nei,** invitasjonen holder | – |
| Skriftlig Tjek-avtale | Finnes og er «ok», men er **fortrolig og deles ikke**. Eier (2026-11-22): tillater **lagring av priser**, **bilder og avissider**, dekker **alle kjeder Tjek har** og **bruk i appen for andre brukere** (eiers opplysning, ikke avtaletekst vi har sett) | **Kreditering, kallgrense, varighet og pris** ikke kjent for oss; må bekreftes med Tjek (`phase0/tjek-avtale.md`) |
| Henvendelser til kjeder og Tjek (`phase0/utkast/`) | **Skal ikke sendes** nå | – |

## Slik bruker du listen

- **Ansvarlig:** *Eier* (du), *Drift* (den navngitte driftsansvarlige), *Utvikler*, *Fagperson* (jurist eller personvernrådgiver), *Redaktør* (den som kontrollerer varekoblinger og tilbud).
- **Status:** skriv ☐ ikke startet, ◐ pågår / utkast finnes, ☑ gjort. Forhåndsutfylt status viser hva som er gjort **i repoet** per 2026-11-22; ingenting er gjort i verden utenfor repoet med mindre det står.
- Der en kolonne sier «Navn», skriv en person, ikke en rolle. Et punkt uten navn er ikke eid.

## A. Beslutninger du må ta (Eier)

Ingen kan gjøre resten før disse er svart på. Hele listen med bakgrunn står i [`hosting.md`](hosting.md), avsnitt 7.

| # | Punkt | STOPP | Ansvarlig | Status | Merknad / svar |
| --- | --- | --- | --- | --- | --- |
| A1 | **Behandlingsansvarlig:** hvem er den juridiske parten (person, enkeltpersonforetak, AS)? Navn, organisasjonsnummer, adresse. Må tegne leverandøravtaler og stå i personvernerklæringen | STOPP | Eier | ☑ | **AVVR AS, org.nr. 935941644** (2026-11-22). Forretningsadresse: **Smedalsvegen 14, 2067 Jessheim (Ullensaker)**, forretningsadresse fra Enhetsregisteret (data.brreg.no, `/enhetsregisteret/api/enheter/935941644`), oppslag 2026-11-22 (bare selskapets registrerte adresse; ingen privatpersoners opplysninger er ført inn). AVVR AS må også være kontoeier og part i leverandøravtalene |
| A2 | **Driftsansvarlig:** rolle (ikke navn), og akseptabel responstid hvis appen er nede (samme dag / neste virkedag). Én person i rollen får varsler og oppdaterer | STOPP | Eier | ◐ | **«Admin» (rolle)** (2026-11-22). Eier: rollen skal ikke navngis, så personen føres ikke inn i dokumentene. **Responstid er ikke bestemt: UAVKLART** |
| A3 | **Hosting:** velg leverandør og region i EØS (anbefalt: europeisk VPS, alternativ A i `hosting.md`; PaaS hvis ingen kan drifte). Månedlig tak i kroner | STOPP | Eier | ☐ | Ikke valgt. Et vanlig webhotel passer ikke; se `hosting.md`, avsnitt 0 |
| A4 | **Konto og domene** eies av deg, ikke utvikleren. Hvilket domenenavn? To-faktor på begge kontoene | STOPP | Eier | ◐ | **Avgjort: domenenavnet er `husvett.no`** (eier, 2026-11-22); hovedadresse `husvett.no`, `www.husvett.no` omdirigeres (Caddyfile, `DOMENE=husvett.no` i `env.eksempel`). **Gjenstår, ikke bekreftet:** at domenet er kjøpt (ledig? bestilt?) og står i AVVR AS sitt navn, to-faktor på registrar-kontoen, og DNS (A/AAAA for både `husvett.no` og `www.husvett.no`, først når serveren finnes, A3). Kryss av først når kjøpet er gjort. Navnet i appen er «Husvett» (se E5). Veiledning: `hosting.md`, «Slik velger og kjøper du et .no-domene» |
| A5 | **Personvernhenvendelser:** hvilken e-postadresse, og hvem svarer innen 30 dager? Opprett postkassen | STOPP | Eier | ◐ | **Avgjort: `kontakt@husvett.no`** (felles adresse oppgitt av eieren 2026-11-22; brukes bare i personverndokumentene og personvern-arket i appen). **Gjenstår, ikke bekreftet:** at postkassen er opprettet og virker (krever domenet, A4; send en prøvemelding utenfra og se at den kommer fram), hvem som svarer innen 30 dager, og hvilken leverandør som drifter e-posten (mulig databehandler, `personvern/04-databehandleravtaler-sjekkliste.md`). Arket «Personvern» i appen sier fortsatt «ikke bekreftet at postkassen er i drift» til dette er gjort (`draftNoticeText` i `src/views/PrivacySheet.tsx`) |
| A6 | **Piloten:** lukket gruppe (invitasjon) eller åpen? Antall husstander, hvilke 3–5 områder, startdato. Betaling i piloten (anbefalt: nei) | | Eier | ◐ | **Lukket pilot, hele Norge** (2026-11-22). Antall husstander, startdato og betaling ikke avgjort |
| A7 | **Oppbevaringstid** for husstandsdata og hendelser etter siste bruk, loggtid ([14] dager), sikkerhetskopier ([30] dager). Se `personvern/01-oversikt-behandling.md`, avsnitt 4 | STOPP | Eier + Fagperson | ◐ | **Inaktive husstander: 730 dager** (2026-11-22), settes som `SYNC_RETENTION_DAYS=730` i `.env.drift`; 730 er også standarden i koden. Logger og sikkerhetskopier ikke avgjort. Tokenutløpet er satt til samme tid (D15, avgjort) |
| A8 | **Aksepterer du pilotavgrensningen for allergier?** Kostkrav og allergier deles ikke mellom enheter (valg A). En voksen sin telefon uten filter kan lage en plan med allergener for hele husstanden; avbøtet med alltid synlig «Inneholder: …» og banner, ikke fjernet (`synk.md`, «Kostkrav og allergier»). Ja/nei, og at deltakerne får vite det | STOPP | Eier | ☑ | **Godtatt** (2026-11-22). Deltakerne må fortsatt få vite det (B12) |
| A9 | **Nøkkel til sikkerhetskopiene:** hvem to personer holder den private nøkkelen (ikke på serveren), og hvor? | STOPP | Eier | ☐ | Eier vil ha hjelp til oppsett (2026-11-22). Fremgangsmåte: `hosting.md`, avsnitt 0, steg 6. De to personene er ikke valgt |
| A10 | **Tap av siste timer ved gjenoppretting:** er det akseptabelt at hver enhet må kobles på nytt etter en gjenoppretting som taper data (se C9)? Hvor ofte skal kopien tas (forslag: daglig)? | | Eier | ☐ | |
| A11 | **Tjek:** foreligger skriftlig avtale, og hva dekker den? Svarene føres i `phase0/tjek-avtale.md` (avtalen selv er fortrolig) | | Eier | ◐ | Eier: avtalen finnes, er «ok», men er **fortrolig og deles ikke** (2026-11-22). Eier opplyser samme dag at den tillater lagring av priser, bilder og avissider, dekker alle kjeder Tjek har og bruk i appen for andre brukere. **Gjenstår:** bekreft med Tjek kreditering, kallgrense, varighet og pris (og hvor lenge priser kan lagres). Tjeks offentlige vilkår er lest (`phase0/tjek-avtale.md`) |
| A12 | **Hvem kvalitetssikrer personverndokumentene** (jurist/rådgiver) og når? Se B1 | STOPP | Eier | ☐ | **Ikke nå;** eier vil bare kjøre lukket pilot (2026-11-22). Se B1 |

## B. Personvern og juss (Eier + Fagperson)

Alle personverndokumentene er **utkast skrevet av en utviklerassistent** og avstemt mot koden 2026-11-22. Ingenting er vurdert av en fagperson. Lovhenvisninger er fra generell kunnskap og merket «må verifiseres».

| # | Punkt | STOPP | Ansvarlig | Status | Se |
| --- | --- | --- | --- | --- | --- |
| B1 | **Fagperson har gjennomgått alle seks utkastene** og skriftlig sagt hva som må rettes | STOPP | Fagperson | ☐ | [personvern/README](personvern/README.md). Eier har bestemt «ikke nå, bare lukket pilot» (2026-11-22). Etter hovedregelen øverst er punktet fortsatt åpent: skal piloten starte uten, må eier skrive det i del H, med begrunnelse. B2, B3 og B10 forutsetter også en fagperson |
| B2 | **Art. 9-vurdering:** (a) gjelder det kostkrav lagret bare på brukerens egen enhet i appen vår, og (b) kan plan, handleliste, beholdning og fritekst (etiketter, egne handlelinjer) indirekte avsløre helse eller livssyn slik at datasettet må behandles varsomt? | STOPP | Fagperson | ☐ | `01`, avsnitt 3 og 2b; `06` |
| B3 | **DPIA-terskelen** dokumentert og signert av behandlingsansvarlig (utkastet konkluderer trolig «ikke full DPIA i piloten, men DPIA-lett»). Datatilsynets fulle liste er ikke lest | STOPP | Eier + Fagperson | ◐ utkast | `03` |
| B4 | **Personvernerklæring** ferdig (fyll ut alle [hakeparenteser]), godkjent av fagperson og publisert på en fast adresse | STOPP | Eier + Fagperson | ◐ utkast | `02` |
| B5 | **Lenke til personvernerklæringen i appen** (på Husstand-skjermen, før opprettelse/innmelding). Bygget: arket «Personvern» (`src/views/PrivacySheet.tsx`) nås fra Husstand-skjermen (også før opprettelse) og fra bunnen av hver side, merket UTKAST og «ikke ferdig vurdert av fagperson». Teksten må byttes når erklæringen er godkjent (B4) | STOPP | Utvikler | ◐ utkast i appen | `01`, avsnitt 6 |
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
| C6 | **Daglig kryptert sikkerhetskopi** (`docs/drift/backup.sh` + cron) av **både** `middag.sqlite` og `tilbud.sqlite` (prishistorikk fra Tjek), kopiert til separat lagring i EØS, med slettefrist. Privat nøkkel ikke på serveren. Gjenopprettingsøvelsen skal ta med tilbudsfila | STOPP | Drift | ◐ skript prøvd lokalt; `npm run check:backup` (begge databasene, uten Docker) | `hosting.md` 8 |
| C7 | **Gjenopprettingsøvelse** gjort på ekte server: fra kryptert kopi til kjørende app, tidtatt og skrevet ned (prosedyren er prøvd i sandkasse mot nytt volum) | STOPP | Drift | ☐ | `hosting.md` 8 |
| C8 | **Sletting i sikkerhetskopier:** rutine som sletter eller overskriver kopier innen fristen, og som sletter igjen husstander som er slettet etter kopitidspunktet hvis noe gjenopprettes. Husstander slettet for inaktivitet slettes igjen av seg selv ved oppstart etter en gjenoppretting; husstander slettet av eieren gjør ikke det (`hosting.md` 8, «Slettefrist for sikkerhetskopier») | STOPP | Drift + Fagperson | ◐ delvis dokumentert | `05`, avsnitt 4 |
| C9 | **Gjenoppretting og enhetenes cursor:** rettet i klienten (serveren svarer `reset`, enhetene sender sitt på nytt; e2e-prøvd). Plan og innstillinger flettes tre-veis etter gjenoppretting, og ankeret dekker hele cursoren (S1 og S2 i `kodegjennomgang.md`, rettet og testet 2026-11-22). Ta med i gjenopprettingsøvelsen at alle enheter viser «Synket» etterpå, og at plan og innstillinger er like på alle enheter (eller viser en konflikt å avgjøre) | STOPP | Drift + Utvikler | ☐ | `hosting.md` 8 |
| C10 | **Overvåking:** ekstern oppetidssjekk med varsel, diskvarsel, og varsel ved mange `5xx`. Uten innhold, token eller kode i varsler. Bruk `GET /healthz` (`SELECT 1`, ingen innhold) | STOPP | Drift | ☐ | `hosting.md` 3 |
| C11 | **Logger:** bekreft hva leverandøren, brannmuren og Caddy logger. Mål: ingen IP-adresser lagret mer enn [14] dager, ingen innhold | | Drift | ◐ eksempel uten tilgangslogg | `hosting.md` 3 |
| C12 | **Oppdateringer:** rutine for operativsystem og nytt image (ukentlig/månedlig), og regelen om å teste før Node-versjonen endres | | Drift | ◐ dokumentert | `hosting.md` 8 |
| C13 | **Node 22 og `node:sqlite` (eksperimentell):** versjonen er festet til 22.23.5. Beslutning om hva som gjøres før Node 22 går ut av støtte (hev, eller PostgreSQL) | | Eier + Utvikler | ◐ risiko dokumentert | `hosting.md` 8 |
| C14 | **Tilgang:** to-faktor på hosting-, domene- og GitHub-konto. Bare navngitte personer har serveren. Ingen delte passord | STOPP | Drift | ☐ | `personvern/01`, avsnitt 5 |
| C15 | **Rutine for personvernbrudd** kjent: hvem varsles, 72-timersfristen, avviksliste | | Drift + Eier | ◐ utkast | `05`, avsnitt 6 |

## D. Teknisk og sikkerhet (Utvikler)

Fra `synk.md` («Kjente svakheter» og «Må på plass før ekte familier») og funn under personvern- og driftsarbeidet. Disse er ikke utført av drift- og personvernøkta.

| # | Punkt | STOPP | Ansvarlig | Status | Se |
| --- | --- | --- | --- | --- | --- |
| D1 | **Demodata er merket.** Alle priser, butikker og aviser er demodata (CLAUDE.md regel 5), unntatt ekte tilbud, produktbilder og kundeaviser fra Tjek («Tilbud nå», «Aviser fra Tjek», merket «Kilde: Tjek»). Piloten må ikke presentere noe av det som ekte pris eller sluttpris. Prismålene i planen (90 % ferske priser, ≤ 5 % avvik) **kan ikke måles** før ekte prisdata finnes (fase 0-porten) | STOPP | Eier + Utvikler | ◐ merket i appen | `fase1-status.md` |
| D2 | **Sikkerhetsgjennomgang** gjennomført (egen økt; `docs/sikkerhet.md` hvis den foreligger), inkl. **CSP-hode** mot XSS (tokenet ligger i `localStorage`), avhengigheter, og ratebegrensning (i minnet: bare én serverprosess) | STOPP | Utvikler | ☐ | `synk.md` |
| D3 | **Fjernede medlemmer:** rad med offentlig id og etikett beholdes til husstanden slettes. Tøm etikett ved fjerning, og slett gamle rader | | Utvikler | ☐ | `personvern/01`, avsnitt 8 |
| D4 | **Cursor etter gjenoppretting:** serveren oppgir siste løpenummer (`head`) og sjekker anker; klienten nullstiller cursor og legger lokal logg i utboksen på nytt (bygget, `docs/synk.md`) | | Utvikler | ☑ | `hosting.md` 8 |
| D5 | **Helse-rute** `GET /healthz` (`SELECT 1`, ingen innhold) til helsesjekk og oppetidsovervåking (bygget; Dockerfile bruker den) | | Utvikler | ☑ | `hosting.md` 8 |
| D6 | **Oppbevaring:** rutine som sletter husstander som er inaktive etter avtalt tid, og eventuelt komprimerer gamle uker; kvoter per husstand. Bygget: `server/retention.ts`, `SYNC_RETENTION_DAYS` (standard 730 = eierens valg 2026-11-22, `0` = av, ugyldig verdi gir 730 med advarsel), ved oppstart og hver 6. time, samme sletting som «Slett husstanden». Gamle uker komprimeres ikke. Fristen må avgjøres (A7) | STOPP hvis erklæringen lover det | Utvikler | ◐ bygget, frist ikke avgjort | `synk.md`, `personvern/01` 4 |
| D7 | **Eksport** av husstandens data (JSON) for innsyn og portabilitet, eller en dokumentert manuell rutine som fagperson godtar. Bygget: «Last ned mine data» på Husstand-skjermen (enhetens data + `GET /api/household/export`) | | Utvikler | ☑ | `personvern/05` 5 |
| D8 | **«Vis enhets-id»** på Husstand-skjermen, så brukere kan identifisere seg ved en henvendelse (eller annen bekreftelsesmåte). Bygget (også i personvern-arket). Fortsatt svak identitetsbekreftelse: id-en er synlig for alle medlemmer | | Utvikler | ☑ | `personvern/05` 3 |
| D9 | **Token-utløp/rotasjon** og/eller godkjenning av nye medlemmer (invitasjon uten godkjenning er en kjent svakhet). Glidende utløp finnes (730 dager, D15); bare eier inviterer. «Eier godkjenner nye medlemmer» er utsatt (ikke bygget, `synk.md`) | | Utvikler | ◐ | `synk.md`. **Eier: godkjenning av nye medlemmer trengs ikke, invitasjonen holder** (2026-11-22). Rotasjon er ikke bygget. Utløpet er avgjort i D15 |
| D10 | **Etiketter:** vurder faste forslag i stedet for fritekst for å redusere fare for navn og helseopplysninger | | Utvikler + Fagperson | ☐ | `personvern/01` 8 |
| D11 | **Sletting av lokale data** synlig også før første plan. Bygget: «Slett alt på denne enheten …» på Husstand-skjermen, med bekreftelse | | Utvikler | ☑ | `fase1-status.md` |
| D12 | **CI** grønn på hovedbranchen: typesjekk, vitest (inkl. synk-serveren), kontrast, bygg, bygg av serveren og røyktest av produksjonsbygget, og `npm audit --omit=dev` (siste blokkerer ikke). Nettleserjobben (`e2e:sync`, `check:pwa`, `check:a11y`, og CSP/PWA/e2e mot det bygde serveren) og imagejobben (`docker build`, start, helsesjekk) er valgfrie; kjør dem for hånd før piloten | | Utvikler | ☑ jobbene finnes (ikke kjørt på GitHub-maskinene) | `.github/workflows/ci.yml` |
| D13 | **Skjermleser- og tastaturtest** av hele flyten på ekte telefon (automatiske sjekker finnes, men er ikke nok) | | Utvikler | ◐ automatiske sjekker | `fase1-status.md` |
| D14 | **Produksjonsbygg av serveren:** `npm run build:server` (esbuild, én fil), `npm start`, slankt flertrinns Docker-image uten `node_modules`/tsx (417 → 200 MB; 107 → 54 MB komprimert), `docker stop` ryddig (SIGTERM). Prøvd i sandkasse mot Compose, backup og gjenoppretting; `check:csp`, `check:pwa` og `e2e-sync` består mot bygget | | Utvikler | ☑ prøvd i sandkasse | `hosting.md` 8; `sikkerhet.md` S17 |
| D15 | **Tokenutløp og oppbevaringstid:** et enhetstoken slutter å virke etter så mange dager uten bruk (`SYNC_TOKEN_IDLE_DAYS`); glidende, hver bruk forlenger. Tidligere standard var 180 dager, kortere enn oppbevaringstiden på 730 dager: ingen kunne da åpne, eksportere eller slette en husstand i appen i rundt 550 dager mens dataene lå på serveren | STOPP (del av A7) | Eier + Utvikler | ☑ | **Avgjort av eier 2026-11-22: innloggingens levetid er 730 dager**, samme som oppbevaringstiden for inaktive husstander. Gjort: standarden i koden er nå 730 (`DEFAULT_TOKEN_IDLE_DAYS` i `server/retention.ts`; ugyldig verdi gir 730 med advarsel, `0` = aldri utløp); `SYNC_TOKEN_IDLE_DAYS=730` står i `docs/drift/env.eksempel`; arket «Personvern» i appen sier 730 dager (også reservetekst for oppbevaringstid: ikke lenger «12 måneder»); personvern-dokumentene er rettet. Testet i `server/sync/api.test.ts` («tokenutløp») og `src/views/privacyText.test.ts`. **Ulempe eier har akseptert:** en glemt eller mistet telefon har gyldig nøkkel i opptil to år til eieren fjerner enheten (ingen rotasjon, D9). Standarden for `SYNC_RETENTION_DAYS` i koden er også 730 (oppdatert etter eierens beslutning samme dag), så de to frister følger hverandre selv om `.env.drift` ikke setter dem |
| D16 | **Bilder fra Tjek og IP-adresser** (mulig senere tiltak): i dag henter brukerens nettleser produktbilder og avissider direkte fra Tjeks verter (`TJEK_IMAGE_HOSTS`), så Tjek ser IP-adressen (`docs/personvern/01-oversikt-behandling.md`). Beslutning 2026-11-22: ingen bildeproxy nå (ny angrepsflate, SSRF og last). Vurder en bildeproxy på serveren hvis fagperson eller Tjek krever at brukernes IP ikke når Tjek | | Eier + Utvikler | ☐ senere | `docs/sikkerhet.md` S22 |

## E. Produkt, innhold og avtaler (Eier + Redaktør)

| # | Punkt | STOPP | Ansvarlig | Status | Se |
| --- | --- | --- | --- | --- | --- |
| E1 | **Fase 0-porten:** er dekningen god nok til å love noe om pris i pilotområdene? Per `fase1-status.md` er det ingen ferske priser fra Rema 1000 og Coop, og Kiwi bare for 5 av 24 varer. Uten ekte prisdata: kjør piloten som test av plan, handleliste og synk, ikke av pris | STOPP | Eier | ◐ delvis | `phase0/RESULTS.md` |
| E2 | **Pilotområder** (3–5, by og distrikt) valgt | | Eier | ☑ | `plan.md`. **Hele Norge, lukket pilot** (2026-11-22). Pris kan uansett ikke måles (E1) |
| E3 | **Rettigheter:** bare avtalte kilder; ingen kundeaviser hentes uten avtale (CLAUDE.md regel 6) | STOPP | Eier | ◐ bare Tjek | `THIRD_PARTY.md`. Offentlige vilkår lest 2026-11-22: Tjek-API for kunder med avtale. Eier opplyser (2026-11-22) at avtalen tillater lagring av priser, bilder og avissider for alle kjeder Tjek har; kreditering, kallgrense, varighet og pris er ikke kjent for oss og må bekreftes med Tjek. Meny, SPAR og Joker krever skriftlig samtykke for bruk av innhold; om det er klarert gjennom Tjek, er ikke kjent for oss; ingen kjede gir offentlig tillatelse (`phase0/kundeavis-rettigheter.md`). Aviser hentes aldri fra kjedenes nettsteder |
| E4 | **Redaktør** har gått gjennom varekoblinger og regelfil for tilbud i pilotområdene | | Redaktør | ☐ | `CLAUDE.md` |
| E5 | **Navn og varemerke «Husvett»:** navnet er valgt av eieren (2026-11-22), men **navnetilgjengelighet og varemerke er ikke sjekket av oss**: søk i Patentstyrets varemerkeregister (og vurder registrering), at `husvett.no` faktisk er kjøpt (A4) og andre domener/toppnivåer, kontonavn og eventuelle appbutikker (App Store, Google Play) og sosiale medier, og om navnet ligner et eksisterende varemerke eller selskap. Kryss av først når dette er sjekket av eier eller fagperson | | Eier + Fagperson | ☐ | Ikke gjort. Appen viser «Husvett» (tittel, installert navn, toppfelt); et senere navnebytte er en tekstendring, se `src/brand.test.ts` |

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
| 6 | **Gjenopprettingsøvelse** (Drift), i tillegg: kopi → nytt volum → app | Gjenopprettet; enhetene sender sitt på nytt og viser «Synket» (C9). Plan og innstillinger er like overalt, eller en konflikt vises; ingenting er overskrevet i stillhet | | |
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
| **Lokal avis og tilbud i planen** | `plan.md` fase 2 | Finner familien sin lokale avis, bruker et tilbud i planen, besøker butikk nummer to? Spør og observer | Flertallet klarer det uten hjelp | Delvis (Tjek-tilbud og «Aviser fra Tjek» er ekte; «Aviser (demo)» er demo) |
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
