# Installere Husvett på en Ubuntu-server som deles med et annet prosjekt

**Status: UTKAST, skrevet 2026-11-22. Ikke prøvd på eierens server.** Guiden er skrevet for eierens leide server hos one.com (Cloud server L, Ubuntu 26.04, 8 vCPU, 16 GB minne, 400 GB disk, bruker `administrator`, tilgang via one.coms nettkonsoll), som allerede brukes av et annet prosjekt («plattformprosjektet»). Hva som kjører der, om det bruker port 80/443, og om Docker er installert, er **ikke kjent**. Derfor starter guiden med å *lese* tilstanden, og først deretter velger du vei A eller B.

Les også: [`hosting.md`](hosting.md) (bakgrunn, miljøvariabler, avsnitt 8 om Docker, sikkerhetskopi og gjenoppretting), [`pilot-sjekkliste.md`](pilot-sjekkliste.md) (alt som må være på plass før ekte familier), [`sikkerhet.md`](sikkerhet.md) og filene i [`drift/`](drift/).

**Hva er prøvd, og hva er ikke?** Kort: Docker-bygget, begge Compose-variantene (vei A med vår egen Caddy, vei B bak Nginx eller Caddy på verten), sikkerhetskopi, gjenoppretting og tilbakerulling er prøvd **i en sandkasse** (Linux-container med Docker 29.10 og Compose 5.7, ikke Ubuntu 26.04, ikke one.com, uten ekte domene). **Ingenting er prøvd på Ubuntu 26.04 eller hos one.com.** Hele listen står i avsnitt 14. Der det står **«sjekk dette»**, vet vi ikke svaret og forteller deg hvordan du finner det ut.

**Ingen IP-adresser, passord eller nøkler skal skrives inn i repoet**, i denne guiden eller i chat. Der guiden trenger dem, står det `<SLIK>` og hvor du finner verdien.

---

## 0. Før du begynner

**Hvem gjør hva.** Rollen «Admin» (hosting.md, avsnitt 0) følger guiden. Avtal med den som har ansvar for plattformprosjektet **før** du endrer noe på serveren: du kommer til å installere programmer (kanskje Docker), og i vei B legger du til ett nytt vertsoppsett i deres webserver.

**Slik leser du kommandoene.**

- Alt i grå bokser skrives (eller limes inn) i konsollen, én linje om gangen, og avsluttes med Enter. Linjer som begynner med `#` er forklaringer og trenger ikke skrives.
- `sudo` betyr «kjør som administrator (root)». Første gang spør den om passordet til brukeren `administrator`. Det vises ingen tegn mens du skriver passordet; det er normalt.
- `<SLIK>` skal byttes ut med en verdi, uten `<` og `>`.
- Fra og med avsnitt 3 bruker guiden et **root-skall** for Husvett-arbeid: skriv `sudo -i` én gang, og alle kommandoer etter det kjøres som root (ledeteksten slutter da med `#` i stedet for `$`). Skriv `exit` når du er ferdig. Vær ekstra nøye i et root-skall: ingen spør om du er sikker.
- Får du en feilmelding du ikke forstår: **stopp**, ta et skjermbilde (uten passord eller nøkler) og spør utvikleren. Ikke prøv deg fram med kommandoer fra nettet på en server som også kjører et annet prosjekt.

**Nettkonsollen hos one.com.** Guiden forutsetter bare nettkonsollen (SSH er ikke bekreftet). **Sjekk dette:** om du kan lime inn tekst i konsollen (prøv med en kort, ufarlig linje som `echo hei`). Går det ikke, må lange filer skrives for hånd, og da er SSH verdt å sette opp først (spør utvikleren).

**Driftslogg.** Før en enkel logg utenfor repoet (f.eks. et dokument hos AVVR AS): dato, hva du gjorde, hvilken versjon (commit) som kjører, og hva som gikk galt. Ingen passord, nøkler eller IP-adresser i den heller, hvis den deles.

---

## 1. Les tilstanden (bare lesing, endrer ingenting)

Kommandoene under **endrer ingenting** på serveren. Kjør dem i rekkefølge og skriv ned svarene (uten IP-adresser i noe som deles). Resultatet avgjør veien videre (avsnitt 2).

| # | Kommando | Hva den viser | Skriv ned |
| --- | --- | --- | --- |
| L1 | `cat /etc/os-release` | Ubuntu-versjon og kodenavn | `VERSION_ID` (ventet `26.04`) og `VERSION_CODENAME` (ventet `resolute`) |
| L2 | `uname -m` | Prosessortype | `x86_64` (vanlig) eller `aarch64`. Imaget er bare prøvd på `x86_64` |
| L3 | `sudo ss -tlnp '( sport = :80 or sport = :443 )'` | Hvilke programmer som lytter på port 80 og 443 (TCP) | Tom liste (bare overskrift), eller navnet i `users:(("…"` (f.eks. `nginx`, `caddy`, `apache2`, `docker-proxy`, `traefik`) |
| L4 | `sudo ss -ulnp '( sport = :443 )'` | Om noe lytter på UDP 443 (HTTP/3) | Tom eller programnavn |
| L5 | `sudo ss -tlnp '( sport = :8790 )'` | Om porten vi vil bruke i vei B er ledig | Bør være tom |
| L6 | `systemctl list-units --type=service --state=running --no-pager` | Tjenester som kjører | Se etter `nginx`, `caddy`, `apache2`, `docker`, `containerd`, `podman`, databaser |
| L7 | `command -v docker && docker --version; docker compose version` | Om Docker og Compose finnes | Versjonene, eller at kommandoen ikke finnes |
| L8 | `apt list --installed 2>/dev/null \| grep -Ei 'docker\|containerd\|podman\|runc'` | Hvilke Docker-pakker som er installert, og fra hvor | Pakkenavn: `docker-ce` (fra Docker) eller `docker.io` (fra Ubuntu), eller ingenting |
| L9 | `sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'` | Kjørende containere (bare hvis L7 fant Docker) | Navn og porter. Se særlig etter noe som publiserer `:80->` eller `:443->` |
| L10 | `sudo docker volume ls` og `sudo docker network ls` | Volumer og nettverk som finnes | At ingen heter `middagsplanlegger_…` fra før |
| L11 | `command -v node && node --version` | Om Node er installert på verten | Bare til orientering. Husvett bruker Node **inne i** Docker-imaget, ikke vertens Node |
| L12 | `df -h /` og `df -h /var/lib/docker 2>/dev/null` | Ledig disk | Kolonnen `Avail`. Husvett trenger minst ca. 10 GB ledig (image, byggebuffer, databaser og sikkerhetskopier; grovt anslag) |
| L13 | `free -h` og `nproc` | Minne og antall prosessorer | `available` i linjen `Mem:`. Husvett er begrenset til 2,5 GB (avsnitt 7) |
| L14 | `sudo ufw status verbose` | Ubuntus brannmur | `Status: active` eller `inactive`, og hvilke porter som er tillatt |
| L15 | `sudo nft list ruleset \| head -50` | Brannmurregler på lavere nivå (Docker legger inn regler her) | Bare til orientering |
| L16 | `ip -4 addr show scope global` og `ip -6 addr show scope global` | Serverens IP-adresser | **Ikke i repoet eller i delte dokumenter.** Noter om det finnes en IPv6-adresse (linje med `inet6`) |
| L17 | `timedatectl` | Klokke og tidssone | `Time zone` (sikkerhetskopien kjører kl. 03.17 i denne tidssonen) |
| L18 | `sudo crontab -l; ls /etc/cron.d; systemctl list-timers --no-pager` | Planlagte jobber | Se særlig etter `docker system prune`, `docker volume prune` eller opprydding som kan slette volumer |
| L19 | `curl -sI https://download.docker.com \| head -1` og `curl -sI https://api.etilbudsavis.dk \| head -1` | Om serveren når Docker (installasjon) og Tjek (tilbud) | En linje som begynner med `HTTP/`. Feil eller ingenting = utgående nett er stengt |

**Bare hvis L3 viser en webserver**, les også oppsettet (fortsatt bare lesing):

| # | Kommando | Hva den viser |
| --- | --- | --- |
| L20 | `systemctl status nginx caddy apache2 --no-pager` | Hvilken webserver som kjører som tjeneste på verten |
| L21 | `sudo nginx -T 2>/dev/null \| grep -nE 'server_name\|listen\|include\|real_ip'` | Nginx: domener, porter, hvilke mapper som leses inn, og om `real_ip` er i bruk |
| L22 | `sudo cat /etc/caddy/Caddyfile` | Caddy: domener og om `import` eller `trusted_proxies` er i bruk |
| L23 | `command -v certbot; snap list certbot 2>/dev/null; sudo ls /etc/letsencrypt/live 2>/dev/null` | Om certbot (sertifikater for Nginx) finnes, og hvordan den er installert |

## 2. Slik avgjør resultatet veien videre

| Hva L3 (og L9/L20) viste | Vei | Merknad |
| --- | --- | --- |
| **Ingenting lytter på 80 eller 443** | **A** (avsnitt 6A) | Vår egen Caddy tar port 80/443 og henter sertifikat selv. Finnes Docker fra før (L7), bruk den; ikke installer på nytt |
| **`nginx` som tjeneste på verten** (L20 viser `nginx.service` aktiv) | **B med Nginx** (avsnitt 6B) | Ett nytt vertsoppsett i Nginx; ingenting annet endres |
| **`caddy` som tjeneste på verten** (L20 viser `caddy.service` aktiv) | **B med Caddy** (avsnitt 6C) | Én ny blokk i deres Caddyfile |
| **`docker-proxy`** på 80/443, eller `traefik`, eller en container i L9 med `:80->`/`:443->` | **Stopp, spør utvikleren** | Webserveren kjører selv i Docker. Den når ikke `127.0.0.1` på verten, så vei B fungerer ikke uendret. Ikke dekket eller prøvd her |
| **`apache2`** | **Stopp, spør utvikleren** | Apache som proxy er mulig, men ikke skrevet eller prøvd |
| **Noe annet eller uklart** | **Stopp, spør utvikleren** | – |

**Andre funn som stopper deg (uansett vei):**

- **L1 viser ikke Ubuntu 26.04:** kommandoene kan fortsatt stemme, men er ikke kontrollert for andre versjoner. Spør.
- **L8 viser Docker fra Ubuntu (`docker.io`) eller `podman-docker`:** ikke installer Dockers egne pakker i tillegg (de krasjer med hverandre, og en ny Docker-motor starter plattformprosjektets containere på nytt). Bruk den som finnes hvis `docker compose version` virker (L7); se avsnitt 3.2.
- **L12/L13: under 10 GB ledig disk eller under 4 GB tilgjengelig minne:** snakk med plattformprosjektet først.
- **L18 viser `docker system prune --volumes`, `docker volume prune -a` eller lignende:** en slik jobb kan slette Husvetts database når containeren står stoppet. Avtal at den tar hensyn til Husvett før du går videre.
- **L19 får ikke svar fra Tjek:** appen virker, men tilbud fra Tjek vil mangle. Spør one.com/plattformprosjektet om utgående brannmur.
- **L21 viser `real_ip`, eller L22 viser `trusted_proxies`:** det står en annen proxy eller CDN foran webserveren. Da kan ratebegrensningen telle feil (sikkerhet.md S3). Spør utvikleren før vei B.

---

## 3. Felles forberedelser (begge veier)

### 3.1 Programmer på verten

```sh
sudo -i
apt update
apt install -y git age curl ca-certificates
```

`git` henter koden, `age` krypterer sikkerhetskopiene, `curl` brukes til kontroller. Alle tre finnes i Ubuntu 26.04 (`age` 1.2.1 er sett i Ubuntus pakkeoversikt for `resolute` 2026-11-22; ikke installert av oss).

### 3.2 Docker og Docker Compose

**Finnes Docker allerede (L7 viste versjoner for både `docker` og `docker compose`)?** Hopp over resten av 3.2. Ikke installer på nytt, og ikke oppgrader uten avtale med plattformprosjektet: en ny Docker-motor starter alle containere på serveren på nytt. Kravet er Compose versjon 2 eller nyere (kommandoen `docker compose` med mellomrom; den gamle `docker-compose` med bindestrek er ikke prøvd og virker trolig ikke med `docker-compose.yml` vår).

**Finnes `docker`, men ikke `docker compose`?** Installer bare Compose-tillegget fra samme kilde som Docker kom fra (L8): `apt install -y docker-compose-plugin` hvis du så `docker-ce`, eller `apt install -y docker-compose-v2` hvis du så `docker.io`. Sjekk med `docker compose version`.

**Finnes ingen Docker (L7 og L8 tomme)?** Installer fra Dockers offisielle apt-kilde. Kommandoene følger Dockers egen veiledning slik den var da guiden ble skrevet. **Sammenlign med `https://docs.docker.com/engine/install/ubuntu/` den dagen du installerer**; endrer Docker veiledningen, gjelder den.

**Trinn 1: kontroller at Docker har pakker for denne Ubuntu-versjonen** (bare lesing):

```sh
. /etc/os-release && echo "$VERSION_CODENAME"
curl -fsS -o /dev/null -w '%{http_code}\n' "https://download.docker.com/linux/ubuntu/dists/$VERSION_CODENAME/Release"
```

- `200`: kilden finnes. Per 2026-11-22 har Docker en kilde for `resolute` (Ubuntu 26.04) med `docker-ce` 29.10.0 og `docker-compose-plugin` 5.8.0 for `amd64` (lest av oss fra Dockers pakkeoversikt; **ikke installert på Ubuntu 26.04 av oss**). Gå til trinn 2.
- `404` eller feil: ingen offisiell kilde for denne versjonen (ennå). **Ikke** bytt kodenavnet til en eldre Ubuntu-versjon. Bruk reserveveien under.

**Trinn 2: legg til Dockers kilde og installer** (fortsatt i root-skallet):

```sh
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt update
apt-cache policy docker-ce docker-compose-plugin
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

`apt-cache policy` skal vise en `Candidate:` fra `download.docker.com` for begge pakkene. Står det `Candidate: (none)`, stopp: kilden har ikke pakken for denne versjonen.

**Ikke kjør** trinnet i Dockers veiledning som avinstallerer «gamle» pakker (`apt-get remove docker.io … containerd runc`) på denne serveren. Det kan fjerne noe plattformprosjektet bruker. Finnes noe av det (L8), skal du ikke installere Dockers pakker i det hele tatt.

**Reservevei hvis Docker ikke har pakker for 26.04:** Ubuntus egne pakker. Per 2026-11-22 finnes `docker.io` 29.1.3, `docker-compose-v2` 2.40.3 og `docker-buildx` 0.30.1 for `resolute` i Ubuntus pakkeoversikt (sett av oss, ikke installert):

```sh
apt-cache policy docker.io docker-compose-v2 docker-buildx
apt install -y docker.io docker-compose-v2 docker-buildx
```

Bruk **én** av kildene, aldri begge.

**Trinn 3: kontroll.**

```sh
systemctl is-active docker          # skal svare: active
systemctl is-enabled docker         # skal svare: enabled (starter igjen etter omstart av serveren)
docker --version
docker compose version
docker run --rm hello-world         # henter et lite testbilde og skriver «Hello from Docker!»
```

**Ikke legg `administrator` (eller andre) i gruppen `docker`.** Den gir full root-tilgang til hele serveren, også plattformprosjektet. Bruk `sudo` / root-skallet.

### 3.3 Egen systembruker, egen mappe

Husvett får sin egen systembruker (`husvett`, uten innlogging), sin egen mappe (`/srv/husvett`) og sin egen mappe for sikkerhetskopier. Ingenting legges i plattformprosjektets mapper.

```sh
# Fortsatt i root-skallet (sudo -i)
id husvett 2>/dev/null || adduser --system --group --home /srv/husvett --shell /usr/sbin/nologin husvett
install -d -m 750 -o husvett -g husvett /srv/husvett
install -d -m 700 -o root -g root /srv/husvett/backup
ls -la /srv/husvett
```

Ventet: mappen `/srv/husvett` eies av `husvett`, og `backup` eies av `root` med `drwx------`. **Sjekk dette:** at `adduser` på 26.04 godtar valgene over (den skal svare uten feil, og `id husvett` skal deretter vise en bruker). Hvis ikke: stopp og spør.

### 3.4 Hent koden

Repoet er offentlig på GitHub, så det trengs ingen nøkkel for å lese det.

```sh
sudo -u husvett git clone https://github.com/mani19871/Middagplanlegger.git /srv/husvett/middagsplanlegger
sudo -u husvett git -C /srv/husvett/middagsplanlegger log -1 --oneline
```

Skriv den siste linjen (commit og tekst) i driftsloggen: det er versjonen du installerer. Spør utvikleren hvilken branch eller commit som skal kjøres (i dag: `claude/middagsplanner-app-wwuq1p`, som er standardbranchen).

Git kjøres alltid som `husvett` (`sudo -u husvett git …`), ikke som root. Ikke endre filer som ligger i git i denne mappen; da stopper neste oppdatering. Bare `.env.drift` er din egen (den sjekkes aldri inn, `docs/drift/.gitignore`).

---

## 4. DNS for husvett.no (hos one.com)

Gjør dette **tidlig**: endringer i DNS bruker tid på å nå fram, og i vei A må DNS peke riktig **før** første oppstart.

**Eierens opplysning (2026-11-22):** `husvett.no` er registrert hos one.com, så DNS-oppføringene settes i **one.coms DNS-panel**. Eieren har også et vanlig one.com-**webhotell**. Webhotellet kan **ikke** kjøre Husvett (Node-server med SQLite; hosting.md, avsnitt 0). Domenet skal derfor peke mot **serveren (VPS-en)**, ikke mot webhotellet. **Ikke bekreftet av oss:** at domenet står i AVVR AS sitt navn (pilot-sjekkliste A4).

### 4.1 Kartlegg det som finnes på domenet i dag (før du endrer noe)

En feil DNS-endring kan **stoppe e-posten** til `kontakt@husvett.no` eller ta ned en nettside som ligger på webhotellet. Kartlegg derfor først, og lagre resultatet **privat** (ikke i repoet; listen inneholder adresser):

1. **Skjermbilde av hele DNS-listen** i one.com-panelet (alle oppføringer, også dem som er merket som standard).
2. **Fra din egen PC** (Windows, Mac og Linux har `nslookup`):

```sh
nslookup -type=NS husvett.no
nslookup -type=MX husvett.no
nslookup -type=TXT husvett.no
nslookup -type=A husvett.no
nslookup -type=AAAA husvett.no
nslookup www.husvett.no
```

`NS` viser hvem som styrer DNS (ventet: one.com). `MX` og `TXT` (SPF, ofte en linje med `v=spf1`) hører til e-posten. `A`/`AAAA` for `husvett.no` og `www` viser hvor nettsiden peker i dag (trolig webhotellet).
3. **Nettside i dag:** åpne `https://husvett.no/` og `https://www.husvett.no/`. Ligger det en side på webhotellet som skal beholdes, avgjør eieren **før** DNS endres hva som skal skje med den: når `husvett.no` og `www` peker mot serveren, vises ikke webhotellets side der lenger.
4. **E-post i dag:** send en prøvemelding til `kontakt@husvett.no` utenfra og se at den kommer fram. Da vet du at e-posten virket før endringen.

### 4.2 Finn serverens adresser

I one.coms kontrollpanel for serveren (oversikten viser IPv4 og eventuelt IPv6). **Skriv dem ikke i repoet.** Sammenlign med L16. **Sjekk dette:** at adressen i L16 er den samme som i kontrollpanelet. Begynner adressen i L16 med `10.`, `172.16.`–`172.31.` eller `192.168.`, er det en intern adresse: bruk den fra kontrollpanelet.

### 4.3 Endre oppføringene i one.coms DNS-panel

**Forbehold:** one.com endrer panelet sitt fra tid til annen. Navnene under er slik vi forventer dem, ikke kontrollert mot panelet i dag. Finner du ikke det som beskrives, stopp og ta et skjermbilde.

1. Logg inn på one.coms kontrollpanel (med to-faktor) og velg domenet `husvett.no`.
2. Finn DNS-innstillingene for domenet (hos one.com har de ligget under noe som «Avanserte innstillinger» → «DNS-innstillinger»; **sjekk dette**). Der står oppføringene i en liste, og det finnes en knapp for å legge til eller redigere en oppføring.
3. **Endre bare oppføringene for `@` (selve `husvett.no`) og `www`**, slik:

| Navn (vert) | Type | Verdi | Merknad |
| --- | --- | --- | --- |
| `@` (selve `husvett.no`; noen paneler vil ha feltet tomt) | A | `<SERVERENS IPv4>` | Hovedadressen |
| `www` | A | `<SERVERENS IPv4>` | Eller i stedet: `www` som **CNAME** til `husvett.no` (følger da `@` av seg selv). Ikke begge |
| `@` | AAAA | `<SERVERENS IPv6>` | **Bare hvis serveren har en offentlig IPv6** (4.2) |
| `www` | AAAA | `<SERVERENS IPv6>` | Samme (ikke nødvendig hvis `www` er CNAME) |

4. **Gamle A/AAAA for `@` og `www`** som peker mot webhotellet må endres eller fjernes, ellers peker domenet to steder. Særlig **gamle AAAA-oppføringer**: Let's Encrypt bruker IPv6-adressen når den finnes, og en AAAA som peker mot webhotellet kan gi sertifikatfeil selv om A er riktig. Har `www` en CNAME fra før, må den bort før du kan lage en A-oppføring på `www` (eller behold CNAME-en hvis den peker til `husvett.no`). **Sjekk dette:** om one.com viser webhotellets oppføringer som «standard»/låste, og om du da må slå dem av eller lage egne oppføringer som erstatter dem. Er du usikker: spør one.coms kundeservice før du endrer, og si at **e-posten skal beholdes**.
5. **E-posten skal stå urørt.** Ikke endre, slett eller «tilbakestill» `MX`, `TXT` (SPF, DKIM), oppføringer for e-post som `mail`, `webmail`, `autodiscover` eller `autoconfig`, eller andre oppføringer du ikke vet hva er. Bruk **ikke** valg som «tilbakestill til standard», «pek domenet til ekstern server» eller bytte av navnetjenere (NS): slike valg kan erstatte hele listen og stoppe e-posten. Peker `MX` mot selve `husvett.no` (i stedet for et navn hos one.com), stopp og spør utvikleren før du endrer A.
6. **CAA:** `nslookup -type=CAA husvett.no`. Ingen CAA-oppføring er greit. Finnes det CAA, må én av dem tillate `letsencrypt.org`.
7. **Ikke slå på noen «proxy»- eller CDN-funksjon** for domenet (en tjeneste som legger seg foran serveren). Da står det to proxyer foran appen, og ratebegrensningen teller feil (sikkerhet.md S3).

### 4.4 Kontroller etterpå

**Hvor lang tid?** Ofte noen minutter, noen ganger noen timer. Gamle svar kan huskes av andre DNS-tjenere til levetiden (TTL) på den gamle oppføringen er ute (ofte 1 time, i blant opptil et døgn). Fra PC-en:

```sh
nslookup husvett.no 1.1.1.1
nslookup www.husvett.no 1.1.1.1
nslookup -type=AAAA husvett.no 1.1.1.1
nslookup -type=MX husvett.no 1.1.1.1
```

De tre første skal gi serverens adresse (og ingen andre). `MX` skal være **likt** det du noterte i 4.1. På serveren kan du bruke `getent hosts husvett.no`.

**Send en ny prøvemelding til `kontakt@husvett.no` utenfra** og se at den kommer fram. Kommer den ikke: sammenlign DNS-listen med skjermbildet fra 4.1 og legg tilbake det som mangler (e-postoppføringene), eller kontakt one.com.

---

## 5. Miljøfilen `.env.drift`

Miljøfilen holder innstillinger og hemmeligheten `SYNC_SECRET`. Den ligger bare på serveren, med rettighet 600, og sjekkes aldri inn.

```sh
# I root-skallet
cd /srv/husvett/middagsplanlegger/docs/drift
install -m 600 -o husvett -g husvett env.eksempel .env.drift
# Lag hemmeligheten og skriv den rett inn i filen (den vises ikke på skjermen):
sed -i "s/^SYNC_SECRET=.*/SYNC_SECRET=$(openssl rand -hex 32)/" .env.drift
grep -c '^SYNC_SECRET=BYTT' .env.drift      # skal svare 0
```

Åpne filen med `nano .env.drift` og kontroller (lagre med Ctrl+O, Enter, avslutt med Ctrl+X):

| Linje | Verdi | Hvorfor |
| --- | --- | --- |
| `DOMENE=husvett.no` | Uten `www.` og uten `https://` | Eierens valg 2026-11-22. Står allerede slik i `env.eksempel` |
| `SYNC_SECRET=…` | 64 tegn (laget over) | Invitasjonskoder. Ikke del den, ikke lim den inn i chat |
| `SYNC_RETENTION_DAYS=730` | 730 | Eierens valg: inaktive husstander slettes etter 730 dager |
| `SYNC_TOKEN_IDLE_DAYS=730` | 730 | Eierens valg: innloggingen utløper etter 730 dager uten bruk |
| `# TJEK_IMAGE_HOSTS=` | **La stå med `#` foran** (tom) | Hvilke bildeverter Tjek bruker er ikke kjent. Tom = ingen bilder. Fylles først når serverloggen viser vertene (`env.eksempel`) |
| `TRUST_PROXY` | **Skal ikke stå i filen** | Er satt til `1` i `docker-compose.yml` for begge veier (riktig: nøyaktig én proxy foran appen). En verdi i `.env.drift` overstyrer den ikke |

**Bare i vei B** legger du til to linjer nederst (fjern `#` foran dem; de står som kommentar nederst i `env.eksempel`):

```
COMPOSE_FILE=docker-compose.yml:docker-compose.bak-proxy.yml
APP_PORT=8790
```

Da bruker alle `docker compose`-kommandoer (også `backup.sh`) automatisk overstyringsfilen [`drift/docker-compose.bak-proxy.yml`](drift/docker-compose.bak-proxy.yml): appen publiseres bare på `127.0.0.1:8790`, og vår egen Caddy startes ikke. Var L5 ikke tom, velg et annet ledig nummer og bruk det samme nummeret i webserveroppsettet i 6B/6C.

Se filen uten hemmeligheten:

```sh
grep -v '^#' .env.drift | grep -v '^$' | sed 's/^SYNC_SECRET=.*/SYNC_SECRET=(skjult)/'
docker compose --env-file .env.drift config --quiet && echo "Compose-oppsettet er gyldig"
```

**Ta vare på en kopi av `SYNC_SECRET`** i AVVR AS sin passordhåndterer (ikke i e-post eller chat). Mistes den, slutter bare ubrukte invitasjonskoder å virke; ingen logges ut (hosting.md, avsnitt 8).

---

## 6A. Vei A: port 80/443 er ledige, bruk vår egen Caddy

Forutsetter avsnitt 3, 4 og 5 (uten `COMPOSE_FILE`-linjene).

1. **Brannmur hos one.com:** **sjekk dette:** om one.com har en brannmur for serveren i kontrollpanelet. Den må slippe inn TCP 80 og 443 (og gjerne UDP 443). Ikke åpne noe annet for Husvett.
2. **Brannmur på serveren (ufw, L14):** Docker åpner publiserte porter selv, forbi `ufw` (kjent Docker-oppførsel). Du trenger altså ikke endre `ufw` for 80/443, og du skal **ikke** slå `ufw` av eller på uten avtale med plattformprosjektet. Kontrollen utenfra i avsnitt 8 er det som teller.
3. **DNS peker riktig** (avsnitt 4) før du starter, ellers får Caddy ikke sertifikat (den prøver igjen av seg selv, men det tar lengre tid og kan treffe grensene hos Let's Encrypt).
4. **Start** (bygget tar noen minutter første gang):

```sh
cd /srv/husvett/middagsplanlegger/docs/drift
docker compose --env-file .env.drift up -d --build
docker compose --env-file .env.drift ps
```

Ventet etter ca. 30 sekunder: `app` med `(healthy)` og `caddy` med `Up`, og `caddy` med portene `0.0.0.0:80->80/tcp` og `0.0.0.0:443->443/tcp`. Stopper Caddy med `address already in use` eller `port is already allocated`, bruker noe annet port 80/443: stopp Caddy med `docker compose --env-file .env.drift stop caddy` og gå tilbake til avsnitt 1.

5. **Følg sertifikatet:** `docker compose --env-file .env.drift logs caddy --tail 50`. Se etter `certificate obtained successfully` for `husvett.no` og `www.husvett.no`. Feil: se «Vanlige feil med HTTPS» i avsnitt 11.

---

## 6B. Vei B med Nginx: appen bak plattformprosjektets Nginx

Forutsetter avsnitt 3, 4 og 5 **med** `COMPOSE_FILE`- og `APP_PORT`-linjene. Du endrer ikke noe i plattformprosjektets eget oppsett; du legger til **én ny fil** for `husvett.no`.

**1. Ta sikkerhetskopi av hele Nginx-oppsettet først:**

```sh
tar czf /root/nginx-for-husvett-$(date +%F).tar.gz /etc/nginx
ls -la /root/nginx-for-husvett-*.tar.gz
```

**2. Kontroller at Nginx leser `sites-enabled`, og at `husvett.no` ikke finnes fra før:**

```sh
nginx -T 2>/dev/null | grep -n 'include /etc/nginx/sites-enabled'
nginx -T 2>/dev/null | grep -n 'husvett'
```

Den første skal gi én linje; den andre skal ikke gi noe. Gir den første ingenting, bruker plattformprosjektet et annet oppsett: stopp og spør.

**3. Start appen og kontroller at den svarer bare lokalt:**

```sh
cd /srv/husvett/middagsplanlegger/docs/drift
docker compose --env-file .env.drift up -d --build
docker compose --env-file .env.drift ps
curl -s http://127.0.0.1:8790/healthz
```

Ventet: bare `app` (ingen `caddy`), `(healthy)`, porten vist som `127.0.0.1:8790->8787/tcp`, og `{"status":"ok"}`. Står porten som `0.0.0.0:8790`, er noe feil: stopp med `docker compose --env-file .env.drift down` og spør.

**4. Lag vertsoppsettet** med `nano /etc/nginx/sites-available/husvett.no` og lim inn:

```nginx
# Husvett (vei B): videresending til appen på 127.0.0.1:8790. Se docs/installasjon-ubuntu.md i Husvett-repoet.
server {
    listen 80;
    listen [::]:80;
    server_name husvett.no www.husvett.no;

    # Ingen tilgangslogg for Husvett (IP-adresser er personopplysninger).
    access_log off;

    location / {
        proxy_pass http://127.0.0.1:8790;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        # Bare klientens egen adresse. Appen (TRUST_PROXY=1) leser siste adresse i hodet.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Har serveren ingen IPv6 (L16), slett linjen `listen [::]:80;` (ellers gir neste steg `Address family not supported by protocol`). Valgte du et annet `APP_PORT`, bytt `8790`.

**5. Slå det på, prøv oppsettet, og last inn på nytt** (`reload` beholder plattformprosjektets forbindelser; `nginx -t` stopper deg før noe endres hvis filen har feil):

```sh
ln -s /etc/nginx/sites-available/husvett.no /etc/nginx/sites-enabled/husvett.no
nginx -t && systemctl reload nginx
curl -s -H 'Host: husvett.no' http://127.0.0.1/healthz
```

Ventet: `syntax is ok`, `test is successful`, og `{"status":"ok"}`. Kontroller straks at plattformprosjektets sider fortsatt virker.

**6. Sertifikat (HTTPS) med certbot** (krever at DNS peker riktig, avsnitt 4):

- Viste L23 at certbot finnes, bruk den som er der. Finnes den som snap (`snap list certbot`), ikke installer apt-varianten i tillegg.
- Finnes ingen certbot: `apt-cache policy certbot python3-certbot-nginx` (begge skal ha en `Candidate:`; **sjekk dette** på 26.04), så `apt install -y certbot python3-certbot-nginx`.

```sh
certbot --nginx -d husvett.no -d www.husvett.no --redirect
```

Første gang spør certbot om e-postadresse (bruk `kontakt@husvett.no` når postkassen virker) og om vilkårene. Certbot endrer bare filen med `server_name husvett.no` (vår fil): den legger til `listen 443 ssl`, sertifikatlinjer og en omdirigering fra http til https.

**7. Legg til omdirigering fra `www` og kort HSTS.** Åpne `nano /etc/nginx/sites-available/husvett.no`, finn blokken med `listen 443 ssl` (lagt til av certbot), og legg disse to linjene rett under linjen `server_name husvett.no www.husvett.no;` **i den blokken**:

```nginx
    if ($host = www.husvett.no) { return 301 https://husvett.no$request_uri; }
    add_header Strict-Transport-Security "max-age=86400" always;
```

```sh
nginx -t && systemctl reload nginx
certbot renew --dry-run
systemctl list-timers --no-pager | grep -i certbot
```

`renew --dry-run` skal ende med at fornyelsen ville lykkes, og det skal finnes en `certbot`-timer (fornyer sertifikatet av seg selv). Ikke sett `HSTS=1` i `.env.drift` i tillegg (appen sender da ett år og `includeSubDomains`, som er for tidlig).

**Angre vei B med Nginx** (plattformprosjektet uberørt):

```sh
rm /etc/nginx/sites-enabled/husvett.no
nginx -t && systemctl reload nginx
```

Går noe helt galt med Nginx: pakk ut sikkerhetskopien fra steg 1 (`tar xzf /root/nginx-for-husvett-<DATO>.tar.gz -C /`), `nginx -t`, `systemctl reload nginx`. Gjør det bare sammen med plattformprosjektet.

Dette oppsettet (steg 3–5, uten certbot og uten IPv6) er prøvd i sandkassen med Nginx 1.24 (avsnitt 14). Steg 6–7 er **ikke prøvd** (krever ekte domene).

---

## 6C. Vei B med Caddy: appen bak plattformprosjektets Caddy

Forutsetter avsnitt 3, 4 og 5 **med** `COMPOSE_FILE`- og `APP_PORT`-linjene, og at Caddy kjører som tjeneste på verten (L20: `caddy.service`).

**1. Sikkerhetskopi av Caddy-oppsettet:**

```sh
cp -a /etc/caddy /root/caddy-for-husvett-$(date +%F)
```

**2. Les oppsettet** (`cat /etc/caddy/Caddyfile`): finnes `husvett.no` fra før, eller `trusted_proxies`, stopp og spør. Bruker filen `import` av en mappe (f.eks. `import /etc/caddy/sites/*`), legg Husvett-blokken i en egen fil der i stedet for i hovedfilen.

**3. Start appen** og kontroller som i 6B, steg 3 (`curl -s http://127.0.0.1:8790/healthz` gir `{"status":"ok"}`).

**4. Legg til Husvett nederst** i `/etc/caddy/Caddyfile` (`nano /etc/caddy/Caddyfile`):

```caddyfile
# Husvett (vei B). Se docs/installasjon-ubuntu.md i Husvett-repoet.
husvett.no {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8790
	header {
		Referrer-Policy no-referrer
		Strict-Transport-Security "max-age=86400"
		-Server
	}
}

www.husvett.no {
	redir https://husvett.no{uri} permanent
}
```

Ingen `log`-linje: ingen tilgangslogg for Husvett. Caddy henter sertifikat selv når DNS peker riktig.

**5. Prøv og last inn på nytt:**

```sh
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy
journalctl -u caddy --since "10 min ago" --no-pager | grep -i husvett
```

`validate` skal svare `Valid configuration`. Er filen ugyldig, beholder Caddy det gamle oppsettet ved `reload`. Kontroller straks at plattformprosjektets sider fortsatt virker.

**Angre:** slett Husvett-blokken, `caddy validate …`, `systemctl reload caddy`.

Blokken er validert med `caddy validate` (Caddy 2, alpine-imaget) og prøvd i sandkassen med Caddy foran appen på `127.0.0.1:8790` over http (avsnitt 14). Ekte sertifikat er **ikke prøvd**.

---

## 7. Isolasjon fra plattformprosjektet

Dette er bygget inn i oppsettet; avsnittet forklarer hva som skiller Husvett fra plattformprosjektet, og hva som **ikke** gjør det.

| Hva | Hvordan | Kontroll |
| --- | --- | --- |
| Egen bruker og mappe | `husvett` eier `/srv/husvett` (750). Kode i `/srv/husvett/middagsplanlegger`, hemmeligheter i `.env.drift` (600) | `ls -la /srv/husvett` |
| Eget Compose-prosjekt | `name: middagsplanlegger` i `docker-compose.yml`; containerne heter `middagsplanlegger-app-1` (og `-caddy-1` i vei A) | `docker compose --env-file .env.drift ps` |
| Eget Docker-nettverk | Compose lager `middagsplanlegger_default`. Koble det **aldri** til plattformprosjektets nettverk, og koble aldri plattformens containere til vårt | `docker network inspect middagsplanlegger_default --format '{{range .Containers}}{{.Name}} {{end}}'` skal bare vise Husvett-containere |
| Eget databasevolum | `middagsplanlegger_middag-data` (og `…caddy-data`/`…caddy-config` i vei A). Deles ikke med noe annet. Ligger under `/var/lib/docker/volumes/`, som bare root kan lese | `docker volume ls` |
| Ressursgrenser | Appen: høyst 2 GB minne, 2 prosessorer, 256 prosesser. Caddy (vei A): 512 MB, 1 prosessor. Satt i `docker-compose.yml` | `docker stats --no-stream` |
| Egen sikkerhetskopimappe | `/srv/husvett/backup` (700, root), egen nøkkel og egen slettefrist | `ls -la /srv/husvett/backup` |
| Porter | Vei A: bare Caddy publiserer 80/443; appen har ingen port ut. Vei B: appen bare på `127.0.0.1:8790` | `docker compose --env-file .env.drift ps` (kolonnen PORTS) |

**Hva isolasjonen ikke dekker (viktig for personvernet):**

- **Alle som har `sudo`/root på serveren, eller er med i gruppen `docker`, kan lese Husvetts database**, også plattformprosjektets folk. Lag en liste over hvem det er (`getent group sudo docker`) og før den inn i tilgangslisten (pilot-sjekkliste B8 og C16).
- Docker-motoren deles. En oppgradering eller omstart av Docker (fra plattformprosjektet eller fra deg) starter begge prosjektenes containere på nytt. Husvett starter av seg selv igjen (`restart: unless-stopped`).
- Containeren kjører som uid 1000. På mange Ubuntu-servere er uid 1000 den første vanlige brukeren (kanskje `administrator`; sjekk med `id -u administrator`). Det har betydning bare hvis noen bryter ut av containeren; endre det ikke på egen hånd (en endring av Docker-motoren påvirker plattformprosjektet).
- Grensen på 2 GB gjelder også den midlertidige kopien `backup.sh` lager i `/tmp` (minne). Blir databasene til sammen større enn ca. 1 GB, må grensen økes (`mem_limit` i `docker-compose.yml`), ellers kan appen stoppes under sikkerhetskopien. Følg med på størrelsen (avsnitt 11).

---

## 8. Kontroll: helsesjekk på serveren og utenfra

**På serveren:**

```sh
cd /srv/husvett/middagsplanlegger/docs/drift
docker compose --env-file .env.drift ps                       # app: (healthy)
docker compose --env-file .env.drift logs app --tail 30
```

I loggen, første gang: `Synk-databasen fantes ikke og er opprettet tom: /data/middag.sqlite … (Ventet ved første oppstart.)`. Ved senere oppstarter skal det stå `Synk-databasen: /data/middag.sqlite (N husstander).` **Står «opprettet tom» etter at noen har tatt appen i bruk, er feil volum montert:** se avsnitt 11. Linjen `ExperimentalWarning: SQLite is an experimental feature` er ventet (hosting.md, «node:sqlite»). `Tilbud: N hentet (…)` betyr at henting fra Tjek virker; `tilbud-feil: …` betyr at den ikke gjør det (se L19).

```sh
curl -s https://husvett.no/healthz            # {"status":"ok"} (krever DNS og sertifikat)
curl -sI https://www.husvett.no/ | head -3    # 301 (eller 308) til https://husvett.no/
```

**Fra din egen PC** (ikke serveren):

1. Åpne `https://husvett.no/` i nettleseren: appen vises, med hengelås i adressefeltet. Åpne `https://www.husvett.no/`: du havner på `https://husvett.no/`. Prøv også `http://husvett.no/` (uten s): du sendes til `https://`.
2. I et terminalvindu (Windows: PowerShell; `curl.exe` følger med Windows 10 og 11): `curl -s https://husvett.no/healthz` skal gi `{"status":"ok"}`.
3. **Appens egen port skal ikke svare utenfra.** Windows (PowerShell): `Test-NetConnection husvett.no -Port 8790` og `Test-NetConnection husvett.no -Port 8787` skal begge gi `TcpTestSucceeded : False`. Mac/Linux: `nc -vz -w 5 husvett.no 8790` skal feile.
4. Opprett en testhusstand fra to enheter (pilot-sjekkliste F, dag 0) og se at de ser hverandre. Slett den igjen etterpå.

---

## 9. Sikkerhetskopi

Bakgrunn og hva skriptet gjør: hosting.md, avsnitt 8, «Sikkerhetskopi og gjenoppretting». Kort: [`drift/backup.sh`](drift/backup.sh) tar en konsistent kopi av begge databasene mens appen kjører, krypterer den med `age` før den forlater containeren, og sletter lokale kopier eldre enn 30 dager. **Skriptet sender ikke kopiene noe sted;** det gjør du i 9.4.

### 9.1 Lag nøkkelparet (på en PC, ikke på serveren)

Den **private** nøkkelen skal aldri ligge fast på serveren. Den skal finnes hos **minst to personer** (pilot-sjekkliste A9; ikke valgt ennå). Mistes den, kan ingen kopi leses. Kommer den på avveie, kan alle kopier leses.

1. Installer `age` på PC-en til én av nøkkelholderne. Offisiell kilde: `https://github.com/FiloSottile/age/releases` (Windows og Mac). Mac med Homebrew: `brew install age`. Ubuntu/Debian: `sudo apt install age`. **Sjekk dette:** at du laster ned fra den offisielle siden over.
2. Lag nøkkelen: `age-keygen -o husvett-backup.key`. Den skriver `Public key: age1…` på skjermen. Den linjen er den **offentlige** nøkkelen (ikke hemmelig; den skal på serveren).
3. Lagre filen `husvett-backup.key` (den **private** nøkkelen, begynner med `AGE-SECRET-KEY-1`) hos begge nøkkelholderne, f.eks. i hver sin passordhåndterer eller på en kryptert minnepinne i safe. Ikke send den i e-post eller chat, og ikke legg den i repoet.

### 9.2 Sett opp kopieringen på serveren

```sh
# I root-skallet
install -m 600 /dev/null /srv/husvett/backup.env
nano /srv/husvett/backup.env
```

Skriv inn (bytt `age1…` med den offentlige nøkkelen fra 9.1):

```
BACKUP_AGE_RECIPIENT=age1…
BACKUP_DIR=/srv/husvett/backup
```

Lag to filer for systemd (tjeneste og daglig tidsplan). `nano /etc/systemd/system/husvett-backup.service`:

```ini
[Unit]
Description=Husvett: kryptert sikkerhetskopi av databasene (backup.sh)
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/srv/husvett/middagsplanlegger/docs/drift
EnvironmentFile=/srv/husvett/backup.env
ExecStart=/srv/husvett/middagsplanlegger/docs/drift/backup.sh
```

`nano /etc/systemd/system/husvett-backup.timer`:

```ini
[Unit]
Description=Husvett: daglig sikkerhetskopi

[Timer]
OnCalendar=*-*-* 03:17:00
RandomizedDelaySec=10min
Persistent=true

[Install]
WantedBy=timers.target
```

Klokkeslettet er i serverens tidssone (L17). `Persistent=true` tar en kopi som ble hoppet over (f.eks. fordi serveren var av) så snart den er på igjen.

```sh
systemctl daemon-reload
systemctl start husvett-backup.service            # én kopi nå, som prøve
journalctl -u husvett-backup -n 20 --no-pager     # «kopi ok» og «Sikkerhetskopi: …» for middag og tilbud
ls -la /srv/husvett/backup
systemctl enable --now husvett-backup.timer
systemctl list-timers husvett-backup.timer --no-pager
```

Ventet: to filer `middag-<tid>.sqlite.age` og `tilbud-<tid>.sqlite.age` (`tilbud` kan mangle hvis tilbudslagring er av; skriptet sier da «Hopper over»), og en timer med neste kjøring i natt.

**Alternativ med cron** (bruk **enten** systemd-timeren **eller** cron, ikke begge): `nano /etc/cron.d/husvett-backup` med én linje:

```
17 3 * * * root cd /srv/husvett/middagsplanlegger/docs/drift && . /srv/husvett/backup.env && BACKUP_AGE_RECIPIENT="$BACKUP_AGE_RECIPIENT" BACKUP_DIR="$BACKUP_DIR" ./backup.sh >> /var/log/husvett-backup.log 2>&1
```

Enhetsfilene over er kontrollert med `systemd-analyze verify` (uten feil), men **ikke kjørt under systemd** (sandkassen har ikke systemd). Cron-linjen er ikke prøvd.

### 9.3 Varsel når kopien feiler

**Ikke bygget.** Til det finnes: se etter i `journalctl -u husvett-backup --since yesterday --no-pager` minst én gang i uka, og at det kommer nye filer i `/srv/husvett/backup` (`ls -lt /srv/husvett/backup | head`). Et varsel (e-post eller oppetidstjeneste) er en del av pilot-sjekkliste C10.

### 9.4 Kopier utenfor serveren

En kopi som bare ligger på samme server forsvinner med serveren. Kopiene må også ligge et annet sted **i EØS**, med samme slettefrist (30 dager) der.

**Anbefalt: lagringstjeneste («object storage», S3-kompatibel) i EØS** hos en leverandør AVVR AS har databehandleravtale med (pilot-sjekkliste B6). Kopiene er kryptert med `age`, så leverandøren ser bare kryptert innhold. **Ikke valgt og ikke prøvd.** Med verktøyet `rclone` (finnes i Ubuntu):

```sh
apt install -y rclone
rclone config          # spør deg gjennom oppsettet; kall forbindelsen «husvett-kopi». Tilgangsnøkkelen lagres i /root/.config/rclone/rclone.conf, aldri i repoet
rclone lsd husvett-kopi:           # skal liste bøttene dine
```

Legg så til to linjer nederst i `husvett-backup.service` (under `ExecStart=…backup.sh`), bytt `<BØTTE>` med navnet på bøtten, og kjør `systemctl daemon-reload`:

```ini
ExecStart=/usr/bin/rclone --config /root/.config/rclone/rclone.conf copy /srv/husvett/backup husvett-kopi:<BØTTE>/husvett
ExecStart=/usr/bin/rclone --config /root/.config/rclone/rclone.conf delete --min-age 30d husvett-kopi:<BØTTE>/husvett
```

`copy` laster opp nye filer; `delete --min-age 30d` sletter kopier eldre enn 30 dager der (lokalt gjør `backup.sh` det selv). Bruk gjerne i tillegg en livssyklusregel hos leverandøren («slett etter 30 dager»). **Sjekk dette:** stien til `rclone` (`command -v rclone`), og at `rclone lsf husvett-kopi:<BØTTE>/husvett` viser filene etter neste kjøring.

**Ikke godt nok alene:** øyeblikksbilder (snapshots) av hele serveren hos one.com. De kan være nyttige i tillegg, men ligger hos samme leverandør, tar med alt på serveren (også plattformprosjektet), er ikke kryptert med vår nøkkel, og må ha samme slettefrist. **Sjekk dette** med one.com hvis dere vil bruke dem.

### 9.5 Gjenopprettingsøvelse (før ekte familier)

Prosedyren er prøvd i sandkassen (avsnitt 14). **Gjør den på serveren før piloten**, mens det bare finnes testdata, og skriv ned hvor lang tid den tok (pilot-sjekkliste C7). Øvelsen bruker et **nytt** volum; det gamle står urørt.

Den private nøkkelen må være på serveren et kort øyeblikk for å dekryptere. Lim den inn, bruk den, og slett den straks etterpå. (Alternativet er å gjøre øvelsen på en annen maskin med Docker; spør utvikleren.)

```sh
# I root-skallet
cd /srv/husvett/middagsplanlegger/docs/drift
install -d -m 700 /root/restore
install -m 600 /dev/null /root/restore/nokkel.txt
nano /root/restore/nokkel.txt                    # lim inn hele innholdet i husvett-backup.key, lagre
ls -lt /srv/husvett/backup | head                # velg ett tidspunkt <TID> (samme for begge filene)
age -d -i /root/restore/nokkel.txt -o /root/restore/middag.sqlite /srv/husvett/backup/middag-<TID>.sqlite.age
age -d -i /root/restore/nokkel.txt -o /root/restore/tilbud.sqlite /srv/husvett/backup/tilbud-<TID>.sqlite.age
docker compose --env-file .env.drift stop app
docker volume create middag-data-gjenopprettet
docker run --rm --user 0:0 -v middag-data-gjenopprettet:/data -v /root/restore:/in:ro middagsplanlegger:pilot \
  sh -c 'cp /in/middag.sqlite /in/tilbud.sqlite /data/ && chown 1000:1000 /data/middag.sqlite /data/tilbud.sqlite'
echo "DATA_VOLUME=middag-data-gjenopprettet" >> .env.drift
docker compose --env-file .env.drift up -d
docker compose --env-file .env.drift logs app --tail 20     # «Synk-databasen: /data/middag.sqlite (N husstander).»
shred -u /root/restore/nokkel.txt /root/restore/middag.sqlite /root/restore/tilbud.sqlite
rmdir /root/restore
```

(Kopieringen kjøres som root i containeren og gir filene til uid 1000, fordi `/root/restore` bare kan leses av root. Med `--user 1000:1000` feiler den da med `Permission denied`; prøvd i sandkassen.)

Kontroller: testenhetene viser «Synket», og husstanden og medlemmene er som før (pilot-sjekkliste C9).

**Tilbake til det opprinnelige volumet etter øvelsen** (bare før ekte familier er med; ellers mister du det som ble lagret under øvelsen): `nano .env.drift`, slett linjen `DATA_VOLUME=middag-data-gjenopprettet`, så `docker compose --env-file .env.drift up -d` og kontroller loggen igjen. Slett øvelsesvolumet først når alt er kontrollert: `docker volume rm middag-data-gjenopprettet`.

**Ved en ekte gjenoppretting** blir appen stående på det nye volumet. Les hosting.md om hva enhetene gjør etter en gjenoppretting, og om husstander som må slettes igjen («Slettefrist for sikkerhetskopier»).

---

## 10. Oppdatering og tilbakerulling

**Ny versjon** (gjør det på et rolig tidspunkt; bygget bruker prosessor i noen minutter):

```sh
# I root-skallet
cd /srv/husvett/middagsplanlegger/docs/drift
systemctl start husvett-backup.service                                # fersk kopi før oppdateringen
sudo -u husvett git -C /srv/husvett/middagsplanlegger log -1 --oneline   # skriv ned: dette er versjonen du går FRA
docker tag middagsplanlegger:pilot middagsplanlegger:forrige          # ta vare på imaget som kjører nå
sudo -u husvett git -C /srv/husvett/middagsplanlegger pull --ff-only
docker compose --env-file .env.drift up -d --build
docker compose --env-file .env.drift ps                                # app: (healthy)
docker compose --env-file .env.drift logs app --tail 20                # «Synk-databasen: … (N husstander).»
```

Gjør så kontrollene i avsnitt 8. Sier `git pull` at lokale endringer er i veien, har noen endret filer i mappen: stopp og spør. Har oppdateringen endret Node-versjonen i `Dockerfile`, skal utvikleren ha kjørt testene og gjenopprettingsøvelsen først (hosting.md, «node:sqlite»).

**Rull tilbake** hvis den nye versjonen ikke virker:

```sh
cd /srv/husvett/middagsplanlegger/docs/drift
docker tag middagsplanlegger:forrige middagsplanlegger:pilot
sudo -u husvett git -C /srv/husvett/middagsplanlegger checkout <FORRIGE-COMMIT>    # den du skrev ned
docker compose --env-file .env.drift up -d --no-build
docker compose --env-file .env.drift ps
```

`--no-build` gjør at Compose bruker det gamle imaget i stedet for å bygge på nytt (prøvd i sandkassen: containeren lages på nytt med det gamle imaget). Neste vanlige oppdatering: `sudo -u husvett git -C /srv/husvett/middagsplanlegger checkout claude/middagsplanner-app-wwuq1p` (eller den branchen utvikleren oppgir) før `pull`.

**Merk om databasen:** nye versjoner kan legge til kolonner i databasen (`server/storage/sqlite.ts`). En eldre versjon tåler som regel det, men det er ikke garantert. Virker ikke den gamle versjonen mot databasen etter tilbakerulling, gjenopprett kopien du tok før oppdateringen (9.5); det som ble lagret etter den, er da tapt.

**Caddy (bare vei A):** `docker compose --env-file .env.drift pull caddy && docker compose --env-file .env.drift up -d` henter siste Caddy 2. Gjør det omtrent månedlig.

**Ubuntu-oppdateringer:** avtal rutine med plattformprosjektet. **Sjekk dette:** `systemctl status unattended-upgrades --no-pager` (om sikkerhetsoppdateringer installeres automatisk). En oppdatering av Docker-pakkene starter alle containere på nytt; Husvett starter selv igjen, men kontroller avsnitt 8 etterpå.

---

## 11. Logger, og når noe går galt

**Hvor loggene er:**

| Hva | Kommando | Merknad |
| --- | --- | --- |
| Appen | `docker compose --env-file .env.drift logs app --tail 100` | Bare oppstart, advarsler og feilnavn, ikke innhold eller IP-adresser. Begrenset til 3 × 10 MB |
| Caddy (vei A) | `docker compose --env-file .env.drift logs caddy --tail 100` | Ingen tilgangslogg; feilmeldinger kan inneholde IP-adresser |
| Sikkerhetskopi | `journalctl -u husvett-backup --since yesterday --no-pager` | – |
| Nginx (vei B) | `journalctl -u nginx --no-pager -n 50` og `tail -50 /var/log/nginx/error.log` | Feilloggen kan inneholde IP-adresser. **Sjekk dette:** hvor lenge den beholdes (`cat /etc/logrotate.d/nginx`) |
| Caddy på verten (vei B) | `journalctl -u caddy --no-pager -n 50` | Samme |
| Sertifikat (Nginx) | `tail -50 /var/log/letsencrypt/letsencrypt.log` | – |
| Ressursbruk | `docker stats --no-stream` og `df -h /` | Følg med på disk ukentlig |
| Databasestørrelse | `docker compose --env-file .env.drift exec app ls -la /data` | Kjøres fra `docs/drift`. Viser `middag.sqlite` og `tilbud.sqlite` (med `-wal`/`-shm`) i det volumet appen faktisk bruker |

**Når noe går galt:**

| Symptom | Sjekk | Gjør |
| --- | --- | --- |
| Siden svarer ikke | `docker compose --env-file .env.drift ps` | Er `app` ikke `healthy`: les loggen. `docker compose --env-file .env.drift restart app` én gang. Hjelper ikke det: ring utvikleren |
| `502 Bad Gateway` (vei B) | `curl -s http://127.0.0.1:8790/healthz` på serveren | Svarer ikke appen: se over. Svarer den: feil port i Nginx/Caddy-oppsettet |
| Alle enheter er logget ut, eller loggen sier «opprettet tom» etter omstart | `docker inspect -f '{{range .Mounts}}{{.Name}} {{end}}' middagsplanlegger-app-1` og `grep DATA_VOLUME .env.drift` | **Feil volum.** Stopp appen (`docker compose --env-file .env.drift stop app`), ikke slett noe, og ring utvikleren. De gamle dataene ligger i det volumet som var i bruk før |
| Sertifikatfeil i nettleseren | Caddy-loggen (vei A) eller certbot-loggen (vei B) | Se «Vanlige feil med HTTPS» |
| Plattformprosjektets sider virker ikke etter vei B | `nginx -t` / `caddy validate …` | Angre Husvett-oppsettet straks (6B/6C, «Angre»), og si fra til plattformprosjektet |
| Caddy starter ikke: `address already in use` (vei A) | L3 på nytt | Noe annet har tatt 80/443. Bruk vei B |
| Appen starter ikke: `port is already allocated` (vei B) | `ss -tlnp '( sport = :8790 )'` | Velg et annet `APP_PORT` i `.env.drift`, og samme nummer i Nginx/Caddy |
| Disken er nesten full | `df -h /`, `docker system df` | Ikke slett volumer. `docker builder prune` fjerner byggebuffer, men gjelder hele serveren (også plattformprosjektet): avtal først |
| Sikkerhetskopien feilet | `journalctl -u husvett-backup` | «Fant ikke middag-databasen»: feil volum eller appen står stoppet. «Sett BACKUP_AGE_RECIPIENT»: `backup.env` mangler eller er feil |
| E-post til `kontakt@husvett.no` kommer ikke fram etter DNS-endringen | `nslookup -type=MX husvett.no` og DNS-listen i one.com-panelet mot skjermbildet fra 4.1 | Legg tilbake e-postoppføringene som mangler, eller kontakt one.com. Rør ikke `MX` ellers |
| Ingen tilbud fra Tjek | Appens logg: `tilbud-feil` | Utgående nett (L19). Ikke kritisk for synk |
| Mistanke om innbrudd eller lekkasje | – | Rutinen for avvik: `personvern/05-innsyn-retting-sletting.md`, avsnitt 6 (72 timer) |

**Vanlige feil med HTTPS (Let's Encrypt):**

- **DNS peker ikke ennå, eller peker feil:** meldinger som `NXDOMAIN`, `unauthorized` eller `Timeout during connect`. Kontroller med `nslookup` (avsnitt 4.4) og vent. Caddy prøver igjen av seg selv; certbot må kjøres på nytt.
- **Gammel AAAA-oppføring:** A er riktig, men sertifikatet feiler likevel. Fjern eller rett AAAA (avsnitt 4.3).
- **Port 80 er stengt** (brannmur hos one.com): sertifikatet kan ikke kontrolleres. Åpne TCP 80 og 443.
- **For mange forsøk:** Let's Encrypt har grenser for mislykkede forsøk og for nye sertifikater per uke. Vent (minst en time) i stedet for å prøve om og om igjen, og **slett aldri volumet `caddy-data`** (der ligger sertifikatene).
- **Nettleseren viser fortsatt gammel side:** DNS-svaret er husket et sted. Prøv fra mobilnett, eller vent til TTL er ute.
- **`www` virker ikke, men `husvett.no` gjør det:** `www` mangler i DNS (avsnitt 4).

---

## 12. Ikke gjør dette

- **Ikke åpne databasen eller appens port mot internett.** Ingen porter for 8787/8790 i brannmuren, aldri `0.0.0.0:8790` eller serverens offentlige adresse i `docker-compose.bak-proxy.yml`. Appen skal bare nås gjennom Caddy/Nginx (ellers kan ratebegrensningen lures; prøvd i sandkassen, avsnitt 14).
- **Ikke legg hemmeligheter i repoet,** i guiden, i chat eller i e-post: `.env.drift`, `SYNC_SECRET`, den private `age`-nøkkelen, `rclone.conf`, passord, IP-adresser.
- **Ikke legg den private `age`-nøkkelen fast på serveren** (bare et øyeblikk under gjenoppretting, og slett den etterpå).
- **Ikke kopier `middag.sqlite` med `cp`** mens appen kjører; bruk `backup.sh` (hosting.md).
- **Ikke start to Husvett-servere mot samme volum,** og ikke kjør `docker compose up` fra en annen kopi av repoet på samme server.
- **Ikke kjør `docker system prune --volumes`, `docker volume prune -a` eller `docker compose down -v`.** De kan slette databasen. (`docker compose down` uten `-v` er trygt.)
- **Ikke endre e-postoppføringer i DNS** (`MX`, SPF/DKIM i `TXT`, `mail`, `autodiscover` o.l.), ikke bytt navnetjenere og ikke bruk «tilbakestill»-valg i one.com-panelet: det kan stoppe e-posten til `kontakt@husvett.no`. Kartlegg først (avsnitt 4.1).
- **Ikke la domenet peke mot webhotellet** for Husvett: webhotellet kan ikke kjøre serverdelen.
- **Ikke slett volumet `caddy-data`** (vei A): sertifikatene ligger der.
- **Ikke endre plattformprosjektets filer, nettverk, containere eller brannmur.** Bare ett nytt vertsoppsett i vei B, med sikkerhetskopi først.
- **Ikke legg brukere i gruppen `docker`** (det er root-tilgang).
- **Ikke installer Docker på nytt eller fra to kilder,** og ikke kjør Dockers «avinstaller gamle pakker»-steg på denne serveren.
- **Ikke sett `TRUST_PROXY=1` hvis appen kan nås uten om proxyen,** og ikke legg en CDN/«proxy» foran uten at utvikleren har sett på det.
- **Ikke slå på tilgangslogg (IP-adresser) for Husvett** før loggtid er avgjort (pilot-sjekkliste A7, C11).
- **Ikke inviter ekte familier** før STOPP-punktene i pilot-sjekklisten er krysset av, også gjenopprettingsøvelsen (C7).

---

## 13. Kort huskeliste

1. Avsnitt 1: les tilstanden, velg vei (avsnitt 2).
2. Avsnitt 3: programmer, Docker (bare om det mangler), bruker, mappe, kode.
3. Avsnitt 4: kartlegg nettside og e-post på domenet, så DNS i one.coms panel (tidlig). Bare `@` og `www`; e-postoppføringene står urørt.
4. Avsnitt 5: `.env.drift` (vei B: to ekstra linjer).
5. Avsnitt 6A eller 6B/6C: start.
6. Avsnitt 7: kontroller isolasjonen; avsnitt 8: kontroller på serveren og utenfra.
7. Avsnitt 9: nøkkel, daglig kopi, kopi utenfor serveren, gjenopprettingsøvelse.
8. Skriv i driftsloggen og i pilot-sjekklisten (C1–C7, C16).

---

## 14. Hva er prøvd, og hva er ikke prøvd

**Prøvd 2026-11-22 i sandkassen** (Linux-container med Docker 29.10.0 og Compose 5.7.1, `x86_64`, uten systemd og uten IPv6; **ikke** Ubuntu 26.04 og **ikke** hos one.com):

- `docker build` av imaget fra `Dockerfile` (med sandkassens omvei for sertifikater, som i hosting.md avsnitt 8).
- **Vei A:** Compose med app og Caddy (`DOMENE=localhost`, Caddys selvsignerte sertifikat): `app` `healthy`, `https://localhost/healthz` gir `200`, Caddy publiserer 80/443. Ressursgrensene er satt (lest med `docker inspect`: app 2 GB / 2 CPU / 256 prosesser, Caddy 512 MB / 1 CPU).
- **Vei B:** `COMPOSE_FILE` i `.env.drift` med `docker-compose.bak-proxy.yml`: bare `app` startes (ingen Caddy), porten er `127.0.0.1:8790->8787/tcp`, og appen svarer ikke på maskinens andre adresse. Nginx 1.24 (Ubuntu-pakken, på verten) med vertsoppsettet i 6B steg 4 (uten IPv6-linjen): `/healthz` og `/` gir `200` gjennom Nginx, appens CSP kommer fram, og Nginx' standardside (som «plattformprosjektet») virker fortsatt. Caddy 2 (alpine-imaget, med vertsnettverk) med blokken i 6C: `caddy validate` gir `Valid configuration`; over http gir `/healthz` `200` og `www` gir `301` til `https://husvett.no/…` med sti og søk.
- **`TRUST_PROXY=1` målt gjennom proxy** (sto som «ikke målt» i hosting.md), både gjennom Nginx og gjennom Caddy: 21 forsøk på å bli med i en husstand fra samme maskin, hvert med en ny falsk `X-Forwarded-For`, ga 20 avviste forsøk og deretter `429` (falske adresser hjelper ikke); forsøk fra en annen kildeadresse ble telt for seg (`403`, ikke `429`), mens den første fortsatt var sperret (appen skiller ekte klienter). Direkte mot appens port ble hver falske adresse telt som en ny klient: derfor må porten bare være på `127.0.0.1`. Bare IPv4 er prøvd.
- **Sikkerhetskopi og gjenoppretting i Compose med dagens `backup.sh`** (begge databasene, ekte `age`, `BACKUP_DIR` utenfor repoet med 700): kopi tatt mens appen kjørte, dekryptert, lagt i et nytt volum (kopiering som root og `chown 1000:1000` fra en mappe bare root kan lese), `DATA_VOLUME` satt; appen startet med `(1 husstander)`, og tokenet fra før kopien ga `200`. Varianten med `--user 1000:1000` feilet med `Permission denied` når mappen bare kunne leses av root.
- **Tilbakerulling:** `docker tag … forrige`, nytt image som `pilot`, `up -d --no-build` laget containeren på nytt med det nye imaget, og tilbake igjen med det gamle.
- `systemd-analyze verify` av `husvett-backup.service` og `.timer` uten feil (filene og stiene laget midlertidig).
- Lest (ikke installert) 2026-11-22: Dockers apt-kilde har `resolute` (Ubuntu 26.04) med `docker-ce` 29.10.0 og `docker-compose-plugin` 5.8.0 for `amd64`; Ubuntus pakkeoversikt for `resolute` har `docker.io` 29.1.3, `docker-compose-v2` 2.40.3, `docker-buildx` 0.30.1 og `age` 1.2.1.

**Ikke prøvd:**

- **Noe som helst på Ubuntu 26.04 eller hos one.com:** installasjon av Docker fra apt-kilden (eller reserveveien), `adduser`-valgene, nettkonsollen (lime inn), one.coms brannmur og om serveren har IPv6.
- one.coms DNS-panel (menynavn, om webhotellets standardoppføringer er låste) og at e-posten overlever endringen.
- Ekte domene, DNS og Let's Encrypt (verken Caddy eller certbot); certbot-stegene i 6B (6–7) og `www`-omdirigeringen i Nginx; HTTP/3.
- At Docker-publiserte porter går forbi `ufw` på akkurat denne serveren (kjent Docker-oppførsel, ikke målt her).
- Kjøring under systemd (timer og tjeneste), cron-linjen, `rclone` og lagring utenfor serveren, `shred` på serverens disk.
- Vei B når webserveren selv kjører i Docker, med Apache, eller med en CDN foran.
- Bygging av imaget på en vanlig maskin uten sandkassens omveier, og på `aarch64`.
- At henting fra Tjek virker fra containeren (i sandkassen var henting slått av).
- Lasttest og hvordan Husvett og plattformprosjektet påvirker hverandre under last.

---

## 15. Spørsmål eieren må svare på

1. **Hva viser leseskjemaet i avsnitt 1?** Særlig L3 (hvem bruker 80/443), L7–L9 (Docker), L12–L13 (disk og minne), L16 (har serveren IPv6?), L18 (opprydding som kan slette volumer) og L19 (utgående nett). Det avgjør vei A eller B.
2. **Godtar plattformprosjektet** at Husvett kjører på samme server, at Docker installeres (hvis den mangler), og (vei B) at det legges til ett vertsoppsett i deres Nginx/Caddy? Hvem hos dem skal varsles før endringer og oppdateringer?
3. **Hvem har `sudo`/root og `docker`-tilgang** på serveren i dag? De kan lese Husvetts data og må inn i tilgangslisten (pilot-sjekkliste B8, C14, C16). Er det akseptabelt for piloten?
4. **one.com som databehandler:** finnes det en databehandleravtale med one.com for denne serveren, og i hvilket land står serveren (eieren oppgir «Europa», land ikke bekreftet), og ligger eventuelle øyeblikksbilder også der? (pilot-sjekkliste B6). Har one.com en brannmur i kontrollpanelet for serveren?
5. **Står `husvett.no` (registrert hos one.com) i AVVR AS sitt navn** (A4)? **Ligger det en nettside på webhotellet** på `husvett.no` eller `www` som skal beholdes (den vises ikke lenger der når domenet peker mot serveren)? Og hvem hos dere kan rette e-postoppføringene hvis noe går galt?
6. **Hvem er de to nøkkelholderne** for sikkerhetskopiene (A9)?
7. **Hvor skal kopiene ligge utenfor serveren** (leverandør i EØS, med databehandleravtale), og er 30 dager riktig slettefrist (A7)?
8. **Gjenopprettingsøvelsen:** godtar du at den private nøkkelen er på serveren et kort øyeblikk under en gjenoppretting (9.5), eller skal øvelsen og en ekte gjenoppretting gjøres på en annen maskin?
9. **Kan nettkonsollen lime inn tekst, og skal SSH settes opp** (med nøkkel, ikke passord)? Det gjør oppdateringer og feilsøking mye enklere.
10. **Hvem tar oppdateringer av Ubuntu og Docker** på den delte serveren, og når (avtal med plattformprosjektet)?
