# 01 Oversikt over behandlingen

> **UTKAST. Ikke juridisk rådgivning. Må kvalitetssikres av noen med personvernkompetanse.** Paragrafhenvisninger fra generell kunnskap, ikke kontrollert: «må verifiseres».
>
> **Avstemt 2026-11-22 mot synk-løsningen** (`docs/synk.md`, `server/sync/`, `server/storage/sqlite.ts`, `src/sync/`). Det som står om hva som lagres, er lest i koden og (for sletting, volum og sikkerhetskopi) prøvd i en Docker-kjøring; se `docs/hosting.md`. Det er fortsatt ikke vurdert av en fagperson.

Dette dokumentet kan danne grunnlag for oversikten over behandlingsaktiviteter (GDPR art. 30; om og hvordan plikten gjelder oss, må verifiseres, men siden vi kan behandle helseopplysninger bør vi regne med at vi må ha en).

## 1. Parter

| Rolle | Hvem |
| --- | --- |
| Behandlingsansvarlig | **[Må avklares av eier: juridisk person, navn, organisasjonsnummer, adresse]** |
| Kontakt for personvern | **[E-postadresse må opprettes]** |
| Personvernombud | Trolig ikke påkrevd i piloten (må verifiseres, art. 37) |
| Databehandlere | Hostingleverandør og tilleggstjenester, se `04-databehandleravtaler-sjekkliste.md` |

## 2. Hvilke data, hvorfor og på hvilket grunnlag

Utgangspunktet er datasparsomhet: appen trenger lite. Det som **ikke** samles inn: barns navn, presis posisjon, fødselsdato, adresse, e-post, passord, bilder, kvitteringer (bilder og kvitteringer hører til fase 3–4).

**Hvor opplysningene ligger.** Uten husstand ligger alt bare på brukerens enhet. Med husstand (synk) ligger *noe* i tillegg på serveren; kostkrav og postnummer gjør det **aldri** (se 2b).

| # | Opplysning | Beskrivelse (slik koden lagrer den) | Hvor | Formål | Grunnlag (art. 6) | Art. 9? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Husstandsinnstillinger | Valgte butikker, vanlig butikk, maks antall butikkstopp, grense for ekstra butikk, budsjett, om tilbud brukes, valgte kjeder for tilbud, hvilke dager det lages middag og hvor lang tid. **Postnummer er ikke med** | Enhet; server (dokumentet `innstillinger`) | Gjøre ukeplan og prisberegning | b) avtale om å levere tjenesten (må verifiseres: i en gratis pilot kan f) være et alternativ) | Nei |
| 1b | Postnummer | Brukes til «Nær meg» i kundeavisene | **Bare enhet**, synkes ikke | Vise lokale aviser | b) | Nei |
| 2 | Spiseprofiler | Etikett (fritekst, høyst 40 tegn; appen foreslår «Voksen 1», «Barn 1»), porsjonsstørrelse (tall), hvilke dager hjemme. **Ingen aldersgruppe og ingen navn i datamodellen**, men etikettfeltet hindrer ikke at noen skriver et navn eller en opplysning | Enhet; server (`innstillinger`) | Regne mengder og porsjoner | b) | Nei i seg selv |
| 3 | **Kostkrav og allergener** | Vegetar, valgte allergener, matvarer som skal unngås | **Bare enhet. Synkes ikke og lagres aldri på serveren** (valg A for piloten). Serveren avviser dokumenter som inneholder dem | Filtrere bort retter som ikke passer, på enheten | Ikke aktuelt for serveren. For lagring på brukerens egen enhet: se avsnitt 3 | **Ja, mulig** (helse, evt. religion/livssyn) |
| 4 | Plan, handleliste og avkrysninger | Valgte middager per dag (oppskrifts-id, låst/ikke, ekstra porsjon, matpakketype), godkjent ja/nei, valgt handletur; avkrysninger per enhet og manuelle linjer (**fritekst**, høyst 200 + 200 tegn) | Enhet; server (dokumentet `plan`, strømmen `liste`) | Levere tjenesten på tvers av enheter | b) | Nei, men kan avsløre kosthold (se 3) |
| 5 | Beholdning og kjøpshendelser | Hendelser: kjøpt, løst konflikt, angret, laget, telling, bekreftet rest, med uke, ingrediens, produkt, butikk, mengde og tidspunkt. Utsolgt/fant ikke/erstattet som egen strøm (`endring`) | Enhet; server (`events`) | Trekke varer fra behovet, unngå dobbeltkjøp | b) | Nei |
| 6 | Husstandsmedlemskap og enhetstoken | Tilfeldig offentlig enhets-id (`enhet-xxxxxxxx`), etikett (høyst 24 tegn), rolle (eier/voksen), sha256 av enhetstokenet, opprettet, sist sett (minutt), fjernet-tidspunkt | Server (`devices`); selve tokenet og enhets-id på enheten | Synk mellom enheter, tilgangskontroll | b) | Nei |
| 6b | Invitasjoner | HMAC av engangskoden, hvem som laget den, utløp (24 t), brukt av hvem | Server (`invites`) | Ta inn en annen voksen | b) | Nei |
| 7 | Kontoopplysninger | **Ingen i piloten:** ingen e-post, passord eller konto. Identitet er enhetstokenet. Konto med e-post er ikke bygget (`docs/synk.md`, «Ekte kontoer senere») | – | – | – | – |
| 8 | Tekniske data og logger | I vårt oppsett skriver appserveren bare oppstart og feilmeldinger, og Caddy-eksempelet har ikke tilgangslogg slått på. IP-adressen brukes av ratebegrensningen i **minnet** (nullstilles ved omstart). Leverandørens egne logger og brannmur kan likevel logge IP: **må sjekkes per leverandør** | Server, proxy, leverandør | Sikkerhet, feilsøking | f) berettiget interesse (interesseavveining må dokumenteres, må verifiseres) | Nei |
| 9 | Henvendelser | E-post eller skjema til støtte | Postkasse | Svare på henvendelser, innsyn, sletting | b)/c)/f) avhengig av innhold | Kan inneholde alt |
| 10 | Samtykkelogg | **Ikke bygget og ikke nødvendig i piloten:** uten serverlagring av kostkrav finnes ingen samtykkebasert behandling å dokumentere. Trengs hvis deling av kostkrav bygges senere (`06-samtykke-helsekost.md`) | – | – | – | – |
| 11 | Lokal lagring i nettleseren | Hele appens tilstand (`middag-state-v1`: plan, innstillinger inkl. kostkrav og postnummer, beholdning, handleliste, utboks, **enhetstokenet**) og enhets-id (`middag-enhet`) | Enhet (`localStorage`) | Appen skal virke uten nett | Se «Lokal lagring» under | Som over |
| 12 | Tidspunkt fra enhetens klokke | Hver hendelse har tidspunkt satt av enheten (`at`) og avgjør rekkefølgen i loggen. Serveren lagrer i tillegg når den mottok hendelsen (`received_at`) | Enhet; server | Riktig rekkefølge ved frakobling | b) | Nei |

**Ikke i piloten, kommer senere (egen vurdering før de bygges):** betaling og abonnement (fase 2–3), KI-forslag og bildetolkning (fase 3–4), deling av kvitteringspriser til Open Prices (eget, informert valg), varsler, markedsføring, konto med e-post. **Barns profiler skal aldri brukes til markedsføring** (planen). Vi selger ikke data og bruker ikke dem til profilering for annonser.

### 2b. Fasit: hva som ligger i serverens database

Tabellene i `server/storage/sqlite.ts`, en SQLite-fil (`middag.sqlite`, med `-wal` og `-shm` mens serveren kjører):

| Tabell | Kolonner med personrelevant innhold | Merknad |
| --- | --- | --- |
| `households` | tilfeldig id, opprettet, teller | Ingen navn eller adresse |
| `devices` | offentlig enhets-id, **etikett (fritekst ≤ 24)**, rolle, sha256 av token, opprettet, sist sett (avrundet til minutt), fjernet | Fjernede medlemmer beholdes som rad (se «Svakheter») |
| `invites` | HMAC av kode, laget av, utløp, brukt, brukt av | Brukte og utløpte ryddes når en ny lages |
| `events` | strøm, hendelsens JSON, hvilken enhet som sendte den, mottatt-tidspunkt | Beholdning, avkrysning/manuelle linjer, utsolgt/fant ikke. Vokser uten tak |
| `docs` | JSON for `plan` og `innstillinger`, versjon, hvem som endret sist (offentlig id), tidspunkt | Etiketter for spiseprofiler (fritekst ≤ 40) ligger her |

**Lagres aldri på serveren** (verifisert i `server/sync/api.ts` og `src/sync/docs.ts`; serveren avviser dokumenter med ukjente felt): postnummer, kostkrav og allergier (`avoid`, `avoidFoods`, `vegetarian`), det gamle matskapsfeltet, tilbud fra Tjek (holdes bare i serverens minne i seks timer og lagres ikke på disk), planversjoner/historikk (`planHistory`, lokal), passord, e-post, navn og posisjon.

**Vær ærlig om det indirekte:** at kostkrav ikke er et felt på serveren, betyr ikke at serveren ikke kan si noe om kosthold. Planen (hvilke retter), handlelisten og beholdningen viser hva husstanden spiser og kjøper, og manuelle linjer og etiketter er fritekst. En husstand som bare planlegger vegetarmiddager, eller kjøper «glutenfri» pasta, avslører det til den som leser databasen. Dette er et skjønnsspørsmål for fagpersonen (se avsnitt 3 og 8).

### Data som ikke er persondata om brukerne
Tilbud hentes av **serveren** fra Tjek på varenavn. Ingen brukerdata sendes til Tjek, og Tjek ser bare serverens IP-adresse. Katalogdata og demodata (butikker, priser, oppskrifter) er ikke personopplysninger. Merk: demodata skal alltid være merket som demodata (CLAUDE.md regel 5).

## 3. Når artikkel 9 kommer inn

Artikkel 9 gjelder «særlige kategorier», blant annet helseopplysninger og opplysninger om religiøs eller filosofisk overbevisning. Behandling er som hovedregel forbudt med mindre et unntak i art. 9 nr. 2 gjelder.

- **Allergier og intoleranser** (f.eks. gluten, melk, nøtter): helseopplysninger. Et filter «unngå gluten» kan i praksis tilsi cøliaki, selv uten diagnose (planen sier det samme).
- **Kostkrav** som svin, storfe eller skalldyr kan antyde religiøs overbevisning. **Vegetar/vegan** kan være etisk eller filosofisk overbevisning. Om dette utløser art. 9, er et tolkningsspørsmål som må avklares med en fagperson.

**Valg A for piloten (bygget): kostkrav og allergier synkes ikke og lagres ikke på serveren.** Felt: `avoid`, `avoidFoods`, `vegetarian`. De ligger bare i `localStorage` på hver enhet. Serveren avviser dokumenter som inneholder dem, og `src/sync/engine.test.ts` har en test for at de ikke synkes. Hva det betyr for vurderingen:

1. **Det uttrykkelige samtykket etter art. 9 nr. 2 a for *serverlagring* er ikke nødvendig i piloten**, fordi vi ikke lagrer kostkravene hos oss. Samtykkeskjermen i `06-samtykke-helsekost.md` er derfor **ikke bygget** og trengs først hvis deling av kostkrav mellom enheter bygges.
2. **Lagring på brukerens egen enhet** er fortsatt behandling av helseopplysninger på et sted vi ikke kontrollerer. Om det regnes som *vår* behandling (vi leverer programvaren, men ser ikke dataene), må en fagperson svare på. Planen vår forutsetter at det er brukerens eget utstyr og at vi ikke mottar dem.
3. **Indirekte avledning er ikke utelukket** (se 2b): plan, handleliste, beholdning, manuelle linjer og etiketter kan avsløre kosthold eller helse selv uten kostkravfeltene. Fritekst er det svakeste punktet; appen råder til etiketter, men validerer ikke innholdet. **Fagpersonen må avgjøre** om dette gjør at hele husstandsdatasettet bør behandles som potensielt særlige kategorier, eller om det er for indirekte til å telle.
4. **Pris for valg A:** en voksen som har satt allergier på sin enhet, deler dem ikke med den andre. Planen på en enhet uten allergifilter kan da inneholde allergener for hele husstanden (kjent svakhet i `docs/synk.md`; varsel i plan-skjemaet). Det er en **produktsikkerhetsrisiko**, ikke bare en personvernavveining, og eier bør vite at den er akseptert i piloten.
5. Appens regel er uendret: appen garanterer aldri allergenfrihet (CLAUDE.md regel 4).

- **Betydning av koblingen:** opplysningene som *er* på serveren er knyttet til en husstand (tilfeldig id) og ofte til en spiseprofil («Barn 1»). Det gjør dem identifiserbare i husstandens egen sammenheng, og de er personopplysninger selv uten navn (må verifiseres).
- **Konsekvens for design (status):** (1) kostkrav bare på enheten: **gjort**; (2) husstandsnivå, ikke per person: **gjort** (`Settings` har `avoid`/`avoidFoods`/`vegetarian` på husstandsnivå, `Eater` har bare etikett, porsjon og dager hjemme); (3) aldri kostkrav i delbare lenker, logger eller feilmeldinger: invitasjonslenken har bare en kode i fragmentet (`#bli-med=`), og serveren logger ikke innhold.

## 4. Oppbevaringstid (forslag, må godkjennes av eier)

| Data | Forslag til oppbevaring | Slik er det bygget i dag |
| --- | --- | --- |
| Husstandsdata (1–6) | Så lenge husstanden bruker appen. Slettes automatisk **[12] måneder** etter siste aktivitet. Slettes straks ved sletting av husstand | **Sletting på forespørsel virker** («Slett husstanden», bare eier, bekreftes ved å skrive SLETT; siste medlem som forlater slettet også). **Automatisk sletting etter inaktivitet er ikke bygget.** Tallet [12] er et forslag. `last_seen` finnes og kan brukes til en slik rutine, men ingen kjører den |
| Hendelser (`events`) | Samme som husstandsdata. Kan kortes ned (f.eks. gamle uker) | Vokser uten tak og komprimeres ikke. Oppbevaringstid for gamle uker er ikke bestemt |
| Kostkrav (3) | – | Lagres ikke på serveren (valg A). På enheten til brukeren trekkes de ved «Slett lokale data» |
| Fjernede medlemmer | Slettes ved fjerning, eller senest sammen med husstanden | **Beholdes som rad** (offentlig id, etikett, uten token) til husstanden slettes. Se «Svakheter» |
| Serverlogger med IP | **[14] dager** hvis noe logges | Appserveren og Caddy-eksempelet logger ikke IP. Dockers loggfil er størrelsesbegrenset (3 × 10 MB), ikke tidsbegrenset. Leverandørlogger: må sjekkes |
| Sikkerhetskopier | Overskrives etter **[30] dager** | `docs/drift/backup.sh` sletter lokale kopier eldre enn 30 dager. Kopier som lastes opp andre steder må ha egen slettefrist. Slettede data finnes i kopier til da. Må opplyses om |
| Samtykkelogg | – | Ikke aktuelt i piloten (ingen samtykkebasert serverlagring) |
| Henvendelser | **[12] måneder** etter avsluttet sak | Forslag |
| Regnskapsdata (fase 2+) | Etter regnskapsregler (må verifiseres) | Ikke i piloten |

**Sletting av husstand (verifisert).** `DELETE /api/household` sletter raden i `households`, og `devices`, `invites`, `events` og `docs` har `ON DELETE CASCADE` (`PRAGMA foreign_keys = ON`). I en Docker-kjøring 2026-11-22 gikk en husstand med ett medlem og én hendelse ble borte (`households` 2→1, `devices` 2→1, `events` 1→0; én annen husstands rader var urørt), og det gamle tokenet ga 401 på både lesing og skriving etterpå (en slettet husstand kan ikke gjenopprettes ved senere synk fra en enhet som har utboks). Beholdningsloggen og utboksen **på serveren** er dermed slettet. Utboksen **på brukerens enheter** ligger i `localStorage` og slettes bare hvis brukeren velger «Slett også alt som er lagret på denne enheten», eller «Slett lokale data».

**Hva «slettet» betyr fysisk.** Databasen har `PRAGMA secure_delete = ON`, så slettede sider nulles i databasefilen. Men databasen kjører i WAL-modus: i en test lå en slettet husstands etikett fortsatt i `-wal`-filen etter slettingen, og var borte først etter en checkpoint (`PRAGMA wal_checkpoint(TRUNCATE)`). Rader er altså borte for appen med en gang, men kan ligge fysisk igjen i WAL-filen en kort tid (til neste automatiske checkpoint). Det er sannsynligvis akseptabelt, men en fagperson bør vurdere det, og en kopi eller et øyeblikksbilde av volumet tatt i det vinduet inneholder dataene. Sikkerhetskopier og eldre volumer inneholder slettede husstander til de overskrives (`05-innsyn-retting-sletting.md`).

Beholdningsloggen er en hendelseslogg (`src/engine/inventory.ts`). Sletting av husstand sletter hele loggen og utboksen på serveren, ikke bare den avledede tilstanden.

## 5. Hvem har tilgang

| Hvem | Til hva | Hvordan |
| --- | --- | --- |
| Husstandens medlemmer | Husstandens egne data (alle voksne kan se og endre alt, også andres avkrysninger og planen) | Gjennom appen, med enhetstoken (ingen konto) |
| Driftsansvarlig (navngitt person) | Servere og databasefil, ved feilretting | Personlig tilgang, nøkkel eller to-faktor, ingen delte passord. Tilgang logges der det er mulig |
| Utvikler | Kode og testdata, **ikke** produksjonsdata som hovedregel | Feilsøking i produksjon bare når nødvendig og dokumentert |
| Redaktør (oppskrifter, varekoblinger) | Katalog, ikke husstandsdata | Egen rolle uten tilgang til husstander |
| Hostingleverandør (databehandler) | Teknisk tilgang til infrastruktur | Underlagt databehandleravtale |
| Tjek, Kassalapp | Ingen husstandsdata | Serveren sender bare varesøk. Tilbud lagres aldri |

Prinsipp: minst mulig tilgang, navngitte personer, og en liste over hvem som har tilgang som oppdateres ved endringer. **[Eier fører listen.]**

## 6. Lokal lagring i nettleseren

Appen lagrer hele sin tilstand (plan, innstillinger, **kostkrav og postnummer**, beholdning, handleliste, utboks) under nøkkelen `middag-state-v1` i `localStorage`, og en tilfeldig enhets-id under `middag-enhet`, for at den skal virke uten nett. **Når enheten er med i en husstand, ligger også enhetstokenet i klartekst i `middag-state-v1`.** Det betyr at skadelig kode i appen (XSS) som kan lese `localStorage` får full tilgang til husstanden, og at den som har tilgang til en ulåst telefon eller nettleserprofil har det samme. Det finnes ingen utløpstid eller rotasjon av tokenet; en tapt enhet må fjernes av eieren. Sikkerhetsgjennomgangen (`docs/sikkerhet.md`, hvis den foreligger) og et CSP-hode foran appen er tiltak som ikke er på plass i dette dokumentets versjon.

Lagring av opplysninger i brukerens utstyr er regulert av ekomloven (samtykke kreves som hovedregel, med unntak for lagring som er strengt nødvendig for en tjeneste brukeren ber om). Hvilken paragraf og om vår bruk faller under unntaket, må verifiseres. Vi bruker ingen sporings- eller annonseinformasjonskapsler, ingen informasjonskapsler i det hele tatt (tokenet sendes i `Authorization`-hodet), og bør ikke innføre det uten ny vurdering. Appen viser i dag ingen lenke til personvernerklæringen (ingen treff på «personvern» i `src/`): den må på plass før piloten.

**Klientklokken.** Tidspunktet på hver hendelse (`at`) settes av enheten og bestemmer rekkefølgen i loggen. En enhet med feil klokke, eller et medlem som vil, kan tilbakedatere hendelser; serveren sjekker bare formatet. Det er et integritets-, ikke et personvernproblem, men tidspunktene er en del av dataene som lagres.

## 7. Sikkerhetstiltak (minimum, art. 32 må verifiseres)

- HTTPS overalt (Caddy-eksempelet i `docs/drift/`), ingen hemmeligheter i repoet eller imaget (CLAUDE.md regel 7). `SYNC_SECRET` og andre hemmeligheter ligger i en miljøfil (`.env.drift`) utenfor git.
- Enhetstoken: 32 tilfeldige byte, bare sha256 lagret. Invitasjonskoder: 50 bit, HMAC, 24 timer, én gang, ratebegrenset (`docs/synk.md`, «Sikkerhet»).
- Kryptert sikkerhetskopi i EØS, gjenopprettingsøvelse før piloten (`docs/hosting.md`; en øvelse er kjørt i en testkjøring, ikke hos en leverandør).
- Ingen kryptering i hvile utover det plattformen gir (diskkryptering hos leverandøren må avklares).
- Tilgang bare for navngitte personer, to-faktor på hosting- og domenekonto.
- Rutiner for sletting (`05-innsyn-retting-sletting.md`) og avvik.
- Oppdateringer av server og avhengigheter; CI kjører typesjekk, tester, kontrast og bygg (`.github/workflows/ci.yml`).
- Appserveren kjører som ikke-privilegert bruker (uid 1000) i en container med skrivebeskyttet filsystem unntatt datavolumet (`docs/drift/docker-compose.yml`).

## 8. Svakheter og åpne punkter

**Kjente svakheter i dagens løsning (fra `docs/synk.md` og koden), relevante for personvern:**

1. **Fjernede medlemmer beholdes som rad** (offentlig id, etikett, uten token) til husstanden slettes, og hendelsene deres blir i loggen. Etiketten kan være et navn. Fjerning bør derfor også tømme etiketten, og en rutine for å slette gamle fjernede rader trengs. *Sikkerhetsøkten kan rette dette.*
2. **Token i `localStorage`**, ingen utløp (se avsnitt 6).
3. **Etiketter og manuelle linjer er fritekst** og kan inneholde navn eller opplysninger om helse. Validerer lengde og kontrolltegn, ikke innhold.
4. **Ingen automatisk sletting etter inaktivitet, ingen kvoter, ingen komprimering av loggen.**
5. **Alle voksne kan alt** og det finnes ingen historikk over hvem som endret plan og innstillinger (serveren lagrer bare siste endrer).
6. **Invitasjon uten godkjenning:** den som har en gyldig kode innen 24 timer blir medlem.
7. **Ingen eksport av husstandens data i appen** (innsyn/portabilitet må gjøres manuelt, se `05-innsyn-retting-sletting.md`).
8. **Slettede data kan ligge i `-wal`-filen en kort tid og i sikkerhetskopier** (avsnitt 4).
9. **Allergier deles ikke mellom enheter** (avsnitt 3, punkt 4).

**Åpne punkter som krever eier eller fagperson:**

1. Behandlingsansvarlig og kontaktadresse.
2. Juridisk avklaring av art. 9: gjelder det kostkrav lagret bare på brukerens enhet, og er indirekte avledning fra plan/handleliste/fritekst nok til å regne husstandsdata som særlige kategorier?
3. Oppbevaringstider og om automatisk sletting etter inaktivitet skal bygges før piloten.
4. Valg av hosting (påvirker underleverandører og overføringer), og om leverandøren logger IP.
5. Om etiketter bør begrenses mer (f.eks. forhåndsdefinerte etiketter) for å redusere fritekst.
6. Om `sist sett` (minutt-oppløsning) og enhetsetiketter er nødvendige, eller kan fjernes.
