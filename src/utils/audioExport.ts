/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Encodes an AudioBuffer into a standard 16-bit PCM WAV Blob.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numOfChan * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const bufferLength = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  let pos = 0;

  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(pos++, str.charCodeAt(i));
    }
  }

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF header
  writeString('RIFF');
  setUint32(bufferLength - 8);
  writeString('WAVE');

  // fmt chunk
  writeString('fmt ');
  setUint32(16); // Subchunk1Size (16 for PCM)
  setUint16(1);  // AudioFormat (1 for PCM)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(byteRate);
  setUint16(blockAlign);
  setUint16(16); // BitsPerSample

  // data chunk
  writeString('data');
  setUint32(dataSize);

  // Interleave and write 16-bit PCM samples
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numOfChan; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      let sample = channelData[ch][i];
      // Hard clamp to [-1, 1]
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, intSample, true);
      pos += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function buildCleanWavFilename(rawName: string): string {
  const stripped = (rawName || 'audio_voxart')
    .trim()
    .replace(/\.(wav|mp3|ogg|webm|m4a|aac)$/i, '');
  const safe = stripped.replace(/[\\/:*?"<>|]+/g, '_').trim();
  return `${safe || 'audio_voxart'}.wav`;
}

function hasRiffWaveHeader(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  return (
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x41 && // A
    bytes[10] === 0x56 && // V
    bytes[11] === 0x45 // E
  );
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Fetches an audio data URL / URL, converts it to a true 16-bit PCM WAV Blob
 * if it is not already a RIFF/WAVE file, and downloads it as `<name>.wav`.
 */
export async function exportAudioDataAsWav(sourceUrl: string, rawName: string): Promise<void> {
  const downloadName = buildCleanWavFilename(rawName);
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error('Impossible de lire le fichier audio source.');
  }

  const sourceBlob = await response.blob();
  const arrayBuffer = await sourceBlob.arrayBuffer();
  const headerBytes = new Uint8Array(arrayBuffer.slice(0, 12));

  if (hasRiffWaveHeader(headerBytes)) {
    const wavBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
    triggerBlobDownload(wavBlob, downloadName);
    return;
  }

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    triggerBlobDownload(new Blob([arrayBuffer], { type: 'audio/wav' }), downloadName);
    return;
  }

  const audioCtx = new AudioCtx();
  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const wavBlob = audioBufferToWavBlob(decodedBuffer);
    triggerBlobDownload(wavBlob, downloadName);
  } finally {
    audioCtx.close().catch(() => {});
  }
}

