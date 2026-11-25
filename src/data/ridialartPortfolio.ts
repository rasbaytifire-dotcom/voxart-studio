import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, ensureAuth } from '../firebase';

export type ArtworkCategory = 'visuel' | 'son' | 'video';

export interface PortfolioArtwork {
  id: string;
  title: string;
  year: string;
  category: ArtworkCategory;
  technique: string;
  dimensions?: string;
  instrumentConcept?: string;
  description: string;
  imageUrl: string;
  createdAt: number;
}

export interface PortfolioWriting {
  id: string;
  title: string;
  theme: string;
  dateLabel: string;
  content: string;
  createdAt: number;
  isBuiltin?: boolean;
}

export const ARTIST_PROFILE = {
  fullName: 'Mamadou Baytir Ndiaye',
  alias: 'The RidiaLArt · Ridialness',
  role: "Artiste Plasticien d'Expression · Spécialiste Synesthésie Plastique & Polyrythmie Plastique",
  atelier: 'Atelier RidiaLArt-Vision',
  location: 'Saly & Ngaparou · Région de Thiès / Dakar, Sénégal',
  bio: "Artiste plasticien diplômé avec la mention Très Bien (Major de promotion) du Département des Arts Visuels (Option Expression) de l'École Nationale des Arts et Métiers de la Culture (ENAMC) de Dakar. Mon travail explore la synesthésie plastique et la transposition plastique des fréquences et polyrythmies des instruments traditionnels africains, appuyé par une maîtrise technique en sérigraphie, peinture, électrotechnique industrielle et création numérique.",
  timeline: [
    {
      period: '2021 – 2026',
      title: 'Diplôme ENAMC Dakar — Option Expression (Major de promotion)',
      detail: 'Département des Arts Visuels (DAV), mention Très Bien.',
    },
    {
      period: 'Dak’Art (Off)',
      title: "Deux participations au programme Off de la Biennale d'Art Contemporain Africain",
      detail: 'Expositions collectives dédiées à l’expression plastique contemporaine.',
    },
    {
      period: 'FESMIR',
      title: 'Participation au Festival Miroir International de Dakar Plateau',
      detail: 'Rencontres artistiques, médiation et dialogue autour des arts plastiques.',
    },
    {
      period: 'Technique',
      title: 'Électrotechnique Industrielle, Sérigraphie & Teinture Textile',
      detail: 'Sérigraphie artisanale et industrielle multi-couleurs, électricité d’équipement et de studio.',
    },
    {
      period: 'Atelier',
      title: 'Directeur & Fondateur de l’Atelier RidiaLArt-Vision',
      detail: 'Création plastique, numérisation studio (Canon EOS R6), conception de VoxArt Studio et médiation culturelle à Saly / Ngaparou.',
    },
  ],
  skills: [
    {
      title: 'Arts Plastiques',
      detail: 'Expression plastique, peinture acrylique/huile, sculpture synesthésique, composition polyrythmique plastique.',
    },
    {
      title: 'Technique & Sérigraphie',
      detail: 'Sérigraphie textile et papier, préparation des écrans, impression multi-couleurs, électricité de studio.',
    },
    {
      title: 'Digital & Image',
      detail: 'Numérisation haute résolution d’œuvres (Canon EOS R6), retouche d’image, workflows créatifs IA et audio.',
    },
    {
      title: 'Régie & Médiation',
      detail: "Régie d'exposition, scénographie, médiation culturelle et conception de modules de formation artistique.",
    },
  ],
};

export const ARTISTIC_VISION = {
  headline: 'Synesthésie Plastique & Polyrythmie Plastique',
  instruments: ['Kora', 'Sabar', 'Balafon', 'Riti', 'Tama', 'Flûte'],
  paragraphs: [
    "Mon travail plastique s'articule autour du concept de synesthésie plastique et polyrythmique : l'espace pictural devient le réceptacle plastique des fréquences acoustiques, des timbres et des structures rythmiques de la musique traditionnelle sénégalaise et africaine.",
    'À travers la Kora, le Sabar, le Balafon, le Riti, la Flûte et le Tama, chaque vibration sonore se traduit par une dynamique formelle : la ligne suit le trait mélodique, la matière s’imprègne de la percussion, et la palette chromatique reflète les variations harmoniques.',
    "Mon parcours académique à l'ENAMC de Dakar, enrichi par la sérigraphie et l'électrotechnique, me permet d'aborder la matière avec précision structurale tout en préservant la spontanéité du geste expressif.",
  ],
  pillars: [
    {
      title: 'Traduction Son → Matière',
      detail: 'La ligne suit le trait mélodique, la texture porte la cadence percussive et la couleur traduit les harmoniques.',
    },
    {
      title: 'Pont Tradition & Contemporain',
      detail: 'Faire résonner les instruments patrimoniaux au cœur des arts plastiques et du studio numérique VoxArt.',
    },
    {
      title: 'Rigueur & Spontanéité',
      detail: "Associer la précision structurale acquise en électrotechnique et sérigraphie à l'élan du geste pictural.",
    },
  ],
};

export const DEFAULT_WRITINGS: PortfolioWriting[] = [
  {
    id: 'builtin_demarche',
    title: 'Démarche Artistique : Synesthésie Plastique et Polyrythmique',
    theme: 'Manifeste · Atelier RidiaLArt-Vision',
    dateLabel: 'Texte de référence',
    createdAt: 1,
    isBuiltin: true,
    content: [
      "Mon travail plastique s'articule autour du concept de synesthésie plastique et polyrythmique. Il s'agit d'une démarche d'exploration où l'espace pictural devient le réceptacle plastique des fréquences acoustiques, des timbres et des structures rythmiques de la musique traditionnelle sénégalaise et africaine.",
      'À travers la Kora, le Sabar, le Balafon, le Riti, la Flûte et le Tama, chaque vibration sonore se traduit par une dynamique formelle : la ligne suit le trait mélodique, la matière s’imprègne de la percussion, et la palette chromatique reflète les variations harmoniques. Mes compositions établissent un pont entre la tradition acoustique et les langages plastiques contemporains, faisant résonner la toile au rythme des instruments patrimoniaux.',
      "Mon parcours académique à l'ENAMC de Dakar (Département des Arts Visuels, Option Expression), enrichi par une pratique technique rigoureuse de la sérigraphie et de l'électrotechnique, me permet d'aborder la matière avec une précision structurale tout en préservant la spontanéité du geste expressif.",
    ].join('\n\n'),
  },
  {
    id: 'builtin_atelier',
    title: 'Matérialiser la Dynamique Acoustique du Patrimoine',
    theme: 'Création & Médiation · Sénégal',
    dateLabel: 'Note d’atelier',
    createdAt: 2,
    isBuiltin: true,
    content: [
      "Étudier les correspondances entre les rythmes du Sabar, les arpèges de la Kora, les résonances du Balafon et les gestes picturaux permet de matérialiser plastiquement la dynamique acoustique de notre patrimoine culturel.",
      "Au sein de l'Atelier RidiaLArt-Vision à Saly et Ngaparou, ce dialogue prend forme à travers la peinture d'expression, la sérigraphie, les techniques mixtes et la traduction spectrale numérique intégrée à VoxArt Studio, accompagné de temps de transmission et d'ateliers participatifs.",
    ].join('\n\n'),
  },
];

const ARTWORKS_STORAGE_KEY = 'voxart_portfolio_artworks_v1';
const WRITINGS_STORAGE_KEY = 'voxart_portfolio_writings_v1';
const FIRESTORE_COLLECTION = 'vox_library';
const FIRESTORE_DOC_ID = 'ridialart_portfolio_v1';

enum OperationType {
  GET = 'get',
  WRITE = 'write',
}

function logFirestoreWarning(error: unknown, operationType: OperationType, path: string) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
    },
  };
  console.warn('Firestore portfolio sync:', JSON.stringify(errInfo));
}

export function loadLocalArtworks(): PortfolioArtwork[] {
  try {
    const raw = localStorage.getItem(ARTWORKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

export function loadLocalCustomWritings(): PortfolioWriting[] {
  try {
    const raw = localStorage.getItem(WRITINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

export function saveLocalArtworks(artworks: PortfolioArtwork[]) {
  try {
    localStorage.setItem(ARTWORKS_STORAGE_KEY, JSON.stringify(artworks));
  } catch {
    // ignore quota error
  }
}

export function saveLocalCustomWritings(writings: PortfolioWriting[]) {
  try {
    localStorage.setItem(WRITINGS_STORAGE_KEY, JSON.stringify(writings));
  } catch {
    // ignore quota error
  }
}

export async function syncPortfolioToCloud(
  artworks: PortfolioArtwork[],
  customWritings: PortfolioWriting[]
) {
  const path = `${FIRESTORE_COLLECTION}/${FIRESTORE_DOC_ID}`;
  try {
    await ensureAuth();
    await setDoc(
      doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID),
      {
        artworks: artworks.slice(0, 20),
        customWritings: customWritings.slice(0, 30),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    logFirestoreWarning(err, OperationType.WRITE, path);
  }
}

export async function fetchPortfolioFromCloud(): Promise<{
  artworks?: PortfolioArtwork[];
  customWritings?: PortfolioWriting[];
} | null> {
  const path = `${FIRESTORE_COLLECTION}/${FIRESTORE_DOC_ID}`;
  try {
    await ensureAuth();
    const snap = await getDoc(doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID));
    if (snap.exists()) {
      const data = snap.data();
      return {
        artworks: Array.isArray(data.artworks) ? data.artworks : undefined,
        customWritings: Array.isArray(data.customWritings) ? data.customWritings : undefined,
      };
    }
  } catch (err) {
    logFirestoreWarning(err, OperationType.GET, path);
  }
  return null;
}
