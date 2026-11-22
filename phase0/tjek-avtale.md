# Tjek: vilkår og det som må dokumenteres

Status 2026-11-22: **Tjeks offentlige vilkår er lest** (sidene under, hentet 2026-11-22). **En skriftlig avtale med Tjek finnes ifølge brukeren, men den er fortrolig og ligger ikke i repoet** (se «Brukerens opplysning» under). Brukeren har svart på spørsmål 1–5 (lagring, bilder, avissider, kjeder, avtalepart og bruk for andre brukere); svarene er brukerens opplysning, ikke avtaletekst vi har sett. Kreditering, kallgrense, varighet og pris er fortsatt ikke kjent for oss. Ingenting under er gjettet om hva den avtalen sier.

## Brukerens opplysning (2026-11-22)

Brukeren opplyser at:
- det finnes en **skriftlig avtale** med Tjek,
- avtalen er **merket fortrolig og deles ikke** (verken i repoet eller med utviklingsteamet),
- avtalen er **«ok»** for bruken i appen, ifølge brukeren.

Dette er brukerens egen opplysning. Den er ikke kontrollert her, fordi vi ikke har sett avtalen. Tjeks offentlige vilkår, § 4.1, sier at partene skal holde avtaleinnholdet hemmelig; det kan være grunnen, men det er ikke tolket her.

### Brukerens svar (2026-11-22)

Brukeren opplyser (2026-11-22) at avtalen:
1. **tillater lagring av priser** (og tilbud) fra Tjek,
2. **tillater både bilder og avissider**,
3. **dekker alle kjeder Tjek har**,
4. **dekker at AVVR AS bruker API-et i appen for andre brukere** (appens brukere, ikke tredjeparter som henter data videre).

**Fortsatt ikke kjent for oss:** krav til **kreditering** (tekst, lenke, logo), **kallgrense** (om § 8.5-taket på 8 000 000 kall per måned per land gjelder, eller noe annet), **varighet** (lisensperiode, oppsigelse, hva som skjer med lagrede data ved opphør) og **pris**. Heller ikke hvor lenge lagrede priser kan beholdes, om «bilder» også omfatter kjedelogoer, og om kjedenes egne rettigheter (Meny, SPAR og Joker, punkt 16 i deres vilkår; `kundeavis-rettigheter.md`) er klarert gjennom Tjek. **Dette må bekreftes med Tjek** (eller av brukeren etter å ha lest avtalen) før bred lansering.

**Arbeidsregel fra 2026-11-22 (til avtalen er bekreftet på punktene over):**
- Lagring er tillatt ifølge brukeren: tilbud og priser fra Tjek kan lagres på serveren, i en egen tabell uten persondata, med konfigurerbar oppbevaringstid. De lagres ikke i husstandens synkdata og synkes ikke mellom enheter.
- Bilder og avissider er tillatt ifølge brukeren: de vises bare fra Tjek-data, lastes fra Tjeks egne adresser (ikke lastet ned og lagret av oss), og hver visning krediterer kilden («Kilde: Tjek» med dato) selv om kravet ikke er kjent.
- Konservativt der avtalen kan avvike fra de offentlige vilkårene: bare på appens egne sider (§ 8.2), ingen innbygging, framing eller videreformidling til tredjeparter (§ 8.3–8.4), ingen åpne nedlastinger av lagrede priser, ingen KI-trening (§ 8.6), og kallbruken holdes langt under § 8.5-taket med ratebegrensning og bakoff.

### Spørsmål brukeren kan svare på uten å dele avtalen

Svar ja, nei eller «vet ikke» på hvert punkt. Svarene føres her med dato som brukerens opplysning:

| # | Spørsmål | Svar (dato) |
| --- | --- | --- |
| 1 | Tillater avtalen at vi **lagrer priser og tilbud** fra Tjek (for eksempel hurtigbuffer, historikk eller i husstandens handleliste)? Hvis ja: hvor lenge? | **Ja**, lagring av priser er tillatt (brukerens opplysning, 2026-11-22). Hvor lenge: ikke oppgitt |
| 2 | Tillater avtalen at vi viser **bilder** (produktbilder, kjedelogoer)? | **Ja**, bilder er tillatt (brukerens opplysning, 2026-11-22). Om kjedelogoer er med: ikke oppgitt. **Beslutning 2026-11-22: ingen kjedelogoer før Tjek bekrefter at logoer er med**; vi viser bare produktbilder og avissider fra Tjek |
| 3 | Tillater avtalen at vi viser **avissider** (hele kundeaviser eller sider fra dem)? | **Ja**, avissider er tillatt (brukerens opplysning, 2026-11-22) |
| 4 | Dekker avtalen **alle kjedene** vi ser i Tjek (Rema 1000, Kiwi, Coop Extra/Prix/Mega/Obs/Marked, Meny, SPAR, Joker, Bunnpris, Europris m.fl.)? Hvis ikke: hvilke? | **Ja**, alle kjeder Tjek har (brukerens opplysning, 2026-11-22) |
| 5 | Er **appen vår** (nettstedet til AVVR AS) den plattformen avtalen gjelder for, og er **AVVR AS** avtaleparten? | **Ja**, avtalen dekker at AVVR AS bruker API-et i appen for andre brukere (brukerens opplysning, 2026-11-22) |
| 6 | Krever avtalen **kreditering** (for eksempel «Kilde: Tjek») eller lenke? | **Ikke kjent for oss** (2026-11-22). Vi krediterer «Kilde: Tjek» med dato uansett |
| 7 | Har avtalen en **grense for antall kall**, eller en **utløpsdato** vi må vite om? | **Ikke kjent for oss** (2026-11-22), heller ikke pris. Vi holder oss under § 8.5 i de offentlige vilkårene |

Dette dokumentet gir ingen juridisk vurdering. Sitatene er gjengitt ordrett på engelsk som på siden; oppsummeringene er nøkterne gjengivelser, ikke tolkninger av hva som gjelder for oss. «Ikke dokumentert» betyr at vi ikke har en kilde i hende som svarer på punktet.

## Kilder lest

| Side | URL | Lest | Merknad |
| --- | --- | --- | --- |
| Terms and Conditions | https://tjek.com/terms | 2026-11-22 | Siden oppgir «Latest revision: 21 February 2023». Samme adresse som `Link: rel="terms-of-service"` i API-svaret |
| API's and SDK's | https://tjek.com/apis-and-sdks | 2026-11-22 | Kort produktside; ingen egne API-vilkår ut over lenken til Terms |
| Info (juridisk informasjon) | https://tjek.com/info | 2026-11-22 | Selskapsnavn, adresser og MVA-nummer |
| Privacy | https://tjek.com/privacy | 2026-11-22 | Gjelder Tjeks egne systemer (CMS, CRM m.m.); bare lest for å se om det finnes egne API-vilkår der (nei) |

Ikke funnet: egne utviklervilkår, API-dokumentasjon med vilkår, prisliste eller oppgitt rate limit for API-et på tjek.com. Siden «API's and SDK's» henviser bare til Terms og til e-post (se under).

## Det de offentlige sidene sier

**Hvem API-et er for.** tjek.com/apis-and-sdks: *«The API is only available to customers. See our terms.»* og *«Want to start using our APIs? Contact our team via services@tjek.com.»*

**Parter og avtaletyper** (Terms § 1.2). «Tjek» er *«Tjek A/S, a company incorporated in Denmark and/or (as applicable) Tjek Norge AS, a company incorporated in Norway and/or (as applicable) Tjek Sverige AB»*. «Customer» er *«a third party that enters into Agreements»*, og «Tjek Agreement» er *«any signed agreement between the Customer and Tjek about the Services»*. «Integration» er *«integration of content or data from Tjek's platforms in the Customer's own media (e.g. apps and websites) using Tjek's APIs and SDKs»*. § 1.1: vilkårene gjelder *«unless otherwise agreed between the Parties»*.

tjek.com/info: Tjek Norge AS, c/o Econpartner AS, Grundingen 6, 0250 Oslo, VAT NO 913 040 309; Tjek A/S, Wildersgade 41, 1408 København K, VAT DK32157785; e-post hello@tjek.com.

**Avtaleinngåelse og varighet** (§ 2). § 2.1: *«An Agreement commences when Tjek's quote has been accepted and terminates when the Services have been delivered or the agreed license period terminates. Acceptance can be sent by e-mail or by electronic signature.»* § 2.2: *«Licenses will be automatically renewed unless a written notice of termination is given by at least one of the Parties at least six (6) months before the end of a quarter.»*

**Betaling** (§ 3). § 3.1: *«The Customer pays for Services as described in the Agreement.»* § 3.4: for Integration faktureres kunden etter avtalen. § 3.2: 14 dagers betalingsfrist, priser eks. MVA. § 3.8: priser heves 2 % hver januar (eller mer ved høyere prisindeks ved nyforhandling). Selve prisen står ikke på sidene.

**API og integrasjon** (§ 8, ordrett):
- § 8.2: *«The Customer may only use Tjek's APIs to deliver and display the agreed Services on the Customer's own platforms and in accordance with Tjek's instructions and technical documentation. For the purpose of this Clause 8, the Customer's own platforms means only digital platforms, including websites and apps, that are owned and operated directly by the Customer.»*
- § 8.3: *«Any use of Tjek's APIs or API‑based content outside Tjek's or the Customer's own platforms, including embedded linking, framing, hotlinking or similar use on third‑party media, and any commercial use of such content by third parties, requires Tjek's prior written approval and all necessary consents from the relevant rights holders.»*
- § 8.4: *«The Customer must not provide or grant access to Tjek's APIs, API keys, or API‑based content to third parties, nor allow third parties to systematically fetch or re‑use content hosted by Tjek via the Customer's apps or websites, unless expressly agreed in writing with Tjek.»*
- § 8.5: *«Unless otherwise agreed in writing, the Customer's use of the Services must not exceed 8,000,000 API calls per month per country. NB: 1 publication open equals 1 API call.»* Videre: Tjek kan fakturere økte drifts-/båndbreddekostnader, og *«may monitor and limit usage, including suspending access with immediate effect in case of misuse, breach of this Clause 8, or if the agreed or permitted usage level is exceeded.»*
- § 8.6: data fra tjenestene, også via API, kan ikke brukes til å *«train, develop or improve any artificial intelligence or machine learning models»* uten skriftlig forhåndsavtale.
- § 8.7: planlagt vedlikehold 01:00–06:00 regnes ikke med i oppetid.

**Rettigheter** (§ 11). § 11.1: *«Any intellectual property or data rights pertaining to the Services, Statistics, and to any other delivery by Tjek, are owned by, or licensed to, Tjek and are not exclusive to the Customer.»* § 11.2: *«The Agreement does in any way transfer nor license any intellectual property or data rights to the Customer nor the Facilitator.»* (gjengitt ordrett; setningen står slik på siden.) § 11.3: brudd på Tjeks immaterielle rettigheter regnes som vesentlig mislighold.

**Innhold fra kjedene** (§ 5, gjelder kunder som *legger inn* innhold, typisk kjedene). § 5.1: *«It is the Customer who adds Content for Marketing.»* § 5.2: kunden må sørge for at innholdet følger lovgivningen, også om *«intellectual property rights»*. Vilkårene sier ikke noe offentlig om hvilke rettigheter Tjek har til å la andre vise kjedenes innhold.

**Ansvar, mislighold, lovvalg, endringer.** § 9.2: Tjeks ansvar er begrenset til siste faktura. § 12: vesentlig mislighold gir rett til å heve etter dansk rett. § 14.1: kunden kan ikke overdra avtalen uten samtykke. § 16: dansk rett, Københavns domstol. § 17.1: Tjek kan endre vilkårene; endringer gjelder én måned etter varsel på e-post.

## Tabell: hva vi må ha svart på

Kolonnen «Offentlige vilkår» gjengir bare det tjek.com/terms og /apis-and-sdks sier. Kolonnen «Vår avtale» fylles bare med brukerens svar (avtalen er fortrolig); «Brukeren (2026-11-22)» betyr brukerens opplysning den dagen, ikke avtaletekst vi har sett.

| Punkt | Offentlige vilkår (tjek.com, lest 2026-11-22) | Vår avtale | Status |
| --- | --- | --- | --- |
| Hvem kan bruke API-et | «only available to customers»; kunde = part som inngår avtale med Tjek (§ 1.2) | Brukeren (2026-11-22): AVVR AS, i appen, for appens brukere | Brukerens opplysning; ikke bekreftet med Tjek |
| Omfang | Integrasjon av innhold/data i kundens egne apper og nettsider (§ 1.2, § 8.2); «the agreed Services» avgjøres av avtalen | Brukeren (2026-11-22): lagring av priser, bilder og avissider, alle kjeder Tjek har, bruk i appen for andre brukere | Brukerens opplysning; ikke bekreftet med Tjek |
| Lagring | Ikke omtalt for kunder som henter data (bare at Tjek kan beholde kopier av kjedenes innhold, § 5.4, og en regel for Incito-data i § 6.4) | Brukeren (2026-11-22): lagring av priser er tillatt. Hvor lenge: ikke kjent for oss | Brukerens opplysning. Vi lagrer på serveren i egen tabell med konfigurerbar oppbevaringstid |
| Avissider | § 8.5 nevner «publication open» som API-kall; ingenting om hvorvidt kunden kan vise hele aviser | Brukeren (2026-11-22): tillatt | Brukerens opplysning. Hver åpnet avis teller som kall (§ 8.5) |
| Bilder og logoer | Ikke omtalt for API-kunder. § 11: rettigheter til leveransene tilhører eller er lisensiert til Tjek, ikke overført | Brukeren (2026-11-22): bilder er tillatt; logoer ikke oppgitt | Brukerens opplysning. Vi viser produktbilder og avissider fra Tjek, ingen logoer |
| Kreditering | Ikke omtalt for API/Integration (kildekrav finnes bare for Insights, § 7.7) | Ikke kjent for oss (2026-11-22) | Må bekreftes med Tjek. Vi viser «Kilde: Tjek» med dato |
| Rate limit | Maks 8 000 000 API-kall per måned per land med mindre annet er avtalt; Tjek kan overvåke, begrense og stenge (§ 8.5) | Ikke kjent for oss (2026-11-22) | Må bekreftes med Tjek. Øvre tak dokumentert i offentlige vilkår. Observert 2026-11-21: API-et svarte 200 uten nøkkel ved ett kall per sekund (`phase0/tjek-probe/`) |
| Pris | Betaling etter avtalen (§ 3.1, § 3.4); 2 % årlig økning (§ 3.8). Ingen pris oppgitt | Ikke kjent for oss (2026-11-22) | Må bekreftes med Tjek |
| Land/kjeder | Ikke omtalt | Brukeren (2026-11-22): alle kjeder Tjek har | Brukerens opplysning. Observert: tilbud fra Rema, Kiwi, Coop-formater, Meny, Spar, Joker, Bunnpris, Europris m.fl. i norske søketreff |
| Geografi (utsalg/område) | Ikke omtalt | Fortrolig, ikke kjent for oss | Ikke dokumentert. Ikke undersøkt |
| Varighet | Fra akseptert tilbud til levert/lisensperiode slutt; automatisk fornyelse (§ 2) | Ikke kjent for oss (2026-11-22) | Må bekreftes med Tjek. Mekanismen er dokumentert i offentlige vilkår; vår periode ikke dokumentert |
| Oppsigelse | Skriftlig, minst seks måneder før kvartalsslutt (§ 2.2); heving ved vesentlig mislighold (§ 12) | Fortrolig, ikke kjent for oss | Mekanismen dokumentert; hva som skjer med data ved opphør er ikke omtalt |
| Bruk utenfor egen plattform og tredjeparter | Krever Tjeks skriftlige forhåndsgodkjenning og samtykke fra rettighetshaverne (§ 8.3); ikke gi tredjeparter tilgang (§ 8.4) | Brukeren (2026-11-22): bruk i appen for andre brukere er dekket; bruk utenfor appen er ikke omtalt | Vi holder oss til § 8.3–8.4: ingen innbygging, framing eller videreformidling. Dokumentert i offentlige vilkår |
| KI/maskinlæring | Forbudt uten skriftlig forhåndsavtale (§ 8.6) | Fortrolig, ikke kjent for oss | Dokumentert i offentlige vilkår. Ikke aktuelt i fase 1 (KI er fase 3) |
| Rettighetskjeden (kjedene eier tilbudene) | § 8.3 krever «all necessary consents from the relevant rights holders» for bruk utenfor egen plattform. Ellers ikke omtalt | Fortrolig, ikke kjent for oss | Ikke dokumentert. Se `phase0/kundeavis-rettigheter.md` |
| Endringer og ansvar | Tjek kan endre vilkår med én måneds varsel (§ 17.1); ansvar begrenset til siste faktura (§ 9.2); dansk rett (§ 16) | Fortrolig, ikke kjent for oss | Dokumentert i offentlige vilkår |
| Personvern | Tjeks personvernside viser til egen databehandleravtale for den som bruker «Tjek's integration solution through Tjek's SDK and API»; avtalen er ikke lest | Fortrolig, ikke kjent for oss | Ikke dokumentert. Vi sender ingen persondata til Tjek utover tekniske kall fra serveren |

## Hva dette betyr for status (uten juridisk tolkning)

- De offentlige vilkårene beskriver API-tilgang som noe som gis til **kunder med avtale**, og at bruksomfanget står i avtalen. At API-et svarer uten nøkkel, sier ikke noe om hva som er tillatt.
- Brukerens svar (2026-11-22) kan ikke kontrolleres her, fordi avtalen er fortrolig og ikke deles. På brukerens opplysning er nå lagring av priser på serveren og produktbilder og avissider fra Tjek bygget (arbeidsregelen over; `docs/synk.md`, «Tilbud fra Tjek»), men vi holder oss konservative der avtalen kan avvike fra de offentlige vilkårene. Hver åpnet avis gir ett kall mot Tjek (hurtigbuffer i 6 t), i tråd med § 8.5 («1 publication open equals 1 API call»).
- Kreditering, kallgrense, varighet og pris er ikke kjent for oss og må bekreftes med Tjek.

## Tekniske observasjoner (ikke avtale)
- Endepunkter brukt: `GET https://api.etilbudsavis.dk/v2/offers/search?query=…&country_id=NO`. `/dealers` ga ingen norske dealere (306 oppføringer: 302 DK, 4 DE).
- API-et svarer uten nøkkel. Det betyr ikke at bruk er tillatt; det er bare hva API-et gjør.
- Svaret har `Link: <https://tjek.com/terms>; rel="terms-of-service"`.

## Hva som gjenstår
1. ~~Brukeren svarer på spørsmålene~~: spørsmål 1–5 besvart 2026-11-22 (brukerens opplysning). Avtalen selv skal ikke legges i repoet (fortrolig).
2. **Bekreftes med Tjek** (eller av brukeren etter å ha lest avtalen): kreditering, kallgrense, varighet, pris, hvor lenge lagrede priser kan beholdes, om logoer er med, og om kjedenes rettigheter er klarert gjennom Tjek.
3. Til punkt 2 er bekreftet, gjelder arbeidsregelen over (lagring på serveren uten persondata, bilder og avissider fra Tjeks adresser med kreditering, konservativt etter § 8.2–8.6).
4. Utkastet til oppfølging (`phase0/utkast/tjek-oppfolging.md`) er **ikke sendt** og skal ikke sendes uten at brukeren ber om det.
