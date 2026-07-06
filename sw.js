/* Author Clock service worker: offline cache-first app shell. */
"use strict";

var CACHE_NAME = "author-clock-v2";
var PRECACHE_URLS = [
  "./index.html",
  "assets/style.css",
  "assets/app.js",
  "data/ko_quotes.js",
  "manifest.webmanifest",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-512-maskable.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon-32.png",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = caches.open(CACHE_NAME).then(function (cache) {
        return fetch(event.request)
          .then(function (response) {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(function () {
            return cached;
          });
      });
      event.waitUntil(network);
      return cached || network;
    })
  );
});
