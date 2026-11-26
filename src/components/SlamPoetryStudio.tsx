/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Mic,
  Music,
  Sparkles,
  Play,
  Pause,
  Save,
  RefreshCw,
  Subtitles,
  Image as ImageIcon,
  ArrowLeft,
  Feather,
  Download,
  Upload,
  Volume2,
  Trash2,
  Sliders,
  Film,
  FolderOpen,
  Smartphone,
  Monitor,
  Square as SquareIcon,
} from 'lucide-react';
import { CustomVoiceProfile } from '../types/voiceProfile';
import { SoundscapeId } from '../types/rhythm';
import {
  BASE_GEMINI_VOICES,
  isCustomVoiceId,
  toCustomVoiceOptionId,
  resolveVoicePayloadForTTS,
} from '../utils/customVoiceStorage';
import { authFetch, apiAuthStore, safeJsonResponse } from '../services/apiAuth';
import { cleanTextForSpeech } from '../utils/textCleaner';
import { buildSlamSubtitles, computeSlamMetrics } from '../utils/slamMetrics';
import {
  DEFAULT_SOUNDSCAPES,
  TRADITIONAL_RHYTHM_PRESETS,
  playContinuousSoundscape,
  renderCompositionToWav,
} from '../utils/africanAudioEngine';
import {
  audioBufferToWavBlob,
  compressWavForUpload,
  exportAudioBlobAsWav,
  exportAudioDataAsWav,
  readSourceUrlToArrayBuffer,
  triggerSafeDownload,
  triggerHttpUrlDownload,
} from '../utils/audioExport';
import { renderStudioMixWithDucking } from '../utils/audioDuckingEngine';
import { SlamPoetryEditor } from './SlamPoetryEditor';
import { LiteraryExpertAssistant } from './LiteraryExpertAssistant';

interface SlamPoetryStudioProps {
  apiKey: string;
  customVoices: CustomVoiceProfile[];
  library: Record<string, any>;
  addToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
  onSaveAssetToProject: (projectName: string, category: 'audios' | 'texts' | 'videos', name: string, data: string) => void;
  onCreateProject?: (projectName: string) => void;
  onBackToHome: () => void;
}

interface Segment {
  start: number;
  end: number;
  text: string;
}

const DEFAULT_POEM_TEXT = `Dans l'écho des ruelles où le temps suspend son vol, [respiration]
Les mots s'entrechoquent et résonnent sur le sol.
[emphase]Slam de l'âme[/emphase], poésie des temps modernes et profonds, [pause]
Nous naviguons ensemble au cœur de nos horizons.`;

function formatSrtTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}

function sanitizeFileSlug(raw: string, fallback = 'VoxArt_Slam'): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_');
  return cleaned || fallback;
}

function triggerFileDownload(blob: Blob, filename: string) {
  void triggerSafeDownload(blob, filename);
}

function generatePoeticArtworkDataUrl(
  title: string,
  prompt: string,
  width = 720,
  height = 1280
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const seed = (title + prompt).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const palettes = [
    ['#0f172a', '#312e81', '#f59e0b'],
    ['#1c0f04', '#7c2d12', '#fbbf24'],
    ['#11111b', '#1e1b4b', '#38bdf8'],
    ['#090d16', '#3b0764', '#f472b6'],
  ];
  const [c1, c2, c3] = palettes[seed % palettes.length];

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, c1);
  grad.addColorStop(0.55, c2);
  grad.addColorStop(1, '#09090b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Atmospheric glowing halo orbs
  for (let i = 0; i < 5; i++) {
    const x = ((seed * (i + 3) * 137) % Math.max(200, width - 160)) + 80;
    const y = ((seed * (i + 5) * 89) % Math.max(200, height - 160)) + 80;
    const r = 130 + ((seed + i * 47) % 180);
    const orb = ctx.createRadialGradient(x, y, 8, x, y, r);
    orb.addColorStop(0, i % 2 === 0 ? `${c3}55` : '#89b4fa44');
    orb.addColorStop(1, 'transparent');
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle concentric acoustic rings
  ctx.strokeStyle = `${c3}30`;
  ctx.lineWidth = 2;
  for (let ring = 1; ring <= 6; ring++) {
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, ring * Math.min(width, height) * 0.085, 0, Math.PI * 2);
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  zoom = 1
) {
  const imgRatio = (img.naturalWidth || img.width || 1) / (img.naturalHeight || img.height || 1);
  const canvasRatio = canvasW / canvasH;
  let drawW = canvasW;
  let drawH = canvasH;
  if (imgRatio > canvasRatio) {
    drawH = canvasH * zoom;
    drawW = drawH * imgRatio;
  } else {
    drawW = canvasW * zoom;
    drawH = drawW / imgRatio;
  }
  const dx = (canvasW - drawW) / 2;
  const dy = (canvasH - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export const SlamPoetryStudio: React.FC<SlamPoetryStudioProps> = ({
  apiKey,
  customVoices,
  library,
  addToast,
  onSaveAssetToProject,
  onCreateProject,
  onBackToHome,
}) => {
  const projectNames = useMemo(() => Object.keys(library || {}), [library]);
  const [selectedProject, setSelectedProject] = useState<string>(projectNames[0] || 'Projet_Slam');
  const [newProjectInput, setNewProjectInput] = useState('');
  const [showNewProjInput, setShowNewProjInput] = useState(false);

  const availableProjects = useMemo(() => {
    const base = projectNames.length > 0 ? [...projectNames] : ['Projet_Slam'];
    if (selectedProject && selectedProject !== '__NEW__' && !base.includes(selectedProject)) {
      base.unshift(selectedProject);
    }
    return base;
  }, [projectNames, selectedProject]);

  const handleConfirmNewProject = () => {
    const trimmed = newProjectInput.trim();
    if (!trimmed) {
      addToast('Veuillez saisir un nom pour le nouveau projet.', 'info');
      return;
    }
    onCreateProject?.(trimmed);
    setSelectedProject(trimmed);
    setShowNewProjInput(false);
    setNewProjectInput('');
    addToast(`Projet « ${trimmed} » créé et sélectionné !`, 'success');
  };

  // Poem Text & Slam Cadence State
  const [poemText, setPoemText] = useState<string>(DEFAULT_POEM_TEXT);
  const [poemTitle, setPoemTitle] = useState<string>('Écho de l’Âme');
  const [cadenceWpm, setCadenceWpm] = useState<number>(130);
  const [targetDurationSec, setTargetDurationSec] = useState<number>(30);
  const [showLiteraryExpert, setShowLiteraryExpert] = useState<boolean>(false);

  const estimatedMetrics = useMemo(
    () => computeSlamMetrics(poemText, cadenceWpm),
    [poemText, cadenceWpm]
  );

  // Voice State
  const [selectedVoice, setSelectedVoice] = useState<string>('Charon');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState<boolean>(false);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [measuredVoiceDuration, setMeasuredVoiceDuration] = useState<number | null>(null);
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0);

  // Background Music State
  const [bgMusicUrl, setBgMusicUrl] = useState<string | null>(null);
  const [bgMusicTitle, setBgMusicTitle] = useState<string | null>(null);
  const [bgMusicDurationSec, setBgMusicDurationSec] = useState<number | null>(null);
  const [bgMusicVolume, setBgMusicVolume] = useState<number>(0.28);
  const [bgMusicSourceTab, setBgMusicSourceTab] = useState<'studio' | 'upload' | 'library'>('studio');
  const [isGeneratingBgMusic, setIsGeneratingBgMusic] = useState<boolean>(false);
  const [isPreviewingBgOnly, setIsPreviewingBgOnly] = useState<boolean>(false);

  // Mixed Audio State
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);
  const [mixedBlob, setMixedBlob] = useState<Blob | null>(null);
  const [isMixingAudio, setIsMixingAudio] = useState<boolean>(false);

  // Illustration / Image State
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState<string>('Afrofuturistic poetic art, neon colors, cinematic lighting, 8k');
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);

  // Video Format (9:16 Vertical Smartphone by default) & Subtitle Display Settings
  const [videoFormat, setVideoFormat] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [subtitlePosition, setSubtitlePosition] = useState<'bottom' | 'center' | 'top'>('bottom');
  const [subtitleStyle, setSubtitleStyle] = useState<'dark_white' | 'gold_slam' | 'neon_cyan'>('dark_white');
  const [subtitleSize, setSubtitleSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [videoExportProgress, setVideoExportProgress] = useState<number>(0);
  const [compiledVideoBlob, setCompiledVideoBlob] = useState<Blob | null>(null);
  const [compiledVideoUrl, setCompiledVideoUrl] = useState<string | null>(null);

  // Subtitles State
  const [segments, setSegments] = useState<Segment[]>([]);

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const effectiveDuration = measuredVoiceDuration || Math.max(4, estimatedMetrics.estimatedSeconds);

  // Flatten all saved library audio tracks so user can load them as background music
  const libraryAudioTracks = useMemo(() => {
    const items: Array<{ projectName: string; id: number; name: string; data: string }> = [];
    Object.entries(library || {}).forEach(([projName, projData]) => {
      const audios = Array.isArray(projData?.audios) ? projData.audios : [];
      audios.forEach((a: any) => {
        if (a?.data) {
          items.push({
            projectName: projName,
            id: a.id || Math.random(),
            name: a.name || 'Audio sans titre',
            data: a.data,
          });
        }
      });
    });
    return items;
  }, [library]);

  // Keep audio element volumes synchronized in real time
  useEffect(() => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.volume = Math.max(0, Math.min(1, voiceVolume));
    }
  }, [voiceVolume]);

  useEffect(() => {
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = Math.max(0, Math.min(1, bgMusicVolume));
    }
  }, [bgMusicVolume]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (voiceAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(voiceAudioUrl);
      if (bgMusicUrl?.startsWith('blob:')) URL.revokeObjectURL(bgMusicUrl);
      if (mixedAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(mixedAudioUrl);
      if (compiledVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(compiledVideoUrl);
    };
  }, []);

  // Measure background music duration whenever bgMusicUrl changes
  useEffect(() => {
    if (!bgMusicUrl) {
      setBgMusicDurationSec(null);
      return;
    }
    let cancelled = false;
    const probe = new Audio(bgMusicUrl);
    probe.onloadedmetadata = () => {
      if (!cancelled && probe.duration && Number.isFinite(probe.duration) && probe.duration > 0) {
        setBgMusicDurationSec(Math.round(probe.duration));
      }
    };
    return () => {
      cancelled = true;
    };
  }, [bgMusicUrl]);

  // Auto-generate smartphone-friendly SRT segments stripped of raw prosody tags
  useEffect(() => {
    const maxChars = videoFormat === '9:16' ? 38 : videoFormat === '1:1' ? 46 : 58;
    const generated = buildSlamSubtitles(poemText, effectiveDuration, maxChars);
    setSegments(generated);
  }, [poemText, effectiveDuration, videoFormat]);

  // Invalidate previous mix when voice or backing track changes
  const clearPreviousMix = () => {
    if (mixedAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(mixedAudioUrl);
    setMixedAudioUrl(null);
    setMixedBlob(null);
  };

  // Handle Voice Generation via TTS
  const handleGenerateVoice = async () => {
    const clean = cleanTextForSpeech(poemText.trim());
    if (!clean) {
      addToast('Veuillez saisir un texte de poème ou de slam.', 'info');
      return;
    }

    setIsGeneratingVoice(true);
    const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();
    const resolved = resolveVoicePayloadForTTS(
      selectedVoice,
      customVoices,
      'gemini-3.8-flash-lite-tts',
      'Masculin / Neutre',
      `voix posée, expressive et théâtrale pour slam et poésie (débit ~${cadenceWpm} mots/min)`
    );

    try {
      const response = await authFetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          voiceName: resolved.voiceName,
          model: resolved.model,
          language: 'Français',
          gender: resolved.gender,
          style: resolved.style,
          customVoiceStyle: resolved.customVoiceStyle,
          apiKey: effectiveKey,
        }),
      }, effectiveKey);

      const data = await safeJsonResponse<any>(response, 'du moteur vocal');
      if (!response.ok || !data.audio || data.fallback) {
        throw new Error(data.error || data.message || 'Erreur lors de la génération vocale');
      }

      const binary = atob(data.audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const isRiffWav =
        bytes.length >= 4 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46;
      const blob = new Blob([bytes], { type: isRiffWav ? 'audio/wav' : 'audio/mp3' });
      const url = URL.createObjectURL(blob);

      if (voiceAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(voiceAudioUrl);
      setVoiceAudioUrl(url);
      setVoiceBlob(blob);
      clearPreviousMix();

      // Measure duration
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
          setMeasuredVoiceDuration(audio.duration);
        }
      };

      addToast('Voix off de slam générée ! Vous pouvez la télécharger en WAV.', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Erreur lors de la synthèse vocale.', 'error');
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  // Apply Traditional Rhythm Preset as local WAV backing track
  const handleApplyStudioRhythm = async (presetId: string) => {
    const preset = TRADITIONAL_RHYTHM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setIsGeneratingBgMusic(true);
    try {
      const wavBlob = await renderCompositionToWav(preset, 4);
      const nextUrl = URL.createObjectURL(wavBlob);
      if (bgMusicUrl?.startsWith('blob:')) URL.revokeObjectURL(bgMusicUrl);
      setBgMusicUrl(nextUrl);
      setBgMusicTitle(`🥁 ${preset.name}`);
      setIsPreviewingBgOnly(false);
      clearPreviousMix();
      addToast(`Musique de fond "${preset.name}" ajoutée !`, 'success');
    } catch (err) {
      console.error('Rhythm render error:', err);
      addToast('Erreur lors de la génération du rythme musical.', 'error');
    } finally {
      setIsGeneratingBgMusic(false);
    }
  };

  // Apply Natural Soundscape as local WAV backing track
  const handleApplySoundscape = async (scId: SoundscapeId, title: string) => {
    setIsGeneratingBgMusic(true);
    try {
      const sampleRate = 44100;
      const duration = 16;
      const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
      const gainNode = offlineCtx.createGain();
      gainNode.gain.setValueAtTime(0.75, 0);
      gainNode.connect(offlineCtx.destination);

      playContinuousSoundscape(offlineCtx, scId, 0, duration, 0.7, 0, gainNode);
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWavBlob(renderedBuffer);
      const nextUrl = URL.createObjectURL(wavBlob);

      if (bgMusicUrl?.startsWith('blob:')) URL.revokeObjectURL(bgMusicUrl);
      setBgMusicUrl(nextUrl);
      setBgMusicTitle(`🌿 ${title}`);
      setIsPreviewingBgOnly(false);
      clearPreviousMix();
      addToast(`Ambiance "${title}" ajoutée comme fond sonore !`, 'success');
    } catch (err) {
      console.error('Soundscape render error:', err);
      addToast("Erreur lors de la création de l'ambiance sonore.", 'error');
    } finally {
      setIsGeneratingBgMusic(false);
    }
  };

  // Import local background music file (MP3, WAV, M4A, OGG...)
  const handleUploadBgMusicFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      addToast('Veuillez sélectionner un fichier audio valide (.mp3, .wav, .m4a, .ogg).', 'error');
      e.target.value = '';
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    if (bgMusicUrl?.startsWith('blob:')) URL.revokeObjectURL(bgMusicUrl);
    setBgMusicUrl(nextUrl);
    setBgMusicTitle(`🎵 ${cleanName}`);
    setIsPreviewingBgOnly(false);
    clearPreviousMix();
    addToast(`Musique "${cleanName}" importée comme fond !`, 'success');
    e.target.value = '';
  };

  // Load backing music from Library
  const handleSelectLibraryTrack = (track: { projectName: string; name: string; data: string }) => {
    if (bgMusicUrl?.startsWith('blob:')) URL.revokeObjectURL(bgMusicUrl);
    setBgMusicUrl(track.data);
    setBgMusicTitle(`📚 ${track.name} (${track.projectName})`);
    setIsPreviewingBgOnly(false);
    clearPreviousMix();
    addToast(`Piste "${track.name}" ajoutée depuis la bibliothèque !`, 'success');
  };

  const handleRemoveBgMusic = () => {
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
    }
    if (bgMusicUrl?.startsWith('blob:')) URL.revokeObjectURL(bgMusicUrl);
    setBgMusicUrl(null);
    setBgMusicTitle(null);
    setIsPreviewingBgOnly(false);
    clearPreviousMix();
    addToast('Musique de fond retirée.', 'info');
  };

  const togglePreviewBgMusicOnly = () => {
    if (!musicAudioRef.current || !bgMusicUrl) return;
    if (isPreviewingBgOnly) {
      musicAudioRef.current.pause();
      setIsPreviewingBgOnly(false);
    } else {
      musicAudioRef.current.volume = Math.max(0, Math.min(1, bgMusicVolume));
      musicAudioRef.current.play().catch(() => {});
      setIsPreviewingBgOnly(true);
    }
  };

  // Render mixed WAV (Voice + Background Music with Broadcast EQ & Ducking)
  const buildMixedAudioBlob = async (): Promise<Blob | null> => {
    if (!voiceBlob) return null;
    if (!bgMusicUrl) return voiceBlob;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) throw new Error('AudioContext non supporté par ce navigateur.');

    const ctx = new AudioCtx();
    try {
      const voiceArrayBuffer = await voiceBlob.arrayBuffer();
      const voiceBuffer = await ctx.decodeAudioData(voiceArrayBuffer.slice(0));

      const { buffer: bgArrayBuffer } = await readSourceUrlToArrayBuffer(bgMusicUrl);
      const backingBuffer = await ctx.decodeAudioData(bgArrayBuffer.slice(0));

      const mixedBuffer = await renderStudioMixWithDucking(voiceBuffer, backingBuffer, {
        voiceVolume,
        backingVolume: bgMusicVolume,
        duckingAmountDb: -10,
        eqEnabled: true,
      });

      // Trim to voice duration + smooth 1.8s musical outro tail so track doesn't drag past poem end
      const targetFrames = Math.min(
        mixedBuffer.length,
        Math.ceil((voiceBuffer.duration + 1.8) * mixedBuffer.sampleRate)
      );
      if (targetFrames < mixedBuffer.length && targetFrames > 0) {
        const trimmedCtx = new OfflineAudioContext(
          mixedBuffer.numberOfChannels,
          targetFrames,
          mixedBuffer.sampleRate
        );
        const src = trimmedCtx.createBufferSource();
        src.buffer = mixedBuffer;
        const fadeGain = trimmedCtx.createGain();
        const fadeStart = Math.max(0, voiceBuffer.duration + 0.1);
        const endSec = targetFrames / mixedBuffer.sampleRate;
        fadeGain.gain.setValueAtTime(1, 0);
        fadeGain.gain.setValueAtTime(1, fadeStart);
        fadeGain.gain.linearRampToValueAtTime(0, endSec);
        src.connect(fadeGain);
        fadeGain.connect(trimmedCtx.destination);
        src.start(0);
        const finalBuf = await trimmedCtx.startRendering();
        return audioBufferToWavBlob(finalBuf);
      }

      return audioBufferToWavBlob(mixedBuffer);
    } finally {
      ctx.close().catch(() => {});
    }
  };

  // Download generated voice WAV directly from in-memory Blob (never fetch blob: URL)
  const handleDownloadVoiceWav = async () => {
    if (!voiceBlob && !voiceAudioUrl) {
      addToast('Générez d’abord la voix off narrative.', 'info');
      return;
    }
    try {
      const slug = `${sanitizeFileSlug(poemTitle)}_Voix`;
      if (voiceBlob) {
        await exportAudioBlobAsWav(voiceBlob, slug);
      } else if (voiceAudioUrl) {
        await exportAudioDataAsWav(voiceAudioUrl, slug);
      }
      addToast('Voix générée téléchargée en .WAV !', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Erreur lors du téléchargement WAV.', 'error');
    }
  };

  // Mix Voice + Background Music & Download WAV
  const handleMixAndDownloadWav = async () => {
    if (!voiceBlob || !voiceAudioUrl) {
      addToast('Générez d’abord la voix off narrative.', 'info');
      return;
    }
    if (!bgMusicUrl) {
      await handleDownloadVoiceWav();
      return;
    }

    setIsMixingAudio(true);
    try {
      const resultBlob = await buildMixedAudioBlob();
      if (!resultBlob) return;
      const nextMixUrl = URL.createObjectURL(resultBlob);
      if (mixedAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(mixedAudioUrl);
      setMixedBlob(resultBlob);
      setMixedAudioUrl(nextMixUrl);

      triggerFileDownload(resultBlob, `${sanitizeFileSlug(poemTitle)}_Mix_Slam.wav`);
      addToast('Mix (Voix + Musique de fond) compilé et téléchargé en .WAV !', 'success');
    } catch (err: any) {
      console.error('Slam mix download error:', err);
      addToast(err?.message || 'Erreur lors du mixage audio.', 'error');
    } finally {
      setIsMixingAudio(false);
    }
  };

  // Download SRT subtitles
  const handleDownloadSrt = () => {
    if (segments.length === 0) {
      addToast('Aucun sous-titre à exporter.', 'info');
      return;
    }
    const srtContent = segments
      .map(
        (seg, idx) =>
          `${idx + 1}\n${formatSrtTimestamp(seg.start)} --> ${formatSrtTimestamp(seg.end)}\n${seg.text}`
      )
      .join('\n\n');
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    triggerFileDownload(blob, `${sanitizeFileSlug(poemTitle)}_SousTitres.srt`);
    addToast('Fichier sous-titres .SRT téléchargé !', 'success');
  };

  // Handle AI / Procedural Artwork Generation or Image Upload matching selected aspect ratio
  const handleGenerateIllustration = async () => {
    setIsGeneratingImage(true);
    try {
      const w = videoFormat === '9:16' ? 720 : videoFormat === '1:1' ? 1080 : 1280;
      const h = videoFormat === '9:16' ? 1280 : videoFormat === '1:1' ? 1080 : 720;
      const dataUrl = generatePoeticArtworkDataUrl(poemTitle, imagePrompt, w, h);
      setImageUrl(dataUrl);
      addToast(`Illustration artistique générée (${videoFormat}) !`, 'success');
    } catch {
      addToast('Erreur lors de la génération de l’illustration.', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleUploadIllustration = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast('Veuillez sélectionner une image (.jpg, .png, .webp).', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setImageUrl(ev.target.result);
        addToast('Image chargée pour la vidéo slam !', 'success');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Export complete Slam Video to universal mobile MP4 (H.264 Main@L4.0 + AAC-LC 44.1kHz stereo)
  const handleCompileAndDownloadVideo = async () => {
    if (!voiceBlob) {
      addToast('Générez d’abord la voix off avant de compiler la vidéo.', 'info');
      return;
    }

    setIsExportingVideo(true);
    setVideoExportProgress(8);

    let progressTimer: number | null = null;
    try {
      const audioBlobForVideo = bgMusicUrl ? await buildMixedAudioBlob() : voiceBlob;
      if (!audioBlobForVideo) throw new Error('Audio indisponible pour la vidéo.');
      setVideoExportProgress(22);

      // Measure exact audio duration when AudioContext is available
      let totalDur = Math.max(2, effectiveDuration);
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const audioAb = await audioBlobForVideo.arrayBuffer();
          const decodedAudio = await audioCtx.decodeAudioData(audioAb.slice(0));
          totalDur = Math.max(2, decodedAudio.duration);
          audioCtx.close().catch(() => {});
        }
      } catch {
        // Fallback to effectiveDuration probed server-side by ffprobe
      }

      const width = videoFormat === '9:16' ? 720 : videoFormat === '1:1' ? 1080 : 1280;
      const height = videoFormat === '9:16' ? 1280 : videoFormat === '1:1' ? 1080 : 720;
      const isVertical = videoFormat === '9:16';

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D indisponible.');

      let bgImg: HTMLImageElement | null = null;
      if (imageUrl) {
        bgImg = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = imageUrl;
        });
      }

      // Draw crisp base backdrop + subtle dark overlay + title watermark
      if (bgImg) {
        drawImageCover(ctx, bgImg, width, height, 1.02);
        ctx.fillStyle = 'rgba(10, 10, 18, 0.45)';
        ctx.fillRect(0, 0, width, height);
      } else {
        const g = ctx.createLinearGradient(0, 0, width, height);
        g.addColorStop(0, '#1e1b4b');
        g.addColorStop(0.5, '#181825');
        g.addColorStop(1, '#09090b');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f59e0b';
      ctx.font = `bold ${isVertical ? 26 : 28}px sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText(poemTitle.toUpperCase(), width / 2, isVertical ? 96 : 68, width - 80);
      ctx.shadowBlur = 0;

      const fontPx =
        subtitleSize === 'sm'
          ? isVertical ? 30 : 32
          : subtitleSize === 'lg'
          ? isVertical ? 42 : 46
          : isVertical ? 36 : 40;

      // Pre-wrap subtitle cues to fit exact canvas bounds
      ctx.font = `bold ${fontPx}px sans-serif`;
      const maxTextWidth = width - (isVertical ? 110 : 190);
      const wrappedSegments = segments.map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: wrapCanvasLines(ctx, seg.text, maxTextWidth).join('\n') || seg.text,
      }));

      const backdropBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );
      setVideoExportProgress(38);

      const uploadAudioBlob = await compressWavForUpload(audioBlobForVideo, 22050);

      const formData = new FormData();
      const audioExt = uploadAudioBlob.type.includes('mp3') || uploadAudioBlob.type.includes('mpeg') ? 'mp3' : 'wav';
      formData.append('audio', uploadAudioBlob, `slam-audio.${audioExt}`);
      if (backdropBlob) {
        formData.append('image', backdropBlob, 'slam-backdrop.jpg');
      }
      const fileName = `${sanitizeFileSlug(poemTitle)}_${videoFormat.replace(':', 'x')}.mp4`;
      formData.append('outputFilename', fileName);
      formData.append('responseMode', 'json');
      formData.append('width', String(width));
      formData.append('height', String(height));
      formData.append('durationSec', String(totalDur));
      formData.append('subtitleStyle', subtitleStyle);
      formData.append('subtitlePosition', subtitlePosition);
      formData.append('subtitleFontPx', String(fontPx));
      formData.append('segmentsJson', JSON.stringify(wrappedSegments));

      progressTimer = window.setInterval(() => {
        setVideoExportProgress((prev) => (prev < 92 ? prev + 3 : prev));
      }, 350);

      const response = await authFetch('/api/compile-slam-video', {
        method: 'POST',
        body: formData,
      });

      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!response.ok) {
        const errJson = await safeJsonResponse<any>(response, 'du compilateur vidéo').catch((e) => ({ error: e?.message }));
        throw new Error(errJson.error || 'Échec de la compilation MP4 côté serveur.');
      }

      if (contentType.includes('application/json')) {
        const compileData = await safeJsonResponse<{ url: string; filename?: string }>(response, 'du compilateur vidéo');
        if (!compileData?.url) {
          throw new Error('Lien de téléchargement MP4 manquant dans la réponse serveur.');
        }
        if (compiledVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(compiledVideoUrl);
        setCompiledVideoBlob(null);
        setCompiledVideoUrl(compileData.url);
        triggerHttpUrlDownload(compileData.url, compileData.filename || fileName);
      } else {
        const directUrl = response.headers.get('X-Download-Url');
        const mp4Buffer = await response.arrayBuffer();
        const videoBlob = new Blob([mp4Buffer], { type: 'video/mp4' });
        if (compiledVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(compiledVideoUrl);
        const nextUrl = URL.createObjectURL(videoBlob);
        setCompiledVideoBlob(videoBlob);
        setCompiledVideoUrl(nextUrl);

        if (directUrl) {
          triggerHttpUrlDownload(directUrl, fileName);
        } else {
          await triggerSafeDownload(videoBlob, fileName);
        }
      }
      setVideoExportProgress(100);
      addToast(`Vidéo MP4 (${videoFormat}) compatible InShot, CapCut et mobile téléchargée !`, 'success');
    } catch (err: any) {
      console.error('Video compile error:', err);
      addToast(err?.message || 'Erreur lors de la compilation vidéo MP4.', 'error');
    } finally {
      if (progressTimer !== null) clearInterval(progressTimer);
      setIsExportingVideo(false);
    }
  };

  // Handle Play/Pause (Synchronized Voice + Backing Music)
  const togglePlay = () => {
    if (!voiceAudioUrl) {
      addToast('Générez d’abord la voix off audio.', 'info');
      return;
    }

    if (isPreviewingBgOnly && musicAudioRef.current) {
      musicAudioRef.current.pause();
      setIsPreviewingBgOnly(false);
    }

    if (isPlaying) {
      setIsPlaying(false);
      if (voiceAudioRef.current) voiceAudioRef.current.pause();
      if (musicAudioRef.current) musicAudioRef.current.pause();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    } else {
      setIsPlaying(true);
      if (voiceAudioRef.current) {
        voiceAudioRef.current.volume = Math.max(0, Math.min(1, voiceVolume));
        voiceAudioRef.current.currentTime = currentTime;
        voiceAudioRef.current.play().catch(() => {});
      }
      if (musicAudioRef.current && bgMusicUrl) {
        musicAudioRef.current.currentTime = currentTime % (musicAudioRef.current.duration || 10);
        musicAudioRef.current.volume = Math.max(0, Math.min(1, bgMusicVolume));
        musicAudioRef.current.play().catch(() => {});
      }

      const startTime = performance.now() - currentTime * 1000;
      const updateTime = () => {
        const audioPos =
          voiceAudioRef.current && !voiceAudioRef.current.paused
            ? voiceAudioRef.current.currentTime
            : (performance.now() - startTime) / 1000;
        if (audioPos >= effectiveDuration) {
          setIsPlaying(false);
          setCurrentTime(0);
          if (musicAudioRef.current) musicAudioRef.current.pause();
          return;
        }
        setCurrentTime(audioPos);
        animFrameRef.current = requestAnimationFrame(updateTime);
      };
      animFrameRef.current = requestAnimationFrame(updateTime);
    }
  };

  // Save assets to project library (saves mixed audio if available, otherwise voice audio, plus poem text)
  const handleSaveToLibrary = () => {
    const typedNewName = showNewProjInput ? newProjectInput.trim() : '';
    const pName = typedNewName || (selectedProject !== '__NEW__' ? selectedProject.trim() : '') || 'Projet_Slam';
    if (typedNewName) {
      onCreateProject?.(typedNewName);
      setSelectedProject(typedNewName);
      setShowNewProjInput(false);
      setNewProjectInput('');
    }
    const blobToSave = mixedBlob || voiceBlob;
    const audioSuffix = mixedBlob ? 'Mix Slam' : 'Voix';

    if (blobToSave) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          onSaveAssetToProject(pName, 'audios', `${poemTitle} (${audioSuffix})`, dataUrl);
        }
      };
      reader.readAsDataURL(blobToSave);
    }
    if (poemText) {
      onSaveAssetToProject(pName, 'texts', `${poemTitle} (Poème)`, poemText);
    }
    if (compiledVideoBlob && compiledVideoBlob.size <= 15 * 1024 * 1024) {
      const vidReader = new FileReader();
      vidReader.onload = (e) => {
        const vidDataUrl = e.target?.result as string;
        if (vidDataUrl) {
          onSaveAssetToProject(pName, 'videos', `${poemTitle} (${videoFormat})`, vidDataUrl);
        }
      };
      vidReader.readAsDataURL(compiledVideoBlob);
    }
    if (!blobToSave && !poemText.trim()) {
      addToast('Rien à enregistrer : saisissez un texte ou générez un audio.', 'info');
    }
  };

  return (
    <div className="bg-[#1e1e2e] border border-[#f59e0b]/40 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-[#313244]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="p-2 rounded-xl bg-[#313244] text-[#89b4fa] hover:bg-[#89b4fa] hover:text-[#11111b] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#f59e0b] flex items-center gap-2">
              <Mic className="w-5 h-5" />
              <span>Studio Slam & Poésie</span>
            </h1>
            <p className="text-xs text-[#a6adc8]">
              Écrivez avec le compteur slam, générez et téléchargez la voix off, ajoutez une musique de fond et exportez audio ou vidéo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => setShowLiteraryExpert((prev) => !prev)}
            className={`min-h-[40px] px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer border transition-colors ${
              showLiteraryExpert
                ? 'bg-[#cba6f7] text-[#11111b] border-[#cba6f7]'
                : 'bg-[#181825] text-[#cba6f7] border-[#cba6f7]/45 hover:border-[#cba6f7]'
            }`}
          >
            <Feather className="w-4 h-4" />
            <span>Assistant Littéraire Expert</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToLibrary}
            className="flex-1 sm:flex-none min-h-[40px] px-4 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-[#11111b] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer au Projet</span>
          </button>
        </div>
      </div>

      {/* Panneau Assistant Expert Littérature, Histoire & Poésie */}
      {showLiteraryExpert && (
        <LiteraryExpertAssistant
          currentText={poemText}
          apiKey={apiKey}
          language="Français"
          cadenceWpm={cadenceWpm}
          onChangeCadenceWpm={setCadenceWpm}
          targetDurationSec={targetDurationSec}
          onChangeTargetDurationSec={setTargetDurationSec}
          bgMusicDurationSec={bgMusicDurationSec}
          onApplyPoem={(poem) => {
            setPoemText(poem);
            setMeasuredVoiceDuration(null);
          }}
          onAppendPoem={(poem) => {
            setPoemText((prev) => (prev.trim() ? `${prev.trim()}\n\n${poem}` : poem));
            setMeasuredVoiceDuration(null);
          }}
          onClose={() => setShowLiteraryExpert(false)}
          addToast={addToast}
        />
      )}

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Poem Editor, Voice, Download & Background Music */}
        <div className="space-y-4">
          {/* Project & Title selector */}
          <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#89b4fa]">
                Projet Cible :{' '}
                {!showNewProjInput && (
                  <span className="text-[#fbbf24] font-bold">{selectedProject}</span>
                )}
              </label>
              <button
                type="button"
                onClick={() => setShowNewProjInput((prev) => !prev)}
                className="text-[11px] font-semibold text-[#f59e0b] hover:underline cursor-pointer"
              >
                {showNewProjInput ? 'Annuler' : '+ Nouveau projet'}
              </button>
            </div>
            {showNewProjInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newProjectInput}
                  onChange={(e) => setNewProjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmNewProject();
                    }
                  }}
                  placeholder="Nom du nouveau projet..."
                  className="flex-1 p-2 rounded-lg bg-[#313244] border border-[#f59e0b]/40 text-xs text-[#cdd6f4] focus:outline-none focus:border-[#f59e0b]"
                />
                <button
                  type="button"
                  onClick={handleConfirmNewProject}
                  className="px-3.5 py-1.5 bg-[#f59e0b] hover:bg-[#fbbf24] text-[#11111b] text-xs font-bold rounded-lg cursor-pointer shrink-0"
                >
                  Créer
                </button>
              </div>
            ) : (
              <select
                value={selectedProject}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__NEW__') {
                    setShowNewProjInput(true);
                  } else {
                    setSelectedProject(val);
                  }
                }}
                className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-xs text-[#cdd6f4] cursor-pointer"
              >
                {availableProjects.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="__NEW__">+ Créer un nouveau projet...</option>
              </select>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#a6adc8]">Titre du Poème / Slam :</label>
                <input
                  type="text"
                  value={poemTitle}
                  onChange={(e) => setPoemTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-xs text-[#cdd6f4]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#a6adc8]">Voix Narrative :</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-xs text-[#cdd6f4]"
                >
                  {customVoices.length > 0 && (
                    <optgroup label="Mes Voix Personnalisées">
                      {customVoices.map((cv) => (
                        <option key={cv.id} value={toCustomVoiceOptionId(cv.id)}>
                          ★ {cv.name} ({cv.baseVoiceName})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Voix Studio Gemini">
                    {BASE_GEMINI_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} ({v.gender})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* Dedicated Slam/Poetry Input Interface with Voice Generation & Immediate Download */}
          <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] space-y-3">
            <SlamPoetryEditor
              value={poemText}
              onChange={(val) => {
                setPoemText(val);
                if (measuredVoiceDuration) setMeasuredVoiceDuration(null);
              }}
              cadenceWpm={cadenceWpm}
              onChangeCadenceWpm={setCadenceWpm}
              targetDurationSec={targetDurationSec}
              onChangeTargetDurationSec={setTargetDurationSec}
              onOpenLiteraryAssistant={() => setShowLiteraryExpert(true)}
              accentColor="amber"
              label="Texte du Poème / Slam"
              onNotify={addToast}
            />

            <button
              type="button"
              onClick={handleGenerateVoice}
              disabled={isGeneratingVoice || !poemText.trim()}
              className="w-full min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] text-[#11111b] font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
            >
              {isGeneratingVoice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              <span>
                {isGeneratingVoice
                  ? 'Synthèse vocale en cours...'
                  : `🎙️ Générer la Voix Off Narrative (${isCustomVoiceId(selectedVoice) ? 'Voix Perso' : selectedVoice})`}
              </span>
            </button>

            {/* Immediate Generated Audio & Download Bar */}
            {voiceAudioUrl && (
              <div className="p-3 rounded-xl bg-[#11111b] border border-emerald-500/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Audio généré prêt ({effectiveDuration.toFixed(1)}s)</span>
                  </div>
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{isPlaying ? 'Pause' : 'Écouter'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadVoiceWav}
                    className="min-h-[38px] px-3 py-2 rounded-lg bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger Voix (WAV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleMixAndDownloadWav}
                    disabled={isMixingAudio}
                    className="min-h-[38px] px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#11111b] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isMixingAudio ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sliders className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {bgMusicUrl
                        ? 'Mixer & Télécharger (WAV)'
                        : 'Exporter Audio (WAV)'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dedicated Background Music Panel (Upload, Studio Rhythms/Soundscapes, Library) */}
          <div className="p-4 bg-[#181825] rounded-xl border border-[#89b4fa]/35 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-[#89b4fa]" />
                <h3 className="text-xs font-bold text-[#cdd6f4]">Ajouter une Musique de Fond</h3>
              </div>
              {bgMusicUrl && (
                <button
                  type="button"
                  onClick={handleRemoveBgMusic}
                  className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Retirer</span>
                </button>
              )}
            </div>

            {/* Source Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#11111b] border border-[#313244]">
              <button
                type="button"
                onClick={() => setBgMusicSourceTab('studio')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  bgMusicSourceTab === 'studio'
                    ? 'bg-[#89b4fa] text-[#11111b]'
                    : 'text-[#a6adc8] hover:text-[#cdd6f4]'
                }`}
              >
                Rythmes Studio
              </button>
              <button
                type="button"
                onClick={() => setBgMusicSourceTab('upload')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  bgMusicSourceTab === 'upload'
                    ? 'bg-[#89b4fa] text-[#11111b]'
                    : 'text-[#a6adc8] hover:text-[#cdd6f4]'
                }`}
              >
                Importer Audio
              </button>
              <button
                type="button"
                onClick={() => setBgMusicSourceTab('library')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  bgMusicSourceTab === 'library'
                    ? 'bg-[#89b4fa] text-[#11111b]'
                    : 'text-[#a6adc8] hover:text-[#cdd6f4]'
                }`}
              >
                Bibliothèque ({libraryAudioTracks.length})
              </button>
            </div>

            {bgMusicSourceTab === 'studio' && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-[#a6adc8]">Instruments & Rythmes Traditionnels (générés en WAV) :</label>
                  <select
                    defaultValue=""
                    disabled={isGeneratingBgMusic}
                    onChange={(e) => {
                      if (e.target.value) handleApplyStudioRhythm(e.target.value);
                    }}
                    className="w-full p-2.5 rounded-xl bg-[#11111b] border border-[#313244] text-xs text-[#cdd6f4] cursor-pointer"
                  >
                    <option value="">-- Choisir un fond musical / instrumental --</option>
                    {TRADITIONAL_RHYTHM_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.bpm} BPM)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-[#a6adc8]">Ambiances Poétiques Naturelles :</label>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_SOUNDSCAPES.map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        disabled={isGeneratingBgMusic}
                        onClick={() => handleApplySoundscape(sc.id, sc.name)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#11111b] hover:bg-[#313244] border border-[#313244] text-[11px] text-[#cdd6f4] cursor-pointer disabled:opacity-50"
                      >
                        🌿 {sc.name}
                      </button>
                    ))}
                  </div>
                </div>

                {isGeneratingBgMusic && (
                  <div className="flex items-center gap-2 text-[11px] text-[#89b4fa]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthèse du fond musical en cours...</span>
                  </div>
                )}
              </div>
            )}

            {bgMusicSourceTab === 'upload' && (
              <div className="space-y-2">
                <input
                  ref={bgFileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleUploadBgMusicFile}
                />
                <button
                  type="button"
                  onClick={() => bgFileInputRef.current?.click()}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#11111b] hover:bg-[#313244] border border-dashed border-[#89b4fa]/60 text-[#89b4fa] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Importer une musique depuis votre appareil (.mp3, .wav, .m4a...)</span>
                </button>
              </div>
            )}

            {bgMusicSourceTab === 'library' && (
              <div className="space-y-2">
                {libraryAudioTracks.length === 0 ? (
                  <p className="text-[11px] text-[#6c7086] py-2">
                    Aucun audio enregistré dans vos projets pour le moment.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {libraryAudioTracks.map((track) => (
                      <button
                        key={`${track.projectName}-${track.id}`}
                        type="button"
                        onClick={() => handleSelectLibraryTrack(track)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-[#11111b] hover:bg-[#313244] border border-[#313244] text-xs text-[#cdd6f4] flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span className="truncate flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                          <span className="truncate">{track.name}</span>
                        </span>
                        <span className="text-[10px] text-[#6c7086] shrink-0">{track.projectName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Background Track + Mix Volumes */}
            {bgMusicUrl && (
              <div className="p-3 rounded-xl bg-[#11111b] border border-[#89b4fa]/40 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#89b4fa] truncate">
                    Fond actif : {bgMusicTitle || 'Musique sélectionnée'}
                  </span>
                  <button
                    type="button"
                    onClick={togglePreviewBgMusicOnly}
                    className="px-2.5 py-1 rounded-lg bg-[#89b4fa]/15 text-[#89b4fa] border border-[#89b4fa]/40 text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {isPreviewingBgOnly ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{isPreviewingBgOnly ? 'Stop' : 'Tester'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <label className="space-y-1 text-[#a6adc8]">
                    <div className="flex justify-between">
                      <span>Volume Voix</span>
                      <span className="font-mono text-[#cdd6f4]">{Math.round(voiceVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={1.4}
                      step={0.05}
                      value={voiceVolume}
                      onChange={(e) => {
                        setVoiceVolume(parseFloat(e.target.value));
                        clearPreviousMix();
                      }}
                      className="w-full accent-[#f59e0b]"
                    />
                  </label>

                  <label className="space-y-1 text-[#a6adc8]">
                    <div className="flex justify-between">
                      <span>Volume Musique</span>
                      <span className="font-mono text-[#cdd6f4]">{Math.round(bgMusicVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={0.9}
                      step={0.05}
                      value={bgMusicVolume}
                      onChange={(e) => {
                        setBgMusicVolume(parseFloat(e.target.value));
                        clearPreviousMix();
                      }}
                      className="w-full accent-[#89b4fa]"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Illustration Upload or Generation */}
          <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[#f59e0b] flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Illustration / Arrière-plan Vidéo</span>
              </label>
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadIllustration}
              />
              <button
                type="button"
                onClick={() => imageFileInputRef.current?.click()}
                className="text-[11px] font-semibold text-[#89b4fa] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Importer Image</span>
              </button>
            </div>
            <input
              type="text"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="Ambiance visuelle ou mots-clés..."
              className="w-full p-2 rounded-lg bg-[#313244] text-xs text-[#cdd6f4]"
            />
            <button
              type="button"
              onClick={handleGenerateIllustration}
              disabled={isGeneratingImage}
              className="w-full py-2 rounded-lg bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 text-[#f59e0b] border border-[#f59e0b]/40 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isGeneratingImage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Générer Visuel Artistique</span>
            </button>
          </div>
        </div>

        {/* Column 2: Visual Preview (9:16 Default), Audio/Video Downloads & Subtitles Editor */}
        <div className="space-y-4">
          {/* Format Selector Bar (9:16 Smartphone Vertical Default) */}
          <div className="p-2.5 bg-[#181825] rounded-xl border border-[#313244] flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#cdd6f4] flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#f59e0b]" />
              <span>Format Vidéo :</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVideoFormat('9:16')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer border transition-colors ${
                  videoFormat === '9:16'
                    ? 'bg-[#f59e0b] text-[#11111b] border-[#f59e0b]'
                    : 'bg-[#11111b] text-[#a6adc8] border-[#313244] hover:text-[#cdd6f4]'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>9:16 Smartphone</span>
              </button>
              <button
                type="button"
                onClick={() => setVideoFormat('16:9')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer border transition-colors ${
                  videoFormat === '16:9'
                    ? 'bg-[#f59e0b] text-[#11111b] border-[#f59e0b]'
                    : 'bg-[#11111b] text-[#a6adc8] border-[#313244] hover:text-[#cdd6f4]'
                }`}
              >
                <Monitor className="w-3 h-3" />
                <span>16:9</span>
              </button>
              <button
                type="button"
                onClick={() => setVideoFormat('1:1')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer border transition-colors ${
                  videoFormat === '1:1'
                    ? 'bg-[#f59e0b] text-[#11111b] border-[#f59e0b]'
                    : 'bg-[#11111b] text-[#a6adc8] border-[#313244] hover:text-[#cdd6f4]'
                }`}
              >
                <SquareIcon className="w-3 h-3" />
                <span>1:1</span>
              </button>
            </div>
          </div>

          {/* Preview Stage */}
          <div
            className={`p-4 bg-[#11111b] rounded-2xl border border-[#313244] relative overflow-hidden flex flex-col justify-between shadow-inner ${
              videoFormat === '9:16'
                ? 'aspect-[9/16] max-w-[310px] sm:max-w-[340px] w-full mx-auto'
                : videoFormat === '1:1'
                ? 'aspect-square max-w-[390px] w-full mx-auto'
                : 'aspect-video w-full'
            }`}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="Art Illustration" className="absolute inset-0 w-full h-full object-cover opacity-65" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] via-[#181825] to-[#09090b] opacity-95" />
            )}

            {/* Top Title Safe Zone */}
            <div className="relative z-10 text-center pt-2 px-2">
              <h2 className="text-xs sm:text-sm font-bold text-[#f59e0b] tracking-wider uppercase drop-shadow">
                {poemTitle}
              </h2>
            </div>

            {/* Active Subtitles Stage Overlay */}
            {(() => {
              const activeCue =
                segments.find((s) => currentTime >= s.start && currentTime < s.end) ||
                (currentTime >= (segments[segments.length - 1]?.end || 0)
                  ? segments[segments.length - 1]
                  : segments[0]);

              const posClass =
                subtitlePosition === 'top'
                  ? 'justify-start pt-4'
                  : subtitlePosition === 'center'
                  ? 'justify-center'
                  : 'justify-end pb-20';

              const styleClass =
                subtitleStyle === 'gold_slam'
                  ? 'bg-[#140c04]/80 text-[#fde68a] border border-[#f59e0b]/50'
                  : subtitleStyle === 'neon_cyan'
                  ? 'bg-[#06101c]/80 text-[#e0f2fe] border border-[#38bdf8]/50'
                  : 'bg-black/70 text-white border border-white/10';

              const sizeClass =
                subtitleSize === 'sm'
                  ? 'text-xs sm:text-sm'
                  : subtitleSize === 'lg'
                  ? 'text-base sm:text-xl'
                  : 'text-sm sm:text-base';

              return (
                <div className={`relative z-10 flex-1 flex flex-col items-center px-2 ${posClass}`}>
                  {segments.length > 0 && activeCue ? (
                    <div
                      className={`max-w-[94%] text-center font-extrabold leading-snug break-words whitespace-pre-wrap px-3.5 py-2 rounded-xl backdrop-blur-sm shadow-lg ${styleClass} ${sizeClass}`}
                    >
                      {activeCue.text}
                    </div>
                  ) : (
                    <p className="text-xs text-[#a6adc8] text-center">
                      Rédigez votre poème pour prévisualiser les sous-titres.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Hidden audio elements */}
            {voiceAudioUrl && (
              <audio
                ref={voiceAudioRef}
                src={voiceAudioUrl}
                onEnded={() => {
                  setIsPlaying(false);
                  if (musicAudioRef.current) musicAudioRef.current.pause();
                }}
              />
            )}
            {bgMusicUrl && (
              <audio
                ref={musicAudioRef}
                src={bgMusicUrl}
                loop
                onEnded={() => setIsPreviewingBgOnly(false)}
              />
            )}

            {/* Play/Pause Control Bar */}
            <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10">
              <button
                type="button"
                onClick={togglePlay}
                disabled={!voiceAudioUrl}
                className="w-9 h-9 rounded-full bg-[#f59e0b] text-[#11111b] flex items-center justify-center cursor-pointer hover:scale-105 transition-transform disabled:opacity-45 shrink-0"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <div className="flex-1 mx-1.5 min-w-0">
                <div className="flex justify-between text-[10px] text-[#a6adc8] mb-1 tabular-nums">
                  <span>{currentTime.toFixed(1)}s</span>
                  <span>
                    {effectiveDuration.toFixed(1)}s {measuredVoiceDuration ? '(voix)' : `(${cadenceWpm} mpm)`}
                  </span>
                </div>
                <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#f59e0b] h-full transition-all"
                    style={{ width: `${Math.min(100, (currentTime / (effectiveDuration || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={bgMusicUrl ? handleMixAndDownloadWav : handleDownloadVoiceWav}
                disabled={!voiceAudioUrl || isMixingAudio}
                className="px-2.5 py-1.5 rounded-lg bg-[#89b4fa] text-[#11111b] font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-40 shrink-0"
                title="Télécharger l'audio WAV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>WAV</span>
              </button>
            </div>
          </div>

          {/* Export Audio, SRT & Video Bar */}
          <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] space-y-2.5">
            <h3 className="text-xs font-bold text-[#cdd6f4] flex items-center gap-1.5">
              <Download className="w-4 h-4 text-[#89b4fa]" />
              <span>Export Audio, Sous-titres & Vidéo ({videoFormat})</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleDownloadVoiceWav}
                disabled={!voiceAudioUrl}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-[#11111b] hover:bg-[#313244] border border-[#89b4fa]/40 text-[#89b4fa] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Voix (.WAV)</span>
              </button>

              <button
                type="button"
                onClick={handleMixAndDownloadWav}
                disabled={!voiceAudioUrl || isMixingAudio}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-[#11111b] hover:bg-[#313244] border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                {isMixingAudio ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sliders className="w-3.5 h-3.5" />
                )}
                <span>Mix Final (.WAV)</span>
              </button>

              <button
                type="button"
                onClick={handleCompileAndDownloadVideo}
                disabled={!voiceAudioUrl || isExportingVideo}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-[#11111b] text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                {isExportingVideo ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Film className="w-3.5 h-3.5" />
                )}
                <span>
                  {isExportingVideo ? `MP4 ${videoExportProgress}%` : `Vidéo MP4 (${videoFormat})`}
                </span>
              </button>
            </div>
            <p className="text-[10px] text-[#a6adc8] flex flex-wrap items-center justify-between gap-2">
              <span>Format MP4 universel (H.264 + AAC) compatible InShot, CapCut, Android & iPhone.</span>
              {(compiledVideoBlob || compiledVideoUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    const fileName = `${sanitizeFileSlug(poemTitle)}_${videoFormat.replace(':', 'x')}.mp4`;
                    if (compiledVideoBlob) {
                      triggerFileDownload(compiledVideoBlob, fileName);
                    } else if (compiledVideoUrl) {
                      triggerHttpUrlDownload(compiledVideoUrl, fileName);
                    }
                  }}
                  className="text-[#f59e0b] font-semibold hover:underline cursor-pointer"
                >
                  Re-télécharger le MP4
                </button>
              )}
            </p>
          </div>

          {/* Subtitles Style & Timeline Editor */}
          <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-[#cdd6f4] flex items-center gap-1.5">
                <Subtitles className="w-4 h-4 text-[#f59e0b]" />
                <span>Sous-titres ({segments.length} séquences)</span>
              </h3>
              <button
                type="button"
                onClick={handleDownloadSrt}
                disabled={segments.length === 0}
                className="px-2.5 py-1 rounded-lg bg-[#11111b] hover:bg-[#313244] border border-[#f59e0b]/40 text-[#f59e0b] text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-45"
              >
                <Download className="w-3 h-3" />
                <span>Exporter .SRT</span>
              </button>
            </div>

            {/* Subtitle Visual Customization */}
            <div className="grid grid-cols-3 gap-2">
              <select
                value={subtitlePosition}
                onChange={(e) => setSubtitlePosition(e.target.value as 'bottom' | 'center' | 'top')}
                aria-label="Position des sous-titres"
                className="p-1.5 rounded-lg bg-[#11111b] border border-[#313244] text-[11px] text-[#cdd6f4]"
              >
                <option value="bottom">Position : Bas</option>
                <option value="center">Position : Centre</option>
                <option value="top">Position : Haut</option>
              </select>

              <select
                value={subtitleStyle}
                onChange={(e) => setSubtitleStyle(e.target.value as 'dark_white' | 'gold_slam' | 'neon_cyan')}
                aria-label="Style des sous-titres"
                className="p-1.5 rounded-lg bg-[#11111b] border border-[#313244] text-[11px] text-[#cdd6f4]"
              >
                <option value="dark_white">Style : Classique</option>
                <option value="gold_slam">Style : Or Slam</option>
                <option value="neon_cyan">Style : Néon Cyan</option>
              </select>

              <select
                value={subtitleSize}
                onChange={(e) => setSubtitleSize(e.target.value as 'sm' | 'md' | 'lg')}
                aria-label="Taille des sous-titres"
                className="p-1.5 rounded-lg bg-[#11111b] border border-[#313244] text-[11px] text-[#cdd6f4]"
              >
                <option value="sm">Taille : Petite</option>
                <option value="md">Taille : Moyenne</option>
                <option value="lg">Taille : Grande</option>
              </select>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {segments.map((seg, idx) => {
                const isActiveSeg = isPlaying && currentTime >= seg.start && currentTime < seg.end;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition-colors ${
                      isActiveSeg
                        ? 'bg-[#f59e0b]/15 border-[#f59e0b]/60'
                        : 'bg-[#11111b] border-[#313244]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTime(seg.start);
                        if (voiceAudioRef.current) voiceAudioRef.current.currentTime = seg.start;
                      }}
                      title="Aller à ce moment"
                      className="text-[10px] font-mono text-[#f59e0b] hover:underline shrink-0 cursor-pointer"
                    >
                      {seg.start.toFixed(1)}s-{seg.end.toFixed(1)}s
                    </button>
                    <input
                      type="text"
                      value={seg.text}
                      onChange={(e) => {
                        const next = [...segments];
                        next[idx].text = e.target.value;
                        setSegments(next);
                      }}
                      className="flex-1 bg-transparent text-[#cdd6f4] focus:outline-none min-w-0"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
