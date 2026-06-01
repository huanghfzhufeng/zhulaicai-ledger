// Minimal service worker — its only job is to make the app installable as a PWA
// (Android "安装应用" / iOS 添加到主屏幕). It is network-only on purpose: no
// offline cache, so the app is always fresh and never serves a stale version.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  /* passthrough: let the browser fetch from the network as usual */
});
