/**
 * VoxArt Studio - Broadcast Audio Processing & Real-Time Sidechain Ducking Engine
 * Professional-grade automatic volume ducking, 3-band broadcast vocal EQ,
 * and offline multitrack mixing without server latency.
 */

export interface BroadcastEQConfig {
  lowCutFreq?: number;     // e.g. 80Hz (anti-rumble)
  midFreq?: number;        // e.g. 2500Hz (vocal presence)
  midGain?: number;        // e.g. +2dB
  highShelfFreq?: number;  // e.g. 7000Hz (air & clarity)
  highShelfGain?: number;  // e.g. +1.5dB
}

export interface DuckingConfig {
  duckingAmountDb: number; // e.g. -14 dB attenuation
  attackSec: number;       // e.g. 0.04 sec (40ms)
  releaseSec: number;      // e.g. 0.35 sec (350ms)
  threshold: number;       // voice activity threshold
}

export const DEFAULT_DUCKING_CONFIG: DuckingConfig = {
  duckingAmountDb: -12,
  attackSec: 0.04,
  releaseSec: 0.35,
  threshold: 0.02,
};

export const DEFAULT_BROADCAST_EQ: BroadcastEQConfig = {
  lowCutFreq: 80,
  midFreq: 2500,
  midGain: 2.0,
  highShelfFreq: 7000,
  highShelfGain: 1.5,
};

/**
 * Creates a 3-band broadcast EQ filter chain in the given AudioContext
 */
export function createBroadcastEQChain(ctx: BaseAudioContext, config: BroadcastEQConfig = DEFAULT_BROADCAST_EQ) {
  // 1. Highpass anti-rumble filter
  const lowCut = ctx.createBiquadFilter();
  lowCut.type = 'highpass';
  lowCut.frequency.value = config.lowCutFreq ?? 80;
  lowCut.Q.value = 0.707;

  // 2. Peaking filter for vocal clarity & intelligibility
  const midPresence = ctx.createBiquadFilter();
  midPresence.type = 'peaking';
  midPresence.frequency.value = config.midFreq ?? 2500;
  midPresence.gain.value = config.midGain ?? 2.0;
  midPresence.Q.value = 1.0;

  // 3. High shelf for broadcast sheen
  const highAir = ctx.createBiquadFilter();
  highAir.type = 'highshelf';
  highAir.frequency.value = config.highShelfFreq ?? 7000;
  highAir.gain.value = config.highShelfGain ?? 1.5;

  // Connect lowCut -> midPresence -> highAir
  lowCut.connect(midPresence);
  midPresence.connect(highAir);

  return {
    input: lowCut,
    output: highAir,
    lowCut,
    midPresence,
    highAir,
  };
}

/**
 * Renders a studio-grade mix of a voice AudioBuffer and a backing track AudioBuffer
 * with automatic sidechain ducking and broadcast vocal EQ directly in browser memory.
 */
export async function renderStudioMixWithDucking(
  voiceBuffer: AudioBuffer,
  backingBuffer: AudioBuffer,
  options?: {
    voiceVolume?: number;
    backingVolume?: number;
    duckingAmountDb?: number;
    eqEnabled?: boolean;
    sampleRate?: number;
  }
): Promise<AudioBuffer> {
  const sampleRate = options?.sampleRate || 44100;
  const duration = Math.max(voiceBuffer.duration, backingBuffer.duration);
  const totalFrames = Math.ceil(duration * sampleRate);

  const offlineCtx = new OfflineAudioContext(2, totalFrames, sampleRate);

  // Voice source
  const voiceSource = offlineCtx.createBufferSource();
  voiceSource.buffer = voiceBuffer;

  const voiceGain = offlineCtx.createGain();
  voiceGain.gain.value = options?.voiceVolume ?? 1.0;

  // Backing source (looped if shorter than voice)
  const backingSource = offlineCtx.createBufferSource();
  backingSource.buffer = backingBuffer;
  if (backingBuffer.duration < voiceBuffer.duration) {
    backingSource.loop = true;
  }

  const backingMasterGain = offlineCtx.createGain();
  const baseBackingGain = options?.backingVolume ?? 0.45;
  backingMasterGain.gain.value = baseBackingGain;

  // Sidechain ducking envelope calculation
  const duckingDb = options?.duckingAmountDb ?? -12;
  const duckRatio = Math.pow(10, duckingDb / 20); // e.g. -12dB ~ 0.25
  const duckedGain = baseBackingGain * duckRatio;

  // Compute voice RMS envelope in blocks to automate backingGain
  const blockSize = Math.floor(sampleRate * 0.05); // 50ms blocks
  const voiceData = voiceBuffer.getChannelData(0);
  const duckingGainNode = offlineCtx.createGain();
  duckingGainNode.gain.setValueAtTime(baseBackingGain, 0);

  let isDucked = false;
  for (let frame = 0; frame < voiceData.length; frame += blockSize) {
    let sum = 0;
    const end = Math.min(frame + blockSize, voiceData.length);
    for (let i = frame; i < end; i++) {
      sum += voiceData[i] * voiceData[i];
    }
    const rms = Math.sqrt(sum / (end - frame));
    const time = frame / sampleRate;

    if (rms > 0.015 && !isDucked) {
      duckingGainNode.gain.setTargetAtTime(duckedGain, time, 0.04);
      isDucked = true;
    } else if (rms <= 0.015 && isDucked) {
      duckingGainNode.gain.setTargetAtTime(baseBackingGain, time, 0.35);
      isDucked = false;
    }
  }

  // Connect voice through EQ if enabled
  if (options?.eqEnabled !== false) {
    const eq = createBroadcastEQChain(offlineCtx);
    voiceSource.connect(voiceGain);
    voiceGain.connect(eq.input);
    eq.output.connect(offlineCtx.destination);
  } else {
    voiceSource.connect(voiceGain);
    voiceGain.connect(offlineCtx.destination);
  }

  // Connect backing track through ducking
  backingSource.connect(duckingGainNode);
  duckingGainNode.connect(offlineCtx.destination);

  voiceSource.start(0);
  backingSource.start(0);

  return offlineCtx.startRendering();
}
