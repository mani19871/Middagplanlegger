# Fase 0 – resultater

Status: **delvis**. Kassalapp-importtesten er kjørt (2026-11-21). De øvrige delprøvene (Tjek, kjedeavtaler, kundeavis-rettigheter) er ikke startet, og to av portkriteriene krever data vi ikke har (se «Port»).

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

## Port – Fase 0

- [ ] Kildedekning dokumentert per område og kjede, med mangelliste — **delvis**: Kassalapp dokumentert (over); Tjek, kjedeavtaler og Open Prices ikke vurdert.
- [ ] Ti prøvekurver sammenlignet med faktiske kjøp i ulike landsdeler — **ikke gjort**: kurvene er laget og kjørt mot Kassalapp, men det finnes ingen kvitteringer å sammenligne med.
- [ ] Prisgrunnlag for en reell prøvehandel — **ikke gjort**: avhenger av kvitteringer og en kilde med fersk Rema/Kiwi/Coop-pris.
- [ ] Tillatt visningsmåte avklart for hver kundeavis — **ikke startet**.
