# Oppskrifter: hva kan Husvett bruke? (research)

**Status:** research, 2026-11-22. Ikke juridisk rådgivning. Ingen avtale er inngått, ingen henvendelse er sendt, og ingen oppskrifter er lagt inn eller endret.
**Bakgrunn:** Eieren har bestemt (2026-11-22) at Husvett skal skrive egne oppskrifter og utvide i omganger, og ba om research på oppskrifter vi kan bruke («Matprat ol.; kan selvfølgelig referere til dem eventuelt»). Appen har i dag 31 enkle demooppskrifter (`src/data/catalog.ts`, se `docs/fase1-status.md`). Regel 6 i `CLAUDE.md`: bare avtalte eller lisensierte oppskrifter.

## Kort oppsummert

**Hovedfunn**

1. **Matprat (Opplysningskontoret for egg og kjøtt) sier nei til apper som vår.** Vilkårene (datert 19. februar 2026) sier rett ut at aktører som ikke finansierer dem og som bygger «egne eller konkurrerende plattformer eller produkter», ikke lenger får bruke innholdet. De har ikke API for tredjepart og låner ikke ut hele oppskriftsbasen. Matprat har selv ukeplanlegger, handleliste, «Hva har du i kjøleskapet?» og en KI-assistent, så for dem er vi en konkurrent.
2. **TINE krever samtykke** for all bruk av oppskriftene sine utover vanlig forbrukerbruk. Gjengivelse må være ordrett, med kreditering, lenke og `rel=canonical`. Det står ingenting om API eller lisensprogram.
3. **MENY (NorgesGruppen) forbyr** nedlasting, kopiering og annen bruk av «oppskrifter med bilder» uten skriftlig forhåndssamtykke (punkt 16 i bruker- og salgsbetingelsene). **KIWI** sier i personvernerklæringen at oppskriftene i KIWI Middagstips er laget med KI. **Coop og REMA 1000:** vi fant ingen vilkår om oppskrifter. Det betyr ikke at oppskriftene er fri: åndsverkloven gjelder uansett.
4. **Ingen åpen, norsk og kommersielt brukbar oppskriftsbase ble funnet.** De åpne kildene er enten på engelsk med deling på like vilkår (Wikibooks Cookbook, CC BY-SA), bare for ikke-kommersiell bruk (RecipeNLG, mye NDLA-innhold med CC BY-NC-SA), handler om produkter og ikke oppskrifter (Open Food Facts, ODbL), eller har uklare innholdsrettigheter (TheMealDB). Den mest lovende offentlige kilden, Helsedirektoratet (NLOD for innhold via API-et ifølge søkeresultat; har bl.a. «Kokebok for alle»), er **ikke verifisert** for oppskrifter.
5. **Lenking er trolig lovlig, men ikke risikofritt.** EU-domstolen (C-466/12 *Svensson*, 2014) har kommet til at lenker til fritt tilgjengelige verk normalt ikke krever samtykke. Å hente lenker, titler eller ingredienser systematisk fra en database kan likevel komme i konflikt med databasevernet (åndsverkloven § 24) og med nettstedets vilkår. Dette må en jurist vurdere.

**Anbefaling:** Velg **A (egne oppskrifter)** som hovedspor, med en dokumentert skriveprosess og to-personskontroll av allergener. **B (lenker)** bør vente til en jurist har sett på det, og da bare som en liten, håndplukket lenkeliste uten innhold fra kilden. **C (samarbeid)** kan prøves billig med én henvendelse til TINE, eventuelt Helsedirektoratet. Matprat har allerede sagt nei skriftlig, så vi bør ikke regne med dem.

## 1. Metode og begrensninger

- Leste offentlige sider uten innlogging 2026-11-22: 16 sidehentinger direkte (curl, minst 1 s mellom kall, robots.txt sjekket for matprat.no) og 18 forsøk via hentingsagent. Ingen skraping, ingen blokkering omgått.
- **Vertene var sperret i nettverket for denne økta:** mattilsynet.no, en.wikibooks.org, foundation.wikimedia.org, world.openfoodfacts.org, themealdb.com, recipenlg.cs.put.poznan.pl, data.norge.no, helsedirektoratet.no, godfisk.no, frukt.no, brodogkorn.no og godt.no. For dem bygger dokumentet på **søkeresultater** (sammendrag fra søkemotoren). Disse påstandene er merket «søkeresultat, ikke lest direkte» og må kontrolleres på kildesiden før vi bygger på dem.
- Coop sine sider er i stor grad rendret med JavaScript. Vi fant ingen vilkårsside for nettstedet, men det kan finnes én.
- Juridisk vurdering er **ikke** vår oppgave. Der dokumentet sier noe om jus, er det en beskrivelse av offentlige kilder og en markering av usikkerhet. **Anbefaling: la en jurist med opphavsrett (immaterialrett) vurdere punkt 3 før vi gjør noe annet enn alternativ A.**

## 2. Hva norske kilder sier om gjenbruk

| Kilde | Hva vilkårene sier (kort) | API/lisens/samarbeid | Lest |
| --- | --- | --- | --- |
| Matprat (OEK) | Nei til ikke-finansierende aktører som bygger konkurrerende plattformer. Ellers krever all bruk skriftlig tillatelse, med visse unntak for bransje og presse | Ikke API. Låner ikke ut hele basen | Direkte |
| TINE | Oppskrifter: samtykke kreves utover forbrukers alminnelige bruk. Ordrett, kreditering, lenke og canonical | Ikke nevnt. Bilder via TINE Mediebank | Direkte |
| MENY (NorgesGruppen) | Oppskrifter med bilder kan ikke lastes ned, kopieres eller brukes uten skriftlig forhåndssamtykke | Ikke nevnt | Direkte |
| KIWI (NorgesGruppen) | Ingen vilkår om innhold funnet. Middagstips-oppskriftene er laget med KI | Ikke funnet | Direkte (personvernerklæring) |
| Coop | Ingen vilkår om oppskrifter funnet | Ikke funnet | Direkte (forside, personvern, medlemsvilkår) |
| REMA 1000 | Appvilkårene sier ingenting om rettigheter til oppskrifter | Ikke funnet | Direkte (personvern, appvilkår) |
| Sjømatrådet / Godfisk | Bilder fra Mediapool har begrensninger. Ingen oppskriftsvilkår funnet | Ikke funnet | Søkeresultat |
| Frukt.no (OFG) | Ingen vilkår funnet. Over 2000 oppskrifter | Ikke funnet | Søkeresultat |
| Mattilsynet / Matvaretabellen | Tekster og tabellverdier er vernet. Kildehenvisning kreves | API med bedt kildeangivelse | API-siden direkte, resten søkeresultat |
| Helsedirektoratet | Innhold via API etter NLOD med kildeangivelse. Faglig innhold må ikke endres så meningen endres | Åpent API (NLOD) | Søkeresultat |

### 2.1 Matprat.no (Opplysningskontoret for egg og kjøtt)

Kilde: <https://www.matprat.no/retningslinjer-for-bruk-av-innhold/> (siden er datert «Februar 19, 2026», lest 2026-11-22).

- «For aktører som ikke finansierer oss, som ønsker å bygge egne eller konkurrerende plattformer eller produkter, tillater vi ikke lenger bruk av vårt innhold.»
- «Innholdet publisert på dette nettstedet tilhører Opplysningskontoret for egg og kjøtt og er beskyttet av åndsverkslovens regler. Dette betyr at du trenger skriftlig samtykke […]»
- «Med innhold mener vi; logo, bilder, tekster, oppskrifter, videoer, rapporter og infografikk […]»
- «Det er ikke tillatt å hente ut store deler eller hele oppskriftsbasen vår, til bruk i apper og på nettsteder.»
- Om API, i spørsmål og svar på samme side: «Vi har ikke API tilgjengelig for tredjepart. Vi låner heller ikke ut hele oppskriftsbasen […]»
- Kreditering på nett, for dem som får låne: «Henvisning via en klikkbar lenke til matprat.no». Ordet «Matprat» kan brukes som kildehenvisning, men logoen er et registrert varemerke.
- Ellers: utlån varer høyst 12 måneder, låneren må holde innholdet oppdatert, og innholdet kan ikke lisensieres videre. Kontakt: post@matprat.no.
- `robots.txt` (lest 2026-11-22) stenger bl.a. `/ingredienser/`, `/min-matprat/` og `/Services/`, men ikke oppskriftssidene. Det gir ingen rett til å bruke innholdet. Vilkårene over gjelder uansett.
- **Konkurranse:** Menyen på matprat.no har «Ukeplanlegger», «Handleliste», «Hva har du i kjøleskapet?» og «Prat med KI-assistenten vår!». Det er samme område som Husvett.

**Vurdering:** Det er lite trolig at Matprat gir en lisens. Lenking er ikke nevnt i vilkårene (se punkt 3.1).

### 2.2 TINE

Kilde: <https://www.tine.no/kontakt/artikler/ansvarserklæring-personvern-og-debattregler-på-tines-nettsteder> (ingen dato på siden, lest 2026-11-22).

- «Med unntak av oppskrifter og bilder/tekst knyttet til oppskrifter, kan alt innhold fritt distribueres, kopieres og lagres elektronisk eller skrives ut. Dette samtykket gis under forutsetning av at kilden til materialet angis riktig.»
- «Med unntak av forbrukers alminnelige bruk, kan TINEs oppskrifter ikke benyttes uten samtykke fra TINE. Ved enhver gjengivelse av TINEs oppskrifter skal oppskriftene gjengis ordrett. Innhold må også markeres med canonical URL (Rel=Canonical) […]»
- «Oppskrift skal akkrediteres med følgende tekst og klikkbare lenke til original oppskrift på tine.no i umiddelbar nærhet til oppskriften: «Oppskriften(e) er hentet fra TINE.».»
- Bilder: «Bilder knyttet til oppskrifter hentes fra og reguleres av retningslinjer for TINE Mediebank.» (Mediebankens vilkår er ikke lest.)

**Vurdering:** TINE åpner for samtykke, men krever ordrett gjengivelse. Det passer dårlig med appen vår, der oppskriftene må struktureres og skaleres (mengder per porsjon, varekobling, allergener). Selv med samtykke må vi derfor spørre om vi kan *tilpasse* oppskriftene. Vi fant ikke noe API eller lisensprogram.

### 2.3 MENY og KIWI (NorgesGruppen)

Kilde: <https://meny.no/personvern/bruker-og-salgsbetingelser>, punkt «16. Copyright» (ingen dato funnet, lest 2026-11-22).

- «Alt innhold på disse nettsidene er MENY AS eller underleverandør av nevntes eiendom og er beskyttet etter bl.a. opphavsretts-, markedsførings- og varemerkelovgivningen. Dette innebærer at […] oppskrifter med bilder […] under enhver omstendighet ikke kan lastes ned, kopieres eller benyttes på annen måte uten at dette er eksplisitt tillatt etter ufravikelig lovgivning eller etter uttrykkelig skriftlig forhåndssamtykke fra MENY AS.»
- Dette er samme «punkt 16» som `CLAUDE.md` nevner for Meny/SPAR/Joker. Klausulen er heller ikke klarert for tilbud.

KIWI: <https://kiwi.no/personvernerklaering> («Publisert: 19. mai 2025», «Endret: 07. sep. 2026», lest 2026-11-22).

- «Oppskriftene er generert ved hjelp av kunstig intelligens (KI).» (om KIWI Middagstips i KIWI PLUSS-appen)
- Vi fant ingen vilkår om gjenbruk av innhold på kiwi.no.

### 2.4 Coop

Leste <https://www.coop.no/>, <https://www.coop.no/personvern> og <https://www.coop.no/medlem/avtaler-og-vilkaar> (lest 2026-11-22). Vi fant ingen generelle brukervilkår for nettstedet og ingenting om oppskrifter, API eller lisens. Siden «Oppskrifter med Smak*-produkter» finnes (<https://www.coop.no/egne-merkevarer/dagligvare/smak/smak-oppskrifter>, søkeresultat). **Ingen vilkår betyr ikke fri bruk.**

### 2.5 REMA 1000

Leste <https://www.rema.no/om-rema/personvern/> og <https://www.rema.no/om-rema/personvern/vilkar/brukervilkar-rema-appen/> (lest 2026-11-22). Vilkårene gjelder REMA-appen og personvern. Vi fant ingenting om rettigheter til oppskriftene på rema.no, og heller ikke API eller lisens. Det finnes også egne vilkår for Reitan Retail (<https://www.rema.no/om-rema/personvern/vilkar/brukervilkar-reitan-retail/>), som vi ikke har lest.

### 2.6 Andre norske kilder

- **Sjømatrådet / Godfisk** (søkeresultat, ikke lest direkte): Den engelske opphavsrettssiden <https://en.seafood.no/about-norwegian-seafood-council/copyright/> gjelder materiale fra Mediapool (film og bilder), og bruken er begrenset. Vi fant ingen vilkår for oppskriftene på godfisk.no.
- **Frukt.no** (OFG) (søkeresultat): Nettstedet sier det har «over 2000 oppskrifter». Vi fant ingen vilkår. Kontaktadresse ifølge et faktaark: post@frukt.no.
- **Mattilsynet** (søkeresultat): <https://mattilsynet.no/om-mattilsynet/vil-du-bruke-innhold-fra-mattilsynet>: tekstene kan deles etter retningslinjer og med kreditering, og opphavsretten ligger hos Mattilsynet. Matvaretabellen: «Innhaldet er beskytta etter åndsverkloven. Tabellverdiar og tekstar frå Matvaretabellen må ikkje kopierast eller gjevast ut på anna måte utan tydeleg kjeldetilvising.» (<https://mattilsynet.no/mat-og-drikke/matvaretabellen/opphavsrett>)
- **Matvaretabellens API** (lest direkte av hentingsagenten): <https://www.matvaretabellen.no/api/> sier «Vi ber om at Matvaretabellen oppgis som kilde når du bruker data fra oss.» og at data trygt kan mellomlagres. Siden nevner ingen formell lisens. Vi bruker allerede dette til næring (`THIRD_PARTY.md`).
- **Helsedirektoratet** (søkeresultat): Innhold fra helsedirektoratet.no gjennom API-et deres (<https://www.helsedirektoratet.no/om-oss/apne-data-api/om-api-tjenesten>) skal brukes etter NLOD med Helsedirektoratet som kilde. Innholdet må merkes, tjenesten må ikke se ut som den kommer fra direktoratet, og faglig innhold må ikke endres så meningen endres. Direktoratet har oppskriftssamlinger som «Kokebok for alle» (<https://www.helsedirektoratet.no/tema/mat-og-maltider-i-skolen/kokebok-for-alle>). **Ikke verifisert:** om disse oppskriftene (og bildene) er omfattet av NLOD.
- **matoppskrift.no** er et privat nettsted som skriver at opphavsretten gjelder «skrivemåten» og ikke selve oppskriften, men at bilder ikke kan kopieres (<https://www.matoppskrift.no/sider/badget.asp>, søkeresultat). Det er nettstedets egen oppfatning og ikke en rettskilde. Den nevnes bare fordi synet er vanlig.

## 3. Hva kan gjøres uten avtale?

**Usikkerhet:** Alt i dette kapitlet er en arbeidshypotese, ikke en juridisk konklusjon. Vi har ikke funnet norsk rettspraksis om oppskrifter. **Anbefaling: jurist før B, og før vi bruker noe fra en kilde i A.**

### 3.1 Lenke til en ekstern oppskrift («referere»)

- EU-domstolen, C-466/12 *Svensson* (13.2.2014): En lenke til et verk som er fritt tilgjengelig på nettet med rettighetshaverens samtykke, når ikke en «ny allmennhet» og krever normalt ikke samtykke (søkeresultat, primærkilde curia.europa.eu). Senere praksis (*GS Media*, C-160/15) gjelder lenker til ulovlig publisert innhold. Den er ikke kontrollert her. Om og hvordan praksisen gjelder i Norge gjennom EØS, må en jurist bekrefte.
- **Trolig uproblematisk:** en vanlig lenke med vår egen tekst, f.eks. «Flere ideer med kjøttdeig hos TINE», uten innhold fra siden.
- **Usikkert, må vurderes:**
  - å vise kildens tittel, bilde eller ingredienser ved lenken
  - å vise siden i en ramme eller innebygd
  - å bygge lenkelisten ved å hente fra nettstedskart eller søk; systematisk uttrekk kan treffe databasevernet (åndsverkloven § 24, «katalogvern»: vern for den som har gjort en «vesentlig investering» i innsamling, kontroll eller presentasjon, ifølge snl.no/katalogvern, søkeresultat)
  - å lenke i strid med vilkårene; Matprat forbyr bruk av «innhold» for konkurrerende plattformer, men nevner ikke lenker
- **Praktisk:** En lenke må vedlikeholdes, siden adresser endres. Vi kan heller ikke kjenne allergener, mengder eller pris for en lenket oppskrift. Den kan derfor aldri gå inn i planmotoren, kurven eller allergifilteret (regel 3 og 4).

### 3.2 Ingrediensliste som fakta

- Både i norsk diskusjon og i andre land er det vanlig å mene at en ren ingrediensliste med mengder er fakta eller en idé og ikke et åndsverk. Vi har **ikke** funnet en norsk rettskilde som slår det fast.
- Selv om én liste ikke er vernet, kan **samlingen** være vernet etter § 24, og vilkårene kan forby bruken (Matprat: «hente ut store deler»; MENY: «kopieres eller benyttes»). Om slike nettstedsvilkår binder en besøkende, er også uavklart.
- **Anbefaling:** Ikke hent ingredienslister fra andre kilder, heller ikke én og én for hånd. Egne mengder fra egen testkoking er tryggere og gir uansett bedre data, fordi mengdene må passe pakningene og porsjonsmodellen vår.

### 3.3 Egne oppskrifter med egne ord for vanlige retter

- Alminnelige retter (bolognese, fiskesuppe, taco, linsegryte) og vanlige teknikker (brune, la småkoke, bake i ovn) tilhører ingen. Det som kan være vernet, er den konkrete teksten, bildene, utvalget og oppsettet.
- **Arbeidsregel (vår, ikke juss):** Skriv uten kildesiden åpen. Ta mengder fra egen testkoking og egne erfaringstall, skriv stegene med egne ord og ta bilder selv eller dropp dem. Noter for hver oppskrift hvem som skrev den, når og at ingen kilde ble kopiert.
- **KI-utkast:** Hvis oppskriftene skrives av en Claude-økt, er de KI-utkast. Planen sier at KI kommer i fase 3, og at KI-utkast skal ha «tydelig opphav» (`docs/plan.md`, «Oppskrifter»). Det er også en risiko at en språkmodell gjengir tekst den har sett, f.eks. fra kjente norske oppskriftssider. Eieren må bestemme om Claude-skrevne utkast godtas som «egne oppskrifter» når et menneske har kontrollert, testkokt og godkjent dem (se kapittel 7). Om KI-skrevet tekst har opphavsrettslig vern, er også uavklart. Det kan bety at andre fritt kan kopiere våre oppskrifter.

### 3.4 Dette krever tillatelse (etter vilkårene vi har lest)

- Kopiere tekst, stegbeskrivelser eller bilder fra Matprat, TINE, MENY og (trolig) de andre.
- Hente ut mange oppskrifter eller deler av dem, f.eks. titler og ingredienser, fra en database.
- Bruke logoer (Matprat er registrert varemerke) eller la det se ut som en kilde står bak eller anbefaler oss.
- Gjengi TINE-oppskrifter, som i tillegg må være ordrett (vi kan ikke tilpasse dem uten særskilt samtykke).

## 4. Åpne eller lisensierte kilder

| Kilde | Lisens/vilkår | Passer for oss? | Lest |
| --- | --- | --- | --- |
| Wikibooks Cookbook (engelsk) | CC BY-SA 4.0 (ofte i tillegg GFDL). Kreditering, og endringer må deles under CC BY-SA 4.0 eller senere ([Wikibooks:COPY](https://en.wikibooks.org/wiki/Wikibooks:COPY)) | **Dårlig.** Engelsk, ujevn kvalitet, ingen strukturerte allergener. Deling på like vilkår gjelder bearbeidelser: våre bearbeidede oppskrifter måtte i så fall deles med samme lisens, og det må en jurist vurdere. Kan brukes som idéliste, ikke som tekst | Søkeresultat |
| Wikimedia Commons-bilder | Lisens per fil (ofte CC BY / CC BY-SA). Krever kreditering per bilde | Mulig for enkeltbilder med lisensen registrert. CSP og `THIRD_PARTY.md` må da oppdateres | Ikke undersøkt nærmere |
| Open Food Facts | Database: ODbL. Enkeltinnhold: Database Contents License. Bilder: CC BY-SA ([dokumentasjon](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side)) | Gir produkter og ingredienser, **ikke oppskrifter**. Deling på like vilkår for avledede databaser. Kunne hjelpe allergeninfo per produkt, men ikke uten kontroll (regel 4) | Søkeresultat |
| Matvaretabellen | Ber om kildeangivelse. Tekster og tabellverdier er vernet etter åndsverkloven | Næring per ingrediens (brukes allerede). Ingen oppskrifter, ingen allergenstatus | API-siden direkte |
| Helsedirektoratet | NLOD for API-innhold, med kilde, merking og uten meningsendring | **Mest lovende offentlige kilde**, men det er ikke bekreftet at oppskriftene (f.eks. «Kokebok for alle») og bildene er NLOD. Må avklares med direktoratet | Søkeresultat |
| NLOD 2.0 generelt | Ifølge søkeresultat tillater lisensen kopiering, endring, sammenstilling og kommersiell bruk med kildeangivelse | Ikke lest på data.norge.no (sperret). Må leses før bruk | Søkeresultat |
| NDLA (mat og helse) | Lisens per element. Eksemplene vi så var CC BY-NC-SA (ikke kommersielt) | **Nei** for kommersiell app, med mindre et element har en annen lisens | Søkeresultat |
| RecipeNLG | Egen avtale med Poznań University of Technology: «non-commercial research and educational purposes» ([Hugging Face](https://huggingface.co/datasets/recipe_nlg)) | **Nei** (kommersielt). Engelsk, skrapet fra nett | Søkeresultat |
| TheMealDB | Testnøkkel for utvikling. Publiserte apper bør bli «supporter» for produksjonsnøkkel (ifølge omtaler av dokumentasjonen). Vi fant ingen lisens for innholdet | **Nei.** Engelsk, uklart hvem som har rett til innholdet | Søkeresultat |
| Gamle kokebøker (allemannseie) | Vern i 70 år etter forfatterens dødsår. Eksempel: Hanna Winsnes (død 1872), *Lærebog i de forskjellige Grene af Huusholdningen* (1845) | Teksten er trolig fri, men nye utgaver, innledninger og digitaliseringer kan ha egne rettigheter. Gammeldags språk, mål og råvarer. **Bare som inspirasjon** | Søkeresultat (snl.no, runeberg.org) |

**Konklusjon:** Ingen åpen kilde gir oss norske, strukturerte og kommersielt brukbare middagsoppskrifter. Helsedirektoratet er den eneste som bør undersøkes videre.

## 5. Tre modeller for Husvett

### A) Egne oppskrifter, skrevet i omganger (anbefalt hovedspor)

**For**
- Vi eier innholdet og kan strukturere, skalere, koble til varer og merke allergener som motoren krever.
- Ingen avhengighet av eller kostnad til en lisensgiver, og ingen fare for at tillatelsen trekkes tilbake (Matprat gir høyst 12 måneders utlån).
- Passer regel 1–6 direkte: hver linje er en vare i katalogen med pris, og hver rett har allergener og `FoodTag` via varene.

**Imot**
- Tar tid. Hver oppskrift må skrives, testkokes og kontrolleres. Gode norske hverdagsretter finnes allerede gratis på Matprat og TINE, så våre må være gode nok.
- Feil i allergendata er en helsefare (risikotabellen i `docs/plan.md`). Prosessen må være streng.
- Hvis oppskriftene skrives av KI, se 3.3.

**Omfang:** 31 → ca. 150 i fire til fem omganger à 25–30 (kapittel 6).

### B) Lenker til eksterne oppskrifter fra «Lag nå» eller planen, uten å lagre innhold

**For**
- Gir mer variasjon uten at vi skriver alt selv.
- Svarer på eierens «kan referere til dem».

**Imot**
- En lenket oppskrift har ingen mengder, varer, allergener eller pris hos oss. Den kan derfor ikke inn i plan, kurv, sammenligning eller allergifilter (regel 3 og 4). Den blir en «idé», ikke en middag i planen.
- Juridisk og relasjonelt usikkert. Matprat har skrevet at konkurrerende plattformer ikke får bruke innholdet. Lenker er ikke nevnt, men vi bør ikke provosere en aktør vi kanskje vil samarbeide med.
- Lenkelisten kan ikke bygges ved skraping (databasevern og vilkår). Den må lages for hånd og holdes ved like, siden adresser endres.
- Personvern: et klikk sender brukeren til en tredjepart med egne informasjonskapsler. Det bør sies i arket «Personvern».

**Hvis B velges:** bare etter juristvurdering, bare håndplukkede lenker med vår egen tekst (ingen tittel, bilde eller ingredienser fra kilden), åpnes utenfor appen, aldri med i plan eller kurv, og tydelig merket «ekstern oppskrift, ikke kontrollert av Husvett, allergener ukjent».

### C) Samarbeid eller lisens (TINE, eventuelt Matprat eller Helsedirektoratet)

**For**
- Ville gitt mange gode, testede norske oppskrifter med bilder.
- Helsedirektoratet kan ha innhold under NLOD, som kanskje bare krever kreditering.

**Imot**
- Matprat har avvist dette skriftlig for aktører som oss, og TINE krever ordrett gjengivelse. En lisens som tillater strukturering og tilpasning er lite sannsynlig, og ville trolig hatt vilkår (merkevare, varighet, kreditering, oppdateringsplikt).
- En meieri- eller kjøttaktør har egne interesser (Matprat: ikke importvarer; TINE: egne produkter). Det kan stride mot en nøytral planlegger, særlig hvis butikkvalg og tilbud påvirkes.
- Ingen kjent pris eller tidslinje.

**Utkast til henvendelse (IKKE SENDT, avsender er plassholder):**

> **Til:** TINE SA, kundeservice / markedsavdeling (kontaktadresse må bekreftes)
> **Emne:** Spørsmål om bruk av TINE-oppskrifter i en norsk middagsplanlegger
>
> Hei,
>
> Vi utvikler Husvett, en norsk app som hjelper husstander å planlegge ukens middager, lage én handleliste og anslå hva handelen koster. Appen viser allergener og tilpasser mengdene til antall porsjoner.
>
> Vi har lest TINEs ansvarserklæring og ser at oppskriftene ikke kan brukes uten samtykke, og at gjengivelse skal være ordrett med kreditering og lenke. Vi ønsker å høre om TINE er åpen for en avtale, og i så fall hvilke vilkår som gjelder for:
>
> 1. å vise et utvalg TINE-oppskrifter i appen med kreditering («Oppskriften er hentet fra TINE.») og lenke til originalen,
> 2. å skalere mengder til antall porsjoner og koble ingrediensene til varer i en handleliste (en tilpasning, ikke ordrett gjengivelse),
> 3. bilder fra TINE Mediebank,
> 4. varighet, oppdatering når dere endrer en oppskrift, og eventuell pris.
>
> Vi ønsker ikke å hente innhold automatisk fra tine.no, og vi vil ikke gi inntrykk av at TINE står bak appen. Allergeninformasjon kontrollerer vi selv, og appen lover aldri at en rett er fri for allergener.
>
> Hvis dette ikke er aktuelt, setter vi pris på et kort svar, så vi ikke spør igjen.
>
> Vennlig hilsen
> [Navn], [rolle]
> [Selskap], [e-post]

Tilsvarende henvendelse til Helsedirektoratet bør spørre konkret: «Er oppskriftene i *Kokebok for alle* og andre oppskriftshefter, med bilder, omfattet av NLOD, og kan de bearbeides (skaleres, struktureres) i en kommersiell app med kreditering?»

**Matprat:** Vilkårene sier allerede nei. Hvis eieren likevel vil spørre, bør henvendelsen bare gjelde lenking og kildehenvisning («Har dere innvendinger mot at vi lenker til oppskrifter på matprat.no, uten å vise innhold fra dere?»), ikke lisens.

### Anbefalt kombinasjon

1. **A nå.** Første omgang kan starte når eieren har bestemt hvem som skriver og godkjenner (kapittel 7).
2. **C som billig sidespor.** Eieren sender én henvendelse til TINE og én til Helsedirektoratet. Vi planlegger ikke ut fra svaret.
3. **B senere eller aldri.** Bare etter juristvurdering, og bare som merket idéliste utenfor planen.

## 6. Arbeidsplan: fra 31 til ca. 150 egne oppskrifter

### 6.1 Kvalitetskrav for hver oppskrift

1. **Opphav:** forfatter (person eller «KI-utkast, kontrollert av …»), dato, «skrevet uten kilde åpen», ingen tekst eller bilder fra andre. Typen `Recipe` har i dag ikke noe felt for opphav eller lisens, selv om planens datamodell har «lisens» på oppskrift. Det må legges til i kode før første nye omgang (egen oppgave, ikke gjort her).
2. **Testkoking:** minst én gang av en person, med notert faktisk tid (`minutes`) og om 4 porsjoner (`baseServings`) stemmer.
3. **Varer:** Hver linje er en vare i `ingredients`. Nye varer trenger produkter med pakningsstørrelse, allergener og `allergenKnown`, og demopriser merket «Demodata» (regel 5). Ellers blir prisen «ukjent», og retten kan ikke vinne noe (regel 3).
4. **Allergener (regel 4), to-personskontroll:**
   - Rettens `allergens` dekker alle varenes allergener (testes allerede i `catalog.test.ts`).
   - Sammensatte varer (buljong, krydderblandinger, sauser, pølser, fiskekaker, tortilla, nudler, hermetikk) får `allergenKnown: false` med mindre innholdet er avklart.
   - Bløtdyr, selleri, sennep, sesam, lupin og sulfitt sjekkes eksplisitt. De er lette å glemme i buljong, sennep, krydder og tørket frukt.
   - Teksten lover aldri «allergenfri», «glutenfri» eller lignende (testes i `regler.test.ts`).
5. **Kost og `FoodTag`:** `vegetarian` stemmer med varene (ingen fisk, kjøtt, gelatin eller fiskesaus), `protein` er satt, og alle kjøtt-, fisk-, skalldyr-, belgvekst- og nøttevarer har riktig `tags`. Eieren bør ta stilling til om flere merker trengs (f.eks. vilt eller innmat).
6. **Mengder:** fornuftige per porsjon (f.eks. 100–150 g kjøtt eller fisk per voksen) og avstemt mot vanlige pakninger, så kurven ikke gir unødig rest.
7. **Stegene:** korte, egne ord, ingen påstander om helse eller pris.
8. **Godkjenning:** redaktør (planens rolle «Redaktør kontrollerer oppskrifter … og allergendata») godkjenner, og godkjenningen noteres i opphavsfeltet. Endringen sjekkes inn som vanlig kode med test.

### 6.2 Omganger (forslag)

| Omgang | Antall | Mål | Tilbakemelding før neste |
| --- | --- | --- | --- |
| 0 (forarbeid) | 0 | Opphavsfelt i `Recipe` + test, mal for oppskrift, sjekkliste for allergener, beslutninger i kapittel 7 | Eieren godkjenner malen |
| 1 | 25 | Tette hull: flere raske retter (≤ 25 min), flere vegetarretter, mer fisk (sei, torsk, laks), kyllinglår og svin; retter som bruker vanlige rester (ris, poteter, pasta) for «Lag nå» | Testkoking, kontroll, «Lag nå» prøvd med vanlige matskap |
| 2 | 30 | Sesong og norsk husmannskost (gryter, supper, ovnsretter), barnevennlige retter | Samme, pluss tidsbruk per oppskrift målt |
| 3 | 30 | Variasjon i kjøkken (asiatisk, meksikansk, middelhav) med varer som finnes i vanlige butikker | Samme |
| 4 | 30–35 | Fylle hull etter bruksdata fra piloten (hva byttes bort, hva mangler i «Lag nå») | Samme |

Sum: 31 + 115–120 ≈ 150. Hvor fort det går, avhenger av hvem som testkoker. Det tallet kan vi ikke anslå uten eierens svar.

### 6.3 Tekniske følger å planlegge (ikke gjort nå)

- `fase1.test.ts` prøver alle par av retter: 465 par for 31 retter, men 11 175 for 150. Testtiden må måles og eventuelt begrenses.
- Katalogen ligger i kode (`src/data/catalog.ts`). Med 150 oppskrifter bør oppskriftene trolig ligge i en egen datafil med skjema og validering (som `offer-rules.json`). Det er en egen kodeoppgave.
- Næring (Matvaretabellen) må dekke de nye varene (`scripts/build-nutrition.mjs`).
- Brukerflaten sier i dag at oppskriftsbasen er liten («Lag nå»). Teksten må oppdateres når basen vokser.
- Demopriser for nye varer er fortsatt demodata (regel 5) til ekte prisdekning finnes.

## 7. Hva eieren må bestemme

1. **Hvem skriver?** Mennesker, Claude-økter som KI-utkast med menneskelig kontroll, eller begge. Godtas KI-utkast som «egne oppskrifter», og hvordan merkes opphavet (fase 3-regelen i `CLAUDE.md`)?
2. **Hvem testkoker og godkjenner?** Én redaktør, og en person nummer to for allergenkontrollen.
3. **Juristvurdering:** før lenker (B), og gjerne en kort bekreftelse på arbeidsreglene i 3.3.
4. **Henvendelser (C):** skal TINE og Helsedirektoratet kontaktes, av hvem, og fra hvilken adresse? Utkastet over er ikke sendt.
5. **Matprat:** ikke kontakte, eller bare spørre om lenking?
6. **Bilder:** ingen bilder (anbefalt nå), egne bilder, eller bilder med lisens (f.eks. Commons)? Bilder krever endring i CSP og `THIRD_PARTY.md`.
7. **Mål og rekkefølge:** er 150 riktig mål, og er prioriteringene i 6.2 riktige?
8. **Flere `FoodTag`-er:** trengs f.eks. vilt eller innmat som råvarekrav?

## Kilder (lest 2026-11-22)

Lest direkte:
- Matprat, «Retningslinjer for bruk av innhold» (datert 19.2.2026): <https://www.matprat.no/retningslinjer-for-bruk-av-innhold/>
- Matprat, robots.txt og forside (meny): <https://www.matprat.no/robots.txt>, <https://www.matprat.no/>
- TINE, «Ansvarserklæring, personvern og debattregler på TINEs nettsteder»: <https://www.tine.no/kontakt/artikler/ansvarserklæring-personvern-og-debattregler-på-tines-nettsteder>
- MENY, «Bruker- og salgsbetingelser», punkt 16: <https://meny.no/personvern/bruker-og-salgsbetingelser>
- KIWI, personvernerklæring (endret 7.9.2026): <https://kiwi.no/personvernerklaering>
- REMA 1000, personvern og brukervilkår for appen: <https://www.rema.no/om-rema/personvern/>, <https://www.rema.no/om-rema/personvern/vilkar/brukervilkar-rema-appen/>
- Coop, forside, personvern og medlemsvilkår: <https://www.coop.no/>, <https://www.coop.no/personvern>, <https://www.coop.no/medlem/avtaler-og-vilkaar>
- Matvaretabellen, API: <https://www.matvaretabellen.no/api/>

Bare søkeresultat (vertene var sperret eller ikke hentet; må kontrolleres):
- Mattilsynet: <https://mattilsynet.no/om-mattilsynet/vil-du-bruke-innhold-fra-mattilsynet>, <https://mattilsynet.no/mat-og-drikke/matvaretabellen/opphavsrett>
- Helsedirektoratet: <https://www.helsedirektoratet.no/om-oss/apne-data-api/om-api-tjenesten>, <https://www.helsedirektoratet.no/tema/mat-og-maltider-i-skolen/kokebok-for-alle>
- Sjømatrådet: <https://en.seafood.no/about-norwegian-seafood-council/copyright/>
- Wikibooks: <https://en.wikibooks.org/wiki/Wikibooks:COPY>
- Open Food Facts: <https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side>, <https://wiki.openfoodfacts.org/ODBL_License>
- RecipeNLG: <https://huggingface.co/datasets/recipe_nlg>
- TheMealDB: <https://themealdb.com/documentation>
- NDLA (eksempel på CC BY-NC-SA): <https://ndla.no/nn/image/7120>
- EU-domstolen C-466/12 *Svensson*: <https://curia.europa.eu/> (sammendrag fra bl.a. <https://globalfreedomofexpression.columbia.edu/cases/svensson-v-sverige-ab>)
- Katalogvern: <https://snl.no/katalogvern>
- Hanna Winsnes: <https://snl.no/Hanna_Winsnes>, <https://runeberg.org/authors/winsnhan.html>
- matoppskrift.no: <https://www.matoppskrift.no/sider/badget.asp>
