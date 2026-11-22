# Fase 0 – resultater

Status: **delvis**. Kassalapp-importtesten og Tjek-dekningsmålingen er kjørt (2026-11-21). Tjeks og kjedenes offentlige vilkår er lest 2026-11-22 (§ 3), men visningsmåten er ikke avklart: den skriftlige Tjek-avtalen er fortrolig, så omfanget er ikke kjent for oss, og ingen kjede gir offentlig tillatelse til gjenbruk. To av portkriteriene krever data vi ikke har (se «Port»).

## 1. Kassalapp-importtest

### Metode
- API: `GET https://kassal.app/api/v1/products` og `/physical-stores`, verifisert mot OpenAPI-spesifikasjonen (`https://kassal.app/docs/api.json`) og mot ekte svar samme dag.
- Felt som gir **pris**: `current_price` (NOK). Felt som gir **dato**: `updated_at` (siste observasjon; samme dato som nyeste `price_history[].date`). `current_price_updated`, som den opprinnelige probe.mjs brukte, finnes ikke og er fjernet. Pakning: `weight` + `weight_unit`, med fallback til størrelse i produktnavnet. Kjede: `store.code`.
- Gyldige `store`-verdier er ikke listet i spesifikasjonen; funnet ved prøving: `KIWI`, `REMA_1000`, `COOP_NO`, `MENY_NO`, `SPAR_NO`, `JOKER_NO`, `BUNNPRIS`, `ODA_NO`, `ENGROSSNETT_NO`. Coop er én kode for alle formater (Extra, Prix, Mega, Obs, Marked). `COOP_MEGA` o.l. godtas som parameter, men gir ingen treff.
- Ti kurver, 5 middager hver (14 oppskrifter fra `src/data/catalog.ts`, 24 ingredienser, basisvarene salt, pepper og olje utelatt), 154 unike varelinjer totalt per kjede. Landsdeler: Oslo, Bergen, Trondheim, Tromsø, Stavanger, Kristiansand, Hamar, Bodø, Alta, Sogndal (by, småby, distrikt).
- 233 API-kall, 0 feil, 0 avkortede søk (maks tre sider à 100 per søk). Én kjøring; ingen gjentakelse over to kampanjeperioder.
- Alder = kjøretidspunkt minus `updated_at`. For hver varelinje er det **beste treff** brukt (riktig pakning først, deretter ferskest), så aldre og dekning er optimistiske.

### Begrensninger (les før tallene)
1. **Kurvene er konstruert fra planens oppskrifter, ikke fra faktiske kvitteringer.** Ingen sammenligning mot faktiske kjøp er gjort.
2. **Treffene er vurdert automatisk** med regler per vare (`baskets.json`: ordkrav, forbudte ord, pakningsstørrelse), ikke manuelt. «Med pris» er derfor en øvre grense. Eksempel: «Kyllingfilet Pepper/Hvitløk 110g» (pålegg) kan telle som kyllingfilet. Navn der ordet er delt (f.eks. «Kylling Filet») overses. Pakning er bare krevd for fem varer (kjøttdeig, spagetti, hakkede tomater, jasminris, kokosmelk), 42 linjer per kjede.
3. **Prisenes korrekthet er ikke kontrollert** mot hyllepris eller kvittering. Kassalapp opplyser selv at pris- og observasjonsdato må sjekkes.
4. **Kassalapp-prisene er kjedenivå, ikke per utsalg.** Dekning per kurv/landsdel varierer derfor bare fordi kurvene har ulike varer; produktdekningen i seg selv varierer ikke geografisk. Området måles bare som utsalgsnærvær (under). Hvor komplett Kassalapps utsalgsregister er, er ikke kontrollert; null utsalg (f.eks. Kiwi i Sogndal) kan være et hull i registeret eller reelt, det vet vi ikke.
5. Én kjøring på én dag; hvor ofte de «ferske» prisene faktisk oppdateres over tid er ikke målt.

### Dekning per kjede (alle kurver)

| Kjede | Linjer | Med pris | Pakning riktig (av linjer med krav) | ≤2 d | 3–365 d | >365 d |
| --- | --- | --- | --- | --- | --- | --- |
| Kiwi | 154 | 154 (100 %) | 28/42 (67 %) | 34 | 0 | 120 |
| Rema 1000 | 154 | 131 (85 %) | 42/42 (100 %) | 0 | 0 | 131 |
| Coop | 154 | 154 (100 %) | 36/42 (86 %) | 0 | 0 | 154 |
| Meny | 154 | 154 (100 %) | 34/42 (81 %) | 140 | 0 | 14 |
| SPAR | 154 | 154 (100 %) | 28/42 (67 %) | 146 | 0 | 8 |
| Joker | 154 | 146 (95 %) | 28/42 (67 %) | 146 | 0 | 0 |
| Bunnpris | 154 | 138 (90 %) | 28/42 (67 %) | 138 | 0 | 0 |
| Oda (nettbutikk) | 154 | 154 (100 %) | 34/42 (81 %) | 154 | 0 | 0 |
| Engrosnett | 154 | 151 (98 %) | 32/42 (76 %) | 65 | 0 | 86 |

Alder for de eldste prisene: **929 dager** (observasjonsdato 2024-05-05) for alle Rema-linjer, 120 av 154 Kiwi-linjer og 123 av 154 Coop-linjer; de øvrige 31 Coop-linjene er 477 dager. Ingen Rema 1000- eller Coop-pris i prøven er yngre enn 477 dager.

### Hva dette betyr per kjede
- **Rema 1000, Kiwi, Coop:** katalogen har et produkt og en pris for nesten alle linjer, men prisen er nesten alltid gammel (Rema og Coop: ingen fersk pris i prøven; Kiwi: 34 av 154 linjer fersk, ellers 929 dager). Det bekrefter planens forutsetning om at Kassalapp ikke har løpende priser fra disse tre. En slik pris kan bare vises som «estimat» med dato, aldri som dagens pris.
- **Kiwis ferske linjer** gjelder bare paprika, ost, gulrot, melk og fiskekaker (andre varer 929 dager). Hvorfor akkurat disse er ukjent.
- **Meny, SPAR, Joker, Bunnpris, Oda:** nesten alle priser er under to dager gamle. Engrosnett (grossist) er blandet (65 av 154 fersk).
- **Rema** manglet helt (ingen treff) for revet ost, rømme og poteter; Bunnpris for rømme og røde linser; Joker og Bunnpris for spagetti; Engrosnett for kidneybønner. Rema har et tynt katalogutvalg i Kassalapp: søket «melk» ga 11 Rema-produkter mot 79 for Kiwi.

### Utsalg i området (Kassalapp /physical-stores; adresse slutter på stedsnavnet)

| Sted | Kiwi | Rema 1000 | Coop | Meny | SPAR | Joker | Bunnpris |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Oslo | 83 | 79 | 163 | 31 | 8 | 83 | 21 |
| Bergen | 10 | 20 | 28 | 5 | 6 | 7 | 16 |
| Trondheim | 9 | 24 | 38 | 3 | 0 | 4 | 26 |
| Tromsø | 7 | 4 | 26 | 0 | 4 | 2 | 0 |
| Stavanger | 12 | 14 | 46 | 5 | 2 | 6 | 5 |
| Kristiansand | 9 | 12 | 34 | 6 | 3 | 8 | 1 |
| Hamar | 5 | 5 | 7 | 1 | 1 | 1 | 0 |
| Bodø | 6 | 6 | 25 | 0 | 3 | 8 | 5 |
| Alta | 3 | 2 | 15 | 0 | 0 | 0 | 2 |
| Sogndal | 0 | 2 | 4 | 1 | 0 | 0 | 0 |

Coop er summert over alle Coop-formater. Oda har ingen fysiske utsalg. Se begrensning 4.

Full utskrift (per kurv, per vare og kjede): kjør `probe.mjs`; rådata skrives til `phase0/kassalapp-import/out/` (ikke i git).

### Vilkår funnet i Kassalapps `llms.txt` (kontroller mot https://kassal.app/api/faq før avtale)
- Kommersiell bruk (betalt app, abonnement, annonsefinansiert) krever Bedrift, 750 kr/mnd eks. mva. Hobby er gratis og ikke-kommersiell, 60 kall/min.
- Lokal lagring og hurtigbuffer er tillatt (seks timer anbefales). Rå produkt- eller prishistorikk-dumper må ikke publiseres som åpne nedlastinger.
- Ingredienser, allergener og næring er opplyst som veiledende og mulig ufullstendige/utdaterte, og skal **ikke** brukes til allergivarsler. Det er i tråd med regel 4 i CLAUDE.md: Kassalapp kan ikke være kilde til allergenfrihet.
- Produktbilder: Kassalapp eier ikke rettighetene.

### Mangelliste
1. Ingen fersk pris fra Rema 1000 og Coop; Kiwi bare for fem av 24 varer.
2. Ingen kjedepriser per utsalg eller kampanjeområde; ingen opplysning om tilbud, medlemspris eller kampanjevilkår i det vi målte.
3. Ukjent presisjon i pakningsmatching utenom fem varer; ingen manuell kontroll av treff.
4. Ukjent om Kassalapps utsalgsregister er komplett i distriktene.
5. Ikke målt: avvik mot faktisk betalt pris, endringsrate over tid, ytelse over to kampanjeperioder.

### Anbefaling (ikke endelig)
**Snevre inn løftet, ikke fortsett som planlagt.** Kassalapp kan være produktkatalog og kilde til ferske priser for Meny, SPAR, Joker, Bunnpris og Oda, men ikke for Rema 1000, Kiwi og Coop, som er de tre kjedene planen først og fremst vil sammenligne. Med disse dataene kan appen:
- vise «anslått» pris for Rema/Kiwi/Coop bare som status «estimat» med dato (inntil to år gammel), og aldri la den vinne en butikksammenligning uten tydelig merking (regel 2–3 i CLAUDE.md);
- ikke love sluttpris eller «billigste butikk» i Rema/Kiwi/Coop før en annen kilde er avklart (kjedeavtaler, Tjek, kvitteringer).

«Velg pilotområder» støttes ikke av disse tallene, siden Kassalapp-prisene ikke varierer per område. Områdevalg bør heller bygge på hvor ferske data (kvitteringer, avtaler) kan skaffes. Det er ikke avgjort.

## 2. Tjek

Kjørt 2026-11-21 (én kjøring, 24 API-kall, 0 feil). Skript: `phase0/tjek-probe/probe.mjs`. Bare tellinger er lagret; ingen tilbudstekst eller bilder.

### Tillatelse og vilkår
Brukeren opplyser (2026-11-22) at det finnes en skriftlig avtale med Tjek, at den er «ok», og at den er **fortrolig og ikke deles** (verken i repoet eller med utviklingsteamet). **Innholdet er derfor ikke dokumentert her.** Tjeks offentlige vilkår (`https://tjek.com/terms`, siste revisjon 21. februar 2023) er lest 2026-11-22; se `phase0/tjek-avtale.md`. De sier blant annet at API-et *«is only available to customers»* (tjek.com/apis-and-sdks), at kunden bare kan bruke API-et til *«the agreed Services on the Customer's own platforms»* (§ 8.2), og at bruken ikke skal overstige 8 000 000 kall per måned per land med mindre annet er avtalt (§ 8.5). Hva vår avtale sier om omfang, lagring, bilder, kreditering og pris, er ikke dokumentert. API-et svarte uten nøkkel (HTTP 200); det sier ikke noe om hva som er tillatt. For å nå verten ble `api.etilbudsavis.dk` lagt til i tillatte verter i miljøet «Default» (etter godkjenning); det gjelder også senere sesjoner i det miljøet til det fjernes.

### Metode
- Endepunkter etter repoet olgasafonova/tilbudstrolden-mcp (MIT): `GET /v2/dealers`, `GET /v2/offers/search?query=…&country_id=NO&limit=100`. Felt: `pricing.price`, `quantity.size.from` + `quantity.unit.symbol` eller `quantity.pieces.from`, `run_from`, `run_till`, `dealer.name`, `dealer.country.id`.
- **`/dealers` ga ingen norske dealere** (306 oppføringer: 302 danske, 4 tyske). Norske dealere er derfor funnet via treffene i `offers/search` (dealernavn i hvert tilbud), ikke fra et dealerregister. Antall dealere under er en nedre grense.
- Ett åpent søk per vare (24 søkeord, samme varer og treffregler som Kassalapp-testen), ingen dealerfilter. Ingen søk traff sidegrensen (100 treff per side, maks fem sider). 408 treff fra ikke-norske dealere ble ignorert.
- «Gyldig nå» = `run_from` ≤ kjøretidspunkt < `run_till`. «Pris og mengde» = `price` > 0 og størrelse med enhet eller stykketall, nok til å regne pakningspris.
- Kurvene er de samme ti som i Kassalapp-testen (konstruert fra planens oppskrifter, ikke kvitteringer).

### Funn
- **Dealere sett:** 31 norske dealere ga treff. Alle kjedene vi lette etter er representert (REMA 1000, KIWI, Coop Extra, Prix, Mega, Obs, Marked, Meny, SPAR, Joker, Bunnpris), pluss bl.a. Europris, Matkroken og Nærbutikken.
- **Hele utvalget:** 203 treff fra norske dealere, 69 relevante etter ordreglene, 57 av dem gyldige nå, 12 kommende, 0 utløpt. **Alle 57 gyldige hadde pris og mengde**, så pakningspris kan regnes for dem.
- **Dekning per kjede** (andel av 154 varelinjer med minst ett gyldig, relevant tilbud nå):

| Kjede | Linjer med gyldig tilbud nå | Med pris og mengde |
| --- | --- | --- |
| REMA 1000 | 37 (24 %) | 37 |
| KIWI | 50 (32 %) | 50 |
| Coop Extra | 24 (16 %) | 24 |
| Coop Prix | 13 (8 %) | 13 |
| Coop Mega | 0 (0 %) | 0 |
| Coop Obs | 33 (21 %) | 33 |
| Coop Marked | 13 (8 %) | 13 |
| Meny | 7 (5 %) | 7 |
| SPAR | 24 (16 %) | 24 |
| Joker | 9 (6 %) | 9 |
| Bunnpris | 28 (18 %) | 28 |

  Coop Prix og Coop Marked hadde relevante tilbud på henholdsvis 38 og 22 linjer, men bare 13 og 13 er gyldige nå (resten er kommende). Coop Mega ga ingen relevante treff.
- Per kurv varierer andelen mellom 0 og 40 % (full tabell i `phase0/tjek-probe/out/coverage.md` etter kjøring). Tjek-søket skiller ikke på utsalg, så forskjellen mellom kurvene kommer av ulike varer, ikke av landsdel (se begrensning 2).

### Sammenligning med Kassalapp
| Kjede | Kassalapp (ordinærpris, 154 linjer) | Tjek (tilbud nå, 154 linjer) |
| --- | --- | --- |
| Rema 1000 | 85 % med pris, ingen fersk | 24 % har gyldig tilbud |
| Kiwi | 100 % med pris, 34 linjer (22 %) ferske | 32 % har gyldig tilbud |
| Coop (Extra, Prix, Mega, Obs, Marked) | 100 % med pris, ingen fersk | 0–21 % per format |

Tjek fyller **ikke** Kassalapps hull for ordinærpris: det er tilbud (tidsavgrensede kampanjer), ikke hyllepris. At en vare mangler i Tjek betyr bare at ingen kampanje ble funnet. Til gjengjeld er alle gyldige Tjek-tilbud ferske i definisjonens forstand (innenfor kampanjeperioden) og har pris og mengde, noe Kassalapp for Rema og Coop ikke har. Tjek er dermed et mulig supplement for tilbud hos Rema, Kiwi og Coop, men ikke en erstatning for en kilde til dagens ordinærpris.

### Begrensninger
1. Tilbud, ikke ordinærpriser. Vilkår som «3 for 2», medlemspris og minimumskjøp er ikke undersøkt; «pris og mengde» betyr bare at feltene er fylt ut.
2. Ingen geografi: vi har ikke undersøkt om tilbud gjelder alle utsalg eller bare noen områder, så dekning per landsdel er ukjent.
3. Treffene er vurdert automatisk med de samme ordreglene som for Kassalapp (øvre/nedre grense ukjent). Hvor godt Tjeks søk finner varer (recall) er ikke målt.
4. Én kjøring på én dag; ikke målt over to kampanjeperioder.
5. Dealerlisten er en nedre grense (bare dealere med treff på våre 24 varer).
6. Rettigheter (visning, viderebruk, avisbilder) er ikke avklart: offentlige vilkår er lest, vår avtale er fortrolig og omfanget ikke kjent for oss (se over og § 3).

## 3. Rettigheter og avtaler (status 2026-11-22)

Offentlige vilkår er lest 2026-11-22 (nettverket ble åpnet for tjek.com og kjedenes nettsteder). Ingenting er avklart for vår bruk; det som står under er hva sidene sier, ikke en juridisk vurdering.

- **Tjek-vilkår:** `phase0/tjek-avtale.md`. Lest: tjek.com/terms, /apis-and-sdks, /info og /privacy. Vilkårene beskriver API-tilgang for **kunder med avtale**; omfang, pris og varighet står i avtalen (§ 1.2, § 2, § 3, § 8). Dokumentert fra offentlige vilkår: tak på 8 000 000 kall per måned per land (§ 8.5), bruk bare på kundens egne plattformer (§ 8.2), skriftlig godkjenning og rettighetshavernes samtykke for bruk utenfor (§ 8.3), ingen KI-trening (§ 8.6), automatisk fornyelse og seks måneders oppsigelse før kvartalsslutt (§ 2.2), dansk rett. **Ikke kjent for oss:** innholdet i vår avtale (finnes og er «ok» ifølge brukeren, men fortrolig), dermed lagring, avissider, bilder, kreditering, pris, kjeder og geografi. Spørsmål brukeren kan svare på uten å dele avtalen står i `tjek-avtale.md`.
- **Kundeavis-rettigheter per kjede:** `phase0/kundeavis-rettigheter.md`. Lest: rema.no, kiwi.no, coop.no, meny.no, spar.no, joker.no, bunnpris.no, europris.no, norgesgruppen.no (om-oss, personvern, vilkår, forsidens avislenke). Eier og org.nr. er registrert for alle ni. **Meny, SPAR og Joker** har en opphavsrettsklausul om at innhold på nettsidene ikke kan *«lastes ned, kopieres eller benyttes på annen måte»* uten lov eller *«uttrykkelig skriftlig forhåndssamtykke»*. **De andre** har ingen bruksvilkår for nettstedets innhold som vi fant. **Ingen kjede** sier noe offentlig om API, datafeed, partnerprogram eller Tjek. Matkroken og Nærbutikken er ikke undersøkt. Anbefalt visningsmåte er uendret: ingen avisinnhold, ingen bilder, ingen lagring, bare Tjek-live der avtalen tillater det.
- **Kjedeavtaler:** utkast til henvendelser i `phase0/utkast/`: Rema 1000, Kiwi/NorgesGruppen, Coop og oppfølging til Tjek. **Ikke sendt, og skal ikke sendes** uten at brukeren ber om det (brukerens beslutning 2026-11-22). Avsender er plassholder `[AVSENDER]`; behandlingsansvarlig er nå AVVR AS (org.nr. 935941644), men avsender er ikke byttet ut fordi utkastene ikke skal sendes nå.

## Port – Fase 0

- [ ] Kildedekning dokumentert per område og kjede, med mangelliste — **delvis**: Kassalapp og Tjek (tilbud) dokumentert (over); kjedeavtaler: utkast til henvendelser finnes (ikke sendt); Open Prices ikke vurdert.
- [ ] Ti prøvekurver sammenlignet med faktiske kjøp i ulike landsdeler — **ikke gjort**: kurvene er laget og kjørt mot Kassalapp, men det finnes ingen kvitteringer å sammenligne med.
- [ ] Prisgrunnlag for en reell prøvehandel — **ikke gjort**: avhenger av kvitteringer og en kilde med fersk Rema/Kiwi/Coop-pris.
- [ ] Tillatt visningsmåte avklart for hver kundeavis — **ikke avklart**: Tjeks og ni kjeders offentlige vilkår er lest (§ 3). Ingen kjede gir offentlig tillatelse; tre (Meny, SPAR, Joker) krever skriftlig forhåndssamtykke for bruk av innhold. Tjeks vilkår legger omfanget i en avtale som brukeren sier finnes, men som er fortrolig; omfanget er ikke kjent for oss. Gjenstår: (1) brukeren svarer på spørsmålene i `tjek-avtale.md` (lagring, bilder/avissider, kjeder), (2) Matkroken og Nærbutikken, (3) avklaring med kjedene, hvis brukeren bestemmer det (utkastene er ikke sendt).

**Pilotområde:** brukeren har valgt hele Norge (lukket pilot). Det endrer ikke tallene over: Kassalapp-prisene varierer ikke per område, og Tjek-søket skiller ikke på utsalg. Pris kan fortsatt ikke måles i piloten (se `docs/pilot-sjekkliste.md`, E1).
