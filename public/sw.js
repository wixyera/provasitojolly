// Never cache authenticated pages, API responses or app bundles.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('jolly-')).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response('<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Jolly · Offline</title><body style="font-family:system-ui;padding:10%;background:#fff6f8;color:#351017"><h1>Torniamo subito.</h1><p>Collegati a Internet per aprire Jolly e consultare disponibilità aggiornate.</p><a href="/">Riprova</a></body></html>', {headers:{'Content-Type':'text/html;charset=utf-8'},status:503})));
});
