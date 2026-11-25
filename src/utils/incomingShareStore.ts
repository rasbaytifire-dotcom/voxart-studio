/**
 * VoxArt Studio - Incoming Share Target & File Handling Inbox (IndexedDB + launchQueue)
 */

const SHARE_DB_NAME = 'voxart-share-db';
const SHARE_DB_VERSION = 1;
const SHARE_STORE_NAME = 'incoming_shares';

export type IncomingMediaKind = 'video' | 'audio' | 'subtitle' | 'text' | 'json' | 'other';

export interface IncomingPayload {
  source: 'share_target' | 'open_with' | 'file_picker';
  title?: string;
  text?: string;
  url?: string;
  files: File[];
}

interface StoredFileRecord {
  name: string;
  type: string;
  size: number;
  lastModified?: number;
  buffer: ArrayBuffer;
}

interface StoredShareRecord {
  id: string;
  receivedAt: number;
  title?: string;
  text?: string;
  url?: string;
  files?: StoredFileRecord[];
}

function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB indisponible'));
    }
    const req = indexedDB.open(SHARE_DB_NAME, SHARE_DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SHARE_STORE_NAME)) {
        db.createObjectStore(SHARE_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function consumePendingShares(): Promise<IncomingPayload[]> {
  try {
    const db = await openShareDb();
    const records: StoredShareRecord[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(SHARE_STORE_NAME, 'readonly');
      const store = tx.objectStore(SHARE_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as StoredShareRecord[]);
      req.onerror = () => reject(req.error);
    });

    if (records.length === 0) return [];

    // Clear consumed records
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SHARE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SHARE_STORE_NAME);
      records.forEach((r) => store.delete(r.id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return records
      .sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0))
      .map((rec) => {
        const files: File[] = (rec.files || []).map((f) => {
          const blob = new Blob([f.buffer], { type: f.type || 'application/octet-stream' });
          return new File([blob], f.name || 'fichier_partage', {
            type: f.type || 'application/octet-stream',
            lastModified: f.lastModified || Date.now(),
          });
        });
        return {
          source: 'share_target' as const,
          title: rec.title,
          text: rec.text,
          url: rec.url,
          files,
        };
      });
  } catch (err) {
    console.warn('consumePendingShares warning:', err);
    return [];
  }
}

export function registerLaunchQueueConsumer(onFiles: (files: File[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const win = window as unknown as {
    launchQueue?: {
      setConsumer: (
        consumer: (launchParams: { files?: Array<{ getFile: () => Promise<File> }> }) => void
      ) => void;
    };
  };
  if (!win.launchQueue || typeof win.launchQueue.setConsumer !== 'function') {
    return () => {};
  }

  let active = true;
  try {
    win.launchQueue.setConsumer(async (launchParams) => {
      if (!active || !launchParams?.files || launchParams.files.length === 0) return;
      const loadedFiles: File[] = [];
      for (const handle of launchParams.files) {
        try {
          if (handle && typeof handle.getFile === 'function') {
            const file = await handle.getFile();
            if (file) loadedFiles.push(file);
          }
        } catch (err) {
          console.warn('launchQueue getFile warning:', err);
        }
      }
      if (active && loadedFiles.length > 0) {
        onFiles(loadedFiles);
      }
    });
  } catch (err) {
    console.warn('registerLaunchQueueConsumer warning:', err);
  }

  return () => {
    active = false;
  };
}

export function detectIncomingMediaKind(file: File): IncomingMediaKind {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v|3gp)$/.test(name)) {
    return 'video';
  }
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/.test(name)) {
    return 'audio';
  }
  if (/\.(srt|vtt)$/.test(name) || type.includes('subrip') || type === 'text/vtt') {
    return 'subtitle';
  }
  if (name.endsWith('.json') || type === 'application/json') {
    return 'json';
  }
  if (type.startsWith('text/') || /\.(txt|md|csv)$/.test(name)) {
    return 'text';
  }
  return 'other';
}
