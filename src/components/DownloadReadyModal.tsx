/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Film,
  FileText,
  Music,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import { DownloadReadyPayload, VOXART_DOWNLOAD_READY_EVENT } from '../utils/audioExport';

interface DownloadReadyModalProps {
  onToast?: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Ko';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

export const DownloadReadyModal: React.FC<DownloadReadyModalProps> = ({ onToast }) => {
  const [payload, setPayload] = useState<DownloadReadyPayload | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const custom = e as CustomEvent<DownloadReadyPayload>;
      if (custom.detail?.blob && custom.detail?.filename) {
        setPayload(custom.detail);
      }
    };
    window.addEventListener(VOXART_DOWNLOAD_READY_EVENT, handleEvent);
    return () => {
      window.removeEventListener(VOXART_DOWNLOAD_READY_EVENT, handleEvent);
    };
  }, []);

  useEffect(() => {
    if (!payload) {
      setBlobUrl(null);
      setDataUrl(null);
      return;
    }

    const nextBlobUrl = URL.createObjectURL(payload.blob);
    setBlobUrl(nextBlobUrl);
    setDataUrl(null);

    let cancelled = false;
    // Also prepare a base64 data: URI for files <= 8 MB so strict Android WebView APKs
    // that ignore blob: URIs in DownloadListener can still save exact MIME + filename locally.
    if (payload.blob.size <= 8 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        if (!cancelled && typeof reader.result === 'string') {
          setDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(payload.blob);
    }

    return () => {
      cancelled = true;
      URL.revokeObjectURL(nextBlobUrl);
    };
  }, [payload]);

  const shareFile = useMemo(() => {
    if (!payload) return null;
    try {
      return new File([payload.blob], payload.filename, {
        type: payload.mimeType || payload.blob.type || 'application/octet-stream',
      });
    } catch {
      return null;
    }
  }, [payload]);

  const canShareFiles = useMemo(() => {
    if (!shareFile || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return false;
    }
    try {
      if (typeof navigator.canShare === 'function') {
        return navigator.canShare({ files: [shareFile] });
      }
      return true;
    } catch {
      return false;
    }
  }, [shareFile]);

  if (!payload || !blobUrl) return null;

  const lower = payload.filename.toLowerCase();
  const isVideo = lower.endsWith('.mp4') || payload.mimeType.startsWith('video/');
  const isAudio =
    lower.endsWith('.wav') ||
    lower.endsWith('.mp3') ||
    lower.endsWith('.m4a') ||
    lower.endsWith('.ogg') ||
    payload.mimeType.startsWith('audio/');
  const extLabel = (payload.filename.split('.').pop() || 'FILE').toUpperCase();

  // Call navigator.share synchronously inside the click handler (before any await!)
  // so Android WebAPK / Chrome / iOS never reject with NotAllowedError.
  const handleNativeShareSave = () => {
    if (!shareFile || typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      onToast?.('Utilisez un des boutons de téléchargement direct ci-dessous.', 'info');
      return;
    }
    setShareBusy(true);
    try {
      const sharePromise = navigator.share({
        files: [shareFile],
        title: payload.filename,
      });
      sharePromise
        .then(() => {
          onToast?.(`Fichier "${payload.filename}" envoyé / enregistré !`, 'success');
        })
        .catch((err: any) => {
          if (err?.name === 'AbortError') return;
          console.warn('Native file share error:', err);
          onToast?.(
            'Le partage natif n’est pas disponible dans cette WebView. Utilisez le bouton Télécharger ci-dessous.',
            'info'
          );
        })
        .finally(() => {
          setShareBusy(false);
        });
    } catch (err: any) {
      setShareBusy(false);
      if (err?.name !== 'AbortError') {
        onToast?.('Utilisez le bouton de téléchargement direct ci-dessous.', 'info');
      }
    }
  };

  const fullHttpUrl =
    payload.httpUrl && typeof window !== 'undefined'
      ? new URL(payload.httpUrl, window.location.origin).toString()
      : null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="w-full sm:max-w-md bg-[#1e1e2e] border border-[#f59e0b]/45 rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
              {isVideo ? (
                <Film className="w-5 h-5" />
              ) : isAudio ? (
                <Music className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wide">
                  Fichier {extLabel} prêt ({formatBytes(payload.sizeBytes)})
                </span>
              </div>
              <p className="text-sm font-bold text-[#cdd6f4] truncate" title={payload.filename}>
                {payload.filename}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPayload(null)}
            aria-label="Fermer"
            className="p-2 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#a6adc8] hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Built-in quick preview */}
        {isVideo && (
          <div className="rounded-xl overflow-hidden bg-black border border-[#313244] max-h-52 flex items-center justify-center">
            <video
              src={blobUrl}
              controls
              playsInline
              className="w-full max-h-52 object-contain"
            />
          </div>
        )}
        {isAudio && (
          <div className="p-2.5 rounded-xl bg-[#11111b] border border-[#313244]">
            <audio src={blobUrl} controls className="w-full h-9" />
          </div>
        )}

        {/* Mobile / APK Guaranteed Save Actions (Direct synchronous user-tap targets) */}
        <div className="space-y-2">
          {canShareFiles && (
            <button
              type="button"
              disabled={shareBusy}
              onClick={handleNativeShareSave}
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] hover:brightness-105 text-[#11111b] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span className="text-left leading-tight">
                Enregistrer sur Téléphone / Ouvrir (Fichiers, InShot, CapCut)
              </span>
            </button>
          )}

          {/* Real human-tap HTTP/Local download anchor */}
          <a
            href={fullHttpUrl || dataUrl || blobUrl}
            download={payload.filename}
            onClick={() => {
              onToast?.(`Téléchargement de "${payload.filename}" lancé !`, 'success');
            }}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Télécharger le fichier (.{extLabel.toLowerCase()})</span>
          </a>

          {/* Dedicated local-memory WebView fallback when an APK blocks /api/download cookies */}
          {fullHttpUrl && (dataUrl || blobUrl) && (
            <a
              href={dataUrl || blobUrl}
              download={payload.filename}
              onClick={() => {
                onToast?.(`Sauvegarde locale "${payload.filename}" lancée !`, 'info');
              }}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#11111b] hover:bg-[#313244] text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-2"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>Alternative APK / Hors-ligne ({extLabel})</span>
            </a>
          )}

          {fullHttpUrl && (
            <a
              href={fullHttpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[40px] px-4 py-2 rounded-xl bg-[#11111b] hover:bg-[#313244] text-[#a6adc8] hover:text-[#cdd6f4] border border-[#313244] font-semibold text-xs flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              <span>Ouvrir le lien direct dans Chrome</span>
            </a>
          )}
        </div>

        <p className="text-[10px] text-[#a6adc8] text-center leading-relaxed">
          Astuce Android / APK : « Enregistrer sur Téléphone / Ouvrir » évite les fichiers .bin et envoie directement le vrai .{extLabel.toLowerCase()} vers vos Téléchargements, InShot ou CapCut.
        </p>
      </div>
    </div>
  );
};
