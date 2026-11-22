# Hvor skal appen kjøre? Beslutningsguide for eier

**Status: UTKAST, skrevet 2026-11-22; avsnitt 2, 3 og 8 avstemt samme dag mot den bygde synk-serveren.** Skrevet for en eier uten teknisk bakgrunn. Ingenting her er bestilt, og ingen kontoer er opprettet. Avsnitt 8 er prøvd i en Docker-kjøring i en sandkasse (ikke hos en leverandør); se «Hva som er testet». Alt som skal gjøres før ekte familier står samlet i [`pilot-sjekkliste.md`](pilot-sjekkliste.md). **Oppdatert 2026-11-22** med eierens svar (avsnitt 7) og et kort avsnitt om webhotel (avsnitt 0).

**Les dette først om tallene.** Alle priser, regioner og vilkår under er fra min generelle kunnskap, ikke slått opp i dag. De er satt opp som grove intervaller i norske kroner (regnet med ca. 11 kr per euro og 10 kr per dollar) og kan være feil eller utdaterte. Alt som står under «Må verifiseres» (siste del av dokumentet) må sjekkes mot leverandørens egne prissider og vilkår før noe bestilles. Dokumentet er ikke juridisk rådgivning.

## 0. Webhotel eller VPS? (kort, for deg som ikke er teknisk)

**Kort svar: et vanlig webhotel passer ikke.** Et webhotel (delt hosting, slik man ofte får sammen med et domene) er laget for nettsider i PHP med en MySQL-database: du får en mappe på en maskin som deles med mange andre kunder, ikke en egen maskin. Appen vår trenger noe annet:

1. **En Node-server som kjører hele tiden.** Synk mellom telefonene og henting av tilbud skjer i ett program som alltid må være i gang. Et webhotel starter som regel bare et skript når noen åpner en side, og stopper det igjen.
2. **En databasefil (SQLite) på varig disk, med én skriver.** Husstandene ligger i én fil som må overleve omstart, tas sikkerhetskopi av på en bestemt måte (avsnitt 8) og aldri skrives av to programmer samtidig.
3. **Docker.** Oppsettet vi har prøvd (Docker-image, Caddy for HTTPS, sikkerhetskopiskript) forutsetter at vi kan kjøre Docker. Det får man ikke på delt hosting.
4. **Kontroll over logger og nettverk.** Vi må vite hva som logges (IP-adresser er personopplysninger) og kunne hente tilbud fra Tjek.

Noen webhotell tilbyr «Node.js-støtte». Det er som regel ikke nok: uten Docker, uten valg av Node-versjon (vi trenger Node 22.23.5, avsnitt 8) og ofte med prosesser som stoppes. Det er ikke prøvd, og vi anbefaler det ikke.

**Et webhotel kan likevel være nyttig til to ting:** kjøp av domene og en e-postadresse (til personvernhenvendelser: eieren har valgt `kontakt@husvett.no`, men det er ikke bekreftet at postkassen finnes). Domenet kan da pekes til serveren der appen kjører.

**Anbefalt: en liten VPS (leid virtuell maskin) i EU, for eksempel hos Hetzner, med Caddy foran appen.** Det er alternativ A under.

| | 1. VPS i EU (f.eks. Hetzner), drift selv | 2. Administrert plattform (PaaS) med EU-region (f.eks. Render, Fly.io) | 3. VPS i EU + innleid driftshjelp |
| --- | --- | --- | --- |
| Omtrentlig pris per måned (grovt, ikke slått opp i dag) | ca. 100–200 kr (liten server ca. 50–100 kr, lagring til sikkerhetskopi ca. 30–50 kr, domene ca. 10–20 kr) | ca. 150–400 kr (instans + disk; prisen kan variere med bruk) + domene | Som 1, pluss timer til den som drifter (timepris må innhentes; regn med 1–3 timer i måneden når alt kjører) |
| Hva du selv må gjøre | Opprette konto og server, og ha en person («Admin») som tar oppdateringer, sikkerhetskopi og varsler. Vi har skrevet oppsett og skript (avsnitt 8) | Opprette konto og sette opp appen fra Docker-imaget; mindre vedlikehold av maskinen. Mer papirarbeid for personvern (selskapene er trolig amerikanske: overføringsgrunnlag, underleverandører) | Opprette konto i AVVR AS sitt navn og gi driftshjelpen tilgang. Inngå avtale med driftshjelpen (også databehandleravtale) |
| Passer når | «Admin» er en person som kan følge en sjekkliste i terminal | Ingen kan eller vil drifte en maskin | Ingen i selskapet kan drifte, men du vil ha data og leverandør i EØS |
| Personvern | Enklest: europeisk selskap, data i EØS | Data i EØS, men leverandør utenfor EØS | Som 1, pluss én databehandler til |

Prisene er fra generell kunnskap, ikke kontrollert mot leverandørenes prissider 2026-11-22. Sjekk før bestilling (avsnitt 9).

**Hva vi trenger fra deg, steg for steg** (alternativ 1; for 2 og 3 er steg 1–3 og 6 like):

1. **Bestem hvem som har rollen «Admin»:** «Admin» er en rolle i AVVR AS og navngis ikke i dokumentene (eierens beslutning 2026-11-22); den som har rollen får varsler, tar oppdateringer omtrent én gang i måneden og kan gjøre en gjenoppretting. Hvis ingen kan det, velg alternativ 2 eller 3.
2. **Domene og e-post:** eieren har valgt domenet **`husvett.no`** og kontakt-e-posten **`kontakt@husvett.no`** (2026-11-22). **Ikke bekreftet:** at domenet er kjøpt, at det står i **AVVR AS** sitt navn, og at postkassen er opprettet og virker. Kjøp domenet i AVVR AS sitt navn (se «Slik velger og kjøper du et .no-domene» under; gjerne hos en norsk registrar; et webhotel holder til dette), opprett postkassen `kontakt@husvett.no`, og prøv den med en melding utenfra. Slå på to-faktor.
3. **Konto hos VPS-leverandøren** i AVVR AS sitt navn, med to-faktor. Godta leverandørens databehandleravtale i kundeportalen og lagre en kopi med dato (`personvern/04-databehandleravtaler-sjekkliste.md`). Sett et budsjettvarsel.
4. **Bestill den minste serveren** med Ubuntu (LTS) i en region i EU (f.eks. Tyskland eller Finland). Legg inn Admins SSH-nøkkel (offentlig del) ved bestilling. Del aldri passord eller private nøkler i chat eller e-post.
5. **Pek domenet til serveren:** en A-post (og AAAA for IPv6) i domenets DNS-innstillinger, til serverens IP-adresse, for **både `husvett.no` og `www.husvett.no`** (se DNS-avsnittet under).
6. **Nøkkel til sikkerhetskopiene** (du ba om hjelp): på din egen PC, ikke på serveren, lag et nøkkelpar med verktøyet `age` (`age-keygen -o middag-backup.key`). Filen inneholder en privat nøkkel og skriver ut en offentlig nøkkel som begynner med `age1…`. Den **offentlige** nøkkelen gis til Admin og settes som `BACKUP_AGE_RECIPIENT` på serveren (avsnitt 8). Den **private** nøkkelfilen lagres hos **to navngitte personer** (f.eks. i hver sin passordhåndterer, eller en kryptert minnepinne i safe), aldri på serveren. Mistes den, kan ingen kopi leses. Vi kan gå gjennom dette sammen; skriv ned hvem de to er (sjekklisten A9).
7. **Lagring til sikkerhetskopiene** et annet sted enn serveren, i EØS (f.eks. leverandørens lagringstjeneste), med sletting etter 30 dager (forslag, ikke avgjort).
8. **Admin setter opp appen** etter avsnitt 8 («Pilotoppsett med Docker Compose og Caddy»): fyller `.env.drift` med `DOMENE=husvett.no`, `SYNC_SECRET`, `SYNC_RETENTION_DAYS=730` og `SYNC_TOKEN_IDLE_DAYS=730` (innloggingens levetid, avgjort i sjekklisten D15; 730 er også standarden i koden).
9. **Gjenopprettingsøvelse og testuke** (sjekklisten C7 og F) før første familie inviteres.

### Slik velger og kjøper du et .no-domene (for lekmann)

Dette er en veiledning; ingenting er kjøpt eller bestilt, og tallene under er **omtrentlige og må sjekkes** hos registraren før du betaler (jeg har ikke slått opp noen priser).

1. **Hva et domene er:** navnet folk skriver i nettleseren. Eierens valg 2026-11-22 er `husvett.no` (ikke bekreftet kjøpt). Appens navn er «Husvett» (eierens beslutning 2026-11-22); at navnet er ledig og kan brukes som varemerke er ikke sjekket av oss (`pilot-sjekkliste.md`, E5). Du leier det (vanligvis ett år om gangen) og betaler fornyelse hvert år. Appen virker ikke på et domene før domenet peker på serveren (punkt 5 under).
2. **Hvem selger det:** `.no` forvaltes av Norid, men du kjøper ikke direkte av Norid. Du kjøper hos en **registrar** (et selskap som er godkjent av Norid til å selge .no-domener). Norid har en oppdatert liste over registrarer på norid.no (søk «finn registrar»); velg en fra den listen. Mange webhoteller er registrarer. Sammenlign pris (førsteår og fornyelse), om to-faktor finnes, om du får styre DNS-innstillingene selv, og om e-post eller videresending av e-post følger med.
3. **Omtrentlig pris (omtrentlig, må sjekkes):** et .no-domene koster gjerne et sted mellom 100 og 300 kr i året, men prisene varierer mellom registrarer og kan ha tilbudspris første år. Eventuell e-posttjeneste (en egen postkasse for personvern) kommer i tillegg hvis den ikke følger med; sjekk dette.
4. **Hva som trengs:** domenet skal stå i **AVVR AS** sitt navn (org.nr. 935941644), ikke i en privatpersons navn, så selskapet kan styre det og så personvernerklæringen peker på riktig part. Registraren ber om organisasjonsnummer, selskapets adresse og en kontaktperson med e-postadresse (reglene for .no krever tilknytning til Norge, og en organisasjon må være registrert i Enhetsregisteret; sjekk gjeldende regler hos Norid). Kontoen hos registraren bør eies av selskapet, med to-faktor, og innloggingen bør ikke bare ligge hos én person. Domenenavn kan bestå av bokstaver (også æ, ø og å), tall og bindestrek; velg et kort navn uten bindestreker hvis mulig, og sjekk at navnet er ledig.
5. **Pek domenet mot serveren (DNS):** når du har en VPS (f.eks. hos Hetzner, hvis det blir valgt; hosting er ikke valgt ennå) får serveren en offentlig IP-adresse. I registrarens DNS-innstillinger (eller i leverandørens egen DNS-tjeneste, hvis du flytter DNS dit) legger du inn:
   - en **A-post** for `husvett.no` (selve domenet, «@» hos mange registrarer) med IPv4-adressen til serveren, og en **A-post for `www`** (`www.husvett.no`) med samme adresse (eller en CNAME fra `www` til `husvett.no`, hvis registraren tillater det),
   - en **AAAA-post** med IPv6-adressen, på de samme to navnene, hvis serveren har en.
   **Hovedadresse:** `husvett.no`. `www.husvett.no` er ikke en egen side: Caddy sender den permanent videre til `https://husvett.no/` (se `docs/drift/Caddyfile`). Begge navnene må peke på serveren, ellers får Caddy ikke sertifikat for `www` (hovedadressen virker likevel). Å bytte hovedadresse til `www` senere er mulig, men husstander og lagrede lenker som viser til den gamle adressen må da flyttes, så velg nå og hold på valget. Merk også: **domenet er ikke bekreftet kjøpt**, så ingen av disse oppføringene er satt.
   Les verdiene av i kundeportalen til VPS-leverandøren. Endringen kan ta fra noen minutter til noen timer før den virker overalt. Sjekk med `nslookup <domene>` (Windows, Mac eller Linux) at svaret er serverens IP-adresse. Sett så `DOMENE=husvett.no` i `.env.drift` (uten `www.` og uten `https://`; Caddy lager `www`-omdirigeringen selv); Caddy henter da sertifikat (HTTPS) av seg selv, forutsatt at port 80 og 443 er åpne i brannmuren og at DNS peker riktig **før** første oppstart.
6. **Etterpå:** slå på automatisk fornyelse (eller sett en påminnelse), ellers mister du domenet og appen slutter å virke. Domenenavnet må også inn i personvernerklæringen (der erklæringen publiseres), og kontakt-e-posten `kontakt@husvett.no` forutsetter at domenet er kjøpt og at e-post er satt opp på det (`pilot-sjekkliste.md`, A4 og A5; begge er avgjort av eier, men ikke bekreftet utført).

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
| Én Node.js-prosess (Node 22) som serverer appen (statiske filer), `/api/offers` og synk-API-et (`/api/household*`, `/api/sync*`). Serveren er bygget til én JavaScript-fil (`dist-server/index.mjs`, esbuild) og kjører med `node`; den har ingen npm-avhengigheter ved kjøring | Trenger lite CPU og minne. Én instans holder trolig for en pilot (ikke lasttestet). **Må være én prosess:** ratebegrensningen ligger i minnet og SQLite har én skriver. |
| Henter tilbud fra Tjek og holder dem i minnet i seks timer, uten lagring | Serveren må kunne gjøre utgående HTTPS-kall. Hosting uten utgående nett (eller med streng utgående brannmur) virker ikke. |
| **Synk-serveren er bygget** (`docs/synk.md`): husstander, enhetstokens, hendelser og dokumenter lagres i **én SQLite-fil** (`middag.sqlite`, WAL-modus) i `DATA_DIR` | Det er persondata på serveren (se `docs/personvern/01-oversikt-behandling.md`, avsnitt 2b). Vi trenger **disk som overlever omstart**, **sikkerhetskopi** og **øvd gjenoppretting**. Plattformer der filsystemet nullstilles ved hver omstart, kan ikke brukes. Postnummer og kostkrav/allergier lagres ikke. |
| Databasen bruker `node:sqlite`, som er **eksperimentell i Node 22** | Se avsnitt 8, «node:sqlite». Versjonen er festet i `Dockerfile`. |
| Senere: PostgreSQL | `SyncStorage`-grensesnittet er laget for det (`docs/synk.md`, «Koble på PostgreSQL»). Administrert database blir interessant ved bred lansering. |

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
3. **Logger.** Webtjenere logger vanligvis IP-adresser, og IP-adresser er personopplysninger. Appserveren skriver bare oppstart, advarsler og feilmeldinger (`synk-feil: …`), ikke tilgang eller innhold, og Caddy-eksempelet i `docs/drift/` har ikke tilgangslogg slått på (kontrollert i testkjøringen: ingen forespørselslinjer). Ratebegrensningen holder IP-adresser **i minnet** og glemmer dem ved omstart. Dockers loggfiler er størrelsesbegrenset (3 × 10 MB) i eksempelet, ikke tidsbegrenset. **Leverandørens egne logger og brannmur er ikke kjent:** spør. Slå av eller kort ned adresse-logging der det finnes, og sett en fast sletting (forslag: 14 dager, må avgjøres).
4. **Overvåking.** En enkel ekstern sjekk som varsler på e-post/SMS hvis siden er nede, og et varsel når disken nærmer seg full (databasen vokser uten tak, `docs/synk.md`). Docker-imaget har en innebygd helsesjekk (avsnitt 8). Bruk `GET /healthz` (kjører `SELECT 1` mot databasen; `200 {"status":"ok"}` eller `503`, uten innhold og uten autentisering). Overvåk uten å sende innhold eller IP-adresser (`docs/synk.md`, «Må på plass før ekte familier», punkt 5).
5. **Sikkerhetskopi og øvelse på gjenoppretting.** En sikkerhetskopi som aldri er prøvd gjenopprettet, regnes ikke som en sikkerhetskopi. Kopien skal krypteres og ligge i EØS, ikke på samme maskin. Skript og prosedyre: avsnitt 8, «Sikkerhetskopi og gjenoppretting». **Gjenoppretting fra en eldre kopi har en bivirkning for enhetene** (de kan slutte å motta nye endringer): les den.
6. **Oppdateringer.** Operativsystem og Node-versjon må oppdateres jevnlig (sikkerhetsfeil). På PaaS gjør leverandøren operativsystemet; vi bygger fortsatt imaget på nytt.
7. **Hemmeligheter** (`SYNC_SECRET` nå; Kassalapp-nøkkelen når den tas i bruk) legges i leverandørens hemmelighetslager eller en miljøfil utenfor repoet (`.env.drift`, rettighet 600). Aldri i imaget eller i git.
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

### Pilot (lukket, hele Norge; antatt noen hundre husstander)

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

**Svar 2026-11-22** (eierens beslutninger; samlet også i `pilot-sjekkliste.md`):

| # | Svar | Uavklart |
| --- | --- | --- |
| 1 | **AVVR AS, org.nr. 935941644** er behandlingsansvarlig. Forretningsadresse: **Smedalsvegen 14, 2067 Jessheim** (Enhetsregisteret, data.brreg.no, oppslag 2026-11-22) | – |
| 2 | Driftsansvarlig: **«Admin» (rolle; navngis ikke)** | Responstid er ikke bestemt |
| 3 | – | Månedlig tak ikke oppgitt |
| 4 | – | Ikke besvart. Anbefaling: europeisk leverandør (avsnitt 0) |
| 5 | Konto og domene: AVVR AS (følger av svar 1). Domene: **`husvett.no`** (hovedadresse; `www.husvett.no` omdirigeres), eierens beslutning 2026-11-22 | **Ikke bekreftet:** at domenet er kjøpt og står i AVVR AS sitt navn, og DNS. Appens navn er ikke avklart. Se «Slik velger og kjøper du et .no-domene» |
| 6 | Kontakt-e-post for personvern: **`kontakt@husvett.no`** (felles adresse oppgitt av eieren 2026-11-22) | **Ikke bekreftet:** at postkassen er opprettet og virker, hvem som svarer innen 30 dager og e-postleverandør |
| 7 | **Lukket pilot, hele Norge** | Antall husstander, startdato, betaling |
| 8 | **730 dager** for inaktive husstander (`SYNC_RETENTION_DAYS=730`) | Logger og sikkerhetskopier. Innloggingens levetid (`SYNC_TOKEN_IDLE_DAYS`) er satt til samme 730 dager (`pilot-sjekkliste.md`, D15, avgjort) |
| 9 | **Ingen fagperson nå,** bare lukket pilot | Når en fagperson skal se på dokumentene |
| 10 | Eier vil ha **hjelp til oppsett** av sikkerhetskopinøkkelen | Hvem de to nøkkelholderne er (fremgangsmåte: avsnitt 0, steg 6) |
| 11 | – | Ikke besvart |
| 12 | Skriftlig Tjek-avtale finnes og er «ok» ifølge eier, men er fortrolig og deles ikke | Omfang ikke kjent for oss; spørsmål i `phase0/tjek-avtale.md`. Til svar foreligger: ingen lagring av tilbud |
| – | Hosting: eier vet ikke, spurte om webhotel | Se avsnitt 0 |
| – | Eier-godkjenning av nye medlemmer: **nei**, invitasjonen holder | – |

Spørsmålene slik de ble stilt:

1. **Hvem er behandlingsansvarlig?** En person, et enkeltpersonforetak eller et AS? Det må finnes en juridisk part som tegner leverandøravtaler og står i personvernerklæringen.
2. **Hvem tar driftsansvaret?** Navn, og hva er akseptabel responstid hvis appen er nede (samme dag, neste virkedag)? Er det greit at piloten kan være nede noen timer?
3. **Månedlig tak for hosting** i piloten (f.eks. 300 kr, 500 kr, 1 000 kr)?
4. **EØS-leverandør eller også amerikansk?** Er det et krav at leverandøren er europeisk, eller godtar du en amerikansk leverandør med datasenter i EU (alternativ B/C)?
5. **Hvem skal eie konto og domene**, og hvilket domenenavn skal brukes?
6. **Hvem kan nås for personvernhenvendelser** (innsyn, retting, sletting), med hvilken e-postadresse? Hvem svarer innen 30 dager?
7. **Piloten:** åpen for hvem som helst eller lukket gruppe (invitasjonskode)? Omtrentlig antall husstander, hvilke områder, og startdato? Skal det være betaling i piloten (påvirker vilkår og betalingsleverandør)?
8. **Hvor lenge skal data oppbevares** etter at en husstand slutter å bruke appen (forslag i `docs/personvern/01-oversikt-behandling.md`)?
9. **Har du noen som kan gjennomgå personverndokumentene** (jurist eller personvernrådgiver), og når? Piloten bør ikke åpnes for ekte brukere før det er gjort.
10. **Hvem eier sikkerhetskopinøkkelen?** Kopiene krypteres med en offentlig nøkkel (age); den private nøkkelen må ligge hos minst to navngitte personer, ikke på serveren. Hvem, og hvor?
11. **Hva gjør vi hvis en gjenoppretting taper de siste timenes data?** Avsnitt 8 beskriver at enhetene da må kobles på nytt. Er det akseptabelt for en pilot (ja/nei), og hvor ofte skal kopien tas (forslag: daglig)?
12. **Skriftlige vilkår:** avtalen med Tjek finnes (fortrolig). Eier opplyser (2026-11-22) at den tillater lagring av priser, bilder og avissider (`phase0/tjek-avtale.md`). Kreditering, kallgrense, varighet og pris er ikke kjent for oss og må bekreftes med Tjek. Hosting påvirkes ved at lagrede tilbud krever plass på volumet (egen databasefil, se `docs/synk.md`).

## 8. Kjøre med Docker

Imaget bygges av `Dockerfile` (flertrinns: bygg appen og serveren, så et lite alpine-image med bare `node`, `dist-server/index.mjs` og `dist/`; ingen `node_modules`, npm, kildekode eller tsx; kjører som bruker `node` med uid/gid 1000, uten hemmeligheter, med helsesjekk). Et ferdig pilotoppsett med Caddy foran ligger i [`docs/drift/`](drift/) (`docker-compose.yml`, `Caddyfile`, `env.eksempel`, `backup.sh`); det er beskrevet i «Pilotoppsett» under.

```sh
docker build -t middagsplanlegger .

docker run -d --name middagsplanlegger \
  --restart unless-stopped --init \
  -p 127.0.0.1:8787:8787 \
  -e TRUST_PROXY=1 \
  -v middag-data:/data \
  --env-file /srv/middag/.env.drift \
  middagsplanlegger
```

Porten bindes til `127.0.0.1` så bare en proxy på samme maskin (f.eks. Caddy) når den. **Åpne ikke porten direkte mot internett, og sett aldri `TRUST_PROXY=1` hvis serveren kan nås uten om proxyen:** da kan hvem som helst forfalske IP-adressen sin og gå utenom ratebegrensningen.

### Uten Docker: produksjonsbygg av serveren

```sh
npm ci
npm run build          # appen -> dist/
npm run build:server   # serveren -> dist-server/index.mjs (esbuild; src/ og server/ slås sammen til én fil)
SYNC_SECRET=… npm start   # node dist-server/index.mjs (kjør fra repoets rot: dist/ leses relativt til arbeidskatalogen)
```

`npm run server` (tsx, krever `node_modules`) er bare til utvikling. Valget av **esbuild** (devDependency) i stedet for `tsc`: koden bruker importer uten filendelse og går på tvers av `server/` og `src/` (`src/offers`, `src/data`, `src/sync`, `src/engine`), noe Node ikke leser direkte; `tsc` ville krevd omskrevne importer og en egen mappestruktur i utdata, mens esbuild gir én fil som `node` kjører rett fra. `scripts/build-server.mjs` feiler bygget hvis noe annet enn `node:`-moduler blir stående utenfor filen. Typesjekken står uendret i `npm run build` (`tsc --noEmit`); esbuild fjerner bare typer og sjekker dem ikke. Kildekart ligger ved (`index.mjs.map`): `node --enable-source-maps dist-server/index.mjs` gir lesbare stakker. `npm run smoke:server` starter bygget fra en tom katalog uten `node_modules` og sjekker `/healthz`, appen, CSP, husstand, sync, omstart og ryddig avslutning (SIGTERM); `npm run check:prod` kjører i tillegg CSP-, PWA- og e2e-skriptene mot det bygde serveren (`BUILT_SERVER=1`, krever Playwright).

### Miljøvariabler

| Variabel | Standard | Status |
| --- | --- | --- |
| `PORT` | `8787` | I bruk. Porten serveren lytter på. |
| `DATA_DIR` | `/data` i imaget (`data/` utenfor Docker) | I bruk. Katalogen der synk-serveren lagrer `middag.sqlite`. Monter et volum her. |
| `SYNC_DB` | `$DATA_DIR/middag.sqlite` | I bruk. Overstyrer hele stien til databasen (`:memory:` bare til test). |
| `SYNC_SECRET` | tilfeldig per start | **Skal settes i drift.** Hemmelighet for invitasjonskoder (HMAC). Mangler den, skriver serveren en advarsel og alle aktive invitasjoner blir ugyldige ved hver omstart. Lag den med `openssl rand -hex 32`. Enhetstokenene avhenger **ikke** av den (bare sha256 av tokenet lagres), så å miste eller bytte den logger ingen ut, den ugyldiggjør bare ubrukte invitasjoner. Aldri i Dockerfile eller git. |
| `SYNC_RETENTION_DAYS` | `730` | I bruk. Husstander uten autentisert aktivitet på så mange dager slettes automatisk (`0` = av; ugyldig verdi gir 730 og en advarsel). **Eierens valg 2026-11-22: `730`** (er nå også standarden i koden; `.env.drift` setter den likevel eksplisitt). Se `docs/synk.md`, «Oppbevaringstid». |
| `SYNC_TOKEN_IDLE_DAYS` | `730` | I bruk. Innloggingens levetid: dager uten bruk før et enhetstoken slutter å virke (glidende; hver bruk forlenger). `0` = aldri; ugyldig verdi gir 730 og en advarsel. **Eierens valg 2026-11-22: 730**, samme som `SYNC_RETENTION_DAYS` i piloten; se `pilot-sjekkliste.md`, D15. En mistet telefon har gyldig nøkkel i opptil så mange dager til eieren fjerner enheten. |
| `TRUST_PROXY` | ikke satt | `1` når serveren står bak en egen reverse proxy (Caddy), så ratebegrensningen bruker klientens IP fra `X-Forwarded-For`. |
| `KASSALAPP_TOKEN` | ikke satt | **Reservert, ikke i bruk av serveren ennå.** Brukes i dag bare av `phase0/kassalapp-import/probe.mjs`. Hemmelighet: send den inn ved oppstart, aldri i Dockerfile eller git. |
| `NODE_USE_ENV_PROXY` | ikke satt | Bare hvis serveren står bak en utgående proxy (f.eks. firmanettverk) og skal hente tilbud derfra. |
| `NODE_ENV` | `production` (satt i imaget) | Ingen kjent virkning på serveren. |
| `DOMENE`, `DATA_VOLUME` | – | Bare i Compose-eksempelet (`docs/drift/`): domenet Caddy henter sertifikat for, og navnet på datavolumet. |

Hemmeligheter ved oppstart, uten å skrive dem i kommandolinjen (de havner ellers i skallets historikk): legg dem i en fil som bare ligger på serveren, utenfor repoet, med rettighet 600, og bruk `--env-file` (eller `env_file:` i Compose). `docs/drift/.gitignore` hindrer at `.env.drift` sjekkes inn. På PaaS og skyleverandører legges nøkkelen i plattformens hemmelighetslager («secrets»).

### Volum, filrettigheter og én-prosess-regelen

- **Hva som skal ligge på volumet:** `/data` med `middag.sqlite` og, mens serveren kjører, `middag.sqlite-wal` og `middag.sqlite-shm` (WAL-modus). **De tre filene hører sammen.** Ikke kopier, flytt eller slett bare én av dem mens serveren kjører, og aldri legg en gammel `-wal` ved en gjenopprettet database.
- **Eier og rettigheter:** prosessen kjører som uid/gid **1000** (`node`). Et **navngitt Docker-volum** (`-v middag-data:/data`) arver eierskapet fra imaget og virker uten videre (kontrollert). Et **vertskatalog-volum** (`bind mount`) må klargjøres på verten:
  ```sh
  sudo mkdir -p /srv/middag/data && sudo chown 1000:1000 /srv/middag/data && sudo chmod 700 /srv/middag/data
  docker run … -v /srv/middag/data:/data …
  ```
  Serveren oppretter databasefilene med lesetilgang for alle (`rw-r--r--`, kontrollert), så rettighetene på katalogen (700) er det som holder andre brukere på verten ute. På systemer med SELinux trengs normalt også `:Z` etter volumnavnet (ikke prøvd).
- **Lokal disk, ikke nettverksdisk.** SQLite i WAL-modus virker ikke pålitelig over NFS/SMB. Bruk vertens lokale disk eller leverandørens blokklagring.
- **Én prosess, én container per volum.** Start aldri to servere mot samme databasefil (ratebegrensningen ligger i minnet, og SQLite tillater én skriver).
- **Feil volum gir tom database, uten feilmelding.** I testkjøringen startet serveren uten problem mot et tomt volum og opprettet en ny, tom database; alle enhetstokener ga da `401`, og helsesjekken var «healthy». Etter hver omstart, flytting eller gjenoppretting: kontroller at volumet er riktig (`docker compose exec app ls -la /data` og at en kjent enhet fortsatt får `200` fra `/api/household`).
- **Diskplass:** databasen vokser uten tak (ingen kvoter eller sletting av gamle uker er bygget). Sett et diskvarsel.
- **Kryptering i hvile:** volumet er ikke kryptert av appen. Bruk leverandørens diskkryptering eller kryptert filsystem, og krypter alle kopier. Avklares per leverandør (`docs/personvern/04-databehandleravtaler-sjekkliste.md`).

### Helsesjekk

`HEALTHCHECK` i `Dockerfile` kaller `GET /healthz` (kjører `SELECT 1` mot synk-databasen; `200` eller `503`, ingen innhold, ingen autentisering) og `GET /` (appen er bygget, `200`). Sjekken endrer ingenting. `/healthz` er testet mot en database som er lukket (`503`) i `server/sync/api.test.ts`; Docker-sjekken er prøvd i et kjørende image (2026-11-22: `healthy` etter oppstart, også under Compose), men ikke mot en databasefeil (`unhealthy` er ikke provosert). Siden et feil volum ikke gir feil (se over), fanger den heller ikke det.

### node:sqlite: eksperimentelt i Node 22

Synk-serveren bruker `node:sqlite` (innebygd i Node, ingen ekstern avhengighet eller native bygging). I Node 22 er den **eksperimentell**: den skriver `ExperimentalWarning: SQLite is an experimental feature and might change at any time` ved hver oppstart, og grensesnittet kan endres mellom Node-versjoner. Slik håndterer vi det:

- **Versjonen er festet** i `Dockerfile` (`ARG NODE_VERSION=22.23.5`, bildet `node:22.23.5-alpine`, med SQLite 3.54.1). Dette er versjonen alt i dette dokumentet er prøvd mot. `docker build` gir samme versjon hver gang, ellers kunne et nytt «22-alpine» byttet Node under oss uten at noen testet det. CI bruker `node-version: 22` (siste 22.x): en CI som er grønn mot en annen 22.x enn imaget gir ikke full trygghet.
- **Minste versjon:** etter min kunnskap er `node:sqlite` først tilgjengelig uten kommandolinjeflagg fra Node 22.13 (eldre 22.x krever `--experimental-sqlite`). Dette er ikke kontrollert mot Nodes dokumentasjon; bruk ikke eldre enn den festede versjonen.
- **Ved enhver endring av Node-versjon** (også sikkerhetsoppdateringer): bygg på nytt, kjør `npx vitest run server/sync src/sync`, og gjør gjenopprettingsøvelsen (under) før den rulles ut.
- **Datafilen er vanlig SQLite**, ikke et Node-spesifikt format. En endring i `node:sqlite` kan altså ikke låse dataene inne: sikkerhetskopier kan åpnes med hvilket som helst `sqlite3`-verktøy, og lagringslaget (`SyncStorage`) kan byttes til PostgreSQL (`docs/synk.md`).
- **Levetid:** Node 22 når slutten av støtteperioden sin i løpet av 2027 (må verifiseres mot Nodes utgivelsesplan). Planlegg et valg før pilotens slutt: hev Node (da må det sjekkes hvor langt `node:sqlite` er kommet der; må verifiseres), eller gå til PostgreSQL eller en pakket SQLite-driver.
- **Ikke skjul advarselen** (f.eks. med `--disable-warning`): den er et nyttig tegn på at vi står på eksperimentell grunn.

### Pilotoppsett med Docker Compose og Caddy

Filene i [`docs/drift/`](drift/): `docker-compose.yml` (app + Caddy, volum for databasen, `read_only`, ingen ekstra rettigheter, loggstørrelse begrenset), `Caddyfile` (HTTPS med automatisk sertifikat for `{$DOMENE}` = `husvett.no` som hovedadresse, permanent omdirigering fra `www.{$DOMENE}`, videresending til `app:8787`, noen sikkerhetshoder, ingen tilgangslogg; omdirigeringen er ikke kjørt mot ekte DNS og Caddyfilen er ikke validert med `caddy validate` i denne sandkassen, fordi Docker-daemonen manglet), `env.eksempel` og `backup.sh`. **Dette er et eksempel, ikke utrullet hos noen leverandør.**

1. Server (VPS) i EØS med Docker og Compose; brannmur åpen bare for 22 (fra kjente adresser), 80 og 443. Domenet peker (A/AAAA) på serveren **før** første oppstart, ellers får ikke Caddy sertifikat.
2. `git clone` repoet til f.eks. `/srv/middagsplanlegger`, `cd docs/drift`.
3. `cp env.eksempel .env.drift && chmod 600 .env.drift`, og fyll ut `DOMENE` (`husvett.no`, eierens valg; ikke bekreftet kjøpt) og `SYNC_SECRET` (`openssl rand -hex 32`).
4. `docker compose --env-file .env.drift up -d --build`, så `docker compose --env-file .env.drift ps` (app skal være `healthy`).
5. Åpne `https://husvett.no/` (og sjekk at `https://www.husvett.no/` sendes videre dit), opprett en husstand fra to enheter og sjekk at de ser hverandre.
6. Sett opp daglig sikkerhetskopi (under) og **gjør gjenopprettingsøvelsen før ekte familier inviteres.**
7. Oppdatering: `git pull && docker compose --env-file .env.drift up -d --build`. Husk Node-regelen over. Tilbakerulling: sett `image:` til en tidligere merket versjon (`docker tag` før hver oppdatering).

Bare Caddy publiserer porter; appen er nåbar bare gjennom Caddy, som `TRUST_PROXY=1` forutsetter. Caddy overskriver `X-Forwarded-For` med klientens adresse (standardoppførsel; ikke sett `trusted_proxies` uten en annen proxy foran). HSTS er satt kort (1 døgn) til alt er prøvd. Det er **ikke** satt noe `Content-Security-Policy`-hode: det hører til sikkerhetsgjennomgangen og må prøves mot appen først. Sertifikater ligger i volumet `caddy-data`; mist det ikke.

### Sikkerhetskopi og gjenoppretting

**Ikke kopier `middag.sqlite` med `cp` mens serveren kjører.** Nyere endringer ligger i `-wal`-filen, så en kopi av bare hovedfilen kan mangle dem eller være ufullstendig. (I en test manglet en kopi av bare hovedfilen hele husstanden som var opprettet like før.) To brukbare måter:

1. **`backup.sh` i `docs/drift/`** (prøvd): tar **begge databasene**, synk-databasen (`middag.sqlite`, husstander) og tilbudsdatabasen med prishistorikk fra Tjek (`tilbud.sqlite`, uten persondata; `docs/synk.md`, «Tilbud fra Tjek»), som hver sin krypterte fil (`backup/middag-<tid>.sqlite.age` og `backup/tilbud-<tid>.sqlite.age`) med samme kryptering og samme slettefrist. Mangler `middag.sqlite`, stopper skriptet med feil (feil volum?) uten å opprette en tom database; mangler `tilbud.sqlite` (f.eks. `OFFER_STORE=0`), hoppes den over med en melding. For hver database kjører skriptet SQLite sin `VACUUM INTO` inne i app-containeren, som gir én konsistent, fullstendig fil mens serveren kjører; kontrollerer den med `PRAGMA integrity_check`; krypterer den med `age` (offentlig nøkkel) eller `gpg` **før** den forlater containeren (ukryptert kopi skrives aldri til verten); og sletter lokale kopier eldre enn 30 dager (`BACKUP_KEEP_DAYS`, forslag fra personvernutkastet; se «Slettefrist for sikkerhetskopier» under). Kjør det daglig, f.eks. fra cron:
   ```
   17 3 * * *  cd /srv/middagsplanlegger/docs/drift && BACKUP_AGE_RECIPIENT=age1… ./backup.sh >> /var/log/middag-backup.log 2>&1
   ```
   Skriptet sender ikke kopien noe sted. Kopier `docs/drift/backup/*.age` til separat lagring i EØS (egen avtale, egen slettefrist). **Den private nøkkelen skal ikke ligge på serveren;** den må finnes hos minst to personer, ellers er kopiene verdiløse.
2. **`sqlite3 middag.sqlite ".backup kopi.sqlite"`** (som i `docs/synk.md`) fra et verktøy med `sqlite3` på verten. Imaget har ikke `sqlite3`-kommandoen. Ikke prøvd her. (Node 22.23.5 har også en `backup()`-funksjon i `node:sqlite`; ikke prøvd.) Et volumøyeblikksbilde fra leverandøren er ikke prøvd som sikkerhetskopi.

**Gjenoppretting (prøvd mot et nytt, tomt volum, med kopi laget av `backup.sh`).** Bruk et *nytt* volum og la det gamle stå urørt til alt er kontrollert; da trenger vi ikke slette noe i det gamle, og vi kan gå tilbake:

```sh
cd /srv/middagsplanlegger/docs/drift
docker compose --env-file .env.drift stop app
age -d -i <privat-nøkkel> -o /tmp/restore/middag.sqlite backup/middag-<tid>.sqlite.age       # på en trygg maskin
age -d -i <privat-nøkkel> -o /tmp/restore/tilbud.sqlite backup/tilbud-<tid>.sqlite.age       # samme tidspunkt
docker volume create middag-data-gjenopprettet
docker run --rm --user 1000:1000 -v middag-data-gjenopprettet:/data -v /tmp/restore:/in:ro \
  middagsplanlegger:pilot sh -c 'cp /in/middag.sqlite /data/middag.sqlite && cp /in/tilbud.sqlite /data/tilbud.sqlite'
echo "DATA_VOLUME=middag-data-gjenopprettet" >> .env.drift      # peker Compose på det nye volumet
docker compose --env-file .env.drift up -d
```

Kontroller etterpå at en kjent enhet får `200` fra `/api/household` med sitt token og at medlemslisten er riktig, og at `/api/offers/lagret` svarer `"status":"ok"` med tilbud (serveren skriver ved oppstart «Tilbudslagring: … (N observasjoner, M kjeder)»). Finnes ingen tilbudskopi, starter serveren med tom tilbudsdatabase og henter på nytt; prishistorikken før tapet er da borte. **Automatisk test: `npm run build:server && npm run check:backup`** (`scripts/checks/backup-restore.mjs`, krever `age`): den bygde serveren kjører med en husstand og en lagret tilbudsobservasjon; `backup.sh` kjøres mens serveren går (WAL), med en liten erstatning for `docker compose exec` som kjører kommandoen lokalt, og ekte `age`; begge filene dekrypteres til en ny katalog, og en ny server må lese begge (tokenet gir `200`, tilbudet serveres med opprinnelig observasjonsdato). Testen sjekker også at manglende tilbudsdatabase hoppes over og at manglende synk-database gir feil uten å opprette en tom fil. Den feiler mot den forrige versjonen av skriptet (bare `middag.sqlite`). **Ikke prøvd i Docker-oppsettet** med den nye versjonen av skriptet; gjør gjenopprettingsøvelsen over i Compose før piloten. Bruk **samme `SYNC_SECRET`** som før, ellers er åpne invitasjoner ugyldige (enhetstokenene er upåvirket). Slett den dekrypterte filen i `/tmp/restore` straks. Når alt virker: fjern det gamle volumet **og** gamle kopier etter slettefristen (de inneholder data til husstander som kan være slettet siden; se «slett igjen» i `docs/personvern/05-innsyn-retting-sletting.md`).

**Enhetene etter en gjenoppretting (rettet 2026-11-22):** hver enhet husker hvor langt den har lest (`cursor`) og siste hendelse den så (anker). Er kopien eldre, svarer serveren `reset`; enheten begynner på nytt fra 0 og sender hele sin egen lokale logg og sine dokumenter på nytt (idempotent på id, ingen doble rader, `docs/synk.md`, «Klient»). Det som bare fantes på serveren etter kopitidspunktet og ikke på noen enhet som kobler seg til igjen, er tapt. Prøvd i `npm run e2e:sync` (databasefil byttes, serveren startes på nytt) og `src/sync/engine.test.ts`. Gjenopprettingsøvelsen bør likevel kontrollere at alle enheter viser «Synket» etterpå.

### Sletting og WAL

Sletter eieren en husstand, fjernes radene med en gang (kaskade; `PRAGMA secure_delete` nuller sidene). Men innholdet kan ligge igjen i `middag.sqlite-wal` en kort tid. I prøven var en slettet etikett fortsatt i `-wal` rett etter slettingen og borte etter en checkpoint. Driftsansvarlig kan tvinge den ved en slettebegjæring, uten å stoppe serveren:

```sh
docker compose --env-file .env.drift exec app node --no-warnings -e \
  'const {DatabaseSync}=require("node:sqlite");const d=new DatabaseSync("/data/middag.sqlite");d.exec("PRAGMA busy_timeout=5000");console.log(d.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get())'
```

Sikkerhetskopier og volumkopier tatt før slettingen inneholder fortsatt dataene til de roterer ut.

### Slettefrist for sikkerhetskopier

- **Frist:** kopier slettes etter `BACKUP_KEEP_DAYS` dager (standard 30, forslag fra personvernutkastet; må avgjøres av eier). `backup.sh` sletter bare kopiene i `./backup`. **Kopier som er flyttet til ekstern lagring, må ha samme frist der** (livssyklusregel hos lagringsleverandøren, eller et eget ryddeskript). Ellers holder ikke fristen i personvernerklæringen.
- **Hva fristen betyr:** en husstand som er slettet (av eieren eller automatisk etter `SYNC_RETENTION_DAYS`), finnes i kopiene i høyst `BACKUP_KEEP_DAYS` dager etter slettingen. Lengste tid data om en inaktiv husstand ligger hos oss er altså `SYNC_RETENTION_DAYS + BACKUP_KEEP_DAYS` (med standardverdiene, som er eierens valg: 730 + 30 = 760 dager).
- **Etter gjenoppretting:** oppbevaringsjobben kjører ved oppstart og sletter husstander som fortsatt er inaktive, så sletting for inaktivitet gjentas av seg selv. Husstander som **eieren** slettet etter kopitidspunktet, kommer derimot tilbake og må slettes igjen for hånd (se «slett igjen» i `docs/personvern/05-innsyn-retting-sletting.md`).

### Hva som er testet (2026-11-22, sandkasse med Docker 29.10 og Compose 5.7)

**Testet:**
- `docker build` av den nye flertrinns-`Dockerfile` (esbuild-bygd server, alpine uten npm/node_modules) lykkes. **Størrelse (målt med `docker image inspect` / `docker save`): 417 MB → 200 MB utpakket, 107 MB → 54 MB komprimert** (det gamle imaget: `npm run server` med hele `node_modules`; bygget fra forrige commit på samme maskin). `node`-programmet alene er 124 MB, så mye mer lar seg ikke spare uten å bytte kjøretid. *Merk:* i sandkassen måtte byggingen kjøres med `--network host`, proxy som `--build-arg HTTPS_PROXY` og sandkassens sertifikat lagt inn for `npm ci` (nettverkspolicy). Sertifikatet ble lagt i en lokal kopi av `node:22.23.5-alpine` (`NODE_EXTRA_CA_CERTS`), tagget om til samme navn; **Dockerfilen er ikke endret for det**, og er ikke bygget på en vanlig maskin med direkte internett (CI-jobben `image` prøver det).
- Det nye imaget: starter som uid 1000 (`node`), skrivebeskyttet rotfilsystem med `--cap-drop ALL`, `healthy` etter ca. 25 s, `/healthz` og `/` gir `200`, `touch` i `/app` og `/etc` avvises, `/data` er skrivbar. Navngitt volum og `docker rm` + ny container mot samme volum: husstand og token overlevde (`200`).
- Compose (app + Caddy) med det nye imaget (`--no-build`, tagget `middagsplanlegger:pilot`): `healthy`, `https://localhost/` og `/healthz` gjennom Caddy `200`, husstand opprettet gjennom Caddy. `backup.sh` (age) laget kryptert og integritetskontrollert kopi; gjenoppretting til nytt volum med `DATA_VOLUME` etter prosedyren under ga `200` på gammelt token; WAL-tømmingen under «Sletting og WAL» kjørte uendret i det nye imaget.
- **Funn og rettelse:** `node` som PID 1 har ingen standard signalhåndtering; `docker stop` tok 10 s og endte med SIGKILL. `server/index.ts` har nå en liten SIGTERM/SIGINT-håndtering (lukker forbindelser og database, `exit 0`; SQLite tømmer da WAL). Etterpå: `docker stop` ca. 0,07 s, `compose stop` ca. 0,2 s, og `-wal`/`-shm` er borte etter stopp. Røyktesten sjekker at SIGTERM gir kode 0.
- Mot produksjonsbygget av serveren (`node dist-server/index.mjs`, 2026-11-22): `npm run smoke:server` (13 sjekker), `check:csp` og `check:pwa` (`BUILT_SERVER=1`) og `scripts/e2e-sync.mjs` (to enheter, frakoblet endring, erstatning, konflikt, gjenoppretting fra eldre kopi) bestod, og `npm audit --omit=dev` ga 0 sårbarheter. Playwright kjørte mot den bygde serveren utenfor Docker, ikke mot containeren.
- Prøvd tidligere med det gamle imaget (samme dag) og ikke gjentatt med det nye:
- Compose-oppsettet (app + Caddy) startet; appen ble `healthy`; `https://localhost/` ga `200` via Caddy (selvsignert sertifikat for `localhost`); HSTS-, nosniff- og referrer-hoder ble satt; appen kjørte som uid 1000, med skrivebeskyttet rotfilsystem og skrivbar `/data`; en husstand ble opprettet gjennom Caddy.
- Sletting: kaskade (`households`, `devices`, `events`) og `401` på gammelt token både for lesing og skriving; etikett i `-wal` til checkpoint.
- Tomt volum gir stille ny tom database (feil volum merkes ikke).
- Loggene: ingen forespørselslinjer fra Caddy, og appen logget bare oppstart og `ExperimentalWarning`.
- Gjenoppretting og enhetenes cursor (se over): rettet og prøvd i e2e mot en lokal server.

**Ikke testet:** at `docker compose up --build` bygger imaget (jeg bygde imaget for seg og brukte `--no-build`); Docker-bygging på en maskin med vanlig nett (uten sandkassens omveier), og CI-jobben `image` på GitHub; at serveren når Tjek fra containeren (i sandkassen ga `/api/offers` «Tilbud er ikke tilgjengelige», `fetch failed`: utgående nett var ikke åpent, så Tjek-oppslag fra imaget er **ikke** bekreftet; Node bruker egne rotsertifikater, så alpine uten `ca-certificates` bør ikke være et hinder, men det er ikke prøvd); `--init` er ikke lenger nødvendig for rask stopp, men er ikke fjernet fra Compose; hosting hos noen leverandør; ekte domene og Let's Encrypt (bare Caddys lokale selvsignerte sertifikat); at `TRUST_PROXY` faktisk leser klientens adresse gjennom Caddy (ikke målt); brannmur; `cron`; opplasting av kopi til ekstern lagring; `gpg`-varianten av `backup.sh`; `sqlite3 .backup`; volumøyeblikksbilder; bind mount og SELinux; at helsesjekken blir «unhealthy» ved databasefeil; lastprøving; ytelse; at den eldre `22-alpine` ga samme resultat (den er identisk med den festede per testdato); at imaget er bygget og kjørt på en annen CPU-arkitektur enn testmaskinens.

## 9. Må verifiseres av en person før beslutning

- Aktuelle priser og pristyper (fast månedspris vs. bruksbasert) hos de leverandørene som er aktuelle, og valutakurs.
- At valgt region faktisk er i EØS, og at sikkerhetskopier, logger og støtteverktøy holdes i EØS.
- Hver leverandørs databehandleravtale og liste over underleverandører (se `docs/personvern/04-databehandleravtaler-sjekkliste.md`).
- For amerikanske leverandører: gjeldende overføringsgrunnlag. EU–US Data Privacy Framework (kommisjonsvedtak fra 2023) er etter min kunnskap utfordret for domstolene i EU; nåværende rettsstatus og hvordan Datatilsynet i Norge forholder seg til den, må sjekkes.
- At norske leverandører (VPS, hosting) som kan være aktuelle, er kartlagt. Jeg har ikke gjort det.
- Hvilke sikkerhetskopifunksjoner og varig disk hver plattform faktisk tilbyr for en embedded database.
- Om de valgte leverandørene godtar vårt bruksområde (helserelaterte kostvalg kan gjøre behandlingen mer sensitiv).
- Domenepriser og registrar for .no.
- Node 22 sin siste støttedato og hvor stabil `node:sqlite` er i versjonen vi eventuelt hever til (avsnitt 8, «node:sqlite»).
- At valgt leverandør tilbyr diskkryptering, hva som er logget i nettverkslaget (IP-adresser), og hvordan øyeblikksbilder/sikkerhetskopier slettes.
- At `TRUST_PROXY=1` bak Caddy gir riktig klient-IP (ikke målt), og at brannmuren hindrer direkte tilgang til port 8787.
