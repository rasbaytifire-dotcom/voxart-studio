/**
 * VoxArt Studio - High-Capacity Offline Storage Engine (IndexedDB)
 * Allows storing large audio WAV/MP3 blobs, project state, and video metadata
 * with hundreds of megabytes of offline storage, bypassing localStorage 5MB limit.
 */

const DB_NAME = 'voxart_studio_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_AUDIO_BLOBS = 'audio_blobs';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO_BLOBS)) {
        db.createObjectStore(STORE_AUDIO_BLOBS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAudioBlob(key: string, blob: Blob, metadata?: Record<string, any>): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_AUDIO_BLOBS);
      store.put({
        key,
        blob,
        timestamp: Date.now(),
        metadata: metadata || {}
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB saveAudioBlob fallback:', e);
  }
}

export async function getAudioBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO_BLOBS, 'readonly');
      const store = tx.objectStore(STORE_AUDIO_BLOBS);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB getAudioBlob fallback:', e);
    return null;
  }
}

export async function saveProjectOffline(project: { id: string; [key: string]: any }): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      store.put({
        ...project,
        updatedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB saveProjectOffline fallback:', e);
  }
}

export async function getAllProjectsOffline(): Promise<any[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB getAllProjectsOffline fallback:', e);
    return [];
  }
}

export async function deleteProjectOffline(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB deleteProjectOffline fallback:', e);
  }
}
