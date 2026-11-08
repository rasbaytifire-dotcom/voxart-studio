import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Defensive prototype safeguard: clamp volume property on all HTMLMediaElements to [0, 1]
// to prevent browser IndexSizeError if any component, slider, or preset passes > 1 or < 0
if (typeof window !== 'undefined' && typeof HTMLMediaElement !== 'undefined') {
  try {
    const originalVolumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
    if (originalVolumeDescriptor && originalVolumeDescriptor.set) {
      const originalSet = originalVolumeDescriptor.set;
      Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
        configurable: true,
        enumerable: true,
        get: originalVolumeDescriptor.get,
        set(val: number) {
          const num = Number(val);
          const safeVal = Math.max(0, Math.min(1, isNaN(num) ? 1 : num));
          return originalSet.call(this, safeVal);
        }
      });
    }
  } catch (e) {
    console.warn('Could not wrap HTMLMediaElement.prototype.volume:', e);
  }
}

// Register PWA service worker with graceful fallback
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('PWA ServiceWorker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.warn('PWA ServiceWorker registration fallback:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);

