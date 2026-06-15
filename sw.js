const CACHE = "gestor-servicos-v26";
const ASSETS = [
  "./",
  "index.html",
  "cliente.html",
  "styles.css?v=26",
  "cliente.css?v=14",
  "config.js?v=26",
  "auth.js?v=26",
  "data.js?v=26",
  "app.js?v=26",
  "supplier.js?v=26",
  "fornecedor.html",
  "fornecedor.css?v=16",
  "fornecedor.js?v=16",
  "cliente.js?v=14",
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
