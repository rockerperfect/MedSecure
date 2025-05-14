// Firebase Service Worker
// Handles cache management and connection issues for Firebase services

const CACHE_NAME = 'firebase-cache-v1';
const FIREBASE_CACHE_URLS = [
  'https://www.googleapis.com/identitytoolkit',
  'https://securetoken.googleapis.com',
  'https://www.googleapis.com/identitytoolkit/v3/relyingparty',
  'https://firestore.googleapis.com',
  'https://firebase.googleapis.com'
];

// Install event - cache essential Firebase resources
self.addEventListener('install', event => {
  console.log('Firebase ServiceWorker: Installing');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  // We don't need to cache Firebase resources on install
  // as they are dynamically handled during fetch
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Firebase ServiceWorker: Activating');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Firebase ServiceWorker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Firebase ServiceWorker: Activated and controlling');
      return self.clients.claim();
    })
  );
});

// Fetch event - handle Firebase API requests
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Only handle Firebase-related URLs
  if (FIREBASE_CACHE_URLS.some(fbUrl => url.includes(fbUrl))) {
    // For Firebase requests, we'll use a network-first strategy
    // with a timeout fallback to cached responses if available
    event.respondWith(
      networkFirstWithTimeout(event.request, 5000)
    );
  }
});

// Network-first strategy with timeout fallback
async function networkFirstWithTimeout(request, timeoutMs) {
  try {
    // Try to construct a cache key that includes authentication info
    const cacheKey = await createCacheKeyFromRequest(request);
    
    // Start the network request
    const networkPromise = fetch(request.clone())
      .then(response => {
        // If successful, update the cache
        if (response && response.ok) {
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(cacheKey, clonedResponse);
          });
        }
        return response;
      })
      .catch(err => {
        console.error('Firebase ServiceWorker: Network fetch failed', err);
        throw err;
      });
    
    // Set up the timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Network request timeout'));
      }, timeoutMs);
    });
    
    // Race the network request against the timeout
    return Promise.race([
      networkPromise,
      timeoutPromise.catch(async error => {
        console.log('Firebase ServiceWorker: Network timeout, trying cache', error);
        
        // If timeout, try to get from cache
        const cachedResponse = await caches.match(cacheKey);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // If no cached response, throw the original error
        throw error;
      })
    ]).catch(async error => {
      console.log('Firebase ServiceWorker: All strategies failed', error);
      
      // Final fallback - try cache again with no frills
      const cachedResponse = await caches.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If all strategies fail, return a specific error response
      return new Response(JSON.stringify({
        error: 'firebase_connection_error',
        message: 'Failed to connect to Firebase services'
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Firebase-SW': 'connection-error'
        }
      });
    });
  } catch (e) {
    console.error('Firebase ServiceWorker: Error in fetch handler', e);
    return new Response('Service Worker Error', { status: 500 });
  }
}

// Create a cache key from a request that preserves auth info
async function createCacheKeyFromRequest(request) {
  // For authentication requests, we need to include the body in the cache key
  // as the body contains the credentials
  if (request.method === 'POST' && 
      (request.url.includes('signInWithPassword') || 
       request.url.includes('token'))) {
    try {
      // Clone the request so we can read the body
      const requestClone = request.clone();
      const body = await requestClone.text();
      
      // Create a new request object with the same properties
      // but add a custom header with a hash of the body
      const newHeaders = new Headers(request.headers);
      newHeaders.append('X-Body-Hash', hashCode(body).toString());
      
      return new Request(request.url, {
        method: request.method,
        headers: newHeaders,
        mode: request.mode,
        credentials: request.credentials,
        redirect: request.redirect
      });
    } catch (e) {
      console.error('Firebase ServiceWorker: Error creating cache key', e);
      return request;
    }
  }
  
  return request;
}

// Simple string hash function
function hashCode(str) {
  let hash = 0;
  if (str.length === 0) return hash;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash;
}

// Message event handler
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'clear-firebase-caches') {
    console.log('Firebase ServiceWorker: Received request to clear caches');
    
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(requests => {
        promises = requests.map(request => {
          return cache.delete(request);
        });
        
        return Promise.all(promises);
      }).then(() => {
        console.log('Firebase ServiceWorker: Cleared all Firebase caches');
        
        // Notify clients that caches were cleared
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'firebase-cache-cleared',
              timestamp: new Date().getTime()
            });
          });
        });
      });
    });
  }
  
  if (event.data && event.data.type === 'ping') {
    // Respond to ping messages to check if service worker is active
    event.source.postMessage({
      type: 'pong',
      timestamp: Date.now()
    });
  }
});

// Handle errors that might occur during fetch operations
self.addEventListener('error', event => {
  console.error('Firebase ServiceWorker: Uncaught error', event.error);
});

console.log('Firebase ServiceWorker: Loaded successfully'); 