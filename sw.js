// ============================================================
// TRANSPORTE TEC - SERVICE WORKER (sw.js)
// Habilita instalación PWA y cache offline
// ============================================================

const CACHE_NAME = 'tec-transporte-v1.2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './logo.png',
  'https://fonts.googleapis.com/css2?family=Calibri:wght@400;600;700&display=swap'
];

// INSTALL - cache recursos estáticos
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cache abierto');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Error cacheando algunos assets:', err);
      });
    })
  );
  self.skipWaiting();
});

// ACTIVATE - limpiar caches viejos
self.addEventListener('activate', event => {
  console.log('[SW] Activando...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eliminando cache antiguo:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// FETCH - estrategia Network First con fallback a cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Para peticiones a Supabase y Apps Script: solo network
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleapis.com')
  ) {
    return; // dejar pasar sin interceptar
  }

  // Para assets estáticos: cache first
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Actualizar en background
        fetch(event.request).then(freshResponse => {
          if (freshResponse && freshResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, freshResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => {
        // Offline fallback
        return caches.match('./index.html');
      });
    })
  );
});

// SINCRONIZACIÓN EN BACKGROUND (cuando recupera conexión)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pendientes') {
    event.waitUntil(syncPendientes());
  }
});

async function syncPendientes() {
  // Los clientes manejan la sincronización
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_PENDIENTES' });
  });
}
