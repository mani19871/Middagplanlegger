# Tillatelser til oppskrifter: søknadspakke og importrutine

**Status 2026-11-22:** Ingen tillatelser er innhentet, og ingen henvendelser er sendt. Eieren har bestemt at Husvett kan bruke oppskrifter fra nettet, og vil selv innhente tillatelsene som trengs. Fram til en kilde har gitt **skriftlig** tillatelse, kopieres ingenting fra den kilden inn i repoet (regel 6). Bakgrunn og vilkårssitater: `docs/oppskrifter-research.md`.

Dokumentet har tre deler:

1. **Søknadspakke:** hvem du spør, og hva du ber om.
2. **Importrutine:** hva som skjer når en kilde sier ja.
3. **Egne oppskrifter:** status for omgang 1 og 2.

## 1. Søknadspakke

### 1.1 Hva vi trenger lov til

En tillatelse som bare dekker «vise oppskriften», holder ikke for appen. Be om skriftlig svar på hvert punkt:

1. **Vise** oppskriften (tittel, ingredienser, fremgangsmåte) i Husvett, også når appen brukes av andre husstander.
2. **Tilpasse:**
   - skalere mengder til antall porsjoner
   - dele opp ingredienslisten i varer som kobles til handlelista og pakningsstørrelser
   - korte ned eller dele opp stegene
   - merke allergener og kosthold selv
3. **Lagre** oppskriftene i vår database eller kode, og hvor lenge.
4. **Bilder:** om de er med, hvor de hentes fra, og kreditering per bilde.
5. **Kreditering:** nøyaktig tekst og plassering, og lenke til originalen.
6. **Varighet og oppsigelse:** hva som skjer med oppskriftene i appen hvis tillatelsen faller bort.
7. **Oppdateringer:** om vi må følge endringer i originalen (Matprat krever det i sine vilkår).
8. **Pris**, hvis noen.
9. **Omfang:** antall oppskrifter, eller hele basen. Hvordan vi får dem (fil eller API). Vi henter ikke selv fra nettsidene uten at det står i tillatelsen.
10. **Merkevare:** om vi kan bruke navnet deres som kilde, og at vi ikke bruker logo eller antyder at de står bak appen.

### 1.2 Kilder i anbefalt rekkefølge

«Lest» betyr at vilkårene er lest direkte 2026-11-22. «Søk» betyr at de bare er kjent fra søkeresultat. Kontaktopplysninger er bare tatt med der vi har sett dem i en kilde. Ellers står det «finn på nettstedet».

| # | Kilde (rettighetshaver) | Hva vilkårene sier i dag | Kontakt vi har sett | Hvorfor i denne rekkefølgen |
| --- | --- | --- | --- | --- |
| 1 | Helsedirektoratet | Innhold via API etter NLOD med kilde (søk). Uvisst om oppskrifter som «Kokebok for alle» er omfattet | Finn på helsedirektoratet.no | Kan være fritt allerede, og trenger da bare bekreftelse |
| 2 | TINE SA | Samtykke kreves. Ordrett gjengivelse, kreditering, lenke og canonical (lest) | Kundeservice forbruker, tlf. 23 288 335 (fra vilkårssiden) | Åpner for samtykke. Kravet om ordrett gjengivelse må fravikes |
| 3 | Opplysningskontoret for frukt og grønt (frukt.no) | Ingen vilkår funnet (søk). Over 2000 oppskrifter | post@frukt.no (fra faktaark, søk) | Mange grønnsaksretter, og vi har ikke sett noe nei |
| 4 | Norges sjømatråd (godfisk.no) | Mediapool-bilder har begrensninger. Ingen oppskriftsvilkår funnet (søk) | godfisk@seafood.no (fra retningslinjer, søk) | Fiskeretter er et hull hos oss |
| 5 | Opplysningskontoret for brød og korn | Ikke undersøkt (nettstedet var sperret) | Finn på nettstedet | Lavere prioritet for middag |
| 6 | NorgesGruppen (MENY, KIWI, SPAR, Joker) | MENY punkt 16: skriftlig forhåndssamtykke kreves (lest). KIWI: Middagstips-oppskriftene er laget med KI (lest) | Finn på meny.no / kiwi.no | Kan kobles til en kjedeavtale om priser |
| 7 | Coop Norge SA | Ingen vilkår funnet (lest forside, personvern, medlemsvilkår) | Finn på coop.no | Samme som 6 |
| 8 | REMA 1000 Norge AS | Ingen oppskriftsvilkår funnet (lest appvilkår og personvern) | Finn på rema.no | Samme som 6 |
| 9 | Opplysningskontoret for egg og kjøtt (Matprat) | Bruk er ikke tillatt for aktører som ikke finansierer dem og som bygger konkurrerende plattformer. Ikke API (lest, datert 19.2.2026) | post@matprat.no (fra vilkårssiden) | Har allerede sagt nei skriftlig. Spør bare hvis du vil prøve likevel |

**Tips:** Opplysningskontorene (Matprat, frukt.no, Brød og korn) finansieres av sine bransjer. Matprat sier at det er avgjørende for dem. Forvent at noen vil kreve at vi ikke fremhever importvarer eller bestemte merker. Spør om det tidlig, så vi vet om vilkårene passer med en nøytral planlegger.

### 1.3 Utkast til henvendelse (felles mal, ikke sendt)

Fyll inn `[ ]` og legg til avsnittet for kilden fra 1.4. Avsenderen er en plassholder.

> **Emne:** Forespørsel om bruk av oppskrifter i Husvett
>
> Hei,
>
> Jeg utvikler Husvett, en norsk app som hjelper husstander å planlegge ukens middager, lage én handleliste og anslå hva handelen koster. Appen tilpasser mengdene til antall porsjoner og viser allergener.
>
> Vi vil gjerne bruke oppskrifter fra [kilde] i appen, med tydelig kreditering og lenke til originalen. Vi har lest vilkårene deres [lenke] og forstår at det krever skriftlig tillatelse. Vi har ikke kopiert noe.
>
> Kan dere svare på om dette er mulig, og på hvilke vilkår?
>
> 1. Vise et utvalg oppskrifter, eller hele basen, i appen for våre brukere.
> 2. Tilpasse dem: skalere mengder, koble ingrediensene til en handleliste og merke allergener selv.
> 3. Lagre dem hos oss, og hvor lenge.
> 4. Bilder: om de kan brukes, og hvordan de skal krediteres.
> 5. Ønsket kreditering og lenke.
> 6. Varighet, oppsigelse og om vi må følge endringer i originalen.
> 7. Eventuell pris.
> 8. Om dere kan levere oppskriftene som fil eller API, så vi slipper å hente dem fra nettsidene.
>
> Vi bruker ikke logoen deres og gir ikke inntrykk av at dere står bak appen. Allergeninformasjonen kontrollerer vi selv, og appen lover aldri at en rett er fri for allergener.
>
> Er dette ikke aktuelt, setter vi pris på et kort svar.
>
> Vennlig hilsen
> [Navn], [rolle]
> [Selskap], [e-post], [telefon]

### 1.4 Tillegg per kilde

- **Helsedirektoratet:** «Vi har sett at innhold fra helsedirektoratet.no kan brukes etter NLOD med kildeangivelse. Gjelder det også oppskriftene i *Kokebok for alle* og andre oppskriftshefter, med bilder? Og kan vi skalere og strukturere dem i en kommersiell app, når vi krediterer Helsedirektoratet og ikke endrer det faglige innholdet?»
- **TINE:** «Vilkårene sier at oppskrifter skal gjengis ordrett. Vi må skalere mengder etter antall porsjoner og dele opp ingredienslisten. Kan det godtas hvis vi lenker til originalen og skriver «Oppskriften er hentet fra TINE.» ved oppskriften? Gjelder samtykket også bilder fra TINE Mediebank?»
- **Frukt.no og Godfisk:** «Vi fant ingen vilkår for gjenbruk av oppskriftene på nettstedet deres. Derfor spør vi før vi gjør noe.»
- **NorgesGruppen, Coop og REMA:** «Vi er også interessert i en avtale om priser og tilbud. Om det er aktuelt, kan oppskriftene tas med i den samme samtalen.» (Se `phase0/` om kjedeavtaler.)
- **Matprat:** «Vilkårene sier at aktører som ikke finansierer dere og som bygger egne plattformer, ikke kan bruke innholdet. Vi spør likevel: finnes det en ordning for oss, for eksempel bare lenker til oppskriftene deres med kildehenvisning?»

### 1.5 Hva et ja må inneholde

Før vi importerer noe, må vi ha **skriftlig** svar (e-post holder hvis det er tydelig) som dekker:

- hvem som gir tillatelsen, og at de eier rettighetene (også til bildene)
- hvilke oppskrifter tillatelsen gjelder
- punkt 1–3 i 1.1
- kreditering
- varighet

Legg svaret der du lagrer avtaler. **Ikke legg det i repoet** hvis det er fortrolig. Repoet får bare et sammendrag, som for Tjek.

## 2. Importrutine når en kilde har sagt ja

1. **Du gir beskjed** i en økt: kilde, dato, hva tillatelsen dekker (punktene i 1.1) og krediteringsteksten.
2. **`THIRD_PARTY.md`:** Jeg legger til et avsnitt for kilden. Der står det at tillatelsen er «brukerens opplysning, ikke avtaletekst vi har sett» (samme modell som Tjek), og hva som ikke er kjent. Testen `catalog.test.ts` avviser en lisensiert oppskrift hvis rettighetshaveren (`origin.by`) ikke står i `THIRD_PARTY.md`.
3. **Innhenting:** bare slik tillatelsen sier, f.eks. fil eller API fra kilden, eller enkeltoppskrifter for hånd. Ingen skraping av nettsidene med mindre tillatelsen sier det uttrykkelig.
4. **Hver oppskrift** får `origin`:

   ```ts
   origin: { kind: 'lisensiert', by: '<rettighetshaver>', date: '<ÅÅÅÅ-MM-DD>', status: 'utkast', credit: '<kreditering>', url: 'https://…', license: '<kort vilkår>' }
   ```

   Appen viser krediteringen og lenken «Se originaloppskriften» ved fremgangsmåten (`src/views/RecipeOrigin.tsx`). Teksten om oppskriftsbasen i «Lag nå» teller lisensierte oppskrifter for seg.
5. **Varer og allergener** kontrolleres akkurat som for egne oppskrifter:
   - Hver ingrediens kobles til en vare i katalogen.
   - Allergenene er våre egne og settes ut fra varene, ikke ut fra kildens tekst.
   - Sammensatte varer er uavklart (`allergenKnown: false`).
   - Kildens allergenpåstander overtas aldri ukontrollert (regel 4).
6. **Bilder** bare hvis tillatelsen dekker dem. Det krever at bildeverten legges til i CSP (`server/app.ts`, `npm run check:csp`) og kreditering per bilde.
7. **Når tillatelsen opphører:** oppskriftene fra kilden fjernes i én commit. Lagrede planer som peker på dem, må tåle at retten mangler. Det må sjekkes før første import (planversjoner lagrer `recipeId`).

## 3. Egne oppskrifter: omgang 1

25 nye oppskrifter er lagt til i `src/data/catalog.ts` (`ownRecipes`), slik at basen nå har 56. De er vanlige norske hverdagsretter, skrevet med egne ord og egne mengder uten noen kilde åpen:

- fårikål, lys lapskaus, pølsegryte, pytt i panne
- kyllinglår i ovn, kylling i fløtesaus, kyllingsuppe
- søtpotetsuppe, fiskegrateng, ovnslaks, kokt torsk, seibiff, fiskegryte, hyse i fløtesaus, fiskekaker med ertestuing
- chili con carne, kjøttdeigform, kålgryte
- svinefilet to måter, lammedeig med kikerter
- bønnetaco, ovnsomelett, tofu i kokoskarri, soppsuppe

**Merking:** `origin: { kind: 'egen', by: 'KI-utkast (Claude)', status: 'utkast' }`. De er skrevet av en Claude-økt etter eierens beslutning. De er **ikke testkokt og ikke godkjent av en redaktør**. Appen viser «Husvett-oppskrift (utkast, ikke testkokt)».

**Nye varer (10):** hodekål, purre, frosne erter, søtpotet, kyllinglår, svinefilet, fårikålkjøtt, kjøttpølse, matfløte og tomatpuré. Alle har demoprodukt og demopriser (regel 5) og næring fra Matvaretabellen (`scripts/build-nutrition.mjs`; eksisterende tall er uendret). Kjøttpølse er uavklart (`allergenKnown: false`, typisk gluten og melk). Fårikålkjøtt finnes bare i én demobutikk.

**Skjult ved aktive krav (eierens beslutning 2026-11-22, spørsmål 45):** Når allergi-, kost- eller råvarefilteret er på, brukes ingen av disse utkastene. Det gjelder ukeplanen, bytte-, budsjett- og «fant ikke»-forslag, «Lag nå» og retter til tilbud. En låst utkast-rett slippes ut med varsel. Motoren gir årsaken `utkast` (`requirementViolation` i `src/engine/planner.ts`). Ukeplanen, «Rediger uke» og «Lag nå» sier «N oppskrifter er skjult fordi de ikke er allergen-kontrollert av en person ennå». Uten filter vises de som før, med utkast-merket. Demooppskriftene (`kind: 'demo'`) er ikke omfattet, fordi de allerede er merket som demodata.

**Status `testkokt` slipper en oppskrift inn under aktivt filter.** Den skal derfor settes først når retten er laget minst én gang og en person har kontrollert allergenene mot varene. Testkoking alene er ikke nok.

**Må gjøres før de kan regnes som ferdige:**

- testkoking, med mengder og tider rettet
- allergenkontroll av en person nummer to (bruk arket `docs/allergen-gjennomgang.md`, laget med `npm run allergen-ark`)
- godkjenning av en redaktør, og status endret til `testkokt` eller `godkjent`

## 4. Egne oppskrifter: omgang 2

25 nye oppskrifter er lagt til i `src/data/catalog.ts` (`ownRecipes2`, 2026-11-26), slik at basen nå har **81**: 31 demo, 25 fra omgang 1 og 25 fra omgang 2. Norsk husmannskost og enkle familieretter, skrevet med egne ord og egne mengder uten noen kilde åpen (ingen tekst, ingredienslister eller bilder fra Matprat, TINE, kjedene, bøker eller nettsteder). Rettene er valgt for å fylle hull etter omgang 1:

| Gruppe | Retter |
| --- | --- |
| Vegetar (9) | gul ertesuppe, spinatsuppe med egg, blomkål- og brokkoligrateng, stekt ris med tofu og egg, tomatsuppe med bønner, byggotto med sopp, ovnsbakte rotgrønnsaker med kikerter, pasta med brokkoli og erter, potet- og purresuppe |
| Fisk og skalldyr (5) | plukkfisk, fiskeboller i hvit saus, pasta med tunfisk, stekt laks med erter, rekewok |
| Kjøtt (11) | kjøttsuppe, brun lapskaus, karbonader, lasagne (storfe); hel kylling i ovn, kyllinglår i tomatgryte, kyllingwraps (kylling); kålruletter, svinefilet i wok (svin); lammegryte (lam); eggekake med flesk (egg, med svin) |

**Fordeling i omgang 2:** 9 vegetar; 9 under 30 min; 8 på 60 min eller mer (ertesuppe, kjøttsuppe, brun lapskaus, lasagne, hel kylling, kyllinggryte, kålruletter, lammegryte); 13 uten gluten og melk; 12 ulike hovedproteiner (belgvekster 3, storfe 4, fisk 4, kylling 3, egg 2, ost 2, svin 2, og én hver av tofu, sopp, grønnsaker, skalldyr og lam). **Hele basen (81):** 23 vegetar, 53 uten gluten, 51 uten melk, 40 uten både gluten og melk, 26 under 30 min.

**Merking:** som omgang 1, men med datoen 2026-11-26: `origin: { kind: 'egen', by: 'KI-utkast (Claude)', date: '2026-11-26', status: 'utkast' }`. **Ingen av dem er testkokt eller kontrollert av en person.** Ingen oppskrift i basen er `testkokt` eller `godkjent`.

**Allergener:** foreningen av varenes allergener (testet i `catalog.test.ts`: nøyaktig lik, ikke bare dekket), aldri gjettet fra teksten. Fire retter bruker en uavklart vare (`allergenKnown: false`) og kan ha flere allergener enn oppgitt: fiskeboller i hvit saus (fiskeboller), kyllingwraps (tortillalefser), lasagne (lasagneplater) og rekewok (reker). Ved aktivt allergifilter gir de ukjent pris, men de er uansett skjult som utkast når et filter er på.

**Nye varer (7):** gule erter (tørre), byggryn, lasagneplater, grytekjøtt av storfe, hel kylling, fiskeboller (hermetiske, uavklart) og tunfisk i vann. Alle har demoprodukt og demopriser i begge demobutikkene (regel 5) og næring fra Matvaretabellen (`scripts/build-nutrition.mjs`; eksisterende tall er kontrollert uendret). Lasagneplater er uavklart fordi noen merker har egg.

**Skjult ved aktive krav:** som omgang 1. Med allergi-, kost- eller råvarefilter skjules nå 50 utkast; med filter på er basen fortsatt bare de 31 demorettene. Omgang 2 gir derfor først variasjon med filter når rettene er testkokt og allergen-kontrollert. Testen «når omgang 2 en gang er kontrollert (simulert godkjent)» i `planner.test.ts` viser at planen da holder seg til maks to per protein med filter for gluten + melk og for vegetar. Vegetar uten melk gir i dag bare fire demoretter, så planen gjentar retter (testet).

**Må gjøres før de kan regnes som ferdige:** samme som for omgang 1 (testkoking, allergenkontroll med `docs/allergen-gjennomgang.md`, som nå dekker alle 81, og godkjenning).

Neste omganger: se `docs/oppskrifter-research.md`, kapittel 6.
