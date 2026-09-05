const CACHE = "gestor-servicos-v265";
const ASSETS = [
  "./",
  "index.html",
  "cliente.html",
  "logo.svg",
  "icon-192.png",
  "icon-512.png",
  "styles.css?v=155",
  "cliente.css?v=25",
  "config.js?v=31",
  "auth.js?v=30",
  "data.js?v=56",
  "app.js?v=210",
  "supplier.js?v=67",
  "fornecedor.html",
  "fornecedor.css?v=26",
  "fornecedor.js?v=30",
  "cliente.js?v=34",
  "acompanhamento.html",
  "acompanhamento.css?v=36",
  "acompanhamento.js?v=50",
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
  // So intercepta GET - deixar POST/PUT/DELETE passar direto evita um bug conhecido
  // de service worker no Safari/WebKit mobile que corrompe o corpo (FormData/JSON) de
  // requisicoes nao-GET quando repassadas via fetch(event.request) - foi a causa real
  // do erro "Failed to parse body as FormData" no upload de imagem do Extras no celular.
  if (event.request.method !== "GET") return;
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

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Gestor de Serviços";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientsList) => {
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
