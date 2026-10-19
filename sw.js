/* Service worker — membuat Simulasi TKA bisa di-install & dibuka offline
   di PC/laptop maupun HP. Sengaja memakai strategi cache-first untuk aset
   statis, dan network-first untuk navigasi supaya update cepat masuk. */

const VERSION = "v32";
const CACHE = "simulasi-tka-" + VERSION;

// Hanya aset statis milik aplikasi. Jangan pernah cache request navigasi
// (halaman) atau pun API eksternal.
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./js/config.js",
  "./js/data-matematika.js",
  "./js/data-indonesia.js",
  "./js/data-inggris.js",
  "./js/data-produktif.js",
  "./js/data-pkwu.js",
  "./js/data-tts.js",
  "./js/store.js",
  "./js/games.js",
  "./js/parser.js",
  "./js/engine.js",
  "./js/dynamic.js",
  "./js/dynamic2.js",
  "./js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll gagal penuh kalau satu file 404; pakai add per-file agar
      // satu aset bermasalah tidak memblokir seluruh instalasi.
      Promise.all(
        ASSETS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch((err) => {
            console.warn("[sw] gagal cache:", url, err && err.message);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // biarkan font/eksternal lewat

  // Navigasi (buka halaman): coba jaringan dulu, jatuh ke cache saat offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Aset lain: sajikan dari cache, isi cache di belakang bila belum ada.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});