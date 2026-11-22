# Kodegjennomgang 2026-11-22

Uavhengig gjennomgang av hele repoet på branch `claude/middagsplanner-app-wwuq1p`, delt i fire områder: motor (`src/engine/`), synk og server (`src/sync/`, `server/`), visninger (`src/views/`, `App.tsx`, `store.ts`) og tilbud (`src/offers/`, `server/index.ts`). Hvert funn som er rettet, har en test som feilet før rettingen. Der testen ikke kan skrives uten nettleser (fokus, React-tilstand), er rettingen begrunnet i koden.

**Alvorlighet.** *Høy:* bryter en regel i CLAUDE.md, gir datatap eller stopper synk. *Middels:* feil sum, feil visning eller feil tilstand som brukeren kan merke. *Lav:* småfeil, tekst eller manglende vern uten kjent skade.

| Alvorlighet | Funn | Rettet | Åpne |
|---|---|---|---|
| Høy | 9 | 7 | 2 |
| Middels | 15 | 12 + 1 delvis | 2 |
| Lav | 12 | 7 | 5 |
| **Sum** | **36** | **26 + 1 delvis** | **9** |

## Åpne funn (produktbeslutning eller for store til å rette her)

| # | Alv. | Fil:linje | Funn | Reproduksjon | Anbefaling |
|---|---|---|---|---|---|
| S1 | Høy | `src/sync/engine.ts:59` (`receiveDoc`, gren `meta.restored`) | Etter at serveren er gjenopprettet fra en eldre kopi, tar en enhet serverens versjon som ny base og sender sin lokale verdi uten fletting. To enheter som begge har sett mer enn kopien, overskriver hverandre (siste skriving vinner). Det bryter «Ingen siste-skriving-vinner». | A og B har budsjett v5 = X. Serveren gjenopprettes til v3. A sender X som v4. B har lokal Y og sender Y som v5 uten konflikt. Testen «oppdages også når bare dokumentet viser det (409 …)» i `src/sync/engine.test.ts` viser det: B ender på 222 200 og ikke A sitt 333 300. | Krever et valg. Enten (a) flett tre-veis mot base før gjenoppretting og vis konflikt når begge sider har endret seg, eller (b) la serveren lagre en epoke eller instans-id, så enhetene vet hvilken side som er nyest. |
| S2 | Høy | `src/sync/engine.ts:188` | Ankeret flyttes bare når en pull inneholder hendelser. Dokumentene deler `seq` med hendelsene, så cursor kan ligge foran ankeret. Gjenopprettes serveren og noen skriver forbi cursor, oppdages det ikke. Da hentes aldri den nye hendelsen, og egne hendelser sendes ikke på nytt. | A har anker `10:E` og cursor 12 (dokumenter på 11–12). Serveren gjenopprettes til 11, og en ny hendelse får seq 12. A spør med `after=12`: head = 12 og hendelse 10 er fortsatt E, så serveren svarer ikke `reset`. | Anker på cursor-posisjonen (fingeravtrykk av raden ved `cursor`, også for dokumenter) eller en database-epoke i svaret. Hører til synk-økten. |
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

Én eksisterende test er utvidet: `engine.test.ts`, synkstatus uten nett. Den nye 409-testen sier ikke hvilket budsjett som vinner, fordi det er det åpne funnet S1.

E7 endret én forventning etter brukerens beslutning: `fase2.test.ts` «demokatalogens laksetilbud er satt langt frem …» ventet `tilbud` på handledag 2027-06-01 for en observasjon fra 2026-11-17. Den venter nå `estimat` med dato og kilde, og laks er fortsatt priset (det testen skulle sikre). Samme test sjekker at tilbudet er `tilbud` på 2026-11-23.

## Vurdering: lukket pilot

Lukket pilot er forsvarlig, med to forbehold.

1. **Gjenoppretting av serveren (S1, S2):** etter en gjenoppretting fra eldre kopi kan dokumentendringer gå tapt uten konflikt, og i et smalt tilfelle oppdages ikke gjenopprettingen. Dette gjelder bare når driften faktisk gjenoppretter. Inntil det er rettet: gjenopprett ikke en kopi mens husstander er aktive, og be piloten kontrollere plan og innstillinger etterpå. Legg dette i `docs/drift` eller i pilot-sjekklisten.
2. **Ekte priser (E7):** rettet. Observasjoner eldre enn 14 dager før handledagen er bare estimat med dato og vinner aldri over en nyere pris. Importen må fortsatt gi riktig `observed` (datoen prisen ble sett, ikke importdatoen).

Resten av de åpne funnene er småting eller produktvalg uten kjent skade for en lukket pilot. Motoren er deterministisk (ingen `Date.now`, `Math.random` eller nettverk i `src/engine/`, sjekket med grep). Beløp er hele øre også ved ugyldige tilbudsdata. Allergi- og kostkrav slår nå tilbud også i kundeavisvisningen.
