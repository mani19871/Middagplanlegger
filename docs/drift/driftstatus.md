# Driftsstatus og overvåking av Husvett

**Status (2026-11-26):** bygget og prøvd i sandkassen (skriptet mot en falsk `docker`, den ekte bygde serveren, selvsignerte sertifikater; `systemd-analyze verify` av enhetsfilene). **Ikke prøvd på den ekte serveren:** Docker der, systemd-timeren, sertifikatet for `husvett.no`, og en ekstern oppetidstjeneste. Se «Hva er prøvd» nederst.

For eieren: du trenger bare å kunne kjøre én kommando og lese en liste der hver linje er **OK**, **ADVARSEL** eller **FEIL**. Skriptet **leser bare**: det starter ikke noe på nytt, sletter ikke noe og endrer ikke noe. Utskriften har ingen IP-adresser, nøkler, koder, etiketter eller innhold, så du kan lime den inn i en melding til utvikleren.

## Det som finnes (tre lag)

| Lag | Hva | Fanger | Varsler deg? |
| --- | --- | --- | --- |
| `driftstatus.sh` (denne siden) | Rapport om containere, `/healthz`, disk, minne, sikkerhetskopier, databaser, Tjek-henting, feil i loggen og sertifikat | Det meste som kan gå galt på serveren | Nei, ikke på egen hånd. Daglig kjøring skriver til journalen (under), men sender ikke e-post |
| Ekstern oppetidstjeneste (under, **ikke satt opp**) | Sjekker `https://husvett.no/healthz` utenfra hvert 1.–5. minutt | At siden er nede, uansett årsak (også at hele serveren er av) | Ja, e-post/SMS/push |
| Dockers innebygde helsesjekk | `HEALTHCHECK` i `Dockerfile`; `docker compose ps` viser `healthy` | At appen ikke svarer | Nei; Docker starter heller ikke på nytt på grunn av den |

Pilot-sjekklistens C10 kreves oppfylt av **lag 1 og 2 sammen**: lag 1 gir disk-, backup- og feilvarsel i en rapport du leser, lag 2 gir selve varselet når siden er nede. Ingen av dem varsler deg automatisk om disken er nesten full midt på natta; det ville krevd e-post fra serveren, som ikke er bygget (se «Åpne spørsmål»).

## Kjøre rapporten

Fra en vanlig bruker på serveren (den som har `sudo`), i mappen `docs/drift`:

```sh
cd /srv/husvett/middagsplanlegger/docs/drift
./driftstatus.sh
echo "utgangskode $?"      # 0 = alt OK, 1 = minst én ADVARSEL, 2 = minst én FEIL
```

Eksempel (fra sandkassen, falske verdier):

```
Husvett driftsstatus 2026-11-26 07:11 (serverens tid). Bare lesing; ingen adresser eller innhold i rapporten.
OK        Containere: app kjører og er «healthy», oppe 47 t 11 min (omstarter siden den ble laget: 0).
OK        Containere: Caddy (HTTPS-fronten) kjører.
OK        Helsesjekk (/healthz lokalt): svarer 200, synk-databasen svarer.
OK        Disk (Husvetts datavolum): 41 % brukt, 59,8 GB ledig.
...
ADVARSEL  Sikkerhetskopi (synk-databasen): nyeste er 40 t 0 min gammel, 1,2 MB. Over 36 timer: sjekk at daglig sikkerhetskopi kjører.
...
Samlet: ADVARSEL (0 feil, 1 advarsler, 14 i orden). Hva du gjør: docs/drift/driftstatus.md.
```

Skriptet spør etter sudo-passordet ditt. **Det er bare disse kommandoene som kjøres med `sudo`:** `docker` (compose ps, inspect, exec, stats, logs), og `find` og `df` på sikkerhetskopimappen hvis du ikke kan lese den selv. Alt annet kjører som deg. `docker exec` kjører ett lite lese-program i app-containeren som bare skriver tall og ja/nei tilbake. Ingenting skrives noe sted.

Flere innstillinger (terskler, andre mapper) står øverst i skriptet (`./driftstatus.sh --hjelp`). Er sikkerhetskopimappen ikke `/srv/husvett/backup`, sett `BACKUP_DIR=… ./driftstatus.sh`. Når serveren ikke når seg selv utenfra (kan være tilfelle hos leverandøren), gir TLS- og nettadressepunktene en ADVARSEL hver dag; slå dem av med `HUSVETT_SKIP_EXTERNAL=1` og la oppetidstjenesten ta dem.

## Hva hvert punkt sjekker

| Punkt | OK | ADVARSEL | FEIL |
| --- | --- | --- | --- |
| Docker | `sudo docker` virker | – | Docker kan ikke kjøres (stoppet, ikke installert, eller du har ikke sudo). Containere, helse, volum og logg sjekkes da ikke |
| Containere | `app` kjører og er `healthy`; `caddy` kjører (eller vei B uten egen Caddy) | `app` starter (helsesjekken er ikke ferdig), eller har startet på nytt 5 ganger eller mer | `app` finnes ikke, er stoppet eller `unhealthy`; Caddy er stoppet eller mangler i vei A |
| `/healthz` lokalt | 200 og synk-databasen svarer | 429 (for mange kall akkurat nå) | 503 (databasen svarer ikke), ingen svar, eller uventet svar |
| Disk (datavolumet og kopimappen) | under 80 % brukt og minst 2 GB ledig | 80 % eller mer, eller under 2 GB ledig | 90 % eller mer, eller under 500 MB ledig |
| Minne, hele serveren | minst 15 % tilgjengelig | under 15 % | under 5 % |
| Minne, appen | under 75 % av `mem_limit` | 75 % eller mer | 90 % eller mer |
| Sikkerhetskopi (synk og tilbud) | nyeste krypterte fil er under 36 timer gammel | 36 timer eller mer; tilbudskopi mangler (greit hvis tilbudslagring er av) | 96 timer (4 døgn) eller mer; ingen kopi av synk-databasen; tom fil; mappen finnes ikke |
| Databaser | synk- og tilbudsdatabasen finnes; til sammen under 800 MB; journalfilen under 100 MB | til sammen 800 MB eller mer (minnegrensen for sikkerhetskopien trenger kanskje økes, `hosting.md`); uvanlig stor journalfil | synk-databasen finnes ikke i volumet (feil eller tomt volum) |
| Tilbud fra Tjek | siste vellykkede henting under 14 timer siden (normalt hver 6. time) | 14 timer eller mer, 3 mislykkede på rad, ingen vellykket henting noensinne, eller henting er slått av | 48 timer eller mer |
| Feil i appens logg (24 t) | færre enn 5 feillinjer (`serverfeil`, `synk-feil`, `eksport-feil`, `helsesjekk`, `statisk fil`) | 5 eller flere | 100 eller flere. Bare antallet vises, aldri teksten |
| TLS-sertifikat | gyldig, betrodd og over 21 dager igjen | under 21 dager igjen (Caddy fornyer vanligvis 30 dager før); kunne ikke koble til | under 7 dager igjen, utløpt, eller nettlesere vil ikke stole på det |
| Nettadressen (`https://husvett.no/healthz`) | svarer 200 | ingen forbindelse (kan skyldes at serveren ikke når seg selv), 429 | svarer en annen kode |

Fra `/healthz` kommer tallene `dbOk`, `offersFetch`, `offersLastRunAgeMinutes`, `offersFailures`, `offersDbOk` og `uptimeMinutes` (`server/health.ts`). Det er **bare tall og ja/nei**, aldri antall husstander eller annen persondata (`docs/sikkerhet.md`, S23). Kopier utenfor serveren kan ikke sjekkes herfra; rapporten minner om det.

## Kjøre den hver dag (systemd-timer)

Ikke prøvd på den ekte serveren (bare `systemd-analyze verify` av filene i sandkassen). Som i `installasjon-ubuntu.md`, avsnitt 9.2, i root-skallet (`sudo -i`). Tre filer i `/etc/systemd/system/`.

`husvett-driftstatus.service`:

```ini
[Unit]
Description=Husvett: driftsstatus (bare lesing, driftstatus.sh)
Requires=docker.service
After=docker.service
OnFailure=husvett-driftstatus-feil.service

[Service]
Type=oneshot
WorkingDirectory=/srv/husvett/middagsplanlegger/docs/drift
ExecStart=/srv/husvett/middagsplanlegger/docs/drift/driftstatus.sh --journal
# Utgangskode 1 (ADVARSEL) er ikke en feil for systemd; den står i journalen med advarselsprioritet. Kode 2 (FEIL) er en feil.
SuccessExitStatus=1
```

`husvett-driftstatus-feil.service` (kjøres bare når rapporten gir FEIL, og skriver én linje med prioritet «crit» til journalen):

```ini
[Unit]
Description=Husvett: driftsstatus ga FEIL (skriver en linje med prioritet «crit» til journalen)

[Service]
Type=oneshot
ExecStart=/usr/bin/systemd-cat -t husvett-driftstatus -p crit /bin/echo "FEIL i driftsstatus. Les: journalctl -u husvett-driftstatus -n 40 --no-pager"
```

`husvett-driftstatus.timer` (07:30 i serverens tidssone, etter nattens sikkerhetskopi kl. 03:17):

```ini
[Unit]
Description=Husvett: daglig driftsstatus

[Timer]
OnCalendar=*-*-* 07:30:00
RandomizedDelaySec=5min
Persistent=true

[Install]
WantedBy=timers.target
```

Slå på og prøv:

```sh
systemctl daemon-reload
systemctl start husvett-driftstatus.service        # én kjøring nå, som prøve
journalctl -u husvett-driftstatus -n 40 --no-pager # rapporten
systemctl enable --now husvett-driftstatus.timer
systemctl list-timers husvett-driftstatus.timer --no-pager
```

Se bare det som ikke er OK (advarsler og feil, siste to døgn): `journalctl -u husvett-driftstatus -p warning --since "2 days ago" --no-pager`. Linjer med FEIL har prioritet `err`; én ekstra linje med `crit` kommer fra `-feil`-tjenesten (`journalctl -t husvett-driftstatus -p crit`).

**Merk:** tjenesten kjører som root (den bruker `docker`) og leser skriptet fra mappen `/srv/husvett/middagsplanlegger/docs/drift`. Den som kan skrive i den mappen, kan derfor få root-rettigheter. Mappen er allerede brukerens egen Docker-mappe (Docker gir i praksis root-tilgang), så det gir ingen ny risiko på denne serveren, men hold skriptet og mappen skrivbare bare for dem som allerede har root eller `sudo`.

Journalen inneholder bare rapporten (tall og faste tekster). Den har ingen persondata, så den trenger ingen egen slettefrist; journaldens vanlige størrelsesgrense gjelder (`journalctl --disk-usage`).

## Ekstern oppetidsovervåking (ikke prøvd)

**Ikke valgt, ikke satt opp og ikke prøvd.** Her står bare hvilke typer tjenester som finnes og hva som kreves. Priser, gratisgrenser og vilkår er ikke kontrollert og endres; sjekk dem hos tjenesten du vurderer. Mange tilbyr et gratis nivå med e-postvarsel, men det er ikke bekreftet for noen konkret tjeneste.

| Type | Hva den gjør | Hva som kreves | Bruk til |
| --- | --- | --- | --- |
| HTTP(S)-sjekk med nøkkelord | Henter en adresse hvert 1.–5. minutt og varsler når den svarer feil eller mangler en tekst | Adressen `https://husvett.no/healthz`; forventet svarkode `200`; nøkkelord `"status":"ok"`; en e-postadresse (eller SMS/push) for varsel | **Det viktigste punktet:** siden er nede, Caddy er nede, serveren er av, DNS er feil |
| Sertifikatvarsel | Varsler når TLS-sertifikatet nærmer seg utløp (følger ofte med HTTP-sjekken) | Samme adresse | Nummer to når Caddy ikke får fornyet |
| «Heartbeat» (jeg lever-kall) | Varsler når et ventet kall *uteblir* | Serveren må sende et kall til en hemmelig adresse hos tjenesten (ikke bygget inn i skriptet) | Hvis du vil bli varslet også når serveren eller den daglige rapporten selv er død |

Krav for å holde reglene i `CLAUDE.md` (regel 7) og `docs/sikkerhet.md`:

- Bare `GET /healthz`. **Ikke** gi tjenesten token, invitasjonskode, innloggingsopplysninger eller andre adresser (`/api/...`).
- Ikke legg noe i adressen eller i egne hoder. `/healthz` er åpen og har bare `status`, `dbOk` og tall.
- Grensen er 60 kall per minutt per IP. En sjekk hvert minutt, også fra flere steder (hver IP telles for seg), ligger langt under.
- **Test varselet** når det er satt opp: endre nøkkelordet midlertidig til noe feil (f.eks. `"status":"nei"`), vent på e-posten, og sett det tilbake. Ikke stopp produksjonsserveren for å prøve.
- Tjenesten lagrer eierens kontakt-e-post og adressen, ingen brukerdata. Legg tjenesten inn i behandlingsoversikten hvis fagpersonen mener det trengs (pilot-sjekklisten, B-punktene).
- Sjekken fanger ikke disk, sikkerhetskopier eller Tjek-henting. Det gjør `driftstatus.sh`.

## Hva eieren gjør ved ADVARSEL eller FEIL

Regelen først: **ved tvil, ikke gjør noe, og send utvikleren rapporten** (den kan limes inn trygt). **Ikke slett volumer, ikke kjør `docker system prune` eller `docker compose down -v`, ikke start Docker eller serveren på nytt uten å si fra til Plattform-prosjektet** (det starter også deres containere). Kommandoene kjøres fra `docs/drift`.

| Symptom (linje i rapporten) | Sjekk | Gjør | Kontakt utvikler |
| --- | --- | --- | --- |
| **Docker** FEIL | `sudo docker ps` | Står Docker stoppet etter en oppdatering: si fra til Plattform-prosjektet. Start ikke Docker selv | Hvis den ikke er oppe etter en time, eller `sudo` ikke virker |
| **Containere**: `app` ADVARSEL «starter» | Vent to minutter, kjør rapporten på nytt | Ingenting | Hvis den fortsatt ikke er `healthy` |
| **Containere**: `app` FEIL (stoppet / unhealthy) | `docker compose --env-file .env.drift logs app --tail 50` | Én gang: `docker compose --env-file .env.drift restart app`, vent to minutter, kjør rapporten | Hvis den ikke blir `healthy`, eller loggen sier «opprettet tom» (feil volum: slett ingenting) |
| **Containere**: omstarter ≥ 5 | Samme logg | Ingenting | Ja, i løpet av en dag |
| **Containere**: Caddy FEIL | `docker compose --env-file .env.drift logs caddy --tail 50` | Én gang: `docker compose --env-file .env.drift restart caddy` | Hvis den ikke starter (`address already in use`: noe annet bruker port 80/443) |
| **/healthz** FEIL (503, ingen svar) | Loggen over | Ingenting mer enn omstarten over | **Ja, med en gang** (databasen svarer ikke) |
| **Disk** ADVARSEL | `df -h /` og `docker system df` | Ingenting selv. Se at kopimappen ikke vokser unormalt; eldre kopier slettes av `backup.sh` etter 30 dager | Ja, i løpet av noen dager, før noe ryddes |
| **Disk** FEIL | Samme | Ikke slett noe. Si fra til Plattform-prosjektet (delt disk) | **Ja, samme dag** |
| **Minne** (serveren) ADVARSEL/FEIL | `free -m` | Si fra til Plattform-prosjektet; delt maskin | Hvis det er Husvetts app som bruker mest (`docker stats --no-stream`) |
| **Minne** (appen) | `docker stats --no-stream` | Ingenting | Ja (grensen `mem_limit` kan trenge økes) |
| **Sikkerhetskopi** ADVARSEL (over 36 t) | `journalctl -u husvett-backup --since yesterday --no-pager` | Les feilmeldingen. Er det en enkelt feil (f.eks. appen sto stoppet): `systemctl start husvett-backup.service` og kjør rapporten | Hvis meldingen er «Fant ikke … databasen» (feil volum), eller kopien feiler to dager på rad |
| **Sikkerhetskopi** FEIL (flere døgn, ingen fil, tom fil) | Samme, og `ls -lt /srv/husvett/backup \| head` | Ikke slett eldre kopier. Prøv `systemctl start husvett-backup.service` én gang | **Ja, samme dag.** Uten kopi er husstandene ubeskyttet |
| **Databaser** ADVARSEL | – | Ingenting | Ja, i løpet av noen dager (nær 1 GB: `mem_limit` og kopiering må ses på) |
| **Databaser** FEIL (synk-databasen finnes ikke) | `docker inspect -f '{{range .Mounts}}{{.Name}} {{end}}'` for app-containeren, og `grep DATA_VOLUME .env.drift` | **Stopp appen** (`docker compose --env-file .env.drift stop app`) og slett ingenting | **Ja, med en gang.** Feil volum gir en tom database; de gamle dataene ligger i det volumet som var i bruk før |
| **Tilbud fra Tjek** ADVARSEL | `docker compose --env-file .env.drift logs app --tail 100 \| grep tilbud` (bare feilnavn) | Ingenting. Synk og planlegging virker; bare nye tilbud mangler | Hvis det varer mer enn et par døgn (FEIL), eller henting er slått av uten at du har gjort det |
| **Feil i appens logg** ADVARSEL/FEIL | `docker compose --env-file .env.drift logs app --since 24h \| grep -E '^(serverfeil\|synk-feil\|eksport-feil)'` | Ingenting | Ja ved FEIL, og ved ADVARSEL som kommer igjen flere dager |
| **TLS-sertifikat** ADVARSEL (under 21 dager) | `docker compose --env-file .env.drift logs caddy --tail 100` (DNS-feil, port 80 stengt) | Rett DNS/brannmur hvis loggen sier det. **Slett aldri volumet `caddy-data`.** Vei B: `certbot renew --dry-run` | Ja, i løpet av noen dager |
| **TLS-sertifikat** FEIL (utløpt, ikke betrodd) | Åpne `https://husvett.no` fra mobilnett | Samme | **Ja, med en gang.** Brukerne ser sikkerhetsfeil |
| **TLS** / **Nettadressen**: «kunne ikke koble til», ingen forbindelse | Åpne `https://husvett.no/healthz` fra mobilnett (ikke wifi hjemme/på serveren) | Svarer den der, er alarmen falsk (serveren når ikke seg selv): sett `HUSVETT_SKIP_EXTERNAL=1` og bruk oppetidstjenesten. Svarer den ikke: se Caddy og DNS | Hvis den ikke svarer utenfra |
| **Nettadressen** svarer ikke-200 (FEIL) | Som over, og loggen til Caddy | Én omstart av `caddy` (se over) | Ja, samme dag |
| Alt ser rart ut, eller du mistenker innbrudd | – | Ikke rør noe. Følg rutinen i `docs/personvern/05-innsyn-retting-sletting.md`, avsnitt 6 (72 timer) | **Ja, med en gang** |

## Hva er prøvd, og hva er ikke prøvd

**Prøvd 2026-11-26 i sandkassen** (Linux uten Docker-demon og uten systemd som PID 1; ikke Ubuntu 26.04 og ikke hos one.com): `bash -n` og `shellcheck` uten merknader; `npm run check:driftstatus` (`scripts/checks/driftstatus.mjs`, 91 sjekker): skriptet kjørt mot en **falsk `docker`** som svarer med faste verdier og kjører det virkelige lese-programmet mot (a) den **ekte, bygde serveren** (`dist-server/index.mjs`, `TJEK_FETCH=0`) og (b) en falsk `/healthz`; falske sikkerhetskopier med satt alder; selvsignerte sertifikater (90, 15 og 5 dager) bak en lokal HTTPS-server. Dekket: nivå per punkt og terskel, utgangskode 0/1/2, `--journal`-merkene, at Docker ikke kan kjøres, at skriptet ikke endrer noen fil, og at utskriften ikke har hemmeligheter fra `.env.drift`, IP-adresser, tekst fra `/healthz` eller fra loggen. `systemd-analyze verify` av de tre enhetsfilene uten merknad (filene og stiene laget midlertidig). Selve `/healthz`-tallene: `server/health.test.ts`, `server/sync/api.test.ts`, `server/sync/security.test.ts`, `npm run smoke:server`.

**Ikke prøvd:**

- **Mot ekte Docker:** formatet på `docker compose ps`, `docker inspect`, `docker stats` og `docker logs` er antatt fra Docker 29 / Compose 5 og testet bare mot den falske `docker`. `docker exec` av lese-programmet i det skrivebeskyttede imaget er ikke kjørt (`node` og `fetch` finnes der, og `/healthz` er prøvd i et kjørende image tidligere, men ikke dette programmet).
- **Mot den ekte serveren hos one.com:** `sudo`-oppførsel for `husvett-drift`, prosjektnavnet (`husvett` ifølge installasjonen, `0B`), hvilket volum som brukes, `BACKUP_DIR`, og at serveren når seg selv utenfra (NAT).
- **systemd på ekte:** at timeren går, `SuccessExitStatus`, `OnFailure=` og prioritetsmerkene (`<4>`/`<3>`) i journalen. Bare `systemd-analyze verify` er kjørt.
- **Sertifikatet for `husvett.no`:** TLS-punktet er prøvd med selvsignerte sertifikater i stedet for Let's Encrypt (og med `-verify_hostname`), ikke utløpt sertifikat (bare 5 dager igjen) og ikke Caddy-fornyelse.
- **Ekstern oppetidstjeneste:** ingen er valgt eller prøvd.
- **Terskler** (36 t, 80/90 % disk, 14/48 timer Tjek, 5/100 feillinjer, osv.) er forslag uten erfaring fra drift. Juster etter noen uker (miljøvariablene øverst i skriptet).
- Journalens oppførsel over tid og med mange kjøringer.

## Åpne spørsmål (til eieren)

1. Hvilken oppetidstjeneste vil du bruke, og hvilken e-postadresse skal få varselet (pilot-sjekkliste C10)?
2. Skal du bli varslet på e-post også for disk, sikkerhetskopi og Tjek? Det er ikke bygget (serveren har ingen e-post). Alternativ: en «heartbeat»-tjeneste, eller at utvikleren legger inn et enkelt e-postvarsel når dere har valgt leverandør.
3. Når det er prøvd på den ekte serveren: hvem leser rapporten, og hvor ofte i pilotperioden (forslag: du hver mandag, og alltid etter en omstart eller oppdatering)?
