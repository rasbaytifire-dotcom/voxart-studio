/**
 * VoxArt Studio - Service Worker for PWA Offline & Automatic Live Updates
 */

const CACHE_NAME = 'voxart-cache-v2-live';

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

self.addEventListener('install', (event) => {
  // Activate new worker immediately
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
  // Purge any older caches so the new application version is loaded immediately
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Purging legacy PWA cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache POST, PUT, DELETE, WebSocket, or API routes
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-First with Cache fallback strategy
  // This guarantees installed PWAs always receive fresh updates when online,
  // while retaining seamless offline capabilities.
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
        // Fallback to cache when offline
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // If navigation request fails offline, serve the cached SPA index.html
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

        return new Response('', { status: 200 });
      })
  );
});
