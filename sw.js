'use strict';

const CACHE_NAME = 'Šmírka APP-v1';

// All files that make up the app shell — cached on install
const PRECACHE_FILES = [
  './index.html',
  './manifest.json',
  './icon.svg',
  './sw.js',
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_FILES))
      .then(() => self.skipWaiting())   // activate immediately, don't wait for old SW to die
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', event => {
  // Delete any old cache versions
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())  // take control of all open tabs immediately
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', event => {
  // Only intercept same-origin GET requests (don't break Google Fonts, CDNs, etc.)
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve from cache immediately, but revalidate in background
        const revalidate = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => {});  // silence network errors during background revalidation
        return cached;       // always return the cached version without waiting
      }

      // Not in cache yet — fetch from network and cache the result
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If network fails and we're navigating, serve the app shell
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
