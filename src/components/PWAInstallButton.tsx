/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, Check, Share2, MoreVertical } from 'lucide-react';

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
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md transition-all duration-200 active:scale-95"
        title="Installer l'application sur votre appareil"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installer l'app</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#1e1e2e] border border-[#45475a] p-6 shadow-2xl relative text-[#cdd6f4]">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#a6adc8] hover:text-white hover:bg-[#313244] transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#89b4fa] to-[#cba6f7] flex items-center justify-center text-[#11111b] font-bold shadow-md">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Installer VoxStudio sur mobile</h3>
                <p className="text-xs text-[#a6adc8]">Application autonome rapide & hors-ligne</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 py-2 text-sm">
                <p className="text-xs text-[#fab387] bg-[#fab387]/10 p-2.5 rounded-lg border border-[#fab387]/20">
                  Sur iPhone / iPad (Safari) :
                </p>
                <ol className="space-y-2.5 text-xs text-[#cdd6f4]/90 list-decimal list-inside pl-1">
                  <li>
                    Appuyez sur le bouton de partage <strong className="text-[#89b4fa] inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5 inline" /> Partager</strong> en bas de Safari.
                  </li>
                  <li>
                    Faites défiler le menu vers le bas et touchez <strong className="text-[#a6e3a1]">« Sur l'écran d'accueil »</strong>.
                  </li>
                  <li>
                    Validez en touchant <strong className="text-[#a6e3a1]">« Ajouter »</strong> en haut à droite.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 py-2 text-sm">
                <p className="text-xs text-[#89b4fa] bg-[#89b4fa]/10 p-2.5 rounded-lg border border-[#89b4fa]/20">
                  Sur Android (Chrome / Navigateur) :
                </p>
                <ol className="space-y-2.5 text-xs text-[#cdd6f4]/90 list-decimal list-inside pl-1">
                  <li>
                    Appuyez sur les trois points <strong className="text-[#89b4fa] inline-flex items-center gap-1"><MoreVertical className="w-3.5 h-3.5 inline" /> Menu</strong> en haut à droite.
                  </li>
                  <li>
                    Sélectionnez <strong className="text-[#a6e3a1]">« Installer l'application »</strong> (ou « Ajouter à l'écran d'accueil »).
                  </li>
                  <li>
                    Confirmez pour retrouver VoxStudio directement comme une application native.
                  </li>
                </ol>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              {isInstallable && (
                <button
                  onClick={async () => {
                    await install();
                    setShowGuide(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-bold text-white hover:from-blue-500 hover:to-indigo-500 shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Installer maintenant
                </button>
              )}
              <button
                onClick={() => setShowGuide(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#313244] text-xs font-semibold text-[#cdd6f4] hover:bg-[#45475a] transition-all"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

