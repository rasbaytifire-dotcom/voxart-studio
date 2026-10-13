/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type InstrumentId = 
  | 'djembe_bass'
  | 'djembe_open'
  | 'djembe_slap'
  | 'sabar_mbeng'
  | 'sabar_nder'
  | 'tama_talking'
  | 'balafon_casamance'
  | 'kora_mandingue'
  | 'flute_peulh'
  | 'riti_violin'
  | 'trompe_vent_ancestral'
  | 'calebasse_water'
  | 'cloche_kenkeni'
  | 'chekere_shaker'
  | 'coq_matin'
  | 'oiseaux_saheliens'
  | 'lion_savane'
  | 'chant_rituel_ancestral'
  | 'femme_pilon_frappe';

export type InstrumentCategory = 
  | 'Djembé' 
  | 'Sabar' 
  | 'Percussion' 
  | 'Corde' 
  | 'Vent' 
  | 'Mélodique' 
  | 'Bruitage Endogène';

export interface AfricanInstrument {
  id: InstrumentId;
  name: string;
  shortName: string;
  category: InstrumentCategory;
  tradition: string;
  color: string;
  defaultGain: number;
  defaultPan: number; // -1 to 1
  description: string;
}

export type SoundscapeId = 
  | 'foret_brousse' 
  | 'village_pilon' 
  | 'marche_sandaga' 
  | 'fleuve_pirogue' 
  | 'nuit_savane';

export interface EndogenousSoundscapeLayer {
  id: SoundscapeId;
  name: string;
  subtitle: string;
  description: string;
  icon: string;
  enabled: boolean;
  volume: number; // 0 to 1
  pan: number;    // -1 to 1
}

export interface RhythmTrack {
  instrumentId: InstrumentId;
  steps: number[]; // 0 = mute, 1 = normal, 2 = accent
  muted: boolean;
  solo: boolean;
  gain: number;
  pan: number;
}

export interface RhythmEffectsConfig {
  reverb: {
    enabled: boolean;
    decay: number; // 0.5 to 4.0 seconds
    wet: number;   // 0 to 1
  };
  delay: {
    enabled: boolean;
    time: number;  // 0.05 to 0.6 seconds
    feedback: number; // 0 to 0.8
    wet: number;   // 0 to 1
  };
  filter: {
    enabled: boolean;
    type: 'lowpass' | 'highpass';
    cutoff: number; // 100 to 12000 Hz
    resonance: number; // 0 to 10
  };
  compressor: {
    enabled: boolean;
    threshold: number; // -36 to 0 dB
    ratio: number;     // 1 to 12
  };
  masterVolume: number; // 0 to 1.2
}

export interface RhythmComposition {
  id: string;
  name: string;
  tradition: string;
  signature: '12/8' | '4/4' | '6/8' | '16-step';
  stepCount: number; // 12, 16, 24, etc.
  bpm: number;
  tracks: RhythmTrack[];
  effects: RhythmEffectsConfig;
  soundscapes?: EndogenousSoundscapeLayer[];
  audioWavData?: string; // base64 data URL if rendered
  createdAt: number;
  description?: string;
}
