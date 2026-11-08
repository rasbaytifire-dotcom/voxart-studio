/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility to sanitize text before sending to speech synthesis (Gemini TTS or Web Speech API).
 * Aggressively strips all Markdown formatting, special symbols, and characters 
 * that cause the AI to generate asterisks or create phonetic misinterpretations.
 */
export function cleanTextForSpeech(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // 1. Remove code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // 2. Remove all markdown, special symbols, and unwanted characters
    .replace(/[*#`_~^\[\]()<>|\\{}+!\-]/g, ' ')
    // 3. Replace punctuation with spaces for natural speech cadence
    .replace(/[.,:;?!]/g, ' ')
    // 4. Remove URLs
    .replace(/https?:\/\/\S+/g, ' ')
    // 5. Remove extra characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // 6. Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
