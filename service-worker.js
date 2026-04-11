const CACHE_NAME = 'el-maravilloso-v1009';
// NOTA: auth.js, main.js, index.html NO se cachean (siempre red)
const urlsToCache = [
    // NO cachear: './index.html', './main.js', './js/views/auth.js'
    './css/style.css',
    './css/components.css',
    './js/app.js',
    './js/config.js',
    './js/constants.js',
    './js/db.js',
    './js/transaction-manager.js',
    './js/error-logger.js',
    './js/utils.js',
    './js/sync.js',
    './js/sync/device-id.js',
    './js/sync/hlc.js',
    './js/sync/outbox.js',
    './js/sync/sync-v2.js',
    './js/sii_api.js',
    './js/notifications.js',
    // archivos (excluido auth.js)
    './js/views/calculator.js',
    './js/views/calendar.js',
    './js/views/dashboard.js',
    './js/views/daily_sales.js',
    './js/views/employees.js',
    './js/views/expenses.js',
    './js/views/marketing.js',
    './js/views/payments.js',
    './js/views/purchase_invoices.js',
    './js/views/reports.js',
    './js/views/sales_invoices.js',
    './js/views/electronic_invoices.js',
    './js/views/reminders.js',
    './js/views/security.js',
    './js/views/settings.js',
    './js/views/suppliers.js',
    // assets
    './assets/logo.png',
    './assets/splash.png',
    './assets/logo-dark.png',
    './assets/icon-512.png',
    './manifest.json',
    './offline.html'
];



// instalaciónes
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - Network First Strategy
// IMPORTANTE: toda rama DEBE devolver una Response válida, nunca undefined,
// o Safari rompe con "FetchEvent.respondWith received an error: Returned response is null".
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Solo manejamos GET. Safari y otros browsers lanzan error si intentamos
    // cachear POST/PUT/DELETE, así que los dejamos pasar directos.
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Ignorar cross-origin y Supabase (el browser los maneja directo).
    if (url.origin !== location.origin || url.href.includes('supabase.co')) {
        return;
    }

    const criticalFiles = ['/main.js', 'main.js', '/js/views/auth.js', 'js/views/auth.js', '/index.html', 'index.html'];
    const isCritical = criticalFiles.some(file => url.pathname.endsWith(file));

    const acceptsHtml = req.headers.get('accept')?.includes('text/html');

    const fallbackResponse = () => new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' }
    });

    if (isCritical) {
        // Network-first sin caching para archivos críticos.
        event.respondWith((async () => {
            try {
                const networkResponse = await fetch(req);
                if (networkResponse) return networkResponse;
                throw new Error('Empty network response');
            } catch (e) {
                const cached = await caches.match(req);
                if (cached) return cached;
                if (acceptsHtml) {
                    const offline = await caches.match('./offline.html');
                    if (offline) return offline;
                }
                return fallbackResponse();
            }
        })());
    } else {
        // Network-first con caching para el resto.
        event.respondWith((async () => {
            try {
                const networkResponse = await fetch(req);
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.put(req, clone))
                        .catch(() => { /* ignorar errores de caching */ });
                }
                if (networkResponse) return networkResponse;
                throw new Error('Empty network response');
            } catch (e) {
                const cached = await caches.match(req);
                if (cached) return cached;
                if (acceptsHtml) {
                    const offline = await caches.match('./offline.html');
                    if (offline) return offline;
                }
                return fallbackResponse();
            }
        })());
    }
});

// Listen for messages from the main app (for manual updates)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[ServiceWorker] Received skip waiting message');
        self.skipWaiting();
    }
});

// Notifications Support
self.addEventListener('push', (event) => {
    let data = { title: 'El Maravilloso', body: 'Nueva actualización recibida.' };
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: './assets/logo.png',
        badge: './assets/logo.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || './index.html'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});


