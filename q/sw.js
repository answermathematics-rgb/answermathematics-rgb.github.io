// 공기계 페이지 저장: 항상 최신 페이지를 먼저 받아오고, 인터넷이 느리거나 끊기면 저장된 페이지를 바로 보여줌
const CACHE = "q-kiosk-v1";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./logo.png", "./icon-192.png"];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).catch(() => {})); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;  // 서버 호출·사진 업로드는 건드리지 않음
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; });
    const timeout = new Promise((res) => setTimeout(res, 3000));
    const first = await Promise.race([net.catch(() => null), timeout]);
    if (first) return first;
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit || net;
  })());
});
