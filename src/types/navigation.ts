export type InterfaceMode = 'hub' | 'classic';

export type AppRouteId =
  | 'home'
  | 'vocal_single'
  | 'vocal_voice_custom'
  | 'vocal_batch'
  | 'video_dubbing'
  | 'video_transcription'
  | 'slam_poetry'
  | 'music_rhythm'
  | 'music_mixer'
  | 'ai_assistant'
  | 'ai_knowledge'
  | 'library'
  | 'settings'
  | 'about'
  | 'about_vision'
  | 'about_artist'
  | 'about_gallery'
  | 'about_writings';

export type HubCategoryId =
  | 'vocal'
  | 'video'
  | 'slam_poetry'
  | 'music'
  | 'ai'
  | 'library'
  | 'settings'
  | 'about';

export interface SubCategoryItem {
  route: AppRouteId;
  title: string;
  description: string;
  iconName: 'mic' | 'layers' | 'film' | 'subtitles' | 'drum' | 'sliders' | 'bot' | 'database';
}

export interface HubCategoryItem {
  id: HubCategoryId;
  title: string;
  subtitle: string;
  accent: string;
  iconName: 'mic' | 'film' | 'music' | 'bot' | 'folder' | 'settings' | 'info';
  directRoute?: AppRouteId;
  subcategories?: SubCategoryItem[];
}

export const ROUTE_HASH_MAP: Record<AppRouteId, string> = {
  home: '#/',
  vocal_single: '#/vocal/studio',
  vocal_voice_custom: '#/vocal/ma-voix',
  vocal_batch: '#/vocal/lots',
  video_dubbing: '#/video/doublage',
  video_transcription: '#/video/transcription',
  slam_poetry: '#/slam-poesie',
  music_rhythm: '#/musique/rythmes',
  music_mixer: '#/musique/mixage',
  ai_assistant: '#/ia/assistant',
  ai_knowledge: '#/ia/connaissances',
  library: '#/bibliotheque',
  settings: '#/reglages',
  about: '#/a-propos',
  about_vision: '#/a-propos/vision',
  about_artist: '#/a-propos/artiste',
  about_gallery: '#/a-propos/galerie',
  about_writings: '#/a-propos/ecrits',
};

export const ROUTE_TITLES: Record<AppRouteId, string> = {
  home: 'VoxArt Studio',
  vocal_single: 'Synthèse Vocale',
  vocal_voice_custom: 'Ma Voix Personnalisée',
  vocal_batch: 'Production par Lots',
  video_dubbing: 'Doublage Vidéo',
  video_transcription: 'Transcription & Sous-titres',
  slam_poetry: 'Slam & Poésie',
  music_rhythm: 'Atelier Rythmes',
  music_mixer: 'Fond Sonore & Mixage',
  ai_assistant: 'Assistant Créatif',
  ai_knowledge: 'Base de Connaissance',
  library: 'Bibliothèque',
  settings: 'Réglages',
  about: 'À propos & Vision',
  about_vision: 'Vision & Démarche',
  about_artist: 'The RidiaLArt',
  about_gallery: 'Galerie d’Œuvres',
  about_writings: 'Écrits & Chroniques',
};

export const HUB_CATEGORIES: HubCategoryItem[] = [
  {
    id: 'vocal',
    title: 'Studio Vocal',
    subtitle: 'Voix simple · Ma Voix · Lots',
    accent: '#89b4fa',
    iconName: 'mic',
    subcategories: [
      {
        route: 'vocal_single',
        title: 'Synthèse Vocale',
        description: 'Convertir un texte en voix expressive avec choix de langue et timbre.',
        iconName: 'mic',
      },
      {
        route: 'vocal_voice_custom',
        title: 'Ma Voix Personnalisée',
        description: 'Analyser votre voix par audio ou sculpter un profil vocal sur mesure.',
        iconName: 'sliders',
      },
      {
        route: 'vocal_batch',
        title: 'Production par Lots',
        description: 'Découper un script long et générer plusieurs pistes en file d’attente.',
        iconName: 'layers',
      },
    ],
  },
  {
    id: 'video',
    title: 'Vidéo & Texte',
    subtitle: 'Doublage · Transcription',
    accent: '#fbbf24',
    iconName: 'film',
    subcategories: [
      {
        route: 'video_dubbing',
        title: 'Doublage Vidéo',
        description: 'Ajouter une voix off, un fond sonore et des sous-titres sur une vidéo.',
        iconName: 'film',
      },
      {
        route: 'video_transcription',
        title: 'Transcription & SRT',
        description: 'Extraire le texte et les sous-titres horodatés d’un média audio ou vidéo.',
        iconName: 'subtitles',
      },
    ],
  },
  {
    id: 'slam_poetry',
    title: 'Slam & Poésie',
    subtitle: 'Voix · Musique · Image · Vidéo',
    accent: '#f59e0b',
    iconName: 'mic',
    directRoute: 'slam_poetry',
  },
  {
    id: 'music',
    title: 'Musique & Mix',
    subtitle: 'Rythmes · Fond sonore',
    accent: '#f59e0b',
    iconName: 'music',
    subcategories: [
      {
        route: 'music_rhythm',
        title: 'Atelier Rythmes',
        description: 'Composer des boucles percussives (Djembé, Sabar, Kora, Balafon).',
        iconName: 'drum',
      },
      {
        route: 'music_mixer',
        title: 'Fond Sonore & Mixage',
        description: 'Choisir une ambiance, régler les volumes, le pitch et fusionner le master.',
        iconName: 'sliders',
      },
    ],
  },
  {
    id: 'ai',
    title: 'Création & Savoir',
    subtitle: 'Assistant · Documents',
    accent: '#cba6f7',
    iconName: 'bot',
    subcategories: [
      {
        route: 'ai_assistant',
        title: 'Assistant Créatif',
        description: 'Rédiger des scripts, scénarios ou prompts visuels et les envoyer au studio.',
        iconName: 'bot',
      },
      {
        route: 'ai_knowledge',
        title: 'Base de Connaissance',
        description: 'Enrichir et interroger vos références documentaires.',
        iconName: 'database',
      },
    ],
  },
  {
    id: 'library',
    title: 'Bibliothèque',
    subtitle: 'Projets · Audios · Scripts',
    accent: '#a6e3a1',
    iconName: 'folder',
    directRoute: 'library',
  },
  {
    id: 'settings',
    title: 'Réglages',
    subtitle: 'Voix · Thème · Clé API',
    accent: '#94e2d5',
    iconName: 'settings',
    directRoute: 'settings',
  },
  {
    id: 'about',
    title: 'À propos',
    subtitle: 'Vision · Artiste · Galerie · Écrits',
    accent: '#f9e2af',
    iconName: 'info',
    directRoute: 'about',
  },
];

export function routeToHash(route: AppRouteId): string {
  return ROUTE_HASH_MAP[route] || '#/';
}

export function hashToRoute(hash: string): AppRouteId {
  const normalized = (hash || '').trim().toLowerCase();
  if (!normalized || normalized === '#' || normalized === '#/') {
    return 'home';
  }
  const entry = (Object.entries(ROUTE_HASH_MAP) as [AppRouteId, string][]).find(
    ([, path]) => path.toLowerCase() === normalized
  );
  return entry ? entry[0] : 'home';
}
