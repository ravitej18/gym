const CACHE_NAME = "gymflow-v13";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./gym.config.js",
  "./styles/main.css",
  "./lib/firebase-init.js",
  "./modules/utils.js",
  "./modules/auth.js",
  "./modules/dashboard.js",
  "./modules/members.js",
  "./modules/memberships.js",
  "./modules/payments.js",
  "./modules/renewals.js",
  "./modules/reminders.js",
  "./modules/trainers.js",
  "./modules/attendance.js",
  "./modules/workouts.js",
  "./modules/progress.js",
  "./modules/reports.js",
  "./modules/settings.js",
  "./modules/my-membership.js",
  "./modules/my-payments.js",
  "./modules/trainer-checkin.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
