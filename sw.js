const CACHE = "gestor-servicos-v13";
const ASSETS = [
  "./",
  "index.html",
  "cliente.html",
  "styles.css?v=13",
  "cliente.css?v=13",
  "config.js?v=13",
  "auth.js?v=13",
  "data.js?v=13",
  "app.js?v=13",
  "cliente.js?v=13",
  "acompanhamento.html",
  "acompanhamento.css?v=12",
  "acompanhamento.js?v=12",
  "manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
