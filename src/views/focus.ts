// Fokus etter handlinger som fjerner eller deaktiverer knappen brukeren sto på (kodegjennomgang runde 2, V16). Uten dette
// havner fokus på <body>, og tastatur- og skjermleserbrukere mister plassen sin. Målet er en knapp, en overskrift eller en
// statuslinje; ikke-interaktive mål har tabIndex={-1}. Ingen virkning uten DOM (tester og serverrendering).

/**
 * Etter neste gjengivelse: fokus på første synlige og aktive element blant `ids` (i rekkefølge). Finnes ingen av dem,
 * skjer ingenting.
 */
export function focusAfterRender(...ids: string[]): void {
  if (typeof document === 'undefined') return;
  const go = () => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.getClientRects().length > 0 && !(el as HTMLButtonElement).disabled) { el.focus(); return; }
    }
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go); else setTimeout(go, 0);
}
