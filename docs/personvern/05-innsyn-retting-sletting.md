# 05 Rutine for innsyn, retting og sletting

> **UTKAST. Ikke juridisk rådgivning. Må kvalitetssikres av noen med personvernkompetanse.** Frister og artikler fra generell kunnskap: må verifiseres. Rutinen forutsetter at synk-løsningen støtter sletting av husstand og eksport; det er ikke kontrollert mot den ferdige koden (bygges i egen økt).

## 1. Prinsipper

- Svar **uten ugrunnet opphold og senest innen en måned** etter at vi mottok henvendelsen (GDPR art. 12 nr. 3, må verifiseres). Fristen kan i visse tilfeller forlenges; avtal da med den som spør.
- **Gratis** for vanlige henvendelser.
- **Ikke samle mer data for å oppfylle en rettighet.** Vi har få data om hvem personen er. Identitet bekreftes med det vi allerede har (se avsnitt 3).
- Hver henvendelse føres i et enkelt register (dato mottatt, type, hvem som behandlet, dato besvart, utfall). Ikke lagre selve dataene i registeret.
- **Ansvarlig for rutinen:** [navn]. **Postkasse:** [e-postadresse].

## 2. Typer henvendelser

| Rettighet (GDPR) | Hva brukeren får | Hvordan |
| --- | --- | --- |
| Innsyn (art. 15) | Kopi av husstandens data og informasjon om formål, mottakere, oppbevaring | Eksport fra appen (helst selvbetjent) eller manuelt uttrekk |
| Retting (art. 16) | Rettet opplysning | Brukeren retter selv i appen. Ellers retter vi på forespørsel |
| Sletting (art. 17) | Alt slettet | **Slett husstand** i appen. Ellers sletter vi manuelt |
| Dataportabilitet (art. 20) | Egne data i maskinlesbart format (JSON) | Samme eksport som innsyn |
| Begrensning og innsigelse (art. 18, 21) | Behandling stanses eller begrenses | Vurderes enkeltvis |
| Trekke samtykke (art. 7 nr. 3) | Kostkrav slettet fra serveren | Bryter i innstillinger. Må være like enkelt som å gi samtykke |

## 3. Bekrefte hvem som spør

Vi har ikke navn eller adresse på brukerne, og skal ikke samle dem bare for dette. Slik går vi frem (forslag):

1. **Selvbetjent er best.** Innsyn, retting og sletting gjøres i appen av en enhet som allerede er medlem av husstanden. Da trengs ingen annen identifisering.
2. **Henvendelse per e-post:** be personen sende husstandskode/invitasjonskode eller en bekreftelseskode som vises i appen på en medlemsenhet. Har vi e-postadresse på kontoen, svar til den.
3. **Medlemmer av samme husstand:** husstandens data tilhører husstanden. Alle voksne medlemmer kan se husstandens data. Fjerning av andre medlemmers opplysninger (f.eks. én voksens kostkrav) skal være mulig for den det gjelder. **Hvordan vi forholder oss til uenighet mellom medlemmer, må avklares av fagperson.**
4. **Er identiteten tvilsom:** be om bekreftelse på en annen måte, men ikke gi ut data.

## 4. Fremgangsmåte

### Innsyn
1. Registrer mottak. Bekreft identitet (avsnitt 3).
2. Hent ut husstandens data: husstand, spiseprofiler, plan, handleliste, beholdningslogg, kostkrav, samtykkelogg, enhetsliste. Se `01-oversikt-behandling.md`, tabell 2.
3. Legg ved: formål, grunnlag, mottakere (databehandlere), oppbevaringstid, rettigheter og klageadgang. Dette finnes i personvernerklæringen.
4. Send i et vanlig format. Sikre overføringen (ikke send sensitive data i åpen e-post; bruk kode i appen eller en nedlastingslenke som utløper).
5. Skriv at logger med IP-adresse bare finnes i [14] dager og vanligvis ikke kan kobles til husstanden. Be om dato og tidsrom hvis personen likevel vil ha dem.

### Retting
Rett opplysningen eller be brukeren gjøre det i appen. Informer eventuelle mottakere (databehandlere trenger normalt ikke varsel, men sikkerhetskopier retter seg ikke; se under).

### Sletting
1. Bekreft hvem som ber om det og at det gjelder hele husstanden eller bare enkeltopplysninger.
2. **Slett husstand i appen** (forutsetter at synk-løsningen sletter: husstand, medlemskap/enhetstokens, spiseprofiler, kostkrav, plan, handleliste, beholdningslogg, **utboks/hendelser** og samtykkelogg-detaljer; se punkt 5 under).
3. Bekreft sletting skriftlig. Opplys at:
   - data i **sikkerhetskopier** overskrives innen [30] dager og ikke brukes til noe annet enn gjenoppretting etter feil,
   - lokale kopier på brukerens egne enheter (nettleserlagring) slettes av brukeren, f.eks. via «tøm data» i appen eller nettleseren,
   - logger med IP slettes etter [14] dager.
4. Hvis en gjenoppretting fra sikkerhetskopi gjøres, **slett igjen** de husstandene som ble slettet etter kopitidspunktet. Før en kort liste over slettede husstands-id-er (bare id og dato, ingen innhold) til dette formålet. **[Må avgjøres: en slik liste er selv en lagring; bør kunne forsvares og slettes etter kopiens levetid.]**

### Avslag
Vi kan avslå eller begrense hvis det er lovlig grunn (f.eks. dokumentasjonsplikt eller andres rettigheter, må verifiseres). Begrunn skriftlig og opplys om klageadgang til Datatilsynet.

## 5. Krav til appen (til synk-økten og koden)

Dette er ikke bygd av meg. Det er krav som bør kontrolleres mot koden:

- [ ] **Slett husstand** i appen, bekreftet i to trinn, sletter alle poster knyttet til husstanden på serveren, inkludert hendelseslogg og utboks, uten rester i avledede tabeller.
- [ ] Sletting er **idempotent** (kan sendes to ganger uten feil), på linje med øvrige importer og bekreftelser (CLAUDE.md regel 8).
- [ ] Etter sletting avvises hendelser fra enheter som fortsatt har utboks til husstanden (de skal ikke gjenopprette husstanden ved en senere synk).
- [ ] **Eksport** av husstandens data i JSON, tilgjengelig for medlemmer.
- [ ] **Samtykkebryter** for kostkrav som sletter dem fra serveren.
- [ ] Mulighet til å **fjerne en enhet** fra husstanden.
- [ ] Ingen kostkrav, tokens eller husstands-id-er i serverlogger.
- [ ] «Tøm lokal data» i appen for å fjerne lokal lagring på enheten.

## 6. Personvernbrudd (kort)

Et personvernbrudd er brudd på sikkerheten som fører til utilsiktet tap, endring eller utlevering av personopplysninger. Slik går vi frem (må verifiseres):

1. Den som oppdager det, varsler **[driftsansvarlig]** med en gang. Skriv ned tidspunkt, hva som skjedde og hva som er berørt.
2. Stans lekkasjen (rotér nøkler og tokens, ta ned tjenesten om nødvendig). Behold bevis.
3. Vurder risiko for de registrerte. Hvis bruddet sannsynligvis innebærer en risiko, meld til **Datatilsynet uten ugrunnet opphold og om mulig innen 72 timer** (art. 33, må verifiseres).
4. Er risikoen **høy** (f.eks. kostkrav eller helseopplysninger er lekket), varsle også de registrerte (art. 34, må verifiseres).
5. Føre alle avvik i en intern avviksliste, også de som ikke meldes.
6. Databehandler varsler oss; avtale hvor raskt (se `04-databehandleravtaler-sjekkliste.md`).

## 7. Svarmaler (innsyn)

> Hei. Vi har mottatt forespørselen din om innsyn i opplysninger vi har om husstanden din i Middagsplanlegger. Vedlagt (eller via lenken under, gyldig i 7 dager) er en kopi av opplysningene. Der står også hva vi bruker dem til, hvem som får dem, hvor lenge vi oppbevarer dem og hvilke rettigheter du har. Du kan be oss rette eller slette opplysningene, eller slette hele husstanden i appen. Hvis du mener vi behandler opplysninger feil, kan du klage til Datatilsynet. Hilsen [navn], [kontakt].
