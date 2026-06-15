const CACHE = "gestor-servicos-v28";
const ASSETS = [
  "./",
  "index.html",
  "cliente.html",
  "styles.css?v=27",
  "cliente.css?v=14",
  "config.js?v=27",
  "auth.js?v=27",
  "data.js?v=27",
  "app.js?v=27",
  "supplier.js?v=27",
  "fornecedor.html",
  "fornecedor.css?v=18",
  "fornecedor.js?v=18",
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
