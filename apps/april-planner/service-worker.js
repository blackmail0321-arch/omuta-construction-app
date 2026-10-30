/* Only the application shell is cached. User records stay in browser storage. */
'use strict';
const VERSION = 'abdaf32c42b5359f7308';
const PREFIX = 'april-note-shell:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
const FILES = ['index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const urls = FILES.map(name => new URL(name, self.registration.scope).href);
const directory = new URL('./', self.registration.scope).pathname;
function shellURL(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  if (url.pathname === directory) return urls[0];
  return urls.find(value => new URL(value).pathname === url.pathname) || null;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      await cache.addAll(urls.map(url => new Request(url, {cache: 'reload', credentials: 'same-origin'})));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = shellURL(event.request);
  if (!url) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const response = await cache.match(url);
    // Missing shell files are refreshed only in this cache; never cache user uploads or arbitrary URLs.
    if (response) return response;
    const fresh = await fetch(url, {cache: 'no-cache', credentials: 'same-origin'});
    if (fresh.ok) await cache.put(url, fresh.clone());
    return fresh;
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
  if (['CACHE_STATUS', 'REPAIR_CACHE'].includes(event.data?.type)) event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    if (event.data.type === 'REPAIR_CACHE') {
      const missing = [];
      for (const url of urls) if (!(await cache.match(url))) missing.push(new Request(url, {cache: 'reload', credentials: 'same-origin'}));
      try { await cache.addAll(missing); } catch (_) { /* Ready stays false until every shell file is present. */ }
    }
    const ready = (await Promise.all(urls.map(url => cache.match(url)))).every(Boolean);
    event.ports[0]?.postMessage({ready, version: VERSION});
  })());
});
