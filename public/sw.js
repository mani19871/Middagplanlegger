// Service worker: appskallet (HTML, JS, CSS, ikoner) caches slik at appen åpner frakoblet.
// Aldri cache /api/: tilbudsdata fra Tjek er live-visning og skal ikke lagres (se CLAUDE.md, Tilbudskilder).
const CACHE = 'middag-v3';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.ico', '/icons/ikon-192.png', '/icons/ikon-512.png', '/icons/maskable-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Forhåndslast de innebygde JS/CSS-filene fra forsiden, slik at første frakoblede åpning virker.
    const html = await (await fetch('/', { cache: 'no-cache' })).text();
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))];
    await Promise.all(assets.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    } catch {
      return (await caches.match(req)) || (req.mode === 'navigate' ? await caches.match('/') : undefined) || Response.error();
    }
  })());
});
