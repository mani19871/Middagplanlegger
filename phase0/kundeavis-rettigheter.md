# Kundeavis-rettigheter per kjede

Status 2026-11-22: **ikke kontrollert.** Kjedenes nettsteder (rema.no, kiwi.no, coop.no, meny.no, spar.no, joker.no, bunnpris.no, europris.no, norgesgruppen.no) og `tjek.com` er blokkert i miljøets nettverk, og tilgang er ikke godkjent. Ingen vilkår, om-oss-sider eller aviser er lest eller hentet. Ingen avis er lagret.

Kjedene under er de vi har **sett som dealere i Tjek-treff** (2026-11-21, `phase0/RESULTS.md` § Tjek). At en kjede finnes i Tjek betyr ikke at Tjek har rett til å la oss vise kjedens aviser.

Kolonnen «Eier/avsender» er ikke kontrollert mot kilde. Den skal fylles ut fra kjedens egen side (firmanavn, organisasjonsnummer, kontakt for samarbeid). Anbefalt visningsmåte er satt etter det vi faktisk vet: **ingenting er lest**, så alle står på forsiktig standard.

| Kjede (Tjek-dealer) | Eier/avsender | Hvor avisen er offentlig tilgjengelig | Kjedens vilkår for bruk av avis/tilbudsdata | Anbefalt visningsmåte nå |
| --- | --- | --- | --- | --- |
| REMA 1000 | Ikke kontrollert | Ikke kontrollert (kjedens egen nettside) | Ikke kontrollert, vert ikke tilgjengelig | Ingen avisinnhold. Tilbudsliste kun via Tjek live, i den grad avtalen tillater (se `tjek-avtale.md`) |
| KIWI | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Coop Extra | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Coop Prix | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Coop Mega | Ikke kontrollert (ingen relevante Tjek-treff i vår måling) | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Obs | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Coop Marked | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Meny | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| SPAR | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Joker | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Bunnpris | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Europris | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Matkroken | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |
| Nærbutikken | Ikke kontrollert | Ikke kontrollert | Ikke kontrollert, vert ikke tilgjengelig | Som over |

Andre dealere sett i Tjek-treffene (stort sett ikke dagligvare, ikke vurdert): Afood Market, Apotek 1, Biltema, CC Mat, Clas Ohlson, Gigaboks, Holdbart, Jacobs, Kids Outlet, Lekia, Megaflis, Price Lagerbutikk, Ringo, Rusta, Scandinavian Park, Skeidar, Søstrene Grene.

## Sjekkliste per kjede (det som må leses og hvor)
For hver kjede, fra kjedens **egen offentlige side** (ikke skraping; bare vilkår, om-oss, personvern/«bruksvilkår», presse/samarbeid):
1. **Avsender:** firmanavn, eier/konsern, kontakt for samarbeid/data (ofte «presse», «samarbeid», «leverandør» eller kundeservice).
2. **Hvor avisen publiseres:** kjedens egen tilbuds-/avissider og hvilke tredjepartstjenester de bruker (f.eks. Tjek).
3. **Nettstedets bruksvilkår:** hva som står om gjenbruk av innhold, bilder, priser, automatisk uthenting, og lenking.
4. **Opphavsrett/varemerke:** vilkår for logo og bilder.
5. **Eventuelt API/data for partnere:** står det noe offentlig om datafeed eller partnerprogram?
6. **Tilbudsvilkår som må tolkes riktig:** medlemspris, mengdekjøp, kampanjeområde.

Anbefalt visningsmåte avgjøres per kjede først etter at punktene 1–5 er lest, med valg mellom: (a) lenke til kjedens egen avis, (b) liste over enkelttilbud fra en avtalt kilde, (c) ingen visning. Inntil videre: (c) for avisinnhold, ingen bilder, ingen lagring (CLAUDE.md).

## Hva som trengs for å gjøre dette
Godkjenning (via `update_environment`) av de enkelte vertene over, én om gangen, eller at brukeren leverer vilkårene som filer i repoet.
