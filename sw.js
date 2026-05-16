/* Rosy Recruits — minimal service worker.
   Purpose: meet the PWA install criteria (manifest + registered SW + responsive) so Chrome
   fires `beforeinstallprompt`. We deliberately do NOT cache JSX or the HTML shell because
   the in-browser Babel cache-buster needs fresh fetches every page load. */

const CACHE = 'rosy-v1';
const PRECACHE = [
  '/project/styles.css',
  '/project/assets/logo.avif',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('.jsx') || url.pathname === '/' || url.pathname === '/index.html') return;
  if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/rest')) return;

  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
  }
});
