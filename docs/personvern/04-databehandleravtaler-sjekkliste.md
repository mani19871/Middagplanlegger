# 04 Databehandleravtaler og underleverandører: sjekkliste

> **UTKAST. Ikke juridisk rådgivning. Må kvalitetssikres av noen med personvernkompetanse.** Artikkelhenvisninger fra generell kunnskap: må verifiseres. Ingen leverandør er valgt eller kontaktet. Ingen avtaler er inngått.

Sjekklisten brukes **før** en leverandør velges og **før** ekte persondata lagres der. Leverandørene i `docs/hosting.md` er eksempler, ikke utvalgt.

## 1. Alle leverandører som får behandle persondata

En leverandør er **databehandler** hvis den lagrer eller behandler personopplysninger på våre vegne. Da kreves skriftlig avtale (GDPR art. 28). Sjekk:

| # | Spørsmål | Ja/Nei/Merknad |
| --- | --- | --- |
| 1 | Finnes en databehandleravtale (DPA) vi kan godta eller signere, og gjelder den for akkurat tjenesten vi bruker? | |
| 2 | Står det at leverandøren bare behandler data etter vår instruks? | |
| 3 | Taushetsplikt for leverandørens ansatte? | |
| 4 | Sikkerhetstiltak beskrevet (kryptering, tilgangsstyring, sertifiseringer)? Vedlegg eller lenke til sikkerhetsdokumentasjon | |
| 5 | Underleverandørliste, og varsling om endringer med mulighet for å protestere? | |
| 6 | Hjelp til å oppfylle de registrertes rettigheter (innsyn, sletting)? | |
| 7 | Varsling av personvernbrudd uten ugrunnet opphold (vi har selv 72 timers frist til Datatilsynet, art. 33, må verifiseres), og hvor raskt? | |
| 8 | Sletting eller utlevering av alle data når avtalen opphører, og hvor lang tid det tar? | |
| 9 | Revisjon/informasjon: kan vi få dokumentasjon om etterlevelse? | |
| 10 | **Hvor ligger dataene** (region), og sikkerhetskopier, logger og støttesystemer i samme region? | |
| 11 | Overføring utenfor EØS (også ved fjerntilgang fra støtte eller drift)? Hvilket overføringsgrunnlag (angivelse av tilstrekkelig vern, standard personvernbestemmelser/SCC, e.l.)? Må verifiseres | |
| 12 | Leverandørens selskap og morselskap: hvilket land? Kan en myndighet i et annet land kreve innsyn? Hva gjør leverandøren i så fall? | |
| 13 | Bruker leverandøren våre data til egne formål (analyse, produktforbedring, trening av modeller)? Det skal være nei | |
| 14 | Avtalevilkår og pris ved endringer: kan leverandøren endre avtalen ensidig? | |
| 15 | Hvordan avslutter vi avtalen og får ut data (portabilitet, unngå innlåsing)? | |

Bevar kopi av avtaleversjonen og dato vi godtok den.

## 2. Per hostingvalg: tilleggssjekk

Valgene tilsvarer alternativene i `docs/hosting.md`.

### A. Europeisk VPS
- Er leverandøren etablert i EØS, og er datasenteret du velger i EØS? Bekreft regionen i bestillingen.
- Tilbyr de DPA i kundeportalen? (Mange gjør det; må verifiseres.)
- Hvilke underleverandører (datasenter, betaling, support)?
- Sikkerhetskopier: tas de hos leverandøren (region?) eller av oss (til hvilken lagring, og er den lagringen en egen databehandler)?
- Vi har **ansvaret** for operativsystem, brannmur og oppdateringer. Dokumenter hva som er gjort og av hvem.

### B. PaaS (f.eks. Fly.io, Render, Railway)
- Region som er valgt aktivt (EU), og om alle funksjoner vi bruker finnes der.
- Selskapets land: sannsynlig overføring ved tilgang fra USA. Hvilket grunnlag (sertifisering, SCC)? Må verifiseres.
- Underleverandørlisten er ofte lang (skytjenester under plattformen). Les den, og se om den inkluderer leverandører utenfor EØS.
- Kan vi låse region slik at data ikke flyttes?
- Gratisnivå: normalt uten DPA eller med dårligere vilkår. Ikke bruk til ekte persondata.
- Varig disk og sikkerhetskopi: hvem eier kopiene og hvor ligger de?

### C. Hyperscaler (Azure, AWS, Google Cloud)
- Vilkårene som gjelder (en samlet DPA ligger vanligvis i leverandørens online-vilkår, må verifiseres).
- Regionvalg, og om «kontrollplanet», support og overvåking også holdes i EØS.
- Underleverandørlister og endringsvarsler. Konfigurer varsling.
- Amerikansk morselskap: dokumenter risikovurderingen og overføringsgrunnlaget. Be fagperson vurdere.
- Hvilke sikkerhetssertifiseringer og revisjonsrapporter leverandøren oppgir, og hva vi trenger av dem.

### D. Selvdrift
- Ingen hostingleverandør, men: **fysisk sikring** (hvem har tilgang til rommet), kryptert disk, strøm og nett, sikkerhetskopi på annet sted.
- Databehandlere for øvrige tjenester (domene, e-post, kopilagring) må fortsatt dekkes av avtaler.
- Vi bærer alt ansvar for sikkerheten selv. Dokumenter tiltakene.

## 3. Øvrige mulige databehandlere

| Tjeneste | Når aktuelt | Persondata? | Tiltak |
| --- | --- | --- | --- |
| Hosting/lagring | Piloten | Ja | Avsnitt 1–2 |
| Lagring av sikkerhetskopier | Piloten | Ja (kryptert) | Kryptér før opplasting; EØS-region; avtale |
| Domene og DNS | Piloten | Lite (IP i oppslag) | Sjekk leverandørens avtale. Unngå tjenester som ruter all trafikk gjennom en tredjepart uten at det er vurdert (CDN/proxy ser trafikken) |
| E-post (support, utsendelser) | Hvis brukt | Ja | DPA, region, ingen markedsføringsbruk |
| Overvåking/oppetidssjekk | Piloten | Bør ikke få persondata | Overvåk bare den offentlige adressen, ikke send logger med IP |
| Feilsporing/logging som tjeneste | Hvis brukt | Kan inneholde IP, feildata | Unngå eller vurder som databehandler; ikke send kostkrav |
| Betaling/abonnement | Fase 2–3 | Ja | Egen vurdering før den bygges. Leverandør kan være egen behandlingsansvarlig |
| KI-leverandør | Fase 3 | Ja | Egen vurdering (minst mulig kontekst, ingen trening på våre data) |
| Tjek | Live tilbud | **Nei** (serveren sender bare varesøk) | Dette er en datakilde, ikke en databehandler. Rettighetsavtalen er et eget spor |
| Kassalapp | Prisdata | Nei | Samme |

## 4. Register

Før et register over databehandlere: navn, tjeneste, data, region, avtaledato, avtaleversjon, underleverandørliste (dato hentet), overføringsgrunnlag og ansvarlig hos oss. **[Eier fører.]** Gå gjennom hvert halvår og ved endringsvarsel.
