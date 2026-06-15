const CACHE = "gestor-servicos-v32";
const ASSETS = [
  "./",
  "index.html",
  "cliente.html",
  "styles.css?v=30",
  "cliente.css?v=15",
  "config.js?v=30",
  "auth.js?v=30",
  "data.js?v=30",
  "app.js?v=30",
  "supplier.js?v=31",
  "fornecedor.html",
  "fornecedor.css?v=19",
  "fornecedor.js?v=19",
  "cliente.js?v=15",
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
