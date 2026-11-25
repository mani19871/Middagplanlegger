// V7: bare én fane skriver tilstanden. Testet mot en falsk LockManager med samme regler som Web Locks (kø, ifAvailable, steal, signal).
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { otherTabText, startTabGuard, type Locks, type TabRole } from './singleTab';
import TabGate, { OtherTabNotice } from './views/TabGate';

interface Entry { cb: (l: unknown) => unknown; resolve(v: unknown): void; reject(e: unknown): void; done: boolean }
const abortError = () => Object.assign(new Error('avbrutt'), { name: 'AbortError' });

class FakeLocks implements Locks {
  holder: Entry | null = null;
  queue: Entry[] = [];
  request(_name: string, o: { ifAvailable?: boolean; steal?: boolean; signal?: AbortSignal }, cb: (l: unknown) => unknown) {
    return new Promise<unknown>((resolve, reject) => {
      const e: Entry = { cb, resolve, reject, done: false };
      if (o.steal) {
        const old = this.holder;
        if (old) { old.done = true; old.reject(abortError()); }
        this.holder = null;
        this.grant(e);
      } else if (o.ifAvailable && (this.holder || this.queue.length)) {
        Promise.resolve(cb(null)).then(resolve, reject);
      } else if (!this.holder) {
        this.grant(e);
      } else {
        this.queue.push(e);
        o.signal?.addEventListener('abort', () => {
          const i = this.queue.indexOf(e);
          if (i >= 0) { this.queue.splice(i, 1); reject(abortError()); }
        });
      }
    });
  }
  private grant(e: Entry) {
    this.holder = e;
    Promise.resolve(e.cb({ name: 'lås' })).then((v) => {
      if (e.done) return;
      e.done = true; e.resolve(v);
      if (this.holder === e) { this.holder = null; const next = this.queue.shift(); if (next) this.grant(next); }
    }, (err) => { e.done = true; e.reject(err); });
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
function tab(locks: Locks | null) {
  const roles: TabRole[] = [];
  const g = startTabGuard(locks, (r) => roles.push(r));
  return { g, roles, now: () => roles[roles.length - 1] };
}

describe('V7: én aktiv fane', () => {
  it('første fane er aktiv, en fane til er passiv og skriver ikke', async () => {
    const locks = new FakeLocks();
    const a = tab(locks); await tick();
    const b = tab(locks); await tick();
    expect(a.now()).toBe('aktiv');
    expect(b.now()).toBe('passiv');
  });

  it('«Bruk her» gjør denne fanen aktiv og den andre passiv; aldri to aktive samtidig', async () => {
    const locks = new FakeLocks();
    const a = tab(locks); await tick();
    const b = tab(locks); await tick();
    b.g.takeOver(); await tick();
    expect(b.now()).toBe('aktiv');
    expect(a.now()).toBe('passiv');
    a.g.takeOver(); await tick();
    expect(a.now()).toBe('aktiv');
    expect(b.now()).toBe('passiv');
  });

  it('lukkes den aktive fanen, tar den ventende over av seg selv (også etter at låsen er tatt)', async () => {
    const locks = new FakeLocks();
    const a = tab(locks); await tick();
    const b = tab(locks); await tick();
    a.g.stop(); await tick();
    expect(b.now()).toBe('aktiv');
    const c = tab(locks); await tick();
    expect(c.now()).toBe('passiv');
    c.g.takeOver(); await tick();
    expect(b.now()).toBe('passiv');
    c.g.stop(); await tick();
    expect(b.now()).toBe('aktiv');
    expect(locks.queue).toHaveLength(0); // ingen hengende forespørsler i kø
  });

  it('en lukket fane melder aldri ny rolle', async () => {
    const locks = new FakeLocks();
    const a = tab(locks); await tick();
    const b = tab(locks); await tick();
    b.g.stop(); await tick();
    const before = b.roles.length;
    a.g.stop(); await tick();
    expect(b.roles.length).toBe(before);
    expect(locks.holder).toBeNull();
  });

  it('uten Web Locks (eldre nettleser) er fanen aktiv som før', () => {
    expect(tab(null).now()).toBe('aktiv');
  });

  it('passiv fane viser forklaring og knapp, og appen gjengis bare når fanen er aktiv', () => {
    const t = renderToStaticMarkup(createElement(OtherTabNotice, { onTakeOver: () => {} }));
    expect(t).toContain(otherTabText());
    expect(t).toMatch(/Bruk Husvett her/);
    expect(t).toMatch(/role="status"/);
    const app = createElement('p', null, 'APPEN');
    expect(renderToStaticMarkup(createElement(TabGate, { locks: null, children: app }))).toContain('APPEN');
    expect(renderToStaticMarkup(createElement(TabGate, { locks: new FakeLocks(), children: app }))).not.toContain('APPEN');
  });
});
