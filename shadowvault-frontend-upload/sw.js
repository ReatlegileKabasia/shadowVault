const CACHE_NAME = "quick-calc-shell-v1";
const APP_SHELL = [
    "./",
    "./index.html",
    "./config.js",
    "./styleVault.css",
    "./app.js",
    "./manifest.json",
    "./icon.svg"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const requestUrl = new URL(event.request.url);
    if (
        event.request.method !== "GET" ||
        requestUrl.origin !== self.location.origin ||
        requestUrl.pathname.startsWith("/api/")
    ) {
        return;
    }

    event.respondWith(
        (async () => {
            let response;
            try {
                response = await fetch(event.request);
            } catch {
                const cached = await caches.match(event.request);
                if (cached) {
                    return cached;
                }
                throw new Error("This app page is not available offline.");
            }

            if (response.ok) {
                event.waitUntil(
                    caches.open(CACHE_NAME)
                        .then(cache => cache.put(event.request, response.clone()))
                );
            }
            return response;
        })()
    );
});
