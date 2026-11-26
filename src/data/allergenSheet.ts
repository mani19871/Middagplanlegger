// Arket til allergengjennomgangen (docs/allergen-gjennomgang.md). Ren funksjon av katalogen: alt som står i arket kommer fra
// varene og oppskriftene i koden (src/data/catalog.ts). Ingen allergenopplysninger er lagt til her. Ingen klokke,
// ingen tilfeldighet og ingen nettverk, så samme katalog gir samme ark. Genereres med `npm run allergen-ark`.
import { ALLERGENS, ALLERGEN_LABEL } from '../engine/allergens';
import { recipeTags } from '../engine/planner';
import type { Allergen, Catalog, FoodTag, Ingredient, Product, Recipe } from '../engine/types';

const short = (a: Allergen) => ALLERGEN_LABEL[a].split(' (')[0];
const names = (as: Allergen[]) => (as.length > 0 ? as.map(short).join(', ') : '–');
const inOrder = (as: Iterable<Allergen>): Allergen[] => { const s = new Set(as); return ALLERGENS.filter((a) => s.has(a)); };
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const ANIMAL: FoodTag[] = ['storfe', 'svin', 'lam', 'kylling', 'fisk', 'skalldyr'];
/** Kosttagger som også er et av de 14 allergenene. */
const TAG_ALLERGEN: Partial<Record<FoodTag, Allergen>> = { fisk: 'fisk', skalldyr: 'skalldyr', notter: 'notter' };

/**
 * Hvorfor koden selv sier at en vare er uavklart (fra kommentarene i src/data/catalog.ts). Bare for visning i arket;
 * en vare uten oppføring her får teksten «ingen begrunnelse i koden».
 */
const UAVKLART_BEGRUNNELSE: Record<string, string> = {
  kokos400: 'Noen merker har tilsatt sulfitt (konserveringsmiddel).',
  fk500: 'Typisk fisk, hvetemel, melk og egg, ofte også soya; innholdet varierer mellom merker.',
  tort8: 'Hvete, men noen merker har også melk eller soya.',
  reker300: 'Sulfitt brukes ofte mot mørkfarging.',
  mak170: 'Tomatsausen kan ha gluten (stivelse) og andre tilsetninger.',
  nud250: 'Ofte eggnudler; egg er ikke avklart.',
  polse500: 'Innholdet varierer mellom merker (ofte melk, noen ganger hvete, sennep eller selleri).',
  lasag500: 'Hvete, men noen merker har også egg.',
  fbol560: 'Typisk fisk og melk, men innholdet varierer mellom merker (noen har hvete eller andre tilsetninger).',
};

/**
 * Enkle navnemønstre som sier at en vare «burde» ha en tagg eller et allergen. Brukes bare til å peke ut steder en person
 * bør se på (aldri til å sette merking), og er bevisst smale.
 */
const NAME_TAG: [FoodTag, RegExp][] = [
  ['belgvekster', /erter|bønne|linse|kikert|tofu/i], ['kylling', /kylling/i], ['svin', /svin|flesk|bacon|skinke/i],
  ['storfe', /^kjøttdeig|storfe/i], ['lam', /^(lam|får)/i], ['skalldyr', /reker|krabbe|hummer/i],
  ['fisk', /torsk|laks|seifilet|hyse|sild|makrell|fisk/i], ['notter', /nøtt|mandel/i],
];
const NAME_ALLERGEN: [Allergen, RegExp][] = [
  ['gluten', /hvete|pasta|spagetti|nudler|tortilla/i], ['melk', /(?<!kokos)melk|fløte|rømme|norvegia|(^|\s)ost(\s|$)/i],
  ['egg', /(^|\s)egg(\s|$)/i], ['soya', /soya|tofu/i], ['fisk', /torsk|laks|seifilet|hyse|sild|makrell|fisk/i], ['skalldyr', /reker|krabbe|hummer/i],
];

export interface Deviation { recipeId: string; kind: string; text: string }

const wordRe = /\b(karri|curry|\w*krydder|buljong|brødsmul\w*|smør\w*|smurt|margarin)\b/gi;

/**
 * Mulige avvik som skriptet finner ved å sammenligne dataene med hverandre. Det er ikke fasit: hver treff er et sted
 * en person bør se ekstra nøye. Rettes aldri av skriptet. Ingrediensnivå har `recipeId` `vare:<id>`.
 */
export function possibleDeviations(catalog: Catalog): Deviation[] {
  const out: Deviation[] = [];
  const ing = (id: string): Ingredient | undefined => catalog.ingredients.find((i) => i.id === id);
  const prods = (id: string): Product[] => catalog.products.filter((p) => p.ingredient === id);

  for (const i of catalog.ingredients) {
    const ps = prods(i.id);
    if (ps.length === 0) continue;
    const sig = (p: Product) => `${inOrder(p.allergens).join(',')}|${p.allergenKnown}`;
    if (new Set(ps.map(sig)).size > 1)
      out.push({ recipeId: `vare:${i.id}`, kind: 'produkter-ulike', text: `${i.name}: produktene har ulik allergenmerking (${ps.map((p) => `${p.name}: ${names(p.allergens)}${p.allergenKnown ? '' : ', uavklart'}`).join('; ')}).` });
    for (const [t, re] of NAME_TAG)
      if (re.test(i.name) && !(i.tags ?? []).includes(t))
        out.push({ recipeId: `vare:${i.id}`, kind: 'navn-uten-tagg', text: `Navnet «${i.name}» tyder på kosttaggen «${t}», men varen har den ikke (kosttaggene styrer «unngå råvare»).` });
    for (const [a, re] of NAME_ALLERGEN)
      for (const p of ps)
        if (re.test(`${i.name} ${p.name}`) && !p.allergens.includes(a))
          out.push({ recipeId: `vare:${i.id}`, kind: 'navn-uten-allergen', text: `Navnet «${p.name}» tyder på allergenet ${short(a)}, men produktet er ikke merket med det${p.allergenKnown ? '' : ' (produktet er uavklart)'}.` });
    for (const t of i.tags ?? []) {
      const al = TAG_ALLERGEN[t];
      if (al && !ps.some((p) => p.allergens.includes(al)))
        out.push({ recipeId: `vare:${i.id}`, kind: 'tagg-uten-allergen', text: `${i.name} har kosttaggen «${t}», men ingen av produktene er merket med allergenet ${short(al)}.` });
    }
    for (const [t, al] of Object.entries(TAG_ALLERGEN) as [FoodTag, Allergen][])
      if (ps.some((p) => p.allergens.includes(al)) && !(i.tags ?? []).includes(t))
        out.push({ recipeId: `vare:${i.id}`, kind: 'allergen-uten-tagg', text: `${i.name} er merket med allergenet ${short(al)}, men mangler kosttaggen «${t}».` });
  }

  for (const r of catalog.recipes) {
    const fromProducts = new Set<Allergen>();
    for (const l of r.lines) for (const p of prods(l.ingredient)) for (const a of p.allergens) fromProducts.add(a);
    for (const a of inOrder(fromProducts))
      if (!r.allergens.includes(a)) out.push({ recipeId: r.id, kind: 'allergen-mangler-i-rett', text: `${r.name}: en vare har allergenet ${short(a)}, men det står ikke i rettens allergenliste (filteret ser bare på rettens liste).` });
    for (const a of r.allergens)
      if (!fromProducts.has(a)) out.push({ recipeId: r.id, kind: 'allergen-uten-vare', text: `${r.name}: ${short(a)} står i rettens allergenliste, men ingen vare i retten er merket med det (kan være satt bevisst, for eksempel for noe som ikke er ført opp som vare).` });

    const tags = recipeTags(r, catalog.ingredients);
    const animal = ANIMAL.filter((t) => tags.has(t));
    if (r.vegetarian && animal.length > 0) out.push({ recipeId: r.id, kind: 'vegetar-med-dyretagg', text: `${r.name} er merket vegetar, men har råvaretaggene ${animal.join(', ')}.` });
    if (!r.vegetarian && animal.length === 0) out.push({ recipeId: r.id, kind: 'vegetar-uten-dyretagg', text: `${r.name} er ikke merket vegetar, men har ingen råvaretagger for kjøtt, fisk eller skalldyr.` });
    if (!r.vegetarian && (ANIMAL as string[]).includes(r.protein) && !tags.has(r.protein as FoodTag))
      out.push({ recipeId: r.id, kind: 'protein-uten-tagg', text: `${r.name}: proteinet er oppgitt som ${r.protein}, men ingen vare har den taggen.` });

    const found = new Set<string>();
    for (const m of `${r.name} ${r.steps.join(' ')}`.matchAll(wordRe)) found.add(m[0].toLowerCase());
    const lineNames = r.lines.map((l) => ing(l.ingredient)?.name.toLowerCase() ?? '').join(' ');
    const missing = [...found].filter((w) => !lineNames.includes(w));
    if (missing.length > 0)
      out.push({ recipeId: r.id, kind: 'ord-i-steg', text: `${r.name}: navn eller fremgangsmåte nevner ${missing.map((w) => `«${w}»`).join(', ')}, som ikke er ført opp som vare. Allergener fra det er ikke med i merkingen.` });
  }
  return out.sort((a, b) => a.recipeId.localeCompare(b.recipeId) || a.kind.localeCompare(b.kind));
}

const amountText = (n: number, unit: string) => `${n} ${unit}`;

function recipeSection(r: Recipe, i: number, catalog: Catalog): string {
  const lines: string[] = [];
  const prods = (id: string) => catalog.products.filter((p) => p.ingredient === id);
  lines.push(`### ${i + 1}. ${cell(r.name)} (\`${r.id}\`)`, '');
  const o = r.origin;
  lines.push(`Opphav: ${o ? `${o.kind}, status ${o.status}` : 'mangler'}. Tid: ${r.minutes} min. Mengdene gjelder ${r.baseServings} porsjoner.`, '');
  lines.push('| Vare | Mengde | Produkt i katalogen | Allergener fra varen | Merkestatus |', '| --- | --- | --- | --- | --- |');
  const unclear: string[] = [];
  for (const l of r.lines) {
    const ing = catalog.ingredients.find((x) => x.id === l.ingredient);
    const ps = prods(l.ingredient);
    const label = ing?.name ?? l.ingredient;
    if (ps.length === 0) {
      lines.push(`| ${cell(label)} | ${amountText(l.amount, ing?.unit ?? '')} | ingen (basisvare uten produkt) | ikke merket | ikke merket |`);
      unclear.push(label);
      continue;
    }
    const al = inOrder(ps.flatMap((p) => p.allergens));
    const known = ps.every((p) => p.allergenKnown);
    if (!known) unclear.push(label);
    lines.push(`| ${cell(label)} | ${amountText(l.amount, ing?.unit ?? '')} | ${cell(ps.map((p) => p.name).join('; '))} | ${names(al)} | ${known ? 'kjent' : '**uavklart**'} |`);
  }
  lines.push('');
  const fromProducts = inOrder(r.lines.flatMap((l) => prods(l.ingredient).flatMap((p) => p.allergens)));
  const tags = recipeTags(r, catalog.ingredients);
  lines.push(`- **Appens allergener for retten** (det filteret bruker): ${names(inOrder(r.allergens))}`);
  lines.push(`- Samlet fra varene: ${names(fromProducts)}`);
  const notMarked = ALLERGENS.filter((a) => !r.allergens.includes(a));
  lines.push(`- Ikke merket (kontroller at ingen av disse finnes i retten): ${notMarked.map(short).join(', ') || '–'}`);
  lines.push(`- **Kosttagger:** vegetar: ${r.vegetarian ? 'ja' : 'nei'}. Hovedprotein: ${cell(r.protein)}. Råvaretagger fra varene: ${tags.size > 0 ? [...tags].sort().join(', ') : 'ingen'}.`);
  lines.push(`- Uavklart eller uten merking: ${unclear.length > 0 ? unclear.map(cell).join(', ') : 'ingen'}.`);
  lines.push(`- Fremgangsmåte (for å se om noe mangler i varelisten): ${r.steps.map(cell).join(' ')}`);
  lines.push('', '**Gjennomgang (fylles ut av en person):**', '',
    '- Allergener stemmer: [ ] ja  [ ] nei',
    '- Kosttagger stemmer: [ ] ja  [ ] nei',
    '- Kommentar:',
    '- Gjennomgått av (rolle, ikke navn):',
    '- Dato (ÅÅÅÅ-MM-DD):', '');
  return lines.join('\n');
}

const INTRO = `# Allergengjennomgang av oppskriftene

**Status: UTKAST. Kontrollen er ikke ferdig før feltene under hver oppskrift er fylt ut av en person.** Arket er laget av skriptet \`npm run allergen-ark\` ut fra varene og oppskriftene i \`src/data/catalog.ts\`. Alt som står i tabellene kommer fra koden; skriptet har ikke lagt til egne allergenopplysninger. Appen garanterer aldri allergenfrihet, og dette arket gjør det heller ikke.

## Slik gjennomgår du arket

### Hvorfor
Allergi- og kostfiltrene i appen bygger på allergenmerkingen i dette arket. Før noen med allergi eller kostkrav inviteres, skal en person kontrollere at merkingen stemmer. Du trenger ikke kunne programmere. Du trenger arket og din egen kunnskap om hva slike varer vanligvis inneholder (eller pakningen, hvis du har den).

### De 14 allergenene
Appen bruker EUs liste. Navnet i parentes er det som står i koden: ${ALLERGENS.map((a) => `${short(a)} (\`${a}\`)`).join(', ')}.

### Én oppskrift om gangen
1. **Les varelisten.** Stemmer varene og mengdene med retten slik fremgangsmåten under tabellen beskriver den? Mangler det noe som brukes i fremgangsmåten (for eksempel krydder, buljong, smør eller brødsmuler), står det under «Mulige avvik».
2. **Se på hver vare.** Kolonnen «Allergener fra varen» viser hva appen mener varen inneholder. Stemmer det? Mangler noe varen vanligvis inneholder?
3. **Se på «Appens allergener for retten».** Det er denne listen filteret bruker. Den skal dekke allergenene til alle varene. Les også linjen «Ikke merket»: er det noe i den listen som faktisk finnes i retten?
4. **Se på kosttagger.** «Vegetar: ja» betyr at retten kommer med når brukeren har valgt vegetar. «Råvaretagger» (storfe, svin, lam, kylling, fisk, skalldyr, belgvekster, nøtter) brukes når brukeren velger å unngå en råvare. Gluten, melk (inkludert laktose) og egg er allergener i appen, ikke egne kosttagger.
5. **Fyll ut feltene under retten.** Kryss av ved å skrive en x mellom hakeparentesene: \`[x] ja\`.
   - **Allergener stemmer: ja** bare hvis du har sett over alt ovenfor og ikke fant noe galt.
   - **Kosttagger stemmer: ja** på samme måte for vegetar og råvaretagger.
   - **Gjennomgått av:** skriv rolle (for eksempel «redaktør» eller «kontrollør 2»), aldri personnavn. **Dato:** ÅÅÅÅ-MM-DD.

### Hva «uavklart» betyr
En vare er **uavklart** (\`allergenKnown: false\` i koden) når innholdet ikke er fastslått og varen kan ha flere allergener enn de som står oppført. Det gjelder typisk sammensatte varer (kjøttpølse, fiskekaker, tortillalefser, nudler) og varer der merkene er ulike (kokosmelk, skalldyr, makrell i tomat). I appen betyr det:
- Varen godkjennes **aldri** som erstatning når en allergi er valgt, og kan gi ukjent pris.
- Retten viser «Innholdet i noen varer er ikke avklart. Sjekk pakningen.»
- Retten blir **ikke** skjult på grunn av en uavklart vare. Filteret ser bare på rettens egen allergenliste. Derfor er det viktig at du skriver i kommentaren hva du mener kan finnes i en uavklart vare, så redaktøren kan avgjøre om rettens liste skal utvides. Ikke gjett: skriv «usikker» hvis du ikke vet.

Under «Uavklarte varer» lenger ned står hver uavklart vare med begrunnelsen koden selv oppgir.

### Hvis du finner et avvik
Skriv avviket i **kommentaren** under retten: hvilken vare, hva appen sier, og hva du mener det bør være. **Ikke endre koden selv.** Sett «Allergener stemmer: nei» (eller «Kosttagger stemmer: nei»). Redaktøren retter koden etterpå og oppdaterer arket.

### Etter gjennomgangen
- \`origin.status\` i koden settes til \`godkjent\` **bare** når en person har kontrollert både allergener og kosttagger for oppskriften (se «Oppskrifter» i \`CLAUDE.md\`). Status endres ikke i arket, men av utvikleren etter at arket er levert.
- \`testkokt\` slipper en oppskrift inn selv når et allergi-, kost- eller råvarefilter er på. Den settes derfor først når retten er laget minst én gang og en person har kontrollert allergenene.
- Så lenge en egen oppskrift er \`utkast\`, skjules den i appen når et filter er på. Det er meningen.

### Om arket
- Det er ingen automatisk kobling mellom arket og koden. Når varer eller oppskrifter endres, kjør \`npm run allergen-ark\` på nytt. Skriptet nekter å overskrive en fil der noen har fylt ut felt, med mindre du bruker \`--overstyr\`; ta da vare på den gamle filen først.
- Arket inneholder demovarer (regel 5): oppdiktede produkter og priser. Allergenene gjelder «en typisk vare», ikke et bestemt merke. Pakningen i butikken avgjør alltid.
- Basisvarene salt og matolje har ikke et produkt i katalogen og er derfor ikke allergenmerket i appen.
`;

/** Hele arket som markdown. */
export function allergenSheet(catalog: Catalog): string {
  const parts: string[] = [INTRO];
  const dev = possibleDeviations(catalog);
  parts.push('## Mulige avvik funnet av skriptet', '',
    'Skriptet sammenligner dataene med hverandre og peker på steder en person bør se ekstra nøye. Dette er **ikke** fasit og er ikke rettet. Hvert punkt er enten en feil i koden eller noe som er satt bevisst; avgjør i kommentaren.', '');
  if (dev.length === 0) parts.push('Ingen funnet.', '');
  else {
    parts.push('| Gjelder | Type | Beskrivelse |', '| --- | --- | --- |');
    for (const d of dev) parts.push(`| ${d.recipeId.startsWith('vare:') ? `vare ${d.recipeId.slice(5)}` : `\`${d.recipeId}\``} | ${d.kind} | ${cell(d.text)} |`);
    parts.push('');
  }

  const unknown = catalog.products.filter((p) => !p.allergenKnown);
  parts.push('## Uavklarte varer', '',
    unknown.length === 0 ? 'Ingen uavklarte varer.' : '| Vare | Produkt | Allergener oppgitt | Begrunnelse i koden |',
    ...(unknown.length === 0 ? [] : ['| --- | --- | --- | --- |']));
  for (const p of unknown) {
    const ing = catalog.ingredients.find((i) => i.id === p.ingredient);
    parts.push(`| ${cell(ing?.name ?? p.ingredient)} | ${cell(p.name)} | ${names(inOrder(p.allergens))} (uavklart) | ${UAVKLART_BEGRUNNELSE[p.id] ?? 'ingen begrunnelse i koden'} |`);
  }
  parts.push('');

  parts.push('## Oversikt over oppskriftene', '', `${catalog.recipes.length} oppskrifter. Fyll ut «ferdig» når alle felt under retten er fylt ut.`, '',
    '| # | Oppskrift | Opphav | Allergener (appen) | Vegetar | Uavklarte varer | Ferdig |', '| --- | --- | --- | --- | --- | --- | --- |');
  catalog.recipes.forEach((r, i) => {
    const un = r.lines.filter((l) => catalog.products.some((p) => p.ingredient === l.ingredient && !p.allergenKnown)).length;
    parts.push(`| ${i + 1} | ${cell(r.name)} (\`${r.id}\`) | ${r.origin ? `${r.origin.kind}, ${r.origin.status}` : 'mangler'} | ${names(inOrder(r.allergens))} | ${r.vegetarian ? 'ja' : 'nei'} | ${un} | [ ] |`);
  });
  parts.push('', '## Oppskrifter', '');
  catalog.recipes.forEach((r, i) => parts.push(recipeSection(r, i, catalog)));
  return `${parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/** Id-ene til oppskriftene som har en seksjon i arket, i rekkefølge. */
export function sheetRecipeIds(md: string): string[] {
  return [...md.matchAll(/^### \d+\. .+ \(`([^`]+)`\)$/gm)].map((m) => m[1]);
}

/** Har noen begynt å fylle ut arket (avkrysning, kommentar, rolle eller dato)? Skriptet overskriver aldri slikt arbeid. */
export const hasReviewEntries = (md: string): boolean =>
  /^- (Allergener|Kosttagger) stemmer:.*\[[xX]\]/m.test(md) || /^- (Kommentar|Gjennomgått av \(rolle, ikke navn\)|Dato \(ÅÅÅÅ-MM-DD\)):[ \t]*\S/m.test(md) || /\| \[[xX]\] \|$/m.test(md);
