// Service worker, generated at build time (see vite.config.ts): the version and precache
// list placeholders are filled in from the built files, so every deploy gets a fresh cache.
const CACHE = 'heqie-__VERSION__';
const PRECACHE = __PRECACHE__;
const NAV_TIMEOUT_MS = 3000;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('heqie-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Network first so a new deploy shows up, but don't hang on a slow connection:
    // after a few seconds (or offline) serve the cached app.
    const timeout = new Promise((_, reject) => setTimeout(reject, NAV_TIMEOUT_MS));
    e.respondWith(
      Promise.race([fetch(req), timeout]).catch(async () => (await caches.match('./')) || fetch(req)),
    );
    return;
  }
  // Everything else is content-hashed or immutable: cache first.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
