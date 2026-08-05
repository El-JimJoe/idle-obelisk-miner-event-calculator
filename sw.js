/* Service Worker fuer den Obelisk Event-Upgrade-Rechner.
 *
 * Strategie: "network first, cache fallback" fuer die Seite selbst.
 * Grund: der Rechner ist EINE Datei, die sich bei jedem Update aendert.
 * Bei "cache first" wuerden Nutzer nach einem Update die alte Version
 * sehen, bis der Cache irgendwann ablaeuft - der klassische PWA-Frust.
 * So bekommen sie online immer die frische Fassung und offline die
 * letzte, die sie geladen haben.
 *
 * CACHE bei jedem Release hochzaehlen, damit alte Eintraege wegfliegen.
 */
const CACHE = 'obelisk-rechner-v1';
const ASSETS = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', ev => {
  /* Nicht an einer einzelnen fehlenden Datei scheitern: jede Datei
     einzeln versuchen. addAll() bricht sonst komplett ab.            */
  ev.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(u => c.add(u).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  /* Der Spielstand-Endpunkt des Unraid-Servers darf NIE aus dem Cache
     kommen - sonst zeigt die Seite einen veralteten Stand.            */
  if (new URL(req.url).pathname.endsWith('/state')) return;

  ev.respondWith(
    fetch(req)
      .then(res => {
        /* Frische Antwort nebenbei in den Cache legen */
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match('index.html'))
      )
  );
});
