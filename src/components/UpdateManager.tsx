import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, ArrowDownCircle, AlertCircle, Sparkles, Smartphone, Trash2 } from 'lucide-react';

export const APP_VERSION = "2.4.2";

interface UpdateStatus {
  isChecking: boolean;
  hasUpdate: boolean;
  lastChecked: Date | null;
  serverVersion: string | null;
  message: string | null;
}

export function useAppUpdate(showToast?: (msg: string, type?: 'info' | 'success' | 'error') => void) {
  const [status, setStatus] = useState<UpdateStatus>({
    isChecking: false,
    hasUpdate: false,
    lastChecked: null,
    serverVersion: null,
    message: null,
  });

  // Listen for waiting service worker on load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          setStatus(prev => ({
            ...prev,
            hasUpdate: true,
            message: "Une nouvelle version de VoxArt est prête à être activée.",
          }));
        }
      }).catch(() => {});
    }
  }, []);

  const checkForUpdate = async (manual = true) => {
    setStatus(prev => ({ ...prev, isChecking: true, message: null }));
    let detectedNewVersion = false;
    let remoteVersion = APP_VERSION;

    try {
      // 1. Check server API version endpoint with cache busting
      try {
        const response = await fetch(`/api/version?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store' }
        });
        if (response.ok) {
          const data = await response.json();
          remoteVersion = data.version || APP_VERSION;
          // Compare versions or check if server version is higher/different
          const localStoredVer = localStorage.getItem('voxart_client_version');
          if (localStoredVer && localStoredVer !== remoteVersion) {
            detectedNewVersion = true;
          }
        }
      } catch (err) {
        console.warn("Could not query /api/version:", err);
      }

      // 2. Query Service Worker registration for waiting updates
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting || reg.installing) {
            detectedNewVersion = true;
          }
        }
      }

      setStatus({
        isChecking: false,
        hasUpdate: detectedNewVersion,
        lastChecked: new Date(),
        serverVersion: remoteVersion,
        message: detectedNewVersion
          ? "🎉 Nouvelle mise à jour disponible !"
          : "✅ Votre application est déjà à jour avec la dernière version.",
      });

      if (manual && showToast) {
        if (detectedNewVersion) {
          showToast("🎉 Nouvelle version détectée ! Cliquez sur 'Installer la mise à jour'.", "success");
        } else {
          showToast(`✅ Votre application est à jour (v${APP_VERSION}).`, "info");
        }
      }
    } catch (err: any) {
      console.warn("Check for updates error:", err);
      setStatus(prev => ({
        ...prev,
        isChecking: false,
        message: "Impossible de vérifier les mises à jour (vérifiez votre connexion).",
      }));
      if (manual && showToast) {
        showToast("Impossible de vérifier les mises à jour en ligne.", "error");
      }
    }
  };

  const applyUpdate = async () => {
    try {
      if (showToast) {
        showToast("🔄 Application des mises à jour en cours...", "info");
      }

      // 1. Purge all cached assets in caches API
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      // 2. Instruct active service worker to skip waiting
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }

      // 3. Store new version tag
      localStorage.setItem('voxart_client_version', status.serverVersion || APP_VERSION);

      // 4. Force reload without cache
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (e) {
      console.error("Failed to apply update:", e);
      window.location.reload();
    }
  };

  return {
    ...status,
    checkForUpdate,
    applyUpdate,
  };
}

/**
 * Compact Button for the Top Navigation Bar
 */
export const TopBarUpdateButton: React.FC<{
  onCheck: () => void;
  isChecking: boolean;
  hasUpdate: boolean;
  onApplyUpdate: () => void;
}> = ({ onCheck, isChecking, hasUpdate, onApplyUpdate }) => {
  if (hasUpdate) {
    return (
      <button
        type="button"
        onClick={onApplyUpdate}
        className="px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400 shadow-md animate-pulse cursor-pointer"
        title="Nouvelle version disponible ! Cliquez pour recharger."
      >
        <ArrowDownCircle className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Mettre à jour</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onCheck}
      disabled={isChecking}
      className="px-2 py-1 rounded-lg text-xs font-medium border border-[#45475a] bg-[#1e1e2e]/90 hover:bg-[#313244] text-[#a6adc8] hover:text-[#cdd6f4] transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
      title="Rechercher une mise à jour de l'application"
    >
      <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin text-[#89b4fa]' : ''}`} />
      <span className="hidden sm:inline">{isChecking ? 'Recherche...' : 'MAJ'}</span>
    </button>
  );
};

/**
 * Full Settings Card Section for Update Management
 */
export const UpdateSettingsSection: React.FC<{
  isChecking: boolean;
  hasUpdate: boolean;
  lastChecked: Date | null;
  serverVersion: string | null;
  message: string | null;
  onCheck: () => void;
  onApply: () => void;
}> = ({ isChecking, hasUpdate, lastChecked, serverVersion, message, onCheck, onApply }) => {
  return (
    <div className="p-4 bg-[#1e1e2e] rounded-xl border border-[#313244] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#89b4fa]/10 text-[#89b4fa]">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#cdd6f4]">Mises à jour & Version de l'application</h3>
            <p className="text-[11px] text-[#a6adc8]">Gestion de la version PWA et rafraîchissement du cache</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] bg-[#313244] text-[#89b4fa] font-mono px-2 py-0.5 rounded-full border border-[#45475a]">
            v{APP_VERSION}
          </span>
          {hasUpdate && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/40 animate-pulse">
              Nouvelle MAJ dispo !
            </span>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
          hasUpdate 
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
            : 'bg-[#181825] border border-[#313244] text-[#a6adc8]'
        }`}>
          {hasUpdate ? <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-[#89b4fa] shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      {lastChecked && (
        <div className="text-[10px] text-[#6c7086]">
          Dernière vérification : {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {hasUpdate ? (
          <button
            type="button"
            onClick={onApply}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Installer la mise à jour (Redémarrer)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onCheck}
            disabled={isChecking}
            className="flex-1 py-2 px-3 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Vérification en cours...' : '🔍 Rechercher une mise à jour'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onApply}
          className="py-2 px-3 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] font-medium text-xs border border-[#45475a] transition-all flex items-center gap-1.5 cursor-pointer"
          title="Vide tous les fichiers en cache local et force le rechargement immédiat de la toute dernière version déployée"
        >
          <Trash2 className="w-3.5 h-3.5 text-[#f38ba8]" />
          <span>Vider le cache & Recharger</span>
        </button>
      </div>

      <div className="pt-2 border-t border-[#313244] space-y-1 text-[11px]">
        <div className="flex items-center justify-between text-[#a6adc8]">
          <span>📱 <strong>Format APK Android autonome :</strong></span>
          <a
            href="https://github.com/rasbaytifire-dotcom/voxart-studio/actions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:text-amber-300 font-semibold underline flex items-center gap-1"
          >
            Télécharger VoxArt.apk
          </a>
        </div>
        <p className="text-[10px] text-[#6c7086] leading-relaxed">
          Le workflow GitHub Actions compile automatiquement votre application en fichier <code>.apk</code> natif à chaque publication, éliminant les restrictions d'installation de Google Chrome.
        </p>
      </div>
    </div>
  );
};
