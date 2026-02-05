const CACHE_NAME = 'exam-app-shell-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './assets/css/style.css',
    './assets/js/main.js',
    './assets/js/sidebar.js',
    './assets/js/indexeddb-manager.js',
    './assets/js/sync-manager.js',
    './assets/js/offline-exams.js',
    './assets/js/offline-exam-engine.js',
    './components/sidebar.html',
    './components/header.html',
    './pages/dashboard.html',
    './pages/offline-exams.html',
    './pages/take-offline-exam.html',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
];

// Install Event - Cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache and adding assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event - Clean up old caches
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
        })
    );
});

// Fetch Event - Serve from cache or network
self.addEventListener('fetch', (event) => {
    // Skip API calls - we don't want to cache sync.php or other data APIs
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((response) => {
            // Cache hit - return response
            if (response) {
                return response;
            }

            // Not in cache - fetch from network
            return fetch(event.request).then((networkResponse) => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // Clone the response to store in cache
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            });
        }).catch(() => {
            // If both fail, let it fail naturally 
            // Do not leave empty as it causes "canceled" status
            return fetch(event.request);
        })
    );
});
