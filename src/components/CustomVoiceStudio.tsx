import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Square,
  Upload,
  Sparkles,
  Volume2,
  Save,
  Check,
  Trash2,
  Edit3,
  RefreshCw,
  Info,
  Sliders,
  ArrowRight,
  Plus,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import {
  BaseGeminiVoiceId,
  CustomVoiceProfile,
  VoiceAnalysisResult,
  VoicePace,
} from '../types/voiceProfile';
import {
  BASE_GEMINI_VOICES,
  PACE_OPTIONS,
  TIMBRE_DESCRIPTOR_CHIPS,
  buildCustomVoiceDesignStyle,
  clampPitch,
  extractCustomVoiceId,
  isCustomVoiceId,
  toCustomVoiceOptionId,
} from '../utils/customVoiceStorage';
import { StudioThemeMode } from './ThemeModeSelector';
import { authFetch, safeJsonResponse } from '../services/apiAuth';

interface CustomVoiceStudioProps {
  customVoices: CustomVoiceProfile[];
  activeVoiceName: string;
  language: string;
  apiKey: string;
  themeMode: StudioThemeMode;
  onSaveProfile: (profile: CustomVoiceProfile, activateImmediately?: boolean) => void;
  onDeleteProfile: (profileId: string) => void;
  onActivateVoice: (voiceOptionId: string, pitch?: number) => void;
  onGoToVocalStudio: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

const DEFAULT_PREVIEW_TEXT =
  "Bonjour, je suis votre voix personnalisée dans VoxArt Studio. Écoutez la chaleur, le rythme et la précision de mon timbre.";

export const CustomVoiceStudio: React.FC<CustomVoiceStudioProps> = ({
  customVoices,
  activeVoiceName,
  language,
  apiKey,
  themeMode,
  onSaveProfile,
  onDeleteProfile,
  onActivateVoice,
  onGoToVocalStudio,
  showToast,
}) => {
  const isRidialArt = themeMode === 'ridialart';
  const accentBtnClass = isRidialArt
    ? 'bg-gradient-to-r from-[#d97706] to-[#fbbf24] text-[#1c0f04] hover:opacity-95'
    : 'bg-[#89b4fa] text-[#11111b] hover:bg-[#b4befe]';
  const accentBorder = isRidialArt ? 'border-[#fbbf24]/50' : 'border-[#89b4fa]/50';
  const accentText = isRidialArt ? 'text-[#fbbf24]' : 'text-[#89b4fa]';

  // Form / Voice Design state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>('Ma Voix Personnalisée');
  const [baseVoiceName, setBaseVoiceName] = useState<BaseGeminiVoiceId>('Charon');
  const [genderLabel, setGenderLabel] = useState<string>(
    'voix masculine grave, profonde et résonnante (homme)'
  );
  const [pitch, setPitch] = useState<number>(1.0);
  const [pace, setPace] = useState<VoicePace>('pose');
  const [timbreTags, setTimbreTags] = useState<string[]>(['Chaleureux', 'Posé & Serein']);
  const [customPromptStyle, setCustomPromptStyle] = useState<string>(
    'Voix naturelle et chaleureuse, articulation nette, présence microphonique proche avec des respirations calmes.'
  );
  const [analysisSummary, setAnalysisSummary] = useState<string>('');

  // Audio recording / upload analysis state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [sampleBlob, setSampleBlob] = useState<Blob | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [sampleFilename, setSampleFilename] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Preview playback state
  const [previewText, setPreviewText] = useState<string>(DEFAULT_PREVIEW_TEXT);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.playbackRate = clampPitch(pitch);
    }
  }, [pitch, previewAudioUrl]);

  const activeCustomId = isCustomVoiceId(activeVoiceName)
    ? extractCustomVoiceId(activeVoiceName)
    : null;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    setMicError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      const msg =
        "L'enregistrement micro direct n'est pas disponible sur cet appareil. Importez plutôt un court fichier audio (MP3, WAV, M4A).";
      setMicError(msg);
      showToast(msg, 'warning');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setIsRecording(false);

        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        if (blob.size > 0) {
          if (sampleUrl) URL.revokeObjectURL(sampleUrl);
          const url = URL.createObjectURL(blob);
          setSampleBlob(blob);
          setSampleUrl(url);
          setSampleFilename(`empreinte-micro-${new Date().toLocaleTimeString('fr-FR')}.webm`);
          showToast('Échantillon vocal enregistré ! Lancez maintenant l’analyse IA.', 'success');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecordingSeconds(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 29) {
            recorder.stop();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('permission'));
      const msg = isDenied
        ? "Autorisation microphone refusée par le navigateur ou l'appareil. Activez l'accès au micro dans les paramètres du site (icône 🔒) ou les autorisations Android, rechargez la page, ou utilisez « Importer un audio »."
        : "Impossible d'accéder au microphone sur cet appareil. Utilisez « Importer un audio » pour charger un fichier ou un mémo vocal.";
      setMicError(msg);
      showToast(msg, 'warning');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleImportSampleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    const url = URL.createObjectURL(file);
    setSampleBlob(file);
    setSampleUrl(url);
    setSampleFilename(file.name);
    setMicError(null);
    showToast(`Audio "${file.name}" chargé. Cliquez sur Analyser ma voix.`, 'info');
  };

  const handleAnalyzeSample = async () => {
    if (!sampleBlob) {
      showToast("Enregistrez ou importez d'abord un court extrait vocal.", 'info');
      return;
    }

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', sampleBlob, sampleFilename || 'voice-sample.webm');

      const response = await authFetch(
        '/api/voice-profile/analyze',
        {
          method: 'POST',
          body: formData,
        },
        apiKey
      );

      const data = await safeJsonResponse<any>(response, "de l'analyse vocale");
      if (!response.ok) {
        throw new Error(data?.error || 'Erreur lors de l’analyse vocale');
      }

      const result = data as VoiceAnalysisResult;
      setBaseVoiceName(result.recommendedBaseVoice);
      setPitch(clampPitch(result.estimatedPitchFactor));
      setGenderLabel(result.detectedGenderLabel);
      setPace(result.detectedPace);
      setTimbreTags(result.detectedTimbreTags || []);
      if (result.voiceDesignPrompt) {
        setCustomPromptStyle(result.voiceDesignPrompt);
      }
      setAnalysisSummary(result.analysisSummary || 'Empreinte vocale calibrée.');
      showToast('Empreinte vocale analysée et appliquée au profil !', 'success');
    } catch (err: any) {
      showToast(err?.message || "Impossible d'analyser cet extrait audio.", 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleTimbreTag = (tag: string) => {
    setTimbreTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 5)
    );
  };

  const buildDraftProfile = (idToUse: string, createdAtToUse: string): CustomVoiceProfile => ({
    id: idToUse,
    name: profileName.trim() || 'Ma Voix Personnalisée',
    baseVoiceName,
    genderLabel,
    pitch: clampPitch(pitch),
    pace,
    timbreTags,
    customPromptStyle: customPromptStyle.trim(),
    analysisSummary: analysisSummary.trim() || undefined,
    createdAt: createdAtToUse,
    updatedAt: new Date().toISOString(),
  });

  const handleTestCustomVoice = async () => {
    const cleanText = previewText.trim() || DEFAULT_PREVIEW_TEXT;
    const draft = buildDraftProfile('preview', new Date().toISOString());
    const voiceDesignStyle = buildCustomVoiceDesignStyle(draft);

    setIsPreviewLoading(true);
    try {
      const response = await authFetch(
        '/api/tts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cleanText,
            voiceName: draft.baseVoiceName,
            model: 'gemini-3.8-flash-tts',
            language,
            gender: draft.genderLabel,
            style: voiceDesignStyle,
            customVoiceStyle: voiceDesignStyle,
            apiKey,
          }),
        },
        apiKey
      );

      const data = await safeJsonResponse<any>(response, 'du moteur vocal');
      if (!response.ok || data.fallback || !data.audio) {
        throw new Error(
          data?.message ||
            data?.error ||
            'Génération d’aperçu indisponible. Vérifiez votre connexion ou clé API Gemini.'
        );
      }

      const binary = atob(data.audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const isRiffWav = bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
      const blob = new Blob([bytes], { type: isRiffWav ? 'audio/wav' : 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(url);

      setTimeout(() => {
        if (previewAudioRef.current) {
          previewAudioRef.current.playbackRate = clampPitch(draft.pitch);
          previewAudioRef.current.play().catch(() => {});
        }
      }, 60);
    } catch (err: any) {
      showToast(err?.message || "Échec de l'aperçu vocal.", 'warning');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSaveAndActivate = () => {
    const cleanName = profileName.trim();
    if (!cleanName) {
      showToast('Veuillez donner un nom à votre voix personnalisée.', 'warning');
      return;
    }

    const existing = editingId ? customVoices.find((v) => v.id === editingId) : null;
    const id = existing
      ? existing.id
      : `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = existing?.createdAt || new Date().toISOString();

    const profile = buildDraftProfile(id, createdAt);
    onSaveProfile(profile, true);
    setEditingId(id);
    showToast(`Voix "${profile.name}" enregistrée et activée dans le studio !`, 'success');
  };

  const handleEditExisting = (profile: CustomVoiceProfile) => {
    setEditingId(profile.id);
    setProfileName(profile.name);
    setBaseVoiceName(profile.baseVoiceName);
    setGenderLabel(profile.genderLabel);
    setPitch(clampPitch(profile.pitch));
    setPace(profile.pace);
    setTimbreTags(profile.timbreTags || []);
    setCustomPromptStyle(profile.customPromptStyle || '');
    setAnalysisSummary(profile.analysisSummary || '');
    showToast(`Édition du profil "${profile.name}".`, 'info');
  };

  const handleResetNewForm = () => {
    setEditingId(null);
    setProfileName(`Ma Voix ${customVoices.length + 1}`);
    setBaseVoiceName('Charon');
    setGenderLabel('voix masculine grave, profonde et résonnante (homme)');
    setPitch(1.0);
    setPace('pose');
    setTimbreTags(['Chaleureux', 'Posé & Serein']);
    setCustomPromptStyle(
      'Voix naturelle et chaleureuse, articulation nette, présence microphonique proche avec des respirations calmes.'
    );
    setAnalysisSummary('');
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Bannière explicative transparente */}
      <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl bg-[#181825] border ${accentBorder} shrink-0`}>
            <Info className={`w-4 h-4 ${accentText}`} />
          </div>
          <div className="space-y-1 text-xs">
            <h2 className="text-sm font-bold text-[#cdd6f4]">
              Ma Voix Personnalisée — Empreinte Vocale & Voice Design
            </h2>
            <p className="text-[#a6adc8] leading-relaxed">
              Enregistrez ou importez un court extrait de votre voix (10 à 20 s) ou sculptez directement vos paramètres. Gemini analyse votre grain, votre rythme et votre registre pour piloter le moteur <strong className="text-[#cdd6f4]">Voice Design</strong> et calibrer votre hauteur vocale.
            </p>
            <p className="text-[11px] text-[#6c7086] leading-relaxed">
              Transparence technique : Gemini ne réalise pas de clonage biométrique brut à l’identique d’un fichier audio, mais recrée fidèlement votre signature vocale (timbre, cadence, intonation et pitch) sur mesure.
            </p>
          </div>
        </div>
      </div>

      {/* ÉTAPE 1 : EMPREINTE VOCALE AUDIO */}
      <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mic className={`w-4 h-4 ${accentText}`} />
            <h3 className="text-xs sm:text-sm font-bold text-[#cdd6f4]">
              1. Empreinte vocale par audio (optionnel)
            </h3>
          </div>
          {isRecording && (
            <span className="text-xs font-mono font-bold text-[#f38ba8] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#f38ba8] animate-pulse" />
              {formatDuration(recordingSeconds)} / 00:30
            </span>
          )}
        </div>

        <p className="text-xs text-[#a6adc8]">
          Lisez une phrase à voix posée (ex. : « Bonjour, je crée avec VoxArt Studio... ») pour que l’IA détecte automatiquement votre timbre et votre cadence.
        </p>

        <div className="flex flex-wrap gap-2.5">
          {!isRecording ? (
            <button
              type="button"
              onClick={handleStartRecording}
              className="min-h-[44px] px-4 rounded-xl bg-[#181825] hover:bg-[#313244] border border-[#313244] text-[#cdd6f4] text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Mic className="w-4 h-4 text-[#f38ba8]" />
              <span>Enregistrer au micro</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopRecording}
              className="min-h-[44px] px-4 rounded-xl bg-[#f38ba8] text-[#11111b] text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Arrêter l’enregistrement</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] px-4 rounded-xl bg-[#181825] hover:bg-[#313244] border border-[#313244] text-[#cdd6f4] text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Upload className="w-4 h-4 text-[#89b4fa]" />
            <span>Importer un audio</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
            className="hidden"
            onChange={handleImportSampleFile}
          />

          {sampleBlob && (
            <button
              type="button"
              onClick={handleAnalyzeSample}
              disabled={isAnalyzing}
              className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all ${accentBtnClass}`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyse acoustique...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyser ma voix avec l’IA</span>
                </>
              )}
            </button>
          )}
        </div>

        {micError && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{micError}</span>
          </div>
        )}

        {sampleUrl && (
          <div className="p-3 rounded-xl bg-[#181825] border border-[#313244] space-y-2">
            <div className="text-[11px] text-[#a6adc8] truncate">
              Échantillon chargé : <strong className="text-[#cdd6f4]">{sampleFilename}</strong>
            </div>
            <audio controls src={sampleUrl} className="w-full h-9 accent-[#fbbf24]" />
          </div>
        )}

        {analysisSummary && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 leading-relaxed">
            <strong className="text-emerald-300">Diagnostic acoustique : </strong>
            {analysisSummary}
          </div>
        )}
      </div>

      {/* ÉTAPE 2 : SCULPTURE DU PROFIL VOCAL */}
      <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sliders className={`w-4 h-4 ${accentText}`} />
            <h3 className="text-xs sm:text-sm font-bold text-[#cdd6f4]">
              2. Sculpture & signature vocale
            </h3>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={handleResetNewForm}
              className="text-xs text-[#89b4fa] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer un autre profil</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[#a6adc8] mb-1">
              Nom de votre voix
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Ex : Ma Voix — The RidiaLArt"
              className="w-full min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#fbbf24]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#a6adc8] mb-1">
              Registre / Timbre de base
            </label>
            <select
              value={genderLabel}
              onChange={(e) => setGenderLabel(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#fbbf24] cursor-pointer"
            >
              <option value="voix masculine grave, profonde et résonnante (homme)">
                Homme (Grave & Profond)
              </option>
              <option value="voix féminine mélodieuse, claire et expressive (femme)">
                Femme (Mélodieuse & Claire)
              </option>
              <option value="voix neutre, posée et feutrée">Neutre & Feutré</option>
            </select>
          </div>
        </div>

        {/* Sélection socle vocal Gemini */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-[#a6adc8]">
            Moteur vocal Gemini de référence
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {BASE_GEMINI_VOICES.map((v) => {
              const selected = baseVoiceName === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setBaseVoiceName(v.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selected
                      ? `bg-[#181825] ${accentBorder} ring-1 ring-inset ${
                          isRidialArt ? 'ring-[#fbbf24]/40' : 'ring-[#89b4fa]/40'
                        }`
                      : 'bg-[#181825]/70 border-[#313244] hover:border-[#45475a]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#cdd6f4]">{v.label}</span>
                    <span className="text-[10px] text-[#a6adc8]">{v.gender}</span>
                  </div>
                  <p className="text-[10px] text-[#6c7086] mt-1 leading-tight">{v.summary}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Calibrage Pitch + Cadence */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-[#181825] border border-[#313244] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#a6adc8] font-medium">Hauteur / Pitch</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[#cdd6f4] tabular-nums">
                  {pitch.toFixed(2)}x
                </span>
                {pitch !== 1.0 && (
                  <button
                    type="button"
                    onClick={() => setPitch(1.0)}
                    className="text-[10px] text-[#89b4fa] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>1.00</span>
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={0.75}
              max={1.25}
              step={0.01}
              value={pitch}
              onChange={(e) => setPitch(clampPitch(parseFloat(e.target.value)))}
              className="w-full accent-[#fbbf24]"
            />
            <div className="flex justify-between text-[10px] text-[#6c7086]">
              <span>Plus grave (0.75x)</span>
              <span>Plus clair (1.25x)</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#181825] border border-[#313244] space-y-2">
            <label className="block text-xs text-[#a6adc8] font-medium">
              Cadence & rythme d’élocution
            </label>
            <select
              value={pace}
              onChange={(e) => setPace(e.target.value as VoicePace)}
              className="w-full min-h-[40px] px-3 rounded-lg bg-[#11111b] border border-[#313244] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#fbbf24] cursor-pointer"
            >
              {(Object.keys(PACE_OPTIONS) as VoicePace[]).map((key) => (
                <option key={key} value={key}>
                  {PACE_OPTIONS[key].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Descripteurs de timbre */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-[#a6adc8]">
            Traits vocaux caractéristiques (5 max)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TIMBRE_DESCRIPTOR_CHIPS.map((tag) => {
              const active = timbreTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTimbreTag(tag)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                    active
                      ? isRidialArt
                        ? 'bg-[#fbbf24]/20 border-[#fbbf24]/60 text-[#fde68a]'
                        : 'bg-[#89b4fa]/20 border-[#89b4fa]/60 text-[#cdd6f4]'
                      : 'bg-[#181825] border-[#313244] text-[#a6adc8] hover:border-[#45475a]'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Directive libre Voice Design */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-[#a6adc8]">
            Directive Voice Design (grain, diction, respiration, émotion)
          </label>
          <textarea
            value={customPromptStyle}
            onChange={(e) => setCustomPromptStyle(e.target.value)}
            rows={3}
            placeholder="Décrivez précisément votre façon de parler..."
            className="w-full p-3 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-xs leading-relaxed resize-y focus:outline-none focus:border-[#fbbf24]"
          />
        </div>

        {/* Texte de test + écoute */}
        <div className="p-3 rounded-xl bg-[#181825] border border-[#313244] space-y-2.5">
          <label className="block text-[11px] font-medium text-[#a6adc8]">
            Phrase d’aperçu pour tester votre voix ({language})
          </label>
          <input
            type="text"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            className="w-full min-h-[40px] px-3 rounded-lg bg-[#11111b] border border-[#313244] text-[#cdd6f4] text-xs"
          />

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleTestCustomVoice}
              disabled={isPreviewLoading}
              className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isPreviewLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Génération de l’aperçu...</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-[#89b4fa]" />
                  <span>Écouter un aperçu</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSaveAndActivate}
              className={`flex-1 min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${accentBtnClass}`}
            >
              <Save className="w-4 h-4" />
              <span>{editingId ? 'Mettre à jour & Activer' : 'Enregistrer & Activer'}</span>
            </button>
          </div>

          {previewAudioUrl && (
            <audio
              ref={previewAudioRef}
              controls
              src={previewAudioUrl}
              className="w-full accent-[#fbbf24] pt-1"
            />
          )}
        </div>
      </div>

      {/* ÉTAPE 3 : MES VOIX ENREGISTRÉES */}
      <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-bold text-[#cdd6f4]">
            Mes voix enregistrées ({customVoices.length})
          </h3>
          <button
            type="button"
            onClick={onGoToVocalStudio}
            className={`text-xs font-semibold flex items-center gap-1 cursor-pointer hover:underline ${accentText}`}
          >
            <span>Aller à Synthèse Vocale</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {customVoices.length === 0 ? (
          <p className="text-xs text-[#6c7086] py-3 text-center">
            Aucune voix personnalisée enregistrée pour le moment. Sculptez votre profil ci-dessus puis cliquez sur « Enregistrer & Activer ».
          </p>
        ) : (
          <div className="space-y-2.5">
            {customVoices.map((profile) => {
              const isActive = activeCustomId === profile.id;
              return (
                <div
                  key={profile.id}
                  className={`p-3.5 rounded-xl bg-[#181825] border transition-colors space-y-2 ${
                    isActive ? accentBorder : 'border-[#313244]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-[#cdd6f4] truncate">
                          {profile.name}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#a6adc8]">
                        Base {profile.baseVoiceName} · Pitch {profile.pitch.toFixed(2)}x ·{' '}
                        {PACE_OPTIONS[profile.pace]?.label || profile.pace}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            onActivateVoice(toCustomVoiceOptionId(profile.id), profile.pitch);
                            showToast(`Voix "${profile.name}" activée.`, 'success');
                          }}
                          className="min-h-[34px] px-2.5 rounded-lg bg-[#313244] hover:bg-[#45475a] text-[#a6e3a1] text-[11px] font-semibold cursor-pointer"
                        >
                          Activer
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEditExisting(profile)}
                        className="min-h-[34px] px-2.5 rounded-lg bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Modifier</span>
                      </button>

                      {confirmDeleteId === profile.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteProfile(profile.id);
                            if (editingId === profile.id) handleResetNewForm();
                            setConfirmDeleteId(null);
                            showToast(`Voix "${profile.name}" supprimée.`, 'info');
                          }}
                          className="min-h-[34px] px-2.5 rounded-lg bg-[#f38ba8] text-[#11111b] text-[11px] font-bold cursor-pointer"
                        >
                          Confirmer
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(profile.id)}
                          className="min-h-[34px] px-2 rounded-lg bg-[#313244] hover:bg-[#45475a] text-[#f38ba8] text-[11px] cursor-pointer"
                          title="Supprimer cette voix"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {profile.timbreTags && profile.timbreTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {profile.timbreTags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded bg-[#11111b] border border-[#313244] text-[10px] text-[#a6adc8]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
