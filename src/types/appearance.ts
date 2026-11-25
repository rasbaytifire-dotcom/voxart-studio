import wallpaperObsidianGold from '../assets/images/wallpaper_obsidian_gold_1795240452033.jpg';
import wallpaperCosmosGriot from '../assets/images/wallpaper_cosmos_griot_1795240451571.jpg';
import wallpaperLateriteBronze from '../assets/images/wallpaper_laterite_bronze_1795240452094.jpg';

export type VisualThemeId = 'obsidian_gold' | 'slate_pro' | 'royal_indigo';

export interface WallpaperPreset {
  id: string;
  label: string;
  subtitle: string;
  url: string;
  isCustom?: boolean;
}

export interface AppearanceConfig {
  visualTheme: VisualThemeId;
  wallpaperId: string; // 'none' | preset id | custom id
  wallpaperScrim: number; // 0.35 to 0.9
}

export const VISUAL_THEMES: Array<{
  id: VisualThemeId;
  label: string;
  subtitle: string;
  bgSwatch: string;
  cardSwatch: string;
  borderSwatch: string;
  accentSwatch: string;
}> = [
  {
    id: 'obsidian_gold',
    label: 'Noir & Or (RidiaLArt)',
    subtitle: 'Obsidienne pure · Contours dorés Afrofuturistes',
    bgSwatch: '#070605',
    cardSwatch: '#110e0a',
    borderSwatch: '#d99b26',
    accentSwatch: '#fbbf24',
  },
  {
    id: 'slate_pro',
    label: 'Ardoise Studio',
    subtitle: 'Nuit bleutée · Bleu ciel classique',
    bgSwatch: '#181825',
    cardSwatch: '#1e1e2e',
    borderSwatch: '#45475a',
    accentSwatch: '#89b4fa',
  },
  {
    id: 'royal_indigo',
    label: 'Indigo Ancestral',
    subtitle: 'Indigo profond · Or & bronze',
    bgSwatch: '#090b18',
    cardSwatch: '#111428',
    borderSwatch: '#6366f1',
    accentSwatch: '#f59e0b',
  },
];

export const BUILTIN_WALLPAPERS: WallpaperPreset[] = [
  {
    id: 'wallpaper_obsidian_gold',
    label: 'Ondes Dorées',
    subtitle: 'Obsidienne & or brossé',
    url: wallpaperObsidianGold,
  },
  {
    id: 'wallpaper_cosmos_griot',
    label: 'Cosmos Griot',
    subtitle: 'Constellations du Sahel',
    url: wallpaperCosmosGriot,
  },
  {
    id: 'wallpaper_laterite_bronze',
    label: 'Basalte & Bronze',
    subtitle: 'Résonance volcanique',
    url: wallpaperLateriteBronze,
  },
];

export const DEFAULT_APPEARANCE_CONFIG: AppearanceConfig = {
  visualTheme: 'obsidian_gold',
  wallpaperId: 'none',
  wallpaperScrim: 0.68,
};
