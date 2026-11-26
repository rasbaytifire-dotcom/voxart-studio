/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Volume2 } from 'lucide-react';
import { isVoiceGuideEnabled, speakVoiceGuide } from '../utils/voiceGuide';

interface VoiceGuideWrapperProps {
  tip: string;
  children: React.ReactNode;
  className?: string;
}

export const VoiceGuideWrapper: React.FC<VoiceGuideWrapperProps> = ({ tip, children, className = '' }) => {
  const [enabled, setEnabled] = useState<boolean>(isVoiceGuideEnabled());

  useEffect(() => {
    const handleChanged = (e: any) => {
      setEnabled(e.detail?.enabled ?? isVoiceGuideEnabled());
    };
    window.addEventListener('voxart:voice-guide-changed', handleChanged);
    return () => {
      window.removeEventListener('voxart:voice-guide-changed', handleChanged);
    };
  }, []);

  const handleMouseEnter = () => {
    if (enabled && tip) {
      speakVoiceGuide(tip);
    }
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      className={`relative group/guide ${className}`}
      title={enabled ? `💡 Guide Vocal: ${tip}` : undefined}
    >
      {children}
      {enabled && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#89b4fa] border-2 border-[#1e1e2e] opacity-75 group-hover/guide:opacity-100 flex items-center justify-center pointer-events-none transition-opacity">
          <span className="w-1 h-1 rounded-full bg-[#11111b] animate-ping" />
        </span>
      )}
    </div>
  );
};
