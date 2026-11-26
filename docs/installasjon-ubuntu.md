# Installere Husvett på en Ubuntu-server som deles med et annet prosjekt

**Status: UTKAST, skrevet 2026-11-22. Ikke prøvd på eierens server.** Guiden er skrevet for eierens leide server hos one.com (Ubuntu 26.04, 8 kjerner, 16 GB minne, 400 GB disk), som allerede brukes av et annet prosjekt («plattformprosjektet», under kalt Plattform). **Oppdatert samme dag:** Plattform-prosjektet har kartlagt serveren (port 80/443 ledige, Docker installert, SSH som `mani`); det står i **avsnitt 0A**, som går foran det guiden ellers sier om serveren. Konklusjonen der er **vei A med `PUBLIC_BIND_IP`**. Avsnitt 1–2 (lese tilstanden og velge vei) gjelder fortsatt for en annen server, og som bakgrunn for lesepakken i 0A.2.

**Installasjonsstatus 2026-11-22 (se 0B):** en installasjonsøkt på eierens PC har begynt på vei A som bruker `husvett-drift` og er **ikke fullført**. Den rapporterte at koden er klonet, `age` installert, `.env.drift` laget uten hemmeligheter og at to funn ikke stemmer med det Plattform opplyste (0A). **Alt dette er rapportert av installasjonsøkta, ikke kontrollert av oss.** To avvik fra guiden: ingen egen systembruker `husvett` (`husvett-drift` eier mappen), og Compose-prosjekt, nettverk og volumer heter **`husvett_…` i stedet for `middagsplanlegger_…`**. Kommandoer i guiden som nevner de gamle navnene må leses med de nye: se **0B**.

Les også: [`hosting.md`](hosting.md) (bakgrunn, miljøvariabler, avsnitt 8 om Docker, sikkerhetskopi og gjenoppretting), [`pilot-sjekkliste.md`](pilot-sjekkliste.md) (alt som må være på plass før ekte familier), [`sikkerhet.md`](sikkerhet.md) og filene i [`drift/`](drift/).

**Hva er prøvd, og hva er ikke?** Kort: Docker-bygget, begge Compose-variantene (vei A med vår egen Caddy, vei B bak Nginx eller Caddy på verten), sikkerhetskopi, gjenoppretting og tilbakerulling er prøvd **i en sandkasse** (Linux-container med Docker 29.10 og Compose 5.7, ikke Ubuntu 26.04, ikke one.com, uten ekte domene). **Ingenting er prøvd på Ubuntu 26.04 eller hos one.com.** Hele listen står i avsnitt 14. Der det står **«sjekk dette»**, vet vi ikke svaret og forteller deg hvordan du finner det ut.

**Ingen IP-adresser, passord eller nøkler skal skrives inn i repoet**, i denne guiden eller i chat. Der guiden trenger dem, står det `<SLIK>` og hvor du finner verdien.

---

## 0. Før du begynner

**Hvem gjør hva.** Rollen «Admin» (hosting.md, avsnitt 0) følger guiden; på Plattform-serveren er det eieren, innlogget som `mani` (avsnitt 0A). Avtal med den som har ansvar for plattformprosjektet **før** du endrer noe på serveren: du kommer til å installere noen få programmer (`git`, `age`), og i vei B legger du til ett nytt vertsoppsett i deres webserver. Les «Ikke rør» (0A.1) før du begynner.

**Slik leser du kommandoene.**

- Alt i grå bokser skrives (eller limes inn) i konsollen, én linje om gangen, og avsluttes med Enter. Linjer som begynner med `#` er forklaringer og trenger ikke skrives.
- `sudo` betyr «kjør som administrator (root)». Første gang spør den om passordet til brukeren du er logget inn som (på Plattform-serveren: `mani`). Det vises ingen tegn mens du skriver passordet; det er normalt.
- `<SLIK>` skal byttes ut med en verdi, uten `<` og `>`.
- **Lesing (avsnitt 0A.2 og 1) gjøres som `mani` med `sudo` foran hver kommando som trenger det**, ikke i et root-skall.
- Fra og med avsnitt 3 bruker guiden et **root-skall** for Husvett-arbeid, fordi nesten alt der krever root (Docker, `/srv/husvett`, systemd): skriv `sudo -i` som `mani` én gang, og alle kommandoer etter det kjøres som root (ledeteksten slutter da med `#` i stedet for `$`). Skriv `exit` når du er ferdig, så er du tilbake som `mani`. Vær ekstra nøye i et root-skall: ingen spør om du er sikker. Bruk ikke `koordinator` eller `administrator` til Husvett-arbeid.
- Får du en feilmelding du ikke forstår: **stopp**, ta et skjermbilde (uten passord eller nøkler) og spør utvikleren. Ikke prøv deg fram med kommandoer fra nettet på en server som også kjører et annet prosjekt.

**SSH som `mani`.** På Plattform-serveren logger eieren inn som `mani` over SSH med nøkkel (opplyst av Plattform-prosjektet, avsnitt 0A); nettkonsollen hos one.com trengs ikke, og innliming virker i en vanlig terminal. Ikke endre SSH-oppsettet, og ikke lag nye SSH-brukere (0A.1). På en annen server uten SSH: **sjekk dette:** om nettkonsollen kan lime inn tekst (prøv `echo hei`).

**Driftslogg.** Før en enkel logg utenfor repoet (f.eks. et dokument hos AVVR AS): dato, hva du gjorde, hvilken versjon (commit) som kjører, og hva som gikk galt. Ingen passord, nøkler eller IP-adresser i den heller, hvis den deles.

---

## 0A. Plattform-serveren slik den faktisk er (opplyst 2026-11-22)

**Kilde:** notat fra plattformprosjektets koordinatorøkt 2026-11-22, levert av eieren (fakta fra deres kartlegging, uten IP-adresser, nøkler eller passord). Eieren har bekreftet at alle tilganger er hans egne, og at Husvett skal installeres nå på denne serveren. **Alt i tabellen er opplyst av Plattform-prosjektet, ikke kontrollert av oss.** Avsnittet går foran det som står om serveren ellers i guiden (f.eks. «bruker `administrator`, nettkonsoll»).

| Hva | Opplyst | Betyr for Husvett |
| --- | --- | --- |
| Operativsystem og maskin | Ubuntu 26.04.1, 8 kjerner, 16 GB minne, 400 GB disk, «nesten tom» | Nok plass. Ledig disk og minne er likevel ikke målt (L12, L13) |
| Port 80 og 443 | Ingenting lytter i dag; `ufw` slipper dem inn | **Vei A** (vår egen Caddy) |
| Port 443 på WireGuard-adressen | Plattforms testmiljø vil binde 443 på `10.8.0.1` (wg0), trolig denne uken | Vår Caddy må bindes til serverens **offentlige** adresse alene (`PUBLIC_BIND_IP`, avsnitt 5). Binder den til alle adresser, kolliderer de (prøvd i sandkassen, avsnitt 14) |
| Docker | `docker-ce` 29.x med Compose, fra Dockers eget pakkelager; ingen containere kjører | **Ikke installer Docker på nytt.** Hopp over installasjonen i 3.2, men kontroller versjonen (L7, L8) |
| Brannmur | `ufw` aktiv (SSH, 80, 443, 51820/udp for WireGuard); `fail2ban` aktiv | Ingenting skal endres. Docker-publiserte porter går forbi `ufw`; derfor publiseres appen aldri (vei A) eller bare på `127.0.0.1` (vei B) |
| SSH | Bare nøkkel; passord og root slått av; bare navngitte brukere (`AllowUsers` i `/etc/ssh/sshd_config.d/00-herding.conf`) | Eieren arbeider som `mani` over SSH. Nettkonsollen trengs ikke |
| Brukere | `mani` (eier, `sudo` med passord); `koordinator` (Plattforms Claude-økt, `sudo` **uten** passord, **midlertidig til 29.11.2026**); `administrator` (one.coms standardbruker, har passord og `sudo`, slipper ikke inn over SSH) | Alle tre kan lese Husvetts database (avsnitt 7). Føres i tilgangslisten (pilot-sjekkliste C16). **Installasjonsøkta rapporterte senere to funn som ikke stemmer med denne raden** og en ny bruker `husvett-drift`: se «Nye funn» under og 0B |
| Plattforms mapper | `/srv/stacks/plattform`, `/srv/stacks/akkreditering`, `/srv/edge`, `/home/mani/plattform` | Husvett bruker bare `/srv/husvett` |
| WireGuard | `wg0` på `10.8.0.1/24` | Ikke rør. `10.8.0.1` skal aldri stå i `PUBLIC_BIND_IP` |
| Oppdateringer | `unattended-upgrades` aktiv (kan kreve omstart); omstarter avtales med eieren | Se «Omstart og oppdateringer» under |
| Ikke kartlagt | Ledig disk/minne (L12/L13), IPv6 (L15/L16), tidssone (L17), planlagte Docker-oppryddingsjobber (L18) | Kjør lesepakken under |

**Kjente avvik (opplyst av Plattform-prosjektet, ikke kontrollert av oss):** serveren er behandlet som **testserver**: port 22 er åpen mot hele internett, `koordinator` har full `sudo` uten passord til 29.11.2026, og `administrator` har et aktivt passord. Plattform planla å stenge 80/443 etter testfasen; det går ikke så lenge Husvett ligger der. Dette er et **STOPP før ekte familiedata** (pilot-sjekkliste C17): herdingstiltak foreslås der, men utføres ikke av oss. **Eierens beslutning 2026-11-22:** eieren har akseptert risikoen skriftlig («Jeg aksepterer risikoen skriftlig og inviterer familie nå», artifact-spørsmål 40, kl. 18:15 UTC, uten kommentar). Tiltakene står likevel som **anbefalt, ikke utført**, og aksepten opphever ikke andre STOPP-punkter (pilot-sjekklisten, statustabellen øverst).

**Nye funn (rapportert av installasjonsøkta på eierens PC, 2026-11-22; ikke kontrollert av oss; stemmer ikke med det Plattform opplyste):** (1) **`administrator` har `sudo` uten passord** i `sudoers.d` (Plattform opplyste «har passord og `sudo`»); (2) **`AllowUsers` står i to linjer**: én med bare `mani` og én med `mani koordinator husvett-drift` (Plattform opplyste én liste uten `administrator`). Hvordan sshd leser de to linjene, er ikke kontrollert; `sudo sshd -T | grep -i allowusers` viser gjeldende verdi (bare lesing). Disse to funnene gjør ikke avvikene i C17 mindre. **Plattform-koordinatoren har sluttet å følge opp Husvett:** spørsmål om serveren går direkte via eieren, ikke via Plattform.

**Konklusjon: vei A** (avsnitt 6A), med `PUBLIC_BIND_IP` satt til serverens offentlige IPv4-adresse i `.env.drift`. Appens egen port publiseres ikke i det hele tatt i vei A. Det meste av leseskjemaet i avsnitt 1 er besvart av Plattform; bare punktene i lesepakken under gjenstår.

### 0A.1 Ikke rør (avtale med Plattform-prosjektet)

Husvett-arbeid skal **aldri**:

- endre, lese inn eller kopiere noe i `/srv/stacks` (`plattform`, `akkreditering`), `/srv/edge` eller `/home/mani/plattform`;
- endre WireGuard (`wg0`, `10.8.0.1/24`, port 51820/udp), `ufw`, `fail2ban` eller SSH-oppsettet (`/etc/ssh/sshd_config*`, `AllowUsers`);
- binde noe til port 443 (eller andre porter) på `10.8.0.1`;
- røre Plattforms Docker-nettverk, -volumer, -containere eller -images (bare Husvetts eget Compose-prosjekt `middagsplanlegger`, fra `/srv/husvett/middagsplanlegger/docs/drift`);
- kjøre `docker login` eller `docker logout` som root (root har en innlogging mot GHCR som Plattform bruker). Husvett henter bare offentlige images og trenger ingen innlogging;
- kjøre `docker system prune` (i noen variant), `docker volume prune`, `docker network prune`, `docker image prune -a` eller `docker builder prune` uten avtale: de virker på hele serveren;
- starte Docker-tjenesten på nytt (`systemctl restart docker`) eller oppgradere Docker uten avtale med eieren: det starter Plattforms containere på nytt;
- lage nye SSH-brukere. Systembrukeren `husvett` (avsnitt 3.3) har ikke innloggingsskall og står ikke i `AllowUsers`; det er riktig. Nye SSH-brukere krever endring av `AllowUsers`, avtalt med eieren;
- endre `unattended-upgrades` eller tidspunkt for omstart.

Husvett-arbeidet gjøres av eieren som `mani` (anbefalt). `koordinator` er Plattforms midlertidige økt og skal ikke brukes til Husvett.

### 0A.2 Lesepakke for eieren (bare lesing, kjøres som `mani`)

Logg inn som `mani` over SSH og lim inn blokken under (hele på én gang går fint). Den **endrer ingenting**: den bare leser og skriver ut. `sudo` spør om passordet til `mani` første gang. IP-adresser blir maskert (bare de to første tallene vises, f.eks. `10.8.x.x`), så utskriften kan limes inn i chat. **Se likevel over at ingen hel IP-adresse, nøkkel eller passord er med før du deler.**

```sh
maske() { sed -E 's/0\.0\.0\.0/@A@/g; s/127\.0\.0\.1/@L@/g; s/([0-9]{1,3}\.[0-9]{1,3})\.[0-9]{1,3}\.[0-9]{1,3}/\1.x.x/g; s/([0-9a-fA-F]{1,4}:[0-9a-fA-F]{1,4}):[0-9a-fA-F:]*[0-9a-fA-F]/\1:…/g; s/@A@/0.0.0.0/g; s/@L@/127.0.0.1/g'; }
echo "== L3/L4 porter 80 og 443 (TCP og UDP)"; sudo ss -tlnp '( sport = :80 or sport = :443 )' | maske; sudo ss -ulnp '( sport = :443 )' | maske
echo "== L7/L8 Docker"; docker --version; docker compose version; apt list --installed 2>/dev/null | grep -Ei '^(docker|containerd)'
echo "== L9/L10 containere, volumer og nettverk"; sudo docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | maske; sudo docker volume ls | grep -c middagsplanlegger; sudo docker network ls
echo "== L12 disk"; df -h / /var/lib/docker; sudo docker system df
echo "== L13 minne"; free -h; nproc
echo "== L15 brannmurtabeller"; sudo nft list tables; sudo ufw status | grep -c '(v6)'
echo "== L16 adresser (maskert)"; ip -4 -o addr show scope global | awk '{print $2, $4}' | maske; ip -6 -o addr show scope global | awk '{print $2, $4}' | maske
echo "== L17 tid"; timedatectl | grep -E 'Time zone|synchronized|NTP'
echo "== L18 planlagte jobber"; sudo ls /var/spool/cron/crontabs 2>/dev/null; ls /etc/cron.d; systemctl list-timers --all --no-pager; sudo grep -rniE 'prune|docker (rm|volume|system)' /etc/cron* /var/spool/cron /etc/systemd/system 2>/dev/null
echo "== T1 tilgang (C16)"; for u in mani koordinator administrator; do id "$u"; done; getent group sudo docker; sudo grep -rhv '^#' /etc/sudoers.d 2>/dev/null | grep -v '^$'; sudo passwd -S administrator; sudo grep -rh '^AllowUsers' /etc/ssh/sshd_config /etc/ssh/sshd_config.d 2>/dev/null
echo "== T2 oppdateringer og omstart"; systemctl is-active unattended-upgrades; grep -vh '^\s*//' /etc/apt/apt.conf.d/50unattended-upgrades 2>/dev/null | grep -E 'Automatic-Reboot|origin=|Origins-Pattern|\$\{distro' ; ls /var/run/reboot-required 2>/dev/null || echo "ingen omstart ventet"
```

**Hva svarene betyr:**

| # | Ventet / greit | Stopp og spør utvikleren hvis |
| --- | --- | --- |
| L3/L4 | Bare overskrift, **eller** bare Plattforms testmiljø på `10.8.x.x:443` | Noe lytter på `0.0.0.0:443`, `*:443`, `[::]:443`, `:80`, eller på serverens offentlige adresse. Da er portene ikke ledige for oss |
| L7/L8 | `Docker version 29.…`, `Docker Compose version` v2 eller nyere (f.eks. `v5.…`), og pakkene `docker-ce`, `docker-compose-plugin`, `containerd.io` | `docker compose` mangler, eller `docker.io` finnes i tillegg til `docker-ce` (to kilder) |
| L9/L10 | Plattforms containere (hvis noen) uten `:80->` eller `:443->` på andre adresser enn `10.8.x.x`; tallet for `middagsplanlegger` er `0` (gjelder før installasjonen; etterpå heter Husvetts volumer `husvett_…`, 0B) | En container publiserer 80/443 på alle adresser, eller det finnes `middagsplanlegger`-volumer fra før |
| L12 | `Avail` minst ca. 10 GB på `/` (og `/var/lib/docker` hvis den står for seg) | Under 10 GB |
| L13 | `available` minst 4 GB; `nproc` 8 | Under 4 GB |
| L15 | Tabellnavn som `inet`/`ip`/`ip6` (`ufw` og Docker). Tallet etter er antall `ufw`-regler for IPv6 | Bare til orientering, ingen stopp |
| L16 | Ett offentlig nettverkskort (ofte `eth0`, `ens3` eller lignende) med en adresse som **ikke** begynner med `10.`, `172.16.`–`172.31.` eller `192.168.`; `wg0` med `10.8.x.x`; `docker0` med `172.17.x.x` | Det offentlige kortet har bare en privat adresse (one.com bruker da adresseomsetting, NAT): se avsnitt 5 om `PUBLIC_BIND_IP` før du fortsetter. **IPv6:** står det en linje under IPv6-delen, har serveren offentlig IPv6. Med `PUBLIC_BIND_IP` svarer Husvett bare på IPv4: **ingen AAAA-oppføring** for `husvett.no`/`www` (avsnitt 4.3) |
| L17 | `Time zone: Europe/Oslo` eller `Etc/UTC`, `System clock synchronized: yes` | Klokken er ikke synkronisert (sertifikater og token-utløp krever riktig tid) |
| L18 | Ingen linjer fra `grep` med `prune` eller `docker volume/system` | Noe sletter Docker-data automatisk: avtal med eieren at det ikke rammer Husvetts volumer (avsnitt 2) |
| T1 | Brukerne og gruppene stemmer med tabellen over; `koordinator` med `NOPASSWD` i `sudoers.d`; `administrator` med `P` (har passord) i `passwd -S`; `AllowUsers` uten `administrator`; ingen i gruppen `docker`. **Installasjonsøkta rapporterte annerledes (ikke kontrollert av oss):** `administrator` også med `NOPASSWD` i `sudoers.d`, to `AllowUsers`-linjer (én med bare `mani`, én med `mani koordinator husvett-drift`), og en ekstra bruker `husvett-drift`. Se hva T1 faktisk viser | Ukjente brukere i `sudo` eller `docker`, eller `AllowUsers` har flere enn ventet: før dem i tilgangslisten og spør eieren |
| T2 | `active`; `Automatic-Reboot` mangler eller er `"false"`; bare Ubuntus egne kilder (`${distro_id}…`) | `Automatic-Reboot "true"` (serveren kan starte på nytt av seg selv) eller Dockers kilde (`origin=Docker`) i listen (Docker kan bli oppgradert og starte alle containere på nytt). Ikke stopp, men avtal rutinen med eieren |

Lim svaret (maskert) inn i chatten med utvikleren. Rett **før** første oppstart kjøres L3/L4 én gang til (avsnitt 6A, steg 4).

### 0A.3 Omstart og oppdateringer

- **Hvem varsles:** eieren, før enhver planlagt omstart av serveren, oppgradering av Docker eller endring i Husvett. Eieren avtaler med Plattform-prosjektet.
- **`unattended-upgrades`** installerer sikkerhetsoppdateringer selv og kan kreve omstart (`/var/run/reboot-required`). Omstarten tas av eieren på et avtalt tidspunkt (ikke av Husvett-arbeid på egen hånd).
- **Etter hver omstart av serveren eller av Docker** (fra `mani`, `sudo -i`): `cd /srv/husvett/middagsplanlegger/docs/drift && docker compose --env-file .env.drift ps`. Ventet: `app (healthy)` og `caddy` med `<IP>:80->80/tcp` og `<IP>:443->443/tcp`. Containerne har `restart: unless-stopped` og starter selv. **Sjekk dette etter første omstart:** står `caddy` som `Exited` med `cannot assign requested address`, var den offentlige adressen ikke klar da Docker startet; kjør `docker compose --env-file .env.drift up -d` og si fra til utvikleren. Kontroller også volumet (avsnitt 8: «Synk-databasen: … (N husstander)», ikke «opprettet tom»).
- `restart: unless-stopped` betyr at en container som er stoppet for hånd (`docker compose stop`), **forblir** stoppet etter omstart. Glem ikke `up -d` etter vedlikehold.

### 0A.4 Flytte Husvett senere (uten å binde Plattforms planer)

Husvett er laget for å kunne flytte til egen server uten at Plattform må gjøre noe. Husvett bruker ikke Plattforms mapper, nettverk, volumer, Caddy/edge eller WireGuard, og ingenting i Plattform skal vise til Husvett. Etter flyttingen kan Plattform stenge 80/443 slik de planla. **Merk:** en `ufw`-regel som stenger 80/443 stenger **ikke** Husvett mens den ligger her (Docker-publiserte porter går forbi `ufw`); en stenging i one.coms brannmur ville derimot stenge Husvett også. Plattform bør altså ikke stenge 80/443 før Husvett er flyttet eller eieren har bestemt noe annet.

Det som må flyttes: datavolumet (`middag.sqlite` og `tilbud.sqlite`), `.env.drift` (særlig `SYNC_SECRET`; uten den slutter bare ubrukte invitasjoner å virke) og avtalen om backupnøkkelen (den private nøkkelen ligger uansett ikke på serveren). Sertifikatene (`caddy-data`) hentes på nytt på den nye serveren.

Rekkefølge (utkast, ikke prøvd mellom to servere):

1. Ny server satt opp etter denne guiden (avsnitt 3–5), **uten** `PUBLIC_BIND_IP` hvis serveren er Husvetts alene. Senk TTL på A-oppføringene for `husvett.no` og `www` (avsnitt 4) et døgn før.
2. På den gamle serveren: `docker compose --env-file .env.drift stop caddy` (da når ingen appen lenger, men den kjører), så `systemctl start husvett-backup.service` (`backup.sh` trenger at appen kjører; avsnitt 9), og deretter `docker compose --env-file .env.drift stop app`. Enhetene virker videre uten server og sender det de har lagret når synken er tilbake (offline først). Stopp Caddy **før** kopien, ellers kan data som skrives etterpå gå tapt.
3. På den nye serveren: gjenopprett kopien som i 9.5, kopier `SYNC_SECRET` til `.env.drift` (fra passordhåndtereren), start.
4. Endre A-oppføringene til den nye adressen. Caddy henter sertifikat når DNS peker riktig. Kontroller avsnitt 8 og at testenhetene viser «Synket».
5. På den gamle serveren, når alt er kontrollert: `docker compose --env-file .env.drift down` (**uten** `-v`). Volumet og de lokale sikkerhetskopiene slettes først etter avtalt tid og i tråd med slettefristen (30 dager for kopier, A7), og bare Husvetts egne (`docker volume rm middagsplanlegger_middag-data …`; på Plattform-serveren trolig `husvett_middag-data`, se 0B; `/srv/husvett`). Fjern så systemd-timeren `husvett-backup` og systembrukeren `husvett` (på Plattform-serveren: `husvett-drift`, 0B). Ingenting av Plattforms skal røres.

### 0B. Installasjonsstatus og navneavvik (rapportert 2026-11-22)

**Kilde:** installasjonsøkta på eierens PC (vei A, innlogget som bruker `husvett-drift`), **ikke fullført ennå**. **Alt under er rapportert av installasjonsøkta, ikke kontrollert av oss** (vi har ingen tilgang til serveren). Rapporten er ikke prøvd mot lesepakken i 0A.2; kjør T1 og kontroller etter punktene under før noe krysses av i pilot-sjekklisten.

**Rapportert gjort:**

- Koden er klonet til `/srv/husvett/middagsplanlegger`, commit 3539940.
- `age` er installert.
- `/srv/husvett/backup` finnes (bare root).
- `.env.drift` er laget fra malen **uten hemmeligheter**. Eieren skriver selv `SYNC_SECRET` og `PUBLIC_BIND_IP`, og endrer DNS selv (avsnitt 4). Hemmeligheter og hele IP-adresser skal ikke inn i repoet eller i chat.
- Caddy binder bare til én adresse, appen har ingen port ut, og `restart: unless-stopped` er på begge containerne.

**Ikke gjort ennå (så vidt vi vet):** hemmelighetene i `.env.drift`, DNS, oppstart og kontroll utenfra (avsnitt 8), backup-nøkkel og -oppsett (avsnitt 9; **nøkkelen lages av eieren, bare én holder er oppgitt, anbefalt er to**), kopi utenfor serveren, gjenopprettingsøvelse (9.5) og tilgangslisten (pilot-sjekkliste C16).

**Avvik fra guiden. Les kommandoene i resten av guiden med disse navnene:**

| Guiden sier | Rapportert virkelighet | Merknad |
| --- | --- | --- |
| Systembruker `husvett` (uten innlogging, `adduser --system`, avsnitt 3.3) | **`husvett-drift`** eier `/srv/husvett/middagsplanlegger`. Brukeren står i `AllowUsers` (rapportert) | Avviker fra 0A.1 («ingen nye SSH-brukere»; eieren har selv valgt dette). **Tilgangsnivået er ikke opplyst:** har `husvett-drift` `sudo` eller gruppen `docker`? Føres i tilgangslisten (pilot-sjekkliste B8, C16). Les `sudo -u husvett git …` som `sudo -u husvett-drift git …` (eller kjør `git` direkte som den brukeren) |
| Compose-prosjekt `middagsplanlegger` (`name:` i `docker-compose.yml`) | Prosjektet heter **`husvett`** | Hvordan navnet ble endret, er ikke rapportert. Compose-filen har `name: middagsplanlegger`; en annen verdi kommer fra `COMPOSE_PROJECT_NAME` eller `-p`. Kontroller under |
| Containere `middagsplanlegger-app-1` og `middagsplanlegger-caddy-1` | Følger prosjektnavnet: trolig **`husvett-app-1`** og **`husvett-caddy-1`** (ikke rapportert), se `docker compose --env-file .env.drift ps` | Gjelder bl.a. `docker inspect … middagsplanlegger-app-1` i avsnitt 11 |
| Nettverk `middagsplanlegger_default` | **`husvett_default`** | Gjelder avsnitt 7 |
| Volumer `middagsplanlegger_middag-data`, `…_caddy-data`, `…_caddy-config` | **`husvett_middag-data`, `husvett_caddy-data`, `husvett_caddy-config`** | Gjelder 0A.4 (flytting), 0A.2 (L9/L10), avsnitt 7 og 11. **Slett aldri `husvett_caddy-data`** (sertifikatene) |
| Image `middagsplanlegger:pilot` | Ikke rapportert; Compose-filen har et fast `image:`-navn, så det er trolig **uendret** | Kontroller med `docker images`. Gjelder `docker tag` i avsnitt 10 og `docker run` i 9.5 |
| Mappen `/srv/husvett/middagsplanlegger` | Uendret | – |

**Kontroller dette før du går videre (bare lesing, fra `docs/drift` som `husvett-drift` eller med `sudo`):**

```sh
docker compose --env-file .env.drift config | grep -E '^name:|^    name:'      # prosjektnavn og volumnavn Compose faktisk bruker
grep -E '^(DATA_VOLUME|COMPOSE_PROJECT_NAME)=' .env.drift                     # er navnet satt her? (verdiene er ikke hemmelige)
git -C /srv/husvett/middagsplanlegger status --short                           # tom = ingen lokale endringer i filene fra git
docker volume ls | grep -E 'husvett|middagsplanlegger'                         # hvilke volumer finnes
```

**Viktig om volumet:** `docker-compose.yml` gir datavolumet navnet `${DATA_VOLUME:-middagsplanlegger_middag-data}`, altså et fast standardnavn som **ikke** følger prosjektnavnet. Et volum som heter `husvett_middag-data` oppstår derfor bare hvis `DATA_VOLUME` er satt til det i `.env.drift`, eller Compose-filen er endret lokalt (da stopper neste `git pull`). Står det to datavolumer (`middagsplanlegger_middag-data` og `husvett_middag-data`), bruker appen bare ett: **kontroller hvilket** (`docker inspect -f '{{range .Mounts}}{{.Name}} {{end}}' <appcontainer>`) og at `DATA_VOLUME` peker på det, før noen tar appen i bruk. Feil volum gir en stille tom database (avsnitt 8 og 11). Ikke slett noe volum for å rydde.

**Etter navnebyttet gjelder fortsatt** alle regler i 0A.1 og avsnitt 12 (ikke `docker system prune`, ikke `down -v`, ikke røre Plattforms nettverk eller volumer). Husvetts volumer og nettverk heter nå `husvett_…`, men er fortsatt Husvetts egne.

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
| L10 | `sudo docker volume ls` og `sudo docker network ls` | Volumer og nettverk som finnes | At ingen heter `middagsplanlegger_…` fra før (etter installasjonen: se 0B, navnene er `husvett_…`) |
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

**På Plattform-serveren finnes Docker** (`docker-ce` 29.x med Compose fra Dockers pakkelager; opplyst av Plattform-prosjektet, ikke kontrollert av oss). **Ikke installer på nytt.** Kontroller bare versjonen (L7/L8 i lesepakken 0A.2: `docker --version` skal vise 29.x, `docker compose version` v2 eller nyere, og `docker-ce` skal være eneste Docker-pakke), og hopp så til 3.3.

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

**Ikke legg `mani`, `koordinator`, `administrator` (eller andre) i gruppen `docker`.** Den gir full root-tilgang til hele serveren, også plattformprosjektet. Bruk `sudo` / root-skallet.

### 3.3 Egen systembruker, egen mappe

Husvett får sin egen systembruker (`husvett`, uten innlogging), sin egen mappe (`/srv/husvett`) og sin egen mappe for sikkerhetskopier. Ingenting legges i plattformprosjektets mapper.

```sh
# Fortsatt i root-skallet (sudo -i)
id husvett 2>/dev/null || adduser --system --group --home /srv/husvett --shell /usr/sbin/nologin husvett
install -d -m 750 -o husvett -g husvett /srv/husvett
install -d -m 700 -o root -g root /srv/husvett/backup
ls -la /srv/husvett
```

**På Plattform-serveren er dette gjort annerledes (rapportert, 0B):** `husvett-drift` eier mappen, og det er ingen systembruker `husvett`. Les `husvett` i resten av guiden som `husvett-drift` der det gjelder `sudo -u … git`.

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

I one.coms kontrollpanel for serveren (oversikten viser IPv4 og eventuelt IPv6). **Skriv dem ikke i repoet.** Sammenlign med L16 (umaskert på serveren: `ip -4 addr show scope global`). Adressen på serverens offentlige nettverkskort er også den som skal i `PUBLIC_BIND_IP` (avsnitt 5). **Sjekk dette:** at adressen i L16 er den samme som i kontrollpanelet. Begynner adressen i L16 med `10.`, `172.16.`–`172.31.` eller `192.168.`, er det en intern adresse: bruk den fra kontrollpanelet.

### 4.3 Endre oppføringene i one.coms DNS-panel

**Forbehold:** one.com endrer panelet sitt fra tid til annen. Navnene under er slik vi forventer dem, ikke kontrollert mot panelet i dag. Finner du ikke det som beskrives, stopp og ta et skjermbilde.

1. Logg inn på one.coms kontrollpanel (med to-faktor) og velg domenet `husvett.no`.
2. Finn DNS-innstillingene for domenet (hos one.com har de ligget under noe som «Avanserte innstillinger» → «DNS-innstillinger»; **sjekk dette**). Der står oppføringene i en liste, og det finnes en knapp for å legge til eller redigere en oppføring.
3. **Endre bare oppføringene for `@` (selve `husvett.no`) og `www`**, slik:

| Navn (vert) | Type | Verdi | Merknad |
| --- | --- | --- | --- |
| `@` (selve `husvett.no`; noen paneler vil ha feltet tomt) | A | `<SERVERENS IPv4>` | Hovedadressen |
| `www` | A | `<SERVERENS IPv4>` | Eller i stedet: `www` som **CNAME** til `husvett.no` (følger da `@` av seg selv). Ikke begge |
| `@` | AAAA | `<SERVERENS IPv6>` | **Bare hvis serveren har en offentlig IPv6** (4.2) **og `PUBLIC_BIND_IP` er tom.** På Plattform-serveren (med `PUBLIC_BIND_IP`) svarer Husvett bare på IPv4: **ingen AAAA** |
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
| `# TJEK_IMAGE_HOSTS=image-transformer-api.tjek.com` | Fjern `#` når bilder og avissider fra Tjek skal vises; ellers la stå (tom = ingen bilder) | Formprøven 2026-11-22 fant bare denne verten (`phase0/tjek-formprøve.md`). Brukernes nettleser henter da bildene fra Tjek (Tjek ser IP-adressen) |
| `PUBLIC_BIND_IP=<OFFENTLIG IPv4>` | **På Plattform-serveren: må settes** (fjern `#` foran linjen og skriv adressen). Ellers tom | Se «`PUBLIC_BIND_IP`» rett under. Adressen står bare i `.env.drift` på serveren |
| `TRUST_PROXY` | **Skal ikke stå i filen** | Er satt til `1` i `docker-compose.yml` for begge veier (riktig: nøyaktig én proxy foran appen). En verdi i `.env.drift` overstyrer den ikke |

**`PUBLIC_BIND_IP` (vei A på Plattform-serveren).** Plattforms testmiljø vil bruke port 443 på WireGuard-adressen `10.8.0.1`. Binder vår Caddy til alle adresser (som når linjen er tom), kolliderer de: den som starter sist, får `address already in use` (prøvd i sandkassen, avsnitt 14). Derfor bindes Caddy bare til serverens offentlige IPv4-adresse:

```sh
# I root-skallet, fra docs/drift. Vis adressene (ikke del utskriften):
ip -4 addr show scope global
```

Velg adressen på det **offentlige nettverkskortet** (ofte `eth0` eller `ens…`), samme som i one.coms kontrollpanel (4.2). **Aldri** `10.8.0.1` (`wg0`), `172.17.…` (`docker0`) eller `127.0.0.1`. Viser det offentlige kortet bare en privat adresse (`10.`, `172.16.`–`172.31.`, `192.168.`), bruker one.com adresseomsetting (NAT): stopp og spør utvikleren (da skal den private adressen på det kortet trolig brukes, men det er ikke prøvd). Skriv adressen inn med `nano .env.drift` på linjen `PUBLIC_BIND_IP=` (uten `#`, uten klammer, uten port). Kontroller:

```sh
grep -c '^PUBLIC_BIND_IP=[0-9]' .env.drift                                        # skal svare 1
ip -4 -o addr show | grep -F " $(sed -n 's/^PUBLIC_BIND_IP=//p' .env.drift)/" | awk '{print $2}'   # navnet på det offentlige kortet, ikke wg0 eller docker0
docker compose --env-file .env.drift config | grep -c host_ip                     # skal svare 3 (80/tcp, 443/tcp, 443/udp)
```

Med adressen satt svarer Husvett bare på IPv4: ingen AAAA-oppføring (4.3). En ugyldig verdi (f.eks. et domenenavn) stopper Compose med `invalid IP address` før noe startes.

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

Forutsetter avsnitt 3, 4 og 5 (uten `COMPOSE_FILE`-linjene; på Plattform-serveren **med** `PUBLIC_BIND_IP`).

1. **Brannmur hos one.com:** **sjekk dette:** om one.com har en brannmur for serveren i kontrollpanelet. Den må slippe inn TCP 80 og 443 (og gjerne UDP 443). Ikke åpne noe annet for Husvett.
2. **Brannmur på serveren (ufw, L14):** Docker åpner publiserte porter selv, forbi `ufw` (kjent Docker-oppførsel). Du trenger altså ikke endre `ufw` for 80/443 (på Plattform-serveren slipper `ufw` dem allerede inn, opplyst av Plattform-prosjektet), og du skal **ikke** endre `ufw` i det hele tatt (0A.1). Kontrollen utenfra i avsnitt 8 er det som teller.
3. **DNS peker riktig** (avsnitt 4) før du starter, ellers får Caddy ikke sertifikat (den prøver igjen av seg selv, men det tar lengre tid og kan treffe grensene hos Let's Encrypt).
4. **Kontroller portene rett før start** (L3/L4, bare lesing): `ss -tlnp '( sport = :80 or sport = :443 )'` og `ss -ulnp '( sport = :443 )'`. Greit: tomt, eller bare Plattforms testmiljø på `10.8.0.1:443`. Lytter noe på `0.0.0.0`, `*`, `[::]` eller serverens offentlige adresse på 80/443: stopp og spør.
5. **Start** (bygget tar noen minutter første gang):

```sh
cd /srv/husvett/middagsplanlegger/docs/drift
docker compose --env-file .env.drift up -d --build
docker compose --env-file .env.drift ps
```

Ventet etter ca. 30 sekunder: `app` med `(healthy)` og `caddy` med `Up`. Med `PUBLIC_BIND_IP` har `caddy` portene `<OFFENTLIG IP>:80->80/tcp`, `<OFFENTLIG IP>:443->443/tcp` og `<OFFENTLIG IP>:443->443/udp` (uten `PUBLIC_BIND_IP`: `0.0.0.0:80->80/tcp` osv.). `app` skal ikke ha noen port mot verten (bare `8787/tcp` uten pil). Står det `0.0.0.0` mens `PUBLIC_BIND_IP` er satt, eller `10.8.0.1`: stopp med `docker compose --env-file .env.drift down` og spør. Stopper Caddy med `address already in use` eller `port is already allocated`, bruker noe annet port 80/443 (eller `PUBLIC_BIND_IP` mangler): stopp Caddy med `docker compose --env-file .env.drift stop caddy` og gå tilbake til steg 4. Står det `cannot assign requested address`, finnes ikke adressen i `PUBLIC_BIND_IP` på serveren: rett den (avsnitt 5).

6. **Følg sertifikatet:** `docker compose --env-file .env.drift logs caddy --tail 50`. Se etter `certificate obtained successfully` for `husvett.no` og `www.husvett.no`. Feil: se «Vanlige feil med HTTPS» i avsnitt 11.

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

**Navnene i tabellen er slik guiden er skrevet. Rapportert fra installasjonen 2026-11-22 (0B, ikke kontrollert av oss): prosjekt, nettverk og volumer heter `husvett_…`, og brukeren er `husvett-drift`.**

Dette er bygget inn i oppsettet; avsnittet forklarer hva som skiller Husvett fra plattformprosjektet, og hva som **ikke** gjør det.

| Hva | Hvordan | Kontroll |
| --- | --- | --- |
| Egen bruker og mappe | `husvett` (på Plattform-serveren rapportert som `husvett-drift`) eier `/srv/husvett` (750). Kode i `/srv/husvett/middagsplanlegger`, hemmeligheter i `.env.drift` (600) | `ls -la /srv/husvett` |
| Eget Compose-prosjekt | `name: middagsplanlegger` i `docker-compose.yml`; containerne heter `middagsplanlegger-app-1` (og `-caddy-1` i vei A) | `docker compose --env-file .env.drift ps` |
| Eget Docker-nettverk | Compose lager `middagsplanlegger_default`. Koble det **aldri** til plattformprosjektets nettverk, og koble aldri plattformens containere til vårt | `docker network inspect middagsplanlegger_default --format '{{range .Containers}}{{.Name}} {{end}}'` skal bare vise Husvett-containere |
| Eget databasevolum | `middagsplanlegger_middag-data` (og `…caddy-data`/`…caddy-config` i vei A). Deles ikke med noe annet. Ligger under `/var/lib/docker/volumes/`, som bare root kan lese | `docker volume ls` |
| Ressursgrenser | Appen: høyst 2 GB minne, 2 prosessorer, 256 prosesser. Caddy (vei A): 512 MB, 1 prosessor. Satt i `docker-compose.yml` | `docker stats --no-stream` |
| Egen sikkerhetskopimappe | `/srv/husvett/backup` (700, root), egen nøkkel og egen slettefrist | `ls -la /srv/husvett/backup` |
| Porter | Vei A: bare Caddy publiserer 80/443, på Plattform-serveren bare på den offentlige adressen (`PUBLIC_BIND_IP`), aldri på `10.8.0.1`; appen har ingen port ut. Vei B: appen bare på `127.0.0.1:8790` | `docker compose --env-file .env.drift ps` (kolonnen PORTS) |

**Hva isolasjonen ikke dekker (viktig for personvernet):**

- **Alle som har `sudo`/root på serveren, eller er med i gruppen `docker`, kan lese Husvetts database**, også plattformprosjektets folk. På Plattform-serveren er det etter Plattforms opplysning `mani` (eier), `koordinator` (Plattforms Claude-økt, `sudo` uten passord, midlertidig til 29.11.2026), `administrator` (one.coms standardbruker, med passord) og one.com som leverandør. Kontroller med T1 i lesepakken (0A.2) og før listen inn i tilgangslisten (pilot-sjekkliste B8 og C16).
- Docker-motoren deles. En oppgradering eller omstart av Docker (fra plattformprosjektet eller fra deg) starter begge prosjektenes containere på nytt. Husvett starter av seg selv igjen (`restart: unless-stopped`).
- Containeren kjører som uid 1000. På mange Ubuntu-servere er uid 1000 den første vanlige brukeren (kanskje `administrator`; T1 i lesepakken viser uid for `mani`, `koordinator` og `administrator`). Det har betydning bare hvis noen bryter ut av containeren; endre det ikke på egen hånd (en endring av Docker-motoren påvirker plattformprosjektet).
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

**Et eget e-postvarsel er ikke bygget.** Det som finnes: `driftstatus.sh` (9B) sier **ADVARSEL** når nyeste kopi er eldre enn 36 timer og **FEIL** etter 4 døgn, og den daglige timeren i 9B skriver det til journalen. Se også etter i `journalctl -u husvett-backup --since yesterday --no-pager`, og at det kommer nye filer i `/srv/husvett/backup` (`ls -lt /srv/husvett/backup | head`). Et varsel som når deg uten at du ser etter (e-post), er ikke på plass (pilot-sjekkliste C10).

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

### 9B. Driftsstatus og overvåking (bare lesing)

Skript: [`drift/driftstatus.sh`](drift/driftstatus.sh). Tolkning av hver linje, systemd-timer, oppskrift for ekstern oppetidstjeneste og tabellen «hva gjør jeg ved ADVARSEL/FEIL»: [`drift/driftstatus.md`](drift/driftstatus.md). Kort:

```sh
cd /srv/husvett/middagsplanlegger/docs/drift
./driftstatus.sh          # som en vanlig bruker med sudo; utgangskode 0 = OK, 1 = ADVARSEL, 2 = FEIL
```

Rapporten sjekker containere og helse, `/healthz` lokalt, disk og minne (datavolumet og kopimappen), alderen på siste kopi av begge databasene (ADVARSEL over 36 timer), databasestørrelser, om Tjek-hentingen har kjørt nylig, antall feillinjer i appens logg, og TLS-sertifikatet mot `husvett.no`. Den **leser bare**, skriver aldri IP-adresser, nøkler eller innhold, og kan limes inn i en melding til utvikleren. `/healthz` har fått noen ekstra **tall og ja/nei** (aldri persondata) til dette (`sikkerhet.md`, S23).

For daglig kjøring: tre enhetsfiler i `driftstatus.md` («Kjøre den hver dag»). For å bli varslet når siden er nede: en ekstern oppetidstjeneste (samme dokument; **ikke valgt, ikke satt opp**).

**Status:** skriptet og `/healthz`-tallene er prøvd i sandkassen (falsk `docker`, ekte bygd server, selvsignerte sertifikater; `npm run check:driftstatus`). **Ikke prøvd på denne serveren:** Docker der (formatet på `docker`-utskriftene er antatt), `sudo`-oppførselen for `husvett-drift`, systemd-timeren (bare `systemd-analyze verify`), sertifikatet for `husvett.no`, og at serveren når seg selv utenfra (ellers: `HUSVETT_SKIP_EXTERNAL=1`). Prosjektnavnet på denne serveren er `husvett` (0B); skriptet finner containerne gjennom `docker compose --env-file .env.drift`, så det følger `COMPOSE_PROJECT_NAME` fra `.env.drift` uten å kjenne navnet.

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

**Ubuntu-oppdateringer og omstart:** se 0A.3. Kort: `unattended-upgrades` er aktiv (opplyst av Plattform-prosjektet); omstarter avtales med eieren, og eieren varsles før enhver planlagt omstart eller Docker-oppgradering. En oppdatering av Docker-pakkene starter alle containere på nytt; Husvett starter selv igjen, men kontroller avsnitt 8 etterpå.

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
| Ressursbruk | `docker stats --no-stream` og `df -h /` | Følg med på disk ukentlig, eller les `./driftstatus.sh` (9B) |
| Samlet status | `./driftstatus.sh` fra `docs/drift`, eller `journalctl -u husvett-driftstatus -n 40 --no-pager` etter at timeren i 9B er slått på | Bare lesing; ingen IP-adresser eller innhold |
| Databasestørrelse | `docker compose --env-file .env.drift exec app ls -la /data` | Kjøres fra `docs/drift`. Viser `middag.sqlite` og `tilbud.sqlite` (med `-wal`/`-shm`) i det volumet appen faktisk bruker |

**Når noe går galt:**

| Symptom | Sjekk | Gjør |
| --- | --- | --- |
| Siden svarer ikke | `./driftstatus.sh` (9B), `docker compose --env-file .env.drift ps` | Er `app` ikke `healthy`: les loggen. `docker compose --env-file .env.drift restart app` én gang. Hjelper ikke det: ring utvikleren |
| `502 Bad Gateway` (vei B) | `curl -s http://127.0.0.1:8790/healthz` på serveren | Svarer ikke appen: se over. Svarer den: feil port i Nginx/Caddy-oppsettet |
| Alle enheter er logget ut, eller loggen sier «opprettet tom» etter omstart | `docker inspect -f '{{range .Mounts}}{{.Name}} {{end}}' middagsplanlegger-app-1` (på Plattform-serveren trolig `husvett-app-1`, 0B) og `grep DATA_VOLUME .env.drift` | **Feil volum.** Stopp appen (`docker compose --env-file .env.drift stop app`), ikke slett noe, og ring utvikleren. De gamle dataene ligger i det volumet som var i bruk før |
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
- **Ikke endre plattformprosjektets filer, nettverk, containere eller brannmur.** Bare ett nytt vertsoppsett i vei B, med sikkerhetskopi først. På Plattform-serveren gjelder hele «Ikke rør»-listen i 0A.1 (bl.a. `/srv/stacks`, `/srv/edge`, `/home/mani/plattform`, WireGuard, `ufw`, `fail2ban`, SSH, GHCR-innloggingen hos root, port 443 på `10.8.0.1`, aldri `docker system prune`).
- **Ikke la `PUBLIC_BIND_IP` stå tom på Plattform-serveren,** og skriv aldri `10.8.0.1` i den.
- **Ikke legg brukere i gruppen `docker`** (det er root-tilgang).
- **Ikke installer Docker på nytt eller fra to kilder,** og ikke kjør Dockers «avinstaller gamle pakker»-steg på denne serveren.
- **Ikke sett `TRUST_PROXY=1` hvis appen kan nås uten om proxyen,** og ikke legg en CDN/«proxy» foran uten at utvikleren har sett på det.
- **Ikke slå på tilgangslogg (IP-adresser) for Husvett** før loggtid er avgjort (pilot-sjekkliste A7, C11).
- **Ikke inviter ekte familier** før STOPP-punktene i pilot-sjekklisten er krysset av, også gjenopprettingsøvelsen (C7).

---

## 13. Kort huskeliste

1. Plattform-serveren: avsnitt 0A (les «Ikke rør», kjør lesepakken 0A.2, vei A). Annen server: avsnitt 1, velg vei (avsnitt 2).
2. Avsnitt 3: programmer, Docker (bare om det mangler), bruker, mappe, kode.
3. Avsnitt 4: kartlegg nettside og e-post på domenet, så DNS i one.coms panel (tidlig). Bare `@` og `www`; e-postoppføringene står urørt.
4. Avsnitt 5: `.env.drift` (Plattform-serveren: `PUBLIC_BIND_IP`; vei B: to ekstra linjer).
5. Avsnitt 6A eller 6B/6C: start.
6. Avsnitt 7: kontroller isolasjonen; avsnitt 8: kontroller på serveren og utenfra.
7. Avsnitt 9: nøkkel, daglig kopi, kopi utenfor serveren, gjenopprettingsøvelse; 9B: driftsstatus (og en ekstern oppetidstjeneste).
8. Skriv i driftsloggen og i pilot-sjekklisten (C1–C7, C16, C17).

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
- **Driftsstatus (2026-11-26):** `driftstatus.sh` (`bash -n`, `shellcheck`, `npm run check:driftstatus`) mot en falsk `docker`, den ekte bygde serveren og selvsignerte sertifikater; `systemd-analyze verify` av de tre enhetsfilene i `drift/driftstatus.md`. Se 9B.
- **`PUBLIC_BIND_IP` (senere 2026-11-22, Docker 29.10.0 og Compose 5.7.1 i sandkassen):** `docker compose config` med `env.eksempel` uten variabelen, med tom variabel og med en adresse satt. Uten og med tom verdi er utskriften **identisk** med Compose-filen fra før endringen (ingen `host_ip`); med adresse får alle tre Caddy-portene (80/tcp, 443/tcp, 443/udp) `host_ip`; appen har ingen `ports`; begge tjenestene har `restart: unless-stopped`; i vei B (`COMPOSE_FILE` med `docker-compose.bak-proxy.yml`) startes bare `app`, på `127.0.0.1:8790`, også med `PUBLIC_BIND_IP` satt. Et domenenavn i variabelen gir `invalid IP address`. **Kollisjonen er prøvd:** med en annen lytter på `127.0.0.2:443` (stedfortreder for Plattforms `10.8.0.1:443`) feilet Caddy uten variabelen med `failed to bind host port 0.0.0.0:443/tcp: address already in use`; med variabelen satt til sandkassens egen adresse startet Caddy (`docker compose up --no-deps caddy`, `DOMENE=localhost`), lyttet bare på den adressen (80/tcp, 443/tcp, 443/udp), svarte der (http `308`, https nådde Caddy; `502` fordi appen ikke var startet i denne prøven), svarte ikke på `127.0.0.1` eller `172.17.0.1`, og den andre lytteren sto urørt. Appen og hele vei A er ikke kjørt på nytt etter endringen (Compose-utskriften for appen er uendret).
- **Lesepakken (0A.2):** `bash -n` uten feil; maskeringen prøvd på eksempeladresser (IPv4 blir `a.b.x.x`, IPv6 forkortes, `0.0.0.0` og `127.0.0.1` står); kjørt i sandkassen uten å stoppe (der mangler `ip`, `ss`, `ufw` og systemd, så de linjene ga bare feilmeldinger).
- Lest (ikke installert) 2026-11-22: Dockers apt-kilde har `resolute` (Ubuntu 26.04) med `docker-ce` 29.10.0 og `docker-compose-plugin` 5.8.0 for `amd64`; Ubuntus pakkeoversikt for `resolute` har `docker.io` 29.1.3, `docker-compose-v2` 2.40.3, `docker-buildx` 0.30.1 og `age` 1.2.1.

**Ikke prøvd:**

- **Noe som helst på Ubuntu 26.04 eller hos one.com:** installasjon av Docker fra apt-kilden (eller reserveveien), `adduser`-valgene, nettkonsollen (lime inn), one.coms brannmur og om serveren har IPv6.
- one.coms DNS-panel (menynavn, om webhotellets standardoppføringer er låste) og at e-posten overlever endringen.
- Ekte domene, DNS og Let's Encrypt (verken Caddy eller certbot); certbot-stegene i 6B (6–7) og `www`-omdirigeringen i Nginx; HTTP/3.
- At Docker-publiserte porter går forbi `ufw` på akkurat denne serveren (kjent Docker-oppførsel, ikke målt her).
- `PUBLIC_BIND_IP` på Ubuntu 26.04 og sammen med Plattforms ekte `10.8.0.1:443` (WireGuard), IPv6 med `PUBLIC_BIND_IP`, at Caddy starter igjen av seg selv etter omstart av serveren med adressen satt (0A.3), og NAT hos one.com.
- Flytting til en annen server (0A.4).
- **Navneavviket fra installasjonen** (`husvett_…` i stedet for `middagsplanlegger_…`, `husvett-drift` i stedet for `husvett`; 0B): rapportert, ikke kontrollert av oss og ikke prøvd i sandkassen. Hvordan prosjektnavnet ble endret, og hvilket volum appen bruker, er ikke kjent.
- Lesepakken på Ubuntu 26.04 (bl.a. om `id`, `passwd -S` og `nft` gir samme format der).
- Kjøring under systemd (timer og tjeneste), cron-linjen, `rclone` og lagring utenfor serveren, `shred` på serverens disk.
- **Driftsstatus (9B):** skriptet og enhetsfilene er ikke kjørt på denne serveren eller mot ekte Docker, og timeren, `OnFailure=` og journalprioritetene er ikke prøvd under systemd. Ingen ekstern oppetidstjeneste er valgt eller prøvd. Se `drift/driftstatus.md`, «Hva er prøvd».
- Vei B når webserveren selv kjører i Docker, med Apache, eller med en CDN foran.
- Bygging av imaget på en vanlig maskin uten sandkassens omveier, og på `aarch64`.
- At henting fra Tjek virker fra containeren (i sandkassen var henting slått av).
- Lasttest og hvordan Husvett og plattformprosjektet påvirker hverandre under last.

---

## 15. Spørsmål eieren må svare på

1. **Hva viser lesepakken i 0A.2?** (L3/L4, L7–L10, L12, L13, L15–L18, T1, T2; maskert.) Veien er avgjort (vei A), men L12/L13 (disk, minne), L16 (IPv6, NAT), L17 (tidssone) og L18 (opprydding som kan slette volumer) er ikke kartlagt.
2. **Plattform-prosjektet:** eieren har bekreftet at Husvett skal på serveren og at tilgangene er hans egne. Hvem varsles før endringer og omstarter? (Svar i notatet: eieren.) Er Plattform innforstått med at de ikke kan stenge 80/443 mens Husvett ligger der, og at en `ufw`-stenging uansett ikke stenger Husvett (0A.4)?
3. **Tilgang** (opplyst av Plattform-prosjektet, ikke kontrollert av oss): `mani`, `koordinator` (til 29.11.2026), `administrator` og one.com. Stemmer T1 med det? **Hvilke herdingstiltak gjøres før ekte familiedata** (pilot-sjekkliste C17: port 22, `koordinator`, passordet og `sudo` til `administrator`), og hvem gjør dem? Eieren har akseptert risikoen skriftlig (2026-11-22); tiltakene er ikke utført. Hvilket tilgangsnivå har `husvett-drift` (`sudo`, `docker`), og hvordan leser sshd de to `AllowUsers`-linjene (0A, «Nye funn»)?
4. **one.com som databehandler:** finnes det en databehandleravtale med one.com for denne serveren, og i hvilket land står serveren (eieren oppgir «Europa», land ikke bekreftet), og ligger eventuelle øyeblikksbilder også der? (pilot-sjekkliste B6). Har one.com en brannmur i kontrollpanelet for serveren?
5. **Står `husvett.no` (registrert hos one.com) i AVVR AS sitt navn** (A4)? **Ligger det en nettside på webhotellet** på `husvett.no` eller `www` som skal beholdes (den vises ikke lenger der når domenet peker mot serveren)? Og hvem hos dere kan rette e-postoppføringene hvis noe går galt?
6. **Hvem er de to nøkkelholderne** for sikkerhetskopiene (A9)?
7. **Hvor skal kopiene ligge utenfor serveren** (leverandør i EØS, med databehandleravtale), og er 30 dager riktig slettefrist (A7)?
8. **Gjenopprettingsøvelsen:** godtar du at den private nøkkelen er på serveren et kort øyeblikk under en gjenoppretting (9.5), eller skal øvelsen og en ekte gjenoppretting gjøres på en annen maskin?
9. ~~Nettkonsoll eller SSH?~~ Besvart: SSH med nøkkel som `mani` (opplyst av Plattform-prosjektet).
10. **Når tas omstarter etter `unattended-upgrades`,** og når oppgraderes Docker? (Eieren avtaler med Plattform; 0A.3.) Står `Automatic-Reboot` på (T2)?
