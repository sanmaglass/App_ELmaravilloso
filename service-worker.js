// ──────────────────────────────────────────────────────────────
// Service Worker — Push Notifications + Offline Cache
// Estrategia: Network-first con fallback a cache para app shell
// ──────────────────────────────────────────────────────────────

const CACHE_NAME = 'wm-v1063';
const APP_SHELL = [
    '/',
    '/index.html',
    '/offline.html',
    '/css/style.css',
    '/css/components.css',
    '/assets/icon-512.png',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ── Fetch: Network-first, cache fallback ───────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // No cachear: APIs, Supabase, analytics, CDN libs (versionadas por query string)
    if (url.origin !== self.location.origin ||
        url.pathname.startsWith('/api/') ||
        event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cachear copia de respuestas exitosas de app shell y assets
                if (response.ok && (
                    url.pathname.endsWith('.css') ||
                    url.pathname.endsWith('.js') ||
                    url.pathname.startsWith('/assets/') ||
                    url.pathname === '/' ||
                    url.pathname === '/index.html'
                )) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                // Sin red: servir de cache o página offline
                return caches.match(event.request)
                    .then(cached => cached || caches.match('/offline.html'));
            })
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
                for (const client of clients) {
                    if (client.url.includes(self.registration.scope)) {
                        return client.focus();
                    }
                }
                return self.clients.openWindow('/');
            })
    );
});
