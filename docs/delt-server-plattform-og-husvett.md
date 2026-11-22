# Husvett og plattformprosjektet på samme server

Dato: 2026-11-22. Status: **utkast, ikke prøvd på eierens server.** Dette er en sammenfatning. Den fullstendige veiledningen er [`installasjon-ubuntu.md`](installasjon-ubuntu.md), og stopp-punktene står i [`pilot-sjekkliste.md`](pilot-sjekkliste.md) (særlig C16 «Delt server»).

## Kort svar

Det går an å kjøre Husvett på samme server som plattformprosjektet. Det som avgjør hvor enkelt det blir, er om plattformen allerede bruker port 80 og 443. Husvett har fem deler som må være på plass: isolasjon, eget domene, egen backup, en tilgangsliste og en avtale om vedlikehold.

Min anbefaling: bruk den delte serveren i en kort test med familie, og flytt Husvett til en egen server før andre inviteres. Husvett er pakket i Docker, så flytting er enkel, og backup tas uavhengig av plattformen.

## 1. Slik er serveren (fra skjermbildet eieren viste)

- one.com Cloud server L, Ubuntu 26.04, 8 kjerner, 16 GB minne, 400 GB disk.
- Standardbrukeren heter «administrator». Tilgang via one.coms nettkonsoll. SSH er ikke bekreftet.
- Servere står i Europa. Land og datasenter er **ikke bekreftet**.
- Skjermbildet viser «additional resources active». Hva det betyr, og om det koster ekstra, er ikke avklart.
- IP-adressen skal ikke skrives i repoet eller i delte dokumenter.

Ressursmessig er serveren mer enn stor nok. Husvett er begrenset til 2 GB minne og 2 kjerner i oppsettet vårt.

## 2. Det du må finne ut først (leseskjemaet)

Kommandoene i guidens avsnitt 1 (L1–L23) **leser bare** og endrer ingenting. Resultatet avgjør veien:

| Spørsmål | Hvor i skjemaet | Hva det betyr |
| --- | --- | --- |
| Bruker noe port 80 og 443? | L3, L4 | Tom liste: vei A. Nginx, Caddy eller noe annet: vei B. |
| Er Docker installert, og fra hvor? | L7, L8 | Ikke installer på nytt. Finnes den fra Ubuntu, bruk den. |
| Kjører det containere som bruker portene? | L9 | `docker-proxy` på 80/443 betyr at en container eier portene. Stopp og spør. |
| Er det ledig disk og minne? | L12, L13 | Minst ca. 10 GB ledig disk. Husvett begrenses til 2,5 GB minne. |
| Går det planlagte jobber som rydder Docker? | L18 | `docker system prune` kan slette databasen. Avtal først. |
| Brannmur og IPv6? | L14–L16 | Port 80 og 443 må være åpne. Gammel AAAA-oppføring kan ødelegge sertifikatet. |
| Når går backupen? | L17 | Tidssonen avgjør når kopien tas. |

## 3. To veier

**Vei A: portene er ledige.** Husvett får sin egen Caddy som tar 80 og 443, henter sertifikat og sender trafikken til appen. Dette er `docs/drift/docker-compose.yml` slik det står.

**Vei B: plattformen bruker portene.** Husvett kjører bare appen på `127.0.0.1` på en egen port (standard 8790). Plattformens egen webserver (Nginx eller Caddy) får ett nytt vertsoppsett som sender `husvett.no` videre til appen. Filen `docs/drift/docker-compose.bak-proxy.yml` brukes. Husvett skal ikke ha en egen Caddy på denne veien.

Guiden har eksakte oppsett for både Nginx og Caddy, og sier at du skal ta sikkerhetskopi av plattformens konfigurasjon før du legger til noe. Guiden stopper og ber om hjelp hvis serveren har noe uvanlig (Traefik, Apache, `real_ip`, `trusted_proxies`, og så videre).

## 4. Det som må være adskilt

- **Egen systembruker og egen mappe** (`husvett`, `/srv/husvett`).
- **Egne Docker-volumer** og eget nettverk. Databasevolumet deles ikke.
- **Ressursgrenser:** appen har 2 GB minne, 2 kjerner og 256 prosesser. Caddy (vei A) har 512 MB.
- **Eget domene og eget sertifikat.** Husvett bruker `husvett.no`.
- **Egen backup:** begge Husvett-databasene (`middag.sqlite` og `tilbud.sqlite`) kopieres hver for seg, krypteres med `age` og lagres utenfor serveren. Backup-nøkkelen skal ikke ligge på serveren.

## 5. Det som blir felles, og risikoen

- **Administratortilgang:** alle med root eller Docker-tilgang på serveren kan lese Husvett-data. De må føres på en tilgangsliste, og det er et stopp-punkt (pilot-sjekklisten C16). Eieren har skrevet at bare vedkommende har administratortilgang, og at en Claude-økt for plattformprosjektet kan ha tilgang. Hvis det er riktig, må den økten også føres på tilgangslisten.
- **Felles feil:** en omstart eller en oppdatering av serveren tar ned begge tjenester. Avtal når Ubuntu og Docker oppdateres, og hvem som varsles.
- **Sikkerhetshull i plattformen** kan nå Husvett. Isolasjonen i guiden reduserer risikoen, men er ikke et skille som en egen server gir.
- **Personvern:** AVVR AS er behandlingsansvarlig. Eieren har oppgitt at databehandleravtale med one.com finnes og at serveren ligger i EØS. Dette er eierens opplysning og er ikke kontrollert av oss.

## 6. DNS og e-post

- Domenet `husvett.no` er registrert hos one.com.
- Bare `@` og `www` skal endres, slik at de peker mot serveren.
- **E-postoppføringene skal stå urørt** (`MX`, SPF og DKIM i `TXT`, `mail`, `autodiscover` og lignende). Feil endring kan stoppe e-post til `kontakt@husvett.no`.
- Ta skjermbilde av hele DNS-listen først, og send en prøvemelding før og etter endringen.
- Et vanlig webhotell hos one.com kan ikke kjøre serverdelen. Domenet må peke mot serveren, ikke mot webhotellet. Kartlegg først om det ligger en nettside på webhotellet som skal beholdes.

## 7. Rekkefølge (kort)

1. Kjør leseskjemaet i nettkonsollen og lim svaret inn i chatten.
2. Velg vei A eller B.
3. Opprett bruker og mappe, og installer Docker bare hvis den mangler.
4. Kartlegg DNS og e-post, og endre `@` og `www`.
5. Lag `.env.drift` fra `env.eksempel` (`SYNC_RETENTION_DAYS=730`, `SYNC_TOKEN_IDLE_DAYS=730`).
6. Start, kontroller `/healthz` på serveren og utenfra.
7. Lag backup-nøkkel (helst to holdere), sett opp daglig backup og kopi utenfor serveren, og gjør en gjenopprettingsøvelse.
8. Før tilgangslisten (C16) og avtal vedlikehold med plattformprosjektet.

## 8. Ikke gjør dette

- Ikke endre plattformens filer, nettverk, containere eller brannmur utover ett nytt vertsoppsett (vei B), og ikke uten sikkerhetskopi av konfigurasjonen.
- Ikke åpne appens port (8787 eller 8790) mot internett.
- Ikke kjør `docker system prune --volumes`, `docker volume prune -a` eller `docker compose down -v`.
- Ikke slett volumet `caddy-data` (sertifikatene ligger der).
- Ikke legg hemmeligheter i repoet, i chat eller i e-post: `.env.drift`, `SYNC_SECRET`, den private `age`-nøkkelen og IP-adresser.
- Ikke legg brukere i gruppen `docker` (det er root-tilgang).
- Ikke inviter ekte familier før stopp-punktene i pilot-sjekklisten er krysset av, også gjenopprettingsøvelsen (C7).

## 9. Hva som er prøvd, og hva som ikke er prøvd

**Prøvd i en testmaskin** (Docker, ikke Ubuntu 26.04 og ikke one.com): bygging av imaget, vei A og vei B, Nginx og Caddy foran appen, backup og gjenoppretting til nytt volum, tilbakerulling og måling av ratebegrensningen gjennom proxy.

**Ikke prøvd:** Ubuntu 26.04, one.coms nettkonsoll og brannmur, ekte DNS og sertifikater, om Dockers porter går forbi brannmuren på serveren, kjøring under systemd, ekstern lagring av backup, og last.

## 10. Åpne spørsmål til eieren

Disse står også i artifacten «Beslutninger» (spørsmål 33–37):

1. Resultatet av leseskjemaet, særlig hvem som bruker port 80 og 443.
2. Godtar plattformprosjektet deling av serveren, og hvem varsles før endringer?
3. Hvem har root-, sudo- og Docker-tilgang i dag?
4. Skriftlig databehandleravtale med one.com, og hvor ligger serveren og eventuelle øyeblikksbilder?
5. Er domenet registrert i AVVR AS sitt navn?
6. Hvem er de to nøkkelholderne for backup, og hvor skal kopiene ligge?
7. Kan nettkonsollen lime inn tekst, og skal SSH med nøkkel settes opp?
8. Hvem oppdaterer Ubuntu og Docker, og når?
