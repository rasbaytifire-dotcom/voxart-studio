/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const VOICE_GUIDE_STORAGE_KEY = 'voxart_voice_guide_enabled';

export function isVoiceGuideEnabled(): boolean {
  try {
    return localStorage.getItem(VOICE_GUIDE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setVoiceGuideEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(VOICE_GUIDE_STORAGE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('voxart:voice-guide-changed', { detail: { enabled } }));
  } catch {
    // ignore
  }
}

let lastSpokenText = '';
let lastSpokenTime = 0;

export function speakVoiceGuide(text: string): void {
  if (!isVoiceGuideEnabled()) return;
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;

  const now = Date.now();
  // Prevent spamming the exact same tip within 4 seconds
  if (text === lastSpokenText && now - lastSpokenTime < 4000) return;

  lastSpokenText = text;
  lastSpokenTime = now;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const frVoice = voices.find(v => v.lang.startsWith('fr') || v.lang.startsWith('FR'));
    if (frVoice) {
      utterance.voice = frVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Voice Guide speech synthesis error:", err);
  }
}
