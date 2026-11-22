# Husvett og plattformprosjektet på samme server

Dato: 2026-11-22 (oppdatert samme dag etter Plattform-prosjektets kartlegging). Status: **utkast, ikke prøvd på eierens server.** Dette er en sammenfatning. Den fullstendige veiledningen er [`installasjon-ubuntu.md`](installasjon-ubuntu.md), og stopp-punktene står i [`pilot-sjekkliste.md`](pilot-sjekkliste.md) (særlig C16 «Delt server»).

## Kort svar

Husvett skal installeres nå på samme server som plattformprosjektet (eierens beslutning 2026-11-22; eieren har bekreftet at alle tilganger er hans egne). Port 80 og 443 er ledige, så Husvett får sin egen Caddy (**vei A**), bundet til serverens **offentlige** adresse alene (`PUBLIC_BIND_IP`), fordi Plattforms testmiljø skal bruke port 443 på WireGuard-adressen. Husvett har fem deler som må være på plass: isolasjon, eget domene, egen backup, en tilgangsliste og en avtale om vedlikehold. I tillegg er serveren i dag behandlet som **testserver** (se «STOPP» under).

Min anbefaling står fast: bruk den delte serveren i en kort test med familie, og flytt Husvett til en egen server før andre inviteres. Husvett er pakket i Docker, så flytting er enkel (guidens 0A.4), og backup tas uavhengig av plattformen.

## 1. Slik er serveren

**Opplyst av Plattform-prosjektet, ikke kontrollert av oss** (notat fra deres koordinatorøkt 2026-11-22, levert av eieren; uten IP, nøkler eller passord). Fullstendig tabell: [`installasjon-ubuntu.md`](installasjon-ubuntu.md), avsnitt 0A.

- one.com-server, Ubuntu 26.04.1, 8 kjerner, 16 GB minne, 400 GB disk, nesten tom.
- Ingenting lytter på port 80/443 i dag; `ufw` slipper dem inn. Plattforms testmiljø vil binde port 443 på `10.8.0.1` (WireGuard `wg0`, `10.8.0.1/24`), trolig denne uken.
- Docker (`docker-ce` 29.x med Compose, fra Dockers pakkelager) er installert; ingen containere kjører. Skal ikke installeres på nytt.
- `ufw` aktiv (SSH, 80, 443, 51820/udp), `fail2ban` aktiv. SSH bare med nøkkel, passord og root slått av, bare navngitte brukere (`AllowUsers`).
- Brukere: `mani` (eier, `sudo` med passord; gjør Husvett-arbeidet over SSH), `koordinator` (Plattforms Claude-økt, `sudo` uten passord, **midlertidig til 29.11.2026**), `administrator` (one.coms standardbruker, har passord og `sudo`, slipper ikke inn over SSH).
- Plattform bruker `/srv/stacks/plattform`, `/srv/stacks/akkreditering`, `/srv/edge` og `/home/mani/plattform`.
- `unattended-upgrades` er aktiv (kan kreve omstart); omstarter avtales med eieren.
- **Ikke kartlagt ennå:** ledig disk og minne, IPv6, tidssone, planlagte Docker-oppryddingsjobber. Lesepakke for eieren: guidens 0A.2.
- Fra eierens skjermbilde (før kartleggingen): servere i Europa, **land og datasenter ikke bekreftet**; «additional resources active» er ikke avklart.
- IP-adressen skal ikke skrives i repoet eller i delte dokumenter.

Ressursmessig er serveren mer enn stor nok. Husvett er begrenset til 2 GB minne og 2 kjerner i oppsettet vårt.

## 1b. STOPP: serveren er en testserver

**Opplyst av Plattform-prosjektet, ikke kontrollert av oss:** serveren er behandlet som testserver. Tre forhold må vurderes av eieren **før ekte familiedata** legges på serveren (pilot-sjekkliste **C17**). Vi foreslår tiltak; vi utfører dem ikke (vi har ingen tilgang, og SSH, `ufw` og brukere er Plattforms og eierens oppsett):

| Forhold | Hvorfor det betyr noe for Husvett | Forslag (eieren avgjør, utføres av eieren/Plattform) |
| --- | --- | --- |
| **Port 22 er åpen mot hele internett** | Alle med root kan lese Husvetts database; SSH er døren dit. Nøkkel-innlogging og `fail2ban` demper, men flaten er stor. Pilot-sjekkliste C1 sier «22 bare fra kjente adresser» | Begrens SSH til kjente adresser (one.coms brannmur eller `ufw`), eller bare over WireGuard; behold nøkkel-innlogging og `fail2ban`. Prøv ny regel i en ekstra SSH-økt før den gamle lukkes, og ha one.coms nettkonsoll som reservevei |
| **`koordinator` har full `sudo` uten passord** (til 29.11.2026) | En Claude-økt for et annet prosjekt kan lese og endre Husvetts data uten passord. Må føres i tilgangslisten | Fjern brukeren (eller `sudo`-retten og `AllowUsers`-linjen) **før** ekte familiedata, senest 29.11.2026. Kontroller etterpå med T1 i lesepakken |
| **`administrator` har aktivt passord og `sudo`** | Et passord som kan brukes lokalt (one.coms nettkonsoll) gir root. Slipper ikke inn over SSH (opplyst) | Lås passordet (`passwd -l administrator`) eller fjern `sudo`, etter avklaring med one.com om de trenger brukeren; ellers sterkt, unikt passord i passordhåndtereren og to-faktor på one.com-kontoen. **Før** passordet låses: kontroller at `mani` kan logge inn i one.coms nettkonsoll (reserveveien hvis SSH stenger deg ute) |

**I tillegg:** Husvett inviterer ingen ekte familier før **alle** andre STOPP-punkter i pilot-sjekklisten er krysset av eller avtalt bort skriftlig (bl.a. personvern, databehandleravtale, backup og gjenopprettingsøvelse).

## 2. Det du må finne ut først (leseskjemaet)

På Plattform-serveren er veien avgjort (vei A), og det meste er besvart av Plattform. Det som gjenstår (L12, L13, L15–L18, og L3/L4 som bekreftelse rett før start, pluss tilgang og omstart) ligger i **én lesepakke** som eieren kjører som `mani`: guidens 0A.2, med forklaring av svarene. Pakken maskerer IP-adresser. Den generelle tabellen under gjelder for en annen server.

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

**Vei A: portene er ledige (valgt for Plattform-serveren).** Husvett får sin egen Caddy som tar 80 og 443, henter sertifikat og sender trafikken til appen. Dette er `docs/drift/docker-compose.yml` slik det står. På Plattform-serveren settes `PUBLIC_BIND_IP` i `.env.drift` til serverens offentlige IPv4-adresse (aldri i repoet), så Caddy ikke binder `10.8.0.1:443`, som Plattforms testmiljø skal bruke; uten den kolliderer de (prøvd i sandkassen). Appen publiseres ikke på verten i det hele tatt. Med `PUBLIC_BIND_IP` svarer Husvett bare på IPv4, så det skal ikke være AAAA-oppføringer for `husvett.no`.

**Vei B: plattformen bruker portene.** Husvett kjører bare appen på `127.0.0.1` på en egen port (standard 8790). Plattformens egen webserver (Nginx eller Caddy) får ett nytt vertsoppsett som sender `husvett.no` videre til appen. Filen `docs/drift/docker-compose.bak-proxy.yml` brukes. Husvett skal ikke ha en egen Caddy på denne veien.

Guiden har eksakte oppsett for både Nginx og Caddy, og sier at du skal ta sikkerhetskopi av plattformens konfigurasjon før du legger til noe. Guiden stopper og ber om hjelp hvis serveren har noe uvanlig (Traefik, Apache, `real_ip`, `trusted_proxies`, og så videre).

## 4. Det som må være adskilt

- **Egen systembruker og egen mappe** (`husvett`, `/srv/husvett`).
- **Egne Docker-volumer** og eget nettverk. Databasevolumet deles ikke.
- **Ressursgrenser:** appen har 2 GB minne, 2 kjerner og 256 prosesser. Caddy (vei A) har 512 MB.
- **Eget domene og eget sertifikat.** Husvett bruker `husvett.no`.
- **Egen backup:** begge Husvett-databasene (`middag.sqlite` og `tilbud.sqlite`) kopieres hver for seg, krypteres med `age` og lagres utenfor serveren. Backup-nøkkelen skal ikke ligge på serveren.

## 5. Det som blir felles, og risikoen

- **Administratortilgang:** alle med root eller Docker-tilgang på serveren kan lese Husvett-data. De må føres på en tilgangsliste, og det er et stopp-punkt (pilot-sjekklisten C16). Tilgangslisten etter Plattforms opplysning (ikke kontrollert av oss): `mani` (eier), `koordinator` (Plattforms Claude-økt, full `sudo` uten passord, midlertidig til 29.11.2026), `administrator` (one.coms standardbruker, passord og `sudo`, ikke SSH) og **one.com** som leverandør (konsoll og maskinvare). Se også STOPP i 1b.
- **Felles feil:** en omstart eller en oppdatering av serveren tar ned begge tjenester. `unattended-upgrades` er aktiv. Omstarter avtales med eieren, og **eieren varsles** før planlagte omstarter og Docker-oppgraderinger (guidens 0A.3). Husvett starter selv igjen (`restart: unless-stopped`), men kontrolleres etter hver omstart.
- **Port 80/443 og Plattforms planer:** Plattform planla å stenge 80/443 etter testfasen. Det går ikke så lenge Husvett ligger der. Merk at en `ufw`-regel ikke stenger Husvett (Docker-porter går forbi `ufw`), mens en stenging i one.coms brannmur gjør det.
- **Sikkerhetshull i plattformen** kan nå Husvett. Isolasjonen i guiden reduserer risikoen, men er ikke et skille som en egen server gir.
- **Personvern:** AVVR AS er behandlingsansvarlig. Eieren har oppgitt at databehandleravtale med one.com finnes og at serveren ligger i EØS. Dette er eierens opplysning og er ikke kontrollert av oss.

## 6. DNS og e-post

- Domenet `husvett.no` er registrert hos one.com.
- Bare `@` og `www` skal endres, slik at de peker mot serveren.
- **E-postoppføringene skal stå urørt** (`MX`, SPF og DKIM i `TXT`, `mail`, `autodiscover` og lignende). Feil endring kan stoppe e-post til `kontakt@husvett.no`.
- Ta skjermbilde av hele DNS-listen først, og send en prøvemelding før og etter endringen.
- Et vanlig webhotell hos one.com kan ikke kjøre serverdelen. Domenet må peke mot serveren, ikke mot webhotellet. Kartlegg først om det ligger en nettside på webhotellet som skal beholdes.

## 7. Rekkefølge (kort)

1. Les «Ikke rør» (guidens 0A.1). Kjør lesepakken (0A.2) som `mani` over SSH og lim det maskerte svaret inn i chatten.
2. Vei A (avgjort for Plattform-serveren).
3. Opprett bruker og mappe. Docker finnes: kontroller bare versjonen.
4. Kartlegg DNS og e-post, og endre `@` og `www` (bare A, ingen AAAA med `PUBLIC_BIND_IP`).
5. Lag `.env.drift` fra `env.eksempel` (`SYNC_RETENTION_DAYS=730`, `SYNC_TOKEN_IDLE_DAYS=730`, og `PUBLIC_BIND_IP` = offentlig IPv4).
6. Start, kontroller `/healthz` på serveren og utenfra.
7. Lag backup-nøkkel (helst to holdere), sett opp daglig backup og kopi utenfor serveren, og gjør en gjenopprettingsøvelse.
8. Før tilgangslisten (C16) og avtal vedlikehold med plattformprosjektet.
9. Eieren avgjør herdingen (C17) før ekte familiedata.

## 8. Ikke gjør dette

- Ikke rør `/srv/stacks`, `/srv/edge`, `/home/mani/plattform`, WireGuard, `ufw`, `fail2ban`, SSH-oppsettet, Plattforms Docker-nettverk, -volumer og -containere, GHCR-innloggingen hos root, eller port 443 på `10.8.0.1` (guidens 0A.1). Ingen nye SSH-brukere uten `AllowUsers`-endring avtalt med eieren. Aldri `docker system prune`.
- Ikke endre plattformens filer, nettverk, containere eller brannmur utover ett nytt vertsoppsett (vei B), og ikke uten sikkerhetskopi av konfigurasjonen.
- Ikke åpne appens port (8787 eller 8790) mot internett.
- Ikke kjør `docker system prune --volumes`, `docker volume prune -a` eller `docker compose down -v`.
- Ikke slett volumet `caddy-data` (sertifikatene ligger der).
- Ikke legg hemmeligheter i repoet, i chat eller i e-post: `.env.drift`, `SYNC_SECRET`, den private `age`-nøkkelen og IP-adresser.
- Ikke legg brukere i gruppen `docker` (det er root-tilgang).
- Ikke inviter ekte familier før stopp-punktene i pilot-sjekklisten er krysset av, også gjenopprettingsøvelsen (C7).

## 9. Hva som er prøvd, og hva som ikke er prøvd

**Prøvd i en testmaskin** (Docker, ikke Ubuntu 26.04 og ikke one.com): bygging av imaget, vei A og vei B, Nginx og Caddy foran appen, backup og gjenoppretting til nytt volum, tilbakerulling og måling av ratebegrensningen gjennom proxy.

**Også prøvd (senere 2026-11-22):** `PUBLIC_BIND_IP` med `docker compose config` med og uten variabelen (uten er utskriften identisk med før), og en ekte Caddy-start: uten variabelen feilet den med `address already in use` når en annen lytter hadde 443 på en annen adresse; med variabelen lyttet den bare på den valgte adressen.

**Ikke prøvd:** Ubuntu 26.04, one.coms brannmur, ekte DNS og sertifikater, `PUBLIC_BIND_IP` sammen med Plattforms ekte WireGuard-binding og etter omstart, IPv6, om Dockers porter går forbi brannmuren på serveren, kjøring under systemd, ekstern lagring av backup, flytting til ny server, og last.

## 10. Åpne spørsmål til eieren

Disse står også i artifacten «Beslutninger» (spørsmål 33–37):

1. Resultatet av lesepakken (guidens 0A.2): disk, minne, IPv6/NAT, tidssone, oppryddingsjobber, tilgang og `unattended-upgrades`.
2. ~~Godtar plattformprosjektet deling?~~ Besvart: eieren har bekreftet installasjonen; eieren varsles før endringer og omstarter. Gjenstår: er Plattform innforstått med at 80/443 ikke kan stenges mens Husvett ligger der?
3. Tilgang er opplyst (`mani`, `koordinator` til 29.11.2026, `administrator`, one.com). Hvilke herdingstiltak (1b) gjøres før ekte familiedata, og når?
4. Skriftlig databehandleravtale med one.com, og hvor ligger serveren og eventuelle øyeblikksbilder?
5. Er domenet registrert i AVVR AS sitt navn?
6. Hvem er de to nøkkelholderne for backup, og hvor skal kopiene ligge?
7. ~~Nettkonsoll eller SSH?~~ Besvart: SSH med nøkkel som `mani`.
8. Når tas omstarter etter `unattended-upgrades`, og når oppgraderes Docker?
