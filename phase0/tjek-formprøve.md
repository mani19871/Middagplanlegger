# Formprøve mot Tjek (api.etilbudsavis.dk/v2)

Kjørt 2026-11-22 (ca. 13:05 UTC). Skript: `phase0/tjek-probe/form-probe.ts` (14 kall) og `phase0/tjek-probe/form-probe-oppfolging.ts` (11 kall). Formål: bekrefte eller avkrefte antakelsene i `src/offers/tjek.ts`, `src/offers/household.ts` og `server/offers/` (tilbudssøk, kundeaviser, sider, bildeverter, paginering, kallgrenser).

**Hva som er lagret:** bare felt- og typebeskrivelser, antall, andeler og vertsnavn. Ingen rådata, ingen tilbudstekst, ingen priser, ingen bilde-URL-er. Skriptene skriver bare aggregater til skjermen; utdata ligger ikke i repoet.

**Rammer for kjøringen:** 25 GET-kall totalt (grense 40), 1,5 s mellom hvert kall, ett om gangen, uten nøkkel og uten innlogging, generisk User-Agent. Stopp ved første 401/403/429 (inntraff ikke). Nettet gikk via sesjonens proxy (`NODE_USE_ENV_PROXY=1`). Tillatelsen er brukerens opplysning (fortrolig avtale, `phase0/tjek-avtale.md`); kallgrensen i avtalen er ikke kjent for oss, derfor det lave tallet.

| Kall | Antall | Svar |
| --- | --- | --- |
| `/offers/search?query=…&country_id=NO&limit=100` (7 søkeord) | 7 | 200 |
| `/offers/search` med `offset=100` | 1 | 200 |
| `/offers/search` med `limit=250` | 1 | **400** |
| `/catalogs?country_id=NO&limit=100&offset=0…900` | 10 | 200 |
| `/catalogs/:id/pages` (én norsk avis, gyldig i dag) | 1 | 200 |
| `/catalogs/:id` | 1 | 200 |
| `/offers/search` «egg», «tortilla» (stykkvarer) | 2 | 200 |
| `/offers/search` og `/catalogs` med fast punkt (Oslo sentrum, `r_lat`/`r_lng`/`r_radius=700000`; ingen brukerposisjon) | 2 | 200 |
| **Sum** | **25** | 24 × 200, 1 × 400 |

## 1. Tilbudssøk (`/v2/offers/search`)

### Treff per søkeord

«Norske» = `dealer.country.id === 'NO'`. «Husholdning» = `classifyHousehold` med regelfilen i repoet (uten «kan være mat»). «Mat» = overskriften treffer et matord fra `OFFER_TERMS`. «Gyldige i dag» = gyldig 2026-11-22.

| Søkeord | Type | Treff | Norske | Gyldige i dag | Husholdning | Mat | Annet | Kjeder |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| kjøttdeig | mat | 25 | 25 | 12 | 0 | 12 | 13 | 9 |
| laks | mat | 100 | 12 | 6 | 0 | 12 | 0 | 7 |
| pasta | mat | 100 | 18 | 15 | 0 | 5 | 13 | 8 |
| oppvask | husholdning | 9 | 2 | 2 | 0 | 0 | 2 | 2 |
| toalettpapir | husholdning | 12 | 12 | 10 | 10 | 0 | 2 | 10 |
| batterier | husholdning | 100 | 17 | 17 | 13 | 0 | 4 | 7 |
| vaskemiddel | husholdning | 67 | 12 | 10 | 7 | 0 | 5 | 9 |

- **`country_id=NO` filtrerer ikke søket.** Av 413 treff var 98 norske (24 %); resten DK 264, SE 33, FI 17, FO 1. Tre søk nådde taket på 100 treff med bare 12–18 norske.
- **Andeler:** husholdningssøkene ga 43 norske treff, og 30 av dem (70 %) ble klassifisert som husholdning. Matsøkene ga 55 norske treff, 0 av dem husholdning, og 29 (53 %) traff et matord. «Oppvask» (generelt ord, ikke et søkeord i regelfilen) ga bare 2 norske treff, og ingen av dem ble klassifisert. 72 av 98 norske treff (73 %) var gyldige i dag; resten var kommende.
- **Tolket med `parseTjekOffer`** (98 norske): pris 96 (de 2 andre hadde annen valuta enn NOK og fikk ukjent pris, som tiltenkt), mengde i g/ml 56 (57 %; resten er stykk), stykk/antall 98, bilde 98, mengde som spenn 5 (blir ukjent mengde). Ingen ukjente enhetssymboler.

### Felt (alle 413 treff)

| Felt | Andel | Type | Merknad |
| --- | --- | --- | --- |
| `id`, `ern`, `heading` | 100 % | string | |
| `description` | 100 % | string | Aldri `null` i prøven (kan være tom) |
| `pricing.price` | 100 % | tall (heltall eller desimal, kroner) | |
| `pricing.pre_price` | 100 % | tall eller `null` | |
| `pricing.currency` | 100 % | string | Verdier: DKK, NOK, SEK, EUR |
| `quantity.unit.symbol` | 100 % | string | Verdier: g, pcs, kg, l, ml |
| `quantity.unit.si.symbol` / `.factor` | 100 % | string / tall | kg, pcs, l / 1 eller 0,001 |
| `quantity.size.from` / `.to` | 100 % | tall | Alltid med; spenn forekommer |
| `quantity.pieces.from` / `.to` | 100 % | heltall | Alltid med (1 for vanlige pakker) |
| `quantity.pieces.min` / `.max` | 100 % | heltall eller `null` | Ikke i våre typer; leses ikke |
| `run_from`, `run_till`, `publish` | 100 % | streng `ÅÅÅÅ-MM-DDTtt:mm:ss+hhmm` | Sone uten kolon; `Date.parse` i Node tolker den |
| `dealer_id`, `dealer.id`, `dealer.name`, `dealer.country.id` | 100 % | string | |
| `branding.name` | 100 % | string | |
| `images.thumb` / `.view` / `.zoom` | 100 % | https-adresse | Vert: `image-transformer-api.tjek.com` |
| `catalog_id`, `catalog_page` | 100 % | string / heltall | Tilbudet peker til avis og side; leses ikke |
| `category_ids` | 100 % | array | **Tom i alle 413 treff** |
| `dealer.category_ids` | 100 % | array | Tom i alle |
| `branding.logo`, `dealer.logo`, `*.pageflip.logo` | 100 % | https-adresse | Kjedelogoer (`image-transformer-api.tjek.com`); leses ikke (ingen logoer før Tjek bekrefter) |
| `links.webshop`, `branding.website`, `dealer.website`, `catalog_url`, `dealer_url` | 100 % | adresse eller `null` | Leses ikke |
| `store_id`, `store_url` | 100 % | `null` | Ingen butikk/utsalg i svaret |
| `display_run_till` | 100 % | boolean | |

**Kategori eller avdeling:** finnes ikke i praksis. Feltet `category_ids` finnes, men var tomt i alle treff. Klassifiseringen av husholdningsvarer må fortsatt bygge på overskriften alene.

### Stykkvarer (oppfølging, «egg» og «tortilla»)

- Vektvarer har `pieces = 1`, unntatt flerpakninger (`g` med `pieces = 3` sett én gang); de merkes allerede «flerpakning» i `match.ts`.
- `pcs`-varer har antallet i `size`. 11 av 13 norske eggtilbud har `pcs`, `size = 1` og `pieces = 1`. Med bare aggregater kan vi ikke se om «1 stk» betyr ett egg eller én pakke. Koden viser «1 stk», men stykktilbud uten vekt gir aldri hint eller sum (`toHints` krever mengde i samme enhet). **Ikke rettet; må kontrolleres mot overskrifter i Kontroll.**
- `pcs` med `pieces > 1` (2 av 3 tortilla-treff med `pcs`): koden tok `size` som antall og ignorerte `pieces`. **Rettet:** antallet er nå ukjent, og tilbudet går til kontroll (se under).

## 2. Kundeaviser (`/v2/catalogs`) og sider

- **`country_id=NO` filtrerer heller ikke kataloglista.** De tre første sidene (300 kataloger) hadde 145 norske, DE 111, DK 22, SE 14, FI 6 og PL 2. Sidene 4–10 (offset 300–900) var alle fulle (100) med **0 norske**. Lista har altså over 1 000 kataloger, og i denne kjøringen lå alle norske først. Hvorfor (sortering, eller avstand fra avsenderens IP), vet vi ikke. `listCatalogs` leser høyst 5 sider og fikk dermed alle 145 her.
- Tolket med `parseTjekCatalog`: 145 av 145 norske, 121 gyldige i dag, alle med `page_count`, 131 med tittel (`label` er alltid en streng, men tom for 14; blir `null`).
- **Felt i lista** (alle 300): `id`, `ern`, `label`, `dealer_id`, `dealer.{id,name,country.id,…}`, `branding.name`, `run_from`/`run_till`/`publish` (samme datoformat som tilbud), `page_count` (heltall), `offer_count` (heltall), `all_stores` (boolean; 48 sanne), `types` (string-array), `tags`, `category_ids` (string-array, ikke tom), `dimensions.width` (alltid 1) og `.height` (forhold, f.eks. 1,13–1,76), `images.{thumb,view,zoom}` (forsiden), `pdf_url` (`null` eller https på `squid-api.tjek.com`), `incito_publication_id` (`null`), `store_id` (`null`), samt et objekt `pages` med arrayene `thumb`, `view` og `zoom`. **Disse arrayene var tomme i alle 300**, så sidene må hentes for seg, slik koden gjør.
- **`/v2/catalogs/:id`** har samme form som et element i lista.
- **`/v2/catalogs/:id/pages`**: en liste av objekter `{ thumb, view, zoom }`, alle https på `image-transformer-api.tjek.com`. Den prøvde avisen hadde 39 sider, likt `page_count`, og alle 39 ble tolket med `view`.

## 3. Bildeverter (til `TJEK_IMAGE_HOSTS`)

| Bruk | Vert |
| --- | --- |
| Produktbilder (`images.thumb/view/zoom` i tilbud) | `image-transformer-api.tjek.com` |
| Avissider (`/catalogs/:id/pages`) og forsider (`images` i katalog) | `image-transformer-api.tjek.com` |
| Kjedelogoer (`branding.logo`, `dealer.logo`, `pageflip.logo`) | `image-transformer-api.tjek.com` (leses ikke av appen) |
| `pdf_url`, `catalog_url`, `dealer_url` (ikke bilder) | `squid-api.tjek.com` (leses ikke) |

Én vert dekker alt appen viser: `TJEK_IMAGE_HOSTS=image-transformer-api.tjek.com`. Den står nå som forslag i `docs/drift/env.eksempel`; standarden i koden er fortsatt tom (driftens valg). **Merk:** logoene ligger på samme vert. CSP-en hindrer dem derfor ikke; at de ikke vises, avhenger av at parserne ikke leser logo-feltene (de gjør det ikke).

## 4. Paginering og grenser

- `limit` høyst **100**: `limit=100` ga 100 treff, `limit=250` ga **HTTP 400**. Koden sender aldri over 100 (`listDealers` og `listCatalogs` 100; søket nå 100, se under).
- `offset` virker: `offset=100` ga 100 nye treff for «pasta».
- Ingen totalantall, ingen `Link: rel="next"` og ingen pagineringshoder. Slutt på lista kjennes bare på at en side har færre enn `limit` treff (som koden antar).

## 5. Svarhoder og rate limit

- Hodenavn i svarene: `access-control-allow-credentials`, `access-control-expose-headers`, `content-encoding`, `content-length`, `content-type`, `cross-origin-opener-policy`, `date`, `link`, `permissions-policy`, `referrer-policy`, `server`, `strict-transport-security`, `transfer-encoding`, `vary`, `x-cloud-trace-context`, `x-content-type-options`.
- **Ingen rate limit-hoder** (ingen `x-ratelimit-*`, `retry-after` eller lignende) og ingen tall-hoder om kvote. `Link` hadde bare `rel="terms-of-service"`.
- Ingen 429 i 25 kall med 1,5 s mellom. Det sier ingenting om avtalens kallgrense, som fortsatt ikke er kjent for oss. Innsamleren kan ikke lese en grense fra svarene og må fortsatt styre etter eget kallbudsjett og bakoff (uendret).

## 6. Fast punkt i stedet for `country_id` (bare prøvd, ikke tatt i bruk)

- Søket «laks» med `r_lat=59.9139&r_lng=10.7522&r_radius=700000` (Oslo sentrum, ingen brukerposisjon) ga 12 treff, alle norske. Det er like mange norske som blant de 100 treffene uten punkt.
- Kataloglista med samme punkt ga 86 kataloger (84 norske, 2 svenske) mot 145 norske uten punkt. **Punktet mister altså aviser** (trolig kjeder uten butikk innenfor radiusen, f.eks. i Nord-Norge). Ikke tatt i bruk; landsdekkende appen ville miste aviser.

## Antatt i koden vs funnet

| Antakelse i koden | Funnet | Status |
| --- | --- | --- |
| `country_id` filtrerer ikke alltid; vi filtrerer på `dealer.country.id` (`searchOffers`, `listDealers`, `parseTjekCatalog`) | Filtrerer verken søk eller kataloger; `dealer.country.id` er alltid med | **Bekreftet** (og nødvendig) |
| Søket ber om `limit × 3` (60) og kutter etter landfiltrering | Opptil 88 % av treffene er fra andre land; 60 kan miste norske treff | **Avkreftet → rettet:** ber alltid om 100 (Tjeks maks), fortsatt ett kall per søk |
| `limit` 100 per side (`listCatalogs`, `listDealers`) | 100 er maks; over 100 gir 400 | **Bekreftet** |
| Slutt på lista når en side har under 100 | Ingen totalantall eller `next`-lenke | **Bekreftet** (eneste mulighet) |
| `pricing.price`/`pre_price` i kroner, `currency` NOK ellers ukjent pris | Desimaltall i kroner; DKK, SEK, EUR forekommer (også 2 hos norske kjeder) | **Bekreftet** |
| Enhet fra `quantity.unit.symbol` (g, kg, hg, ml, cl, dl, l, pcs/stk); `si` brukes ikke | Sett: g, kg, ml, l, pcs | **Bekreftet** (hg, cl, dl, stk ikke sett, ufarlig) |
| Spenn i `size` er ukjent mengde | Spenn finnes (5 av 98 norske) | **Bekreftet** |
| `pcs`: antall = `size`; `pieces` ignoreres | `pcs` med `pieces > 1` finnes (flere pakker) | **Avkreftet → rettet:** antallet er ukjent og går til kontroll |
| `pieces` kan være `null` | Alltid med (heltall) | Ufarlig (koden tåler begge) |
| `description: string \| null` | Alltid string i prøven | Ufarlig |
| Tidspunkt med sone, omregnet til norsk dato | `+hhmm` uten kolon; `Date.parse` i Node tolker det | **Bekreftet** |
| Produktbilde i `images.view` (ellers `zoom`, `thumb`), bare https | Alle tre finnes i 100 %, https | **Bekreftet** |
| Ingen kategori vi bruker (`household.ts`) | `category_ids` finnes, men er tom i alle treff | **Bekreftet** |
| Kjede fra `branding.name`, ellers `dealer.name` | Begge alltid med | **Bekreftet** |
| `/v2/catalogs` med `id`, `label`, `branding.name`/`dealer.name`, `run_from`, `run_till`, `page_count` | Alle med; `label` kan være tom | **Bekreftet** |
| Sidene hentes med `/v2/catalogs/:id/pages`, liste med `thumb`/`view`/`zoom` | Nøyaktig den formen; `pages` i lista er tomme arrayer | **Bekreftet** |
| Katalog-id er `[A-Za-z0-9_-]{1,64}` | Alle 145 norske id-er godtatt | **Bekreftet** |
| Høyst 5 katalogsider er nok | Alle 145 norske lå på side 1–3 i denne kjøringen; lista har over 1 000 | **Bekreftet her**, men rekkefølgen er ikke forklart (se «Gjenstår») |
| Bildeverter ukjent, `TJEK_IMAGE_HOSTS` tom | Én vert: `image-transformer-api.tjek.com` | **Avklart** (forslag i `env.eksempel`) |
| Ingen rate limit-informasjon å lese | Ingen slike hoder | **Bekreftet** |

## Rettet i koden (test først, syntetisk fixture)

Testene står i `src/offers/tjek-form.test.ts`. Fixturen speiler formen over med **oppdiktede verdier merket som syntetiske** (example-/test-domener, ingen ekte tilbud eller bildeadresser). To av testene var røde før rettingen:
1. `TjekSource.searchOffers` ber om `limit=100` (`TJEK_MAX_LIMIT`) i stedet for `limit × 3`, og kutter fortsatt til ønsket antall etter landfiltrering. Samme antall kall; kallbudsjett og innsamlingsfrekvens er uendret.
2. `parseTjekOffer`: `pcs` med `pieces > 1` gir `pieces: null` («mengde ukjent», kontroll) i stedet for å ta `size` som antall.

Ellers er kommentarene i `src/offers/tjek.ts`, `server/offers/images.ts`, `server/index.ts`, `src/offers/catalogs.test.ts`, `docs/synk.md`, `docs/fase1-status.md`, `docs/installasjon-ubuntu.md`, `docs/drift/env.eksempel` og `CLAUDE.md` oppdatert fra «ikke prøvd» til det som er funnet.

## Gjenstår

- **Eggtilfellet:** `pcs` med `size = 1` (11 av 13 eggtilbud) kan bety én pakke, ikke ett egg. Det påvirker ikke sum eller hint (stykktilbud uten vekt gir ingen av delene), men «1 stk» kan vises i Kontroll og Aviser. Må vurderes av en redaktør mot overskriftene.
- **Katalogrekkefølgen:** at alle norske aviser lå på de tre første sidene, er sett én gang. Ligger de lenger ut ved neste kjøring (f.eks. fordi serveren står i et annet land), mister vi aviser etter side 5. Innsamleren bør logge antall norske per side (bare tall) når den kjører i drift. Et fast punkt løser det ikke (mister aviser).
- **Søk med mange utenlandske treff:** også med 100 kan norske treff ligge etter de første 100 (ikke målt; `offset` virker, men ville gi flere kall, og kallbudsjettet er ikke endret her).
- **Husholdningsordene:** bare tre husholdningsord fra regelfilen er prøvd (toalettpapir, batterier, vaskemiddel), pluss det generelle «oppvask». Resten av de 27 søkeordene er ikke prøvd. Om de gjenværende 30 % av norske treff fra husholdningssøkene (13 av 43) bør fanges med flere søkeord, må redaktøren se på i Kontroll.
- **Avtalen:** kallgrense, kreditering, varighet og pris er fortsatt ikke kjent for oss (`phase0/tjek-avtale.md`). Formprøven sier ingenting om hva som er tillatt.
