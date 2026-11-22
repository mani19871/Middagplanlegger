// Plassholder-miniatyrer (emoji) til ekte matbilder er lisensiert.
export const EMOJI: Record<string, string> = {
  bolognese: '🍝', taco: '🌮', karri: '🍛', ovnstorsk: '🐟', fiskekaker: '🍤', linsegryte: '🥣', pastaspinat: '🍝',
  omelett: '🍳', lakseris: '🍣', kyllingwok: '🥘', pannekaker: '🥞', bonnechili: '🌶️', kjottkaker: '🍖', fiskesuppe: '🍲',
  svinekotelett: '🥩', fleskkalrot: '🥓', svinewok: '🥢', lammeboller: '🧆', lammepasta: '🍝', rekepasta: '🦐',
  rekekokos: '🦐', seigryte: '🐠', stektsild: '🐟', makrelltomat: '🥫', hyseris: '🍚', kyllingnudler: '🍜',
  ovnskylling: '🍗', kikertcurry: '🍛', tofuwok: '🥡', soppasta: '🍄', ovnsblomkal: '🧀',
};
const TINT = ['#e6efd9', '#f6e3cf', '#dde8ea', '#f2dede', '#ece6d3'];
export function Thumb({ id, size = 56 }: { id: string; size?: number }) {
  const tint = TINT[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TINT.length];
  return <span className="thumb" style={{ width: size, height: size, background: tint, fontSize: size * 0.55 }} aria-hidden>{EMOJI[id] ?? '🍽️'}</span>;
}
const I = (d: string) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
export const icons = {
  Uka: I('M4 6h16v14H4zM4 10h16M8 3v4M16 3v4'),
  Kundeaviser: I('M3 12l9-9h8v8l-9 9zM15 7.5h.01'),
  Handleliste: I('M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01'),
  Matskap: I('M7 3h10v4H7zM6 7h12v14H6zM6 12h12'),
};

export const ING_EMOJI: Record<string, string> = {
  pasta: '🍝', tomat: '🍅', kjottdeig: '🥩', lok: '🧅', ris: '🍚', kylling: '🍗', kokosmelk: '🥥', torsk: '🐟', poteter: '🥔',
  gulrot: '🥕', fiskekaker: '🍤', tortilla: '🫓', mais: '🌽', paprika: '🫑', ost: '🧀', romme: '🥛', egg: '🥚', melk: '🥛',
  mel: '🌾', brokkoli: '🥦', laks: '🍣', spinat: '🥬', linser: '🫘', bonner: '🫘',
  svinekotelett: '🥩', svinedeig: '🥩', flesk: '🥓', lammedeig: '🥩', reker: '🦐', sei: '🐟', hyse: '🐟', sild: '🐟',
  makrell: '🥫', kikerter: '🫘', tofu: '⬜', sopp: '🍄', blomkal: '🥦', kalrot: '🥔', soyasaus: '🍶', nudler: '🍜',
  salt: '🧂', olje: '🫒',
};
export const DEPT_EMOJI: Record<string, string> = {
  'Frukt og grønt': '🍎', 'Kjøtt og fisk': '🥩', Tørrvarer: '🥫', Hermetikk: '🥫', Meieri: '🥛', Krydder: '🧂',
};
