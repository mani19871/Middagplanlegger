# 05 Rutine for innsyn, retting og sletting

> **UTKAST. Ikke juridisk rådgivning. Må kvalitetssikres av noen med personvernkompetanse.** Frister og artikler fra generell kunnskap: må verifiseres. **Avstemt 2026-11-22 mot synk-løsningen og koden** (avsnitt 5 er krysset av etter hva som er bygget og prøvd). Sletting av husstand finnes; **eksport finnes** («Last ned mine data», 2026-11-22), automatisk sletting etter inaktivitet finnes; identitetsbekreftelse uten konto er fortsatt svak.

## 1. Prinsipper

- Svar **uten ugrunnet opphold og senest innen en måned** etter at vi mottok henvendelsen (GDPR art. 12 nr. 3, må verifiseres). Fristen kan i visse tilfeller forlenges; avtal da med den som spør.
- **Gratis** for vanlige henvendelser.
- **Ikke samle mer data for å oppfylle en rettighet.** Vi har få data om hvem personen er. Identitet bekreftes med det vi allerede har (se avsnitt 3).
- Hver henvendelse føres i et enkelt register (dato mottatt, type, hvem som behandlet, dato besvart, utfall). Ikke lagre selve dataene i registeret.
- **Ansvarlig for rutinen:** AVVR AS (behandlingsansvarlig); den som svarer og responstid: **UAVKLART** (ikke bestemt). **Postkasse:** **[UAVKLART: e-postadresse ikke bestemt]**.

## 2. Typer henvendelser

| Rettighet (GDPR) | Hva brukeren får | Hvordan |
| --- | --- | --- |
| Innsyn (art. 15) | Kopi av husstandens data og informasjon om formål, mottakere, oppbevaring | **Selvbetjent:** «Last ned mine data» på Husstand-skjermen (alle medlemmer, ikke bare eier) gir én JSON-fil med enhetens lokale data (også kostkrav og postnummer, som ikke er hos oss) og alt serveren har om husstanden. Informasjon om formål osv.: personvern-arket i appen (utkast). Manuelt uttrekk bare når brukeren ikke kan bruke appen |
| Retting (art. 16) | Rettet opplysning | Brukeren retter selv i appen (alle voksne kan endre plan, innstillinger og egen etikett). Vi retter ikke direkte i databasen uten å være sikre på hvem som spør |
| Sletting (art. 17) | Alt slettet | **Slett husstand** i appen. Ellers sletter vi manuelt |
| Dataportabilitet (art. 20) | Egne data i maskinlesbart format (JSON) | Samme fil som innsyn (`format`, `versjon`, `eksportert`). API: `GET /api/household/export` (autentisert, bare egen husstand, 10 per time per enhet, logges ikke). Merk: filen har husstandens felles data, også andre medlemmers etiketter og hendelser; fagperson må vurdere om det er riktig |
| Begrensning og innsigelse (art. 18, 21) | Behandling stanses eller begrenses | Vurderes enkeltvis |
| Trekke samtykke (art. 7 nr. 3) | Ikke aktuelt i piloten: vi lagrer ikke kostkrav (valg A) og har ingen samtykkebasert behandling | Gjelder hvis deling av kostkrav bygges (`06-samtykke-helsekost.md`) |

## 3. Bekrefte hvem som spør

Vi har ikke navn eller adresse på brukerne, og skal ikke samle dem bare for dette. Slik går vi frem (forslag):

1. **Selvbetjent er best.** Sletting gjøres i appen av husstandens **eier** (bekreftes ved å skrive SLETT). Andre medlemmer kan forlate husstanden. Da trengs ingen annen identifisering.
2. **Henvendelse per e-post:** vi har ingen kontoer og ingen e-postadresse per husstand, så vi kan ikke slå opp «hvem» ut fra en e-post. Enhets-id-en **vises** nå på Husstand-skjermen og i personvern-arket, så brukeren kan oppgi den; driftsansvarlig finner husstanden med `SELECT household_id FROM devices WHERE public_id = ?`. Id-en er ikke hemmelig (alle medlemmer ser den), så den alene bekrefter ikke identitet. I tillegg kan brukes en **nylig laget invitasjonskode** (driftsansvarlig kan slå opp kodens HMAC, som krever `SYNC_SECRET`) eller at brukeren beskriver etikettene i husstanden og omtrent når den ble laget. Svar på henvendelsens avsender. **Dette er svak identitetsbekreftelse og må vurderes av fagperson.** Uten noe av dette kan vi ikke finne husstanden, og vi skal ikke samle mer data for å kunne det.
3. **Medlemmer av samme husstand:** husstandens data tilhører husstanden. Alle voksne medlemmer kan se husstandens data. Fjerning av andre medlemmers opplysninger (f.eks. én voksens kostkrav) skal være mulig for den det gjelder. **Hvordan vi forholder oss til uenighet mellom medlemmer, må avklares av fagperson.**
4. **Er identiteten tvilsom:** be om bekreftelse på en annen måte, men ikke gi ut data.

## 4. Fremgangsmåte

### Innsyn
1. Registrer mottak. Bekreft identitet (avsnitt 3).
2. Hent ut husstandens data: tabellene `households`, `devices` (med fjernede), `invites` (uten kodene), `events` og `docs` for husstanden (spiseprofiler, plan, innstillinger, handleliste, beholdningslogg). Kostkrav og postnummer finnes ikke hos oss. Se `01-oversikt-behandling.md`, avsnitt 2b. Uttrekket krever tilgang til databasen: bare driftsansvarlig, og ikke mer enn nødvendig (se `docs/hosting.md` for hvordan man leser fra en kjørende container).
3. Legg ved: formål, grunnlag, mottakere (databehandlere), oppbevaringstid, rettigheter og klageadgang. Dette finnes i personvernerklæringen.
4. Send i et vanlig format. Sikre overføringen (ikke send sensitive data i åpen e-post; bruk kode i appen eller en nedlastingslenke som utløper).
5. Skriv at logger med IP-adresse bare finnes i [14] dager og vanligvis ikke kan kobles til husstanden. Be om dato og tidsrom hvis personen likevel vil ha dem.

### Retting
Rett opplysningen eller be brukeren gjøre det i appen. Informer eventuelle mottakere (databehandlere trenger normalt ikke varsel, men sikkerhetskopier retter seg ikke; se under).

### Sletting
1. Bekreft hvem som ber om det og at det gjelder hele husstanden eller bare enkeltopplysninger.
2. **Slett husstand i appen** (eier). Serveren sletter husstand, medlemmer og tokens, invitasjoner, plan, innstillinger, **hele hendelseslogg** (beholdning, handleliste, utsolgt/fant ikke) med kaskade; verifisert 2026-11-22 (punkt 5). Kostkrav, postnummer og samtykkelogg finnes ikke hos oss. Utboksen på brukerens enheter ligger lokalt og slettes bare på enhetene. Mistet eierenhet: se avsnitt 4, «Eier borte».
3. Bekreft sletting skriftlig. Opplys at:
   - data i **sikkerhetskopier** overskrives innen [30] dager og ikke brukes til noe annet enn gjenoppretting etter feil,
   - spor i databasens `-wal`-fil og i eldre volumkopier overskrives ved neste checkpoint eller når kopien slettes (driftsansvarlig kan tvinge en checkpoint, se `docs/hosting.md`),
   - lokale kopier på brukerens egne enheter (nettleserlagring) slettes av brukeren, f.eks. via «tøm data» i appen eller nettleseren,
   - logger med IP slettes etter [14] dager.
4. Hvis en gjenoppretting fra sikkerhetskopi gjøres, **slett igjen** de husstandene som ble slettet etter kopitidspunktet. Før en kort liste over slettede husstands-id-er (bare id og dato, ingen innhold) til dette formålet. **[Må avgjøres: en slik liste er selv en lagring; bør kunne forsvares og slettes etter kopiens levetid.]**

### Eier borte
Er eierens enhet borte, kan ingen fjerne medlemmer eller slette husstanden i appen (overføring av eierskap er ikke bygget; de andre kan bare forlate, og den siste som går sletter alt). Driftsansvarlig kan da slette husstanden direkte i databasen etter at identiteten er bekreftet etter avsnitt 3. **Rutinen og hvem som kan godkjenne slik sletting må avgjøres.**

### Avslag
Vi kan avslå eller begrense hvis det er lovlig grunn (f.eks. dokumentasjonsplikt eller andres rettigheter, må verifiseres). Begrunn skriftlig og opplys om klageadgang til Datatilsynet.

## 5. Krav til appen: status mot koden (2026-11-22)

Kontrollert mot koden (`server/sync/api.ts`, `server/storage/sqlite.ts`, `src/views/HouseholdView.tsx`) og, for sletting, en Docker-kjøring.

- [x] **Slett husstand** i appen, bekreftet i to trinn (skriv SLETT), sletter alle poster knyttet til husstanden, inkludert hendelseslogg: `ON DELETE CASCADE` fra `households` til `devices`, `invites`, `events`, `docs`; verifisert at `events` og `devices` ble borte. Bare eier kan slette.
- [~] Sletting er **idempotent**: en gjentatt `DELETE` kommer fra et token som ikke lenger finnes og gir `401` (ikke feil i betydningen datatap, men ikke `204` to ganger). Må avgjøres om det er godt nok (CLAUDE.md regel 8 gjelder importer og kjøpsbekreftelser).
- [x] Etter sletting **avvises** kall fra enheter som fortsatt har utboks til husstanden (`401`; prøvd for både lesing og skriving). De gjenoppretter ikke husstanden.
- [x] **Eksport** av husstandens data i JSON for medlemmer: «Last ned mine data» (Husstand-skjermen) og `GET /api/household/export`. Testet at andre husstander aldri kan eksporteres og at token, tokenhash, invitasjonskode og interne id-er aldri er med (`server/sync/api.test.ts`, `security.test.ts`, `npm run e2e:sync`).
- [x] **Vis enhets-id** på Husstand-skjermen og i personvern-arket.
- [x] **Personvern i appen:** arket «Personvern» (utkast, merket «ikke ferdig vurdert av fagperson»), fra Husstand-skjermen og bunnen av hver side.
- [n/a] **Samtykkebryter** for kostkrav som sletter dem fra serveren: ikke aktuelt (kostkrav lagres ikke på serveren).
- [x] Mulighet til å **fjerne en enhet** fra husstanden (eier) og å forlate den selv. **Svakhet:** fjernet enhet beholdes som rad med id og etikett til husstanden slettes.
- [x] Ingen kostkrav, tokens eller husstands-id-er i serverlogger: appen logger bare oppstart og `synk-feil: <feilmelding>`; ingen tilgangslogg. (Feilmeldingen er ikke kontrollert for alle databasefeil.)
- [x] «Tøm lokal data»: «Slett alt på denne enheten …» på Husstand-skjermen (alltid synlig, med bekreftelse), i tillegg til «Slett lokale data» i plan-skjemaet og valget ved sletting av husstand.
- [x] **Automatisk sletting etter inaktivitet:** `SYNC_RETENTION_DAYS` (standard 365, `0` = av; eierens valg 2026-11-22: 730), ved oppstart og hver 6. time, samme sletting som «Slett husstand». «Sist aktiv» = siste autentiserte kall fra en enhet i husstanden; inaktivitet er eneste kriterium, og ingen varsles på forhånd (vi har ingen kontakt). Loggen får bare antall. Se `docs/synk.md`, «Oppbevaringstid».

## 6. Personvernbrudd (kort)

Et personvernbrudd er brudd på sikkerheten som fører til utilsiktet tap, endring eller utlevering av personopplysninger. Slik går vi frem (må verifiseres):

1. Den som oppdager det, varsler **driftsansvarlig («Admin», rolle)** med en gang. Skriv ned tidspunkt, hva som skjedde og hva som er berørt.
2. Stans lekkasjen (rotér nøkler og tokens, ta ned tjenesten om nødvendig). Behold bevis.
3. Vurder risiko for de registrerte. Hvis bruddet sannsynligvis innebærer en risiko, meld til **Datatilsynet uten ugrunnet opphold og om mulig innen 72 timer** (art. 33, må verifiseres).
4. Er risikoen **høy** (f.eks. kostkrav eller helseopplysninger er lekket), varsle også de registrerte (art. 34, må verifiseres).
5. Føre alle avvik i en intern avviksliste, også de som ikke meldes.
6. Databehandler varsler oss; avtale hvor raskt (se `04-databehandleravtaler-sjekkliste.md`).

## 7. Svarmaler (innsyn)

> Hei. Vi har mottatt forespørselen din om innsyn i opplysninger vi har om husstanden din i Middagsplanlegger. Vedlagt (eller via lenken under, gyldig i 7 dager) er en kopi av opplysningene. Der står også hva vi bruker dem til, hvem som får dem, hvor lenge vi oppbevarer dem og hvilke rettigheter du har. Du kan be oss rette eller slette opplysningene, eller slette hele husstanden i appen. Hvis du mener vi behandler opplysninger feil, kan du klage til Datatilsynet. Hilsen [navn], [kontakt].
