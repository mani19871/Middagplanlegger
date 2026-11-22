// Generell liste over vanlige basisvarer husstanden kan velge å alltid ha hjemme (utvidelse B). Bare varenavn, ingen
// priser, butikker eller avtaler. Varer med `ingredient` svarer til en vare i (demo)katalogen og kan få minstemengde
// når den kan telles i matskapet; de andre bruker nivå («har / snart tom / tom»). Husholdningsvarer (toalettpapir,
// vaskemidler) hører ikke hjemme her (utvidelse C, ikke bygd).
import type { StapleChoice } from '../engine/types';

export const stapleChoices: StapleChoice[] = [
  { id: 'mel', name: 'Hvetemel', department: 'Tørrvarer', ingredient: 'mel' },
  { id: 'ris', name: 'Ris', department: 'Tørrvarer', ingredient: 'ris' },
  { id: 'pasta', name: 'Pasta', department: 'Tørrvarer', ingredient: 'pasta' },
  { id: 'havregryn', name: 'Havregryn', department: 'Tørrvarer' },
  { id: 'sukker', name: 'Sukker', department: 'Tørrvarer' },
  { id: 'olje', name: 'Matolje', department: 'Tørrvarer', ingredient: 'olje' },
  { id: 'salt', name: 'Salt', department: 'Krydder' },
  { id: 'pepper', name: 'Pepper', department: 'Krydder' },
  { id: 'buljong', name: 'Buljong', department: 'Krydder' },
  { id: 'soyasaus', name: 'Soyasaus', department: 'Krydder', ingredient: 'soyasaus' },
  { id: 'tomat', name: 'Hakkede tomater', department: 'Hermetikk', ingredient: 'tomat' },
  { id: 'linser', name: 'Røde linser', department: 'Tørrvarer', ingredient: 'linser' },
  { id: 'melk', name: 'Melk', department: 'Meieri', ingredient: 'melk' },
  { id: 'egg', name: 'Egg', department: 'Meieri', ingredient: 'egg' },
  { id: 'smor', name: 'Smør', department: 'Meieri' },
  { id: 'ost', name: 'Ost', department: 'Meieri', ingredient: 'ost' },
  { id: 'kaffe', name: 'Kaffe', department: 'Drikke' },
  { id: 'te', name: 'Te', department: 'Drikke' },
];
