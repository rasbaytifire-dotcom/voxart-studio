/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Sliders, Music, Radio, Sparkles, RefreshCw } from 'lucide-react';

interface PolyrhythmicEngineProps {
  themeMode: 'standard' | 'ridialart';
  onOpenStudio?: () => void;
}

export type RhythmPatternId = 'djembe_doundounba' | 'djembe_kuku' | 'sabar_kaolack' | 'dub_roots_senegal';

interface RhythmDefinition {
  id: RhythmPatternId;
  name: string;
  tradition: string;
  signature: '12/8' | '4/4' | '6/8';
  defaultBpm: number;
  description: string;
  // Steps: 12 or 16 steps array of instrument triggers
  steps: {
    djembeBass?: boolean;
    djembeOpen?: boolean;
    djembeSlap?: boolean;
    sabarSnap?: boolean;
    bell?: boolean;
  }[];
}

const RHYTHM_PRESETS: RhythmDefinition[] = [
  {
    id: 'djembe_doundounba',
    name: 'Djembé Doundounba (12/8)',
    tradition: 'Afrique de l’Ouest / Mandingue',
    signature: '12/8',
    defaultBpm: 104,
    description: 'Pulsation ternaire noble, basses profondes de doundoun et frappes ouvertes de djembé.',
    steps: [
      { djembeBass: true, bell: true },
      {},
      { djembeOpen: true },
      { djembeSlap: true, bell: true },
      {},
      { djembeOpen: true },
      { djembeBass: true, bell: true },
      {},
      { djembeOpen: true },
      { djembeSlap: true, bell: true },
      { djembeOpen: true },
      {}
    ]
  },
  {
    id: 'djembe_kuku',
    name: 'Djembé Kuku / Yankadi',
    tradition: 'Guinée / Mali',
    signature: '4/4',
    defaultBpm: 96,
    description: 'Rythme binaire festif d’Afrique de l’Ouest, frappes équilibrées et assise percutante.',
    steps: [
      { djembeBass: true, bell: true },
      {},
      { djembeOpen: true },
      {},
      { djembeSlap: true, bell: true },
      {},
      { djembeOpen: true },
      { djembeOpen: true },
      { djembeBass: true, bell: true },
      {},
      { djembeOpen: true },
      {},
      { djembeSlap: true, bell: true },
      { djembeOpen: true },
      {},
      { djembeSlap: true }
    ]
  },
  {
    id: 'sabar_kaolack',
    name: 'Sabar Kaolack (Sénégal)',
    tradition: 'Sénégal / Wolof',
    signature: '6/8',
    defaultBpm: 116,
    description: 'Polyrythmie wolof vive et incisive, claquements de baguette et résonance rapide.',
    steps: [
      { djembeBass: true, sabarSnap: true },
      {},
      { sabarSnap: true },
      { djembeOpen: true },
      {},
      { sabarSnap: true },
      { djembeBass: true },
      { sabarSnap: true },
      {},
      { djembeSlap: true, sabarSnap: true },
      {},
      { djembeOpen: true }
    ]
  },
  {
    id: 'dub_roots_senegal',
    name: 'Dub Roots Ancestral (One-Drop)',
    tradition: 'RidiaLArt Dub Fusion',
    signature: '4/4',
    defaultBpm: 76,
    description: 'Basse ronde sub-roots, frappe de djembé et caisse réverbérée sur le 3e temps.',
    steps: [
      { djembeBass: true },
      {},
      {},
      {},
      { bell: true },
      {},
      {},
      {},
      { djembeBass: true, djembeSlap: true },
      {},
      {},
      {},
      { bell: true },
      {},
      { djembeOpen: true },
      {}
    ]
  }
];

export const PolyrhythmicEngine: React.FC<PolyrhythmicEngineProps> = ({ themeMode, onOpenStudio }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedRhythmId, setSelectedRhythmId] = useState<RhythmPatternId>('djembe_doundounba');
  const [bpm, setBpm] = useState<number>(104);
  const [volume, setVolume] = useState<number>(0.65);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepIndexRef = useRef<number>(0);

  const currentPattern = RHYTHM_PRESETS.find(r => r.id === selectedRhythmId) || RHYTHM_PRESETS[0];

  // Initialize or get Web Audio Context
  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Acoustic synthesis of Djembé & Sabar instruments
  const triggerSound = (type: 'bass' | 'open' | 'slap' | 'sabar' | 'bell', time: number, volFactor: number) => {
    try {
      const ctx = getAudioContext();
      const masterVol = isMuted ? 0 : volume * volFactor;
      if (masterVol <= 0.001) return;

      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);

      if (type === 'bass') {
        // Djembé Bass: deep resonant membrane drop
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(55, time + 0.12);

        gainNode.gain.setValueAtTime(masterVol * 1.2, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

        osc.connect(gainNode);
        osc.start(time);
        osc.stop(time + 0.36);
      } else if (type === 'open') {
        // Djembé Open Tone: warm mid-range drum skin
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, time);
        osc.frequency.exponentialRampToValueAtTime(190, time + 0.08);

        gainNode.gain.setValueAtTime(masterVol * 0.85, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

        osc.connect(gainNode);
        osc.start(time);
        osc.stop(time + 0.23);
      } else if (type === 'slap') {
        // Djembé Slap: crisp high crack with noise transient
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(460, time);
        osc.frequency.exponentialRampToValueAtTime(280, time + 0.04);

        // White noise crack
        const bufferSize = ctx.sampleRate * 0.05;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1800, time);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(masterVol * 0.7, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(gainNode);

        gainNode.gain.setValueAtTime(masterVol * 0.9, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

        osc.connect(gainNode);
        osc.start(time);
        osc.stop(time + 0.15);
        noise.start(time);
        noise.stop(time + 0.06);
      } else if (type === 'sabar') {
        // Sabar snap: sharp stick whip with rapid pitch variation
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(520, time);
        osc.frequency.exponentialRampToValueAtTime(180, time + 0.06);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, time);

        gainNode.gain.setValueAtTime(masterVol * 0.75, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

        osc.connect(filter);
        filter.connect(gainNode);
        osc.start(time);
        osc.stop(time + 0.13);
      } else if (type === 'bell') {
        // Metallic Kenkeni or Woodblock / Cowbell timeline
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(820, time);

        gainNode.gain.setValueAtTime(masterVol * 0.45, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

        osc.connect(gainNode);
        osc.start(time);
        osc.stop(time + 0.09);
      }
    } catch {
      // Audio trigger fallback
    }
  };

  // Loop player using precise setInterval
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Step duration based on BPM and rhythm signature
    // In 12/8 (triplet feel), steps are dotted eighths; in 4/4 they are 16ths.
    const stepsInPattern = currentPattern.steps.length;
    const stepDurationMs = (60 / bpm / (currentPattern.signature === '12/8' ? 3 : 4)) * 1000;

    stepIndexRef.current = 0;

    const tick = () => {
      const idx = stepIndexRef.current % stepsInPattern;
      setCurrentStep(idx);

      const step = currentPattern.steps[idx];
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      if (step.djembeBass) triggerSound('bass', now, 1.0);
      if (step.djembeOpen) triggerSound('open', now, 0.9);
      if (step.djembeSlap) triggerSound('slap', now, 1.0);
      if (step.sabarSnap) triggerSound('sabar', now, 0.85);
      if (step.bell) triggerSound('bell', now, 0.7);

      stepIndexRef.current++;
    };

    tick();
    timerRef.current = window.setInterval(tick, stepDurationMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, bpm, selectedRhythmId, isMuted, volume]);

  const handleSelectPattern = (id: RhythmPatternId) => {
    setSelectedRhythmId(id);
    const pat = RHYTHM_PRESETS.find(p => p.id === id);
    if (pat) setBpm(pat.defaultBpm);
  };

  const togglePlay = () => {
    getAudioContext();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="bg-[#1f1307]/90 border border-[#d97706]/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-[#d97706]/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#d97706] to-[#f59e0b] flex items-center justify-center text-[#1c0f04] shadow-md font-bold">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#fbbf24] flex items-center gap-2">
              <span>Polyrythmie & Pulsations Djembé / Sabar</span>
              <span className="text-[10px] bg-[#d97706]/20 text-[#fde68a] px-2 py-0.5 rounded-full border border-[#d97706]/40 font-mono">
                Endogène
              </span>
            </h3>
            <p className="text-[11px] text-[#fcd34d]/70">
              Timelines euclidiennes et résonances traditionnelles synchronisées
            </p>
          </div>
        </div>

        {/* Global Play Toggle */}
        <button
          type="button"
          onClick={togglePlay}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md ${
            isPlaying
              ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]'
              : 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-[#1c0f04] hover:opacity-95'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" />
              <span>Arrêter le rythme</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Lancer la pulsation</span>
            </>
          )}
        </button>
      </div>

      {/* Preset Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {RHYTHM_PRESETS.map((pat) => (
          <button
            key={pat.id}
            type="button"
            onClick={() => handleSelectPattern(pat.id)}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedRhythmId === pat.id
                ? 'bg-[#2d1807] border-[#fbbf24] shadow-md'
                : 'bg-[#140c06] border-[#d97706]/30 hover:border-[#d97706]/60 text-[#d4d4d8]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold ${selectedRhythmId === pat.id ? 'text-[#fbbf24]' : 'text-[#fde68a]'}`}>
                {pat.name}
              </span>
              <span className="text-[10px] bg-[#d97706]/25 text-[#fde68a] px-1.5 py-0.5 rounded font-mono">
                {pat.signature}
              </span>
            </div>
            <p className="text-[11px] text-[#fcd34d]/60 leading-tight">
              {pat.description}
            </p>
          </button>
        ))}
      </div>

      {/* Step Sequencer Visualization (Pulsation Tracker) */}
      <div className="bg-[#140c06] p-3 rounded-xl border border-[#d97706]/30 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-[#fde68a]">
          <span className="font-semibold">Barre de pas euclidiens ({currentPattern.signature})</span>
          <span className="font-mono text-[#fbbf24]">
            Pas actif : {isPlaying ? currentStep + 1 : '-'}/{currentPattern.steps.length}
          </span>
        </div>

        <div className="grid grid-cols-12 sm:grid-cols-16 gap-1">
          {currentPattern.steps.map((st, i) => {
            const hasHit = st.djembeBass || st.djembeOpen || st.djembeSlap || st.sabarSnap || st.bell;
            const isCurrent = isPlaying && currentStep === i;

            return (
              <div
                key={i}
                className={`h-7 rounded-md flex flex-col items-center justify-center text-[9px] font-mono transition-all ${
                  isCurrent
                    ? 'bg-[#fbbf24] text-[#1c0f04] scale-110 font-bold shadow-[0_0_10px_#fbbf24]'
                    : hasHit
                    ? 'bg-[#d97706]/40 text-[#fde68a] border border-[#d97706]/60'
                    : 'bg-[#261507]/40 text-[#78350f]'
                }`}
                title={st.djembeBass ? 'Djembé Basse' : st.djembeSlap ? 'Djembé Claqué' : st.djembeOpen ? 'Djembé Tonique' : 'Silence'}
              >
                <span>{st.djembeBass ? 'B' : st.djembeSlap ? 'S' : st.djembeOpen ? 'T' : '•'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tempo & Volume Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#140c06]/80 p-3 rounded-xl border border-[#d97706]/20">
        <div>
          <div className="flex items-center justify-between text-xs text-[#fde68a] mb-1">
            <span>Cadence / Tempo :</span>
            <span className="font-mono font-bold text-[#fbbf24]">{bpm} BPM</span>
          </div>
          <input
            type="range"
            min={60}
            max={150}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="w-full accent-[#fbbf24]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-[#fde68a] mb-1">
            <span className="flex items-center gap-1">
              {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>Volume du Rythme :</span>
            </span>
            <span className="font-mono font-bold text-[#fbbf24]">{isMuted ? 'Muet' : `${Math.round(volume * 100)}%`}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-full accent-[#fbbf24]"
            />
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="text-[10px] bg-[#2d1807] hover:bg-[#3d200a] text-[#fde68a] px-2 py-1 rounded border border-[#d97706]/40"
            >
              {isMuted ? 'Activer' : 'Couper'}
            </button>
          </div>
        </div>
      </div>

      {/* Button to Open Dedicated Full African Rhythm Studio */}
      {onOpenStudio && (
        <button
          type="button"
          onClick={onOpenStudio}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#d97706] to-[#f59e0b] hover:brightness-110 text-[#1c0f04] text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95"
        >
          <Sliders className="w-4 h-4" />
          <span>Ouvrir l'Atelier de Composition Polyrythmique Complet (Instruments, Effets & Export WAV)</span>
        </button>
      )}
    </div>
  );
};
