/**
 * VoxArt Studio - Service Worker for PWA Offline, Live Updates & Web Share Target
 */

const CACHE_NAME = 'voxart-cache-v6-ridialart';
const SHARE_DB_NAME = 'voxart-share-db';
const SHARE_DB_VERSION = 1;
const SHARE_STORE_NAME = 'incoming_shares';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.ico',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/logo.png',
  '/logo.jpg'
];

function openShareDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(SHARE_STORE_NAME)) {
        db.createObjectStore(SHARE_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveIncomingShare(payload) {
  const db = await openShareDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SHARE_STORE_NAME);
    store.put(payload);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-cache warning (some assets could be deferred):', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept blob:, data:, chrome-extension:, or external cross-origin requests
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Intercept Android / Desktop Web Share Target POST requests
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const title = String(formData.get('title') || '').trim();
          const text = String(formData.get('text') || '').trim();
          const sharedUrl = String(formData.get('url') || '').trim();
          const rawFiles = formData.getAll('media');

          const serializedFiles = [];
          for (const item of rawFiles) {
            if (item && typeof item === 'object' && typeof item.arrayBuffer === 'function' && item.size > 0) {
              const buffer = await item.arrayBuffer();
              serializedFiles.push({
                name: item.name || `fichier_partage_${Date.now()}`,
                type: item.type || 'application/octet-stream',
                size: item.size || buffer.byteLength,
                lastModified: item.lastModified || Date.now(),
                buffer
              });
            }
          }

          await saveIncomingShare({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            receivedAt: Date.now(),
            title,
            text,
            url: sharedUrl,
            files: serializedFiles
          });

          const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          windowClients.forEach((client) => {
            try {
              client.postMessage({ type: 'VOXART_INCOMING_SHARE' });
            } catch {}
          });

          return Response.redirect('/?shared=1', 303);
        } catch (err) {
          console.error('SW share-target error:', err);
          return Response.redirect('/?shared=1&shareError=1', 303);
        }
      })()
    );
    return;
  }

  // Never cache POST, PUT, DELETE, WebSocket, Range, or API routes
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    event.request.headers.has('range')
  ) {
    return;
  }

  // Network-First with Cache fallback strategy
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/index.html') || await caches.match('/');
          if (fallback) return fallback;

          return new Response(
            '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>VoxArt Offline</title></head><body style="background:#181825;color:#cdd6f4;font-family:sans-serif;padding:2rem;text-align:center;"><h1>VoxArt Studio</h1><p>Application en mode hors-ligne. Reconnectez-vous pour actualiser.</p></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        }

        return new Response('Offline - asset not in cache', {
          status: 503,
          statusText: 'Service Unavailable (Offline)'
        });
      })
  );
});
