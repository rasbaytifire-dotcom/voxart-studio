/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Play, Pause, Download, Trash2, Sparkles, Volume2, 
  BookOpen, Users, Clock, Settings2, Sliders, Check, RefreshCw, 
  Music, Radio, Headphones, FileText, Bookmark, Info, ArrowRight, Settings, Scissors, AlertTriangle, Cpu, Timer, Package, Share2, Upload, Edit3, Folder, Copy,
  Layers, ListOrdered, PlayCircle, PauseCircle, Square, Plus, FileUp, AlertCircle, CheckCircle2, X, Disc, Save, Bot, Waves, Film
} from 'lucide-react';
import JSZip from 'jszip';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ThemeModeSelector, StudioThemeMode } from './components/ThemeModeSelector';
import { PlasticSynesthesiaCanvas } from './components/PlasticSynesthesiaCanvas';
import { PolyrhythmicEngine } from './components/PolyrhythmicEngine';
import { AfricanRhythmStudio } from './components/AfricanRhythmStudio';
import { AIAgentChat } from './components/AIAgentChat';
import { RhythmComposition } from './types/rhythm';
import studioLogo from './assets/images/voxart_logo_1791875178885.jpg';
import { db, ensureAuth } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { audioBufferToWavBlob } from './utils/audioExport';
import { KnowledgeBaseManager } from './components/KnowledgeBaseManager';
import { UnifiedStudioWorkspace } from './components/UnifiedStudioWorkspace';
import { LibraryManager } from './components/LibraryManager';
import { BackgroundMusicStudio, BackingTrackInfo } from './components/BackgroundMusicStudio';
import { TranscriptionStudio } from './components/TranscriptionStudio';
import { 
  TRADITIONAL_RHYTHM_PRESETS, 
  DEFAULT_SOUNDSCAPES, 
  renderCompositionToWav, 
  playContinuousSoundscape 
} from './utils/africanAudioEngine';
import { cleanTextForSpeech } from './utils/textCleaner';
import { copyTextToClipboard } from './utils/clipboard';
import { useApiAuth, authFetch, apiAuthStore } from './services/apiAuth';

interface SynthesisPresetConfig {
  domain: string;
  language: string;
  style: string;
  gender: string;
  voiceName: string;
  voicePitch: number;
  voiceVolume: number;
  backingVolume: number;
  enableCrossfade?: boolean;
  crossfadeDuration?: number;
  model: string;
  defaultBackingTrackId?: string;
  savedAt?: string;
}

const getStoredDefaultPreset = (): SynthesisPresetConfig | null => {
  try {
    const raw = localStorage.getItem('voxart_default_preset');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

interface SavedAudioItem {
  id: number;
  name: string;
  data: string;
}

interface SavedTextItem {
  id: number;
  name: string;
  content: string;
}

interface SavedVideoItem {
  id: number;
  name: string;
  data: string;
}

interface ProjectData {
  audios: SavedAudioItem[];
  texts: SavedTextItem[];
  videos?: SavedVideoItem[];
  category?: string;
  folderPath?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface BatchQueueItem {
  id: string;
  name: string;
  text: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  audioBlob?: Blob;
  audioUrl?: string;
  errorMsg?: string;
}

export interface SentimentAnalysisResult {
  sentiment: string;
  moodEmoji: string;
  explanation: string;
  suggestedDomain: string;
  suggestedStyleLabel: string;
  suggestedStyleVal: string;
  speechPaceTip: string;
}

const PRESET_VOICES = [
  { id: 'Kore', name: 'Kore (Femme mélodieuse)', gender: 'Femme', desc: 'Warm, articulate, balanced' },
  { id: 'Puck', name: 'Puck (Homme dynamique)', gender: 'Homme', desc: 'Enthusiastic, energetic, bright' },
  { id: 'Charon', name: 'Charon (Homme grave & profond)', gender: 'Homme', desc: 'Deep, resonant, authoritative' },
  { id: 'Fenrir', name: 'Fenrir (Homme direct)', gender: 'Homme', desc: 'Crisp, professional, direct' },
  { id: 'Zephyr', name: 'Zephyr (Femme douce)', gender: 'Femme', desc: 'Soft, calming, conversational' },
];

const stylesMap: Record<string, { label: string; val: string }[]> = {
  art: [
    { label: "Poétique & Rythmé (Synesthésique)", val: "prosodie artistique et musicale, variations de rythme, pauses expressives, grande chaleur humaine et phrasé vibrant" },
    { label: "Conte Traditionnel / Griot", val: "interprétation de conteur traditionnel, voix vivante, imagée, chaleureuse, habitée par l'oralité et le souffle" },
    { label: "Slam & Performance Urbaine", val: "déclamation scandée, percutante, pleine d'énergie, de nuances et d'émotion brute" }
  ],
  cinema: [
    { label: "Voix Off Documentaire / Court-métrage", val: "voix de cinéma immersive, texturée, grave, posée et chargée d'émotion narrative" },
    { label: "Dramatique & Intense", val: "tension dramatique palpable, intonation profonde, mystérieuse et captivante" }
  ],
  education: [
    { label: "Narratif & Pédagogique", val: "voix claire, bienveillante, chaleureuse et très expressive" }
  ],
  marketing: [
    { label: "Pub & Podcast Dynamique", val: "ton enthousiaste, accrocheur, moderne, vivant et percutant" },
    { label: "Corporate Élégant", val: "voix posée, professionnelle, inspirante et convaincante" }
  ],
  journalism: [
    { label: "Reportage & Récit", val: "ton journalistique vivant, incarné, sérieux mais doté d'une vraie présence humaine" }
  ],
  general: [
    { label: "Naturel & Expressif", val: "voix naturelle, humaine, chaleureuse et équilibrée" }
  ],
  ridialart: [
    { label: "Taasu & Scansion Oratoire", val: "déclamation oratoire scandée dans la tradition du Taasu sénégalais, tempo percutant, verve poétique, assonances rythmées et souffle habité" },
    { label: "Griot & Épopée Ancestrale", val: "voix de griot gardien des récits sacrés, louanges solennelles, voix texturée, habitée par l'oralité et les généalogies" },
    { label: "Synesthésie Plastique RidiaLArt", val: "prosodie artistique et synesthésique reliant le verbe à la matière, variations de dynamique, résonance de calebasse et de djembé" },
    { label: "Dub Roots & Poésie Mystique", val: "déclamation méditative, phrasé profond et posé, présence chaleureuse imprégnée d'écho spatial et de spiritualité" },
    { label: "Conte sous l'Arbre à Palabres", val: "narration vivante et captivante, chuchotements initiatiques, envolées dramatiques et silences signifiants" }
  ]
};

function formatTimeDisplay(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
}

function generateSRT(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
  let srtContent = '';
  let currentTime = 0;

  sentences.forEach((sentence, index) => {
    const trimmed = sentence.trim();
    if (!trimmed) return;
    
    const wordCount = trimmed.split(/\s+/).length;
    const duration = Math.max(2, wordCount * 0.35); 
    
    const startTime = currentTime;
    const endTime = currentTime + duration;

    srtContent += `${index + 1}\n`;
    srtContent += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
    srtContent += `${trimmed}\n\n`;

    currentTime = endTime;
  });

  return srtContent;
}

function formatSRTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'rhythm_studio' | 'library' | 'knowledge_base' | 'settings'>('home');
  const [studioComposition, setStudioComposition] = useState<RhythmComposition | undefined>(undefined);
  const [activeBackingTrack, setActiveBackingTrack] = useState<BackingTrackInfo | null>(null);
  const [isBackingTrackPlaying, setIsBackingTrackPlaying] = useState<boolean>(false);
  const backingAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Studio Theme Modality: 'standard' (Universal Pro Studio) vs 'ridialart' (Afrofuturisme Endogène & Synesthésie Plastique)
  const [themeMode, setThemeMode] = useState<StudioThemeMode>(() => {
    return (localStorage.getItem('ridialart_studio_theme') as StudioThemeMode) || 'ridialart';
  });
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);

  const handleSelectThemeMode = (mode: StudioThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem('ridialart_studio_theme', mode);
    if (mode === 'ridialart') {
      if (domain !== 'ridialart' && domain !== 'art') {
        setDomain('ridialart');
        setStyle(stylesMap.ridialart[0].val);
      }
      showToast("Mode RidiaLArt Vision activé : Synesthésie plastique & Polyrythmies Djembé/Sabar déployées.", "info");
    } else {
      if (domain === 'ridialart') {
        setDomain('general');
        setStyle(stylesMap.general[0].val);
      }
      showToast("Mode Standard Pro activé : Studio audio universel prêt.", "info");
    }
  };

  // Default synthesis preset management
  const initialPresetRef = useRef<SynthesisPresetConfig | null>(getStoredDefaultPreset());
  const [hasCustomDefaultPreset, setHasCustomDefaultPreset] = useState<boolean>(() => !!getStoredDefaultPreset());
  const [defaultPresetInfo, setDefaultPresetInfo] = useState<string | null>(() => getStoredDefaultPreset()?.savedAt || null);

  // Settings State - loaded from saved default preset or factory defaults
  const [domain, setDomain] = useState(() => initialPresetRef.current?.domain || 'art');
  const [language, setLanguage] = useState(() => initialPresetRef.current?.language || 'Français');
  const [style, setStyle] = useState(() => initialPresetRef.current?.style || (stylesMap[initialPresetRef.current?.domain || 'art'] || stylesMap.art)[0].val);
  const [gender, setGender] = useState(() => initialPresetRef.current?.gender || 'voix masculine grave, profonde et résonnante (homme)');
  const [voiceName, setVoiceName] = useState(() => initialPresetRef.current?.voiceName || 'Kore');
  const [model, setModel] = useState(() => initialPresetRef.current?.model || 'gemini-3.8-flash-lite-tts');
  const { apiKey, setApiKey, isValidKey, backendStatus } = useApiAuth();
  const [isLiveMixPlaying, setIsLiveMixPlaying] = useState<boolean>(false);

  // Home State & 30s Auto-save
  const [text, setText] = useState<string>(() => {
    return localStorage.getItem('voxart_autosave_text') || '';
  });
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string | null>(() => {
    return localStorage.getItem('voxart_autosave_time') || null;
  });
  const [showMixer, setShowMixer] = useState<boolean>(false);
  const [saveTitle, setSaveTitle] = useState('Piste_01');
  const [library, setLibrary] = useState<Record<string, ProjectData>>({});
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState('');
  const [libNewProjectName, setLibNewProjectName] = useState('');

  // Initialisation et proposition clé API si non encore configurée
  useEffect(() => {
    const currentKey = apiAuthStore.getKey();
    if (!currentKey && !backendStatus.hasServerEnvKey) {
      setDialog({
        isOpen: true,
        title: "Configuration de la Clé API Gemini",
        message: "Pour accéder aux fonctionnalités avancées d'analyse et d'agent vocal, veuillez saisir votre clé API Gemini (gratuite sur aistudio.google.com).",
        type: 'prompt',
        confirmText: "Enregistrer",
        onConfirm: (val) => {
          if (val && typeof val === 'string' && val.trim()) {
            const cleanKey = val.trim();
            setApiKey(cleanKey);
            showToast("✓ Clé API enregistrée et synchronisée !", "success");
          }
        }
      });
    }
  }, [backendStatus.hasServerEnvKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (text) {
        localStorage.setItem('voxart_autosave_text', text);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        localStorage.setItem('voxart_autosave_time', timeStr);
        setLastAutoSaveTime(timeStr);
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [text]);

  // Sauvegarde préventive de sécurité avant déchargement de page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (text) {
        localStorage.setItem('voxart_autosave_text', text);
        localStorage.setItem('voxart_autosave_time', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [text]);
  
  // Audio & Trimmer State
  const [currentAudioBlob, setCurrentAudioBlob] = useState<Blob | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [fadeInDuration, setFadeInDuration] = useState<number>(0.1);
  const [fadeOutDuration, setFadeOutDuration] = useState<number>(0.2);
  const [voiceVolume, setVoiceVolume] = useState<number>(() => {
    const v = initialPresetRef.current?.voiceVolume;
    return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 1.0;
  });
  const [backingVolume, setBackingVolume] = useState<number>(() => {
    const v = initialPresetRef.current?.backingVolume;
    return typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0.55;
  });
  const [voicePitch, setVoicePitch] = useState<number>(() => {
    const v = initialPresetRef.current?.voicePitch;
    return typeof v === 'number' ? Math.max(0.7, Math.min(1.3, v)) : 1.0;
  });
  const [enableCrossfade, setEnableCrossfade] = useState<boolean>(() => {
    const v = initialPresetRef.current?.enableCrossfade;
    return typeof v === 'boolean' ? v : true;
  });
  const [crossfadeDuration, setCrossfadeDuration] = useState<number>(() => {
    const d = initialPresetRef.current?.crossfadeDuration;
    return typeof d === 'number' ? Math.max(0.3, Math.min(4.0, d)) : 1.5;
  });
  const [isMixingFinal, setIsMixingFinal] = useState<boolean>(false);

  // Save current synthesis settings as user default preset for future app launches
  const handleSaveDefaultPreset = () => {
    const timeStr = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    const preset: SynthesisPresetConfig = {
      domain,
      language,
      style,
      gender,
      voiceName,
      voicePitch,
      voiceVolume,
      backingVolume,
      enableCrossfade,
      crossfadeDuration,
      model,
      defaultBackingTrackId: activeBackingTrack ? activeBackingTrack.title : undefined,
      savedAt: timeStr
    };
    try {
      localStorage.setItem('voxart_default_preset', JSON.stringify(preset));
      setHasCustomDefaultPreset(true);
      setDefaultPresetInfo(timeStr);
      showToast("💾 Préréglage de synthèse enregistré par défaut à chaque ouverture !", "success");
    } catch (e) {
      console.warn("Storage error saving preset:", e);
      showToast("Erreur lors de la sauvegarde du préréglage local.", "error");
    }
  };

  // Restore factory audio synthesis defaults
  const handleResetDefaultPreset = () => {
    localStorage.removeItem('voxart_default_preset');
    setHasCustomDefaultPreset(false);
    setDefaultPresetInfo(null);
    setDomain('art');
    setLanguage('Français');
    setStyle(stylesMap.art[0].val);
    setGender('voix masculine grave, profonde et résonnante (homme)');
    setVoiceName('Kore');
    setModel('gemini-3.8-flash-lite-tts');
    setVoicePitch(1.0);
    setVoiceVolume(1.0);
    setBackingVolume(0.55);
    setEnableCrossfade(true);
    setCrossfadeDuration(1.5);
    showToast("Paramètres d'usine réinitialisés avec succès.", "info");
  };

  useEffect(() => {
    if (audioRef.current) {
      try {
        const safeVol = Math.max(0, Math.min(1, voiceVolume));
        audioRef.current.volume = safeVol;
      } catch (e) {
        console.warn("Could not set voice volume:", e);
      }
    }
  }, [voiceVolume]);

  useEffect(() => {
    if (backingAudioRef.current) {
      try {
        const safeVol = Math.max(0, Math.min(1, backingVolume));
        backingAudioRef.current.volume = safeVol;
      } catch (e) {
        console.warn("Could not set backing volume:", e);
      }
    }
  }, [backingVolume]);

  // Real-time pitch control on the generated speech audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = voicePitch;
      try {
        (audioRef.current as any).preservesPitch = false;
        (audioRef.current as any).mozPreservesPitch = false;
        (audioRef.current as any).webkitPreservesPitch = false;
      } catch (e) {
        // ignore
      }
    }
  }, [voicePitch]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [showSaveSection, setShowSaveSection] = useState(false);
  const [copiedScriptId, setCopiedScriptId] = useState<number | string | null>(null);
  const [activeVideoModal, setActiveVideoModal] = useState<{ url: string; title: string } | null>(null);
  const [isApplyingQuickBacking, setIsApplyingQuickBacking] = useState<boolean>(false);
  const backingInputRef = useRef<HTMLInputElement | null>(null);

  // Quick selection and instant generation of background music and soundscapes directly from text editor
  const handleQuickSelectPreset = async (presetId: string) => {
    if (presetId === '__NONE__') {
      if (backingAudioRef.current) backingAudioRef.current.pause();
      setActiveBackingTrack(null);
      setIsBackingTrackPlaying(false);
      showToast("Fond sonore d'accompagnement désactivé.", "info");
      return;
    }
    if (presetId === '__COMPOSE__') {
      setCurrentView('rhythm_studio');
      return;
    }
    if (presetId === '__STUDIO__') {
      setShowMixer(true);
      return;
    }
    if (presetId === '__UPLOAD__') {
      backingInputRef.current?.click();
      return;
    }

    setIsApplyingQuickBacking(true);
    try {
      // 1. Check traditional African rhythm presets
      const preset = TRADITIONAL_RHYTHM_PRESETS.find(p => p.id === presetId);
      if (preset) {
        showToast(`Génération du rythme "${preset.name}" en cours...`, "info");
        const wavBlob = await renderCompositionToWav(preset, 4);
        const url = URL.createObjectURL(wavBlob);
        setActiveBackingTrack({
          url,
          title: `🥁 ${preset.name}`,
          category: 'Rythme Traditionnel',
          icon: '🥁'
        });
        setIsBackingTrackPlaying(false);
        showToast(`Fond rythmique "${preset.name}" activé avec succès !`, "success");
        return;
      }

      // 2. Check endogenous soundscapes
      const sc = DEFAULT_SOUNDSCAPES.find(s => s.id === presetId);
      if (sc) {
        showToast(`Synthèse de l'ambiance "${sc.name}" en cours...`, "info");
        const sampleRate = 44100;
        const duration = 20;
        const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
        const gainNode = offlineCtx.createGain();
        gainNode.gain.setValueAtTime(0.75, 0);
        gainNode.connect(offlineCtx.destination);
        playContinuousSoundscape(offlineCtx, sc.id, 0, duration, 0.7, 0, gainNode);
        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = audioBufferToWavBlob(renderedBuffer);
        const url = URL.createObjectURL(wavBlob);
        setActiveBackingTrack({
          url,
          title: `${sc.icon} ${sc.name}`,
          category: 'Ambiance Naturelle',
          icon: sc.icon
        });
        setIsBackingTrackPlaying(false);
        showToast(`Ambiance naturelle "${sc.name}" activée !`, "success");
        return;
      }
    } catch (err) {
      console.error("Error setting quick backing track:", err);
      showToast("Erreur lors de la génération du fond sonore.", "error");
    } finally {
      setIsApplyingQuickBacking(false);
    }
  };

  const handleVideoUpload = (proj: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updated = { ...library };
      if (!updated[proj].videos) updated[proj].videos = [];
      updated[proj].videos.push({
        id: Date.now(),
        name: file.name.replace(/\.[^/.]+$/, ""),
        data: base64
      });
      saveLibraryToStorage(updated);
      showToast(`Vidéo "${file.name}" importée dans le projet "${proj}" !`, "success");
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('audio/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setActiveBackingTrack({
          url: base64,
          title: file.name.replace(/\.[^/.]+$/, "")
        });
        setShowMixer(true);
        showToast(`Audio "${file.name}" importé comme fond sonore !`, "success");
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = (event.target?.result as string) || '';
        setText(content);
        localStorage.setItem('voxart_autosave_text', content);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        localStorage.setItem('voxart_autosave_time', timeStr);
        setLastAutoSaveTime(timeStr);
        showToast(`Fichier texte "${file.name}" importé avec succès !`, "success");
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Preview Mix State (in-memory temporary rendering without disk write)
  const [isPreviewingMix, setIsPreviewingMix] = useState<boolean>(false);
  const [previewMixUrl, setPreviewMixUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);

  // Batch & Workspace State
  const [homeMode, setHomeMode] = useState<'single' | 'batch' | 'workspace' | 'transcription' | 'video_dubbing'>('single');
  const [preloadedVideoFile, setPreloadedVideoFile] = useState<File | null>(null);
  const homeVideoInputRef = useRef<HTMLInputElement | null>(null);
  const [batchRawText, setBatchRawText] = useState('');
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [batchTargetProject, setBatchTargetProject] = useState('Projet_Audiobook_Lots');
  const [batchPrefix, setBatchPrefix] = useState('Clip');
  const [batchDelimiter, setBatchDelimiter] = useState<'paragraphs' | 'lines' | 'custom'>('paragraphs');
  const [batchCustomDelimiter, setBatchCustomDelimiter] = useState('---');
  const [batchIsRunning, setBatchIsRunning] = useState(false);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState<number>(-1);
  const [batchDelayCountdown, setBatchDelayCountdown] = useState<number>(0);
  const [batchSequentialPlayingIndex, setBatchSequentialPlayingIndex] = useState<number | null>(null);
  const [batchCompressMp3, setBatchCompressMp3] = useState<boolean>(true);

  // Toast Notification System
  interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
  }
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Safe Dialog Modal System (replaces window.prompt & window.confirm for iframe compliance)
  interface DialogConfig {
    isOpen: boolean;
    type: 'prompt' | 'confirm';
    title: string;
    message?: string;
    defaultValue?: string;
    confirmText?: string;
    onConfirm: (val: string) => void;
  }
  const [dialog, setDialog] = useState<DialogConfig | null>(null);
  const [dialogInputVal, setDialogInputVal] = useState('');

  const openPromptDialog = (title: string, defaultValue: string, onConfirm: (val: string) => void) => {
    setDialogInputVal(defaultValue);
    setDialog({
      isOpen: true,
      type: 'prompt',
      title,
      defaultValue,
      confirmText: 'Valider',
      onConfirm
    });
  };

  const openConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setDialog({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      confirmText: 'Confirmer',
      onConfirm: () => onConfirm()
    });
  };

  // Sentiment Analysis State & Expressiveness Optimizer
  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);
  const [sentimentResult, setSentimentResult] = useState<SentimentAnalysisResult | null>(null);
  const [autoApplySentimentStyle, setAutoApplySentimentStyle] = useState<boolean>(() => {
    return localStorage.getItem('voxart_auto_sentiment') === 'true';
  });
  const [appliedSentimentTimestamp, setAppliedSentimentTimestamp] = useState<number | null>(null);

  const batchFileInputRef = useRef<HTMLInputElement | null>(null);
  const batchAbortRef = useRef<boolean>(false);
  const batchAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const sentimentDebounceRef = useRef<number | null>(null);

  // Fallback heuristic sentiment analyzer if offline or network unavailable
  const analyzeSentimentLocal = (content: string): SentimentAnalysisResult => {
    const lower = content.toLowerCase();

    // 0. RidiaLArt & Endogenous Afrofuturism / Taasu / Griot / Djembé keywords
    const ridialartKeywords = ['taasu', 'griot', 'sabar', 'djembe', 'djembé', 'kora', 'balafon', 'ancêtre', 'ancêtres', 'oralité', 'initiatique', 'palabre', 'dub', 'roots', 'afrofuturism', 'afrofuturisme', 'synesthésie', 'senegal', 'sénégal', 'wolof', 'calebasse', 'ngéwél'];
    // 1. Poetry / Art keywords
    const artKeywords = ['poème', 'poésie', 'étoile', 'cœur', 'âme', 'beauté', 'lumière', 'harmonie', 'vers', 'rime', 'chant', 'sens', 'vibrant', 'souffle', 'légende', 'contes'];
    // 2. Cinema / Dramatic keywords
    const dramaKeywords = ['mystère', 'nuit', 'ombre', 'peur', 'sombre', 'tragédie', 'destin', 'guerre', 'silence', 'abîme', 'angoisse', 'drame', 'tension', 'mort', 'danger'];
    // 3. Marketing / Promo keywords
    const promoKeywords = ['nouveau', 'offre', 'découvrez', 'promo', 'incroyable', 'cliquez', 'achetez', 'gratuit', 'exceptionnel', 'profitez', 'solution', 'croissance', 'business', 'exclusif', 'lancement'];
    // 4. Education / Pedagogic keywords
    const eduKeywords = ['apprendre', 'leçon', 'comprendre', 'cours', 'méthode', 'étapes', 'explication', 'pourquoi', 'comment', 'définition', 'découverte', 'science', 'histoire', 'concept'];
    // 5. Journalism / News keywords
    const newsKeywords = ['enquête', 'selon', 'rapport', 'gouvernement', 'témoignage', 'faits', 'actualité', 'direct', 'source', 'déclaration', 'société', 'événement', 'journaliste'];

    const countMatches = (list: string[]) => list.reduce((acc, k) => acc + (lower.includes(k) ? 1 : 0), 0);

    const ridialartScore = countMatches(ridialartKeywords);
    const artScore = countMatches(artKeywords);
    const dramaScore = countMatches(dramaKeywords);
    const promoScore = countMatches(promoKeywords);
    const eduScore = countMatches(eduKeywords);
    const newsScore = countMatches(newsKeywords);

    const maxScore = Math.max(ridialartScore, artScore, dramaScore, promoScore, eduScore, newsScore);

    if (maxScore === 0) {
      return {
        sentiment: "Naturel & Équilibré",
        moodEmoji: "🎙️",
        explanation: "Ton sobre et fluide, idéal pour une restitution claire et agréable.",
        suggestedDomain: "general",
        suggestedStyleLabel: stylesMap.general[0].label,
        suggestedStyleVal: stylesMap.general[0].val,
        speechPaceTip: "Débit naturel et régulier"
      };
    }

    if (ridialartScore === maxScore) {
      return {
        sentiment: "Oralité Sacrée & Griot",
        moodEmoji: "🥁",
        explanation: "Texte d'oralité vivante ou poésie scandée : une prosodie habitée et polyrythmique sublime le verbe.",
        suggestedDomain: "ridialart",
        suggestedStyleLabel: stylesMap.ridialart[0].label,
        suggestedStyleVal: stylesMap.ridialart[0].val,
        speechPaceTip: "Scansion oratoire et silences habités"
      };
    }

    if (artScore === maxScore) {
      return {
        sentiment: "Poétique & Émotionnel",
        moodEmoji: "✨",
        explanation: "Texte évocateur et littéraire : une prosodie musicale et sensible sublime le lyrisme.",
        suggestedDomain: "art",
        suggestedStyleLabel: stylesMap.art[0].label,
        suggestedStyleVal: stylesMap.art[0].val,
        speechPaceTip: "Prosodie artistique et pauses expressives"
      };
    }

    if (dramaScore === maxScore) {
      return {
        sentiment: "Dramatique & Intense",
        moodEmoji: "🎭",
        explanation: "Texte à forte tension narrative : une voix grave et captivante amplifie le mystère.",
        suggestedDomain: "cinema",
        suggestedStyleLabel: stylesMap.cinema[1].label,
        suggestedStyleVal: stylesMap.cinema[1].val,
        speechPaceTip: "Prosodie lente, intonation profonde et suspendue"
      };
    }

    if (promoScore === maxScore) {
      return {
        sentiment: "Dynamique & Promotionnel",
        moodEmoji: "🔥",
        explanation: "Message percutant et persuasif : un phrasé moderne et entraînant capte l'attention.",
        suggestedDomain: "marketing",
        suggestedStyleLabel: stylesMap.marketing[0].label,
        suggestedStyleVal: stylesMap.marketing[0].val,
        speechPaceTip: "Rythme vif et accrocheur"
      };
    }

    if (eduScore === maxScore) {
      return {
        sentiment: "Pédagogique & Bienveillant",
        moodEmoji: "📖",
        explanation: "Contenu explicatif : une voix claire et posée facilite l'assimilation et la compréhension.",
        suggestedDomain: "education",
        suggestedStyleLabel: stylesMap.education[0].label,
        suggestedStyleVal: stylesMap.education[0].val,
        speechPaceTip: "Débit posé et articulation soignée"
      };
    }

    return {
      sentiment: "Informatif & Récit",
      moodEmoji: "📰",
      explanation: "Structure factuelle : une voix de reportage vivante donne de la crédibilité au propos.",
      suggestedDomain: "journalism",
      suggestedStyleLabel: stylesMap.journalism[0].label,
      suggestedStyleVal: stylesMap.journalism[0].val,
      speechPaceTip: "Rythme journalistique fluide et incarné"
    };
  };

  const runSentimentAnalysis = async (inputText: string, forced = false) => {
    const trimmed = inputText.trim();
    if (!trimmed || trimmed.length < 12) {
      setSentimentResult(null);
      return;
    }

    setIsAnalyzingSentiment(true);
    const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();
    try {
      const res = await authFetch('/api/sentiment-analysis', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: trimmed, apiKey: effectiveKey })
      }, effectiveKey);

      if (!res.ok) {
        throw new Error(`API response status ${res.status}`);
      }

      const data: SentimentAnalysisResult = await res.json();
      if (data && data.suggestedStyleVal) {
        setSentimentResult(data);
        if (autoApplySentimentStyle || forced) {
          applySentimentSuggestion(data);
        }
      } else {
        throw new Error('Invalid JSON format from AI');
      }
    } catch (err) {
      console.warn("Using offline sentiment heuristic fallback:", err);
      const fallback = analyzeSentimentLocal(trimmed);
      setSentimentResult(fallback);
      if (autoApplySentimentStyle || forced) {
        applySentimentSuggestion(fallback);
      }
    } finally {
      setIsAnalyzingSentiment(false);
    }
  };

  const applySentimentSuggestion = (res: SentimentAnalysisResult) => {
    if (res.suggestedDomain && stylesMap[res.suggestedDomain]) {
      setDomain(res.suggestedDomain);
    }
    if (res.suggestedStyleVal) {
      setStyle(res.suggestedStyleVal);
    }
    setAppliedSentimentTimestamp(Date.now());
    setTimeout(() => {
      setAppliedSentimentTimestamp(null);
    }, 2800);
  };

  // Real-time debounced trigger for sentiment analysis on text changes
  useEffect(() => {
    if (sentimentDebounceRef.current) {
      clearTimeout(sentimentDebounceRef.current);
    }

    if (text.trim().length >= 15) {
      sentimentDebounceRef.current = window.setTimeout(() => {
        runSentimentAnalysis(text);
      }, 700);
    } else {
      setSentimentResult(null);
    }

    return () => {
      if (sentimentDebounceRef.current) {
        clearTimeout(sentimentDebounceRef.current);
      }
    };
  }, [text]);

  const handleToggleAutoApplySentiment = () => {
    const nextVal = !autoApplySentimentStyle;
    setAutoApplySentimentStyle(nextVal);
    localStorage.setItem('voxart_auto_sentiment', String(nextVal));
    if (nextVal && sentimentResult) {
      applySentimentSuggestion(sentimentResult);
    }
  };

  const handleTransferFromAgent = (rawText: string) => {
    if (!rawText || !rawText.trim()) return;

    // Detect explicit tone tag like [Ton: ...] or [Style: ...]
    const toneMatch = rawText.match(/\[(?:Ton|Style)\s*:\s*([^\]]+)\]/i);
    let cleanedText = rawText;
    let explicitTone: string | null = null;

    if (toneMatch) {
      explicitTone = toneMatch[1].trim();
      cleanedText = cleanedText.replace(/\[(?:Ton|Style)\s*:\s*[^\]]+\]/gi, '').trim();
    }

    // Clean surrounding markdown backticks if present
    cleanedText = cleanedText.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, '').trim();

    // Set text in state & localStorage
    setText(cleanedText);
    localStorage.setItem('voxart_autosave_text', cleanedText);

    // Switch view directly to Studio Vocal (single mode)
    setHomeMode('single');

    // Match explicit tone with stylesMap
    let toneApplied = false;
    if (explicitTone) {
      const lower = explicitTone.toLowerCase();
      for (const [dom, styles] of Object.entries(stylesMap)) {
        const found = styles.find(s => s.label.toLowerCase().includes(lower) || lower.includes(s.label.toLowerCase()));
        if (found) {
          setDomain(dom);
          setStyle(found.val);
          toneApplied = true;
          showToast(`Texte collé dans le Studio Vocal ! Ton sélectionné : "${found.label}"`, "success");
          break;
        }
      }
    }

    // If no explicit tone was matched, trigger intelligent sentiment & style analysis
    if (!toneApplied) {
      runSentimentAnalysis(cleanedText, true);
      showToast("Texte collé dans le Studio Vocal avec adaptation automatique du ton !", "success");
    }

    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  useEffect(() => {
    const loadedLib = JSON.parse(localStorage.getItem('voxart_library') || '{}');
    setLibrary(loadedLib);

    // Sync from Firebase Cloud Firestore
    ensureAuth().then(async () => {
      try {
        const docRef = doc(db, 'vox_library', 'main_library');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const cloudData = docSnap.data().library as Record<string, ProjectData>;
          if (cloudData && Object.keys(cloudData).length > 0) {
            setLibrary(cloudData);
            localStorage.setItem('voxart_library', JSON.stringify(cloudData));
          }
        }
      } catch (e) {
        console.warn("Cloud sync load error:", e);
      }
    });
  }, []);

  useEffect(() => {
    if (retryCountdown > 0) {
      retryTimerRef.current = window.setTimeout(() => {
        setRetryCountdown(retryCountdown - 1);
      }, 1000);
    } else if (retryCountdown === 0 && isQuotaError && text) {
      handlePreview();
    }
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [retryCountdown, isQuotaError]);

  const cancelQuotaRetry = () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setIsQuotaError(false);
    setRetryCountdown(0);
    setStatusMsg("File d'attente automatique interrompue.");
    showToast("File d'attente automatique interrompue.", "info");
  };

  const saveLibraryToStorage = async (lib: Record<string, ProjectData>) => {
    setLibrary(lib);
    try {
      localStorage.setItem('voxart_library', JSON.stringify(lib));
    } catch (e: any) {
      console.warn("Storage quota exceeded:", e);
      showToast("Stockage local saturé. Sauvegarde cloud Firebase active.", "info");
    }

    // Sync to Firebase Cloud Firestore
    try {
      await ensureAuth();
      const docRef = doc(db, 'vox_library', 'main_library');
      await setDoc(docRef, { library: lib, updatedAt: new Date().toISOString() });
    } catch (e) {
      console.warn("Cloud sync save error:", e);
    }
  };

  const handleDomainChange = (newDomain: string) => {
    setDomain(newDomain);
    const available = stylesMap[newDomain] || stylesMap.art;
    setStyle(available[0].val);
  };

  const fetchWithExponentialBackoff = async (url: string, options: RequestInit, maxRetries = 3, explicitKey?: string): Promise<Response> => {
    let delay = 2000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await authFetch(url, options, explicitKey);
        if (response.status === 429 && attempt < maxRetries) {
          setStatusMsg(`Quota atteint. Tentative ${attempt}/${maxRetries} dans ${delay / 1000}s (backoff exponentiel)...`);
          setRetryCountdown(Math.floor(delay / 1000));
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
        return response;
      } catch (e) {
        if (attempt === maxRetries) throw e;
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
    return authFetch(url, options, explicitKey);
  };

  const generateTTS = async (textToRead: string, isTest = false) => {
    // Sanitize text: strip markdown asterisks (*, **), bullet points, and code formatting so the voice never speaks them
    const sanitizedText = cleanTextForSpeech(textToRead);
    if (!sanitizedText.trim()) {
      showToast("Veuillez saisir un texte à convertir.", "info");
      return;
    }

    if (isTest) {
      setIsTesting(true);
    } else {
      setIsGenerating(true);
      setStatusMsg("Génération de l'aperçu audio (Studio RidiaLArt-Vision)...");
      setIsQuotaError(false);
      setRetryCountdown(0);
    }

    const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();
    try {
      const response = await fetchWithExponentialBackoff('/api/tts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: sanitizedText,
          voiceName,
          model,
          language,
          gender,
          style,
          apiKey: effectiveKey
        })
      }, 3, effectiveKey);

      const data = await response.json();
      if (data.fallback || data.isKeyError || !response.ok) {
        console.warn("Gemini TTS fallback:", data.message || data.error);
        handleBrowserSpeechFallback(textToRead);
        setStatusMsg("Lecture vocale via la synthèse locale du navigateur active. Configurez votre clé API Gemini dans les Paramètres pour les voix HD.");
        return;
      }

      if (!data.audio) {
        handleBrowserSpeechFallback(textToRead);
        setStatusMsg("Lecture vocale via la synthèse locale du navigateur active.");
        return;
      }

      const base64Audio = data.audio;
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(blob);

      if (isTest) {
        setTestAudioUrl(audioUrl);
        if (testAudioRef.current) {
          testAudioRef.current.src = audioUrl;
          testAudioRef.current.play().catch(() => {});
        }
      } else {
        setCurrentAudioBlob(blob);
        setCurrentAudioUrl(audioUrl);
        setShowSaveSection(true);
        setStatusMsg("Aperçu généré avec succès ! Écoutez ou ajustez les curseurs ci-dessous :");

        const audioEl = new Audio(audioUrl);
        audioEl.onloadedmetadata = () => {
          const dur = audioEl.duration || 10;
          setAudioDuration(dur);
          setStartTime(0);
          setEndTime(dur);
        };

        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.playbackRate = voicePitch;
          audioRef.current.play().catch(() => {});
        }

        const projects = Object.keys(library);
        if (projects.length > 0 && !selectedProject) {
          setSelectedProject(projects[0]);
        } else if (projects.length === 0) {
          setSelectedProject('__NEW__');
          setNewProjectName('Mon Projet 1');
        }
      }
    } catch (err: any) {
      console.warn("TTS generation warning, using browser speech fallback:", err);
      handleBrowserSpeechFallback(textToRead);
      const msg = err.message || "";
      if (msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
        setIsQuotaError(true);
        setRetryCountdown(30);
        setStatusMsg("⚠️ Quota Gemini temporairement atteint. Lecture locale active.");
      } else {
        setStatusMsg("Lecture vocale locale (navigateur) active.");
      }
    } finally {
      setIsGenerating(false);
      setIsTesting(false);
    }
  };

  const handleBrowserSpeechFallback = (customText?: string) => {
    const raw = customText || text || "";
    // Clean asterisks and markdown tokens so browser speech doesn't pronounce "astérisque astérisque"
    const textToSpeak = cleanTextForSpeech(raw);
    if (!textToSpeak) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = language === 'Wolof' ? 'fr-FR' : (language === 'Anglais' ? 'en-US' : 'fr-FR');
      utterance.rate = Math.max(0.7, Math.min(1.4, voicePitch || 1.0));
      window.speechSynthesis.speak(utterance);
      setStatusMsg("Lecture de secours via la synthèse vocale du navigateur en cours...");
    } else {
      showToast("La synthèse vocale du navigateur n'est pas supportée sur cet appareil.", "error");
    }
  };

  const handlePreview = () => {
    if (!text.trim()) {
      showToast("Veuillez saisir un texte à convertir.", "info");
      return;
    }
    generateTTS(text, false);
  };

  const handleTestVoice = () => {
    generateTTS("Ceci est un test de la voix sélectionnée pour votre projet.", true);
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const getTrimmedAudioBlob = async (): Promise<Blob> => {
    if (!currentAudioBlob) return new Blob();
    if (startTime <= 0 && endTime >= audioDuration - 0.1 && fadeInDuration === 0 && fadeOutDuration === 0) {
      return currentAudioBlob;
    }

    try {
      const arrayBuffer = await currentAudioBlob.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const sampleRate = decodedBuffer.sampleRate;
      const effectiveStart = Math.max(0, startTime);
      const effectiveEnd = Math.min(audioDuration || decodedBuffer.duration, endTime > 0 ? endTime : decodedBuffer.duration);
      const startSample = Math.floor(effectiveStart * sampleRate);
      const endSample = Math.min(Math.floor(effectiveEnd * sampleRate), decodedBuffer.length);
      const frameCount = Math.max(1, endSample - startSample);

      const offlineCtx = new OfflineAudioContext(decodedBuffer.numberOfChannels, frameCount, sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;

      const gainNode = offlineCtx.createGain();
      source.connect(gainNode);
      gainNode.connect(offlineCtx.destination);

      const totalDuration = effectiveEnd - effectiveStart;
      gainNode.gain.setValueAtTime(0, 0);

      // Fade In
      if (fadeInDuration > 0) {
        gainNode.gain.linearRampToValueAtTime(1, Math.min(fadeInDuration, totalDuration / 2));
      } else {
        gainNode.gain.setValueAtTime(1, 0);
      }

      // Fade Out
      if (fadeOutDuration > 0) {
        const fadeOutStart = Math.max(totalDuration - fadeOutDuration, totalDuration / 2);
        gainNode.gain.setValueAtTime(1, fadeOutStart);
        gainNode.gain.linearRampToValueAtTime(0, totalDuration);
      }

      source.start(0, effectiveStart, totalDuration);

      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWavBlob(renderedBuffer);
    } catch (e) {
      console.error("Trimming/Fade error:", e);
      return currentAudioBlob;
    }
  };

  const audioBufferToWavBlob = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    let channels = [];
    let sampleRate = buffer.sampleRate;
    let pos = 0;

    function writeString(str: string) {
      for (let i = 0; i < str.length; i++) {
        out.setUint8(pos++, str.charCodeAt(i));
      }
    }

    function setUint16(data: number) {
      out.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      out.setUint32(pos, data, true);
      pos += 4;
    }

    writeString('RIFF');
    setUint32(length - 8);
    writeString('WAVE');
    writeString('fmt ');
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    writeString('data');
    setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 0;
    while (offset < buffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  };

  const renderMixedAudioBlob = async (
    voiceBlob: Blob,
    backingTrackUrl: string | null,
    voiceVol: number,
    backingVol: number,
    pitchRate: number = 1.0,
    useCrossfade: boolean = true,
    crossfadeDur: number = 1.5
  ): Promise<Blob> => {
    const voiceArrayBuffer = await voiceBlob.arrayBuffer();
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const decodedVoice = await ctx.decodeAudioData(voiceArrayBuffer);

    let decodedBacking: AudioBuffer | null = null;
    if (backingTrackUrl) {
      try {
        const backingRes = await fetch(backingTrackUrl);
        const backingArrayBuf = await backingRes.arrayBuffer();
        decodedBacking = await ctx.decodeAudioData(backingArrayBuf);
      } catch (e) {
        console.warn("Could not load backing track for mix:", e);
      }
    }

    const sampleRate = decodedVoice.sampleRate;
    const effectivePitch = Math.max(0.5, Math.min(2.0, pitchRate || 1.0));
    const adjustedVoiceDuration = decodedVoice.duration / effectivePitch;

    // If no backing track is selected, render trimmed voice cleanly
    if (!decodedBacking) {
      const frameCount = Math.ceil(adjustedVoiceDuration * sampleRate);
      const offlineCtx = new OfflineAudioContext(decodedVoice.numberOfChannels, frameCount, sampleRate);
      const voiceSource = offlineCtx.createBufferSource();
      voiceSource.buffer = decodedVoice;
      voiceSource.playbackRate.value = effectivePitch;
      const voiceGain = offlineCtx.createGain();
      voiceGain.gain.setValueAtTime(voiceVol, 0);
      voiceSource.connect(voiceGain);
      voiceGain.connect(offlineCtx.destination);
      voiceSource.start(0);
      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWavBlob(renderedBuffer);
    }

    // Crossfade calculation:
    // With crossfade: add a smooth tail so the music fades out naturally after voice ends
    const safeFadeDuration = useCrossfade ? Math.max(0.3, Math.min(4.0, crossfadeDur)) : 0.05;
    const tailDuration = useCrossfade ? safeFadeDuration : 0.05;
    const totalDuration = adjustedVoiceDuration + tailDuration;
    const frameCount = Math.ceil(totalDuration * sampleRate);

    const offlineCtx = new OfflineAudioContext(2, frameCount, sampleRate);

    // 1. Voice setup with subtle anti-click micro-fades
    const voiceSource = offlineCtx.createBufferSource();
    voiceSource.buffer = decodedVoice;
    voiceSource.playbackRate.value = effectivePitch;
    const voiceGain = offlineCtx.createGain();

    if (useCrossfade) {
      const voiceFadeInTime = Math.min(0.04, adjustedVoiceDuration * 0.05);
      voiceGain.gain.setValueAtTime(0, 0);
      voiceGain.gain.linearRampToValueAtTime(voiceVol, voiceFadeInTime);

      const voiceFadeOutStart = Math.max(voiceFadeInTime, adjustedVoiceDuration - 0.06);
      voiceGain.gain.setValueAtTime(voiceVol, voiceFadeOutStart);
      voiceGain.gain.linearRampToValueAtTime(0, adjustedVoiceDuration);
    } else {
      voiceGain.gain.setValueAtTime(voiceVol, 0);
    }

    voiceSource.connect(voiceGain);
    voiceGain.connect(offlineCtx.destination);
    voiceSource.start(0);

    // 2. Backing track setup with automated Crossfade
    const backingSource = offlineCtx.createBufferSource();
    backingSource.buffer = decodedBacking;
    backingSource.loop = true;
    const backingGain = offlineCtx.createGain();

    if (useCrossfade) {
      // Intro Crossfade: gentle fade-in ramp up to backingVol
      const introFade = Math.min(safeFadeDuration * 0.8, 1.2);
      backingGain.gain.setValueAtTime(0, 0);
      backingGain.gain.linearRampToValueAtTime(backingVol, introFade);

      // Sustain backingVol during the speech
      backingGain.gain.setValueAtTime(backingVol, adjustedVoiceDuration);

      // Outro Crossfade: smooth decay to 0 over the tailDuration after speech ends
      backingGain.gain.linearRampToValueAtTime(0, totalDuration);
    } else {
      backingGain.gain.setValueAtTime(backingVol, 0);
      backingGain.gain.setValueAtTime(backingVol, adjustedVoiceDuration);
      backingGain.gain.linearRampToValueAtTime(0, totalDuration);
    }

    backingSource.connect(backingGain);
    backingGain.connect(offlineCtx.destination);
    backingSource.start(0);
    backingSource.stop(totalDuration);

    const renderedBuffer = await offlineCtx.startRendering();
    return audioBufferToWavBlob(renderedBuffer);
  };

  // Instant live zero-latency mixing: plays voice and backing track simultaneously in perfect sync
  const handlePreviewMix = () => {
    if (!currentAudioUrl) {
      showToast("Veuillez d'abord générer ou écouter une voix avant de mixer.", "error");
      return;
    }

    // Toggle live mix if already playing
    if (isLiveMixPlaying) {
      if (audioRef.current) audioRef.current.pause();
      if (backingAudioRef.current) backingAudioRef.current.pause();
      setIsLiveMixPlaying(false);
      setIsAudioPlaying(false);
      setIsBackingTrackPlaying(false);
      showToast("Mix en pause.", "info");
      return;
    }

    try {
      // 1. Play Voice element immediately
      if (audioRef.current) {
        audioRef.current.currentTime = startTime || 0;
        audioRef.current.playbackRate = voicePitch;
        const safeVoiceVol = Math.max(0, Math.min(1, voiceVolume));
        audioRef.current.volume = safeVoiceVol;
        audioRef.current.play().catch(e => console.warn("Voice play error:", e));
        setIsAudioPlaying(true);
      }

      // 2. Play Backing element synchronously
      if (backingAudioRef.current && activeBackingTrack) {
        backingAudioRef.current.currentTime = 0;
        const safeBackingVol = Math.max(0, Math.min(1, backingVolume));
        backingAudioRef.current.volume = safeBackingVol;
        backingAudioRef.current.play().catch(e => console.warn("Backing play error:", e));
        setIsBackingTrackPlaying(true);
      }

      setIsLiveMixPlaying(true);
      showToast("⚡ Mix Voix + Fond lancé instantanément en temps réel !", "success");
    } catch (e) {
      console.warn("Instant live mix error:", e);
    }
  };

  const handleTogglePreviewPlay = () => {
    if (!previewAudioRef.current || !previewMixUrl) return;
    if (previewAudioRef.current.paused) {
      previewAudioRef.current.play().catch(e => console.warn("Play error:", e));
      setIsPreviewPlaying(true);
    } else {
      previewAudioRef.current.pause();
      setIsPreviewPlaying(false);
    }
  };

  const handleStopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setIsPreviewPlaying(false);
  };

  const handleClosePreview = () => {
    handleStopPreview();
    if (previewMixUrl) {
      URL.revokeObjectURL(previewMixUrl);
    }
    setPreviewMixUrl(null);
  };

  const handleMixAndRecordFinal = async () => {
    if (!currentAudioBlob) {
      showToast("Veuillez d'abord générer ou importer un fichier vocal.", "error");
      return;
    }

    handleStopPreview();

    setIsMixingFinal(true);
    setStatusMsg(`Mixage ${enableCrossfade ? `avec Crossfade (${crossfadeDuration.toFixed(1)}s)` : ''} et enregistrement en cours...`);
    try {
      const mixedBlob = await renderMixedAudioBlob(
        currentAudioBlob,
        activeBackingTrack ? activeBackingTrack.url : null,
        voiceVolume,
        backingVolume,
        voicePitch,
        enableCrossfade,
        crossfadeDuration
      );
      const mixedUrl = URL.createObjectURL(mixedBlob);

      setCurrentAudioBlob(mixedBlob);
      setCurrentAudioUrl(mixedUrl);
      if (audioRef.current) {
        audioRef.current.src = mixedUrl;
      }

      const audioEl = new Audio(mixedUrl);
      audioEl.onloadedmetadata = () => {
        const dur = audioEl.duration || 10;
        setAudioDuration(dur);
        setStartTime(0);
        setEndTime(dur);
      };

      showToast(
        enableCrossfade
          ? `Mix final réussi avec Crossfade automatique (${crossfadeDuration.toFixed(1)}s) !`
          : "Mix final (Voix + Fond) enregistré avec succès !",
        "success"
      );
      setStatusMsg("Mix final prêt !");
    } catch (err) {
      console.error("Mix error:", err);
      showToast("Erreur lors du mixage audio.", "error");
    } finally {
      setIsMixingFinal(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!currentAudioBlob && !text.trim()) {
      showToast("Rien à enregistrer. Saisissez du texte ou générez un audio.", "error");
      return;
    }
    
    let targetProj = selectedProject;
    if (targetProj === '__NEW__' || !targetProj) {
      targetProj = newProjectName.trim();
      if (!targetProj) {
        showToast("Veuillez saisir un nom pour le nouveau projet.", "error");
        return;
      }
    }

    const itemName = saveTitle.trim() || 'Piste_01';
    const formattedTextContent = `[Studio: VoxArt - Studio RidiaLArt-Vision]\n[Empreinte / Produit par: Studio RidiaLArt-Vision]\n[Date: ${new Date().toISOString().split('T')[0]}]\n----------------------------------------\n\n` + text;

    const updatedLib = { ...library };
    if (!updatedLib[targetProj]) {
      updatedLib[targetProj] = { audios: [], texts: [] };
    }

    if (currentAudioBlob) {
      const trimmedBlob = await getTrimmedAudioBlob();
      const base64Audio = await blobToBase64(trimmedBlob);
      updatedLib[targetProj].audios.push({
        id: Date.now(),
        name: itemName,
        data: base64Audio
      });
    }

    if (text.trim()) {
      updatedLib[targetProj].texts.push({
        id: Date.now() + 1,
        name: `${itemName}_script`,
        content: formattedTextContent
      });
    }

    saveLibraryToStorage(updatedLib);
    showToast(`Enregistré avec succès dans le projet "${targetProj}" (Studio RidiaLArt-Vision) !`, "success");
    setShowSaveSection(false);
    setCurrentView('library');
  };

  const handleDownloadAudioFile = async (format: 'mp3' | 'wav') => {
    try {
      const blob = await getTrimmedAudioBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = (saveTitle.trim() || 'VoxArt_Audio').replace(/[^a-z0-9_-]/gi, '_');
      a.download = `${fileName}.${format === 'mp3' ? 'mp3' : 'wav'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`Audio téléchargé avec succès en .${format} !`, "success");
    } catch (e) {
      console.error("Download error:", e);
      showToast("Erreur lors du téléchargement de l'audio.", "error");
    }
  };

  const handleShareSocial = async (platform: 'whatsapp' | 'twitter' | 'facebook' | 'linkedin' | 'telegram' | 'native') => {
    const shareText = `🎙️ Écoutez cette création audio générée sur VoxArt (Studio RidiaLArt-Vision) : "${saveTitle || 'Piste Vocale'}" ! 🎧✨`;
    const shareUrl = window.location.href;

    if (platform === 'native' && navigator.share) {
      try {
        await navigator.share({
          title: 'VoxArt Audio - Studio RidiaLArt-Vision',
          text: shareText,
          url: shareUrl,
        });
        showToast("Partagé avec succès !", "success");
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.warn("Native share error:", err);
        }
      }
    }

    let url = '';
    switch (platform) {
      case 'whatsapp':
        url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'telegram':
        url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        break;
      default:
        break;
    }

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      showToast("Redirection vers la plateforme de partage...", "info");
    } else {
      await copyTextToClipboard(shareText + ' ' + shareUrl);
      showToast("Lien et message copiés dans le presse-papier !", "success");
    }
  };

  const handleSaveAnyToLibrary = (project: string, category: 'audios' | 'texts' | 'videos', name: string, data: string) => {
    const updatedLib = { ...library };
    if (!updatedLib[project]) {
      updatedLib[project] = { audios: [], texts: [], videos: [] };
    }
    if (!updatedLib[project][category]) {
      updatedLib[project][category] = [];
    }
    updatedLib[project][category].push({
      id: Date.now(),
      name,
      data: category === 'texts' ? undefined : data,
      content: category === 'texts' ? data : undefined
    } as any);
    saveLibraryToStorage(updatedLib);
  };

  const handleSaveRhythmToLibrary = (
    _audioBlob: Blob,
    audioDataUrl: string,
    title: string,
    composition: RhythmComposition
  ) => {
    let targetProj = selectedProject;
    if (targetProj === '__NEW__' || !targetProj) {
      targetProj = Object.keys(library)[0] || 'Rythmes_Africains';
    }

    const cleanTitle = title.startsWith('[Rythme]') ? title : `[Rythme] ${title}`;
    const updatedLib = { ...library };
    if (!updatedLib[targetProj]) {
      updatedLib[targetProj] = { audios: [], texts: [] };
    }

    updatedLib[targetProj].audios.push({
      id: Date.now(),
      name: cleanTitle,
      data: audioDataUrl
    });

    const compositionMetadata = `[Composition Polyrythmique RidiaLArt]\n[Titre: ${composition.name}]\n[Tradition: ${composition.tradition}]\n[Signature: ${composition.signature} - ${composition.stepCount} pas]\n[Tempo: ${composition.bpm} BPM]\n[Date: ${new Date().toISOString()}]\n----------------------------------------\n\n` +
      `Instruments: ${composition.tracks.map(t => t.instrumentId).join(', ')}\n` +
      `Effets: Reverb ${composition.effects.reverb.enabled ? 'ON' : 'OFF'} (${composition.effects.reverb.decay}s), Delay ${composition.effects.delay.enabled ? 'ON' : 'OFF'}, Compresseur ${composition.effects.compressor.enabled ? 'ON' : 'OFF'}\n` +
      `Description: ${composition.description || 'Rythme africain composé au Studio RidiaLArt'}`;

    updatedLib[targetProj].texts.push({
      id: Date.now() + 1,
      name: `${cleanTitle}_partition`,
      content: compositionMetadata
    });

    saveLibraryToStorage(updatedLib);

    try {
      const savedComps = JSON.parse(localStorage.getItem('voxart_saved_compositions') || '{}');
      savedComps[cleanTitle] = composition;
      localStorage.setItem('voxart_saved_compositions', JSON.stringify(savedComps));
    } catch (e) {
      console.warn("Storage error", e);
    }

    showToast(`Rythme "${cleanTitle}" enregistré avec succès dans "${targetProj}" !`, "success");
  };

  const handleUseRhythmAsBackingTrack = (_audioBlob: Blob, audioUrl: string, title: string) => {
    setActiveBackingTrack({ url: audioUrl, title });
    setIsBackingTrackPlaying(false);
    showToast(`Boucle de rythme "${title}" chargée comme accompagnement pour le Studio Voix !`, "success");
    setCurrentView('home');
  };

  const exportProjectAsZip = async (projectName: string, pData: ProjectData) => {
    try {
      const zip = new JSZip();
      const folder = zip.folder(projectName) || zip;

      for (const audio of pData.audios) {
        const base64Content = audio.data.split(',')[1] || audio.data;
        folder.file(`${audio.name}.wav`, base64Content, { base64: true });
      }

      for (const txt of pData.texts) {
        folder.file(`${txt.name}.txt`, txt.content);
        const srt = generateSRT(txt.content);
        folder.file(`${txt.name.replace('_script', '')}.srt`, srt);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/[^a-z0-9_-]/gi, '_')}_voxart_archive.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      console.error("ZIP Export Error:", e);
      showToast("Erreur lors de la création de l'archive ZIP.", "error");
    }
  };

  const exportProjectAsJson = (projectName: string, pData: ProjectData) => {
    const exportObj = {
      version: "1.0",
      studio: "VoxArt - Studio RidiaLArt-Vision",
      projectName,
      projectData: pData,
      exportedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^a-z0-9_-]/gi, '_')}_voxart_share.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleImportProjectJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.projectName && parsed.projectData) {
          const updated = { ...library, [parsed.projectName]: parsed.projectData };
          saveLibraryToStorage(updated);
          showToast(`Projet "${parsed.projectName}" importé avec succès dans la bibliothèque VoxArt !`, "success");
        } else {
          showToast("Format de fichier de partage VoxArt invalide.", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Erreur lors de l'importation du fichier projet.", "error");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleCreateLibraryProject = () => {
    const pName = libNewProjectName.trim();
    if (!pName) {
      showToast("Veuillez saisir un nom pour le nouveau projet.", "error");
      return;
    }
    if (library[pName]) {
      showToast("Un projet avec ce nom existe déjà dans la bibliothèque.", "error");
      return;
    }
    const updated = {
      ...library,
      [pName]: { audios: [], texts: [] }
    };
    saveLibraryToStorage(updated);
    setLibNewProjectName('');
    showToast(`Projet "${pName}" créé avec succès !`, "success");
  };

  const renameProject = (oldName: string) => {
    openPromptDialog("Renommer le projet", oldName, (newName) => {
      if (newName && newName.trim() && newName.trim() !== oldName) {
        const trimmed = newName.trim();
        if (library[trimmed]) {
          showToast("Un projet portant ce nom existe déjà.", "error");
          return;
        }
        const updated = { ...library };
        updated[trimmed] = updated[oldName];
        delete updated[oldName];
        saveLibraryToStorage(updated);
        showToast(`Projet renommé en "${trimmed}".`, "success");
      }
    });
  };

  const renameAudioItem = (proj: string, idx: number) => {
    const item = library[proj]?.audios[idx];
    if (!item) return;
    openPromptDialog("Renommer le fichier audio", item.name, (newName) => {
      if (newName && newName.trim()) {
        const updated = { ...library };
        updated[proj].audios[idx].name = newName.trim();
        saveLibraryToStorage(updated);
        showToast("Fichier audio renommé.", "success");
      }
    });
  };

  const renameTextItem = (proj: string, idx: number) => {
    const item = library[proj]?.texts[idx];
    if (!item) return;
    openPromptDialog("Renommer le fichier texte", item.name, (newName) => {
      if (newName && newName.trim()) {
        const updated = { ...library };
        updated[proj].texts[idx].name = newName.trim();
        saveLibraryToStorage(updated);
        showToast("Fichier texte renommé.", "success");
      }
    });
  };

  const shareAudioItem = async (base64Data: string, filename: string) => {
    try {
      const res = await fetch(base64Data);
      const blob = await res.blob();
      const file = new File([blob], `${filename}.wav`, { type: 'audio/wav' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: `VoxArt (Studio RidiaLArt-Vision) - Fichier audio : ${filename}`
        });
      } else {
        showToast("Le partage direct de fichiers n'est pas pris en charge par votre navigateur. Utilisez le téléchargement ⬇️.", "info");
      }
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string } | null;
      if (
        errorObj?.name === 'AbortError' ||
        errorObj?.message?.toLowerCase().includes('cancel') ||
        errorObj?.message?.toLowerCase().includes('abort')
      ) {
        // User closed/cancelled the share dialog normally; no action needed
        return;
      }
      console.error(err);
      showToast("Impossible de partager le fichier audio.", "error");
    }
  };

  const shareTextItem = async (textContent: string, filename: string) => {
    try {
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
      const file = new File([blob], `${filename}.txt`, { type: 'text/plain' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: textContent
        });
      } else if (navigator.share) {
        await navigator.share({ title: filename, text: textContent });
      } else {
        showToast("Partage non supporté sur ce navigateur.", "info");
      }
    } catch (err: unknown) {
      const errorObj = err as { name?: string; message?: string } | null;
      if (
        errorObj?.name === 'AbortError' ||
        errorObj?.message?.toLowerCase().includes('cancel') ||
        errorObj?.message?.toLowerCase().includes('abort')
      ) {
        // User closed/cancelled the share dialog normally; no action needed
        return;
      }
      console.error(err);
      showToast("Impossible de partager le texte.", "error");
    }
  };

  const copyToClipboard = async (str: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(str);
        return true;
      }
    } catch {
      // fallback if clipboard API fails
    }
    try {
      const textArea = document.createElement('textarea');
      textArea.value = str;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch (err) {
      console.error('Fallback copy failed', err);
      return false;
    }
  };

  const handleCopyScript = async (content: string, id: number | string) => {
    // If text contains header separator, copy clean script, else entire text
    const cleanContent = content.includes('----------------------------------------\n\n')
      ? content.split('----------------------------------------\n\n')[1]
      : content;
    await copyToClipboard(cleanContent || content);
    setCopiedScriptId(id);
    setTimeout(() => {
      setCopiedScriptId(null);
    }, 2000);
  };

  const handleUseScriptInStudio = (content: string) => {
    const cleanContent = content.includes('----------------------------------------\n\n')
      ? content.split('----------------------------------------\n\n')[1]
      : content;
    setText(cleanContent || content);
    setCurrentView('home');
  };

  const playTrimmedSelection = async () => {
    if (!currentAudioBlob) return;
    const trimmed = await getTrimmedAudioBlob();
    const url = URL.createObjectURL(trimmed);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play();
    }
  };

  // Batch Processing Helper Functions
  const splitTextIntoBatchQueue = (
    rawText: string, 
    prefix = batchPrefix, 
    delimType = batchDelimiter, 
    customDelim = batchCustomDelimiter
  ) => {
    if (!rawText.trim()) {
      setBatchQueue([]);
      return;
    }

    let chunks: string[] = [];
    if (delimType === 'paragraphs') {
      chunks = rawText.split(/\n\s*\n+/);
    } else if (delimType === 'lines') {
      chunks = rawText.split(/\n+/);
    } else {
      const d = customDelim || '---';
      chunks = rawText.split(d);
    }

    const cleaned = chunks
      .map(c => c.trim())
      .filter(c => c.length > 0);

    const safePrefix = prefix.trim() || 'Clip';
    const newQueue: BatchQueueItem[] = cleaned.map((par, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      return {
        id: `batch-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        name: `${safePrefix}_${num}`,
        text: par,
        status: 'pending'
      };
    });

    setBatchQueue(newQueue);
  };

  const handleImportBatchFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setBatchRawText(content);
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        if (baseName) {
          setBatchTargetProject(`Projet_${baseName}`);
        }
        splitTextIntoBatchQueue(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const runBatchQueue = async () => {
    if (batchQueue.length === 0) {
      showToast("Veuillez d'abord découper un texte ou importer un fichier.", "info");
      return;
    }
    const targetProj = batchTargetProject.trim() || 'Projet_Lots';

    setBatchIsRunning(true);
    batchAbortRef.current = false;

    for (let i = 0; i < batchQueue.length; i++) {
      if (batchAbortRef.current) break;
      if (batchQueue[i].status === 'completed') continue;

      setBatchCurrentIndex(i);
      setBatchQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'generating', errorMsg: undefined } : item));

      try {
        const textToRead = cleanTextForSpeech(batchQueue[i].text);
        const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();
        const response = await fetchWithExponentialBackoff('/api/tts', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: textToRead,
            voiceName,
            model,
            language,
            gender,
            style,
            apiKey: effectiveKey
          })
        }, 3, effectiveKey);

        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || `Erreur serveur ${response.status}`);
        }

        const base64Audio = data.audio;
        const binary = atob(base64Audio);
        const bytes = new Uint8Array(binary.length);
        for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);

        const audioItem: SavedAudioItem = {
          id: Date.now() + i,
          name: batchQueue[i].name,
          data: `data:audio/mp3;base64,${base64Audio}`
        };

        const formattedScript = `[Studio: VoxArt - RidiaLArt-Vision]
[Projet: ${targetProj}]
[Clip: ${batchQueue[i].name}]
[Paragraphe ${i + 1}/${batchQueue.length}]
[Date: ${new Date().toLocaleDateString('fr-FR')}]
----------------------------------------

${textToRead}`;

        const textItem: SavedTextItem = {
          id: Date.now() + 1000 + i,
          name: `${batchQueue[i].name}_script`,
          content: formattedScript
        };

        setLibrary(prev => {
          const nextLib = { ...prev };
          if (!nextLib[targetProj]) {
            nextLib[targetProj] = { audios: [], texts: [] };
          }
          nextLib[targetProj].audios.push(audioItem);
          nextLib[targetProj].texts.push(textItem);
          localStorage.setItem('voxart_library', JSON.stringify(nextLib));
          return nextLib;
        });

        setBatchQueue(prev => prev.map((item, idx) => idx === i ? {
          ...item,
          status: 'completed',
          audioBlob: blob,
          audioUrl
        } : item));

        // Polite delay to protect against Gemini quota limits
        if (i < batchQueue.length - 1 && !batchAbortRef.current) {
          for (let cd = 2; cd > 0; cd--) {
            if (batchAbortRef.current) break;
            setBatchDelayCountdown(cd);
            await new Promise(r => setTimeout(r, 1000));
          }
          setBatchDelayCountdown(0);
        }
      } catch (err: any) {
        console.error(`Erreur clip ${i}:`, err);
        setBatchQueue(prev => prev.map((item, idx) => idx === i ? {
          ...item,
          status: 'error',
          errorMsg: err.message || 'Erreur lors de la génération'
        } : item));
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setBatchIsRunning(false);
    setBatchCurrentIndex(-1);
    setBatchDelayCountdown(0);
  };

  const stopBatchQueue = () => {
    batchAbortRef.current = true;
    setBatchIsRunning(false);
    setBatchCurrentIndex(-1);
    setBatchDelayCountdown(0);
  };

  const retrySingleBatchItem = async (index: number) => {
    const targetProj = batchTargetProject.trim() || 'Projet_Lots';
    const item = batchQueue[index];
    if (!item) return;

    setBatchQueue(prev => prev.map((it, idx) => idx === index ? { ...it, status: 'generating', errorMsg: undefined } : it));

    try {
      const sanitizedBatchText = cleanTextForSpeech(item.text);
      const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();
      const response = await fetchWithExponentialBackoff('/api/tts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: sanitizedBatchText,
          voiceName,
          model,
          language,
          gender,
          style,
          apiKey: effectiveKey
        })
      }, 3, effectiveKey);

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || `Erreur ${response.status}`);
      }

      const base64Audio = data.audio;
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);
      let blob = new Blob([bytes], { type: 'audio/mp3' });
      let finalBase64Audio = base64Audio;

      if (batchCompressMp3) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const tempCtx = new AudioCtx();
          const decoded = await tempCtx.decodeAudioData(arrayBuffer);
          const offlineCtx = new OfflineAudioContext(1, Math.floor(decoded.duration * 22050), 22050);
          const source = offlineCtx.createBufferSource();
          source.buffer = decoded;
          source.connect(offlineCtx.destination);
          source.start(0);
          const rendered = await offlineCtx.startRendering();
          blob = audioBufferToWavBlob(rendered);

          const compressedBuffer = await blob.arrayBuffer();
          const compressedBytes = new Uint8Array(compressedBuffer);
          let binaryCompressed = '';
          for (let i = 0; i < compressedBytes.byteLength; i++) {
            binaryCompressed += String.fromCharCode(compressedBytes[i]);
          }
          finalBase64Audio = btoa(binaryCompressed);
        } catch (compErr) {
          console.warn("Compression warning:", compErr);
        }
      }

      const audioUrl = URL.createObjectURL(blob);

      const audioItem: SavedAudioItem = {
        id: Date.now(),
        name: item.name,
        data: `data:audio/mp3;base64,${finalBase64Audio}`
      };

      const formattedScript = `[Studio: VoxArt - RidiaLArt-Vision]
[Projet: ${targetProj}]
[Clip: ${item.name}]
[Date: ${new Date().toLocaleDateString('fr-FR')}]
----------------------------------------

${item.text}`;

      const textItem: SavedTextItem = {
        id: Date.now() + 1,
        name: `${item.name}_script`,
        content: formattedScript
      };

      setLibrary(prev => {
        const nextLib = { ...prev };
        if (!nextLib[targetProj]) {
          nextLib[targetProj] = { audios: [], texts: [] };
        }
        nextLib[targetProj].audios.push(audioItem);
        nextLib[targetProj].texts.push(textItem);
        localStorage.setItem('voxart_library', JSON.stringify(nextLib));
        return nextLib;
      });

      setBatchQueue(prev => prev.map((it, idx) => idx === index ? {
        ...it,
        status: 'completed',
        audioBlob: blob,
        audioUrl
      } : it));
    } catch (err: any) {
      setBatchQueue(prev => prev.map((it, idx) => idx === index ? {
        ...it,
        status: 'error',
        errorMsg: err.message || 'Erreur lors de la génération'
      } : it));
    }
  };

  const removeBatchItem = (index: number) => {
    setBatchQueue(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateBatchItemText = (index: number, newText: string) => {
    setBatchQueue(prev => prev.map((it, idx) => idx === index ? { ...it, text: newText } : it));
  };

  const updateBatchItemName = (index: number, newName: string) => {
    setBatchQueue(prev => prev.map((it, idx) => idx === index ? { ...it, name: newName } : it));
  };

  const playSequentialBatch = (startIndex = 0) => {
    const completedItems = batchQueue
      .map((item, idx) => ({ ...item, originalIndex: idx }))
      .filter(item => item.status === 'completed' && item.audioUrl);

    if (completedItems.length === 0) {
      showToast("Aucun clip audio terminé à lire.", "info");
      return;
    }

    const target = completedItems.find(it => it.originalIndex >= startIndex) || completedItems[0];
    if (!target || !target.audioUrl) {
      setBatchSequentialPlayingIndex(null);
      return;
    }

    setBatchSequentialPlayingIndex(target.originalIndex);

    if (batchAudioPlayerRef.current) {
      batchAudioPlayerRef.current.src = target.audioUrl;
      batchAudioPlayerRef.current.onended = () => {
        const nextIndex = target.originalIndex + 1;
        playSequentialBatch(nextIndex);
      };
      batchAudioPlayerRef.current.play();
    }
  };

  const stopSequentialBatch = () => {
    setBatchSequentialPlayingIndex(null);
    if (batchAudioPlayerRef.current) {
      batchAudioPlayerRef.current.pause();
      batchAudioPlayerRef.current.onended = null;
    }
  };

  const genderText = gender.includes('femme') ? 'Femme' : (gender.includes('neutre') ? 'Neutre' : 'Homme');
  const batchCompletedCount = batchQueue.filter(i => i.status === 'completed').length;
  const batchPendingCount = batchQueue.filter(i => i.status === 'pending').length;
  const batchErrorCount = batchQueue.filter(i => i.status === 'error').length;

  return (
    <div className="min-h-screen bg-[#181825] text-[#cdd6f4] flex flex-col font-sans">
      <OfflineIndicator />

      {/* Minimalist Top Bar with Top-Left Section Dropdown */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#181825]/90 border-b border-[#313244]/40 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <select
            value={homeMode === 'video_dubbing' && currentView === 'home' ? 'video_dubbing' : currentView}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'video_dubbing') {
                setCurrentView('home');
                setHomeMode('video_dubbing');
              } else {
                setCurrentView(val as any);
              }
            }}
            className="bg-[#1e1e2e] text-[#89b4fa] font-bold text-xs px-3 py-1.5 rounded-xl border border-[#313244] shadow-md focus:outline-none focus:border-[#89b4fa] cursor-pointer"
            title="Volet déroulant des rubriques"
          >
            <option value="home">🏠 Accueil Studio Vocal</option>
            <option value="video_dubbing">🎬 Doublage Vidéo (Voix Off & Fond Sonore)</option>
            <option value="rhythm_studio">🥁 Atelier Rythmes</option>
            <option value="library">📚 Bibliothèque ({Object.keys(library).length})</option>
            <option value="knowledge_base">📖 Base de Connaissance (RAG)</option>
            <option value="settings">⚙️ Réglages</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectThemeMode(themeMode === 'ridialart' ? 'standard' : 'ridialart')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 ${
              themeMode === 'ridialart'
                ? 'bg-[#2d1807] border-[#fbbf24]/50 text-[#fbbf24]'
                : 'bg-[#313244] border-[#89b4fa]/40 text-[#89b4fa]'
            }`}
            title="Basculer entre Mode Standard et Mode RidiaLArt"
          >
            {themeMode === 'ridialart' ? <Sparkles className="w-3 h-3 text-[#fbbf24]" /> : <Radio className="w-3 h-3 text-[#89b4fa]" />}
            <span className="hidden sm:inline">{themeMode === 'ridialart' ? 'RidiaLArt' : 'Standard'}</span>
          </button>
          <PWAInstallButton />
        </div>
      </div>

      <main className={`flex-1 w-full mx-auto p-4 sm:p-6 transition-all ${currentView === 'rhythm_studio' ? 'max-w-4xl' : homeMode === 'batch' && currentView === 'home' ? 'max-w-2xl' : 'max-w-xl'}`}>
        
        {/* HOME VIEW */}
        {currentView === 'home' && (
          <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col items-center mb-3 text-center">
              <img
                src={studioLogo}
                alt="VoxArt - Studio RidiaLArt-Vision"
                className="w-[120px] h-[120px] rounded-full object-cover border-2 border-[#00f2ff] shadow-[0_0_20px_rgba(0,242,255,0.4)] mb-2.5 transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.triedPng) {
                    target.dataset.triedPng = 'true';
                    target.src = 'logo.png';
                  } else if (!target.dataset.triedJpg) {
                    target.dataset.triedJpg = 'true';
                    target.src = 'logo.jpg';
                  }
                }}
              />
              <h1 className="text-2xl font-bold text-[#89b4fa] tracking-wide">VoxArt</h1>
              <div className="text-xs text-[#a6adc8] uppercase tracking-widest font-medium mt-1">Studio RidiaLArt-Vision</div>
            </div>
            
            {/* Mode Switcher */}
            <div className="flex p-1 bg-[#181825] rounded-xl border border-[#313244] gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setHomeMode('single')}
                className={`flex-1 min-w-[100px] py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  homeMode === 'single'
                    ? themeMode === 'ridialart' ? 'bg-[#d97706] text-[#1c0f04] shadow-md font-bold' : 'bg-[#89b4fa] text-[#11111b] shadow-md'
                    : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]/50'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>🎙️ Studio Vocal</span>
              </button>

              <button
                type="button"
                onClick={() => setHomeMode('video_dubbing')}
                className={`flex-1 min-w-[130px] py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  homeMode === 'video_dubbing' || homeMode === 'transcription'
                    ? 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#1c0f04] shadow-md font-black'
                    : 'text-[#fbbf24] border border-[#fbbf24]/40 hover:bg-[#fbbf24]/10'
                }`}
                title="Importer une vidéo pour y ajouter une Voix Off et un Fond Sonore"
              >
                <Film className="w-3.5 h-3.5" />
                <span>🎬 Doublage Vidéo</span>
              </button>

              <button
                type="button"
                onClick={() => setHomeMode('workspace')}
                className={`flex-1 min-w-[95px] py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  homeMode === 'workspace'
                    ? themeMode === 'ridialart' ? 'bg-[#d97706] text-[#1c0f04] shadow-md font-bold' : 'bg-[#89b4fa] text-[#11111b] shadow-md'
                    : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]/50'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>💬 Agent IA</span>
              </button>

              <button
                type="button"
                onClick={() => setHomeMode('batch')}
                className={`flex-1 min-w-[75px] py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  homeMode === 'batch'
                    ? themeMode === 'ridialart' ? 'bg-[#d97706] text-[#1c0f04] shadow-md font-bold' : 'bg-[#89b4fa] text-[#11111b] shadow-md'
                    : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>📦 Lots</span>
                {batchQueue.length > 0 && (
                  <span className="text-[10px] bg-[#11111b]/20 px-1.5 py-0.2 rounded-full font-bold">
                    {batchCompletedCount}/{batchQueue.length}
                  </span>
                )}
              </button>
            </div>

            {homeMode === 'workspace' && (
              <UnifiedStudioWorkspace
                currentText={text}
                setCurrentText={setText}
                apiKey={apiKey}
                onOpenSettings={() => setCurrentView('settings')}
                addToast={showToast}
                library={library}
                onSaveToLibrary={handleSaveAnyToLibrary}
                onPreviewTTS={handlePreview}
                onPreviewMix={handlePreviewMix}
                isGenerating={isGenerating}
                currentAudioUrl={currentAudioUrl}
                onSpeakText={(txt: string) => generateTTS(txt)}
                onTransferToVocalStudio={handleTransferFromAgent}
                onSwitchToStudio={() => setHomeMode('single')}
              />
            )}

            {(homeMode === 'transcription' || homeMode === 'video_dubbing') && (
              <TranscriptionStudio
                apiKey={apiKey}
                addToast={showToast}
                activeBackingTrack={activeBackingTrack}
                initialVideoFile={preloadedVideoFile}
                initialText={text}
                library={library}
                onSwitchMode={(mode) => setHomeMode(mode as any)}
                onInsertTextToStudio={(transcribedText) => {
                  setText(transcribedText);
                  setHomeMode('single');
                  showToast('Texte injecté dans le Studio Vocal !', 'success');
                }}
                onInsertTextToAgent={(transcribedText) => {
                  setText(transcribedText);
                  setHomeMode('workspace');
                  showToast('Texte transféré dans l\'Agent IA pour analyse & scénarios !', 'success');
                }}
              />
            )}

            {homeMode === 'single' ? (
              <div className="space-y-3.5 animate-fadeIn">
                {/* CARTE MIS EN AVANT : IMPORTER UNE VIDÉO (VOIX OFF + FOND SONORE) */}
                <div className="bg-gradient-to-r from-[#181825] via-[#24172a] to-[#1c1429] rounded-2xl border-2 border-[#fbbf24]/50 p-4 shadow-xl space-y-3 relative overflow-hidden group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#fbbf24] via-[#f59e0b] to-[#ec4899] flex items-center justify-center text-[#11111b] shadow-lg shrink-0">
                        <Film className="w-5 h-5 font-black" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white tracking-wide">
                            🎬 Doublage Vidéo : Voix Off & Fond Sonore
                          </h3>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/30">
                            Nouveau
                          </span>
                        </div>
                        <p className="text-xs text-[#a6adc8]">
                          Importez une vidéo pour générer une voix off synchronisée, ajouter une musique d'ambiance et incruster les sous-titres.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setHomeMode('video_dubbing')}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#fbbf24] text-[#1c0f04] hover:bg-[#f59e0b] transition-all flex items-center justify-center gap-1.5 shadow-md shrink-0 cursor-pointer"
                    >
                      <span>Ouvrir Studio Vidéo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Zone Drag & Drop Vidéo */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const droppedFile = e.dataTransfer.files?.[0];
                      if (droppedFile && (droppedFile.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(droppedFile.name))) {
                        setPreloadedVideoFile(droppedFile);
                        setHomeMode('video_dubbing');
                        showToast(`Vidéo "${droppedFile.name}" importée avec succès !`, "success");
                      } else {
                        showToast("Veuillez déposer un fichier vidéo valide (MP4, WebM, MOV)", "error");
                      }
                    }}
                    className="border-2 border-dashed border-[#fbbf24]/40 hover:border-[#fbbf24] bg-[#11111b]/70 hover:bg-[#11111b]/95 rounded-xl p-3.5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
                    onClick={() => homeVideoInputRef.current?.click()}
                  >
                    <input
                      ref={homeVideoInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const selected = e.target.files?.[0];
                        if (selected) {
                          setPreloadedVideoFile(selected);
                          setHomeMode('video_dubbing');
                          showToast(`Vidéo "${selected.name}" importée avec succès !`, "success");
                          e.target.value = '';
                        }
                      }}
                    />
                    <div className="flex items-center gap-2 text-xs font-bold text-[#f9e2af]">
                      <Upload className="w-4 h-4 text-[#fbbf24]" />
                      <span>Cliquez pour importer une vidéo ou glissez-déposez votre fichier ici</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#a6adc8] flex-wrap justify-center">
                      <span className="bg-[#313244] px-2 py-0.5 rounded text-[#89b4fa]">MP4 • WebM • MOV</span>
                      <span>•</span>
                      <span className="text-[#a6e3a1]">🎙️ Voix Off IA</span>
                      <span>•</span>
                      <span className="text-[#fbbf24]">🎵 Fond Sonore & Rythmes Africains</span>
                      <span>•</span>
                      <span className="text-[#cba6f7]">📜 Sous-titres Hardsub</span>
                    </div>
                  </div>
                </div>

                {isQuotaError && (
                  <div className="p-3.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-red-300">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Quota temporairement atteint</span>
                    </div>
                    <p className="leading-relaxed">
                      Rétablissement automatique dans : <strong className="text-white font-mono">{retryCountdown}s</strong>
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => { setRetryCountdown(0); handlePreview(); }}
                        className="py-1.5 px-3 rounded-lg bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-all"
                      >
                        Réessayer
                      </button>
                      <button
                        onClick={cancelQuotaRetry}
                        className="py-1.5 px-3 rounded-lg bg-red-950/60 text-red-300 border border-red-500/30 hover:bg-red-900/60 text-xs transition-all"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {/* STUDIO DE VOIX, LANGUE & ACCENT (TEXT-TO-AUDIO) */}
                <div className="bg-[#181825]/95 rounded-2xl border border-[#89b4fa]/30 p-3.5 sm:p-4 space-y-3 shadow-lg animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-[#313244]/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow">
                        <Mic className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#89b4fa] flex items-center gap-2">
                          <span>Configuration Vocale, Langue & Accent</span>
                        </h4>
                        <p className="text-[10px] text-[#a6adc8]">
                          Personnalisez le timbre (homme/femme), la voix Gemini, la langue et l'accent de sortie
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentView('settings')}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] border border-[#89b4fa]/30 transition-all flex items-center gap-1 cursor-pointer"
                      title="Ouvrir les paramètres avancés"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Paramètres Avancés</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Voix Gemini Prebuilt */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#a6adc8] mb-1">
                        Voix Gemini :
                      </label>
                      <select
                        value={voiceName}
                        onChange={(e) => setVoiceName(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-[#11111b] border border-[#45475a] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#89b4fa] cursor-pointer"
                      >
                        {PRESET_VOICES.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Langue */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#a6adc8] mb-1">
                        Langue :
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-[#11111b] border border-[#45475a] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#89b4fa] cursor-pointer"
                      >
                        <option value="Français">🇫🇷 Français (Standard / International)</option>
                        <option value="Anglais">🇬🇧 Anglais (English)</option>
                        <option value="Wolof">🇸🇳 Wolof (Sénégal & Afrique de l'Ouest)</option>
                      </select>
                    </div>

                    {/* Timbre & Genre */}
                    <div>
                      <label className="block text-[11px] font-semibold text-[#a6adc8] mb-1">
                        Timbre & Genre :
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-[#11111b] border border-[#45475a] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#89b4fa] cursor-pointer"
                      >
                        <option value="voix masculine grave, profonde et résonnante (homme)">🚹 Homme (Grave & Profond)</option>
                        <option value="voix féminine mélodieuse, claire et expressive (femme)">🚺 Femme (Mélodieuse & Claire)</option>
                        <option value="voix neutre, posée et feutrée">⚖️ Neutre & Feutré</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Espace Épuré : Zone de texte & Auto-sauvegarde 30s */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2">
                      <label className="block text-xs font-semibold text-[#a6adc8]">Texte à convertir :</label>
                      {/* Outil de nettoyage immédiat des astérisques et markdown */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!text.trim()) {
                            showToast("Aucun texte à nettoyer.", "info");
                            return;
                          }
                          const cleaned = cleanTextForSpeech(text);
                          setText(cleaned);
                          showToast("Astérisques (*) et balises markdown supprimés avec succès !", "success");
                        }}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] border border-[#89b4fa]/30 transition-all flex items-center gap-1 cursor-pointer"
                        title="Supprime les astérisques (*) et le formatage markdown pour une synthèse vocale limpide sans bruit"
                      >
                        <span>🧹 Nettoyer astérisques (*)</span>
                      </button>

                      {/* Bouton de sauvegarde du préréglage par défaut */}
                      <button
                        type="button"
                        onClick={handleSaveDefaultPreset}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#313244] hover:bg-[#45475a] text-[#a6e3a1] border border-[#a6e3a1]/30 transition-all flex items-center gap-1 cursor-pointer"
                        title="Sauvegarder ce réglage de voix et volumes par défaut à chaque ouverture"
                      >
                        <Save className="w-2.5 h-2.5 text-[#a6e3a1]" />
                        <span>{hasCustomDefaultPreset ? 'Préréglage par défaut actif' : 'Sauvegarder par défaut'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {lastAutoSaveTime && (
                        <span className="text-[10px] text-[#a6e3a1] bg-[#a6e3a1]/10 border border-[#a6e3a1]/20 px-2 py-0.5 rounded-md flex items-center gap-1 font-mono" title="Auto-sauvegarde active toutes les 30 secondes">
                          <Check className="w-2.5 h-2.5 text-[#a6e3a1]" /> Auto-sauvegardé ({lastAutoSaveTime})
                        </span>
                      )}
                      <span className="text-[10px] text-[#6c7086] font-mono">{text.length} caractères</span>
                    </div>
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Saisissez ou collez votre texte ici..."
                    className="w-full h-36 p-3 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm resize-y focus:outline-none focus:border-[#89b4fa] transition-colors"
                  />
                </div>

                {/* MODULE INTÉGRÉ DANS LA PAGE D'ACCUEIL : CHOIX, COMPOSITION ET MIXAGE DU FOND SONORE */}
                <div className="bg-[#181825]/95 rounded-2xl border border-[#fbbf24]/30 p-3.5 sm:p-4 space-y-3 shadow-lg animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#313244]/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#d97706] to-[#fbbf24] flex items-center justify-center text-[#1c0f04] shadow">
                        <Music className="w-4 h-4 font-black" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#f9e2af] flex items-center gap-2">
                          <span>Fond Sonore, Composition & Mixage</span>
                          {activeBackingTrack && (
                            <span className="text-[10px] bg-[#fbbf24]/20 text-[#fbbf24] px-1.5 py-0.2 rounded font-mono">
                              Actif
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-[#a6adc8]">
                          Choisissez une ambiance musicale, composez vos rythmes ou mixez en direct avec la voix
                        </p>
                      </div>
                    </div>

                    {/* Actions directes vers les studios de composition et mixage complets */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCurrentView('rhythm_studio')}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#2b1708] border border-[#fbbf24]/40 text-[#fbbf24] hover:bg-[#fbbf24] hover:text-[#1c0f04] transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                        title="Ouvrir le séquenceur pas-à-pas pour composer des polyrythmies sur mesure"
                      >
                        <Sparkles className="w-3 h-3 text-[#fbbf24]" />
                        <span>Composer un Rythme</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowMixer(prev => !prev)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1 shadow-sm cursor-pointer ${
                          showMixer
                            ? 'bg-[#fbbf24] text-[#1c0f04] border-[#fbbf24]'
                            : 'bg-[#313244] text-[#cdd6f4] border-[#45475a] hover:bg-[#45475a]'
                        }`}
                        title="Ouvrir le panneau complet du studio de mixage (bibliothèque, importation, presets)"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>{showMixer ? 'Masquer Studio' : 'Studio Complet'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Barre de sélection directe du fond sonore */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-[#a6adc8] mb-1">
                        Sélectionner le fond sonore d'accompagnement :
                      </label>
                      <div className="relative">
                        <select
                          value={activeBackingTrack ? activeBackingTrack.title : '__NONE__'}
                          disabled={isApplyingQuickBacking}
                          onChange={(e) => handleQuickSelectPreset(e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-[#11111b] border border-[#45475a] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#fbbf24] disabled:opacity-50 cursor-pointer"
                        >
                          <option value="__NONE__">🔇 Aucun fond sonore (Voix a cappella)</option>
                          <optgroup label="── Rythmes Traditionnels Africains (Loops) ──">
                            <option value="aube_kora_sahel">🪕 Aube Sahélienne & Kora Mandingue (12/8 - 104 BPM)</option>
                            <option value="sabar_kaolack">🥁 Sabar Kaolack Polyrythmique (12/8 - 114 BPM)</option>
                            <option value="balafon_casamance_fleuve">🪵 Balafon Solaire de Casamance (4/4 - 108 BPM)</option>
                            <option value="mystique_flute_peulh">🪈 Mystique Pastorale & Flûte Peulh (6/8 - 96 BPM)</option>
                            <option value="rituel_appel_ancetres">⚡ Djembé & Rituel Ancestral (4/4 - 92 BPM)</option>
                            <option value="mbalax_thieboudienne">🎉 Mbalax Thiéboudiène Festif (12/8 - 118 BPM)</option>
                            <option value="dub_roots_senegal">🌌 Dub Roots Ancestral RidiaLArt (4/4 - 76 BPM)</option>
                          </optgroup>
                          <optgroup label="── Ambiances Naturelles & Sahéliennes ──">
                            <option value="foret_brousse">🌳 Forêt Sacrée & Brousse (Casamance)</option>
                            <option value="village_pilon">🛖 Matinée au Village (Pilons de mil & aube)</option>
                            <option value="marche_sandaga">🧺 Marché Sandaga & Palabres Sahéliennes</option>
                            <option value="fleuve_pirogue">🛶 Fleuve Sénégal & Clapotis de Pirogue</option>
                            <option value="nuit_savane">✨ Nuit Sahélienne & Grillons Mystiques</option>
                          </optgroup>
                          <optgroup label="── Création & Personnalisation ──">
                            <option value="__COMPOSE__">✨ Composer un rythme sur mesure (Studio Rythmique)...</option>
                            <option value="__STUDIO__">🎛️ Ouvrir le Studio complet (Bibliothèque, Effets, Mix)...</option>
                            <option value="__UPLOAD__">📁 Importer un fichier audio MP3/WAV personnel...</option>
                          </optgroup>
                        </select>
                        {isApplyingQuickBacking && (
                          <div className="absolute right-3 top-2.5">
                            <RefreshCw className="w-4 h-4 text-[#fbbf24] animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Input invisible pour l'upload rapide d'un fichier audio */}
                    <input
                      ref={backingInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = URL.createObjectURL(file);
                        setActiveBackingTrack({
                          url,
                          title: `📁 ${file.name.replace(/\.[^/.]+$/, "")}`,
                          category: 'Fichier Personnel',
                          icon: '📁'
                        });
                        showToast(`Fichier "${file.name}" chargé comme fond sonore !`, "success");
                        e.target.value = '';
                      }}
                    />
                  </div>

                  {/* Carte d'état de la piste active, pré-écoute et curseurs de mixage & pitch */}
                  {activeBackingTrack && (
                    <div className="bg-[#11111b] p-3 rounded-xl border border-[#fbbf24]/20 space-y-3 animate-fadeIn">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Disc className={`w-4 h-4 text-[#fbbf24] shrink-0 ${isBackingTrackPlaying ? 'animate-spin' : ''}`} />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#f9e2af] truncate">
                              {activeBackingTrack.title}
                            </div>
                            <div className="text-[10px] text-[#a6adc8]">
                              {activeBackingTrack.category || 'Accompagnement'} • Boucle synchronisée
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (backingAudioRef.current) {
                                if (isBackingTrackPlaying) backingAudioRef.current.pause();
                                else backingAudioRef.current.play().catch(() => {});
                              }
                            }}
                            className="py-1 px-2.5 rounded-lg text-xs font-bold bg-[#d97706] text-[#1c0f04] hover:bg-[#fbbf24] transition-all flex items-center gap-1 shadow cursor-pointer"
                          >
                            {isBackingTrackPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                            <span>{isBackingTrackPlaying ? 'Pause Fond' : 'Écouter Fond'}</span>
                          </button>

                          {/* Bouton de mix instantané en temps réel (0ms) */}
                          <button
                            type="button"
                            onClick={handlePreviewMix}
                            disabled={!currentAudioUrl}
                            className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow cursor-pointer ${
                              isLiveMixPlaying
                                ? 'bg-[#fbbf24] text-[#1c0f04]'
                                : 'bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b]'
                            }`}
                            title="Lancer ou mettre en pause l'écoute mixée instantanée de la voix et du fond sonore"
                          >
                            {isLiveMixPlaying ? <Pause className="w-3 h-3" /> : <Sliders className="w-3 h-3" />}
                            <span>{isLiveMixPlaying ? 'Pause Mix' : '⚡ Mixer Voix + Fond'}</span>
                          </button>

                          {/* Bouton pour fusionner et enregistrer le mix définitif dans la bibliothèque */}
                          <button
                            type="button"
                            onClick={handleMixAndRecordFinal}
                            disabled={isMixingFinal || !currentAudioBlob}
                            className="py-1 px-2.5 rounded-lg text-xs font-bold bg-[#313244] hover:bg-[#45475a] text-[#a6e3a1] border border-[#a6e3a1]/40 transition-all flex items-center gap-1 shadow cursor-pointer disabled:opacity-50"
                            title="Calculer et fusionner le fichier audio mixé final dans la bibliothèque"
                          >
                            {isMixingFinal ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            <span>Fusionner Mix</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (backingAudioRef.current) backingAudioRef.current.pause();
                              setActiveBackingTrack(null);
                              setIsBackingTrackPlaying(false);
                              if (isLiveMixPlaying) setIsLiveMixPlaying(false);
                              showToast("Fond sonore retiré.", "info");
                            }}
                            className="p-1 rounded-lg text-red-400 hover:bg-red-500/20 transition-all text-xs cursor-pointer"
                            title="Désactiver le fond sonore"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Sliders temps réel : Volume Voix, Volume Fond Sonore, et Pitch (Hauteur) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-[#313244]/50">
                        <div>
                          <div className="flex justify-between text-[10px] text-[#a6adc8] mb-1">
                            <span>🎙️ Volume Voix :</span>
                            <span className="font-mono font-bold text-[#89b4fa]">{Math.round(voiceVolume * 100)}%</span>
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

                        <div>
                          <div className="flex justify-between text-[10px] text-[#a6adc8] mb-1">
                            <span>🥁 Volume Fond :</span>
                            <span className="font-mono font-bold text-[#fbbf24]">{Math.round(backingVolume * 100)}%</span>
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

                        <div>
                          <div className="flex justify-between text-[10px] text-[#a6adc8] mb-1">
                            <span>🎚️ Pitch (Hauteur) :</span>
                            <span className="font-mono font-bold text-[#cba6f7]">
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
                        </div>
                      </div>

                      {/* Option Crossfade Automatique Rapide */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#313244]/50 text-[11px]">
                        <div className="flex items-center gap-1.5 text-[#a6adc8]">
                          <Waves className={`w-3.5 h-3.5 ${enableCrossfade ? 'text-[#a6e3a1]' : 'text-[#6c7086]'}`} />
                          <span className="font-medium">Crossfade automatique ({crossfadeDuration.toFixed(1)}s) :</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEnableCrossfade(!enableCrossfade)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                              enableCrossfade
                                ? 'bg-[#a6e3a1]/20 text-[#a6e3a1] border border-[#a6e3a1]/40'
                                : 'bg-[#313244] text-[#a6adc8] hover:text-white'
                            }`}
                          >
                            {enableCrossfade ? '✓ Activé' : 'Désactivé'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Barre de commandes épurée : Écouter, Enregistrer, Mixer, + Importer */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                  {/* Bouton Écouter */}
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={isGenerating || !text.trim()}
                    className="py-2.5 px-3 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    title="Écouter l'aperçu vocal"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Génération...</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Écouter</span>
                      </>
                    )}
                  </button>

                  {/* Bouton Enregistrer */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentAudioUrl && !text.trim()) {
                        showToast("Saisissez d'abord du texte ou générez un audio avant d'enregistrer.", "error");
                        return;
                      }
                      setShowSaveSection(prev => !prev);
                    }}
                    disabled={!text.trim() && !currentAudioUrl}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                      showSaveSection
                        ? 'bg-[#a6e3a1] text-[#11111b]'
                        : 'bg-[#313244] hover:bg-[#45475a] text-[#a6e3a1] border border-[#a6e3a1]/30'
                    }`}
                    title="Enregistrer dans la bibliothèque"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Enregistrer</span>
                  </button>

                  {/* Bouton Fond Sonore & Mixage */}
                  <button
                    type="button"
                    onClick={() => setShowMixer(prev => !prev)}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 border ${
                      showMixer || activeBackingTrack
                        ? 'bg-gradient-to-r from-[#d97706] to-[#fbbf24] text-[#1c0f04] border-[#fbbf24]'
                        : 'bg-[#313244] hover:bg-[#45475a] text-[#fbbf24] border-[#fbbf24]/30'
                    }`}
                    title="Ouvrir le studio de composition, de choix du fond sonore et de mixage"
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>{activeBackingTrack ? '🎵 Fond Actif' : '🎵 Fond Sonore & Mixage'}</span>
                    {activeBackingTrack && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                    )}
                  </button>

                  {/* Bouton + Importer */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-3 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] hover:text-[#89b4fa] font-bold text-xs border border-[#45475a] hover:border-[#89b4fa]/50 shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    title="Importer un fichier texte (.txt, .md) ou audio"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#89b4fa]" />
                    <span>+ Importer</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.text,audio/*"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                </div>

                {statusMsg && (
                  <div className="text-xs text-center text-[#a6adc8] italic">
                    {statusMsg}
                  </div>
                )}

                {/* Panneau d'enregistrement dans la bibliothèque */}
                {showSaveSection && (
                  <div className="p-4 rounded-xl bg-[#181825] border border-[#a6e3a1]/40 space-y-3 animate-fadeIn shadow-lg">
                    <div className="flex items-center justify-between text-xs font-bold text-[#a6e3a1]">
                      <span className="flex items-center gap-1.5"><Save className="w-4 h-4" /> Enregistrer dans la Bibliothèque</span>
                      <button
                        type="button"
                        onClick={() => setShowSaveSection(false)}
                        className="text-[#a6adc8] hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#a6adc8] mb-1">Nom du fichier / piste :</label>
                      <input
                        type="text"
                        value={saveTitle}
                        onChange={(e) => setSaveTitle(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#a6e3a1]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#a6adc8] mb-1">Dossier / Projet cible :</label>
                      <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-xs"
                      >
                        {Object.keys(library).map(proj => (
                          <option key={proj} value={proj}>{proj}</option>
                        ))}
                        <option value="__NEW__">+ Créer un nouveau projet...</option>
                      </select>

                      {selectedProject === '__NEW__' && (
                        <input
                          type="text"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="Nom du nouveau projet..."
                          className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-xs mt-2"
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveToLibrary}
                      className="w-full py-2.5 rounded-xl bg-[#a6e3a1] text-[#11111b] font-bold text-xs text-center shadow hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Confirmer l'enregistrement (Studio RidiaLArt-Vision)</span>
                    </button>
                  </div>
                )}

                {/* Lecteur Audio, Synesthésie Plastique & Découpe */}
                {currentAudioUrl && (
                  <div className="pt-2 space-y-3 animate-fadeIn">
                    <audio
                      ref={audioRef}
                      controls
                      className={`w-full ${themeMode === 'ridialart' ? 'accent-[#fbbf24]' : 'accent-[#89b4fa]'}`}
                      src={currentAudioUrl}
                      onPlay={() => setIsAudioPlaying(true)}
                      onPause={() => {
                        setIsAudioPlaying(false);
                        if (isLiveMixPlaying) {
                          if (backingAudioRef.current) backingAudioRef.current.pause();
                          setIsBackingTrackPlaying(false);
                          setIsLiveMixPlaying(false);
                        }
                      }}
                      onEnded={() => {
                        setIsAudioPlaying(false);
                        if (isLiveMixPlaying) {
                          if (backingAudioRef.current) backingAudioRef.current.pause();
                          setIsBackingTrackPlaying(false);
                          setIsLiveMixPlaying(false);
                        }
                      }}
                    />

                    {/* RIDIALART PLASTIC SYNESTHESIA CANVAS */}
                    {themeMode === 'ridialart' && (
                      <PlasticSynesthesiaCanvas
                        audioElement={audioRef.current}
                        audioUrl={currentAudioUrl}
                        isPlaying={isAudioPlaying}
                        themeMode={themeMode}
                        title={saveTitle || 'Voix_VoxArt'}
                      />
                    )}

                    {/* TRIMMER RANGE SLIDER UI */}
                    <div className="bg-[#313244]/60 p-3.5 rounded-xl border border-[#45475a] space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#89b4fa]">
                        <span className="flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5" /> Découpe & Silences</span>
                        <span className="tabular-nums text-[11px] text-[#a6adc8]">{formatTimeDisplay(startTime)} — {formatTimeDisplay(endTime)} / {formatTimeDisplay(audioDuration)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between text-[10px] text-[#a6adc8] mb-1">
                            <span>Début : {formatTimeDisplay(startTime)}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={audioDuration || 1}
                            step={0.05}
                            value={startTime}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (val < endTime) setStartTime(val);
                            }}
                            className="w-full accent-[#89b4fa]"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] text-[#a6adc8] mb-1">
                            <span>Fin : {formatTimeDisplay(endTime)}</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={audioDuration || 1}
                            step={0.05}
                            value={endTime}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (val > startTime) setEndTime(val);
                            }}
                            className="w-full accent-[#f9e2af]"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={playTrimmedSelection}
                        className="w-full py-1.5 rounded-lg bg-[#313244] border border-[#89b4fa]/50 text-[#89b4fa] text-xs font-bold hover:bg-[#89b4fa] hover:text-[#11111b] transition-all"
                      >
                        ▶️ Écouter la sélection rognée
                      </button>
                    </div>

                    {/* SECTION: Téléchargement & Partage Réseaux Sociaux */}
                    <div className="bg-[#181825] p-4 rounded-xl border border-[#89b4fa]/30 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between text-xs font-bold text-[#89b4fa]">
                        <span className="flex items-center gap-1.5"><Download className="w-4 h-4 text-[#89b4fa]" /> Téléchargement & Partage Direct</span>
                        <span className="text-[10px] bg-[#313244] px-2 py-0.5 rounded-full text-[#a6adc8]">MP3 / WAV / Réseaux</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadAudioFile('mp3')}
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>📥 Télécharger (.mp3)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadAudioFile('wav')}
                          className="py-2.5 px-3 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] border border-[#89b4fa]/40 font-bold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>📥 Télécharger (.wav)</span>
                        </button>
                      </div>

                      <div className="pt-2 border-t border-[#45475a]/60 space-y-2">
                        <div className="text-[11px] font-semibold text-[#a6adc8] flex items-center gap-1">
                          <Share2 className="w-3.5 h-3.5 text-[#fbbf24]" /> Partager sur les réseaux sociaux :
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleShareSocial('whatsapp')}
                            className="py-2 px-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-[11px] font-bold hover:bg-emerald-950 transition-all flex items-center justify-center gap-1"
                            title="WhatsApp"
                          >
                            <span>💬 WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareSocial('twitter')}
                            className="py-2 px-2 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-200 text-[11px] font-bold hover:bg-blue-950 transition-all flex items-center justify-center gap-1"
                            title="X / Twitter"
                          >
                            <span>🐦 X</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareSocial('facebook')}
                            className="py-2 px-2 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-[11px] font-bold hover:bg-indigo-950 transition-all flex items-center justify-center gap-1"
                            title="Facebook"
                          >
                            <span>📘 Facebook</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareSocial('linkedin')}
                            className="py-2 px-2 rounded-lg bg-sky-950/60 border border-sky-500/40 text-sky-200 text-[11px] font-bold hover:bg-sky-950 transition-all flex items-center justify-center gap-1"
                            title="LinkedIn"
                          >
                            <span>🔗 LinkedIn</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareSocial('telegram')}
                            className="py-2 px-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 text-[11px] font-bold hover:bg-cyan-950 transition-all flex items-center justify-center gap-1"
                            title="Telegram"
                          >
                            <span>✈️ Telegram</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareSocial('native')}
                            className="py-2 px-2 rounded-lg bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-[11px] font-bold hover:bg-[#45475a] transition-all flex items-center justify-center gap-1"
                            title="Partager via l'appareil"
                          >
                            <span>📤 Partager</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STUDIO DE FOND SONORE & MIXAGE (COMPOSITION, PRESETS, BIBLIO, PITCH, MIX) */}
                {showMixer && (
                  <BackgroundMusicStudio
                    activeBackingTrack={activeBackingTrack}
                    setActiveBackingTrack={setActiveBackingTrack}
                    voiceVolume={voiceVolume}
                    setVoiceVolume={setVoiceVolume}
                    backingVolume={backingVolume}
                    setBackingVolume={setBackingVolume}
                    voicePitch={voicePitch}
                    setVoicePitch={setVoicePitch}
                    enableCrossfade={enableCrossfade}
                    setEnableCrossfade={setEnableCrossfade}
                    crossfadeDuration={crossfadeDuration}
                    setCrossfadeDuration={setCrossfadeDuration}
                    currentAudioBlob={currentAudioBlob}
                    onPreviewMix={handlePreviewMix}
                    isPreviewingMix={isPreviewingMix}
                    onMixAndRecordFinal={handleMixAndRecordFinal}
                    isMixingFinal={isMixingFinal}
                    previewMixUrl={previewMixUrl}
                    isPreviewPlaying={isPreviewPlaying}
                    onTogglePreviewPlay={handleTogglePreviewPlay}
                    onStopPreview={handleStopPreview}
                    library={library}
                    onOpenRhythmStudio={() => setCurrentView('rhythm_studio')}
                    showToast={showToast}
                    onClose={() => setShowMixer(false)}
                  />
                )}

                {/* Barre récapitulative compacte du fond sonore actif lorsque le panneau est fermé */}
                {activeBackingTrack && !showMixer && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#181825] border border-[#fbbf24]/30 text-xs shadow-md animate-fadeIn">
                    <div className="flex items-center gap-2.5 truncate">
                      <Disc className={`w-4 h-4 text-[#fbbf24] shrink-0 ${isBackingTrackPlaying ? 'animate-spin' : ''}`} />
                      <div className="truncate">
                        <span className="text-[#a6adc8] text-[11px] block sm:inline mr-1">Fond sonore actif :</span>
                        <span className="text-[#f9e2af] font-bold truncate">{activeBackingTrack.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <audio
                        ref={backingAudioRef}
                        src={activeBackingTrack.url}
                        loop
                        onPlay={() => setIsBackingTrackPlaying(true)}
                        onPause={() => setIsBackingTrackPlaying(false)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (backingAudioRef.current) {
                            if (isBackingTrackPlaying) backingAudioRef.current.pause();
                            else backingAudioRef.current.play().catch(() => {});
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#d97706] text-[#1c0f04] hover:bg-[#fbbf24] transition-all flex items-center gap-1 shadow"
                      >
                        {isBackingTrackPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                        <span>{isBackingTrackPlaying ? 'Pause' : 'Écouter'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowMixer(true)}
                        className="py-1 px-2.5 rounded-lg bg-[#313244] hover:bg-[#45475a] text-[#fbbf24] font-bold text-xs transition-all border border-[#fbbf24]/30"
                      >
                        🎛️ Mixer / Changer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (backingAudioRef.current) backingAudioRef.current.pause();
                          setActiveBackingTrack(null);
                          setIsBackingTrackPlaying(false);
                          showToast("Fond sonore retiré.", "info");
                        }}
                        className="p-1 text-red-400 hover:bg-red-500/20 rounded-lg text-xs"
                        title="Retirer le fond sonore"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* BATCH PROCESSING MODE */
              <div className="space-y-4 animate-fadeIn">
                {/* Project & Configuration Card */}
                <div className="bg-[#313244]/50 p-4 rounded-xl border border-[#45475a] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#89b4fa] flex items-center gap-1.5">
                      <Folder className="w-4 h-4" /> Projet & Organisation de la file d'attente
                    </span>
                    <span className="text-[10px] text-[#f9e2af] bg-[#313244] px-2 py-0.5 rounded-full font-mono">
                      Archivage automatique
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#a6adc8] mb-1">
                      📁 Nom du projet cible dans la Bibliothèque :
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={batchTargetProject}
                        onChange={(e) => setBatchTargetProject(e.target.value)}
                        placeholder="Nom du projet cible..."
                        className="p-2.5 rounded-xl bg-[#1e1e2e] border border-[#45475a] text-[#cdd6f4] text-xs font-medium"
                      />
                      {Object.keys(library).length > 0 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value) setBatchTargetProject(e.target.value);
                          }}
                          className="p-2.5 rounded-xl bg-[#1e1e2e] border border-[#45475a] text-[#cdd6f4] text-xs"
                          defaultValue=""
                        >
                          <option value="" disabled>Choisir un projet existant...</option>
                          {Object.keys(library).map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#45475a]/40">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#cdd6f4]">
                      <input
                        type="checkbox"
                        checked={batchCompressMp3}
                        onChange={(e) => setBatchCompressMp3(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#89b4fa]"
                      />
                      <span>🗜️ Optimiser & Compresser les clips MP3 dans la Bibliothèque (Réduction taille ~50-70%)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#45475a]/40">
                    <div>
                      <label className="block text-xs font-semibold text-[#a6adc8] mb-1">
                        🏷️ Préfixe des noms de clips :
                      </label>
                      <input
                        type="text"
                        value={batchPrefix}
                        onChange={(e) => {
                          setBatchPrefix(e.target.value);
                          if (batchRawText) splitTextIntoBatchQueue(batchRawText, e.target.value, batchDelimiter, batchCustomDelimiter);
                        }}
                        placeholder="ex: Clip, Piste, Chapitre"
                        className="w-full p-2 rounded-lg bg-[#1e1e2e] border border-[#45475a] text-[#cdd6f4] text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#a6adc8] mb-1">
                        ✂️ Règle de découpage :
                      </label>
                      <select
                        value={batchDelimiter}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setBatchDelimiter(val);
                          if (batchRawText) splitTextIntoBatchQueue(batchRawText, batchPrefix, val, batchCustomDelimiter);
                        }}
                        className="w-full p-2 rounded-lg bg-[#1e1e2e] border border-[#45475a] text-[#cdd6f4] text-xs"
                      >
                        <option value="paragraphs">Paragraphes (Saut double \n\n)</option>
                        <option value="lines">Ligne par ligne (Saut simple \n)</option>
                        <option value="custom">Séparateur personnalisé</option>
                      </select>
                      {batchDelimiter === 'custom' && (
                        <input
                          type="text"
                          value={batchCustomDelimiter}
                          onChange={(e) => {
                            setBatchCustomDelimiter(e.target.value);
                            if (batchRawText) splitTextIntoBatchQueue(batchRawText, batchPrefix, 'custom', e.target.value);
                          }}
                          placeholder="Séparateur (ex: --- ou ###)"
                          className="w-full p-1.5 mt-1.5 rounded-lg bg-[#1e1e2e] border border-[#45475a] text-[#cdd6f4] text-xs font-mono"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Text Input & File Import */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#a6adc8]">
                      📄 Manuscrit ou texte long à découper :
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={batchFileInputRef}
                        accept=".txt,.md,.srt,text/plain"
                        onChange={handleImportBatchFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => batchFileInputRef.current?.click()}
                        className="px-2.5 py-1 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] border border-[#89b4fa]/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Importer un fichier (.txt, .md)</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={batchRawText}
                    onChange={(e) => {
                      setBatchRawText(e.target.value);
                      splitTextIntoBatchQueue(e.target.value);
                    }}
                    placeholder="Collez ou tapez ici votre texte complet divisé par paragraphes...&#10;&#10;Chaque paragraphe deviendra automatiquement un clip audio dans la file d'attente !"
                    className="w-full h-36 p-3 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-xs font-sans resize-y"
                  />
                  <div className="flex items-center justify-between text-[11px] text-[#a6adc8]">
                    <span>{batchRawText.length} caractères • {batchQueue.length} clip(s) prêt(s)</span>
                    {batchRawText && (
                      <button
                        type="button"
                        onClick={() => {
                          setBatchRawText('');
                          setBatchQueue([]);
                        }}
                        className="text-red-400 hover:underline"
                      >
                        Effacer le texte
                      </button>
                    )}
                  </div>
                </div>

                {/* Batch Queue & Production Section */}
                {batchQueue.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-[#313244]">
                    {/* Stats Dashboard */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-[#313244] p-2 rounded-xl border border-[#45475a]/30">
                        <div className="text-[10px] text-[#a6adc8]">Total Clips</div>
                        <div className="font-bold text-[#89b4fa]">{batchQueue.length}</div>
                      </div>
                      <div className="bg-[#313244] p-2 rounded-xl border border-[#45475a]/30">
                        <div className="text-[10px] text-[#a6adc8]">Terminés</div>
                        <div className="font-bold text-[#a6e3a1]">{batchCompletedCount}</div>
                      </div>
                      <div className="bg-[#313244] p-2 rounded-xl border border-[#45475a]/30">
                        <div className="text-[10px] text-[#a6adc8]">En attente</div>
                        <div className="font-bold text-[#f9e2af]">{batchPendingCount}</div>
                      </div>
                      <div className="bg-[#313244] p-2 rounded-xl border border-[#45475a]/30">
                        <div className="text-[10px] text-[#a6adc8]">Erreurs</div>
                        <div className="font-bold text-[#f38ba8]">{batchErrorCount}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#a6adc8]">Progression de la synthèse :</span>
                        <span className="font-mono font-bold text-[#89b4fa]">
                          {Math.round((batchCompletedCount / batchQueue.length) * 100)}% ({batchCompletedCount}/{batchQueue.length})
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-[#313244] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#89b4fa] to-[#a6e3a1] transition-all duration-300 rounded-full"
                          style={{ width: `${(batchCompletedCount / batchQueue.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Live Processing / Rate Limit Alert */}
                    {batchIsRunning && (
                      <div className="bg-[#313244] p-3 rounded-xl border border-[#89b4fa]/40 flex items-center justify-between text-xs animate-pulse">
                        <div className="flex items-center gap-2 text-[#89b4fa] font-semibold">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Synthèse du clip {batchCurrentIndex + 1}/{batchQueue.length} ({batchQueue[batchCurrentIndex]?.name})...</span>
                        </div>
                        {batchDelayCountdown > 0 && (
                          <div className="text-[#fab387] font-mono text-[11px] bg-[#1e1e2e] px-2 py-0.5 rounded-full border border-[#fab387]/30">
                            ⏱️ Anti-quota: {batchDelayCountdown}s
                          </div>
                        )}
                      </div>
                    )}

                    {/* Control Buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!batchIsRunning ? (
                        <button
                          type="button"
                          onClick={runBatchQueue}
                          disabled={batchPendingCount === 0}
                          className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Lancer la génération ({batchPendingCount} restant{batchPendingCount > 1 ? 's' : ''})</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopBatchQueue}
                          className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                        >
                          <Square className="w-4 h-4 fill-current" />
                          <span>Arrêter la file d'attente</span>
                        </button>
                      )}

                      {batchCompletedCount > 0 && (
                        <>
                          {batchSequentialPlayingIndex === null ? (
                            <button
                              type="button"
                              onClick={() => playSequentialBatch(0)}
                              className="py-2.5 px-3 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] border border-[#89b4fa]/40 font-semibold text-xs flex items-center gap-1.5 transition-all"
                              title="Écouter tous les clips terminés dans l'ordre"
                            >
                              <PlayCircle className="w-4 h-4" />
                              <span>Écouter la suite</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={stopSequentialBatch}
                              className="py-2.5 px-3 rounded-xl bg-[#fab387]/20 text-[#fab387] border border-[#fab387]/40 font-semibold text-xs flex items-center gap-1.5 transition-all"
                            >
                              <PauseCircle className="w-4 h-4" />
                              <span>Pause écoute</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const projData = library[batchTargetProject.trim() || 'Projet_Lots'];
                              if (projData) {
                                exportProjectAsZip(batchTargetProject.trim() || 'Projet_Lots', projData);
                              } else {
                                showToast("Le projet n'est pas encore enregistré dans la bibliothèque.", "info");
                              }
                            }}
                            className="py-2.5 px-3 rounded-xl bg-[#a6e3a1]/20 hover:bg-[#a6e3a1]/30 text-[#a6e3a1] border border-[#a6e3a1]/40 font-semibold text-xs flex items-center gap-1.5 transition-all"
                            title="Exporter l'archive ZIP du projet complet (MP3 + TXT + SRT)"
                          >
                            <Package className="w-4 h-4" />
                            <span>Exporter ZIP</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setCurrentView('library')}
                        className="py-2.5 px-3 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] border border-[#45475a] font-semibold text-xs flex items-center gap-1.5 transition-all"
                      >
                        <Folder className="w-4 h-4" />
                        <span>Biblio</span>
                      </button>
                    </div>

                    {/* Sequential Continuous Player Banner */}
                    <audio ref={batchAudioPlayerRef} className="hidden" />
                    {batchSequentialPlayingIndex !== null && (
                      <div className="bg-[#181825] p-2.5 rounded-xl border border-[#89b4fa]/40 flex items-center justify-between text-xs text-[#89b4fa]">
                        <div className="flex items-center gap-2 truncate">
                          <Volume2 className="w-4 h-4 animate-bounce shrink-0" />
                          <span className="truncate">
                            Lecture en continu : <strong>{batchQueue[batchSequentialPlayingIndex]?.name}</strong> ({batchSequentialPlayingIndex + 1}/{batchQueue.length})
                          </span>
                        </div>
                        <button
                          onClick={stopSequentialBatch}
                          className="text-xs text-red-400 hover:text-red-300 font-semibold shrink-0 ml-2"
                        >
                          Arrêter
                        </button>
                      </div>
                    )}

                    {/* Queue Items List */}
                    <div className="space-y-2 pt-1 max-h-[420px] overflow-y-auto pr-1">
                      {batchQueue.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-xl border transition-all text-xs space-y-2 ${
                            item.status === 'generating'
                              ? 'bg-[#313244] border-[#89b4fa] shadow-md shadow-[#89b4fa]/10'
                              : item.status === 'completed'
                              ? 'bg-[#1e1e2e] border-[#a6e3a1]/30'
                              : item.status === 'error'
                              ? 'bg-[#1e1e2e] border-red-500/40'
                              : 'bg-[#1e1e2e] border-[#313244]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#313244] text-[#a6adc8]">
                                #{idx + 1}
                              </span>
                              <input
                                type="text"
                                value={item.name}
                                disabled={batchIsRunning}
                                onChange={(e) => updateBatchItemName(idx, e.target.value)}
                                className="font-bold text-xs bg-transparent border-b border-transparent hover:border-[#89b4fa] focus:border-[#89b4fa] outline-none text-[#89b4fa] w-24 sm:w-32"
                              />
                              <span className="text-[10px] text-[#6c7086]">
                                ({item.text.length} car.)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Status Badge */}
                              {item.status === 'pending' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#313244] text-[#a6adc8] font-medium">
                                  ⏳ En attente
                                </span>
                              )}
                              {item.status === 'generating' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#89b4fa]/20 text-[#89b4fa] font-bold animate-pulse flex items-center gap-1">
                                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Synthèse...
                                </span>
                              )}
                              {item.status === 'completed' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#a6e3a1]/20 text-[#a6e3a1] font-bold flex items-center gap-1">
                                  <Check className="w-2.5 h-2.5" /> Prêt
                                </span>
                              )}
                              {item.status === 'error' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400 font-bold">
                                  ❌ Erreur
                                </span>
                              )}

                              {/* Completed Audio Actions */}
                              {item.status === 'completed' && item.audioUrl && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (batchAudioPlayerRef.current) {
                                        batchAudioPlayerRef.current.src = item.audioUrl!;
                                        batchAudioPlayerRef.current.play();
                                        setBatchSequentialPlayingIndex(idx);
                                      }
                                    }}
                                    className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded text-[11px] font-medium"
                                    title="Écouter ce clip"
                                  >
                                    ▶️
                                  </button>
                                  <a
                                    href={item.audioUrl}
                                    download={`${item.name}.mp3`}
                                    className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#a6e3a1] rounded text-[11px]"
                                    title="Télécharger MP3"
                                  >
                                    ⬇️
                                  </a>
                                </>
                              )}

                              {/* Error Retry */}
                              {item.status === 'error' && (
                                <button
                                    type="button"
                                    onClick={() => retrySingleBatchItem(idx)}
                                    className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-[11px] font-semibold"
                                  >
                                    🔄 Réessayer
                                  </button>
                              )}

                              {/* Delete button */}
                              {!batchIsRunning && (
                                <button
                                  type="button"
                                  onClick={() => removeBatchItem(idx)}
                                  className="p-1 rounded text-[#6c7086] hover:text-red-400 hover:bg-[#313244]"
                                  title="Supprimer de la file"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Paragraph Text Preview */}
                          <p className="text-[11px] text-[#a6adc8] leading-relaxed bg-[#181825] p-2 rounded-lg border border-[#313244]/50 line-clamp-3">
                            {item.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AFRICAN RHYTHM STUDIO VIEW (COMPOSITION, EFFETS, EXPORT WAV & BIBLIO) */}
        {currentView === 'rhythm_studio' && (
          <AfricanRhythmStudio
            onBackToStudio={() => setCurrentView('home')}
            onSaveToLibrary={handleSaveRhythmToLibrary}
            onUseAsBackingTrack={handleUseRhythmAsBackingTrack}
            existingProjects={Object.keys(library)}
            initialComposition={studioComposition}
          />
        )}

        {/* LIBRARY VIEW */}
        {currentView === 'library' && (
          <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col items-center mb-1 text-center">
              <img
                src={studioLogo}
                alt="VoxArt"
                className="w-[70px] h-[70px] rounded-full object-cover border-2 border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.4)] mb-1.5 transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.triedPng) {
                    target.dataset.triedPng = 'true';
                    target.src = 'logo.png';
                  } else if (!target.dataset.triedJpg) {
                    target.dataset.triedJpg = 'true';
                    target.src = 'logo.jpg';
                  }
                }}
              />
              <h1 className="text-xl font-bold text-[#89b4fa]">Bibliothèque VoxArt</h1>
              <div className="text-[10px] text-[#a6adc8] uppercase tracking-widest font-medium">Studio RidiaLArt-Vision</div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
              <button
                onClick={() => setCurrentView('home')}
                className="w-full sm:w-auto py-2 px-4 rounded-xl bg-[#313244] text-[#89b4fa] font-semibold text-xs border border-[#89b4fa]/50 hover:bg-[#89b4fa] hover:text-[#11111b] transition-all"
              >
                ⬅️ Retour à l'accueil
              </button>

              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(library, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `voxart_database_backup_${new Date().toISOString().slice(0,10)}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                    showToast("Base de données téléchargée avec succès sur votre appareil !", "success");
                  }}
                  className="w-full sm:w-auto py-2 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition-all flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>💾 Télécharger la base (JSON)</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onChange={handleImportProjectJson}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto py-2 px-4 rounded-xl bg-[#fab387] text-[#11111b] font-bold text-xs hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>📥 Importer (.json)</span>
                </button>
              </div>
            </div>

            {/* Create Project Card in Library */}
            <div className="bg-[#313244] p-4 rounded-xl border border-[#45475a] space-y-2 mt-4">
              <label className="block text-xs font-semibold text-[#89b4fa]">✨ Créer un nouveau projet :</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={libNewProjectName}
                  onChange={(e) => setLibNewProjectName(e.target.value)}
                  placeholder="Nom du nouveau projet..."
                  className="flex-1 p-2 rounded-lg bg-[#1e1e2e] border border-[#45475a] text-[#cdd6f4] text-xs"
                />
                <button
                  onClick={handleCreateLibraryProject}
                  className="px-4 py-2 bg-[#89b4fa] text-[#11111b] font-bold text-xs rounded-lg hover:bg-[#b4befe] transition-all shrink-0"
                >
                  + Créer
                </button>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              {Object.keys(library).length === 0 ? (
                <div className="text-center py-12 text-[#a6adc8] text-xs">
                  Aucun projet dans la bibliothèque VoxArt pour le moment.
                </div>
              ) : (
                Object.keys(library).map(proj => {
                  const pData = library[proj];
                  return (
                    <div key={proj} className="bg-[#313244] p-4 rounded-xl border-l-4 border-[#89b4fa] space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#89b4fa]">📁 {proj}</h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => renameProject(proj)}
                            className="px-2.5 py-1 rounded bg-[#313244] border border-[#89b4fa]/50 text-[#89b4fa] text-xs font-semibold hover:bg-[#89b4fa] hover:text-[#11111b]"
                          >
                            ✏️ Renommer
                          </button>
                          <button
                            onClick={() => exportProjectAsJson(proj, pData)}
                            className="px-2.5 py-1 rounded bg-[#f9e2af] text-[#11111b] text-xs font-bold hover:opacity-90 flex items-center gap-1"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Partager (JSON)</span>
                          </button>
                          <button
                            onClick={() => exportProjectAsZip(proj, pData)}
                            className="px-2.5 py-1 rounded bg-[#89b4fa] text-[#11111b] text-xs font-bold hover:bg-[#b4befe] flex items-center gap-1"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>ZIP</span>
                          </button>
                          <button
                            onClick={() => {
                              openConfirmDialog(
                                "Supprimer le projet",
                                `Êtes-vous sûr de vouloir supprimer définitivement le projet "${proj}" et tout son contenu ?`,
                                () => {
                                  const updated = { ...library };
                                  delete updated[proj];
                                  saveLibraryToStorage(updated);
                                  showToast(`Projet "${proj}" supprimé.`, "info");
                                }
                              );
                            }}
                            className="px-2.5 py-1 rounded bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>

                      {/* Audios */}
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-[#f9e2af]">🎵 Fichiers Audio (.mp3) :</div>
                        {pData.audios.length === 0 ? (
                          <div className="text-[11px] text-[#6c7086]">Aucun audio</div>
                        ) : (
                          pData.audios.map((item, idx) => {
                            const isRhythm = item.name.includes('[Rythme]');
                            return (
                            <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg text-xs ${isRhythm ? 'bg-[#241307] border border-[#fbbf24]/30' : 'bg-[#1e1e2e]'}`}>
                              <div className="flex items-center gap-1.5 truncate max-w-[130px] sm:max-w-[190px]">
                                <span>{isRhythm ? '🥁' : '🎧'}</span>
                                <span className={`truncate font-medium ${isRhythm ? 'text-[#fbbf24]' : 'text-[#cdd6f4]'}`}>
                                  {item.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isRhythm && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        try {
                                          const savedComps = JSON.parse(localStorage.getItem('voxart_saved_compositions') || '{}');
                                          if (savedComps[item.name]) {
                                            setStudioComposition(savedComps[item.name]);
                                          }
                                        } catch (e) {
                                          // ignore
                                        }
                                        setCurrentView('rhythm_studio');
                                      }}
                                      className="px-2 py-1 bg-[#d97706]/25 hover:bg-[#d97706]/45 text-[#fbbf24] border border-[#fbbf24]/40 rounded text-[10px] font-bold"
                                      title="Éditer cette partition dans l'Atelier de Rythmes"
                                    >
                                      🎛️ Éditer
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveBackingTrack({ url: item.data, title: item.name });
                                        setIsBackingTrackPlaying(false);
                                        showToast(`Boucle "${item.name}" chargée comme accompagnement du studio vocal !`, "success");
                                        setCurrentView('home');
                                      }}
                                      className="px-2 py-1 bg-[#ea580c]/25 hover:bg-[#ea580c]/45 text-[#fdba74] border border-[#ea580c]/40 rounded text-[10px] font-bold"
                                      title="Utiliser en boucle de fond pour la voix"
                                    >
                                      🎙️ Fond
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => renameAudioItem(proj, idx)}
                                  className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded text-[11px]"
                                  title="Renommer"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={async () => {
                                    const res = await fetch(item.data);
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    if (audioRef.current) {
                                      audioRef.current.src = url;
                                      audioRef.current.play();
                                    }
                                    setCurrentView('home');
                                  }}
                                  className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded text-[11px]"
                                >
                                  ▶️ Écouter
                                </button>
                                <button
                                  onClick={() => shareAudioItem(item.data, item.name)}
                                  className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#f9e2af] rounded text-[11px]"
                                  title="Partager"
                                >
                                  📤
                                </button>
                                <a
                                  href={item.data}
                                  download={`${item.name}.wav`}
                                  className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#a6e3a1] rounded text-[11px]"
                                >
                                  ⬇️
                                </a>
                                <button
                                  onClick={() => {
                                    const updated = { ...library };
                                    updated[proj].audios.splice(idx, 1);
                                    saveLibraryToStorage(updated);
                                  }}
                                  className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            );
                          })
                        )}
                      </div>

                      {/* Texts */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between pb-1">
                          <div className="text-xs font-semibold text-[#f9e2af]">📜 Scripts & Sous-titres (.txt / .srt) :</div>
                          {pData.texts.length > 0 && (
                            <button
                              onClick={async () => {
                                const allText = pData.texts
                                  .map(t => {
                                    const clean = t.content.includes('----------------------------------------\n\n')
                                      ? t.content.split('----------------------------------------\n\n')[1]
                                      : t.content;
                                    return (clean || t.content).trim();
                                  })
                                  .filter(Boolean)
                                  .join('\n\n---\n\n');
                                await copyToClipboard(allText);
                                setCopiedScriptId(`section-${proj}`);
                                setTimeout(() => setCopiedScriptId(null), 2000);
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                                copiedScriptId === `section-${proj}`
                                  ? 'bg-[#a6e3a1] text-[#11111b]'
                                  : 'bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] border border-[#89b4fa]/40'
                              }`}
                              title="Copier le script de cette section"
                            >
                              {copiedScriptId === `section-${proj}` ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Copié !</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copier le script</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        {pData.texts.length === 0 ? (
                          <div className="text-[11px] text-[#6c7086]">Aucun texte</div>
                        ) : (
                          pData.texts.map((item, idx) => {
                            const cleanExcerpt = (
                              item.content.includes('----------------------------------------\n\n')
                                ? item.content.split('----------------------------------------\n\n')[1]
                                : item.content
                            ) || item.content;
                            const preview = cleanExcerpt.trim().slice(0, 90) + (cleanExcerpt.trim().length > 90 ? '...' : '');

                            return (
                              <div key={item.id} className="bg-[#1e1e2e] p-2.5 rounded-lg text-xs space-y-1.5 border border-[#45475a]/30">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="font-medium text-[#cdd6f4] truncate max-w-[160px] sm:max-w-[220px]">
                                    📄 {item.name}
                                  </span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                      onClick={() => handleCopyScript(item.content, item.id)}
                                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 ${
                                        copiedScriptId === item.id 
                                          ? 'bg-[#a6e3a1] text-[#11111b] shadow-sm' 
                                          : 'bg-[#89b4fa]/15 hover:bg-[#89b4fa]/25 text-[#89b4fa] border border-[#89b4fa]/40'
                                      }`}
                                      title="Copier le script dans le presse-papier"
                                    >
                                      {copiedScriptId === item.id ? (
                                        <>
                                          <Check className="w-3.5 h-3.5" />
                                          <span>Copié !</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>Copier le script</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleUseScriptInStudio(item.content)}
                                      className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#fab387] rounded text-[11px] font-medium"
                                      title="Réutiliser le texte dans le Studio"
                                    >
                                      🎙️ Réutiliser
                                    </button>
                                    <button
                                      onClick={() => renameTextItem(proj, idx)}
                                      className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded text-[11px]"
                                      title="Renommer"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => shareTextItem(item.content, item.name)}
                                      className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#f9e2af] rounded text-[11px]"
                                      title="Partager"
                                    >
                                      📤
                                    </button>
                                    <button
                                      onClick={() => {
                                        const blob = new Blob([item.content], { type: 'text/plain;charset=utf-8' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${item.name}.txt`;
                                        a.click();
                                      }}
                                      className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded text-[11px]"
                                    >
                                      ⬇️ TXT
                                    </button>
                                    <button
                                      onClick={() => {
                                        const srt = generateSRT(item.content);
                                        const blob = new Blob([srt], { type: 'text/srt;charset=utf-8' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${item.name}.srt`;
                                        a.click();
                                      }}
                                      className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#fab387] rounded text-[11px]"
                                    >
                                      ⬇️ SRT
                                    </button>
                                    <button
                                      onClick={() => {
                                        const updated = { ...library };
                                        updated[proj].texts.splice(idx, 1);
                                        saveLibraryToStorage(updated);
                                      }}
                                      className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                {preview && (
                                  <div className="bg-[#181825] px-2.5 py-1.5 rounded text-[11px] text-[#a6adc8] italic line-clamp-2 border border-[#313244]">
                                    "{preview}"
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Videos (Google Flow / Veo 9:16) */}
                      <div className="space-y-1.5 pt-2 border-t border-[#45475a]/40">
                        <div className="flex items-center justify-between pb-1">
                          <div className="text-xs font-semibold text-[#89b4fa] flex items-center gap-1.5">
                            <span>🎞️ Séquences Vidéo 9:16 (Google Flow / Veo) :</span>
                          </div>
                          <label className="px-2.5 py-1 rounded bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] text-[11px] font-bold cursor-pointer flex items-center gap-1 shadow-sm transition-all">
                            <span>+ Importer Vidéo</span>
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/*"
                              onChange={(e) => handleVideoUpload(proj, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                        {(!pData.videos || pData.videos.length === 0) ? (
                          <div className="text-[11px] text-[#6c7086] italic py-1">
                            Aucune vidéo importée. Générez un clip 9:16 sur Google Flow et importez-le ici.
                          </div>
                        ) : (
                          pData.videos.map((vid, idx) => (
                            <div key={vid.id} className="flex items-center justify-between p-2 rounded-lg text-xs bg-[#1e1e2e] border border-[#313244]">
                              <div className="flex items-center gap-2 truncate max-w-[140px] sm:max-w-[210px]">
                                <span>📱</span>
                                <span className="truncate font-medium text-[#cdd6f4]" title={vid.name}>
                                  {vid.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setActiveVideoModal({ url: vid.data, title: vid.name })}
                                  className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-sm"
                                  title="Lire en format vertical 9:16"
                                >
                                  ▶️ Regarder
                                </button>
                                <a
                                  href={vid.data}
                                  download={`${vid.name}.mp4`}
                                  className="px-2 py-1 bg-[#313244] hover:bg-[#45475a] text-[#a6e3a1] rounded text-[11px]"
                                  title="Télécharger"
                                >
                                  ⬇️
                                </a>
                                <button
                                  onClick={() => {
                                    const updated = { ...library };
                                    updated[proj].videos?.splice(idx, 1);
                                    saveLibraryToStorage(updated);
                                    showToast("Vidéo supprimée.", "info");
                                  }}
                                  className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SETTINGS VIEW */}
        {currentView === 'settings' && (
          <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col items-center mb-1 text-center">
              <img
                src={studioLogo}
                alt="VoxArt"
                className="w-[70px] h-[70px] rounded-full object-cover border-2 border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.4)] mb-1.5 transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.triedPng) {
                    target.dataset.triedPng = 'true';
                    target.src = 'logo.png';
                  } else if (!target.dataset.triedJpg) {
                    target.dataset.triedJpg = 'true';
                    target.src = 'logo.jpg';
                  }
                }}
              />
              <h1 className="text-xl font-bold text-[#89b4fa]">Réglages de la Voix</h1>
              <div className="text-[10px] text-[#a6adc8] uppercase tracking-widest font-medium">Studio RidiaLArt-Vision</div>
            </div>
            
            <button
              onClick={() => setCurrentView('home')}
              className="py-2 px-4 rounded-xl bg-[#313244] text-[#89b4fa] font-semibold text-xs border border-[#89b4fa]/50 hover:bg-[#89b4fa] hover:text-[#11111b] transition-all"
            >
              ⬅️ Retour à l'accueil
            </button>

            {/* Thématique & Mode du Studio */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-[#a6adc8]">Thématique active & Mode du Studio :</label>
              <ThemeModeSelector
                currentMode={themeMode}
                onSelectMode={handleSelectThemeMode}
              />
            </div>

            <div className="space-y-1.5 mt-3 p-3 bg-[#1e1e2e]/80 rounded-xl border border-[#45475a]/50">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#89b4fa]">🔑 Clé API Google AI Studio :</label>
                {apiKey ? (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">✓ Clé active</span>
                ) : (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">Optionnelle (par défaut)</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    const clean = e.target.value;
                    setApiKey(clean);
                  }}
                  placeholder="Collez votre clé API Gemini (ex: AIzaSy... ou AQ...)"
                  className="flex-1 p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm focus:outline-none focus:border-[#89b4fa]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = apiKey.trim();
                    setApiKey(clean);
                    showToast(clean ? "✓ Clé API synchronisée avec succès !" : "Clé API réinitialisée (clé du système active).", "success");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs shadow transition-all shrink-0 cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
              <p className="text-[11px] text-[#a6adc8] leading-relaxed">
                Vous pouvez intégrer ici la clé API de votre compte <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-[#89b4fa] underline hover:text-[#b4befe]">Google AI Studio</a> pour utiliser vos propres quotas sur l'assistant vocal, les analyses multimédias et les prompts 9:16.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs font-semibold text-[#a6adc8] mb-1">Domaine / Univers :</label>
                <select
                  value={domain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm"
                >
                  <option value="ridialart">⚡ RidiaLArt — Afrofuturisme Endogène & Oralité</option>
                  <option value="art">Création Artistique, Poésie & Conte</option>
                  <option value="cinema">Cinéma, Voix Off & Storytelling</option>
                  <option value="education">Pédagogie & Formation</option>
                  <option value="marketing">Pub, Marketing & Promotion</option>
                  <option value="journalism">Journalisme & Reportage</option>
                  <option value="general">Général & Neutre</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#a6adc8] mb-1">Langue de sortie :</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm"
                >
                  <option value="Français">Français</option>
                  <option value="Anglais">Anglais</option>
                  <option value="Wolof">Wolof</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#a6adc8] mb-1">Style / Intention :</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm"
                >
                  {(stylesMap[domain] || stylesMap.art).map((s, idx) => (
                    <option key={idx} value={s.val}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#a6adc8] mb-1">Timbre & Genre :</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm"
                >
                  <option value="voix masculine grave, profonde et résonnante (homme)">Homme (Grave & Profond)</option>
                  <option value="voix féminine mélodieuse, claire et expressive (femme)">Femme (Mélodieuse & Expressive)</option>
                  <option value="voix neutre, posée et feutrée">Neutre & Feutré</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#a6adc8] mb-1">Modèle TTS par défaut :</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm"
                >
                  <option value="gemini-3.8-flash-lite-tts">Flash Lite TTS (Rapide & Efficace)</option>
                  <option value="gemini-3.8-flash-tts">Flash TTS (Voix Design & Podcasts)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#a6adc8] mb-1">Voix Gemini Prebuilt :</label>
                <select
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm"
                >
                  {PRESET_VOICES.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {themeMode === 'ridialart' && (
              <div className="bg-[#2d1807]/80 p-3.5 rounded-xl border border-[#fbbf24]/30 space-y-2 text-xs">
                <div className="font-bold text-[#fbbf24] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#fbbf24]" />
                  <span>Modules RidiaLArt & Afrofuturisme Endogène Actifs</span>
                </div>
                <ul className="text-[11px] text-[#fde68a]/80 space-y-1 list-disc list-inside">
                  <li><strong>Polyrythmies Djembé & Sabar</strong> : Algorithmes euclidiens (Doundounba 12/8, Kuku, Sabar Kaolack, Dub Roots Sénégal).</li>
                  <li><strong>Synesthésie Plastique</strong> : Traduction spectrale FFT de la voix en ondes de forme et couleurs d'Afrique (or impérial, indigo, latérite).</li>
                  <li><strong>Export de la Toile Plastique</strong> : Téléchargement en PNG HD de l'empreinte graphique générée par votre audio.</li>
                </ul>
              </div>
            )}

            {/* PRÉRÉGLAGE DE SYNTHÈSE AUDIO PAR DÉFAUT */}
            <div className="bg-[#181825] p-4 rounded-xl border border-[#fbbf24]/30 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-[#fbbf24]" />
                  <span className="text-xs font-bold text-[#f9e2af]">Préréglage de Synthèse par Défaut à l'Ouverture</span>
                </div>
                {hasCustomDefaultPreset && (
                  <span className="text-[10px] bg-[#fbbf24]/20 text-[#fbbf24] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Personnalisé actif
                  </span>
                )}
              </div>
              
              <p className="text-[11px] text-[#a6adc8] leading-relaxed">
                Enregistrez vos paramètres actuels (Langue : <strong className="text-white">{language}</strong>, Voix : <strong className="text-white">{voiceName}</strong>, Modèle : <strong className="text-white">{model}</strong>, Timbre : <strong className="text-white">{genderText}</strong>, Pitch : <strong className="text-white">{voicePitch.toFixed(2)}x</strong>). Ils seront automatiquement restaurés par défaut à chaque lancement de l'application.
              </p>

              {defaultPresetInfo && (
                <div className="text-[10px] text-[#a6adc8] font-mono italic">
                  Dernier enregistrement : {defaultPresetInfo}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveDefaultPreset}
                  className="py-2 px-3 rounded-lg bg-gradient-to-r from-[#d97706] to-[#fbbf24] text-[#1c0f04] font-bold text-xs flex items-center justify-center gap-1.5 shadow hover:opacity-90 transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Enregistrer ces réglages par défaut</span>
                </button>

                {hasCustomDefaultPreset && (
                  <button
                    type="button"
                    onClick={handleResetDefaultPreset}
                    className="py-2 px-3 rounded-lg bg-[#313244] hover:bg-[#45475a] text-[#f38ba8] border border-[#f38ba8]/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Rétablir valeurs d'usine</span>
                  </button>
                )}
              </div>
            </div>

            <div className="bg-[#313244] p-3 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-[#a6adc8]">Test rapide des réglages :</label>
              <button
                onClick={handleTestVoice}
                disabled={isTesting}
                className="w-full py-2.5 rounded-lg bg-[#313244] border border-[#89b4fa] text-[#89b4fa] text-xs font-bold hover:bg-[#89b4fa] hover:text-[#11111b] transition-all flex items-center justify-center gap-2"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>🔊 Tester la voix sélectionnée</span>
              </button>
              {testAudioUrl && (
                <audio ref={testAudioRef} controls className="w-full accent-[#89b4fa] mt-2" src={testAudioUrl} />
              )}
            </div>

            <button
              onClick={() => setCurrentView('home')}
              className="w-full py-3 rounded-xl bg-[#89b4fa] text-[#11111b] font-bold text-sm shadow-md hover:bg-[#b4befe] transition-all"
            >
              Valider & Retourner à l'accueil
            </button>
          </div>
        )}

        {/* KNOWLEDGE BASE VIEW */}
        {currentView === 'knowledge_base' && (
          <KnowledgeBaseManager apiKey={apiKey} addToast={showToast} />
        )}

      </main>

      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border text-xs sm:text-sm font-medium transition-all transform animate-in fade-in slide-in-from-bottom-2 ${
              toast.type === 'error'
                ? 'bg-red-950/90 border-red-500/50 text-red-200'
                : toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : 'bg-[#1e1e2e]/95 border-[#89b4fa]/40 text-[#cdd6f4]'
            }`}
          >
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-[#89b4fa] shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="p-1 hover:bg-white/10 rounded transition-all text-[#a6adc8] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Safe Modal Dialog for Prompt and Confirm (Iframe & sandboxing friendly) */}
      {dialog && dialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1e1e2e] border border-[#45475a] p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#89b4fa] flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>{dialog.title}</span>
            </h3>
            {dialog.message && (
              <p className="text-sm text-[#a6adc8] leading-relaxed">{dialog.message}</p>
            )}
            {dialog.type === 'prompt' && (
              <input
                type="text"
                autoFocus
                value={dialogInputVal}
                onChange={(e) => setDialogInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    dialog.onConfirm(dialogInputVal);
                    setDialog(null);
                  } else if (e.key === 'Escape') {
                    setDialog(null);
                  }
                }}
                className="w-full p-3 rounded-xl border border-[#45475a] bg-[#313244] text-[#cdd6f4] text-sm focus:outline-none focus:border-[#89b4fa] ring-1 ring-transparent focus:ring-[#89b4fa]/30 transition-all"
              />
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="px-4 py-2 rounded-xl bg-[#313244] text-[#a6adc8] hover:text-white hover:bg-[#45475a] text-xs font-semibold transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  dialog.onConfirm(dialogInputVal);
                  setDialog(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#89b4fa] text-[#11111b] font-bold text-xs hover:bg-[#b4befe] transition-all shadow-md"
              >
                {dialog.confirmText || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9:16 Vertical Video Preview Modal */}
      {activeVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-[#1e1e2e] border border-[#45475a] p-5 shadow-2xl relative text-[#cdd6f4] flex flex-col items-center">
            <button
              onClick={() => setActiveVideoModal(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-[#a6adc8] hover:text-white hover:bg-[#313244] transition-all z-10"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-sm font-bold text-[#89b4fa] mb-3 truncate max-w-[260px]">
              📱 {activeVideoModal.title}
            </div>
            {/* 9:16 Vertical Container */}
            <div className="relative w-full aspect-[9/16] max-h-[70vh] bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-[#89b4fa]/40 flex items-center justify-center">
              <video
                src={activeVideoModal.url}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
            <div className="mt-4 w-full flex gap-2">
              <a
                href={activeVideoModal.url}
                download={`${activeVideoModal.title}.mp4`}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-bold text-white text-center hover:opacity-90 shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger (.mp4)</span>
              </a>
              <button
                onClick={() => setActiveVideoModal(null)}
                className="py-2.5 px-4 rounded-xl bg-[#313244] hover:bg-[#45475a] text-xs font-bold text-[#cdd6f4]"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Agent Chat Widget */}
      <AIAgentChat 
        currentText={text} 
        apiKey={apiKey} 
        onOpenSettings={() => setCurrentView('settings')} 
        addToast={showToast} 
        onTransferToVocalStudio={handleTransferFromAgent}
      />
    </div>
  );
}
