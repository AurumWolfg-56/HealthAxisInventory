// IMPORTANT: Increment this version whenever you deploy new code to force cache refresh
const CACHE_VERSION = 'healthaxis-v3-fixed-persistence';
const ASSETS_TO_CACHE = [
    '/logo.png',
    '/manifest.json'
    // NOTE: Intentionally NOT caching index.html or JS files - they need to be fresh
];

// Install event - cache only static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing new service worker', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            console.log('[SW] Caching static assets');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => {
            // Force the new service worker to activate immediately
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating new service worker', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_VERSION) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all pages immediately
            return self.clients.claim();
        })
    );
});

// Fetch event - network first for HTML/JS, cache for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Bypass for external APIs
    if (url.hostname.includes('supabase.co') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com')) {
        return;
    }

    // Bypass for Vite dev server
    if (url.pathname.includes('@vite') ||
        url.pathname.includes('@react-refresh') ||
        url.search.includes('t=') ||
        url.protocol === 'chrome-extension:' ||
        event.request.method !== 'GET') {
        return;
    }

    // CRITICAL: ALWAYS fetch fresh HTML and JS files (network-first)
    if (url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.js') ||
        url.pathname === '/' ||
        url.pathname === '') {

        console.log('[SW] Network-first for:', url.pathname);
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Don't cache HTML/JS - always use fresh version
                    return response;
                })
                .catch(() => {
                    // If offline, try cache as fallback
                    return caches.match(event.request);
                })
        );
        return;
    }

    // For other assets (images, fonts, etc.) - cache first
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((fetchResponse) => {
                // Cache the fetched asset for future use
                return caches.open(CACHE_VERSION).then((cache) => {
                    cache.put(event.request, fetchResponse.clone());
                    return fetchResponse;
                });
            });
        })
    );
});
