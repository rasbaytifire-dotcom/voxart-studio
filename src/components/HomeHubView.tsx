import React, { useState } from 'react';
import {
  Mic,
  Film,
  Music,
  Bot,
  Folder,
  Settings,
  Info,
  Layers,
  Subtitles,
  Disc,
  Sliders,
  Database,
  ChevronRight,
  X,
  ArrowRight,
  FileUp,
  Smartphone,
} from 'lucide-react';
import studioLogo from '../assets/images/voxart_logo_1791875178885.jpg';
import {
  AppRouteId,
  HUB_CATEGORIES,
  HubCategoryItem,
  SubCategoryItem,
} from '../types/navigation';
import { StudioThemeMode } from './ThemeModeSelector';

interface HomeHubViewProps {
  onNavigate: (route: AppRouteId) => void;
  themeMode: StudioThemeMode;
  projectCount: number;
  hasDraftText: boolean;
  activeBackingTrackTitle?: string | null;
  onOpenPhoneFilePicker?: () => void;
  canInstallPWA?: boolean;
  isPWAInstalled?: boolean;
  onInstallPWA?: () => void;
}

const CategoryIcon: React.FC<{ name: HubCategoryItem['iconName']; className?: string }> = ({
  name,
  className = 'w-5 h-5',
}) => {
  switch (name) {
    case 'mic':
      return <Mic className={className} />;
    case 'film':
      return <Film className={className} />;
    case 'music':
      return <Music className={className} />;
    case 'bot':
      return <Bot className={className} />;
    case 'folder':
      return <Folder className={className} />;
    case 'settings':
      return <Settings className={className} />;
    case 'info':
    default:
      return <Info className={className} />;
  }
};

const SubCategoryIcon: React.FC<{ name: SubCategoryItem['iconName']; className?: string }> = ({
  name,
  className = 'w-5 h-5',
}) => {
  switch (name) {
    case 'mic':
      return <Mic className={className} />;
    case 'layers':
      return <Layers className={className} />;
    case 'film':
      return <Film className={className} />;
    case 'subtitles':
      return <Subtitles className={className} />;
    case 'drum':
      return <Disc className={className} />;
    case 'sliders':
      return <Sliders className={className} />;
    case 'bot':
      return <Bot className={className} />;
    case 'database':
    default:
      return <Database className={className} />;
  }
};

export const HomeHubView: React.FC<HomeHubViewProps> = ({
  onNavigate,
  themeMode,
  projectCount,
  hasDraftText,
  activeBackingTrackTitle,
  onOpenPhoneFilePicker,
  canInstallPWA,
  onInstallPWA,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<HubCategoryItem | null>(null);

  const handleCategoryClick = (cat: HubCategoryItem) => {
    if (cat.directRoute) {
      onNavigate(cat.directRoute);
      return;
    }
    if (cat.subcategories && cat.subcategories.length > 0) {
      setSelectedCategory(cat);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col justify-between gap-4 py-1">
      {/* En-tête compact sans scroll */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={studioLogo}
            alt="Logo VoxArt Studio"
            referrerPolicy="no-referrer"
            className={`w-11 h-11 rounded-full object-cover shrink-0 border ${
              themeMode === 'ridialart' ? 'border-[#fbbf24]/70' : 'border-[#89b4fa]/70'
            }`}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#cdd6f4] tracking-tight truncate">
              VoxArt Studio
            </h1>
            <p className="text-xs text-[#a6adc8] truncate">
              Sélectionnez une catégorie pour ouvrir votre espace dédié
            </p>
          </div>
        </div>
      </div>

      {/* Accès rapide : Fichier du téléphone + reprise + installation PWA */}
      <div className="flex flex-col sm:flex-row gap-2">
        {onOpenPhoneFilePicker && (
          <button
            type="button"
            onClick={onOpenPhoneFilePicker}
            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1e1e2e] border border-[#89b4fa]/40 hover:border-[#89b4fa] flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
          >
            <span className="text-xs font-semibold text-[#cdd6f4] flex items-center gap-2 truncate">
              <FileUp className="w-4 h-4 text-[#89b4fa] shrink-0" />
              <span className="truncate">Importer un fichier du téléphone (vidéo, audio, script, SRT)</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-[#89b4fa] shrink-0" />
          </button>
        )}

        {canInstallPWA && onInstallPWA && (
          <button
            type="button"
            onClick={onInstallPWA}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#a6e3a1]/15 border border-[#a6e3a1]/45 hover:bg-[#a6e3a1]/25 text-xs font-bold text-[#a6e3a1] flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer shrink-0"
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>Installer l’app (Partager / Ouvrir avec)</span>
          </button>
        )}
      </div>

      {/* Accès rapide de reprise (discret, 1 ligne max) */}
      {(hasDraftText || activeBackingTrackTitle) && (
        <button
          type="button"
          onClick={() => onNavigate('vocal_single')}
          className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
        >
          <span className="text-xs text-[#cdd6f4] truncate">
            {hasDraftText ? 'Reprendre votre texte en cours' : `Fond actif : ${activeBackingTrackTitle}`}
          </span>
          <span className="text-xs font-semibold text-[#89b4fa] flex items-center gap-1 whitespace-nowrap shrink-0">
            <span>Ouvrir</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}

      {/* Grille principale des catégories (sans scroll sur mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {HUB_CATEGORIES.map((cat) => {
          const dynamicSubtitle =
            cat.id === 'library'
              ? `${projectCount} projet${projectCount > 1 ? 's' : ''} · Médias`
              : cat.subtitle;

          const isAboutWide = cat.id === 'about';

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryClick(cat)}
              className={`group text-left p-3.5 sm:p-4 rounded-2xl bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 active:scale-[0.98] transition-all flex ${
                isAboutWide ? 'col-span-2 lg:col-span-3 flex-row items-center justify-between min-h-[60px]' : 'flex-col justify-between min-h-[104px] sm:min-h-[118px]'
              } cursor-pointer focus-visible:outline-2 focus-visible:outline-[#89b4fa]`}
            >
              <div className={`flex ${isAboutWide ? 'items-center gap-3 min-w-0' : 'items-start justify-between w-full gap-2'}`}>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${cat.accent}1a`,
                    color: cat.accent,
                  }}
                >
                  <CategoryIcon name={cat.iconName} className="w-5 h-5" />
                </div>
                {!isAboutWide && (
                  <ChevronRight className="w-4 h-4 text-[#6c7086] group-hover:text-[#cdd6f4] transition-colors shrink-0 mt-1" />
                )}
                {isAboutWide && (
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#cdd6f4] truncate">{cat.title}</div>
                    <div className="text-[11px] text-[#a6adc8] truncate">{dynamicSubtitle}</div>
                  </div>
                )}
              </div>

              {!isAboutWide ? (
                <div className="mt-2.5 min-w-0">
                  <div className="text-sm font-semibold text-[#cdd6f4] truncate">{cat.title}</div>
                  <div className="text-[11px] text-[#a6adc8] truncate mt-0.5">{dynamicSubtitle}</div>
                </div>
              ) : (
                <ChevronRight className="w-4 h-4 text-[#6c7086] group-hover:text-[#cdd6f4] transition-colors shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tiroir / Modale de sélection des sous-catégories */}
      {selectedCategory && selectedCategory.subcategories && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setSelectedCategory(null)}
        >
          <div
            className="w-full sm:max-w-md bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Poignée visuelle mobile */}
            <div className="w-10 h-1 bg-[#45475a] rounded-full mx-auto sm:hidden" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${selectedCategory.accent}1a`,
                    color: selectedCategory.accent,
                  }}
                >
                  <CategoryIcon name={selectedCategory.iconName} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[#cdd6f4] truncate">
                    {selectedCategory.title}
                  </h2>
                  <p className="text-xs text-[#a6adc8] truncate">
                    Choisissez une tâche
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] transition-colors cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {selectedCategory.subcategories.map((sub) => (
                <button
                  key={sub.route}
                  type="button"
                  onClick={() => {
                    const target = sub.route;
                    setSelectedCategory(null);
                    onNavigate(target);
                  }}
                  className="w-full min-h-[64px] p-3.5 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#89b4fa] active:scale-[0.99] flex items-center gap-3.5 text-left transition-all cursor-pointer"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${selectedCategory.accent}1a`,
                      color: selectedCategory.accent,
                    }}
                  >
                    <SubCategoryIcon name={sub.iconName} className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#cdd6f4] truncate">
                      {sub.title}
                    </div>
                    <p className="text-xs text-[#a6adc8] line-clamp-2 mt-0.5 leading-snug">
                      {sub.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6c7086] shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
