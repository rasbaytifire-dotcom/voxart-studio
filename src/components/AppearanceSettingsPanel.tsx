import React, { useRef, useState } from 'react';
import { Check, Image as ImageIcon, Palette, Plus, Trash2 } from 'lucide-react';
import {
  AppearanceConfig,
  BUILTIN_WALLPAPERS,
  VISUAL_THEMES,
  VisualThemeId,
  WallpaperPreset,
} from '../types/appearance';

interface AppearanceSettingsPanelProps {
  config: AppearanceConfig;
  customWallpapers: WallpaperPreset[];
  onChangeConfig: (next: AppearanceConfig) => void;
  onAddCustomWallpaper: (item: WallpaperPreset) => void;
  onRemoveCustomWallpaper: (id: string) => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const compressImageFileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image invalide.'));
      img.onload = () => {
        const maxDim = 1440;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponible.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
};

export const AppearanceSettingsPanel: React.FC<AppearanceSettingsPanelProps> = ({
  config,
  customWallpapers,
  onChangeConfig,
  onAddCustomWallpaper,
  onRemoveCustomWallpaper,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handlePickWallpaperFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsImporting(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      const id = `custom_${Date.now()}`;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').slice(0, 24) || 'Fond personnel';
      const newPreset: WallpaperPreset = {
        id,
        label: cleanName,
        subtitle: 'Bibliothèque appareil',
        url: dataUrl,
        isCustom: true,
      };
      onAddCustomWallpaper(newPreset);
      onChangeConfig({ ...config, wallpaperId: id });
      onNotify?.(`Fond d'écran "${cleanName}" appliqué !`, 'success');
    } catch {
      onNotify?.("Impossible d'importer cette image.", 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const allWallpapers = [...BUILTIN_WALLPAPERS, ...customWallpapers];

  const handleSelectTheme = (themeId: VisualThemeId) => {
    onChangeConfig({ ...config, visualTheme: themeId });
  };

  return (
    <div className="p-4 bg-[#181825] rounded-xl border border-[#313244] space-y-4">
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-[#89b4fa]" />
        <div>
          <h3 className="text-xs font-bold text-[#cdd6f4]">Apparence & Style du Studio</h3>
          <p className="text-[11px] text-[#a6adc8]">
            Choisissez les couleurs des contours et un fond d'écran depuis la galerie RidiaLArt ou votre appareil.
          </p>
        </div>
      </div>

      {/* Sélecteur de Thème Visuel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {VISUAL_THEMES.map((theme) => {
          const active = config.visualTheme === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleSelectTheme(theme.id)}
              className={`min-h-[60px] p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                active
                  ? 'bg-[#1e1e2e] border-[#89b4fa] ring-1 ring-[#89b4fa]/40'
                  : 'bg-[#11111b] border-[#313244] hover:border-[#45475a]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Pastille aperçu couleur + contour */}
                <span
                  className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border-2"
                  style={{
                    backgroundColor: theme.bgSwatch,
                    borderColor: theme.borderSwatch,
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: theme.accentSwatch }}
                  />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#cdd6f4] truncate">
                    {theme.label}
                  </div>
                  <div className="text-[10px] text-[#a6adc8] truncate">{theme.subtitle}</div>
                </div>
              </div>
              {active && <Check className="w-4 h-4 text-[#89b4fa] shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Sélecteur de Fond d'Écran */}
      <div className="space-y-2.5 pt-2 border-t border-[#313244]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#cdd6f4]">
            <ImageIcon className="w-3.5 h-3.5 text-[#89b4fa]" />
            <span>Fond d'écran</span>
          </div>

          <button
            type="button"
            disabled={isImporting}
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isImporting ? 'Chargement...' : 'Choisir dans ma galerie'}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickWallpaperFile}
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Option Aucun fond */}
          <button
            type="button"
            onClick={() => onChangeConfig({ ...config, wallpaperId: 'none' })}
            className={`relative h-24 rounded-xl border overflow-hidden flex flex-col items-center justify-center p-2 text-center transition-all cursor-pointer ${
              config.wallpaperId === 'none'
                ? 'border-[#89b4fa] ring-1 ring-[#89b4fa]/40 bg-[#1e1e2e]'
                : 'border-[#313244] bg-[#11111b] hover:border-[#45475a]'
            }`}
          >
            <span className="text-xs font-semibold text-[#cdd6f4]">Fond uni</span>
            <span className="text-[10px] text-[#a6adc8] mt-0.5">Sans image</span>
            {config.wallpaperId === 'none' && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#89b4fa] text-[#11111b] flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
          </button>

          {/* Fonds intégrés & personnels */}
          {allWallpapers.map((wp) => {
            const active = config.wallpaperId === wp.id;
            return (
              <div
                key={wp.id}
                className={`relative h-24 rounded-xl border overflow-hidden transition-all ${
                  active
                    ? 'border-[#89b4fa] ring-1 ring-[#89b4fa]/40'
                    : 'border-[#313244] hover:border-[#45475a]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChangeConfig({ ...config, wallpaperId: wp.id })}
                  className="w-full h-full relative text-left cursor-pointer"
                >
                  <img
                    src={wp.url}
                    alt={wp.label}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute bottom-1.5 left-2 right-2">
                    <div className="text-[11px] font-semibold text-white truncate">
                      {wp.label}
                    </div>
                    <div className="text-[9px] text-white/75 truncate">{wp.subtitle}</div>
                  </div>
                  {active && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#89b4fa] text-[#11111b] flex items-center justify-center shadow">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </button>

                {wp.isCustom && (
                  <button
                    type="button"
                    onClick={() => onRemoveCustomWallpaper(wp.id)}
                    aria-label={`Supprimer ${wp.label}`}
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/70 text-red-300 hover:text-red-400 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Opacité du voile de lisibilité */}
        {config.wallpaperId !== 'none' && (
          <div className="pt-1 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-[#a6adc8]">
              <span>Voile sombre de lisibilité :</span>
              <span className="font-mono tabular-nums font-semibold text-[#cdd6f4]">
                {Math.round(config.wallpaperScrim * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.35}
              max={0.9}
              step={0.05}
              value={config.wallpaperScrim}
              onChange={(e) =>
                onChangeConfig({ ...config, wallpaperScrim: parseFloat(e.target.value) })
              }
              className="w-full accent-[#89b4fa]"
            />
          </div>
        )}
      </div>
    </div>
  );
};
