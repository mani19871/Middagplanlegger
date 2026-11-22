# Tjek: vilkår og det som må dokumenteres

Status 2026-11-22: **Tjeks offentlige vilkår er lest** (sidene under, hentet 2026-11-22). **Ingen skriftlig avtale mellom oss og Tjek ligger i repoet.** Brukeren opplyser at avtalen finnes og vil sende den; den er ikke levert, og innholdet er ikke kjent her. Ingenting under er gjettet om hva den avtalen sier.

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

Kolonnen «Offentlige vilkår» gjengir bare det tjek.com/terms og /apis-and-sdks sier. Kolonnen «Vår avtale» blir fylt når den skriftlige avtalen er levert.

| Punkt | Offentlige vilkår (tjek.com, lest 2026-11-22) | Vår avtale | Status |
| --- | --- | --- | --- |
| Hvem kan bruke API-et | «only available to customers»; kunde = part som inngår avtale med Tjek (§ 1.2) | Ikke levert | Ikke dokumentert for oss |
| Omfang | Integrasjon av innhold/data i kundens egne apper og nettsider (§ 1.2, § 8.2); «the agreed Services» avgjøres av avtalen | Ikke levert. Muntlig opplyst: «tilbudsdata, live-visning» | Ikke dokumentert |
| Lagring | Ikke omtalt for kunder som henter data (bare at Tjek kan beholde kopier av kjedenes innhold, § 5.4, og en regel for Incito-data i § 6.4) | Ikke levert. Vi bygger uten lagring (kun minne) | Ikke dokumentert |
| Avissider | § 8.5 nevner «publication open» som API-kall; ingenting om hvorvidt kunden kan vise hele aviser | Ikke levert. Vi viser ingen avissider | Ikke dokumentert |
| Bilder og logoer | Ikke omtalt for API-kunder. § 11: rettigheter til leveransene tilhører eller er lisensiert til Tjek, ikke overført | Ikke levert. Vi viser ingen bilder | Ikke dokumentert |
| Kreditering | Ikke omtalt for API/Integration (kildekrav finnes bare for Insights, § 7.7) | Ikke levert | Ikke dokumentert |
| Rate limit | Maks 8 000 000 API-kall per måned per land med mindre annet er avtalt; Tjek kan overvåke, begrense og stenge (§ 8.5) | Ikke levert | Øvre tak dokumentert i offentlige vilkår. Observert 2026-11-21: API-et svarte 200 uten nøkkel ved ett kall per sekund (`phase0/tjek-probe/`) |
| Pris | Betaling etter avtalen (§ 3.1, § 3.4); 2 % årlig økning (§ 3.8). Ingen pris oppgitt | Ikke levert | Ikke dokumentert |
| Land/kjeder | Ikke omtalt | Ikke levert | Ikke dokumentert. Observert: tilbud fra Rema, Kiwi, Coop-formater, Meny, Spar, Joker, Bunnpris, Europris m.fl. i norske søketreff |
| Geografi (utsalg/område) | Ikke omtalt | Ikke levert | Ikke dokumentert. Ikke undersøkt |
| Varighet | Fra akseptert tilbud til levert/lisensperiode slutt; automatisk fornyelse (§ 2) | Ikke levert | Mekanismen er dokumentert i offentlige vilkår; vår periode ikke dokumentert |
| Oppsigelse | Skriftlig, minst seks måneder før kvartalsslutt (§ 2.2); heving ved vesentlig mislighold (§ 12) | Ikke levert | Mekanismen dokumentert; hva som skjer med data ved opphør er ikke omtalt |
| Bruk utenfor egen plattform og tredjeparter | Krever Tjeks skriftlige forhåndsgodkjenning og samtykke fra rettighetshaverne (§ 8.3); ikke gi tredjeparter tilgang (§ 8.4) | Ikke levert | Dokumentert i offentlige vilkår |
| KI/maskinlæring | Forbudt uten skriftlig forhåndsavtale (§ 8.6) | Ikke levert | Dokumentert i offentlige vilkår. Ikke aktuelt i fase 1 (KI er fase 3) |
| Rettighetskjeden (kjedene eier tilbudene) | § 8.3 krever «all necessary consents from the relevant rights holders» for bruk utenfor egen plattform. Ellers ikke omtalt | Ikke levert | Ikke dokumentert. Se `phase0/kundeavis-rettigheter.md` |
| Endringer og ansvar | Tjek kan endre vilkår med én måneds varsel (§ 17.1); ansvar begrenset til siste faktura (§ 9.2); dansk rett (§ 16) | Ikke levert | Dokumentert i offentlige vilkår |
| Personvern | Tjeks personvernside viser til egen databehandleravtale for den som bruker «Tjek's integration solution through Tjek's SDK and API»; avtalen er ikke lest | Ikke levert | Ikke dokumentert. Vi sender ingen persondata til Tjek utover tekniske kall fra serveren |

## Hva dette betyr for status (uten juridisk tolkning)

- De offentlige vilkårene beskriver API-tilgang som noe som gis til **kunder med avtale**, og at bruksomfanget står i avtalen. At API-et svarer uten nøkkel, sier ikke noe om hva som er tillatt.
- Brukerens opplysning om at Tjek har godkjent bruk er derfor ikke mulig å kontrollere før avtalen er levert. Vi holder fast ved det som gjelder i dag (CLAUDE.md): bare live-visning i minnet, ingen lagring, ingen avissider, ingen bilder.

## Tekniske observasjoner (ikke avtale)
- Endepunkter brukt: `GET https://api.etilbudsavis.dk/v2/offers/search?query=…&country_id=NO`. `/dealers` ga ingen norske dealere (306 oppføringer: 302 DK, 4 DE).
- API-et svarer uten nøkkel. Det betyr ikke at bruk er tillatt; det er bare hva API-et gjør.
- Svaret har `Link: <https://tjek.com/terms>; rel="terms-of-service"`.

## Hva som gjenstår
1. **Brukeren leverer den skriftlige avtalen med Tjek** (sagt at den finnes). Legg den i `phase0/` (eller en beskrivelse av den, hvis den er konfidensiell, jf. Terms § 4.1 om taushetsplikt), og fyll kolonnen «Vår avtale». Ikke fyll kolonnen før dokumentet er i hende.
2. Kontroller mot avtalen særlig: at vår app regnes som kundens «own platform» (§ 8.2), omfang (tilbudsdata, live-visning), lagring, bilder, kreditering, pris og hvem som er avtalepart på vår side (AVVR AS?).
3. Utkastet til oppfølging (`phase0/utkast/tjek-oppfolging.md`) er **ikke sendt** og skal ikke sendes uten at brukeren ber om det.
4. Til punktene over er dokumentert: bare live-visning, ingen lagring, ingen avissider, ingen bilder (som i CLAUDE.md).
