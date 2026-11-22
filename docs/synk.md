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
| Utsolgt / fant ikke, planversjoner | `src/engine/substitution.ts`, `src/listActions.ts` | Valg per linje med `prev`, versjoner med `parents`, konflikt som tilstand, samme kurv i alle visninger |
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
| `docs` | (husstand, navn), versjon, JSON, `seq`, endret av, slekt (`revs`) | `plan` og `innstillinger`. `revs`: de siste 100 versjons-id-ene (rev = sha256 av forrige rev, versjon og innhold, 12 tegn; samme innhold på samme grunnlag gir samme rev). Interne versjons-id-er uten persondata; ikke med i eksporten (som andre interne id-er) |

Alle tabeller har `ON DELETE CASCADE` fra `households`, og `PRAGMA secure_delete` er på, så sletting overskriver innholdet i databasefilen.

**Lagres aldri på serveren:** tilbud fra Tjek (bare i minnet i `server/index.ts`), postnummer, kostkrav og allergier (`avoid`, `avoidFoods`, `vegetarian`, mulige helseopplysninger, se `docs/personvern/06-samtykke-helsekost.md`), passord, e-post, navn, posisjon. Serveren avviser dokumenter med ukjente felt.

## API

Alle svar er JSON med `Cache-Control: no-store`. Feil har formen `{ "error": "<kode>", "message": "<norsk tekst>" }`.

| Metode og sti | Tilgang | Hva |
| --- | --- | --- |
| `POST /api/household` `{deviceId, label?}` | åpen, 20/t per IP | Ny husstand; svarer `201 {token, member}` |
| `POST /api/household/join` `{code, deviceId, label?}` | åpen, 20/10 min per IP | Bli med; koden brukes opp i samme transaksjon |
| `GET /api/household` | medlem | Aktive medlemmer, invitasjoner og serverens oppbevaringstid (`retentionDays`, 0 = av) |
| `PATCH /api/household/me` `{label}` | medlem | Endre egen etikett (høyst 24 tegn, kontrolltegn fjernes) |
| `POST /api/household/invites` | eier | Ny kode, 10 tegn (50 bit), utløper etter 24 t. Andre medlemmer får `403 bare_eier` (pilotbeslutning) |
| `DELETE /api/household/invites/:id` | eier | Trekk tilbake |
| `DELETE /api/household/members/:id` | eier | Tilbakekall en annen enhets token |
| `POST /api/household/leave` | medlem | Forlat. Eier som går gir eierskap til eldste; siste som går sletter husstanden |
| `DELETE /api/household` | eier | Slett husstanden og alle data |
| `POST /api/sync/events` `{events: [{stream, event}]}` | medlem | Høyst 500 per kall. Svar `{accepted, rejected:[{id, code}]}` |
| `GET /api/sync?after=<cursor>&anchor=<seq:id>&docs=<navn:versjon:rev,…>` | medlem | Hendelser etter cursor (sider på 1000), medlemsliste og `head` (siste `seq`). `cursor` i svaret er `seq` for siste hendelse (ellers `after`), aldri en dokumentskriving, så ankeret dekker hele cursoren. Dokumenter: med dokumentanker (`docs`, høyst ett per dokument, streng form, ellers `400`) hvert dokument der serverens versjon eller rev er ulik enhetens, uansett `seq`; uten (eldre klienter) dokumenter skrevet etter `after`. Dokumentene har slekten `revs`. `reset: true` når cursor er etter `head` eller ankeret (siste hendelse enheten har sett) ikke finnes: databasen er gjenopprettet fra en eldre kopi |
| `GET /api/household/export` | medlem, 10/t per enhet | Innsyn og dataportabilitet: alt serveren har om husstanden som én JSON-fil (`ServerExport` i `protocol.ts`, versjon 1): medlemmer (offentlig enhets-id, etikett, rolle, tider, også fjernede), invitasjoner (uten kode og HMAC), dokumenter og alle hendelser slik de er lagret, med mottakstid og hvem som leverte. Aldri token, tokenhash, kode eller interne id-er. Husstanden gis av tokenet; ingen id i stien. Strømmes side for side; logges ikke |
| `GET /healthz` | åpen | `SELECT 1` mot databasen: `200 {"status":"ok"}` eller `503`. Ingen innhold, ingen autentisering (Docker-helsesjekk, oppetidsovervåking) |
| `PUT /api/sync/docs/:navn` `{baseVersion, body}` | medlem | Skriver hvis `baseVersion` er gjeldende og svarer `{version, revs, updatedAt}`; ellers `409 {error:"konflikt", current}` |

Feilkoder: `ugyldig_forespørsel` (400/415), `for_stor` (413), `ikke_autentisert` (401), `ingen_tilgang` (403), `ugyldig_kode` (403), `enhet_finnes` (409), `konflikt` (409), `ugyldig_dokument` (400), `bare_eier` (403), `kvote_full` (403), `ikke_funnet` (404), `for_mange_forespørsler` (429), `serverfeil` (500). Per hendelse: `ugyldig_hendelse`, `ukjent_strøm`, `for_stor`, `feil_identitet` (hendelsen utgir seg for et annet medlem).

## Konfliktmodell

| Data | Modell | To voksne samtidig |
| --- | --- | --- |
| Kjøp, telling, rest, laget (`inventory.ts`) | Hendelseslogg, idempotent på id, tilstand avledet av hele loggen sortert på (`at`, id) | Samme linje med samme antall: ett kjøp. Ulikt antall: `konflikt` som ikke teller før en voksen bekrefter med `løs` |
| Avkrysning (`list.ts`) | Observed-remove-sett per (uke, linje). Hver avkrysning har egen id og `by` | Begge avkrysninger står og vises («Avkrysset av deg og Voksen 2»). Et kryss som fjernes, fjerner bare kryssene enheten hadde sett, så en samtidig avkrysning overlever |
| Manuelle linjer | Legg til / fjern med linje-id | Fjerning vinner |
| Bruk noe hjemme (`inventory.ts`, `hjemme`) | Hendelse per (uke, vare), idempotent på id | Samme valg fra begge: én registrering, største mengde. Angres med `angre` når valget på linja endres |
| Utsolgt / fant ikke (`src/engine/substitution.ts`, strøm `endring`) | Hendelseslogg, idempotent på id. Hvert valg har `prev`: valgene på linja enheten hadde sett. Gjeldende valg = de ingen andre bygger på | Valg som ikke bygger på hverandre og sier ulikt (samtidig, eller fra en enhet uten nett): **konflikt** på linja, ukjent pris og ikke «handlet» før en voksen velger i arket (nytt valg som bygger på begge). Samme utfall: ingen konflikt. Rettebytte som følger av valget går via plandokumentet og opphever godkjenningen |
| Planversjoner (`substitution.ts`, strøm `planversjon`) | Uforanderlige øyeblikksbilder, idempotent på id, med `parents` (versjonene de bygger på) | Gjeldende versjoner for uka med samme middager og ulike fastholdte produkter (f.eks. «Bruk nye priser» på én enhet og «Behold» på en annen): **konflikt**, ingenting holdes fast, banner i appen og valg i handlelista («Bruk denne listen» gir en `valgt`-versjon som bygger på begge). Samtidige endringer oppå samme liste (samme produkter) er ingen konflikt; «Behold»-valg slås sammen |
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

- **Utboks:** `outbox` (beholdning), `listOutbox` (handleliste), `changeOutbox` (utsolgt / fant ikke) og `versionOutbox` (planversjoner). Leveres i biter på høyst 500 hendelser og under kroppsgrensen (planversjoner er store). Levert betyr at serveren har bekreftet id-en (også hvis den fantes fra før), så et brutt svar og ny levering gir ingen doble rader. Avviste hendelser fjernes fra utboksen og telles (`sync.rejected`).
- **Dokumenter:** `sync.docs[navn] = {version, base, revs, at}` (`revs`: slekten til basen fra serveren; `at`: når basen ble skrevet, serverens klokke). Et dokument er endret når lokal verdi ≠ `base`. Ved `409` flettes gjeldende versjon inn før nytt forsøk. Hver pull sender dokumentanker («navn:versjon:rev»), så serveren sender bare dokumenter som er ulike enhetens.
- **Status** (header og Handleliste): «Lagret på denne enheten» (ingen husstand), «Synket med husstanden», «Synker …», «Venter på nett (n endringer lagret her)», «Konflikt – må avklares» (dokumentkonflikt, konflikt om antall, ulike valg på en linje eller to ulike godkjente lister).
- **Samme kurv:** ukeplanen, handletur-kortene, bytteforslagene, handlelista og «Med kontrollerte tilbud» regnes fra samme justerte kurv (`adjustedWeek`): motoren velger butikkene på sine priser, brukerens valg og den godkjente listen legges oppå, og anbefalingen regnes på nytt (ukjent pris vinner aldri). «Summen er med valgene fra handlelista: …» vises når valg er med.
- **Godkjenning:** «Velg én/to butikk(er)» lager en planversjon bare når grunnlaget er endret siden gjeldende versjon (ingen duplikater); versjonen synkes, og planens `approved` følger i plandokumentet.
- **Gjenoppretting av serveren:** enheten oppdager den på tre måter: serveren svarer `reset` (cursor etter `head`, eller ankeret finnes ikke), serveren sender en dokumentversjon som viser at den har mistet en versjon enheten har sett (`lostDoc`: lavere versjon, samme versjon med annen rev, eller feil rev på enhetens plass i slekten), eller en `409` viser det samme. Da nullstiller enheten cursor og anker, legger hele sin egen lokale logg (alle strømmer, bare egne hendelser og migrerte data) i utboksene igjen og merker dokumentene som `restored`, med basen og slekten fra før. Alt er idempotent på id, så ingenting dobles. Hendelser fra medlemmer som er fjernet etter kopitidspunktet, og som bare fantes etter kopien, kommer ikke tilbake.
- **Dokumenter etter gjenoppretting (ingen siste-skriving-vinner):** neste versjon fra serveren sammenlignes med basen fra før gjenopprettingen. Slekten avgjør rekkefølgen: står basen i serverens slekt, er serverens versjon nyere og flettes tre-veis som vanlig (felt begge har endret ulikt blir konflikt). Står serverens versjon i basens slekt, er den en eldre kopi: den overses, og lokal verdi sendes som neste versjon. Avgjør ikke slekten (mer enn 100 versjoner, eller en annen enhet har sendt noe nytt etter gjenopprettingen), avgjør serverens klokke (`updatedAt` mot basens `at`). Uten slekt og tid (eldre lagret tilstand) blir hvert felt som er ulikt en konflikt, også felt bare serveren har endret. Eksempel: A og B har budsjett X; serveren gjenopprettes; A endrer til Y og synker først; B uten egne endringer får Y, og har B endret til Z, får B en konflikt i stedet for å overskrive A.
- **Feil:** en feil som ikke bare er manglende nett (`kvote_full`, `serverfeil`, `for_mange_forespørsler`, avvist forespørsel) gir status «⚠ Synk feilet – endringene er lagret her», rød chip, norsk tekst per feilkode på Husstand-skjermen (`syncErrorText`) og opplesning via en skjult `aria-live`-region.
- **Strenge feltlister:** `beholdning`, `liste` og `endring` har faste felt per hendelsestype (`cleanEvent` i `protocol.ts`). Ukjente felt fjernes ved mottak på serveren (lagres og deles aldri) og ved utlevering og mottak hos klienten (eldre rader). De avvises ikke, så eldre klienter virker. `planversjon` har strengt skjema og avvises ved ukjente felt.
- **Første tilkobling:** alt lokalt (hele beholdningsloggen og handlelista, også eldre migrerte data med faste id-er) legges i utboksen; serveren lagrer hver id én gang. Ved «Opprett» sendes enhetens plan og innstillinger som versjon 1. Ved «Bli med» overtar enheten husstandens plan og innstillinger (brukeren varsles først); kostkrav, allergier og postnummer på enheten beholdes.
- **Fjernet, forlatt eller slettet:** neste synk får `401`; enheten kobles fra, beholder dataene sine og viser en melding. «Slett husstanden» kan også slette alt lokalt.
- **Handlemodus:** knapp i Handlelista for stor tekst og store avkrysningsfelt.

## Sikkerhet

- Enhetstoken: 32 tilfeldige byte (base64url). Bare sha256 lagres; oppslag på hash. Sendes i `Authorization: Bearer`, aldri i URL. Ingen informasjonskapsler, så CSRF er ikke relevant; serveren sender ingen CORS-hoder (bare samme opprinnelse).
- Invitasjonskode: 10 tegn fra 32 tegn (50 bit), HMAC-SHA256 med `SYNC_SECRET`, én gangs bruk, 24 t, ratebegrenset. Koden står i fragmentet (`#bli-med=`), så den havner ikke i serverlogger.
- All data er avgrenset til husstanden til tokenet. En hendelse kan ikke ha `by` lik et annet medlems id.
- Inndata: JSON-kropp høyst 256 KB og `Content-Type: application/json`, høyst 500 hendelser per kall, 4 KB per hendelse (48 KB per planversjon, strengt skjema uten ukjente felt; en full demouke er ca. 6 KB), 64 KB per dokument, lengdegrenser på alle strenger, tall må være endelige og innenfor grenser, tidspunkter i ISO-format, dokumenter med ukjente felt avvises.
- Ratebegrensning (i minnet): 600 kall/min per IP, 240/min per enhet, 20 nye husstander/t per IP og 200/t samlet, 20 forsøk på å bli med/10 min per IP og 1 000 feilede samlet. IPv6 telles per /64. `TRUST_PROXY=1` leser siste adresse i `X-Forwarded-For` (bare bak nøyaktig én egen proxy).
- Kvoter per husstand: 12 aktive medlemmer (50 rader totalt), 5 aktive invitasjoner, 100 000 hendelser og 64 MB; alle husstander samlet `SYNC_MAX_TOTAL_MB`. Over kvoten: `403 kvote_full`, og hendelsene blir i utboksen.
- `at` mer enn 10 min fram i tid settes til mottakstid; ugyldige datoer avvises. Tilbakedatering er lov.
- Token som ikke er brukt på `SYNC_TOKEN_IDLE_DAYS` (180) dager slutter å virke. Fjernede, forlatte og utløpte medlemmer får etiketten «Tidligere medlem» uten «sist sett».
- Streng CSP med Trusted Types og øvrige sikkerhetshoder på alle svar (`server/app.ts`). Logger og feilsvar har aldri token, kode, etikett eller feilmelding.
- Service workeren cacher aldri `/api/`.
- Full gjennomgang med funn og hva som gjenstår: `docs/sikkerhet.md`.

## Personvern i appen

- **«Last ned mine data»** (Husstand-skjermen, med og uten husstand): én JSON-fil (`src/sync/export.ts`, `format: middagsplanlegger-eksport`, `versjon: 1`, `eksportert`) med `enhet` (enhets-id, det som bare er lokalt: postnummer, vegetar, allergener, matvarer som unngås, og hele den lokale tilstanden uten token) og `server` (svaret fra `GET /api/household/export`). Uten nett lastes bare enhetsdelen ned, med `serverMerknad` og melding i appen.
- **«Personvern»** (`src/views/PrivacySheet.tsx`): ark fra Husstand-skjermen og bunnen av hver side. Merket UTKAST og «ikke ferdig vurdert av fagperson». Sier hva som lagres lokalt og hva som synkes, at allergier og kostkrav bare er lokale, og serverens oppbevaringstid slik serveren oppgir den (ellers at den ikke er bestemt). Bygger på `docs/personvern/02-personvernerklaering.md`, men lover ikke mer enn koden gjør. Ingen HTML-strenger (CSP og Trusted Types; sjekket i `npm run check:csp`).
- **Enhets-id** vises på Husstand-skjermen og i arket, så brukeren kan oppgi den ved en henvendelse.
- **«Slett alt på denne enheten …»** på Husstand-skjermen (også før første plan), med bekreftelse og varsel om at enheten fortsatt er medlem på serveren til den forlater husstanden.

## Oppbevaringstid

`server/retention.ts` kjøres ved oppstart og hver 6. time (`startRetention` i `server/index.ts`). Den sletter husstander der **siste aktivitet** er eldre enn `SYNC_RETENTION_DAYS` dager (standard 365, `0` = av), med samme sletting som «Slett husstanden»: kaskade til medlemmer, invitasjoner, hendelser og dokumenter, `secure_delete` og WAL-checkpoint (`SqliteStorage.deleteInactive`). Høyst 500 per transaksjon. Loggen får bare antall («slettet 2 husstander uten aktivitet på 365 dager»), aldri id-er eller innhold. Klokken settes inn (testet med injisert klokke i `server/sync/api.test.ts`).

- **Siste aktivitet** er seneste «sist sett» blant husstandens enheter, ellers når husstanden ble opprettet. «Sist sett» oppdateres ved hvert autentiserte kall (synk, Husstand-skjermen), med minutt-oppløsning. En enhet som har appen åpen med nett, synker hvert 10. sekund og holder husstanden i live. Inaktivitet er **eneste** kriterium.
- **Ingen varsel før sletting:** vi har ingen kontaktinformasjon. Personvern-arket sier hva som gjelder, og en enhet som kommer tilbake etter slettingen får `401`, kobles fra og beholder sine lokale data.
- **Samspill med tokenutløp:** med standardverdiene slutter et token å virke etter 180 dager uten bruk (`SYNC_TOKEN_IDLE_DAYS`), så en husstand der ingen har vært aktive på 180 dager er i praksis ubrukelig før den slettes ved 365 dager. Er `SYNC_RETENTION_DAYS` kortere enn tokenutløpet, er det oppbevaringstiden som gjelder. **Åpent (2026-11-22):** med eierens valg 730 dager og tokenutløp 180 dager kan ingen åpne, eksportere eller slette en husstand i appen i rundt 550 dager før den slettes. Forslag og valg: `docs/pilot-sjekkliste.md`, D15. Ingen kode er endret.
- **Sikkerhetskopier:** se `docs/hosting.md`, avsnitt 8 («Slettefrist for sikkerhetskopier»). Gjenopprettes en eldre kopi, sletter jobben ved oppstart de husstandene som fortsatt er inaktive, så sletting for inaktivitet gjentas av seg selv; sletting gjort av eieren gjør ikke det.

## Drift

| Miljøvariabel | Standard | Hva |
| --- | --- | --- |
| `SYNC_DB` | `$DATA_DIR/middag.sqlite` | Databasefil (`:memory:` for test) |
| `DATA_DIR` | `data/` (Docker: `/data`) | Katalog for databasen; monter et volum |
| `SYNC_SECRET` | tilfeldig per prosess | Hemmelighet for invitasjonskoder. Uten den slutter aktive koder å virke ved omstart. Sett den som hemmelighet ved oppstart, aldri i repoet |
| `TRUST_PROXY` | av | `1` bak nøyaktig én kjent reverse proxy |
| `SYNC_TOKEN_IDLE_DAYS` | 180 | Dager uten bruk før et enhetstoken slutter å virke (`0` = aldri) |
| `SYNC_MAX_TOTAL_MB` | 4096 | Tak for alle husstanders hendelser samlet |
| `SYNC_RETENTION_DAYS` | 365 | Husstander uten aktivitet i så mange dager slettes automatisk (`0` = av; ugyldig verdi gir 365). Eierens valg for piloten (2026-11-22): `730`, satt i `docs/drift/env.eksempel`; standarden i koden er uendret. Se «Oppbevaringstid» |
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
- `src/sync/engine.test.ts` (godkjent liste og utsolgt / fant ikke): godkjent liste deles med samme fastholdte produkter etter prisendring; samtidig «Bruk nye priser» og «Behold» uten nett gir samme konflikt hos begge og løses av ett valg; ulike valg på samme linje blir konflikt hos begge og løses (registrering i matskapet angres); frakoblet erstatning flettes med den andres valg og dobbel levering gir ingen doble rader; rettebytte opphever godkjenningen.
- `server/sync/api.test.ts` (helse, invitasjoner, gjenoppretting, feltlister): `/healthz` uten autentisering og `503` uten database; bare eier inviterer; `head`, `reset` og anker; ukjente felt fjernes før lagring.
- `src/sync/engine.test.ts` (gjenoppretting): kopi tas, begge skriver videre, kopien legges tilbake; enhetene sender sitt på nytt, ingen doble rader, dokumentet (budsjett) beholder siste verdi, en ny enhet ser alt; også når en annen enhet har skrevet forbi cursoren før enheten synker (anker), og når cursoren hadde flyttet seg på grunn av dokumenter (S2). Dokumenter flettes tre-veis etter gjenoppretting (S1): en enhet uten egne endringer overskriver ikke den andres, begge endret gir konflikt, en eldre kopi tar ikke tilbake gamle verdier; `lostDoc`, rekkefølge etter slekt og tid, dokumentanker. Status «feil» med norsk tekst.
- `server/sync/api.test.ts` og `security.test.ts` (dokumentanker og slekt): cursor står på en hendelse; bare ulike dokumenter sendes; samme innhold gir samme rev; eldre database får `revs` ved oppstart; ugyldig dokumentanker gir `400`; slekten er ikke med i eksporten.
- `server/sync/api.test.ts` (eksport og oppbevaringstid): medlem og ikke-eier får alt; aldri token, hash, kode, HMAC eller interne id-er; bare egen husstand; fjernet/slettet gir 401; 2 500 hendelser strømmes som én gyldig fil; 10 per time per enhet. Inaktive husstander slettes med alt innhold, aktivitet fra ett medlem holder husstanden, grensen på minuttet, `0` = av, ugyldig verdi gir 365, jobben med injisert klokke logger bare antall. `server/sync/security.test.ts`: eksport i lista over samme 401, ingen lekkasje mellom husstander, ingen logg, avbrutt nedlasting krasjer ikke, API-CSP; automatisk sletting fjerner innhold fra databasefil og `-wal`. `src/sync/export.test.ts`: filen har format, versjon og tid, aldri token.
- `server/sync/api.test.ts` (planversjoner): lagres én gang og deles; ukjente felt, helseopplysninger, feil identitet, egen forelder og for store versjoner avvises; `hjemme` og `prev` godtas.
- `src/engine/substitution.test.ts`: konflikt på linje og versjoner uavhengig av rekkefølge, ingen duplikat ved ny godkjenning, samme sum i alle visninger etter en erstatning og basiskurven uendret.
- `src/sync/list.test.ts`: handlelistemodellen er uavhengig av rekkefølge.
- `npm run e2e:sync` (`scripts/e2e-sync.mjs`): Playwright med to nettleserkontekster mot ekte server: A oppretter, B blir med via lenke, A krysser av og B ser det («Avkrysset av Voksen 1»), B krysser av uten nett mens A krysser av noe annet, og etter gjenoppkobling har begge alle tre og tom utboks. Deretter godkjenner A lista (B får samme versjon), A erstatter en utsolgt vare (begge viser «Erstatter» og samme sum, B ser samme sum i ukeplanen og på handletur-kortet), og B uten nett og A velger ulikt på samme vare: konflikten vises hos begge og løses av A. Så velger A tilbudskjeden Kiwi (B får samme `offerChains`), det tas en kopi av databasen, begge krysser av noe nytt, serveren stoppes og kopien legges tilbake, og enhetene sender det som manglet til serveren har alle hendelsene igjen (ingen doble). Til slutt laster B (ikke eier) ned sine data: filen har alle hendelsene, begge medlemmene, riktig enhets-id og ingen token. Krever Playwright med Chromium; ikke en del av `vitest run`.

## Kjente svakheter

- **Token i localStorage.** XSS i appen gir full tilgang til husstanden (dempet av streng CSP og Trusted Types). Glidende utløp etter 180 dager uten bruk, men ingen rotasjon; tap av enheten krever at eieren fjerner den. Se `docs/sikkerhet.md` (S2, S7).
- **Invitasjon uten godkjenning.** Bare eieren kan lage og trekke tilbake koder (pilotbeslutning; andre medlemmer får `403 bare_eier`, og Husstand-skjermen forklarer det). Den som har en gyldig kode innen 24 t blir likevel medlem uten at eieren bekrefter, og de andre varsles ikke. «Eier godkjenner nye medlemmer» (ventestatus) er **utsatt**: den krever ny medlemsstatus i lagringen, at autentisering skiller ventende enheter, at klientens synk tåler å vente (ny feilkode og tilstand i `src/sync/engine.ts`) og eget UI for eieren, og ble ikke bygget sammen med eksport og oppbevaringstid for ikke å endre synkmotoren uten egen gjennomgang (`docs/sikkerhet.md`, S6).
- **Alle voksne kan alt med data.** Et medlem kan angre andres kjøp, fjerne avkrysninger og endre planen. Det er tilsiktet for en familie, men det finnes ingen historikk i UI over hvem som endret plan og innstillinger (serveren lagrer bare siste `updatedBy`).
- **Klientens klokke** bestemmer rekkefølgen i loggen. Tid langt fram klippes til mottakstid, men en enhet (eller et medlem som vil) kan tilbakedatere hendelser, og enheten som sendte en klippet hendelse beholder sin egen tid lokalt (`docs/sikkerhet.md`, S5).
- **Mistet eierenhet.** Er eierens enhet borte, kan ingen fjerne medlemmer eller slette husstanden; de andre kan bare forlate (siste som går sletter alt). Overføring av eierskap mangler.
- **Allergier deles ikke** (se «Kostkrav og allergier» over). En enhet uten filter kan lage en plan med allergener for hele husstanden; avbøtet med synlig allergentekst og banner, ikke fjernet.
- **Oppbevaringstid bare for hele husstanden.** Inaktive husstander slettes (se «Oppbevaringstid»), men i en aktiv husstand komprimeres ikke loggen og gamle uker slettes ikke. Eieren har valgt 730 dager for piloten (2026-11-22); standarden i koden er 365.
- **Eksporten** er en ren kopi av det som er lagret (hendelser i rå form med engelske feltnavn fra protokollen), ikke en forklart rapport. Den inneholder også andre medlemmers etiketter og hendelser (husstandens felles data); om det er riktig ved innsyn for én person, må fagperson vurdere.
- **Fjernede medlemmer** beholdes som rad (offentlig id, etiketten «Tidligere medlem», uten token og «sist sett») og hendelsene deres blir i husstanden til den slettes.
- **Planversjoner og allergifilter.** Versjonene deles, men kostkrav og allergier gjør ikke. En enhet med aktivt allergifilter bruker ikke et fastholdt produkt med allergentreff eller uavklart status (motorens valg brukes i stedet), så den kan vise et annet produkt enn de andre på den linja, og kjøp på de to linjene telles hver for seg.
- **Konflikter løses av handling, ikke bare av knappen.** En ny godkjenning eller «Bruk nye priser»/«Behold» på en enhet bygger på alle gjeldende versjoner og avslutter dermed en konflikt (bevisst valg, men uten eget spørsmål). Et nytt valg på en linje i konflikt bygger på begge og løser den.
- **«Bruk hjemme» ved samtidige valg.** Velger en annen enhet noe annet på linja uten å ha sett «bruk hjemme», blir det konflikt; først når en voksen velger, angres registreringen i matskapet. Velges «bruk hjemme», står registreringen fra den første enheten.
- **Klientens klokke** avgjør rekkefølgen i historikken, men ikke hvem som vinner: konflikt avgjøres av `prev`/`parents`, ikke av tid. En enhet kan likevel utgi `prev` den ikke har sett (bevisst «løse» en konflikt); serveren sjekker bare formatet.
- **Planhistorikken vokser** med én versjon per endring (opptil ca. 20–50 KB per versjon) og ryddes ikke.
- **Ratebegrensning i minnet** virker bare med én serverprosess. Flere prosesser trenger felles teller (Redis eller databasen).
- **Flere faner på samme enhet** deler token og localStorage; de kan skrive over hverandres lokale tilstand (gjaldt også før synk).
- **Gjenoppretting fra en eldre sikkerhetskopi** oppdages med `head`, anker og dokumentenes slekt og rettes av enhetene selv; plan og innstillinger flettes tre-veis mot basen fra før (se Klient). Det som bare fantes på serveren etter kopitidspunktet og ikke på noen tilkoblet enhet (f.eks. hendelser fra en enhet som er fjernet eller slettet), er tapt. Enheter som er frakoblet lenge, sender sitt når de kommer på nett. Gjenværende smale tilfeller: (1) en hendelse som sendes på nytt etter gjenopprettingen og tilfeldigvis får nøyaktig samme `seq` som en enhets anker, skjuler gjenopprettingen for den enheten; (2) en hendelse enheten har levert, men ikke hentet igjen før serveren ble gjenopprettet til en kopi fra før leveringen, sendes ikke på nytt hvis ankeret ellers stemmer; (3) når slekten ikke avgjør rekkefølgen, brukes serverens klokke. Testet i `src/sync/engine.test.ts` og `npm run e2e:sync`.
- **Ingen kryptering i hvile** utover det plattformen gir; databasefil og sikkerhetskopier må krypteres av drift.

## Må på plass før ekte familier

1. **Hosting med TLS** (HTTPS foran serveren, f.eks. Caddy), varig volum for databasen, `SYNC_SECRET` som hemmelighet, `TRUST_PROXY=1` bak proxyen. Se `docs/hosting.md`.
2. **Sikkerhetskopi og gjenoppretting**, kryptert, med slettefrist som følger GDPR-sletting, og en prøvd gjenoppretting.
3. **Personvernerklæring, behandlingsprotokoll og DPIA-vurdering** oppdatert mot denne løsningen (`docs/personvern/`), behandlingsansvarlig avklart, **databehandleravtaler** med hosting- og backupleverandør.
4. **Oppbevaringstid** avgjort (`SYNC_RETENTION_DAYS`, bygget for hele husstanden; eieren har valgt 730 dager, men samspillet med tokenutløpet er åpent, `pilot-sjekkliste.md` D15) og slettefrist for sikkerhetskopier; eventuelt sletting av gamle uker i aktive husstander (ikke bygget).
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
