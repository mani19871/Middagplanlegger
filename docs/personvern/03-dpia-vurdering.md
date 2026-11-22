# 03 Skal vi gjøre en personvernkonsekvensvurdering (DPIA)?

> **UTKAST. Ikke juridisk rådgivning. Må kvalitetssikres av noen med personvernkompetanse.**
> **Ikke verifisert i sin helhet.** Ved et raskt søk 2026-11-22 ble bare utdrag av Datatilsynets sider lest, og aldersangivelsen på sidene tilsa at de kan være eldre. **Datatilsynets fullstendige liste over behandlinger som alltid krever DPIA er ikke lest.** Les den og kriteriene selv før konklusjonen brukes.

Planen krever at terskelen dokumenteres, og at DPIA gjøres **før** behandlingen hvis den sannsynligvis gir høy risiko eller står på Datatilsynets liste (`docs/plan.md`).

## 1. Metode (slik jeg forstår Datatilsynets veiledning)

Datatilsynets side «Når må man gjennomføre en vurdering av personvernkonsekvenser» beskriver to trinn:

1. Står behandlingen på Datatilsynets liste over behandlinger som alltid krever DPIA (GDPR art. 35 nr. 4)?
2. Hvis ikke: er det sannsynlig at behandlingen gir **høy risiko** for de registrertes rettigheter og friheter (art. 35 nr. 1)? Her brukes kriteriene fra Artikkel 29-gruppens veileder om DPIA (WP 248, på norsk hos Datatilsynet). Hovedregelen etter den veilederen er at **to eller flere kriterier** tilsier at DPIA trengs. Dette er min lesning og må verifiseres.

Kilder (ikke fullt lest):

- [Datatilsynet: Når må man gjennomføre en vurdering av personvernkonsekvenser](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdering-av-personvernkonsekvenser/nar-ma-man-gjennomfore-en-vurdering-av-personvernkonsekvenser/)
- [Datatilsynet: Veiledning om DPIA, når er risikoen høy](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdering-av-personvernkonsekvenser/nar-er-risiko-hoy/)
- [Datatilsynet: Sjekkliste for DPIA](https://www.datatilsynet.no/contentassets/8b767689abb14926af27820c9c2fb89e/sjekkliste-for-dpiafaser.pdf)
- [Artikkel 29-gruppen, veileder WP 248 (norsk)](https://www.datatilsynet.no/globalassets/global/dokumenter-pdfer-skjema-ol/regelverk/edpbartikkel29gruppen/Veileder-i-vurdering-av-personvernkonsekvenser-wp-248-norsk.pdf)
- [Personvernforordningen (GDPR)](https://eur-lex.europa.eu/eli/reg/2016/679/oj) (art. 35)

## 2. Trinn 1: Datatilsynets liste

Av utdragene jeg så, handler listen om blant annet biometri i stor skala, genetiske opplysninger, overvåking av ansatte, kameraovervåking i skoler og barnehager, og kommersiell profilering av atferd, posisjon eller preferanser, ofte i kombinasjon med et annet kriterium. **Middagsplanlegging i piloten ser ikke ut til å høre til noen av disse, men jeg har ikke lest hele listen.** Må verifiseres: les hele listen og kryss av.

## 3. Trinn 2: kriteriene

Mine vurderinger for piloten (noen hundre husstander, ingen KI, ingen betaling):

| Kriterium (WP 248, slik jeg gjengir dem) | Passer? | Begrunnelse |
| --- | --- | --- |
| 1. Vurdering eller poengsetting, inkludert profilering | Nei / lite | Appen rangerer retter og butikker, ikke personer. Kostkrav brukes til å filtrere, ikke til å vurdere personer |
| 2. Automatiserte avgjørelser med rettslig eller tilsvarende virkning | Nei | Motoren foreslår, bruker bestemmer. Ingen rettslig virkning |
| 3. Systematisk overvåking | Nei / lite | Ingen posisjon, ingen sporing. Beholdningslogg er brukerens egen registrering. Vurder på nytt hvis kjøpsdata eller kvitteringer kobles inn |
| 4. Sensitive eller svært personlige opplysninger | **Mulig** | Allergier og kostkrav kan være helse eller livssyn (`01-oversikt-behandling.md`, avsnitt 3). Tiltak: samtykke og lagring på enheten som standard |
| 5. Stort omfang | Nei i piloten, **mulig ved bred lansering** | Noen hundre husstander er lite. Antall registrerte, geografi og varighet må vurderes på nytt ved vekst |
| 6. Sammenstilling av datasett | Nei | Tilbudsdata og prisdata sammenstilles med varer, ikke med personer |
| 7. Sårbare registrerte (inkludert barn) | **Delvis** | Barns aldersgruppe og porsjon registreres, og eventuelle allergier. Ingen navn, ingen egen konto for barn. Foreldre legger det inn |
| 8. Innovativ bruk eller ny teknologi | Nei i piloten, **ja fra fase 3** | KI-forslag og bildetolkning er egne behandlinger som må vurderes før de bygges |
| 9. Hindrer registrerte i å utøve en rettighet eller bruke en tjeneste | Nei | Ingen kontrakt eller tjeneste avgjøres av dataene |

## 4. Foreløpig konklusjon (må bekreftes av fagperson)

- **Pilot:** to kriterier kan være berørt (4 sensitive opplysninger, 7 barn), men begge i svak form fordi opplysningene er få, uten navn, lagret på enheten som standard og delt kun etter samtykke, og omfanget er lite. Min foreløpige vurdering er at en **fullstendig DPIA trolig ikke er påkrevd i piloten**, men at terskelvurderingen **må dokumenteres og signeres av behandlingsansvarlig**, og at en kort DPIA («DPIA-lett», avsnitt 5) er verdt å gjøre uansett fordi det er helsenære opplysninger og barn. Dette er et skjønn en fagperson bør overprøve.
- **Bred lansering og fase 3 (KI, betaling, bilder):** trolig ja. Gjør full DPIA **før** disse behandlingene starter, og før bred lansering gjennomgås terskelen på nytt.
- Det som gir sterkest utslag mot konklusjonen: hvis kostkrav lagres per person med aldersgruppe på serveren **uten** samtykke og uten at de er skilt fra øvrige data, eller hvis omfanget blir stort.

**Beslutning:** [Ja/Nei DPIA i piloten. Dato. Signert av behandlingsansvarlig og rådgiver.] **[Fylles ut.]**

## 5. DPIA-lett for piloten (utkast, bygger på minimumsinnholdet i art. 35 nr. 7, må verifiseres)

1. **Beskrivelse av behandlingen:** se `01-oversikt-behandling.md`.
2. **Nødvendighet og forholdsmessighet:** datasparsomhet (etiketter i stedet for navn, postnummer i stedet for adresse, ingen posisjon). Kostkrav er nødvendige for formålet (allergifilter), men ikke for å lagre dem på serveren, så lagring på serveren krever samtykke.
3. **Risikoer for de registrerte og tiltak:**

| Risiko | Sannsynlighet / konsekvens (grov) | Tiltak |
| --- | --- | --- |
| Lekkasje av databasen gir innsyn i kostkrav koblet til husstand | Lav / middels–høy | Minst mulig lagret, kostkrav bare etter samtykke, kryptering i hvile og ved overføring, få med tilgang, sikkerhetskopier krypteres |
| Feil person ser husstandens data (enhetstoken stjålet, delt lenke) | Lav–middels / middels | Tilfeldige tokens, mulighet til å fjerne enheter, ingen kostkrav i delbare lenker |
| Samtykke gitt av feil person (en forelder for en annen voksen) | Middels / lav–middels | Utformingen i `06-samtykke-helsekost.md`, mulighet for den andre voksne å se og fjerne |
| Allergifilter oppfattes som garanti, og skade oppstår | Lav–middels / høy | Dette er en produktsikkerhets-, ikke personvernrisiko, men listes her: aldri garanti, uavklart allergenstatus godkjennes aldri (CLAUDE.md regel 4), tydelig tekst |
| Data oppbevares for lenge | Middels / lav | Automatisk sletting etter inaktivitet, sletting av husstand |
| Overføring til USA via leverandør | Avhenger av valg | Velg EØS-leverandør i piloten (`docs/hosting.md`) |
| Logger inneholder IP-adresser | Høy / lav | Kort loggtid, ingen kostkrav i logger |

4. **Rest-risiko:** [Fylles ut etter gjennomgang. Er den høy etter tiltak, må Datatilsynet konsulteres før behandlingen starter (art. 36, må verifiseres).]

## 6. Når terskelen må vurderes på nytt

Ved endring: KI-funksjoner, bilder og kvitteringer, betaling, kobling av kjøpsdata, deling mellom husstander, ny leverandør eller land, og et vesentlig høyere antall husstander.
