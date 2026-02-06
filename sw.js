const CACHE_NAME = 'rethink-exam-v12';
const PRE_CACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/css/style.css',
    './assets/js/main.js',
    './assets/js/sidebar.js',
    './assets/js/indexeddb-manager.js',
    './assets/js/sync-manager.js',
    './assets/js/print-engine.js',
    './assets/js/dashboard.js',
    './assets/js/offline-exams.js',
    './assets/js/offline-exam-engine.js',
    './assets/js/performance-review.js',
    './components/header.html',
    './components/sidebar.html',
    './pages/dashboard.html',
    './pages/offline-exams.html',
    './pages/take-offline-exam.html',
    './pages/performance-review.html'
];

const EXTERNAL_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('SW v5: Starting resilient installation...');

            // 1. Cache internal assets (must succeed)
            try {
                await cache.addAll(PRE_CACHE_ASSETS);
                console.log('SW v5: Internal assets cached.');
            } catch (e) {
                console.error('SW v5: Critical internal cache failed!', e);
            }

            // 2. Cache external assets individually with no-cors
            for (const url of EXTERNAL_ASSETS) {
                try {
                    // Using no-cors ensures we get an opaque response that can be cached
                    // even if the server doesn't provide CORS headers.
                    const response = await fetch(url, { mode: 'no-cors' });
                    await cache.put(url, response);
                    console.log(`SW v5: Cached external asset: ${url}`);
                } catch (e) {
                    console.warn(`SW v5: Failed to cache external asset: ${url}`, e);
                }
            }
        })
    );
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('SW v5: Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Cache-First with Network Fallback & Update
            const networkFetch = fetch(event.request).then((networkResponse) => {
                if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch((error) => {
                // Return cached response if network fails, OR throw if nothing
                if (cachedResponse) return cachedResponse;
                throw error;
            });

            return cachedResponse || networkFetch;
        })
    );
});
