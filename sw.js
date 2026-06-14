const CACHE = "gestor-servicos-v18";
const ASSETS = [
  "./",
  "index.html",
  "cliente.html",
  "styles.css?v=18",
  "cliente.css?v=14",
  "config.js?v=18",
  "auth.js?v=18",
  "data.js?v=18",
  "app.js?v=18",
  "supplier.js?v=18",
  "fornecedor.html",
  "fornecedor.css?v=15",
  "fornecedor.js?v=15",
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
