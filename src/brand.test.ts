// Merkenavnet er «Husvett» (eierens beslutning 2026-11-22). Interne navn (repo, Docker, nøkler) er uendret.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('merkenavn: Husvett', () => {
  it('vises i tittel, manifest, ikon og toppfelt', () => {
    expect(read('index.html')).toContain('<title>Husvett</title>');
    const m = JSON.parse(read('public/manifest.webmanifest'));
    expect(m.name).toBe('Husvett');
    expect(m.short_name).toBe('Husvett');
    expect(read('src/App.tsx')).toContain('<b>Husvett</b>');
  });

  it('logopakke A: ikonene i public/ er byte for byte de fra brand/husvett/Nett, og ligger i manifest, head og service worker', () => {
    const files = ['ikon-192.png', 'ikon-512.png', 'maskable-192.png', 'maskable-512.png', 'apple-touch-icon.png'];
    for (const f of files) expect(readFileSync(join(root, 'public/icons', f)).equals(readFileSync(join(root, 'brand/husvett/Nett', f))), f).toBe(true);
    expect(readFileSync(join(root, 'public/favicon.ico')).equals(readFileSync(join(root, 'brand/husvett/Nett/favicon.ico')))).toBe(true);
    const m = JSON.parse(read('public/manifest.webmanifest'));
    const pack = JSON.parse(read('brand/husvett/Nett/manifest-ikoner.json')).icons;
    expect(m.icons).toEqual(pack.map((i: { src: string }) => ({ ...i, src: `/icons/${i.src}` })));
    const html = read('index.html');
    expect(html).toContain('href="/favicon.ico"');
    expect(html).toContain('href="/icons/apple-touch-icon.png"');
    expect(html).not.toContain('icon.svg');
    const sw = read('public/sw.js');
    for (const f of ['/icons/ikon-192.png', '/icons/ikon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png', '/favicon.ico']) expect(sw, f).toContain(`'${f}'`);
    expect(sw).not.toContain('/icons/icon-');
  });

  it('paletten: skoggrønn #103E28 og krem #FAF6EE i manifest, head og lys tema', () => {
    const m = JSON.parse(read('public/manifest.webmanifest'));
    expect(m.theme_color).toBe('#103E28');
    expect(m.background_color).toBe('#FAF6EE');
    expect(read('index.html')).toContain('name="theme-color" content="#103E28"');
    const light = read('src/styles.css').match(/^:root \{[^}]*\}/m)![0];
    expect(light).toContain('--g:#103E28');
    expect(light).toContain('--cream:#FAF6EE');
  });

  it('symbolet vises i toppfeltet som skjult dekor, uten at filene i brand/ er rørt', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('symbol-skoggronn.svg');
    expect(app).toContain('symbol-hvit.svg');
    expect(app).toMatch(/<img[^>]*alt=""[^>]*aria-hidden/);
    expect(readFileSync(join(root, 'src/assets/symbol-skoggronn.svg')).equals(readFileSync(join(root, 'brand/husvett/SVG/symbol-skoggronn.svg')))).toBe(true);
    expect(readFileSync(join(root, 'src/assets/symbol-hvit.svg')).equals(readFileSync(join(root, 'brand/husvett/SVG/symbol-hvit.svg')))).toBe(true);
  });

  it('det gamle merkenavnet «Matuke» finnes ikke lenger i kode eller dokumenter', () => {
    const skip = new Set(['node_modules', '.git', 'dist', 'dist-server', 'data']);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(join(root, dir))) {
        if (skip.has(f)) continue;
        const rel = join(dir, f), st = statSync(join(root, rel));
        if (st.isDirectory()) walk(rel);
        else if (/\.(tsx?|cjs|mjs|json|md|html|svg|webmanifest|ya?ml|js|sh)$/.test(f) && f !== 'brand.test.ts' && /matuke/i.test(read(rel))) hits.push(rel);
      }
    };
    walk('');
    expect(hits).toEqual([]);
  });
});
