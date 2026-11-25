import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Disc,
  Download,
  FileText,
  Film,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Music,
  Package,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Share2,
  Sliders,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { exportAudioDataAsWav } from '../utils/audioExport';

export interface LibraryAudioItem {
  id: number;
  name: string;
  data: string;
}

export interface LibraryTextItem {
  id: number;
  name: string;
  content: string;
}

export interface LibraryVideoItem {
  id: number;
  name: string;
  data: string;
}

export interface LibraryProjectData {
  audios: LibraryAudioItem[];
  texts: LibraryTextItem[];
  videos?: LibraryVideoItem[];
  category?: string;
  folderPath?: string;
  createdAt?: string;
  updatedAt?: string;
}

type MediaCategoryTab = 'audios' | 'texts' | 'videos';

interface LibraryHubViewProps {
  library: Record<string, LibraryProjectData>;
  newProjectName: string;
  onNewProjectNameChange: (val: string) => void;
  onCreateProject: () => void;
  onRenameProject: (oldName: string) => void;
  onDeleteProject: (projectName: string) => void;
  onExportProjectJson: (projectName: string, data: LibraryProjectData) => void;
  onExportProjectZip: (projectName: string, data: LibraryProjectData) => void;
  onExportAllDatabaseJson: () => void;
  onImportProjectJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPlayAudio: (dataUrl: string) => Promise<void> | void;
  onRenameAudio: (projectName: string, idx: number) => void;
  onShareAudio: (dataUrl: string, filename: string) => Promise<void> | void;
  onExportAudioWav?: (dataUrl: string, filename: string) => Promise<void> | void;
  onDeleteAudio: (projectName: string, idx: number) => void;
  onEditRhythm: (itemName: string) => void;
  onUseAudioAsBackingTrack: (dataUrl: string, itemName: string) => void;
  onCopyScript: (content: string, id: number | string) => Promise<void> | void;
  onCopyAllScripts: (projectName: string, texts: LibraryTextItem[]) => Promise<void> | void;
  copiedScriptId: number | string | null;
  onUseScriptInStudio: (content: string) => void;
  onRenameText: (projectName: string, idx: number) => void;
  onShareText: (content: string, filename: string) => Promise<void> | void;
  onDeleteText: (projectName: string, idx: number) => void;
  onDownloadTextSrt: (content: string, filename: string) => void;
  onUploadVideo: (projectName: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onWatchVideo: (url: string, title: string) => void;
  onDeleteVideo: (projectName: string, idx: number) => void;
}

export const LibraryHubView: React.FC<LibraryHubViewProps> = ({
  library,
  newProjectName,
  onNewProjectNameChange,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onExportProjectJson,
  onExportProjectZip,
  onExportAllDatabaseJson,
  onImportProjectJson,
  onPlayAudio,
  onRenameAudio,
  onShareAudio,
  onExportAudioWav,
  onDeleteAudio,
  onEditRhythm,
  onUseAudioAsBackingTrack,
  onCopyScript,
  onCopyAllScripts,
  copiedScriptId,
  onUseScriptInStudio,
  onRenameText,
  onShareText,
  onDeleteText,
  onDownloadTextSrt,
  onUploadVideo,
  onWatchVideo,
  onDeleteVideo,
}) => {
  const projectNames = useMemo(() => Object.keys(library), [library]);

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaCategoryTab>('audios');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showBackupSheet, setShowBackupSheet] = useState(false);
  const [showProjectActionsSheet, setShowProjectActionsSheet] = useState(false);

  const [selectedAudioIdx, setSelectedAudioIdx] = useState<number | null>(null);
  const [selectedTextIdx, setSelectedTextIdx] = useState<number | null>(null);
  const [selectedVideoIdx, setSelectedVideoIdx] = useState<number | null>(null);
  const [exportingAudioId, setExportingAudioId] = useState<number | null>(null);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleExportAudioAsWav = async (audioId: number, dataUrl: string, filename: string) => {
    setExportingAudioId(audioId);
    try {
      if (onExportAudioWav) {
        await onExportAudioWav(dataUrl, filename);
      } else {
        await exportAudioDataAsWav(dataUrl, filename);
      }
    } finally {
      setExportingAudioId((prev) => (prev === audioId ? null : prev));
    }
  };

  const activeProjectData =
    selectedProject && library[selectedProject] ? library[selectedProject] : null;

  const openProject = (name: string) => {
    const data = library[name];
    setSelectedProject(name);
    if (data) {
      if (data.audios.length > 0) setActiveTab('audios');
      else if (data.texts.length > 0) setActiveTab('texts');
      else if ((data.videos?.length || 0) > 0) setActiveTab('videos');
      else setActiveTab('audios');
    }
  };

  // Vue Niveau 2 : Page dédiée d'un projet sélectionné
  if (selectedProject && activeProjectData) {
    const audioCount = activeProjectData.audios.length;
    const textCount = activeProjectData.texts.length;
    const videoCount = activeProjectData.videos?.length || 0;

    const activeAudio =
      selectedAudioIdx !== null ? activeProjectData.audios[selectedAudioIdx] : null;
    const activeText =
      selectedTextIdx !== null ? activeProjectData.texts[selectedTextIdx] : null;
    const activeVideo =
      selectedVideoIdx !== null && activeProjectData.videos
        ? activeProjectData.videos[selectedVideoIdx]
        : null;

    return (
      <div className="w-full max-w-4xl mx-auto space-y-4">
        {/* En-tête minimal du projet */}
        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedProject(null)}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#89b4fa]/60 text-xs font-semibold text-[#cdd6f4] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#89b4fa]" />
            <span>Projets</span>
          </button>

          <div className="min-w-0 flex-1 text-center">
            <h2 className="text-sm sm:text-base font-bold text-[#cdd6f4] truncate">
              {selectedProject}
            </h2>
            <p className="text-[11px] text-[#a6adc8] tabular-nums truncate">
              {audioCount} audio{audioCount > 1 ? 's' : ''} · {textCount} script
              {textCount > 1 ? 's' : ''} · {videoCount} vidéo{videoCount > 1 ? 's' : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowProjectActionsSheet(true)}
            aria-label="Actions du projet"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#181825] border border-[#313244] hover:border-[#89b4fa]/60 text-[#cdd6f4] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Sélecteur de sous-catégorie du projet */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-[#1e1e2e] border border-[#313244] rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('audios')}
            className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'audios'
                ? 'bg-[#89b4fa] text-[#11111b]'
                : 'text-[#a6adc8] hover:text-[#cdd6f4]'
            }`}
          >
            <Music className="w-4 h-4 shrink-0" />
            <span>Audios</span>
            <span className="tabular-nums opacity-80">({audioCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('texts')}
            className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'texts'
                ? 'bg-[#89b4fa] text-[#11111b]'
                : 'text-[#a6adc8] hover:text-[#cdd6f4]'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Scripts</span>
            <span className="tabular-nums opacity-80">({textCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('videos')}
            className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'videos'
                ? 'bg-[#89b4fa] text-[#11111b]'
                : 'text-[#a6adc8] hover:text-[#cdd6f4]'
            }`}
          >
            <Film className="w-4 h-4 shrink-0" />
            <span>Vidéos</span>
            <span className="tabular-nums opacity-80">({videoCount})</span>
          </button>
        </div>

        {/* Contenu de la sous-catégorie active */}
        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 space-y-3">
          {activeTab === 'audios' && (
            <>
              {audioCount === 0 ? (
                <div className="py-10 text-center text-xs text-[#a6adc8]">
                  Aucun fichier audio dans ce projet.
                </div>
              ) : (
                <div className="divide-y divide-[#313244]">
                  {activeProjectData.audios.map((item, idx) => {
                    const isRhythm = item.name.includes('[Rythme]');
                    return (
                      <div
                        key={item.id}
                        className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => onPlayAudio(item.data)}
                          className="flex-1 min-w-0 min-h-[44px] flex items-center gap-3 text-left group cursor-pointer"
                        >
                          <span
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isRhythm
                                ? 'bg-[#fbbf24]/15 text-[#fbbf24]'
                                : 'bg-[#89b4fa]/15 text-[#89b4fa]'
                            }`}
                          >
                            {isRhythm ? (
                              <Disc className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 fill-current" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-[#cdd6f4] group-hover:text-[#89b4fa] truncate transition-colors">
                              {item.name}
                            </span>
                            <span className="block text-[11px] text-[#a6adc8]">
                              {isRhythm ? 'Rythme · Toucher pour écouter' : 'Audio · Toucher pour écouter'}
                            </span>
                          </span>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleExportAudioAsWav(item.id, item.data, item.name)}
                            disabled={exportingAudioId === item.id}
                            aria-label={`Exporter ${item.name} en WAV`}
                            title="Exporter en WAV"
                            className="min-h-[44px] px-2.5 sm:px-3 rounded-xl bg-[#181825] border border-[#a6e3a1]/35 hover:border-[#a6e3a1] hover:bg-[#a6e3a1]/15 text-[#a6e3a1] text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 transition-colors"
                          >
                            {exportingAudioId === item.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                            ) : (
                              <Download className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span className="whitespace-nowrap">Exporter WAV</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedAudioIdx(idx)}
                            aria-label={`Options pour ${item.name}`}
                            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#181825] border border-[#313244] hover:border-[#89b4fa]/60 text-[#a6adc8] hover:text-[#cdd6f4] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'texts' && (
            <>
              {textCount > 1 && (
                <div className="flex justify-end pb-1">
                  <button
                    type="button"
                    onClick={() => onCopyAllScripts(selectedProject, activeProjectData.texts)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                      copiedScriptId === `section-${selectedProject}`
                        ? 'bg-[#a6e3a1] text-[#11111b] border-[#a6e3a1]'
                        : 'bg-[#181825] text-[#89b4fa] border-[#313244] hover:border-[#89b4fa]/60'
                    }`}
                  >
                    {copiedScriptId === `section-${selectedProject}` ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Tout copié</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Tout copier</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {textCount === 0 ? (
                <div className="py-10 text-center text-xs text-[#a6adc8]">
                  Aucun script ou sous-titre dans ce projet.
                </div>
              ) : (
                <div className="divide-y divide-[#313244]">
                  {activeProjectData.texts.map((item, idx) => {
                    const cleanExcerpt =
                      (item.content.includes('----------------------------------------\n\n')
                        ? item.content.split('----------------------------------------\n\n')[1]
                        : item.content) || item.content;
                    const preview = cleanExcerpt.trim();

                    return (
                      <div
                        key={item.id}
                        className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => onCopyScript(item.content, item.id)}
                          className="flex-1 min-w-0 min-h-[48px] flex items-center gap-3 text-left group cursor-pointer"
                        >
                          <span
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              copiedScriptId === item.id
                                ? 'bg-[#a6e3a1]/20 text-[#a6e3a1]'
                                : 'bg-[#cba6f7]/15 text-[#cba6f7]'
                            }`}
                          >
                            {copiedScriptId === item.id ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-[#cdd6f4] group-hover:text-[#89b4fa] truncate transition-colors">
                              {item.name}
                            </span>
                            <span className="block text-[11px] text-[#a6adc8] truncate">
                              {copiedScriptId === item.id
                                ? 'Copié dans le presse-papier'
                                : preview || 'Toucher pour copier'}
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedTextIdx(idx)}
                          aria-label={`Options pour ${item.name}`}
                          className="min-h-[44px] min-w-[44px] rounded-xl bg-[#181825] border border-[#313244] hover:border-[#89b4fa]/60 text-[#a6adc8] hover:text-[#cdd6f4] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'videos' && (
            <>
              <div className="flex items-center justify-between gap-2 pb-1">
                <span className="text-xs text-[#a6adc8]">Format vertical 9:16 (Veo / Flow)</span>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Importer</span>
                </button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/*"
                  onChange={(e) => {
                    onUploadVideo(selectedProject, e);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>

              {videoCount === 0 ? (
                <div className="py-10 text-center text-xs text-[#a6adc8]">
                  Aucune vidéo importée dans ce projet.
                </div>
              ) : (
                <div className="divide-y divide-[#313244]">
                  {activeProjectData.videos?.map((vid, idx) => (
                    <div
                      key={vid.id}
                      className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => onWatchVideo(vid.data, vid.name)}
                        className="flex-1 min-w-0 min-h-[44px] flex items-center gap-3 text-left group cursor-pointer"
                      >
                        <span className="w-9 h-9 rounded-xl bg-[#f38ba8]/15 text-[#f38ba8] flex items-center justify-center shrink-0">
                          <Play className="w-4 h-4 fill-current" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-[#cdd6f4] group-hover:text-[#89b4fa] truncate transition-colors">
                            {vid.name}
                          </span>
                          <span className="block text-[11px] text-[#a6adc8]">
                            Vidéo 9:16 · Toucher pour lire
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedVideoIdx(idx)}
                        aria-label={`Options pour ${vid.name}`}
                        className="min-h-[44px] min-w-[44px] rounded-xl bg-[#181825] border border-[#313244] hover:border-[#89b4fa]/60 text-[#a6adc8] hover:text-[#cdd6f4] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Tiroir Actions du Projet */}
        {showProjectActionsSheet && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowProjectActionsSheet(false)}
          >
            <div
              className="w-full sm:max-w-sm bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-[#45475a] rounded-full mx-auto sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#cdd6f4] truncate">{selectedProject}</h3>
                <button
                  type="button"
                  onClick={() => setShowProjectActionsSheet(false)}
                  className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectActionsSheet(false);
                    onRenameProject(selectedProject);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#89b4fa]/60 flex items-center gap-3 text-sm font-medium text-[#cdd6f4] cursor-pointer"
                >
                  <Pencil className="w-4 h-4 text-[#89b4fa]" />
                  <span>Renommer le projet</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProjectActionsSheet(false);
                    onExportProjectZip(selectedProject, activeProjectData);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#89b4fa]/60 flex items-center gap-3 text-sm font-medium text-[#cdd6f4] cursor-pointer"
                >
                  <Package className="w-4 h-4 text-[#89b4fa]" />
                  <span>Exporter en archive ZIP</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProjectActionsSheet(false);
                    onExportProjectJson(selectedProject, activeProjectData);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#89b4fa]/60 flex items-center gap-3 text-sm font-medium text-[#cdd6f4] cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#f9e2af]" />
                  <span>Partager le projet (JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const target = selectedProject;
                    setShowProjectActionsSheet(false);
                    onDeleteProject(target);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 flex items-center gap-3 text-sm font-medium text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer le projet</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tiroir Actions Audio */}
        {activeAudio && selectedAudioIdx !== null && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setSelectedAudioIdx(null)}
          >
            <div
              className="w-full sm:max-w-sm bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-[#45475a] rounded-full mx-auto sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#cdd6f4] truncate">{activeAudio.name}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedAudioIdx(null)}
                  className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAudioIdx(null);
                    onPlayAudio(activeAudio.data);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#89b4fa] text-[#11111b] flex items-center gap-3 text-sm font-bold cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Écouter dans le studio</span>
                </button>

                {activeAudio.name.includes('[Rythme]') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAudioIdx(null);
                        onEditRhythm(activeAudio.name);
                      }}
                      className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#fbbf24]/60 flex items-center gap-3 text-sm font-medium text-[#fbbf24] cursor-pointer"
                    >
                      <Sliders className="w-4 h-4" />
                      <span>Éditer la partition</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAudioIdx(null);
                        onUseAudioAsBackingTrack(activeAudio.data, activeAudio.name);
                      }}
                      className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#fbbf24]/60 flex items-center gap-3 text-sm font-medium text-[#fab387] cursor-pointer"
                    >
                      <Music className="w-4 h-4" />
                      <span>Utiliser comme fond sonore</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const idx = selectedAudioIdx;
                    setSelectedAudioIdx(null);
                    onRenameAudio(selectedProject, idx);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] flex items-center gap-3 text-sm font-medium text-[#cdd6f4] cursor-pointer"
                >
                  <Pencil className="w-4 h-4 text-[#89b4fa]" />
                  <span>Renommer</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAudioIdx(null);
                    onShareAudio(activeAudio.data, activeAudio.name);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] flex items-center gap-3 text-sm font-medium text-[#cdd6f4] cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#f9e2af]" />
                  <span>Partager</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetAudio = activeAudio;
                    setSelectedAudioIdx(null);
                    handleExportAudioAsWav(targetAudio.id, targetAudio.data, targetAudio.name);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#a6e3a1]/60 flex items-center gap-3 text-sm font-medium text-[#a6e3a1] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Exporter WAV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const idx = selectedAudioIdx;
                    setSelectedAudioIdx(null);
                    onDeleteAudio(selectedProject, idx);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-sm font-medium text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tiroir Actions Script */}
        {activeText && selectedTextIdx !== null && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setSelectedTextIdx(null)}
          >
            <div
              className="w-full sm:max-w-sm bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-[#45475a] rounded-full mx-auto sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#cdd6f4] truncate">{activeText.name}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedTextIdx(null)}
                  className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTextIdx(null);
                    onUseScriptInStudio(activeText.content);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#89b4fa] text-[#11111b] flex items-center gap-3 text-sm font-bold cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Ouvrir dans le studio vocal</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCopyScript(activeText.content, activeText.id);
                    setSelectedTextIdx(null);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] flex items-center gap-3 text-sm font-medium text-[#cdd6f4] cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-[#89b4fa]" />
                  <span>Copier le texte</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const idx = selectedTextIdx;
                    setSelectedTextIdx(null);
                    onRenameText(selectedProject, idx);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] flex items-center gap-3 text-sm font-medium text-[#cdd6f4] cursor-pointer"
                >
                  <Pencil className="w-4 h-4 text-[#89b4fa]" />
                  <span>Renommer</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedTextIdx(null);
                    onShareText(activeText.content, activeText.name);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] flex items-center gap-3 text-sm font-medium text-[#cdd6f4] cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-[#f9e2af]" />
                  <span>Partager</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([activeText.content], {
                        type: 'text/plain;charset=utf-8',
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${activeText.name}.txt`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 5000);
                      setSelectedTextIdx(null);
                    }}
                    className="min-h-[48px] px-3 rounded-xl bg-[#181825] border border-[#313244] flex items-center justify-center gap-2 text-xs font-semibold text-[#89b4fa] cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>TXT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDownloadTextSrt(activeText.content, activeText.name);
                      setSelectedTextIdx(null);
                    }}
                    className="min-h-[48px] px-3 rounded-xl bg-[#181825] border border-[#313244] flex items-center justify-center gap-2 text-xs font-semibold text-[#fab387] cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>SRT</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const idx = selectedTextIdx;
                    setSelectedTextIdx(null);
                    onDeleteText(selectedProject, idx);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-sm font-medium text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tiroir Actions Vidéo */}
        {activeVideo && selectedVideoIdx !== null && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setSelectedVideoIdx(null)}
          >
            <div
              className="w-full sm:max-w-sm bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-[#45475a] rounded-full mx-auto sm:hidden" />
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#cdd6f4] truncate">{activeVideo.name}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedVideoIdx(null)}
                  className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVideoIdx(null);
                    onWatchVideo(activeVideo.data, activeVideo.name);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#89b4fa] text-[#11111b] flex items-center gap-3 text-sm font-bold cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Lire en format 9:16</span>
                </button>

                <a
                  href={activeVideo.data}
                  download={`${activeVideo.name}.mp4`}
                  onClick={() => setSelectedVideoIdx(null)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] flex items-center gap-3 text-sm font-medium text-[#a6e3a1]"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger (.mp4)</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    const idx = selectedVideoIdx;
                    setSelectedVideoIdx(null);
                    onDeleteVideo(selectedProject, idx);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 text-sm font-medium text-red-400 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vue Niveau 1 : Grille Hub des Projets
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Barre d'actions épurée (2 boutons max) */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowCreateSheet(true)}
          className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Nouveau projet</span>
        </button>

        <button
          type="button"
          onClick={() => setShowBackupSheet(true)}
          className="min-h-[48px] px-4 py-2.5 rounded-xl bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 text-[#cdd6f4] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Upload className="w-4 h-4 text-[#a6adc8]" />
          <span>Sauvegarde</span>
        </button>
      </div>

      {/* Grille des projets (format cohérent avec HomeHubView) */}
      {projectNames.length === 0 ? (
        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-8 text-center space-y-2">
          <Folder className="w-8 h-8 text-[#6c7086] mx-auto" />
          <p className="text-sm font-medium text-[#cdd6f4]">Aucun projet enregistré</p>
          <p className="text-xs text-[#a6adc8]">
            Créez votre premier projet ou enregistrez une piste depuis le studio.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projectNames.map((proj) => {
            const pData = library[proj];
            const audioCount = pData.audios.length;
            const textCount = pData.texts.length;
            const videoCount = pData.videos?.length || 0;

            return (
              <button
                key={proj}
                type="button"
                onClick={() => openProject(proj)}
                className="group text-left p-4 rounded-2xl bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 active:scale-[0.98] transition-all flex items-center justify-between gap-3 min-h-[84px] cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#89b4fa]/15 text-[#89b4fa] flex items-center justify-center shrink-0">
                    <Folder className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#cdd6f4] truncate">{proj}</div>
                    <div className="text-xs text-[#a6adc8] tabular-nums truncate mt-0.5">
                      {audioCount} audio{audioCount > 1 ? 's' : ''} · {textCount} script
                      {textCount > 1 ? 's' : ''} · {videoCount} vidéo{videoCount > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#6c7086] group-hover:text-[#cdd6f4] transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* Tiroir Création de projet */}
      {showCreateSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowCreateSheet(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#45475a] rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#cdd6f4]">Nouveau projet</h3>
              <button
                type="button"
                onClick={() => setShowCreateSheet(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={newProjectName}
              onChange={(e) => onNewProjectNameChange(e.target.value)}
              placeholder="Nom du projet..."
              autoFocus
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#181825] border border-[#313244] focus:border-[#89b4fa] focus:outline-none text-sm text-[#cdd6f4]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = newProjectName.trim();
                  onCreateProject();
                  if (trimmed) setShowCreateSheet(false);
                }
              }}
            />

            <button
              type="button"
              onClick={() => {
                const trimmed = newProjectName.trim();
                onCreateProject();
                if (trimmed) setShowCreateSheet(false);
              }}
              className="w-full min-h-[48px] rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-sm cursor-pointer transition-colors"
            >
              Créer le projet
            </button>
          </div>
        </div>
      )}

      {/* Tiroir Sauvegarde / Import JSON */}
      {showBackupSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowBackupSheet(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#45475a] rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#cdd6f4]">Sauvegarde & Import</h3>
              <button
                type="button"
                onClick={() => setShowBackupSheet(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowBackupSheet(false);
                onExportAllDatabaseJson();
              }}
              className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#a6e3a1]/60 flex items-center gap-3 text-sm font-medium text-[#a6e3a1] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exporter toute la base (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => jsonInputRef.current?.click()}
              className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#fab387]/60 flex items-center gap-3 text-sm font-medium text-[#fab387] cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Importer un projet (.json)</span>
            </button>

            <input
              ref={jsonInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                onImportProjectJson(e);
                e.target.value = '';
                setShowBackupSheet(false);
              }}
              className="hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
};
