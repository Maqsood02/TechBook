const CACHE_NAME = 'techbook-cache-v61';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/img/logo.png',
  '/img/logo_cropped.png'
];

// Install Service Worker
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Activate Service Worker and Clean Old Caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Purging old service worker cache:', key);
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
  
  // NEVER intercept cross-origin / third-party requests (Google, Firebase, Groq, Anthropic, ElevenLabs, etc.)
  if (!url.startsWith(self.location.origin)) {
    return;
  }

  // Skip non-GET requests or local API routes
  if (event.request.method !== 'GET' || url.includes('/api/')) {
    return;
  }

  // Network-First strategy for HTML navigation, JS, and CSS requests to prevent stale PWA cache lock
  if (
    event.request.mode === 'navigate' || 
    url.endsWith('.html') || 
    url.includes('.js') || 
    url.includes('.css') || 
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
