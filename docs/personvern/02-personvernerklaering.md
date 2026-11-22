> **UTKAST. Ikke juridisk rådgivning. Må kvalitetssikres av noen med personvernkompetanse før bruk.**
> Tekst i [hakeparenteser] må fylles ut eller avgjøres. **Avstemt 2026-11-22 mot synk-løsningen** (`docs/synk.md`, koden): erklæringen beskriver nå hva appen faktisk lagrer (kostkrav og postnummer synkes ikke). Den må likevel ikke publiseres før en fagperson har lest den, og den må oppdateres hvis noe i appen endres. Appen har i dag ingen lenke til erklæringen; den må legges inn før piloten.

# Personvernerklæring for Middagsplanlegger (pilot)

Sist oppdatert: [dato]

## Kort fortalt

- Vi trenger lite om deg og familien din: hvilke butikker du handler i, antall personer og hvor mye de spiser, planen din og handlelisten.
- Vi spør **ikke** om navn på barn, adresse, e-post, passord eller hvor du befinner deg.
- **Postnummer, allergier og kostkrav blir på enheten din.** De sendes aldri til oss, heller ikke når du deler husstand med en annen voksen. Det betyr at en annen voksen sin telefon ikke vet om dem: legg dem inn på hver enhet som skal bruke filteret.
- Appen virker uten nett og uten husstand. Deler du en husstand, lagrer vi planen, innstillingene, handlelisten og det dere har registrert som kjøpt og laget, slik at dere ser det samme.
- Vi selger ikke opplysninger, og vi bruker dem ikke til reklame.
- Du kan når som helst slette husstanden og alt vi har lagret om den.

Appen er en **pilot**. Priser og tilbud er anslag, ikke løfter om sluttpris. Appen kan ikke garantere at en vare er fri for allergener. Les alltid varedeklarasjonen.

## Hvem er ansvarlig?

[Navn på behandlingsansvarlig, organisasjonsnummer, adresse] er ansvarlig for opplysningene (behandlingsansvarlig). Spørsmål om personvern: [e-postadresse].

## Hva vi lagrer, og hvorfor

**Hos oss (på serveren), bare hvis du oppretter eller blir med i en husstand:**

| Hva | Hvorfor | Hvor lenge |
| --- | --- | --- |
| Valgte butikker, budsjett, antall butikkstopp, hvilke dager dere lager middag og hvor lang tid, om tilbud brukes og hvilke kjeder | Regne ut ukeplan og anslått pris | Til husstanden slettes [eller [12] måneder etter siste bruk; bygges ikke ennå] |
| Etiketter for personer («Voksen 1», «Barn 1»), porsjonsstørrelse, dager hjemme. Etiketten er fritekst: skriv ikke navn eller helseopplysninger der | Regne ut hvor mye mat dere trenger | Samme |
| Plan (hvilke middager), handleliste med avkrysninger og egne linjer du skriver inn, kjøp, det dere har hjemme, hva som er laget, og valg ved utsolgt vare | Gi dere samme plan og liste på alle enhetene | Samme |
| Hvilke enheter som er med: en tilfeldig enhets-id, en etikett du velger («Voksen 2»), når enheten ble med og sist var i bruk (avrundet til minutt), og en kode som bare lagres i uleselig form (sha256) | Koble enhetene til samme husstand og vite hvem som har krysset av | Til husstanden slettes. Fjernes en enhet, blir en tom «rad» med id og etikett liggende til husstanden slettes [dette skal endres] |
| Tidspunkt for hver endring, satt av enheten din (enhetens klokke), og når serveren mottok den | Riktig rekkefølge når enheter har vært uten nett | Samme |

**Bare på enheten din (sendes ikke til oss):** postnummer, allergier og kostkrav (vegetar, valgte allergener, matvarer som skal unngås), tilbud, og en kopi av alt over. Enheten din lagrer også nøkkelen som viser at den er med i husstanden.

**Vi lagrer ikke:** e-post, passord, navn, adresse, posisjon, bilder, kvitteringer, tilbud fra butikkenes aviser.

| Annet | Hvorfor | Hvor lenge |
| --- | --- | --- |
| Teknisk logg: i vårt oppsett lagres ikke IP-adresse eller innhold i tilgangslogg [må bekreftes for valgt leverandør]. IP-adressen din brukes kort i serverens minne for å stoppe misbruk og glemmes når serveren starter på nytt | Sikkerhet og feilretting | [14] dager hvis noe logges |
| Henvendelser du sender oss | Svare deg | [12] måneder etter at saken er avsluttet |

Hvis en husstand ikke har vært brukt på [12] måneder, sletter vi den. [Dette er ikke bygget ennå: stryk setningen eller bygg rutinen før piloten.]

Merk: selv om vi ikke lagrer allergier og kostkrav som egne opplysninger, kan planen og handlelisten din si noe om hva dere spiser og kjøper. Skriv ikke helseopplysninger eller navn i etiketter og egne handlelinjer.

## Hva vi bruker opplysningene til, og lovlig grunn

- **Levere tjenesten** (plan, liste, synk): vi trenger opplysningene for å gi deg tjenesten du ber om. [Grunnlag: avtale, personvernforordningen art. 6 nr. 1 b. Må verifiseres.]
- **Allergier og kostkrav:** disse kan si noe om helse eller livssyn, som er særlig beskyttede opplysninger. **Vi lagrer dem ikke hos oss.** De blir på enheten din, og filteret virker bare der. [Fagperson må vurdere om lagring på din egen enhet i appen vår krever noe mer av oss. Hvis deling mellom enheter senere bygges, spør vi om uttrykkelig samtykke (art. 9 nr. 2 a) først. Se `06-samtykke-helsekost.md`.]
- **Sikkerhet og drift:** vi har en berettiget interesse i å holde tjenesten trygg og stabil (art. 6 nr. 1 f). [Må verifiseres.]
- **Svare på henvendelser og rettigheter:** for å oppfylle rettighetene dine.

Vi bruker ikke opplysningene til markedsføring, og profilene til barn brukes aldri til markedsføring. Vi tar ingen avgjørelser om deg som har rettslig virkning ved hjelp av automatikk. Planmotoren foreslår middager, og det er alltid du som velger. [KI brukes ikke i piloten. Innføres det senere, oppdaterer vi dette og spør deg om valget.]

## Allergier og kostkrav: du må legge dem inn på hver enhet

Når du legger inn allergier eller kostkrav, spør vi ikke om samtykke til å lagre dem hos oss, fordi vi ikke gjør det. Konsekvensen er at **de ikke deles**: har du lagt inn nøtteallergi på din telefon, vet ikke den andre voksne sin telefon om det, og en plan laget der kan inneholde nøtter. Appen varsler om dette i plan-skjemaet. Legg inn de samme kravene på alle enheter som lager planer. [Se `06-samtykke-helsekost.md` for hva som må på plass hvis vi senere vil dele dem.]

## Hvem får se opplysningene?

- **Du og de du inviterer til husstanden.** Alle voksne i husstanden kan se og endre alt husstanden har delt (plan, liste, innstillinger, hvem som har krysset av). Den som har en gyldig invitasjonskode innen 24 timer, kan bli med, så del koden bare med den du vil invitere.
- **Vår leverandør av drift og lagring** ([navn, land for datasenter]). De behandler opplysningene på våre vegne og har ikke lov til å bruke dem til egne formål. Vi har [databehandleravtale]. [Underleverandører: liste eller lenke.]
- **Vi** ([navngitte roller]) har bare tilgang når det trengs for drift og feilretting.

Tilbudsinformasjon hentes av vår server fra [Tjek]. Vi sender ikke opplysninger om deg eller husstanden din dit. Kilden ser bare serverens adresse.

**Overføring utenfor EØS:** [Dataene lagres i EØS og leverandøren er i EØS: ingen overføring. ELLER: leverandøren er amerikansk; overføringsgrunnlag er … Fylles ut etter valg av hosting.]

## Lagring på enheten din

Appen lagrer planen, innstillingene, postnummer, allergier og kostkrav, handlelisten og (hvis du er med i en husstand) nøkkelen til husstanden på enheten din, slik at den virker uten nett. Vi bruker ingen sporings- eller reklameinformasjonskapsler. [Må verifiseres mot ekomloven.] Nøkkelen kan brukes av den som får tilgang til en ulåst telefon eller nettleserprofil: lås telefonen, og fjern enheten fra husstanden i appen hvis du mister den. «Slett lokale data» fjerner alt appen har lagret på enheten.

## Dine rettigheter

Du har rett til å:

- **få innsyn** i hva vi har om husstanden din og få en kopi,
- **få rettet** feil,
- **få slettet** opplysningene, også ved å slette hele husstanden i appen,
- **få utlevert** opplysningene du har gitt oss i et vanlig, maskinlesbart format,
- **protestere mot** eller **få begrenset** behandling i enkelte tilfeller,
- **trekke samtykke** der behandlingen bygger på samtykke.

Send e-post til [adresse]. Vi svarer innen en måned. Vi kan be deg bekrefte at du hører til husstanden, men vi ber ikke om mer personopplysninger enn nødvendig for det. Hvordan vi behandler dem, står i vår interne rutine.

**Sletting:** når eieren sletter husstanden i appen (bekreftes ved å skrive SLETT), fjernes dataene fra systemet vårt med en gang, og de andre enhetene i husstanden kobles fra. Spor i serverens databasefil overskrives i løpet av kort tid. Sikkerhetskopier overskrives innen [30] dager, og kopiene brukes bare til gjenoppretting etter feil. Det som ligger på enhetene dine, sletter du selv (valget «Slett også alt som er lagret på denne enheten», eller «Slett lokale data»).

**Innsyn og kopi:** appen har ingen knapp for å laste ned dataene. Send e-post, så henter vi en kopi manuelt. [Eier avgjør om en eksportfunksjon skal bygges før piloten.]

## Klage

Hvis du mener vi behandler opplysninger i strid med reglene, kan du klage til Datatilsynet (datatilsynet.no). Vi vil gjerne at du kontakter oss først, men du må ikke.

## Barn

Appen er ment for voksne som planlegger for familien. Vi samler inn en **etikett og en porsjonsstørrelse** for barn (f.eks. «Barn 1», 0,6 porsjon), ikke navn, alder eller andre personopplysninger om dem. [Barn under [13 / må verifiseres] år skal ikke opprette egen konto eller husstand.]

## Endringer

Hvis vi endrer hva vi gjør med opplysningene, oppdaterer vi erklæringen og varsler i appen før endringen gjelder. Tidligere versjoner: [lenke].
