# Hvor skal appen kjøre? Beslutningsguide for eier

**Status: UTKAST, skrevet 2026-11-22.** Skrevet for en eier uten teknisk bakgrunn. Ingenting her er bestilt, og ingen kontoer er opprettet.

**Les dette først om tallene.** Alle priser, regioner og vilkår under er fra min generelle kunnskap, ikke slått opp i dag. De er satt opp som grove intervaller i norske kroner (regnet med ca. 11 kr per euro og 10 kr per dollar) og kan være feil eller utdaterte. Alt som står under «Må verifiseres» (siste del av dokumentet) må sjekkes mot leverandørens egne prissider og vilkår før noe bestilles. Dokumentet er ikke juridisk rådgivning.

## 1. Kort versjon

- Appen er liten: én Node-prosess og (snart) en lokal database. Noen hundre husstander i en pilot trenger en liten maskin, ikke en stor skyløsning.
- Det viktigste valget er **hvem som står for driften** (oppdateringer, sikkerhetskopi, å svare når noe slutter å virke), ikke hvilken leverandør som har lavest pris. Pris spiller liten rolle i piloten: forskjellen mellom alternativene er trolig noen hundre kroner i måneden.
- **Anbefaling for pilot:** leid virtuell server (VPS) hos en europeisk leverandør med datasenter i EU/EØS, kjørt med Docker, med daglig kryptert sikkerhetskopi til et annet sted i EØS. Billigst, enklest å forklare i personvernerklæringen (leverandør og data i EØS), og passer en embedded database. Forutsetter at en navngitt person har driftsansvar.
- **Alternativ hvis ingen kan ta driftsansvar:** en administrert plattform (PaaS) med EU-region. Litt dyrere og leverandøren er trolig amerikansk, så GDPR-arbeidet blir større.
- **Bred lansering:** administrert PostgreSQL og flere servere. Velg da på nytt, med tall fra piloten. Se avsnitt 6.
- Svar på spørsmålene i avsnitt 7, så kan jeg gå videre.

## 2. Hva vi faktisk skal kjøre

Fra repoet (`server/index.ts`, `Dockerfile`):

| Fakta | Betydning for valg av hosting |
| --- | --- |
| Én Node.js-prosess (Node 22) som serverer appen (statiske filer) og `/api/offers` | Trenger lite CPU og minne. Én instans holder trolig for en pilot (ikke lasttestet). |
| Henter tilbud fra Tjek og holder dem i minnet i seks timer, uten lagring | Serveren må kunne gjøre utgående HTTPS-kall. Hosting uten utgående nett (eller med streng utgående brannmur) virker ikke. |
| Ingen brukerdata på serveren i dag. Plan, handleliste og valg lagres på brukerens egen enhet | Dagens server er ikke en personvernrisiko av betydning (men se loggene, avsnitt 3). |
| **Under arbeid:** synk-server med husstander, enhetstokens og lagring i en embedded database (egen økt, `docs/synk.md`) | Da kommer det persondata på serveren, og vi trenger **disk som overlever omstart** og **sikkerhetskopi**. Det utelukker plattformer der filsystemet nullstilles ved hver omstart. |
| Senere: PostgreSQL | Administrert database blir interessant ved bred lansering. |

Ordforklaring:

- **VPS**: en virtuell maskin du leier. Du får full kontroll og må selv oppdatere den.
- **PaaS**: en plattform der du leverer et ferdig bygd program (f.eks. Docker-image), og leverandøren kjører det og sørger for HTTPS.
- **Embedded database**: databasen ligger som en fil ved siden av programmet (f.eks. SQLite). Enkel og rask, men bare én server kan skrive til den, og filen må sikkerhetskopieres.
- **Databehandler / databehandleravtale (DPA)**: leverandøren som lagrer eller kjører dataene på våre vegne. Loven krever en skriftlig avtale. De store leverandørene har standardavtale du godtar på nett.
- **EØS**: EU pluss Norge, Island og Liechtenstein. Personvernreglene gjelder likt der; data i EØS er enklest.

## 3. Det som er likt for alle alternativene

Disse punktene må løses uansett valg, og de koster mer tid enn penger:

1. **Domene og HTTPS.** Et domenenavn (typisk noen hundre kroner i året for .no, må verifiseres) og krypterte forbindelser. PaaS og skyleverandører ordner sertifikatet selv; på VPS bruker vi et verktøy som Caddy som henter gratis sertifikat automatisk.
2. **Kontoen skal eies av eieren**, ikke av utvikleren. Utvikleren får tilgang, ikke eierskap. Betaling og databehandleravtale gjelder den som er behandlingsansvarlig (se `docs/personvern/`).
3. **Logger.** Webtjenere logger vanligvis IP-adresser, og IP-adresser er personopplysninger. Slå av eller kort ned adresse-logging, og sett en fast sletting (forslag: 14 dager, må avgjøres). Dagens server skriver bare en oppstartslinje, men en proxy foran den (Caddy, PaaS, skytjeneste) logger ofte mer.
4. **Overvåking.** En enkel ekstern sjekk som varsler på e-post/SMS hvis siden er nede. Docker-imaget har en innebygd helsesjekk.
5. **Sikkerhetskopi og øvelse på gjenoppretting.** En sikkerhetskopi som aldri er prøvd gjenopprettet, regnes ikke som en sikkerhetskopi. Kopien skal krypteres og ligge i EØS, ikke på samme maskin.
6. **Oppdateringer.** Operativsystem og Node-versjon må oppdateres jevnlig (sikkerhetsfeil). På PaaS gjør leverandøren operativsystemet; vi bygger fortsatt imaget på nytt.
7. **Hemmeligheter** (f.eks. Kassalapp-nøkkelen når den tas i bruk) legges i leverandørens hemmelighetslager eller en miljøfil utenfor repoet. Aldri i imaget eller i git.
8. **Ingen deploy fra CI i denne omgang.** CI (`.github/workflows/ci.yml`) tester og bygger bare. Utrulling gjøres manuelt til vi har valgt leverandør.

## 4. De fire alternativene

Pilotstørrelse som er brukt: 3–5 områder, noen hundre husstander, én liten server. Det er en antakelse, ikke en målt belastning.

### A. Leid VPS hos europeisk leverandør (f.eks. Hetzner, Scaleway, OVHcloud, UpCloud, eller en norsk leverandør)

Navnene er eksempler, ikke en vurdering eller anbefaling av én bestemt leverandør. Norske leverandører er ikke kartlagt her.

| | |
| --- | --- |
| **Omtrentlig månedskostnad (pilot)** | Ca. 100–250 kr: server ca. 50–120 kr, sikkerhetskopilagring ca. 10–50 kr, domene ca. 10–25 kr. Usikkerhet: ±50 %. Må sjekkes mot leverandørens prisside. Kommer i tillegg: tiden den som drifter bruker. |
| **Datalokasjon** | Du velger region; for europeiske leverandører ligger datasentrene i EU/EØS (f.eks. Tyskland, Finland, Frankrike). Sjekk at valgt region er i EØS, og at sikkerhetskopier ikke havner i en annen region. |
| **Driftsinnsats for eier** | **Høy** hvis ingen har gjort det før: oppsett, brannmur, oppdateringer, sikkerhetskopi, overvåking. Vi kan skrive skript og en sjekkliste, men noen må gjøre det jevnlig, ca. 1–3 timer i måneden når alt er satt opp (grovt anslag). |
| **Backup** | Leverandøren tilbyr ofte automatiske øyeblikksbilder mot et lite tillegg (må verifiseres per leverandør), men en egen kryptert kopi av databasefilen til separat lagring bør også tas. Gjenoppretting: starte ny maskin og legge tilbake filen. Tap ved feil: opptil siste kopi (daglig = opptil ett døgn). |
| **Skalering** | Opp til større maskin ved å bytte størrelse (kort nedetid). Én server, ikke flere samtidig med embedded database. Holder trolig for tusenvis av husstander, ikke målt. |
| **GDPR** | Enklest: europeisk selskap, data i EØS, ingen overføring til tredjeland i vanlig drift. Databehandleravtale tilbys vanligvis i kundeportalen (må verifiseres). Underleverandørliste må hentes fra leverandøren. Sjekk om selskapet har amerikansk morselskap eller amerikanske underleverandører for støtte. |
| **Passer når** | Det finnes en person (eier, utvikler eller innleid) som tar driftsansvaret, og du vil ha lav pris og enkel GDPR-beskrivelse. |
| **Pass opp** | Du er selv ansvarlig for sikkerhet. Én maskin = ingen redundans: faller den, er appen nede til den er gjenopprettet. |

### B. Administrert plattform (PaaS), f.eks. Fly.io, Render eller Railway, med EU-region

| | |
| --- | --- |
| **Omtrentlig månedskostnad (pilot)** | Ca. 100–500 kr: liten instans pluss et lagringsvolum for databasen. Flere av dem tar betalt etter bruk, så fakturaen kan variere. Sett en øvre grense for forbruk der det finnes. Usikkerhet: ±70 %. Må sjekkes. |
| **Datalokasjon** | Leverandørene tilbyr EU-regioner (f.eks. Frankfurt eller Amsterdam), men må velges aktivt, og ikke alle funksjoner finnes i alle regioner (må verifiseres). Selskapene er trolig amerikanske. |
| **Driftsinnsats for eier** | **Lav til middels.** Leverandøren kjører servere, sertifikater og oppdatering av operativsystemet. Vi leverer et Docker-image (finnes) og setter miljøvariabler. |
| **Backup** | Varierer. Varig disk (volum) til en embedded database er ofte knyttet til én maskin, og øyeblikksbilder kan være begrenset (må verifiseres per plattform). Regn med egen kryptert kopi i tillegg. Administrert PostgreSQL med automatisk sikkerhetskopi finnes hos flere av dem. |
| **Skalering** | Enkelt å bytte størrelse; flere instanser krever PostgreSQL i stedet for embedded database. |
| **GDPR** | Trolig amerikansk leverandør: databehandleravtale (vanligvis standard på nett), underleverandørliste, og et **overføringsgrunnlag** for tilgang fra USA (typisk EU–US Data Privacy Framework-sertifisering eller standard personvernbestemmelser/SCC). Må verifiseres per leverandør, og rettslig status for slike overføringer må følges (se «Må verifiseres»). |
| **Passer når** | Ingen kan ta teknisk driftsansvar, og du godtar at leverandøren er utenfor EØS-jurisdiksjon selv om dataene ligger i EØS. |
| **Pass opp** | Plattformer som starter på nytt ved hver utrulling uten varig disk, kan ikke brukes til embedded database. Sjekk at disk er varig og i riktig region. Gratisplaner er normalt ikke egnet til persondata. |

### C. Skyleverandør med norsk eller EU-region (Microsoft Azure, Amazon Web Services, Google Cloud)

| | |
| --- | --- |
| **Omtrentlig månedskostnad (pilot)** | Ca. 300–1 500 kr. En enkel virtuell maskin ligger i nedre ende; administrert PostgreSQL, nettverkstjenester og logging trekker opp. Priser er sammensatte og bruksbaserte. Usikkerhet: ±100 %. Bruk leverandørens prisberegner. |
| **Datalokasjon** | Regioner i Norge (Azure), Sverige (AWS), Finland og Sverige (Google) finnes (må verifiseres, regionlister endrer seg). Data kan holdes i EØS, men selskapene er amerikanske. |
| **Driftsinnsats for eier** | **Middels til høy** for en nybegynner: mange valg og mye konfigurasjon. Lav hvis man bruker ferdige tjenester, men da øker kostnaden og låsingen til leverandøren. |
| **Backup** | God: automatisk sikkerhetskopi og tilbakeføring til et tidspunkt for administrert database. Til embedded database kreves egen kopiering til lagring. |
| **Skalering** | Best av alternativene: flere instanser, administrert PostgreSQL, lastbalansering. Overkill for en pilot. |
| **GDPR** | Standard databehandleravtaler finnes på nett (må verifiseres), og underleverandørlister er omfattende. Amerikansk morselskap gir spørsmål om amerikansk myndighetstilgang og overføringsgrunnlag. Har ofte mer dokumentasjon (sertifiseringer, sikkerhetsrapporter) som hjelper en personvernvurdering. |
| **Passer når** | Bred lansering, krav om tilgjengelighetsgaranti, eller samarbeidspartnere som krever en stor leverandør. |
| **Pass opp** | Kostnaden kan løpe uten at man ser det. Sett budsjettvarsler før noe opprettes. |

### D. Selvdrift (egen maskin hjemme eller på kontor)

| | |
| --- | --- |
| **Omtrentlig månedskostnad** | Ca. 30–100 kr i strøm og nett, pluss engangskostnad for maskin (grovt 0–5 000 kr, avhengig av om man har en maskin fra før). Fast IP/portåpning kan koste ekstra eller være umulig hos enkelte nettleverandører. |
| **Datalokasjon** | Norge, hos deg. Ingen underleverandør til selve lagringen. |
| **Driftsinnsats for eier** | **Svært høy** og avhengig av én person og ett sted. Oppetid avhenger av strøm, nett og at maskinen ikke går i stykker. |
| **Backup** | Må løses fullt ut selv, og brann/innbrudd/lynnedslag tar både maskin og kopi hvis kopien ligger i samme hus. |
| **Skalering** | Ingen. |
| **GDPR** | Du er både behandlingsansvarlig og drifter: all teknisk og organisatorisk sikring (fysisk sikring, kryptering, tilgangsstyring) er ditt ansvar uten leverandør å støtte seg på. Ingen databehandleravtale for hosting, men for e-post, domene og sikkerhetskopi-lagring. |
| **Passer når** | Bare til utvikling og demo. **Anbefales ikke** for pilot med ekte husstander. |

## 5. Sammenligning

| | A. Europeisk VPS | B. PaaS (EU-region) | C. Hyperscaler | D. Selvdrift |
| --- | --- | --- | --- | --- |
| Pilotkostnad per måned | ca. 100–250 kr | ca. 100–500 kr | ca. 300–1 500 kr | ca. 30–100 kr + maskin |
| Data i EØS | ja (velg region) | ja (velg region) | ja (velg region) | ja (Norge) |
| Leverandør i EØS-jurisdiksjon | typisk ja | trolig nei | nei (amerikansk morselskap) | ikke relevant |
| Driftsinnsats | høy | lav–middels | middels–høy | svært høy |
| Passer embedded database | ja | ja, hvis varig disk | ja på VM, mer krøkkete ellers | ja |
| Veien til PostgreSQL | egen eller administrert hos samme leverandør | administrert tilbys ofte | tilbys | egen |
| Skalering | middels | middels | høy | ingen |
| GDPR-arbeid | lite | middels | middels–mye | mye (alt selv) |
| Risiko som ikke er pris | at driften ikke blir gjort | prisvariasjon, tredjelandsoverføring | kompleksitet og kostnad | en enkelt feilkilde |

## 6. Anbefaling

### Pilot (3–5 områder, noen hundre husstander)

**Alternativ A: leid VPS i EU/EØS hos en europeisk leverandør**, med:

- Docker-imaget fra repoet, startet på nytt automatisk, bak Caddy (HTTPS).
- Daglig kryptert kopi av databasefilen til separat lagring i EØS, og en gjenopprettingsøvelse før piloten åpnes.
- Adresselogg avkortet til 14 dager (forslag) og ekstern oppetidssjekk.
- En **navngitt driftsansvarlig** som får varsler og oppdaterer ukentlig/månedlig.
- Eier har kontoen. Utvikler får tilgang.

Begrunnelse: lavest pris, data og leverandør i EØS (kortere personvernerklæring og mindre risiko), passer embedded database, og piloten trenger ikke skalering. Svakheten er at noen må gjøre driftsjobben. **Hvis ingen kan det, velg B** (PaaS, EU-region) og regn med mer GDPR-papirarbeid (overføringsgrunnlag, underleverandører). Ikke velg C eller D til piloten.

Dette er min anbefaling ut fra dagens kunnskap om prosjektet. Den må justeres etter svarene i avsnitt 7.

### Bred lansering

Beslutningen bør tas på nytt etter piloten, med målt belastning, antall husstander, behov for tilgjengelighet og avtalekrav fra datakilder og betalingspartnere. Utgangspunkt:

- Gå over til **administrert PostgreSQL** med automatisk sikkerhetskopi og tilbakeføring til et tidspunkt, og to eller flere app-instanser.
- To veier: (1) europeisk leverandør med administrert PostgreSQL (lavere pris, EØS-jurisdiksjon, mindre funksjonalitet), eller (2) hyperscaler med norsk/europeisk region (best skalering, sikkerhetsdokumentasjon og tilgjengelighetsavtaler, men amerikansk morselskap).
- Min anbefaling i dag: begynn med (1), og velg (2) bare hvis det finnes et konkret krav (tilgjengelighetsgaranti, kunder/partnere, personvernvurdering som tilsier det). Dette er en hypotese som prøves mot pilotdata.
- Før bred lansering: gjennomgå personvernvurderingen (DPIA) på nytt og få den kvalitetssikret (`docs/personvern/03-dpia-vurdering.md`).

## 7. Spørsmål eier må svare på

1. **Hvem er behandlingsansvarlig?** En person, et enkeltpersonforetak eller et AS? Det må finnes en juridisk part som tegner leverandøravtaler og står i personvernerklæringen.
2. **Hvem tar driftsansvaret?** Navn, og hva er akseptabel responstid hvis appen er nede (samme dag, neste virkedag)? Er det greit at piloten kan være nede noen timer?
3. **Månedlig tak for hosting** i piloten (f.eks. 300 kr, 500 kr, 1 000 kr)?
4. **EØS-leverandør eller også amerikansk?** Er det et krav at leverandøren er europeisk, eller godtar du en amerikansk leverandør med datasenter i EU (alternativ B/C)?
5. **Hvem skal eie konto og domene**, og hvilket domenenavn skal brukes?
6. **Hvem kan nås for personvernhenvendelser** (innsyn, retting, sletting), med hvilken e-postadresse? Hvem svarer innen 30 dager?
7. **Piloten:** åpen for hvem som helst eller lukket gruppe (invitasjonskode)? Omtrentlig antall husstander, hvilke områder, og startdato? Skal det være betaling i piloten (påvirker vilkår og betalingsleverandør)?
8. **Hvor lenge skal data oppbevares** etter at en husstand slutter å bruke appen (forslag i `docs/personvern/01-oversikt-behandling.md`)?
9. **Har du noen som kan gjennomgå personverndokumentene** (jurist eller personvernrådgiver), og når? Piloten bør ikke åpnes for ekte brukere før det er gjort.
10. **Skriftlige vilkår:** foreligger det skriftlig avtale fra Tjek? (Planen krever dokumentasjon før noe annet enn live-visning bygges.) Hosting påvirkes ved at lagring av tilbud ikke er tillatt ennå.

## 8. Kjøre med Docker

Imaget bygges av `Dockerfile` (flertrinns, kjører som bruker `node`, uten hemmeligheter, med helsesjekk).

```sh
docker build -t middagsplanlegger .

docker run -d --name middagsplanlegger \
  --restart unless-stopped \
  -p 127.0.0.1:8787:8787 \
  -e PORT=8787 \
  -v middag-data:/data \
  middagsplanlegger
```

Porten bindes til `127.0.0.1` så bare en proxy på samme maskin (f.eks. Caddy) når den. Åpne ikke porten direkte mot internett.

| Miljøvariabel | Standard | Status |
| --- | --- | --- |
| `PORT` | `8787` | I bruk. Porten serveren lytter på. |
| `DATA_DIR` | `/data` | **Reservert, ikke i bruk ennå.** Katalogen (montert som volum) der synk-serveren skal lagre databasefilen. Navnet må avstemmes med synk-løsningen i `server/` når den er ferdig. |
| `KASSALAPP_TOKEN` | ikke satt | **Reservert, ikke i bruk av serveren ennå.** Brukes i dag bare av `phase0/kassalapp-import/probe.mjs`. Hemmelighet: send den inn ved oppstart, aldri i Dockerfile eller git (se under). |
| `NODE_USE_ENV_PROXY` | ikke satt | Bare hvis serveren står bak en utgående proxy (f.eks. firmanettverk). |

Hemmeligheter ved oppstart, uten å skrive dem i kommandolinjen (de havner ellers i historikken):

```sh
# Filen .env.drift ligger bare på serveren, utenfor repoet, med rettighet 600:
#   KASSALAPP_TOKEN=...
docker run -d --name middagsplanlegger --restart unless-stopped \
  -p 127.0.0.1:8787:8787 -v middag-data:/data \
  --env-file /srv/middag/.env.drift \
  middagsplanlegger
```

På PaaS og skyleverandører legges nøkkelen i plattformens hemmelighetslager ("secrets").

Sjekk at den kjører: `docker ps` viser `healthy` etter ca. 20–30 sekunder; `curl -I http://127.0.0.1:8787/` gir `200`.

**Hva som er testet (2026-11-22):** imaget ble bygd og startet i en sandkasse, kjørte som bruker `node` (uid 1000), svarte `200` på `/` og `/api/offers` (status «loading» før første tilbudshenting), og helsesjekken ble `healthy`. Imaget er ca. 416 MB fordi serveren kjører TypeScript direkte (`tsx`) og trenger hele `node_modules`; det kan gjøres mindre når serveren får eget byggesteg. For å få `npm ci` til å virke i sandkassen måtte byggingen kjøres med vertens nettverk og sandkassens sertifikat. Den innsjekkede Dockerfilen er uendret, men det er ikke testet at den bygger på en vanlig maskin med direkte internett. Volum (`/data`) er ikke testet mot noen databasefil ennå, siden synk-serveren ikke er ferdig. Ikke testet: HTTPS/Caddy, sikkerhetskopi, gjenoppretting, utrulling hos noen leverandør.

## 9. Må verifiseres av en person før beslutning

- Aktuelle priser og pristyper (fast månedspris vs. bruksbasert) hos de leverandørene som er aktuelle, og valutakurs.
- At valgt region faktisk er i EØS, og at sikkerhetskopier, logger og støtteverktøy holdes i EØS.
- Hver leverandørs databehandleravtale og liste over underleverandører (se `docs/personvern/04-databehandleravtaler-sjekkliste.md`).
- For amerikanske leverandører: gjeldende overføringsgrunnlag. EU–US Data Privacy Framework (kommisjonsvedtak fra 2023) er etter min kunnskap utfordret for domstolene i EU; nåværende rettsstatus og hvordan Datatilsynet i Norge forholder seg til den, må sjekkes.
- At norske leverandører (VPS, hosting) som kan være aktuelle, er kartlagt. Jeg har ikke gjort det.
- Hvilke sikkerhetskopifunksjoner og varig disk hver plattform faktisk tilbyr for en embedded database.
- Om de valgte leverandørene godtar vårt bruksområde (helserelaterte kostvalg kan gjøre behandlingen mer sensitiv).
- Domenepriser og registrar for .no.
