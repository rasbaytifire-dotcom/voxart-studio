import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, Upload, RefreshCw, Download, Search, FolderDown, Trash2, 
  Play, Pause, Music, Video, FileText, Check, Copy, Edit2, 
  Subtitles, Eye, ArrowRight, Sparkles, Volume2, Clock, Film, 
  Sliders, CheckCircle2, AlertCircle, Wand2, Disc, Layers
} from 'lucide-react';
import JSZip from 'jszip';
import { authFetch, apiAuthStore } from '../services/apiAuth';
import { 
  TRADITIONAL_RHYTHM_PRESETS, 
  renderCompositionToWav 
} from '../utils/africanAudioEngine';
import { cleanTextForSpeech } from '../utils/textCleaner';

interface TranscriptionStudioProps {
  apiKey: string;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  activeBackingTrack?: any;
  onSwitchMode: (mode: 'single' | 'workspace' | 'transcription' | 'video_dubbing') => void;
  onInsertTextToStudio?: (text: string) => void;
  onInsertTextToAgent?: (text: string) => void;
  initialVideoFile?: File | null;
  initialText?: string;
  library?: Record<string, any>;
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
  { id: '__NONE__', name: '🔇 Aucun fond sonore (Voix & Vidéo uniquement)' },
  { id: '__ACTIVE__', name: '🎛️ Fond sonore actif du Studio (si sélectionné)' },
  { id: 'aube_kora_sahel', name: '🪕 Aube Sahélienne & Kora Mandingue (104 BPM)' },
  { id: 'balafon_casamance_fleuve', name: '🪵 Balafon Solaire de Casamance (108 BPM)' },
  { id: 'sabar_kaolack', name: '🥁 Sabar Kaolack Polyrythmique (114 BPM)' },
  { id: 'rituel_appel_ancetres', name: '⚡ Djembé & Rituel Ancestral (92 BPM)' },
  { id: 'dub_roots_senegal', name: '🌌 Dub Roots Ancestral RidiaLArt (76 BPM)' },
  { id: '__CUSTOM__', name: '📁 Importer un fichier MP3/WAV personnel...' },
];

export const TranscriptionStudio: React.FC<TranscriptionStudioProps> = ({ 
  apiKey, 
  addToast, 
  activeBackingTrack, 
  onSwitchMode,
  onInsertTextToStudio,
  onInsertTextToAgent,
  initialVideoFile,
  initialText,
  library
}) => {
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
  const [segments, setSegments] = useState<Segment[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSubtitlesOverlay, setShowSubtitlesOverlay] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState<'yellow' | 'classic' | 'afro'>('yellow');
  const [editingSegmentIdx, setEditingSegmentIdx] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Subtitle Readability Configuration State
  const [minSubtitleDuration, setMinSubtitleDuration] = useState<number>(2.0);
  const [maxCharsPerLine, setMaxCharsPerLine] = useState<number>(42);
  const [showSubtitleConfigPanel, setShowSubtitleConfigPanel] = useState<boolean>(false);

  // Video Voiceover & Export State
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);
  const [voiceoverAudioBlob, setVoiceoverAudioBlob] = useState<Blob | null>(null);
  const [voiceoverAudioUrl, setVoiceoverAudioUrl] = useState<string | null>(null);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('Charon');
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0);
  const [originalAudioVolume, setOriginalAudioVolume] = useState<number>(0.15); // Ducking default: 15% original sound
  const [burnSubtitlesInExport, setBurnSubtitlesInExport] = useState<boolean>(true);
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [exportProgressMsg, setExportProgressMsg] = useState<string>('');
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);

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
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const voiceoverFileInputRef = useRef<HTMLInputElement | null>(null);

  // React to initialVideoFile passed from Home page
  useEffect(() => {
    if (initialVideoFile) {
      setFile(initialVideoFile);
      setIsVideo(true);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      const newUrl = URL.createObjectURL(initialVideoFile);
      setFileUrl(newUrl);
    }
  }, [initialVideoFile]);

  // React to initialText passed from Home Studio
  useEffect(() => {
    if (initialText && !rawText && segments.length === 0) {
      setRawText(initialText);
    }
  }, [initialText]);

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

  const handleMediaPlay = () => {
    setIsPlaying(true);
    if (voiceoverAudioRef.current && voiceoverAudioUrl) {
      voiceoverAudioRef.current.currentTime = mediaRef.current?.currentTime || 0;
      voiceoverAudioRef.current.play().catch(() => {});
    }
    if (musicAudioRef.current && musicAudioUrl) {
      const dur = musicAudioRef.current.duration || 10;
      musicAudioRef.current.currentTime = (mediaRef.current?.currentTime || 0) % dur;
      musicAudioRef.current.play().catch(() => {});
    }
  };

  const handleMediaPause = () => {
    setIsPlaying(false);
    if (voiceoverAudioRef.current) {
      voiceoverAudioRef.current.pause();
    }
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
    }
  };

  const handleMediaSeek = (seconds: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = seconds;
    setCurrentTime(seconds);
    if (voiceoverAudioRef.current) {
      voiceoverAudioRef.current.currentTime = seconds;
    }
    if (musicAudioRef.current && musicAudioRef.current.duration) {
      musicAudioRef.current.currentTime = seconds % musicAudioRef.current.duration;
    }
  };

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

  const formatSegmentText = (text: string, maxLen: number): string => {
    if (!text || text.length <= maxLen) return text;
    const words = text.split(' ');
    let lines: string[] = [];
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
      let duration = effectiveEnd - seg.start;
      if (duration < minSubtitleDuration) {
        effectiveEnd = seg.start + minSubtitleDuration;
        if (idx < arr.length - 1 && effectiveEnd > arr[idx + 1].start) {
          effectiveEnd = Math.max(seg.start + 0.8, arr[idx + 1].start - 0.05);
        }
      }
      const formattedText = formatSegmentText(seg.text, maxCharsPerLine);
      return {
        start: seg.start,
        end: effectiveEnd,
        text: formattedText
      };
    });
  };

  const handleApplySubtitleConfig = () => {
    if (segments.length === 0) {
      addToast("Aucun segment de sous-titre à configurer.", "info");
      return;
    }
    setSegments(prev => processSegmentsWithConfig(prev));
    addToast(`Paramètres de lisibilité appliqués : min ${minSubtitleDuration}s, max ${maxCharsPerLine} car./ligne.`, "success");
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
      if (voiceoverAudioUrl) URL.revokeObjectURL(voiceoverAudioUrl);
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);

      const newUrl = URL.createObjectURL(f);
      setFileUrl(newUrl);
      setSegments([]);
      setRawText('');
      setCurrentTime(0);
      setIsPlaying(false);
      setVoiceoverAudioBlob(null);
      setVoiceoverAudioUrl(null);
      setExportedVideoUrl(null);
      addToast(`Fichier ${isVid ? 'vidéo' : 'audio'} prêt pour l'analyse et l'édition`, 'info');
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setIsLoading(true);
    const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (effectiveKey) formData.append('apiKey', effectiveKey);

      const response = await authFetch('/api/transcribe', { 
        method: 'POST', 
        body: formData 
      }, effectiveKey);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Échec de la transcription');
      }

      const data = await response.json();
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
      const parsedSegments = parseSRT(srtPart);
      setSegments(parsedSegments);

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        name: file.name,
        type: isVideo ? 'video' : 'audio',
        transcription: extractedRaw,
        srtContent: srtPart,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      };

      setHistory(prev => [newItem, ...prev]);
      addToast(`Extraction réussie (${parsedSegments.length} sous-titres générés)`, 'success');
    } catch (err: any) {
      console.error(err);
      addToast(err?.message || 'Erreur lors de la transcription', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate synthetic voiceover from the transcribed text or edited segments
  const handleGenerateVoiceover = async () => {
    const textToSpeak = rawText.trim() || segments.map(s => s.text).join(' ').trim();
    if (!textToSpeak) {
      addToast('Aucun texte disponible pour synthétiser la voix off.', 'error');
      return;
    }

    setIsGeneratingVoiceover(true);
    const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();

    try {
      const response = await authFetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: textToSpeak,
          voiceName: selectedVoiceName,
          model: 'gemini-3.8-flash-tts',
          language: 'Français',
          gender: 'Masculin',
          style: 'voix posée, expressive et incarnée pour narration vidéo',
          apiKey: effectiveKey
        })
      }, effectiveKey);

      const data = await response.json();
      if (!response.ok || !data.audio) {
        throw new Error(data.error || 'Erreur lors de la synthèse vocale Gemini');
      }

      const binary = atob(data.audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      if (voiceoverAudioUrl) URL.revokeObjectURL(voiceoverAudioUrl);
      const newUrl = URL.createObjectURL(blob);

      setVoiceoverAudioBlob(blob);
      setVoiceoverAudioUrl(newUrl);

      // Mute original video volume slightly by default for clean voiceover
      if (mediaRef.current && isVideo) {
        mediaRef.current.volume = originalAudioVolume;
      }

      addToast(`Voix off (${selectedVoiceName}) générée avec succès !`, 'success');
    } catch (err: any) {
      console.warn("Voiceover generation warning, using browser speech fallback:", err);
      handleBrowserSpeechFallback(textToSpeak);
      const msg = err?.message || "";
      if (msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
        addToast("⚠️ Quota Gemini temporairement atteint. Synthèse vocale locale (navigateur) active.", "info");
      } else {
        addToast("Synthèse vocale locale (navigateur) active.", "info");
      }
    } finally {
      setIsGeneratingVoiceover(false);
    }
  };

  const handleBrowserSpeechFallback = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      addToast("Synthèse vocale non supportée par ce navigateur.", "error");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    addToast("Quota Gemini atteint : Lecture vocale basculée sur la synthèse vocale locale du navigateur.", "info");
  };

  const handleSelectVoiceoverFromLibrary = async (base64Data: string, trackName: string) => {
    try {
      let b64 = base64Data;
      let mimeType = 'audio/wav';
      if (base64Data.includes('base64,')) {
        const parts = base64Data.split('base64,');
        mimeType = parts[0].replace('data:', '').replace(';', '');
        b64 = parts[1];
      }
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });
      if (voiceoverAudioUrl) URL.revokeObjectURL(voiceoverAudioUrl);
      const newUrl = URL.createObjectURL(blob);

      setVoiceoverAudioBlob(blob);
      setVoiceoverAudioUrl(newUrl);
      addToast(`Voix off "${trackName}" importée avec succès depuis la Bibliothèque !`, 'success');
    } catch (e) {
      console.error("Library audio import error:", e);
      addToast("Erreur lors de l'importation de la piste audio.", "error");
    }
  };

  const handleUploadVoiceoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (voiceoverAudioUrl) URL.revokeObjectURL(voiceoverAudioUrl);
    setVoiceoverAudioBlob(file);
    setVoiceoverAudioUrl(url);
    addToast(`Piste de voix off "${file.name}" chargée avec succès !`, 'success');
    e.target.value = '';
  };

  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) {
      mediaRef.current.play();
    } else {
      mediaRef.current.pause();
    }
  };

  const handleUpdateSegment = (idx: number, newText: string) => {
    setSegments(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], text: newText };
      return updated;
    });
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
      addToast("Fond sonore désactivé.", "info");
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
          const resp = await fetch(activeBackingTrack.url);
          const b = await resp.blob();
          setMusicAudioBlob(b);
          addToast(`Fond sonore "${activeBackingTrack.title}" associé à la vidéo !`, "success");
        } catch (e) {
          console.warn("Could not fetch active backing track blob:", e);
        }
      } else {
        addToast("Aucun fond sonore actif trouvé dans le Studio Vocal.", "info");
        setSelectedMusicId('__NONE__');
      }
      return;
    }

    // Traditional rhythm presets from AfricanAudioEngine
    const preset = (TRADITIONAL_RHYTHM_PRESETS as any)[trackId];
    if (preset) {
      try {
        setIsPreparingMusic(true);
        addToast(`Préparation du rythme "${preset.name || trackId}"...`, "info");
        const blob = await renderCompositionToWav(preset);
        const url = URL.createObjectURL(blob);
        setMusicAudioBlob(blob);
        setMusicAudioUrl(url);
        setCustomMusicName(preset.name);
        addToast(`Rythme "${preset.name}" prêt et associé à la vidéo !`, "success");
      } catch (e) {
        console.warn("Error rendering rhythm preset:", e);
        addToast("Erreur lors de la génération du fond sonore", "error");
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
    addToast(`Musique "${musicF.name}" chargée pour la vidéo !`, "success");
    e.target.value = '';
  };

  // Render & Export final assembled MP4 video with Voiceover + Burned Subtitles + Background Music
  const handleExportEditedVideo = async () => {
    if (!file || !isVideo) {
      addToast("Veuillez sélectionner un fichier vidéo d'abord.", "error");
      return;
    }

    setIsExportingVideo(true);
    setExportProgressMsg("Assemblage de la vidéo, mixage voix off & musique, incrustation sous-titres...");

    try {
      const srtString = getCombinedSRTString();
      const formData = new FormData();
      formData.append('video', file);

      if (voiceoverAudioBlob) {
        formData.append('voice', voiceoverAudioBlob, 'voiceover.mp3');
      }

      if (musicAudioBlob && selectedMusicId !== '__NONE__') {
        formData.append('music', musicAudioBlob, 'music.wav');
        formData.append('musicVolume', musicVolume.toString());
      }

      formData.append('srtContent', srtString);
      formData.append('burnSubtitles', burnSubtitlesInExport ? 'true' : 'false');
      formData.append('originalAudioVolume', originalAudioVolume.toString());
      formData.append('voiceVolume', voiceVolume.toString());
      formData.append('subtitleStyle', subtitleStyle);

      const response = await authFetch('/api/export-video', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Erreur lors de l'assemblage de la vidéo");
      }

      const blob = await response.blob();
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
      const outputUrl = URL.createObjectURL(blob);
      setExportedVideoUrl(outputUrl);

      // Auto trigger download of the finalized MP4
      const a = document.createElement('a');
      a.href = outputUrl;
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      a.download = `${baseName}_voxart_subtitled.mp4`;
      a.click();

      addToast("Vidéo éditée avec voix off et sous-titres exportée avec succès !", "success");
    } catch (err: any) {
      console.error(err);
      addToast(err?.message || "Erreur lors de l'export de la vidéo", "error");
    } finally {
      setIsExportingVideo(false);
      setExportProgressMsg('');
    }
  };

  const exportCurrentAsSRT = () => {
    if (segments.length === 0) return;
    const srt = getCombinedSRTString();
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(file?.name || 'sous-titres').replace(/\.[^/.]+$/, '')}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Fichier .SRT téléchargé', 'success');
  };

  const exportCurrentAsVTT = () => {
    if (segments.length === 0) return;
    let vtt = 'WEBVTT\n\n';
    segments.forEach((seg, idx) => {
      vtt += `${idx + 1}\n${secondsToVTT(seg.start)} --> ${secondsToVTT(seg.end)}\n${seg.text}\n\n`;
    });

    const blob = new Blob([vtt], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(file?.name || 'sous-titres').replace(/\.[^/.]+$/, '')}.vtt`;
    a.click();
    URL.revokeObjectURL(url);
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
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voxart_transcriptions_subtitles.zip';
    a.click();
    URL.revokeObjectURL(url);
    addToast('Archive ZIP téléchargée', 'success');
  };

  // Find currently active subtitle segment
  const activeSegment = segments.find(seg => currentTime >= seg.start && currentTime <= seg.end);

  const filteredHistory = history.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.transcription.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-[#1e1e2e] p-5 sm:p-7 rounded-2xl border border-[#313244] shadow-2xl space-y-6 text-[#cdd6f4]">
      {/* Hidden audio element for voiceover sync */}
      {voiceoverAudioUrl && (
        <audio 
          ref={voiceoverAudioRef} 
          src={voiceoverAudioUrl} 
          className="hidden" 
        />
      )}

      {/* Top navigation tabs */}
      <div className="flex items-center gap-2 bg-[#181825] p-1.5 rounded-xl border border-[#313244]/60">
        <button 
          onClick={() => onSwitchMode('single')} 
          className="flex-1 py-2 text-xs font-bold text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-lg transition-all"
        >
          🎙️ Studio Vocal
        </button>
        <button 
          onClick={() => onSwitchMode('workspace')} 
          className="flex-1 py-2 text-xs font-bold text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244] rounded-lg transition-all"
        >
          🤖 Agent IA & Scénarios
        </button>
        <button 
          className="flex-1 py-2 text-xs font-bold text-[#89b4fa] bg-[#313244] rounded-lg shadow-sm"
        >
          🎬 Montage Vidéo, Voix Off & Sous-titres
        </button>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#313244]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 via-sky-500/20 to-teal-500/20 rounded-2xl border border-[#89b4fa]/30 shadow-inner">
            <Film className="w-6 h-6 text-[#89b4fa]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <span>Édition Vidéo : Voix Off & Sous-titres Incrustés</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#a6e3a1]/20 text-[#a6e3a1] border border-[#a6e3a1]/30">
                MP4 HD
              </span>
            </h2>
            <p className="text-xs text-[#a6adc8]">
              Importez une vidéo, générez les sous-titres, appliquez une nouvelle voix off synthétique et exportez le fichier vidéo final assemblé.
            </p>
          </div>
        </div>

        {activeBackingTrack && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#181825] border border-[#fbbf24]/30 rounded-xl text-xs text-[#fde68a]">
            <Music className="w-3.5 h-3.5 text-[#fbbf24] animate-pulse" />
            <span className="truncate max-w-[150px]">Fond: {activeBackingTrack.title}</span>
          </div>
        )}
      </div>

      {/* File Ingestion & Action Zone */}
      <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <label className="cursor-pointer flex-1 flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] text-xs font-bold transition-all border border-[#89b4fa]/30 hover:border-[#89b4fa] shadow-sm group">
            <Upload className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            <span className="truncate max-w-[260px] sm:max-w-none">
              {file ? `${isVideo ? '🎬 Vidéo' : '🎵 Audio'} : ${file.name}` : "Importer une vidéo (.mp4, .mov, .webm) ou un audio"}
            </span>
            <input 
              type="file" 
              accept="video/*,audio/*,.mp4,.mov,.webm,.mkv,.avi,.mp3,.wav,.m4a" 
              onChange={handleFileChange} 
              className="hidden" 
            />
          </label>

          <button 
            onClick={handleTranscribe} 
            disabled={!file || isLoading} 
            className="px-6 py-3.5 bg-gradient-to-r from-[#89b4fa] to-[#a6e3a1] text-[#11111b] rounded-xl text-xs font-extrabold hover:opacity-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#89b4fa]/10"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Extraction & analyse en cours...</span>
              </>
            ) : (
              <>
                <Subtitles className="w-4 h-4" />
                <span>1. Extraire Sous-titres (SRT)</span>
              </>
            )}
          </button>
        </div>

        {file && (
          <div className="flex items-center justify-between text-[11px] text-[#a6adc8] px-1">
            <span>Taille : {(file.size / (1024 * 1024)).toFixed(2)} Mo</span>
            <span className="capitalize">Type détecté : {isVideo ? 'Fichier Vidéo (MP4/WebM/MOV)' : 'Fichier Audio'}</span>
          </div>
        )}
      </div>

      {/* Video / Audio Player with Live Subtitle Overlay */}
      {fileUrl && (
        <div className="space-y-3 p-4 bg-[#11111b] rounded-2xl border border-[#313244] shadow-inner">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#89b4fa]">
              <Eye className="w-4 h-4" />
              <span>Aperçu interactif : {voiceoverAudioUrl ? 'Vidéo + Voix Off active' : 'Vidéo originale'}</span>
            </div>

            {isVideo && segments.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-[#a6adc8]">Style visuel des sous-titres :</span>
                <button 
                  onClick={() => setSubtitleStyle('yellow')} 
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${subtitleStyle === 'yellow' ? 'bg-[#f9e2af] text-[#11111b] shadow-sm' : 'bg-[#313244] text-[#a6adc8]'}`}
                >
                  ⚡ Reels Jaune
                </button>
                <button 
                  onClick={() => setSubtitleStyle('classic')} 
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${subtitleStyle === 'classic' ? 'bg-white text-[#11111b] shadow-sm' : 'bg-[#313244] text-[#a6adc8]'}`}
                >
                  Blanc Pro
                </button>
                <button 
                  onClick={() => setSubtitleStyle('afro')} 
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${subtitleStyle === 'afro' ? 'bg-[#fab387] text-[#11111b] shadow-sm' : 'bg-[#313244] text-[#a6adc8]'}`}
                >
                  RidiaLArt Ocre
                </button>
                <button 
                  onClick={() => setShowSubtitlesOverlay(!showSubtitlesOverlay)} 
                  className={`p-1.5 rounded-lg text-xs ${showSubtitlesOverlay ? 'text-[#89b4fa] bg-[#313244]' : 'text-[#6c7086]'}`}
                  title="Activer/Désactiver l'affichage des sous-titres sur le player"
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
                onTimeUpdate={() => {
                  if (mediaRef.current) setCurrentTime(mediaRef.current.currentTime);
                }}
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
                  onTimeUpdate={() => {
                    if (mediaRef.current) setCurrentTime(mediaRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (mediaRef.current) setDuration(mediaRef.current.duration);
                  }}
                  onPlay={handleMediaPlay}
                  onPause={handleMediaPause}
                  className="hidden" 
                />
                <div className="p-4 rounded-full bg-[#89b4fa]/10 border border-[#89b4fa]/30 text-[#89b4fa]">
                  <Music className="w-8 h-8 animate-pulse" />
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
                <div className="absolute bottom-6 left-3 right-3 flex justify-center pointer-events-none transition-all duration-150 z-20">
                  <div 
                    className={`px-4 py-2.5 rounded-2xl text-center max-w-[92%] font-black text-sm sm:text-base leading-relaxed shadow-2xl drop-shadow-md backdrop-blur-md border flex flex-wrap justify-center gap-1.5 ${
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
                                ? 'text-[#f59e0b] scale-110 drop-shadow-[0_0_10px_rgba(245,158,11,0.9)] font-black'
                                : subtitleStyle === 'yellow'
                                ? 'text-[#fbbf24] scale-110 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)] font-black'
                                : 'text-[#38bdf8] scale-110 drop-shadow-[0_0_10px_rgba(56,189,248,0.9)] font-black'
                              : isPast
                              ? subtitleStyle === 'yellow'
                                ? 'text-[#f9e2af]'
                                : subtitleStyle === 'afro'
                                ? 'text-[#fbbf24]'
                                : 'text-white'
                              : 'text-white/50'
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
              onClick={togglePlay} 
              className="p-2.5 bg-[#89b4fa] text-[#11111b] rounded-xl hover:bg-[#b4befe] transition-all shadow-md shrink-0"
              title={isPlaying ? "Mettre en pause" : "Lire"}
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
              <div className="flex justify-between text-[10px] font-mono text-[#a6adc8]">
                <span>{secondsToSRT(currentTime).split(',')[0]}</span>
                <span>{secondsToSRT(duration).split(',')[0]}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voiceover Generation & Audio Mixing Studio Panel */}
      {file && (
        <div className="p-5 bg-gradient-to-br from-[#181825] to-[#1e1e2e] rounded-2xl border border-[#89b4fa]/40 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-[#313244] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#89b4fa]/20 rounded-xl text-[#89b4fa]">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>2. Voix Off IA & Fond Sonore d'Accompagnement</span>
                  {voiceoverAudioUrl && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-[#a6e3a1]/20 text-[#a6e3a1] rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Voix Off Prête
                    </span>
                  )}
                  {selectedMusicId !== '__NONE__' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-[#fbbf24]/20 text-[#fbbf24] rounded-full flex items-center gap-1">
                      <Music className="w-3 h-3" /> Musique Active
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[#a6adc8]">
                  Saisissez votre script ou utilisez les sous-titres, générez une narration vocale IA et mixez un fond sonore ou rythme africain.
                </p>
              </div>
            </div>

            <button 
              onClick={handleGenerateVoiceover}
              disabled={isGeneratingVoiceover || (!rawText.trim() && segments.length === 0)}
              className="px-4 py-2.5 bg-gradient-to-r from-[#89b4fa] via-[#b4befe] to-[#a6e3a1] text-[#11111b] rounded-xl text-xs font-black hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shrink-0 cursor-pointer"
            >
              {isGeneratingVoiceover ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Synthèse de la voix...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Générer Voix Off (Gemini)</span>
                </>
              )}
            </button>
          </div>

          {/* SÉLECTION / IMPORTATION DIRECTE DEPUIS LA BIBLIOTHÈQUE OU FICHIER */}
          <div className="bg-[#11111b] p-3.5 rounded-xl border border-[#89b4fa]/30 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#89b4fa] flex items-center gap-1.5">
                <FolderDown className="w-4 h-4 text-[#89b4fa]" />
                <span>Importer ou Choisir une Voix Off depuis le Studio / Bibliothèque :</span>
              </span>
              <button
                type="button"
                onClick={() => voiceoverFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] font-bold text-xs border border-[#89b4fa]/40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>📁 Charger un fichier audio (.mp3/.wav)</span>
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
              <div>
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    const [projName, audioIdStr] = val.split(':::');
                    const audioItem = library[projName]?.audios?.find((a: any) => String(a.id) === audioIdStr);
                    if (audioItem) {
                      handleSelectVoiceoverFromLibrary(audioItem.data, audioItem.name);
                    }
                    e.target.value = '';
                  }}
                  className="w-full p-2.5 rounded-xl bg-[#181825] border border-[#45475a] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#89b4fa] cursor-pointer"
                >
                  <option value="">📂 Ou sélectionner une piste enregistrée dans la Bibliothèque...</option>
                  {Object.entries(library).map(([projName, projData]: [string, any]) => (
                    <optgroup key={projName} label={`Projet : ${projName}`}>
                      {projData.audios?.map((audio: any) => (
                        <option key={audio.id} value={`${projName}:::${audio.id}`}>
                          🎵 {audio.name} ({projName})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Script / Narration Editor */}
          <div className="space-y-1.5 bg-[#11111b]/80 p-3 rounded-xl border border-[#313244]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-[#cdd6f4] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#89b4fa]" />
                <span>Script / Texte pour la Voix Off :</span>
              </label>

              <div className="flex items-center gap-1.5 flex-wrap">
                {initialText && (
                  <button
                    type="button"
                    onClick={() => {
                      setRawText(initialText);
                      addToast("Texte de l'Accueil Studio copié dans le script !", "success");
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] border border-[#89b4fa]/30 transition-all flex items-center gap-1"
                  >
                    <span>📋 Utiliser texte du Studio</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (!rawText.trim()) return;
                    const cleaned = cleanTextForSpeech(rawText);
                    setRawText(cleaned);
                    addToast("Astérisques et markdown nettoyés pour la voix off !", "success");
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#313244] hover:bg-[#45475a] text-[#a6e3a1] border border-[#a6e3a1]/30 transition-all flex items-center gap-1"
                >
                  <span>🧹 Nettoyer astérisques</span>
                </button>
              </div>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Rédigez ou collez ici le script à faire prononcer par la voix off sur votre vidéo..."
              rows={3}
              className="w-full p-2.5 rounded-lg bg-[#181825] border border-[#45475a] text-xs text-[#cdd6f4] focus:outline-none focus:border-[#89b4fa] resize-y"
            />
          </div>

          {/* Configuration Voix & Fond Sonore */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Choix du Timbre Vocal */}
            <div className="p-3 bg-[#11111b]/60 rounded-xl border border-[#313244] space-y-1.5">
              <label className="block text-xs font-semibold text-[#a6adc8] flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#89b4fa]" />
                <span>Timbre Vocal de la Voix Off :</span>
              </label>
              <select
                value={selectedVoiceName}
                onChange={(e) => setSelectedVoiceName(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#181825] border border-[#45475a] text-white text-xs font-medium focus:outline-none focus:border-[#89b4fa] cursor-pointer"
              >
                {PRESET_VOICE_OPTIONS.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Choix du Fond Sonore / Musique */}
            <div className="p-3 bg-[#11111b]/60 rounded-xl border border-[#fbbf24]/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#f9e2af] flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-[#fbbf24]" />
                  <span>Fond Sonore / Musique d'Ambiance :</span>
                </label>
                {isPreparingMusic && (
                  <RefreshCw className="w-3 h-3 text-[#fbbf24] animate-spin" />
                )}
              </div>

              <select
                value={selectedMusicId}
                onChange={(e) => handleSelectMusicTrack(e.target.value)}
                disabled={isPreparingMusic}
                className="w-full p-2.5 rounded-xl bg-[#181825] border border-[#45475a] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#fbbf24] cursor-pointer"
              >
                {BACKGROUND_MUSIC_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>

              {customMusicName && selectedMusicId !== '__NONE__' && (
                <div className="text-[11px] text-[#fbbf24] flex items-center justify-between pt-1">
                  <span className="truncate">🎵 Piste : {customMusicName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (musicAudioRef.current) {
                        if (musicAudioRef.current.paused) musicAudioRef.current.play().catch(() => {});
                        else musicAudioRef.current.pause();
                      }
                    }}
                    className="text-[10px] underline hover:text-white shrink-0 ml-2"
                  >
                    Tester audio
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mixeur 3 Canaux : Vidéo Originale • Voix Off • Fond Sonore */}
          <div className="p-3.5 bg-[#11111b] rounded-xl border border-[#313244] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#cdd6f4]">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#89b4fa]" />
                <span>Mixeur Audio 3 Canaux (Volumes de sortie)</span>
              </span>
              <span className="text-[10px] text-[#a6adc8] font-normal">
                Équilibrez la vidéo, la voix off et le fond sonore
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Canal 1 : Son Original */}
              <div className="bg-[#181825] p-2.5 rounded-lg border border-[#313244] space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-semibold text-[#89b4fa] flex items-center gap-1">
                    <Volume2 className="w-3 h-3" />
                    <span>Vidéo Originale</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-[#89b4fa]">
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
                <span className="text-[9px] text-[#6c7086] block">
                  {originalAudioVolume === 0 ? "Muet (Remplacement total)" : "Atténuation ambiance (Ducking)"}
                </span>
              </div>

              {/* Canal 2 : Voix Off */}
              <div className="bg-[#181825] p-2.5 rounded-lg border border-[#313244] space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-semibold text-[#a6e3a1] flex items-center gap-1">
                    <Mic className="w-3 h-3" />
                    <span>Voix Off (Narration)</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-[#a6e3a1]">
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
                <span className="text-[9px] text-[#6c7086] block">
                  Clarté et niveau d'écoute de la voix
                </span>
              </div>

              {/* Canal 3 : Fond Sonore / Musique */}
              <div className="bg-[#181825] p-2.5 rounded-lg border border-[#fbbf24]/30 space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-semibold text-[#fbbf24] flex items-center gap-1">
                    <Music className="w-3 h-3" />
                    <span>Fond Sonore / Rythme</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-[#fbbf24]">
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
                <span className="text-[9px] text-[#6c7086] block">
                  {selectedMusicId === '__NONE__' ? "Aucun fond sélectionné" : "Volume d'accompagnement"}
                </span>
              </div>
            </div>
          </div>

          {/* Éléments audio de pré-écoute cachés */}
          <audio ref={voiceoverAudioRef} src={voiceoverAudioUrl || undefined} preload="auto" />
          <audio ref={musicAudioRef} src={musicAudioUrl || undefined} loop preload="auto" />
          <input 
            ref={customMusicInputRef} 
            type="file" 
            accept="audio/*,.mp3,.wav,.ogg,.m4a" 
            className="hidden" 
            onChange={handleCustomMusicUpload} 
          />

          {/* Video Assembler & Export Trigger */}
          {isVideo && (
            <div className="pt-3 border-t border-[#313244] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#11111b]/60 p-3.5 rounded-xl">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#cdd6f4]">
                  <input 
                    type="checkbox" 
                    checked={burnSubtitlesInExport} 
                    onChange={(e) => setBurnSubtitlesInExport(e.target.checked)}
                    className="w-4 h-4 rounded text-[#89b4fa] focus:ring-0 cursor-pointer accent-[#89b4fa]"
                  />
                  <span>Incruster les sous-titres dans la vidéo finale (Hardsub)</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportEditedVideo}
                  disabled={isExportingVideo}
                  className="px-6 py-3 bg-gradient-to-r from-[#a6e3a1] via-[#94e2d5] to-[#89b4fa] text-[#11111b] rounded-xl text-xs font-black hover:opacity-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-[#a6e3a1]/20"
                >
                  {isExportingVideo ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{exportProgressMsg || "Assemblage vidéo en cours..."}</span>
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4" />
                      <span>Exporter la Vidéo Finale (.MP4)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Synchronized Subtitles Segments List */}
      {segments.length > 0 && (
        <div className="space-y-3 p-4 bg-[#181825] rounded-2xl border border-[#313244]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#313244]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#89b4fa]" />
              <h3 className="text-sm font-bold text-white">
                Sous-titres synchronisés ({segments.length} segments)
              </h3>
            </div>
            
            {/* Quick Export & Config Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowSubtitleConfigPanel(prev => !prev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  showSubtitleConfigPanel
                    ? 'bg-[#89b4fa] text-[#11111b] border-[#89b4fa]'
                    : 'bg-[#313244] text-[#cdd6f4] border-[#45475a] hover:bg-[#45475a]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>⚙️ Configuration Lisibilité SRT</span>
              </button>

              <button 
                onClick={exportCurrentAsSRT}
                className="px-3 py-1.5 bg-[#89b4fa]/20 hover:bg-[#89b4fa]/30 text-[#89b4fa] border border-[#89b4fa]/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                title="Télécharger le fichier .SRT"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter .SRT</span>
              </button>
              <button 
                onClick={exportCurrentAsVTT}
                className="px-3 py-1.5 bg-[#a6e3a1]/20 hover:bg-[#a6e3a1]/30 text-[#a6e3a1] border border-[#a6e3a1]/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                title="Télécharger le fichier .VTT pour le web"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter .VTT</span>
              </button>
            </div>
          </div>

          {/* Panneau repliable de configuration des sous-titres */}
          {showSubtitleConfigPanel && (
            <div className="p-4 bg-[#11111b] rounded-xl border border-[#89b4fa]/40 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-bold text-[#89b4fa]">
                <span>Paramètres d'Optimisation de la Lisibilité SRT</span>
                <span className="text-[10px] text-[#a6adc8] font-mono">Sous-titres & Répit visuel</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-xs text-[#a6adc8] mb-1">
                    <span>Durée minimale par sous-titre :</span>
                    <span className="font-mono font-bold text-[#89b4fa]">{minSubtitleDuration.toFixed(1)}s</span>
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
                  <span className="text-[10px] text-[#6c7086] block mt-0.5">Garantit que l'œil humain a le temps de lire (défaut 2.0s)</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[#a6adc8] mb-1">
                    <span>Caractères max par ligne :</span>
                    <span className="font-mono font-bold text-[#f9e2af]">{maxCharsPerLine} car.</span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={70}
                    step={1}
                    value={maxCharsPerLine}
                    onChange={(e) => setMaxCharsPerLine(parseInt(e.target.value))}
                    className="w-full accent-[#f9e2af]"
                  />
                  <span className="text-[10px] text-[#6c7086] block mt-0.5">Coupe automatiquement le texte en lignes propres</span>
                </div>
              </div>

              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  onClick={handleApplySubtitleConfig}
                  className="px-4 py-2 rounded-lg bg-[#89b4fa] text-[#11111b] font-bold text-xs hover:bg-[#b4befe] transition-all shadow"
                >
                  Appliquer aux sous-titres actuels
                </button>
              </div>
            </div>
          )}

          {/* Quick Export & Config Actions */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#313244]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#89b4fa]" />
              <h3 className="text-sm font-bold text-white">
                Sous-titres synchronisés ({segments.length} segments)
              </h3>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowSubtitleConfigPanel(prev => !prev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  showSubtitleConfigPanel
                    ? 'bg-[#89b4fa] text-[#11111b] border-[#89b4fa]'
                    : 'bg-[#313244] text-[#cdd6f4] border-[#45475a] hover:bg-[#45475a]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>⚙️ Configuration Lisibilité SRT</span>
              </button>
              <button 
                onClick={exportCurrentAsSRT}
                className="px-3 py-1.5 bg-[#89b4fa]/20 hover:bg-[#89b4fa]/30 text-[#89b4fa] border border-[#89b4fa]/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                title="Télécharger le fichier .SRT"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter .SRT</span>
              </button>
              <button 
                onClick={exportCurrentAsVTT}
                className="px-3 py-1.5 bg-[#a6e3a1]/20 hover:bg-[#a6e3a1]/30 text-[#a6e3a1] border border-[#a6e3a1]/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                title="Télécharger le fichier .VTT pour le web"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter .VTT</span>
              </button>
              {onInsertTextToStudio && rawText && (
                <button 
                  onClick={() => onInsertTextToStudio(rawText)}
                  className="px-3 py-1.5 bg-[#f9e2af]/20 hover:bg-[#f9e2af]/30 text-[#f9e2af] border border-[#f9e2af]/40 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                  title="Envoyer le texte transcrit dans le Studio Vocal pour synthèse"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Vers Studio Vocal</span>
                </button>
              )}
            </div>
          </div>

          {/* Timeline segments list with interactive jump on click */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {segments.map((seg, idx) => {
              const isActive = currentTime >= seg.start && currentTime <= seg.end;
              const isEditing = editingSegmentIdx === idx;

              return (
                <div 
                  key={idx}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    isActive 
                      ? 'bg-[#89b4fa]/15 border-[#89b4fa] shadow-sm' 
                      : 'bg-[#11111b] border-[#313244] hover:border-[#45475a]'
                  }`}
                >
                  <div 
                    onClick={() => handleMediaSeek(seg.start)} 
                    className="cursor-pointer flex-1 flex flex-col sm:flex-row sm:items-center gap-2.5"
                  >
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#313244] text-[#a6adc8] shrink-0 font-semibold flex items-center gap-1">
                      <Play className="w-2.5 h-2.5 text-[#89b4fa]" />
                      {secondsToSRT(seg.start).slice(3, 8)} ➔ {secondsToSRT(seg.end).slice(3, 8)}
                    </span>

                    {isEditing ? (
                      <input 
                        type="text" 
                        value={seg.text} 
                        onChange={(e) => handleUpdateSegment(idx, e.target.value)} 
                        onBlur={() => setEditingSegmentIdx(null)}
                        autoFocus
                        className="flex-1 p-1.5 bg-[#181825] border border-[#89b4fa] rounded text-xs text-white focus:outline-none"
                      />
                    ) : (
                      <span className={`text-xs ${isActive ? 'text-[#89b4fa] font-bold' : 'text-[#cdd6f4]'}`}>
                        {seg.text}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    <button 
                      onClick={() => setEditingSegmentIdx(isEditing ? null : idx)} 
                      className="p-1.5 text-[#a6adc8] hover:text-[#89b4fa] hover:bg-[#313244] rounded-lg text-[11px]"
                      title="Modifier le texte de ce segment"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => copyToClipboard(seg.text, `seg-${idx}`)} 
                      className="p-1.5 text-[#a6adc8] hover:text-[#a6e3a1] hover:bg-[#313244] rounded-lg text-[11px]"
                      title="Copier ce segment"
                    >
                      {copiedKey === `seg-${idx}` ? <Check className="w-3.5 h-3.5 text-[#a6e3a1]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw continuous text view */}
      {rawText && (
        <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#89b4fa]" />
              <span>Texte intégral fluide</span>
            </h4>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => copyToClipboard(rawText, 'raw-full')} 
                className="px-2.5 py-1 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded-lg text-[11px] font-semibold flex items-center gap-1"
              >
                {copiedKey === 'raw-full' ? <Check className="w-3 h-3 text-[#a6e3a1]" /> : <Copy className="w-3 h-3" />}
                <span>Copier tout le texte</span>
              </button>
              {onInsertTextToAgent && (
                <button 
                  onClick={() => onInsertTextToAgent(rawText)} 
                  className="px-2.5 py-1 bg-[#89b4fa]/20 hover:bg-[#89b4fa]/30 text-[#89b4fa] rounded-lg text-[11px] font-semibold flex items-center gap-1"
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
            onClick={exportAllAsZip} 
            disabled={filteredHistory.length === 0} 
            className="px-4 py-2.5 bg-[#a6e3a1] text-[#11111b] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#94e2d5] transition-all disabled:opacity-50 shadow-md"
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
                    <p className="text-[10px] text-[#a6adc8] truncate">{item.date || 'Récemment'} • {item.transcription.slice(0, 50)}...</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => {
                      if (item.srtContent) {
                        const blob = new Blob([item.srtContent], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${item.name.replace(/\.[^/.]+$/, '')}.srt`;
                        a.click();
                        URL.revokeObjectURL(url);
                        addToast('.SRT téléchargé', 'success');
                      }
                    }} 
                    className="p-1.5 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded-lg text-xs"
                    title="Télécharger les sous-titres .SRT"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setHistory(prev => prev.filter(h => h.id !== item.id))} 
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
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
