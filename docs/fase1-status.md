# Fase 1: uavhengig kontroll mot godkjenningskriteriene

Kontrollert 2026-11-22 på branch `claude/middagsplanner-app-wwuq1p`. **Oppdatert samme dag:** funn 2 (låst rett mot absolutte krav) og funn 3 (geografisk feil tilbud) er rettet av en motorøkt; se merknadene «Lukket» under. Kontrolløren skriver bare dette dokumentet, tester i `src/acceptance/` og (etter melding) små motorrettinger; produksjonskode utenfor `src/engine/` er ikke endret.

**«Oppfylt» betyr at en test eller en kjøring som kan gjentas beviser det, ikke at koden finnes.** Alt som krever ekte prisdata, kvitteringer eller ekte brukere står som «ikke testbart uten ekte data». Alle priser, butikker og aviser i appen er demodata (regel 5), så ingen av prismålene i planen er målt.

## Kjøringer

| Kjøring | Resultat |
| --- | --- |
| `npx tsc --noEmit` | grønn |
| `npx vitest run` | 21 filer, 289 bestått, 6 `todo`, ingen `it.fails`. 130 av testene ligger i `src/acceptance/` |
| `npx vite build` | grønn (45 moduler, 323 kB JS / 100 kB gzip) |
| Server (`NODE_USE_ENV_PROXY=1 npx tsx server/index.ts` etter bygg) | Startet. `/api/offers` var «loading» i ca. 30–60 s, deretter ble 87 ekte Tjek-tilbud koblet til varer. Stier utenfor `dist/` kan ikke leses (prøvd med `--path-as-is` og kodede punktum) |
| Playwright, 420 px bred, Chromium | Se «Nettleserkjøring». Ingen konsollfeil utenom forventet `ERR_INTERNET_DISCONNECTED` under offline-testen |

## Matrise: godkjenningskriterier

Status: **oppfylt** / **delvis** / **ikke oppfylt** / **ikke testbart uten ekte data**.

### Fase 0 (bare for sammenheng; porten er ikke min oppgave)
`phase0/RESULTS.md` rapporterer «delvis»: Kassalapp-importen og Tjek-dekningen er målt, men kjedeavtaler og kundeavisrettigheter er ikke startet. Ingen ferske priser fra Rema 1000 og Coop, og Kiwi bare for 5 av 24 varer. Porten er derfor ikke passert for «ti prøvekurver mot faktiske kjøp» og «tillatt visningsmåte per avis». Fase 1 bygges likevel, som planlagt for en demo, men ingen prisløfter kan gis.

### Fase 1 – familieversjon

| Kriterium | Status | Bevis | Mangler |
| --- | --- | --- | --- |
| Alle varer har synlig prisstatus | **oppfylt** | `fase1.test.ts` «alle varer har synlig prisstatus» (8 innstillingsscenarier × 3 butikkvalg: gyldig status, kilde og dato når pris er kjent, `ukjent` ⇒ ingen pris). `prisstatus-ui.test.tsx`: server-rendret handleliste har statusetikett på hver `<li>` (ordinær/estimert/tilbud/ukjent), ukeplanen viser «Anslått … innenfor/over», «N estimert · N ukjent pris» og «Ufullstendig prisgrunnlag» med varene som mangler. Nettleser: 11 av 11 handlelinjer hadde status; detaljvisningen viste «Ordinær pris», kilde og observasjonsdato | Geografisk omfang vises ikke per linje (butikknavn vises, omfang «utsalg/region/kjede» bare i «Rediger uke»). Manuelle linjer fra aviser er merket «ikke kontrollert», ikke med prisstatus (bevisst). Skjermleserlesing er ikke verifisert av meg (opprydding/tilgjengelighet-økta eier det) |
| To retter som deler én pakning gir én handlelinje | **oppfylt** | `fase1.test.ts`: alle 465 par av katalogens 31 retter gir én linje per vare, begge retter i `covers`, behov = sum før avrunding, pakker = ⌈sum / pakning⌉; deling er aldri dyrere enn separate kurver. Eksisterende: `planner.test.ts` «delt pasta», `inventory.test.ts` «delt rispose» | – |
| Tre beregninger med samme inndata og prisversjon gir lik kurv, sum og begrunnelse | **oppfylt** for motoren | `fase1.test.ts`: plan, alternativer, budsjettsvar, tilbudssum, bytteforslag og budsjettforslag, 3 kjøringer × 8 scenarier, byte-identisk `JSON.stringify`; også etter JSON-rundtur av inndata og med omvendt rekkefølge på alle katalogtabeller; inndata endres aldri | I appen blir inndata ikke de samme mellom kjøringer, fordi live-tilbud og beholdning endrer seg (se «Prisgrunnlag lagres ikke») |
| Rettbytte bevarer låste retter | **oppfylt** | `fase1.test.ts`: et bytte rører bare den dagen; låste retter er uendret; bytteforslag foreslår aldri en rett som en annen dag bruker; «Lag ny uke» beholder byttet og alle låste, stabilt over runder (også med tilbud og beholdning); budsjettforslag rører aldri låste. Nettleser: byttet rett fikk 🔒 og var uendret etter «Lag ny uke» | **Lukket:** en låst rett som bryter et allergen, kost eller råvarekrav som aktiveres senere, slippes ut, og UI varsler («Låst rett X ble fjernet fordi den bryter …»). Tester i `fase1.test.ts` «F1: absolutte krav slår låste retter»: «en låst rett med et allergen … (var `it.fails`)», «vegetar: … «kost»», «råvarekrav: … «råvare»», «tidsgrensen er unntatt …», «slipp-ut er deterministisk …»; og `planner.test.ts` «regresjon: absolutte krav vinner over låste retter». En låst rett på en dag som slås av slippes ut med varsel i UI (ikke testet automatisk; prøvd i nettleser) |
| Planlegge, endre, handle offline og komme tilbake på nett uten doble kjøp | **delvis** | Nettleser: service worker registrert; med nettet av ble siden lastet på nytt, handlelisten (11 linjer) vistes, avkryssing og «Marker som handlet» virket, og lagret tilstand var uendret etter innlasting og ny tilkobling (11 hendelser, 11 unike id-er). `fase1.test.ts`: lagring→innlasting er idempotent, gjentatt kjøp gir én rad i logg og utboks, 50 tilfeldige rekkefølger og dubletter gir lik beholdning. `inventory.test.ts`: frakoblet enhet, feilet levering, tapt kvittering | *Oppdatert av synk-økta:* synk-server og transport finnes nå (`docs/synk.md`). Ende til ende bevist i `npm run e2e:sync` (to nettleserkontekster, frakoblet avkrysning flettes) og `src/sync/engine.test.ts` (frakoblet kjøp, avbrutt levering, migrering uten duplikater). Fortsatt ikke prøvd på to ekte telefoner over mobilnett. Å planlegge på nytt offline er ikke prøvd i nettleser. Første besøk må skje på nett |

### Fase 2 – priset kurv

| Kriterium | Status | Bevis | Mangler |
| --- | --- | --- | --- |
| En kurv med ukjent pris vinner aldri butikksammenligningen | **oppfylt** | `fase2.test.ts` (8 tester): ufullstendig kombinasjon med latterlig lav sum blir aldri valgt; ufullstendig vanlig butikk kåres ikke billigst og gir ingen «du sparer»; begge ufullstendige ⇒ ingen vinner; delsum under budsjettet gir fortsatt «Ufullstendig prisgrunnlag»; bytteforslag med ukjent pris havner sist; alle 31 retter. Eksisterende: `planner.test.ts`, `allergens.test.ts` | – |
| Utløpte, utilgjengelige og geografisk feil rabatter gir ingen rabatt | **oppfylt** på kjedenivå | Utløpt/kommende (handledagen avgjør, grensedatoer inkludert): `fase2.test.ts`, `deals.test.ts`, `offerTotal.test.ts`, `offers.test.ts`. Utilgjengelig (uten pris, mengde, feil enhet, ikke regelgodkjent, ikke heltall i øre, allergifilter, «tilbud av»): `fase2.test.ts`. Utløpt katalogpris (`PriceObs.validUntil`) brukes ikke lenger på handledagen: `fase2.test.ts` (rettet i `planner.ts` etter min melding; testen viser at siste gyldige dag fortsatt gjelder) | **Geografisk feil: lukket på kjedenivå.** `OfferHint.chain` (normalisert) og `Settings.offerChains`: bare tilbud fra valgte kjeder teller i rangering og sum; ingen valgt = ingen tilbud. Tester i `fase2.test.ts`: «geografisk feil: tilbud fra en kjede som ikke er valgt …», «standard uten valgt kjede …», «kjedevalget flytter aldri valget av middager mot ikke-valgte kjeder …», «kjedevalget endrer aldri basissum … allergifilter blokkerer fortsatt»; `chains.test.ts` (`normalizeChain`); `planner.test.ts` «regresjon: tilbud teller bare fra valgte kjeder». **Gjenstår:** Tjek skiller ikke på utsalg eller region, så et kjedetilbud som ikke gjelder brukerens utsalg kan fortsatt telle; summen sier at den forutsetter kjøp hos kjeden. «Utilgjengelig» i betydningen utsolgt er utsolgt-økta sitt område (`substitution.ts`) |
| Prisreglene kan gjenskapes fra en lagret uke | **delvis** | `fase2.test.ts`: innstillinger, plan, tilbud, handledag og beholdning lest tilbake fra JSON gir byte-identisk kurv, sum, budsjettsvar og tilbudssum; hver linje bærer behov, pakke, pris, status, kilde, dato og dekte retter | **Prisgrunnlag lagres ikke:** `AppState` har bare `settings` og `slots`. Tilbud, handledag og beholdning leses på nytt hver gang, og katalogprisene ligger i koden, så en eldre uke kan ikke gjenskapes i appen etter at noe av dette endres. Planens punkt 8 («lagre planversjon med prisgrunnlag og regelversjon») er ikke gjort i appen; `substitution.ts` har begynt på planversjoner, men er ikke vurdert her |
| En avbrutt eller gjentatt kjøpsbekreftelse dobler ikke beholdningen | **oppfylt** på logikknivå | `inventory.test.ts` (samme kjøp to ganger, tapt kvittering, rekkefølge), `fase1.test.ts` (tilfeldige rekkefølger og dubletter), `store.test.ts` | Ingen ekte mottaker (se offline) |
| ≥ 90 % ferskt prisede linjer og ≤ 5 % median avvik mot kassakjøp | **ikke testbart uten ekte data** | `it.todo` i `fase2.test.ts`. Fase 0 fant ingen ferske priser for Rema og Coop (eldste 929 dager) og målte ikke avvik mot kvittering | Prisavtale for minst én av Rema 1000, Kiwi og Coop, eller pilotområder der de dekkede kjedene dominerer; kvitteringer |
| Brukerne finner lokal avis, bruker et tilbud i planen og besøker butikk nummer to | **ikke testbart uten ekte data** | `it.todo`. Flyten finnes og ble klikket gjennom (se under) | Pilot |

### Fase 3 og 4
Ikke vurdert: de er utenfor omfanget i CLAUDE.md.

## Matrise: regler 1–8 i CLAUDE.md

| Regel | Status | Bevis | Mangler / merknad |
| --- | --- | --- | --- |
| 1. Motoren er ren og deterministisk | **oppfylt** | `regler.test.ts` skanner hver fil i `src/engine/` (utenom tester): ingen `Date`, `Math.random`, `fetch`, `crypto`, lagring, miljøvariabler, tidtakere eller nettleser-API, og de importerer bare andre motorfiler (mutasjon med `Date.now()` ga rødt). Determinisme: se fase 1. Beløp er heltall i øre | Skanningen er en stikkprøve på tekst. `server/index.ts` og `store.ts` bruker klokke og tilfeldighet, men ligger utenfor motoren som det skal |
| 2. Hver pris har kilde, omfang, dato og status; historisk pris blir aldri dagens tilbud | **delvis** | `regler.test.ts`: alle katalogpriser har kilde, ISO-dato, status, butikk med omfang; «tilbud» krever utløpsdato. Utløpt tilbud brukes ikke (rettet). UI viser «anslått», «ikke en garanti for sluttpris» | Omfanget ligger på butikken, ikke på prisen, og vises ikke på handlelinjen. Utløpt tilbud gir `ukjent`, ikke en gammel pris |
| 3. Ukjent pris vinner aldri; svaret «Ufullstendig prisgrunnlag» | **oppfylt** | Se fase 2. `prisstatus-ui.test.tsx` viser at teksten står i ukeplanen | – |
| 4. Allergener: aldri garanti; uavklart godkjennes aldri; absolutte krav filtrerer, preferanser rangerer | **oppfylt** | `allergens.test.ts` (hver av 14 allergener i 7-dagers plan, flere samtidig, uavklart status, tilbud slår aldri allergi), `catalog.test.ts`. `regler.test.ts`: setning for setning står «garant», «allergenfri», «sluttpris» og «billigste» bare i benektende setninger (mutasjon ga rødt) | Låst rett mot senere krav er rettet (funn 2). Tilbudsvarer er alltid uavklart og blokkeres ved aktivt filter (testet). Katalogens allergendata er forenklet demodata, ikke ekte, og aldri en garanti |
| 5. Demodata er merket | **oppfylt** | `regler.test.ts`: `DEMODATA` i filhodene, alle butikker/aviser heter «Demo …», alle priser har kilde «Demodata», banneret står i `App.tsx`, avisfanen heter «Aviser (demo)». Nettleser: banner synlig på alle faner | **Blandet i visningen:** «Tilbud nå» viser ekte Tjek-tilbud (MENY, Coop, Price …) ved siden av demobutikker og demopriser. Fanen sier «Kilde: Tjek», men demomerknaden gjelder da bare resten |
| 6. Bare avtalte kilder; ikke hent aviser selv | **delvis** | `regler.test.ts`: `fetch` bare i `src/offers/client.ts` og `server/index.ts`; eneste eksterne verter er Tjek og Matvaretabellen (byggeskript); tilbud lagres bare i egen tilbudsdatabase (`server/offers/`), aldri i synk-databasen | Tjek-avtalen er fortrolig; brukerens svar (2026-11-22: lagring av priser, bilder og avissider, alle kjeder) er ført i `phase0/tjek-avtale.md` som brukerens opplysning. Kreditering, kallgrense, varighet og pris er ikke kjent for oss. Avissider fra Tjek er bygd («Aviser fra Tjek», bilder fra Tjek med `TJEK_IMAGE_HOSTS`; katalogformen ikke prøvd mot ekte svar). «Les hos kjeden» er ikke bygd (knapp deaktivert) |
| 7. Personvern, ingen hemmeligheter | **delvis** | `regler.test.ts`: ingen kjente nøkkelformater, `.env`/nøkkelfiler er ikke sporet, miljøvariabler leses ikke i `src/`, ingen geolokasjon, lagret tilstand har bare etikett, porsjon og dager (+ postnummer, tomt fra start), ingen personfelt. `PlanForm.tsx:88` råder nå til etiketter, ikke navn | Etikettfeltet er fortsatt fritekst, så barnenavn kan skrives (kontrollerer ikke). Enhets-id (`crypto.randomUUID`) lagres i `localStorage`; det er ikke persondata, men bør nevnes i personvernteksten. «Slett lokale data» finnes (`localStorage.clear()`) men er bare synlig etter at en plan finnes |
| 8. Importer og kjøpsbekreftelser tåler dobbelt mottak | **oppfylt** på logikknivå | `inventory.test.ts`, `store.test.ts`, `fase1.test.ts`, `rules.test.ts` («samme regel to ganger gir én rad») | Tilbudsimport lagres ikke. Ingen ekte mottaker for kjøp |

## Nettleserkjøring (420 px, Chromium, bygg + server)

Flyt og det jeg så:
1. **Forside uten plan** («Planlegg uka»): skjema for hvem som spiser, budsjett, dager, tid, butikk, «Flere valg». Demodata-banner øverst.
2. **«Lag ukeplan»**: fem dagkort med rett, tid, porsjoner og «På tilbud»-linje. Sammendrag: «655 kr · Anslått innenfor budsjett · margin 245 kr · 1 butikk · 0 estimert · 0 ukjent pris» og «Anslått pris, ikke en garanti for sluttpris».
3. **Bytt rett**: dialogen viser dagens rett, fremgangsmåte, næring, «Lås», «Reserver ekstra porsjon» og alternativer med «+20 kr på handelen». Valgte «Omelett» → raden fikk 🔒. «Lag ny uke» beholdt den.
4. **Velg handletur**: «Én butikk 490 kr» mot «To butikker 434 kr», «Du sparer 56 kr med et ekstra stopp», terskel, og «Laveste beregnede pris blant sammenlignede alternativer, ikke en garanti».
5. **Handleliste**: gruppert per butikk og avdeling, hver linje med pakning, mengde, pris og prisstatus; «Marker alt her som handlet (10)». Etter markering: 10 kjøp i logg og utboks.
6. **Detalj («Hvorfor 30 kr?»)**: pakker × pris, behov, til overs, hvilke retter den dekker, butikk, «Ordinær pris», «Kilde: Demodata, observert 2026-11-17. Prisen er anslått».
7. **Matskap**: «Bekreftet hjemme» (tom), «Kjøpt (ikke brukt)» (10 linjer), «Forventet rest» med «Bekreft rest», «Marker som laget», «Kan lages med det du har» (senere erstattet av «Lag nå», se under).
8. **Kundeaviser**: «Tilbud nå» (87 ekte Tjek-tilbud, «Kilde: Tjek. Lest …»), «Aviser (demo)» med to demoutgaver i denne uka, og utgavevisning. «Kontroll»-fanen (redaktør) åpnet.
9. **Offline**: service worker aktiv; lasting uten nett, avkryssing og kjøp virket; ingen dubletter etter ny tilkobling.

Funn fra kjøringen:
- «Tilbud nå» viser alle 87 tilbud i én lang liste (siden er ca. 11 000 px høy) og har **28 px horisontal overflyt** på 420 px. De andre fanene har ingen overflyt.
- Ukeplanen satte «På tilbud: …» for tilbud fra kjeder som ikke er husstandens butikker. **Rettet:** tilbudslinjene vises bare for kjeder brukeren har valgt under «Flere valg» → «Kjeder jeg handler hos (for tilbud)».
- Å trykke på den aktive fanen («Kundeaviser») nullstiller ikke en åpen utgave, så «Kontroll» ligger bak «Tilbake».
- Ikke prøvd av meg: sammenlignet to enheter, bytte av område/postnummer ut over feltet, skjermleser.

## Funn (fil og linje)

1. **Utløpt katalogpris ble brukt som «tilbud»** (`src/engine/planner.ts`, `bestOffer`, regel 2). **Rettet** av en annen økt etter min melding: `if (ctx.shopDate && obs.validUntil && obs.validUntil < ctx.shopDate) continue;`. Gir `ukjent` (ikke estimat) etter siste gyldige dag; uten handledag er oppførselen uendret. Demolaksens utløp er satt til 2099 (demodata), så demoen mister ikke laks. Testet i `fase2.test.ts`, `planner.test.ts` og `substitution.test.ts` (der med en katalogkopi som utløper 23.11.). `PriceObs` har ingen `validFrom`, så kommende katalogtilbud kan ikke uttrykkes (`it.todo`).
2. **Låst rett overstyrer senere allergi- eller kostkrav** (`src/engine/planner.ts`, `generatePlan`). **Rettet:** absolutte krav vinner over lås; `lockedViolations(slots, ctx)` gir `{day, recipeId, reason: 'allergen'|'kost'|'råvare'}`, og `generatePlan` slipper disse ut og planlegger dagen på nytt. Tidsgrensen er unntatt. `WeekView.tsx` varsler etter «Lag ukeplan»/«Lag ny uke», viser brudd i gjeldende plan (f.eks. etter synk av nye krav) og låser aldri en rett som bryter kravene. `it.fails` er gjort om til vanlige tester (se matrisen). En låst rett på en dag som slås av slippes ut med varsel i UI (prøvd i nettleser).
3. **Tilbud har ingen butikk eller område** (`src/engine/deals.ts` `OfferHint`, `offerTotal.ts`). **Rettet på kjedenivå:** `OfferHint.chain` + `Settings.offerChains`, filtrert i `dealsFor` og `totalWithOffers` (`hintsForChains`); ingen valgt kjede gir `blocked: 'kjede'` og en forklaring. Utsalg/region skilles fortsatt ikke (Tjek har det ikke).
4. **Prisgrunnlag lagres ikke med uka** (`src/store.ts` `AppState`).
5. **Handleliste uten sync-server** (`src/sync/queue.ts`): utboksen blir aldri sendt; `store.ts` utboks vokser uten tak. *Rettet:* synk-server og delt husstand (`docs/synk.md`). Uten husstand blir utboksen fortsatt liggende lokalt.
6. **Etikettfelt er fritekst** (`PlanForm.tsx:~87`): hjelpeteksten er lagt til, men feltet hindrer ikke barnenavn.
7. **Manuelle avislinjer** får id `m${s.manual.length}-${tekst}` (`PapersView.tsx:64`): etter sletting og ny linje med samme tekst kan to linjer få samme id og avkrysning. *Rettet:* manuelle linjer er hendelser med tilfeldig id (`src/sync/list.ts`).
8. **Ingen språkbrudd funnet**: ingen «garantert», «allergenfri» eller «sluttpris» uten benektelse (skannet).
9. **Ingen hemmeligheter, ingen `Date`/`Math.random`/nettverk i motoren, ingen geolokasjon** (skannet; se regel 1 og 7).
10. Brukernes `localStorage` har nøkkelen `middag-state-v1`; migrering fra `settings.pantry` er idempotent (`store.test.ts`). Ny, inkompatibel tilstand ville trenge en versjon (ingen i dag utenom nøkkelnavnet).

## Prioritert liste

**Må fikses før en pilot**
- ~~Tilbud må knyttes til husstandens butikker eller område (funn 3)~~ Rettet på kjedenivå. Utsalg/region gjenstår (krever kilde som har det).
- ~~Låst rett vs. allergi/kost (funn 2)~~ Rettet: absolutte krav vinner over lås.
- Ekte prisdata for minst én av Rema 1000, Kiwi og Coop, eller snevre inn løftet (fase 0-porten). Uten det kan 90 %-målet aldri måles.
- Tjek-avtalen: bekreft med Tjek kreditering, kallgrense, varighet og pris (`phase0/tjek-avtale.md`; omfanget ellers er brukerens opplysning 2026-11-22).
- ~~Sync-server for kjøpshendelser (funn 5)~~ bygget (`docs/synk.md`); se «Må på plass før ekte familier» der (TLS, backup, personvern, test på ekte telefoner).
- Personvern: tekst om enhets-id og lokal lagring; DPIA-vurdering før ekte husstander (se `docs/personvern/`).

**Bør fikses**
- Lagre prisgrunnlag, handledag, tilbud og regelversjon sammen med uka (funn 4), så en rapportert feil kan gjenskapes.
- «Tilbud nå»: paginering eller grense, og rett 28 px overflyt på 420 px.
- Vis omfang (utsalg/region/kjede) og «anslått» på hver handlelinje og i detaljvisningen.
- Merk ekte Tjek-tilbud og demopriser tydeligere som ulike kilder i samme skjerm.
- Nullstill åpen utgave når brukeren trykker på den aktive fanen; unik id for manuelle linjer (funn 7).
- La «Slett lokale data» være synlig også før første plan.

**Kan vente**
- Avissider og «Les hos kjeden» (avhenger av avtaler, fase 0).
- Versjonering av lagret tilstand.
- Skjermleser- og tastaturtest av hele flyten (opprydding/tilgjengelighet-økta).
- Test på to ekte enheter når sync finnes.

## Utvidelse A: «Lag nå» (2026-11-22)

Eierens beslutning: utvidelsene bygges i rekkefølgen A, B, C. A og B er bygd (B: se under). C (husholdningsvarer) er ikke påbegynt, og ingen KI.

**Hva:** Matskap → «🍳 Lag nå». Viser det som finnes hjemme (bekreftet hjemme + kjøpt og ikke brukt fra `deriveStock`; forventet rest er aldri med), lar brukeren krysse av, legge til, rette mengde eller merke «⏰ Bruk snart», og foreslår middager fra oppskriftsbasen. Hvert forslag viser tid, porsjoner, andel som finnes, hva som finnes (også «bare 200 g hjemme» og «mengde ikke oppgitt»), hva som mangler med pakning, pris og prisstatus, anslått sum eller «Ufullstendig prisgrunnlag», allergentekst og fremgangsmåte. «Legg manglende på handlelista» lager vanlige manuelle linjer (strøm `liste`, ingen nye felt), vist i handlelista under «Fra «Lag nå» (ikke kontrollert)», ikke med i beregnet sum, også uten ukeplan.

**Regler (motor, `src/engine/cookNow.ts`):** absolutte krav filtrerer med `requirementViolation` (allergi, kost, råvarer), også mot full dekning og «snart». Dekning er mengdebevisst (har/behov per vare, skalert til porsjonene; basisvarer teller ikke; ukjent mengde = funnet og merket). Det som mangler prises med `basketForNeeds` (skilt ut av `buildBasket`, samme `resolvePrice`, allergifilter på produkt og hele pakninger), i vanlig butikk, med dagens dato som handledag. Rangering: dekning i promille + 200 per «snart»-vare, færrest manglende, kjent prisgrunnlag foran ufullstendig, lavest kjent pris, kortest tid, id. Tom tilstand har fire grunner (`ingen-varer`, `ingen-porsjoner`, `ingen-retter`, `ingen-dekning`).

**Lagring og personvern:** egne valg i `AppState.cookNow` (bare på enheten, ikke i noe synkdokument eller noen strøm, endrer aldri beholdningsloggen), med i «Last ned mine data» via `lagretPåEnheten`, nevnt i personvernarket og `docs/synk.md`.

**Bevis:** `src/engine/cookNow.test.ts` (22 tester, skrevet før koden og sett røde: determinisme også med omvendt rekkefølge i inndata og katalog, inndata endres ikke, allergi/kost/råvare vinner, uavklart allergenstatus gir ukjent pris, ukjent pris vinner aldri ved lik dekning, estimat, butikkvalg, «snart» løfter, mengdebevissthet, porsjonsskalering, tom tilstand); `planner.test.ts` «regresjon: «Lag nå» …»; `src/acceptance/lagna-ui.test.tsx` (6 tester, server-rendret tekst); `npm run check:a11y` utvidet med Lag nå (navn, overflyt på 360/420 px, tom tilstand som status, «bruk snart» med tastatur og `aria-pressed`, 44 px trykkflater, ingen dobbel innlegging i handlelista); `npm run check:contrast` uendret grønn.

**Oppskriftsbasen er liten:** 31 enkle demooppskrifter laget for demoen (`src/data/catalog.ts`), ingen fra andre kilder. UI sier det. Mange kombinasjoner av varer gir derfor få eller ingen gode forslag; ingen oppskrifter er funnet på eller hentet inn (regel 6).

**Ikke testet / åpent:** ikke prøvd med skjermleser eller på ekte telefon; demopriser bare (ingen ekte prisdekning, regel 5); «må brukes snart» er brukerens eget valg, appen kjenner ikke holdbarhet; vekten 200 promille er et skjønn, ikke målt mot brukere; manglende varer prises bare i vanlig butikk; avkrysning i «Lag nå» deles ikke med andre i husstanden (bevisst, men kan overraske).

## Utvidelse B: basisvarer med minstebeholdning (2026-11-22)

**Bare A og B er bygd.** C (husholdningsvarer som toalettpapir og vaskemidler) og KI er ikke påbegynt.

**Hva:** Matskap → «🧂 Basisvarer». Husstanden velger varer den alltid vil ha hjemme fra en generell liste (18 vanlige varer, `src/data/staples.ts`, ingen priser) eller som egen vare (kort varenavn). Varer som telles i matskapet (mel, ris, pasta, tomater, linser, melk, egg, ost, soyasaus) kan få minstemengde i g/ml/stk; alle kan markeres «Har», «Snart tom» eller «Tom». Når beholdningen (bekreftet hjemme + kjøpt og ikke brukt, `deriveStock`) er under grensen, eller varen er markert «snart tom»/«tom», foreslås den i handlelista under «🧂 Forslag: basisvarer» med «Legg på lista» og «Ikke nå». Godkjente linjer står under «🧂 Basisvarer (ikke kontrollert)», uten pris og ikke med i beregnet sum, også uten ukeplan. «Lag nå» viser basisvarene som informasjon («Finnes · Har»), uten å endre det som regnes som hjemme eller rangeringen.

**Regler (motor, `src/engine/staples.ts`):** ren og deterministisk; tilstanden avledes av hele loggen sortert på (at, id). Siste markering gjelder; «snart tom»/«tom» oppheves av kjøp, telling, bekreftet rest eller avkrysset basisvarelinje (ikke av «laget»); «har» gjelder til beholdningen endres. Uten markering avgjør grensen; en vare som aldri er telt eller kjøpt er ukjent (ingen forslag), ikke null. Akkurat på grensen er nok. Forslag har linje-id `basis:<uke>|<vare>`: godkjent to ganger eller på to enheter gir én linje, avvist kommer ikke igjen samme uke, og så lenge en basisvarelinje ligger åpen foreslås varen ikke igjen. En basisvarelinje krysses av for sin egen uke. Basisvarer påvirker aldri kurv, butikksum, sammenligning, budsjettsvar eller allergi-/kostfilter (planmotoren leser dem ikke).

**Synk (begrunnelse i `docs/synk.md`, «Basisvarer»):** varer og grenser i innstillingsdokumentet, flettet per vare (`basis:<id>`; samme vare endret ulikt = konflikt); markeringer som `nivå`-hendelser i `beholdning`; forslag som vanlige manuelle linjer. Ingen ny serverlagring, strøm eller dokumenttype. Strenge feltlister (`cleanEvent`, `isValidStaples` i `isValidDoc`), kvoter og dokumentgrense som før. Egne navn: høyst 30 tegn, uten tall og kontrolltegn, logges aldri. Med i «Last ned mine data» (innstillinger og beholdningslogg, forklart i filen) og i personvernarket.

**Bevis:** `src/engine/staples.test.ts` (23 tester, skrevet før koden og sett røde: terskel krysses, akkurat på grensen, ukjent ≠ null, «snart tom»/«tom» manuelt, opphevet av kjøp/telling/avkrysning og ikke av bruk, idempotens ved to mottak, omvendt rekkefølge, flere enheter, godkjenn/avvis/fjerning vinner, validering); `planner.test.ts` «regresjon: basisvarer …» (samme plan, kurv, sum og alternativer med og uten basisvarer, med ulike allergi- og kostkrav); `src/sync/engine.test.ts` (4 tester mot ekte server); `server/sync/api.test.ts` (2), `security.test.ts` (1), `export.test.ts` (1); `src/acceptance/basisvarer-ui.test.tsx` (5, server-rendret tekst, også personvernarket); `npm run check:a11y` utvidet med Basisvarer (navn, overflyt på 360/420 px, «Tom» med tastatur og `aria-pressed`, status-område for forslag, 44 px trykkflater, godkjent forslag legges inn én gang); `check:contrast` uendret grønn.

**Konvensjon fulgt:** UI-testen ligger i `src/acceptance/basisvarer-ui.test.tsx` (som `lagna-ui.test.tsx`), og regel-skanningen i `regler.test.ts` dekker nå også `src/data/staples.ts`.

**Ikke testet / åpent:** ikke prøvd med skjermleser eller på ekte telefon; ingen holdbarhet eller forbruksprognose (bare grense og manuelle markeringer); siste markering vinner ved samtidige ulike markeringer (som `telling`), avbøtet av at et forslag alltid må godkjennes; «Ikke nå» gjelder hele uka; manuelle linjer fra eldre uker blir stående til de fjernes (som før); en eldre, bufret app godtar ikke innstillinger med basisvarer før den er oppdatert; den generelle lista er et skjønn, ikke testet med brukere.

## Hvordan kjøre kontrollen på nytt
`npx tsc --noEmit && npx vitest run && npx vite build`. Nettleserflyten er ikke en sjekket inn test (Playwright er ikke avhengighet i repoet); stegene over kan gjentas manuelt på 420 px mot `npx tsx server/index.ts` etter bygg.
