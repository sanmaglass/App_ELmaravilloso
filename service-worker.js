// Service Worker DESACTIVADO (self-destructor).
// Este archivo ya no intercepta peticiones. Si un navegador lo carga desde
// HTTP cache (porque tenía una versión anterior instalada), se desregistra
// a sí mismo y borra todas las cachés viejas. Luego la app funciona como
// una web normal sin SW.

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
        } catch (e) { /* ignorar */ }
        try {
            await self.registration.unregister();
        } catch (e) { /* ignorar */ }
        try {
            const clientsList = await self.clients.matchAll({ type: 'window' });
            for (const client of clientsList) {
                client.navigate(client.url).catch((e) => { console.warn('SW client.navigate falló:', e); });
            }
        } catch (e) { /* ignorar */ }
    })());
});

// NO fetch listener: dejamos que todas las peticiones pasen directas a la red.
