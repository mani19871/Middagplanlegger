// Bildeverter fra Tjek: bare verter driften har satt i TJEK_IMAGE_HOSTS slippes inn i CSP og i svarene.
import { describe, expect, it } from 'vitest';
import { API_CSP, APP_CSP, appCsp } from '../app';
import { allowedImage, imageHostsFrom } from './images';

describe('imageHostsFrom', () => {
  it('eksakte vertsnavn, små bokstaver, uten skjema, sti, port eller jokertegn', () => {
    const warns: string[] = [];
    expect(imageHostsFrom('Bilder.Example.test, cdn.example.test ,*.tjek.test,https://x.test/a,1.2.3.4,localhost,', (m) => warns.push(m)))
      .toEqual(['bilder.example.test', 'cdn.example.test']);
    expect(warns.length).toBe(1);
    expect(imageHostsFrom(undefined)).toEqual([]);
    expect(imageHostsFrom('')).toEqual([]);
  });
});

describe('allowedImage', () => {
  const hosts = ['bilder.example.test'];
  it('bare https og bare tillatte verter; ellers null', () => {
    expect(allowedImage('https://bilder.example.test/a.jpg', hosts)).toBe('https://bilder.example.test/a.jpg');
    expect(allowedImage('https://annen.example.test/a.jpg', hosts)).toBeNull();
    expect(allowedImage('http://bilder.example.test/a.jpg', hosts)).toBeNull();
    expect(allowedImage('https://bilder.example.test.ond.test/a.jpg', hosts)).toBeNull();
    expect(allowedImage('https://user@bilder.example.test/a.jpg', hosts)).toBeNull();
    expect(allowedImage('https://bilder.example.test:8443/a.jpg', hosts)).toBeNull();
    expect(allowedImage(null, hosts)).toBeNull();
    expect(allowedImage('https://bilder.example.test/a.jpg', [])).toBeNull();
    expect(allowedImage(`https://bilder.example.test/${'a'.repeat(600)}`, hosts)).toBeNull();
  });
});

describe('appCsp', () => {
  it('uten verter er CSP som før; med verter utvides bare img-src, og Trusted Types beholdes', () => {
    expect(appCsp([])).toBe(APP_CSP);
    const c = appCsp(['bilder.example.test']);
    expect(c).toBe(APP_CSP.replace("img-src 'self' data:", "img-src 'self' data: https://bilder.example.test"));
    expect(c).toMatch(/require-trusted-types-for 'script'; trusted-types sw/);
    expect(c).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    expect(() => appCsp(['ond.test; script-src *'])).toThrow();
    expect(API_CSP).toBe("default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  });
});
