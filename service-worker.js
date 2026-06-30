const CACHE_NAME = "menezzi-site-v7";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./manifest.json",
  "./admin/index.html",
  "./js/config.js",
  "./js/products-store.js",
  "./js/admin.js",
  "./js/components/ProductCard.js",
  "./js/components/ProductModal.js",
  "./js/components/ProductGrid.js",
  "./js/components/CategoryFilter.js",
  "./js/components/AdminProducts.js",
  "./assets/logo-menezzi.jpg",
  "./assets/hero-bolsa-preta.jpg",
  "./assets/bolsa-elegance.jpg",
  "./assets/bolsa-casual-chic.jpg",
  "./assets/bolsa-classica.jpg",
  "./assets/bolsa-tote.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
