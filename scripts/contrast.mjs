// Kontrollerer WCAG-kontrast (4.5:1 for tekst) for fargepar i src/styles.css, lyst og mørkt tema.
// Bruk: node scripts/contrast.mjs  (avslutter med kode 1 hvis et par er under 4,5)
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const vars = (block) => Object.fromEntries([...block.matchAll(/--(\w+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const light = vars(css.match(/^:root \{[^}]*\}/m)[0]);
const dark = { ...light, ...vars(css.match(/prefers-color-scheme: dark\) \{ :root \{([^}]*)\}/)[1]) };
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// [forgrunn, bakgrunn, navn]; verdier med # er faste farger fra CSS-regler utenfor variablene.
const pairs = (t) => [
  [t.ink, t.cream, 'tekst på bakgrunn'], [t.ink, t.card, 'tekst på kort'], [t.mut, t.cream, 'dempet tekst på bakgrunn'], [t.mut, t.card, 'dempet tekst på kort'],
  [t.mut, t.gl, 'dempet tekst på grønn flate'], [t.ink, t.gl, 'tekst på grønn flate'],
  [t.g, t.card, 'lenke/grønn tekst på kort'], [t.g, t.cream, 'grønn tekst på bakgrunn'], [t.g, t.gl, 'grønn pille (ok/down)'],
  [t.bad, t.cream, 'feil/over budsjett'], [t.bad, t.card, 'feil på kort'], [t.upfg, t.upbg, 'pille/banner «opp»'], [t.warn, t.cream, 'advarsel'],
  [t.onG ?? '#ffffff', t.g, 'knapp (cta/aktiv fane)'],
  [t.focus, t.cream, 'fokusmarkering (3:1 kreves)', 3], [t.focus, t.card, 'fokusmarkering på kort (3:1)', 3],
];
const fixed = [['#5c4600', '#fff3cd', 'demo-banner'], ['#6b4500', '#fff0cc', 'pille/banner advarsel'], ['#7a3615', '#fbe9de', 'tilbudsbanner'], ['#8a3d1c', '#FAF6EE', 'tilbudstekst'],
  ['#ffffff', '#b4532a', 'pris-pluss'], ['#b4532a', '#fffdf9', 'pris på kort'], ['#7a3615', '#fffdf9', 'tilbudssum']];
let bad = 0;
const report = (name, list) => list.forEach(([f, b, n, min = 4.5]) => { const r = ratio(f, b); const ok = r >= min; if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FEIL'} ${name.padEnd(5)} ${r.toFixed(2).padStart(5)}  ${n} (${f} på ${b})`); });
report('lyst', pairs(light)); report('mørkt', pairs(dark)); report('fast', fixed);
if (bad) { console.error(`\n${bad} par under kravet`); process.exit(1); }
