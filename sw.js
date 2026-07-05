const CACHE_NAME = 'techbook-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/img/logo.png',
  '/img/logo_cropped.png'
];

// Install Service Worker
self.addEventListener('install', event => {
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
      }).catch(() => {
        // Return index.html as fallback for navigation requests offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      })
  );
});
