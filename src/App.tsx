/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Play, Pause, Download, Trash2, Sparkles, Volume2, 
  BookOpen, Users, Clock, Settings2, Sliders, Check, RefreshCw, 
  Music, Radio, Headphones, FileText, Bookmark, Info, ArrowRight, Settings, Scissors, AlertTriangle, Cpu, Timer, Package, Share2, Upload, Edit3, Folder, Copy,
  Layers, ListOrdered, PlayCircle, PauseCircle, Square, Plus, FileUp
} from 'lucide-react';
import JSZip from 'jszip';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import studioLogo from './assets/images/voxart_logo_1791875178885.jpg';

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

interface ProjectData {
  audios: SavedAudioItem[];
  texts: SavedTextItem[];
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
  const [currentView, setCurrentView] = useState<'home' | 'library' | 'settings'>('home');
  
  // Settings State
  const [domain, setDomain] = useState('art');
  const [language, setLanguage] = useState('Français');
  const [style, setStyle] = useState(stylesMap.art[0].val);
  const [gender, setGender] = useState('voix masculine grave, profonde et résonnante (homme)');
  const [voiceName, setVoiceName] = useState('Kore');
  const [model, setModel] = useState('gemini-3.8-flash-lite-tts');
  const [apiKey, setApiKey] = useState(localStorage.getItem('voxart_key') || '');

  // Home State
  const [text, setText] = useState('');
  const [saveTitle, setSaveTitle] = useState('Piste_01');
  const [library, setLibrary] = useState<Record<string, ProjectData>>({});
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState('');
  const [libNewProjectName, setLibNewProjectName] = useState('');
  
  // Audio & Trimmer State
  const [currentAudioBlob, setCurrentAudioBlob] = useState<Blob | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [showSaveSection, setShowSaveSection] = useState(false);
  const [copiedScriptId, setCopiedScriptId] = useState<number | string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Batch Processing State
  const [homeMode, setHomeMode] = useState<'single' | 'batch'>('single');
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

  const batchFileInputRef = useRef<HTMLInputElement | null>(null);
  const batchAbortRef = useRef<boolean>(false);
  const batchAudioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loadedLib = JSON.parse(localStorage.getItem('voxart_library') || '{}');
    setLibrary(loadedLib);
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

  const saveLibraryToStorage = (lib: Record<string, ProjectData>) => {
    setLibrary(lib);
    localStorage.setItem('voxart_library', JSON.stringify(lib));
  };

  const handleDomainChange = (newDomain: string) => {
    setDomain(newDomain);
    const available = stylesMap[newDomain] || stylesMap.art;
    setStyle(available[0].val);
  };

  const fetchWithExponentialBackoff = async (url: string, options: RequestInit, maxRetries = 3): Promise<Response> => {
    let delay = 2000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
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
    return fetch(url, options);
  };

  const generateTTS = async (textToRead: string, isTest = false) => {
    if (!textToRead.trim()) return;

    if (isTest) {
      setIsTesting(true);
    } else {
      setIsGenerating(true);
      setStatusMsg("Génération de l'aperçu audio (Studio RidiaLArt-Vision)...");
      setIsQuotaError(false);
      setRetryCountdown(0);
    }

    try {
      const response = await fetchWithExponentialBackoff('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToRead,
          voiceName,
          model,
          language,
          gender,
          style,
          apiKey
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || `HTTP error ${response.status}`);
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
          testAudioRef.current.play();
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
          audioRef.current.play();
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
      console.error(err);
      const msg = err.message || "";
      if (msg.includes("Quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("429")) {
        setIsQuotaError(true);
        setRetryCountdown(30);
        setStatusMsg("⚠️ Quota Gemini atteint. Nouvelle tentative automatique programmée avec backoff exponentiel.");
      } else {
        setStatusMsg("Erreur : " + (msg || "Échec de la génération"));
      }
    } finally {
      setIsGenerating(false);
      setIsTesting(false);
    }
  };

  const handleBrowserSpeechFallback = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'Wolof' ? 'fr-FR' : (language === 'Anglais' ? 'en-US' : 'fr-FR');
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
      setStatusMsg("Lecture de secours via la synthèse vocale du navigateur en cours...");
    } else {
      alert("La synthèse vocale du navigateur n'est pas supportée sur cet appareil.");
    }
  };

  const handlePreview = () => {
    if (!text.trim()) {
      alert("Veuillez saisir un texte à convertir.");
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
    if (startTime <= 0 && endTime >= audioDuration - 0.1) {
      return currentAudioBlob;
    }

    try {
      const arrayBuffer = await currentAudioBlob.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const sampleRate = decodedBuffer.sampleRate;
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.min(Math.floor(endTime * sampleRate), decodedBuffer.length);
      const frameCount = endSample - startSample;

      if (frameCount <= 0) return currentAudioBlob;

      const offlineCtx = new OfflineAudioContext(decodedBuffer.numberOfChannels, frameCount, sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(offlineCtx.destination);
      source.start(0, startTime, endTime - startTime);

      const renderedBuffer = await offlineCtx.startRendering();
      return audioBufferToWavBlob(renderedBuffer);
    } catch (e) {
      console.error("Trimming error:", e);
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

  const handleSaveToLibrary = async () => {
    if (!currentAudioBlob) return;
    
    let targetProj = selectedProject;
    if (targetProj === '__NEW__' || !targetProj) {
      targetProj = newProjectName.trim();
      if (!targetProj) {
        alert("Veuillez saisir un nom pour le nouveau projet.");
        return;
      }
    }

    const trimmedBlob = await getTrimmedAudioBlob();
    const base64Audio = await blobToBase64(trimmedBlob);
    const itemName = saveTitle.trim() || 'Piste_01';
    const formattedTextContent = `[Studio: VoxArt - Studio RidiaLArt-Vision]\n[Empreinte / Produit par: Studio RidiaLArt-Vision]\n[Date: ${new Date().toISOString().split('T')[0]}]\n----------------------------------------\n\n` + text;

    const updatedLib = { ...library };
    if (!updatedLib[targetProj]) {
      updatedLib[targetProj] = { audios: [], texts: [] };
    }

    updatedLib[targetProj].audios.push({
      id: Date.now(),
      name: itemName,
      data: base64Audio
    });

    updatedLib[targetProj].texts.push({
      id: Date.now() + 1,
      name: `${itemName}_script`,
      content: formattedTextContent
    });

    saveLibraryToStorage(updatedLib);
    alert(`Enregistré avec succès dans le projet "${targetProj}" (Studio RidiaLArt-Vision) !`);
    setCurrentView('library');
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
    } catch (e) {
      console.error("ZIP Export Error:", e);
      alert("Erreur lors de la création de l'archive ZIP.");
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
          alert(`Projet "${parsed.projectName}" importé avec succès dans la bibliothèque VoxArt !`);
        } else {
          alert("Format de fichier de partage VoxArt invalide.");
        }
      } catch (err) {
        console.error(err);
        alert("Erreur lors de l'importation du fichier projet.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleCreateLibraryProject = () => {
    const pName = libNewProjectName.trim();
    if (!pName) {
      alert("Veuillez saisir un nom pour le nouveau projet.");
      return;
    }
    if (library[pName]) {
      alert("Un projet avec ce nom existe déjà dans la bibliothèque.");
      return;
    }
    const updated = {
      ...library,
      [pName]: { audios: [], texts: [] }
    };
    saveLibraryToStorage(updated);
    setLibNewProjectName('');
    alert(`Projet "${pName}" créé avec succès !`);
  };

  const renameProject = (oldName: string) => {
    const newName = prompt("Nouveau nom du projet :", oldName);
    if (newName && newName.trim() !== oldName) {
      const trimmed = newName.trim();
      if (library[trimmed]) {
        alert("Un projet portant ce nom existe déjà.");
        return;
      }
      const updated = { ...library };
      updated[trimmed] = updated[oldName];
      delete updated[oldName];
      saveLibraryToStorage(updated);
    }
  };

  const renameAudioItem = (proj: string, idx: number) => {
    const item = library[proj]?.audios[idx];
    if (!item) return;
    const newName = prompt("Nouveau nom du fichier audio :", item.name);
    if (newName) {
      const updated = { ...library };
      updated[proj].audios[idx].name = newName.trim();
      saveLibraryToStorage(updated);
    }
  };

  const renameTextItem = (proj: string, idx: number) => {
    const item = library[proj]?.texts[idx];
    if (!item) return;
    const newName = prompt("Nouveau nom du fichier texte :", item.name);
    if (newName) {
      const updated = { ...library };
      updated[proj].texts[idx].name = newName.trim();
      saveLibraryToStorage(updated);
    }
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
        alert("Le partage de fichiers n'est pas pris en charge par votre navigateur. Utilisez le téléchargement ⬇️.");
      }
    } catch (err) {
      console.error(err);
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
        alert("Partage non supporté.");
      }
    } catch (err) {
      console.error(err);
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
      alert("Veuillez d'abord découper un texte ou importer un fichier.");
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
        const textToRead = batchQueue[i].text;
        const response = await fetchWithExponentialBackoff('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: textToRead,
            voiceName,
            model,
            language,
            gender,
            style,
            apiKey
          })
        });

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
      const response = await fetchWithExponentialBackoff('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: item.text,
          voiceName,
          model,
          language,
          gender,
          style,
          apiKey
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || `Erreur ${response.status}`);
      }

      const base64Audio = data.audio;
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(blob);

      const audioItem: SavedAudioItem = {
        id: Date.now(),
        name: item.name,
        data: `data:audio/mp3;base64,${base64Audio}`
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
      alert("Aucun clip audio terminé à lire.");
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

      {/* Top Header */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-[#313244] bg-[#1e1e2e]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#89b4fa] to-[#fab387] flex items-center justify-center shadow-md">
            <Radio className="w-5 h-5 text-[#11111b]" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-[#cdd6f4] whitespace-nowrap">VoxArt Studio</span>
            <span className="hidden sm:inline-block ml-2 text-xs text-[#a6adc8] font-mono">RidiaLArt-Vision</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 bg-[#313244]/60 p-1 rounded-xl border border-[#45475a]">
          <button
            onClick={() => setCurrentView('home')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              currentView === 'home' ? 'bg-[#89b4fa] text-[#11111b]' : 'text-[#cdd6f4]'
            }`}
          >
            Accueil Studio
          </button>
          <button
            onClick={() => setCurrentView('library')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              currentView === 'library' ? 'bg-[#89b4fa] text-[#11111b]' : 'text-[#cdd6f4]'
            }`}
          >
            📚 Bibliothèque ({Object.keys(library).length})
          </button>
          <button
            onClick={() => setCurrentView('settings')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              currentView === 'settings' ? 'bg-[#89b4fa] text-[#11111b]' : 'text-[#cdd6f4]'
            }`}
          >
            ⚙️ Réglages
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton />
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="flex md:hidden gap-2 px-4 py-3 bg-[#1e1e2e] border-b border-[#313244] shrink-0">
        <button
          onClick={() => setCurrentView('home')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${currentView === 'home' ? 'bg-[#89b4fa] text-[#11111b]' : 'bg-[#313244] text-[#cdd6f4]'}`}
        >
          Accueil
        </button>
        <button
          onClick={() => setCurrentView('library')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${currentView === 'library' ? 'bg-[#89b4fa] text-[#11111b]' : 'bg-[#313244] text-[#cdd6f4]'}`}
        >
          Biblio
        </button>
        <button
          onClick={() => setCurrentView('settings')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${currentView === 'settings' ? 'bg-[#89b4fa] text-[#11111b]' : 'bg-[#313244] text-[#cdd6f4]'}`}
        >
          Réglages
        </button>
      </div>

      <main className={`flex-1 w-full mx-auto p-4 sm:p-6 transition-all ${homeMode === 'batch' && currentView === 'home' ? 'max-w-2xl' : 'max-w-xl'}`}>
        
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
            
            <div className="bg-[#313244] p-3 rounded-xl flex items-center justify-between text-xs text-[#f9e2af]">
              <span>Config : {language} | {genderText} | {domain.toUpperCase()} | Modèle : {model}</span>
              <div>
                <button
                  onClick={() => setCurrentView('library')}
                  className="px-2.5 py-1 bg-[#1e1e2e] text-[#89b4fa] rounded-lg border border-[#89b4fa]/50 hover:bg-[#89b4fa] hover:text-[#11111b] transition-all font-semibold mr-2 text-xs"
                >
                  📚 Biblio
                </button>
                <button
                  onClick={() => setCurrentView('settings')}
                  className="px-2.5 py-1 bg-[#1e1e2e] text-[#89b4fa] rounded-lg border border-[#89b4fa]/50 hover:bg-[#89b4fa] hover:text-[#11111b] transition-all font-semibold text-xs"
                >
                  ⚙️ Réglages
                </button>
              </div>
            </div>

            {/* Mode Switcher: Mode Standard vs Traitement par lots */}
            <div className="flex p-1 bg-[#181825] rounded-xl border border-[#313244] gap-1">
              <button
                type="button"
                onClick={() => setHomeMode('single')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  homeMode === 'single'
                    ? 'bg-[#89b4fa] text-[#11111b] shadow-md'
                    : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]/50'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Mode Standard (Texte unique)</span>
              </button>
              <button
                type="button"
                onClick={() => setHomeMode('batch')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  homeMode === 'batch'
                    ? 'bg-[#89b4fa] text-[#11111b] shadow-md'
                    : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Traitement par lots (Multi-clips)</span>
                {batchQueue.length > 0 && (
                  <span className="text-[10px] bg-[#11111b]/20 px-1.5 py-0.5 rounded-full font-bold">
                    {batchCompletedCount}/{batchQueue.length}
                  </span>
                )}
              </button>
            </div>

            {homeMode === 'single' ? (
              <>
                {isQuotaError && (
                  <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs space-y-3">
                    <div className="flex items-center gap-2 font-bold text-red-300">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>File d'attente intelligente — Quota Gemini Atteint</span>
                    </div>
                    <p className="leading-relaxed">
                      Le système a appliqué un backoff exponentiel. Rétablissement estimé dans : <strong className="text-white font-mono text-sm">{retryCountdown}s</strong>
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => { setRetryCountdown(0); handlePreview(); }}
                        className="flex-1 py-2 rounded-lg bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition-all"
                      >
                        Réessayer maintenant
                      </button>
                      <button
                        onClick={handleBrowserSpeechFallback}
                        className="flex-1 py-2 rounded-lg bg-[#313244] text-[#89b4fa] border border-[#89b4fa]/40 font-bold text-xs hover:bg-[#89b4fa] hover:text-[#11111b] transition-all"
                      >
                        🔊 Secours Navigateur
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#a6adc8]">Texte à convertir :</label>
                    <span className="text-[10px] text-[#a6adc8]">{text.length} caractères</span>
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Saisissez ou collez votre texte ici..."
                    className="w-full h-36 p-3 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm resize-y"
                  />
                </div>

                <button
                  onClick={handlePreview}
                  disabled={isGenerating || !text.trim()}
                  className="w-full py-3 rounded-xl bg-[#89b4fa] text-[#11111b] font-bold text-sm shadow-md hover:bg-[#b4befe] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Génération en cours (Studio RidiaLArt-Vision)...</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span>🔊 Écouter l'aperçu (Gemini TTS)</span>
                    </>
                  )}
                </button>

                <div className="text-xs text-center text-[#a6adc8]">
                  {statusMsg}
                </div>

                {currentAudioUrl && (
                  <div className="pt-3 space-y-4">
                    <audio ref={audioRef} controls className="w-full accent-[#89b4fa]" src={currentAudioUrl} />

                    {/* TRIMMER RANGE SLIDER UI */}
                    <div className="bg-[#313244]/60 p-4 rounded-xl border border-[#45475a] space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-[#89b4fa]">
                        <span className="flex items-center gap-1.5"><Scissors className="w-4 h-4" /> Découpe & Suppression des silences</span>
                        <span className="tabular-nums">{formatTimeDisplay(startTime)} — {formatTimeDisplay(endTime)} (sur {formatTimeDisplay(audioDuration)})</span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-[11px] text-[#a6adc8] mb-1">
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
                          <div className="flex justify-between text-[11px] text-[#a6adc8] mb-1">
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
                        onClick={playTrimmedSelection}
                        className="w-full py-2 rounded-lg bg-[#313244] border border-[#89b4fa] text-[#89b4fa] text-xs font-bold hover:bg-[#89b4fa] hover:text-[#11111b] transition-all"
                      >
                        ▶️ Écouter la sélection rognée
                      </button>
                    </div>
                  </div>
                )}

                {showSaveSection && currentAudioUrl && (
                  <div className="mt-4 pt-4 border-t border-[#313244] space-y-3 animate-fadeIn">
                    <label className="block text-xs font-semibold text-[#a6adc8]">Nom du fichier audio :</label>
                    <input
                      type="text"
                      value={saveTitle}
                      onChange={(e) => setSaveTitle(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm"
                    />

                    <label className="block text-xs font-semibold text-[#a6adc8]">Choisir ou créer un projet :</label>
                    <select
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm"
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
                        className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm mt-2"
                      />
                    )}

                    <button
                      onClick={handleSaveToLibrary}
                      className="w-full py-3 rounded-xl bg-[#a6e3a1] text-[#11111b] font-bold text-sm text-center shadow-lg hover:opacity-90 transition-all"
                    >
                      💾 Enregistrer dans la Bibliothèque VoxArt
                    </button>
                  </div>
                )}
              </>
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
                                alert("Le projet n'est pas encore enregistré dans la bibliothèque.");
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

              <div className="w-full sm:w-auto">
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
                  <span>📥 Importer un projet (.json)</span>
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
                              if (confirm(`Supprimer tout le projet "${proj}" ?`)) {
                                const updated = { ...library };
                                delete updated[proj];
                                saveLibraryToStorage(updated);
                              }
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
                          pData.audios.map((item, idx) => (
                            <div key={item.id} className="flex items-center justify-between bg-[#1e1e2e] p-2 rounded-lg text-xs">
                              <span className="truncate max-w-[140px] sm:max-w-[200px]">🎧 {item.name}</span>
                              <div className="flex items-center gap-1.5">
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
                          ))
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

            <div className="space-y-1 mt-3">
              <label className="block text-xs font-semibold text-[#a6adc8]">Clé API Google Gemini :</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  localStorage.setItem('voxart_key', e.target.value);
                }}
                placeholder="Collez votre clé API AI Studio"
                className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs font-semibold text-[#a6adc8] mb-1">Domaine / Univers :</label>
                <select
                  value={domain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-sm"
                >
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

      </main>
    </div>
  );
}
