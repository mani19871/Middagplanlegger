// Bildeverter for produktbilder og avissider fra Tjek. Bildene lastes av brukerens nettleser direkte fra Tjeks adresser
// (vi laster ikke ned og lagrer ikke bildefiler). Bare verter driften har satt i TJEK_IMAGE_HOSTS slippes inn: de står i
// CSP-ens img-src (server/app.ts, appCsp), og alle andre bildeadresser fjernes fra svarene før de når appen. Hvilke verter
// Tjek bruker: formprøven 2026-11-22 (phase0/tjek-formprøve.md) fant bare image-transformer-api.tjek.com, både for
// produktbilder og avissider (kjedelogoer ligger på samme vert, men leses ikke). Serveren logger vertsnavn den ser, men
// som ikke er tillatt, i tilfelle Tjek bytter vert.

/** Et eksakt vertsnavn: små bokstaver, punktum, minst ett punktum og et toppdomene med bokstaver. Ingen IP, port eller jokertegn. */
export const HOST = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Leser TJEK_IMAGE_HOSTS (kommaseparert). Ugyldige oppføringer hoppes over med én advarsel. Tom = ingen bilder. */
export function imageHostsFrom(value: string | undefined, warn: (m: string) => void = console.warn): string[] {
  const out: string[] = [];
  let bad = 0;
  for (const part of (value ?? '').split(',')) {
    const h = part.trim().toLowerCase();
    if (!h) continue;
    if (HOST.test(h)) { if (!out.includes(h)) out.push(h); } else bad++;
  }
  if (bad) warn(`TJEK_IMAGE_HOSTS: ${bad} ugyldig${bad === 1 ? '' : 'e'} oppføring${bad === 1 ? '' : 'er'} hoppet over (bare eksakte vertsnavn, uten skjema, sti, port eller *).`);
  return out;
}

/** Adressen hvis den er https til en tillatt vert (uten brukernavn eller port, høyst 500 tegn), ellers null. */
export function allowedImage(url: string | null | undefined, hosts: string[]): string | null {
  if (!url || url.length > 500 || hosts.length === 0) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && hosts.includes(u.hostname) ? u.href : null;
  } catch { return null; }
}

/** Vertsnavnet i en https-adresse som ikke er tillatt (til loggen, aldri hele adressen), ellers null. */
export function foreignHost(url: string | null | undefined, hosts: string[]): string | null {
  if (!url) return null;
  try { const u = new URL(url); return u.protocol === 'https:' && HOST.test(u.hostname) && !hosts.includes(u.hostname) ? u.hostname : null; } catch { return null; }
}
