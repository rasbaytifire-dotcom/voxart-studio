/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  AfricanInstrument, 
  EndogenousSoundscapeLayer, 
  InstrumentId, 
  RhythmComposition, 
  RhythmEffectsConfig, 
  RhythmTrack, 
  SoundscapeId 
} from '../types/rhythm';
import { audioBufferToWavBlob } from './audioExport';

export const AFRICAN_INSTRUMENTS: AfricanInstrument[] = [
  // --- DJEMBÉ ---
  {
    id: 'djembe_bass',
    name: 'Djembé Basse (Goun)',
    shortName: 'Djembe Basse',
    category: 'Djembé',
    tradition: 'Mandingue / Afrique de l’Ouest',
    color: '#f59e0b', // Amber
    defaultGain: 0.9,
    defaultPan: 0.0,
    description: 'Frappe lourde au centre de la peau, onde grave et enveloppante.'
  },
  {
    id: 'djembe_open',
    name: 'Djembé Ton Ouvert (Pah)',
    shortName: 'Djembe Ton',
    category: 'Djembé',
    tradition: 'Mandingue / Afrique de l’Ouest',
    color: '#fbbf24', // Yellow gold
    defaultGain: 0.8,
    defaultPan: -0.15,
    description: 'Frappe intermédiaire pleine et chaleureuse avec résonance de fût.'
  },
  {
    id: 'djembe_slap',
    name: 'Djembé Claqué (Ta)',
    shortName: 'Djembe Slap',
    category: 'Djembé',
    tradition: 'Mandingue / Guinée / Mali',
    color: '#ea580c', // Bright orange
    defaultGain: 0.85,
    defaultPan: 0.15,
    description: 'Frappe tranchante sur le cercle, son aigu, sec et pénétrant.'
  },

  // --- SABAR & SÉNÉGAL ---
  {
    id: 'sabar_mbeng',
    name: 'Sabar Mbëng-Mbëng (Baguette)',
    shortName: 'Sabar Baguette',
    category: 'Sabar',
    tradition: 'Sénégal / Wolof',
    color: '#ec4899', // Pink rose
    defaultGain: 0.85,
    defaultPan: 0.35,
    description: 'Claquement de baguette en bois courbée (Galàn) typique du Mbalax.'
  },
  {
    id: 'sabar_nder',
    name: 'Sabar Ndër (Solo Wolof)',
    shortName: 'Sabar Ndër',
    category: 'Sabar',
    tradition: 'Sénégal / Wolof',
    color: '#d946ef', // Fuchsia
    defaultGain: 0.8,
    defaultPan: -0.3,
    description: 'Tambour Sabar allongé soliste, frappe incisive et vibrante.'
  },
  {
    id: 'tama_talking',
    name: 'Tama (Tambour Parlant)',
    shortName: 'Tama Talking Drum',
    category: 'Percussion',
    tradition: 'Sénégal / Sahel',
    color: '#06b6d4', // Cyan
    defaultGain: 0.75,
    defaultPan: 0.2,
    description: 'Tambour d’aisselle modulable par tension des cordes de cuir.'
  },

  // --- INSTRUMENTS MÉLODIQUES & CORDES ---
  {
    id: 'kora_mandingue',
    name: 'Kora Mandingue (21 Cordes)',
    shortName: 'Kora Mandingue',
    category: 'Corde',
    tradition: 'Mandingue / Sénégal / Gambie / Mali',
    color: '#38bdf8', // Sky blue
    defaultGain: 0.85,
    defaultPan: -0.2,
    description: 'Harpe-luth sacrée à résonateur de calebasse, arpèges cristallins et polyphonie sahélienne.'
  },
  {
    id: 'balafon_casamance',
    name: 'Balafon Mandingue / Casamance',
    shortName: 'Balafon',
    category: 'Mélodique',
    tradition: 'Casamance / Mandingue',
    color: '#10b981', // Emerald
    defaultGain: 0.8,
    defaultPan: -0.25,
    description: 'Lames de bois de rose résonnant sur calebasses gourdes aux timbres boisés chauds.'
  },
  {
    id: 'riti_violin',
    name: 'Riti (Violon Monocorde Wolof & Peul)',
    shortName: 'Riti Violon',
    category: 'Corde',
    tradition: 'Sénégal / Wolof & Peul',
    color: '#fb923c', // Warm orange
    defaultGain: 0.8,
    defaultPan: -0.3,
    description: 'Archet de crin de cheval frottant une corde unique sur peau de varan, glissando vocalique expressif.'
  },

  // --- INSTRUMENTS À VENT ---
  {
    id: 'flute_peulh',
    name: 'Flûte Peulh (Tambin Pastoral)',
    shortName: 'Flûte Peulh',
    category: 'Vent',
    tradition: 'Fouta Djallon / Sénégal / Guinée',
    color: '#34d399', // Mint green
    defaultGain: 0.8,
    defaultPan: 0.25,
    description: 'Flûte pastorale à 3 trous, souffle d’air aéré, harmoniques suraiguës et chant fredonné simultané.'
  },
  {
    id: 'trompe_vent_ancestral',
    name: 'Trompe Sahélienne (Corne d’Appel)',
    shortName: 'Trompe d’Appel',
    category: 'Vent',
    tradition: 'Afrique de l’Ouest / Cérémonial',
    color: '#c084fc', // Purple light
    defaultGain: 0.75,
    defaultPan: 0.15,
    description: 'Corne naturelle des grands rassemblements ancestraux, appel cuivré grave et solennel.'
  },

  // --- PERCUSSIONS TRADITIONNELLES ---
  {
    id: 'calebasse_water',
    name: 'Calebasse frappée (Eau & Terre)',
    shortName: 'Calebasse',
    category: 'Percussion',
    tradition: 'Sahel / Peul / Songhaï',
    color: '#84cc16', // Lime
    defaultGain: 0.85,
    defaultPan: 0.0,
    description: 'Résonance sourde et ronde d’une demi-calebasse creuse jouée à mains nues.'
  },
  {
    id: 'cloche_kenkeni',
    name: 'Cloche de Fer Kenkeni',
    shortName: 'Cloche Kenkeni',
    category: 'Percussion',
    tradition: 'Afrique de l’Ouest',
    color: '#e2e8f0', // Metallic silver
    defaultGain: 0.65,
    defaultPan: 0.4,
    description: 'Pulsation métronomique métallique guidant et structurant la polyrythmie.'
  },
  {
    id: 'chekere_shaker',
    name: 'Chékéré & Perles',
    shortName: 'Chékéré Shaker',
    category: 'Percussion',
    tradition: 'Yoruba / Afrique de l’Ouest',
    color: '#a855f7', // Purple
    defaultGain: 0.7,
    defaultPan: -0.35,
    description: 'Frottement continu et sec de résille de perles sur calebasse tressée.'
  },

  // --- EFFETS & BRUITAGES ENDOGÈNES ---
  {
    id: 'coq_matin',
    name: 'Chant du Coq (Aube au Village)',
    shortName: 'Chant du Coq',
    category: 'Bruitage Endogène',
    tradition: 'Scène de Vie Rurale',
    color: '#f87171', // Red coral
    defaultGain: 0.75,
    defaultPan: 0.35,
    description: 'Cocorico matinal clair inaugurant le lever du soleil au village sahélien.'
  },
  {
    id: 'oiseaux_saheliens',
    name: 'Oiseaux du Sahel & Brousse',
    shortName: 'Oiseaux Sahel',
    category: 'Bruitage Endogène',
    tradition: 'Éco-Acoustique / Nature',
    color: '#a3e635', // Lime light
    defaultGain: 0.7,
    defaultPan: -0.3,
    description: 'Trilles et gazouillis d’oiseaux tropicaux et tourterelles sous la canopée.'
  },
  {
    id: 'lion_savane',
    name: 'Rugissement du Lion (Savane Lointaine)',
    shortName: 'Lion Savane',
    category: 'Bruitage Endogène',
    tradition: 'Totem & Faune Ancestrale',
    color: '#d97706', // Amber gold
    defaultGain: 0.8,
    defaultPan: 0.0,
    description: 'Grondement sourd et majestueux résonnant à travers la plaine sauvage.'
  },
  {
    id: 'chant_rituel_ancestral',
    name: 'Voix & Incantation Rituelle',
    shortName: 'Voix Rituelle',
    category: 'Bruitage Endogène',
    tradition: 'Griots & Confréries Sacrées',
    color: '#e879f9', // Pink lavender
    defaultGain: 0.8,
    defaultPan: -0.1,
    description: 'Harmoniques vocales mystiques, drone spirituel diphonique et syllabes sacrées.'
  },
  {
    id: 'femme_pilon_frappe',
    name: 'Pilon de Mil (Mortier en Bois)',
    shortName: 'Pilon Mortier',
    category: 'Bruitage Endogène',
    tradition: 'Vie Quotidienne / Sénégal',
    color: '#b45309', // Deep wood
    defaultGain: 0.85,
    defaultPan: 0.2,
    description: 'Impact lourd et boisé du pilon dans le mortier, cadence ancestrale féminine.'
  }
];

export const DEFAULT_SOUNDSCAPES: EndogenousSoundscapeLayer[] = [
  {
    id: 'foret_brousse',
    name: 'Forêt Sacrée & Brousse',
    subtitle: 'Casamance & Forêt de Baobabs',
    description: 'Brise bruissant dans les branches sacrées, feuilles sèches, éco-acoustique vivante.',
    icon: '🌳',
    enabled: false,
    volume: 0.45,
    pan: -0.2
  },
  {
    id: 'village_pilon',
    name: 'Matinée au Village',
    subtitle: 'Cadence des Pilons & Murmures',
    description: 'Rythme ancestral du mil pilé au mortier en bois et murmures de villageois au réveil.',
    icon: '🛖',
    enabled: false,
    volume: 0.4,
    pan: 0.15
  },
  {
    id: 'marche_sandaga',
    name: 'Marché Traditionnel & Palabres',
    subtitle: 'Rumeur Sahélienne & Échanges',
    description: 'Effervescence chaleureuse des étals, cliquetis de calebasses, pas sur la terre rouge.',
    icon: '🧺',
    enabled: false,
    volume: 0.38,
    pan: 0.3
  },
  {
    id: 'fleuve_pirogue',
    name: 'Fleuve Sénégal & Pirogue',
    subtitle: 'Clapotis d’Eau & Pagaies en Bois',
    description: 'Ondes aquatiques douces, mouvement de pirogue et clapotis au crépuscule.',
    icon: '🛶',
    enabled: false,
    volume: 0.45,
    pan: -0.3
  },
  {
    id: 'nuit_savane',
    name: 'Nuit Sahélienne & Grillons',
    subtitle: 'Harmonie Stellaire & Nocturne',
    description: 'Pulsation de grillons mystiques sous la voie lactée et brise fraîche nocturne.',
    icon: '✨',
    enabled: false,
    volume: 0.42,
    pan: 0.0
  }
];

export const DEFAULT_EFFECTS_CONFIG: RhythmEffectsConfig = {
  reverb: {
    enabled: true,
    decay: 1.8,
    wet: 0.28
  },
  delay: {
    enabled: false,
    time: 0.28,
    feedback: 0.35,
    wet: 0.2
  },
  filter: {
    enabled: false,
    type: 'lowpass',
    cutoff: 8000,
    resonance: 1.2
  },
  compressor: {
    enabled: true,
    threshold: -18,
    ratio: 3.5
  },
  masterVolume: 0.85
};

// Generates an impulse response buffer for warm acoustic space / calabash resonance
export function createReverbImpulse(ctx: BaseAudioContext, decaySec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * Math.max(0.2, decaySec));
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / length;
    const envelope = Math.exp(-t * 3.8);
    const noiseL = (Math.random() * 2 - 1) * envelope;
    const noiseR = (Math.random() * 2 - 1) * envelope;
    left[i] = noiseL;
    right[i] = noiseR;
  }
  return impulse;
}

/**
 * Triggers an authentic African instrument or endogenous sound effect inside any Web Audio Context.
 */
export function playAfricanInstrument(
  ctx: BaseAudioContext,
  instrumentId: InstrumentId,
  time: number,
  velocity: number = 1,
  destination: AudioNode
) {
  if (velocity <= 0.01) return;
  const effectiveVol = Math.max(0.1, Math.min(1.5, velocity));

  const trackGain = ctx.createGain();
  trackGain.gain.setValueAtTime(1, time);
  trackGain.connect(destination);

  switch (instrumentId) {
    // ----------------------------------------------------
    // DJEMBÉ BASSE, TON, SLAP
    // ----------------------------------------------------
    case 'djembe_bass': {
      const osc = ctx.createOscillator();
      const oscSub = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, time);
      osc.frequency.exponentialRampToValueAtTime(54, time + 0.12);

      oscSub.type = 'sine';
      oscSub.frequency.setValueAtTime(68, time);
      oscSub.frequency.exponentialRampToValueAtTime(42, time + 0.28);

      gainNode.gain.setValueAtTime(effectiveVol * 1.3, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

      osc.connect(gainNode);
      oscSub.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      oscSub.start(time);
      osc.stop(time + 0.4);
      oscSub.stop(time + 0.4);
      break;
    }

    case 'djembe_open': {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gainNode = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(265, time);
      osc.frequency.exponentialRampToValueAtTime(185, time + 0.07);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, time);
      filter.frequency.exponentialRampToValueAtTime(600, time + 0.18);

      gainNode.gain.setValueAtTime(effectiveVol * 0.95, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      osc.stop(time + 0.24);
      break;
    }

    case 'djembe_slap': {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, time);
      osc.frequency.exponentialRampToValueAtTime(280, time + 0.035);

      const noiseLen = Math.floor(ctx.sampleRate * 0.045);
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseLen * 0.3));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(2400, time);
      noiseFilter.Q.setValueAtTime(1.5, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 1.05, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

      osc.connect(gainNode);
      noise.connect(noiseFilter);
      noiseFilter.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      noise.start(time);
      osc.stop(time + 0.15);
      noise.stop(time + 0.05);
      break;
    }

    // ----------------------------------------------------
    // SABAR & TAMA
    // ----------------------------------------------------
    case 'sabar_mbeng': {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(640, time);
      osc.frequency.exponentialRampToValueAtTime(320, time + 0.03);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1600, time);
      bp.Q.setValueAtTime(3.5, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 1.1, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

      osc.connect(bp);
      bp.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      osc.stop(time + 0.13);
      break;
    }

    case 'sabar_nder': {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, time);
      osc.frequency.exponentialRampToValueAtTime(290, time + 0.06);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(950, time);
      filter.Q.setValueAtTime(2.2, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 0.95, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      osc.stop(time + 0.2);
      break;
    }

    case 'tama_talking': {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const startPitch = 220 + (Math.sin(time * 3) * 60);
      osc.frequency.setValueAtTime(startPitch, time);
      osc.frequency.linearRampToValueAtTime(startPitch * 1.55, time + 0.09);
      osc.frequency.exponentialRampToValueAtTime(startPitch * 0.9, time + 0.22);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 0.85, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      osc.stop(time + 0.27);
      break;
    }

    // ----------------------------------------------------
    // KORA MANDINGUE (Harpe-luth 21 cordes en résonance)
    // ----------------------------------------------------
    case 'kora_mandingue': {
      // Mandingue Silaba scale pitches (F4, G4, A4, C5, D5, E5, F5, G5)
      const koraPitches = [349.23, 392.00, 440.00, 523.25, 587.33, 659.25, 698.46, 783.99];
      const pitchIndex = Math.abs(Math.floor(time * 6.3)) % koraPitches.length;
      const freq = koraPitches[pitchIndex];

      const stringOsc = ctx.createOscillator();
      stringOsc.type = 'triangle';
      stringOsc.frequency.setValueAtTime(freq, time);

      const harmonicOsc = ctx.createOscillator();
      harmonicOsc.type = 'sine';
      harmonicOsc.frequency.setValueAtTime(freq * 2, time);

      // Calabash acoustic body resonator (formant filter)
      const bodyFilter = ctx.createBiquadFilter();
      bodyFilter.type = 'bandpass';
      bodyFilter.frequency.setValueAtTime(380, time);
      bodyFilter.Q.setValueAtTime(3.8, time);

      // High string shimmer filter
      const stringFilter = ctx.createBiquadFilter();
      stringFilter.type = 'lowpass';
      stringFilter.frequency.setValueAtTime(4500, time);
      stringFilter.frequency.exponentialRampToValueAtTime(1200, time + 0.45);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 0.9, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.55);

      stringOsc.connect(stringFilter);
      harmonicOsc.connect(stringFilter);
      stringFilter.connect(bodyFilter);
      bodyFilter.connect(gainNode);
      // Mix direct clear pluck with calabash warmth
      stringFilter.connect(gainNode);
      gainNode.connect(trackGain);

      stringOsc.start(time);
      harmonicOsc.start(time);
      stringOsc.stop(time + 0.6);
      harmonicOsc.stop(time + 0.6);
      break;
    }

    // ----------------------------------------------------
    // FLÛTE PEULH (Tambin pastoral du Fouta)
    // ----------------------------------------------------
    case 'flute_peulh': {
      // Pastoral flute scale (D5, E5, G5, A5, B5, D6)
      const flutePitches = [587.33, 659.25, 783.99, 880.00, 987.77, 1174.66];
      const pIdx = Math.abs(Math.floor(time * 5.1)) % flutePitches.length;
      const freq = flutePitches[pIdx];

      // Fundamental air pipe
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      // 5.5Hz pastoral vibrato LFO
      const vibrato = ctx.createOscillator();
      vibrato.frequency.setValueAtTime(5.5, time);
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.setValueAtTime(8, time);
      vibrato.connect(osc.frequency);

      // Breath turbulence noise
      const noiseLen = Math.floor(ctx.sampleRate * 0.28);
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const nData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        nData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseLen * 0.7));
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuf;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(freq * 1.5, time);
      noiseFilter.Q.setValueAtTime(4.0, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, time);
      gainNode.gain.linearRampToValueAtTime(effectiveVol * 0.85, time + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.42);

      osc.connect(gainNode);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(gainNode);
      gainNode.connect(trackGain);

      vibrato.start(time);
      osc.start(time);
      noiseSource.start(time);
      vibrato.stop(time + 0.45);
      osc.stop(time + 0.45);
      noiseSource.stop(time + 0.28);
      break;
    }

    // ----------------------------------------------------
    // RITI (Violon monocorde traditionnel Wolof & Peul)
    // ----------------------------------------------------
    case 'riti_violin': {
      const ritiPitches = [293.66, 329.63, 392.00, 440.00, 523.25];
      const rIdx = Math.abs(Math.floor(time * 4.7)) % ritiPitches.length;
      const targetFreq = ritiPitches[rIdx];

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      // Characteristic Sahélian micro-glissando on string touch
      osc.frequency.setValueAtTime(targetFreq * 0.97, time);
      osc.frequency.linearRampToValueAtTime(targetFreq, time + 0.045);

      // Resonant skin-covered gourd body filter
      const skinFilter = ctx.createBiquadFilter();
      skinFilter.type = 'bandpass';
      skinFilter.frequency.setValueAtTime(1150, time);
      skinFilter.Q.setValueAtTime(2.6, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, time);
      gainNode.gain.linearRampToValueAtTime(effectiveVol * 0.8, time + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

      osc.connect(skinFilter);
      skinFilter.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      osc.stop(time + 0.4);
      break;
    }

    // ----------------------------------------------------
    // TROMPE SAHÉLIENNE (Corne cérémonielle d'appel)
    // ----------------------------------------------------
    case 'trompe_vent_ancestral': {
      const fundamental = 110; // A2 deep ceremonial brass tone
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(fundamental, time);
      osc2.frequency.setValueAtTime(fundamental * 1.5, time); // 5th harmonic

      const brassFilter = ctx.createBiquadFilter();
      brassFilter.type = 'lowpass';
      brassFilter.frequency.setValueAtTime(320, time);
      brassFilter.frequency.linearRampToValueAtTime(1600, time + 0.08);
      brassFilter.frequency.exponentialRampToValueAtTime(420, time + 0.55);
      brassFilter.Q.setValueAtTime(3.2, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, time);
      gainNode.gain.linearRampToValueAtTime(effectiveVol * 0.9, time + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

      osc1.connect(brassFilter);
      osc2.connect(brassFilter);
      brassFilter.connect(gainNode);
      gainNode.connect(trackGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.65);
      osc2.stop(time + 0.65);
      break;
    }

    // ----------------------------------------------------
    // BALAFON & CALEBASSE
    // ----------------------------------------------------
    case 'balafon_casamance': {
      const pentatonicPitches = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];
      const pitchIndex = Math.abs(Math.floor(time * 7.5)) % pentatonicPitches.length;
      const freq = pentatonicPitches[pitchIndex];

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      const mirlitonOsc = ctx.createOscillator();
      mirlitonOsc.type = 'sine';
      mirlitonOsc.frequency.setValueAtTime(freq * 3, time);

      const mirlitonGain = ctx.createGain();
      mirlitonGain.gain.setValueAtTime(0.2, time);
      mirlitonGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 0.85, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

      osc.connect(gainNode);
      mirlitonOsc.connect(mirlitonGain);
      mirlitonGain.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      mirlitonOsc.start(time);
      osc.stop(time + 0.35);
      mirlitonOsc.stop(time + 0.1);
      break;
    }

    case 'calebasse_water': {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, time);
      osc.frequency.exponentialRampToValueAtTime(65, time + 0.16);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 1.1, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      osc.stop(time + 0.38);
      break;
    }

    // ----------------------------------------------------
    // CLOCHE & CHÉKÉRÉ
    // ----------------------------------------------------
    case 'cloche_kenkeni': {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(840, time);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1260, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 0.55, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(trackGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.2);
      osc2.stop(time + 0.15);
      break;
    }

    case 'chekere_shaker': {
      const dur = 0.06;
      const noiseLen = Math.floor(ctx.sampleRate * dur);
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / noiseLen) * Math.PI);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3200, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 0.7, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + dur);

      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(trackGain);

      noise.start(time);
      noise.stop(time + dur + 0.01);
      break;
    }

    // ----------------------------------------------------
    // EFFETS & BRUITAGES ENDOGÈNES
    // ----------------------------------------------------
    case 'coq_matin': {
      // African village rooster crow multi-segment curve:
      // Cocorico: short rise, dip, long bright flutter crow
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(540, time);
      osc.frequency.linearRampToValueAtTime(720, time + 0.08);
      osc.frequency.linearRampToValueAtTime(620, time + 0.14);
      osc.frequency.linearRampToValueAtTime(960, time + 0.24);
      osc.frequency.exponentialRampToValueAtTime(680, time + 0.65);

      // Rooster vocal tract formant
      const vocalFilter = ctx.createBiquadFilter();
      vocalFilter.type = 'bandpass';
      vocalFilter.frequency.setValueAtTime(1850, time);
      vocalFilter.Q.setValueAtTime(3.0, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, time);
      gainNode.gain.linearRampToValueAtTime(effectiveVol * 0.85, time + 0.06);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.68);

      osc.connect(vocalFilter);
      vocalFilter.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      osc.stop(time + 0.7);
      break;
    }

    case 'oiseaux_saheliens': {
      // High-pitched tropical bird chirps (trill pattern)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3200, time);
      osc.frequency.linearRampToValueAtTime(4400, time + 0.04);
      osc.frequency.linearRampToValueAtTime(2800, time + 0.08);
      osc.frequency.linearRampToValueAtTime(4100, time + 0.12);
      osc.frequency.exponentialRampToValueAtTime(2600, time + 0.22);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 0.75, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc.connect(gainNode);
      gainNode.connect(trackGain);

      osc.start(time);
      osc.stop(time + 0.26);
      break;
    }

    case 'lion_savane': {
      // Deep guttural savannah lion roar
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(58, time);
      subOsc.frequency.exponentialRampToValueAtTime(38, time + 0.55);

      // Brownian rumble noise
      const nLen = Math.floor(ctx.sampleRate * 0.6);
      const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
      const d = nBuf.getChannelData(0);
      let lastVal = 0;
      for (let i = 0; i < nLen; i++) {
        lastVal = (lastVal + (Math.random() * 2 - 1) * 0.1) * 0.95;
        d[i] = lastVal * Math.sin((i / nLen) * Math.PI);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = nBuf;

      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(140, time);
      subFilter.Q.setValueAtTime(4.0, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, time);
      gainNode.gain.linearRampToValueAtTime(effectiveVol * 1.15, time + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.65);

      subOsc.connect(subFilter);
      noise.connect(subFilter);
      subFilter.connect(gainNode);
      gainNode.connect(trackGain);

      subOsc.start(time);
      noise.start(time);
      subOsc.stop(time + 0.7);
      noise.stop(time + 0.65);
      break;
    }

    case 'chant_rituel_ancestral': {
      // Sacred vocal formant drone (Griot incantation)
      const vocalFund = 146.83; // D3
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(vocalFund, time);

      // Vibrato
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(4.8, time);
      const lfoG = ctx.createGain();
      lfoG.gain.setValueAtTime(4, time);
      lfo.connect(osc.frequency);

      // Formants for "Oh-Ah" ancestral chant
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(520, time);
      f1.Q.setValueAtTime(4.0, time);

      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.setValueAtTime(1150, time);
      f2.Q.setValueAtTime(3.5, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.01, time);
      gainNode.gain.linearRampToValueAtTime(effectiveVol * 0.9, time + 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.65);

      osc.connect(f1);
      osc.connect(f2);
      f1.connect(gainNode);
      f2.connect(gainNode);
      gainNode.connect(trackGain);

      lfo.start(time);
      osc.start(time);
      lfo.stop(time + 0.7);
      osc.stop(time + 0.7);
      break;
    }

    case 'femme_pilon_frappe': {
      // Pestle strike in hollow wooden mortar
      const thudOsc = ctx.createOscillator();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(160, time);
      thudOsc.frequency.exponentialRampToValueAtTime(55, time + 0.12);

      const woodRes = ctx.createBiquadFilter();
      woodRes.type = 'bandpass';
      woodRes.frequency.setValueAtTime(310, time);
      woodRes.Q.setValueAtTime(3.0, time);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(effectiveVol * 1.15, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

      thudOsc.connect(woodRes);
      woodRes.connect(gainNode);
      gainNode.connect(trackGain);

      thudOsc.start(time);
      thudOsc.stop(time + 0.3);
      break;
    }
  }
}

/**
 * Procedural synthesis of continuous endogenous soundscapes.
 * Can be run in both real-time AudioContext and offline rendering.
 */
export function playContinuousSoundscape(
  ctx: BaseAudioContext,
  soundscapeId: SoundscapeId,
  startTime: number,
  duration: number,
  volume: number,
  pan: number,
  destination: AudioNode
) {
  if (volume <= 0.01) return;

  const panNode = ctx.createStereoPanner();
  panNode.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), startTime);

  const masterVolNode = ctx.createGain();
  masterVolNode.gain.setValueAtTime(volume, startTime);
  masterVolNode.connect(panNode);
  panNode.connect(destination);

  switch (soundscapeId) {
    case 'foret_brousse': {
      // Wind through sacred baobab trees and rustling leaves
      const noiseLen = Math.floor(ctx.sampleRate * Math.min(duration, 5.0));
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        d[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(450, startTime);
      windFilter.Q.setValueAtTime(1.8, startTime);

      // Wind swelling LFO
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.22, startTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(220, startTime);
      lfo.connect(windFilter.frequency);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.45, startTime);

      noise.connect(windFilter);
      windFilter.connect(g);
      g.connect(masterVolNode);

      lfo.start(startTime);
      noise.start(startTime);
      lfo.stop(startTime + duration);
      noise.stop(startTime + duration);
      break;
    }

    case 'village_pilon': {
      // Hypnotic distant mortar pestle cadence in village
      const bpmInterval = 60 / 68; // ~68 bpm village cadence
      const beats = Math.floor(duration / bpmInterval);
      for (let b = 0; b < beats; b++) {
        const beatTime = startTime + (b * bpmInterval);
        playAfricanInstrument(ctx, 'femme_pilon_frappe', beatTime, 0.45, masterVolNode);
      }
      break;
    }

    case 'marche_sandaga': {
      // Sahelian market background murmur and rustle
      const noiseLen = Math.floor(ctx.sampleRate * Math.min(duration, 4.0));
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        d[i] = (Math.random() * 2 - 1);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop = true;

      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.setValueAtTime(750, startTime);
      f1.Q.setValueAtTime(3.0, startTime);

      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.setValueAtTime(1800, startTime);
      f2.Q.setValueAtTime(2.5, startTime);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35, startTime);

      noise.connect(f1);
      noise.connect(f2);
      f1.connect(g);
      f2.connect(g);
      g.connect(masterVolNode);

      noise.start(startTime);
      noise.stop(startTime + duration);
      break;
    }

    case 'fleuve_pirogue': {
      // Gentle water wave lapping and soft paddle dips
      const waveCycle = 3.6; // seconds per wave swell
      const totalCycles = Math.ceil(duration / waveCycle);

      const noiseLen = Math.floor(ctx.sampleRate * 2.5);
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        d[i] = (Math.random() * 2 - 1);
      }

      for (let c = 0; c < totalCycles; c++) {
        const cTime = startTime + (c * waveCycle);
        if (cTime >= startTime + duration) break;

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuf;

        const waterFilter = ctx.createBiquadFilter();
        waterFilter.type = 'lowpass';
        waterFilter.frequency.setValueAtTime(280, cTime);
        waterFilter.frequency.linearRampToValueAtTime(800, cTime + 1.2);
        waterFilter.frequency.exponentialRampToValueAtTime(180, cTime + 2.8);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.01, cTime);
        env.gain.linearRampToValueAtTime(0.4, cTime + 1.1);
        env.gain.exponentialRampToValueAtTime(0.001, cTime + 2.9);

        noise.connect(waterFilter);
        waterFilter.connect(env);
        env.connect(masterVolNode);

        noise.start(cTime);
        noise.stop(cTime + 3.0);
      }
      break;
    }

    case 'nuit_savane': {
      // Crickets chorus pulsating at 6Hz with nocturnal breeze
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(4850, startTime);
      osc2.frequency.setValueAtTime(5320, startTime);

      // Tremolo LFO
      const tremolo = ctx.createOscillator();
      tremolo.frequency.setValueAtTime(6.2, startTime);
      const tremoloGain = ctx.createGain();
      tremoloGain.gain.setValueAtTime(0.4, startTime);

      const nightGain = ctx.createGain();
      nightGain.gain.setValueAtTime(0.18, startTime);

      osc1.connect(nightGain);
      osc2.connect(nightGain);
      nightGain.connect(masterVolNode);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration);
      osc2.stop(startTime + duration);
      break;
    }
  }
}

/**
 * Connects the Master Effects Rack (Reverb, Delay, Warmth Filter, Compressor, Master Gain)
 */
export function buildEffectsRack(ctx: BaseAudioContext, effects: RhythmEffectsConfig) {
  const inputNode = ctx.createGain();
  const outputNode = ctx.createGain();
  outputNode.gain.value = effects.masterVolume;

  let currentEndNode: AudioNode = inputNode;

  // 1. Warmth Filter
  let filterNode: BiquadFilterNode | null = null;
  if (effects.filter.enabled) {
    filterNode = ctx.createBiquadFilter();
    filterNode.type = effects.filter.type;
    filterNode.frequency.value = effects.filter.cutoff;
    filterNode.Q.value = effects.filter.resonance;
    currentEndNode.connect(filterNode);
    currentEndNode = filterNode;
  }

  // 2. Dynamics Compressor
  let compNode: DynamicsCompressorNode | null = null;
  if (effects.compressor.enabled) {
    compNode = ctx.createDynamicsCompressor();
    compNode.threshold.value = effects.compressor.threshold;
    compNode.ratio.value = effects.compressor.ratio;
    compNode.attack.value = 0.005;
    compNode.release.value = 0.12;
    currentEndNode.connect(compNode);
    currentEndNode = compNode;
  }

  const masterBus = currentEndNode;

  // 3. Reverb Convolver
  if (effects.reverb.enabled && effects.reverb.wet > 0.01) {
    try {
      const convolver = ctx.createConvolver();
      convolver.buffer = createReverbImpulse(ctx, effects.reverb.decay);

      const reverbGain = ctx.createGain();
      reverbGain.gain.value = effects.reverb.wet;

      masterBus.connect(convolver);
      convolver.connect(reverbGain);
      reverbGain.connect(outputNode);
    } catch (e) {
      console.warn("Reverb node creation fallback:", e);
    }
  }

  // 4. Stereo Tape Delay (Dub Echo)
  if (effects.delay.enabled && effects.delay.wet > 0.01) {
    const delay = ctx.createDelay();
    delay.delayTime.value = effects.delay.time;
    const feedback = ctx.createGain();
    feedback.gain.value = effects.delay.feedback;
    const delayGain = ctx.createGain();
    delayGain.gain.value = effects.delay.wet;

    masterBus.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(outputNode);
  }

  // Dry bus straight to output
  masterBus.connect(outputNode);

  return {
    input: inputNode,
    output: outputNode
  };
}

/**
 * Traditional Presets of Senegalese & African Loops with Endogenous Ambience
 */
export const TRADITIONAL_RHYTHM_PRESETS: RhythmComposition[] = [
  {
    id: 'aube_kora_sahel',
    name: 'Aube Sahélienne & Kora Mandingue (12/8)',
    tradition: 'Mandingue / Casamance',
    signature: '12/8',
    stepCount: 12,
    bpm: 104,
    createdAt: 1710000000100,
    description: 'Immersion poétique à l’aube : Kora perlée, djembé doux, chant de coq lointain et brise de brousse.',
    effects: {
      ...DEFAULT_EFFECTS_CONFIG,
      reverb: { enabled: true, decay: 2.2, wet: 0.35 }
    },
    soundscapes: [
      { ...DEFAULT_SOUNDSCAPES[0], enabled: true, volume: 0.5 }, // forêt brousse
      { ...DEFAULT_SOUNDSCAPES[1], enabled: false, volume: 0.3 }
    ],
    tracks: [
      {
        instrumentId: 'kora_mandingue',
        steps: [2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1],
        muted: false,
        solo: false,
        gain: 0.95,
        pan: -0.25
      },
      {
        instrumentId: 'djembe_bass',
        steps: [2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 0.85,
        pan: 0
      },
      {
        instrumentId: 'djembe_open',
        steps: [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
        muted: false,
        solo: false,
        gain: 0.75,
        pan: 0.15
      },
      {
        instrumentId: 'chekere_shaker',
        steps: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        muted: false,
        solo: false,
        gain: 0.5,
        pan: -0.35
      },
      {
        instrumentId: 'coq_matin',
        steps: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 0.7,
        pan: 0.4
      },
      {
        instrumentId: 'oiseaux_saheliens',
        steps: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 0.65,
        pan: -0.3
      }
    ]
  },
  {
    id: 'sabar_kaolack',
    name: 'Sabar Kaolack (Sénégal)',
    tradition: 'Sénégal / Wolof',
    signature: '12/8',
    stepCount: 12,
    bpm: 114,
    createdAt: 1710000000000,
    description: 'Polyrythmie wolof étincelante avec jeu de baguette incisif, cloche et basse de djembé.',
    effects: {
      ...DEFAULT_EFFECTS_CONFIG,
      reverb: { enabled: true, decay: 1.6, wet: 0.3 }
    },
    soundscapes: [
      { ...DEFAULT_SOUNDSCAPES[2], enabled: true, volume: 0.35 } // marché & palabres
    ],
    tracks: [
      {
        instrumentId: 'djembe_bass',
        steps: [2, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0],
        muted: false,
        solo: false,
        gain: 0.9,
        pan: 0
      },
      {
        instrumentId: 'sabar_mbeng',
        steps: [2, 0, 1, 0, 1, 2, 0, 1, 2, 0, 1, 0],
        muted: false,
        solo: false,
        gain: 0.95,
        pan: 0.3
      },
      {
        instrumentId: 'sabar_nder',
        steps: [0, 0, 0, 2, 0, 1, 0, 0, 2, 1, 0, 1],
        muted: false,
        solo: false,
        gain: 0.8,
        pan: -0.25
      },
      {
        instrumentId: 'cloche_kenkeni',
        steps: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
        muted: false,
        solo: false,
        gain: 0.65,
        pan: 0.4
      },
      {
        instrumentId: 'chekere_shaker',
        steps: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        muted: false,
        solo: false,
        gain: 0.5,
        pan: -0.35
      }
    ]
  },
  {
    id: 'mystique_flute_peulh',
    name: 'Mystique Pastorale & Flûte Peulh (6/8)',
    tradition: 'Fouta / Sénégal / Peul',
    signature: '6/8',
    stepCount: 12,
    bpm: 96,
    createdAt: 1710000000200,
    description: 'Harmonie pastorale sahélienne : Flûte Peulh aérée, violon Riti expressif et cadence de mortier.',
    effects: {
      ...DEFAULT_EFFECTS_CONFIG,
      reverb: { enabled: true, decay: 2.5, wet: 0.38 },
      delay: { enabled: true, time: 0.32, feedback: 0.35, wet: 0.25 }
    },
    soundscapes: [
      { ...DEFAULT_SOUNDSCAPES[1], enabled: true, volume: 0.4 } // village pilon
    ],
    tracks: [
      {
        instrumentId: 'flute_peulh',
        steps: [2, 0, 1, 2, 1, 0, 2, 0, 1, 2, 0, 1],
        muted: false,
        solo: false,
        gain: 0.9,
        pan: 0.25
      },
      {
        instrumentId: 'riti_violin',
        steps: [1, 0, 0, 2, 0, 1, 1, 0, 0, 2, 1, 0],
        muted: false,
        solo: false,
        gain: 0.85,
        pan: -0.3
      },
      {
        instrumentId: 'calebasse_water',
        steps: [2, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0],
        muted: false,
        solo: false,
        gain: 0.95,
        pan: 0.0
      },
      {
        instrumentId: 'femme_pilon_frappe',
        steps: [0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 0.8,
        pan: 0.2
      },
      {
        instrumentId: 'cloche_kenkeni',
        steps: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
        muted: false,
        solo: false,
        gain: 0.55,
        pan: 0.35
      }
    ]
  },
  {
    id: 'mbalax_thieboudienne',
    name: 'Mbalax Thiéboudienne (Dakar)',
    tradition: 'Sénégal Moderne / Dakar',
    signature: '12/8',
    stepCount: 12,
    bpm: 126,
    createdAt: 1710000001000,
    description: 'Cadence de fête dakaroise endiablée, signature polyrythmique 12/8 percutante avec le Tama et le Sabar.',
    effects: {
      ...DEFAULT_EFFECTS_CONFIG,
      reverb: { enabled: true, decay: 1.4, wet: 0.22 }
    },
    tracks: [
      {
        instrumentId: 'sabar_mbeng',
        steps: [2, 1, 0, 2, 1, 0, 2, 1, 0, 2, 1, 2],
        muted: false,
        solo: false,
        gain: 1.0,
        pan: 0.35
      },
      {
        instrumentId: 'tama_talking',
        steps: [0, 2, 1, 0, 2, 1, 0, 2, 1, 0, 2, 1],
        muted: false,
        solo: false,
        gain: 0.85,
        pan: -0.2
      },
      {
        instrumentId: 'djembe_bass',
        steps: [2, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 0.9,
        pan: 0
      },
      {
        instrumentId: 'djembe_slap',
        steps: [0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 0, 0],
        muted: false,
        solo: false,
        gain: 0.9,
        pan: 0.15
      },
      {
        instrumentId: 'chekere_shaker',
        steps: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        muted: false,
        solo: false,
        gain: 0.6,
        pan: -0.35
      }
    ]
  },
  {
    id: 'rituel_appel_ancetres',
    name: 'Cérémonie Rituelle & Appel des Ancêtres (4/4)',
    tradition: 'RidiaLArt / Rituel Sacré',
    signature: '4/4',
    stepCount: 16,
    bpm: 82,
    createdAt: 1710000000300,
    description: 'Rassemblement mystique : Trompe d’appel sahélienne, incantations rituelles, pilon lourd et grondement.',
    effects: {
      ...DEFAULT_EFFECTS_CONFIG,
      reverb: { enabled: true, decay: 3.0, wet: 0.42 },
      delay: { enabled: true, time: 0.36, feedback: 0.45, wet: 0.3 }
    },
    soundscapes: [
      { ...DEFAULT_SOUNDSCAPES[4], enabled: true, volume: 0.5 } // nuit savane
    ],
    tracks: [
      {
        instrumentId: 'trompe_vent_ancestral',
        steps: [2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 0.9,
        pan: 0.15
      },
      {
        instrumentId: 'chant_rituel_ancestral',
        steps: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 0.85,
        pan: -0.15
      },
      {
        instrumentId: 'calebasse_water',
        steps: [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 1.0,
        pan: 0.0
      },
      {
        instrumentId: 'femme_pilon_frappe',
        steps: [0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0],
        muted: false,
        solo: false,
        gain: 0.9,
        pan: 0.2
      },
      {
        instrumentId: 'lion_savane',
        steps: [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 0.75,
        pan: 0.0
      }
    ]
  },
  {
    id: 'balafon_casamance_fleuve',
    name: 'Casamance Balafon & Fleuve Pirogue (6/8)',
    tradition: 'Casamance (Sénégal) / Diola',
    signature: '6/8',
    stepCount: 12,
    bpm: 108,
    createdAt: 1710000004000,
    description: 'Envoûtement du Sud : calebasse aquatique résonnante, mélodie de balafon et clapotis du fleuve.',
    effects: {
      ...DEFAULT_EFFECTS_CONFIG,
      reverb: { enabled: true, decay: 2.5, wet: 0.38 },
      delay: { enabled: true, time: 0.32, feedback: 0.3, wet: 0.25 }
    },
    soundscapes: [
      { ...DEFAULT_SOUNDSCAPES[3], enabled: true, volume: 0.45 } // fleuve pirogue
    ],
    tracks: [
      {
        instrumentId: 'calebasse_water',
        steps: [2, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0],
        muted: false,
        solo: false,
        gain: 1.0,
        pan: 0
      },
      {
        instrumentId: 'balafon_casamance',
        steps: [1, 0, 2, 0, 1, 2, 1, 0, 2, 1, 0, 2],
        muted: false,
        solo: false,
        gain: 0.9,
        pan: -0.25
      },
      {
        instrumentId: 'djembe_open',
        steps: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0],
        muted: false,
        solo: false,
        gain: 0.75,
        pan: 0.15
      },
      {
        instrumentId: 'chekere_shaker',
        steps: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
        muted: false,
        solo: false,
        gain: 0.55,
        pan: 0.3
      }
    ]
  },
  {
    id: 'dub_roots_senegal',
    name: 'Dub Roots Ancestral (One-Drop 4/4)',
    tradition: 'RidiaLArt Afrofuturiste',
    signature: '4/4',
    stepCount: 16,
    bpm: 76,
    createdAt: 1710000005000,
    description: 'Dub méditatif profond : sub calebasse, frappe tranchante sur le 3e temps et écho spatial.',
    effects: {
      ...DEFAULT_EFFECTS_CONFIG,
      delay: { enabled: true, time: 0.38, feedback: 0.5, wet: 0.4 },
      reverb: { enabled: true, decay: 2.8, wet: 0.4 },
      masterVolume: 0.9
    },
    tracks: [
      {
        instrumentId: 'djembe_bass',
        steps: [2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 1.1,
        pan: 0
      },
      {
        instrumentId: 'calebasse_water',
        steps: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 0.9,
        pan: -0.1
      },
      {
        instrumentId: 'djembe_slap',
        steps: [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 1.0,
        pan: 0.15
      },
      {
        instrumentId: 'tama_talking',
        steps: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 1, 2, 0],
        muted: false,
        solo: false,
        gain: 0.85,
        pan: 0.3
      },
      {
        instrumentId: 'cloche_kenkeni',
        steps: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        muted: false,
        solo: false,
        gain: 0.6,
        pan: -0.35
      }
    ]
  }
];

/**
 * High-speed offline rendering of an entire polyrhythmic composition into a master WAV Blob.
 * Renders instruments, rhythm tracks, AND continuous endogenous soundscapes!
 */
export async function renderCompositionToWav(
  composition: RhythmComposition,
  loopCount: number = 4
): Promise<Blob> {
  const sampleRate = 44100;
  const secondsPerBeat = 60 / composition.bpm;
  const stepsPerBeat = composition.signature === '12/8' || composition.signature === '6/8' ? 3 : 4;
  const stepDuration = secondsPerBeat / stepsPerBeat;
  const oneLoopDuration = composition.stepCount * stepDuration;
  const tailDuration = Math.max(1.8, composition.effects.reverb.decay);
  const totalDuration = (oneLoopDuration * loopCount) + tailDuration;
  const totalFrames = Math.ceil(totalDuration * sampleRate);

  const offlineCtx = new OfflineAudioContext(2, totalFrames, sampleRate);

  // Set up effects chain on offline context
  const rack = buildEffectsRack(offlineCtx, composition.effects);
  rack.output.connect(offlineCtx.destination);

  // Render continuous endogenous soundscapes if present and enabled
  if (composition.soundscapes && composition.soundscapes.length > 0) {
    for (const sc of composition.soundscapes) {
      if (sc.enabled && sc.volume > 0.01) {
        playContinuousSoundscape(
          offlineCtx,
          sc.id,
          0,
          totalDuration,
          sc.volume * 0.85,
          sc.pan || 0,
          rack.input
        );
      }
    }
  }

  // Check solo tracks
  const hasSolo = composition.tracks.some(t => t.solo);

  // Render all loops
  for (let loop = 0; loop < loopCount; loop++) {
    const loopStartTime = loop * oneLoopDuration;

    for (const track of composition.tracks) {
      if (track.muted) continue;
      if (hasSolo && !track.solo) continue;

      const trackPanNode = offlineCtx.createStereoPanner();
      trackPanNode.pan.value = track.pan;

      const trackGainNode = offlineCtx.createGain();
      trackGainNode.gain.value = track.gain;

      trackGainNode.connect(trackPanNode);
      trackPanNode.connect(rack.input);

      for (let s = 0; s < composition.stepCount; s++) {
        const vel = track.steps[s] || 0;
        if (vel > 0) {
          const stepTime = loopStartTime + (s * stepDuration);
          const velMultiplier = vel === 2 ? 1.35 : 0.9;
          playAfricanInstrument(offlineCtx, track.instrumentId, stepTime, velMultiplier, trackGainNode);
        }
      }
    }
  }

  const renderedAudioBuffer = await offlineCtx.startRendering();
  return audioBufferToWavBlob(renderedAudioBuffer);
}
