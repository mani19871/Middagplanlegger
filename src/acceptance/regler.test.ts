// Kildeskanning og datasjekker for reglene i CLAUDE.md. Dette er stikkprøver som fanger de vanligste bruddene
// (de beviser ikke fravær av brudd). Reglenes atferd er testet andre steder; se docs/fase1-status.md.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalog } from '../data/catalog';
import { defaultSettings } from '../data/defaults';
import { editions } from '../data/newspapers';
import { initialState } from '../store';

const ROOT = new URL('../../', import.meta.url).pathname;
const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
const text = (f: string) => readFileSync(ROOT + f, 'utf8');
const isTest = (f: string) => /\.test\.tsx?$/.test(f);
const code = (f: string) => /\.(ts|tsx|mjs|cjs)$/.test(f);
/** Fjerner linjekommentarer, slik at «Ingen Date.now» i en kommentar ikke teller som bruk. */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('regel 1: planmotoren er ren og deterministisk', () => {
  const engine = tracked.filter((f) => f.startsWith('src/engine/') && code(f) && !isTest(f));
  it('src/engine/ har filer å skanne', () => expect(engine.length).toBeGreaterThan(5));
  it.each(engine)('%s: ingen klokke, tilfeldighet, nettverk, lagring eller miljøvariabler', (f) => {
    const src = stripComments(text(f));
    for (const bad of [/\bDate\b/, /Math\.random/, /\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /\bcrypto\b/, /performance\.now/,
      /localStorage|sessionStorage|indexedDB/, /process\.env|import\.meta\.env/, /setTimeout|setInterval/, /\bwindow\b|\bdocument\b|navigator/]) {
      expect(src, `${f} bruker ${bad}`).not.toMatch(bad);
    }
  });
  it.each(engine)('%s: importerer bare andre motorfiler (ingen React, server, tilbudskilder eller UI)', (f) => {
    for (const m of text(f).matchAll(/from\s+'([^']+)'/g)) expect(m[1], `${f}`).toMatch(/^\.\/[a-z]+$/);
  });
  it('beløp i øre er heltall i katalogen (demodata)', () => {
    for (const p of catalog.prices) expect(Number.isInteger(p.ore) && p.ore > 0, `${p.productId}@${p.storeId}`).toBe(true);
  });
});

describe('regel 2: hver pris har kilde, omfang, dato og status', () => {
  it('alle prisobservasjoner i katalogen har kilde, ISO-dato, kjent status og en butikk med omfang', () => {
    const storeById = new Map(catalog.stores.map((s) => [s.id, s]));
    for (const p of catalog.prices) {
      expect(p.source, p.productId).toBeTruthy();
      expect(p.observed, p.productId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['ordinær', 'tilbud', 'estimat']).toContain(p.status);
      expect(['utsalg', 'region', 'kjede']).toContain(storeById.get(p.storeId)?.scope);
      if (p.status === 'tilbud') expect(p.validUntil, `${p.productId}: tilbud må ha utløpsdato`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it('hver kjent pris i katalogen peker på et produkt som finnes', () => {
    const ids = new Set(catalog.products.map((p) => p.id));
    for (const p of catalog.prices) expect(ids.has(p.productId)).toBe(true);
  });
});

describe('regel 4 og 2: ingen garanti-språk om allergener eller pris i brukergrensesnittet', () => {
  const ui = tracked.filter((f) => /^src\/(views\/.*\.tsx|App\.tsx|data\/(catalog|newspapers)\.ts)$/.test(f) || f === 'index.html');
  /** Linjer som nevner garanti må benekte den («garanterer aldri», «ikke en garanti»). */
  it.each(ui)('%s: «garanti», «allergenfri», «sluttpris» og «billigste» står bare i benektende setninger', (f) => {
    const sentences = stripComments(text(f)).split(/\n|(?<=[.!?])\s+/);
    const flagged = sentences.filter((l) => /garant|allergenfri|fri for allergener|sluttpris|billigst|alltid lavest|100 ?% (trygg|sikker)/i.test(l));
    for (const l of flagged) // setning for setning, så en benektelse i nabosetningen ikke skjuler et brudd
      expect(l, `${f}: ${l.trim().slice(0, 140)}`).toMatch(/\b(ikke|aldri|uten)\b/i);
  });
});

describe('regel 5: demodata er merket som demodata', () => {
  it('katalog og aviser har DEMODATA i filhodet, og alle butikker, kilder og avsendere er merket «Demo»', () => {
    expect(text('src/data/catalog.ts').split('\n')[0]).toMatch(/DEMODATA/);
    expect(text('src/data/newspapers.ts').split('\n')[0]).toMatch(/DEMODATA/);
    for (const s of catalog.stores) expect(s.name, s.id).toMatch(/^Demo/);
    for (const p of catalog.prices) expect(p.source, p.productId).toBe('Demodata');
    for (const e of editions) expect(e.sender, e.id).toMatch(/^Demo/);
  });
  it('appen viser en synlig demodata-merknad på alle faner (App.tsx), og aviser (demo) er merket i fanen', () => {
    expect(text('src/App.tsx')).toMatch(/className="demo"[^<]*>[^<]*Demodata/);
    expect(text('src/views/PapersView.tsx')).toMatch(/Aviser \(demo\)/);
  });
});

describe('regel 6: bare avtalte kilder, ingen egen henting av kundeaviser', () => {
  it('nettverkskall i produksjonskoden går bare via /api/offers (klient) og Tjek-kilden (server)', () => {
    const calls = tracked.filter((f) => /^(src|server)\//.test(f) && code(f) && !isTest(f))
      .filter((f) => /\bfetch\s*\(/.test(stripComments(text(f)))).sort();
    // Utvides en gang en ny kilde eller synk-server legges til, må denne listen og docs/fase1-status.md oppdateres bevisst.
    expect(calls.filter((f) => !['src/offers/client.ts', 'server/index.ts'].includes(f) && !f.startsWith('src/sync/'))).toEqual([]);
  });
  it('de eneste eksterne vertene i produksjonskoden er Tjek (tilbud) og Matvaretabellen (næring, bare byggeskript)', () => {
    const hosts = new Set<string>();
    for (const f of tracked.filter((x) => /^(src|server|scripts)\//.test(x) && code(x) && !isTest(x))) {
      for (const m of stripComments(text(f)).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) hosts.add(m[1]);
    }
    expect([...hosts].filter((h) => !['localhost', '127.0.0.1', 'api.etilbudsavis.dk', 'www.matvaretabellen.no'].includes(h))).toEqual([]);
  });
  it('serveren lagrer ikke tilbud: ingen filskriving i server/index.ts, og tilbud når aldri synk-databasen', () => {
    // Synk-databasen (server/storage/) holder bare husstand, hendelser og dokumenter (docs/synk.md).
    const src = stripComments(text('server/index.ts'));
    expect(src).not.toMatch(/writeFile|appendFile|createWriteStream|mongodb|redis/i);
    // Tilbudsdata (cache/offers) sendes aldri inn i lagringen, og lagrings- og synk-koden kjenner ikke tilbudskildene.
    expect(src).not.toMatch(/(storage|syncApi)[^\n]*(cache|offers)/i);
    for (const f of tracked.filter((x) => /^server\/(storage|sync)\//.test(x) && code(x) && !isTest(x))) {
      expect(stripComments(text(f)), f).not.toMatch(/from '[^']*offers[^']*'|LiveOffer|tjek/i);
    }
  });
});

describe('regel 7: personvern og hemmeligheter', () => {
  it('ingen hemmeligheter i sporede filer (kjente nøkkelformater og tilordnede token)', () => {
    const patterns: [string, RegExp][] = [
      ['Bearer-token', /Bearer\s+[A-Za-z0-9._-]{24,}/], ['GitHub-token', /\bgh[pousr]_[A-Za-z0-9]{30,}/], ['sk-nøkkel', /\bsk-[A-Za-z0-9_-]{20,}/],
      ['AWS', /\bAKIA[0-9A-Z]{16}\b/], ['privatnøkkel', /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/],
      ['tilordnet hemmelighet', /\b(api[_-]?key|secret|token|password|passord)\b\s*[:=]\s*['"][A-Za-z0-9._/+=-]{16,}['"]/i],
    ];
    for (const f of tracked.filter((x) => !/package-lock\.json$|\.(png|svg|ico)$/.test(x))) {
      const src = text(f);
      for (const [name, re] of patterns) expect(src, `${f}: ${name}`).not.toMatch(re);
    }
  });
  it('.env-filer og nøkkelfiler er ikke sporet, og node_modules/dist er ignorert', () => {
    expect(tracked.filter((f) => /(^|\/)\.env(\.|$)|\.pem$|\.key$|credentials/i.test(f))).toEqual([]);
    expect(text('.gitignore')).toMatch(/node_modules/);
  });
  it('miljøvariabler for nøkler leses bare utenfor src/ (server og fase 0-skript)', () => {
    const inSrc = tracked.filter((f) => f.startsWith('src/') && code(f) && !isTest(f)).filter((f) => /process\.env|import\.meta\.env\.(?!PROD|DEV|MODE|BASE_URL)/.test(text(f)));
    expect(inSrc).toEqual([]);
  });
  it('ingen presis posisjon: koden bruker ikke geolokasjon', () => {
    for (const f of tracked.filter((x) => /^(src|server)\//.test(x) && code(x) && !isTest(x))) {
      // «geolocation=()» i Permissions-Policy (server/app.ts) forbyr posisjon og er lov.
      expect(text(f), f).not.toMatch(/geolocation(?!=\(\))|getCurrentPosition|watchPosition/);
    }
  });
  it('lagret tilstand har ingen personfelt: spiserne har bare etikett, porsjon og dager, og postnummer er tomt fra start', () => {
    for (const e of defaultSettings.eaters) {
      expect(Object.keys(e).sort()).toEqual(['daysHome', 'id', 'label', 'portion']);
      expect(e.label).toMatch(/^(Voksen|Barn) \d+$/);
    }
    expect(initialState.postal).toBe('');
    expect(JSON.stringify(initialState)).not.toMatch(/e-?post|email|telefon|phone|fødselsdato|birth|adresse|address|latitude|longitude/i);
  });
});
