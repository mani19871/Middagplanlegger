# 06 Samtykke for helserelaterte kostvalg, og hvem som kan samtykke

> **UTKAST. Ikke juridisk rådgivning. Må kvalitetssikres av noen med personvernkompetanse.**
>
> **Status 2026-11-22: valg A er bygget for piloten.** Kostkrav og allergier (`avoid`, `avoidFoods`, `vegetarian`) synkes ikke og lagres ikke på serveren; serveren avviser dem (`src/sync/docs.ts`, `LOCAL_ONLY_SETTINGS`), og det er en test for det (`src/sync/engine.test.ts`). **Samtykkeløsningen under (avsnitt 4–5) er derfor ikke bygget og ikke nødvendig for piloten.** Dokumentet beholdes som utkast til det som må på plass **hvis** deling av kostkrav mellom enheter bygges senere (valg B). Se `01-oversikt-behandling.md`, avsnitt 3, for konsekvensene.
>
> Dette er planens åpne punkt: «Det må avklares hvem som kan samtykke for hvert familiemedlem; rollen som kontoeier løser ikke det for alle» (`docs/plan.md`). Jeg foreslår en løsning; jeg løser ikke de juridiske spørsmålene.

## 0. Hva valg A betyr i praksis (bygget)

- Kostkrav ligger bare i `localStorage` på hver enhet. En voksen som blir med i en husstand beholder sine egne krav, og krav fra andre enheter kommer aldri inn.
- **Ingen deling:** en annen voksen sin enhet uten allergifilter kan lage en plan med allergener for hele husstanden. Appen varsler i plan-skjemaet, men det er en reell produktsikkerhetsrisiko (se `docs/synk.md`, «Allergier deles ikke»). Eier må vite at den er akseptert i piloten.
- Spørsmål 6 i avsnitt 6 er dermed besvart for piloten: den kjøres med kostkrav bare lokalt.
- **Det som fortsatt trenger en fagpersons svar selv med valg A:** (1) er lagring på brukerens egen enhet i appen vår noe vi må vurdere som behandling av helseopplysninger; (2) kan plan, handleliste og fritekst indirekte avsløre helse eller livssyn slik at hele datasettet må behandles varsomt (`01-oversikt-behandling.md`, avsnitt 2b og 3).
- **Hvis valg B senere bygges**, må dette på plass først: samtykkeskjerm slik som under, samtykkelogg, bryter som sletter kostkrav fra serveren (inkludert hendelser og utboks som inneholder dem), og en egen modell for at to voksne kan ha ulike krav (i dag er kostkrav husstandsnivå i `Settings`, ikke per person).

## 1. Problemet

Et kostfilter (allergi, intoleranse, vegetar, «ikke svin») kan avsløre helse eller livssyn om en bestemt person (`01-oversikt-behandling.md`, avsnitt 3). Skal vi lagre det på serveren, trenger vi i tillegg til grunnlag etter art. 6 et unntak etter art. 9. Vi har valgt **uttrykkelig samtykke** (art. 9 nr. 2 a). Men:

- Den som sitter med telefonen (kontoeier) registrerer ofte kostkrav for **andre**: ektefelle, barn, besteforeldre, gjester.
- Samtykke må være frivillig, spesifikt, informert og utvetydig, og må kunne trekkes like enkelt som det ble gitt (art. 4 nr. 11 og art. 7, må verifiseres).
- En voksen kan i utgangspunktet ikke samtykke på vegne av en annen voksen. Foreldre kan handle for barn innenfor foreldreansvaret.

## 2. Designprinsipper (forslag)

1. **Samle minst mulig.** Ikke spør om diagnose, bare om hva som skal unngås («unngå gluten», ikke «har cøliaki»). Ingen fritekst om helse.
2. **Husstandsnivå, ikke personnivå.** Kostkrav lagres som husstandens krav («husstanden unngår: nøtter, gluten»), ikke koblet til en bestemt person, så lenge motoren ikke trenger noe annet. Dagens motor har `avoid` og `avoidFoods` på husstandsnivå, og `Eater` har bare etikett, porsjon og dager hjemme. Det er en god utgangsposisjon. Skal kostkrav senere knyttes til en person («Barn 1 tåler ikke nøtter»), blir behovet for riktig samtykke større.
3. **Lagre lokalt som standard.** Kostkrav virker uten samtykke til serverlagring, fordi de bare ligger på brukerens enhet. Serverlagring og synk av kostkrav mellom enheter krever uttrykkelig samtykke, og er av som standard. Da kommer ingen kostkrav til serveren uten at en voksen aktivt har sagt ja.
4. **Filteret virker uansett.** Å si nei til serverlagring skal aldri slå av sikkerheten på enheten. Hvis brukeren trekker samtykket, vises en tekst om at filteret bare gjelder denne enheten.
5. **Aldri bruk kostkrav til annet** enn filtrering og rangering av retter. Ikke til markedsføring, analyse eller deling (planen: barns profiler brukes aldri til markedsføring).
6. **Ingen kostkrav i logger, delingslenker eller feilmeldinger.**

## 3. Hvem kan samtykke for hvem (forslag, må verifiseres)

| Person | Forslag | Begrunnelse og forbehold |
| --- | --- | --- |
| **Kontoeier/voksen som bruker appen** | Samtykker for seg selv | Klart tilfelle |
| **Annen voksen i husstanden** | Kontoeier registrerer, men **den andre voksne får selv en samtykkeskjerm** når hen kobler til husstanden (eller en melding hvis hen ikke har enhet), med mulighet til å se og fjerne egne krav. Ligger kravet på husstandsnivå, vises det som «husstandens krav». Inntil den andre har sett det: **ikke synk til server**, bare lokalt | En voksen kan ikke gyldig samtykke for en annen voksen. En bekreftelse fra kontoeier («jeg har lov til å oppgi dette») er ikke samtykke fra den andre. Hvis den andre ikke har noe forhold til appen, er det trolig tryggest å ikke lagre personkoblede kostkrav på serveren. **Må avklares av fagperson.** |
| **Barn (under 13 år, må verifiseres)** | En med **foreldreansvar** samtykker for barnets kostkrav. Barn har ikke egen konto eller husstand i piloten | Aldersgrensen for barns eget samtykke til informasjonssamfunnstjenester er 13 år etter personopplysningsloven § 5, og regjeringen har sendt på høring å heve den til 15 år; om det er vedtatt, må verifiseres. Grensen gjelder barnets eget samtykke til en slik tjeneste. Her er det forelder som bruker appen. Hvem som har foreldreansvar (f.eks. delt omsorg) kan skape uenighet; vår løsning kan ikke avgjøre det |
| **Ungdom 13–17 år** | Ikke i piloten. Ingen egen konto for ungdom | Skal det inn senere, må alder og samtykkegrensen vurderes på nytt |
| **Gjester** | Ingen profil lagres. Gjestens allergi legges inn som engangsvalg for et måltid og lagres ikke på husstanden, eller bare lokalt | Unngår å lagre helseopplysninger om en person som ikke har noe forhold til appen |
| **Verge/fullmektig for voksen** | Utenfor piloten | Må avklares ved behov |

**Kravet til registrering:** når kontoeier legger inn et kostkrav, spør vi om **hvem** det gjelder i generelle termer («meg», «noen i husstanden», «et barn jeg har foreldreansvar for», «en gjest, bare denne gangen») og viser valget i klart språk. Vi lagrer bare svaret som en etikett, ikke navn.

## 4. Samtykkeløsning (utkast til flyt)

Vises første gang noen legger inn allergi eller kostkrav, og igjen ved endring av hva vi lagrer.

**Skjerm 1: Lagre bare på denne enheten (forhåndsvalgt)**
> Allergier og kostkrav brukes til å holde retter som ikke passer, utenfor planen. Foreløpig lagres de **bare på denne enheten**. [Fortsett]

**Skjerm 2: Valgfritt: lagre hos oss og bruk på alle enhetene**
> Vil du at vi lagrer allergier og kostkrav hos oss, så de følger husstanden på alle enhetene dine? De kan fortelle noe om helse eller livssyn, som er særlig beskyttet.
>
> - Vi lagrer dem bare for å filtrere retter. Aldri til reklame, og vi selger ikke opplysninger.
> - Du kan trekke samtykket når som helst i Innstillinger. Da sletter vi dem hos oss.
> - Du bekrefter at du har lov til å oppgi dem: for deg selv, for barn du har foreldreansvar for, eller for en annen voksen som vet om og er enig.
>
> ☐ Ja, lagre hos [Navn på tjenesten] **[IKKE forhåndsavkrysset]**
> [Ikke nå]  [Les personvernerklæringen]

**Det som må være sant for at dette skal være et samtykke (sjekkliste, må verifiseres):**

- [ ] Frivillig: nei gir ikke dårligere tjeneste (bare ingen synk av kostkrav).
- [ ] Spesifikt og atskilt: ikke bundet sammen med vilkår eller andre samtykker.
- [ ] Informert: hvem som er ansvarlig, formål, hva som lagres, rett til å trekke.
- [ ] Utvetydig handling: eget avkrysningsfelt, ikke forhåndsvalgt.
- [ ] Like enkelt å trekke som å gi: bryter i Innstillinger, ikke en e-post.
- [ ] Vi kan vise at det er gitt: **samtykkelogg** med husstands-id, tidspunkt, tekstversjon, valg. Ikke mer.
- [ ] Nytt samtykke når formål eller tekst endres vesentlig.

## 5. Når samtykke trekkes

1. Appen sletter kostkrav fra serveren og fra husstandens synkroniserte data (inkludert utboks og hendelser som inneholder dem).
2. Appen beholder krav lokalt på enheten hvis brukeren ber om det, og viser tydelig at filteret nå bare gjelder denne enheten.
3. Samtykkeloggen oppdateres med «trukket», tidspunkt.
4. Sikkerhetskopier overskrives innen [30] dager (opplyst i erklæringen).

## 6. Hva en fagperson må avgjøre

1. Er kostkrav som «ikke svin» eller «vegetar» særlige kategorier i vår bruk, eller bare allergier?
2. Er husstandsnivå uten personkobling tilstrekkelig til å unngå art. 9, eller skal vi regne det som helseopplysninger uansett?
3. Hva er et gyldig samtykke fra «annen voksen» når kontoeier legger inn opplysningene? Er det nok at den andre får vist og kan fjerne dem?
4. Gjelder foreldres samtykke på vegne av barn som samtykke etter art. 9 eller som utøvelse av foreldreansvar, og hva når foreldrene er uenige?
5. Gjester: er engangsvalg uten lagring greit?
6. Må samtykkeskjermen være på plass før piloten åpnes, eller kan piloten kjøres med kostkrav bare lokalt, uten serverlagring (alternativet som unngår problemet)?
7. Hva gjelder om alder 13 eller 15 for barns eget samtykke hvis ungdom senere får egne profiler?

**Alternativ som unngår mesteparten av problemet:** i piloten lagres kostkrav **ikke** på serveren i det hele tatt (bare lokalt). Da trengs ikke samtykkeløsningen for serverlagring, men synk av kostkrav mellom enheter virker ikke. Det er en produktavveining for eier.

**Valgt for piloten (2026-11-22, koordinator):** alternativet over. `avoid`, `avoidFoods` og `vegetarian` synkes ikke og avvises av serveren (`src/sync/docs.ts`, `docs/synk.md`); filteret virker på hver enhet der det er lagt inn. Avbøtende tiltak for allergisikkerheten: alle retter og handlelinjer viser alltid «Inneholder: …» (eller at innholdet ikke er avklart), og en enhet uten filter i en husstand med flere enheter får et banner om at planen kan inneholde allergener. Synk av kostkrav etter samtykke (punkt 3 og tabellen over) er ikke bygget og er en senere beslutning som krever personvernvurdering. Spørsmål 6 over er dermed besvart for piloten: kostkrav bare lokalt.
