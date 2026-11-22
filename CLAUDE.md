# Middagsplanlegger – regler for Claude Code

Fullstendig plan: `docs/plan.md`. Les den før du endrer noe stort. Språk i UI og dokumenter: norsk (bokmål).

## Prosjekt
Landsdekkende norsk middagsplanlegger: ukeplan, én handlekurv, anslått pakningspris i én eller to butikker, kundeaviser. Fase 1 er en webapp (Vite + React + TypeScript). `npm run dev`, `npm test`, `npm run build`.

## Regler som ikke kan brytes
1. **Planmotoren (`src/engine/`) er ren og deterministisk.** Samme inndata og prisversjon gir samme kurv, sum og begrunnelse. Ingen `Date.now()`, tilfeldighet eller nettverk i motoren. Beløp i øre (heltall), mengder i g/ml/stk.
2. **Hver pris har kilde, geografisk omfang, dato og status** (ordinær, tilbud, estimat, ukjent). Historisk pris blir aldri automatisk dagens tilbud. Vis «anslått», aldri løfte om sluttpris.
3. **Ukjent pris vinner aldri** butikksammenligningen og gir svaret «Ufullstendig prisgrunnlag».
4. **Allergener:** appen garanterer aldri allergenfrihet. Uavklart allergenstatus godkjennes aldri som erstatning ved aktivt filter. Absolutte krav (kost, allergi) filtrerer; preferanser rangerer bare. Absolutte krav vinner over lås: `generatePlan` slipper ut låste retter som bryter allergi-, kost- eller råvarekrav (`lockedViolations`), og UI varsler og låser aldri slike retter. Tidsgrensen er unntatt.
5. **Demodata skal være merket som demodata.** Ikke presenter oppdiktede priser, butikker eller aviser som ekte. Ikke finn på leverandøravtaler eller dekningstall.
6. **Rettigheter:** bare avtalte eller lisensierte aviser, oppskrifter og bilder. Ikke hent kundeaviser selv.
7. **Personvern:** minst mulig persondata (postnummer, aldersgrupper, etiketter, porsjoner). Ingen presis posisjon eller barns navn. Ingen hemmeligheter i repoet; API-nøkler kun via miljøvariabler.
8. Importer og kjøpsbekreftelser skal tåle å mottas to ganger uten doble rader.

## Arbeidsmåte
- Nye regler i motoren krever test i `src/engine/planner.test.ts` (se regresjonslisten i planen).
- Ikke bygg funksjoner fra senere faser uten å bli bedt om det (KI = fase 3, egne apper = fase 3).
- Fase 0 er en port: uten dokumentert dekning bygger vi ikke videre som planlagt. Rapporter funn ærlig, også når dekningen er dårlig.
- Commit på brukerens utviklingsbranch. Ikke lag PR uten å bli bedt om det.

## Tilbudskilder (`src/offers/`)
- Eksterne tilbud går gjennom `OfferSource` og normaliseres til øre og standardenheter. Planmotoren kjenner ikke kildene.
- Et tilbud gir bare rabatt når det er gyldig på **handledagen** og vare, pris, mengde og vilkår er kjent. Uavklart går til kontroll (`needsReview`).
- Tjek: brukeren opplyser at Tjek har godkjent og sendt det de trenger, og tillater bruk av alt vi finner (opprinnelig omtalt som **tilbudsdata, live-visning**). Vi bygger fortsatt bare live-visning uten lagring til skriftlige vilkår foreligger (ingen lagring, ingen avissider, ingen bilder). Godkjenningen er ikke dokumentert skriftlig i repoet ennå; legg den i `phase0/tjek-avtale.md` når den foreligger. `server/index.ts` holder tilbud bare i minnet. Se `THIRD_PARTY.md` og `phase0/RESULTS.md`.
- Tilbudsrangering (`src/engine/deals.ts`): gyldige tilbud (på handledagen) med kjent pris, mengde og uten vilkårsord flytter valget av middager. Besparelsen regnes fra tilbudets egen førpris; tilbud uten førpris gir bare dekning. Tilbud endrer aldri butikksum eller kurv; allergi- og kostkrav slår alltid tilbud.
- Regelfil `src/data/offer-rules.json` (menneskekuratert, bare mønstre, aldri tilbud): `godkjent` kobler et mønster til en ingrediens, `avvist` stopper koblingen (med ingrediens) eller hele tilbudet (uten); `tillatt` er unntak fra utelukkelseslisten (f.eks. «soyasaus» trass i «saus») og gir bare forslag. Avvisning vinner alltid. Søkeordtreff uten regel er bare forslag. Redaktøren bruker Kundeaviser → Kontroll og eksporterer regelfilen; endringer sjekkes inn som vanlig kode.
- Kjeder (`src/engine/chains.ts`): `OfferHint.chain` er normalisert kjedenavn (`normalizeChain`, f.eks. «Coop Obs!» → «COOP OBS»). Bare tilbud fra kjeder i `Settings.offerChains` (valgfritt felt) teller i rangering og «Med kontrollerte tilbud» (`hintsForChains`). Ingen valgt kjede = ingen tilbud (`blocked: 'kjede'`), og appen ber brukeren velge. Tjek skiller ikke på utsalg: summen forutsetter at tilbudsvaren kjøpes hos den kjeden. Demobutikkene har ingen kjede.
- «Med kontrollerte tilbud» (`src/engine/offerTotal.ts`): egen sum ved siden av basissummen, bare regelgodkjente tilbud (`OfferHint.approved`), gyldige på handledagen, samme enhet; besparelse fra førpris, aldri over linjens pris. Fyller aldri ukjent pris, brukes ikke ved aktivt allergifilter, og endrer aldri basissum, butikksammenligning eller budsjettsvar.

## Beholdning og kjøp (`src/engine/inventory.ts`)
- Beholdning er en hendelseslogg (`kjøp`, `løs`, `angre`, `laget`, `telling`, `rest`). `applyEvent` er idempotent på hendelses-id; tilstanden avledes alltid av hele loggen sortert på (at, id), så ankomstrekkefølge spiller ingen rolle. Tid, id og enhets-id settes utenfor motoren (`stamp()` i `src/store.ts`).
- Forventet rest (`pantry.ts`) er aldri beholdning. Bare bekreftet hjemme (`telling`, bekreftet `rest`) og kjøpt-ikke-brukt trekkes fra behovet, via `Ctx.stock` = `deriveStock(log, { planWeek })`. Ukas egne kjøp, «laget» og rester holdes utenfor ukas egen kurv, og hendelser etter ukas første kjøp gjelder neste handel.
- Kjøp har linje-id (uke, butikk, vare, produkt): to voksne på samme linje gir ett kjøp. Ulikt antall fra ulike enheter er `konflikt`, teller ikke og må bekreftes med `løs`. En bekreftet rest er total mengde igjen etter ukas middager og erstatter ukas kjøp og forbruk av varen.
- En kjøpt pakke betyr ikke at retten er laget; forbruk registreres bare med `laget` (mengder fra `slotUses`).
- Utboksen (`src/sync/queue.ts`) lagres lokalt og leveres til synk-serveren når enheten er med i en husstand. En mottaker må være idempotent på id.

## Utsolgt / fant ikke og planversjoner (`src/engine/substitution.ts`)
- Brukerens valg i butikken er en egen idempotent hendelseslogg (`erstatt`, `fant-ikke`, `angre-endring`), nøkkel (uke, butikk, vare, utsolgt produkt); siste valg etter (at, id) gjelder. Basiskurven endres aldri; `applyChanges` legger valgene oppå.
- Erstatning: samme vare, gyldig pris i samme butikk, ikke utsolgt; ved aktivt allergifilter avvises allergentreff og uavklart status (sammensatte varer). Pakker regnes mot nettobehovet. «Fant ikke» uten videre valg gir ukjent pris (ufullstendig kurv); «hopp over»/«bruk hjemme» tar linja ut. Ingen av dem lager kjøp; linjer i «fant ikke» kan ikke markeres handlet, og en handlet linje må angres før den kan endres.
- Hver endring og godkjenning lagres som ny `PlanVersion` med årsak; eldre versjoner endres aldri (opprinnelig anslag, også utløpt tilbud, står igjen). En godkjent liste holder på produktene sine (`activePin`); nye priser vises som avvik (`priceDrift`) til brukeren velger «Bruk nye priser» eller «Behold godkjent liste».
- Planmotoren bruker aldri en pris med `validUntil` før handledagen (utløpt tilbud).

## Synk og husstand (`src/sync/`, `server/sync/`, `server/storage/`; se `docs/synk.md`)
- Offline først: skriv alltid lokalt (hendelse + utboks, eller dokumentfelt i `AppState`), aldri direkte til serveren. Appen skal virke uten server.
- Ingen siste-skriving-vinner. Delt data er enten idempotente hendelser (beholdning, handleliste) eller versjonerte dokumenter med tre-veis fletting og eksplisitt konflikt (plan, innstillinger). Ny delt data må passe inn i en av de to modellene.
- Avkrysning lagres per person (`by`); «fjern kryss» fjerner bare kryss enheten har sett. `by` er enhetens offentlige id; serveren avviser hendelser som utgir seg for et annet medlem.
- Identitet uten passord/e-post: enhetstoken (bare sha256 på serveren), engangsinvitasjon med utløp. Etiketter, ikke navn.
- Synkes aldri: postnummer, kostkrav og allergier (`avoid`, `avoidFoods`, `vegetarian`; mulige helseopplysninger), tilbud fra Tjek. Serveren avviser ukjente felt.
- Alle endepunkter: autentisering avgrenset til husstanden, ratebegrensning, størrelses- og lengdegrenser, norske feilkoder. Ny lagring implementerer `SyncStorage` (PostgreSQL senere).
- Endringer i synk krever test i `server/sync/api.test.ts` eller `src/sync/engine.test.ts`.
