import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Mic, Upload, RefreshCw, Download, Search, FolderDown, Trash2,
  Play, Pause, Music, Video, FileText, Check, Copy, Edit2,
  Subtitles, Eye, ArrowRight, Sparkles, Volume2, Clock, Film,
  Sliders, CheckCircle2, Wand2, Square, ArrowLeft, Plus, Save, Folder,
  AlertCircle
} from 'lucide-react';
import JSZip from 'jszip';
import { authFetch, apiAuthStore, safeJsonResponse } from '../services/apiAuth';
import {
  TRADITIONAL_RHYTHM_PRESETS,
  renderCompositionToWav
} from '../utils/africanAudioEngine';
import { cleanTextForSpeech } from '../utils/textCleaner';
import {
  audioBufferToWavBlob,
  readSourceUrlToArrayBuffer,
  triggerSafeDownload,
  triggerHttpUrlDownload,
} from '../utils/audioExport';
import { CustomVoiceProfile } from '../types/voiceProfile';
import {
  resolveVoicePayloadForTTS,
  toCustomVoiceOptionId
} from '../utils/customVoiceStorage';

export interface ProjectStudioLaunchContext {
  projectName: string;
  videoItem?: { id: number; name: string; data: string } | null;
  textItem?: { id: number; name: string; content: string } | null;
  audioItem?: { id: number; name: string; data: string } | null;
  focusSection?: 'subtitles' | 'voiceover' | 'mic';
}

export interface TranscriptionStudioProps {
  apiKey: string;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  activeBackingTrack?: any;
  onSwitchMode: (mode: 'single' | 'workspace' | 'transcription' | 'video_dubbing') => void;
  onInsertTextToStudio?: (text: string) => void;
  onInsertTextToAgent?: (text: string) => void;
  initialVideoFile?: File | null;
  initialVoiceoverFile?: File | null;
  initialText?: string;
  initialScriptPayload?: { text: string; nonce: number } | null;
  library?: Record<string, any>;
  customVoices?: CustomVoiceProfile[];
  launchContext?: ProjectStudioLaunchContext | null;
  onSaveAssetToProject?: (
    projectName: string,
    category: 'audios' | 'texts' | 'videos',
    name: string,
    data: string
  ) => void;
  onBackToProject?: () => void;
}

export interface Segment {
  start: number;
  end: number;
  text: string;
}

interface HistoryItem {
  id: string;
  name: string;
  type: 'video' | 'audio';
  transcription: string;
  srtContent: string;
  date: string;
}

const PRESET_VOICE_OPTIONS = [
  { id: 'Puck', name: 'Puck (Grave & Chaleureux)', gender: 'Masculin' },
  { id: 'Charon', name: 'Charon (Profond & Solennel - Griot)', gender: 'Masculin' },
  { id: 'Fenrir', name: 'Fenrir (Dynamique & Percutant)', gender: 'Masculin' },
  { id: 'Aoede', name: 'Aoede (Claire & Expressive)', gender: 'Féminin' },
  { id: 'Kore', name: 'Kore (Mélodieuse & Douce)', gender: 'Féminin' },
  { id: 'Zephyr', name: 'Zephyr (Posé & Documentaire)', gender: 'Neutre' },
];

export const BACKGROUND_MUSIC_OPTIONS = [
  { id: '__NONE__', name: 'Aucun fond sonore (Voix & Vidéo uniquement)' },
  { id: '__ACTIVE__', name: 'Fond sonore actif du Studio (si sélectionné)' },
  { id: 'aube_kora_sahel', name: 'Aube Sahélienne & Kora Mandingue (104 BPM)' },
  { id: 'balafon_casamance_fleuve', name: 'Balafon Solaire de Casamance (108 BPM)' },
  { id: 'sabar_kaolack', name: 'Sabar Kaolack Polyrythmique (114 BPM)' },
  { id: 'rituel_appel_ancetres', name: 'Djembé & Rituel Ancestral (92 BPM)' },
  { id: 'dub_roots_senegal', name: 'Dub Roots Ancestral RidiaLArt (76 BPM)' },
  { id: '__CUSTOM__', name: 'Importer un fichier MP3/WAV personnel...' },
];

function stripLibraryMetadataHeader(rawContent: string): string {
  if (!rawContent) return '';
  const separator = '----------------------------------------\n\n';
  if (rawContent.includes(separator)) {
    return rawContent.split(separator).slice(1).join(separator).trim();
  }
  return rawContent.trim();
}

function looksLikeSRT(content: string): boolean {
  return /\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}/.test(content || '');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossible de convertir le fichier'));
    reader.readAsDataURL(blob);
  });
}

async function measureAudioBlobDuration(blob: Blob): Promise<number> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      try {
        const ab = await blob.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(ab.slice(0));
        if (audioBuf && Number.isFinite(audioBuf.duration) && audioBuf.duration > 0) {
          return audioBuf.duration;
        }
      } catch {
        // Fallback to HTMLAudioElement below
      } finally {
        ctx.close().catch(() => {});
      }
    }
  } catch {
    // Fallback below
  }

  return new Promise((resolve) => {
    const tempUrl = URL.createObjectURL(blob);
    const audio = new Audio();
    let settled = false;
    const finish = (dur: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(tempUrl);
      resolve(Number.isFinite(dur) && dur > 0 ? dur : 0);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(0);
    setTimeout(() => finish(0), 2500);
    audio.src = tempUrl;
  });
}

interface VoiceSyncMetrics {
  charsPerSec: number;
  wordsPerSec: number;
  wpm: number;
  durationSec: number;
  source: 'voice' | 'estimated';
}

export const TranscriptionStudio: React.FC<TranscriptionStudioProps> = ({
  apiKey,
  addToast,
  activeBackingTrack,
  onSwitchMode,
  onInsertTextToStudio,
  onInsertTextToAgent,
  initialVideoFile,
  initialVoiceoverFile,
  initialText,
  initialScriptPayload,
  library,
  customVoices = [],
  launchContext,
  onSaveAssetToProject,
  onBackToProject,
}) => {
  const projectNames = useMemo(() => (library ? Object.keys(library) : []), [library]);

  const [activeProjectName, setActiveProjectName] = useState<string>(
    () => launchContext?.projectName || projectNames[0] || ''
  );

  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('transcription_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTranscribingVoiceover, setIsTranscribingVoiceover] = useState<boolean>(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Subtitle Visual & Readability Config State
  const [showSubtitlesOverlay, setShowSubtitlesOverlay] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState<'yellow' | 'classic' | 'afro'>('yellow');
  const [subtitlePosition, setSubtitlePosition] = useState<'bottom' | 'center' | 'top'>('bottom');
  const [subtitleFontSize, setSubtitleFontSize] = useState<number>(18);
  const [editingSegmentIdx, setEditingSegmentIdx] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [minSubtitleDuration, setMinSubtitleDuration] = useState<number>(2.0);
  const [maxCharsPerLine, setMaxCharsPerLine] = useState<number>(42);
  const [showSubtitleConfigPanel, setShowSubtitleConfigPanel] = useState<boolean>(false);
  const [autoSyncSrtWithVoice, setAutoSyncSrtWithVoice] = useState<boolean>(true);
  const [speechPaceMultiplier, setSpeechPaceMultiplier] = useState<number>(1.0);
  const [lastVoiceSyncMetrics, setLastVoiceSyncMetrics] = useState<VoiceSyncMetrics | null>(null);

  // Video Voiceover Source & Mix State
  const [voiceoverSourceTab, setVoiceoverSourceTab] = useState<'mic' | 'ai' | 'library'>('mic');
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);
  const [voiceoverAudioBlob, setVoiceoverAudioBlob] = useState<Blob | null>(null);
  const [voiceoverAudioUrl, setVoiceoverAudioUrl] = useState<string | null>(null);
  const [voiceoverLabel, setVoiceoverLabel] = useState<string | null>(null);
  const [voiceoverDuration, setVoiceoverDuration] = useState<number>(0);
  const [voiceDelaySeconds, setVoiceDelaySeconds] = useState<number>(0);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('Charon');
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0);
  const [originalAudioVolume, setOriginalAudioVolume] = useState<number>(0.15);
  const [burnSubtitlesInExport, setBurnSubtitlesInExport] = useState<boolean>(true);
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [exportProgressMsg, setExportProgressMsg] = useState<string>('');
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedVideoBlob, setExportedVideoBlob] = useState<Blob | null>(null);

  // Microphone Voiceover Recording State
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [syncVideoWhileRecording, setSyncVideoWhileRecording] = useState(true);
  const [isProcessingMicRecording, setIsProcessingMicRecording] = useState(false);

  // Background Music State
  const [selectedMusicId, setSelectedMusicId] = useState<string>('__NONE__');
  const [musicVolume, setMusicVolume] = useState<number>(0.25);
  const [musicAudioUrl, setMusicAudioUrl] = useState<string | null>(null);
  const [musicAudioBlob, setMusicAudioBlob] = useState<Blob | null>(null);
  const [isPreparingMusic, setIsPreparingMusic] = useState<boolean>(false);
  const [customMusicName, setCustomMusicName] = useState<string | null>(null);

  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const voiceoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const customMusicInputRef = useRef<HTMLInputElement | null>(null);
  const voiceoverFileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceoverSectionRef = useRef<HTMLDivElement | null>(null);
  const subtitlesSectionRef = useRef<HTMLDivElement | null>(null);

  // Mic Recorder Refs
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const micTimerRef = useRef<number | null>(null);
  const micAnalyserCtxRef = useRef<AudioContext | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);
  const lastLoadedContextRef = useRef<string | null>(null);

  const activeProjectData = activeProjectName && library ? library[activeProjectName] : null;
  const projectAudios: any[] = activeProjectData?.audios || [];
  const projectTexts: any[] = activeProjectData?.texts || [];
  const projectVideos: any[] = activeProjectData?.videos || [];

  // Keep activeProjectName valid if library updates
  useEffect(() => {
    if (activeProjectName && library && !library[activeProjectName]) {
      setActiveProjectName(Object.keys(library)[0] || '');
    } else if (!activeProjectName && projectNames.length > 0) {
      setActiveProjectName(projectNames[0]);
    }
  }, [library, activeProjectName, projectNames]);

  // React to initialVideoFile passed from Home page or phone share/open-with
  useEffect(() => {
    if (initialVideoFile) {
      setFile(initialVideoFile);
      setIsVideo(true);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      const newUrl = URL.createObjectURL(initialVideoFile);
      setFileUrl(newUrl);
    }
  }, [initialVideoFile]);

  // React to initialVoiceoverFile passed from phone share/open-with
  useEffect(() => {
    if (!initialVoiceoverFile) return;
    let cancelled = false;
    const url = URL.createObjectURL(initialVoiceoverFile);
    setVoiceoverAudioBlob(initialVoiceoverFile);
    setVoiceoverAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    setVoiceoverLabel(initialVoiceoverFile.name);
    setVoiceoverSourceTab('library');
    measureAudioBlobDuration(initialVoiceoverFile).then((dur) => {
      if (cancelled || dur <= 0) return;
      setVoiceoverDuration(dur);
    });
    return () => {
      cancelled = true;
    };
  }, [initialVoiceoverFile]);

  // React to initialText passed from Home Studio or phone share/open-with
  useEffect(() => {
    if (!initialText) return;
    if (looksLikeSRT(initialText)) {
      const parsed = parseSRT(initialText);
      if (parsed.length > 0) {
        setSegments(parsed);
        setRawText(parsed.map((s) => s.text.replace(/\n+/g, ' ')).join(' '));
        return;
      }
    }
    if (!rawText && segments.length === 0) {
      setRawText(initialText);
    }
  }, [initialText]);

  // Force-load explicit phone/share script or SRT payloads
  useEffect(() => {
    if (!initialScriptPayload?.text) return;
    const content = stripLibraryMetadataHeader(initialScriptPayload.text);
    if (looksLikeSRT(content)) {
      const parsed = parseSRT(content);
      if (parsed.length > 0) {
        setSegments(parsed);
        setRawText(parsed.map((s) => s.text.replace(/\n+/g, ' ')).join(' '));
        return;
      }
    }
    setRawText(content);
  }, [initialScriptPayload]);

  // Auto-generate synchronized subtitles if rawText is loaded and segments are empty
  useEffect(() => {
    if (rawText && segments.length === 0 && !looksLikeSRT(rawText)) {
      const cleanScript = cleanTextForSpeech(stripLibraryMetadataHeader(rawText));
      if (cleanScript.trim()) {
        const { segments: generated, metrics } = buildVoiceSynchronizedSRT(rawText, voiceoverDuration, voiceDelaySeconds);
        if (generated.length > 0) {
          setSegments(generated);
          setLastVoiceSyncMetrics(metrics);
        }
      }
    }
  }, [rawText, voiceoverDuration]);

  // Cleanup mic resources on unmount
  useEffect(() => {
    return () => {
      if (micTimerRef.current) window.clearInterval(micTimerRef.current);
      if (micAnimFrameRef.current) cancelAnimationFrame(micAnimFrameRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (micAnalyserCtxRef.current) {
        micAnalyserCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('transcription_history', JSON.stringify(history));
  }, [history]);

  // Sync Voiceover playback volume
  useEffect(() => {
    if (voiceoverAudioRef.current) {
      voiceoverAudioRef.current.volume = Math.max(0, Math.min(1.0, voiceVolume));
    }
  }, [voiceVolume]);

  // Sync Background Music volume
  useEffect(() => {
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = Math.max(0, Math.min(1.0, musicVolume));
    }
  }, [musicVolume]);

  // Convert time "00:01:23,456" or "01:23.456" to seconds
  const timeToSeconds = (timeStr: string): number => {
    if (!timeStr) return 0;
    const clean = timeStr.trim().replace(',', '.');
    const parts = clean.split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(clean) || 0;
  };

  // Convert seconds to SRT timestamp format "00:00:00,000"
  const secondsToSRT = (seconds: number): string => {
    const s = Math.max(0, seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  // Convert seconds to WebVTT timestamp format "00:00:00.000"
  const secondsToVTT = (seconds: number): string => {
    return secondsToSRT(seconds).replace(',', '.');
  };

  const formatSegmentText = (text: string, maxLen: number): string => {
    if (!text || text.length <= maxLen) return text;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxLen) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
  };

  const processSegmentsWithConfig = (parsed: Segment[]): Segment[] => {
    return parsed.map((seg, idx, arr) => {
      let effectiveEnd = seg.end;
      const segDur = effectiveEnd - seg.start;
      if (segDur < minSubtitleDuration) {
        effectiveEnd = seg.start + minSubtitleDuration;
        if (idx < arr.length - 1 && effectiveEnd > arr[idx + 1].start) {
          effectiveEnd = Math.max(seg.start + 0.8, arr[idx + 1].start - 0.05);
        }
      }
      const formattedText = formatSegmentText(seg.text.replace(/\n+/g, ' '), maxCharsPerLine);
      return {
        start: Math.max(0, seg.start),
        end: Math.max(seg.start + 0.4, effectiveEnd),
        text: formattedText
      };
    });
  };

  // Parse raw SRT block with flexible line finding
  const parseSRT = (srt: string): Segment[] => {
    if (!srt) return [];
    const blocks = srt.split(/(?:\r?\n){2,}/);
    const parsed: Segment[] = [];

    for (const block of blocks) {
      const lines = block.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;

      const timeLineIdx = lines.findIndex(l => l.includes('-->'));
      if (timeLineIdx === -1) continue;

      const timeParts = lines[timeLineIdx].split('-->').map(s => s.trim());
      if (timeParts.length !== 2) continue;

      const start = timeToSeconds(timeParts[0]);
      const end = timeToSeconds(timeParts[1]);
      const text = lines.slice(timeLineIdx + 1).join(' ').trim();

      if (!isNaN(start) && !isNaN(end) && text) {
        parsed.push({ start, end, text });
      }
    }
    return processSegmentsWithConfig(parsed);
  };

  // Load a video from Project library dataUrl/URL
  const handleLoadProjectVideo = async (vidItem: { id: number; name: string; data: string }) => {
    try {
      const { buffer, mimeType } = await readSourceUrlToArrayBuffer(vidItem.data);
      const mime = mimeType || 'video/mp4';
      const blob = new Blob([buffer], { type: mime });
      const ext = mime.includes('webm') ? '.webm' : mime.includes('quicktime') ? '.mov' : '.mp4';
      const loadedFile = new File([blob], `${vidItem.name}${ext}`, { type: mime });
      setFile(loadedFile);
      setIsVideo(true);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      setFileUrl(URL.createObjectURL(loadedFile));
      setCurrentTime(0);
      setIsPlaying(false);
      setExportedVideoUrl(null);
      setExportedVideoBlob(null);
      addToast(`Vidéo "${vidItem.name}" chargée dans le studio.`, 'success');
    } catch (e) {
      console.error('Failed loading project video:', e);
      addToast('Impossible de charger cette vidéo depuis le projet.', 'error');
    }
  };

  // Load a script from Project library (supports both plain text and .srt)
  const handleLoadProjectScript = (textItem: { id: number; name: string; content: string }) => {
    const clean = stripLibraryMetadataHeader(textItem.content);
    if (looksLikeSRT(clean)) {
      const parsed = parseSRT(clean);
      if (parsed.length > 0) {
        setSegments(parsed);
        setRawText(parsed.map((s) => s.text.replace(/\n+/g, ' ')).join(' '));
        addToast(`Sous-titres SRT "${textItem.name}" chargés (${parsed.length} segments).`, 'success');
        return;
      }
    }
    setRawText(clean);
    addToast(`Script "${textItem.name}" chargé dans l'éditeur.`, 'success');
  };

  // Select voiceover from library
  const handleSelectVoiceoverFromLibrary = async (base64Data: string, trackName: string) => {
    try {
      const { buffer, mimeType } = await readSourceUrlToArrayBuffer(base64Data);
      const blob = new Blob([buffer], { type: mimeType || 'audio/wav' });
      if (voiceoverAudioUrl) URL.revokeObjectURL(voiceoverAudioUrl);
      const newUrl = URL.createObjectURL(blob);

      setVoiceoverAudioBlob(blob);
      setVoiceoverAudioUrl(newUrl);
      setVoiceoverLabel(trackName);

      const measuredDur = await measureAudioBlobDuration(blob);
      if (measuredDur > 0) {
        setVoiceoverDuration(measuredDur);
        if (autoSyncSrtWithVoice && rawText.trim() && !looksLikeSRT(rawText)) {
          const { segments: synced, metrics } = buildVoiceSynchronizedSRT(rawText, measuredDur, voiceDelaySeconds);
          if (synced.length > 0) {
            setSegments(synced);
            setLastVoiceSyncMetrics(metrics);
            const rateTxt = metrics ? ` (${metrics.charsPerSec.toFixed(1)} car./s)` : '';
            addToast(`Voix off "${trackName}" (${measuredDur.toFixed(1)}s) chargée et ${synced.length} sous-titres synchronisés${rateTxt} !`, 'success');
            return;
          }
        }
      }
      addToast(`Voix off "${trackName}" chargée !`, 'success');
    } catch (e) {
      console.error('Library audio import error:', e);
      addToast("Erreur lors de l'importation de la piste audio.", 'error');
    }
  };

  // React to launchContext when opened from a Project
  useEffect(() => {
    if (!launchContext) return;
    const contextKey = JSON.stringify({
      p: launchContext.projectName,
      v: launchContext.videoItem?.id,
      t: launchContext.textItem?.id,
      a: launchContext.audioItem?.id,
      f: launchContext.focusSection,
    });
    if (lastLoadedContextRef.current === contextKey) return;
    lastLoadedContextRef.current = contextKey;

    if (launchContext.projectName) {
      setActiveProjectName(launchContext.projectName);
    }

    const projObj = library?.[launchContext.projectName];

    // Load video item (or first playable video in the project)
    const videoToLoad =
      launchContext.videoItem ||
      projObj?.videos?.find((v: any) => typeof v?.data === 'string' && v.data.startsWith('data:video')) ||
      null;
    if (videoToLoad) {
      handleLoadProjectVideo(videoToLoad);
    }

    // Load text item (or first text in the project)
    const textToLoad = launchContext.textItem || projObj?.texts?.[0] || null;
    if (textToLoad) {
      handleLoadProjectScript(textToLoad);
    }

    // Load audio item if specified
    if (launchContext.audioItem) {
      handleSelectVoiceoverFromLibrary(launchContext.audioItem.data, launchContext.audioItem.name);
      setVoiceoverSourceTab('library');
    }

    if (launchContext.focusSection === 'mic') {
      setVoiceoverSourceTab('mic');
      setTimeout(() => voiceoverSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } else if (launchContext.focusSection === 'subtitles') {
      setTimeout(() => subtitlesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }, [launchContext]);

  // Synchronized Play/Pause/TimeUpdate respecting voiceDelaySeconds
  const syncAuxiliaryTracksToTime = (t: number, shouldPlay: boolean) => {
    if (voiceoverAudioRef.current && voiceoverAudioUrl) {
      const vAudio = voiceoverAudioRef.current;
      const offsetTime = t - voiceDelaySeconds;
      if (offsetTime < 0) {
        if (!vAudio.paused) vAudio.pause();
        vAudio.currentTime = 0;
      } else if (!vAudio.duration || offsetTime <= vAudio.duration) {
        if (Math.abs(vAudio.currentTime - offsetTime) > 0.25) {
          vAudio.currentTime = offsetTime;
        }
        if (shouldPlay && vAudio.paused) {
          vAudio.play().catch(() => {});
        }
      } else {
        if (!vAudio.paused) vAudio.pause();
      }
    }
    if (musicAudioRef.current && musicAudioUrl) {
      const mAudio = musicAudioRef.current;
      const dur = mAudio.duration || 10;
      const target = t % dur;
      if (Math.abs(mAudio.currentTime - target) > 0.3) {
        mAudio.currentTime = target;
      }
      if (shouldPlay && mAudio.paused) {
        mAudio.play().catch(() => {});
      }
    }
  };

  const handleMediaPlay = () => {
    setIsPlaying(true);
    const t = mediaRef.current?.currentTime || 0;
    syncAuxiliaryTracksToTime(t, true);
  };

  const handleMediaPause = () => {
    setIsPlaying(false);
    if (voiceoverAudioRef.current) voiceoverAudioRef.current.pause();
    if (musicAudioRef.current) musicAudioRef.current.pause();
  };

  const handleMediaTimeUpdate = () => {
    if (!mediaRef.current) return;
    const t = mediaRef.current.currentTime;
    setCurrentTime(t);
    if (!mediaRef.current.paused) {
      syncAuxiliaryTracksToTime(t, true);
    }
  };

  const handleMediaSeek = (seconds: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = seconds;
    setCurrentTime(seconds);
    syncAuxiliaryTracksToTime(seconds, !mediaRef.current.paused);
  };

  const handleApplySubtitleConfig = () => {
    if (segments.length === 0) {
      addToast('Aucun segment de sous-titre à configurer.', 'info');
      return;
    }
    setSegments(prev => processSegmentsWithConfig(prev));
    addToast(`Paramètres appliqués : min ${minSubtitleDuration.toFixed(1)}s, max ${maxCharsPerLine} car./ligne.`, 'success');
  };

  const getCombinedSRTString = (): string => {
    if (segments.length === 0) return '';
    return segments.map((seg, idx) =>
      `${idx + 1}\n${secondsToSRT(seg.start)} --> ${secondsToSRT(seg.end)}\n${seg.text}\n`
    ).join('\n');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      const isVid = f.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(f.name);
      setIsVideo(isVid);

      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);

      const newUrl = URL.createObjectURL(f);
      setFileUrl(newUrl);
      setCurrentTime(0);
      setIsPlaying(false);
      setExportedVideoUrl(null);
      setExportedVideoBlob(null);
      addToast(`Fichier ${isVid ? 'vidéo' : 'audio'} prêt pour le montage`, 'info');
    }
  };

  // Transcribe either the primary video/audio file OR the posed voiceover audio
  const handleTranscribeMediaBlob = async (sourceBlob: Blob, sourceName: string, mode: 'media' | 'voiceover') => {
    if (mode === 'media') setIsLoading(true);
    else setIsTranscribingVoiceover(true);

    const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();

    try {
      const formData = new FormData();
      formData.append('file', sourceBlob, sourceName);
      if (effectiveKey) formData.append('apiKey', effectiveKey);

      const response = await authFetch('/api/transcribe', {
        method: 'POST',
        body: formData
      }, effectiveKey);

      if (!response.ok) {
        const errorData = await safeJsonResponse<any>(response, 'de la transcription').catch((e) => ({ error: e?.message }));
        throw new Error(errorData.error || 'Échec de la transcription');
      }

      const data = await safeJsonResponse<any>(response, 'de la transcription');
      const transcriptionText: string = data.transcription || '';

      let extractedRaw = '';
      let srtPart = '';

      if (transcriptionText.includes('### SRT ###')) {
        const parts = transcriptionText.split('### SRT ###');
        extractedRaw = parts[0].replace('[TRANSCRIPTION_BRUTE]', '').trim();
        srtPart = parts[1].trim();
      } else {
        extractedRaw = transcriptionText;
        srtPart = transcriptionText;
      }

      setRawText(extractedRaw);
      let parsedSegments = parseSRT(srtPart);
      // If transcribing voiceover with a start delay, shift SRT timestamps by voiceDelaySeconds
      if (mode === 'voiceover' && voiceDelaySeconds > 0 && parsedSegments.length > 0) {
        parsedSegments = parsedSegments.map((s) => ({
          ...s,
          start: s.start + voiceDelaySeconds,
          end: s.end + voiceDelaySeconds,
        }));
      }
      setSegments(parsedSegments);

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        name: sourceName,
        type: mode === 'media' && isVideo ? 'video' : 'audio',
        transcription: extractedRaw,
        srtContent: srtPart,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      };

      setHistory(prev => [newItem, ...prev]);
      addToast(`Extraction réussie (${parsedSegments.length} sous-titres synchronisés)`, 'success');
    } catch (err: any) {
      console.error(err);
      addToast(err?.message || 'Erreur lors de la transcription', 'error');
    } finally {
      if (mode === 'media') setIsLoading(false);
      else setIsTranscribingVoiceover(false);
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;
    await handleTranscribeMediaBlob(file, file.name, 'media');
  };

  // Build voice-speed-synchronized SRT segments from project text
  const buildVoiceSynchronizedSRT = (
    scriptSource: string,
    measuredVoiceDurationSec: number,
    delaySec: number
  ): { segments: Segment[]; metrics: VoiceSyncMetrics | null } => {
    const cleanScript = cleanTextForSpeech(stripLibraryMetadataHeader(scriptSource));
    if (!cleanScript.trim()) return { segments: [], metrics: null };

    // Split cleanly by sentences/clauses, preserving punctuation pause cues
    const rawChunks = cleanScript
      .replace(/\r\n/g, '\n')
      .split(/(?<=[.!?…;:\n])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const subtitleChunks: string[] = [];
    const targetChunkLen = Math.max(26, Math.min(86, Math.round(maxCharsPerLine * 1.85)));

    for (const chunk of rawChunks) {
      if (chunk.length <= targetChunkLen) {
        subtitleChunks.push(chunk);
      } else {
        // Prefer splitting on commas before breaking by raw word count
        const commaClauses = chunk.split(/(?<=,)\s+/);
        for (const clause of commaClauses) {
          if (clause.length <= targetChunkLen) {
            subtitleChunks.push(clause);
          } else {
            const words = clause.split(/\s+/);
            let buf = '';
            for (const w of words) {
              if ((buf + ' ' + w).trim().length <= targetChunkLen) {
                buf = buf ? `${buf} ${w}` : w;
              } else {
                if (buf) subtitleChunks.push(buf);
                buf = w;
              }
            }
            if (buf) subtitleChunks.push(buf);
          }
        }
      }
    }

    if (subtitleChunks.length === 0) return { segments: [], metrics: null };

    // Compute linguistic articulation + breath pause weight per chunk
    const chunkStats = subtitleChunks.map((chunk) => {
      const spokenChars = chunk.replace(/\s+/g, '').length;
      const wordCount = chunk.split(/\s+/).filter(Boolean).length;
      const endsMajorPause = /[.!?…]$/.test(chunk);
      const endsMinorPause = /[,;:]$/.test(chunk);
      const pauseWeight = endsMajorPause ? 6.5 : endsMinorPause ? 3.0 : 0.8;
      const weight = Math.max(4, spokenChars + wordCount * 1.15 + pauseWeight);
      return { chunk, spokenChars, wordCount, weight };
    });

    const totalWeight = chunkStats.reduce((acc, s) => acc + s.weight, 0);
    const totalSpokenChars = chunkStats.reduce((acc, s) => acc + s.spokenChars, 0);
    const totalWords = chunkStats.reduce((acc, s) => acc + s.wordCount, 0);
    const hasMeasuredVoice = measuredVoiceDurationSec > 0.3;

    // Base natural reading rate ~13.8 non-space chars/sec (adjusted by user pace multiplier if no voice yet)
    const estimatedSpan = Math.max(
      subtitleChunks.length * Math.min(1.4, minSubtitleDuration),
      totalWeight / (13.8 * Math.max(0.65, Math.min(1.75, speechPaceMultiplier)))
    );

    const totalSpan = hasMeasuredVoice ? measuredVoiceDurationSec : estimatedSpan;
    const interGap = subtitleChunks.length > 1 ? 0.04 : 0;
    const totalGapTime = interGap * Math.max(0, subtitleChunks.length - 1);
    const usableSpeechSpan = Math.max(subtitleChunks.length * 0.55, totalSpan - totalGapTime);

    // Proportional distribution with readable floor normalized to preserve exact voice span
    const rawDurations = chunkStats.map((s) =>
      Math.max(0.55, (s.weight / (totalWeight || 1)) * usableSpeechSpan)
    );
    const rawSum = rawDurations.reduce((a, b) => a + b, 0);
    const scaleFactor = rawSum > 0 ? usableSpeechSpan / rawSum : 1;

    let cursor = Math.max(0, delaySec);
    const generated: Segment[] = chunkStats.map((stat, idx) => {
      const segDur = Math.max(0.45, rawDurations[idx] * scaleFactor);
      const start = Number(cursor.toFixed(2));
      const end = Number((cursor + segDur).toFixed(2));
      cursor = end + interGap;

      return {
        start,
        end: Math.max(start + 0.45, end),
        text: formatSegmentText(stat.chunk, maxCharsPerLine),
      };
    });

    const charsPerSec = totalSpan > 0 ? totalSpokenChars / totalSpan : 0;
    const wordsPerSec = totalSpan > 0 ? totalWords / totalSpan : 0;

    return {
      segments: generated,
      metrics: {
        charsPerSec,
        wordsPerSec,
        wpm: Math.round(wordsPerSec * 60),
        durationSec: totalSpan,
        source: hasMeasuredVoice ? 'voice' : 'estimated',
      },
    };
  };

  // Generate timed SRT segments from project text synchronized with generated voice reading speed
  const handleGenerateSubtitlesFromScript = (overrideVoiceDur?: number, overrideDelay?: number) => {
    const cleanScript = cleanTextForSpeech(stripLibraryMetadataHeader(rawText));
    if (!cleanScript.trim()) {
      addToast('Saisissez ou sélectionnez un texte de projet pour générer le fichier .SRT.', 'info');
      return;
    }

    if (looksLikeSRT(rawText)) {
      const parsed = parseSRT(rawText);
      if (parsed.length > 0) {
        setSegments(parsed);
        addToast(`${parsed.length} sous-titres SRT importés depuis votre texte.`, 'success');
        return;
      }
    }

    const effectiveDur = typeof overrideVoiceDur === 'number' ? overrideVoiceDur : voiceoverDuration;
    const effectiveDelay = typeof overrideDelay === 'number' ? overrideDelay : voiceDelaySeconds;
    const { segments: generated, metrics } = buildVoiceSynchronizedSRT(rawText, effectiveDur, effectiveDelay);

    if (generated.length === 0) return;

    setSegments(generated);
    setLastVoiceSyncMetrics(metrics);

    if (metrics?.source === 'voice') {
      addToast(
        `${generated.length} sous-titres .SRT synchronisés à la voix (${metrics.charsPerSec.toFixed(1)} car./s · ${metrics.wpm} mots/min sur ${metrics.durationSec.toFixed(1)}s) !`,
        'success'
      );
    } else {
      addToast(
        `${generated.length} sous-titres .SRT générés à vitesse ${speechPaceMultiplier.toFixed(2)}× (${metrics?.wpm || 140} mots/min).`,
        'success'
      );
    }
  };

  // Generate synthetic voiceover (supports both preset Gemini voices AND user CustomVoiceProfiles)
  const handleGenerateVoiceover = async () => {
    const textToSpeak = cleanTextForSpeech(rawText.trim() || segments.map(s => s.text).join(' ').trim());
    if (!textToSpeak) {
      addToast('Aucun texte disponible pour synthétiser la voix off.', 'error');
      return;
    }

    setIsGeneratingVoiceover(true);
    const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();
    const resolved = resolveVoicePayloadForTTS(
      selectedVoiceName,
      customVoices,
      'gemini-3.8-flash-tts',
      'Masculin',
      'voix posée, expressive et incarnée pour narration vidéo'
    );

    try {
      const response = await authFetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSpeak,
          voiceName: resolved.voiceName,
          model: resolved.model,
          language: 'Français',
          gender: resolved.gender,
          style: resolved.style,
          customVoiceStyle: resolved.customVoiceStyle,
          apiKey: effectiveKey
        })
      }, effectiveKey);

      const data = await safeJsonResponse<any>(response, 'du moteur vocal');
      if (!response.ok || !data.audio || data.fallback) {
        throw new Error(data.error || data.message || 'Erreur lors de la synthèse vocale Gemini');
      }

      const binary = atob(data.audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const isRiffWav = bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
      const blob = new Blob([bytes], { type: isRiffWav ? 'audio/wav' : 'audio/mp3' });
      if (voiceoverAudioUrl) URL.revokeObjectURL(voiceoverAudioUrl);
      const newUrl = URL.createObjectURL(blob);

      setVoiceoverAudioBlob(blob);
      setVoiceoverAudioUrl(newUrl);
      setVoiceoverLabel(`Voix IA (${resolved.activeCustomProfile?.name || resolved.voiceName})`);

      if (mediaRef.current && isVideo) {
        mediaRef.current.volume = originalAudioVolume;
      }

      const measuredDur = await measureAudioBlobDuration(blob);
      if (measuredDur > 0) {
        setVoiceoverDuration(measuredDur);
      }

      if (autoSyncSrtWithVoice && rawText.trim() && !looksLikeSRT(rawText) && measuredDur > 0) {
        const { segments: synced, metrics } = buildVoiceSynchronizedSRT(rawText, measuredDur, voiceDelaySeconds);
        if (synced.length > 0) {
          setSegments(synced);
          setLastVoiceSyncMetrics(metrics);
          addToast(
            `Voix off générée (${measuredDur.toFixed(1)}s) · ${synced.length} sous-titres .SRT synchronisés (${metrics?.charsPerSec.toFixed(1)} car./s) !`,
            'success'
          );
          return;
        }
      }

      addToast(`Voix off (${resolved.activeCustomProfile?.name || resolved.voiceName}) générée !`, 'success');
    } catch (err: any) {
      console.warn('Voiceover generation warning, using browser speech fallback:', err);
      handleBrowserSpeechFallback(textToSpeak);
      const msg = err?.message || '';
      if (msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        addToast('Quota Gemini atteint. Synthèse vocale locale (navigateur) active.', 'info');
      } else {
        addToast('Synthèse vocale locale (navigateur) active.', 'info');
      }
    } finally {
      setIsGeneratingVoiceover(false);
    }
  };

  const handleBrowserSpeechFallback = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      addToast('Synthèse vocale non supportée par ce navigateur.', 'error');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Start / Stop Live Microphone Voiceover Recording
  const stopMicStreamAndMeter = () => {
    if (micTimerRef.current) {
      window.clearInterval(micTimerRef.current);
      micTimerRef.current = null;
    }
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micAnalyserCtxRef.current) {
      micAnalyserCtxRef.current.close().catch(() => {});
      micAnalyserCtxRef.current = null;
    }
    setMicLevel(0);
  };

  const handleStartMicRecording = async () => {
    setMicPermissionError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicPermissionError("L'enregistrement microphone n'est pas supporté sur ce navigateur ou contexte non sécurisé.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // Setup live RMS input level meter
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        micAnalyserCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const dataArr = new Uint8Array(analyser.frequencyBinCount);
        const tickMeter = () => {
          analyser.getByteTimeDomainData(dataArr);
          let sum = 0;
          for (let i = 0; i < dataArr.length; i++) {
            const v = (dataArr[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArr.length);
          setMicLevel(Math.min(100, Math.round(rms * 280)));
          micAnimFrameRef.current = requestAnimationFrame(tickMeter);
        };
        tickMeter();
      }

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const supportedMime = preferredTypes.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      micChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) micChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stopMicStreamAndMeter();
        setIsRecordingMic(false);
        if (syncVideoWhileRecording && mediaRef.current && !mediaRef.current.paused) {
          mediaRef.current.pause();
          if (mediaRef.current) mediaRef.current.muted = false;
        }

        const rawBlob = new Blob(micChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (rawBlob.size < 200) {
          addToast('Enregistrement trop court ou vide.', 'info');
          return;
        }

        setIsProcessingMicRecording(true);
        try {
          let finalBlob: Blob = rawBlob;
          let decodedDuration = 0;
          const AudioCtxDecode = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioCtxDecode) {
            const decodeCtx = new AudioCtxDecode();
            try {
              const ab = await rawBlob.arrayBuffer();
              const audioBuf = await decodeCtx.decodeAudioData(ab.slice(0));
              decodedDuration = audioBuf.duration || 0;
              finalBlob = audioBufferToWavBlob(audioBuf);
            } catch {
              finalBlob = rawBlob;
            } finally {
              decodeCtx.close().catch(() => {});
            }
          }

          if (decodedDuration <= 0) {
            decodedDuration = await measureAudioBlobDuration(finalBlob);
          }

          if (voiceoverAudioUrl) URL.revokeObjectURL(voiceoverAudioUrl);
          const url = URL.createObjectURL(finalBlob);
          setVoiceoverAudioBlob(finalBlob);
          setVoiceoverAudioUrl(url);
          setVoiceoverLabel(`Voix Micro (${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`);
          if (decodedDuration > 0) {
            setVoiceoverDuration(decodedDuration);
            if (autoSyncSrtWithVoice && rawText.trim() && !looksLikeSRT(rawText)) {
              const { segments: synced, metrics } = buildVoiceSynchronizedSRT(rawText, decodedDuration, voiceDelaySeconds);
              if (synced.length > 0) {
                setSegments(synced);
                setLastVoiceSyncMetrics(metrics);
                addToast(`Voix micro enregistrée (${decodedDuration.toFixed(1)}s) et ${synced.length} sous-titres .SRT synchronisés !`, 'success');
                return;
              }
            }
          }
          addToast('Voix off enregistrée au microphone et prête pour le montage !', 'success');
        } finally {
          setIsProcessingMicRecording(false);
        }
      };

      micRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecordingMic(true);
      setRecordingSeconds(0);

      // Sync video playback muted if requested
      if (syncVideoWhileRecording && mediaRef.current) {
        mediaRef.current.muted = true;
        mediaRef.current.currentTime = Math.max(0, voiceDelaySeconds);
        mediaRef.current.play().catch(() => {});
      }

      const startAt = Date.now();
      micTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((Date.now() - startAt) / 1000);
      }, 100);
    } catch (err: any) {
      stopMicStreamAndMeter();
      setIsRecordingMic(false);
      const errName = err?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setMicPermissionError(
          "Autorisation du microphone refusée. Cliquez sur l'icône de cadenas/caméra à côté de l'URL de votre navigateur pour autoriser le micro, puis réessayez."
        );
      } else if (errName === 'NotFoundError') {
        setMicPermissionError('Aucun microphone détecté sur cet appareil.');
      } else {
        setMicPermissionError(err?.message || "Impossible d'accéder au microphone.");
      }
    }
  };

  const handleStopMicRecording = () => {
    if (micRecorderRef.current && micRecorderRef.current.state !== 'inactive') {
      micRecorderRef.current.stop();
    } else {
      stopMicStreamAndMeter();
      setIsRecordingMic(false);
    }
  };

  const handleUploadVoiceoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;
    const url = URL.createObjectURL(uploaded);
    if (voiceoverAudioUrl) URL.revokeObjectURL(voiceoverAudioUrl);
    setVoiceoverAudioBlob(uploaded);
    setVoiceoverAudioUrl(url);
    setVoiceoverLabel(uploaded.name);
    e.target.value = '';

    const measuredDur = await measureAudioBlobDuration(uploaded);
    if (measuredDur > 0) {
      setVoiceoverDuration(measuredDur);
      if (autoSyncSrtWithVoice && rawText.trim() && !looksLikeSRT(rawText)) {
        const { segments: synced, metrics } = buildVoiceSynchronizedSRT(rawText, measuredDur, voiceDelaySeconds);
        if (synced.length > 0) {
          setSegments(synced);
          setLastVoiceSyncMetrics(metrics);
          addToast(`Voix "${uploaded.name}" (${measuredDur.toFixed(1)}s) chargée et ${synced.length} sous-titres .SRT synchronisés !`, 'success');
          return;
        }
      }
    }
    addToast(`Piste de voix off "${uploaded.name}" chargée !`, 'success');
  };

  const handleSaveVoiceoverToProject = async () => {
    if (!voiceoverAudioBlob || !onSaveAssetToProject || !activeProjectName) {
      addToast('Sélectionnez un projet cible et enregistrez/générez une voix off d’abord.', 'info');
      return;
    }
    try {
      const dataUrl = await blobToDataUrl(voiceoverAudioBlob);
      const safeLabel = (voiceoverLabel || `VoixOff_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}`)
        .replace(/\.[^/.]+$/, '');
      onSaveAssetToProject(activeProjectName, 'audios', safeLabel, dataUrl);
      addToast(`Voix off "${safeLabel}" sauvegardée dans le projet "${activeProjectName}" !`, 'success');
    } catch {
      addToast('Erreur lors de la sauvegarde de la voix off dans le projet.', 'error');
    }
  };

  const handleSaveSubtitlesToProject = () => {
    if (!onSaveAssetToProject || !activeProjectName) {
      addToast('Sélectionnez un projet cible pour sauvegarder les sous-titres.', 'info');
      return;
    }
    const srt = getCombinedSRTString();
    if (!srt.trim()) {
      addToast('Aucun sous-titre généré à sauvegarder.', 'info');
      return;
    }
    const baseName = (file?.name || 'Sous_titres').replace(/\.[^/.]+$/, '');
    const itemName = `${baseName}_sous_titres.srt`;
    onSaveAssetToProject(activeProjectName, 'texts', itemName, srt);
    addToast(`Sous-titres "${itemName}" enregistrés dans "${activeProjectName}" !`, 'success');
  };

  const handleSaveExportedVideoToProject = async () => {
    if (!exportedVideoBlob || !onSaveAssetToProject || !activeProjectName) return;
    if (exportedVideoBlob.size > 25 * 1024 * 1024) {
      addToast('Vidéo supérieure à 25 Mo : utilisez le téléchargement MP4 direct.', 'info');
      return;
    }
    try {
      const dataUrl = await blobToDataUrl(exportedVideoBlob);
      const baseName = (file?.name || 'Video_VoxArt').replace(/\.[^/.]+$/, '');
      onSaveAssetToProject(activeProjectName, 'videos', `${baseName}_montage`, dataUrl);
      addToast(`Vidéo finale sauvegardée dans le projet "${activeProjectName}" !`, 'success');
    } catch {
      addToast('Erreur lors de la sauvegarde vidéo dans le projet.', 'error');
    }
  };

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) {
      mediaRef.current.play();
    } else {
      mediaRef.current.pause();
    }
  };

  const handleUpdateSegment = (idx: number, patch: Partial<Segment>) => {
    setSegments(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...patch };
      return updated;
    });
  };

  const handleShiftAllSegments = (deltaSec: number) => {
    if (segments.length === 0) return;
    setSegments((prev) =>
      prev.map((seg) => {
        const nextStart = Math.max(0, Number((seg.start + deltaSec).toFixed(2)));
        const nextEnd = Math.max(nextStart + 0.5, Number((seg.end + deltaSec).toFixed(2)));
        return { ...seg, start: nextStart, end: nextEnd };
      })
    );
    addToast(`Tous les sous-titres décalés de ${deltaSec > 0 ? '+' : ''}${deltaSec.toFixed(1)}s.`, 'info');
  };

  const handleAddSegment = () => {
    const start = Number(Math.max(0, currentTime).toFixed(2));
    const end = Number((start + Math.max(1.5, minSubtitleDuration)).toFixed(2));
    setSegments((prev) => {
      const next = [...prev, { start, end, text: 'Nouveau sous-titre' }].sort((a, b) => a.start - b.start);
      return next;
    });
  };

  const handleDeleteSegment = (idx: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSelectMusicTrack = async (trackId: string) => {
    setSelectedMusicId(trackId);
    if (trackId === '__NONE__') {
      if (musicAudioRef.current) musicAudioRef.current.pause();
      if (musicAudioUrl && !activeBackingTrack?.url) {
        URL.revokeObjectURL(musicAudioUrl);
      }
      setMusicAudioUrl(null);
      setMusicAudioBlob(null);
      setCustomMusicName(null);
      addToast('Fond sonore désactivé.', 'info');
      return;
    }

    if (trackId === '__CUSTOM__') {
      customMusicInputRef.current?.click();
      return;
    }

    if (trackId === '__ACTIVE__') {
      if (activeBackingTrack?.url) {
        setMusicAudioUrl(activeBackingTrack.url);
        setCustomMusicName(activeBackingTrack.title || 'Fond actif du Studio');
        try {
          const { buffer, mimeType } = await readSourceUrlToArrayBuffer(activeBackingTrack.url);
          const b = new Blob([buffer], { type: mimeType || 'audio/wav' });
          setMusicAudioBlob(b);
          addToast(`Fond sonore "${activeBackingTrack.title}" associé à la vidéo !`, 'success');
        } catch (e) {
          console.warn('Could not fetch active backing track blob:', e);
        }
      } else {
        addToast('Aucun fond sonore actif trouvé dans le Studio Vocal.', 'info');
        setSelectedMusicId('__NONE__');
      }
      return;
    }

    if (trackId.startsWith('proj:::') && activeProjectData) {
      const audioIdStr = trackId.replace('proj:::', '');
      const item = projectAudios.find((a) => String(a.id) === audioIdStr);
      if (item) {
        try {
          const { buffer, mimeType } = await readSourceUrlToArrayBuffer(item.data);
          const b = new Blob([buffer], { type: mimeType || 'audio/wav' });
          setMusicAudioBlob(b);
          setMusicAudioUrl(URL.createObjectURL(b));
          setCustomMusicName(item.name);
          addToast(`Fond sonore "${item.name}" chargé depuis le projet !`, 'success');
        } catch {
          addToast('Erreur lors du chargement du fond sonore du projet.', 'error');
        }
      }
      return;
    }

    // Traditional rhythm presets from AfricanAudioEngine
    const preset = (TRADITIONAL_RHYTHM_PRESETS as any)[trackId];
    if (preset) {
      try {
        setIsPreparingMusic(true);
        addToast(`Préparation du rythme "${preset.name || trackId}"...`, 'info');
        const blob = await renderCompositionToWav(preset);
        const url = URL.createObjectURL(blob);
        setMusicAudioBlob(blob);
        setMusicAudioUrl(url);
        setCustomMusicName(preset.name);
        addToast(`Rythme "${preset.name}" prêt !`, 'success');
      } catch (e) {
        console.warn('Error rendering rhythm preset:', e);
        addToast('Erreur lors de la génération du fond sonore', 'error');
      } finally {
        setIsPreparingMusic(false);
      }
    }
  };

  const handleCustomMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const musicF = e.target.files?.[0];
    if (!musicF) return;
    const url = URL.createObjectURL(musicF);
    setMusicAudioBlob(musicF);
    setMusicAudioUrl(url);
    setSelectedMusicId('__CUSTOM__');
    setCustomMusicName(musicF.name);
    addToast(`Musique "${musicF.name}" chargée !`, 'success');
    e.target.value = '';
  };

  // Render & Export final assembled MP4 video with Voiceover + Burned Subtitles + Background Music
  const handleExportEditedVideo = async () => {
    if (!file || !isVideo) {
      addToast("Veuillez sélectionner un fichier vidéo d'abord.", 'error');
      return;
    }

    setIsExportingVideo(true);
    setExportProgressMsg('Assemblage vidéo, voix off, musique & sous-titres...');

    try {
      const srtString = getCombinedSRTString();
      const formData = new FormData();
      formData.append('video', file);

      if (voiceoverAudioBlob) {
        const ext = voiceoverAudioBlob.type.includes('wav')
          ? 'wav'
          : voiceoverAudioBlob.type.includes('webm')
            ? 'webm'
            : voiceoverAudioBlob.type.includes('ogg')
              ? 'ogg'
              : 'mp3';
        formData.append('voice', voiceoverAudioBlob, `voiceover.${ext}`);
        formData.append('voiceDelaySeconds', voiceDelaySeconds.toString());
      }

      if (musicAudioBlob && selectedMusicId !== '__NONE__') {
        const mExt = musicAudioBlob.type.includes('mp3') || musicAudioBlob.type.includes('mpeg') ? 'mp3' : 'wav';
        formData.append('music', musicAudioBlob, `music.${mExt}`);
        formData.append('musicVolume', musicVolume.toString());
      }

      formData.append('srtContent', srtString);
      formData.append('burnSubtitles', burnSubtitlesInExport ? 'true' : 'false');
      formData.append('originalAudioVolume', originalAudioVolume.toString());
      formData.append('voiceVolume', voiceVolume.toString());
      formData.append('subtitleStyle', subtitleStyle);
      formData.append('subtitlePosition', subtitlePosition);
      formData.append('subtitleFontSize', subtitleFontSize.toString());

      const response = await authFetch('/api/export-video', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Erreur lors de l'assemblage de la vidéo");
      }

      const rawBuffer = await response.arrayBuffer();
      const blob = new Blob([rawBuffer], { type: 'video/mp4' });
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
      const outputUrl = URL.createObjectURL(blob);
      setExportedVideoUrl(outputUrl);
      setExportedVideoBlob(blob);

      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const downloadName = `${baseName}_voxart_subtitled.mp4`;
      const serverDownloadUrl = response.headers.get('X-Download-Url');
      if (serverDownloadUrl) {
        triggerHttpUrlDownload(serverDownloadUrl, downloadName);
      } else {
        await triggerSafeDownload(blob, downloadName);
      }

      addToast('Vidéo MP4 (H.264/AAC) compatible InShot, CapCut et mobile téléchargée !', 'success');
    } catch (err: any) {
      console.error(err);
      addToast(err?.message || "Erreur lors de l'export de la vidéo", 'error');
    } finally {
      setIsExportingVideo(false);
      setExportProgressMsg('');
    }
  };

  const exportCurrentAsSRT = () => {
    if (segments.length === 0) return;
    const srt = getCombinedSRTString();
    const blob = new Blob([srt], { type: 'application/x-subrip;charset=utf-8' });
    void triggerSafeDownload(blob, `${(file?.name || 'sous-titres').replace(/\.[^/.]+$/, '')}.srt`);
    addToast('Fichier .SRT téléchargé', 'success');
  };

  const exportCurrentAsVTT = () => {
    if (segments.length === 0) return;
    let vtt = 'WEBVTT\n\n';
    segments.forEach((seg, idx) => {
      vtt += `${idx + 1}\n${secondsToVTT(seg.start)} --> ${secondsToVTT(seg.end)}\n${seg.text}\n\n`;
    });

    const blob = new Blob([vtt], { type: 'text/vtt;charset=utf-8' });
    void triggerSafeDownload(blob, `${(file?.name || 'sous-titres').replace(/\.[^/.]+$/, '')}.vtt`);
    addToast('Fichier .VTT WebVTT téléchargé', 'success');
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    addToast('Copié dans le presse-papier !', 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const exportAllAsZip = async () => {
    const zip = new JSZip();
    filteredHistory.forEach(item => {
      const baseName = item.name.replace(/\.[^/.]+$/, '');
      zip.file(`${baseName}.txt`, item.transcription || '');
      if (item.srtContent) {
        zip.file(`${baseName}.srt`, item.srtContent);
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    await triggerSafeDownload(content, 'voxart_transcriptions_subtitles.zip');
    addToast('Archive ZIP téléchargée', 'success');
  };

  const activeSegment = segments.find(seg => currentTime >= seg.start && currentTime <= seg.end);

  const filteredHistory = history.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.transcription.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const overlayPositionClass =
    subtitlePosition === 'top'
      ? 'top-5'
      : subtitlePosition === 'center'
        ? 'top-1/2 -translate-y-1/2'
        : 'bottom-6';

  const overlayTextSizeClass =
    subtitleFontSize >= 21
      ? 'text-base sm:text-lg'
      : subtitleFontSize <= 15
        ? 'text-xs sm:text-sm'
        : 'text-sm sm:text-base';

  return (
    <div className="bg-[#1e1e2e] p-5 sm:p-7 rounded-2xl border border-[#313244] shadow-2xl space-y-6 text-[#cdd6f4]">
      {/* Éléments audio de pré-écoute cachés */}
      <audio
        ref={voiceoverAudioRef}
        src={voiceoverAudioUrl || undefined}
        preload="auto"
        onLoadedMetadata={() => {
          if (voiceoverAudioRef.current) {
            setVoiceoverDuration(voiceoverAudioRef.current.duration || 0);
          }
        }}
      />
      <audio ref={musicAudioRef} src={musicAudioUrl || undefined} loop preload="auto" />
      <input
        ref={customMusicInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a"
        className="hidden"
        onChange={handleCustomMusicUpload}
      />

      {/* Top navigation tabs */}
      <div className="flex items-center gap-2 bg-[#181825] p-1.5 rounded-xl border border-[#313244]/60 flex-wrap sm:flex-nowrap">
        {onBackToProject && (
          <button
            type="button"
            onClick={onBackToProject}
            className="px-3 py-2 text-xs font-bold text-[#a6e3a1] hover:bg-[#313244] rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour au projet</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onSwitchMode('single')}
          className="flex-1 py-2 px-3 text-xs font-bold text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-lg transition-all whitespace-nowrap cursor-pointer"
        >
          Studio Vocal
        </button>
        <button
          type="button"
          onClick={() => onSwitchMode('workspace')}
          className="flex-1 py-2 px-3 text-xs font-bold text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-lg transition-all whitespace-nowrap cursor-pointer"
        >
          Agent IA & Scénarios
        </button>
        <button
          type="button"
          className="flex-1 py-2 px-3 text-xs font-bold text-[#89b4fa] bg-[#313244] rounded-lg shadow-sm whitespace-nowrap"
        >
          Montage Vidéo, Voix Off & Sous-titres
        </button>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#313244]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#181825] rounded-2xl border border-[#89b4fa]/30">
            <Film className="w-6 h-6 text-[#89b4fa]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Studio Montage : Voix Off, Micro & Sous-titres
            </h2>
            <p className="text-xs text-[#a6adc8]">
              Assemblez vos éléments de projet, enregistrez votre voix au micro, générez vos sous-titres et exportez en MP4 HD.
            </p>
          </div>
        </div>

        {activeBackingTrack && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#181825] border border-[#fbbf24]/30 rounded-xl text-xs text-[#fde68a] shrink-0">
            <Music className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span className="truncate max-w-[160px]">Fond : {activeBackingTrack.title}</span>
          </div>
        )}
      </div>

      {/* BARRE PROJET ACTIF : Charger Vidéo, Script et Audio directement depuis un Projet */}
      {projectNames.length > 0 && (
        <div className="p-4 bg-[#181825] rounded-2xl border border-[#89b4fa]/35 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#89b4fa]">
              <Folder className="w-4 h-4 shrink-0" />
              <span>Charger les éléments d’un projet</span>
            </div>

            <select
              value={activeProjectName}
              onChange={(e) => setActiveProjectName(e.target.value)}
              aria-label="Projet actif"
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#11111b] border border-[#45475a] text-xs font-semibold text-[#cdd6f4] focus:outline-none focus:border-[#89b4fa] cursor-pointer"
            >
              {projectNames.map((p) => (
                <option key={p} value={p}>
                  {p} ({(library?.[p]?.videos?.length || 0)} vid · {(library?.[p]?.audios?.length || 0)} aud · {(library?.[p]?.texts?.length || 0)} txt)
                </option>
              ))}
            </select>
          </div>

          {activeProjectData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Vidéo du projet */}
              <div className="bg-[#11111b] p-2.5 rounded-xl border border-[#313244] space-y-1">
                <span className="text-[11px] font-semibold text-[#f38ba8] flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  <span>Vidéo du projet ({projectVideos.length})</span>
                </span>
                <select
                  value=""
                  disabled={projectVideos.length === 0}
                  onChange={(e) => {
                    const v = projectVideos.find((item) => String(item.id) === e.target.value);
                    if (v) handleLoadProjectVideo(v);
                  }}
                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4] disabled:opacity-50 cursor-pointer"
                >
                  <option value="">
                    {projectVideos.length > 0 ? 'Choisir une vidéo du projet...' : 'Aucune vidéo dans ce projet'}
                  </option>
                  {projectVideos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Script / SRT du projet */}
              <div className="bg-[#11111b] p-2.5 rounded-xl border border-[#313244] space-y-1">
                <span className="text-[11px] font-semibold text-[#cba6f7] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Script / Sous-titres ({projectTexts.length})</span>
                </span>
                <select
                  value=""
                  disabled={projectTexts.length === 0}
                  onChange={(e) => {
                    const t = projectTexts.find((item) => String(item.id) === e.target.value);
                    if (t) handleLoadProjectScript(t);
                  }}
                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4] disabled:opacity-50 cursor-pointer"
                >
                  <option value="">
                    {projectTexts.length > 0 ? 'Charger un script ou SRT...' : 'Aucun script dans ce projet'}
                  </option>
                  {projectTexts.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Audio du projet (Voix off) */}
              <div className="bg-[#11111b] p-2.5 rounded-xl border border-[#313244] space-y-1">
                <span className="text-[11px] font-semibold text-[#a6e3a1] flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" />
                  <span>Voix off du projet ({projectAudios.length})</span>
                </span>
                <select
                  value=""
                  disabled={projectAudios.length === 0}
                  onChange={(e) => {
                    const a = projectAudios.find((item) => String(item.id) === e.target.value);
                    if (a) {
                      handleSelectVoiceoverFromLibrary(a.data, a.name);
                      setVoiceoverSourceTab('library');
                    }
                  }}
                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4] disabled:opacity-50 cursor-pointer"
                >
                  <option value="">
                    {projectAudios.length > 0 ? 'Poser un audio en voix off...' : 'Aucun audio dans ce projet'}
                  </option>
                  {projectAudios.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 1. Média Source & Génération des Sous-titres */}
      <div className="p-4 bg-[#181825] rounded-2xl border border-[#313244] space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <label className="cursor-pointer flex-1 flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] text-xs font-bold transition-all border border-[#89b4fa]/30 hover:border-[#89b4fa] shadow-sm group">
            <Upload className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-[260px] sm:max-w-none">
              {file ? `${isVideo ? 'Vidéo' : 'Audio'} : ${file.name}` : 'Importer une vidéo (.mp4, .mov, .webm) ou un audio'}
            </span>
            <input
              type="file"
              accept="video/*,audio/*,.mp4,.mov,.webm,.mkv,.avi,.mp3,.wav,.m4a"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleTranscribe}
            disabled={!file || isLoading}
            className="min-h-[44px] px-5 py-3 bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] rounded-xl text-xs font-bold transition-all disabled:opacity-45 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Extraction...</span>
              </>
            ) : (
              <>
                <Subtitles className="w-4 h-4" />
                <span>Extraire sous-titres de la vidéo</span>
              </>
            )}
          </button>
        </div>

        {/* Options complémentaires de génération de sous-titres */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#313244]/70">
          <div className="text-[11px] text-[#a6adc8] tabular-nums">
            {file
              ? `Taille : ${(file.size / (1024 * 1024)).toFixed(2)} Mo · ${isVideo ? 'Vidéo' : 'Audio'}`
              : 'Importez une vidéo ci-dessus ou chargez-la depuis votre projet.'}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {voiceoverAudioBlob && (
              <button
                type="button"
                onClick={() => handleTranscribeMediaBlob(voiceoverAudioBlob, voiceoverLabel || 'voix_off.wav', 'voiceover')}
                disabled={isTranscribingVoiceover}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#11111b] border border-[#a6e3a1]/40 hover:border-[#a6e3a1] text-[#a6e3a1] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isTranscribingVoiceover ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
                <span>Transcrire la voix off en sous-titres</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleGenerateSubtitlesFromScript()}
              disabled={!rawText.trim()}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#cba6f7]/15 border border-[#cba6f7]/50 hover:border-[#cba6f7] text-[#cba6f7] text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>
                {voiceoverDuration > 0
                  ? 'Générer .SRT synchro voix'
                  : 'Générer .SRT depuis le texte'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Video / Audio Player with Live Subtitle Overlay */}
      {fileUrl && (
        <div className="space-y-3 p-4 bg-[#11111b] rounded-2xl border border-[#313244] shadow-inner">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#89b4fa]">
              <Eye className="w-4 h-4" />
              <span>
                Aperçu synchronisé · {voiceoverAudioUrl ? `Voix off active (${voiceDelaySeconds.toFixed(1)}s)` : 'Média original'}
              </span>
            </div>

            {isVideo && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSubtitleStyle('yellow')}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${subtitleStyle === 'yellow' ? 'bg-[#f9e2af] text-[#11111b]' : 'bg-[#313244] text-[#a6adc8]'}`}
                >
                  Reels Jaune
                </button>
                <button
                  type="button"
                  onClick={() => setSubtitleStyle('classic')}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${subtitleStyle === 'classic' ? 'bg-white text-[#11111b]' : 'bg-[#313244] text-[#a6adc8]'}`}
                >
                  Blanc Pro
                </button>
                <button
                  type="button"
                  onClick={() => setSubtitleStyle('afro')}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${subtitleStyle === 'afro' ? 'bg-[#fab387] text-[#11111b]' : 'bg-[#313244] text-[#a6adc8]'}`}
                >
                  RidiaLArt Ocre
                </button>

                <select
                  value={subtitlePosition}
                  onChange={(e) => setSubtitlePosition(e.target.value as 'bottom' | 'center' | 'top')}
                  aria-label="Position des sous-titres"
                  className="min-h-[32px] px-2 py-1 rounded-lg bg-[#181825] border border-[#313244] text-[11px] text-[#cdd6f4] cursor-pointer"
                >
                  <option value="bottom">Position : Bas</option>
                  <option value="center">Position : Centre</option>
                  <option value="top">Position : Haut</option>
                </select>

                <select
                  value={subtitleFontSize}
                  onChange={(e) => setSubtitleFontSize(Number(e.target.value))}
                  aria-label="Taille des sous-titres"
                  className="min-h-[32px] px-2 py-1 rounded-lg bg-[#181825] border border-[#313244] text-[11px] text-[#cdd6f4] cursor-pointer"
                >
                  <option value={15}>Taille : Compact</option>
                  <option value={18}>Taille : Standard</option>
                  <option value={22}>Taille : Grand</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowSubtitlesOverlay(!showSubtitlesOverlay)}
                  className={`p-1.5 rounded-lg text-xs cursor-pointer ${showSubtitlesOverlay ? 'text-[#89b4fa] bg-[#313244]' : 'text-[#6c7086] bg-[#181825]'}`}
                  title="Afficher/Masquer l'aperçu des sous-titres"
                >
                  <Subtitles className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Interactive Player Screen */}
          <div className="relative rounded-xl overflow-hidden bg-black/95 border border-[#313244] flex items-center justify-center min-h-[220px] max-h-[440px]">
            {isVideo ? (
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={fileUrl}
                onTimeUpdate={handleMediaTimeUpdate}
                onLoadedMetadata={() => {
                  if (mediaRef.current) setDuration(mediaRef.current.duration);
                }}
                onPlay={handleMediaPlay}
                onPause={handleMediaPause}
                className="w-full h-auto max-h-[440px] object-contain rounded-xl"
                playsInline
                onClick={togglePlay}
              />
            ) : (
              <div className="w-full py-12 flex flex-col items-center justify-center gap-3">
                <audio
                  ref={mediaRef as React.RefObject<HTMLAudioElement>}
                  src={fileUrl}
                  onTimeUpdate={handleMediaTimeUpdate}
                  onLoadedMetadata={() => {
                    if (mediaRef.current) setDuration(mediaRef.current.duration);
                  }}
                  onPlay={handleMediaPlay}
                  onPause={handleMediaPause}
                  className="hidden"
                />
                <div className="p-4 rounded-full bg-[#89b4fa]/10 border border-[#89b4fa]/30 text-[#89b4fa]">
                  <Music className="w-8 h-8" />
                </div>
                <p className="text-xs text-[#a6adc8] font-medium">Piste audio en cours de lecture</p>
              </div>
            )}

            {/* Live Subtitles Overlay with Karaoké Word-Level Highlight */}
            {showSubtitlesOverlay && activeSegment && (() => {
              const segDur = Math.max(0.1, activeSegment.end - activeSegment.start);
              const progress = Math.max(0, Math.min(1, (currentTime - activeSegment.start) / segDur));
              const words = activeSegment.text.trim().split(/\s+/);
              const currentWordIndex = Math.min(words.length - 1, Math.floor(progress * words.length));

              return (
                <div className={`absolute ${overlayPositionClass} left-3 right-3 flex justify-center pointer-events-none transition-all duration-150 z-20`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-center max-w-[92%] font-black ${overlayTextSizeClass} leading-relaxed shadow-2xl drop-shadow-md backdrop-blur-md border flex flex-wrap justify-center gap-1.5 ${
                      subtitleStyle === 'yellow'
                        ? 'bg-black/90 border-yellow-500/40 tracking-wide'
                        : subtitleStyle === 'afro'
                          ? 'bg-[#1c0f04]/90 border-amber-600/50 tracking-wide'
                          : 'bg-black/90 border-white/30'
                    }`}
                  >
                    {words.map((word, wIdx) => {
                      const isCurrent = wIdx === currentWordIndex;
                      const isPast = wIdx < currentWordIndex;

                      return (
                        <span
                          key={wIdx}
                          className={`transition-all duration-150 inline-block ${
                            isCurrent
                              ? subtitleStyle === 'afro'
                                ? 'text-[#f59e0b] scale-110 font-black'
                                : subtitleStyle === 'yellow'
                                  ? 'text-[#fbbf24] scale-110 font-black'
                                  : 'text-[#38bdf8] scale-110 font-black'
                              : isPast
                                ? subtitleStyle === 'yellow'
                                  ? 'text-[#f9e2af]'
                                  : subtitleStyle === 'afro'
                                    ? 'text-[#fbbf24]'
                                    : 'text-white'
                                : 'text-white/55'
                          }`}
                        >
                          {word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Player controls bar */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={togglePlay}
              className="p-2.5 bg-[#89b4fa] text-[#11111b] rounded-xl hover:bg-[#b4befe] transition-all shadow-md shrink-0 cursor-pointer"
              title={isPlaying ? 'Mettre en pause' : 'Lire'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <div className="flex-1 flex flex-col gap-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => handleMediaSeek(parseFloat(e.target.value))}
                className="w-full h-2 bg-[#313244] rounded-lg appearance-none cursor-pointer accent-[#89b4fa]"
              />
              <div className="flex justify-between text-[10px] font-mono tabular-nums text-[#a6adc8]">
                <span>{secondsToSRT(currentTime).split(',')[0]}</span>
                <span>{secondsToSRT(duration).split(',')[0]}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Studio Voix Off (Micro en direct · Synthèse IA · Bibliothèque) & Mixage Audio */}
      <div
        ref={voiceoverSectionRef}
        className="p-5 bg-[#181825] rounded-2xl border border-[#89b4fa]/35 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#313244] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#89b4fa]/15 rounded-xl text-[#89b4fa]">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                <span>2. Réglages Voix Off : Microphone, IA & Mixage</span>
                {voiceoverAudioUrl && (
                  <span className="text-[11px] font-semibold text-[#a6e3a1]">
                    · Voix active ({voiceoverLabel || 'prête'})
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#a6adc8]">
                Enregistrez votre voix directement par microphone, générez-la par IA ou posez un audio du projet.
              </p>
            </div>
          </div>

          {/* Onglets Source Voix Off */}
          <div className="flex items-center gap-1 p-1 bg-[#11111b] rounded-xl border border-[#313244] shrink-0">
            <button
              type="button"
              onClick={() => setVoiceoverSourceTab('mic')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                voiceoverSourceTab === 'mic'
                  ? 'bg-[#89b4fa] text-[#11111b]'
                  : 'text-[#a6adc8] hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Microphone</span>
            </button>
            <button
              type="button"
              onClick={() => setVoiceoverSourceTab('ai')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                voiceoverSourceTab === 'ai'
                  ? 'bg-[#89b4fa] text-[#11111b]'
                  : 'text-[#a6adc8] hover:text-white'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Voix IA</span>
            </button>
            <button
              type="button"
              onClick={() => setVoiceoverSourceTab('library')}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                voiceoverSourceTab === 'library'
                  ? 'bg-[#89b4fa] text-[#11111b]'
                  : 'text-[#a6adc8] hover:text-white'
              }`}
            >
              <FolderDown className="w-3.5 h-3.5" />
              <span>Bibliothèque</span>
            </button>
          </div>
        </div>

        {/* Source Tab 1 : Enregistrement Microphone en direct */}
        {voiceoverSourceTab === 'mic' && (
          <div className="bg-[#11111b] p-4 rounded-xl border border-[#313244] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-[#cdd6f4]">
                  Enregistrement Microphone en direct
                </div>
                <label className="flex items-center gap-2 text-xs text-[#a6adc8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncVideoWhileRecording}
                    onChange={(e) => setSyncVideoWhileRecording(e.target.checked)}
                    disabled={isRecordingMic}
                    className="w-4 h-4 accent-[#89b4fa] cursor-pointer"
                  />
                  <span>Lire la vidéo en sourdine pendant l’enregistrement pour rester synchronisé</span>
                </label>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {isRecordingMic && (
                  <span className="font-mono tabular-nums text-xs font-bold text-[#f38ba8] px-2.5 py-1.5 rounded-lg bg-[#f38ba8]/10 border border-[#f38ba8]/30">
                    {recordingSeconds.toFixed(1)}s
                  </span>
                )}

                {!isRecordingMic ? (
                  <button
                    type="button"
                    onClick={handleStartMicRecording}
                    disabled={isProcessingMicRecording}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#f38ba8] hover:opacity-90 text-[#11111b] font-bold text-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isProcessingMicRecording ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Finalisation WAV...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>{voiceoverAudioUrl ? 'Réenregistrer au micro' : 'Démarrer l’enregistrement micro'}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopMicRecording}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#a6e3a1] hover:opacity-90 text-[#11111b] font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Arrêter & Valider</span>
                  </button>
                )}
              </div>
            </div>

            {/* Vumètre en temps réel pendant l'enregistrement */}
            {isRecordingMic && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-[#a6adc8]">
                  <span>Niveau d’entrée microphone</span>
                  <span className="font-mono tabular-nums">{micLevel}%</span>
                </div>
                <div className="w-full h-2 bg-[#181825] rounded-full overflow-hidden border border-[#313244]">
                  <div
                    className="h-full bg-[#a6e3a1] transition-all duration-75"
                    style={{ width: `${Math.max(4, micLevel)}%` }}
                  />
                </div>
              </div>
            )}

            {micPermissionError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{micPermissionError}</span>
              </div>
            )}
          </div>
        )}

        {/* Source Tab 2 : Voix Off IA Gemini */}
        {voiceoverSourceTab === 'ai' && (
          <div className="bg-[#11111b] p-4 rounded-xl border border-[#313244] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="block text-xs font-semibold text-[#a6adc8]">
                  Voix de synthèse (Gemini & Vos Voix Personnalisées) :
                </label>
                <select
                  value={selectedVoiceName}
                  onChange={(e) => setSelectedVoiceName(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#181825] border border-[#45475a] text-white text-xs font-medium focus:outline-none focus:border-[#89b4fa] cursor-pointer"
                >
                  {customVoices.length > 0 && (
                    <optgroup label="Mes Voix Personnalisées">
                      {customVoices.map((cv) => (
                        <option key={cv.id} value={toCustomVoiceOptionId(cv.id)}>
                          {cv.name} ({cv.baseVoiceName})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Voix Studio Gemini">
                    {PRESET_VOICE_OPTIONS.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <button
                type="button"
                onClick={handleGenerateVoiceover}
                disabled={isGeneratingVoiceover || (!rawText.trim() && segments.length === 0)}
                className="min-h-[42px] px-4 py-2.5 bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                {isGeneratingVoiceover ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Synthèse en cours...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Générer Voix Off (Gemini)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Source Tab 3 : Bibliothèque / Fichier audio local */}
        {voiceoverSourceTab === 'library' && (
          <div className="bg-[#11111b] p-4 rounded-xl border border-[#313244] space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#cdd6f4]">
                Poser une piste audio existante en voix off
              </span>
              <button
                type="button"
                onClick={() => voiceoverFileInputRef.current?.click()}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] font-semibold text-xs border border-[#89b4fa]/40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer un fichier (.mp3 / .wav)</span>
              </button>
              <input
                ref={voiceoverFileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleUploadVoiceoverFile}
              />
            </div>

            {library && Object.keys(library).length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const [projName, audioIdStr] = val.split(':::');
                  const audioItem = library[projName]?.audios?.find((a: any) => String(a.id) === audioIdStr);
                  if (audioItem) {
                    handleSelectVoiceoverFromLibrary(audioItem.data, audioItem.name);
                  }
                }}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#181825] border border-[#45475a] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#89b4fa] cursor-pointer"
              >
                <option value="">Sélectionner une piste enregistrée dans la Bibliothèque...</option>
                {activeProjectName && library[activeProjectName]?.audios?.length > 0 && (
                  <optgroup label={`Projet actif : ${activeProjectName}`}>
                    {library[activeProjectName].audios.map((audio: any) => (
                      <option key={`active-${audio.id}`} value={`${activeProjectName}:::${audio.id}`}>
                        {audio.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {Object.entries(library)
                  .filter(([p]) => p !== activeProjectName)
                  .map(([projName, projData]: [string, any]) => (
                    <optgroup key={projName} label={`Projet : ${projName}`}>
                      {projData.audios?.map((audio: any) => (
                        <option key={audio.id} value={`${projName}:::${audio.id}`}>
                          {audio.name} ({projName})
                        </option>
                      ))}
                    </optgroup>
                  ))}
              </select>
            )}
          </div>
        )}

        {/* Aperçu Voix Off active + Actions (Transcrire SRT / Enregistrer dans le projet) */}
        {voiceoverAudioUrl && (
          <div className="bg-[#11111b] p-3.5 rounded-xl border border-[#a6e3a1]/35 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#a6e3a1] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">Voix off prête : {voiceoverLabel || 'Piste active'}</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => voiceoverAudioBlob && handleTranscribeMediaBlob(voiceoverAudioBlob, voiceoverLabel || 'voix_off.wav', 'voiceover')}
                  disabled={isTranscribingVoiceover || !voiceoverAudioBlob}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#181825] border border-[#89b4fa]/40 hover:border-[#89b4fa] text-[#89b4fa] text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  {isTranscribingVoiceover ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Subtitles className="w-3 h-3" />}
                  <span>Générer SRT depuis cette voix</span>
                </button>

                {onSaveAssetToProject && activeProjectName && (
                  <button
                    type="button"
                    onClick={handleSaveVoiceoverToProject}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#a6e3a1]/15 border border-[#a6e3a1]/40 hover:bg-[#a6e3a1]/25 text-[#a6e3a1] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>Sauvegarder dans "{activeProjectName}"</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (voiceoverAudioUrl) URL.revokeObjectURL(voiceoverAudioUrl);
                    setVoiceoverAudioUrl(null);
                    setVoiceoverAudioBlob(null);
                    setVoiceoverLabel(null);
                    setVoiceoverDuration(0);
                  }}
                  aria-label="Retirer la voix off"
                  className="min-h-[34px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[11px] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <audio controls src={voiceoverAudioUrl} className="w-full h-9 accent-[#a6e3a1]" />
          </div>
        )}

        {/* Éditeur Script / Narration & Génération .SRT synchronisée sur la vitesse de la voix */}
        <div className="space-y-2.5 bg-[#11111b]/80 p-3.5 rounded-xl border border-[#313244]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-[#cdd6f4] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#89b4fa]" />
              <span>Texte du projet pour Voix Off & Sous-titres .SRT :</span>
            </label>

            <div className="flex items-center gap-1.5 flex-wrap">
              {initialText && (
                <button
                  type="button"
                  onClick={() => {
                    setRawText(initialText);
                    addToast("Texte du Studio copié dans le script !", 'success');
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] cursor-pointer"
                >
                  Importer du Studio Vocal
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!rawText.trim()) return;
                  setRawText(cleanTextForSpeech(rawText));
                  addToast('Formatage markdown nettoyé pour la diction.', 'success');
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#313244] hover:bg-[#45475a] text-[#a6e3a1] cursor-pointer"
              >
                Nettoyer pour voix off
              </button>

              <button
                type="button"
                onClick={() => handleGenerateSubtitlesFromScript()}
                disabled={!rawText.trim()}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#cba6f7]/20 hover:bg-[#cba6f7]/30 text-[#cba6f7] border border-[#cba6f7]/40 disabled:opacity-45 cursor-pointer flex items-center gap-1"
              >
                <Subtitles className="w-3 h-3" />
                <span>
                  {voiceoverDuration > 0
                    ? `Générer .SRT synchro voix (${voiceoverDuration.toFixed(1)}s)`
                    : 'Générer .SRT depuis le texte'}
                </span>
              </button>
            </div>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Rédigez ou chargez le texte de votre projet pour synthétiser une voix off et générer le fichier .SRT synchronisé avec sa vitesse de lecture..."
            rows={3}
            className="w-full p-2.5 rounded-lg bg-[#181825] border border-[#45475a] text-xs text-[#cdd6f4] focus:outline-none focus:border-[#89b4fa] resize-y"
          />

          {/* Barre de synchronisation vitesse de lecture <-> .SRT */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1.5 border-t border-[#313244]/80 text-[11px]">
            <label className="flex items-center gap-2 text-[#cdd6f4] cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncSrtWithVoice}
                onChange={(e) => setAutoSyncSrtWithVoice(e.target.checked)}
                className="w-4 h-4 accent-[#cba6f7] cursor-pointer"
              />
              <span>Auto-synchroniser le .SRT avec la vitesse de lecture dès qu’une voix est prête</span>
            </label>

            {voiceoverDuration > 0 ? (
              <div className="font-mono tabular-nums text-[#a6e3a1] flex items-center gap-2">
                <span>
                  Voix : {voiceoverDuration.toFixed(1)}s
                  {lastVoiceSyncMetrics ? ` · ${lastVoiceSyncMetrics.charsPerSec.toFixed(1)} car./s (${lastVoiceSyncMetrics.wpm} mots/min)` : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[#a6adc8]">
                <span>Vitesse estimée :</span>
                <select
                  value={speechPaceMultiplier}
                  onChange={(e) => setSpeechPaceMultiplier(parseFloat(e.target.value))}
                  aria-label="Vitesse de lecture estimée pour le SRT"
                  className="px-2 py-1 rounded bg-[#181825] border border-[#45475a] text-[11px] font-mono tabular-nums text-[#cdd6f4] cursor-pointer"
                >
                  <option value={0.8}>0.80× (Posé)</option>
                  <option value={1.0}>1.00× (Normal)</option>
                  <option value={1.2}>1.20× (Dynamique)</option>
                  <option value={1.4}>1.40× (Rapide)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Positionnement temporel voix off & Fond Sonore */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-[#11111b]/70 rounded-xl border border-[#313244] space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#cdd6f4]">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#89b4fa]" />
                <span>Départ voix off sur la vidéo :</span>
              </span>
              <span className="font-mono tabular-nums text-[#89b4fa]">{voiceDelaySeconds.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(15, Math.ceil(duration || 30))}
              step={0.5}
              value={voiceDelaySeconds}
              onChange={(e) => {
                const nextDelay = parseFloat(e.target.value);
                setVoiceDelaySeconds(nextDelay);
                if (autoSyncSrtWithVoice && voiceoverDuration > 0 && rawText.trim() && !looksLikeSRT(rawText)) {
                  const { segments: synced, metrics } = buildVoiceSynchronizedSRT(rawText, voiceoverDuration, nextDelay);
                  if (synced.length > 0) {
                    setSegments(synced);
                    setLastVoiceSyncMetrics(metrics);
                  }
                }
              }}
              className="w-full h-1.5 bg-[#313244] rounded-lg appearance-none cursor-pointer accent-[#89b4fa]"
            />
            <span className="text-[10px] text-[#6c7086] block">
              Décale le départ de la voix off (et des sous-titres synchronisés) après une intro.
            </span>
          </div>

          <div className="p-3 bg-[#11111b]/70 rounded-xl border border-[#fbbf24]/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#f9e2af] flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-[#fbbf24]" />
                <span>Fond Sonore / Musique d'Ambiance :</span>
              </label>
              {isPreparingMusic && <RefreshCw className="w-3 h-3 text-[#fbbf24] animate-spin" />}
            </div>

            <select
              value={selectedMusicId}
              onChange={(e) => handleSelectMusicTrack(e.target.value)}
              disabled={isPreparingMusic}
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#181825] border border-[#45475a] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#fbbf24] cursor-pointer"
            >
              {BACKGROUND_MUSIC_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
              {projectAudios.length > 0 && (
                <optgroup label={`Audios du projet (${activeProjectName})`}>
                  {projectAudios.map((a) => (
                    <option key={a.id} value={`proj:::${a.id}`}>
                      Projet : {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {customMusicName && selectedMusicId !== '__NONE__' && (
              <div className="text-[11px] text-[#fbbf24] flex items-center justify-between">
                <span className="truncate">Piste : {customMusicName}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (musicAudioRef.current) {
                      if (musicAudioRef.current.paused) musicAudioRef.current.play().catch(() => {});
                      else musicAudioRef.current.pause();
                    }
                  }}
                  className="text-[11px] underline hover:text-white shrink-0 ml-2 cursor-pointer"
                >
                  Tester audio
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mixeur 3 Canaux : Vidéo Originale · Voix Off · Fond Sonore */}
        <div className="p-3.5 bg-[#11111b] rounded-xl border border-[#313244] space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#cdd6f4]">
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#89b4fa]" />
              <span>Mixeur Audio 3 Canaux</span>
            </span>
            <span className="text-[11px] text-[#a6adc8] font-normal">
              Équilibrez le son vidéo, votre voix off et la musique
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="bg-[#181825] p-2.5 rounded-lg border border-[#313244] space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-semibold text-[#89b4fa] flex items-center gap-1">
                  <Volume2 className="w-3 h-3" />
                  <span>Vidéo Originale</span>
                </label>
                <span className="text-[11px] font-mono tabular-nums font-bold text-[#89b4fa]">
                  {Math.round(originalAudioVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={originalAudioVolume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setOriginalAudioVolume(val);
                  if (mediaRef.current) mediaRef.current.volume = val;
                }}
                className="w-full h-1.5 bg-[#313244] rounded-lg appearance-none cursor-pointer accent-[#89b4fa]"
              />
              <span className="text-[10px] text-[#6c7086] block">
                {originalAudioVolume === 0 ? 'Muet (remplacement total)' : 'Atténuation d’ambiance'}
              </span>
            </div>

            <div className="bg-[#181825] p-2.5 rounded-lg border border-[#313244] space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-semibold text-[#a6e3a1] flex items-center gap-1">
                  <Mic className="w-3 h-3" />
                  <span>Voix Off</span>
                </label>
                <span className="text-[11px] font-mono tabular-nums font-bold text-[#a6e3a1]">
                  {Math.round(voiceVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={voiceVolume}
                onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#313244] rounded-lg appearance-none cursor-pointer accent-[#a6e3a1]"
              />
              <span className="text-[10px] text-[#6c7086] block">
                Présence de la narration
              </span>
            </div>

            <div className="bg-[#181825] p-2.5 rounded-lg border border-[#fbbf24]/30 space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-semibold text-[#fbbf24] flex items-center gap-1">
                  <Music className="w-3 h-3" />
                  <span>Fond Sonore</span>
                </label>
                <span className="text-[11px] font-mono tabular-nums font-bold text-[#fbbf24]">
                  {Math.round(musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={musicVolume}
                onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                disabled={selectedMusicId === '__NONE__'}
                className="w-full h-1.5 bg-[#313244] rounded-lg appearance-none cursor-pointer accent-[#fbbf24] disabled:opacity-40"
              />
              <span className="text-[10px] text-[#6c7086] block">
                {selectedMusicId === '__NONE__' ? 'Aucun fond sélectionné' : 'Volume musical'}
              </span>
            </div>
          </div>
        </div>

        {/* Video Assembler & Export Trigger */}
        {isVideo && (
          <div className="pt-3 border-t border-[#313244] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11111b]/60 p-3.5 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#cdd6f4]">
              <input
                type="checkbox"
                checked={burnSubtitlesInExport}
                onChange={(e) => setBurnSubtitlesInExport(e.target.checked)}
                className="w-4 h-4 rounded text-[#89b4fa] focus:ring-0 cursor-pointer accent-[#89b4fa]"
              />
              <span>Incruster les sous-titres dans la vidéo finale (Hardsub)</span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportEditedVideo}
                disabled={isExportingVideo}
                className="min-h-[44px] px-5 py-2.5 bg-[#a6e3a1] hover:opacity-95 text-[#11111b] rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isExportingVideo ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{exportProgressMsg || 'Assemblage vidéo...'}</span>
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4" />
                    <span>Exporter la Vidéo Finale (.MP4)</span>
                  </>
                )}
              </button>

              {exportedVideoUrl && exportedVideoBlob && onSaveAssetToProject && activeProjectName && (
                <button
                  type="button"
                  onClick={handleSaveExportedVideoToProject}
                  className="min-h-[44px] px-4 py-2.5 bg-[#89b4fa]/15 hover:bg-[#89b4fa]/25 text-[#89b4fa] border border-[#89b4fa]/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Enregistrer dans "{activeProjectName}"</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Sous-titres Synchronisés & Réglages Timeline */}
      <div
        ref={subtitlesSectionRef}
        className="space-y-3 p-4 bg-[#181825] rounded-2xl border border-[#313244]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#313244]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#89b4fa]" />
            <h3 className="text-sm font-bold text-white tabular-nums">
              3. Sous-titres synchronisés ({segments.length} segments)
            </h3>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowSubtitleConfigPanel(prev => !prev)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                showSubtitleConfigPanel
                  ? 'bg-[#89b4fa] text-[#11111b] border-[#89b4fa]'
                  : 'bg-[#313244] text-[#cdd6f4] border-[#45475a] hover:bg-[#45475a]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Réglages Lisibilité</span>
            </button>

            <button
              type="button"
              onClick={handleAddSegment}
              className="min-h-[36px] px-3 py-1.5 bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter segment</span>
            </button>

            {segments.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={exportCurrentAsSRT}
                  className="min-h-[36px] px-3 py-1.5 bg-[#89b4fa]/15 hover:bg-[#89b4fa]/25 text-[#89b4fa] border border-[#89b4fa]/35 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.SRT</span>
                </button>
                <button
                  type="button"
                  onClick={exportCurrentAsVTT}
                  className="min-h-[36px] px-3 py-1.5 bg-[#a6e3a1]/15 hover:bg-[#a6e3a1]/25 text-[#a6e3a1] border border-[#a6e3a1]/35 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.VTT</span>
                </button>
                {onSaveAssetToProject && activeProjectName && (
                  <button
                    type="button"
                    onClick={handleSaveSubtitlesToProject}
                    className="min-h-[36px] px-3 py-1.5 bg-[#cba6f7]/15 hover:bg-[#cba6f7]/25 text-[#cba6f7] border border-[#cba6f7]/35 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Sauver SRT</span>
                  </button>
                )}
              </>
            )}

            {onInsertTextToStudio && rawText && (
              <button
                type="button"
                onClick={() => onInsertTextToStudio(rawText)}
                className="min-h-[36px] px-3 py-1.5 bg-[#f9e2af]/15 hover:bg-[#f9e2af]/25 text-[#f9e2af] border border-[#f9e2af]/35 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Studio Vocal</span>
              </button>
            )}
          </div>
        </div>

        {/* Panneau repliable de configuration des sous-titres */}
        {showSubtitleConfigPanel && (
          <div className="p-4 bg-[#11111b] rounded-xl border border-[#89b4fa]/35 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#89b4fa]">
              <span>Paramètres de Lisibilité & Synchronisation SRT</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    if (segments.length === 0) return;
                    const span = voiceoverDuration > 1 ? voiceoverDuration : (duration > 1 ? duration : segments.length * 3);
                    const chunkTime = span / segments.length;
                    let cursor = Math.max(0, voiceDelaySeconds);
                    const updated = segments.map((seg) => {
                      const start = Number(cursor.toFixed(2));
                      const end = Number((cursor + Math.max(1.2, chunkTime - 0.05)).toFixed(2));
                      cursor = end + 0.05;
                      return { ...seg, start, end };
                    });
                    setSegments(updated);
                    addToast("Sous-titres étalés uniformément sur la durée de la voix.", "success");
                  }}
                  disabled={segments.length === 0}
                  className="px-2.5 py-1 rounded bg-[#89b4fa]/20 border border-[#89b4fa]/40 text-[11px] text-[#89b4fa] font-semibold hover:bg-[#89b4fa]/30 disabled:opacity-40 cursor-pointer"
                >
                  Étaler uniformément
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftAllSegments(-0.5)}
                  disabled={segments.length === 0}
                  className="px-2 py-1 rounded bg-[#181825] border border-[#313244] text-[11px] text-[#cdd6f4] hover:border-[#89b4fa] disabled:opacity-40 cursor-pointer"
                >
                  Décaler -0.5s
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftAllSegments(0.5)}
                  disabled={segments.length === 0}
                  className="px-2 py-1 rounded bg-[#181825] border border-[#313244] text-[11px] text-[#cdd6f4] hover:border-[#89b4fa] disabled:opacity-40 cursor-pointer"
                >
                  Décaler +0.5s
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-xs text-[#a6adc8] mb-1">
                  <span>Durée minimale par sous-titre :</span>
                  <span className="font-mono tabular-nums font-bold text-[#89b4fa]">{minSubtitleDuration.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={5.0}
                  step={0.5}
                  value={minSubtitleDuration}
                  onChange={(e) => setMinSubtitleDuration(parseFloat(e.target.value))}
                  className="w-full accent-[#89b4fa]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#a6adc8] mb-1">
                  <span>Caractères max par ligne :</span>
                  <span className="font-mono tabular-nums font-bold text-[#f9e2af]">{maxCharsPerLine} car.</span>
                </div>
                <input
                  type="range"
                  min={25}
                  max={70}
                  step={1}
                  value={maxCharsPerLine}
                  onChange={(e) => setMaxCharsPerLine(parseInt(e.target.value, 10))}
                  className="w-full accent-[#f9e2af]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleApplySubtitleConfig}
                className="px-4 py-2 rounded-lg bg-[#89b4fa] text-[#11111b] font-bold text-xs hover:bg-[#b4befe] transition-all cursor-pointer"
              >
                Appliquer aux sous-titres actuels
              </button>
            </div>
          </div>
        )}

        {segments.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#a6adc8] border border-dashed border-[#313244] rounded-xl space-y-2">
            <p>Aucun sous-titre pour le moment.</p>
            <p className="text-[11px] text-[#6c7086]">
              Extrayez les sous-titres depuis votre vidéo ou voix off, générez-les depuis votre script, ou ajoutez un segment manuellement.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {segments.map((seg, idx) => {
              const isActive = currentTime >= seg.start && currentTime <= seg.end;
              const isEditing = editingSegmentIdx === idx;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                    isActive
                      ? 'bg-[#89b4fa]/15 border-[#89b4fa]'
                      : 'bg-[#11111b] border-[#313244] hover:border-[#45475a]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div
                      onClick={() => !isEditing && handleMediaSeek(seg.start)}
                      className="cursor-pointer flex-1 flex flex-col sm:flex-row sm:items-center gap-2.5"
                    >
                      <span className="font-mono tabular-nums text-[11px] px-2 py-1 rounded bg-[#313244] text-[#a6adc8] shrink-0 font-semibold inline-flex items-center gap-1 w-fit">
                        <Play className="w-2.5 h-2.5 text-[#89b4fa]" />
                        {secondsToSRT(seg.start).slice(3, 8)} → {secondsToSRT(seg.end).slice(3, 8)}
                      </span>

                      {isEditing ? (
                        <input
                          type="text"
                          value={seg.text}
                          onChange={(e) => handleUpdateSegment(idx, { text: e.target.value })}
                          autoFocus
                          className="flex-1 p-1.5 bg-[#181825] border border-[#89b4fa] rounded text-xs text-white focus:outline-none"
                        />
                      ) : (
                        <span className={`text-xs whitespace-pre-line ${isActive ? 'text-[#89b4fa] font-bold' : 'text-[#cdd6f4]'}`}>
                          {seg.text}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingSegmentIdx(isEditing ? null : idx)}
                        className={`p-1.5 rounded-lg text-[11px] cursor-pointer ${isEditing ? 'bg-[#89b4fa] text-[#11111b]' : 'text-[#a6adc8] hover:text-[#89b4fa] hover:bg-[#313244]'}`}
                        title="Modifier texte et timing"
                      >
                        {isEditing ? <Check className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(seg.text, `seg-${idx}`)}
                        className="p-1.5 text-[#a6adc8] hover:text-[#a6e3a1] hover:bg-[#313244] rounded-lg text-[11px] cursor-pointer"
                        title="Copier ce segment"
                      >
                        {copiedKey === `seg-${idx}` ? <Check className="w-3.5 h-3.5 text-[#a6e3a1]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSegment(idx)}
                        className="p-1.5 text-[#a6adc8] hover:text-red-400 hover:bg-red-500/10 rounded-lg text-[11px] cursor-pointer"
                        title="Supprimer ce segment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-[#313244] text-[11px]">
                      <label className="flex items-center gap-1.5 text-[#a6adc8]">
                        <span>Début (s) :</span>
                        <input
                          type="number"
                          step={0.1}
                          min={0}
                          value={Number(seg.start.toFixed(2))}
                          onChange={(e) => {
                            const val = Math.max(0, parseFloat(e.target.value) || 0);
                            handleUpdateSegment(idx, { start: val, end: Math.max(val + 0.4, seg.end) });
                          }}
                          className="w-20 px-2 py-1 rounded bg-[#181825] border border-[#45475a] font-mono tabular-nums text-white"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-[#a6adc8]">
                        <span>Fin (s) :</span>
                        <input
                          type="number"
                          step={0.1}
                          min={seg.start + 0.4}
                          value={Number(seg.end.toFixed(2))}
                          onChange={(e) => {
                            const val = Math.max(seg.start + 0.4, parseFloat(e.target.value) || seg.start + 1);
                            handleUpdateSegment(idx, { end: val });
                          }}
                          className="w-20 px-2 py-1 rounded bg-[#181825] border border-[#45475a] font-mono tabular-nums text-white"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Raw continuous text view */}
      {rawText && (
        <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#89b4fa]" />
              <span>Texte intégral fluide</span>
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(rawText, 'raw-full')}
                className="px-2.5 py-1 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'raw-full' ? <Check className="w-3 h-3 text-[#a6e3a1]" /> : <Copy className="w-3 h-3" />}
                <span>Copier tout le texte</span>
              </button>
              {onInsertTextToAgent && (
                <button
                  type="button"
                  onClick={() => onInsertTextToAgent(rawText)}
                  className="px-2.5 py-1 bg-[#89b4fa]/20 hover:bg-[#89b4fa]/30 text-[#89b4fa] rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Analyser avec l'Agent IA</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-[#cdd6f4] leading-relaxed bg-[#11111b] p-3 rounded-lg border border-[#313244] max-h-36 overflow-y-auto font-sans">
            {rawText}
          </p>
        </div>
      )}

      {/* Transcription & Subtitles History Section */}
      <div className="space-y-3 pt-4 border-t border-[#313244]">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-[#a6adc8]" />
            <input
              type="text"
              placeholder="Rechercher dans l'historique des vidéos et sous-titres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 p-2.5 bg-[#181825] border border-[#313244] rounded-xl text-xs focus:outline-none focus:border-[#89b4fa]"
            />
          </div>

          <button
            type="button"
            onClick={exportAllAsZip}
            disabled={filteredHistory.length === 0}
            className="px-4 py-2.5 bg-[#a6e3a1] text-[#11111b] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#94e2d5] transition-all disabled:opacity-50 shadow-md cursor-pointer"
          >
            <FolderDown className="w-4 h-4" />
            <span>Exporter Tout en ZIP</span>
          </button>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
          {filteredHistory.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#6c7086] border border-dashed border-[#313244] rounded-xl">
              Aucun fichier dans l'historique pour le moment.
            </div>
          ) : (
            filteredHistory.map(item => (
              <div
                key={item.id}
                className="p-3 bg-[#181825] rounded-xl border border-[#313244] flex items-center justify-between gap-3 hover:border-[#45475a] transition-all"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="p-2 rounded-lg bg-[#313244] text-[#89b4fa] shrink-0">
                    {item.type === 'video' ? <Video className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-[#a6adc8] truncate">{item.date || 'Récemment'} · {item.transcription.slice(0, 50)}...</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.srtContent) {
                        const blob = new Blob([item.srtContent], { type: 'application/x-subrip;charset=utf-8' });
                        void triggerSafeDownload(blob, `${item.name.replace(/\.[^/.]+$/, '')}.srt`);
                        addToast('.SRT téléchargé', 'success');
                      }
                    }}
                    className="p-1.5 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded-lg text-xs cursor-pointer"
                    title="Télécharger les sous-titres .SRT"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistory(prev => prev.filter(h => h.id !== item.id))}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
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
    </div>
  );
};
