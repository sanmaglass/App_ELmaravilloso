// ──────────────────────────────────────────────────────────────
// Service Worker — Push Notifications para El Maravilloso
// NO cachea nada. Solo maneja push y notificationclick.
// ──────────────────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .catch(() => {})
            .then(() => self.clients.claim())
    );
});

// ── Push: mostrar notificación ──────────────────────────────
self.addEventListener('push', (event) => {
    let data = { title: 'El Maravilloso', body: 'Tienes un recordatorio pendiente' };

    try {
        if (event.data) {
            const json = event.data.json();
            data = {
                title: json.title || data.title,
                body: json.body || data.body,
                icon: json.icon || '/assets/icon-512.png',
                badge: json.badge || '/assets/icon-512.png',
                tag: json.tag || 'wm-push',
                data: json.data || {}
            };
        }
    } catch (e) {
        // Si no es JSON, usar el texto plano
        if (event.data) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon || '/assets/icon-512.png',
            badge: data.badge || '/assets/icon-512.png',
            tag: data.tag || 'wm-push',
            data: data.data || {},
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 400]
        })
    );
});

// ── Click: abrir/enfocar la app ─────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                // Si ya hay una ventana abierta, enfocarla
                for (const client of clients) {
                    if (client.url.includes(self.registration.scope)) {
                        return client.focus();
                    }
                }
                // Si no, abrir una nueva
                return self.clients.openWindow('/');
            })
    );
});

// NO fetch listener: todas las peticiones pasan directo a la red.
