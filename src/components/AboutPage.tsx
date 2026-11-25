import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Compass,
  Image as ImageIcon,
  Layers,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  Volume2,
  X,
} from 'lucide-react';
import studioLogo from '../assets/images/voxart_logo_1791875178885.jpg';
import { APP_VERSION } from './UpdateManager';
import { AppRouteId } from '../types/navigation';
import {
  ARTIST_PROFILE,
  ARTISTIC_VISION,
  ArtworkCategory,
  DEFAULT_WRITINGS,
  fetchPortfolioFromCloud,
  loadLocalArtworks,
  loadLocalCustomWritings,
  PortfolioArtwork,
  PortfolioWriting,
  saveLocalArtworks,
  saveLocalCustomWritings,
  syncPortfolioToCloud,
} from '../data/ridialartPortfolio';

export type AboutSubRouteId =
  | 'about'
  | 'about_vision'
  | 'about_artist'
  | 'about_gallery'
  | 'about_writings';

interface AboutPageProps {
  activeRoute: AboutSubRouteId;
  onNavigate: (route: AppRouteId) => void;
  onBackHome: () => void;
  onListenWriting: (content: string, title: string) => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const compressArtworkPhoto = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture impossible.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image invalide.'));
      img.onload = () => {
        const maxDim = 960;
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
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
};

export const AboutPage: React.FC<AboutPageProps> = ({
  activeRoute,
  onNavigate,
  onBackHome,
  onListenWriting,
  onNotify,
}) => {
  const [liveVersion, setLiveVersion] = useState<string>(APP_VERSION);
  const [artworks, setArtworks] = useState<PortfolioArtwork[]>(() => loadLocalArtworks());
  const [customWritings, setCustomWritings] = useState<PortfolioWriting[]>(() =>
    loadLocalCustomWritings()
  );

  // États Galerie
  const [galleryFilter, setGalleryFilter] = useState<'all' | ArtworkCategory>('all');
  const [selectedArtwork, setSelectedArtwork] = useState<PortfolioArtwork | null>(null);
  const [showAddArtworkModal, setShowAddArtworkModal] = useState(false);
  const [artTitle, setArtTitle] = useState('');
  const [artYear, setArtYear] = useState(String(new Date().getFullYear()));
  const [artCategory, setArtCategory] = useState<ArtworkCategory>('visuel');
  const [artTechnique, setArtTechnique] = useState('');
  const [artDimensions, setArtDimensions] = useState('');
  const [artInstrument, setArtInstrument] = useState('');
  const [artDesc, setArtDesc] = useState('');
  const [artImageUrl, setArtImageUrl] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // États Écrits & Blog
  const [selectedWriting, setSelectedWriting] = useState<PortfolioWriting | null>(null);
  const [showAddWritingModal, setShowAddWritingModal] = useState(false);
  const [writingTitle, setWritingTitle] = useState('');
  const [writingTheme, setWritingTheme] = useState('Réflexion · Atelier RidiaLArt-Vision');
  const [writingContent, setWritingContent] = useState('');

  useEffect(() => {
    fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.version) setLiveVersion(data.version);
      })
      .catch(() => {});

    fetchPortfolioFromCloud().then((cloud) => {
      if (!cloud) return;
      if (cloud.artworks && cloud.artworks.length > 0 && loadLocalArtworks().length === 0) {
        setArtworks(cloud.artworks);
        saveLocalArtworks(cloud.artworks);
      }
      if (
        cloud.customWritings &&
        cloud.customWritings.length > 0 &&
        loadLocalCustomWritings().length === 0
      ) {
        setCustomWritings(cloud.customWritings);
        saveLocalCustomWritings(cloud.customWritings);
      }
    });
  }, []);

  const allWritings = useMemo(
    () => [...customWritings, ...DEFAULT_WRITINGS],
    [customWritings]
  );

  const filteredArtworks = useMemo(() => {
    if (galleryFilter === 'all') return artworks;
    return artworks.filter((a) => a.category === galleryFilter);
  }, [artworks, galleryFilter]);

  const handleSelectPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsProcessingPhoto(true);
    try {
      const compressed = await compressArtworkPhoto(file);
      setArtImageUrl(compressed);
    } catch {
      onNotify?.("Impossible de charger cette photo d'œuvre.", 'error');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleSaveArtwork = () => {
    const title = artTitle.trim();
    if (!title) {
      onNotify?.("Veuillez saisir le titre de l'œuvre.", 'error');
      return;
    }
    if (!artImageUrl) {
      onNotify?.("Veuillez sélectionner une image pour l'œuvre.", 'error');
      return;
    }

    const nextItem: PortfolioArtwork = {
      id: `art_${Date.now()}`,
      title,
      year: artYear.trim() || String(new Date().getFullYear()),
      category: artCategory,
      technique: artTechnique.trim() || 'Techniques mixtes',
      dimensions: artDimensions.trim() || undefined,
      instrumentConcept: artInstrument.trim() || undefined,
      description: artDesc.trim(),
      imageUrl: artImageUrl,
      createdAt: Date.now(),
    };

    const nextList = [nextItem, ...artworks];
    setArtworks(nextList);
    saveLocalArtworks(nextList);
    syncPortfolioToCloud(nextList, customWritings);

    setArtTitle('');
    setArtTechnique('');
    setArtDimensions('');
    setArtInstrument('');
    setArtDesc('');
    setArtImageUrl('');
    setShowAddArtworkModal(false);
    onNotify?.(`Œuvre "${title}" ajoutée à la galerie.`, 'success');
  };

  const handleDeleteArtwork = (id: string) => {
    const nextList = artworks.filter((a) => a.id !== id);
    setArtworks(nextList);
    saveLocalArtworks(nextList);
    syncPortfolioToCloud(nextList, customWritings);
    setSelectedArtwork(null);
    onNotify?.('Œuvre retirée de la galerie.', 'info');
  };

  const handleSaveWriting = () => {
    const title = writingTitle.trim();
    const content = writingContent.trim();
    if (!title || !content) {
      onNotify?.('Veuillez renseigner le titre et le texte.', 'error');
      return;
    }
    const nextItem: PortfolioWriting = {
      id: `writing_${Date.now()}`,
      title,
      theme: writingTheme.trim() || 'Atelier RidiaLArt-Vision',
      dateLabel: new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      content,
      createdAt: Date.now(),
    };

    const nextList = [nextItem, ...customWritings];
    setCustomWritings(nextList);
    saveLocalCustomWritings(nextList);
    syncPortfolioToCloud(artworks, nextList);

    setWritingTitle('');
    setWritingContent('');
    setShowAddWritingModal(false);
    onNotify?.(`Écrit "${title}" publié.`, 'success');
  };

  const handleDeleteWriting = (id: string) => {
    const nextList = customWritings.filter((w) => w.id !== id);
    setCustomWritings(nextList);
    saveLocalCustomWritings(nextList);
    syncPortfolioToCloud(artworks, nextList);
    setSelectedWriting(null);
    onNotify?.('Écrit supprimé.', 'info');
  };

  // Sous-page 1 : Vision & Démarche Artistique
  if (activeRoute === 'about_vision') {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => onNavigate('about')}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 text-xs font-semibold text-[#cdd6f4] inline-flex items-center gap-2 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#89b4fa]" />
          <span>À propos</span>
        </button>

        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-5 sm:p-6 space-y-4">
          <div>
            <div className="text-xs text-[#89b4fa] font-semibold">
              Atelier RidiaLArt-Vision · Démarche Artistique
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#cdd6f4] mt-1">
              {ARTISTIC_VISION.headline}
            </h1>
            <p className="text-xs text-[#a6adc8] mt-1">
              Instruments de résonance : {ARTISTIC_VISION.instruments.join(' · ')}
            </p>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-[#cdd6f4]/90 leading-relaxed">
            {ARTISTIC_VISION.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#cdd6f4]">Axes de la démarche</h2>
          <div className="divide-y divide-[#313244]">
            {ARTISTIC_VISION.pillars.map((pillar) => (
              <div key={pillar.title} className="py-3 first:pt-1 last:pb-1">
                <div className="text-xs sm:text-sm font-semibold text-[#89b4fa]">
                  {pillar.title}
                </div>
                <p className="text-xs text-[#a6adc8] leading-relaxed mt-0.5">{pillar.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Sous-page 2 : L'Artiste Concepteur (Biographie & Parcours)
  if (activeRoute === 'about_artist') {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => onNavigate('about')}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 text-xs font-semibold text-[#cdd6f4] inline-flex items-center gap-2 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#89b4fa]" />
          <span>À propos</span>
        </button>

        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-4">
            <img
              src={studioLogo}
              alt={ARTIST_PROFILE.fullName}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-full object-cover border border-[#89b4fa]/60 shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-[#cdd6f4] truncate">
                {ARTIST_PROFILE.fullName}
              </h1>
              <div className="text-xs font-semibold text-[#89b4fa] truncate">
                {ARTIST_PROFILE.alias}
              </div>
              <div className="text-[11px] text-[#a6adc8] flex items-center gap-1 mt-1 truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{ARTIST_PROFILE.location}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#313244] space-y-2">
            <div className="text-xs font-semibold text-[#89b4fa]">{ARTIST_PROFILE.role}</div>
            <p className="text-xs sm:text-sm text-[#cdd6f4]/90 leading-relaxed">
              {ARTIST_PROFILE.bio}
            </p>
          </div>
        </div>

        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#cdd6f4]">Formation & Parcours</h2>
          <div className="divide-y divide-[#313244]">
            {ARTIST_PROFILE.timeline.map((step) => (
              <div key={step.title} className="py-3 first:pt-1 last:pb-1 space-y-0.5">
                <div className="text-[11px] font-mono tabular-nums text-[#89b4fa]">
                  {step.period}
                </div>
                <div className="text-xs sm:text-sm font-semibold text-[#cdd6f4]">{step.title}</div>
                <p className="text-xs text-[#a6adc8] leading-relaxed">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[#cdd6f4]">Domaines d’expertise</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ARTIST_PROFILE.skills.map((skill) => (
              <div
                key={skill.title}
                className="p-3.5 rounded-xl bg-[#181825] border border-[#313244] space-y-1"
              >
                <div className="text-xs font-semibold text-[#89b4fa]">{skill.title}</div>
                <p className="text-xs text-[#a6adc8] leading-relaxed">{skill.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Sous-page 3 : Galerie d'Œuvres & Créations
  if (activeRoute === 'about_gallery') {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate('about')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 text-xs font-semibold text-[#cdd6f4] inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#89b4fa]" />
            <span>À propos</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddArtworkModal(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une œuvre</span>
          </button>
        </div>

        {/* Filtre par discipline */}
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#1e1e2e] border border-[#313244] rounded-xl">
          {(
            [
              { id: 'all', label: 'Tout' },
              { id: 'visuel', label: 'Toiles' },
              { id: 'son', label: 'Son' },
              { id: 'video', label: 'Vidéo' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setGalleryFilter(tab.id)}
              className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                galleryFilter === tab.id
                  ? 'bg-[#89b4fa] text-[#11111b]'
                  : 'text-[#a6adc8] hover:text-[#cdd6f4]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filteredArtworks.length === 0 ? (
          <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-8 text-center space-y-3">
            <ImageIcon className="w-8 h-8 text-[#89b4fa] mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#cdd6f4]">
                Galerie prête pour vos créations
              </p>
              <p className="text-xs text-[#a6adc8] max-w-md mx-auto leading-relaxed">
                Importez vos photographies d’œuvres (Canon EOS R6 / galerie de votre téléphone) avec leur fiche technique (titre, année, médium, instrument associé).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddArtworkModal(true)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter votre première œuvre</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredArtworks.map((art) => (
              <button
                key={art.id}
                type="button"
                onClick={() => setSelectedArtwork(art)}
                className="group text-left bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 rounded-2xl overflow-hidden transition-all cursor-pointer flex flex-col"
              >
                <div className="aspect-[4/3] w-full bg-[#11111b] overflow-hidden">
                  <img
                    src={art.imageUrl}
                    alt={art.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                  />
                </div>
                <div className="p-3 space-y-0.5 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-[#cdd6f4] truncate">
                    {art.title}
                  </div>
                  <div className="text-[11px] text-[#a6adc8] tabular-nums truncate">
                    {art.year} · {art.technique}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Modale fiche détaillée d'œuvre */}
        {selectedArtwork && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setSelectedArtwork(null)}
          >
            <div
              className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-[#cdd6f4] truncate">
                  {selectedArtwork.title}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedArtwork(null)}
                  className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-xl overflow-hidden bg-[#11111b] border border-[#313244]">
                <img
                  src={selectedArtwork.imageUrl}
                  alt={selectedArtwork.title}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[50vh] object-contain mx-auto"
                />
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-[#89b4fa] font-semibold tabular-nums">
                  {selectedArtwork.year} · {selectedArtwork.technique}
                  {selectedArtwork.dimensions ? ` · ${selectedArtwork.dimensions}` : ''}
                </div>
                {selectedArtwork.instrumentConcept && (
                  <div className="text-[#a6adc8]">
                    Résonance / Instrument : {selectedArtwork.instrumentConcept}
                  </div>
                )}
                {selectedArtwork.description && (
                  <p className="text-[#cdd6f4]/90 leading-relaxed pt-1">
                    {selectedArtwork.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteArtwork(selectedArtwork.id)}
                className="w-full min-h-[44px] px-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Retirer de la galerie</span>
              </button>
            </div>
          </div>
        )}

        {/* Modale ajout d'une œuvre */}
        {showAddArtworkModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowAddArtworkModal(false)}
          >
            <div
              className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#cdd6f4]">Ajouter une œuvre</h3>
                <button
                  type="button"
                  onClick={() => setShowAddArtworkModal(false)}
                  className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className="w-full min-h-[108px] rounded-xl bg-[#181825] border border-dashed border-[#313244] hover:border-[#89b4fa] flex flex-col items-center justify-center gap-1.5 overflow-hidden cursor-pointer"
              >
                {artImageUrl ? (
                  <img
                    src={artImageUrl}
                    alt="Aperçu"
                    className="w-full h-36 object-cover"
                  />
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-[#89b4fa]" />
                    <span className="text-xs font-medium text-[#cdd6f4]">
                      {isProcessingPhoto ? 'Compression...' : 'Choisir la photo de l’œuvre'}
                    </span>
                  </>
                )}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handleSelectPhoto}
                className="hidden"
              />

              <input
                type="text"
                value={artTitle}
                onChange={(e) => setArtTitle(e.target.value)}
                placeholder="Titre de l’œuvre *"
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4]"
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={artYear}
                  onChange={(e) => setArtYear(e.target.value)}
                  placeholder="Année (ex: 2025)"
                  className="min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4]"
                />
                <select
                  value={artCategory}
                  onChange={(e) => setArtCategory(e.target.value as ArtworkCategory)}
                  className="min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4]"
                >
                  <option value="visuel">Toile / Art plastique</option>
                  <option value="son">Création sonore</option>
                  <option value="video">Numérique / Vidéo</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={artTechnique}
                  onChange={(e) => setArtTechnique(e.target.value)}
                  placeholder="Technique (Acrylique, Sérigraphie...)"
                  className="min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4]"
                />
                <input
                  type="text"
                  value={artDimensions}
                  onChange={(e) => setArtDimensions(e.target.value)}
                  placeholder="Dimensions (ex: 100×80 cm)"
                  className="min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4]"
                />
              </div>

              <input
                type="text"
                value={artInstrument}
                onChange={(e) => setArtInstrument(e.target.value)}
                placeholder="Instrument / Résonance associée (Kora, Sabar...)"
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4]"
              />

              <textarea
                rows={3}
                value={artDesc}
                onChange={(e) => setArtDesc(e.target.value)}
                placeholder="Note d’intention (facultatif)..."
                className="w-full p-3 rounded-xl bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4] resize-none"
              />

              <button
                type="button"
                onClick={handleSaveArtwork}
                className="w-full min-h-[46px] rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-sm cursor-pointer"
              >
                Enregistrer dans la galerie
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sous-page 4 : Écrits, Chroniques & Blog
  if (activeRoute === 'about_writings') {
    if (selectedWriting) {
      return (
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSelectedWriting(null)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 text-xs font-semibold text-[#cdd6f4] inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-[#89b4fa]" />
              <span>Tous les écrits</span>
            </button>

            <button
              type="button"
              onClick={() => onListenWriting(selectedWriting.content, selectedWriting.title)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              <span>Écouter cet écrit</span>
            </button>
          </div>

          <article className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-5 sm:p-6 space-y-4">
            <div>
              <div className="text-xs text-[#89b4fa]">
                {selectedWriting.theme} · {selectedWriting.dateLabel}
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-[#cdd6f4] mt-1">
                {selectedWriting.title}
              </h1>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-[#cdd6f4]/90 leading-relaxed whitespace-pre-line">
              {selectedWriting.content}
            </div>

            {!selectedWriting.isBuiltin && (
              <div className="pt-3 border-t border-[#313244]">
                <button
                  type="button"
                  onClick={() => handleDeleteWriting(selectedWriting.id)}
                  className="min-h-[40px] px-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer cet écrit</span>
                </button>
              </div>
            )}
          </article>
        </div>
      );
    }

    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate('about')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 text-xs font-semibold text-[#cdd6f4] inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#89b4fa]" />
            <span>À propos</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddWritingModal(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvel écrit</span>
          </button>
        </div>

        <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 divide-y divide-[#313244]">
          {allWritings.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedWriting(item)}
              className="w-full py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-left group cursor-pointer"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="text-sm font-semibold text-[#cdd6f4] group-hover:text-[#89b4fa] truncate transition-colors">
                  {item.title}
                </div>
                <div className="text-xs text-[#a6adc8] truncate">
                  {item.theme} · {item.dateLabel}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#6c7086] group-hover:text-[#cdd6f4] shrink-0" />
            </button>
          ))}
        </div>

        {showAddWritingModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => setShowAddWritingModal(false)}
          >
            <div
              className="w-full sm:max-w-md bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#cdd6f4]">Publier un écrit</h3>
                <button
                  type="button"
                  onClick={() => setShowAddWritingModal(false)}
                  className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] cursor-pointer"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                value={writingTitle}
                onChange={(e) => setWritingTitle(e.target.value)}
                placeholder="Titre de l’écrit ou article *"
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4]"
              />

              <input
                type="text"
                value={writingTheme}
                onChange={(e) => setWritingTheme(e.target.value)}
                placeholder="Thème / Rubrique"
                className="w-full min-h-[44px] px-3 rounded-xl bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4]"
              />

              <textarea
                rows={6}
                value={writingContent}
                onChange={(e) => setWritingContent(e.target.value)}
                placeholder="Rédigez ou collez votre texte ici..."
                className="w-full p-3 rounded-xl bg-[#181825] border border-[#313244] text-xs text-[#cdd6f4] resize-y"
              />

              <button
                type="button"
                onClick={handleSaveWriting}
                className="w-full min-h-[46px] rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-sm cursor-pointer"
              >
                Enregistrer l’écrit
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vue Principale Hub « À propos & Vision »
  const subCategories: Array<{
    route: AboutSubRouteId;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    {
      route: 'about_vision',
      title: 'Vision & Démarche',
      subtitle: 'Synesthésie & Polyrythmie plastique',
      icon: <Compass className="w-5 h-5 text-[#89b4fa]" />,
    },
    {
      route: 'about_artist',
      title: 'L’Artiste Concepteur',
      subtitle: `${ARTIST_PROFILE.fullName} · Parcours`,
      icon: <User className="w-5 h-5 text-[#fbbf24]" />,
    },
    {
      route: 'about_gallery',
      title: 'Galerie d’Œuvres',
      subtitle:
        artworks.length > 0
          ? `${artworks.length} création${artworks.length > 1 ? 's' : ''} exposée${artworks.length > 1 ? 's' : ''}`
          : 'Toiles, créations & fiches techniques',
      icon: <Layers className="w-5 h-5 text-[#f59e0b]" />,
    },
    {
      route: 'about_writings',
      title: 'Écrits & Chroniques',
      subtitle: `${allWritings.length} texte${allWritings.length > 1 ? 's' : ''} · Lecture & audio`,
      icon: <BookOpen className="w-5 h-5 text-[#a6e3a1]" />,
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-5 text-center space-y-2.5">
        <img
          src={studioLogo}
          alt="VoxArt Studio RidiaLArt-Vision"
          referrerPolicy="no-referrer"
          className="w-14 h-14 rounded-full object-cover mx-auto border border-[#89b4fa]/60"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-[#cdd6f4]">VoxArt Studio</h1>
          <p className="text-xs text-[#a6adc8] mt-0.5">
            Atelier RidiaLArt-Vision · {ARTIST_PROFILE.fullName} ·{' '}
            <span className="font-mono tabular-nums text-[#89b4fa]">v{liveVersion}</span>
          </p>
        </div>
      </div>

      {/* Grille des 4 sous-catégories À propos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {subCategories.map((sub) => (
          <button
            key={sub.route}
            type="button"
            onClick={() => onNavigate(sub.route)}
            className="group text-left p-4 rounded-2xl bg-[#1e1e2e] border border-[#313244] hover:border-[#89b4fa]/60 active:scale-[0.98] transition-all flex items-center justify-between gap-3 min-h-[82px] cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#181825] border border-[#313244] flex items-center justify-center shrink-0">
                {sub.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#cdd6f4] truncate">{sub.title}</div>
                <div className="text-xs text-[#a6adc8] truncate mt-0.5">{sub.subtitle}</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6c7086] group-hover:text-[#cdd6f4] shrink-0" />
          </button>
        ))}
      </div>

      <div className="bg-[#1e1e2e] border border-[#313244] rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#181825] border border-[#313244] flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#a6e3a1]" />
        </div>
        <div className="text-xs text-[#a6adc8] leading-relaxed">
          <span className="font-semibold text-[#cdd6f4] block mb-0.5">Studio & Continuité</span>
          Créations, œuvres de galerie, écrits et projets sont conservés localement sur votre appareil et synchronisés avec votre base cloud.
        </div>
      </div>

      <button
        type="button"
        onClick={onBackHome}
        className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour à l'accueil</span>
      </button>
    </div>
  );
};
