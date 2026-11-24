# Husvett: informasjon til deg som er med i piloten

> **UTKAST, skrevet 2026-11-24. Eieren må godkjenne teksten før den sendes til noen.** Ikke send den før «Før utsending» nederst er gått gjennom. Del 1 er selve teksten til familiene (ca. to sider). Del 2 er internt og fjernes før utsending. Dette er pilot-sjekklisten punkt B12.

---

## Del 1: teksten til pilotfamiliene

### Hva er Husvett?

Husvett hjelper familier å planlegge middager for uka. Du får en ukeplan, én handleliste, et anslag over hva handlekurven koster, og tilbud fra kundeaviser. Flere voksne kan dele samme plan og liste, og appen virker også uten nett.

### Hva er piloten?

Piloten er **lukket**: bare de vi inviterer, og de kan bo hvor som helst i Norge. Vi vil finne ut om **planen, handlelisten og delingen mellom telefoner** fungerer i en vanlig uke.

Vi tester **ikke prisene**. Butikkene, prisene og de fleste avisene i appen er **demodata**, altså oppdiktet, og er merket «Demodata» øverst i appen. Ikke bruk summen som en pris du kan regne med i butikken. Prisene er alltid *anslått*, aldri et løfte om sluttpris.

Unntaket er tilbud og kundeaviser fra **Tjek**. De er ekte og vises med «Kilde: Tjek» og dato. De kan likevel være utgått eller ha vilkår, så sjekk i butikken. Bildene i tilbud og aviser hentes direkte fra Tjek når du åpner dem, og Tjek ser da IP-adressen til telefonen din, men ingenting annet fra appen.

### Allergi: les dette

**Appen kan aldri garantere at en rett eller vare er fri for allergener.**
- Oppskriftene i piloten er demooppskrifter eller utkast skrevet for Husvett med hjelp av KI. De er ikke testkokt, og allergenene er **ikke kontrollert av en person**.
- **Alle med allergi må selv lese varedeklarasjonen på varen, hver gang.**
- Allergier og kostkrav lagres **bare på telefonen der du legger dem inn**. De deles ikke i husstanden. Legg dem inn på **hver** telefon som lager planer. En telefon uten filter viser et varsel, og hver rett viser alltid hva den inneholder.

### Hva lagres hvor?

- **På telefonen din:** alt appen trenger for å virke uten nett (plan, innstillinger, handleliste, matskap), og postnummer, allergier og kostkrav.
- **Hos oss, bare hvis du lager eller blir med i en husstand:** planen, handlelisten med avkrysninger, det dere har kjøpt og laget, innstillinger (butikker, budsjett, porsjoner), og hvilke telefoner som er med. Alle voksne i husstanden ser og kan endre alt som deles.
- **Aldri hos oss:** postnummer, allergier, kostkrav, navn, e-post, passord, adresse og posisjon. Du trenger ingen konto.
- Tilbud fra Tjek lagres hos oss, men handler bare om varer, ikke om deg.
- Dataene ligger på en leid server i Europa.

**Bruk etiketter, ikke navn:** «Voksen 1», «Barn 1». Skriv ikke navn eller helseopplysninger i etiketter eller egne handlelinjer. Selv uten kostkravene kan en plan og handleliste si noe om hva dere spiser.

Den som har en invitasjonskode (gyldig i 24 timer, brukes én gang) kommer rett inn i husstanden. Del koden bare med den du vil invitere. Mister du telefonen, be eieren av husstanden fjerne den.

### Se, ta med og slette dine data

- **«Last ned mine data»** (Husstand-skjermen): én fil med alt på telefonen din og alt vi har om husstanden. Nøkkelen til husstanden er ikke med.
- **«Slett husstanden og alle data»** (Husstand-skjermen, bare eieren av husstanden; du bekrefter ved å skrive SLETT): sletter alt vi har om husstanden, og de andre telefonene kobles fra. Andre kan i stedet forlate husstanden.
- **«Slett alt på denne enheten»**: fjerner alt appen har lagret på telefonen din.
- Sikkerhetskopier av serveren kan inneholde slettede data en kort tid etter slettingen.
- **Oppbevaring:** hvis ingen telefon i en husstand har vært i kontakt med serveren på **730 dager** (om lag to år), slettes husstanden automatisk. Vi har ingen kontaktinformasjon og kan ikke varsle på forhånd. Appen åpen på nett holder husstanden i live.

Mer detaljer står i «Personvern» i appen (Husstand-skjermen).

### Hvem er ansvarlig, og hvem kan du kontakte?

Ansvarlig er **AVVR AS** (org.nr. 935941644), Smedalsvegen 14, 2067 Jessheim. Spørsmål om personvern, innsyn og sletting: **kontakt@husvett.no**. Oppgi enhets-id-en som står på Husstand-skjermen. Send aldri nøkkelen eller invitasjonskoder. Du kan klage til Datatilsynet (datatilsynet.no), men vi vil gjerne høre fra deg først.

### Tilbakemelding og å trekke seg

- Send tilbakemelding til **kontakt@husvett.no**: hva du gjorde, hva du forventet, og hva som skjedde. Skjermbilder er velkomne, men uten navn, nøkler eller koder.
- Si fra med en gang hvis du ser **noe som kan gi feil allergiinformasjon**, hvis noe du har lagret **er borte**, hvis du ser **en annens data**, eller hvis en nøkkel eller kode har havnet et sted den ikke skal.
- Du kan **avvise eller slutte når som helst**, uten å begrunne det: slett husstanden eller forlat den, slett alt på telefonen, og avinstaller appen.

---

## Del 2: internt, fjernes før utsending

### Før utsending (for eieren)

Regelen i `docs/pilot-sjekkliste.md`: **ingen ekte familie inviteres før alle STOPP-punkter er krysset av, eller eieren har skrevet i del H hvorfor ett er avtalt bort.** Eierens aksept av C17 (2026-11-22) dekker bare C17. Status per 2026-11-24 (fra statustabellen i sjekklisten; ☑ gjort, ◐ delvis, ☐ åpen):

| Punkt | Hva som må være avgjort først | Status |
| --- | --- | --- |
| A1 | Behandlingsansvarlig (AVVR AS) | ☑ |
| A8 | Allergi-begrensningen godtatt, og deltakerne får vite det | ☑ (gjøres her, etter godkjenning av teksten) |
| D15 | Tokenutløp 730 dager | ☑ |
| A2 | Driftsansvarlig: responstid er ikke bestemt | ◐ |
| A3 | Hosting: land/datasenter, tak, fullført oppstart | ◐ |
| A4 | Domenet i AVVR AS sitt navn, to-faktor, DNS | ◐ |
| A5 | Postkassen kontakt@husvett.no opprettet og prøvd utenfra; hvem svarer innen 30 dager | ◐ |
| A7 | Slettefrist for sikkerhetskopier og loggtid | ◐ |
| A9 | Backup-nøkkel laget, helst to holdere | ☐ |
| A12, B1, B2 | Fagperson har lest utkastene, eller eieren skriver i del H at piloten kjøres uten | ☐ |
| B3 | DPIA-terskel signert av AVVR AS | ◐ |
| B4 | Personvernerklæring: godkjent og publisert på fast adresse | ◐ (utfylt som utkast 2026-11-24) |
| B5 | Arket i appen stemt av mot erklæringen | ◐ (avvik funnet, se sjekklisten) |
| B6 | Databehandleravtaler: one.com (avtalen er ikke sett), og for sikkerhetskopier | ◐ |
| B12 | Denne teksten godkjent av eieren | ◐ (skrevet som utkast) |
| C1–C4 | Server med brannmur, domene og HTTPS, `SYNC_SECRET`, varig volum | ☐ / ◐ |
| C6, C7, C9 | Daglig kryptert backup utenfor serveren, gjenopprettingsøvelse på ekte server | ☐ |
| C8, C10 | Sletting i sikkerhetskopier, overvåking | ◐ / ☐ |
| C14 | To-faktor på hosting-, domene- og GitHub-konto | ☐ |
| C16, C17 | Delt server: tilgangsliste ført (B8); testserver-risiko (akseptert, tiltak ikke utført) | ◐ |
| D1 | Demodata merket (gjort i appen; teksten over gjentar det) | ◐ |
| D2 | Sikkerhetsgjennomgang | ☐ |
| D6 | Oppbevaring bygget (730 dager) | ◐ |
| E1 | Fase 0-porten: dekningen er dårlig; piloten er derfor test av plan, liste og synk, ikke av pris | ◐ |
| E3 | Rettigheter til kilder (bare Tjek; avtalen er eierens opplysning) | ◐ |

### Avklaringer i selve teksten før den sendes

- **Postkassen** (A5): `kontakt@husvett.no` er oppgitt av eieren, men ikke bekreftet opprettet eller virkende. Send en prøvemelding utenfra før teksten sendes. Virker den ikke, må adressen byttes i teksten.
- **Land for serveren:** teksten sier bare «en leid server i Europa». Land og EØS er ikke bekreftet (A3). Bekreft, eller behold formuleringen. Skriv ikke «EØS» før det er bekreftet.
- **Databehandleravtale med one.com** (B6): eierens opplysning at den finnes, ikke sett av oss. Teksten nevner ingen leverandør.
- **Pris for deltakerne** (A6): betaling i piloten er ikke avgjort (anbefalt: nei). Teksten sier ingenting om pris. Avgjør, og legg til én setning.
- **Antall husstander og startdato** (A6): ikke avgjort, står ikke i teksten.
- **Slettefrist for sikkerhetskopier** (A7): teksten sier bare «en kort tid». Avgjør tallet og skriv det inn, eller behold formuleringen.
- **Delt server** (C16, C17): andre med administratortilgang kan teknisk lese databasen. Teksten sier ikke dette. Avgjør om den skal (se Å16 i `personvern/02-personvernerklaering.md`).
- **Svartid på tilbakemeldinger:** teksten lover ingen. Avgjør hvem som leser innboksen (A5).
- **Dokumentet er skrevet av en utviklerassistent og ikke vurdert av en fagperson.** Det er ikke juridisk rådgivning.
- **Oppdater teksten** hvis noe i appen eller personvernerklæringen endres.
- Kryss av B12 i sjekklisten først når eieren har godkjent teksten og den er sendt.
