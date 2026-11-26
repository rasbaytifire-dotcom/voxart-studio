/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { stripProsodyMarkersForSubtitles } from './textCleaner';

export interface SlamCadencePreset {
  id: 'meditatif' | 'moyen' | 'soutenu' | 'rapide';
  label: string;
  wpm: number;
  description: string;
}

export const SLAM_CADENCE_PRESETS: SlamCadencePreset[] = [
  { id: 'meditatif', label: 'Lent (105 mpm)', wpm: 105, description: 'Débit posé, méditatif et grave' },
  { id: 'moyen', label: 'Slam moyen (130 mpm)', wpm: 130, description: 'Cadence slam/poésie orale équilibrée' },
  { id: 'soutenu', label: 'Soutenu (155 mpm)', wpm: 155, description: 'Flow rythmé et engagé' },
  { id: 'rapide', label: 'Vif (180 mpm)', wpm: 180, description: 'Débit rapide et percutant' },
];

export interface SlamQuickMarker {
  id: string;
  label: string;
  shortLabel: string;
  category: 'breath' | 'emphasis';
  insertText?: string;
  wrapStart?: string;
  wrapEnd?: string;
  placeholder?: string;
  hint: string;
  pauseSeconds?: number;
}

export const SLAM_QUICK_MARKERS: SlamQuickMarker[] = [
  {
    id: 'respiration',
    label: 'Respiration',
    shortLabel: 'Respiration',
    category: 'breath',
    insertText: ' [respiration] ',
    hint: 'Courte reprise de souffle (+0,7s)',
    pauseSeconds: 0.7,
  },
  {
    id: 'pause',
    label: 'Pause',
    shortLabel: 'Pause',
    category: 'breath',
    insertText: ' [pause] ',
    hint: 'Silence scénique marqué (+1,2s)',
    pauseSeconds: 1.2,
  },
  {
    id: 'silence_2s',
    label: 'Silence 2s',
    shortLabel: 'Silence 2s',
    category: 'breath',
    insertText: '\n[silence 2s]\n',
    hint: 'Suspension dramatique entre deux strophes (+2,0s)',
    pauseSeconds: 2.0,
  },
  {
    id: 'caesura',
    label: 'Césure —',
    shortLabel: '— Césure',
    category: 'breath',
    insertText: ' — ',
    hint: 'Coupure rythmique dans le vers (+0,4s)',
    pauseSeconds: 0.4,
  },
  {
    id: 'ellipsis',
    label: 'Suspension ...',
    shortLabel: '...',
    category: 'breath',
    insertText: '... ',
    hint: 'Point d’orgue / attente (+0,5s)',
    pauseSeconds: 0.5,
  },
  {
    id: 'emphase',
    label: 'Emphase',
    shortLabel: 'Emphase',
    category: 'emphasis',
    wrapStart: '[emphase]',
    wrapEnd: '[/emphase]',
    placeholder: 'mot clé',
    hint: 'Appuyer un mot ou un vers avec intensité',
  },
  {
    id: 'crescendo',
    label: 'Crescendo',
    shortLabel: 'Crescendo',
    category: 'emphasis',
    wrapStart: '[crescendo]',
    wrapEnd: '[/crescendo]',
    placeholder: 'montée en puissance',
    hint: 'Augmenter progressivement la force vocale',
  },
  {
    id: 'murmure',
    label: 'Murmure',
    shortLabel: 'Murmure',
    category: 'emphasis',
    wrapStart: '[murmure]',
    wrapEnd: '[/murmure]',
    placeholder: 'à mi-voix',
    hint: 'Passage intime et feutré',
  },
  {
    id: 'ralentir',
    label: 'Ralentir',
    shortLabel: 'Ralentir',
    category: 'emphasis',
    wrapStart: '[ralentir]',
    wrapEnd: '[/ralentir]',
    placeholder: 'temps suspendu',
    hint: 'Ralentir la diction pour souligner le sens',
  },
];

export interface SlamSpeechMetrics {
  wordCount: number;
  verseCount: number;
  stanzaCount: number;
  breathCount: number;
  emphasisCount: number;
  estimatedSeconds: number;
  formattedTime: string;
  wpm: number;
}

export function formatMinutesSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function computeSlamMetrics(rawText: string, wpm: number = 130): SlamSpeechMetrics {
  const safeWpm = Math.max(60, Math.min(240, wpm || 130));
  const text = rawText || '';

  // Count prosody markers
  const breathMatches = text.match(/\[(?:respiration|souffle)\]/gi) || [];
  const pauseMatches = text.match(/\[pause(?:\s*\d+s?)?\]/gi) || [];
  const silenceMatches = text.match(/\[silence(?:\s*(\d+)s?)?\]/gi) || [];
  const caesuraMatches = text.match(/—/g) || [];
  const ellipsisMatches = text.match(/\.\.\./g) || [];
  const emphasisMatches = text.match(/\[(?:emphase|crescendo|murmure|ralentir|accelerando|fort|doux)\]/gi) || [];

  let silenceBonusSec = 0;
  silenceMatches.forEach((tag) => {
    const numMatch = tag.match(/(\d+)/);
    silenceBonusSec += numMatch ? Math.max(1, parseInt(numMatch[1], 10)) : 2.0;
  });

  const markerPauseSeconds =
    breathMatches.length * 0.7 +
    pauseMatches.length * 1.2 +
    silenceBonusSec +
    caesuraMatches.length * 0.4 +
    ellipsisMatches.length * 0.5;

  // Strip all bracketed stage markers to count actual spoken words accurately
  const spokenOnlyText = text
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/[—]/g, ' ')
    .trim();

  const words = spokenOnlyText
    ? spokenOnlyText.split(/\s+/).filter((w) => /[a-zA-ZÀ-ÿ0-9]/.test(w))
    : [];
  const wordCount = words.length;

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^\[(?:silence|pause|respiration|souffle)(?:\s*\d+s?)?\]$/i.test(l));
  const verseCount = lines.length;

  const stanzas = text
    .trim()
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const stanzaCount = stanzas.length;

  // Add subtle natural breath pause at line breaks & punctuation
  const sentenceEndCount = (spokenOnlyText.match(/[.!?]/g) || []).length;
  const lineBreakCount = Math.max(0, verseCount - 1);

  const speechSeconds = (wordCount / safeWpm) * 60;
  const punctuationSeconds = sentenceEndCount * 0.25 + lineBreakCount * 0.22;
  const estimatedSeconds = wordCount === 0 && markerPauseSeconds === 0
    ? 0
    : Math.max(1, speechSeconds + markerPauseSeconds + punctuationSeconds);

  return {
    wordCount,
    verseCount,
    stanzaCount,
    breathCount: breathMatches.length + pauseMatches.length + silenceMatches.length + caesuraMatches.length,
    emphasisCount: emphasisMatches.length,
    estimatedSeconds,
    formattedTime: formatMinutesSeconds(estimatedSeconds),
    wpm: safeWpm,
  };
}

export interface CadenceZoneInfo {
  label: string;
  textClass: string;
  barClass: string;
  percent: number;
}

export function getCadenceZoneInfo(wpm: number): CadenceZoneInfo {
  const safeWpm = Math.max(60, Math.min(240, Math.round(wpm || 130)));
  const percent = Math.max(0, Math.min(100, ((safeWpm - 60) / (240 - 60)) * 100));

  if (safeWpm < 115) {
    return {
      label: 'Méditatif / Posé',
      textClass: 'text-sky-300',
      barClass: 'bg-sky-400',
      percent,
    };
  }
  if (safeWpm <= 145) {
    return {
      label: 'Slam Équilibré',
      textClass: 'text-emerald-300',
      barClass: 'bg-emerald-400',
      percent,
    };
  }
  if (safeWpm <= 170) {
    return {
      label: 'Flow Soutenu',
      textClass: 'text-amber-300',
      barClass: 'bg-amber-400',
      percent,
    };
  }
  return {
    label: 'Rapide / Percutant',
    textClass: 'text-rose-300',
    barClass: 'bg-rose-400',
    percent,
  };
}

export function computeAutoTempoForDuration(
  rawText: string,
  targetDurationSec: number
): { idealWpm: number; rawWpm: number; clamped: boolean; wordCount: number } {
  const metrics = computeSlamMetrics(rawText, 130);
  if (metrics.wordCount === 0 || !targetDurationSec || targetDurationSec <= 0) {
    return { idealWpm: 130, rawWpm: 130, clamped: false, wordCount: metrics.wordCount };
  }

  // Extract non-speech pause + punctuation time from baseline 130 wpm metrics
  const baselineSpeechSec = (metrics.wordCount / 130) * 60;
  const nonSpeechSec = Math.max(0, metrics.estimatedSeconds - baselineSpeechSec);
  const availableSpeechSec = Math.max(1.5, targetDurationSec - nonSpeechSec);

  const rawWpm = Math.round((metrics.wordCount / availableSpeechSec) * 60);
  const idealWpm = Math.max(60, Math.min(240, rawWpm));

  return {
    idealWpm,
    rawWpm,
    clamped: rawWpm < 60 || rawWpm > 240,
    wordCount: metrics.wordCount,
  };
}

export function applyQuickMarkerToText(
  text: string,
  selStart: number,
  selEnd: number,
  marker: SlamQuickMarker
): { nextText: string; nextCursorStart: number; nextCursorEnd: number } {
  const safeStart = Math.max(0, Math.min(selStart, text.length));
  const safeEnd = Math.max(safeStart, Math.min(selEnd, text.length));
  const before = text.slice(0, safeStart);
  const selected = text.slice(safeStart, safeEnd);
  const after = text.slice(safeEnd);

  if (marker.wrapStart && marker.wrapEnd) {
    const inner = selected || marker.placeholder || 'texte';
    const inserted = `${marker.wrapStart}${inner}${marker.wrapEnd}`;
    const nextText = `${before}${inserted}${after}`;
    const nextCursorStart = before.length + marker.wrapStart.length;
    const nextCursorEnd = nextCursorStart + inner.length;
    return { nextText, nextCursorStart, nextCursorEnd };
  }

  const rawInsert = marker.insertText || '';
  // Avoid double spaces around inserted tag
  const cleanInsert =
    before.endsWith(' ') || before.endsWith('\n') || before.length === 0
      ? rawInsert.replace(/^ +/, '')
      : rawInsert;
  const nextText = `${before}${cleanInsert}${after}`;
  const cursorPos = before.length + cleanInsert.length;
  return { nextText, nextCursorStart: cursorPos, nextCursorEnd: cursorPos };
}

export interface SlamSubtitleSegment {
  start: number;
  end: number;
  text: string;
}

function splitLineIntoReadableChunks(line: string, maxChars: number): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const words = trimmed.split(/\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
      // Break cleanly after strong mid-verse punctuation once chunk has reached ~55% of maxChars
      if (/[—;:.!?]$/.test(word) && current.length >= Math.floor(maxChars * 0.52)) {
        chunks.push(current);
        current = '';
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function buildSlamSubtitles(
  rawPoemText: string,
  totalDurationSeconds: number,
  maxCharsPerCue: number = 44
): SlamSubtitleSegment[] {
  const cleanText = stripProsodyMarkersForSubtitles(rawPoemText);
  if (!cleanText) return [];

  const rawLines = cleanText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length === 0) return [];

  const cues: string[] = [];
  for (const line of rawLines) {
    const subChunks = splitLineIntoReadableChunks(line, maxCharsPerCue);
    cues.push(...subChunks);
  }
  if (cues.length === 0) return [];

  const safeTotal = Math.max(2, totalDurationSeconds || cues.length * 2.2);
  const weights = cues.map((c) => {
    const punctBonus = (c.match(/[,.;:!?—]/g) || []).length * 4;
    return Math.max(8, c.length + punctBonus);
  });
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || 1;

  let cursor = 0;
  return cues.map((cueText, idx) => {
    const slice = (weights[idx] / totalWeight) * safeTotal;
    const start = cursor;
    const end = idx === cues.length - 1 ? safeTotal : cursor + slice;
    cursor = end;
    return {
      start,
      end,
      text: cueText,
    };
  });
}
