const CACHE = "stride-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        const response = await fetch("/index.html");
        if (!response.ok) throw new Error("Shell unavailable");
        const html = await response.text();
        const assets = [
          ...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
        ].map((match) => match[1]);
        await cache.addAll([
          "/",
          "/index.html",
          "/icon.svg",
          "/icon-192.png",
          "/icon-512.png",
          "/manifest.webmanifest",
          ...assets,
        ]);
      })
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("stride-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Cache only this app's public shell, never a future API or user data endpoint.
  const staticAsset =
    url.pathname.startsWith("/assets/") ||
    [
      "/",
      "/index.html",
      "/icon.svg",
      "/icon-192.png",
      "/icon-512.png",
      "/manifest.webmanifest",
    ].includes(url.pathname);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !staticAsset
  )
    return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)),
          );
        }
        return response;
      } catch {
        // Vite sends Vary: Origin. Precached public assets and browser CORS module
        // requests use different Origin headers, but contain identical static bytes.
        const cached = await caches.match(event.request, { ignoreVary: true });
        return (
          cached ||
          (event.request.mode === "navigate"
            ? await caches.match("/index.html")
            : null) ||
          Response.error()
        );
      }
    })(),
  );
});
