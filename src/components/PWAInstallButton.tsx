/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Check, Share2, MoreVertical, Copy, ExternalLink, Sparkles, Monitor, Info } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already installed in standalone mode, hide
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (!outcome) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-all duration-200 active:scale-95 shrink-0"
        title="Installer VoxArt sur votre téléphone ou ordinateur"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installer l'app</span>
      </button>

      {showGuide && <PWAInstallModal onClose={() => setShowGuide(false)} />}
    </>
  );
};

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('voxart_pwa_banner_dismissed');
    if (isDismissed) setDismissed(true);
  }, []);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('voxart_pwa_banner_dismissed', 'true');
  };

  const handleAction = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (!outcome) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <div className="bg-gradient-to-r from-[#1e1e2e] via-[#241b35] to-[#1e1e2e] border border-[#89b4fa]/40 rounded-2xl p-3.5 sm:p-4 shadow-lg text-[#cdd6f4] flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#89b4fa] to-[#cba6f7] flex items-center justify-center text-[#11111b] font-bold shadow-md shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Installer VoxArt sur votre téléphone</span>
              <span className="bg-[#a6e3a1]/20 text-[#a6e3a1] text-[10px] px-1.5 py-0.5 rounded-full font-medium">Gratuit & PWA</span>
            </div>
            <p className="text-[11px] text-[#a6adc8] truncate">
              Accès direct sur l'écran d'accueil, plein écran, mode hors-ligne sans passer par le store.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleAction}
            className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Installer l'app</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-[#a6adc8] hover:text-white rounded-lg hover:bg-[#313244] transition-all"
            title="Masquer cette bannière pour cette session"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showModal && <PWAInstallModal onClose={() => setShowModal(false)} />}
    </>
  );
};

export const PWAInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { isInstallable, isIOS, install } = usePWAInstall();
  const [selectedTab, setSelectedTab] = useState<'android' | 'ios' | 'desktop'>(isIOS ? 'ios' : 'android');
  const [copied, setCopied] = useState(false);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://ais-pre-i3grmt5zrq7cmfq7wtekw6-386454114574.europe-west2.run.app';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl bg-[#1e1e2e] border border-[#45475a] p-5 sm:p-6 shadow-2xl relative text-[#cdd6f4] max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-[#a6adc8] hover:text-white hover:bg-[#313244] transition-all"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#89b4fa] via-[#b4befe] to-[#cba6f7] flex items-center justify-center text-[#11111b] font-black shadow-lg">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Installer l'application VoxArt</h3>
            <p className="text-xs text-[#a6adc8]">Application Web Progressive (PWA) autonome & légère</p>
          </div>
        </div>

        {/* Notice for iframe / in-app viewer */}
        {isInIframe && (
          <div className="mb-4 p-3 rounded-xl bg-[#fab387]/15 border border-[#fab387]/30 text-xs text-[#f9e2af] flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#fab387] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Vous êtes actuellement dans l'aperçu AI Studio :</p>
              <p className="text-[#cdd6f4]">
                Les navigateurs bloquent l'installation directe depuis les fenêtres intégrées (iframe). Pour installer VoxArt, ouvrez le lien directement dans votre navigateur mobile (Chrome ou Safari).
              </p>
            </div>
          </div>
        )}

        {/* Direct Link Copier */}
        <div className="mb-4 p-2.5 rounded-xl bg-[#181825] border border-[#313244] flex items-center justify-between gap-2 text-xs">
          <div className="truncate text-[#89b4fa] font-mono select-all flex-1">
            {currentUrl}
          </div>
          <button
            onClick={handleCopyLink}
            className="px-2.5 py-1.5 rounded-lg bg-[#313244] hover:bg-[#45475a] text-white font-semibold transition-all flex items-center gap-1 shrink-0 text-[11px]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#a6e3a1]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copié !' : 'Copier'}</span>
          </button>
        </div>

        {/* Platform Tabs */}
        <div className="flex rounded-xl bg-[#181825] p-1 mb-4 border border-[#313244]">
          <button
            onClick={() => setSelectedTab('android')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              selectedTab === 'android' ? 'bg-[#89b4fa] text-[#11111b] shadow-sm' : 'text-[#a6adc8] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android</span>
          </button>
          <button
            onClick={() => setSelectedTab('ios')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              selectedTab === 'ios' ? 'bg-[#cba6f7] text-[#11111b] shadow-sm' : 'text-[#a6adc8] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>iPhone / iPad</span>
          </button>
          <button
            onClick={() => setSelectedTab('desktop')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              selectedTab === 'desktop' ? 'bg-[#a6e3a1] text-[#11111b] shadow-sm' : 'text-[#a6adc8] hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>PC / Mac</span>
          </button>
        </div>

        {/* Tab 1: Android */}
        {selectedTab === 'android' && (
          <div className="space-y-3 text-xs bg-[#181825]/60 p-4 rounded-2xl border border-[#313244]">
            <div className="flex items-center gap-2 text-[#89b4fa] font-bold text-sm">
              <Smartphone className="w-4 h-4" />
              <span>Installation sur Android (Google Chrome / Samsung Internet)</span>
            </div>
            
            <ol className="space-y-2.5 text-[#cdd6f4] list-decimal list-inside pl-1 leading-relaxed">
              <li>
                Ouvrez le lien dans l'application <strong>Google Chrome</strong> sur votre smartphone.
              </li>
              <li>
                Appuyez sur les trois points verticaux <strong className="text-[#89b4fa] inline-flex items-center gap-1"><MoreVertical className="w-3.5 h-3.5 inline" /> Menu</strong> en haut à droite du navigateur.
              </li>
              <li>
                Appuyez sur <strong className="text-[#a6e3a1]">« Installer l'application »</strong> (ou « Ajouter à l'écran d'accueil »).
              </li>
              <li>
                Confirmez en touchant <strong className="text-[#a6e3a1]">« Installer »</strong>. L'icône de VoxArt sera instantanément créée sur votre écran d'accueil !
              </li>
            </ol>

            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#89b4fa] text-[11px] flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>VoxArt fonctionne sans téléchargement d'APK lourd et prend moins de 2 Mo sur votre mémoire.</span>
            </div>
          </div>
        )}

        {/* Tab 2: iOS */}
        {selectedTab === 'ios' && (
          <div className="space-y-3 text-xs bg-[#181825]/60 p-4 rounded-2xl border border-[#313244]">
            <div className="flex items-center gap-2 text-[#cba6f7] font-bold text-sm">
              <Smartphone className="w-4 h-4" />
              <span>Installation sur iPhone / iPad (Apple Safari)</span>
            </div>

            <p className="text-[11px] text-[#fab387] bg-[#fab387]/10 p-2 rounded-lg border border-[#fab387]/20">
              Note Apple : Sur iOS, l'installation doit impérativement être faite depuis le navigateur <strong>Safari</strong> (Apple ne permet pas l'installation depuis Chrome iOS).
            </p>

            <ol className="space-y-2.5 text-[#cdd6f4] list-decimal list-inside pl-1 leading-relaxed">
              <li>
                Ouvrez le lien dans le navigateur <strong>Safari</strong> d'Apple.
              </li>
              <li>
                Touchez l'icône de partage <strong className="text-[#89b4fa] inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5 inline" /> Partager</strong> (le carré avec flèche vers le haut au centre en bas).
              </li>
              <li>
                Faites défiler le menu vers le bas et touchez <strong className="text-[#a6e3a1]">« Sur l'écran d'accueil »</strong> (icône avec un carré +).
              </li>
              <li>
                Touchez <strong className="text-[#a6e3a1]">« Ajouter »</strong> en haut à droite. VoxArt apparaît sur votre écran d'accueil comme une application de l'App Store !
              </li>
            </ol>
          </div>
        )}

        {/* Tab 3: Desktop */}
        {selectedTab === 'desktop' && (
          <div className="space-y-3 text-xs bg-[#181825]/60 p-4 rounded-2xl border border-[#313244]">
            <div className="flex items-center gap-2 text-[#a6e3a1] font-bold text-sm">
              <Monitor className="w-4 h-4" />
              <span>Installation sur Ordinateur (Chrome / Edge / Brave)</span>
            </div>

            <ol className="space-y-2.5 text-[#cdd6f4] list-decimal list-inside pl-1 leading-relaxed">
              <li>
                Dans la barre d'adresse de votre navigateur, cliquez sur la petite icône d'installation <strong className="text-[#a6e3a1] inline-flex items-center gap-1"><Download className="w-3.5 h-3.5 inline" /></strong> tout à droite (à côté de l'étoile des favoris).
              </li>
              <li>
                Ou cliquez sur le menu <strong>(⋮)</strong> en haut à droite &gt; <strong>« Enregistrer et partager »</strong> &gt; <strong>« Installer la page sous forme d'application »</strong>.
              </li>
              <li>
                Cliquez sur <strong>« Installer »</strong> : VoxArt s'ouvrira dans sa propre fenêtre indépendante sur votre bureau.
              </li>
            </ol>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          {isInstallable && (
            <button
              onClick={async () => {
                await install();
                onClose();
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Installer directement en 1 clic</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#313244] hover:bg-[#45475a] text-xs font-bold text-[#cdd6f4] transition-all text-center"
          >
            Fermer le guide
          </button>
        </div>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('voxart_pwa_installed', 'true');
              window.dispatchEvent(new Event('appinstalled'));
              onClose();
            }}
            className="text-[11px] text-[#a6adc8] hover:text-[#a6e3a1] underline transition-colors"
          >
            ✓ L'application est déjà installée sur mon écran d'accueil (Ne plus afficher ce bouton)
          </button>
        </div>
      </div>
    </div>
  );
};
