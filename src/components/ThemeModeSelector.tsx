/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sliders, Sparkles, Radio, Check } from 'lucide-react';

export type StudioThemeMode = 'standard' | 'ridialart';

interface ThemeModeSelectorProps {
  currentMode: StudioThemeMode;
  onSelectMode: (mode: StudioThemeMode) => void;
}

export const ThemeModeSelector: React.FC<ThemeModeSelectorProps> = ({
  currentMode,
  onSelectMode
}) => {
  return (
    <div className="bg-[#1e1e2e]/90 p-1.5 rounded-2xl border border-[#45475a] shadow-lg flex flex-col sm:flex-row items-stretch gap-1.5 transition-all">
      {/* Option 1: Mode Standard */}
      <button
        type="button"
        onClick={() => onSelectMode('standard')}
        className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all ${
          currentMode === 'standard'
            ? 'bg-[#89b4fa] text-[#11111b] shadow-md'
            : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]/60'
        }`}
      >
        <div className="flex items-center gap-2 text-left">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${currentMode === 'standard' ? 'bg-[#11111b]/20 text-[#11111b]' : 'bg-[#313244] text-[#89b4fa]'}`}>
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="leading-tight">Mode Standard Pro</div>
            <div className={`text-[10px] font-normal leading-tight ${currentMode === 'standard' ? 'text-[#11111b]/70' : 'text-[#6c7086]'}`}>
              Studio Universel (Podcast, Narration, Voix Off)
            </div>
          </div>
        </div>
        {currentMode === 'standard' && <Check className="w-4 h-4 shrink-0" />}
      </button>

      {/* Option 2: Mode RidiaLArt Afrofuturiste */}
      <button
        type="button"
        onClick={() => onSelectMode('ridialart')}
        className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all ${
          currentMode === 'ridialart'
            ? 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-[#1c0f04] shadow-md border border-[#fbbf24]'
            : 'text-[#fde68a]/70 hover:text-[#fde68a] hover:bg-[#2e190a]/40'
        }`}
      >
        <div className="flex items-center gap-2 text-left">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${currentMode === 'ridialart' ? 'bg-[#1c0f04]/20 text-[#1c0f04]' : 'bg-[#2e190a] text-[#fbbf24]'}`}>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="leading-tight flex items-center gap-1.5">
              <span>Mode RidiaLArt Vision</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${currentMode === 'ridialart' ? 'bg-[#1c0f04]/20 text-[#1c0f04]' : 'bg-[#d97706]/20 text-[#fde68a]'}`}>
                Afrofuturisme
              </span>
            </div>
            <div className={`text-[10px] font-normal leading-tight ${currentMode === 'ridialart' ? 'text-[#1c0f04]/80' : 'text-[#d97706]'}`}>
              Synesthésie Plastique & Polyrythmies Djembé/Sabar
            </div>
          </div>
        </div>
        {currentMode === 'ridialart' && <Check className="w-4 h-4 shrink-0" />}
      </button>
    </div>
  );
};
