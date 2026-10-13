/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, Download, Folder, Sparkles, Volume2, 
  VolumeX, Sliders, Music, RefreshCw, Plus, Trash2, Check, 
  Share2, ArrowLeft, Disc, Waves, Layers, Headphones, Zap, Radio
} from 'lucide-react';
import { 
  AfricanInstrument, InstrumentId, RhythmComposition, 
  RhythmEffectsConfig, RhythmTrack 
} from '../types/rhythm';
import { 
  AFRICAN_INSTRUMENTS, DEFAULT_EFFECTS_CONFIG, 
  TRADITIONAL_RHYTHM_PRESETS, buildEffectsRack, 
  playAfricanInstrument, renderCompositionToWav 
} from '../utils/africanAudioEngine';

interface AfricanRhythmStudioProps {
  onBackToStudio?: () => void;
  onSaveToLibrary?: (audioBlob: Blob, audioDataUrl: string, title: string, composition: RhythmComposition) => void;
  onUseAsBackingTrack?: (audioBlob: Blob, audioDataUrl: string, title: string) => void;
  existingProjects?: string[];
  initialComposition?: RhythmComposition;
}

export const AfricanRhythmStudio: React.FC<AfricanRhythmStudioProps> = ({
  onBackToStudio,
  onSaveToLibrary,
  onUseAsBackingTrack,
  existingProjects = ['Mon Projet 1'],
  initialComposition
}) => {
  // Studio navigation tabs: 'music' (sequencer), 'effects' (DSP), 'export' (WAV & library)
  const [activeTab, setActiveTab] = useState<'music' | 'effects' | 'export'>('music');

  // Current active composition
  const [composition, setComposition] = useState<RhythmComposition>(() => {
    return initialComposition || JSON.parse(JSON.stringify(TRADITIONAL_RHYTHM_PRESETS[0]));
  });

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [renderedAudioUrl, setRenderedAudioUrl] = useState<string | null>(null);
  const [renderedAudioBlob, setRenderedAudioBlob] = useState<Blob | null>(null);
  const [exportLoopCount, setExportLoopCount] = useState<number>(4);
  const [exportFileName, setExportFileName] = useState<string>(composition.name);
  const [targetProject, setTargetProject] = useState<string>(existingProjects[0] || 'Projet_Rythmes');
  const [newProjectInput, setNewProjectInput] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Web Audio Context & scheduling references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const currentStepRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const masterRackRef = useRef<{ input: GainNode; output: GainNode } | null>(null);
  const trackNodesRef = useRef<Map<number, { gainNode: GainNode; panNode: StereoPannerNode }>>(new Map());

  // Tap tempo state
  const tapTimesRef = useRef<number[]>([]);

  // Canvas visualizer ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();

      // Analyser for real-time oscilloscope
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const rack = buildEffectsRack(audioCtxRef.current, composition.effects);
      rack.output.connect(analyser);
      analyser.connect(audioCtxRef.current.destination);
      masterRackRef.current = rack;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Rebuild effects rack when effects change
  useEffect(() => {
    if (audioCtxRef.current && masterRackRef.current && analyserRef.current) {
      try {
        masterRackRef.current.output.disconnect();
        const newRack = buildEffectsRack(audioCtxRef.current, composition.effects);
        newRack.output.connect(analyserRef.current);
        masterRackRef.current = newRack;

        // Reconnect all track nodes to new rack input
        trackNodesRef.current.forEach(({ panNode }) => {
          try {
            panNode.disconnect();
            panNode.connect(newRack.input);
          } catch (e) {
            // ignore
          }
        });
      } catch (e) {
        console.warn("Error updating master rack:", e);
      }
    }
  }, [composition.effects]);

  // Keep track nodes updated in real-time when volume or pan sliders change
  useEffect(() => {
    if (!audioCtxRef.current || !masterRackRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    composition.tracks.forEach((track, trackIdx) => {
      let nodeData = trackNodesRef.current.get(trackIdx);
      if (!nodeData) {
        const gainNode = ctx.createGain();
        const panNode = ctx.createStereoPanner();
        gainNode.gain.setValueAtTime(track.gain, now);
        panNode.pan.setValueAtTime(track.pan, now);
        gainNode.connect(panNode);
        if (masterRackRef.current) {
          panNode.connect(masterRackRef.current.input);
        }
        nodeData = { gainNode, panNode };
        trackNodesRef.current.set(trackIdx, nodeData);
      } else {
        nodeData.gainNode.gain.setValueAtTime(track.gain, now);
        nodeData.panNode.pan.setValueAtTime(track.pan, now);
      }
    });
  }, [composition.tracks]);

  // Visualizer loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;
    const draw = () => {
      if (!isMounted) return;
      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);

        ctx.fillStyle = '#140c06';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2.5;
        // Golden RidiaLArt gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(0.5, '#fbbf24');
        gradient.addColorStop(1, '#ea580c');
        ctx.strokeStyle = gradient;

        ctx.beginPath();
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Update export file name default when composition changes
  useEffect(() => {
    setExportFileName(`${composition.name.replace(/\s+/g, '_')}_${composition.bpm}BPM`);
  }, [composition.name, composition.bpm]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Scheduling clock calculation
  const getSecondsPerStep = (): number => {
    const secondsPerBeat = 60 / composition.bpm;
    const stepsPerBeat = composition.signature === '12/8' || composition.signature === '6/8' ? 3 : 4;
    return secondsPerBeat / stepsPerBeat;
  };

  // Schedule notes
  const scheduleStep = (stepNumber: number, time: number) => {
    const ctx = getAudioContext();
    if (!masterRackRef.current) return;

    const hasSolo = composition.tracks.some(t => t.solo);

    composition.tracks.forEach((track, trackIdx) => {
      if (track.muted) return;
      if (hasSolo && !track.solo) return;

      const vel = track.steps[stepNumber] || 0;
      if (vel > 0) {
        let nodeData = trackNodesRef.current.get(trackIdx);
        if (!nodeData) {
          const gainNode = ctx.createGain();
          const panNode = ctx.createStereoPanner();
          gainNode.gain.value = track.gain;
          panNode.pan.value = track.pan;

          gainNode.connect(panNode);
          if (masterRackRef.current) {
            panNode.connect(masterRackRef.current.input);
          }
          nodeData = { gainNode, panNode };
          trackNodesRef.current.set(trackIdx, nodeData);
        } else {
          nodeData.gainNode.gain.setValueAtTime(track.gain, time);
          nodeData.panNode.pan.setValueAtTime(track.pan, time);
        }

        const velMultiplier = vel === 2 ? 1.35 : 0.9;
        playAfricanInstrument(ctx, track.instrumentId, time, velMultiplier, nodeData.gainNode);
      }
    });
  };

  const scheduler = () => {
    const ctx = getAudioContext();
    const lookaheadSec = 0.1;
    const scheduleAheadTimeSec = 0.03;

    while (nextNoteTimeRef.current < ctx.currentTime + lookaheadSec) {
      scheduleStep(currentStepRef.current, nextNoteTimeRef.current);

      const step = currentStepRef.current;
      // Visual step update timed to audio clock
      setTimeout(() => {
        if (isPlayingRef.current) {
          setCurrentStep(step);
        }
      }, Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000));

      nextNoteTimeRef.current += getSecondsPerStep();
      currentStepRef.current = (currentStepRef.current + 1) % composition.stepCount;
    }

    if (isPlayingRef.current) {
      timerRef.current = window.setTimeout(scheduler, scheduleAheadTimeSec * 1000);
    }
  };

  const startPlayback = () => {
    const ctx = getAudioContext();
    isPlayingRef.current = true;
    setIsPlaying(true);
    currentStepRef.current = 0;
    setCurrentStep(0);
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    scheduler();
  };

  const stopPlayback = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCurrentStep(0);
  };

  // Preview an individual instrument strike (pad test)
  const previewInstrument = (instrumentId: InstrumentId, trackIdx?: number) => {
    const ctx = getAudioContext();
    if (!masterRackRef.current) return;
    const nodeData = trackIdx !== undefined ? trackNodesRef.current.get(trackIdx) : null;
    const targetGain = nodeData ? nodeData.gainNode : masterRackRef.current.input;
    playAfricanInstrument(ctx, instrumentId, ctx.currentTime, 1.1, targetGain);
  };

  // Tap tempo handler
  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current;
    taps.push(now);

    // Keep last 4 taps within 2.5 seconds
    const recentTaps = taps.filter(t => now - t < 2500).slice(-4);
    tapTimesRef.current = recentTaps;

    if (recentTaps.length >= 2) {
      let intervalsSum = 0;
      for (let i = 1; i < recentTaps.length; i++) {
        intervalsSum += recentTaps[i] - recentTaps[i - 1];
      }
      const avgIntervalMs = intervalsSum / (recentTaps.length - 1);
      const calculatedBpm = Math.round(60000 / avgIntervalMs);
      if (calculatedBpm >= 40 && calculatedBpm <= 220) {
        setComposition(prev => ({ ...prev, bpm: calculatedBpm }));
      }
    }
  };

  // Step toggle: 0 -> 1 -> 2 -> 0
  const toggleStep = (trackIdx: number, stepIdx: number) => {
    setComposition(prev => {
      const updated = { ...prev };
      const newTracks = [...updated.tracks];
      const track = { ...newTracks[trackIdx] };
      const newSteps = [...track.steps];
      const currentVal = newSteps[stepIdx] || 0;
      newSteps[stepIdx] = currentVal === 0 ? 1 : currentVal === 1 ? 2 : 0;
      track.steps = newSteps;
      newTracks[trackIdx] = track;
      updated.tracks = newTracks;
      return updated;
    });
  };

  // Load preset
  const loadPreset = (preset: RhythmComposition) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) stopPlayback();
    setComposition(JSON.parse(JSON.stringify(preset)));
  };

  // Change signature / step count
  const setStepCount = (newCount: number, signature: RhythmComposition['signature']) => {
    setComposition(prev => {
      const newTracks = prev.tracks.map(t => {
        let steps = [...t.steps];
        if (steps.length < newCount) {
          while (steps.length < newCount) steps.push(0);
        } else if (steps.length > newCount) {
          steps = steps.slice(0, newCount);
        }
        return { ...t, steps };
      });
      return {
        ...prev,
        stepCount: newCount,
        signature,
        tracks: newTracks
      };
    });
  };

  // Clear all steps
  const clearAllSteps = () => {
    setComposition(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => ({
        ...t,
        steps: new Array(prev.stepCount).fill(0)
      }))
    }));
  };

  // Generate random afrofuturist polyrhythmic groove
  const randomizePolyrhythm = () => {
    setComposition(prev => {
      const isTernary = prev.signature === '12/8' || prev.signature === '6/8';
      const newTracks = prev.tracks.map(t => {
        const steps = new Array(prev.stepCount).fill(0);
        for (let s = 0; s < prev.stepCount; s++) {
          const isDownbeat = isTernary ? (s % 3 === 0) : (s % 4 === 0);
          if (t.instrumentId.includes('bass')) {
            if (isDownbeat && Math.random() > 0.35) steps[s] = Math.random() > 0.4 ? 2 : 1;
            else if (Math.random() > 0.85) steps[s] = 1;
          } else if (t.instrumentId.includes('slap') || t.instrumentId.includes('mbeng')) {
            if (!isDownbeat && Math.random() > 0.5) steps[s] = Math.random() > 0.5 ? 2 : 1;
            else if (Math.random() > 0.75) steps[s] = 1;
          } else if (t.instrumentId.includes('cloche') || t.instrumentId.includes('chekere')) {
            steps[s] = Math.random() > 0.25 ? 1 : 0;
          } else {
            if (Math.random() > 0.6) steps[s] = Math.random() > 0.6 ? 2 : 1;
          }
        }
        return { ...t, steps };
      });
      return { ...prev, tracks: newTracks };
    });
  };

  // Add instrument track
  const addTrack = (instrumentId: InstrumentId) => {
    if (composition.tracks.some(t => t.instrumentId === instrumentId)) return;
    const inst = AFRICAN_INSTRUMENTS.find(i => i.id === instrumentId);
    if (!inst) return;

    const isTernary = composition.signature === '12/8' || composition.signature === '6/8';
    const steps = new Array(composition.stepCount).fill(0);
    for (let i = 0; i < composition.stepCount; i++) {
      if (isTernary ? (i % 3 === 0) : (i % 4 === 0)) {
        steps[i] = 1;
      }
    }

    setComposition(prev => ({
      ...prev,
      tracks: [
        ...prev.tracks,
        {
          instrumentId,
          steps,
          muted: false,
          solo: false,
          gain: inst.defaultGain,
          pan: inst.defaultPan
        }
      ]
    }));
  };

  // Remove track
  const removeTrack = (trackIdx: number) => {
    setComposition(prev => ({
      ...prev,
      tracks: prev.tracks.filter((_, idx) => idx !== trackIdx)
    }));
  };

  // Render high quality WAV master
  const handleExportWav = async () => {
    setIsExporting(true);
    setSaveSuccessMsg(null);
    try {
      const blob = await renderCompositionToWav(composition, exportLoopCount);
      const url = URL.createObjectURL(blob);
      setRenderedAudioBlob(blob);
      setRenderedAudioUrl(url);

      // Trigger automatic direct browser download
      const filename = `${exportFileName || 'Rythme_Africain'}.wav`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setSaveSuccessMsg(`Fichier ${filename} généré en qualité Master (44.1kHz WAV) et téléchargé !`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Erreur lors de la génération audio WAV.");
    } finally {
      setIsExporting(false);
    }
  };

  // Save to App Library
  const handleSaveToVoxArtLibrary = async () => {
    setIsExporting(true);
    try {
      let blob = renderedAudioBlob;
      let url = renderedAudioUrl;
      if (!blob || !url) {
        blob = await renderCompositionToWav(composition, exportLoopCount);
        url = URL.createObjectURL(blob);
        setRenderedAudioBlob(blob);
        setRenderedAudioUrl(url);
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        const finalProject = targetProject === '__NEW__' ? (newProjectInput.trim() || 'Nouveau_Projet') : targetProject;
        
        if (onSaveToLibrary) {
          onSaveToLibrary(blob!, base64Data, exportFileName || composition.name, composition);
        }
        setSaveSuccessMsg(`Rythme enregistré avec succès dans la Bibliothèque VoxArt sous "${exportFileName}" !`);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Library save error:", err);
      alert("Erreur lors de l'enregistrement en bibliothèque.");
    } finally {
      setIsExporting(false);
    }
  };

  // Use as background accompaniment in VoxStudio
  const handleSendToStudioBacking = async () => {
    setIsExporting(true);
    try {
      let blob = renderedAudioBlob;
      let url = renderedAudioUrl;
      if (!blob || !url) {
        blob = await renderCompositionToWav(composition, 8); // 8 loops for background
        url = URL.createObjectURL(blob);
        setRenderedAudioBlob(blob);
        setRenderedAudioUrl(url);
      }

      if (onUseAsBackingTrack) {
        onUseAsBackingTrack(blob, url, exportFileName || composition.name);
      }
      setSaveSuccessMsg("Rythme transmis avec succès au Studio Voix comme boucle d'accompagnement !");
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-[#140c06] text-[#fef3c7] rounded-3xl border-2 border-[#fbbf24]/30 shadow-2xl overflow-hidden flex flex-col space-y-4 p-4 sm:p-6 transition-all animate-fadeIn">
      
      {/* Top Header & Navigation Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#fbbf24]/20 pb-4">
        <div className="flex items-center gap-3">
          {onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="p-2 rounded-xl bg-[#2b1708] border border-[#fbbf24]/40 text-[#fbbf24] hover:bg-[#3d200a] transition-all"
              title="Retourner au Studio Vocal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-[#fbbf24] flex items-center gap-2">
                <Disc className="w-5 h-5 text-[#f59e0b] animate-spin" style={{ animationDuration: isPlaying ? '3s' : '12s' }} />
                Studio Polyrythmique RidiaLArt
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/40">
                Endogène
              </span>
            </div>
            <p className="text-xs text-[#fde68a]/70">
              Composition, instruments sénégalais & africains, traitement d'effets DSP et export WAV Master
            </p>
          </div>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex items-center bg-[#241307] p-1 rounded-2xl border border-[#fbbf24]/30 shrink-0">
          <button
            onClick={() => setActiveTab('music')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'music'
                ? 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-[#1c0f04] shadow-md'
                : 'text-[#fde68a]/70 hover:text-[#fde68a]'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>1. Musique</span>
          </button>
          <button
            onClick={() => setActiveTab('effects')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'effects'
                ? 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-[#1c0f04] shadow-md'
                : 'text-[#fde68a]/70 hover:text-[#fde68a]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>2. Effets & DSP</span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'export'
                ? 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-[#1c0f04] shadow-md'
                : 'text-[#fde68a]/70 hover:text-[#fde68a]'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>3. Export & Biblio</span>
          </button>
        </div>
      </div>

      {/* Transport Control & Real-time Console Bar */}
      <div className="bg-[#241307]/90 p-3.5 rounded-2xl border border-[#fbbf24]/20 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        {/* Playback Button & Step Counter */}
        <div className="flex items-center gap-3">
          <button
            onClick={isPlaying ? stopPlayback : startPlayback}
            className={`px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition-all transform active:scale-95 ${
              isPlaying
                ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]'
                : 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#1c0f04] hover:brightness-110'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>Arrêter</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Jouer la Boucle</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#140c06] border border-[#fbbf24]/30 font-mono text-xs">
            <span className="text-[#fde68a]/60">PAS :</span>
            <span className="text-[#fbbf24] font-bold text-sm tabular-nums">
              {String(currentStep + 1).padStart(2, '0')} / {composition.stepCount}
            </span>
            <span className={`w-2.5 h-2.5 rounded-full transition-all ${
              isPlaying 
                ? (currentStep % 3 === 0 ? 'bg-[#ea580c] shadow-[0_0_8px_#ea580c]' : 'bg-[#fbbf24]') 
                : 'bg-[#523013]'
            }`} />
          </div>
        </div>

        {/* BPM & Signature Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[#140c06] px-3 py-1.5 rounded-xl border border-[#fbbf24]/30">
            <span className="text-xs font-bold text-[#fde68a]/70">BPM :</span>
            <input
              type="number"
              min="40"
              max="220"
              value={composition.bpm}
              onChange={(e) => setComposition(prev => ({ ...prev, bpm: Math.max(40, Math.min(220, parseInt(e.target.value) || 100)) }))}
              className="w-14 bg-transparent font-mono text-[#fbbf24] font-bold text-sm focus:outline-none"
            />
            <input
              type="range"
              min="40"
              max="220"
              value={composition.bpm}
              onChange={(e) => setComposition(prev => ({ ...prev, bpm: parseInt(e.target.value) }))}
              className="w-20 accent-[#fbbf24]"
            />
            <button
              onClick={handleTapTempo}
              className="px-2 py-0.5 bg-[#2b1708] hover:bg-[#3d200a] text-[#fbbf24] text-[10px] font-bold rounded border border-[#fbbf24]/40"
              title="Cliquez en rythme pour ajuster le tempo"
            >
              TAP
            </button>
          </div>

          {/* Metric Selector */}
          <div className="flex items-center bg-[#140c06] p-1 rounded-xl border border-[#fbbf24]/30 text-xs">
            <button
              onClick={() => setStepCount(12, '12/8')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                composition.signature === '12/8' && composition.stepCount === 12
                  ? 'bg-[#fbbf24] text-[#1c0f04]'
                  : 'text-[#fde68a]/70 hover:text-white'
              }`}
              title="12 pas ternaire - Mbalax, Sabar, Doundounba"
            >
              12 pas (12/8 Wolof)
            </button>
            <button
              onClick={() => setStepCount(16, '4/4')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                composition.signature === '4/4' && composition.stepCount === 16
                  ? 'bg-[#fbbf24] text-[#1c0f04]'
                  : 'text-[#fde68a]/70 hover:text-white'
              }`}
              title="16 pas binaire - Kuku, Dub Roots, Afrobeat"
            >
              16 pas (4/4 Binaire)
            </button>
          </div>
        </div>

        {/* Action utility buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={randomizePolyrhythm}
            className="px-2.5 py-1.5 rounded-xl bg-[#2b1708] border border-[#fbbf24]/40 hover:bg-[#3d200a] text-xs font-semibold text-[#fbbf24] flex items-center gap-1.5 transition-all"
            title="Générer une syncope polyrythmique aléatoire"
          >
            <Zap className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>Aléatoire</span>
          </button>
          <button
            onClick={clearAllSteps}
            className="px-2.5 py-1.5 rounded-xl bg-[#2b1708] border border-[#fbbf24]/40 hover:bg-[#3d200a] text-xs font-semibold text-[#f87171] flex items-center gap-1.5 transition-all"
            title="Effacer toutes les frappes de la grille"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vider</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: MUSIQUE (STEP SEQUENCER & PRESETS) */}
      {activeTab === 'music' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Traditional Presets Carousel */}
          <div className="bg-[#241307]/70 p-3 rounded-2xl border border-[#fbbf24]/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#fbbf24]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#fbbf24]" />
                <span>Partitions & Boucles Traditionnelles Pré-configurées :</span>
              </span>
              <span className="text-[10px] text-[#fde68a]/60 font-mono">1-Clic pour charger</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {TRADITIONAL_RHYTHM_PRESETS.map((preset) => {
                const isSelected = composition.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => loadPreset(preset)}
                    className={`p-2 rounded-xl text-left border transition-all text-xs flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#d97706]/50 to-[#b45309]/50 border-[#fbbf24] shadow-md shadow-[#fbbf24]/10'
                        : 'bg-[#140c06] border-[#fbbf24]/20 hover:border-[#fbbf24]/60 text-[#fef3c7]'
                    }`}
                  >
                    <div className="font-bold text-[#fbbf24] text-[11px] truncate leading-tight">
                      {preset.name}
                    </div>
                    <div className="text-[9px] text-[#fde68a]/60 truncate mt-1">
                      {preset.tradition}
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-[#fbbf24] font-mono mt-1 pt-1 border-t border-[#fbbf24]/10">
                      <span>{preset.signature}</span>
                      <span>{preset.bpm} BPM</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Matrix Step Sequencer Grid */}
          <div className="bg-[#241307]/80 p-3 sm:p-4 rounded-2xl border border-[#fbbf24]/20 space-y-3 shadow-xl overflow-x-auto">
            <div className="flex items-center justify-between min-w-[700px] pb-2 border-b border-[#fbbf24]/20">
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4 text-[#fbbf24]" />
                <span className="text-xs font-bold text-[#fbbf24] uppercase tracking-wider">
                  Matrice Polyrythmique ({composition.tracks.length} Pistes)
                </span>
              </div>
              <div className="text-[10px] text-[#fde68a]/70 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#fbbf24]/30 border border-[#fbbf24] inline-block" /> Frappe normale
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#ea580c] border border-[#f59e0b] inline-block" /> Accentuation forte
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#140c06] border border-[#523013] inline-block" /> Silence
                </span>
              </div>
            </div>

            {/* Steps Timeline Header Bar */}
            <div className="flex items-center min-w-[700px] text-[10px] font-mono text-[#fde68a]/60">
              <div className="w-56 shrink-0 font-bold text-left px-2">Instruments & Réglages</div>
              <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${composition.stepCount}, minmax(0, 1fr))` }}>
                {Array.from({ length: composition.stepCount }).map((_, s) => {
                  const isCurrent = isPlaying && currentStep === s;
                  const isBeat = composition.signature === '12/8' ? (s % 3 === 0) : (s % 4 === 0);
                  return (
                    <div
                      key={s}
                      className={`text-center py-1 rounded transition-all font-bold ${
                        isCurrent
                          ? 'bg-[#fbbf24] text-[#1c0f04] shadow-md shadow-[#fbbf24]/30 scale-105'
                          : isBeat
                          ? 'bg-[#3d200a] text-[#fbbf24]'
                          : 'bg-[#140c06] text-[#fde68a]/40'
                      }`}
                    >
                      {s + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Instrument Track Rows */}
            <div className="space-y-2 min-w-[700px]">
              {composition.tracks.map((track, trackIdx) => {
                const inst = AFRICAN_INSTRUMENTS.find(i => i.id === track.instrumentId) || AFRICAN_INSTRUMENTS[0];
                return (
                  <div
                    key={track.instrumentId + '_' + trackIdx}
                    className={`flex items-center p-2 rounded-xl border transition-all ${
                      track.muted
                        ? 'bg-[#140c06]/60 border-[#523013]/50 opacity-60'
                        : track.solo
                        ? 'bg-[#3b1d09] border-[#fbbf24]'
                        : 'bg-[#1a0f07] border-[#fbbf24]/15 hover:border-[#fbbf24]/40'
                    }`}
                  >
                    {/* Left Track Controls */}
                    <div className="w-56 shrink-0 pr-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => previewInstrument(track.instrumentId)}
                          className="font-bold text-xs truncate text-left hover:text-[#fbbf24] transition-all flex items-center gap-1.5"
                          title="Cliquer pour écouter la frappe acoustique"
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: inst.color }} />
                          <span className="truncate">{inst.name}</span>
                        </button>
                        <button
                          onClick={() => removeTrack(trackIdx)}
                          className="p-1 text-[#f87171] hover:text-white rounded hover:bg-[#ef4444]/20 transition-all"
                          title="Supprimer cette piste"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Solo, Mute, Gain, Pan row */}
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          onClick={() => {
                            setComposition(prev => {
                              const updatedTracks = [...prev.tracks];
                              updatedTracks[trackIdx] = { ...updatedTracks[trackIdx], muted: !track.muted };
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            track.muted ? 'bg-[#ef4444] text-white' : 'bg-[#2b1708] text-[#fde68a]/70 hover:text-white'
                          }`}
                          title="Couper le son de cette piste"
                        >
                          M
                        </button>
                        <button
                          onClick={() => {
                            setComposition(prev => {
                              const updatedTracks = [...prev.tracks];
                              updatedTracks[trackIdx] = { ...updatedTracks[trackIdx], solo: !track.solo };
                              return { ...prev, tracks: updatedTracks };
                            });
                          }}
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            track.solo ? 'bg-[#fbbf24] text-[#1c0f04]' : 'bg-[#2b1708] text-[#fde68a]/70 hover:text-white'
                          }`}
                          title="Solo pour cette piste"
                        >
                          S
                        </button>

                        {/* Volume slider */}
                        <div className="flex items-center gap-1 flex-1">
                          <Volume2 className="w-3 h-3 text-[#fde68a]/50" />
                          <input
                            type="range"
                            min="0"
                            max="1.2"
                            step="0.05"
                            value={track.gain}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setComposition(prev => {
                                const updatedTracks = [...prev.tracks];
                                updatedTracks[trackIdx] = { ...updatedTracks[trackIdx], gain: val };
                                return { ...prev, tracks: updatedTracks };
                              });
                            }}
                            className="w-16 accent-[#fbbf24]"
                            title={`Volume : ${Math.round(track.gain * 100)}%`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Step buttons grid */}
                    <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${composition.stepCount}, minmax(0, 1fr))` }}>
                      {Array.from({ length: composition.stepCount }).map((_, s) => {
                        const val = track.steps[s] || 0;
                        const isCurrent = isPlaying && currentStep === s;
                        const isBeat = composition.signature === '12/8' ? (s % 3 === 0) : (s % 4 === 0);

                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleStep(trackIdx, s)}
                            className={`h-9 rounded-lg border flex items-center justify-center transition-all transform active:scale-90 ${
                              val === 2
                                ? 'bg-gradient-to-br from-[#ea580c] to-[#f59e0b] border-[#fbbf24] shadow-md shadow-[#ea580c]/30 text-white font-black text-xs'
                                : val === 1
                                ? 'bg-[#fbbf24]/30 border-[#fbbf24] text-[#fbbf24] font-bold text-xs'
                                : isBeat
                                ? 'bg-[#211107] border-[#fbbf24]/15 hover:border-[#fbbf24]/40'
                                : 'bg-[#140c06] border-[#523013]/30 hover:border-[#fbbf24]/30'
                            } ${isCurrent ? 'ring-2 ring-white ring-offset-1 ring-offset-[#140c06]' : ''}`}
                            title={`Pas ${s + 1} : ${val === 2 ? 'Accent Fort' : val === 1 ? 'Actif' : 'Muet'}`}
                          >
                            {val === 2 ? '•' : val === 1 ? '·' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Instrument Dropdown */}
            <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#fde68a]/70">Ajouter un instrument :</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addTrack(e.target.value as InstrumentId);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="bg-[#140c06] border border-[#fbbf24]/30 rounded-xl px-3 py-1.5 text-xs text-[#fef3c7] focus:outline-none focus:border-[#fbbf24]"
                >
                  <option value="" disabled>+ Choisir un instrument africain...</option>
                  {AFRICAN_INSTRUMENTS.filter(inst => !composition.tracks.some(t => t.instrumentId === inst.id)).map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-[11px] text-[#fde68a]/60">
                Rythme actuel : <strong className="text-[#fbbf24]">{composition.name}</strong> ({composition.tradition})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: EFFETS SONORES (DSP & ACOUSTIQUE) */}
      {activeTab === 'effects' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Dynamic Oscilloscope Canvas */}
          <div className="bg-[#140c06] p-3 rounded-2xl border border-[#fbbf24]/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#fbbf24]">
              <span className="flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-[#fbbf24]" />
                <span>Oscilloscope Spectro-Dynamique (Master Bus) :</span>
              </span>
              <span className="text-[10px] text-[#fde68a]/60 font-mono">
                {isPlaying ? 'Pulsation active en temps réel' : 'Prêt'}
              </span>
            </div>
            <div className="w-full h-24 bg-[#140c06] rounded-xl overflow-hidden border border-[#fbbf24]/20 flex items-center justify-center">
              <canvas ref={canvasRef} width={680} height={96} className="w-full h-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reverb Calebasse */}
            <div className="bg-[#241307]/80 p-4 rounded-2xl border border-[#fbbf24]/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-[#f59e0b]" />
                  <span className="font-bold text-xs text-[#fbbf24]">Réverbération Calebasse / Salle Africaine</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={composition.effects.reverb.enabled}
                    onChange={(e) => setComposition(prev => ({
                      ...prev,
                      effects: {
                        ...prev.effects,
                        reverb: { ...prev.effects.reverb, enabled: e.target.checked }
                      }
                    }))}
                    className="accent-[#fbbf24] w-4 h-4"
                  />
                  <span className={composition.effects.reverb.enabled ? 'text-[#fbbf24] font-bold' : 'text-[#fde68a]/50'}>
                    {composition.effects.reverb.enabled ? 'Actif' : 'Bypass'}
                  </span>
                </label>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-[#fde68a]/70 mb-1">
                    <span>Temps de déclin (Decay) :</span>
                    <span className="font-mono text-[#fbbf24]">{composition.effects.reverb.decay.toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="4.0"
                    step="0.1"
                    disabled={!composition.effects.reverb.enabled}
                    value={composition.effects.reverb.decay}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setComposition(prev => ({
                        ...prev,
                        effects: { ...prev.effects, reverb: { ...prev.effects.reverb, decay: val } }
                      }));
                    }}
                    className="w-full accent-[#fbbf24]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#fde68a]/70 mb-1">
                    <span>Mixage Espace (Wet) :</span>
                    <span className="font-mono text-[#fbbf24]">{Math.round(composition.effects.reverb.wet * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.02"
                    disabled={!composition.effects.reverb.enabled}
                    value={composition.effects.reverb.wet}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setComposition(prev => ({
                        ...prev,
                        effects: { ...prev.effects, reverb: { ...prev.effects.reverb, wet: val } }
                      }));
                    }}
                    className="w-full accent-[#fbbf24]"
                  />
                </div>
              </div>
            </div>

            {/* Tape Delay Dub Roots */}
            <div className="bg-[#241307]/80 p-4 rounded-2xl border border-[#fbbf24]/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#06b6d4]" />
                  <span className="font-bold text-xs text-[#fbbf24]">Écho Spatial Dub Roots (Tape Delay)</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={composition.effects.delay.enabled}
                    onChange={(e) => setComposition(prev => ({
                      ...prev,
                      effects: {
                        ...prev.effects,
                        delay: { ...prev.effects.delay, enabled: e.target.checked }
                      }
                    }))}
                    className="accent-[#fbbf24] w-4 h-4"
                  />
                  <span className={composition.effects.delay.enabled ? 'text-[#fbbf24] font-bold' : 'text-[#fde68a]/50'}>
                    {composition.effects.delay.enabled ? 'Actif' : 'Bypass'}
                  </span>
                </label>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-[#fde68a]/70 mb-1">
                    <span>Temps de délai :</span>
                    <span className="font-mono text-[#fbbf24]">{Math.round(composition.effects.delay.time * 1000)} ms</span>
                  </div>
                  <input
                    type="range"
                    min="0.08"
                    max="0.6"
                    step="0.02"
                    disabled={!composition.effects.delay.enabled}
                    value={composition.effects.delay.time}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setComposition(prev => ({
                        ...prev,
                        effects: { ...prev.effects, delay: { ...prev.effects.delay, time: val } }
                      }));
                    }}
                    className="w-full accent-[#fbbf24]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-[#fde68a]/70 mb-1">
                    <span>Répétitions (Feedback) :</span>
                    <span className="font-mono text-[#fbbf24]">{Math.round(composition.effects.delay.feedback * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.75"
                    step="0.05"
                    disabled={!composition.effects.delay.enabled}
                    value={composition.effects.delay.feedback}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setComposition(prev => ({
                        ...prev,
                        effects: { ...prev.effects, delay: { ...prev.effects.delay, feedback: val } }
                      }));
                    }}
                    className="w-full accent-[#fbbf24]"
                  />
                </div>
              </div>
            </div>

            {/* Chaleur Analogique & Filtre */}
            <div className="bg-[#241307]/80 p-4 rounded-2xl border border-[#fbbf24]/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#ea580c]" />
                  <span className="font-bold text-xs text-[#fbbf24]">Filtre Chaleur Organique</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={composition.effects.filter.enabled}
                    onChange={(e) => setComposition(prev => ({
                      ...prev,
                      effects: {
                        ...prev.effects,
                        filter: { ...prev.effects.filter, enabled: e.target.checked }
                      }
                    }))}
                    className="accent-[#fbbf24] w-4 h-4"
                  />
                  <span className={composition.effects.filter.enabled ? 'text-[#fbbf24] font-bold' : 'text-[#fde68a]/50'}>
                    {composition.effects.filter.enabled ? 'Actif' : 'Bypass'}
                  </span>
                </label>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-[#fde68a]/70 mb-1">
                    <span>Fréquence de coupure (Cutoff) :</span>
                    <span className="font-mono text-[#fbbf24]">{composition.effects.filter.cutoff} Hz</span>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="12000"
                    step="100"
                    disabled={!composition.effects.filter.enabled}
                    value={composition.effects.filter.cutoff}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setComposition(prev => ({
                        ...prev,
                        effects: { ...prev.effects, filter: { ...prev.effects.filter, cutoff: val } }
                      }));
                    }}
                    className="w-full accent-[#fbbf24]"
                  />
                </div>
              </div>
            </div>

            {/* Compresseur & Punch Master */}
            <div className="bg-[#241307]/80 p-4 rounded-2xl border border-[#fbbf24]/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#fbbf24]" />
                  <span className="font-bold text-xs text-[#fbbf24]">Compresseur Dynamique (Punch Master)</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={composition.effects.compressor.enabled}
                    onChange={(e) => setComposition(prev => ({
                      ...prev,
                      effects: {
                        ...prev.effects,
                        compressor: { ...prev.effects.compressor, enabled: e.target.checked }
                      }
                    }))}
                    className="accent-[#fbbf24] w-4 h-4"
                  />
                  <span className={composition.effects.compressor.enabled ? 'text-[#fbbf24] font-bold' : 'text-[#fde68a]/50'}>
                    {composition.effects.compressor.enabled ? 'Actif' : 'Bypass'}
                  </span>
                </label>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-[#fde68a]/70 mb-1">
                    <span>Seuil de compression (Threshold) :</span>
                    <span className="font-mono text-[#fbbf24]">{composition.effects.compressor.threshold} dB</span>
                  </div>
                  <input
                    type="range"
                    min="-36"
                    max="0"
                    step="1"
                    disabled={!composition.effects.compressor.enabled}
                    value={composition.effects.compressor.threshold}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setComposition(prev => ({
                        ...prev,
                        effects: { ...prev.effects, compressor: { ...prev.effects.compressor, threshold: val } }
                      }));
                    }}
                    className="w-full accent-[#fbbf24]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: EXPORT MASTER WAV & BIBLIOTHÈQUE */}
      {activeTab === 'export' && (
        <div className="space-y-4 animate-fadeIn">
          {saveSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-[#064e3b]/80 border border-[#10b981] text-[#a7f3d0] text-xs flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 text-[#34d399] shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Export Audio File (WAV) */}
            <div className="bg-[#241307]/80 p-4 rounded-2xl border border-[#fbbf24]/30 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-[#fbbf24] font-bold text-sm">
                <Download className="w-5 h-5 text-[#f59e0b]" />
                <span>1. Exporter en Fichier Audio Réel (WAV Master)</span>
              </div>
              <p className="text-xs text-[#fde68a]/70 leading-relaxed">
                Génération en quelques millisecondes via <code>OfflineAudioContext</code>. Format PCM 16-bit 44.1kHz stéréo haute fidélité, compatible avec tout DAW de production (FL Studio, Ableton, Logic, Premiere).
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#fde68a]/80 mb-1">
                  Nom du fichier à exporter :
                </label>
                <input
                  type="text"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#140c06] border border-[#fbbf24]/30 text-[#fef3c7] font-mono text-xs focus:outline-none focus:border-[#fbbf24]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#fde68a]/80 mb-1">
                  Nombre de boucles consécutives :
                </label>
                <select
                  value={exportLoopCount}
                  onChange={(e) => setExportLoopCount(parseInt(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-[#140c06] border border-[#fbbf24]/30 text-[#fef3c7] text-xs focus:outline-none focus:border-[#fbbf24]"
                >
                  <option value={2}>2 Boucles (~10 secondes - Échantillon court)</option>
                  <option value={4}>4 Boucles (~20 secondes - Standard production)</option>
                  <option value={8}>8 Boucles (~40 secondes - Beat complet / Morceau)</option>
                  <option value={16}>16 Boucles (~80 secondes - Longue transe)</option>
                </select>
              </div>

              <button
                onClick={handleExportWav}
                disabled={isExporting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#1c0f04] font-black text-sm shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Rendu Master en cours...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>⬇️ Télécharger le fichier WAV Master</span>
                  </>
                )}
              </button>

              {renderedAudioUrl && (
                <div className="pt-2 border-t border-[#fbbf24]/20 space-y-1">
                  <span className="text-[11px] text-[#fde68a]/70">Lecteur de vérification du fichier rendu :</span>
                  <audio controls src={renderedAudioUrl} className="w-full accent-[#fbbf24]" />
                </div>
              )}
            </div>

            {/* Box 2: Enregistrer dans la Bibliothèque VoxArt & Utilisation en Production */}
            <div className="bg-[#241307]/80 p-4 rounded-2xl border border-[#fbbf24]/30 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-[#fbbf24] font-bold text-sm">
                <Folder className="w-5 h-5 text-[#f59e0b]" />
                <span>2. Sauvegarder dans la Bibliothèque & Production</span>
              </div>
              <p className="text-xs text-[#fde68a]/70 leading-relaxed">
                Enregistre à la fois le fichier audio et la partition complète dans votre bibliothèque de projets pour réutilisation et modification continue.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#fde68a]/80 mb-1">
                  Projet de destination dans la bibliothèque :
                </label>
                <select
                  value={targetProject}
                  onChange={(e) => setTargetProject(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#140c06] border border-[#fbbf24]/30 text-[#fef3c7] text-xs focus:outline-none focus:border-[#fbbf24]"
                >
                  {existingProjects.map(proj => (
                    <option key={proj} value={proj}>{proj}</option>
                  ))}
                  <option value="__NEW__">+ Nouveau projet de rythmes...</option>
                </select>
              </div>

              {targetProject === '__NEW__' && (
                <input
                  type="text"
                  placeholder="Nom du nouveau projet..."
                  value={newProjectInput}
                  onChange={(e) => setNewProjectInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#140c06] border border-[#fbbf24]/30 text-[#fef3c7] text-xs focus:outline-none focus:border-[#fbbf24]"
                />
              )}

              <button
                onClick={handleSaveToVoxArtLibrary}
                disabled={isExporting}
                className="w-full py-2.5 rounded-xl bg-[#2b1708] border border-[#fbbf24] text-[#fbbf24] font-bold text-xs hover:bg-[#3d200a] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Folder className="w-4 h-4" />
                <span>💾 Enregistrer dans la Bibliothèque VoxArt</span>
              </button>

              <div className="pt-2 border-t border-[#fbbf24]/20 space-y-2">
                <span className="text-xs font-bold text-[#fbbf24] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
                  <span>Utilisation directe en production vocale :</span>
                </span>
                <button
                  onClick={handleSendToStudioBacking}
                  disabled={isExporting}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#d97706] text-white font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                >
                  <Disc className="w-4 h-4" />
                  <span>🎙️ Injecter comme boucle de fond dans VoxStudio</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
