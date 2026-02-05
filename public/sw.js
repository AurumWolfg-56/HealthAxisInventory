const CACHE_NAME = 'healthaxis-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/logo.png',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Bypass for Supabase and other external API calls
    if (url.hostname.includes('supabase.co')) {
        return;
    }

    // Bypass for Vite dev server assets, HMR, and Chrome extensions
    if (
        url.pathname.includes('@vite') ||
        url.pathname.includes('@react-refresh') ||
        url.search.includes('t=') || // HMR timestamp
        url.protocol === 'chrome-extension:' ||
        event.request.method !== 'GET'
    ) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                // Return null or fallback if fetch fails (e.g., offline)
                return null;
            });
        })
    );
});
