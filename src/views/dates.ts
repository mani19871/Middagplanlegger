// Uken som vises: kommende mandag i helg, ellers inneværende uke. Kun for visning, ikke del av planmotoren.
export function weekStart(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // man=0
  d.setDate(d.getDate() + (dow >= 5 ? 7 - dow : -dow));
  return d;
}
export const dayDate = (start: Date, i: number) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
export function weekLabel(start: Date): string {
  const end = dayDate(start, 6);
  const m = (d: Date) => d.toLocaleDateString('nb-NO', { month: 'long' });
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}.–${end.getDate()}. ${m(end)} ${end.getFullYear()}`
    : `${start.getDate()}. ${m(start)} – ${end.getDate()}. ${m(end)} ${end.getFullYear()}`;
}
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Handledag for tilbud: starten på uka som vises, men aldri før i dag. */
export function shopDate(now = new Date()): string {
  const a = isoDate(weekStart(now));
  const t = isoDate(now);
  return a > t ? a : t;
}
/** «Denne uka» = gyldig på dagen (inkl. grensene); «kommende» = starter etter dagen. Datoer som ÅÅÅÅ-MM-DD. */
export const editionInPeriod = (e: { validFrom: string; validTo: string }, when: 'denne' | 'kommende', today: string) =>
  when === 'denne' ? e.validFrom <= today && e.validTo >= today : e.validFrom > today;
