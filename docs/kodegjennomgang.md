# Kodegjennomgang 2026-11-22

Uavhengig gjennomgang av hele repoet på branch `claude/middagsplanner-app-wwuq1p`, delt i fire områder: motor (`src/engine/`), synk og server (`src/sync/`, `server/`), visninger (`src/views/`, `App.tsx`, `store.ts`) og tilbud (`src/offers/`, `server/index.ts`). Hvert funn som er rettet, har en test som feilet før rettingen. Der testen ikke kan skrives uten nettleser (fokus, React-tilstand), er rettingen begrunnet i koden.

**Alvorlighet.** *Høy:* bryter en regel i CLAUDE.md, gir datatap eller stopper synk. *Middels:* feil sum, feil visning eller feil tilstand som brukeren kan merke. *Lav:* småfeil, tekst eller manglende vern uten kjent skade.

| Alvorlighet | Funn | Rettet | Åpne |
|---|---|---|---|
| Høy | 9 | 9 | 0 |
| Middels | 15 | 12 + 1 delvis | 2 |
| Lav | 12 | 7 | 5 |
| **Sum** | **36** | **28 + 1 delvis** | **7** |

Oppdatert 2026-11-22: E7, S1 og S2 er rettet (se «Rettet»). Runde 2 (alt bygget etter `c137674`) står nederst: 21 funn, 17 rettet og 1 delvis.

## Åpne funn (produktbeslutning eller for store til å rette her)

| # | Alv. | Fil:linje | Funn | Reproduksjon | Anbefaling |
|---|---|---|---|---|---|
| V7 | Middels | `src/store.ts:116` | Med appen åpen i to faner skriver hver fane hele tilstanden til samme localStorage-nøkkel. En fane kan da slette den andre fanens usendte utboks. | Fane A markerer kjøp (utboks = [kjøp]). Fane B, åpnet tidligere, krysser av en vare og skriver uten kjøpet. Etter ny innlasting er kjøpet borte. | Lytt på `storage`-hendelsen og flett de idempotente loggene og utboksene, eller tillat bare én aktiv fane (BroadcastChannel). |
| O5 | Middels | `src/offers/service.ts:19` | Én feilet Tjek-forespørsel forkaster hele innsamlingen (cirka 80 kall i rekke), og det kommer et nytt forsøk først etter fem minutter. Det er bevisst: testen «lar kildefeil boble opp» krever det, og nedkjølingen vernet Tjek. Nå har hvert kall også tidsavbrudd (O6). | Kall 60 av 80 får 429. Svaret blir status `error` i fem minutter. | Bestem om et delvis resultat skal vises, merket som ufullstendig. |
| O4b | Middels | `src/offers/tjek.ts:109` | Tilbud uten `dealer.country` slippes gjennom landfilteret. Valutadelen er rettet (O4). | Et tilbud uten land i et søk med `country_id=NO` tas med. | Krev land bare når Tjek-svaret alltid har det. Phase 0 sier at feltet finnes, men ikke at det alltid er med. Sjekk mot Tjek før det strammes inn. |
| S6 | Lav | `server/sync/api.ts:384` | `/healthz` har ingen ratebegrensning, og hvert kall går til databasen. CLAUDE.md sier at alle endepunkter skal ha ratebegrensning. | Ubegrensede anonyme kall. | IP-grense eller et unntak dokumentert i `docs/sikkerhet.md`. Hører til synk-økten. |
| S7 | Lav | `server/sync/api.test.ts` | De negative testene for `bare_eier`, ugyldig anker og ukjente felt ligger i `api.test.ts`, ikke i `security.test.ts` som CLAUDE.md krever. Det gjelder også testen for anker med linjeskift fra denne gjennomgangen. | – | Flytt testene når synk-økten er ferdig med filene. |
| O8 | Lav | `server/index.ts:68` | `/api/offers` har ingen ratebegrensning. Svaret kommer fra minnet, så Tjek beskyttes av hurtigbufferen og nedkjølingen, men CLAUDE.md krever ratebegrensning på alle endepunkter. | Ubegrensede anonyme kall. | Bruk `RateLimiter` fra synk-API-et. |
| V10 | Lav | `src/App.tsx` (synkchip) | Chipen «⚠ Konflikt» teller også konflikter i handlelista (valg på linjer og godkjente lister), men Husstand-siden forklarer bare dokument- og kjøpskonflikter. | To enheter velger ulikt på én linje. Brukeren trykker på chipen og ser ingenting å løse. | Vis en lenke til Handleliste på Husstand-siden. HouseholdView eies nå av økten «innsyn-og-sletting». |
| O10 | Lav | `src/offers/match.ts:101` | `unitPriceOre` er dokumentert som «per stk» for stykkvarer, men regnes bare fra `amount`. Eggtilbud sorteres derfor sist. | Tilbud med enhet `pcs` og 12 stk får `unitPriceOre = null`. | Bruk `priceOre / pieces` for stykkvarer. Påvirker bare sortering. |

## Rettet

| # | Alv. | Fil | Funn | Test (feilet før retting) |
|---|---|---|---|---|
| S1 | Høy | `src/sync/engine.ts` (`receiveDoc`, `restoredOrder`), `server/storage/sqlite.ts`, `server/sync/api.ts` | Etter gjenoppretting fra eldre kopi tok en enhet serverens versjon som ny base og sendte sin lokale verdi uten fletting, så to enheter overskrev hverandre (siste skriving vinner). Nå har hver dokumentversjon en slekt (`revs`, innholdsadressert rev for de siste 100 versjonene), og enheten beholder basen fra før gjenopprettingen. Neste versjon fra serveren flettes tre-veis mot den basen: nyere (basen står i serverens slekt, ellers serverens klokke) flettes som vanlig med konflikt der begge har endret, en eldre kopi (serverens versjon står i basens slekt) overses og lokal verdi sendes, og uten slekt og tid blir hvert ulikt felt en konflikt. Valgt løsning er (a) fra anbefalingen, med slekten som rekkefølge i stedet for epoke. | `engine.test.ts`: «S1: etter gjenoppretting flettes dokumentene tre-veis …», «S1: begge har endret samme felt …», «S1: eldre kopi (i basens slekt eller eldre tid) overses …», 409-testen (sier nå hvilket budsjett som vinner); `api.test.ts`: «dokumenter har en slekt (revs) …», «eldre database uten slekt …» |
| S2 | Høy | `server/storage/sqlite.ts` (`readSince`), `server/sync/api.ts`, `src/sync/engine.ts` | Ankeret ble bare flyttet når en pull hadde hendelser, mens cursor fulgte `head` (også dokumentskrivinger), så cursor kunne ligge foran ankeret og en gjenoppretting ble ikke oppdaget. Nå står cursor alltid på siste hendelse (ankeret), og dokumentene hentes med dokumentanker (`docs=navn:versjon:rev`): serveren sender hvert dokument som er ulikt enhetens, uansett `seq`, og enheten oppdager selv at serveren har mistet en versjon (`lostDoc`) og starter på nytt som ved `reset`. Eldre lagret cursor etter ankeret hentes fra ankeret. Gjenværende smale tilfeller (ikke dokumenter) står i `docs/synk.md`, «Kjente svakheter». | `engine.test.ts`: «S2: ankeret dekker cursor som har flyttet seg på grunn av dokumenter», «lostDoc …», «dokumentanker …»; `api.test.ts`: «cursor står alltid på en hendelse …»; `security.test.ts`: «ugyldig dokumentanker gir 400 …», «slekten (revs) … ikke med i eksporten» |
| S3 | Høy | `server/sync/api.ts` | Et hendelses-id med linjeskift (`\n`, ` `) ga et anker serveren avviste med 400. Alle andre enheter i husstanden ble stående fast i «feil». Regexen godtar nå alle tegn. | `api.test.ts`: «et hendelses-id med linjeskift låser ikke andre enheters synk» |
| S4 | Høy | `src/sync/engine.ts` | Ble en gjenoppretting oppdaget gjennom 409 på et dokument, ble bare dokumentet nullstilt. Egne hendelser fra etter kopien ble aldri sendt på nytt. Nå kjøres `resetForRestore` og en ny runde, som ved `reset`. | `engine.test.ts`: «oppdages også når bare dokumentet viser det (409 …)» |
| V1 | Høy | `src/views/WeekView.tsx`, `src/views/lunch.ts`, `src/store.ts` | En matpakke fra søndag fikk `extraFor: 7`. `isValidDoc` godtar bare 0–6, så planen sluttet å synke uten feilmelding. Nå gir søndag «Senere», og eldre lagret tilstand ryddes ved innlasting. | `src/views/lunch.test.ts` |
| V2 | Høy | `src/views/PapersView.tsx`, `papers/offerList.ts` | «Legg i ukeplan» fra et tilbud viste og låste retter som bryter allergi-, kost- eller råvarekrav (regel 4). Nå vises bare retter som oppfyller kravene (`offerRecipes`), og låsen følger `requirementViolation`. | `offerList.test.ts`: «foreslår aldri retter som bryter allergi- eller kostkrav» |
| V8 | Høy | `src/views/PapersView.tsx` | «Bare legg i handlelista» lagret Tjek-overskriften og -prisen i den delte lista, som synkes. CLAUDE.md sier at tilbud fra Tjek ikke synkes og ikke lagres. For levende tilbud lagres nå bare varenavnet og «tilbud hos ‹kjede›». Demoavisene er uendret. | Begrunnet i koden (UI-tilstand). |
| O1 | Høy | `src/offers/tjek.ts` | Gyldighet ble lest som UTC-dato (`slice(0, 10)`). Et tilbud fra mandag 00:00 norsk tid (søndag 23:00 UTC) gjaldt derfor på søndag og senket «Med kontrollerte tilbud». Nå brukes norsk dato (`osloDate`), og slutt ved midnatt er eksklusiv. | `offers.test.ts`: «gyldighet regnes i norsk tid» |
| E7 | Høy | `src/engine/prices.ts` (`resolvePrice`), brukt av `bestOffer` i `planner.ts` og `priceIn` i `substitution.ts` | Laveste gyldige pris ble valgt blant alle observasjoner uansett alder, så et gammelt tilbud uten `validUntil` eller en gammel, lavere ordinær pris slo en nyere pris (regel 2). Brukerens beslutning: bare observasjoner høyst `MAX_PRICE_AGE_DAYS` (14) dager eldre enn handledagen er kjent pris. Finnes ingen slik, brukes den nyeste eldre observasjonen som estimat med dato og kilde; et gammelt tilbud uten gyldighet brukes aldri. En gammel pris taper alltid mot en ny i butikkvalget, også når den er lavere. Uten handledag måles alder mot nyeste observasjon i katalogen (ingen klokke i motoren). Handlelista viser «estimert pris, sist sett ‹dato›» og en forklaring på detaljsiden (`src/views/priceText.ts`). Merk: demoprisene er observert 2026-11-17 og vises som estimat fra handledag 2026-12-02. | `planner.test.ts`: «regresjon: gamle prisobservasjoner er estimat (E7)» (fem av seks tester feilet før; konstanttesten krever bare at `prices.ts` finnes) |
| E1 | Middels | `src/engine/substitution.ts` | Gjorde brukeren en endring før listen ble godkjent, laget «Godkjenn» ingen versjon (samme grunnlag), og ingenting ble holdt fast. `approvalVersion` teller nå bare versjoner som `pinState` godtar. | `substitution.test.ts`: «godkjenning etter en endring gjort før listen var godkjent …» |
| E2 | Middels | `src/engine/inventory.ts` | En `løs` eller `angre` etter ukas første kjøp endret likevel ukas beholdning, fordi linja beholdt tidspunktet for første kjøp. `deriveStock` regner nå tilstanden bare av hendelser før cutoff. | `inventory.test.ts`: «en konflikt i forrige uke som løses etter ukas første kjøp …» |
| E3 | Middels | `src/engine/inventory.ts` | En rettet rest etter cutoff fjernet resten som gjaldt før. Rettes av samme endring som E2. | `inventory.test.ts`: «en rettet rest etter ukas første kjøp …» |
| E4 | Middels | `src/engine/deals.ts` | Et tilbud i feil enhet kunne skygge for et gyldig tilbud i riktig enhet, så retten fikk null i besparelse. Nå konkurrerer bare tilbud i ingrediensens egen enhet. | `planner.test.ts`: «et tilbud i feil enhet skygger ikke …» |
| E5 | Middels | `src/engine/planner.ts` | En pris på 0 øre (eller som ikke er hele øre) ble regnet som kjent og kunne vinne butikksammenligningen. Produktstørrelse 0 ga summen `Infinity`. Begge hoppes nå over, som i `priceIn`. | `planner.test.ts`: «en pris på 0 øre eller produktstørrelse 0 …» |
| E6 | Middels | `src/engine/planner.ts` | Et bytteforslag mot en kurv med ukjent pris ble vist som «−X kr» og foreslått som budsjettgrep (regel 3). Forslaget merkes nå som ufullstendig når nåværende kurv ikke er komplett. | `planner.test.ts`: «bytteforslag mot en kurv med ukjent pris …» |
| V3 | Middels | `src/views/PapersView.tsx`, `data/newspapers.ts` | Et levende tilbud uten pris ble vist og lagret som «0 kr». Nå vises «pris ukjent». | Begrunnet i koden. |
| V4 | Middels | `src/views/PapersView.tsx` | ← fra et levende tilbud åpnet en kunstig avisside merket som demodata, med en ekte kjede. Nå går ← tilbake til lista. | Begrunnet i koden. |
| V5 | Middels | `src/views/PlanForm.tsx` | `Step` var en komponent definert inne i gjengivelsen. Knappene ble montert på nytt etter hvert trykk, så fokus forsvant for tastatur- og skjermleserbrukere. `Step` er flyttet til modulnivå. | Begrunnet i koden (a11y). |
| V6 | Middels | `src/views/ListView.tsx` | Detaljsiden viste en gammel kopi av linja. «Marker som handlet» kunne da registrere kjøp på et produkt som var byttet ut. Linja slås nå opp i gjeldende kurv ved hver gjengivelse. | Begrunnet i koden. |
| O2 | Middels | `src/offers/match.ts` | Tvetydighetssjekken så bare på de to første godkjente reglene. En tredje, like lang regel for en annen ingrediens kunne skjules, og koblingen ble godkjent. | `offers.test.ts`: «like lange godkjente mønstre …» |
| O3 | Middels | `src/offers/tjek.ts` | En mengde gitt som spenn («400–700 g») ble lest som 400 g og regnet som kjent. Nå er mengden ukjent, og tilbudet går til kontroll. | `offers.test.ts`: «mengde som spenn …» |
| O4 | Middels (delvis) | `src/offers/tjek.ts` | En pris i annen valuta enn NOK ble lest som kroner. Nå blir prisen ukjent (og tilbudet går til kontroll). Landfilteret står åpent (O4b). | `offers.test.ts`: «tilbud i annen valuta enn NOK …» |
| E8 | Lav | `src/engine/deals.ts`, `offerTotal.ts` | En førpris som ikke var hele øre ga besparelse og sum med desimaler. Den teller nå som manglende førpris (`prePrice`). | `planner.test.ts`: «førpris som ikke er heltall øre …» |
| E9 | Lav | `src/engine/format.ts` | 999,6 g ble vist som «1 000 g», og 30 øre som «+0 kr». | `format.test.ts` |
| S5 | Lav | `src/sync/engine.ts` | Uten nett ble status «feil» hvis forrige runde endte med serverfeil. Nå blir den «venter». | `engine.test.ts`: «feil som ikke bare er manglende nett …» |
| V9 | Lav | `src/views/PantryView.tsx` | Matskapet sa «Deling mellom enheter finnes ikke ennå» også for enheter i en husstand. | – |
| O6 | Lav | `server/index.ts` | Kall mot Tjek hadde ikke tidsavbrudd, så et Tjek som hang ga «loading» i flere minutter. Nå er det 15 s per kall. | – |
| O7 | Lav | `src/offers/tjek.ts` | Omregning av hg og dl ga flyttallsrester (229,99999 g). | `offers.test.ts`: «pakningsstørrelser regnes om …» |
| O9 | Lav | `src/offers/match.ts` | Dobbelt eller hardt mellomrom i overskriften hindret treff på søkeord med to ord. | `offers.test.ts`: «flere mellomrom eller hardt mellomrom …» |

## Ingen tester er slettet eller svekket

Én eksisterende test er utvidet: `engine.test.ts`, synkstatus uten nett. 409-testen («oppdages også når bare dokumentet viser det») er strammet inn ved rettingen av S1: den sier nå at A sitt budsjett vinner hos begge uten konflikt. Med dokumentanker oppdages gjenopprettingen i den testen allerede ved pull; 409-grenen er beholdt (nå også med slekten) for en gjenoppretting mellom pull og PUT.

E7 endret én forventning etter brukerens beslutning: `fase2.test.ts` «demokatalogens laksetilbud er satt langt frem …» ventet `tilbud` på handledag 2027-06-01 for en observasjon fra 2026-11-17. Den venter nå `estimat` med dato og kilde, og laks er fortsatt priset (det testen skulle sikre). Samme test sjekker at tilbudet er `tilbud` på 2026-11-23.

## Vurdering: lukket pilot

Lukket pilot er forsvarlig. Begge forbeholdene fra gjennomgangen er rettet.

1. **Gjenoppretting av serveren (S1, S2):** rettet 2026-11-22. Plan og innstillinger flettes tre-veis etter en gjenoppretting, og ankeret dekker hele cursoren. Forbeholdet i pilot-sjekklisten (ikke gjenopprett mens husstander er aktive) er fjernet. Gjenopprettingsøvelsen (C7, C9) gjelder fortsatt.
2. **Ekte priser (E7):** rettet. Observasjoner eldre enn 14 dager før handledagen er bare estimat med dato og vinner aldri over en nyere pris. Importen må fortsatt gi riktig `observed` (datoen prisen ble sett, ikke importdatoen).

Resten av de åpne funnene er småting eller produktvalg uten kjent skade for en lukket pilot. Motoren er deterministisk (ingen `Date.now`, `Math.random` eller nettverk i `src/engine/`, sjekket med grep). Beløp er hele øre også ved ugyldige tilbudsdata. Allergi- og kostkrav slår nå tilbud også i kundeavisvisningen.

## Runde 2 (2026-11-22)

Ny, uavhengig gjennomgang av alt som er bygget siden første runde (commit `c137674`, 26 commits):
- prisalder (`src/engine/prices.ts`);
- dokumentslekt og tre-veis fletting etter gjenoppretting (`revs`, `lostDoc`, dokumentanker);
- innsyn og eksport, oppbevaringsjobben og tokenutløp;
- tilbudslagring og innsamleren (`server/offers/`);
- avis- og bildeendepunktene og CSP;
- «Lag nå», basisvarer og husholdningsvarer;
- personvernarket.

Gjennomgangen er delt i fire områder (motor, synk, tilbud/server, visninger). Alvorlighet er definert som i første runde.

**Regler for funnene:**
- Hvert funn har en test som feilet før rettingen, eller kodebevis med linje der testen krever en nettleser.
- Åpne funn som kan testes, står som `it.fails` med merknaden «ÅPENT». De blir røde når noen retter dem, og da byttes de til `it`.
- Ingen eksisterende test er slettet eller svekket.

Testene ligger her:
- `src/engine/planner.test.ts`: «regresjon: kodegjennomgang runde 2, M…»
- `src/sync/engine.test.ts` og `server/sync/api.test.ts`: «kodegjennomgang runde 2 …»
- `server/offers/kodegjennomgang2.test.ts`
- `src/acceptance/kodegjennomgang2-ui.test.tsx`

| Alvorlighet | Funn | Rettet | Åpne |
|---|---|---|---|
| Høy | 2 | 2 | 0 |
| Middels | 2 | 2 | 0 |
| Lav | 17 | 13 + 1 delvis | 3 + resten av V17 |
| **Sum** | **21** | **17 + 1 delvis** | **3 + 1 delvis** |

S8 og S9 er satt til Høy fordi definisjonen sier det: S8 stopper synk, og S9 er siste-skriving-vinner. Begge gjelder smale tilfeller. S12 bryter strengt tatt «arket skal ikke love mer enn koden gjør», men er satt til Lav etter virkning: forskjellen er sekunder mot minutter.

### Rettet i runde 2

| # | Alv. | Fil | Funn | Test (feilet før retting) |
|---|---|---|---|---|
| S8 | Høy | `src/sync/docs.ts` (`merge3`), `src/sync/engine.ts`, `src/sync/useSync.ts` | **Feil:** to enheter la til basisvarer som til sammen gikk over taket på 40. Det flettede innstillingsdokumentet ble da ugyldig og ble aldri sendt, heller ikke senere endringer (som budsjettet). Ingen konflikt eller feil ble vist. **Nå:** den andre sidens nye basisvarer blir konflikter når flettingen ville gått over taket. Et dokument med lokale endringer som ikke kan sendes, gir synkstatus «feil» med teksten for `ugyldig_dokument`, uten bakoff. | `engine.test.ts`: «… (til sammen over taket) får konflikt, ikke stille synkstopp», «et dokument med lokale endringer som ikke kan sendes, gir «ugyldig_dokument» …» |
| S9 | Høy | `server/sync/api.ts` (pull) | **Feil:** en kopi tatt før første dokumentskriving, gjenopprettet uten hendelser å oppdage reset på, ble ikke oppdaget. En ny enhet sendte da standardinnstillingene sine med `baseVersion 0` og overskrev husstandens budsjett uten konflikt. **Nå:** oppgir enheten en versjon ≥ 1 i dokumentankeret av et dokument serveren ikke har, svarer serveren `reset`. Dokumenter som venter etter en gjenoppretting står ikke i ankeret, så det blir ingen løkke. | `engine.test.ts`: «kopi tatt før første dokumentskriving: en ny enhet overskriver ikke …» |
| O11 | Middels | `server/offers/papers.ts`, `server/offers/config.ts` (`paperCallsPerDay`), `server/index.ts` | **Feil:** avissidene ligger i minnet for høyst 100 aviser, mens lista kan ha 400. Én IP innenfor 60 kall/min kunne bla gjennom flere enn 100 aviser og hente sidene fra Tjek igjen og igjen. Det brukte opp hele dagens kallbudsjett (felles med innsamleren) på ca. 20 minutter, og innsamleren stoppet resten av døgnet. **Nå:** avisoppslagene har et eget delbudsjett (en femdel av `OFFER_MAX_CALLS_PER_DAY`). Når det er brukt opp, svarer de «error» uten kall til Tjek. Fordelingen er et skjønn. | `kodegjennomgang2.test.ts`: «O11: avissidene har eget delbudsjett …», «O11: … kan ikke bruke opp kallbudsjettet som innsamleren trenger» |
| M3 | Middels | `src/data/household-rules.json` (`sensitive`) | **Feil:** barneprodukter uten «barne», «baby» eller «junior» ble klassifisert som vanlige husholdningsvarer. «Zendium tannkrem barn 0-6 år» ble tannkrem. CLAUDE.md sier at gruppene ikke har barneprodukter. En slik linje i den delte lista kan røpe barns alder. **Nå:** «barn» og «kids» er sensitive ord (delstreng, som de andre). Det kan utelukke litt for mye, for eksempel merkenavn som inneholder «barn». Det er riktig vei å feile. Lista er fortsatt et skjønn. | `planner.test.ts`: «M3 … «Tannkrem barn 0-6 år» og «Kids sjampo» gir ikke treff» |
| O12 | Lav | `server/offers/collector.ts` (`pruneOffers`, `startOfferRetention`), `server/index.ts` | **Feil:** oppbevaringen kjørte bare etter en vellykket henting, og aldri med `TJEK_FETCH=0`. Lagrede priser ble derfor liggende for alltid når hentingen feilet over tid eller var slått av, for eksempel når avtalen er slutt. **Nå:** oppbevaringen kjører i hver runde, også ved feil og kallgrense, og ved oppstart og hver 6. time uten innsamler. | «O12: utløpte tilbud slettes … også når hentingen feiler», «O12: med henting av (TJEK_FETCH=0) …» |
| O13 | Lav | `server/offers/config.ts`, `server/offers/collector.ts` | **Feil:** `OFFER_REFRESH_HOURS` over ca. 596 gir et intervall over det `setTimeout` tåler. Node gjør det om til 1 ms, og innsamleren kjørte runde etter runde til budsjettet var brukt opp. **Nå:** høyst 168 timer (ellers standard med advarsel), og planleggeren kapper ventetiden. | «O13: OFFER_REFRESH_HOURS over ca. 596 timer …» |
| M1 | Lav | `src/engine/staples.ts` | **Feil:** en telling eller rest på 0 ble regnet som påfyll, så «tom» forsvant selv om matskapet sa at varen var tom. **Nå:** bare en mengde over 0 er påfyll. | `planner.test.ts`: «M1 … telt til 0 skal fortsatt foreslås» |
| M2 | Lav | `src/engine/inventory.ts` (`STAPLE_ID`), `src/engine/staples.ts` | **Feil:** `cleanStapleName` godtar alle bokstaver, men `STAPLE_ID` godtok bare `\p{Ll}\p{Lo}`, høyst 40. «ʻAhi» og 30 × «İ» kunne derfor ligge i innstillingene uten at nivå-hendelser for dem ble godtatt. **Nå:** `STAPLE_ID` godtar `\p{L}\p{M}`, høyst 80. `customStapleId` gir null for alt mønsteret ikke godtar. Dette utvider valideringen. En eldre, bufret app avviser fortsatt slike nivå-hendelser til den er oppdatert. | `planner.test.ts`: «M2 … hvert navn som cleanStapleName godtar …» |
| M4 | Lav | `src/engine/household.ts` (`householdCatch`) | **Feil:** med to observasjoner av samme tilbud viste fangsten den eldste prisen, mens «Andre varer» brukte den nyeste. **Nå:** den nyeste observasjonen gjelder begge steder. | `planner.test.ts`: «M4 … bruker samme (nyeste) observasjon» |
| S10 | Lav | `server/retention.ts` | **Feil:** et stort tall i `SYNC_TOKEN_IDLE_DAYS` ga 500 på alle autentiserte kall (`RangeError` i datoregningen). Et stort tall i `SYNC_RETENTION_DAYS` ga en jobb som feilet hver runde. **Nå:** høyst 36 500 dager. Større tall gir standard (730) med advarsel. | `api.test.ts`: «kodegjennomgang runde 2 (S10) …» |
| S11 | Lav | `src/sync/export.ts` | **Feil:** «Last ned mine data» på enheten tok med serverens interne versjons-id-er (`revs`, avledet av sha256). **Nå:** de er fjernet fra eksporten. Servereksporten hadde dem ikke fra før. | `engine.test.ts`: «tar ikke med slekten (revs) …» |
| S12 | Lav | `server/storage/sqlite.ts` | **Feil:** «sist sett» ble lagret med millisekunder ved oppretting og innmelding, og ble først avrundet ved neste autentiserte kall. Personvernarket og `docs/synk.md` sier minutt-oppløsning. **Nå:** alltid minutt. | `api.test.ts`: «kodegjennomgang runde 2 (S12) …» |
| V11 | Lav | `src/engine/cookNow.ts` (`cookNowLineId`), `src/views/CookNowView.tsx` | **Feil:** linje-id for «Legg manglende på handlelista» var prefiks pluss enhetens egen hendelses-id. To enheter ga derfor to linjer, mens CLAUDE.md sier én gang per rett og vare. **Nå:** id-en er fast per rett og vare (prefiks + antall fjernede), samme modell som `householdLineId`. Eldre linjer med gammel id gjenkjennes fortsatt på prefikset. | `kodegjennomgang2-ui.test.tsx`: «V11 …» |
| V13 | Lav | `src/views/ListView.tsx` | **Feil:** en `hus:`-linje som ikke kan tolkes (fra en annen eller eldre klient), var usynlig og kunne ikke fjernes. **Nå:** den vises under «Fra kundeaviser». | «V13 …» |
| V14 | Lav | `src/views/PapersView.tsx` | **Feil:** fanene i Kundeaviser manglet `aria-pressed` og gruppe, så en skjermleser fikk ikke vite hvilken som var valgt. **Nå:** begge deler er på plass, som i Kontroll og Matskap. | «V14 …» |
| V15 | Lav | `src/views/household/HouseholdCatch.tsx` | **Feil:** ga `householdLineId` null (nøkkel over 80 tegn eller med `#`), ble ingenting lagret, men meldingen sa «er lagt på handlelista». **Nå:** meldingen sier at varen ikke kan legges på. | Kodebevis (React-tilstand). Tjek-id-er er korte, så det skjer neppe med ekte data. |
| V17 | Lav (delvis) | `src/views/StaplesView.tsx` (`parseStapleMin`) | **Feil 1:** en ugyldig minstemengde ble forkastet uten melding. **Feil 2:** 0,4 ble avrundet til 0, som `isValidStaples` avviser. Innstillingene sluttet da å synke (og ga etter S8 «feil»). **Nå:** verdien avrundes før sjekken, og ugyldig verdi gir melding. **Åpent:** en ugyldig mengde i «Lag nå» forkastes fortsatt uten melding (bare lokalt, ingen synk). | «V17 basisvarer: en minstemengde som avrundes til 0 godtas ikke …» |
| D1 | Lav | `docs/sikkerhet.md` | **Feil:** S7 sa at `SYNC_RETENTION_DAYS` har standard 365. Koden og CLAUDE.md sier 730. «Tester» sa at `api.test.ts` og `engine.test.ts` var uendret. **Nå:** begge stedene er rettet. `docs/synk.md` er oppdatert for O11, O12, O13, S8 og S9. | – |

### Åpne funn fra runde 2

| # | Alv. | Fil:linje | Funn | Reproduksjon | Anbefaling |
|---|---|---|---|---|---|
| M5 | Lav | `src/engine/prices.ts:16` (`dayNumber`), `src/offers/hints.ts:20`, `src/engine/household.ts` | Tilbudenes `observed` er en UTC-tid, mens handledagen er en norsk dato. En pris sett mellom norsk midnatt og 01:00/02:00 blir regnet én dag for gammel, akkurat på 14-dagersgrensen. Feilen går i trygg retning: prisen regnes som eldre, aldri som nyere. Katalogpriser (bare dato) påvirkes ikke. | `planner.test.ts`: «M5 …» (`it.fails`) | Gjør `observed` om til norsk dato utenfor motoren (`osloDate`) før `isStale`, i hints og i husholdningsvisningene. Ingen klokke eller tidssone i motoren. |
| V12 | Lav | `src/views/ListView.tsx:84` | En «Lag nå»-linje som ble krysset av forrige uke, står som ikke krysset av etter ukeskiftet. «Lag nå» sier samtidig «✓ Ligger på handlelista». Basisvarelinjer beholder krysset for sin egen uke. | `kodegjennomgang2-ui.test.tsx`: «V12 …» (`it.fails`) | Produktbeslutning: enten uke i linja (som basisvarer), eller dokumenter det som for «Andre varer». |
| V16 | Lav | `PantryView.tsx:116`, `StaplesView.tsx:93`, `CookNowView.tsx:227`, `HouseholdCatch.tsx:68`, `ListView.tsx:123`, `TjekPapers.tsx:87` | Etter handlinger som fjerner eller deaktiverer knappen, flyttes ikke fokus, så det havner på `body`. Det gjelder blant annet «Åpne «Lag nå»», «Legg manglende …», «＋ Legg på lista», Godkjenn/«Ikke nå» på basisvareforslag og «Neste →» på siste avisside. «← Tilbake» fra en avis gir heller ikke fokus tilbake. | Kodebevis. Krever nettleser. | Flytt fokus til overskrift eller statuslinje (`tabIndex=-1`), og legg det inn i `npm run check:a11y`. |

**Åpne funn fra første runde, kontrollert på nytt:**
- **Gjelder fortsatt:** V7 (to faner, nå også `cookNow`), V10, O8 (`/api/offers` uten ratebegrensning; `/api/offers/lagret` og `/api/aviser` har den) og O10.
- **Ikke vurdert på nytt i denne runden:** O5, O4b, S6 og S7.

### Sjekket i runde 2 uten funn

- **Motor (regel 1–3):**
  - `prices.ts`, `cookNow.ts`, `staples.ts` og `household.ts` har ingen klokke, tilfeldighet eller nett.
  - `resolvePrice` bruker aldri en utløpt `validUntil` eller et gammelt tilbud uten gyldighet.
  - En gammel pris blir estimat med dato og taper alltid mot en ny.
  - En kombinasjonskurv vinner bare når den er komplett.
  - «Lag nå» filtrerer på absolutte krav før dekning, gir ukjent pris ved uavklart allergenstatus og rangerer aldri ukjent pris foran kjent.
  - Basisvarer påvirker aldri kurv eller sum.
- **Synk:**
  - `parseDocAnchors` er streng; ingen 500 ble funnet.
  - Det ble ikke funnet falsk reset.
  - `cleanEvent` har `nivå`.
  - `isValidDoc` validerer basisvarer og varegrupper strengt.
  - Kostkrav, allergier, postnummer og «Lag nå» synkes aldri.
  - Servereksporten har ingen token, hash, kode eller `revs`.
  - Oppbevaringsjobben har injisert klokke, `0` = av og bare antall i loggen.
  - Utløpt token gir samme 401.
- **Tilbud og server:**
  - Avisoppslag bare for id-er i den gjeldende lista (ingen SSRF).
  - `allowedImage` slipper ikke gjennom brukernavn, port, ikke-https, punycode eller avsluttende punktum.
  - `appCsp` kaster ved injeksjon, og Trusted Types er uendret.
  - Alle kall mot Tjek går gjennom budsjettet.
  - Lagringen er idempotent på (kilde, id), med observasjonsdato fra kilden.
  - Ingen persondata i tilbudsdatabasen.
  - Loggene har bare feilens navn.
  - `TJEK_FETCH=0` slår av alle kall.
- **Visninger:**
  - Tjek-pris og -overskrift havner aldri i synkede linjer.
  - `basis:`- og `hus:`-id-ene er idempotente.
  - Bilder lastes først etter brukerens trykk, med «Kilde: Tjek, hentet …» og `no-referrer`.
  - Ingen kjøpsoppfordring.
  - «Andre varer» er aldri med i middagskurv, budsjett eller «Med kontrollerte tilbud».

### Ikke testet i runde 2

- Ekte Tjek-svar er ikke kalt av denne gjennomgangen. Formen på kataloger, sider og bildevert er prøvd av en annen økt samme dag (`phase0/tjek-formprøve.md`, kom inn under rebasen). Formprøven fant 145 norske aviser, altså flere enn de 100 som holdes i minnet, så utkastingen i O11 skjer med ekte data. Delbudsjettet (200 oppslag per døgn med standardbudsjettet) holder for en lukket pilot, men kan nås med mange brukere. Hvor ofte det nås, er ikke målt.
- Fokus, tastatur og skjermleser i ekte nettleser utover `npm run check:a11y`. To ekte telefoner.
- Gjenoppretting av en ekte produksjonskopi. S9 er testet med SQLite-kopi i testene, ikke med `backup.sh`.
- Ingen eksterne kall er gjort.

### Vurdering etter runde 2: lukket pilot

Lukket pilot er fortsatt forsvarlig, med de samme forbeholdene som før om ekte prisdata, Tjek-avtalen og drift (`docs/sikkerhet.md`, «Må på plass før ekte familier»).

Det viktigste denne runden:
- **Rettet:**
  - Innstillinger kunne slutte å synke uten at noen så det (S8).
  - En gjenoppretting fra en veldig tidlig kopi kunne gi siste-skriving-vinner (S9).
  - Anonyme kall kunne bruke opp Tjek-budsjettet (O11).
  - Barneprodukter slapp inn i husholdningsvarene (M3).
- **Åpent:** bare små ting uten kjent skade (M5 feiler i trygg retning) og produktvalg (V12, V16).

Før piloten anbefales det å se delbudsjettet for aviser (O11) mot det faktiske antallet aviser i formprøven, og å ta V16 (fokus) sammen med neste a11y-runde.
