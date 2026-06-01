// 像原生 App 一样锁定缩放：iOS Safari 会忽略 viewport 的 user-scalable，
// 必须手动拦截双指缩放手势（安卓/WebView 由 viewport 处理）。
['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) =>
  document.addEventListener(evt, (e) => e.preventDefault()),
);

// Register the service worker so the app can be installed to the home screen.
// Only runs in a secure context (HTTPS or localhost) — over plain HTTP the
// browser disallows service workers, so we skip silently and the site still works.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration is best-effort; ignore failures */
    });
  });
}
