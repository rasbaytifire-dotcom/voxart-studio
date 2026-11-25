/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { WifiOff, CheckCircle2, X } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  // Always start hidden so Android WebView never shows a stuck false-positive banner on app launch
  const [visible, setVisible] = useState<boolean>(false);
  const [status, setStatus] = useState<'offline' | 'online'>('online');
  const timerRef = useRef<number | null>(null);

  const showNotification = (type: 'offline' | 'online', durationMs = 4000) => {
    setStatus(type);
    setVisible(true);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    // Auto-dismiss automatically after the duration so it never blocks the screen
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, durationMs);
  };

  useEffect(() => {
    // Only listen for real network transition events (online <-> offline)
    const handleOnline = () => {
      showNotification('online', 3000);
    };

    const handleOffline = () => {
      showNotification('offline', 4500);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!visible) return null;

  if (status === 'online') {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl bg-emerald-950/95 border border-emerald-500/50 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Connexion Internet rétablie</span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="ml-1 p-0.5 rounded text-emerald-300 hover:text-white"
          aria-label="Fermer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div 
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-2xl bg-[#1c0f04]/95 border border-[#f59e0b]/60 px-4 py-2.5 text-xs text-[#fef3c7] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2"
    >
      <div className="w-5 h-5 rounded-lg bg-[#ea580c]/20 border border-[#f59e0b]/40 flex items-center justify-center shrink-0 text-[#f59e0b]">
        <WifiOff className="w-3.5 h-3.5" />
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-[#fbbf24] text-[11px]">Mode hors-ligne</span>
        <span className="text-[10px] text-[#fde68a]/70">Données locales actives</span>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="ml-2 p-1 rounded-lg text-[#fde68a]/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        aria-label="Fermer l'alerte hors-ligne"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
