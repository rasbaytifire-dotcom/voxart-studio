/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 active:scale-95"
      >
        <Download className="w-4 h-4" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-xl border border-[#45475a] bg-[#313244] px-3.5 py-2 text-xs font-semibold text-[#cdd6f4] hover:bg-[#45475a] transition-all duration-200"
        >
          <Share2 className="w-4 h-4 text-[#89b4fa]" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#1e1e2e] border border-[#45475a] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#fab387]">Install on iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-[#a6adc8] hover:text-[#cdd6f4]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-3 text-sm text-[#cdd6f4]/90 list-decimal list-inside">
                <li>Tap the <strong className="text-[#89b4fa]">Share</strong> button in Safari toolbar at the bottom.</li>
                <li>Scroll down the share sheet and tap <strong className="text-[#a6e3a1]">Add to Home Screen</strong>.</li>
                <li>Confirm by tapping <strong className="text-[#a6e3a1]">Add</strong> in the top right corner.</li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-xl bg-[#89b4fa] py-2.5 text-xs font-bold text-[#11111b] hover:bg-[#b4befe] transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
