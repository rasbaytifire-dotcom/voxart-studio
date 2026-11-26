/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Strips Slam / Poetry prosody stage directions such as [respiration], [pause],
 * [silence 2s], [emphase]...[/emphase], [crescendo], [murmure], [ralentir]
 * into clean text suitable for subtitles or display.
 */
export function stripProsodyMarkersForSubtitles(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(/\[(?:respiration|souffle|pause(?:\s*\d+s?)?|silence(?:\s*\d+s?)?)\]/gi, ' ')
    .replace(/\[\/?(?:emphase|crescendo|murmure|ralentir|accelerando|fort|doux)\]/gi, '')
    .replace(/<breath\s*\/?>/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

/**
 * Utility to sanitize text before sending to speech synthesis (Gemini TTS or Web Speech API).
 * Converts Slam/Poetry prosody markers into natural rhythmic pauses (never speaking the tag names),
 * strips Markdown formatting, special symbols, and characters that cause phonetic misinterpretations.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // 1. Remove code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // 2. Convert slam/poetry breath & pause tags into natural silence pauses before stripping brackets
    .replace(/\[(?:respiration|souffle)\]/gi, '... ')
    .replace(/\[(?:pause|silence)(?:\s*\d+s?)?\]/gi, '... — ... ')
    // 3. Unwrap emphasis/dynamic tags cleanly without reading their names
    .replace(/\[\/?(?:emphase|crescendo|murmure|ralentir|accelerando|fort|doux)\]/gi, ' ')
    // 4. Remove any remaining bracketed stage directions like [ton grave]
    .replace(/\[[^\]]+\]/g, ' ')
    // 5. Remove markdown, special symbols, and unwanted characters
    .replace(/[*#`_~^\[\]()<>|\\{}+!\-]/g, ' ')
    // 6. Replace punctuation with spaces (preserve subtle pauses for commas/ellipses? No, keep consistent with existing behavior)
    .replace(/[.,:;?!]/g, ' ')
    // 7. Remove URLs
    .replace(/https?:\/\/\S+/g, ' ')
    // 8. Remove extra characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // 9. Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
