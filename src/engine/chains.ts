// Kjeder for tilbud. Tjek oppgir tilbud per kjede (dealer), ikke per utsalg, så et tilbud kan bare knyttes til
// husstanden gjennom kjedene brukeren har valgt (`Settings.offerChains`). Ren funksjon, ingen nettverk eller klokke.

/** Faste aliaser for kjedenavn slik de forekommer i Tjek og i vanlig tale. Nøkkel og verdi er allerede normalisert. */
const ALIASES: Record<string, string> = {
  'REMA': 'REMA 1000', 'REMA1000': 'REMA 1000', 'REMA 1000 NORGE': 'REMA 1000',
  'OBS': 'COOP OBS', 'EXTRA': 'COOP EXTRA', 'PRIX': 'COOP PRIX', 'MEGA': 'COOP MEGA',
  'MENY NORGE': 'MENY', 'SPAR NORGE': 'SPAR', 'EUROSPAR': 'SPAR',
};

/**
 * Normalisert kjedenavn: store bokstaver, ett mellomrom, uten tegnsetting i endene («Coop Obs!» → «COOP OBS»,
 * «Rema 1000» → «REMA 1000», «Kiwi» → «KIWI»). Coop-formatene holdes atskilt fordi prisene er ulike.
 * Tomt navn gir tom streng, som aldri kan være valgt.
 */
export function normalizeChain(name: string | null | undefined): string {
  const s = (name ?? '')
    .normalize('NFC')
    .toUpperCase()
    .replace(/[\s ]+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .trim();
  return ALIASES[s] ?? s;
}

/** De vanligste dagligvarekjedene, alltid tilgjengelige som valg selv når live-tilbudene ikke har dem. */
export const COMMON_CHAINS: { chain: string; label: string }[] = [
  { chain: 'KIWI', label: 'Kiwi' }, { chain: 'REMA 1000', label: 'Rema 1000' },
  { chain: 'COOP EXTRA', label: 'Coop Extra' }, { chain: 'COOP PRIX', label: 'Coop Prix' },
  { chain: 'COOP MEGA', label: 'Coop Mega' }, { chain: 'COOP OBS', label: 'Coop Obs' },
  { chain: 'COOP MARKED', label: 'Coop Marked' }, { chain: 'MENY', label: 'Meny' }, { chain: 'SPAR', label: 'Spar' },
  { chain: 'JOKER', label: 'Joker' }, { chain: 'BUNNPRIS', label: 'Bunnpris' }, { chain: 'EUROPRIS', label: 'Europris' },
];

/** Valgte kjeder som mengde av normaliserte navn. Ingen valgt gir tom mengde (= ingen tilbud brukes). */
export const chainSet = (chains: readonly string[] | undefined) => new Set((chains ?? []).map(normalizeChain).filter(Boolean));
