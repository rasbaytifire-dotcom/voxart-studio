/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Music, Sliders, Disc, Play, Pause, Volume2, Upload, 
  Folder, Sparkles, RefreshCw, X, Headphones, Mic, 
  Layers, Plus, Check, Waves, Radio, Trash2, ArrowRight
} from 'lucide-react';
import { 
  TRADITIONAL_RHYTHM_PRESETS, 
  DEFAULT_SOUNDSCAPES, 
  renderCompositionToWav, 
  playContinuousSoundscape 
} from '../utils/africanAudioEngine';
import { audioBufferToWavBlob } from '../utils/audioExport';
import { FrequencySpectrumAnalyzer } from './FrequencySpectrumAnalyzer';
import { SoundscapeId } from '../types/rhythm';

export interface BackingTrackInfo {
  url: string;
  title: string;
  category?: string;
  icon?: string;
}

interface BackgroundMusicStudioProps {
  activeBackingTrack: BackingTrackInfo | null;
  setActiveBackingTrack: (track: BackingTrackInfo | null) => void;
  voiceVolume: number;
  setVoiceVolume: (v: number) => void;
  backingVolume: number;
  setBackingVolume: (v: number) => void;
  voicePitch: number;
  setVoicePitch: (p: number) => void;
  enableCrossfade: boolean;
  setEnableCrossfade: (v: boolean) => void;
  crossfadeDuration: number;
  setCrossfadeDuration: (d: number) => void;
  currentAudioBlob: Blob | null;
  onPreviewMix: () => void;
  isPreviewingMix: boolean;
  onMixAndRecordFinal: () => void;
  isMixingFinal: boolean;
  previewMixUrl: string | null;
  isPreviewPlaying: boolean;
  onTogglePreviewPlay: () => void;
  onStopPreview: () => void;
  library: Record<string, any>;
  onOpenRhythmStudio: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onClose: () => void;
}

export const BackgroundMusicStudio: React.FC<BackgroundMusicStudioProps> = ({
  activeBackingTrack,
  setActiveBackingTrack,
  voiceVolume,
  setVoiceVolume,
  backingVolume,
  setBackingVolume,
  voicePitch,
  setVoicePitch,
  enableCrossfade,
  setEnableCrossfade,
  crossfadeDuration,
  setCrossfadeDuration,
  currentAudioBlob,
  onPreviewMix,
  isPreviewingMix,
  onMixAndRecordFinal,
  isMixingFinal,
  previewMixUrl,
  isPreviewPlaying,
  onTogglePreviewPlay,
  onStopPreview,
  library,
  onOpenRhythmStudio,
  showToast,
  onClose
}) => {
  // Navigation tabs for selecting or composing background music
  const [activeTab, setActiveTab] = useState<'rhythms' | 'soundscapes' | 'library' | 'upload'>('rhythms');
  
  // Audio preview playback state for presets before applying
  const [previewingPresetId, setPreviewingPresetId] = useState<string | null>(null);
  const [isGeneratingWav, setIsGeneratingWav] = useState<boolean>(false);
  const [isBackingPlaying, setIsBackingPlaying] = useState<boolean>(false);

  const localBackingAudioRef = useRef<HTMLAudioElement | null>(null);
  const presetAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Sync playing status of backing audio with safe [0, 1] volume clamp
  useEffect(() => {
    if (localBackingAudioRef.current) {
      try {
        const safeVol = Math.max(0, Math.min(1, backingVolume));
        localBackingAudioRef.current.volume = safeVol;
      } catch (e) {
        console.warn("Could not set local backing volume:", e);
      }
    }
  }, [backingVolume]);

  const handleToggleBackingPlay = () => {
    if (!localBackingAudioRef.current || !activeBackingTrack) return;
    if (localBackingAudioRef.current.paused) {
      localBackingAudioRef.current.play().catch(e => console.warn("Backing play error:", e));
      setIsBackingPlaying(true);
    } else {
      localBackingAudioRef.current.pause();
      setIsBackingPlaying(false);
    }
  };

  // Instant render of traditional rhythm preset and set as backing track
  const handleApplyPresetRhythm = async (presetId: string, title: string) => {
    setIsGeneratingWav(true);
    try {
      const preset = TRADITIONAL_RHYTHM_PRESETS.find(p => p.id === presetId);
      if (!preset) return;
      
      const wavBlob = await renderCompositionToWav(preset, 4);
      const audioUrl = URL.createObjectURL(wavBlob);
      
      setActiveBackingTrack({
        url: audioUrl,
        title: `🥁 ${title}`,
        category: 'Rythme Traditionnel',
        icon: '🥁'
      });
      setIsBackingPlaying(false);
      showToast(`Fond sonore "${title}" activé avec succès !`, "success");
    } catch (err) {
      console.error("Error applying rhythm preset:", err);
      showToast("Erreur lors de la génération du fond rythmique.", "error");
    } finally {
      setIsGeneratingWav(false);
    }
  };

  // Instant procedural synthesis of continuous soundscapes
  const handleApplySoundscape = async (scId: SoundscapeId, title: string, icon = '🌿') => {
    setIsGeneratingWav(true);
    try {
      const sampleRate = 44100;
      const duration = 20; // 20-second high-fidelity loop
      const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
      
      const gainNode = offlineCtx.createGain();
      gainNode.gain.setValueAtTime(0.75, 0);
      gainNode.connect(offlineCtx.destination);

      playContinuousSoundscape(offlineCtx, scId, 0, duration, 0.7, 0, gainNode);
      
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWavBlob(renderedBuffer);
      const audioUrl = URL.createObjectURL(wavBlob);

      setActiveBackingTrack({
        url: audioUrl,
        title: `${icon} ${title}`,
        category: 'Ambiance Naturelle',
        icon
      });
      setIsBackingPlaying(false);
      showToast(`Ambiance sonore "${title}" activée !`, "success");
    } catch (err) {
      console.error("Error applying soundscape:", err);
      showToast("Erreur lors de la synthèse de l'ambiance sonore.", "error");
    } finally {
      setIsGeneratingWav(false);
    }
  };

  // Handle local user upload (MP3/WAV)
  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      showToast("Veuillez sélectionner un fichier audio valide (.mp3, .wav, .m4a).", "error");
      return;
    }

    const audioUrl = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    
    setActiveBackingTrack({
      url: audioUrl,
      title: `📁 ${cleanName}`,
      category: 'Fichier Personnel',
      icon: '📁'
    });
    setIsBackingPlaying(false);
    showToast(`Piste audio "${cleanName}" définie comme musique de fond !`, "success");
    e.target.value = '';
  };

  // Select audio from user's Library
  const handleSelectFromLibrary = (audioData: string, name: string) => {
    setActiveBackingTrack({
      url: audioData,
      title: `📚 ${name}`,
      category: 'Bibliothèque',
      icon: '📚'
    });
    setIsBackingPlaying(false);
    showToast(`Piste "${name}" chargée depuis votre bibliothèque !`, "success");
  };

  // Preview preset sound in memory
  const handlePreviewPreset = async (presetId: string) => {
    if (previewingPresetId === presetId) {
      if (presetAudioRef.current) {
        presetAudioRef.current.pause();
      }
      setPreviewingPresetId(null);
      return;
    }

    setIsGeneratingWav(true);
    try {
      const preset = TRADITIONAL_RHYTHM_PRESETS.find(p => p.id === presetId);
      if (!preset) return;

      const wavBlob = await renderCompositionToWav(preset, 2);
      const url = URL.createObjectURL(wavBlob);
      
      if (presetAudioRef.current) {
        presetAudioRef.current.src = url;
        presetAudioRef.current.play();
        setPreviewingPresetId(presetId);
      }
    } catch (err) {
      console.warn("Preset preview error:", err);
    } finally {
      setIsGeneratingWav(false);
    }
  };

  // Presets list - exact IDs matching TRADITIONAL_RHYTHM_PRESETS
  const traditionalPresets = [
    {
      id: 'aube_kora_sahel',
      name: 'Kora Mandingue Méditative',
      subtitle: 'Harpe-luth 21 cordes en résonance sacrée',
      bpm: 104,
      signature: '12/8',
      icon: '🪕',
      color: '#38bdf8',
      description: 'Arpèges cristallins et polyphonie sahélienne profonde.'
    },
    {
      id: 'sabar_kaolack',
      name: 'Sabar Kaolack',
      subtitle: 'Polyrythmie étincelante Wolof & Baguette',
      bpm: 114,
      signature: '12/8',
      icon: '🥁',
      color: '#ec4899',
      description: 'Claquement de baguette incisif typique du Mbalax et cloche Kenkeni.'
    },
    {
      id: 'balafon_casamance_fleuve',
      name: 'Balafon Solaire de Casamance',
      subtitle: 'Percussion boisée & résonance de calebasses',
      bpm: 108,
      signature: '4/4',
      icon: '🪵',
      color: '#f59e0b',
      description: 'Mélodie chaleureuse et dansante des lames de bois au soleil.'
    },
    {
      id: 'mystique_flute_peulh',
      name: 'Mystique Pastorale & Flûte Peulh',
      subtitle: 'Harmonie pastorale du Fouta & Violon Riti',
      bpm: 96,
      signature: '6/8',
      icon: '🪈',
      color: '#10b981',
      description: 'Flûte Peulh aérée, violon traditionnel Riti et cadence de mortier.'
    },
    {
      id: 'rituel_appel_ancetres',
      name: 'Djembé & Rituel Ancestral',
      subtitle: 'Frappes pleines, basse lourde et claqués',
      bpm: 92,
      signature: '4/4',
      icon: '⚡',
      color: '#ea580c',
      description: 'Rythme puissant de célébration, équilibre basse/ton/slap et appel des ancêtres.'
    },
    {
      id: 'mbalax_thieboudienne',
      name: 'Mbalax Thiéboudiène Festif',
      subtitle: 'Rythme festif populaire de Dakar',
      bpm: 118,
      signature: '12/8',
      icon: '🎉',
      color: '#f43f5e',
      description: 'Cadence dynamique et entraînante alliant tama, sabar et cloche.'
    },
    {
      id: 'dub_roots_senegal',
      name: 'Dub Roots Ancestral RidiaLArt',
      subtitle: 'Sub calebasse, one-drop & écho spatial',
      bpm: 76,
      signature: '4/4',
      icon: '🌌',
      color: '#a855f7',
      description: 'Déclamation méditative avec basse profonde et réverbération spatiale.'
    }
  ];

  const soundscapesList = [
    {
      id: 'foret_brousse' as SoundscapeId,
      name: 'Forêt Sacrée & Brousse',
      subtitle: 'Casamance & Forêt de Baobabs',
      icon: '🌳',
      color: '#22c55e',
      description: 'Brise bruissant dans les branches sacrées et éco-acoustique vivante.'
    },
    {
      id: 'village_pilon' as SoundscapeId,
      name: 'Matinée au Village',
      subtitle: 'Cadence des Pilons & Murmures de l\'Aube',
      icon: '🛖',
      color: '#d97706',
      description: 'Rythme ancestral du mil pilé au mortier en bois et réveil chaleureux.'
    },
    {
      id: 'marche_sandaga' as SoundscapeId,
      name: 'Marché Sandaga & Palabres',
      subtitle: 'Rumeur Sahélienne & Échanges',
      icon: '🧺',
      color: '#eab308',
      description: 'Effervescence chaleureuse des étals, calebasses et pas sur la terre rouge.'
    },
    {
      id: 'fleuve_pirogue' as SoundscapeId,
      name: 'Fleuve Sénégal & Pirogue',
      subtitle: 'Clapotis d’Eau & Pagaies en Bois',
      icon: '🛶',
      color: '#06b6d4',
      description: 'Ondes aquatiques douces, mouvement de pirogue au crépuscule.'
    },
    {
      id: 'nuit_savane' as SoundscapeId,
      name: 'Nuit Sahélienne & Grillons',
      subtitle: 'Harmonie Stellaire & Nocturne',
      icon: '✨',
      color: '#8b5cf6',
      description: 'Pulsation de grillons mystiques sous la voie lactée et brise fraîche.'
    }
  ];

  // Extract all audios from library projects
  const libraryAudios: { projectName: string; id: number; name: string; data: string }[] = [];
  Object.entries(library).forEach(([pName, pData]) => {
    if (pData?.audios && Array.isArray(pData.audios)) {
      pData.audios.forEach((a: any) => {
        libraryAudios.push({
          projectName: pName,
          id: a.id,
          name: a.name,
          data: a.data
        });
      });
    }
  });

  return (
    <div className="bg-[#1e1e2e]/95 backdrop-blur-md rounded-2xl border border-[#fbbf24]/40 p-4 sm:p-5 space-y-4 shadow-2xl animate-fadeIn">
      {/* Hidden audio for preset testing */}
      <audio
        ref={presetAudioRef}
        onEnded={() => setPreviewingPresetId(null)}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#45475a]/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#d97706] to-[#fbbf24] flex items-center justify-center text-[#1c0f04] shadow-md">
            <Music className="w-4 h-4 font-black" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#f9e2af] flex items-center gap-2">
              <span>Musique de Fond & Studio de Mixage</span>
              <span className="text-[10px] bg-[#fbbf24]/20 text-[#fbbf24] px-2 py-0.5 rounded-full font-mono font-normal">
                RidiaLArt Polyrythmie
              </span>
            </h3>
            <p className="text-[11px] text-[#a6adc8]">
              Choisissez, composez et fusionnez vos ambiances sonores avec votre voix
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#a6adc8] hover:text-white hover:bg-[#313244] transition-all text-xs"
          title="Fermer le panneau"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ACTIVE TRACK STATUS & CONTROLS */}
      <div className="p-3.5 rounded-xl bg-[#181825] border border-[#fbbf24]/30 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-[#a6adc8] flex items-center gap-1.5">
            <Disc className={`w-3.5 h-3.5 text-[#fbbf24] ${isBackingPlaying ? 'animate-spin' : ''}`} />
            Piste d'accompagnement active :
          </span>
          {activeBackingTrack && (
            <span className="text-[10px] bg-[#313244] text-[#a6e3a1] px-2 py-0.5 rounded-md font-mono">
              Prêt pour le mixage
            </span>
          )}
        </div>

        {activeBackingTrack ? (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#11111b] p-3 rounded-xl border border-[#fbbf24]/20">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl shrink-0">{activeBackingTrack.icon || '🥁'}</span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#f9e2af] truncate">
                  {activeBackingTrack.title}
                </div>
                <div className="text-[10px] text-[#a6adc8] truncate">
                  {activeBackingTrack.category || 'Piste audio'} • Boucle continue synchronisée
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <audio
                ref={localBackingAudioRef}
                src={activeBackingTrack.url}
                loop
                onPlay={() => setIsBackingPlaying(true)}
                onPause={() => setIsBackingPlaying(false)}
              />
              <button
                type="button"
                onClick={handleToggleBackingPlay}
                className="py-1.5 px-3 rounded-lg text-xs font-bold bg-[#d97706] text-[#1c0f04] hover:bg-[#fbbf24] transition-all flex items-center gap-1.5 shadow"
              >
                {isBackingPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Écouter</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (localBackingAudioRef.current) localBackingAudioRef.current.pause();
                  setActiveBackingTrack(null);
                  setIsBackingPlaying(false);
                  showToast("Musique de fond retirée.", "info");
                }}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-all text-xs"
                title="Retirer la musique de fond"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-3 px-2 bg-[#11111b]/60 rounded-xl border border-dashed border-[#45475a] text-xs text-[#a6adc8] space-y-1">
            <p className="font-medium text-[#cdd6f4]">Aucun fond sonore sélectionné</p>
            <p className="text-[11px] text-[#6c7086]">
              Sélectionnez ci-dessous une polyrythmie, une ambiance naturelle, un audio de votre bibliothèque ou importez votre propre musique.
            </p>
          </div>
        )}
      </div>

      {/* SELECTION TABS */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#181825] rounded-xl border border-[#313244]">
          <button
            type="button"
            onClick={() => setActiveTab('rhythms')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'rhythms'
                ? 'bg-[#d97706] text-[#1c0f04] font-bold shadow-md'
                : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]'
            }`}
          >
            <span>🥁 Polyrythmies</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('soundscapes')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'soundscapes'
                ? 'bg-[#10b981] text-[#11111b] font-bold shadow-md'
                : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]'
            }`}
          >
            <span>🌿 Ambiances</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'library'
                ? 'bg-[#89b4fa] text-[#11111b] font-bold shadow-md'
                : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Bibliothèque</span>
            {libraryAudios.length > 0 && (
              <span className="text-[10px] bg-[#11111b]/30 px-1.5 rounded-full font-bold">
                {libraryAudios.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'upload'
                ? 'bg-[#cba6f7] text-[#11111b] font-bold shadow-md'
                : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importer MP3</span>
          </button>

          {/* Quick link to African Rhythm Studio Composer */}
          <button
            type="button"
            onClick={onOpenRhythmStudio}
            className="ml-auto py-1.5 px-3 rounded-lg text-xs font-bold text-[#fbbf24] hover:bg-[#fbbf24]/20 border border-[#fbbf24]/40 flex items-center gap-1.5 transition-all"
            title="Ouvrir le studio complet pour composer un rythme sur mesure"
          >
            <span>🎹 Séquenceur Pas-à-Pas</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* TAB 1: TRADITIONAL RHYTHM PRESETS */}
        {activeTab === 'rhythms' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {traditionalPresets.map((preset) => {
              const isCurrent = activeBackingTrack?.title.includes(preset.name);
              const isPreviewing = previewingPresetId === preset.id;

              return (
                <div
                  key={preset.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 text-left ${
                    isCurrent
                      ? 'bg-[#d97706]/15 border-[#fbbf24] shadow-md ring-1 ring-[#fbbf24]'
                      : 'bg-[#181825] hover:bg-[#232338] border-[#313244]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{preset.icon}</span>
                      <div className="flex items-center gap-1 text-[10px] text-[#a6adc8] font-mono">
                        <span className="bg-[#313244] px-1.5 py-0.5 rounded">{preset.bpm} BPM</span>
                        <span className="bg-[#313244] px-1.5 py-0.5 rounded">{preset.signature}</span>
                      </div>
                    </div>
                    <h4 className="text-xs font-bold text-[#cdd6f4]">{preset.name}</h4>
                    <p className="text-[10px] text-[#a6adc8] line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1.5 border-t border-[#313244]/40">
                    <button
                      type="button"
                      disabled={isGeneratingWav}
                      onClick={() => handlePreviewPreset(preset.id)}
                      className="flex-1 py-1 px-2 rounded-lg bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] font-bold text-[11px] flex items-center justify-center gap-1 transition-all disabled:opacity-50"
                    >
                      {isPreviewing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                      <span>{isPreviewing ? 'Stop' : 'Pré-écoute'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isGeneratingWav}
                      onClick={() => handleApplyPresetRhythm(preset.id, preset.name)}
                      className={`flex-1 py-1 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all ${
                        isCurrent
                          ? 'bg-[#a6e3a1] text-[#11111b]'
                          : 'bg-[#d97706] hover:bg-[#fbbf24] text-[#1c0f04]'
                      }`}
                    >
                      {isCurrent ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      <span>{isCurrent ? 'Actif' : 'Choisir'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: ENDOGENOUS SOUNDSCAPES */}
        {activeTab === 'soundscapes' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {soundscapesList.map((sc) => {
              const isCurrent = activeBackingTrack?.title.includes(sc.name);

              return (
                <div
                  key={sc.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 text-left ${
                    isCurrent
                      ? 'bg-[#10b981]/15 border-[#10b981] shadow-md ring-1 ring-[#10b981]'
                      : 'bg-[#181825] hover:bg-[#232338] border-[#313244]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{sc.icon}</span>
                      <span className="text-[10px] bg-[#313244] text-[#a6e3a1] px-1.5 py-0.5 rounded font-mono">
                        Nature & Village
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-[#cdd6f4]">{sc.name}</h4>
                    <p className="text-[10px] text-[#a6adc8] line-clamp-2 leading-relaxed">
                      {sc.description}
                    </p>
                  </div>

                  <div className="pt-1.5 border-t border-[#313244]/40">
                    <button
                      type="button"
                      disabled={isGeneratingWav}
                      onClick={() => handleApplySoundscape(sc.id, sc.name, sc.icon)}
                      className={`w-full py-1.5 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                        isCurrent
                          ? 'bg-[#a6e3a1] text-[#11111b]'
                          : 'bg-[#10b981] hover:bg-[#34d399] text-[#11111b]'
                      }`}
                    >
                      {isCurrent ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      <span>{isCurrent ? 'Ambiance Active' : 'Activer cette ambiance'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: USER LIBRARY AUDIOS */}
        {activeTab === 'library' && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {libraryAudios.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {libraryAudios.map((item) => (
                  <div
                    key={`${item.projectName}_${item.id}`}
                    className="p-2.5 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#89b4fa]/50 transition-all flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#cdd6f4] truncate">{item.name}</div>
                      <div className="text-[10px] text-[#a6adc8] truncate">📁 Projet: {item.projectName}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectFromLibrary(item.data, item.name)}
                      className="py-1 px-2.5 rounded-lg bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] text-xs font-bold shrink-0 transition-all shadow"
                    >
                      Choisir
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-[#181825] rounded-xl text-xs text-[#a6adc8]">
                Aucun fichier audio enregistré dans la bibliothèque pour le moment.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DIRECT FILE UPLOAD */}
        {activeTab === 'upload' && (
          <div className="p-4 rounded-xl bg-[#181825] border border-dashed border-[#45475a] text-center space-y-3">
            <input
              ref={fileUploadInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a"
              onChange={handleUploadFile}
              className="hidden"
            />
            <div className="w-10 h-10 rounded-full bg-[#cba6f7]/20 text-[#cba6f7] flex items-center justify-center mx-auto">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#cdd6f4]">
                Importer un fichier audio personnel
              </h4>
              <p className="text-[11px] text-[#a6adc8]">
                Formats supportés : MP3, WAV, OGG, M4A
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileUploadInputRef.current?.click()}
              className="py-2 px-4 rounded-xl bg-[#cba6f7] hover:bg-[#f5c2e7] text-[#11111b] font-bold text-xs shadow-md transition-all inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Parcourir mes fichiers...</span>
            </button>
          </div>
        )}
      </div>

      {/* AUDIO MIXING SLIDERS (VOIX, FOND, PITCH) */}
      <div className="p-3.5 rounded-xl bg-[#181825] border border-[#45475a]/50 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-[#f9e2af]">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-[#fbbf24]" />
            Réglages de Mixage & Hauteur Vocale (Pitch)
          </span>
          <span className="text-[10px] text-[#a6adc8] font-mono">
            Temps Réel
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Voice Volume */}
          <div>
            <div className="flex justify-between text-[11px] text-[#a6adc8] mb-1">
              <span>🎙️ Volume Voix :</span>
              <span className="font-bold text-[#89b4fa] font-mono">{Math.round(voiceVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={Math.max(0, Math.min(1, voiceVolume))}
              onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
              className="w-full accent-[#89b4fa]"
            />
          </div>

          {/* Backing Track Volume */}
          <div>
            <div className="flex justify-between text-[11px] text-[#a6adc8] mb-1">
              <span>🥁 Volume Fond :</span>
              <span className="font-bold text-[#fbbf24] font-mono">{Math.round(backingVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={Math.max(0, Math.min(1, backingVolume))}
              onChange={(e) => setBackingVolume(parseFloat(e.target.value))}
              className="w-full accent-[#fbbf24]"
            />
          </div>

          {/* Voice Pitch (Hauteur de Ton) Slider */}
          <div>
            <div className="flex justify-between text-[11px] text-[#a6adc8] mb-1">
              <span>🎚️ Pitch (Hauteur) :</span>
              <span className="font-bold text-[#cba6f7] font-mono">
                {voicePitch === 1.0 ? '1.0x (Neutre)' : `${voicePitch > 1.0 ? '+' : ''}${Math.round((voicePitch - 1) * 100)}% (${voicePitch.toFixed(2)}x)`}
              </span>
            </div>
            <input
              type="range"
              min={0.70}
              max={1.30}
              step={0.02}
              value={voicePitch}
              onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
              className="w-full accent-[#cba6f7]"
            />
            {/* Quick Pitch Presets */}
            <div className="flex items-center justify-between text-[10px] text-[#a6adc8] mt-1 pt-1 border-t border-[#313244]/40">
              <button
                type="button"
                onClick={() => setVoicePitch(0.85)}
                className={`px-1.5 py-0.5 rounded hover:bg-[#313244] ${voicePitch === 0.85 ? 'text-[#cba6f7] font-bold' : ''}`}
              >
                Grave (0.85x)
              </button>
              <button
                type="button"
                onClick={() => setVoicePitch(1.0)}
                className={`px-1.5 py-0.5 rounded hover:bg-[#313244] ${voicePitch === 1.0 ? 'text-[#a6e3a1] font-bold' : ''}`}
              >
                Neutre (1.0x)
              </button>
              <button
                type="button"
                onClick={() => setVoicePitch(1.15)}
                className={`px-1.5 py-0.5 rounded hover:bg-[#313244] ${voicePitch === 1.15 ? 'text-[#cba6f7] font-bold' : ''}`}
              >
                Aiguë (1.15x)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CROSSFADE AUTOMATIQUE (TRANSITION FLUIDE VOIX / FOND SONORE) */}
      <div className="p-3.5 rounded-xl bg-[#181825] border border-[#a6e3a1]/30 hover:border-[#a6e3a1]/50 transition-all space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
              enableCrossfade ? 'bg-[#a6e3a1]/20 text-[#a6e3a1]' : 'bg-[#313244] text-[#a6adc8]'
            }`}>
              <Waves className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#cdd6f4] flex items-center gap-2">
                <span>Option Crossfade Automatique</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                  enableCrossfade 
                    ? 'bg-[#a6e3a1]/20 text-[#a6e3a1] font-semibold' 
                    : 'bg-[#313244] text-[#a6adc8]'
                }`}>
                  {enableCrossfade ? 'Actif' : 'Désactivé'}
                </span>
              </div>
              <p className="text-[10.5px] text-[#a6adc8] leading-tight">
                Transition fluide : fondu enchaîné à l'entrée et estompage progressif de la musique après la fin de la voix.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEnableCrossfade(!enableCrossfade)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              enableCrossfade ? 'bg-[#a6e3a1]' : 'bg-[#313244]'
            }`}
            title={enableCrossfade ? "Désactiver le Crossfade automatique" : "Activer le Crossfade automatique"}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#11111b] shadow-lg ring-0 transition duration-200 ease-in-out ${
                enableCrossfade ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {enableCrossfade && (
          <div className="pt-2 border-t border-[#313244]/60 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-[11px] text-[#a6adc8]">
              <span className="font-medium flex items-center gap-1.5">
                <span>Durée du fondu (Crossfade) :</span>
              </span>
              <span className="font-mono font-bold text-[#a6e3a1] bg-[#11111b] px-2 py-0.5 rounded border border-[#a6e3a1]/30">
                {crossfadeDuration.toFixed(1)} s
              </span>
            </div>

            <input
              type="range"
              min={0.3}
              max={4.0}
              step={0.1}
              value={crossfadeDuration}
              onChange={(e) => setCrossfadeDuration(parseFloat(e.target.value))}
              className="w-full accent-[#a6e3a1]"
            />

            <div className="flex items-center justify-between text-[10px] text-[#a6adc8] pt-0.5">
              <button
                type="button"
                onClick={() => setCrossfadeDuration(0.8)}
                className={`px-2 py-0.5 rounded-md hover:bg-[#313244] transition-all cursor-pointer ${
                  crossfadeDuration === 0.8 ? 'bg-[#a6e3a1]/20 text-[#a6e3a1] font-bold border border-[#a6e3a1]/40' : ''
                }`}
              >
                ⚡ Rapide (0.8s)
              </button>
              <button
                type="button"
                onClick={() => setCrossfadeDuration(1.5)}
                className={`px-2 py-0.5 rounded-md hover:bg-[#313244] transition-all cursor-pointer ${
                  crossfadeDuration === 1.5 ? 'bg-[#a6e3a1]/20 text-[#a6e3a1] font-bold border border-[#a6e3a1]/40' : ''
                }`}
              >
                🌊 Naturel (1.5s)
              </button>
              <button
                type="button"
                onClick={() => setCrossfadeDuration(2.5)}
                className={`px-2 py-0.5 rounded-md hover:bg-[#313244] transition-all cursor-pointer ${
                  crossfadeDuration === 2.5 ? 'bg-[#a6e3a1]/20 text-[#a6e3a1] font-bold border border-[#a6e3a1]/40' : ''
                }`}
              >
                ✨ Progressif (2.5s)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ANALYSEUR DE SPECTRE FRÉQUENTIEL EN TEMPS RÉEL */}
      <FrequencySpectrumAnalyzer
        isPlaying={isPreviewPlaying || isBackingPlaying}
        voiceVolume={voiceVolume}
        backingVolume={backingVolume}
        title="Analyseur de Spectre Fréquentiel (Voix vs Fond Sonore)"
      />

      {/* DUAL ACTION BUTTONS: INSTANT LIVE MIX VS FINAL MERGE TO DISK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        <button
          type="button"
          onClick={onPreviewMix}
          disabled={!currentAudioBlob}
          className="py-2.5 px-3.5 rounded-xl bg-[#3b4252] hover:bg-[#434c5e] text-[#eceff4] font-bold text-xs transition-all flex items-center justify-center gap-2 border border-[#89b4fa]/40 shadow disabled:opacity-50 cursor-pointer active:scale-95"
          title="Lance instantanément la lecture synchronisée de la voix et du fond sonore en temps réel (0ms de latence)"
        >
          <Headphones className="w-4 h-4 text-[#89b4fa]" />
          <span>⚡ Écouter le Mix Instantané</span>
        </button>

        <button
          type="button"
          onClick={onMixAndRecordFinal}
          disabled={isMixingFinal || !currentAudioBlob}
          className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-[#d97706] via-[#fbbf24] to-[#f59e0b] text-[#1c0f04] font-black text-xs hover:brightness-110 transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 shadow-lg disabled:opacity-50 cursor-pointer active:scale-95"
          title="Fusionne et enregistre le mix final avec la voix et le fond sonore"
        >
          {isMixingFinal ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Mixage & Enregistrement...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Mic className="w-4 h-4" />
              <span>🔴 Enregistrer Mix Final</span>
              {enableCrossfade && (
                <span className="text-[10px] bg-[#1c0f04]/20 px-1.5 py-0.2 rounded font-mono font-semibold">
                  Crossfade {crossfadeDuration.toFixed(1)}s
                </span>
              )}
            </div>
          )}
        </button>
      </div>

      {/* TEMPORARY PREVIEW PLAYER */}
      {previewMixUrl && (
        <div className="p-3 bg-[#11111b] rounded-xl border border-[#89b4fa]/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <div className="min-w-0">
              <span className="text-[#89b4fa] font-bold text-xs truncate block">
                Mixage temporaire en mémoire RAM
              </span>
              <span className="text-[10px] text-[#a6adc8]">
                Voix ({Math.round(voiceVolume * 100)}%) + Fond ({Math.round(backingVolume * 100)}%) • Pitch {voicePitch.toFixed(2)}x
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onTogglePreviewPlay}
              className="py-1 px-3 rounded-lg bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs transition-all shadow"
            >
              {isPreviewPlaying ? 'Pause' : 'Écouter'}
            </button>
            <button
              type="button"
              onClick={onStopPreview}
              className="p-1.5 text-red-400 hover:bg-[#313244] rounded-lg text-xs"
              title="Fermer le lecteur temporaire"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
