const CACHE_NAME = 'techbook-cache-v41';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/img/logo.png',
  '/img/logo_cropped.png'
];

// Handle SKIP_WAITING message
self.addEventListener('message', event => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    self.skipWaiting();
  }
});

// Install Service Worker
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate Service Worker and Clean Old Caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('🧹 Evicting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Requests
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Skip non-GET requests or Firebase APIs
  if (
    event.request.method !== 'GET' || 
    url.includes('/api/') || 
    url.includes('firestore.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com')
  ) {
    return;
  }

  // Network-First strategy for HTML navigation and JS requests to prevent stale PWA cache lock
  if (
    event.request.mode === 'navigate' || 
    url.endsWith('.html') || 
    url.includes('.js') || 
    url === self.location.origin + '/'
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(event.request) || caches.match('/index.html');
        })
    );
    return;
  }

  // Cache-First strategy for other static assets
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
  );
});
