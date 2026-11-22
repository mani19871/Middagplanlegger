// DEMODATA: oppdiktede kundeavis-utgaver. Ekte katalog bygges på avtaler (fase 0/1).
export interface Edition {
  id: string; sender: string; title: string; scope: 'nasjonal' | 'regional' | 'lokal';
  postalPrefixes?: string[]; validFrom: string; validTo: string; branch: 'dagligvare' | 'annet';
  rights: 'visning' | 'lenke'; storeId?: string;
}
/** `priceOre` null: prisen er ukjent (vises som «pris ukjent», aldri som 0 kr). */
export interface Offer { editionId: string; text: string; ingredient: string; priceOre: number | null; pack: string; terms: string }
export const editions: Edition[] = [
  { id: 'e1', sender: 'Demo Nærbutikk', title: 'Ukens tilbud uke 47', scope: 'nasjonal', validFrom: '2026-11-23', validTo: '2026-11-29', branch: 'dagligvare', rights: 'lenke', storeId: 'demoA' },
  { id: 'e2', sender: 'Demo Storsenter', title: 'Storsenter – Nord-Norge', scope: 'regional', postalPrefixes: ['8', '9'], validFrom: '2026-11-16', validTo: '2026-11-22', branch: 'dagligvare', rights: 'lenke', storeId: 'demoB' },
  { id: 'e3', sender: 'Demo Storsenter', title: 'Storsenter – Østlandet', scope: 'regional', postalPrefixes: ['0', '1', '2', '3'], validFrom: '2026-11-16', validTo: '2026-11-22', branch: 'dagligvare', rights: 'visning', storeId: 'demoB' },
  { id: 'e4', sender: 'Demo Byggvare', title: 'Black Week', scope: 'nasjonal', validFrom: '2026-11-23', validTo: '2026-11-30', branch: 'annet', rights: 'lenke' },
];
export const offers: Offer[] = [
  { editionId: 'e1', text: 'Torsk 400 g', ingredient: 'torsk', priceOre: 7990, pack: '400 g', terms: 'Medlemspris, maks 4 pk' },
  { editionId: 'e3', text: 'Kyllingfilet 600 g', ingredient: 'kylling', priceOre: 8990, pack: '600 g', terms: 'Gjelder utsalg i regionen' },
];
