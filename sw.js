const CACHE = "gestor-servicos-v34";
const ASSETS = [
  "./",
  "index.html",
  "cliente.html",
  "styles.css?v=31",
  "cliente.css?v=16",
  "config.js?v=30",
  "auth.js?v=30",
  "data.js?v=30",
  "app.js?v=31",
  "supplier.js?v=32",
  "fornecedor.html",
  "fornecedor.css?v=19",
  "fornecedor.js?v=20",
  "cliente.js?v=16",
  "acompanhamento.html",
  "acompanhamento.css?v=13",
  "acompanhamento.js?v=13",
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
