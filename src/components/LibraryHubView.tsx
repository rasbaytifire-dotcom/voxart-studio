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
  Search,
  Share2,
  Sliders,
  Subtitles,
  Mic,
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

type MediaCategoryTab = 'all' | 'audios' | 'texts' | 'videos';

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
  onOpenProjectVideoStudio?: (options: {
    projectName: string;
    videoItem?: LibraryVideoItem | null;
    textItem?: LibraryTextItem | null;
    audioItem?: LibraryAudioItem | null;
    focusSection?: 'subtitles' | 'voiceover' | 'mic';
  }) => void;
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
  onOpenProjectVideoStudio,
}) => {
  const projectNames = useMemo(() => Object.keys(library), [library]);

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaCategoryTab>('all');
  const [hubSearchQuery, setHubSearchQuery] = useState('');
  const [hubCategoryFilter, setHubCategoryFilter] = useState<MediaCategoryTab>('all');
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showBackupSheet, setShowBackupSheet] = useState(false);
  const [showProjectActionsSheet, setShowProjectActionsSheet] = useState(false);

  const [selectedAudioIdx, setSelectedAudioIdx] = useState<number | null>(null);
  const [selectedTextIdx, setSelectedTextIdx] = useState<number | null>(null);
  const [selectedVideoIdx, setSelectedVideoIdx] = useState<number | null>(null);
  const [exportingAudioId, setExportingAudioId] = useState<number | null>(null);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const categoryTotals = useMemo(() => {
    let withAudios = 0;
    let withTexts = 0;
    let withVideos = 0;
    projectNames.forEach((proj) => {
      const p = library[proj];
      if ((p?.audios?.length || 0) > 0) withAudios++;
      if ((p?.texts?.length || 0) > 0) withTexts++;
      if ((p?.videos?.length || 0) > 0) withVideos++;
    });
    return {
      all: projectNames.length,
      audios: withAudios,
      texts: withTexts,
      videos: withVideos,
    };
  }, [library, projectNames]);

  const filteredHubProjects = useMemo(() => {
    const q = hubSearchQuery.trim().toLowerCase();
    return projectNames
      .map((proj) => {
        const pData = library[proj];
        const audios = pData?.audios || [];
        const texts = pData?.texts || [];
        const videos = pData?.videos || [];

        if (hubCategoryFilter === 'audios' && audios.length === 0) return null;
        if (hubCategoryFilter === 'texts' && texts.length === 0) return null;
        if (hubCategoryFilter === 'videos' && videos.length === 0) return null;

        if (!q) {
          return { proj, pData, matchCount: 0 };
        }

        const audioMatches = audios.filter((a) => a.name.toLowerCase().includes(q)).length;
        const textMatches = texts.filter(
          (t) => t.name.toLowerCase().includes(q) || t.content.toLowerCase().includes(q)
        ).length;
        const videoMatches = videos.filter((v) => v.name.toLowerCase().includes(q)).length;

        const projMetaMatch =
          proj.toLowerCase().includes(q) ||
          (pData?.category || '').toLowerCase().includes(q) ||
          (pData?.folderPath || '').toLowerCase().includes(q);

        const categoryItemMatches =
          hubCategoryFilter === 'audios'
            ? audioMatches
            : hubCategoryFilter === 'texts'
              ? textMatches
              : hubCategoryFilter === 'videos'
                ? videoMatches
                : audioMatches + textMatches + videoMatches;

        if (!projMetaMatch && categoryItemMatches === 0) return null;
        return { proj, pData, matchCount: categoryItemMatches };
      })
      .filter(
        (entry): entry is { proj: string; pData: LibraryProjectData; matchCount: number } =>
          entry !== null
      );
  }, [library, projectNames, hubSearchQuery, hubCategoryFilter]);

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
    setProjectSearchQuery(hubSearchQuery);
    if (hubCategoryFilter !== 'all') {
      setActiveTab(hubCategoryFilter);
    } else if (data) {
      if (data.audios.length > 0 || data.texts.length > 0 || (data.videos?.length || 0) > 0) {
        setActiveTab('all');
      } else {
        setActiveTab('audios');
      }
    }
  };

  // Vue Niveau 2 : Page dédiée d'un projet sélectionné
  if (selectedProject && activeProjectData) {
    const q = projectSearchQuery.trim().toLowerCase();
    const audioEntries = activeProjectData.audios
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => !q || item.name.toLowerCase().includes(q));
    const textEntries = activeProjectData.texts
      .map((item, idx) => ({ item, idx }))
      .filter(
        ({ item }) =>
          !q || item.name.toLowerCase().includes(q) || item.content.toLowerCase().includes(q)
      );
    const videoEntries = (activeProjectData.videos || [])
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => !q || item.name.toLowerCase().includes(q));

    const audioCount = audioEntries.length;
    const textCount = textEntries.length;
    const videoCount = videoEntries.length;
    const totalCount = audioCount + textCount + videoCount;

    const rawAudioTotal = activeProjectData.audios.length;
    const rawTextTotal = activeProjectData.texts.length;
    const rawVideoTotal = activeProjectData.videos?.length || 0;

    const activeAudio =
      selectedAudioIdx !== null ? activeProjectData.audios[selectedAudioIdx] : null;
    const activeText =
      selectedTextIdx !== null ? activeProjectData.texts[selectedTextIdx] : null;
    const activeVideo =
      selectedVideoIdx !== null && activeProjectData.videos
        ? activeProjectData.videos[selectedVideoIdx]
        : null;

    const showAudiosSection = activeTab === 'audios' || (activeTab === 'all' && (audioCount > 0 || !q));
    const showTextsSection = activeTab === 'texts' || (activeTab === 'all' && (textCount > 0 || !q));
    const showVideosSection = activeTab === 'videos' || (activeTab === 'all' && (videoCount > 0 || !q));

    return (
      <div className="w-full max-w-4xl mx-auto space-y-4">
        {/* En-tête minimal du projet */}
        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedProject(null);
              setProjectSearchQuery('');
            }}
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
              {rawAudioTotal} audio{rawAudioTotal > 1 ? 's' : ''} · {rawTextTotal} script
              {rawTextTotal > 1 ? 's' : ''} · {rawVideoTotal} vidéo{rawVideoTotal > 1 ? 's' : ''}
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

        {/* Barre Réglages Montage : Sous-titres & Voix Off / Micro */}
        {onOpenProjectVideoStudio && (
          <div className="bg-[#1e1e2e] border border-[#89b4fa]/35 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#cdd6f4] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#89b4fa]" />
                  <span>Réglages Montage du Projet : Voix Off & Sous-titres</span>
                </h3>
                <p className="text-[11px] text-[#a6adc8] mt-0.5">
                  Assemblez vos médias du projet : générez les sous-titres SRT, enregistrez votre voix au micro ou posez une voix off.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  onOpenProjectVideoStudio({
                    projectName: selectedProject,
                    videoItem: activeProjectData.videos?.[0] || null,
                    textItem: activeProjectData.texts?.[0] || null,
                    focusSection: 'subtitles',
                  })
                }
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Subtitles className="w-4 h-4 shrink-0" />
                <span>Générer / Éditer Sous-titres</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onOpenProjectVideoStudio({
                    projectName: selectedProject,
                    videoItem: activeProjectData.videos?.[0] || null,
                    textItem: activeProjectData.texts?.[0] || null,
                    focusSection: 'mic',
                  })
                }
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#181825] border border-[#f38ba8]/40 hover:border-[#f38ba8] text-[#f38ba8] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Mic className="w-4 h-4 shrink-0" />
                <span>Poser / Enregistrer Micro</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onOpenProjectVideoStudio({
                    projectName: selectedProject,
                    videoItem: activeProjectData.videos?.[0] || null,
                    textItem: activeProjectData.texts?.[0] || null,
                    audioItem: activeProjectData.audios?.[0] || null,
                    focusSection: 'voiceover',
                  })
                }
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#181825] border border-[#a6e3a1]/40 hover:border-[#a6e3a1] text-[#a6e3a1] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Film className="w-4 h-4 shrink-0" />
                <span>Studio Montage Vidéo</span>
              </button>
            </div>
          </div>
        )}

        {/* Recherche interne au projet */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#a6adc8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={projectSearchQuery}
            onChange={(e) => setProjectSearchQuery(e.target.value)}
            placeholder={`Rechercher dans "${selectedProject}" (audio, script, vidéo)...`}
            aria-label="Rechercher dans le projet"
            className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-xl bg-[#1e1e2e] border border-[#313244] focus:border-[#89b4fa] focus:outline-none text-xs sm:text-sm text-[#cdd6f4] placeholder:text-[#6c7086]"
          />
          {projectSearchQuery && (
            <button
              type="button"
              onClick={() => setProjectSearchQuery('')}
              aria-label="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-[#a6adc8] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sélecteur de catégorie du projet */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-[#1e1e2e] border border-[#313244] rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-[#89b4fa] text-[#11111b]'
                : 'text-[#a6adc8] hover:text-[#cdd6f4]'
            }`}
          >
            <span>Tous</span>
            <span className="tabular-nums opacity-80">({totalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audios')}
            className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'audios'
                ? 'bg-[#89b4fa] text-[#11111b]'
                : 'text-[#a6adc8] hover:text-[#cdd6f4]'
            }`}
          >
            <Music className="w-4 h-4 shrink-0" />
            <span>Audio</span>
            <span className="tabular-nums opacity-80">({audioCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('texts')}
            className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'texts'
                ? 'bg-[#89b4fa] text-[#11111b]'
                : 'text-[#a6adc8] hover:text-[#cdd6f4]'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Script</span>
            <span className="tabular-nums opacity-80">({textCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('videos')}
            className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'videos'
                ? 'bg-[#89b4fa] text-[#11111b]'
                : 'text-[#a6adc8] hover:text-[#cdd6f4]'
            }`}
          >
            <Film className="w-4 h-4 shrink-0" />
            <span>Vidéo</span>
            <span className="tabular-nums opacity-80">({videoCount})</span>
          </button>
        </div>

        {/* Contenu filtré du projet */}
        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 space-y-5">
          {activeTab === 'all' && totalCount === 0 && (
            <div className="py-10 text-center space-y-2 text-xs text-[#a6adc8]">
              <p>
                {q
                  ? `Aucun élément ne correspond à « ${projectSearchQuery.trim()} » dans ce projet.`
                  : 'Ce projet ne contient encore aucun média.'}
              </p>
              {q && (
                <button
                  type="button"
                  onClick={() => setProjectSearchQuery('')}
                  className="px-3 py-1.5 rounded-lg bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] font-semibold cursor-pointer"
                >
                  Effacer la recherche
                </button>
              )}
            </div>
          )}

          {showAudiosSection && (activeTab === 'audios' || audioCount > 0) && (
            <div className="space-y-2.5">
              {activeTab === 'all' && (
                <div className="flex items-center gap-2 text-xs font-semibold text-[#f9e2af]">
                  <Music className="w-3.5 h-3.5" />
                  <span>Audios ({audioCount})</span>
                </div>
              )}

              {audioCount === 0 ? (
                <div className="py-8 text-center text-xs text-[#a6adc8]">
                  {q
                    ? `Aucun fichier audio ne correspond à « ${projectSearchQuery.trim()} ».`
                    : 'Aucun fichier audio dans ce projet.'}
                </div>
              ) : (
                <div className="divide-y divide-[#313244]">
                  {audioEntries.map(({ item, idx }) => {
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
            </div>
          )}

          {showTextsSection && (activeTab === 'texts' || textCount > 0) && (
            <div className={`space-y-2.5 ${activeTab === 'all' && audioCount > 0 ? 'pt-3 border-t border-[#313244]' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                {activeTab === 'all' ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#cba6f7]">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Scripts ({textCount})</span>
                  </div>
                ) : (
                  <span />
                )}

                {textCount > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onCopyAllScripts(
                        selectedProject,
                        textEntries.map((entry) => entry.item)
                      )
                    }
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
                )}
              </div>

              {textCount === 0 ? (
                <div className="py-8 text-center text-xs text-[#a6adc8]">
                  {q
                    ? `Aucun script ne correspond à « ${projectSearchQuery.trim()} ».`
                    : 'Aucun script ou sous-titre dans ce projet.'}
                </div>
              ) : (
                <div className="divide-y divide-[#313244]">
                  {textEntries.map(({ item, idx }) => {
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
            </div>
          )}

          {showVideosSection && (activeTab === 'videos' || videoCount > 0) && (
            <div className={`space-y-2.5 ${activeTab === 'all' && (audioCount > 0 || textCount > 0) ? 'pt-3 border-t border-[#313244]' : ''}`}>
              <div className="flex items-center justify-between gap-2 pb-1">
                {activeTab === 'all' ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#f38ba8]">
                    <Film className="w-3.5 h-3.5" />
                    <span>Vidéos ({videoCount})</span>
                  </div>
                ) : (
                  <span className="text-xs text-[#a6adc8]">Format vertical 9:16 (Veo / Flow)</span>
                )}
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
                <div className="py-8 text-center text-xs text-[#a6adc8]">
                  {q
                    ? `Aucune vidéo ne correspond à « ${projectSearchQuery.trim()} ».`
                    : 'Aucune vidéo importée dans ce projet.'}
                </div>
              ) : (
                <div className="divide-y divide-[#313244]">
                  {videoEntries.map(({ item: vid, idx }) => (
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
            </div>
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

                {onOpenProjectVideoStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      const audioChoice = activeAudio;
                      setSelectedAudioIdx(null);
                      onOpenProjectVideoStudio({
                        projectName: selectedProject,
                        videoItem: activeProjectData.videos?.[0] || null,
                        audioItem: audioChoice,
                        focusSection: 'voiceover',
                      });
                    }}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#a6e3a1]/40 hover:border-[#a6e3a1] flex items-center gap-3 text-sm font-semibold text-[#a6e3a1] cursor-pointer"
                  >
                    <Film className="w-4 h-4" />
                    <span>Poser comme voix off vidéo</span>
                  </button>
                )}

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

                {onOpenProjectVideoStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      const textChoice = activeText;
                      setSelectedTextIdx(null);
                      onOpenProjectVideoStudio({
                        projectName: selectedProject,
                        videoItem: activeProjectData.videos?.[0] || null,
                        textItem: textChoice,
                        focusSection: 'subtitles',
                      });
                    }}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#cba6f7]/40 hover:border-[#cba6f7] flex items-center gap-3 text-sm font-semibold text-[#cba6f7] cursor-pointer"
                  >
                    <Subtitles className="w-4 h-4" />
                    <span>Générer sous-titres & Voix off</span>
                  </button>
                )}

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

                {onOpenProjectVideoStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      const vidChoice = activeVideo;
                      setSelectedVideoIdx(null);
                      onOpenProjectVideoStudio({
                        projectName: selectedProject,
                        videoItem: vidChoice,
                        textItem: activeProjectData.texts?.[0] || null,
                        focusSection: 'subtitles',
                      });
                    }}
                    className="w-full min-h-[48px] px-4 rounded-xl bg-[#181825] border border-[#f9e2af]/45 hover:border-[#f9e2af] flex items-center gap-3 text-sm font-semibold text-[#f9e2af] cursor-pointer"
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Réglages Voix off, Micro & Sous-titres</span>
                  </button>
                )}

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

      {/* Barre de recherche et filtres de catégorie */}
      {projectNames.length > 0 && (
        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-3 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-[#a6adc8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={hubSearchQuery}
              onChange={(e) => setHubSearchQuery(e.target.value)}
              placeholder="Rechercher un projet, audio, script ou vidéo..."
              aria-label="Rechercher dans la bibliothèque"
              className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-xl bg-[#181825] border border-[#313244] focus:border-[#89b4fa] focus:outline-none text-xs sm:text-sm text-[#cdd6f4] placeholder:text-[#6c7086]"
            />
            {hubSearchQuery && (
              <button
                type="button"
                onClick={() => setHubSearchQuery('')}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-[#a6adc8] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(
              [
                { id: 'all', label: 'Tous', count: categoryTotals.all, icon: null },
                { id: 'audios', label: 'Audio', count: categoryTotals.audios, icon: Music },
                { id: 'texts', label: 'Script', count: categoryTotals.texts, icon: FileText },
                { id: 'videos', label: 'Vidéo', count: categoryTotals.videos, icon: Film },
              ] as const
            ).map((cat) => {
              const Icon = cat.icon;
              const isSelected = hubCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setHubCategoryFilter(cat.id)}
                  className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap border ${
                    isSelected
                      ? 'bg-[#89b4fa] text-[#11111b] border-[#89b4fa]'
                      : 'bg-[#181825] text-[#a6adc8] border-[#313244] hover:text-[#cdd6f4] hover:border-[#45475a]'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                  <span>{cat.label}</span>
                  <span className="tabular-nums opacity-80">({cat.count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grille des projets (format cohérent avec HomeHubView) */}
      {projectNames.length === 0 ? (
        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-8 text-center space-y-2">
          <Folder className="w-8 h-8 text-[#6c7086] mx-auto" />
          <p className="text-sm font-medium text-[#cdd6f4]">Aucun projet enregistré</p>
          <p className="text-xs text-[#a6adc8]">
            Créez votre premier projet ou enregistrez une piste depuis le studio.
          </p>
        </div>
      ) : filteredHubProjects.length === 0 ? (
        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-8 text-center space-y-3">
          <Search className="w-8 h-8 text-[#6c7086] mx-auto" />
          <p className="text-sm font-medium text-[#cdd6f4]">Aucun résultat trouvé</p>
          <p className="text-xs text-[#a6adc8]">
            Essayez un autre mot-clé ou réinitialisez le filtre de catégorie.
          </p>
          <button
            type="button"
            onClick={() => {
              setHubSearchQuery('');
              setHubCategoryFilter('all');
            }}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] text-xs font-semibold cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredHubProjects.map(({ proj, pData, matchCount }) => {
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
                    {hubSearchQuery.trim() && matchCount > 0 && (
                      <div className="text-[11px] text-[#a6e3a1] font-medium tabular-nums mt-0.5">
                        {matchCount} correspondance{matchCount > 1 ? 's' : ''}
                      </div>
                    )}
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
