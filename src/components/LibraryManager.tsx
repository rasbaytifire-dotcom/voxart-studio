/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Folder, FolderPlus, FolderTree, ChevronRight, ChevronDown, 
  Calendar, Tag, Search, ArrowLeft, Move, Plus, Trash2, Edit3, 
  Share2, Package, Save, Upload, Copy, Check, Volume2, Download, 
  Mic, Play, Disc, Filter, ArrowUpDown, X, Sparkles, FileText, CheckCircle2
} from 'lucide-react';
import JSZip from 'jszip';
import { copyTextToClipboard } from '../utils/clipboard';

export interface SavedAudioItem {
  id: number;
  name: string;
  data: string;
}

export interface SavedTextItem {
  id: number;
  name: string;
  content: string;
}

export interface SavedVideoItem {
  id: number;
  name: string;
  data: string;
}

export interface ProjectData {
  audios: SavedAudioItem[];
  texts: SavedTextItem[];
  videos?: SavedVideoItem[];
  category?: string;
  folderPath?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface LibraryManagerProps {
  library: Record<string, ProjectData>;
  saveLibraryToStorage: (lib: Record<string, ProjectData>) => void;
  setCurrentView: (view: any) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  openConfirmDialog: (title: string, msg: string, onConfirm: () => void) => void;
  openPromptDialog: (title: string, defaultValue: string, onConfirm: (val: string) => void) => void;
  onPlayAudio: (data: string) => void;
  onUseScriptInStudio: (content: string) => void;
  onSetActiveBackingTrack: (track: { url: string; title: string }) => void;
  onExportZip: (projName: string, projData: ProjectData) => void;
  onExportJson: (projName: string, projData: ProjectData) => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setStudioComposition?: (comp: any) => void;
  setActiveVideoModal?: (v: { title: string; url: string } | null) => void;
  generateSRT: (text: string) => string;
}

export const PRESET_CATEGORIES = [
  { id: "Contes", label: "📖 Contes & Récits Traditionnels", color: "#89b4fa" },
  { id: "Musique", label: "🥁 Musique & Polyrythmies", color: "#f9e2af" },
  { id: "Poesie", label: "🎙️ Poésie, Slam & Taasu", color: "#cba6f7" },
  { id: "Cinema", label: "🎬 Cinéma & Voix-Off", color: "#fab387" },
  { id: "Education", label: "🏛️ Éducation & Patrimoine", color: "#a6e3a1" },
  { id: "General", label: "📁 Général & Projets Libres", color: "#a6adc8" }
];

export const LibraryManager: React.FC<LibraryManagerProps> = ({
  library,
  saveLibraryToStorage,
  setCurrentView,
  showToast,
  openConfirmDialog,
  openPromptDialog,
  onPlayAudio,
  onUseScriptInStudio,
  onSetActiveBackingTrack,
  onExportZip,
  onExportJson,
  onImportJson,
  setStudioComposition,
  setActiveVideoModal,
  generateSRT
}) => {
  // Navigation & View Mode: 'folders' (nested), 'categories' (category grouped), 'dates' (chronological)
  const [viewMode, setViewMode] = useState<'folders' | 'categories' | 'dates'>('folders');
  
  // Current directory path in nested folder explorer (e.g. "", "Contes", "Contes/Saison 1")
  const [currentFolder, setCurrentFolder] = useState<string>('');
  
  // Custom user-defined empty folders
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('voxart_custom_folders') || '[]');
    } catch {
      return [];
    }
  });

  // Search & Filters for large volumes
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterType, setSelectedFilterType] = useState<'all' | 'audios' | 'texts' | 'videos'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'az' | 'count'>('recent');

  // Expanded folders in categories and dates view
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // UI state for creating new project or folder
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState('Contes');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderNameInput, setNewFolderNameInput] = useState('');

  // Moving a project to another folder
  const [projectToMove, setProjectToMove] = useState<string | null>(null);
  const [targetDestinationFolder, setTargetDestinationFolder] = useState<string>('');

  const [copiedScriptId, setCopiedScriptId] = useState<string | number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveCustomFolders = (folders: string[]) => {
    setCustomFolders(folders);
    localStorage.setItem('voxart_custom_folders', JSON.stringify(folders));
  };

  // Helper: Normalize folder path (no leading/trailing slashes)
  const normalizePath = (p: string) => p.replace(/^\/+|\/+$/g, '').trim();

  // All known folders (derived from projects + custom folders)
  const allFolderPaths = useMemo(() => {
    const set = new Set<string>();
    customFolders.forEach(f => {
      const norm = normalizePath(f);
      if (norm) set.add(norm);
    });

    Object.values(library).forEach(p => {
      const f = normalizePath(p.folderPath || '');
      if (f) {
        set.add(f);
        // Add parent paths as well
        const segments = f.split('/');
        for (let i = 1; i < segments.length; i++) {
          set.add(segments.slice(0, i).join('/'));
        }
      }
    });

    return Array.from(set).sort();
  }, [library, customFolders]);

  // Statistics for a given folder path (including its children)
  const getFolderStats = (folderPath: string) => {
    const norm = normalizePath(folderPath);
    let projectCount = 0;
    let audioCount = 0;
    let textCount = 0;
    let videoCount = 0;

    Object.entries(library).forEach(([_, p]) => {
      const pFolder = normalizePath(p.folderPath || '');
      const isInside = norm === '' || pFolder === norm || pFolder.startsWith(`${norm}/`);
      if (isInside) {
        projectCount++;
        audioCount += p.audios?.length || 0;
        textCount += p.texts?.length || 0;
        videoCount += p.videos?.length || 0;
      }
    });

    return { projectCount, audioCount, textCount, videoCount };
  };

  // Direct subfolders in current folder
  const currentSubFolders = useMemo(() => {
    const currentNorm = normalizePath(currentFolder);
    const subSet = new Set<string>();

    allFolderPaths.forEach(path => {
      if (currentNorm === '') {
        const topSeg = path.split('/')[0];
        if (topSeg) subSet.add(topSeg);
      } else if (path.startsWith(`${currentNorm}/`)) {
        const rest = path.slice(currentNorm.length + 1);
        const nextSeg = rest.split('/')[0];
        if (nextSeg) subSet.add(nextSeg);
      }
    });

    return Array.from(subSet).sort();
  }, [allFolderPaths, currentFolder]);

  // Global library totals
  const globalTotals = useMemo(() => {
    let audios = 0;
    let texts = 0;
    let videos = 0;
    const projectKeys = Object.keys(library);
    projectKeys.forEach(k => {
      audios += library[k].audios?.length || 0;
      texts += library[k].texts?.length || 0;
      videos += library[k].videos?.length || 0;
    });
    return {
      projects: projectKeys.length,
      audios,
      texts,
      videos,
      folders: allFolderPaths.length
    };
  }, [library, allFolderPaths]);

  // Breadcrumbs for folder navigation
  const breadcrumbs = useMemo(() => {
    const norm = normalizePath(currentFolder);
    if (!norm) return [{ name: "Bibliothèque", path: "" }];

    const parts = norm.split('/');
    const crumbs = [{ name: "Bibliothèque", path: "" }];
    let acc = '';
    parts.forEach(part => {
      acc = acc ? `${acc}/${part}` : part;
      crumbs.push({ name: part, path: acc });
    });
    return crumbs;
  }, [currentFolder]);

  // Filtered and sorted projects
  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const currentNorm = normalizePath(currentFolder);

    return Object.entries(library).filter(([name, p]) => {
      // 1. In 'folders' view, check if belongs directly to current folder
      if (viewMode === 'folders' && !query) {
        const pFolder = normalizePath(p.folderPath || '');
        if (pFolder !== currentNorm) return false;
      }

      // 2. Type filter
      if (selectedFilterType === 'audios' && (!p.audios || p.audios.length === 0)) return false;
      if (selectedFilterType === 'texts' && (!p.texts || p.texts.length === 0)) return false;
      if (selectedFilterType === 'videos' && (!p.videos || p.videos.length === 0)) return false;

      // 3. Search query
      if (query) {
        const matchName = name.toLowerCase().includes(query);
        const matchCategory = (p.category || '').toLowerCase().includes(query);
        const matchFolder = (p.folderPath || '').toLowerCase().includes(query);
        const matchAudios = p.audios?.some(a => a.name.toLowerCase().includes(query));
        const matchTexts = p.texts?.some(t => t.name.toLowerCase().includes(query) || t.content.toLowerCase().includes(query));
        const matchVideos = p.videos?.some(v => v.name.toLowerCase().includes(query));
        if (!matchName && !matchCategory && !matchFolder && !matchAudios && !matchTexts && !matchVideos) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const [nameA, pA] = a;
      const [nameB, pB] = b;

      if (sortBy === 'az') return nameA.localeCompare(nameB);
      if (sortBy === 'count') {
        const countA = (pA.audios?.length || 0) + (pA.texts?.length || 0) + (pA.videos?.length || 0);
        const countB = (pB.audios?.length || 0) + (pB.texts?.length || 0) + (pB.videos?.length || 0);
        return countB - countA;
      }
      if (sortBy === 'oldest') {
        const dateA = new Date(pA.createdAt || 0).getTime();
        const dateB = new Date(pB.createdAt || 0).getTime();
        return dateA - dateB;
      }
      // 'recent' by default
      const dateA = new Date(pA.updatedAt || pA.createdAt || 0).getTime();
      const dateB = new Date(pB.updatedAt || pB.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [library, viewMode, currentFolder, searchQuery, selectedFilterType, sortBy]);

  // Groupings for Category view
  const categorizedProjects = useMemo(() => {
    const groups: Record<string, Array<[string, ProjectData]>> = {};
    PRESET_CATEGORIES.forEach(c => { groups[c.id] = []; });
    groups['Autres'] = [];

    filteredProjects.forEach(([name, p]) => {
      const cat = p.category || 'General';
      if (groups[cat]) {
        groups[cat].push([name, p]);
      } else {
        const found = PRESET_CATEGORIES.find(c => c.id === cat || c.label.includes(cat));
        if (found) {
          groups[found.id].push([name, p]);
        } else {
          groups['Autres'].push([name, p]);
        }
      }
    });

    return groups;
  }, [filteredProjects]);

  // Groupings for Date view (Year > Month)
  const dateGroupedProjects = useMemo(() => {
    const groups: Record<string, Array<[string, ProjectData]>> = {};

    filteredProjects.forEach(([name, p]) => {
      const dateStr = p.createdAt || p.updatedAt || new Date().toISOString();
      const d = new Date(dateStr);
      const year = isNaN(d.getFullYear()) ? '2026' : String(d.getFullYear());
      const monthNames = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
      ];
      const month = isNaN(d.getMonth()) ? 'Octobre' : monthNames[d.getMonth()];
      const key = `${year} • ${month}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push([name, p]);
    });

    return groups;
  }, [filteredProjects]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    if (viewMode === 'categories') {
      PRESET_CATEGORIES.forEach(c => { next[c.id] = true; });
      next['Autres'] = true;
    } else if (viewMode === 'dates') {
      Object.keys(dateGroupedProjects).forEach(k => { next[k] = true; });
    }
    setExpandedSections(next);
  };

  const collapseAll = () => {
    setExpandedSections({});
  };

  // Create new project in current folder
  const handleCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) {
      showToast("Veuillez saisir un nom pour le projet.", "error");
      return;
    }
    if (library[name]) {
      showToast("Un projet portant ce nom existe déjà.", "error");
      return;
    }

    const updated = {
      ...library,
      [name]: {
        audios: [],
        texts: [],
        videos: [],
        category: newProjectCategory,
        folderPath: normalizePath(currentFolder) || 'Racine',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    saveLibraryToStorage(updated);
    setNewProjectName('');
    showToast(`Projet "${name}" créé dans "${currentFolder || 'Racine'}" !`, "success");
  };

  // Create new nested folder
  const handleCreateFolder = () => {
    const folderName = normalizePath(newFolderNameInput);
    if (!folderName) {
      showToast("Veuillez saisir un nom de dossier.", "error");
      return;
    }

    const fullPath = currentFolder 
      ? `${normalizePath(currentFolder)}/${folderName}`
      : folderName;

    if (allFolderPaths.includes(fullPath)) {
      showToast("Ce dossier existe déjà.", "info");
      setShowNewFolderModal(false);
      return;
    }

    const nextCustom = Array.from(new Set([...customFolders, fullPath]));
    saveCustomFolders(nextCustom);
    setNewFolderNameInput('');
    setShowNewFolderModal(false);
    showToast(`Dossier "${fullPath}" créé avec succès !`, "success");
  };

  // Move a project to destination folder
  const handleMoveProject = (projectName: string, destFolder: string) => {
    const updated = { ...library };
    if (!updated[projectName]) return;

    const normDest = normalizePath(destFolder) || 'Racine';
    updated[projectName] = {
      ...updated[projectName],
      folderPath: normDest,
      updatedAt: new Date().toISOString()
    };

    saveLibraryToStorage(updated);
    setProjectToMove(null);
    showToast(`Projet "${projectName}" déplacé dans "${normDest}".`, "success");
  };

  // Change project category
  const handleChangeCategory = (projectName: string, newCat: string) => {
    const updated = { ...library };
    if (!updated[projectName]) return;

    updated[projectName] = {
      ...updated[projectName],
      category: newCat,
      updatedAt: new Date().toISOString()
    };

    saveLibraryToStorage(updated);
    showToast(`Catégorie mise à jour pour "${projectName}".`, "success");
  };

  // Rename a folder
  const handleRenameFolder = (oldPath: string) => {
    openPromptDialog("Renommer le dossier", oldPath, (newPathRaw) => {
      const newPath = normalizePath(newPathRaw);
      if (!newPath || newPath === oldPath) return;

      const updated = { ...library };
      let affected = 0;

      // Update all projects inside this folder path
      Object.keys(updated).forEach(proj => {
        const pFolder = normalizePath(updated[proj].folderPath || '');
        if (pFolder === oldPath) {
          updated[proj].folderPath = newPath;
          affected++;
        } else if (pFolder.startsWith(`${oldPath}/`)) {
          updated[proj].folderPath = `${newPath}/${pFolder.slice(oldPath.length + 1)}`;
          affected++;
        }
      });

      // Update custom folders
      const updatedCustom = customFolders.map(f => {
        const normF = normalizePath(f);
        if (normF === oldPath) return newPath;
        if (normF.startsWith(`${oldPath}/`)) return `${newPath}/${normF.slice(oldPath.length + 1)}`;
        return f;
      });

      saveCustomFolders(updatedCustom);
      saveLibraryToStorage(updated);

      if (currentFolder === oldPath) {
        setCurrentFolder(newPath);
      }

      showToast(`Dossier renommé (${affected} projet(s) mis à jour).`, "success");
    });
  };

  // Delete folder
  const handleDeleteFolder = (folderToDelete: string) => {
    const stats = getFolderStats(folderToDelete);
    openConfirmDialog(
      `Supprimer le dossier "${folderToDelete}" ?`,
      `Ce dossier contient ${stats.projectCount} projet(s) et ${stats.audioCount + stats.textCount} fichier(s). Les projets seront replacés à la racine de la bibliothèque.`,
      () => {
        const updated = { ...library };
        Object.keys(updated).forEach(proj => {
          const pFolder = normalizePath(updated[proj].folderPath || '');
          if (pFolder === folderToDelete || pFolder.startsWith(`${folderToDelete}/`)) {
            updated[proj].folderPath = 'Racine';
          }
        });

        const nextCustom = customFolders.filter(f => {
          const norm = normalizePath(f);
          return norm !== folderToDelete && !norm.startsWith(`${folderToDelete}/`);
        });

        saveCustomFolders(nextCustom);
        saveLibraryToStorage(updated);

        if (currentFolder === folderToDelete || currentFolder.startsWith(`${folderToDelete}/`)) {
          setCurrentFolder('');
        }

        showToast(`Dossier "${folderToDelete}" supprimé. Les projets ont été déplacés à la racine.`, "info");
      }
    );
  };

  // Export entire folder as ZIP
  const handleExportFolderAsZip = async (folderPath: string) => {
    try {
      const norm = normalizePath(folderPath) || 'Bibliotheque';
      const zip = new JSZip();
      let hasFiles = false;

      Object.entries(library).forEach(([projName, pData]) => {
        const pFolder = normalizePath(pData.folderPath || '');
        const isInside = norm === 'Bibliotheque' || pFolder === norm || pFolder.startsWith(`${norm}/`);

        if (isInside) {
          hasFiles = true;
          const relativeFolder = pFolder.replace(norm, '').replace(/^\/+/, '');
          const projDir = zip.folder(relativeFolder ? `${relativeFolder}/${projName}` : projName) || zip;

          pData.audios?.forEach(audio => {
            const base64Content = audio.data.split(',')[1] || audio.data;
            projDir.file(`${audio.name}.wav`, base64Content, { base64: true });
          });

          pData.texts?.forEach(txt => {
            projDir.file(`${txt.name}.txt`, txt.content);
            const srt = generateSRT(txt.content);
            projDir.file(`${txt.name.replace('_script', '')}.srt`, srt);
          });
        }
      });

      if (!hasFiles) {
        showToast("Aucun fichier à exporter dans ce dossier.", "info");
        return;
      }

      showToast("Génération de l'archive ZIP du dossier...", "info");
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${norm.replace(/[^a-z0-9_-]/gi, '_')}_archive_complete.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      showToast("Archive ZIP téléchargée !", "success");
    } catch (e) {
      console.error(e);
      showToast("Erreur lors de l'export ZIP du dossier.", "error");
    }
  };

  return (
    <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 sm:p-6 shadow-2xl space-y-5 animate-fadeIn">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#313244] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#89b4fa]/20 to-[#cba6f7]/20 border border-[#89b4fa]/30 flex items-center justify-center text-[#89b4fa]">
              <FolderTree className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-[#cdd6f4]">Bibliothèque & Projets</h2>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#a6adc8] mt-1 flex-wrap">
            <span>{globalTotals.projects} projets</span>
            <span>•</span>
            <span>{globalTotals.audios} audios</span>
            <span>•</span>
            <span>{globalTotals.texts} scripts</span>
            <span>•</span>
            <span>{globalTotals.folders} dossiers</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => setCurrentView('home')}
            className="py-2 px-3.5 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] font-bold text-xs border border-[#89b4fa]/40 transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Studio Vocal</span>
          </button>

          <button
            onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(library, null, 2));
              const downloadAnchor = document.createElement('a');
              downloadAnchor.setAttribute("href", dataStr);
              downloadAnchor.setAttribute("download", `voxart_database_backup_${new Date().toISOString().slice(0,10)}.json`);
              document.body.appendChild(downloadAnchor);
              downloadAnchor.click();
              downloadAnchor.remove();
              showToast("Sauvegarde complète téléchargée !", "success");
            }}
            className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm"
            title="Sauvegarde intégrale (JSON)"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sauvegarder JSON</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={onImportJson}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="py-2 px-3 rounded-xl bg-[#fab387] hover:bg-[#f5c2e7] text-[#11111b] font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm"
            title="Importer une base de données JSON"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Importer</span>
          </button>
        </div>
      </div>

      {/* View Mode Switcher (Folders / Categories / Dates) */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-[#181825] p-1.5 rounded-xl border border-[#313244]">
        <div className="flex items-center gap-1 flex-1 sm:flex-initial">
          <button
            type="button"
            onClick={() => setViewMode('folders')}
            className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              viewMode === 'folders'
                ? 'bg-[#89b4fa] text-[#11111b] font-bold shadow-md'
                : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]/50'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Dossiers Imbriqués</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('categories')}
            className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              viewMode === 'categories'
                ? 'bg-[#89b4fa] text-[#11111b] font-bold shadow-md'
                : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]/50'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Par Catégories</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('dates')}
            className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              viewMode === 'dates'
                ? 'bg-[#89b4fa] text-[#11111b] font-bold shadow-md'
                : 'text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Par Dates</span>
          </button>
        </div>

        {viewMode !== 'folders' && (
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={expandAll}
              className="px-2 py-1 rounded bg-[#313244] hover:bg-[#45475a] text-[#89b4fa]"
            >
              Déplier tout
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-1 rounded bg-[#313244] hover:bg-[#45475a] text-[#a6adc8]"
            >
              Replier
            </button>
          </div>
        )}
      </div>

      {/* Search & Volume Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-[#a6adc8] absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un projet, audio, script..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#181825] border border-[#313244] text-[#cdd6f4] text-xs focus:outline-none focus:border-[#89b4fa]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-[#a6adc8] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="sm:col-span-3 flex items-center gap-1 bg-[#181825] border border-[#313244] rounded-xl px-2">
          <Filter className="w-3.5 h-3.5 text-[#89b4fa] shrink-0" />
          <select
            value={selectedFilterType}
            onChange={(e: any) => setSelectedFilterType(e.target.value)}
            className="w-full bg-transparent text-xs text-[#cdd6f4] py-2 focus:outline-none"
          >
            <option value="all">Tous les formats</option>
            <option value="audios">🎵 Audios uniquement</option>
            <option value="texts">📜 Textes / Scripts</option>
            <option value="videos">🎬 Vidéos (9:16)</option>
          </select>
        </div>

        <div className="sm:col-span-3 flex items-center gap-1 bg-[#181825] border border-[#313244] rounded-xl px-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#89b4fa] shrink-0" />
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="w-full bg-transparent text-xs text-[#cdd6f4] py-2 focus:outline-none"
          >
            <option value="recent">Plus récent</option>
            <option value="oldest">Plus ancien</option>
            <option value="az">Alphabétique (A-Z)</option>
            <option value="count">Nombre de fichiers</option>
          </select>
        </div>
      </div>

      {/* FOLDERS VIEW (Nested Explorer) */}
      {viewMode === 'folders' && (
        <div className="space-y-4">
          {/* Breadcrumb Navigation Bar */}
          <div className="flex items-center justify-between gap-2 p-2.5 bg-[#181825] rounded-xl border border-[#313244] text-xs overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 text-[#a6adc8] truncate">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.path}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#45475a] shrink-0" />}
                  <button
                    onClick={() => setCurrentFolder(crumb.path)}
                    className={`font-semibold hover:underline flex items-center gap-1 shrink-0 ${
                      idx === breadcrumbs.length - 1 ? 'text-[#89b4fa] font-bold' : 'text-[#cdd6f4]'
                    }`}
                  >
                    {idx === 0 ? <Folder className="w-3.5 h-3.5 text-[#89b4fa]" /> : null}
                    <span>{crumb.name}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {currentFolder && (
                <button
                  onClick={() => {
                    const norm = normalizePath(currentFolder);
                    const segments = norm.split('/');
                    segments.pop();
                    setCurrentFolder(segments.join('/'));
                  }}
                  className="px-2 py-1 rounded bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] font-semibold text-[11px] flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Dossier parent</span>
                </button>
              )}

              <button
                onClick={() => setShowNewFolderModal(true)}
                className="px-2.5 py-1 rounded bg-[#89b4fa]/20 hover:bg-[#89b4fa]/30 text-[#89b4fa] font-semibold text-[11px] flex items-center gap-1 border border-[#89b4fa]/30"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ Dossier</span>
              </button>

              <button
                onClick={() => handleExportFolderAsZip(currentFolder)}
                className="px-2.5 py-1 rounded bg-[#a6e3a1]/20 hover:bg-[#a6e3a1]/30 text-[#a6e3a1] font-semibold text-[11px] flex items-center gap-1 border border-[#a6e3a1]/30"
                title="Exporter tous les projets de ce dossier en ZIP"
              >
                <Package className="w-3.5 h-3.5" />
                <span>ZIP Dossier</span>
              </button>
            </div>
          </div>

          {/* Subfolders Grid */}
          {currentSubFolders.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#a6adc8] flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-[#89b4fa]" />
                <span>Sous-dossiers :</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {currentSubFolders.map(subName => {
                  const subFullPath = currentFolder ? `${normalizePath(currentFolder)}/${subName}` : subName;
                  const stats = getFolderStats(subFullPath);

                  return (
                    <div
                      key={subName}
                      className="group p-3 rounded-xl bg-[#181825] hover:bg-[#232433] border border-[#313244] hover:border-[#89b4fa]/50 transition-all flex flex-col justify-between cursor-pointer shadow-sm"
                      onClick={() => setCurrentFolder(subFullPath)}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-2 truncate">
                          <Folder className="w-4 h-4 text-[#89b4fa] shrink-0 fill-[#89b4fa]/20" />
                          <span className="font-bold text-xs text-[#cdd6f4] truncate group-hover:text-[#89b4fa]">
                            {subName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleRenameFolder(subFullPath)}
                            className="p-1 rounded text-[#a6adc8] hover:text-[#89b4fa]"
                            title="Renommer"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteFolder(subFullPath)}
                            className="p-1 rounded text-[#a6adc8] hover:text-red-400"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[10px] text-[#6c7086] mt-2 flex items-center justify-between">
                        <span>{stats.projectCount} projet(s)</span>
                        <span>{stats.audioCount + stats.textCount} fichier(s)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* New Project Quick Creator inside current folder */}
          <div className="bg-[#181825] p-3 rounded-xl border border-[#313244] flex flex-col sm:flex-row items-center gap-2">
            <span className="text-xs font-semibold text-[#89b4fa] shrink-0 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau projet dans "{currentFolder || 'Racine'}" :</span>
            </span>

            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Nom du projet..."
              className="flex-1 w-full p-2 rounded-lg bg-[#1e1e2e] border border-[#45475a] text-[#cdd6f4] text-xs focus:outline-none focus:border-[#89b4fa]"
            />

            <select
              value={newProjectCategory}
              onChange={(e) => setNewProjectCategory(e.target.value)}
              className="w-full sm:w-auto p-2 rounded-lg bg-[#1e1e2e] border border-[#45475a] text-[#cdd6f4] text-xs focus:outline-none"
            >
              {PRESET_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

            <button
              onClick={handleCreateProject}
              className="w-full sm:w-auto px-4 py-2 bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs rounded-lg transition-all shadow-sm shrink-0"
            >
              + Créer
            </button>
          </div>

          {/* Projects inside current folder */}
          <div className="space-y-3">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-10 bg-[#181825]/50 border border-dashed border-[#313244] rounded-xl text-xs text-[#a6adc8]">
                {searchQuery 
                  ? "Aucun projet ou fichier ne correspond à votre recherche."
                  : `Aucun projet directement dans ce dossier. Créez-en un ci-dessus ou déplacez des projets ici.`}
              </div>
            ) : (
              filteredProjects.map(([proj, pData]) => renderProjectCard(proj, pData))
            )}
          </div>
        </div>
      )}

      {/* CATEGORIES VIEW */}
      {viewMode === 'categories' && (
        <div className="space-y-4">
          {PRESET_CATEGORIES.map(cat => {
            const list = categorizedProjects[cat.id] || [];
            const isExpanded = expandedSections[cat.id] ?? true;

            return (
              <div key={cat.id} className="bg-[#181825] border border-[#313244] rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(cat.id)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#232433] transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-[#89b4fa]" /> : <ChevronRight className="w-4 h-4 text-[#a6adc8]" />}
                    <span className="font-bold text-xs sm:text-sm text-[#cdd6f4]">{cat.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#313244] text-[#89b4fa] font-mono">
                      {list.length} projet(s)
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-3 border-t border-[#313244] space-y-3 bg-[#1e1e2e]/60">
                    {list.length === 0 ? (
                      <div className="text-[11px] text-[#6c7086] italic py-2 pl-4">
                        Aucun projet dans cette catégorie.
                      </div>
                    ) : (
                      list.map(([proj, pData]) => renderProjectCard(proj, pData))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DATES VIEW */}
      {viewMode === 'dates' && (
        <div className="space-y-4">
          {Object.keys(dateGroupedProjects).length === 0 ? (
            <div className="text-center py-10 bg-[#181825]/50 border border-dashed border-[#313244] rounded-xl text-xs text-[#a6adc8]">
              Aucun projet trouvé.
            </div>
          ) : (
            Object.entries(dateGroupedProjects).map(([dateKey, list]) => {
              const isExpanded = expandedSections[dateKey] ?? true;

              return (
                <div key={dateKey} className="bg-[#181825] border border-[#313244] rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(dateKey)}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#232433] transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-[#fab387]" /> : <ChevronRight className="w-4 h-4 text-[#a6adc8]" />}
                      <Calendar className="w-4 h-4 text-[#fab387]" />
                      <span className="font-bold text-xs sm:text-sm text-[#cdd6f4]">{dateKey}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#313244] text-[#fab387] font-mono">
                        {list.length} projet(s)
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-3 border-t border-[#313244] space-y-3 bg-[#1e1e2e]/60">
                      {list.map(([proj, pData]) => renderProjectCard(proj, pData))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL: Create New Folder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1e1e2e] border border-[#45475a] rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#313244] pb-2.5">
              <h3 className="text-sm font-bold text-[#cdd6f4] flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#89b4fa]" />
                <span>Nouveau Dossier</span>
              </h3>
              <button onClick={() => setShowNewFolderModal(false)} className="text-[#a6adc8] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-[#a6adc8]">Emplacement parent :</label>
              <div className="p-2 rounded-lg bg-[#181825] border border-[#313244] text-[#89b4fa] font-mono text-[11px]">
                📁 {currentFolder || 'Racine'}
              </div>

              <label className="block text-[#a6adc8] pt-1">Nom du nouveau sous-dossier :</label>
              <input
                type="text"
                autoFocus
                value={newFolderNameInput}
                onChange={(e) => setNewFolderNameInput(e.target.value)}
                placeholder="Ex: Récits 2026, Saison 1, Bogolan..."
                className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] focus:outline-none focus:border-[#89b4fa]"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#313244]">
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="px-3 py-1.5 rounded-lg bg-[#313244] text-[#a6adc8] hover:text-white text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-3.5 py-1.5 rounded-lg bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs shadow-md"
              >
                Créer le dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Move Project to Folder */}
      {projectToMove && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1e1e2e] border border-[#45475a] rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#313244] pb-2.5">
              <h3 className="text-sm font-bold text-[#cdd6f4] flex items-center gap-2">
                <Move className="w-4 h-4 text-[#89b4fa]" />
                <span>Déplacer le projet</span>
              </h3>
              <button onClick={() => setProjectToMove(null)} className="text-[#a6adc8] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#a6adc8]">
                Déplacer le projet <strong className="text-[#89b4fa]">"{projectToMove}"</strong> vers :
              </p>

              <div>
                <label className="block text-[#a6adc8] mb-1">Choisir un dossier existant :</label>
                <select
                  value={targetDestinationFolder}
                  onChange={(e) => setTargetDestinationFolder(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[#313244] border border-[#45475a] text-[#cdd6f4]"
                >
                  <option value="Racine">📁 Racine (aucun sous-dossier)</option>
                  {allFolderPaths.map(f => (
                    <option key={f} value={f}>📁 {f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#a6adc8] mb-1">Ou saisir un nouveau chemin de dossier :</label>
                <input
                  type="text"
                  value={targetDestinationFolder === 'Racine' ? '' : targetDestinationFolder}
                  onChange={(e) => setTargetDestinationFolder(e.target.value)}
                  placeholder="Ex: Contes/Afrofuturisme..."
                  className="w-full p-2 rounded-lg bg-[#313244] border border-[#45475a] text-[#cdd6f4]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#313244]">
              <button
                onClick={() => setProjectToMove(null)}
                className="px-3 py-1.5 rounded-lg bg-[#313244] text-[#a6adc8] hover:text-white text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                onClick={() => handleMoveProject(projectToMove, targetDestinationFolder)}
                className="px-3.5 py-1.5 rounded-lg bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs shadow-md"
              >
                Confirmer le déplacement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper renderer for a single Project Card
  function renderProjectCard(proj: string, pData: ProjectData) {
    const currentCatObj = PRESET_CATEGORIES.find(c => c.id === pData.category) || PRESET_CATEGORIES[0];
    const folderDisplay = normalizePath(pData.folderPath || '') || 'Racine';

    return (
      <div key={proj} className="bg-[#181825] p-4 rounded-xl border border-[#313244] hover:border-[#45475a] space-y-3 shadow-md transition-all">
        {/* Project Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#313244]/80 pb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base">📁</span>
            <h3 className="text-sm font-bold text-[#89b4fa] truncate">{proj}</h3>

            {/* Folder badge */}
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#313244] text-[#cdd6f4] flex items-center gap-1 font-mono">
              <Folder className="w-3 h-3 text-[#89b4fa]" />
              <span>{folderDisplay}</span>
            </span>

            {/* Category Selector Badge */}
            <select
              value={pData.category || 'General'}
              onChange={(e) => handleChangeCategory(proj, e.target.value)}
              className="text-[10px] px-2 py-0.5 rounded-md bg-[#313244] text-[#a6adc8] hover:text-[#cdd6f4] border border-[#45475a] focus:outline-none cursor-pointer"
              title="Changer la catégorie"
            >
              {PRESET_CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Move to folder */}
            <button
              onClick={() => {
                setProjectToMove(proj);
                setTargetDestinationFolder(pData.folderPath || 'Racine');
              }}
              className="px-2 py-1 rounded bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] text-xs font-semibold flex items-center gap-1"
              title="Déplacer vers un autre dossier"
            >
              <Move className="w-3 h-3" />
              <span>Dossier</span>
            </button>

            {/* Rename */}
            <button
              onClick={() => {
                openPromptDialog("Renommer le projet", proj, (newName) => {
                  if (newName && newName.trim() && newName.trim() !== proj) {
                    const trimmed = newName.trim();
                    if (library[trimmed]) {
                      showToast("Un projet portant ce nom existe déjà.", "error");
                      return;
                    }
                    const updated = { ...library };
                    updated[trimmed] = updated[proj];
                    delete updated[proj];
                    saveLibraryToStorage(updated);
                    showToast(`Projet renommé en "${trimmed}".`, "success");
                  }
                });
              }}
              className="px-2 py-1 rounded bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] text-xs font-semibold"
              title="Renommer le projet"
            >
              ✏️
            </button>

            {/* Export JSON */}
            <button
              onClick={() => onExportJson(proj, pData)}
              className="px-2.5 py-1 rounded bg-[#f9e2af] text-[#11111b] text-xs font-bold hover:opacity-90 flex items-center gap-1"
              title="Partager en JSON"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Partager</span>
            </button>

            {/* Export ZIP */}
            <button
              onClick={() => onExportZip(proj, pData)}
              className="px-2.5 py-1 rounded bg-[#89b4fa] text-[#11111b] text-xs font-bold hover:bg-[#b4befe] flex items-center gap-1 shadow-sm"
              title="Télécharger l'archive ZIP complète"
            >
              <Package className="w-3.5 h-3.5" />
              <span>ZIP</span>
            </button>

            {/* Delete Project */}
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
              className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Audios List */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-[#f9e2af] flex items-center gap-1">
            <span>🎵 Fichiers Audio (.mp3 / .wav) :</span>
            <span className="text-[10px] text-[#a6adc8] font-mono">({pData.audios?.length || 0})</span>
          </div>

          {!pData.audios || pData.audios.length === 0 ? (
            <div className="text-[11px] text-[#6c7086] pl-2">Aucun audio enregistré.</div>
          ) : (
            <div className="space-y-1">
              {pData.audios.map((item, idx) => {
                const isRhythm = item.name.includes('[Rythme]');
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs gap-2 ${
                      isRhythm ? 'bg-[#241307] border border-[#fbbf24]/30' : 'bg-[#1e1e2e]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate max-w-[140px] sm:max-w-[280px]">
                      <span>{isRhythm ? '🥁' : '🎧'}</span>
                      <span className={`truncate font-medium ${isRhythm ? 'text-[#fbbf24]' : 'text-[#cdd6f4]'}`}>
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {isRhythm && setStudioComposition && (
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const savedComps = JSON.parse(localStorage.getItem('voxart_saved_compositions') || '{}');
                              if (savedComps[item.name]) {
                                setStudioComposition(savedComps[item.name]);
                              }
                            } catch {}
                            setCurrentView('rhythm_studio');
                          }}
                          className="px-2 py-0.5 bg-[#d97706]/25 hover:bg-[#d97706]/45 text-[#fbbf24] border border-[#fbbf24]/40 rounded text-[10px] font-bold"
                          title="Éditer la partition"
                        >
                          🎛️ Éditer
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onSetActiveBackingTrack({ url: item.data, title: item.name });
                          showToast(`"${item.name}" chargée comme accompagnement sonore !`, "success");
                          setCurrentView('home');
                        }}
                        className="px-2 py-0.5 bg-[#ea580c]/25 hover:bg-[#ea580c]/45 text-[#fdba74] border border-[#ea580c]/40 rounded text-[10px] font-bold"
                        title="Utiliser en boucle de fond dans le studio vocal"
                      >
                        🎙️ Fond
                      </button>

                      <button
                        onClick={() => onPlayAudio(item.data)}
                        className="px-2 py-0.5 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Écouter</span>
                      </button>

                      <a
                        href={item.data}
                        download={`${item.name}.wav`}
                        className="p-1 rounded bg-[#313244] hover:bg-[#45475a] text-[#a6e3a1]"
                        title="Télécharger"
                      >
                        <Download className="w-3 h-3" />
                      </a>

                      <button
                        onClick={() => {
                          const updated = { ...library };
                          updated[proj].audios.splice(idx, 1);
                          saveLibraryToStorage(updated);
                          showToast("Audio supprimé.", "info");
                        }}
                        className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Texts List */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between pb-0.5">
            <div className="text-xs font-semibold text-[#f9e2af] flex items-center gap-1">
              <span>📜 Scripts & Textes (.txt / .srt) :</span>
              <span className="text-[10px] text-[#a6adc8] font-mono">({pData.texts?.length || 0})</span>
            </div>

            {pData.texts?.length > 0 && (
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
                  const ok = await copyTextToClipboard(allText);
                  if (ok) {
                    setCopiedScriptId(`all_${proj}`);
                    showToast("Tous les scripts du projet ont été copiés !", "success");
                    setTimeout(() => setCopiedScriptId(null), 2000);
                  }
                }}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] flex items-center gap-1"
              >
                {copiedScriptId === `all_${proj}` ? <Check className="w-3 h-3 text-[#a6e3a1]" /> : <Copy className="w-3 h-3" />}
                <span>Copier tous les textes</span>
              </button>
            )}
          </div>

          {!pData.texts || pData.texts.length === 0 ? (
            <div className="text-[11px] text-[#6c7086] pl-2">Aucun texte enregistré.</div>
          ) : (
            <div className="space-y-1.5">
              {pData.texts.map((item, idx) => {
                const cleanExcerpt = (
                  item.content.includes('----------------------------------------\n\n')
                    ? item.content.split('----------------------------------------\n\n')[1]
                    : item.content
                ) || item.content;
                const preview = cleanExcerpt.trim().slice(0, 85) + (cleanExcerpt.trim().length > 85 ? '...' : '');

                return (
                  <div key={item.id} className="bg-[#1e1e2e] p-2 rounded-lg text-xs space-y-1 border border-[#313244]">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-[#cdd6f4] truncate max-w-[150px] sm:max-w-[260px]">
                        📄 {item.name}
                      </span>

                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={async () => {
                            const ok = await copyTextToClipboard(item.content);
                            if (ok) {
                              setCopiedScriptId(item.id);
                              showToast("Texte copié !", "success");
                              setTimeout(() => setCopiedScriptId(null), 2000);
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] text-[10px] font-semibold flex items-center gap-1"
                          title="Copier le script"
                        >
                          {copiedScriptId === item.id ? <Check className="w-3 h-3 text-[#a6e3a1]" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedScriptId === item.id ? 'Copié' : 'Copier'}</span>
                        </button>

                        <button
                          onClick={() => onUseScriptInStudio(item.content)}
                          className="px-2 py-0.5 bg-[#89b4fa]/20 hover:bg-[#89b4fa]/35 text-[#89b4fa] font-semibold rounded text-[10px] flex items-center gap-1"
                          title="Ouvrir dans le Studio Vocal"
                        >
                          <Mic className="w-3 h-3" />
                          <span>🎙️ Studio</span>
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
                          className="px-1.5 py-0.5 bg-[#313244] hover:bg-[#45475a] text-[#89b4fa] rounded text-[10px]"
                          title="Télécharger TXT"
                        >
                          TXT
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
                          className="px-1.5 py-0.5 bg-[#313244] hover:bg-[#45475a] text-[#fab387] rounded text-[10px]"
                          title="Télécharger Sous-titres SRT"
                        >
                          SRT
                        </button>

                        <button
                          onClick={() => {
                            const updated = { ...library };
                            updated[proj].texts.splice(idx, 1);
                            saveLibraryToStorage(updated);
                            showToast("Texte supprimé.", "info");
                          }}
                          className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {preview && (
                      <div className="text-[11px] text-[#a6adc8] italic line-clamp-1 bg-[#181825] px-2 py-0.5 rounded">
                        "{preview}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Videos List (9:16 animations & Google Flow prompts) */}
        {pData.videos && pData.videos.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-xs font-semibold text-[#89b4fa] flex items-center gap-1">
              <span>🎬 Prompts & Médias Vidéo (9:16) :</span>
              <span className="text-[10px] text-[#a6adc8] font-mono">({pData.videos.length})</span>
            </div>

            <div className="space-y-1">
              {pData.videos.map((vid, vIdx) => (
                <div key={vid.id} className="bg-[#1e1e2e] p-2 rounded-lg text-xs flex items-center justify-between gap-2 border border-[#313244]">
                  <span className="truncate font-semibold text-[#cdd6f4]">🎬 {vid.name}</span>
                  <div className="flex items-center gap-1">
                    {setActiveVideoModal && vid.data.startsWith('data:video') && (
                      <button
                        onClick={() => setActiveVideoModal({ title: vid.name, url: vid.data })}
                        className="px-2 py-0.5 bg-[#89b4fa]/20 text-[#89b4fa] font-bold rounded text-[10px]"
                      >
                        📱 Voir 9:16
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const ok = await copyTextToClipboard(vid.data);
                        if (ok) showToast("Prompt copié !", "success");
                      }}
                      className="px-2 py-0.5 bg-[#313244] text-[#a6adc8] hover:text-white rounded text-[10px]"
                    >
                      Copier
                    </button>
                    <button
                      onClick={() => {
                        const updated = { ...library };
                        updated[proj].videos?.splice(vIdx, 1);
                        saveLibraryToStorage(updated);
                        showToast("Vidéo supprimée.", "info");
                      }}
                      className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
};
