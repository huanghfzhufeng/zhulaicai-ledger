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
