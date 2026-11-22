# Synk og delt husstand

Datert 2026-11-22. Beskriver det som er bygget i `server/` og `src/sync/`. Appen virker fortsatt helt uten server; da er enheten en husstand alene, som før.

## Kort fortalt

- **Offline først.** All skriving skjer lokalt (localStorage) og legges i en utboks. Synk flytter bare data mellom enheten og serveren i bakgrunnen: hvert 10. sekund når appen er synlig, rett etter en endring og når nettet kommer tilbake. Feil gir eksponentiell backoff (2 s til 5 min). Ingen WebSocket eller SSE.
- **Husstand uten passord og e-post.** En voksen oppretter husstanden på sin enhet og får et enhetstoken. Andre voksne blir med med en engangskode (eller lenke `/#bli-med=KODE`) som utløper etter 24 timer. Hver enhet har sitt eget token; serveren lagrer bare sha256 av det.
- **Ingen siste-skriving-vinner.** Beholdning og handleliste er hendelseslogger som flettes uten tap. Plan og innstillinger er versjonerte dokumenter med tre-veis fletting; samme felt endret ulikt på to enheter blir en synlig konflikt som en voksen må avgjøre.

## Arkitektur

```
 Enhet A (nettleser)                         Server (server/index.ts)                    Enhet B
 ┌────────────────────────┐                 ┌──────────────────────────────┐           ┌──────────────┐
 │ AppState (localStorage)│  POST events    │ server/sync/api.ts           │           │  samme som A │
 │  inventory + outbox    │ ──────────────▶ │  auth (Bearer, sha256)       │ ◀──────── │              │
 │  list + listOutbox     │  GET sync?after │  ratebegrensning, validering │ ────────▶ │              │
 │  slots/settings + sync │ ◀────────────── │ server/storage (SyncStorage) │           │              │
 │ src/sync/engine.ts     │  PUT docs/:navn │  SqliteStorage (node:sqlite) │           │              │
 └────────────────────────┘                 └──────────────────────────────┘           └──────────────┘
```

| Del | Fil | Ansvar |
| --- | --- | --- |
| Hendelsesmodell, beholdning | `src/engine/inventory.ts` | Uendret: idempotent logg, kjøp per linje-id, konflikt om antall som tilstand |
| Hendelsesmodell, handleliste | `src/sync/list.ts` | Avkrysning per person (observed-remove-sett), manuelle linjer |
| Dokumenter | `src/sync/docs.ts` | Plan og innstillinger: felt, tre-veis fletting, validering (delt med serveren) |
| Protokoll | `src/sync/protocol.ts` | Typer, grenser, validering av konvolutter, rensing av etiketter |
| HTTP-klient | `src/sync/api.ts` | `SyncApi`, `HttpTransport` (implementerer `EventTransport` fra `queue.ts`) |
| Synk-runde | `src/sync/engine.ts` | `syncOnce`: lever utboks → hent etter cursor og flett → send endrede dokumenter |
| React | `src/sync/useSync.ts`, `src/views/HouseholdView.tsx` | Polling, nettstatus, backoff; Husstand-skjermen |
| API | `server/sync/api.ts` | Endepunkter, autentisering, ratebegrensning, feilkoder |
| Lagring | `server/storage/types.ts`, `sqlite.ts` | `SyncStorage`-grensesnitt og SQLite-implementasjon |

Planmotoren (`src/engine/`) er uendret og kjenner ikke synk.

## Datamodell på serveren

| Tabell | Innhold | Merknad |
| --- | --- | --- |
| `households` | id, opprettet, `seq` | `seq` er husstandens løpende teller (cursor) |
| `devices` | intern id, husstand, offentlig enhets-id, etikett, rolle, `token_hash`, opprettet, sist sett, fjernet | «Sist sett» lagres med minutt-oppløsning. Fjernede enheter beholdes uten token, så den offentlige id-en ikke kan tas av en annen |
| `invites` | kode-HMAC, utløp, brukt | Brukte og utløpte ryddes når en ny lages |
| `events` | (husstand, id) primærnøkkel, `seq`, strøm, JSON | Idempotent: samme id i samme husstand lagres én gang |
| `docs` | (husstand, navn), versjon, JSON, `seq`, endret av | `plan` og `innstillinger` |

Alle tabeller har `ON DELETE CASCADE` fra `households`, og `PRAGMA secure_delete` er på, så sletting overskriver innholdet i databasefilen.

**Lagres aldri på serveren:** tilbud fra Tjek (bare i minnet i `server/index.ts`), postnummer, kostkrav og allergier (`avoid`, `avoidFoods`, `vegetarian`, mulige helseopplysninger, se `docs/personvern/06-samtykke-helsekost.md`), passord, e-post, navn, posisjon. Serveren avviser dokumenter med ukjente felt.

## API

Alle svar er JSON med `Cache-Control: no-store`. Feil har formen `{ "error": "<kode>", "message": "<norsk tekst>" }`.

| Metode og sti | Tilgang | Hva |
| --- | --- | --- |
| `POST /api/household` `{deviceId, label?}` | åpen, 20/t per IP | Ny husstand; svarer `201 {token, member}` |
| `POST /api/household/join` `{code, deviceId, label?}` | åpen, 20/10 min per IP | Bli med; koden brukes opp i samme transaksjon |
| `GET /api/household` | medlem | Aktive medlemmer og invitasjoner |
| `PATCH /api/household/me` `{label}` | medlem | Endre egen etikett (høyst 24 tegn, kontrolltegn fjernes) |
| `POST /api/household/invites` | medlem | Ny kode, 10 tegn (50 bit), utløper etter 24 t |
| `DELETE /api/household/invites/:id` | medlem | Trekk tilbake |
| `DELETE /api/household/members/:id` | eier | Tilbakekall en annen enhets token |
| `POST /api/household/leave` | medlem | Forlat. Eier som går gir eierskap til eldste; siste som går sletter husstanden |
| `DELETE /api/household` | eier | Slett husstanden og alle data |
| `POST /api/sync/events` `{events: [{stream, event}]}` | medlem | Høyst 500 per kall. Svar `{accepted, rejected:[{id, code}]}` |
| `GET /api/sync?after=<cursor>` | medlem | Hendelser og dokumentversjoner etter cursor (sider på 1000), medlemsliste |
| `PUT /api/sync/docs/:navn` `{baseVersion, body}` | medlem | Skriver hvis `baseVersion` er gjeldende; ellers `409 {error:"konflikt", current}` |

Feilkoder: `ugyldig_forespørsel` (400/415), `for_stor` (413), `ikke_autentisert` (401), `ingen_tilgang` (403), `ugyldig_kode` (403), `enhet_finnes` (409), `konflikt` (409), `ugyldig_dokument` (400), `ikke_funnet` (404), `for_mange_forespørsler` (429), `serverfeil` (500). Per hendelse: `ugyldig_hendelse`, `ukjent_strøm`, `for_stor`, `feil_identitet` (hendelsen utgir seg for et annet medlem).

## Konfliktmodell

| Data | Modell | To voksne samtidig |
| --- | --- | --- |
| Kjøp, telling, rest, laget (`inventory.ts`) | Hendelseslogg, idempotent på id, tilstand avledet av hele loggen sortert på (`at`, id) | Samme linje med samme antall: ett kjøp. Ulikt antall: `konflikt` som ikke teller før en voksen bekrefter med `løs` |
| Avkrysning (`list.ts`) | Observed-remove-sett per (uke, linje). Hver avkrysning har egen id og `by` | Begge avkrysninger står og vises («Avkrysset av deg og Voksen 2»). Et kryss som fjernes, fjerner bare kryssene enheten hadde sett, så en samtidig avkrysning overlever |
| Manuelle linjer | Legg til / fjern med linje-id | Fjerning vinner |
| Utsolgt / fant ikke (`src/engine/substitution.ts`, strøm `endring`) | Hendelseslogg, idempotent på id; siste valg per linje etter (`at`, id) gjelder | Begge valg lagres; det siste (etter klientens tid) gjelder hos alle. Planendringer som følger av valget går via plandokumentet |
| Plan | Dokument, felt per dag + `approved` + `option` | Ulike dager flettes. Samme dag endret ulikt: konflikt |
| Innstillinger | Dokument, felt per toppnivå (`eaters`, `days`, `budgetOre` …) | Ulike felt flettes. Samme felt endret ulikt: konflikt |

En dokumentkonflikt holder egen verdi lokalt og sender ikke dokumentet før brukeren har valgt «Behold det som står her» eller «Bruk endringen fra Voksen 2» (Husstand-skjermen, varsel øverst i appen). Andre felt er allerede flettet. En åpen konflikt forsvinner ikke fordi den andre enheten endrer noe annet.

Rekkefølge: serverens `seq` brukes bare som cursor. Tilstanden avledes av klientens `at` og id, så hendelser fra en enhet som har vært frakoblet sorteres inn der de hører hjemme.

## Kostkrav og allergier: bevisst pilotavgrensning

**Valgt (A):** `avoid`, `avoidFoods` og `vegetarian` blir på hver enhet og synkes ikke. Serveren avviser dem i innstillingsdokumentet. Grunnen er at de kan avsløre helse eller livssyn (GDPR art. 9), og at uttrykkelig samtykke fra hver voksen ikke er avklart (`docs/personvern/06-samtykke-helsekost.md`).

Det gir en sikkerhetsrisiko (CLAUDE.md regel 4): en enhet uten filter kan lage eller endre en plan med allergener for hele husstanden. Avbøtende tiltak:

1. Alle retter i ukeplanen, bytt-arket og kundeavisenes rettforslag viser alltid «Inneholder: gluten, melk …» (eller «Ingen av de 14 allergenene er oppgitt»), pluss hva varene kan inneholde og om noe er uavklart, med «Sjekk pakningen». Hver handlelinje viser varens allergener eller at innholdet er ukjent/ikke avklart. Teksten vises uansett filter (`src/views/allergenText.ts`).
2. En enhet i en husstand med flere medlemmer og uten noe filter får banneret «Ingen allergi- eller kostfilter er satt på denne enheten. Planen kan inneholde allergener. Sjekk innholdet, eller legg inn filter», med knapp til innstillingene (som da åpner kost og allergier) og «Ikke vis igjen på denne enheten» (lokalt). Banneret vises også rett etter «Bli med», når medlemslisten er hentet.
3. En plan eller innstillinger fra en annen enhet endrer aldri filteret på denne (`withDoc` i `src/sync/engine.ts`; testet i `engine.test.ts`).
4. Plan-skjemaet sier at filtre ikke deles og må legges inn på hver voksen enhet.

**Ikke valgt nå (B):** synk av kostkrav etter uttrykkelig samtykke fra hver voksen. Det er en senere beslutning som krever personvernvurdering (hvem kan samtykke for hvem, DPIA, tilbaketrekking og sletting av synkede krav) og er ikke bygget.

## Klient

- **Utboks:** `outbox` (beholdning), `listOutbox` (handleliste) og `changeOutbox` (utsolgt / fant ikke). Levert betyr at serveren har bekreftet id-en (også hvis den fantes fra før), så et brutt svar og ny levering gir ingen doble rader. Avviste hendelser fjernes fra utboksen og telles (`sync.rejected`).
- **Dokumenter:** `sync.docs[navn] = {version, base}`. Et dokument er endret når lokal verdi ≠ `base`. Ved `409` flettes gjeldende versjon inn før nytt forsøk.
- **Status** (header og Handleliste): «Lagret på denne enheten» (ingen husstand), «Synket med husstanden», «Synker …», «Venter på nett (n endringer lagret her)», «Konflikt – må avklares» (dokumentkonflikt eller konflikt om antall).
- **Første tilkobling:** alt lokalt (hele beholdningsloggen og handlelista, også eldre migrerte data med faste id-er) legges i utboksen; serveren lagrer hver id én gang. Ved «Opprett» sendes enhetens plan og innstillinger som versjon 1. Ved «Bli med» overtar enheten husstandens plan og innstillinger (brukeren varsles først); kostkrav, allergier og postnummer på enheten beholdes.
- **Fjernet, forlatt eller slettet:** neste synk får `401`; enheten kobles fra, beholder dataene sine og viser en melding. «Slett husstanden» kan også slette alt lokalt.
- **Handlemodus:** knapp i Handlelista for stor tekst og store avkrysningsfelt.

## Sikkerhet

- Enhetstoken: 32 tilfeldige byte (base64url). Bare sha256 lagres; oppslag på hash. Sendes i `Authorization: Bearer`, aldri i URL. Ingen informasjonskapsler, så CSRF er ikke relevant; serveren sender ingen CORS-hoder (bare samme opprinnelse).
- Invitasjonskode: 10 tegn fra 32 tegn (50 bit), HMAC-SHA256 med `SYNC_SECRET`, én gangs bruk, 24 t, ratebegrenset. Koden står i fragmentet (`#bli-med=`), så den havner ikke i serverlogger.
- All data er avgrenset til husstanden til tokenet. En hendelse kan ikke ha `by` lik et annet medlems id.
- Inndata: JSON-kropp høyst 256 KB og `Content-Type: application/json`, høyst 500 hendelser per kall, 4 KB per hendelse, 64 KB per dokument, lengdegrenser på alle strenger, tall må være endelige og innenfor grenser, tidspunkter i ISO-format, dokumenter med ukjente felt avvises.
- Ratebegrensning (i minnet): 600 kall/min per IP, 240/min per enhet, 20 nye husstander/t per IP og 200/t samlet, 20 forsøk på å bli med/10 min per IP og 1 000 feilede samlet. IPv6 telles per /64. `TRUST_PROXY=1` leser siste adresse i `X-Forwarded-For` (bare bak nøyaktig én egen proxy).
- Kvoter per husstand: 12 aktive medlemmer (50 rader totalt), 5 aktive invitasjoner, 100 000 hendelser og 64 MB; alle husstander samlet `SYNC_MAX_TOTAL_MB`. Over kvoten: `403 kvote_full`, og hendelsene blir i utboksen.
- `at` mer enn 10 min fram i tid settes til mottakstid; ugyldige datoer avvises. Tilbakedatering er lov.
- Token som ikke er brukt på `SYNC_TOKEN_IDLE_DAYS` (180) dager slutter å virke. Fjernede, forlatte og utløpte medlemmer får etiketten «Tidligere medlem» uten «sist sett».
- Streng CSP med Trusted Types og øvrige sikkerhetshoder på alle svar (`server/app.ts`). Logger og feilsvar har aldri token, kode, etikett eller feilmelding.
- Service workeren cacher aldri `/api/`.
- Full gjennomgang med funn og hva som gjenstår: `docs/sikkerhet.md`.

## Drift

| Miljøvariabel | Standard | Hva |
| --- | --- | --- |
| `SYNC_DB` | `$DATA_DIR/middag.sqlite` | Databasefil (`:memory:` for test) |
| `DATA_DIR` | `data/` (Docker: `/data`) | Katalog for databasen; monter et volum |
| `SYNC_SECRET` | tilfeldig per prosess | Hemmelighet for invitasjonskoder. Uten den slutter aktive koder å virke ved omstart. Sett den som hemmelighet ved oppstart, aldri i repoet |
| `TRUST_PROXY` | av | `1` bak nøyaktig én kjent reverse proxy |
| `SYNC_TOKEN_IDLE_DAYS` | 180 | Dager uten bruk før et enhetstoken slutter å virke (`0` = aldri) |
| `SYNC_MAX_TOTAL_MB` | 4096 | Tak for alle husstanders hendelser samlet |
| `HSTS` | av | `1` sender `Strict-Transport-Security` (bare når alt går over HTTPS) |

`node:sqlite` er innebygd i Node 22 og er eksperimentell (skriver en «ExperimentalWarning» ved start; versjonen er festet i `Dockerfile`, se `docs/hosting.md`, «node:sqlite»). Databasen kjører i WAL-modus; skrivinger er `BEGIN IMMEDIATE`-transaksjoner. Sikkerhetskopi: `sqlite3 middag.sqlite ".backup kopi.sqlite"` eller `VACUUM INTO` mens serveren kjører, aldri `cp` av bare hovedfilen (WAL); krypter kopien. Ferdig skript (`VACUUM INTO` + age-kryptering), Docker Compose med Caddy og gjenopprettingsprosedyre: `docs/drift/` og `docs/hosting.md`, avsnitt 8.

### Koble på PostgreSQL

Implementer `SyncStorage` (`server/storage/types.ts`) i `server/storage/postgres.ts` med samme tabeller (`TEXT` → `text`, JSON som `jsonb` eller `text`) og velg implementasjon med `DATABASE_URL` i `server/index.ts`. Det som må holdes:

1. **Cursor uten hull:** hver skriving gjør `UPDATE households SET seq = seq + 1 WHERE id = $1 RETURNING seq` i samme transaksjon. Radlåsen serialiserer skrivinger per husstand, så en leser aldri ser `seq` N+1 før N er synlig.
2. **Idempotens:** `INSERT … ON CONFLICT (household_id, id) DO NOTHING`.
3. **Dokumenter:** `SELECT … FOR UPDATE` på dokumentraden før versjonssjekk.
4. **Invitasjon:** `UPDATE invites SET used_at = … WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING …` og medlemsinnsetting i samme transaksjon.
5. **Sletting:** `ON DELETE CASCADE`; sjekk at sikkerhetskopier også får en slettefrist.

`server/sync/api.test.ts` og `src/sync/engine.test.ts` bruker `startTestServer` (`server/sync/testkit.ts`) og kan kjøres mot en Postgres-implementasjon ved å bytte lagring der.

## Tester

- `server/sync/api.test.ts`: to (og flere) enheter i samme husstand; samme hendelse to ganger; samtidig avkrysning; konflikt om antall; identitetsforfalskning; tilbakekalt token; invitasjon brukes én gang og utløper; tilbaketrukket invitasjon; annen husstand ser aldri data; sletting fjerner alle rader; eier/medlem-tilganger; forlat og overføring av eierskap; ugyldige inndata; ratebegrensning; sider.
- `src/sync/engine.test.ts`: klientens synk-runde mot ekte server: avkrysning vises hos den andre med etikett; samtidig kryss og fjerning; ett kjøp fra to voksne og konflikt om antall likt hos begge; frakoblet endring og rekkefølge ved gjenoppkobling; avbrutt levering; migrering av eksisterende lokal tilstand uten duplikater; fjernet enhet; fletting og konflikt i plan; kostkrav synkes ikke.
- `src/sync/list.test.ts`: handlelistemodellen er uavhengig av rekkefølge.
- `npm run e2e:sync` (`scripts/e2e-sync.mjs`): Playwright med to nettleserkontekster mot ekte server: A oppretter, B blir med via lenke, A krysser av og B ser det («Avkrysset av Voksen 1»), B krysser av uten nett mens A krysser av noe annet, og etter gjenoppkobling har begge alle tre og tom utboks. Krever Playwright med Chromium; ikke en del av `vitest run`.

## Kjente svakheter

- **Token i localStorage.** XSS i appen gir full tilgang til husstanden (dempet av streng CSP og Trusted Types). Glidende utløp etter 180 dager uten bruk, men ingen rotasjon; tap av enheten krever at eieren fjerner den. Se `docs/sikkerhet.md` (S2, S7).
- **Invitasjon uten godkjenning.** Alle medlemmer kan lage koder, og den som har en gyldig kode innen 24 t blir medlem uten at eieren bekrefter. Ingen varsel til de andre. Må avgjøres før piloten (`docs/sikkerhet.md`, S6).
- **Alle voksne kan alt med data.** Et medlem kan angre andres kjøp, fjerne avkrysninger og endre planen. Det er tilsiktet for en familie, men det finnes ingen historikk i UI over hvem som endret plan og innstillinger (serveren lagrer bare siste `updatedBy`).
- **Klientens klokke** bestemmer rekkefølgen i loggen. Tid langt fram klippes til mottakstid, men en enhet (eller et medlem som vil) kan tilbakedatere hendelser, og enheten som sendte en klippet hendelse beholder sin egen tid lokalt (`docs/sikkerhet.md`, S5).
- **Mistet eierenhet.** Er eierens enhet borte, kan ingen fjerne medlemmer eller slette husstanden; de andre kan bare forlate (siste som går sletter alt). Overføring av eierskap mangler.
- **Allergier deles ikke** (se «Kostkrav og allergier» over). En enhet uten filter kan lage en plan med allergener for hele husstanden; avbøtet med synlig allergentekst og banner, ikke fjernet.
- **Ingen oppbevaringstid.** Kvoter stopper et medlem fra å fylle databasen, men loggen komprimeres ikke og gamle uker slettes ikke. Oppbevaringstid er ikke bestemt.
- **Fjernede medlemmer** beholdes som rad (offentlig id, etiketten «Tidligere medlem», uten token og «sist sett») og hendelsene deres blir i husstanden til den slettes.
- **Planversjoner synkes ikke.** `planHistory` (godkjente versjoner og fastholdte produkter, `activePin`) er lokal. Har én enhet en godkjent liste med fastholdte produkter og en annen ikke, kan de etter en prisendring vise ulike produkter på samme vare, og kjøp på de to linjene telles da hver for seg. Krever en egen modell (versjoner som hendelser) før det kan deles.
- **Ratebegrensning i minnet** virker bare med én serverprosess. Flere prosesser trenger felles teller (Redis eller databasen).
- **Flere faner på samme enhet** deler token og localStorage; de kan skrive over hverandres lokale tilstand (gjaldt også før synk).
- **Gjenoppretting fra en eldre sikkerhetskopi bryter enhetenes cursor (funnet i test 2026-11-22, ikke rettet).** `GET /api/sync?after=<cursor>` returnerer bare hendelser med løpenummer over cursor, og klienten har ingen håndtering av at cursor er større enn serverens siste løpenummer. Etter en gjenoppretting som mangler de siste hendelsene får nye hendelser løpenumre enhetene allerede regner som lest, og enheter som hadde hentet lenger enn kopien mottar dem aldri, uten feilmelding; hendelser de allerede hadde levert etter kopitidspunktet er borte fra serveren og sendes ikke på nytt (utboksen er tømt). En ny enhet ser riktig innhold. Forslag: serveren oppgir sin siste løpenummer, og klienten nullstiller cursor og legger lokal logg i utboksen på nytt når cursor er foran (alt er idempotent på id). Til det er rettet: koble alle enheter fra og på igjen etter en gjenoppretting som taper data (`docs/hosting.md`, «Sikkerhetskopi og gjenoppretting»).
- **Ingen kryptering i hvile** utover det plattformen gir; databasefil og sikkerhetskopier må krypteres av drift.

## Må på plass før ekte familier

1. **Hosting med TLS** (HTTPS foran serveren, f.eks. Caddy), varig volum for databasen, `SYNC_SECRET` som hemmelighet, `TRUST_PROXY=1` bak proxyen. Se `docs/hosting.md`.
2. **Sikkerhetskopi og gjenoppretting**, kryptert, med slettefrist som følger GDPR-sletting, og en prøvd gjenoppretting.
3. **Personvernerklæring, behandlingsprotokoll og DPIA-vurdering** oppdatert mot denne løsningen (`docs/personvern/`), behandlingsansvarlig avklart, **databehandleravtaler** med hosting- og backupleverandør.
4. **Oppbevaringstid** for hendelser og dokumenter, og en rutine som sletter eldre data.
5. **Overvåking** av feilrater og databasestørrelse uten å logge innhold, token eller invitasjonskoder.
6. **Sikkerhet:** gjennomgang gjort (`docs/sikkerhet.md`); punktene under «Må på plass før ekte familier» der gjelder.
7. **Test på to ekte telefoner** over mobilnett, med appen installert, gjennom en hel handleuke.

## Ekte kontoer senere (ikke bygget)

Enhetstokenet er nok for piloten, men en familie mister tilgang når en telefon byttes uten at en annen voksen inviterer på nytt. For kontoer med e-post og magisk lenke trengs:

- **Tabell `accounts`** (e-post som HMAC eller kryptert, opprettet, bekreftet) og kobling `devices.account_id`. En konto kan ha flere enheter; medlemskap flyttes fra enhet til konto.
- **Magisk lenke:** engangstoken (32 byte, bare hash lagret, 15 min utløp, én gangs bruk) sendt på e-post via en e-postleverandør med databehandleravtale; lenken bruker fragmentet eller en POST, ikke en GET som e-postskannere kan åpne og bruke opp.
- **Gjenoppretting:** logg inn på ny enhet → nytt enhetstoken for samme medlemskap; liste over egne enheter med «logg ut» per enhet.
- **Personvern:** e-post er en personopplysning; behandlingsgrunnlag, oppbevaring, innsyn og sletting av konto (uten å slette husstandens data for de andre) må beskrives. Ingen markedsføring uten eget samtykke.
- **Sikkerhet:** ratebegrensning per e-postadresse, ingen opplysning om en adresse finnes, valgfri passkey (WebAuthn) i stedet for e-post.
- **Migrering:** eksisterende enheter kobles til en konto første gang brukeren logger inn; husstanden og loggen er uendret.
