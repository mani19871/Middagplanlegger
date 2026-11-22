# Personvern: utkast

> **UTKAST. Ikke juridisk rådgivning.** Disse dokumentene er skrevet av en utviklerassistent for å gjøre arbeidet med personvern konkret. De **må kvalitetssikres av noen med personvernkompetanse** (jurist eller personvernrådgiver) før piloten åpnes for ekte husstander, slik planen krever (`docs/plan.md`, «KI, personvern og kjøpsvilkår»). Der en lov, paragraf eller myndighetsuttalelse ikke er kontrollert, står det **«må verifiseres»**.

Datert 2026-11-22. **Avstemt samme dag mot den bygde synk-løsningen** (`docs/synk.md`, `server/sync/`, `src/sync/`) og driftsoppsettet (`docs/hosting.md`, `docs/drift/`). Beskriver piloten: webapp, kontoløs husstandssynk med enhetstoken, ingen KI, ingen betaling, ingen bilder. **Fortsatt UTKAST: ingenting er vurdert av en fagperson.**

| Dokument | Innhold |
| --- | --- |
| [01-oversikt-behandling.md](01-oversikt-behandling.md) | Hvilke data, formål, behandlingsgrunnlag (art. 6), art. 9, oppbevaring, tilgang |
| [02-personvernerklaering.md](02-personvernerklaering.md) | Personvernerklæring for brukerne, klart språk (med felt som må fylles ut) |
| [03-dpia-vurdering.md](03-dpia-vurdering.md) | Terskelvurdering: trengs personvernkonsekvensvurdering (DPIA)? |
| [04-databehandleravtaler-sjekkliste.md](04-databehandleravtaler-sjekkliste.md) | Sjekkliste for databehandleravtaler og underleverandører per hostingvalg |
| [05-innsyn-retting-sletting.md](05-innsyn-retting-sletting.md) | Rutine for innsyn, retting, sletting og avvik |
| [06-samtykke-helsekost.md](06-samtykke-helsekost.md) | Samtykke for helserelaterte kostvalg; hvem kan samtykke for barn og andre voksne. **Ikke nødvendig i piloten** (kostkrav lagres ikke på serveren), beholdt for senere deling |

Se også [`../pilot-sjekkliste.md`](../pilot-sjekkliste.md) (alt som må være på plass før ekte familier) og [`../hosting.md`](../hosting.md).

## Kort fasit: hva som lagres (avstemt mot koden)

- **På serveren, bare med husstand:** husstands-id, medlemmer (tilfeldig offentlig enhets-id, etikett ≤ 24 tegn, rolle, sha256 av token, tidspunkter), invitasjoner (HMAC av kode), hendelseslogg (beholdning, avkrysning og egne handlelinjer, utsolgt/fant ikke) og to dokumenter (plan, innstillinger med etiketter, porsjoner, butikker, budsjett).
- **Aldri på serveren:** postnummer, allergier og kostkrav (valg A), tilbud fra Tjek, planhistorikk, passord, e-post, navn, posisjon.
- **På enheten:** alt over pluss kostkrav, postnummer og **enhetstokenet i klartekst i `localStorage`**.
- **Sletting:** eier sletter husstanden med kaskade; spor kan ligge kort i `-wal` og i sikkerhetskopier. Fjernede medlemmer ligger igjen som rad til husstanden slettes (svakhet).
- **Ikke bygget:** eksport, automatisk sletting etter inaktivitet, lenke til personvernerklæring i appen, samtykkeskjerm (ikke nødvendig i piloten).

## Hva som er sjekket og ikke sjekket

- **Sjekket mot offentlig kilde (ved et raskt søk 2026-11-22, bare utdrag lest):** at Datatilsynet har en egen side om når DPIA kreves, med to trinn (er behandlingen på deres liste, og ellers: er risikoen sannsynligvis høy); at gjeldende aldersgrense for barns samtykke i personopplysningsloven § 5 er 13 år, og at et forslag om 15 år har vært på høring høsten 2025. Om forslaget er vedtatt, er ikke kontrollert.
- **Ikke sjekket:** alle paragrafhenvisninger i personvernforordningen (GDPR) er fra generell kunnskap og må kontrolleres; norske særregler (personopplysningsloven, ekomloven); Datatilsynets fullstendige liste over behandlinger som alltid krever DPIA; leverandørenes vilkår.
- **Avstemt mot synk-løsningen (2026-11-22):** hvilke felt som lagres, at e-post ikke brukes, at kostkrav og postnummer ikke synkes, og hvordan sletting virker er lest i koden. Sletting (kaskade), WAL-spor, volum, sikkerhetskopi og gjenoppretting er prøvd i en Docker-kjøring (ikke hos en leverandør). **Hvis synk-løsningen endres** (f.eks. kontoer, deling av kostkrav, nye felt, oppbevaringsrutine, rettet fjerning av medlemmer), må dokumentene gås gjennom på nytt. Merk også: det finnes ingen aldersgruppe i datamodellen (tidligere utkast sa det).

## Åpne punkter som krever eierens svar

Se `docs/hosting.md` avsnitt 7 for hele listen. De viktigste for personvern: hvem som er behandlingsansvarlig, hvilken e-postadresse brukerne kan kontakte, valgt hostingleverandør, og hvem som kvalitetssikrer disse dokumentene.
