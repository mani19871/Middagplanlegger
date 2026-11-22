# Tjek: det som må dokumenteres før bruk utover live-visning

Status 2026-11-22: **ingen skriftlig avtale eller vilkår fra Tjek ligger i repoet**, og Tjeks offentlige vilkår (`https://tjek.com/terms`, oppgitt i `Link`-headeren fra API-et) er **ikke lest**: verten `tjek.com` er blokkert i miljøets nettverk, og tilgang er ikke godkjent. Brukeren har opplyst muntlig at Tjek har godkjent bruk og sendt det som trengs. Det er ikke dokumentert i repoet. Når materialet foreligger: legg det i `phase0/` (eller `docs/`), og fyll kildekolonnen under.

Dette dokumentet gir ingen juridisk vurdering. «Ikke dokumentert» betyr bare at vi ikke har en kilde i hende.

## Tabell: hva vi må ha svart på

| Punkt | Hva må dokumenteres | Status | Kilde |
| --- | --- | --- | --- |
| Omfang | Hva avtalen/vilkårene dekker: bare tilbudsdata/live-visning, eller også kataloger/aviser | Ikke dokumentert. Muntlig opplyst: «tilbudsdata, live-visning» | Ingen skriftlig |
| Lagring | Om tilbud/historikk kan lagres og hvor lenge (cache, database, historikk) | Ikke dokumentert. Vi bygger uten lagring (kun minne) | Ingen skriftlig |
| Avissider | Om hele aviser/sider kan vises, eller bare enkelttilbud | Ikke dokumentert. Vi viser ingen avissider | Ingen skriftlig |
| Bilder | Rettigheter til tilbudsbilder og kjedelogoer (visning, hurtigbuffer, egen hosting) | Ikke dokumentert. Vi viser ingen bilder | Ingen skriftlig |
| Kreditering | Krav til kildeangivelse, logo, lenke tilbake | Ikke dokumentert | Ingen skriftlig |
| Rate limit | Tillatt kallfrekvens og dagskvote, nøkkelkrav | Ikke dokumentert. Observert 2026-11-21: API-et svarte 200 uten nøkkel ved ett kall per sekund; ingen grense er testet eller oppgitt | Egen observasjon (`phase0/tjek-probe/`), ikke en avtale |
| Pris | Lisens-/abonnementskostnad, fakturering, prisendringsvarsel | Ikke dokumentert | Ingen skriftlig |
| Land/kjeder | Hvilke land og hvilke kjeder/formater som dekkes (Rema, Kiwi, Coop-formater, Meny, Spar, Joker, Bunnpris, Europris ...) | Ikke dokumentert. Observert: tilbud fra disse kjedene finnes i norske søketreff, men Tjek-avtalen kan avgrense dem | Egen observasjon, ikke en avtale |
| Geografi | Om tilbud gjelder alle utsalg eller bare områder, og om data har utsalgs-/kampanjeområde | Ikke dokumentert. Ikke undersøkt | – |
| Varighet | Avtaleperiode, fornyelse, prøveperiode | Ikke dokumentert | Ingen skriftlig |
| Oppsigelse | Oppsigelsestid, hva som skjer med lagret data ved opphør | Ikke dokumentert | Ingen skriftlig |
| Rettighetskjeden | At Tjek har rett til å videre-lisensiere kjedenes tilbud/aviser til oss (kjedene eier innholdet) | Ikke dokumentert. Se `phase0/kundeavis-rettigheter.md` | – |
| Endringer og ansvar | Rett til å endre vilkår/API, tilgjengelighet, ansvarsbegrensning | Ikke dokumentert | Ingen skriftlig |
| Personvern | Behandling av data om sluttbrukere, databehandling, logging | Ikke dokumentert. Vi sender ingen persondata til Tjek utover tekniske kall fra serveren | – |

## Tekniske observasjoner (ikke avtale)
- Endepunkter brukt: `GET https://api.etilbudsavis.dk/v2/offers/search?query=…&country_id=NO`. `/dealers` ga ingen norske dealere (306 oppføringer: 302 DK, 4 DE).
- API-et svarer uten nøkkel. Det betyr ikke at bruk er tillatt; det er bare hva API-et gjør.
- Svaret har `Link: <https://tjek.com/terms>; rel="terms-of-service"`.

## Hva som gjenstår
1. Få skriftlig avtale/vilkår fra Tjek og legg dem i repoet. Utkast til oppfølging: `phase0/utkast/tjek-oppfolging.md` (ikke sendt).
2. Lese `https://tjek.com/terms` (og lenkede API-/partnervilkår) og føre inn det de sier, i kolonnen «Kilde».
3. Til punktene over er dokumentert: bare live-visning, ingen lagring, ingen avissider, ingen bilder (som i CLAUDE.md).
