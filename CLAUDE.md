# Middagsplanlegger – regler for Claude Code

Fullstendig plan: `docs/plan.md`. Les den før du endrer noe stort. Språk i UI og dokumenter: norsk (bokmål).

## Prosjekt
Landsdekkende norsk middagsplanlegger: ukeplan, én handlekurv, anslått pakningspris i én eller to butikker, kundeaviser. Fase 1 er en webapp (Vite + React + TypeScript). `npm run dev`, `npm test`, `npm run build`.

## Regler som ikke kan brytes
1. **Planmotoren (`src/engine/`) er ren og deterministisk.** Samme inndata og prisversjon gir samme kurv, sum og begrunnelse. Ingen `Date.now()`, tilfeldighet eller nettverk i motoren. Beløp i øre (heltall), mengder i g/ml/stk.
2. **Hver pris har kilde, geografisk omfang, dato og status** (ordinær, tilbud, estimat, ukjent). Historisk pris blir aldri automatisk dagens tilbud. Vis «anslått», aldri løfte om sluttpris.
3. **Ukjent pris vinner aldri** butikksammenligningen og gir svaret «Ufullstendig prisgrunnlag».
4. **Allergener:** appen garanterer aldri allergenfrihet. Uavklart allergenstatus godkjennes aldri som erstatning ved aktivt filter. Absolutte krav (kost, allergi) filtrerer; preferanser rangerer bare.
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
- Tjek: brukeren opplyser at Tjek tillater bruk av alt vi finner (opprinnelig omtalt som **tilbudsdata, live-visning**). Vi bygger fortsatt bare live-visning uten lagring til skriftlige vilkår foreligger (ingen lagring, ingen avissider, ingen bilder). Godkjenningen er ikke dokumentert skriftlig i repoet ennå; legg den i `phase0/tjek-avtale.md` når den foreligger. `server/index.ts` holder tilbud bare i minnet. Se `THIRD_PARTY.md` og `phase0/RESULTS.md`.
