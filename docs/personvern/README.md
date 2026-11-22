# Personvern: utkast

> **UTKAST. Ikke juridisk rådgivning.** Disse dokumentene er skrevet av en utviklerassistent for å gjøre arbeidet med personvern konkret. De **må kvalitetssikres av noen med personvernkompetanse** (jurist eller personvernrådgiver) før piloten åpnes for ekte husstander, slik planen krever (`docs/plan.md`, «KI, personvern og kjøpsvilkår»). Der en lov, paragraf eller myndighetsuttalelse ikke er kontrollert, står det **«må verifiseres»**.

Datert 2026-11-22. Beskriver piloten slik den er planlagt: webapp, kontolaus husstandssynk (under bygging i egen økt, se `docs/synk.md` når den foreligger), ingen KI, ingen betaling, ingen bilder.

| Dokument | Innhold |
| --- | --- |
| [01-oversikt-behandling.md](01-oversikt-behandling.md) | Hvilke data, formål, behandlingsgrunnlag (art. 6), art. 9, oppbevaring, tilgang |
| [02-personvernerklaering.md](02-personvernerklaering.md) | Personvernerklæring for brukerne, klart språk (med felt som må fylles ut) |
| [03-dpia-vurdering.md](03-dpia-vurdering.md) | Terskelvurdering: trengs personvernkonsekvensvurdering (DPIA)? |
| [04-databehandleravtaler-sjekkliste.md](04-databehandleravtaler-sjekkliste.md) | Sjekkliste for databehandleravtaler og underleverandører per hostingvalg |
| [05-innsyn-retting-sletting.md](05-innsyn-retting-sletting.md) | Rutine for innsyn, retting, sletting og avvik |
| [06-samtykke-helsekost.md](06-samtykke-helsekost.md) | Samtykke for helserelaterte kostvalg; hvem kan samtykke for barn og andre voksne |

## Hva som er sjekket og ikke sjekket

- **Sjekket mot offentlig kilde (ved et raskt søk 2026-11-22, bare utdrag lest):** at Datatilsynet har en egen side om når DPIA kreves, med to trinn (er behandlingen på deres liste, og ellers: er risikoen sannsynligvis høy); at gjeldende aldersgrense for barns samtykke i personopplysningsloven § 5 er 13 år, og at et forslag om 15 år har vært på høring høsten 2025. Om forslaget er vedtatt, er ikke kontrollert.
- **Ikke sjekket:** alle paragrafhenvisninger i personvernforordningen (GDPR) er fra generell kunnskap og må kontrolleres; norske særregler (personopplysningsloven, ekomloven); Datatilsynets fullstendige liste over behandlinger som alltid krever DPIA; leverandørenes vilkår.
- **Avhenger av synk-løsningen** som bygges nå: hvilke felt som lagres på serveren, om e-post brukes, og hvordan sletting av husstand virker. Utkastene antar det som står i planen og i CLAUDE.md (postnummer, aldersgrupper, etiketter, porsjoner, ingen presis posisjon, ingen barns navn). Når `docs/synk.md` er ferdig, må dokumentene gås gjennom på nytt.

## Åpne punkter som krever eierens svar

Se `docs/hosting.md` avsnitt 7 for hele listen. De viktigste for personvern: hvem som er behandlingsansvarlig, hvilken e-postadresse brukerne kan kontakte, valgt hostingleverandør, og hvem som kvalitetssikrer disse dokumentene.
