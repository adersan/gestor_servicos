const CACHE = "gestor-servicos-v30";
const ASSETS = [
  "./",
  "index.html",
  "cliente.html",
  "styles.css?v=29",
  "cliente.css?v=15",
  "config.js?v=29",
  "auth.js?v=29",
  "data.js?v=29",
  "app.js?v=29",
  "supplier.js?v=29",
  "fornecedor.html",
  "fornecedor.css?v=18",
  "fornecedor.js?v=18",
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
