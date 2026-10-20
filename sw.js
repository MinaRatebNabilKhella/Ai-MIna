const CACHE_NAME = 'mina-student-shell-v2';
const SHELL_FILES = ['./', './index.html', './styles.css', './config.js', './core.js', './views.js', './app.js', './xlsx-reader.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // Never cache authentication, Supabase API, Edge Functions, or other cross-origin requests.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/rest/v1/') || url.pathname.includes('/functions/v1/')) return;
  event.respondWith(fetch(req).then(response => {
    if (response && response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, copy)); }
    return response;
  }).catch(async () => (await caches.match(req)) || (await caches.match('./index.html'))));
});
