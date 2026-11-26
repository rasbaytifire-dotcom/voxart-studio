/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV Blob.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numOfChan * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferLength = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  let pos = 0;

  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(pos++, str.charCodeAt(i));
    }
  }

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF header
  writeString('RIFF');
  setUint32(bufferLength - 8);
  writeString('WAVE');

  // fmt chunk
  writeString('fmt ');
  setUint32(16); // Subchunk1Size (16 for PCM)
  setUint16(1);  // AudioFormat (1 for PCM)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(byteRate);
  setUint16(blockAlign);
  setUint16(16); // BitsPerSample

  // data chunk
  writeString('data');
  setUint32(dataSize);

  // Interleave and write 16-bit PCM samples
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numOfChan; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      let sample = channelData[ch][i];
      // Hard clamp to [-1, 1]
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, intSample, true);
      pos += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function buildCleanWavFilename(rawName: string): string {
  const trimmed = (rawName || '').trim();
  const isUuidOrBin = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.bin)?$/i.test(trimmed) || trimmed.endsWith('.bin');
  const base = isUuidOrBin || !trimmed ? `VoxArt_Audio_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}` : trimmed;
  const stripped = base.replace(/\.(wav|mp3|ogg|webm|m4a|aac|bin)$/i, '');
  const safe = stripped.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return `${safe || 'VoxArt_Audio'}.wav`;
}

function hasRiffWaveHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  return (
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x41 && // A
    bytes[10] === 0x56 && // V
    bytes[11] === 0x45 // E
  );
}

function inferMimeFromFilename(filename: string, fallbackType?: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.srt')) return 'application/x-subrip; charset=utf-8';
  if (lower.endsWith('.vtt')) return 'text/vtt; charset=utf-8';
  if (lower.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.png')) return 'image/png';
  return fallbackType && fallbackType !== 'application/octet-stream'
    ? fallbackType
    : 'application/octet-stream';
}

export const VOXART_DOWNLOAD_READY_EVENT = 'voxart:download-ready';

export interface DownloadReadyPayload {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
  httpUrl?: string | null;
}

export function isMobileOrStandaloneEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer?.startsWith('android-app://');
  const isMobileUa =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|wv|WebView/i.test(
      navigator.userAgent || ''
    );
  return Boolean(isStandalone || isMobileUa);
}

export function emitDownloadReady(payload: Omit<DownloadReadyPayload, 'id'>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<DownloadReadyPayload>(VOXART_DOWNLOAD_READY_EVENT, {
      detail: {
        ...payload,
        id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      },
    })
  );
}

export function triggerHttpUrlDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Presents a compiled media Blob (like a freshly compiled MP4) to the user:
 * - On mobile / Android APK / standalone PWA, opens DownloadReadyModal with genuine
 *   user-gesture Share Sheet (Fichiers / InShot / CapCut) + direct tap anchors.
 * - On desktop, immediately triggers the download via HTTP relay or blob fallback.
 */
export async function presentReadyDownload(
  blob: Blob,
  filename: string,
  httpUrl?: string | null
): Promise<void> {
  const safeName =
    (filename || 'VoxArt_Export.mp4').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim() ||
    'VoxArt_Export.mp4';
  const mime = inferMimeFromFilename(safeName, blob.type);
  const typedBlob = blob.type === mime ? blob : new Blob([blob], { type: mime });

  if (isMobileOrStandaloneEnvironment()) {
    emitDownloadReady({
      filename: safeName,
      mimeType: mime,
      sizeBytes: typedBlob.size,
      blob: typedBlob,
      httpUrl: httpUrl || null,
    });
    return;
  }

  if (httpUrl) {
    triggerHttpUrlDownload(httpUrl, safeName);
    return;
  }

  const url = URL.createObjectURL(typedBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/**
 * Relays client Blob through /api/prepare-download so browsers receive real HTTP
 * Content-Type + Content-Disposition headers, and on Mobile/Android APK opens
 * DownloadReadyModal so synchronous user-tap Share / Save always works cleanly.
 */
export async function triggerSafeDownload(
  blob: Blob,
  filename: string,
  options?: { convertToMp3?: boolean }
): Promise<void> {
  const safeName = (filename || 'VoxArt_Export.wav').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim() || 'VoxArt_Export.wav';
  let mime = inferMimeFromFilename(safeName, blob.type);
  let finalBlob = blob.type === mime ? blob : new Blob([blob], { type: mime });
  let relayUrl: string | null = null;

  try {
    const formData = new FormData();
    formData.append('file', finalBlob, safeName);
    formData.append('filename', safeName);
    formData.append('mimeType', mime);
    if (options?.convertToMp3) {
      formData.append('convertToMp3', 'true');
    }

    const res = await fetch('/api/prepare-download', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const raw = await res.text();
      if (raw && !raw.trim().startsWith('<')) {
        const parsed = JSON.parse(raw);
        if (parsed?.url) {
          relayUrl = parsed.url;
          // If server transcoded WAV -> real MP3 and we're on mobile/APK, hydrate the MP3 blob
          // so Android native Share Sheet shares genuine MP3 bytes.
          if (options?.convertToMp3 && isMobileOrStandaloneEnvironment()) {
            try {
              const mp3Data = await readSourceUrlToArrayBuffer(parsed.url);
              mime = 'audio/mpeg';
              finalBlob = new Blob([mp3Data.buffer], { type: 'audio/mpeg' });
            } catch {
              // Keep existing blob fallback
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Relay download fallback to local blob URL:', err);
  }

  if (isMobileOrStandaloneEnvironment()) {
    emitDownloadReady({
      filename: safeName,
      mimeType: mime,
      sizeBytes: finalBlob.size,
      blob: finalBlob,
      httpUrl: relayUrl,
    });
    return;
  }

  if (relayUrl) {
    triggerHttpUrlDownload(relayUrl, safeName);
    return;
  }

  const url = URL.createObjectURL(finalBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  void triggerSafeDownload(blob, filename);
}

function decodeDataUrlToBytes(dataUrl: string): { buffer: ArrayBuffer; mimeType: string } {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Format de données audio invalide.');
  }
  const meta = dataUrl.slice(5, commaIdx);
  const payload = dataUrl.slice(commaIdx + 1);
  const mimeType = meta.split(';')[0] || 'application/octet-stream';
  const isBase64 = /;base64/i.test(meta);

  if (isBase64) {
    const cleanB64 = payload.replace(/\s+/g, '');
    const binary = atob(cleanB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { buffer: bytes.buffer, mimeType };
  }

  const decodedText = decodeURIComponent(payload);
  const encoded = new TextEncoder().encode(decodedText);
  return { buffer: encoded.buffer, mimeType };
}

/**
 * Reads any data:, blob:, or HTTP(S) source URL into an ArrayBuffer without failing on
 * Service Worker / WebView fetch restrictions for data: and blob: URLs.
 */
export async function readSourceUrlToArrayBuffer(
  sourceUrl: string
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  if (!sourceUrl) {
    throw new Error('Source multimédia introuvable.');
  }

  if (sourceUrl.startsWith('data:')) {
    return decodeDataUrlToBytes(sourceUrl);
  }

  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Impossible de lire la ressource (HTTP ${response.status}).`);
    }
    const blob = await response.blob();
    return {
      buffer: await blob.arrayBuffer(),
      mimeType: blob.type || response.headers.get('content-type') || 'application/octet-stream',
    };
  } catch (err) {
    if (sourceUrl.startsWith('blob:') || sourceUrl.startsWith('/')) {
      return await new Promise<{ buffer: ArrayBuffer; mimeType: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', sourceUrl, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
            const buf = xhr.response as ArrayBuffer;
            if (buf && buf.byteLength > 0) {
              resolve({
                buffer: buf,
                mimeType: xhr.getResponseHeader('content-type') || 'application/octet-stream',
              });
              return;
            }
          }
          reject(new Error('Ressource locale inaccessible ou expirée. Veuillez la régénérer.'));
        };
        xhr.onerror = () => {
          reject(
            new Error(
              err instanceof Error && err.message !== 'Failed to fetch'
                ? err.message
                : 'Impossible de lire la ressource audio/vidéo locale. Régénérez-la puis réessayez.'
            )
          );
        };
        xhr.send();
      });
    }
    throw new Error(
      err instanceof Error && !/failed to fetch/i.test(err.message)
        ? err.message
        : 'Erreur réseau lors de la lecture du fichier.'
    );
  }
}

/**
 * Downloads any blob:, data:, or URL resource via the HTTP relay so mobile browsers/WebViews
 * receive proper Content-Type and Content-Disposition filename headers instead of <uuid>.bin.
 */
export async function triggerUrlSourceDownload(
  sourceUrl: string,
  filename: string,
  options?: { convertToMp3?: boolean }
): Promise<void> {
  const { buffer, mimeType } = await readSourceUrlToArrayBuffer(sourceUrl);
  const blob = new Blob([buffer], { type: mimeType });
  await triggerSafeDownload(blob, filename, options);
}

/**
 * Converts a local Blob to a clean 16-bit PCM WAV file (if not already RIFF/WAVE)
 * and downloads it directly without doing any fetch(blob:...) round-trip.
 */
export async function exportAudioBlobAsWav(sourceBlob: Blob, rawName: string): Promise<void> {
  const downloadName = buildCleanWavFilename(rawName);
  const arrayBuffer = await sourceBlob.arrayBuffer();
  const headerBytes = new Uint8Array(arrayBuffer.slice(0, 12));

  if (hasRiffWaveHeader(headerBytes)) {
    const wavBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
    await triggerSafeDownload(wavBlob, downloadName);
    return;
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    await triggerSafeDownload(new Blob([arrayBuffer], { type: 'audio/wav' }), downloadName);
    return;
  }

  const audioCtx = new AudioCtx();
  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const wavBlob = audioBufferToWavBlob(decodedBuffer);
    await triggerSafeDownload(wavBlob, downloadName);
  } finally {
    audioCtx.close().catch(() => {});
  }
}

/**
 * Downsamples oversized WAV blobs to mono 22.05 kHz PCM WAV before server upload
 * so mobile 4G video compilation stays fast and below Cloud Run size limits.
 */
export async function compressWavForUpload(
  sourceBlob: Blob,
  targetSampleRate = 22050,
  thresholdBytes = 2.5 * 1024 * 1024
): Promise<Blob> {
  if (sourceBlob.size <= thresholdBytes) {
    return sourceBlob;
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return sourceBlob;

  const ctx = new AudioCtx();
  try {
    const ab = await sourceBlob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(ab.slice(0));
    const outFrames = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
    const offline = new OfflineAudioContext(1, outFrames, targetSampleRate);
    const src = offline.createBufferSource();
    src.buffer = decoded;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    const compact = audioBufferToWavBlob(rendered);
    return compact.size < sourceBlob.size ? compact : sourceBlob;
  } catch {
    return sourceBlob;
  } finally {
    ctx.close().catch(() => {});
  }
}

/**
 * Fetches an audio data URL / URL, converts it to a true 16-bit PCM WAV Blob
 * if it is not already a RIFF/WAVE file, and downloads it as `<name>.wav`.
 */
export async function exportAudioDataAsWav(sourceUrl: string, rawName: string): Promise<void> {
  const { buffer, mimeType } = await readSourceUrlToArrayBuffer(sourceUrl);
  await exportAudioBlobAsWav(new Blob([buffer], { type: mimeType }), rawName);
}

