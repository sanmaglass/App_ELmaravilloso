// Service Worker for PWA - Enhanced Version
const CACHE_NAME = 'el-maravilloso-v3.00-auto-update'; // Increment version
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
    './js/views/security.js',
    './js/views/settings.js',
    './js/views/suppliers.js',
    // Assets
    './assets/logo.png',
    './manifest.json'
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
                        // Final fallback for HTML
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return new Response('<h1>Sin Conexión</h1><p>Esta página no está disponible offline.</p>', {
                                headers: { 'Content-Type': 'text/html' }
                            });
                        }
                    });
            })
    );
});

// Listen for messages from the main app (for manual updates)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Received skip waiting message');
        self.skipWaiting();
    }
});
