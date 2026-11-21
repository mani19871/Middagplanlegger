# Tredjepartsmateriale

## tilbudstrolden-mcp
`src/offers/` er inspirert av grensesnittet og tolkingen av tilbudsdata i https://github.com/olgasafonova/tilbudstrolden-mcp
(MIT License, © 2026 Olga Safonova). Ordlistene for bearbeidede og ikke-mat-varer i `match.ts` er hentet derfra. Koden er skrevet om for dette prosjektet (øre, standardenheter, kildegrensesnitt).

Bruk av data fra Tjek/etilbudsavis krever skriftlig avtale og vilkår fra Tjek. Se `phase0/RESULTS.md`.

## Matvaretabellen (Mattilsynet)
`src/data/nutrition.json` er generert fra https://www.matvaretabellen.no/api/ med `scripts/build-nutrition.mjs`.
Matvaretabellen ber om å bli oppgitt som kilde, og oppdateres hver høst. Regenerer data etter hver årlige oppdatering.
Dataene gjelder generelle matvarer, ikke bestemte ferdigvarer, og brukes ikke til allergenstatus.
