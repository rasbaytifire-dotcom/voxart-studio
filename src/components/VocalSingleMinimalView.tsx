import React, { useState } from 'react';
import {
  Volume2,
  Save,
  Music,
  Upload,
  Scissors,
  Share2,
  Download,
  Package,
  RefreshCw,
  AlertTriangle,
  Sliders,
  ChevronDown,
  ChevronUp,
  Eraser,
  Sparkles,
} from 'lucide-react';
import { cleanTextForSpeech } from '../utils/textCleaner';
import { PlasticSynesthesiaCanvas } from './PlasticSynesthesiaCanvas';
import { StudioThemeMode } from './ThemeModeSelector';
import { CustomVoiceProfile } from '../types/voiceProfile';
import {
  extractCustomVoiceId,
  isCustomVoiceId,
  toCustomVoiceOptionId,
} from '../utils/customVoiceStorage';

interface VoiceOption {
  id: string;
  name: string;
}

interface VocalSingleMinimalViewProps {
  text: string;
  setText: (val: string) => void;
  voiceName: string;
  setVoiceName: (val: string) => void;
  presetVoices: VoiceOption[];
  customVoices?: CustomVoiceProfile[];
  onOpenCustomVoice?: () => void;
  language: string;
  setLanguage: (val: string) => void;
  gender: string;
  setGender: (val: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  isQuotaError: boolean;
  retryCountdown: number;
  onCancelQuotaRetry: () => void;
  statusMsg: string;
  showSaveSection: boolean;
  setShowSaveSection: React.Dispatch<React.SetStateAction<boolean>>;
  saveTitle: string;
  setSaveTitle: (val: string) => void;
  selectedProject: string;
  setSelectedProject: (val: string) => void;
  newProjectName: string;
  setNewProjectName: (val: string) => void;
  libraryKeys: string[];
  onConfirmSave: () => void;
  currentAudioUrl: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isAudioPlaying: boolean;
  setIsAudioPlaying: (val: boolean) => void;
  themeMode: StudioThemeMode;
  startTime: number;
  setStartTime: (val: number) => void;
  endTime: number;
  setEndTime: (val: number) => void;
  audioDuration: number;
  formatTimeDisplay: (secs: number) => string;
  onPlayTrimmed: () => void;
  onDownloadAudio: (fmt: 'mp3' | 'wav') => void;
  onDownloadZipPack: () => void;
  onShareSocial: (platform: 'whatsapp' | 'twitter' | 'facebook' | 'linkedin' | 'telegram' | 'native') => void;
  activeBackingTrackTitle?: string | null;
  onOpenMixerPage: () => void;
  onOpenSettingsPage: () => void;
  onImportTextClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const VocalSingleMinimalView: React.FC<VocalSingleMinimalViewProps> = ({
  text,
  setText,
  voiceName,
  setVoiceName,
  presetVoices,
  customVoices = [],
  onOpenCustomVoice,
  language,
  setLanguage,
  gender,
  setGender,
  isGenerating,
  onGenerate,
  isQuotaError,
  retryCountdown,
  onCancelQuotaRetry,
  statusMsg,
  showSaveSection,
  setShowSaveSection,
  saveTitle,
  setSaveTitle,
  selectedProject,
  setSelectedProject,
  newProjectName,
  setNewProjectName,
  libraryKeys,
  onConfirmSave,
  currentAudioUrl,
  audioRef,
  isAudioPlaying,
  setIsAudioPlaying,
  themeMode,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  audioDuration,
  formatTimeDisplay,
  onPlayTrimmed,
  onDownloadAudio,
  onDownloadZipPack,
  onShareSocial,
  activeBackingTrackTitle,
  onOpenMixerPage,
  onOpenSettingsPage,
  onImportTextClick,
  fileInputRef,
  onImportFile,
  showToast,
}) => {
  const [openDrawer, setOpenDrawer] = useState<'none' | 'trim' | 'export'>('none');

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 sm:p-5 space-y-4">
        {/* Sélections vocales essentielles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1">
              <label className="block text-[11px] font-medium text-[#a6adc8]">Voix</label>
              {onOpenCustomVoice && (
                <button
                  type="button"
                  onClick={onOpenCustomVoice}
                  className="text-[11px] font-semibold text-[#fbbf24] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Ma Voix</span>
                </button>
              )}
            </div>
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#89b4fa] cursor-pointer"
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
                {presetVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#a6adc8] mb-1">Langue</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#89b4fa] cursor-pointer"
            >
              <option value="Français">Français</option>
              <option value="Anglais">Anglais</option>
              <option value="Wolof">Wolof</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#a6adc8] mb-1">Timbre</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-xs font-medium focus:outline-none focus:border-[#89b4fa] cursor-pointer"
            >
              <option value="voix masculine grave, profonde et résonnante (homme)">Homme (Grave)</option>
              <option value="voix féminine mélodieuse, claire et expressive (femme)">Femme (Mélodieuse)</option>
              <option value="voix neutre, posée et feutrée">Neutre & Feutré</option>
            </select>
          </div>
        </div>

        {(() => {
          if (!isCustomVoiceId(voiceName)) return null;
          const activeCustom = customVoices.find((cv) => cv.id === extractCustomVoiceId(voiceName));
          if (!activeCustom) return null;
          return (
            <div className="px-3 py-2 rounded-xl bg-[#181825] border border-[#fbbf24]/35 flex items-center justify-between gap-2 text-[11px]">
              <div className="text-[#fde68a] truncate">
                Voix personnalisée active : <strong>{activeCustom.name}</strong> ({activeCustom.baseVoiceName} · {activeCustom.pitch.toFixed(2)}x)
              </div>
              {onOpenCustomVoice && (
                <button
                  type="button"
                  onClick={onOpenCustomVoice}
                  className="text-[#fbbf24] font-semibold hover:underline shrink-0 cursor-pointer"
                >
                  Modifier
                </button>
              )}
            </div>
          );
        })()}

        {/* Zone de texte épurée */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-[#cdd6f4]">Texte à convertir</label>
            <div className="flex items-center gap-3 text-xs text-[#a6adc8]">
              <button
                type="button"
                onClick={onImportTextClick}
                className="text-[#89b4fa] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer</span>
              </button>
              {text.includes('*') && (
                <button
                  type="button"
                  onClick={() => {
                    setText(cleanTextForSpeech(text));
                    showToast('Balises nettoyées.', 'success');
                  }}
                  className="text-[#f9e2af] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Nettoyer</span>
                </button>
              )}
              <span className="font-mono tabular-nums text-[11px] text-[#6c7086]">
                {text.length} car.
              </span>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Saisissez ou collez votre texte ici..."
            className="w-full h-40 sm:h-44 p-3.5 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-sm resize-y focus:outline-none focus:border-[#89b4fa] transition-colors"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.text,audio/*"
            className="hidden"
            onChange={onImportFile}
          />
        </div>

        {isQuotaError && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>Reprise automatique dans {retryCountdown}s</span>
            </div>
            <button
              type="button"
              onClick={onCancelQuotaRetry}
              className="px-2.5 py-1 rounded-lg bg-red-950/70 text-red-200 border border-red-500/30 cursor-pointer"
            >
              Annuler
            </button>
          </div>
        )}

        {/* Barre d'actions minimale */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating || !text.trim()}
            className="flex-1 min-h-[46px] py-2.5 px-4 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Génération en cours...</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>Générer & Écouter</span>
              </>
            )}
          </button>

          {(text.trim() || currentAudioUrl) && (
            <button
              type="button"
              onClick={() => setShowSaveSection((prev) => !prev)}
              className={`min-h-[46px] px-4 rounded-xl font-semibold text-xs border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                showSaveSection
                  ? 'bg-[#a6e3a1] text-[#11111b] border-[#a6e3a1]'
                  : 'bg-[#181825] text-[#a6e3a1] border-[#313244] hover:border-[#a6e3a1]/60'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
          )}
        </div>

        {/* Liens contextuels discrets (sans encombrer la vue) */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#313244] text-xs">
          <button
            type="button"
            onClick={onOpenMixerPage}
            className="min-h-[36px] text-[#f9e2af] hover:underline flex items-center gap-1.5 truncate cursor-pointer"
          >
            <Music className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {activeBackingTrackTitle ? `Fond actif : ${activeBackingTrackTitle}` : 'Ajouter un fond sonore'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSettingsPage}
            className="min-h-[36px] text-[#a6adc8] hover:text-[#cdd6f4] flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Réglages voix</span>
          </button>
        </div>

        {statusMsg && <div className="text-xs text-[#a6adc8] text-center">{statusMsg}</div>}
      </div>

      {/* Tiroir d'enregistrement (sur demande uniquement) */}
      {showSaveSection && (
        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#a6e3a1]">Enregistrer dans la Bibliothèque</span>
            <button
              type="button"
              onClick={() => setShowSaveSection(false)}
              className="text-xs text-[#a6adc8] hover:text-white cursor-pointer"
            >
              Fermer
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder="Nom de la piste"
              className="min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-xs"
            />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-xs"
            >
              {libraryKeys.map((proj) => (
                <option key={proj} value={proj}>
                  {proj}
                </option>
              ))}
              <option value="__NEW__">+ Nouveau projet...</option>
            </select>
          </div>
          {selectedProject === '__NEW__' && (
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Nom du nouveau projet..."
              className="w-full min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-xs"
            />
          )}
          <button
            type="button"
            onClick={onConfirmSave}
            className="w-full min-h-[44px] rounded-xl bg-[#a6e3a1] text-[#11111b] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Confirmer l'enregistrement</span>
          </button>
        </div>
      )}

      {/* Lecteur & Outils secondaires repliables après génération */}
      {currentAudioUrl && (
        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 space-y-3">
          <audio
            ref={audioRef}
            controls
            className={`w-full ${themeMode === 'ridialart' ? 'accent-[#fbbf24]' : 'accent-[#89b4fa]'}`}
            src={currentAudioUrl}
            onPlay={() => setIsAudioPlaying(true)}
            onPause={() => setIsAudioPlaying(false)}
            onEnded={() => setIsAudioPlaying(false)}
          />

          {themeMode === 'ridialart' && (
            <PlasticSynesthesiaCanvas
              audioElement={audioRef.current}
              audioUrl={currentAudioUrl}
              isPlaying={isAudioPlaying}
              themeMode={themeMode}
              title={saveTitle || 'Voix_VoxArt'}
            />
          )}

          {/* Boutons accordéon compacts */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOpenDrawer((prev) => (prev === 'trim' ? 'none' : 'trim'))}
              className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                openDrawer === 'trim'
                  ? 'bg-[#313244] border-[#89b4fa] text-[#89b4fa]'
                  : 'bg-[#181825] border-[#313244] text-[#cdd6f4]'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Découper</span>
              {openDrawer === 'trim' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setOpenDrawer((prev) => (prev === 'export' ? 'none' : 'export'))}
              className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                openDrawer === 'export'
                  ? 'bg-[#313244] border-[#89b4fa] text-[#89b4fa]'
                  : 'bg-[#181825] border-[#313244] text-[#cdd6f4]'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Exporter / Partager</span>
              {openDrawer === 'export' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {openDrawer === 'trim' && (
            <div className="p-3 rounded-xl bg-[#181825] border border-[#313244] space-y-2.5">
              <div className="flex items-center justify-between text-xs text-[#a6adc8] tabular-nums">
                <span>Sélection : {formatTimeDisplay(startTime)} — {formatTimeDisplay(endTime)}</span>
                <span>Durée : {formatTimeDisplay(audioDuration)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-[#a6adc8] mb-1">Début</span>
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
                  <span className="block text-[11px] text-[#a6adc8] mb-1">Fin</span>
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
                onClick={onPlayTrimmed}
                className="w-full min-h-[40px] rounded-lg bg-[#313244] text-[#89b4fa] text-xs font-semibold cursor-pointer"
              >
                Écouter la sélection
              </button>
            </div>
          )}

          {openDrawer === 'export' && (
            <div className="p-3 rounded-xl bg-[#181825] border border-[#313244] space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onDownloadAudio('mp3')}
                  className="min-h-[44px] rounded-xl bg-[#89b4fa] text-[#11111b] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Audio MP3</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDownloadAudio('wav')}
                  className="min-h-[44px] rounded-xl bg-[#313244] text-[#cdd6f4] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Audio WAV</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onDownloadZipPack}
                className="w-full min-h-[44px] rounded-xl bg-[#313244] text-[#f9e2af] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Pack Multipiste (ZIP + SRT)</span>
              </button>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onShareSocial('whatsapp')}
                  className="min-h-[40px] rounded-lg bg-[#313244] text-[#cdd6f4] text-xs font-medium cursor-pointer"
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => onShareSocial('telegram')}
                  className="min-h-[40px] rounded-lg bg-[#313244] text-[#cdd6f4] text-xs font-medium cursor-pointer"
                >
                  Telegram
                </button>
                <button
                  type="button"
                  onClick={() => onShareSocial('native')}
                  className="min-h-[40px] rounded-lg bg-[#313244] text-[#cdd6f4] text-xs font-medium cursor-pointer"
                >
                  Partager
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
