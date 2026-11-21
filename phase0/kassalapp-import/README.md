# Kassalapp-importtest (fase 0)

**Spørsmål:** Hvor mange linjer i en reell ukehandel kan prises fra Kassalapp, per kjede og område, og hvor ferske er prisene?
Planen sier at Kassalapp mangler løpende priser fra Rema 1000, Kiwi og Coop, så dette måles, ikke antas.

## Oppsett
- Nøkkel i miljøvariabelen `KASSALAPP_TOKEN` (aldri i git). Sjekk gjeldende API-dokumentasjon på https://kassal.app/api og vilkårene for kommersiell bruk (Bedrift-plan).
- `node phase0/kassalapp-import/probe.mjs` leser `baskets.json`, søker hver vare, og skriver `out/coverage.json` og `out/coverage.md`.

## Det som måles
Per kjede og område: andel varelinjer med pris, alder på prisen (dager), pakningsstørrelse funnet/ikke funnet, ukjent. Ingen landsgjennomsnitt som skjuler lokale hull.

## Port
Fyll ut `phase0/RESULTS.md`: dokumentert dekning, mangelliste, anbefaling (fortsett / snevre inn løftet / velg pilotområder). Ti prøvekurver sammenlignes mot faktiske kjøp (kvitteringer) i ulike landsdeler.

`baskets.json` inneholder bare et startsett; utvid til ti kurver med reelle varer.
