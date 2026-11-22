# Fullstendig plan: norsk middagsplanlegger

Nov 21, 2026 · @Mani Radhakrishnan

## Sammendrag

Vi bygger en landsdekkende norsk middagsplanlegger med egen kundeaviskatalog. Familien velger budsjett, middagsdager og butikker, og får en ukeplan, én handlekurv og et anslag på hva hele pakninger koster i én eller to butikker. Hver pris viser kilde, dato og vilkår.

Det som avgjør om produktet lykkes, er prisdata. Kassalapp mangler løpende priser fra Rema 1000, Kiwi og Coop, og tilbud fra kundeaviser krever avtale. Fase 0 er derfor en dataprøve med en tydelig port: uten dokumentert dekning bygger vi ikke videre som planlagt.

Hele Norge kan velges fra første versjon, og prisdekningen vises for hvert område. Prismålene testes i 3–5 pilotområder i by og distrikt før appen markedsføres bredt.

Med 2–3 utviklere og tilgang til produkt- og innholdsarbeid er en brukbar familieversjon klar etter omtrent 5 måneder og bred lansering etter 12–14 måneder. Alle 41 funksjoner med fase og akseptansetest står i en egen fane.

Dokumentet samler *Produkt- og løsningsbeskrivelse for en landsdekkende norsk middagsplanlegger* og byggeplanen, med fire rettelser: fase 0 får to måneder, fase 1 er en webapp, kriteriene for butikksammenligning hører til fase 2, og kundeavisene i fase 1 vises bare slik avtalene tillater.

Alle 41 funksjoner med fase, beskrivelse og akseptansetest: Funksjoner og tester

## Produktløfte, målgruppe og to innganger

**Løftet.** Appen foreslår en uke familien har lyst og tid til å lage, samler ingrediensene i én handlekurv og viser hva hele pakninger anslås å koste. Familien kan sammenligne én handletur med en handel fordelt på to butikker før den velger.

**For hvem.** Primærbrukeren er den som planlegger og handler for husstanden. En annen voksen kan ta handleturen fra samme liste. Aleneboende bruker samme flyt med én porsjon, færre middager og mer gjenbruk av åpnede pakker. De som spiser trenger ikke egne kontoer.

**To innganger til samme handel.** Brukeren kan starte med «Planlegg uka» eller «Kundeaviser», begge tilgjengelige i hele Norge. Den som kjenner budsjettet starter med middager; den som ser et godt fisketilbud starter i avisen og bygger uka rundt det. Hver husstand velger selv område, butikker og maks antall stopp.

## Konkurrenter og fortrinn

Flere norske tjenester dekker deler av ideen, så fortrinnet må bevises i test. Det som skal prøves er om familier foretrekker en handlekurv de kan etterprøve: lokal prisdekning, hele pakninger og synlig gevinst ved en butikk til.

| Tjeneste | Hva den gjør | Hva vi må gjøre bedre |
| --- | --- | --- |
| [Bånn appetitt](https://apps.apple.com/no/app/b%C3%A5nn-appetitt/id6830623007) | Budsjettstyrte middager, butikkvalg, uketilbud, hele pakninger, matskap, delt liste, plan frem til lønning; gratis | Samme meny i én mot to butikker, prisstatus per vare, familieplanlegging per person og dag |
| [Smartevalg](https://smartevalg.no/) | Valgte butikker, ukemeny og tilbud | Pakningsberegning og etterprøvbar sum |
| [Handleklar](https://www.handleklar.no/about) | Middagsforslag fra tilbud hos flere kjeder | Kundeaviser som egen inngang, fra tilbud til ukeplan |
| [CartBrain](https://cartbrain.ca/about) | Matpakker, rester, beholdning, butikkfordelt liste; ingen norsk dekning | Norske data, norsk språk |

Funksjonene Bånn appetitt allerede har er grunnmuren, ikke fortrinnet. Ingen kartlegging bekrefter at kombinasjonen vår er unik.

## Brukerflyt: familien planlegger uka

1. **Start med denne uka.** Forsiden spør hvor mange middager som skal planlegges og hva handelen kan koste. Beløpet gjelder valgte måltider: skal 1 500 kr også dekke frokost og bleier, kan 600 kr reserveres og middagene planlegges innenfor 900 kr.
2. **Velg hvem som spiser.** Etiketter som «Voksen 1» og «Barn 1», justerbare porsjoner og hvem som er hjemme hvilken dag. Kostvalg, råvarer familien unngår, favoritter og allergener, med tydelig skille mellom absolutte krav og preferanser.
3. **Finn butikker.** Postnummer som start, konkrete utsalg og vanlig butikk. Appen viser om prisene gjelder utsalget, regionen eller kjeden. En butikk med for få priser vises med forklaring.
4. **Velg hverdagsrytme.** Dager, tid per dag og faste ønsker, for eksempel maks 20 minutter tirsdag, fri onsdag og låst taco fredag. Forrige ukes innstillinger gjenbrukes, og «Lag min første uke» krever ikke full registrering av matskapet.
5. **Se forslaget.** Dagkort med rett, tid, porsjoner og viktige ingredienser. Øverst: anslått handel, budsjettmargin, antall butikker og hvor mange linjer som har estimert eller ukjent pris.
6. **Endre én middag.** «Bytt til fiskekaker · handelen blir 18 kr dyrere». Forskjellen regnes på hele kurven, så en rett som deler pakning med en annen kan bli billigere å bytte inn.
7. **Godkjenn og handle.** Brukeren velger butikkalternativ og lagrer. Listen er gruppert per butikk og avdeling, med produktnavn, pakning, antall og tilbudsvilkår, og hver vare viser hvilke retter den dekker.

## Kundeaviser fra hele Norge

Kundeavisene er en egen fane som kan åpnes uten konto og før første ukeplan. Katalogen bygges på avtaler og lenker til originalen, ikke på at vi henter avisene selv.

- **Visninger.** «Hele Norge» viser alle registrerte, aktive aviser. «Nær meg» bruker selvvalgt postnummer eller sted. «Mine butikker» viser favorittene. Å bytte område er like enkelt hjemme som på ferie.
- **Hva «alle» betyr.** Målet er én katalog for alle norske kundeaviser. Dagligvarer kobles til middager; andre bransjer kan blas i og filtreres. Katalogen viser faktisk dekning, sist kontrollert, og lar brukeren melde inn en manglende avis.
- **Finn riktig utgave.** Søk på kjede, butikk eller sted; filtrer på bransje, område, denne uka og kommende. Kortet viser avsender, gyldighet og om utgaven er nasjonal, regional eller lokal. Like kjedeutgaver samles; lokale varianter ligger under «Velg utgave».
- **Les og finn tilbake.** Åpne på første eller sist leste side. Der avtalen tillater det kan brukeren bla, zoome og åpne en lesbar tilbudsliste; ellers åpner «Les hos kjeden» originalen.
- **Fra tilbud til middag.** Et koblet tilbud («torsk 400 g») viser butikk, pris, pakning, gyldighet og medlemsvilkår. «Finn middager med torsk», «Bruk i ukeplan» med endring i samlet beløp, og «Legg i handlelista» også uten ukeplan.
- **Når varedata mangler.** Avisen kan leses likevel. Brukeren kan legge inn en manuell linje med henvisning til siden, men den inngår ikke i en beregnet kampanjepris før vare, pris, omfang og vilkår er kontrollert.

**Utgave som egen enhet.** Hver avis har avsender, utgave-ID, periode, geografisk omfang, tilknyttede utsalg, kilde og visningsrett. Sider kobles til null eller flere tilbud. Rettelser lagres med tidspunkt, tilbaketrukne utgaver skjules og berørte planer varsles. Utløpte aviser faller ut av «Denne uka» av seg selv.

**Hele landet, også med hull.** Et postnummer uten lokal utgave får nasjonale aviser og en forklaring. En regional utgave gjelder bare når området dekker valgt utsalg. Å kunne lese en avis betyr ikke at alle varer i butikken kan prises.

**Tester for katalogen.** Samme nasjonale avis for 100 utsalg vises én gang. To lokale utgaver fra samme kjede kan skilles. Søk virker uten posisjonstillatelse. En avis som starter mandag vises som kommende på søndag, men påvirker kurven først når handledagen er innenfor perioden.

**Dekning måles med tre tall:** identifiserte aktive utgaver, utgaver med lovlig lesetilgang og utgaver med varekoblinger, pluss andel prisede handlelinjer per område. Ukjent dekning vises som ukjent.

I fase 1 er katalogen landsdekkende innenfor det avtalene tillater. Tilbud koblet til varer kommer i fase 2, andre bransjer i fase 4.

## Skjermbilder og daglig bruk

| Skjerm | Hva den viser og gjør |
| --- | --- |
| Denne uka | Neste middag, dagene i planen, gjenstående handel og én tydelig handling («Åpne handlelista»). Før første plan: familievalgene. Etter godkjenning: rett til gjeldende uke. |
| Alternativer | Kort for vanlig butikk og beste kombinasjon av valgte butikker, med totalsum, antall stopp, prisdekning og hvilke varer som flyttes: «41 kr lavere varekostnad for samme meny». |
| Oppskrift | Mengder for dagens deltakere, tid, steg, råvarer som finnes hjemme og planlagte resteporsjoner. «Bytt rett» viser prisendring for hele handelen. Egne eller lisensierte oppskrifter og bilder. |
| Handlemodus | Stor tekst og store avkrysningsfelt, «2 × 400 g» og avdeling. To voksne på samme liste; hver avkrysning lagres med egen identitet, og konflikt om antall må bekreftes. |
| Matskapet | Frivillig. Skiller antatt rest, bekreftet kjøp og brukerbekreftet mengde. En kjøpt pakke betyr ikke at retten er laget. Samme vare settes av én gang på tvers av dagene. |
| Når noe endrer seg | Utsolgt vare: velg et annet godkjent produkt eller «fant ikke», se berørte retter og ny kurv. Ved utløpt tilbud beholdes opprinnelig anslag i historikken. |
| Administrasjon | Redaktør kontrollerer oppskrifter, varekoblinger, enheter og allergendata. Driftsansvarlig følger import og dekning per område. Kundestøtte får planreferanse og feildetaljer, med tilgang begrenset til oppgaven. |

Prisstatus skal kunne leses som tekst, også med skjermleser.

## Hva handelen koster

Reglene under er foreslåtte beregningsregler. Tallene i eksemplene er oppdiktet for å vise hvordan reglene testes.

**Fra oppskrift til pakker.** To retter trenger 350 g og 400 g tørr pasta, og familien har 250 g. Nettobehovet er 500 g, så kurven får én pakke på 500 g til 18 kr. Byttes den andre retten til en som trenger 650 g, blir behovet 750 g: to pakker til 36 kr og 250 g i rest.

- Summer mengder på tvers av retter før avrunding.
- Hold rå, kokt og avrent vekt adskilt.
- Regn mellom stykk og gram bare med dokumentert faktor.
- Løsvekt vises som estimert vekt og beløp; pant vises særskilt.

**Én eller to butikker?** Fem middager og budsjett 900 kr. Vanlig butikk alene: 872 kr. To butikker: 831 kr, altså 41 kr lavere varekostnad. Familiens grense for en ekstra butikk er 50 kr, så appen anbefaler én butikk og lar familien velge begge. Reisetid og drivstoff er bare med hvis en senere funksjon faktisk beregner dem.

Samme meny i ulike butikker og alternative menyer innen budsjett vises som to forskjellige handlinger. Ellers kan en tilsynelatende butikkbesparelse egentlig komme av at laks ble byttet mot pasta.

**Tre budsjettsvar:**

| Svar | Når | Hva appen viser |
| --- | --- | --- |
| Anslått innenfor | Alle nødvendige linjer har prisgrunnlag | Totalsum, margin og andel estimerte priser: «Anslått 872 kr av 900 kr» |
| Anslått over | Summen overstiger rammen | Avviket og konkrete grep med ny sum: bytt en middag, bruk noe hjemme, tillat en butikk til; låste retter beholdes |
| Ufullstendig prisgrunnlag | En eller flere linjer mangler pris | Kjent delsum og varene som mangler; kurven kan ikke kåres billigst eller bekreftes innenfor budsjett |

Brukeren kan legge inn egen pris eller bytte til et dokumentert alternativ.

## Planmotoren

Motoren er vanlig beregningskode: samme inndata og prisversjon gir alltid samme kurv, sum og begrunnelse. Den deles mellom server og klient, slik at handlelisten virker offline og en rapportert feil kan gjenskapes.

1. **Filtrer** oppskriftsbanken etter kostkrav, dager, tidsgrense og låste retter. Ved aktivt allergifilter blir en vare med uavklart allergenstatus aldri godkjent erstatning.
2. **Skaler porsjoner** etter hvem som spiser hvilken dag, inkludert matpakker og reserverte rester.
3. **Slå sammen behov** på tvers av retter før avrunding, og trekk fra bekreftet beholdning én gang.
4. **Finn gyldige produkter** i valgte butikker og prøv pakningskombinasjoner mot nettobehovet.
5. **Bruk kampanjeregler** bare når kurven oppfyller vilkårene. Tre pakker for rabatt sammenlignes med én til ordinærpris, og tilbud dateres etter handledagen.
6. **Pris komplette kurver** og sammenlign med budsjettet.
7. **Ranger** gjennomførbare forslag etter familiens valg for pris, antall butikker, tid, variasjon og gjenbruk. En rangering overstyrer aldri en eksplisitt kostbegrensning.
8. **Lagre planversjon** med prisgrunnlag og regelversjon. Bytte gir ny versjon, og brukeren velger om nye priser skal erstatte en allerede godkjent liste.

**Reproduserbar beregning.** Inndata er plan, reservasjoner, beholdning, produktkoblinger, relevante kampanjer, medlemskap, handledato og versjon av prisdata og regler. Utdata er kurv per butikk, budsjettstatus og forklaring per linje. Beløp regnes i øre og mengder i standardenheter, med fast avrunding og en bindende regel ved lik pris. En ny prisimport endrer aldri en aktiv liste uten at brukeren ser det.

**Optimalisering.** Søk blant tillatte butikkombinasjoner med en enkel tommelfingerregel for pakninger, kontrollert mot full gjennomregning på små testkurver. «3 for 2» vurderes som en samlet kampanjegruppe. Terskelen for en ekstra butikk påvirker anbefalingen, men vises adskilt fra utlegget. Teksten er «laveste beregnede pris blant sammenlignede alternativer», aldri et løfte om matematisk beste løsning.

**Faste regresjonstester.** Samme datasett gir samme svar på mobil og server. Testsettet dekker minst:

- delt rispose mellom to retter
- prosenttilbud uten kjent grunnpris
- ulike priser i samme kjede
- samme kjøp mottatt to ganger
- to voksne som krysser av samtidig
- endring mens enheten er frakoblet
- matpakke flyttet før middagen er laget
- gammel prisobservasjon (mer enn 14 dager før handledagen) blir estimat med dato og taper mot en nyere pris

Holdbarhet følger produkt- og oppskriftsspesifikke lagringsregler, ikke én felles grense for all mat.

**KI** brukes først fra fase 3, til å tolke ønsker som «to raske fiskemåltider, men ikke på torsdag», foreslå forklaringer og kladde varekoblinger til redaktøren. Motoren kontrollerer alltid resultatet på nytt.

## Datakilder og leverandørvalg

Ingen enkeltkilde gir ferske priser fra alle store kjeder. Hver pris lagres derfor med kilde, geografisk omfang og dato, slik at appen alltid kan vise hvor sikkert et tall er. Pris på kjedenivå er en annen opplysning enn bekreftet pris i et bestemt utsalg.

| Kilde | Hva den gir | Begrensning | Rolle |
| --- | --- | --- | --- |
| [Kassalapp API](https://kassal.app/api) | Produkter, strekkoder, priser og prishistorikk | Ingen løpende priser fra Rema 1000, Kiwi og Coop; oppdateres én gang i døgnet; kommersiell bruk krever Bedrift-plan, 750 kr/måned eks. mva. | Produktkatalog og ferske priser der den dekker |
| [Tjek](https://tjek.com/apis-and-sdks) (eTilbudsavis, Mattilbud) | API-er og SDK-er for digitale publikasjoner og klikkbare tilbud | Sier ikke at alle kjedenes tilbud kan lisensieres til tredjepart; krever avtale | Tilbud og kundeaviskatalog |
| Direkte avtaler med kjeder og nettbutikker | Ordinærpriser og tilbud per utsalg | Usikkert om kjedene vil, tar tid | Eneste vei til full dekning for Rema, Kiwi og Coop |
| Brukerregistrerte priser og kvitteringer | Faktisk betalt pris, butikk og dato | Historisk observasjon, ofte med personlige rabatter | Fyller hull og måler avvik |
| [Open Prices](https://prices.openfoodfacts.org/api/docs) | Folkefinansierte priser, åpent API | Tynn norsk dekning; lisens må sjekkes | Supplement |
| [Matvaretabellen](https://www.matvaretabellen.no/api/) | Næringsinnhold for generelle matvarer | Gir ikke allergenstatus for en bestemt ferdigvare | Næring på ingrediensnivå, kilde krediteres |

**Prisobservasjoner** lagrer kilde, produkt, pris i øre, pakningsmengde, butikk eller kjede, geografisk omfang, observasjonstid og gyldighet. Status er ordinærpris, tilbud, brukerregistrert pris eller estimat. En historisk pris har dato og blir aldri automatisk dagens tilbud.

**Kampanjeregler** modellerer medlemspris, minimumskjøp, mengdetak, «3 for 2» og kombinasjonskampanjer. «40 % avslag» kan bare regnes når grunnpris, produkt og vilkår er kjent; «3 for 2» krever også hvilke varer som kan kombineres. Mangler noe, kan tilbudet leses i avisen mens beløpet står som uavklart, og ukjente vilkår går til kontroll.

**Valg av leverandør.** Leverandørene vurderes på de samme prøvekurvene: dekning, presisjon i pakninger, observasjonsdato, rettigheter og løpende pris. For hver avtale registreres hvilke visnings- og viderebruksrettigheter den gir. Uteblir en avtale, fortsetter familiene med ordinærpriser med kilde, egne registreringer og originalavisene, og konsekvensen vises per område.

**Oppskrifter.** Vi starter med egne eller lisensierte, kvalitetssikrede oppskrifter. Private brukeroppskrifter og KI-utkast kommer i egne flyter med tydelig opphav. Deling av kvitteringspriser til Open Prices må være et eget, informert valg.

**Dekning måles nasjonalt.** Kjeder, utsalg, kampanjeområder og kilder registreres for hele landet, og representative kurver kontrolleres i alle landsdeler, i by, på småsteder og i distrikt, over minst to kampanjeperioder. Dekning rapporteres per område og kjede, så et landsgjennomsnitt ikke skjuler lokale hull.

## Arkitektur

TypeScript gjennom hele løsningen: React på nett, React Native/Expo for egne apper og PostgreSQL på server. Datatyper, validering og planmotor deles, så alle klienter får samme regnestykke.

&#91;embedded content: arkitektur · 6 deler\]

Fase 1 leveres som én webapp med installerbar handleliste; egne apper kommer i fase 3. Varsler, kamera, deling og lokal lagring er plattformspesifikk kode. En prisleverandør kan byttes uten å skrive om ukeplanen, og KI-svar lagres aldri uten å gå gjennom motoren.

## Datamodell

Modellen skiller ingrediensen «hakkede tomater», produktet «hakkede tomater 400 g» med strekkode, og butikkens pris eller tilbud på produktet. En redaktør godkjenner tillatte alternativer, pakninger og omregninger.

| Objekt | Viktigste felter | Kommentar |
| --- | --- | --- |
| husstand | postnummer, valgte utsalg, vanlig butikk, maks stopp, grense for ekstra butikk | Eier plan, beholdning og liste |
| bruker og medlemskap | konto per voksen, rolle i husstanden | Invitasjon og fjerning må virke på tvers av enheter |
| spiseprofil | etikett («Barn 1»), aldersgruppe, porsjon, dager hjemme | Barn og gjester uten konto |
| måltidsbehov | dag, måltidstype, deltakere, tidsgrense, låst rett | Inkludert matpakker |
| oppskrift og oppskriftslinje | porsjoner, tid, steg, kostmerking, utstyr, lisens |  |
| ingrediens og omregning | enhet, rå/kokt, stk↔g når dokumentert |  |
| produkt og pakning | EAN, navn, mengde, løsvekt, pant, allergenstatus | Samme navn kan ha ulik pakning eller innhold |
| utsalg og sortiment | kjede, adresse, prisområde, varer |  |
| prisobservasjon | se Datakilder | Knyttet til butikk, region eller kjede |
| kampanjeregel | type, vilkår, gyldighet |  |
| avisutgave og side | avsender, periode, omfang, utsalg, kilde, visningsrett |  |
| planrevisjon, måltid, reservasjon | mengde, kilde og mål for hver reservasjon | En brutt reservasjon gir matpakken ny kilde eller merkes uløst |
| beholdningspost, forventet rest, kjøpshendelse, forbruk | holdes adskilt | Varen som går ut først brukes først |
| handlelinje | produkt, antall, butikk, oppskrifter den dekker, pris brukt | Avkrysning lagres per person |

Importer og kjøpsbekreftelser kan mottas to ganger uten doble rader. Det gjør synk etter frakobling og gjentatte importer trygge.

## KI, personvern og kjøpsvilkår

Piloten trenger lite persondata: postnummer, aldersgrupper, etiketter og porsjoner holder. Presis posisjon og barns navn utelates.

- **Behandlingsgrunnlag.** Formål og grunnlag dokumenteres etter GDPR artikkel 6. Når opplysningene avslører helse, trengs i tillegg et unntak etter artikkel 9, for eksempel uttrykkelig samtykke. Et kostfilter kan avsløre helse selv uten diagnose. Det må avklares hvem som kan samtykke for hvert familiemedlem; rollen som kontoeier løser ikke det for alle.
- **Barn.** Aldersgrupper, visningsnavn og porsjonsvalg. Barns profiler brukes aldri til markedsføring.
- **DPIA og leverandører.** Terskelen for vurdering av personvernkonsekvenser dokumenteres, og DPIA gjennomføres før behandlingen hvis den sannsynligvis gir høy risiko eller står på Datatilsynets liste. Roller, databehandleravtaler, underleverandører og eventuelle overføringer avklares.
- **KI og bilder.** Minst mulig kontekst sendes. Irrelevante identifikatorer fjernes fra bilder før ekstern behandling, originalbildet slettes etter bekreftet tolkning med fast slettefrist, og brukeren kan rette eller forkaste forslaget.
- **Brukerens kontroll.** Deling, sletting av konto og data, og eget valg om KI-behandling.
- **Allergisikkerhet.** Appen garanterer aldri at en vare er allergenfri. Uavklart produktstatus sperrer automatisk godkjenning ved relevant allergifilter, og sammensatte ingredienser kontrolleres ved bytte.
- **Priser.** «Anslått» i stedet for løfte om sluttpris, alltid med dato og kilde.
- **Abonnement.** Før bestilling vises pris, prøveperiode, første betalingsdato, fornyelse, oppsigelse og selger. Ansvar og angrerettsflyt kartlegges for hver salgskanal.
- **Rettigheter.** Bare avtalte eller lisensierte aviser, oppskrifter og bilder.

Juridiske punkter bør kvalitetssikres av noen med personvernkompetanse før piloten starter.

## Faseplan

Fem faser over 12–14 måneder. Hver port må være passert før neste fase starter, og fase 0 kan startes uten å skrive kode.

&#91;embedded content: faseplan · 5 faser, 4 porter\]

Anslagene forutsetter 2–3 utviklere med tilgang til produkt- og innholdsarbeid. Avtaler, redaksjonelt arbeid og distribusjon av apper kan flytte datoene. For én person på deltid må tidsplanen lages ut fra tilgjengelige timer.

## Godkjenningskriterier per fase

Ingen fase måles på en funksjon som kommer senere. Måltallene er mål som skal prøves, ikke målt ytelse. Hver funksjon har i tillegg sin egen test i fanen Funksjoner og tester.

**Fase 0 – dataprøve**

- [ ] Kildedekning dokumentert per område og kjede, med mangelliste
- [ ] Ti prøvekurver sammenlignet med faktiske kjøp i ulike landsdeler
- [ ] Prisgrunnlag for en reell prøvehandel
- [ ] Tillatt visningsmåte avklart for hver kundeavis

**Fase 1 – familieversjon**

- [ ] Alle varer har synlig prisstatus
- [ ] To retter som deler én pakning gir én handlelinje
- [ ] Tre beregninger med samme inndata og prisversjon gir lik kurv, sum og begrunnelse
- [ ] Rettbytte bevarer låste retter
- [ ] En familie kan planlegge, endre, handle offline og komme tilbake på nett uten doble kjøp

**Fase 2 – priset kurv**

- [ ] En kurv med ukjent pris vinner aldri butikksammenligningen
- [ ] Utløpte, utilgjengelige og geografisk feil rabatter gir ingen rabatt
- [ ] Prisreglene kan gjenskapes fra en lagret uke
- [ ] En avbrutt eller gjentatt kjøpsbekreftelse dobler ikke beholdningen
- [ ] Minst 90 % ferskt prisede linjer og høyst 5 % median absolutt avvik mot kassakjøp i pilotområdene, med store enkeltavvik forklart
- [ ] Brukerne finner sin lokale avis, bruker et tilbud i planen og besøker butikk nummer to når appen anbefaler det

**Fase 3 – forslag og betaling**

- [ ] Ugyldige KI-forslag avvises av motoren
- [ ] Gjentatte genereringsforsøk gir riktig belastning

**Fase 4 – bred lansering**

- [ ] Prisavvik, deling og betaling verifisert hver for seg
- [ ] En faktisk familieuke testet fra start til slutt

90 %-målet kan bare nås med en prisavtale som dekker minst én av Rema 1000, Kiwi og Coop, eller i pilotområder der de kjedene som dekkes, dominerer.

## Økonomi og drift

Betalingsvilje prøves først etter at familiene har gjennomført flere handler. Modellen som testes er en gratis grunnplan (kundeaviser og grunnflyt, også som gjest) mot et familieabonnement med gjentakende planer, deling og historikk. Bånn appetitt er gratis, så abonnementet må gi noe som merkes i kassa. 49–79 kr per måned er en hypotese, ikke en pris.

| Kostnadspost | Kjent nå | Kommentar |
| --- | --- | --- |
| Kassalapp Bedrift | 750 kr/måned eller 9 000 kr/år eks. mva. | Nødvendig for kommersiell bruk |
| Kampanje- og avisdata | Ukjent | Avtales i fase 0; trolig største post |
| Oppskrifter og bilder | Ukjent | Egne eller lisensierte |
| Redaktør for oppskrifter og varekoblinger | Løpende | Datakvalitet er en egen, varig kostnad |
| Appbutikker og betalingsgebyrer | Avhenger av kanal | Faktiske salgskostnader beregnes per kanal |
| Infrastruktur, støtte, KI, bildelesing | Lav i piloten | KI fra fase 3, bilder fra fase 4 |

**Regnestykket.** Nettoinntekt per betalende husstand minus variable kostnader (betaling, KI, bildelesing, støtte) gir bidraget. Faste kostnader til datalisenser, drift og redaksjonelt arbeid deles på bidraget for å finne hvor mange abonnenter som trengs. Bruk i andre uke og gjennomførte handler måles før prisen velges.

**Drift.** Overvåk prisimport, utløp, dekning per region, varekoblinger, gjenkjenningsfeil og avvik mot kvittering. Varsle om manglende importer, gamle priser, ekstreme prisendringer og tvetydige pakninger, og vis siste oppdatering til brukeren. Ved kildefeil beholdes lagrede planer med merking av når prisene sist ble kontrollert. Køer for rettelser av priser, varer, aviser og oppskrifter har sporbar kilde. Én person har ansvar for dataavtaler og én for produktinnhold.

## Risikoer og åpne beslutninger

| Risiko | Konsekvens | Tiltak |
| --- | --- | --- |
| Ingen ferske priser fra Rema 1000, Kiwi og Coop | Butikksammenligningen og 90 %-målet faller | Port etter fase 0; velg pilotområder der dekningen er best, eller snevre inn løftet |
| Ingen avtale om kundeaviser | Katalogen blir bare lenker | «Les hos kjeden» og manuelle linjer; avisene virker også uten varedata |
| For stort første omfang | Forsinket og uferdig førsteversjon | Webapp i fase 1, egne apper i fase 3; prisløftet testes i pilotområder før bred markedsføring |
| Besparelsen ved to butikker er sjelden stor nok | Fortrinnet mot Bånn appetitt forsvinner | Mål hvor ofte familier faktisk besøker butikk nummer to |
| Feil varekobling | Feil pakninger og sum | Redaktørgodkjenning, prisstatus per linje, enkel feilmelding |
| Feil i allergendata | Helsefare | Uavklart allergenstatus godkjennes aldri som erstatning |

Åpne beslutninger:

- [ ] Hvilke 3–5 pilotområder (by og distrikt, flere landsdeler)?
- [ ] Hvem tar kontakt med Tjek og med kjedene?
- [ ] Egne oppskrifter, eller lisens fra en oppskriftsleverandør? (Eieren 2026-11-22: egne oppskrifter i omganger; research og åpne spørsmål i `docs/oppskrifter-research.md`.)
- [ ] Skal vær i oversikten og fransk som språk kuttes? Begge er arvet fra CartBrain.
- [ ] Skal milepæler og bidragsytere bli liggende i fase 4 eller kuttes?

## Kilder

Krav, terskler, eksempler og pilotstørrelse er anbefalte utgangspunkter. Planen innebærer ingen leverandøravtale, bekreftelse på lokal dekning eller garanti om besparelse.

- *Produkt- og løsningsbeskrivelse for en landsdekkende norsk middagsplanlegger*, versjon med kapittel 11–15 (opplastet 21. november 2026)
- [CartBrain – produkt og ukebudsjett](https://cartbrain.ca/about)
- [Bånn appetitt – App Store](https://apps.apple.com/no/app/b%C3%A5nn-appetitt/id6830623007)
- [Smartevalg](https://smartevalg.no/)
- [Handleklar](https://www.handleklar.no/about)
- [Kassalapp – API, dekning og vilkår](https://kassal.app/api)
- [Tjek – API-er og SDK-er](https://tjek.com/apis-and-sdks)
- [Open Prices – API](https://prices.openfoodfacts.org/api/docs)
- [Matvaretabellen – API](https://www.matvaretabellen.no/api/)
- [Personvernforordningen (GDPR)](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [Datatilsynet – vurdering av personvernkonsekvenser](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdering-av-personvernkonsekvenser/)
- [Angrerettloven](https://lovdata.no/dokument/NL/lov/2014-06-20-27)
