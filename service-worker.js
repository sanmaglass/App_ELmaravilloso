const CACHE_NAME = 'el-maravilloso-v223-reminders-fix';
const urlsToCache = [
    './index.html',
    './css/style.css',
    './css/components.css',
    './js/app.js',
    './js/db.js',
    './js/sync.js',
    './js/utils.js',
    './js/config.js',
    './js/sii_api.js',
    // View files
    './js/views/auth.js',
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
    // Assets
    './assets/logo.png',
    './assets/splash.png',
    './assets/logo-dark.png',
    './manifest.json',
    './offline.html'
];



// Install event - cache resources
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
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip cross-origin and Supabase
    if (url.origin !== location.origin || url.href.includes('supabase.co')) {
        return;
    }

    // Network First then Cache
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If offline or network fails, look in cache
                return caches.match(event.request)
                    .then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        // Styled offline fallback page
                        if (event.request.headers.get('accept')?.includes('text/html')) {
                            return caches.match('./offline.html');
                        }
                    });
            })
    );
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


