// Visningsetiketter for hvem som gjorde noe (avkrysning, kjøp). Bare etiketter som «Voksen 1», aldri ekte navn.
import { deviceId, type AppState } from '../store';

export function whoLabel(s: AppState, by: string): string {
  const me = s.sync?.me.id ?? deviceId();
  if (by === me) return 'deg';
  if (by === 'migrering') return 'tidligere data';
  const m = s.sync?.members.find((x) => x.id === by);
  return m ? m.label : 'en annen enhet';
}
/** «deg og Voksen 2» */
export function whoList(s: AppState, bys: string[]): string {
  const names = [...new Set(bys.map((b) => whoLabel(s, b)))];
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} og ${names[names.length - 1]}`;
}
