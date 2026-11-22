# Sikkerhetsgjennomgang: synk-server og klient

**Status:** gjennomgang 2026-11-22 av koden på `claude/middagsplanner-app-wwuq1p` (utgangspunkt `3d0b57d`), med rettelser i samme branch. Gjennomgangen er gjort av en utvikler-agent, ikke en ekstern revisor. Den erstatter ikke en uavhengig test før bred lansering.

Omfang: `server/` (HTTP-lag, synk-API, lagring), `src/sync/` (klient), `src/main.tsx`, `public/sw.js`, `Dockerfile`, avhengigheter. Ikke omfattet: planmotoren, Tjek-integrasjonen utover feilhåndtering, hosting (finnes ikke ennå).

Alvorlighet: **Kritisk** (en anonym angriper kan ta ned tjenesten eller få tilgang til data), **Høy**, **Middels**, **Lav**, **Info**.

## Kort fortalt

- **Én kritisk feil er rettet:** én HTTP-forespørsel med ugyldig URL (f.eks. `GET http://[/x`) krasjet hele serverprosessen.
- **Rettet:** streng Content-Security-Policy med Trusted Types og øvrige sikkerhetshoder; kvoter per husstand og samlet; tidspunkt fram i tid klippes; glidende utløp av token; anonymisering av fjernede medlemmer; ratebegrensning som ikke kan lures med `X-Forwarded-For` eller IPv6; samlet grense mot gjetting av koder; logger og feilsvar uten detaljer; tryggere statisk filtjener.
- **Gjenstår og må avgjøres:** godkjenning av nye medlemmer (i dag kan alle medlemmer invitere, og koden gir medlemskap direkte), tokenrotasjon/HttpOnly-cookie, streng feltliste for hendelser, ratebegrensning ved flere prosesser. Oppbevaringstid for hele husstanden er bygget (`SYNC_RETENTION_DAYS`); eksport (`GET /api/household/export`) er autentisert, avgrenset til husstanden, ratebegrenset (10/t per enhet) og logges ikke.
- **Må på plass før ekte familier:** TLS med HSTS, kryptert sikkerhetskopi med prøvd gjenoppretting, varig volum, overvåking av disk og feilrate, logg uten IP lenger enn nødvendig, fast Node-versjon i imaget. Se siste avsnitt.
- Testes av `server/sync/security.test.ts` (28 tester) og `npm run check:csp` (Playwright).

## Funn

| # | Alvorlighet | Funn | Status |
| --- | --- | --- | --- |
| S1 | Kritisk | Ugyldig URL krasjer serveren | Rettet |
| S2 | Høy | Token i localStorage uten CSP: XSS gir full tilgang | Rettet delvis (CSP + Trusted Types); lagring uendret |
| S3 | Høy | `X-Forwarded-For` lest fra venstre: ratebegrensningen kan omgås bak en proxy som legger til | Rettet |
| S4 | Middels | Ingen kvoter: et medlem eller stjålet token kan fylle disken; mange husstander likeså | Rettet |
| S5 | Middels | Tidspunkt fram i tid ligger sist i loggen for alltid | Rettet (klippes) |
| S6 | Middels | Invitasjonskode gir medlemskap uten godkjenning; alle medlemmer kan invitere | Delvis: bare eieren inviterer (`403 bare_eier`), samlet gjettegrense, kvote på koder; «eier godkjenner nye medlemmer» er en senere beslutning |
| S7 | Middels | Token utløper aldri | Rettet (glidende utløp, standard 730 dager etter eierens valg 2026-11-22); rotasjon ikke bygget |
| S8 | Lav | Fjernede medlemmer beholder etikett og «sist sett» | Rettet (anonymiseres) |
| S9 | Lav | IPv6-klient kan bytte adresse for hvert forsøk | Rettet (/64) |
| S10 | Lav | Feilmeldinger i logg og i `/api/offers` | Rettet |
| S11 | Lav | Statisk filtjener: alle metoder, `index.html` for alt, feil MIME, uhåndtert strømfeil | Rettet |
| S12 | Lav | Etiketter: retningsstyring (U+2066–2069), myk bindestrek, enslige surrogater, ikke NFC | Rettet |
| S13 | Lav | Hendelser i `beholdning`, `liste`, `endring` kan ha ekstra felt som lagres og deles | Rettet: `cleanEvent` fjerner ukjente felt før lagring og ved utlevering (testet i `server/sync/api.test.ts`) |
| S14 | Lav | En ny enhet kan ta over en fjernet enhets offentlige id | Åpen (dokumentert) |
| S15 | Lav | `by` kan være en hvilken som helst id som ikke er et annet medlem | Åpen (dokumentert) |
| S16 | Info | Ratebegrensning i minnet | Dokumentert |
| S17 | Info | `tsx`, devDependencies og eksperimentell `node:sqlite` i produksjon | Imaget har ikke lenger devDependencies (serveren er bygget til én fil); `node:sqlite` er fortsatt eksperimentell (dokumentert) |
| S18 | Info | Tidsavbrudd mot trege klienter | Rettet |
| S19 | Middels | Slettede data blir liggende i `-wal` til neste checkpoint | Rettet |
| S20 | Lav | Feil eller manglende volum gir en stille, tom database | Rettet (varsel ved oppstart) |
| S21 | Info | Ny lagring og nytt anonymt endepunkt for tilbud fra Tjek (`/api/offers/lagret`) | Bygget med grenser (2026-11-22); se under |
| S22 | Lav | Bilder fra tredjepart (Tjek) i CSP og nye anonyme endepunkter for kundeaviser (`/api/aviser`) | Bygget med grenser (2026-11-22); se under |

### S1 Kritisk: ugyldig URL krasjet hele serveren

- **Hvor:** `server/index.ts:48` og `server/sync/api.ts:247` (før rettelsen): `new URL(req.url, 'http://localhost')` utenfor `try` i en `async`-handler.
- **Reproduksjon:** `printf 'GET http://[/x HTTP/1.1\r\nHost: x\r\n\r\n' | nc vert 8787`. Node sin HTTP-parser godtar målet, `new URL` kaster, løftet avvises uten håndtering, og Node 22 avslutter prosessen (`unhandledRejection`). Bekreftet mot ekte server: neste forespørsel fikk ikke svar. Én pakke fra hvem som helst = tjenesten nede til den startes på nytt (Docker starter den igjen, men angrepet kan gjentas hvert sekund).
- **Rettet:** HTTP-laget er flyttet til `server/app.ts`. URL tolkes i `try` og gir `400`; hele handleren er pakket i `try/catch` som gir `500` uten detaljer. Lesefeil på statiske filer håndteres (uhåndtert `error` på strømmen krasjet også prosessen). Test: «en ugyldig URL i forespørselen krasjer ikke serveren».

### S2 Høy: token i localStorage og ingen CSP

- **Hvor:** `src/store.ts:104` lagrer hele `AppState` (med `sync.token`) i localStorage; serveren sendte ingen CSP.
- **Risiko:** XSS i appen (eller et ondsinnet skript i en avhengighet) kan lese tokenet og bruke det fra hvor som helst til tokenet tilbakekalles. Ingen kjent XSS i dag: React escaper all tekst, `dangerouslySetInnerHTML`/`innerHTML` brukes ikke, ingen dynamiske `href`/`src`, ingen tredjepartsskript.
- **Rettet:** streng CSP på alle sider (`server/app.ts`, `APP_CSP`):
  `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types sw`.
  Ingen `unsafe-inline` eller `unsafe-eval`: Vite-bygget har ingen inline-skript, og React setter `style` via CSSOM, som CSP ikke stopper. Trusted Types hindrer at strenger blir HTML eller skript-URL (DOM-XSS) i Chromium-baserte nettlesere; den eneste skript-URL-en appen lager er service workeren, via policyen `sw` i `src/main.tsx` som bare godtar `/sw.js`. API-svar får `default-src 'none'`. I tillegg: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy` (kamera, mikrofon, posisjon, betaling m.m. av), `Cross-Origin-Opener-Policy` og `Cross-Origin-Resource-Policy: same-origin`. `Strict-Transport-Security` med `HSTS=1` (bare når appen alltid nås over HTTPS).
- **Testet:** `npm run check:csp` starter den ekte serveren, åpner alle faner, oppretter en husstand, registrerer service workeren og laster på nytt: ingen CSP-brudd og ingen konsollfeil. Sjekken fant ett brudd underveis (service worker-registreringen under Trusted Types), som er rettet. `npm run check:pwa` er fortsatt grønn.
- **Gjenstår (må avgjøres):** tokenet ligger fortsatt i localStorage. Alternativet er en `HttpOnly; Secure; SameSite=Strict`-cookie, som JavaScript ikke kan lese. Det krever CSRF-vern (Origin-sjekk) og endrer protokollen for alle klienter; gevinsten er at XSS bare kan bruke tokenet mens siden er åpen, ikke stjele det. Med streng CSP og Trusted Types vurderer jeg dette som akseptabelt for piloten, men det bør gjøres før bred lansering eller kontoer (se docs/synk.md, «Ekte kontoer senere»). Se også S7 om rotasjon.

### S3 Høy: ratebegrensning kunne omgås med `X-Forwarded-For`

- **Hvor:** `server/sync/api.ts:75` (før): med `TRUST_PROXY=1` ble **første** adresse i `X-Forwarded-For` brukt. En proxy som legger til i hodet (nginx `$proxy_add_x_forwarded_for`, mange lastbalanserere) beholder klientens egen verdi først. Angriperen setter da en ny falsk adresse per forsøk og omgår alle grenser per IP, også 20 forsøk på å bli med per 10 min.
- **Rettet:** **siste** adresse brukes (den proxyen selv har lagt til). `TRUST_PROXY=1` forutsetter nøyaktig én proxy foran serveren; med flere ledd (f.eks. CDN + Caddy) må koden telle fra høyre. Test: «per IP teller siste adresse i X-Forwarded-For».

### S4 Middels: ingen kvoter

- **Hvor:** `server/sync/api.ts:175` (invitasjoner), `:143` (bli med), `:216` (hendelser). Et medlem (eller et stjålet token) kunne lagre ubegrenset: 240 kall/min × 500 hendelser × 4 KB ≈ 0,5 GB i minuttet. Og 20 nye husstander per time per IP gir like mange nye kvoter.
- **Rettet:** kvoter per husstand i lagringen, sjekket i samme transaksjon som skrivingen (`server/storage/sqlite.ts`, `DEFAULT_QUOTAS` i `server/sync/api.ts`):

  | Kvote | Standard | Når den nås |
  | --- | --- | --- |
  | Aktive medlemmer | 12 | `403 kvote_full` ved «bli med»; koden brukes ikke opp |
  | Medlemsrader totalt (også fjernede) | 50 | som over |
  | Aktive invitasjoner | 5 | `403 kvote_full` |
  | Hendelser | 100 000 | `403 kvote_full` for hele kallet; ingenting lagres |
  | Byte hendelser (UTF-8) | 64 MB | som over |
  | Byte hendelser, alle husstander samlet | 4 GB (`SYNC_MAX_TOTAL_MB`) | som over, for alle |
  | Nye husstander, alle IP-er | 200 per time | `429` |

  Hendelser som allerede er lagret, teller ikke på nytt, så en enhet kan alltid sende utboksen på nytt. Når hendelser avvises med `kvote_full`, blir de liggende i enhetens utboks (ingen tap). Ved invitasjon og innmelding viser Husstand-skjermen teksten fra `ERROR_TEXT.kvote_full`; ved synk av hendelser viser appen i dag bare «Synker …», fordi `useSync` sin `lastError` ikke vises noe sted (bør vises, UI). Tellerne (`households.event_count`, `event_bytes`) legges til og fylles automatisk i eldre databaser. En familie bruker anslagsvis noen tusen hendelser og noen få MB i året (planversjoner er størst, opptil 48 KB).
- **Avveining:** det samlede taket gjør at en angriper som fyller det, stopper lagring for alle husstander (i stedet for full disk og ødelagt database). Overvåking av databasestørrelse må varsle lenge før taket. En oppbevaringstid (eldre uker slettes) mangler fortsatt (docs/synk.md).

### S5 Middels: klientens klokke

- **Hvor:** `server/sync/api.ts:212` (før) sjekket bare formatet på `at` (`src/sync/protocol.ts:41`), så `2026-02-31` og `2099-01-01` ble godtatt.
- **Hva en enhet kunne gjøre:** tilstanden avledes av loggen sortert på (`at`, id) (`src/engine/inventory.ts`). En hendelse med tid langt fram (feil klokke eller med vilje) ligger sist for alltid: en `telling` overstyrer alle senere tellinger, og et valg i «utsolgt / fant ikke» vinner over alle senere valg, til tiden er passert. Tilbakedatering er mindre farlig (hendelsen blir overstyrt av senere) og nødvendig: frakoblede enheter sender gamle hendelser, og migrerte data har tid 1970.
- **Rettet:** ugyldige datoer avvises (`ugyldig_hendelse`). `at` mer enn 10 minutter fram i tid settes til serverens mottakstid før lagring. Tilbakedatering er fortsatt lov. Idempotens holder: samme id lagres én gang (første versjon gjelder).
- **Avveining:** enheten som sendte hendelsen, har den opprinnelige tiden i sin egen logg (klienten bytter ikke ut en hendelse den allerede har), så rekkefølgen kan avvike på akkurat den enheten for akkurat de hendelsene, til klokka er rettet. Alle andre enheter ser samme rekkefølge. Alternativet, å avvise hendelsen, ville gjort at de andre aldri så den (f.eks. et kjøp). Server-sekvens som eneste rekkefølge ville brutt modellen for frakoblede enheter. Et ondsinnet medlem kan fortsatt tilbakedatere, men kan uansett angre og endre alt (alle voksne kan alt, docs/synk.md).

### S6 Middels: invitasjon uten godkjenning

- **I dag:** alle medlemmer (ikke bare eieren) kan lage koder. Den som har en gyldig kode innen 24 timer blir medlem med full lese- og skrivetilgang, uten at noen bekrefter, og får hele historikken.
- **Gjetting:** koden er 10 tegn fra 32 (50 bit, ca. 1,1 · 10¹⁵ muligheter), HMAC-lagret, engangs, 24 t. Grenser: 20 forsøk per IP (IPv6 per /64) per 10 min, og nå også **1 000 feilede forsøk per 10 min samlet** for hele tjenesten (`joinFailGlobalPer10Min`). Med høyst 5 aktive koder per husstand og 1 000 husstander (5 000 koder, verste tilfelle) er sjansen for ett treff ca. 144 000 × 5 000 / 1,1 · 10¹⁵ ≈ 6 · 10⁻⁷ per døgn (ca. 2 · 10⁻⁴ per år). Uten samlet grense kunne et botnett med 10 000 adresser fått ca. 5 % sjanse per år. Avveining: en angriper med mange adresser kan bruke opp den samlede grensen og hindre ekte innmelding i 10 minutter av gangen (gir `429`, ingen data på spill).
- **Gjenstår (må avgjøres):** «Eier godkjenner nye medlemmer» er ikke bygget: det krever en ventende medlemsstatus på serveren og UI for eieren (Husstand-skjermen) og for den som venter. Enklere mellomsteg som kan bygges raskt: bare eieren kan lage invitasjoner, og alle medlemmer får varsel om nye medlemmer. Anbefaling før piloten: ett av dem.

### S7 Middels: token utløp og rotasjon

- **Rettet:** glidende utløp. Et token som ikke er brukt på `SYNC_TOKEN_IDLE_DAYS` dager (standard 730 etter eierens valg 2026-11-22; `0` = aldri; ugyldig verdi gir 730), slutter å virke; enheten forlater husstanden (eierskap går videre, siste som går sletter husstanden) og beholder dataene lokalt (klienten får `401` og kobler fra med melding). Hver bruk forlenger. Sjekkes når tokenet brukes. Husstander ingen bruker, fjernes av oppbevaringsjobben (`server/retention.ts`, `SYNC_RETENTION_DAYS`, standard 730 dager; docs/synk.md). Begge tar høyst 36 500 dager; større tall gir standard med advarsel (før: 500 på alle kall eller en oppbevaringsjobb som feilet; kodegjennomgang runde 2, S10).
- **Ikke bygget:** en rute for å rotere token. Rotasjon gir lite her: et token stjålet ved XSS kan roteres av angriperen først, og et brutt svar under rotasjon låser en ekte enhet ute uten en overgangsperiode med to gyldige token (krever ny kolonne og klientlogikk i `src/sync/`). Tap av en enhet håndteres ved at eieren fjerner den. Vurder rotasjon sammen med HttpOnly-cookie (S2).

### S8 Lav: fjernede medlemmer

- **Hvor:** `server/storage/sqlite.ts:127,136` (før) beholdt etikett (kan være et navn som «Mamma») og «sist sett» for fjernede og forlatte enheter, og synk-svaret viste dem til alle medlemmer.
- **Rettet:** ved fjerning, forlating og utløp settes etiketten til «Tidligere medlem» og «sist sett» fjernes. Raden og den offentlige id-en beholdes (så id-en ikke kan tas av en annen og gamle avkrysninger kan vises). Hendelsene deres blir i husstanden til den slettes (husstandens data; må dekkes av oppbevaringstiden).

### S9 Lav: IPv6

Én kunde har normalt et helt /64-nett og kunne bytte adresse for hvert forsøk. Nå grupperes IPv6 på /64 (`ipKey` i `server/sync/rateLimit.ts`); IPv4 i IPv6-form (`::ffff:`) behandles som IPv4.

### S10 Lav: logger og feilsvar

- **Hvor:** `server/sync/api.ts:258` logget `e.message` (kan inneholde verdier fra forespørselen). `server/index.ts:39,53` sendte Tjek-feilen (statuskode og sti) til alle som spør `/api/offers`, og nytt forsøk mot Tjek ble startet ved hvert kall etter en feil.
- **Rettet:** synk-API og HTTP-lag logger bare navnet på feilen (`synk-feil: Error`), aldri URL, hoder, kropp, token, kode eller etikett. Feilsvar er alltid `{error, message}` med fast norsk tekst, aldri stack. `/api/offers` svarer «Tilbud er ikke tilgjengelige akkurat nå» og venter 5 minutter etter en feil før nytt oppslag mot Tjek. Oppstartslinjen og varselet om manglende `SYNC_SECRET` inneholder ingen data. Test: «serverfeil gir 500 uten detaljer, og loggen får ikke …».
- **Merk:** en proxy foran (Caddy) logger IP-adresser og stier. Invitasjonskoden ligger i fragmentet (`#bli-med=`) og sendes aldri til serveren; tokenet ligger i `Authorization`-hodet, som proxyer normalt ikke logger. Sjekk proxyens loggformat.

### S11 Lav: statisk filtjener

- **Hvor:** `server/index.ts:59–64` (før).
- **Path traversal:** ikke sårbar i praksis: WHATWG `URL` fjerner `..` og `%2e%2e`, gjør `\` om til `/` og lar `%2f` stå kodet. Nå i tillegg: stien løses mot `dist/` og må ligge under den, segmenter som starter med punktum (`.env`) avvises, og `%`, `\` og NUL gir aldri fil. Testet med 16 varianter over rå socket (fetch normaliserer selv).
- **Rettet ellers:** bare `GET`/`HEAD` (ellers `405` med `Allow`); ukjente `/api/*` gir `404` JSON i stedet for appens forside; manglende fil med filendelse gir `404` (før: `index.html` som `text/html`); riktige MIME-typer for ikoner (før `application/octet-stream`); `Cache-Control: immutable` for `/assets/*`, `no-cache` for resten.

### S12 Lav: etiketter

`cleanLabel` (`src/sync/protocol.ts:138`) fjernet kontrolltegn, nullbredde og retningsoverstyring, men ikke retningsisolering (U+2066–2069, kan snu teksten rundt etiketten i UI), myk bindestrek, U+2060–206F eller enslige surrogater, og kortet ned midt i et emoji. Nå: NFC, disse tegnene fjernes, mellomrom slås sammen, og kortingen skjer per kodepunkt. React viser etiketten som tekst, så HTML i en etikett gjør ingen skade.

### S13 Lav: ekstra felt i hendelser

`checkEnvelope` sjekker kjente felt i `beholdning`, `liste` og `endring`, men avviser ikke ukjente felt; de lagres og sendes til de andre enhetene (innenfor 4 KB). Et medlem kan dermed legge vilkårlig tekst (f.eks. et navn) i en hendelse. `planversjon` har allerede streng feltliste (`onlyKeys`). **Anbefaling:** samme for de andre strømmene, sammen med synk-økten, siden feltlistene må følge motorens typer (`src/engine/inventory.ts`, `src/sync/list.ts`, `src/engine/substitution.ts`).

### S14 Lav: overta en fjernet enhets id

En fjernet enhet som blir invitert på nytt, får tilbake raden sin (`server/storage/sqlite.ts`, `join`). Den offentlige id-en velges av klienten og er synlig for alle medlemmer, så den som har en kode kan bli med under en fjernet enhets id og arve dens tidligere avkrysninger og kjøp i visningen. Krever en gyldig kode (altså et medlems medvirkning). Etiketten er nå anonymisert (S8). Kan lukkes med godkjenning av nye medlemmer (S6).

### S15 Lav: `by` i hendelser

Serveren avviser `by` lik et annet (også fjernet) medlems id, men godtar andre verdier (f.eks. `migrering` eller en oppdiktet id), fordi første tilkobling sender hele den lokale loggen, også eldre hendelser. Et medlem kan dermed vise en hendelse som «tidligere data» eller «en annen enhet». Påvirker bare visning, ikke tilgang.

### S16 Info: ratebegrensning i minnet

`RateLimiter` holder tellere i prosessens minne. Det virker med én serverprosess (dagens oppsett). Med flere prosesser eller maskiner må tellerne flyttes til felles lagring (Redis eller databasen) eller til proxyen (Caddy `rate_limit`-modul, nginx `limit_req`). Under et distribuert angrep vokser tabellen med én rad per adresse i vinduet (ca. 100 byte per rad); proxyen bør derfor også ha en grense.

### S17 Info: produksjonsoppsett, avhengigheter og Docker

- **`npm audit`** 2026-11-22: 0 sårbarheter (161 pakker, alle avhengigheter; også `--omit=dev`). Kjøretidsavhengigheter er bare `react` og `react-dom`.
- **Docker** kjører som `node` (ikke root), og databasen ligger i `/data` med eier `node`. **Rettet 2026-11-22:** serveren bygges med esbuild til `dist-server/index.mjs`, og `Dockerfile` er flertrinns: sluttimaget har bare `node`, den bygde serveren og `dist/` (ingen `node_modules`, npm, yarn, tsx eller kildekode; 417 → 200 MB utpakket). Serveren har ingen npm-avhengigheter ved kjøring, så `npm ci --omit=dev` er ikke nødvendig i kjøretrinnet. Før dette inneholdt imaget hele `node_modules` med devDependencies. Containeren kan kjøres skrivebeskyttet med `/data` som volum, `/tmp` som tmpfs, `cap_drop: [ALL]` og `no-new-privileges` (gjort i `docs/drift/docker-compose.yml`; prøvd med det nye imaget). Basisbildet (alpine og `node`-programmet) må fortsatt oppdateres: se Node-regelen i `docs/hosting.md`. `npm audit --omit=dev` kjører i CI som steg som ikke blokkerer.
- **`node:sqlite`** er eksperimentell i Node 22 (skriver `ExperimentalWarning`). Databasen er vanlig SQLite, men API-et kan endre seg mellom Node-versjoner. **Anbefaling:** lås Node-versjonen i imaget (f.eks. `node:22.x.y-alpine` med digest), oppdater bevisst og kjør testene før oppgradering; vurder `better-sqlite3` eller PostgreSQL før bred lansering.

### S19 Middels: slettede data i WAL-filen

- **Hvor:** `server/storage/sqlite.ts`. Databasen kjører i WAL-modus med `PRAGMA secure_delete = ON`, men `secure_delete` overskriver sidene i hovedfilen først når WAL-filen skrives tilbake (checkpoint, automatisk ved ca. 1 000 sider). Til da lå slettede husstander, hendelser og etiketter i klartekst i `middag.sqlite-wal`, og en sikkerhetskopi av katalogen tok dem med.
- **Reproduksjon:** opprett husstand med en unik etikett, fjern medlemmet eller slett husstanden, søk etter etiketten i `middag.sqlite` og `middag.sqlite-wal`. Før rettelsen: funnet. Testen «etter fjerning og sletting finnes etikett og hendelser verken i databasefilen eller i -wal» feiler uten rettelsen (prøvd).
- **Rettet:** `PRAGMA wal_checkpoint(TRUNCATE)` etter sletting av husstand, fjerning, forlating og utløp av token: alt skrives tilbake (og overskrives) og WAL-filen tømmes. Er databasen opptatt av en leser, tar neste checkpoint det.
- **Gjelder ikke:** sikkerhetskopier og øyeblikksbilder tatt før slettingen. De trenger egen slettefrist (docs/synk.md, Drift).

### S20 Lav: tom database ved feil volum

Monteres volumet feil (eller ikke), lager serveren en ny, tom database uten å si fra, og familiene ser at husstanden er borte (enhetene får `401` og kobles fra, men beholder dataene lokalt). Nå skriver serveren ved oppstart om databasen var ny (`Synk-databasen fantes ikke og er opprettet tom: … Er volumet montert riktig?`), eller hvor mange husstander den har. Det logges uten innhold. Drift bør varsle på den linjen etter første oppstart.

`SYNC_SECRET`: tap eller bytte av hemmeligheten gjør bare aktive invitasjonskoder ugyldige (de er HMAC med hemmeligheten). Enhetstokenene er vanlig sha256 og virker videre; ingen data går tapt.

### S21 Info: lagring av tilbud og `GET /api/offers/lagret`

- **Hva:** tilbud og priser fra Tjek lagres i en egen SQLite-fil (`OFFER_DB`, `server/offers/`), ikke i synk-databasen (brukerens opplysning 2026-11-22: avtalen tillater lagring av priser; `phase0/tjek-avtale.md`). Ingen persondata: ingen husstand, enhet, token, etikett eller IP i tabellene (testet). Tilbudskoden importerer ikke synk-lagringen, og synk-koden kjenner ikke tilbudene (testet i `src/acceptance/regler.test.ts`).
- **Endepunkt:** anonymt (tilbud er ikke husstandsdata), bare `GET`/`HEAD` (`405` med `Allow` ellers), ingen spørreparametre (`400`), **60 kall per minutt per IP** (`429 for_mange_forespørsler` med `Retry-After`; IPv6 per /64, `TRUST_PROXY` som synk-API-et), høyst **1500 tilbud** per svar (`truncated`), `Cache-Control: no-store`, API-CSP (`default-src 'none'`). Svaret bygges én gang per (dag, siste henting) og gjenbrukes, så mange kall gir ikke mange spørringer. Lagringsfeil gir `500 serverfeil` med fast tekst; loggen får bare feilens navn (testet i `server/offers/api.test.ts`).
- **Oppbevaring** kjører også når hentingen feiler eller er av (`TJEK_FETCH=0`), så lagrede priser ikke blir liggende (kodegjennomgang runde 2, O12). `OFFER_REFRESH_HOURS` over 168 gir standard: et intervall over det `setTimeout` tåler ble 1 ms og ga runde etter runde til budsjettet var brukt opp (O13).
- **Lagringsgrenser:** id høyst 100 tegn (ellers avvist), overskrift 200, beskrivelse 500, forhandler 100 (kortes ned), pris i hele øre ≥ 0, mengder endelige og positive, gyldighet som dato; høyst 5000 per runde og **200 000 rader totalt** (nye avvises over taket; eksisterende oppdateres). Oppbevaring sletter utløpte rader som ikke er sett på `OFFER_RETENTION_DAYS` dager.
- **Mot Tjek:** kallbudsjett per norsk døgn (`OFFER_MAX_CALLS_PER_DAY`, standard 1000) for alle kall, bakoff ved feil (5 min doblet, høyst intervallet), tidsavbrudd 15 s per kall. Loggen får bare feilens navn, aldri sti eller statuskode fra Tjek. `TJEK_FETCH=0` slår av alle kall (brukt i røyktest, e2e og CSP-sjekk, så de ikke kaller eksterne tjenester).
- **Sikkerhetskopi:** `docs/drift/backup.sh` tar tilbudsfila med (egen kryptert fil, samme slettefrist; `docs/hosting.md`, avsnitt 8).
- **Gjenstår:** ratebegrensningen er i minnet (S16). Oppbevaringstiden (180 dager) beholdes til Tjek bekrefter grensen.

- **Husholdningstilbud (utvidelse C, 2026-11-22):** samme endepunkt gir også `other` (høyst 500 tilbud som klassifiseringen i `src/engine/household.ts` kjenner igjen som husholdningsvarer). Samme grenser, samme ratebegrensning, samme bildefilter (`TJEK_IMAGE_HOSTS`), ingen nye parametre. Innsamleren gjør ett ekstra søk per husholdningsvare (27 per runde) gjennom samme kallbudsjett; en feil der stopper ikke runden og logges bare med navn (testet i `server/offers/collector.test.ts` og `api.test.ts`). Husholdningsvaregruppene i innstillingsdokumentet valideres strengt (bare kjente id-er, ingen fritekst; testet i `server/sync/api.test.ts`).
### S22 Lav: bilder fra Tjek og `GET /api/aviser`

- **CSP:** `img-src 'self' data:` utvides med `https://<vert>` for hver vert i `TJEK_IMAGE_HOSTS` (`appCsp` i `server/app.ts`), og ingenting annet endres: `script-src`, `connect-src` og Trusted Types (`require-trusted-types-for 'script'; trusted-types sw`) er som før. Vertene må være eksakte vertsnavn (ingen jokertegn, skjema, port eller IP); ugyldige hoppes over, og `appCsp` kaster ved en verdi som kunne lagt til egne direktiver. Uten vertene er CSP uendret (testet i `server/offers/images.test.ts`). Et bilde kan ikke kjøre skript; risikoen er at tredjeparten ser forespørselen (IP, nettleser). `Referrer-Policy: no-referrer` og `referrerPolicy="no-referrer"` på `<img>` gjør at Tjek ikke ser hvilken side i appen bildet ble vist på.
- **Bildeadresser i svarene:** bare https til en tillatt vert, uten brukernavn eller port, høyst 500 tegn (`allowedImage`); ellers `null`. Lagret adresse i tilbudsdatabasen er tekst; vi laster aldri ned bildet.
- **Endepunkter:** `GET /api/aviser` og `GET /api/aviser/:id/sider`, anonyme, bare `GET`/`HEAD`, ingen parametre, 60 kall per minutt per IP (begge samlet), `no-store`, API-CSP. Katalog-id må være `[A-Za-z0-9_-]{1,64}` og stå i den gjeldende lista; ellers `404` uten kall til Tjek, så ingen kan bruke serveren til vilkårlige oppslag hos Tjek. Avisoppslagene har eget delbudsjett (en femdel av `OFFER_MAX_CALLS_PER_DAY`): før det fantes, kunne én IP innenfor 60 kall/min bruke opp hele dagens kallbudsjett på ca. 20 minutter ved å bla gjennom flere aviser enn hurtigbufferen holder, og innsamleren stoppet resten av døgnet (kodegjennomgang runde 2, O11). Lista og sidene holdes i minnet i 6 t (høyst 400 aviser, 200 sider per avis, 100 aviser i minnet); feil gir fast tekst, 5 minutters nedkjøling og bare feilens navn i loggen (testet i `server/offers/papers.test.ts`).
- **Prøvd i nettleser:** appen bak `createApp` med en falsk Tjek-kilde og en falsk bildevert (Playwright fanget bildeforespørslene): produktbildet i tilbudsdetaljen og to avissider lastet under CSP uten brudd eller konsollfeil. Ikke prøvd mot Tjeks ekte verter.

### S18 Rettet: trege klienter

`server.headersTimeout = 15 s`, `requestTimeout = 30 s`, `keepAliveTimeout = 5 s` (`server/index.ts`). Proxyen foran bør ha egne grenser.

## Ting som ble sjekket og er i orden

- **Token:** 32 tilfeldige byte, bare sha256 lagres, oppslag på hash. Det finnes ingen direkte sammenligning av hemmeligheter i koden, så tidsangrep på sammenligningen er ikke aktuelt: angriperen styrer inndata til sha256, ikke til databaseoppslaget, og kan ikke lære noe om hashen av svartiden. Invitasjonskoder slås opp på HMAC på samme måte.
- **401/403/404:** uten gyldig token gir alle beskyttede stier samme `401` med samme kropp, uansett om husstand, invitasjon eller medlem finnes. Med token fra en annen husstand gir fremmede id-er samme `404` som id-er som ikke finnes. Testet.
- **Tilgangsavgrensning:** alle spørringer er parametrisert og avgrenset med `household_id` fra tokenet. SQL- og JSON-injeksjon i id, etikett og tekst lagres som tekst. `__proto__`/`constructor` i kroppen gir ingen roller eller felt. Testet.
- **CORS:** serveren sender aldri `Access-Control-Allow-*`, heller ikke på preflight. Ingen cookies, så CSRF er ikke relevant så lenge tokenet ligger i `Authorization`.
- **Hodeinjeksjon:** ingen brukerdata settes i svarhoder; kodet CR/LF i stien forblir i stien, rå CR/LF avvises av Node. Testet.
- **Inndata:** ugyldig JSON, tom kropp, liste, `null`, feil `Content-Type` (`415`), for store kropper oppgitt og i biter (`413`), 100 000 nivåer nesting (`400`), feil typer, 1e300, ugyldige datoer, ukjente strømmer: alle gir 4xx, aldri 500. Testet.
- **Service worker** cacher aldri `/api/`; `connect-src 'self'` hindrer at appen sender data andre steder.

## Konfigurasjon

| Miljøvariabel | Standard | Hva |
| --- | --- | --- |
| `SYNC_TOKEN_IDLE_DAYS` | 730 | Dager uten bruk før et enhetstoken slutter å virke. `0` = aldri |
| `SYNC_MAX_TOTAL_MB` | 4096 | Tak for alle husstanders hendelser samlet |
| `HSTS` | av | `1` sender `Strict-Transport-Security` (bare når alt går over HTTPS) |
| `TRUST_PROXY` | av | `1` bak nøyaktig én proxy; siste adresse i `X-Forwarded-For` brukes |
| `OFFER_MAX_CALLS_PER_DAY` | 1000 | Kallbudsjett mot Tjek per norsk døgn (alle kall). Øvrige tilbudsinnstillinger: `docs/synk.md`, «Drift» |
| `TJEK_IMAGE_HOSTS` | tom | Eksakte bildeverter hos Tjek i CSP-ens `img-src` (S22). Tom: ingen bilder |

Kvoter og ratebegrensninger per husstand ligger i `DEFAULT_QUOTAS` og `DEFAULT_RATES` i `server/sync/api.ts`.

## Må på plass før ekte familier

1. **TLS** foran serveren (Caddy, `docs/drift/`), `TRUST_PROXY=1`, og bare proxyen når appen (Compose publiserer bare Caddy). Caddyfilen setter HSTS selv; `HSTS=1` trengs bare uten den. Øk HSTS-levetiden når domenet er prøvd.
2. **Sikkerhetskopi**, kryptert og utenfor maskinen, med slettefrist og en prøvd gjenoppretting (`docs/synk.md`, Drift).
3. **Overvåking** av databasestørrelse (varsel lenge før `SYNC_MAX_TOTAL_MB`), disk, feilrate (`500`, `429`, `kvote_full`) og oppetid, uten innhold i loggene.
4. **Proxy-logger:** kort oppbevaring av IP-adresser (forslag 14 dager, `docs/hosting.md`), og ratebegrensning i proxyen i tillegg.
5. **Beslutning om nye medlemmer** (S6): eier godkjenner, eller bare eier kan invitere.
6. **Oppbevaringstid** for hendelser og husstander ingen bruker, med en rutine som sletter.
7. **Imaget:** fast Node-versjon, uten devDependencies, kjørt skrivebeskyttet (S17; gjort). `npm audit --omit=dev` i CI (gjort, blokkerer ikke). Gjenstår: rutine for å bygge på nytt når alpine eller Node får sikkerhetsoppdateringer.
8. **`SYNC_SECRET`** satt som hemmelighet (ellers slutter koder å virke ved omstart).

## Tester

- `server/sync/security.test.ts`: path traversal (16 varianter over rå socket), skjulte filer, metoder, ugyldig URL (krasj), ugyldig JSON og kropper, feil typer, injeksjon, `__proto__`, serverfeil uten lekkasje i svar og logg, sikkerhetshoder og CSP, CORS, hodeinjeksjon, lik `401` og `404`, glidende utløp og eierskap, `X-Forwarded-For`, IPv6 /64, samlet gjettegrense, kodeentropi, alle kvoter, klokkeklipp og idempotens, anonymisering, Unicode i etiketter.
- `server/offers/api.test.ts`, `server/offers/store.test.ts`, `server/offers/collector.test.ts`: lese-endepunktet (metoder, parametre, ratebegrensning, størrelsesgrense, feil uten lekkasje), lagringens grenser og at den ikke har persondata, bakoff og kallbudsjett.
- `server/offers/images.test.ts`, `server/offers/papers.test.ts`: bildeverter i CSP og svar, kundeavis-endepunktene.
- `npm run check:csp` (Playwright, krever bygg): appen under ekte CSP uten brudd eller konsollfeil (også med `TJEK_IMAGE_HOSTS` satt).
- `server/sync/api.test.ts` og `src/sync/engine.test.ts` er utvidet etter denne gjennomgangen (S1/S2 i første kodegjennomgang og runde 2 i `docs/kodegjennomgang.md`) og er grønne.
