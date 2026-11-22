# 01 Oversikt over behandlingen

> **UTKAST. Ikke juridisk rådgivning. Må kvalitetssikres av noen med personvernkompetanse.** Paragrafhenvisninger fra generell kunnskap, ikke kontrollert: «må verifiseres».

Dette dokumentet kan danne grunnlag for oversikten over behandlingsaktiviteter (GDPR art. 30; om og hvordan plikten gjelder oss, må verifiseres, men siden vi kan behandle helseopplysninger bør vi regne med at vi må ha en).

## 1. Parter

| Rolle | Hvem |
| --- | --- |
| Behandlingsansvarlig | **[Må avklares av eier: juridisk person, navn, organisasjonsnummer, adresse]** |
| Kontakt for personvern | **[E-postadresse må opprettes]** |
| Personvernombud | Trolig ikke påkrevd i piloten (må verifiseres, art. 37) |
| Databehandlere | Hostingleverandør og tilleggstjenester, se `04-databehandleravtaler-sjekkliste.md` |

## 2. Hvilke data, hvorfor og på hvilket grunnlag

Utgangspunktet er datasparsomhet: appen trenger lite. Det som **ikke** samles inn: barns navn, presis posisjon, fødselsdato, adresse, bilder, kvitteringer (bilder og kvitteringer hører til fase 3–4).

| # | Opplysning | Beskrivelse | Formål | Grunnlag (art. 6) | Art. 9? |
| --- | --- | --- | --- | --- | --- |
| 1 | Husstand | Postnummer (grov geografi, ikke adresse), valgte butikker, vanlig butikk, maks antall butikkstopp, budsjett | Gjøre ukeplan og prisberegning for riktig område | b) avtale om å levere tjenesten (må verifiseres: i en gratis pilot kan f) være et alternativ) | Nei |
| 2 | Spiseprofiler | Etikett («Voksen 1», «Barn 1», ikke navn), aldersgruppe, porsjonsstørrelse, hvilke dager hjemme | Regne mengder og porsjoner | b) | Nei i seg selv |
| 3 | **Kostkrav og allergener** | Vegetar, valgte allergener som skal unngås, matvarer som skal unngås (f.eks. svin, skalldyr, nøtter) | Filtrere bort retter som ikke passer | **a) samtykke**, se egen vurdering under | **Ja, mulig** (helse, evt. religion/livssyn) |
| 4 | Plan, handleliste og avkrysninger | Valgte middager, handleliste, hva som er krysset av | Levere tjenesten, også på tvers av enheter | b) | Nei, men kan avsløre kosthold |
| 5 | Beholdning og kjøpshendelser | Hva husstanden har registrert som kjøpt, brukt, igjen hjemme | Trekke varer fra behovet, unngå dobbeltkjøp | b) | Nei |
| 6 | Husstandsmedlemskap og enhetstoken | Hvilke enheter som hører til husstanden, tilfeldig enhets-id | Synk mellom enheter, tilgangskontroll | b) | Nei |
| 7 | Kontoopplysninger | **Avhenger av synk-løsningen.** Planen nevner «konto per voksen»; om e-post eller annen innlogging brukes i piloten, er ikke avklart | Innlogging, invitasjon, gjenoppretting | b) | Nei |
| 8 | Tekniske data og logger | IP-adresse, tidspunkt, nettleser og feilmeldinger i server- og proxylogger | Sikkerhet, feilsøking, å holde tjenesten oppe | f) berettiget interesse (interesseavveining må dokumenteres, må verifiseres) | Nei |
| 9 | Henvendelser | E-post eller skjema til støtte | Svare på henvendelser, innsyn, sletting | b)/c)/f) avhengig av innhold | Kan inneholde alt |
| 10 | Samtykkelogg | Når samtykke ble gitt, tekstversjon, husstands-id | Å kunne vise at samtykke er gitt | c)/f) (dokumentasjonsplikt, må verifiseres) | Nei |
| 11 | Lokal lagring i nettleseren | Plan, innstillinger og enhets-id lagres på brukerens enhet | Appen skal virke uten nett | Se «Lokal lagring» under | Som over |

**Ikke i piloten, kommer senere (egen vurdering før de bygges):** betaling og abonnement (fase 2–3), KI-forslag og bildetolkning (fase 3–4), deling av kvitteringspriser til Open Prices (eget, informert valg), varsler, markedsføring. **Barns profiler skal aldri brukes til markedsføring** (planen). Vi selger ikke data og bruker ikke dem til profilering for annonser.

### Data som ikke er persondata om brukerne
Tilbud hentes av **serveren** fra Tjek på varenavn. Ingen brukerdata sendes til Tjek, og Tjek ser bare serverens IP-adresse. Katalogdata og demodata (butikker, priser, oppskrifter) er ikke personopplysninger. Merk: demodata skal alltid være merket som demodata (CLAUDE.md regel 5).

## 3. Når artikkel 9 kommer inn

Artikkel 9 gjelder «særlige kategorier», blant annet helseopplysninger og opplysninger om religiøs eller filosofisk overbevisning. Behandling er som hovedregel forbudt med mindre et unntak i art. 9 nr. 2 gjelder.

- **Allergier og intoleranser** (f.eks. gluten, melk, nøtter): helseopplysninger. Et filter «unngå gluten» kan i praksis tilsi cøliaki, selv uten diagnose (planen sier det samme).
- **Kostkrav** som svin, storfe eller skalldyr kan antyde religiøs overbevisning. **Vegetar/vegan** kan være etisk eller filosofisk overbevisning. Om dette utløser art. 9, er et tolkningsspørsmål som må avklares med en fagperson. Vi bør behandle det forsiktig.
- **Betydning av koblingen:** opplysningene er knyttet til en husstand (via enhets-id/konto) og ofte til en spiseprofil («Barn 1, 4–6 år: nøtteallergi»). Det gjør dem identifiserbare, og de vil være personopplysninger selv uten navn.
- **Valgt unntak:** uttrykkelig samtykke, art. 9 nr. 2 bokstav a. Utforming og hvem som kan samtykke: se `06-samtykke-helsekost.md`.
- **Konsekvens for design (forslag):** (1) lagre kostkrav bare på enheten som standard, og send dem til serveren først når brukeren har samtykket til synk; (2) lagre kostkrav på husstandsnivå, ikke per person, der det er mulig (dagens `Settings` i motoren har `avoid` og `avoidFoods` på husstandsnivå, og `Eater` har bare etikett, porsjon og dager hjemme); (3) aldri vise kostkrav i delbare lenker, logger eller feilmeldinger.

## 4. Oppbevaringstid (forslag, må godkjennes av eier)

| Data | Forslag til oppbevaring | Merknad |
| --- | --- | --- |
| Husstandsdata (1–6) | Så lenge husstanden bruker appen. Slettes automatisk **[12] måneder** etter siste aktivitet, med varsel hvis e-post finnes. Slettes straks ved sletting av husstand | Tallet [12] er et forslag. Må avgjøres |
| Kostkrav (3) | Slettes når samtykket trekkes, eller sammen med husstanden | |
| Serverlogger med IP | **[14] dager** | Forslag. Gjelder også proxy og hosting-plattform |
| Sikkerhetskopier | Overskrives etter **[30] dager** | Slettede data kan finnes i kopier til da. Må opplyses om |
| Samtykkelogg | Så lenge samtykket gjelder, og deretter **[inntil 12 måneder]** for å kunne dokumentere | Må verifiseres |
| Henvendelser | **[12] måneder** etter avsluttet sak | Forslag |
| Regnskapsdata (fase 2+) | Etter regnskapsregler (må verifiseres) | Ikke i piloten |

Beholdningsloggen er en hendelseslogg (`src/engine/inventory.ts`). Sletting av husstand må slette hele loggen og utboksen, ikke bare den avledede tilstanden.

## 5. Hvem har tilgang

| Hvem | Til hva | Hvordan |
| --- | --- | --- |
| Husstandens medlemmer | Husstandens egne data | Gjennom appen, med enhetstoken/konto |
| Driftsansvarlig (navngitt person) | Servere og databasefil, ved feilretting | Personlig tilgang, nøkkel eller to-faktor, ingen delte passord. Tilgang logges der det er mulig |
| Utvikler | Kode og testdata, **ikke** produksjonsdata som hovedregel | Feilsøking i produksjon bare når nødvendig og dokumentert |
| Redaktør (oppskrifter, varekoblinger) | Katalog, ikke husstandsdata | Egen rolle uten tilgang til husstander |
| Hostingleverandør (databehandler) | Teknisk tilgang til infrastruktur | Underlagt databehandleravtale |
| Tjek, Kassalapp | Ingen husstandsdata | Serveren sender bare varesøk |

Prinsipp: minst mulig tilgang, navngitte personer, og en liste over hvem som har tilgang som oppdateres ved endringer. **[Eier fører listen.]**

## 6. Lokal lagring i nettleseren

Appen lagrer plan, innstillinger og en enhets-id på brukerens enhet (`localStorage`) for at den skal virke uten nett. Lagring av opplysninger i brukerens utstyr er regulert av ekomloven (samtykke kreves som hovedregel, med unntak for lagring som er strengt nødvendig for en tjeneste brukeren ber om). Hvilken paragraf og om vår bruk faller under unntaket, må verifiseres. Vi bruker ingen sporings- eller annonseinformasjonskapsler, og bør ikke innføre det uten ny vurdering.

## 7. Sikkerhetstiltak (minimum, art. 32 må verifiseres)

- HTTPS overalt, ingen hemmeligheter i repoet eller imaget (CLAUDE.md regel 7).
- Kryptert sikkerhetskopi i EØS, gjenopprettingsøvelse før piloten.
- Tilgang bare for navngitte personer, to-faktor på hosting- og domenekonto.
- Rutiner for sletting (`05-innsyn-retting-sletting.md`) og avvik.
- Oppdateringer av server og avhengigheter; CI kjører typesjekk, tester og bygg (`.github/workflows/ci.yml`).

## 8. Åpne punkter

1. Behandlingsansvarlig og kontaktadresse. 2. Om e-post brukes (påvirker innlogging og varsler). 3. Endelig liste over lagrede felt fra synk-løsningen. 4. Juridisk avklaring av art. 9 for kostkrav. 5. Oppbevaringstider. 6. Valg av hosting (påvirker underleverandører og overføringer).
