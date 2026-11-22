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
- **Tilbud fra Tjek** lagres på serveren i en egen fil uten persondata (ikke husstandsdata).
- **Aldri på serveren:** postnummer, allergier og kostkrav (valg A), planhistorikk, passord, e-post, navn, posisjon.
- **På enheten:** alt over pluss kostkrav, postnummer og **enhetstokenet i klartekst i `localStorage`**.
- **Sletting:** eier sletter husstanden med kaskade; spor kan ligge kort i `-wal` og i sikkerhetskopier. Fjernede medlemmer ligger igjen som rad til husstanden slettes (svakhet).
- **Bygget siden første utkast:** eksport («Last ned mine data»), automatisk sletting etter inaktivitet (`SYNC_RETENTION_DAYS`), arket «Personvern» i appen (utkast). **Ikke bygget:** samtykkeskjerm (ikke nødvendig i piloten).

## Hva som er sjekket og ikke sjekket

- **Sjekket mot offentlig kilde (ved et raskt søk 2026-11-22, bare utdrag lest):** at Datatilsynet har en egen side om når DPIA kreves, med to trinn (er behandlingen på deres liste, og ellers: er risikoen sannsynligvis høy); at gjeldende aldersgrense for barns samtykke i personopplysningsloven § 5 er 13 år, og at et forslag om 15 år har vært på høring høsten 2025. Om forslaget er vedtatt, er ikke kontrollert.
- **Ikke sjekket:** alle paragrafhenvisninger i personvernforordningen (GDPR) er fra generell kunnskap og må kontrolleres; norske særregler (personopplysningsloven, ekomloven); Datatilsynets fullstendige liste over behandlinger som alltid krever DPIA; leverandørenes vilkår.
- **Avstemt mot synk-løsningen (2026-11-22):** hvilke felt som lagres, at e-post ikke brukes, at kostkrav og postnummer ikke synkes, og hvordan sletting virker er lest i koden. Sletting (kaskade), WAL-spor, volum, sikkerhetskopi og gjenoppretting er prøvd i en Docker-kjøring (ikke hos en leverandør). **Hvis synk-løsningen endres** (f.eks. kontoer, deling av kostkrav, nye felt, oppbevaringsrutine, rettet fjerning av medlemmer), må dokumentene gås gjennom på nytt. Merk også: det finnes ingen aldersgruppe i datamodellen (tidligere utkast sa det).

## Eierens beslutninger og åpne punkter (2026-11-22)

Ført inn i dokumentene 01, 02, 03 og 05:

- **Behandlingsansvarlig:** AVVR AS, org.nr. 935941644, Smedalsvegen 14, 2067 Jessheim (kommune: Ullensaker). Kilde: Enhetsregisteret, forretningsadresse (data.brreg.no, `/enhetsregisteret/api/enheter/935941644`), oppslag 2026-11-22.
- **Driftsansvarlig:** «Admin» (rolle). Rollen navngis ikke (eierens beslutning 2026-11-22). Responstid er ikke bestemt.
- **Oppbevaringstid for inaktive husstander:** 730 dager (`SYNC_RETENTION_DAYS=730`). Logger og sikkerhetskopier er ikke avgjort ([14] og [30] dager står som forslag).
- **Innloggingens levetid (enhetstoken):** 730 dager uten bruk (`SYNC_TOKEN_IDLE_DAYS`, standard 730), samme som oppbevaringstiden (pilot-sjekkliste D15, avgjort).
- **Pilot:** lukket, hele Norge.
- **Fagperson:** ikke nå. Dokumentene forblir utkast; det står fortsatt i sjekklisten som STOPP (B1).

Fortsatt **UAVKLART**: kontakt-e-post for personvern, domene (der erklæringen skal publiseres), hostingleverandør (dermed databehandler, land og overføringsgrunnlag). Hele listen: `docs/hosting.md` avsnitt 7.
