# Allergengjennomgang av oppskriftene

**Status: UTKAST. Kontrollen er ikke ferdig før feltene under hver oppskrift er fylt ut av en person.** Arket er laget av skriptet `npm run allergen-ark` ut fra varene og oppskriftene i `src/data/catalog.ts`. Alt som står i tabellene kommer fra koden; skriptet har ikke lagt til egne allergenopplysninger. Appen garanterer aldri allergenfrihet, og dette arket gjør det heller ikke.

## Slik gjennomgår du arket

### Hvorfor
Allergi- og kostfiltrene i appen bygger på allergenmerkingen i dette arket. Før noen med allergi eller kostkrav inviteres, skal en person kontrollere at merkingen stemmer. Du trenger ikke kunne programmere. Du trenger arket og din egen kunnskap om hva slike varer vanligvis inneholder (eller pakningen, hvis du har den).

### De 14 allergenene
Appen bruker EUs liste. Navnet i parentes er det som står i koden: gluten (`gluten`), melk (`melk`), egg (`egg`), fisk (`fisk`), skalldyr (`skalldyr`), bløtdyr (`blotdyr`), soya (`soya`), peanøtter (`peanotter`), nøtter (`notter`), selleri (`selleri`), sennep (`sennep`), sesam (`sesam`), lupin (`lupin`), svoveldioksid og sulfitt (`sulfitt`).

### Én oppskrift om gangen
1. **Les varelisten.** Stemmer varene og mengdene med retten slik fremgangsmåten under tabellen beskriver den? Mangler det noe som brukes i fremgangsmåten (for eksempel krydder, buljong, smør eller brødsmuler), står det under «Mulige avvik».
2. **Se på hver vare.** Kolonnen «Allergener fra varen» viser hva appen mener varen inneholder. Stemmer det? Mangler noe varen vanligvis inneholder?
3. **Se på «Appens allergener for retten».** Det er denne listen filteret bruker. Den skal dekke allergenene til alle varene. Les også linjen «Ikke merket»: er det noe i den listen som faktisk finnes i retten?
4. **Se på kosttagger.** «Vegetar: ja» betyr at retten kommer med når brukeren har valgt vegetar. «Råvaretagger» (storfe, svin, lam, kylling, fisk, skalldyr, belgvekster, nøtter) brukes når brukeren velger å unngå en råvare. Gluten, melk (inkludert laktose) og egg er allergener i appen, ikke egne kosttagger.
5. **Fyll ut feltene under retten.** Kryss av ved å skrive en x mellom hakeparentesene: `[x] ja`.
   - **Allergener stemmer: ja** bare hvis du har sett over alt ovenfor og ikke fant noe galt.
   - **Kosttagger stemmer: ja** på samme måte for vegetar og råvaretagger.
   - **Gjennomgått av:** skriv rolle (for eksempel «redaktør» eller «kontrollør 2»), aldri personnavn. **Dato:** ÅÅÅÅ-MM-DD.

### Hva «uavklart» betyr
En vare er **uavklart** (`allergenKnown: false` i koden) når innholdet ikke er fastslått og varen kan ha flere allergener enn de som står oppført. Det gjelder typisk sammensatte varer (kjøttpølse, fiskekaker, tortillalefser, nudler) og varer der merkene er ulike (kokosmelk, skalldyr, makrell i tomat). I appen betyr det:
- Varen godkjennes **aldri** som erstatning når en allergi er valgt, og kan gi ukjent pris.
- Retten viser «Innholdet i noen varer er ikke avklart. Sjekk pakningen.»
- Retten blir **ikke** skjult på grunn av en uavklart vare. Filteret ser bare på rettens egen allergenliste. Derfor er det viktig at du skriver i kommentaren hva du mener kan finnes i en uavklart vare, så redaktøren kan avgjøre om rettens liste skal utvides. Ikke gjett: skriv «usikker» hvis du ikke vet.

Under «Uavklarte varer» lenger ned står hver uavklart vare med begrunnelsen koden selv oppgir.

### Hvis du finner et avvik
Skriv avviket i **kommentaren** under retten: hvilken vare, hva appen sier, og hva du mener det bør være. **Ikke endre koden selv.** Sett «Allergener stemmer: nei» (eller «Kosttagger stemmer: nei»). Redaktøren retter koden etterpå og oppdaterer arket.

### Etter gjennomgangen
- `origin.status` i koden settes til `godkjent` **bare** når en person har kontrollert både allergener og kosttagger for oppskriften (se «Oppskrifter» i `CLAUDE.md`). Status endres ikke i arket, men av utvikleren etter at arket er levert.
- `testkokt` slipper en oppskrift inn selv når et allergi-, kost- eller råvarefilter er på. Den settes derfor først når retten er laget minst én gang og en person har kontrollert allergenene.
- Så lenge en egen oppskrift er `utkast`, skjules den i appen når et filter er på. Det er meningen.

### Om arket
- Det er ingen automatisk kobling mellom arket og koden. Når varer eller oppskrifter endres, kjør `npm run allergen-ark` på nytt. Skriptet nekter å overskrive en fil der noen har fylt ut felt, med mindre du bruker `--overstyr`; ta da vare på den gamle filen først.
- Arket inneholder demovarer (regel 5): oppdiktede produkter og priser. Allergenene gjelder «en typisk vare», ikke et bestemt merke. Pakningen i butikken avgjør alltid.
- Basisvarene salt og matolje har ikke et produkt i katalogen og er derfor ikke allergenmerket i appen.

## Mulige avvik funnet av skriptet

Skriptet sammenligner dataene med hverandre og peker på steder en person bør se ekstra nøye. Dette er **ikke** fasit og er ikke rettet. Hvert punkt er enten en feil i koden eller noe som er satt bevisst; avgjør i kommentaren.

| Gjelder | Type | Beskrivelse |
| --- | --- | --- |
| `chili` | ord-i-steg | Chili con carne: navn eller fremgangsmåte nevner «krydder», som ikke er ført opp som vare. Allergener fra det er ikke med i merkingen. |
| `fiskegrateng` | ord-i-steg | Fiskegrateng: navn eller fremgangsmåte nevner «smurt», som ikke er ført opp som vare. Allergener fra det er ikke med i merkingen. |
| `karri` | ord-i-steg | Kylling i karri: navn eller fremgangsmåte nevner «karri», som ikke er ført opp som vare. Allergener fra det er ikke med i merkingen. |
| `kikertcurry` | ord-i-steg | Kikertcurry med spinat og ris: navn eller fremgangsmåte nevner «karri», som ikke er ført opp som vare. Allergener fra det er ikke med i merkingen. |
| `kjottkaker` | allergen-uten-vare | Kjøttkaker med poteter: gluten står i rettens allergenliste, men ingen vare i retten er merket med det (kan være satt bevisst, for eksempel for noe som ikke er ført opp som vare). |
| `lammeboller` | ord-i-steg | Lammekjøttboller med ris og rømmesaus: navn eller fremgangsmåte nevner «krydder», som ikke er ført opp som vare. Allergener fra det er ikke med i merkingen. |
| `taco` | ord-i-steg | Fredagstaco: navn eller fremgangsmåte nevner «krydder», som ikke er ført opp som vare. Allergener fra det er ikke med i merkingen. |
| `tofukarri` | ord-i-steg | Tofu i kokoskarri med ris: navn eller fremgangsmåte nevner «karri», som ikke er ført opp som vare. Allergener fra det er ikke med i merkingen. |
| vare erter | navn-uten-tagg | Navnet «Grønne erter (frosne)» tyder på kosttaggen «belgvekster», men varen har den ikke (kosttaggene styrer «unngå råvare»). |
| `vegtaco` | ord-i-steg | Bønnetaco: navn eller fremgangsmåte nevner «tacokrydder», som ikke er ført opp som vare. Allergener fra det er ikke med i merkingen. |

## Uavklarte varer

| Vare | Produkt | Allergener oppgitt | Begrunnelse i koden |
| --- | --- | --- | --- |
| Kokosmelk | Kokosmelk 400 ml | – (uavklart) | Noen merker har tilsatt sulfitt (konserveringsmiddel). |
| Fiskekaker | Fiskekaker 500 g | gluten, melk, egg, fisk (uavklart) | Typisk fisk, hvetemel, melk og egg, ofte også soya; innholdet varierer mellom merker. |
| Tortillalefser | Tortillalefser 8 stk | gluten (uavklart) | Hvete, men noen merker har også melk eller soya. |
| Reker, skallfrie | Reker, skallfrie 300 g | skalldyr (uavklart) | Sulfitt brukes ofte mot mørkfarging. |
| Makrell i tomat (hermetisk) | Makrell i tomat 170 g | gluten, fisk (uavklart) | Tomatsausen kan ha gluten (stivelse) og andre tilsetninger. |
| Hvetenudler (tørre) | Hvetenudler 250 g | gluten, egg (uavklart) | Ofte eggnudler; egg er ikke avklart. |
| Kjøttpølse | Kjøttpølse 500 g | gluten, melk (uavklart) | Innholdet varierer mellom merker (ofte melk, noen ganger hvete, sennep eller selleri). |
| Lasagneplater | Lasagneplater 500 g | gluten (uavklart) | Hvete, men noen merker har også egg. |
| Fiskeboller (hermetiske) | Fiskeboller, hermetiske 560 g (avrent) | melk, fisk (uavklart) | Typisk fisk og melk, men innholdet varierer mellom merker (noen har hvete eller andre tilsetninger). |

## Oversikt over oppskriftene

81 oppskrifter. Fyll ut «ferdig» når alle felt under retten er fylt ut.

| # | Oppskrift | Opphav | Allergener (appen) | Vegetar | Uavklarte varer | Ferdig |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Spagetti bolognese (`bolognese`) | demo, utkast | gluten | nei | 0 | [ ] |
| 2 | Fredagstaco (`taco`) | demo, utkast | gluten, melk | nei | 1 | [ ] |
| 3 | Kylling i karri (`karri`) | demo, utkast | – | nei | 1 | [ ] |
| 4 | Ovnsbakt torsk med rotgrønnsaker (`ovnstorsk`) | demo, utkast | fisk | nei | 0 | [ ] |
| 5 | Fiskekaker med poteter og gulrot (`fiskekaker`) | demo, utkast | gluten, melk, egg, fisk | nei | 1 | [ ] |
| 6 | Linsegryte (`linsegryte`) | demo, utkast | – | ja | 0 | [ ] |
| 7 | Pasta med spinat og ost (`pastaspinat`) | demo, utkast | gluten, melk | ja | 0 | [ ] |
| 8 | Omelett med grønnsaker (`omelett`) | demo, utkast | melk, egg | ja | 0 | [ ] |
| 9 | Laks med ris og brokkoli (`lakseris`) | demo, utkast | fisk | nei | 0 | [ ] |
| 10 | Kyllingwok (`kyllingwok`) | demo, utkast | – | nei | 0 | [ ] |
| 11 | Pannekaker (`pannekaker`) | demo, utkast | gluten, melk, egg | ja | 0 | [ ] |
| 12 | Bønnechili med ris (`bonnechili`) | demo, utkast | – | ja | 0 | [ ] |
| 13 | Kjøttkaker med poteter (`kjottkaker`) | demo, utkast | gluten, melk | nei | 0 | [ ] |
| 14 | Fiskesuppe (`fiskesuppe`) | demo, utkast | fisk | nei | 1 | [ ] |
| 15 | Svinekoteletter med poteter og gulrot (`svinekotelett`) | demo, utkast | – | nei | 0 | [ ] |
| 16 | Stekt flesk med kålrotstappe (`fleskkalrot`) | demo, utkast | – | nei | 0 | [ ] |
| 17 | Svinekjøttdeig-wok med ris (`svinewok`) | demo, utkast | gluten, soya | nei | 0 | [ ] |
| 18 | Lammekjøttboller med ris og rømmesaus (`lammeboller`) | demo, utkast | melk | nei | 0 | [ ] |
| 19 | Pasta med lammedeig og tomat (`lammepasta`) | demo, utkast | gluten | nei | 0 | [ ] |
| 20 | Rekepasta med spinat (`rekepasta`) | demo, utkast | gluten, skalldyr | nei | 1 | [ ] |
| 21 | Reker i kokossaus med ris (`rekekokos`) | demo, utkast | skalldyr | nei | 2 | [ ] |
| 22 | Ovnsbakt sei med blomkål og poteter (`seigryte`) | demo, utkast | fisk | nei | 0 | [ ] |
| 23 | Stekt sild med poteter og gulrot (`stektsild`) | demo, utkast | gluten, fisk | nei | 0 | [ ] |
| 24 | Makrell i tomat med poteter (`makrelltomat`) | demo, utkast | gluten, fisk | nei | 1 | [ ] |
| 25 | Hyse med ris og brokkoli (`hyseris`) | demo, utkast | fisk | nei | 0 | [ ] |
| 26 | Kyllingnudler (`kyllingnudler`) | demo, utkast | gluten, egg, soya | nei | 1 | [ ] |
| 27 | Ovnsbakt kylling med blomkål og poteter (`ovnskylling`) | demo, utkast | – | nei | 0 | [ ] |
| 28 | Kikertcurry med spinat og ris (`kikertcurry`) | demo, utkast | – | ja | 1 | [ ] |
| 29 | Tofuwok med ris (`tofuwok`) | demo, utkast | gluten, soya | ja | 0 | [ ] |
| 30 | Pasta med sopp og rømme (`soppasta`) | demo, utkast | gluten, melk | ja | 0 | [ ] |
| 31 | Ovnsbakt blomkål og poteter med ost (`ovnsblomkal`) | demo, utkast | melk | ja | 0 | [ ] |
| 32 | Fårikål (`farikal`) | egen, utkast | – | nei | 0 | [ ] |
| 33 | Lys lapskaus med flesk (`lapskaus`) | egen, utkast | – | nei | 0 | [ ] |
| 34 | Pølsegryte med ris (`polsegryte`) | egen, utkast | gluten, melk | nei | 1 | [ ] |
| 35 | Pytt i panne med speilegg (`pyttipanne`) | egen, utkast | gluten, melk, egg | nei | 1 | [ ] |
| 36 | Ovnsbakte kyllinglår med søtpotet (`kyllinglar`) | egen, utkast | – | nei | 0 | [ ] |
| 37 | Kylling i fløtesaus med purre (`kyllingpurre`) | egen, utkast | melk | nei | 0 | [ ] |
| 38 | Kyllingsuppe med grønnsaker (`kyllingsuppe`) | egen, utkast | – | nei | 0 | [ ] |
| 39 | Søtpotetsuppe med kikerter (`sotpotetsuppe`) | egen, utkast | – | ja | 1 | [ ] |
| 40 | Fiskegrateng (`fiskegrateng`) | egen, utkast | gluten, melk, egg, fisk | nei | 0 | [ ] |
| 41 | Ovnsbakt laks med poteter og purre (`ovnslaks`) | egen, utkast | fisk | nei | 0 | [ ] |
| 42 | Kokt torsk med poteter og gulrøtter (`kokttorsk`) | egen, utkast | fisk | nei | 0 | [ ] |
| 43 | Seibiff med løk (`seibiff`) | egen, utkast | gluten, fisk | nei | 0 | [ ] |
| 44 | Fiskegryte med tomat og paprika (`fiskegryte`) | egen, utkast | fisk | nei | 0 | [ ] |
| 45 | Hyse i fløtesaus med purre (`hysepurre`) | egen, utkast | melk, fisk | nei | 0 | [ ] |
| 46 | Fiskekaker med ertestuing (`fiskekakererter`) | egen, utkast | gluten, melk, egg, fisk | nei | 1 | [ ] |
| 47 | Chili con carne (`chili`) | egen, utkast | – | nei | 0 | [ ] |
| 48 | Kjøttdeigform med potetmos (`kjottdeigform`) | egen, utkast | melk | nei | 0 | [ ] |
| 49 | Kålgryte med kjøttdeig og ris (`kalgryte`) | egen, utkast | – | nei | 0 | [ ] |
| 50 | Svinefilet med søtpotet og brokkoli (`svinefilet`) | egen, utkast | – | nei | 0 | [ ] |
| 51 | Svinefilet i fløtesaus med sopp (`svinesopp`) | egen, utkast | melk | nei | 0 | [ ] |
| 52 | Lammedeig med kikerter og tomat (`lammekikert`) | egen, utkast | – | nei | 0 | [ ] |
| 53 | Bønnetaco (`vegtaco`) | egen, utkast | gluten, melk | ja | 1 | [ ] |
| 54 | Ovnsomelett med poteter og spinat (`frittata`) | egen, utkast | melk, egg | ja | 0 | [ ] |
| 55 | Tofu i kokoskarri med ris (`tofukarri`) | egen, utkast | soya | ja | 1 | [ ] |
| 56 | Kremet soppsuppe (`soppsuppe`) | egen, utkast | melk | ja | 0 | [ ] |
| 57 | Gul ertesuppe med rotgrønnsaker (`ertesuppe`) | egen, utkast | – | ja | 0 | [ ] |
| 58 | Spinatsuppe med egg (`spinatsuppe`) | egen, utkast | melk, egg | ja | 0 | [ ] |
| 59 | Blomkål- og brokkoligrateng (`blomkalgrateng`) | egen, utkast | melk, egg | ja | 0 | [ ] |
| 60 | Stekt ris med tofu og egg (`tofuris`) | egen, utkast | gluten, egg, soya | ja | 0 | [ ] |
| 61 | Tomatsuppe med bønner og grønnsaker (`bonnesuppe`) | egen, utkast | – | ja | 0 | [ ] |
| 62 | Byggotto med sopp (`byggotto`) | egen, utkast | gluten, melk | ja | 0 | [ ] |
| 63 | Ovnsbakte rotgrønnsaker med kikerter (`rotgronnsaker`) | egen, utkast | – | ja | 0 | [ ] |
| 64 | Pasta med brokkoli, erter og ost (`brokkolipasta`) | egen, utkast | gluten, melk | ja | 0 | [ ] |
| 65 | Potet- og purresuppe (`purresuppe`) | egen, utkast | melk | ja | 0 | [ ] |
| 66 | Plukkfisk (`plukkfisk`) | egen, utkast | gluten, melk, fisk | nei | 0 | [ ] |
| 67 | Fiskeboller i hvit saus (`fiskeboller`) | egen, utkast | gluten, melk, fisk | nei | 1 | [ ] |
| 68 | Pasta med tunfisk, mais og tomat (`tunfiskpasta`) | egen, utkast | gluten, fisk | nei | 0 | [ ] |
| 69 | Stekt laks med poteter og erter (`stektlaks`) | egen, utkast | fisk | nei | 0 | [ ] |
| 70 | Rekewok med ris (`rekewok`) | egen, utkast | skalldyr | nei | 1 | [ ] |
| 71 | Kjøttsuppe med rotgrønnsaker (`kjottsuppe`) | egen, utkast | – | nei | 0 | [ ] |
| 72 | Brun lapskaus (`brunlapskaus`) | egen, utkast | – | nei | 0 | [ ] |
| 73 | Karbonader med løk og poteter (`karbonader`) | egen, utkast | – | nei | 0 | [ ] |
| 74 | Lasagne med kjøttdeig (`lasagne`) | egen, utkast | gluten, melk | nei | 1 | [ ] |
| 75 | Hel kylling i ovn med rotgrønnsaker (`helkylling`) | egen, utkast | – | nei | 0 | [ ] |
| 76 | Kyllinglår i tomatgryte med bønner (`kyllinggryte`) | egen, utkast | – | nei | 0 | [ ] |
| 77 | Kyllingwraps med grønnsaker (`kyllingwrap`) | egen, utkast | gluten, melk | nei | 1 | [ ] |
| 78 | Kålruletter i tomatsaus (`kalruletter`) | egen, utkast | egg | nei | 0 | [ ] |
| 79 | Lammegryte med kålrot og gulrot (`lammegryte`) | egen, utkast | – | nei | 0 | [ ] |
| 80 | Eggekake med stekt flesk (`eggekake`) | egen, utkast | melk, egg | nei | 0 | [ ] |
| 81 | Svinefilet i wok med grønnsaker og ris (`svinefiletwok`) | egen, utkast | – | nei | 0 | [ ] |

## Oppskrifter

### 1. Spagetti bolognese (`bolognese`)

Opphav: demo, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Pasta | 400 g | Spagetti 500 g | gluten | kjent |
| Kjøttdeig | 400 g | Kjøttdeig 400 g; Kjøttdeig 800 g | – | kjent |
| Hakkede tomater | 800 g | Hakkede tomater 400 g | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten
- Samlet fra varene: gluten
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: storfe. Råvaretagger fra varene: storfe.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Stek løk og kjøttdeig. Tilsett tomat og la småkoke i 20 min. Kok pasta og server.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 2. Fredagstaco (`taco`)

Opphav: demo, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kjøttdeig | 400 g | Kjøttdeig 400 g; Kjøttdeig 800 g | – | kjent |
| Tortillalefser | 8 stk | Tortillalefser 8 stk | gluten | **uavklart** |
| Mais | 200 g | Mais 200 g | – | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Ost | 150 g | Norvegia 400 g | melk | kjent |
| Rømme | 200 ml | Rømme 300 ml | melk | kjent |

- **Appens allergener for retten** (det filteret bruker): gluten, melk
- Samlet fra varene: gluten, melk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: storfe. Råvaretagger fra varene: storfe.
- Uavklart eller uten merking: Tortillalefser.
- Fremgangsmåte (for å se om noe mangler i varelisten): Stek kjøttdeig med krydder. Del opp grønnsaker. Sett frem og la alle bygge sin egen.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 3. Kylling i karri (`karri`)

Opphav: demo, status utkast. Tid: 40 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kyllingfilet | 500 g | Kyllingfilet 600 g | – | kjent |
| Kokosmelk | 400 ml | Kokosmelk 400 ml | – | **uavklart** |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: kylling. Råvaretagger fra varene: kylling.
- Uavklart eller uten merking: Kokosmelk.
- Fremgangsmåte (for å se om noe mangler i varelisten): Brun kylling og løk. Tilsett kokosmelk og karri, la putre. Server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 4. Ovnsbakt torsk med rotgrønnsaker (`ovnstorsk`)

Opphav: demo, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Torsk | 600 g | Torskefilet 400 g | fisk | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): fisk
- Samlet fra varene: fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Skjær poteter og gulrot, bak i 15 min. Legg torsken oppå og bak 12 min til.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 5. Fiskekaker med poteter og gulrot (`fiskekaker`)

Opphav: demo, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Fiskekaker | 500 g | Fiskekaker 500 g | gluten, melk, egg, fisk | **uavklart** |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |

- **Appens allergener for retten** (det filteret bruker): gluten, melk, egg, fisk
- Samlet fra varene: gluten, melk, egg, fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Fiskekaker.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter og gulrot. Stek fiskekakene.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 6. Linsegryte (`linsegryte`)

Opphav: demo, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Røde linser | 300 g | Røde linser 500 g | – | kjent |
| Hakkede tomater | 400 g | Hakkede tomater 400 g | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Ris | 200 g | Jasminris 1 kg | – | kjent |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: belgvekster. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok linser med løk og gulrot. Tilsett tomat og server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 7. Pasta med spinat og ost (`pastaspinat`)

Opphav: demo, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Pasta | 400 g | Spagetti 500 g | gluten | kjent |
| Spinat | 200 g | Spinat 200 g | – | kjent |
| Ost | 150 g | Norvegia 400 g | melk | kjent |

- **Appens allergener for retten** (det filteret bruker): gluten, melk
- Samlet fra varene: gluten, melk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: ost. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok pasta. Bland inn spinat og revet ost.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 8. Omelett med grønnsaker (`omelett`)

Opphav: demo, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Egg | 8 stk | Egg 12 stk | egg | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Ost | 100 g | Norvegia 400 g | melk | kjent |

- **Appens allergener for retten** (det filteret bruker): melk, egg
- Samlet fra varene: melk, egg
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: egg. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Pisk egg, stek grønnsaker, hell over egg. Topp med ost.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 9. Laks med ris og brokkoli (`lakseris`)

Opphav: demo, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Laks | 500 g | Laksefilet 400 g | fisk | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Brokkoli | 300 g | Brokkoli 400 g | – | kjent |

- **Appens allergener for retten** (det filteret bruker): fisk
- Samlet fra varene: fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Bak laks i 12 min. Kok ris og brokkoli.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 10. Kyllingwok (`kyllingwok`)

Opphav: demo, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kyllingfilet | 500 g | Kyllingfilet 600 g | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Paprika | 2 stk | Paprika 3-pk | – | kjent |
| Brokkoli | 300 g | Brokkoli 400 g | – | kjent |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: kylling. Råvaretagger fra varene: kylling.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Stek kylling. Tilsett grønnsaker og wok i 6 min. Server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 11. Pannekaker (`pannekaker`)

Opphav: demo, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Hvetemel | 300 g | Hvetemel 1 kg | gluten | kjent |
| Egg | 4 stk | Egg 12 stk | egg | kjent |
| Melk | 600 ml | Lettmelk 1 l | melk | kjent |

- **Appens allergener for retten** (det filteret bruker): gluten, melk, egg
- Samlet fra varene: gluten, melk, egg
- Ikke merket (kontroller at ingen av disse finnes i retten): fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: egg. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Rør røren og la den hvile. Stek tynne pannekaker.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 12. Bønnechili med ris (`bonnechili`)

Opphav: demo, status utkast. Tid: 40 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kidneybønner | 500 g | Kidneybønner 400 g | – | kjent |
| Hakkede tomater | 800 g | Hakkede tomater 400 g | – | kjent |
| Mais | 200 g | Mais 200 g | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: belgvekster. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Fres løk, tilsett bønner, tomat og mais. Småkok 25 min og server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 13. Kjøttkaker med poteter (`kjottkaker`)

Opphav: demo, status utkast. Tid: 45 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kjøttdeig | 600 g | Kjøttdeig 400 g; Kjøttdeig 800 g | – | kjent |
| Poteter | 1000 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 400 g | Gulrot 1 kg | – | kjent |
| Melk | 200 ml | Lettmelk 1 l | melk | kjent |

- **Appens allergener for retten** (det filteret bruker): gluten, melk
- Samlet fra varene: melk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: storfe. Råvaretagger fra varene: storfe.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Form kjøttkaker og stek. Kok poteter og gulrot.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 14. Fiskesuppe (`fiskesuppe`)

Opphav: demo, status utkast. Tid: 40 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Torsk | 400 g | Torskefilet 400 g | fisk | kjent |
| Poteter | 500 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Kokosmelk | 400 ml | Kokosmelk 400 ml | – | **uavklart** |

- **Appens allergener for retten** (det filteret bruker): fisk
- Samlet fra varene: fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Kokosmelk.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter og gulrot. Tilsett kokosmelk og torsk, la trekke 8 min.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 15. Svinekoteletter med poteter og gulrot (`svinekotelett`)

Opphav: demo, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Svinekoteletter (nakke, med ben) | 800 g | Svinekoteletter 600 g | – | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: svin. Råvaretagger fra varene: svin.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter og gulrot. Krydre koteletter og stek 4–5 min på hver side. La kjøttet hvile et par minutter før servering.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 16. Stekt flesk med kålrotstappe (`fleskkalrot`)

Opphav: demo, status utkast. Tid: 40 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Sideflesk | 600 g | Sideflesk 500 g | – | kjent |
| Kålrot | 800 g | Kålrot 1 kg | – | kjent |
| Poteter | 600 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: svin. Råvaretagger fra varene: svin.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Skrell og kok kålrot, poteter og gulrot møre. Stek fleskeskivene sprø i panne eller ovn. Stapp grønnsakene og server med flesket.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 17. Svinekjøttdeig-wok med ris (`svinewok`)

Opphav: demo, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Svinekjøttdeig | 500 g | Svinekjøttdeig 400 g | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Paprika | 2 stk | Paprika 3-pk | – | kjent |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |
| Soyasaus | 40 ml | Soyasaus 150 ml | gluten, soya | kjent |

- **Appens allergener for retten** (det filteret bruker): gluten, soya
- Samlet fra varene: gluten, soya
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, egg, fisk, skalldyr, bløtdyr, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: svin. Råvaretagger fra varene: svin.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Sett ris på koking. Stek svinekjøttdeigen smuldrende. Tilsett strimlet grønnsaker og soyasaus, wok i 5 min. Server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 18. Lammekjøttboller med ris og rømmesaus (`lammeboller`)

Opphav: demo, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Lammekjøttdeig | 500 g | Lammekjøttdeig 400 g | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Rømme | 200 ml | Rømme 300 ml | melk | kjent |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk
- Samlet fra varene: melk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: lam. Råvaretagger fra varene: lam.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Bland lammedeig med revet løk og krydder, form små boller. Stek bollene gjennom. Kok ris og gulrot. Server med rømme som saus.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 19. Pasta med lammedeig og tomat (`lammepasta`)

Opphav: demo, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Lammekjøttdeig | 400 g | Lammekjøttdeig 400 g | – | kjent |
| Pasta | 400 g | Spagetti 500 g | gluten | kjent |
| Hakkede tomater | 800 g | Hakkede tomater 400 g | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten
- Samlet fra varene: gluten
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: lam. Råvaretagger fra varene: lam.
- Uavklart eller uten merking: Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Stek løk og lammedeig. Tilsett tomat og la småkoke i 15 min. Kok pasta og bland.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 20. Rekepasta med spinat (`rekepasta`)

Opphav: demo, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Pasta | 400 g | Spagetti 500 g | gluten | kjent |
| Reker, skallfrie | 300 g | Reker, skallfrie 300 g | skalldyr | **uavklart** |
| Spinat | 200 g | Spinat 200 g | – | kjent |
| Hakkede tomater | 400 g | Hakkede tomater 400 g | – | kjent |
| Matolje | 10 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, skalldyr
- Samlet fra varene: gluten, skalldyr
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, egg, fisk, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: skalldyr. Råvaretagger fra varene: skalldyr.
- Uavklart eller uten merking: Reker, skallfrie, Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok pasta. Varm tomat med spinat i en panne. Vend inn rekene til de er varme og bland med pasta.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 21. Reker i kokossaus med ris (`rekekokos`)

Opphav: demo, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Reker, skallfrie | 400 g | Reker, skallfrie 300 g | skalldyr | **uavklart** |
| Kokosmelk | 400 ml | Kokosmelk 400 ml | – | **uavklart** |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |

- **Appens allergener for retten** (det filteret bruker): skalldyr
- Samlet fra varene: skalldyr
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: skalldyr. Råvaretagger fra varene: skalldyr.
- Uavklart eller uten merking: Reker, skallfrie, Kokosmelk.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok ris. Fres løk og paprika, tilsett kokosmelk og la putre 5 min. Vend inn reker og server over ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 22. Ovnsbakt sei med blomkål og poteter (`seigryte`)

Opphav: demo, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Seifilet | 600 g | Seifilet 400 g | fisk | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Blomkål | 500 g | Blomkål 1 stk (ca. 600 g) | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): fisk
- Samlet fra varene: fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Del poteter og blomkål i biter og bak 20 min på 200 °C. Legg seifilet på toppen og bak 10 min til.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 23. Stekt sild med poteter og gulrot (`stektsild`)

Opphav: demo, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Sildefilet | 500 g | Sildefilet 400 g | fisk | kjent |
| Hvetemel | 80 g | Hvetemel 1 kg | gluten | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Matolje | 40 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, fisk
- Samlet fra varene: gluten, fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter og gulrot. Vend sildefiletene i mel og salt. Stek gyllen på middels varme, 2–3 min per side.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 24. Makrell i tomat med poteter (`makrelltomat`)

Opphav: demo, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Makrell i tomat (hermetisk) | 510 g | Makrell i tomat 170 g | gluten, fisk | **uavklart** |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |

- **Appens allergener for retten** (det filteret bruker): gluten, fisk
- Samlet fra varene: gluten, fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Makrell i tomat (hermetisk).
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter. Riv gulrot og skjær løk. Server makrell i tomat med poteter og rå grønnsaker.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 25. Hyse med ris og brokkoli (`hyseris`)

Opphav: demo, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Hysefilet | 600 g | Hysefilet 400 g | fisk | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Brokkoli | 300 g | Brokkoli 400 g | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): fisk
- Samlet fra varene: fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok ris og brokkoli. Stek hysefilet 3–4 min på hver side. Server sammen.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 26. Kyllingnudler (`kyllingnudler`)

Opphav: demo, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kyllingfilet | 400 g | Kyllingfilet 600 g | – | kjent |
| Hvetenudler (tørre) | 250 g | Hvetenudler 250 g | gluten, egg | **uavklart** |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Soyasaus | 40 ml | Soyasaus 150 ml | gluten, soya | kjent |

- **Appens allergener for retten** (det filteret bruker): gluten, egg, soya
- Samlet fra varene: gluten, egg, soya
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, fisk, skalldyr, bløtdyr, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: kylling. Råvaretagger fra varene: kylling.
- Uavklart eller uten merking: Hvetenudler (tørre).
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok nudler etter anvisning på pakken. Stek kylling i strimler, tilsett grønnsaker og soyasaus. Vend inn nudlene.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 27. Ovnsbakt kylling med blomkål og poteter (`ovnskylling`)

Opphav: demo, status utkast. Tid: 40 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kyllingfilet | 600 g | Kyllingfilet 600 g | – | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Blomkål | 400 g | Blomkål 1 stk (ca. 600 g) | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: kylling. Råvaretagger fra varene: kylling.
- Uavklart eller uten merking: Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Del poteter og blomkål i biter og bak 15 min på 200 °C. Legg kyllingen på og bak 20 min til.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 28. Kikertcurry med spinat og ris (`kikertcurry`)

Opphav: demo, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kikerter (hermetiske) | 800 g | Kikerter 400 g | – | kjent |
| Kokosmelk | 400 ml | Kokosmelk 400 ml | – | **uavklart** |
| Hakkede tomater | 400 g | Hakkede tomater 400 g | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Spinat | 200 g | Spinat 200 g | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: belgvekster. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: Kokosmelk.
- Fremgangsmåte (for å se om noe mangler i varelisten): Fres løk og karri. Tilsett kikerter, tomat og kokosmelk, la putre 15 min. Vend inn spinat og server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 29. Tofuwok med ris (`tofuwok`)

Opphav: demo, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Tofu | 400 g | Tofu naturell 400 g | soya | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Brokkoli | 300 g | Brokkoli 400 g | – | kjent |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |
| Soyasaus | 40 ml | Soyasaus 150 ml | gluten, soya | kjent |

- **Appens allergener for retten** (det filteret bruker): gluten, soya
- Samlet fra varene: gluten, soya
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, egg, fisk, skalldyr, bløtdyr, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: tofu. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: ingen.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok ris. Stek tofu i terninger gylden. Tilsett grønnsaker og soyasaus, wok i 5 min. Server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 30. Pasta med sopp og rømme (`soppasta`)

Opphav: demo, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Pasta | 400 g | Spagetti 500 g | gluten | kjent |
| Sjampinjong | 300 g | Sjampinjong 250 g | – | kjent |
| Rømme | 200 ml | Rømme 300 ml | melk | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk
- Samlet fra varene: gluten, melk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: sopp. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok pasta. Stek skivet sopp og løk gyllen. Rør inn rømme, varm forsiktig og bland med pasta.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 31. Ovnsbakt blomkål og poteter med ost (`ovnsblomkal`)

Opphav: demo, status utkast. Tid: 40 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Blomkål | 600 g | Blomkål 1 stk (ca. 600 g) | – | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Ost | 150 g | Norvegia 400 g | melk | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk
- Samlet fra varene: melk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: ost. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Del blomkål og poteter i biter og bak 25 min på 200 °C. Strø over revet ost og bak 8 min til.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 32. Fårikål (`farikal`)

Opphav: egen, status utkast. Tid: 150 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Fårikålkjøtt (lam, med ben) | 1500 g | Fårikålkjøtt 1,5 kg | – | kjent |
| Hodekål | 1200 g | Hodekål 1 stk (ca. 1,2 kg) | – | kjent |
| Poteter | 1000 g | Poteter 1,5 kg | – | kjent |
| Salt og pepper | 15 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: lam. Råvaretagger fra varene: lam.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Del kålen i båter. Legg kjøtt og kål lagvis i en vid gryte, med salt og hel pepper mellom lagene. Hell på vann til det står et stykke opp i gryta, og la det småkoke under lokk i ca. 2 timer, til kjøttet slipper beinet. Kok poteter og server sammen med kraften.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 33. Lys lapskaus med flesk (`lapskaus`)

Opphav: egen, status utkast. Tid: 70 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Sideflesk | 400 g | Sideflesk 500 g | – | kjent |
| Poteter | 1000 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 400 g | Gulrot 1 kg | – | kjent |
| Kålrot | 400 g | Kålrot 1 kg | – | kjent |
| Purre | 200 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: svin. Råvaretagger fra varene: svin.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Skjær flesket i terninger og la det koke i lettsaltet vann i 20 min. Skrell og del poteter, gulrot og kålrot i terninger, og hakk løk og purre. Ha grønnsakene i gryta og kok videre til potetene blir møre og noe av dem koker ut, ca. 30 min. Smak til med salt og pepper.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 34. Pølsegryte med ris (`polsegryte`)

Opphav: egen, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kjøttpølse | 500 g | Kjøttpølse 500 g | gluten, melk | **uavklart** |
| Hakkede tomater | 400 g | Hakkede tomater 400 g | – | kjent |
| Matfløte | 200 ml | Matfløte 300 ml | melk | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk
- Samlet fra varene: gluten, melk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: svin. Råvaretagger fra varene: storfe, svin.
- Uavklart eller uten merking: Kjøttpølse, Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Sett ris på koking. Skjær pølse, løk og paprika i biter og stek dem i en gryte. Tilsett tomat og fløte og la det putre i 10 min. Server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 35. Pytt i panne med speilegg (`pyttipanne`)

Opphav: egen, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Poteter | 1000 g | Poteter 1,5 kg | – | kjent |
| Kjøttpølse | 400 g | Kjøttpølse 500 g | gluten, melk | **uavklart** |
| Løk | 2 stk | Gul løk 3-pk | – | kjent |
| Egg | 4 stk | Egg 12 stk | egg | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk, egg
- Samlet fra varene: gluten, melk, egg
- Ikke merket (kontroller at ingen av disse finnes i retten): fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: svin. Råvaretagger fra varene: storfe, svin.
- Uavklart eller uten merking: Kjøttpølse, Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok potetene nesten møre, eller bruk kokte poteter fra dagen før. Skjær poteter, pølse og løk i små terninger. Stek alt i en stor panne til potetene får farge, ca. 15 min. Stek speilegg og legg på toppen.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 36. Ovnsbakte kyllinglår med søtpotet (`kyllinglar`)

Opphav: egen, status utkast. Tid: 50 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kyllinglår (med ben, uten skinn) | 1200 g | Kyllinglår 1 kg | – | kjent |
| Søtpotet | 800 g | Søtpotet 800 g | – | kjent |
| Brokkoli | 300 g | Brokkoli 400 g | – | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: kylling. Råvaretagger fra varene: kylling.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Skjær søtpotet i båter og vend dem i olje, salt og pepper. Legg kyllinglår og søtpotet i en langpanne og bak i ca. 40 min på 200 °C. Legg brokkoli i langpanna de siste 10 minuttene. Kjøttet er ferdig når kjøttsaften er klar ved beinet.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 37. Kylling i fløtesaus med purre (`kyllingpurre`)

Opphav: egen, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kyllingfilet | 500 g | Kyllingfilet 600 g | – | kjent |
| Purre | 300 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Matfløte | 300 ml | Matfløte 300 ml | melk | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk
- Samlet fra varene: melk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: kylling. Råvaretagger fra varene: kylling.
- Uavklart eller uten merking: Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Sett ris på koking. Skjær kylling i biter og brun dem i en gryte. Tilsett purre og gulrot i skiver og stek et par minutter. Hell på fløte og la det putre i 10 min, til kyllingen er gjennomstekt.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 38. Kyllingsuppe med grønnsaker (`kyllingsuppe`)

Opphav: egen, status utkast. Tid: 40 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kyllingfilet | 400 g | Kyllingfilet 600 g | – | kjent |
| Poteter | 500 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Purre | 200 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Salt og pepper | 10 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: kylling. Råvaretagger fra varene: kylling.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok opp ca. 1,5 liter vann med salt. Ha i kylling i biter, løk og poteter og gulrot i terninger, og la det småkoke i 20 min. Tilsett purre i ringer og kok 5 min til. Smak til med salt og pepper.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 39. Søtpotetsuppe med kikerter (`sotpotetsuppe`)

Opphav: egen, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Søtpotet | 800 g | Søtpotet 800 g | – | kjent |
| Kikerter (hermetiske) | 400 g | Kikerter 400 g | – | kjent |
| Kokosmelk | 400 ml | Kokosmelk 400 ml | – | **uavklart** |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: belgvekster. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: Kokosmelk, Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Fres hakket løk i olje. Ha i søtpotet og gulrot i terninger og vann så det dekker, og kok til alt er mørt, ca. 20 min. Kjør suppa jevn med kokosmelk. Vend inn avrente kikerter, varm opp og smak til.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 40. Fiskegrateng (`fiskegrateng`)

Opphav: egen, status utkast. Tid: 60 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Hysefilet | 500 g | Hysefilet 400 g | fisk | kjent |
| Pasta | 250 g | Spagetti 500 g | gluten | kjent |
| Melk | 600 ml | Lettmelk 1 l | melk | kjent |
| Hvetemel | 60 g | Hvetemel 1 kg | gluten | kjent |
| Egg | 2 stk | Egg 12 stk | egg | kjent |
| Ost | 100 g | Norvegia 400 g | melk | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk, egg, fisk
- Samlet fra varene: gluten, melk, egg, fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok pastaen litt kortere enn pakken sier. Lag en jevning: varm olje og mel, spe med melk og kok til en tykk saus. Avkjøl litt og rør inn eggene. Legg pasta og fisk i biter i en smurt form og hell sausen over. Strø over revet ost og bak i ca. 35 min på 200 °C.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 41. Ovnsbakt laks med poteter og purre (`ovnslaks`)

Opphav: egen, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Laks | 600 g | Laksefilet 400 g | fisk | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Purre | 300 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): fisk
- Samlet fra varene: fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Del poteter i båter og bak dem med olje og salt i 15 min på 220 °C. Legg purre i skiver og laks i stykker over potetene. Bak 12–15 min til, til laksen så vidt er gjennomstekt.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 42. Kokt torsk med poteter og gulrøtter (`kokttorsk`)

Opphav: egen, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Torsk | 700 g | Torskefilet 400 g | fisk | kjent |
| Poteter | 900 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 400 g | Gulrot 1 kg | – | kjent |
| Salt og pepper | 30 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): fisk
- Samlet fra varene: fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter og gulrøtter. Kok opp vann med godt med salt, legg i torsken i stykker og trekk gryta av platen. La fisken trekke i 6–8 min, til den flaker seg. Server med poteter og gulrøtter.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 43. Seibiff med løk (`seibiff`)

Opphav: egen, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Seifilet | 700 g | Seifilet 400 g | fisk | kjent |
| Løk | 3 stk | Gul løk 3-pk | – | kjent |
| Poteter | 900 g | Poteter 1,5 kg | – | kjent |
| Hvetemel | 40 g | Hvetemel 1 kg | gluten | kjent |
| Matolje | 40 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, fisk
- Samlet fra varene: gluten, fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter. Skjær løk i skiver og stek den myk og gyllen, og ta den ut av panna. Vend seistykkene i mel med salt og pepper og stek dem 3–4 min på hver side. Legg løken over og la det småkoke med en skvett vann i 2–3 min.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 44. Fiskegryte med tomat og paprika (`fiskegryte`)

Opphav: egen, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Torsk | 500 g | Torskefilet 400 g | fisk | kjent |
| Hakkede tomater | 800 g | Hakkede tomater 400 g | – | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): fisk
- Samlet fra varene: fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Sett ris på koking. Fres løk og paprika i olje. Tilsett tomat og la det putre i 10 min. Legg i fisken i biter og la den trekke under lokk i 6–8 min.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 45. Hyse i fløtesaus med purre (`hysepurre`)

Opphav: egen, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Hysefilet | 600 g | Hysefilet 400 g | fisk | kjent |
| Purre | 300 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Matfløte | 300 ml | Matfløte 300 ml | melk | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk, fisk
- Samlet fra varene: melk, fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter. Skjær purre i ringer og la den surre myk i en vid panne. Hell på fløte og kok opp. Legg fisken i sausen og la den trekke under lokk i 6–8 min.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 46. Fiskekaker med ertestuing (`fiskekakererter`)

Opphav: egen, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Fiskekaker | 500 g | Fiskekaker 500 g | gluten, melk, egg, fisk | **uavklart** |
| Grønne erter (frosne) | 400 g | Grønne erter, frosne 450 g | – | kjent |
| Melk | 400 ml | Lettmelk 1 l | melk | kjent |
| Hvetemel | 40 g | Hvetemel 1 kg | gluten | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk, egg, fisk
- Samlet fra varene: gluten, melk, egg, fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Fiskekaker, Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter. Lag en hvit saus: varm olje og mel, spe med melk og kok i 5 min. Ha i ertene og varm dem i sausen. Stek eller varm fiskekakene.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 47. Chili con carne (`chili`)

Opphav: egen, status utkast. Tid: 45 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kjøttdeig | 500 g | Kjøttdeig 400 g; Kjøttdeig 800 g | – | kjent |
| Kidneybønner | 400 g | Kidneybønner 400 g | – | kjent |
| Hakkede tomater | 800 g | Hakkede tomater 400 g | – | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: storfe. Råvaretagger fra varene: belgvekster, storfe.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Brun kjøttdeigen med hakket løk og paprika. Tilsett tomat, bønner og chili eller krydder etter smak. La det småkoke i 25 min. Server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 48. Kjøttdeigform med potetmos (`kjottdeigform`)

Opphav: egen, status utkast. Tid: 60 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kjøttdeig | 500 g | Kjøttdeig 400 g; Kjøttdeig 800 g | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Tomatpuré | 70 g | Tomatpuré 140 g | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Poteter | 1000 g | Poteter 1,5 kg | – | kjent |
| Melk | 200 ml | Lettmelk 1 l | melk | kjent |
| Ost | 100 g | Norvegia 400 g | melk | kjent |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk
- Samlet fra varene: melk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: storfe. Råvaretagger fra varene: storfe.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter. Brun kjøttdeig med hakket løk og revet gulrot, rør inn tomatpuré og litt vann og la det koke i 10 min. Mos potetene med varm melk og salt. Ha kjøttsausen i en form, legg mosen over, strø over ost og bak i 20 min på 200 °C.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 49. Kålgryte med kjøttdeig og ris (`kalgryte`)

Opphav: egen, status utkast. Tid: 40 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kjøttdeig | 500 g | Kjøttdeig 400 g; Kjøttdeig 800 g | – | kjent |
| Hodekål | 600 g | Hodekål 1 stk (ca. 1,2 kg) | – | kjent |
| Hakkede tomater | 400 g | Hakkede tomater 400 g | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: storfe. Råvaretagger fra varene: storfe.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Sett ris på koking. Brun kjøttdeig og løk. Tilsett kål i strimler og tomat, og la det småkoke under lokk i 15 min, til kålen er myk. Smak til og server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 50. Svinefilet med søtpotet og brokkoli (`svinefilet`)

Opphav: egen, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Svinefilet | 600 g | Svinefilet 600 g | – | kjent |
| Søtpotet | 800 g | Søtpotet 800 g | – | kjent |
| Brokkoli | 300 g | Brokkoli 400 g | – | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: svin. Råvaretagger fra varene: svin.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Del søtpotet i biter og bak dem med olje og salt i 25 min på 200 °C. Brun svinefileten på alle sider i en panne. Legg den i langpanna de siste 12–15 minuttene, sammen med brokkoli. La kjøttet hvile i 5 min før du skjærer det.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 51. Svinefilet i fløtesaus med sopp (`svinesopp`)

Opphav: egen, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Svinefilet | 600 g | Svinefilet 600 g | – | kjent |
| Sjampinjong | 250 g | Sjampinjong 250 g | – | kjent |
| Matfløte | 300 ml | Matfløte 300 ml | melk | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk
- Samlet fra varene: melk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: svin. Råvaretagger fra varene: svin.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter. Skjær svinefileten i medaljonger og stek dem 2–3 min på hver side, og ta dem ut. Stek sopp i samme panne, hell på fløte og kok opp. Legg kjøttet tilbake og la det trekke i 5 min.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 52. Lammedeig med kikerter og tomat (`lammekikert`)

Opphav: egen, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Lammekjøttdeig | 500 g | Lammekjøttdeig 400 g | – | kjent |
| Kikerter (hermetiske) | 400 g | Kikerter 400 g | – | kjent |
| Hakkede tomater | 400 g | Hakkede tomater 400 g | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: lam. Råvaretagger fra varene: belgvekster, lam.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Sett ris på koking. Brun lammedeig og løk. Tilsett tomat og kikerter og la det putre i 15 min. Server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 53. Bønnetaco (`vegtaco`)

Opphav: egen, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kidneybønner | 400 g | Kidneybønner 400 g | – | kjent |
| Mais | 200 g | Mais 200 g | – | kjent |
| Tortillalefser | 8 stk | Tortillalefser 8 stk | gluten | **uavklart** |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Ost | 150 g | Norvegia 400 g | melk | kjent |
| Rømme | 200 ml | Rømme 300 ml | melk | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk
- Samlet fra varene: gluten, melk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: belgvekster. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: Tortillalefser, Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Varm bønnene med litt olje og tacokrydder etter smak, og mos dem lett. Del opp paprika og varm maisen. Sett frem med lefser, ost og rømme.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 54. Ovnsomelett med poteter og spinat (`frittata`)

Opphav: egen, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Egg | 8 stk | Egg 12 stk | egg | kjent |
| Poteter | 500 g | Poteter 1,5 kg | – | kjent |
| Spinat | 150 g | Spinat 200 g | – | kjent |
| Ost | 100 g | Norvegia 400 g | melk | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk, egg
- Samlet fra varene: melk, egg
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: egg. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok potetene, eller bruk kokte poteter, og skjær dem i skiver. Stek løk og poteter i en ildfast panne, og vend inn spinat. Pisk egg med salt og hell over, og strø over ost. Stek på svak varme i 5 min og bak ferdig i ovnen i ca. 10 min på 200 °C.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 55. Tofu i kokoskarri med ris (`tofukarri`)

Opphav: egen, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Tofu | 400 g | Tofu naturell 400 g | soya | kjent |
| Kokosmelk | 400 ml | Kokosmelk 400 ml | – | **uavklart** |
| Brokkoli | 300 g | Brokkoli 400 g | – | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): soya
- Samlet fra varene: soya
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: tofu. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: Kokosmelk, Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Sett ris på koking. Stek tofu i terninger gyllen. Tilsett paprika, brokkoli, karri og kokosmelk, og la det putre i 8 min. Server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 56. Kremet soppsuppe (`soppsuppe`)

Opphav: egen, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Sjampinjong | 500 g | Sjampinjong 250 g | – | kjent |
| Poteter | 300 g | Poteter 1,5 kg | – | kjent |
| Matfløte | 300 ml | Matfløte 300 ml | melk | kjent |
| Melk | 400 ml | Lettmelk 1 l | melk | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk
- Samlet fra varene: melk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: sopp. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Fres hakket løk og sopp i skiver i en gryte. Ha i poteter i små terninger og melk, og la det småkoke i 15 min. Rør inn fløte, og kjør gjerne halve suppa jevn. Smak til med salt og pepper.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 57. Gul ertesuppe med rotgrønnsaker (`ertesuppe`)

Opphav: egen, status utkast. Tid: 120 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Gule erter (tørre) | 400 g | Gule erter, tørre 500 g | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Kålrot | 300 g | Kålrot 1 kg | – | kjent |
| Poteter | 400 g | Poteter 1,5 kg | – | kjent |
| Purre | 200 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Salt og pepper | 10 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: belgvekster. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Skyll ertene, kok dem opp i ca. 1,5 liter vann og skum av. La ertene småkoke under lokk i ca. 1 time, til de begynner å gå i stykker. Rør av og til og spe med vann om det trengs. Ha i poteter, gulrot og kålrot i terninger og hakket løk, og kok i 25 min til. Ha i purre i ringer de siste 5 minuttene og smak til med salt og pepper. Ertene kan bløtlegges natten før; da går kokingen raskere.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 58. Spinatsuppe med egg (`spinatsuppe`)

Opphav: egen, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Spinat | 400 g | Spinat 200 g | – | kjent |
| Poteter | 400 g | Poteter 1,5 kg | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Melk | 700 ml | Lettmelk 1 l | melk | kjent |
| Egg | 6 stk | Egg 12 stk | egg | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk, egg
- Samlet fra varene: melk, egg
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: egg. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok eggene i 9 min, avkjøl dem i kaldt vann og del dem i to. Fres hakket løk i olje, ha i poteter i små terninger og melk, og la det småkoke på svak varme i 15 min, til potetene er møre. Ha i spinaten, la den falle sammen og kjør suppa jevn. Smak til med salt og pepper og server med eggene i suppa.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 59. Blomkål- og brokkoligrateng (`blomkalgrateng`)

Opphav: egen, status utkast. Tid: 50 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Blomkål | 600 g | Blomkål 1 stk (ca. 600 g) | – | kjent |
| Brokkoli | 400 g | Brokkoli 400 g | – | kjent |
| Egg | 4 stk | Egg 12 stk | egg | kjent |
| Melk | 300 ml | Lettmelk 1 l | melk | kjent |
| Ost | 200 g | Norvegia 400 g | melk | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk, egg
- Samlet fra varene: melk, egg
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: ost. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter. Del blomkål og brokkoli i buketter, forkok dem i 3 min i lettsaltet vann og la dem renne godt av. Legg grønnsakene i en ildfast form. Pisk egg, melk og halvparten av den revne osten, og hell det over. Strø over resten av osten og bak i ca. 30 min på 200 °C, til gratengen har stivnet og fått farge.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 60. Stekt ris med tofu og egg (`tofuris`)

Opphav: egen, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Tofu | 400 g | Tofu naturell 400 g | soya | kjent |
| Egg | 4 stk | Egg 12 stk | egg | kjent |
| Grønne erter (frosne) | 200 g | Grønne erter, frosne 450 g | – | kjent |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |
| Soyasaus | 40 ml | Soyasaus 150 ml | gluten, soya | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, egg, soya
- Samlet fra varene: gluten, egg, soya
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, fisk, skalldyr, bløtdyr, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: tofu. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: Matolje.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok risen og la den dampe av, eller bruk kokt ris fra dagen før. Stek tofu i terninger gyllen i olje og ta den ut av panna. Stek revet gulrot og erter et par minutter, skyv dem til side og rør eggene raskt sammen i panna. Ha i risen og tofuen, hell over soyasaus og stek alt sammen i 3–4 min.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 61. Tomatsuppe med bønner og grønnsaker (`bonnesuppe`)

Opphav: egen, status utkast. Tid: 30 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kidneybønner | 400 g | Kidneybønner 400 g | – | kjent |
| Hakkede tomater | 800 g | Hakkede tomater 400 g | – | kjent |
| Poteter | 300 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |
| Purre | 200 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: belgvekster. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Fres hakket løk i olje i en gryte. Ha i poteter og gulrot i små terninger, tomat og 5 dl vann, og la det småkoke i 15 min. Ha i avrente bønner og purre i ringer og kok 5 min til. Smak til med salt og pepper.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 62. Byggotto med sopp (`byggotto`)

Opphav: egen, status utkast. Tid: 45 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Byggryn | 300 g | Byggryn 600 g | gluten | kjent |
| Sjampinjong | 400 g | Sjampinjong 250 g | – | kjent |
| Grønne erter (frosne) | 200 g | Grønne erter, frosne 450 g | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Ost | 100 g | Norvegia 400 g | melk | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 10 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk
- Samlet fra varene: gluten, melk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: sopp. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Fres hakket løk og byggryn i olje i et par minutter. Spe med ca. 1 liter varmt, lettsaltet vann, litt om gangen, og la det småkoke i ca. 30 min under omrøring, til grynene er møre. Stek sopp i skiver gyllen i en panne. Vend sopp, erter og revet ost inn i grynene og smak til.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 63. Ovnsbakte rotgrønnsaker med kikerter (`rotgronnsaker`)

Opphav: egen, status utkast. Tid: 45 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Søtpotet | 800 g | Søtpotet 800 g | – | kjent |
| Gulrot | 400 g | Gulrot 1 kg | – | kjent |
| Kålrot | 400 g | Kålrot 1 kg | – | kjent |
| Kikerter (hermetiske) | 800 g | Kikerter 400 g | – | kjent |
| Løk | 2 stk | Gul løk 3-pk | – | kjent |
| Matolje | 40 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: belgvekster. Råvaretagger fra varene: belgvekster.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Skjær søtpotet, gulrot og kålrot i biter og løk i båter. Vend grønnsakene i olje, salt og pepper og bak dem i en langpanne i 20 min på 220 °C. Ha i avrente kikerter, rør om og bak 15 min til, til grønnsakene er møre og har fått farge.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 64. Pasta med brokkoli, erter og ost (`brokkolipasta`)

Opphav: egen, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Pasta | 400 g | Spagetti 500 g | gluten | kjent |
| Brokkoli | 400 g | Brokkoli 400 g | – | kjent |
| Grønne erter (frosne) | 200 g | Grønne erter, frosne 450 g | – | kjent |
| Matfløte | 200 ml | Matfløte 300 ml | melk | kjent |
| Ost | 150 g | Norvegia 400 g | melk | kjent |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk
- Samlet fra varene: gluten, melk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: ost. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok pasta etter anvisning på pakken, og ha brokkolibuketter og erter i kjelen de siste 3 minuttene. Hell av vannet. Rør inn fløte og revet ost, varm forsiktig til osten smelter og smak til med salt og pepper.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 65. Potet- og purresuppe (`purresuppe`)

Opphav: egen, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Purre | 600 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Melk | 500 ml | Lettmelk 1 l | melk | kjent |
| Matfløte | 300 ml | Matfløte 300 ml | melk | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 10 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk
- Samlet fra varene: melk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: ja. Hovedprotein: grønnsaker. Råvaretagger fra varene: ingen.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Fres hakket løk og purre i ringer i olje på svak varme, uten at det tar farge. Ha i poteter i terninger og 5 dl vann med salt, og kok til potetene er helt møre, ca. 20 min. Hell i melk og fløte, varm opp og kjør suppa jevn. Smak til med salt og pepper.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 66. Plukkfisk (`plukkfisk`)

Opphav: egen, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Seifilet | 600 g | Seifilet 400 g | fisk | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Melk | 500 ml | Lettmelk 1 l | melk | kjent |
| Hvetemel | 40 g | Hvetemel 1 kg | gluten | kjent |
| Purre | 100 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk, fisk
- Samlet fra varene: gluten, melk, fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter og skjær dem i terninger. La fisken trekke i lettsaltet vann i 5–6 min og del den i flak. Varm olje og mel i en gryte, spe med melk litt om gangen og kok til en jevn saus i 5 min. Vend fisk, poteter og purre i tynne ringer forsiktig inn i sausen. Server med revet gulrot.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 67. Fiskeboller i hvit saus (`fiskeboller`)

Opphav: egen, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Fiskeboller (hermetiske) | 560 g | Fiskeboller, hermetiske 560 g (avrent) | melk, fisk | **uavklart** |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 400 g | Gulrot 1 kg | – | kjent |
| Melk | 400 ml | Lettmelk 1 l | melk | kjent |
| Hvetemel | 40 g | Hvetemel 1 kg | gluten | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk, fisk
- Samlet fra varene: gluten, melk, fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Fiskeboller (hermetiske), Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter og gulrøtter. Hell av laken fra fiskebollene, men ta vare på ca. 2 dl. Varm olje og mel, spe med lake og melk og kok sausen jevn i 5 min. Legg fiskebollene i sausen og varm dem forsiktig.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 68. Pasta med tunfisk, mais og tomat (`tunfiskpasta`)

Opphav: egen, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Pasta | 400 g | Spagetti 500 g | gluten | kjent |
| Tunfisk i vann (hermetisk) | 370 g | Tunfisk i vann 185 g | fisk | kjent |
| Hakkede tomater | 400 g | Hakkede tomater 400 g | – | kjent |
| Mais | 200 g | Mais 200 g | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, fisk
- Samlet fra varene: gluten, fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok pasta etter anvisning på pakken. Fres hakket løk i olje, ha i tomat og la det putre i 5 min. Vend inn avrent tunfisk og mais og varm alt. Bland sausen med pastaen.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 69. Stekt laks med poteter og erter (`stektlaks`)

Opphav: egen, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Laks | 600 g | Laksefilet 400 g | fisk | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Grønne erter (frosne) | 300 g | Grønne erter, frosne 450 g | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): fisk
- Samlet fra varene: fisk
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: fisk. Råvaretagger fra varene: fisk.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter. Strø salt og pepper på laksestykkene og stek dem med skinnsiden ned i 4 min. Snu og stek 2–3 min til. Kok ertene i 2–3 min. Server sammen.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 70. Rekewok med ris (`rekewok`)

Opphav: egen, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Reker, skallfrie | 300 g | Reker, skallfrie 300 g | skalldyr | **uavklart** |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Brokkoli | 300 g | Brokkoli 400 g | – | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): skalldyr
- Samlet fra varene: skalldyr
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: skalldyr. Råvaretagger fra varene: skalldyr.
- Uavklart eller uten merking: Reker, skallfrie, Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Sett ris på koking. Wok brokkoli, paprika og gulrot i strimler i olje på sterk varme i 4–5 min. Vend inn rekene til de er varme, og smak til med salt og pepper. Server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 71. Kjøttsuppe med rotgrønnsaker (`kjottsuppe`)

Opphav: egen, status utkast. Tid: 150 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Grytekjøtt av storfe (i terninger) | 600 g | Grytekjøtt av storfe 600 g | – | kjent |
| Poteter | 600 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 400 g | Gulrot 1 kg | – | kjent |
| Kålrot | 400 g | Kålrot 1 kg | – | kjent |
| Purre | 200 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Salt og pepper | 15 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: storfe. Råvaretagger fra varene: storfe.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Legg kjøttet i en gryte med ca. 2 liter kaldt vann og salt, kok opp og skum godt. La det småkoke under lokk i ca. 1,5 time, til kjøttet er mørt. Ha i poteter, gulrot, kålrot og løk i terninger og kok i 20 min til. Ha i purre i ringer de siste 5 minuttene og smak til med salt og pepper.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 72. Brun lapskaus (`brunlapskaus`)

Opphav: egen, status utkast. Tid: 120 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Grytekjøtt av storfe (i terninger) | 600 g | Grytekjøtt av storfe 600 g | – | kjent |
| Poteter | 1000 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 300 g | Gulrot 1 kg | – | kjent |
| Kålrot | 300 g | Kålrot 1 kg | – | kjent |
| Løk | 2 stk | Gul løk 3-pk | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 10 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: storfe. Råvaretagger fra varene: storfe.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Brun kjøttet i små terninger i olje, litt om gangen, til det har fått godt med farge. Ha i hakket løk og vann så det så vidt dekker, og la det småkoke under lokk i ca. 1 time. Ha i poteter, gulrot og kålrot i terninger og kok i 30–40 min til, til noe av potetene koker ut og gjør lapskausen tykk. Smak til med salt og pepper.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 73. Karbonader med løk og poteter (`karbonader`)

Opphav: egen, status utkast. Tid: 35 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kjøttdeig | 600 g | Kjøttdeig 400 g; Kjøttdeig 800 g | – | kjent |
| Løk | 3 stk | Gul løk 3-pk | – | kjent |
| Poteter | 1000 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 400 g | Gulrot 1 kg | – | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: storfe. Råvaretagger fra varene: storfe.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter og gulrøtter. Form kjøttdeigen til 8 flate karbonader med våte hender, og stek dem 3–4 min på hver side. Stek løk i skiver myk og gyllen i samme panne. Hell en skvett vann i panna, la det koke opp og server løk og skysaus over karbonadene.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 74. Lasagne med kjøttdeig (`lasagne`)

Opphav: egen, status utkast. Tid: 80 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Lasagneplater | 250 g | Lasagneplater 500 g | gluten | **uavklart** |
| Kjøttdeig | 500 g | Kjøttdeig 400 g; Kjøttdeig 800 g | – | kjent |
| Hakkede tomater | 800 g | Hakkede tomater 400 g | – | kjent |
| Tomatpuré | 70 g | Tomatpuré 140 g | – | kjent |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Melk | 700 ml | Lettmelk 1 l | melk | kjent |
| Hvetemel | 50 g | Hvetemel 1 kg | gluten | kjent |
| Ost | 150 g | Norvegia 400 g | melk | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk
- Samlet fra varene: gluten, melk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: storfe. Råvaretagger fra varene: storfe.
- Uavklart eller uten merking: Lasagneplater, Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Brun kjøttdeig med hakket løk og revet gulrot, rør inn tomat og tomatpuré og la sausen småkoke i 15 min. Lag en hvit saus: varm olje og mel, spe med melk litt om gangen og kok i 5 min. Legg kjøttsaus, plater og hvit saus lagvis i en ildfast form, og avslutt med hvit saus. Strø over revet ost og bak i ca. 40 min på 200 °C. La lasagnen hvile litt før servering.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 75. Hel kylling i ovn med rotgrønnsaker (`helkylling`)

Opphav: egen, status utkast. Tid: 100 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Hel kylling | 1200 g | Hel kylling ca. 1,2 kg | – | kjent |
| Poteter | 1000 g | Poteter 1,5 kg | – | kjent |
| Gulrot | 400 g | Gulrot 1 kg | – | kjent |
| Løk | 2 stk | Gul løk 3-pk | – | kjent |
| Matolje | 30 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 10 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: kylling. Råvaretagger fra varene: kylling.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Gni kyllingen inn med olje, salt og pepper og legg den i en langpanne. Del poteter, gulrot og løk i biter, vend dem i olje og salt og legg dem rundt kyllingen. Stek i ca. 1 time og 15 min på 200 °C. Kyllingen er ferdig når kjøttsaften er klar ved låret. La kyllingen hvile i 10 min før den deles.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 76. Kyllinglår i tomatgryte med bønner (`kyllinggryte`)

Opphav: egen, status utkast. Tid: 75 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kyllinglår (med ben, uten skinn) | 1000 g | Kyllinglår 1 kg | – | kjent |
| Hakkede tomater | 800 g | Hakkede tomater 400 g | – | kjent |
| Kidneybønner | 400 g | Kidneybønner 400 g | – | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: kylling. Råvaretagger fra varene: belgvekster, kylling.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Brun kyllinglårene i olje i en vid gryte og ta dem ut. Fres løk og paprika i samme gryte, ha i tomat og legg kyllingen tilbake. La det småkoke under lokk i ca. 45 min, til kjøttet slipper beinet. Ha i avrente bønner de siste 10 minuttene. Kok ris og server sammen.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 77. Kyllingwraps med grønnsaker (`kyllingwrap`)

Opphav: egen, status utkast. Tid: 20 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Kyllingfilet | 500 g | Kyllingfilet 600 g | – | kjent |
| Tortillalefser | 8 stk | Tortillalefser 8 stk | gluten | **uavklart** |
| Paprika | 2 stk | Paprika 3-pk | – | kjent |
| Mais | 200 g | Mais 200 g | – | kjent |
| Spinat | 100 g | Spinat 200 g | – | kjent |
| Rømme | 200 ml | Rømme 300 ml | melk | kjent |
| Matolje | 15 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): gluten, melk
- Samlet fra varene: gluten, melk
- Ikke merket (kontroller at ingen av disse finnes i retten): egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: kylling. Råvaretagger fra varene: kylling.
- Uavklart eller uten merking: Tortillalefser, Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Skjær kyllingen i strimler, strø over salt og pepper og stek den gjennom i olje, ca. 6–8 min. Strimle paprika og varm maisen. Varm lefsene i en tørr panne. Fyll lefsene med kylling, grønnsaker, spinat og rømme, og rull dem sammen.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 78. Kålruletter i tomatsaus (`kalruletter`)

Opphav: egen, status utkast. Tid: 75 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Hodekål | 800 g | Hodekål 1 stk (ca. 1,2 kg) | – | kjent |
| Svinekjøttdeig | 400 g | Svinekjøttdeig 400 g | – | kjent |
| Ris | 100 g | Jasminris 1 kg | – | kjent |
| Egg | 1 stk | Egg 12 stk | egg | kjent |
| Løk | 1 stk | Gul løk 3-pk | – | kjent |
| Hakkede tomater | 800 g | Hakkede tomater 400 g | – | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): egg
- Samlet fra varene: egg
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: svin. Råvaretagger fra varene: svin.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok risen og la den bli kald. Skjær ut stilken og kok kålhodet i lettsaltet vann i 5 min, til de ytterste bladene løsner. Ta av ca. 12 blader. Bland svinekjøttdeig, ris, egg, revet løk, salt og pepper. Legg en skje fyll på hvert blad og rull sammen. Legg rulettene tett i en form, hell over tomat og bak dem tildekket i ca. 45 min på 180 °C. Server med kokte poteter.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 79. Lammegryte med kålrot og gulrot (`lammegryte`)

Opphav: egen, status utkast. Tid: 120 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Fårikålkjøtt (lam, med ben) | 1500 g | Fårikålkjøtt 1,5 kg | – | kjent |
| Kålrot | 500 g | Kålrot 1 kg | – | kjent |
| Gulrot | 400 g | Gulrot 1 kg | – | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Løk | 2 stk | Gul løk 3-pk | – | kjent |
| Tomatpuré | 70 g | Tomatpuré 140 g | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 10 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: lam. Råvaretagger fra varene: lam.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Brun kjøttet i olje i en vid gryte, litt om gangen. Ha i hakket løk og tomatpuré og stek et minutt. Hell på vann så det nesten dekker kjøttet, og la det småkoke under lokk i ca. 1 time. Ha i kålrot og gulrot i store biter og kok videre i 30–40 min, til kjøttet slipper beinet og grønnsakene er møre. Kok poteter og smak gryta til med salt og pepper.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 80. Eggekake med stekt flesk (`eggekake`)

Opphav: egen, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Egg | 10 stk | Egg 12 stk | egg | kjent |
| Melk | 300 ml | Lettmelk 1 l | melk | kjent |
| Sideflesk | 300 g | Sideflesk 500 g | – | kjent |
| Purre | 100 g | Purre 1 stk (ca. 300 g) | – | kjent |
| Poteter | 800 g | Poteter 1,5 kg | – | kjent |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): melk, egg
- Samlet fra varene: melk, egg
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: egg. Råvaretagger fra varene: svin.
- Uavklart eller uten merking: Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Kok poteter. Stek flesket i skiver sprøtt i en stor panne og ta det ut. Hell av det meste av fettet. Pisk egg, melk og salt lett sammen, hell det i panna og la det stivne under lokk på svak varme, ca. 10 min. Ikke rør. Legg flesket og purre i tynne ringer over og server rett fra panna med poteter.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):

### 81. Svinefilet i wok med grønnsaker og ris (`svinefiletwok`)

Opphav: egen, status utkast. Tid: 25 min. Mengdene gjelder 4 porsjoner.

| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |
| --- | --- | --- | --- | --- |
| Svinefilet | 500 g | Svinefilet 600 g | – | kjent |
| Ris | 300 g | Jasminris 1 kg | – | kjent |
| Brokkoli | 300 g | Brokkoli 400 g | – | kjent |
| Paprika | 1 stk | Paprika 3-pk | – | kjent |
| Gulrot | 200 g | Gulrot 1 kg | – | kjent |
| Matolje | 20 ml | ingen (basisvare uten produkt) | ikke merket | ikke merket |
| Salt og pepper | 5 g | ingen (basisvare uten produkt) | ikke merket | ikke merket |

- **Appens allergener for retten** (det filteret bruker): –
- Samlet fra varene: –
- Ikke merket (kontroller at ingen av disse finnes i retten): gluten, melk, egg, fisk, skalldyr, bløtdyr, soya, peanøtter, nøtter, selleri, sennep, sesam, lupin, svoveldioksid og sulfitt
- **Kosttagger:** vegetar: nei. Hovedprotein: svin. Råvaretagger fra varene: svin.
- Uavklart eller uten merking: Matolje, Salt og pepper.
- Fremgangsmåte (for å se om noe mangler i varelisten): Sett ris på koking. Skjær svinefileten i tynne strimler og stek dem raskt i olje på sterk varme. Ta dem ut. Wok brokkoli, paprika og gulrot i 4–5 min. Vend inn kjøttet, smak til med salt og pepper og server med ris.

**Gjennomgang (fylles ut av en person):**

- Allergener stemmer: [ ] ja  [ ] nei
- Kosttagger stemmer: [ ] ja  [ ] nei
- Kommentar:
- Gjennomgått av (rolle, ikke navn):
- Dato (ÅÅÅÅ-MM-DD):
