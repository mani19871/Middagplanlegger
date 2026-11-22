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
    expect(read('public/icons/icon.svg')).toContain('aria-label="Husvett"');
    expect(read('src/App.tsx')).toContain('<b>Husvett</b>');
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
