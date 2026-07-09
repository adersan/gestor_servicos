const CACHE = "gestor-servicos-v96";
const ASSETS = [
  "./",
  "index.html",
  "cliente.html",
  "logo.svg",
  "icon-192.png",
  "icon-512.png",
  "styles.css?v=69",
  "cliente.css?v=24",
  "config.js?v=30",
  "auth.js?v=30",
  "data.js?v=42",
  "app.js?v=85",
  "supplier.js?v=39",
  "fornecedor.html",
  "fornecedor.css?v=20",
  "fornecedor.js?v=22",
  "cliente.js?v=25",
  "acompanhamento.html",
  "acompanhamento.css?v=20",
  "acompanhamento.js?v=20",
  "manifest.webmanifest?v=2"
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
