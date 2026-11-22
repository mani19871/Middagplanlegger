# Tredjepartsmateriale

## tilbudstrolden-mcp
`src/offers/` er inspirert av grensesnittet og tolkingen av tilbudsdata i https://github.com/olgasafonova/tilbudstrolden-mcp
(MIT License, © 2026 Olga Safonova). Ordlistene for bearbeidede og ikke-mat-varer i `match.ts` er hentet derfra. Koden er skrevet om for dette prosjektet (øre, standardenheter, kildegrensesnitt).

## Tjek (etilbudsavis)
Tilbud, priser, produktbilder og avissider fra Tjek/etilbudsavis brukes etter skriftlig avtale mellom AVVR AS og Tjek. Avtalen er fortrolig og ligger ikke i repoet. **Brukeren opplyser (2026-11-22)** at den tillater lagring av priser, bilder og avissider, dekker alle kjeder Tjek har og dekker bruk i appen for andre brukere. Det er brukerens opplysning, ikke avtaletekst vi har sett. **Ikke kjent for oss og må bekreftes med Tjek:** kreditering, kallgrense, varighet og pris. Rettighetene til innholdet tilhører Tjek eller kjedene (Tjeks offentlige vilkår § 11); ingenting her lisensierer det videre. Appen viser «Kilde: Tjek» med dato der Tjek-data vises. Se `phase0/tjek-avtale.md` og `phase0/RESULTS.md`.

## Matvaretabellen (Mattilsynet)
`src/data/nutrition.json` er generert fra https://www.matvaretabellen.no/api/ med `scripts/build-nutrition.mjs`.
Matvaretabellen ber om å bli oppgitt som kilde, og oppdateres hver høst. Regenerer data etter hver årlige oppdatering.
Dataene gjelder generelle matvarer, ikke bestemte ferdigvarer, og brukes ikke til allergenstatus.

## Oppskrifter
Ingen oppskrifter fra andre kilder er tatt inn (per 2026-11-22). Alle oppskrifter i `src/data/catalog.ts` er demooppskrifter eller egne oppskrifter skrevet for Husvett, og hver har `origin`. En oppskrift med `origin.kind: 'lisensiert'` krever et avsnitt her for rettighetshaveren (testet i `catalog.test.ts`). Avsnittet skal si hva tillatelsen dekker, kreditering, varighet og om det er brukerens opplysning eller avtaletekst vi har sett. Se `docs/oppskrifter-tillatelser.md`.
