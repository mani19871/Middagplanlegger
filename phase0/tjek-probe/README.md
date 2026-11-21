# Tjek-dekningsmåling (fase 0)

**Spørsmål:** Har Tjek (eTilbudsavis) tilbud fra de norske kjedene vi mangler ferske priser for i Kassalapp (Rema 1000, Kiwi, Coop-formater), for varene i de samme ti prøvekurvene (`../kassalapp-import/baskets.json`)? Er tilbudene gyldige nå, og har de pris og mengde slik at pakningspris kan regnes?

## Status for tillatelse (viktig)
Brukeren har opplyst muntlig at Tjek har gitt tillatelse til å bruke dataene. **Det er ikke dokumentert.** Skriftlig avtale/vilkår fra Tjek må innhentes før noe av dette brukes utover denne målingen. API-et svarer med `Link: <https://tjek.com/terms>; rel="terms-of-service"`; vilkårene er ikke lest eller akseptert her. Målingen er skrivebeskyttet og lagrer bare tellinger, aldri tilbudstekst eller bilder.

## Endepunkter (offentlig, uten nøkkel, observert 2026-11-21)
Referanse: repoet olgasafonova/tilbudstrolden-mcp (MIT), `src/api.ts` og `src/offer-parsing.ts`.
- `GET https://api.etilbudsavis.dk/v2/dealers?country_id=NO&limit=100&offset=N` – for NO ignoreres `country_id`; vi filtrerer på `dealer.country.id` i svaret.
- `GET /offers/search?query=…&country_id=NO&limit=100&dealer_ids=…`
- Felt: `pricing.price`, `pricing.pre_price`, `quantity.size.from`, `quantity.unit.symbol`, `quantity.pieces.from`, `run_from`, `run_till`, `dealer_id`.

## Kjøring
`NODE_USE_ENV_PROXY=1 node phase0/tjek-probe/probe.mjs` (proxy-flagget trengs bare bak proxy). Ett kall per sekund, generisk User-Agent, ingen personopplysninger. Stopper ved 401/403 i stedet for å prøve å komme rundt. Utdata: `out/coverage.json` og `out/coverage.md` (bare aggregater; `out/` er ikke i git).
