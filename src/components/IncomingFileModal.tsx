import React, { useState } from 'react';
import {
  X,
  Film,
  Mic,
  Music,
  FileText,
  FolderPlus,
  Share2,
  Subtitles,
  FileUp,
  Check,
} from 'lucide-react';
import {
  IncomingPayload,
  detectIncomingMediaKind,
  IncomingMediaKind,
} from '../utils/incomingShareStore';

export type IncomingDestination =
  | { action: 'video_dubbing'; file?: File; text?: string }
  | { action: 'voiceover_track'; file: File }
  | { action: 'backing_track'; file: File }
  | { action: 'vocal_studio'; file?: File; text?: string }
  | { action: 'save_to_project'; projectName: string; file?: File; text?: string }
  | { action: 'import_json'; file: File };

interface IncomingFileModalProps {
  payload: IncomingPayload | null;
  projectNames: string[];
  onClose: () => void;
  onSelectDestination: (dest: IncomingDestination) => void;
}

export const IncomingFileModal: React.FC<IncomingFileModalProps> = ({
  payload,
  projectNames,
  onClose,
  onSelectDestination,
}) => {
  const [targetProject, setTargetProject] = useState<string>(
    projectNames[0] || 'Imports_Mobile'
  );
  const [customProjectName, setCustomProjectName] = useState<string>('');

  if (!payload) return null;

  const primaryFile = payload.files[0];
  const kind: IncomingMediaKind = primaryFile
    ? detectIncomingMediaKind(primaryFile)
    : 'text';

  const combinedText = [payload.title, payload.text, payload.url]
    .filter((v) => Boolean(v && v.trim()))
    .join('\n\n');

  const sourceBadge =
    payload.source === 'share_target'
      ? 'Partagé vers VoxArt'
      : payload.source === 'open_with'
        ? 'Ouvert avec VoxArt'
        : 'Fichier du téléphone';

  const effectiveProject =
    customProjectName.trim() || targetProject || 'Imports_Mobile';

  const sizeLabel = primaryFile
    ? primaryFile.size > 1024 * 1024
      ? `${(primaryFile.size / (1024 * 1024)).toFixed(2)} Mo`
      : `${Math.max(1, Math.round(primaryFile.size / 1024))} Ko`
    : `${combinedText.length} caractères`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#1e1e2e] border-t sm:border border-[#313244] rounded-t-3xl sm:rounded-2xl p-5 space-y-4 shadow-2xl text-[#cdd6f4]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#45475a] rounded-full mx-auto sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#89b4fa]/15 text-[#89b4fa] flex items-center justify-center shrink-0">
              {kind === 'video' ? (
                <Film className="w-5 h-5" />
              ) : kind === 'audio' ? (
                <Music className="w-5 h-5" />
              ) : kind === 'subtitle' ? (
                <Subtitles className="w-5 h-5" />
              ) : payload.source === 'share_target' ? (
                <Share2 className="w-5 h-5" />
              ) : (
                <FileUp className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#fbbf24]">
                {sourceBadge}
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {primaryFile ? primaryFile.name : payload.title || 'Contenu partagé'}
              </h2>
              <p className="text-[11px] text-[#a6adc8] tabular-nums">
                {sizeLabel}
                {payload.files.length > 1 ? ` · +${payload.files.length - 1} autre(s)` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#a6adc8] hover:text-white hover:bg-[#313244] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions principales selon le type de média */}
        <div className="space-y-2">
          {kind === 'video' && primaryFile && (
            <button
              type="button"
              onClick={() =>
                onSelectDestination({ action: 'video_dubbing', file: primaryFile })
              }
              className="w-full min-h-[52px] p-3.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs flex items-center gap-3 text-left cursor-pointer transition-all"
            >
              <Film className="w-5 h-5 shrink-0" />
              <div>
                <div>Ouvrir dans Doublage Vidéo & Sous-titres</div>
                <div className="text-[11px] font-normal opacity-80">
                  Poser une voix off, enregistrer au micro et générer les sous-titres .SRT
                </div>
              </div>
            </button>
          )}

          {kind === 'audio' && primaryFile && (
            <>
              <button
                type="button"
                onClick={() =>
                  onSelectDestination({ action: 'voiceover_track', file: primaryFile })
                }
                className="w-full min-h-[52px] p-3.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs flex items-center gap-3 text-left cursor-pointer transition-all"
              >
                <Mic className="w-5 h-5 shrink-0" />
                <div>
                  <div>Poser comme Voix Off (Doublage Vidéo)</div>
                  <div className="text-[11px] font-normal opacity-80">
                    Synchroniser sur une vidéo et générer le fichier .SRT
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onSelectDestination({ action: 'backing_track', file: primaryFile })
                }
                className="w-full min-h-[48px] p-3 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#fbbf24] text-[#cdd6f4] font-semibold text-xs flex items-center gap-3 text-left cursor-pointer transition-all"
              >
                <Music className="w-4 h-4 text-[#fbbf24] shrink-0" />
                <div>Utiliser comme Fond Sonore / Mixage</div>
              </button>
            </>
          )}

          {(kind === 'text' || kind === 'subtitle' || !primaryFile) && (
            <>
              <button
                type="button"
                onClick={() =>
                  onSelectDestination({
                    action: 'vocal_studio',
                    file: primaryFile,
                    text: combinedText || undefined,
                  })
                }
                className="w-full min-h-[52px] p-3.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs flex items-center gap-3 text-left cursor-pointer transition-all"
              >
                <Mic className="w-5 h-5 shrink-0" />
                <div>
                  <div>Ouvrir dans le Studio Vocal</div>
                  <div className="text-[11px] font-normal opacity-80">
                    Transformer ce texte en voix de synthèse
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onSelectDestination({
                    action: 'video_dubbing',
                    file: primaryFile,
                    text: combinedText || undefined,
                  })
                }
                className="w-full min-h-[48px] p-3 rounded-xl bg-[#181825] border border-[#313244] hover:border-[#cba6f7] text-[#cdd6f4] font-semibold text-xs flex items-center gap-3 text-left cursor-pointer transition-all"
              >
                <Subtitles className="w-4 h-4 text-[#cba6f7] shrink-0" />
                <div>Charger dans Doublage Vidéo & Sous-titres .SRT</div>
              </button>
            </>
          )}

          {kind === 'json' && primaryFile && (
            <button
              type="button"
              onClick={() =>
                onSelectDestination({ action: 'import_json', file: primaryFile })
              }
              className="w-full min-h-[52px] p-3.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs flex items-center gap-3 text-left cursor-pointer transition-all"
            >
              <FileText className="w-5 h-5 shrink-0" />
              <div>Importer ce fichier JSON dans VoxArt</div>
            </button>
          )}
        </div>

        {/* Enregistrer dans un projet */}
        {kind !== 'json' && (
          <div className="p-3 bg-[#181825] rounded-xl border border-[#313244] space-y-2">
            <div className="text-xs font-semibold text-[#a6e3a1] flex items-center gap-1.5">
              <FolderPlus className="w-4 h-4" />
              <span>Ou enregistrer directement dans un Projet</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {projectNames.length > 0 && (
                <select
                  value={targetProject}
                  onChange={(e) => {
                    setTargetProject(e.target.value);
                    setCustomProjectName('');
                  }}
                  className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#11111b] border border-[#45475a] text-xs text-[#cdd6f4]"
                >
                  {projectNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="text"
                value={customProjectName}
                onChange={(e) => setCustomProjectName(e.target.value)}
                placeholder={projectNames.length > 0 ? 'Ou nouveau projet...' : 'Nom du projet'}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#11111b] border border-[#45475a] text-xs text-[#cdd6f4] focus:outline-none focus:border-[#a6e3a1]"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                onSelectDestination({
                  action: 'save_to_project',
                  projectName: effectiveProject,
                  file: primaryFile,
                  text: combinedText || undefined,
                })
              }
              className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#a6e3a1]/15 hover:bg-[#a6e3a1]/25 text-[#a6e3a1] border border-[#a6e3a1]/35 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Enregistrer dans « {effectiveProject} »</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
