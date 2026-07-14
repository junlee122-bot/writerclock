/* WriterClock service worker: versioned app shell + safe stale-while-revalidate. */
"use strict";

var CACHE_PREFIX = "writerclock-";
var CACHE_NAME = CACHE_PREFIX + "v1.1.0";
var PRECACHE_URLS = [
  "./",
  "./index.html",
  "assets/style.css",
  "assets/app.js",
  "assets/og-image.png",
  "data/ko_quotes.js",
  "docs/SOURCE_AUDIT.md",
  "DATA_LICENSE.md",
  "NOTICE.md",
  "data/LITERATURE_CLOCK_LICENSE.md",
  "firmware/OFL.txt",
  "manifest.webmanifest",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-512-maskable.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon-32.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return cache.addAll(PRECACHE_URLS);
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key.indexOf(CACHE_PREFIX) === 0 && key !== CACHE_NAME;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

function cacheable(response) {
  return response && response.ok && (response.type === "basic" || response.type === "default");
}

function put(event, response) {
  if (!cacheable(response)) return Promise.resolve();
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.put(event.request, response.clone());
  });
}

function networkFirst(event) {
  return fetch(event.request).then(function (response) {
    event.waitUntil(put(event, response));
    return response;
  }).catch(function () {
    return caches.match(event.request).then(function (cached) {
      return cached || caches.match("./index.html");
    });
  });
}

function staleWhileRevalidate(event) {
  return caches.match(event.request).then(function (cached) {
    var update = fetch(event.request).then(function (response) {
      return put(event, response).then(function () { return response; });
    }).catch(function () { return null; });
    event.waitUntil(update);
    if (cached) return cached;
    return update.then(function (response) {
      return response || Response.error();
    });
  });
}

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
