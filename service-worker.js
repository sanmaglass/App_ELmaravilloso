// Service Worker for PWA - Enhanced Version
const CACHE_NAME = 'el-maravilloso-v2.63-debug'; // Increment version for updates
const urlsToCache = [
    './index.html',
    './css/style.css',
    './css/components.css',
    './js/app.js',
    './js/db.js',
    './js/sync.js',
    './js/utils.js',
    './js/config.js',
    // View files
    './js/views/auth.js',
    './js/views/calculator.js',
    './js/views/calendar.js',
    './js/views/dashboard.js',
    './js/views/employees.js',
    './js/views/marketing.js',
    './js/views/payments.js',
    './js/views/security.js',
    './js/views/settings.js',
    // Assets
    './assets/logo.png',
    './manifest.json'
];

// Install event - cache resources with error handling
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app files...');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[SW] All files cached successfully');
                return self.skipWaiting(); // Activate immediately
            })
            .catch((error) => {
                console.error('[SW] Cache installation failed:', error);
                // Don't fail silently - this will prevent SW from installing
                throw error;
            })
    );
});

// Activate event - clean old caches and take control immediately
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] Service worker activated');
            return self.clients.claim(); // Take control of all pages immediately
        })
    );
});

// Fetch event - Smart caching strategies with error handling
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip cross-origin requests (CDNs, external APIs)
    if (url.origin !== location.origin) {
        // For external resources, try network first, no cache
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // If network fails, external resource is unavailable
                    console.warn('[SW] External resource unavailable:', url.href);
                    return new Response('', { status: 503, statusText: 'Service Unavailable' });
                })
        );
        return;
    }

    // For Supabase API calls (network-first)
    if (url.href.includes('supabase.co')) {
        event.respondWith(
            fetch(event.request)
                .catch((error) => {
                    console.error('[SW] API request failed:', error);
                    return new Response(JSON.stringify({ error: 'Network unavailable' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // For app files (cache-first with network fallback)
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version
                    return cachedResponse;
                }

                // Try network if not in cache
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Cache the new resource for future use
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('[SW] Fetch failed for:', event.request.url, error);

                        // Return a custom offline page for HTML requests
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return new Response(
                                '<h1>Sin Conexión</h1><p>Por favor verifica tu conexión a internet.</p>',
                                { headers: { 'Content-Type': 'text/html' } }
                            );
                        }

                        throw error;
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
