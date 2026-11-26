/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Feather,
  History,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Wand2,
  X,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import { authFetch, apiAuthStore, safeJsonResponse } from '../services/apiAuth';
import { copyTextToClipboard } from '../utils/clipboard';
import { SLAM_CADENCE_PRESETS, formatMinutesSeconds } from '../utils/slamMetrics';

interface LiteraryExpertAssistantProps {
  currentText: string;
  apiKey?: string;
  language?: string;
  cadenceWpm?: number;
  onChangeCadenceWpm?: (wpm: number) => void;
  targetDurationSec?: number;
  onChangeTargetDurationSec?: (sec: number) => void;
  bgMusicDurationSec?: number | null;
  onApplyPoem: (poemText: string) => void;
  onAppendPoem?: (poemText: string) => void;
  onClose?: () => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
}

interface ExpertMessage {
  role: 'user' | 'model';
  content: string;
}

const LITERARY_MOVEMENTS = [
  'Slam contemporain & Spoken Word',
  'Négritude & Oralité des Griots (Senghor, Césaire)',
  'Afrofuturisme Poétique',
  'Symbolisme (Baudelaire, Verlaine, Rimbaud)',
  'Romantisme (Hugo, Lamartine)',
  'Surréalisme & Écriture automatique',
  'Classicisme & Pléiade (Alexandrins)',
  'Harlem Renaissance & Jazz Poetry',
  'Haïku & Poésie contemplative',
  'Poésie engagée & Manifeste',
];

const POETIC_FORMS = [
  'Slam rythmé pour la scène',
  'Vers libre moderne',
  'Sonnet (2 quatrains, 2 tercets)',
  'Alexandrins en rimes croisées',
  'Prose poétique & lyrique',
  'Ode / Hymne solennel',
  'Séquence de Haïkus',
];

export const LiteraryExpertAssistant: React.FC<LiteraryExpertAssistantProps> = ({
  currentText,
  apiKey,
  language = 'Français',
  cadenceWpm,
  onChangeCadenceWpm,
  targetDurationSec,
  onChangeTargetDurationSec,
  bgMusicDurationSec,
  onApplyPoem,
  onAppendPoem,
  onClose,
  addToast,
}) => {
  const [movement, setMovement] = useState<string>(LITERARY_MOVEMENTS[0]);
  const [form, setForm] = useState<string>(POETIC_FORMS[0]);
  const [targetLanguage, setTargetLanguage] = useState<string>(language);
  const [includeMarkers, setIncludeMarkers] = useState<boolean>(true);
  const [localCadenceWpm, setLocalCadenceWpm] = useState<number>(cadenceWpm || 130);
  const [localTargetDurationSec, setLocalTargetDurationSec] = useState<number>(targetDurationSec ?? 30);
  const [themePrompt, setThemePrompt] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const [messages, setMessages] = useState<ExpertMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const effectiveCadence = cadenceWpm ?? localCadenceWpm;
  const effectiveDurationSec = targetDurationSec ?? localTargetDurationSec;

  const setCadence = (wpm: number) => {
    setLocalCadenceWpm(wpm);
    onChangeCadenceWpm?.(wpm);
  };

  const setDurationTarget = (sec: number) => {
    const safeSec = Math.max(0, Math.min(600, Math.round(sec || 0)));
    setLocalTargetDurationSec(safeSec);
    onChangeTargetDurationSec?.(safeSec);
  };

  const targetWordEstimate =
    effectiveDurationSec > 0
      ? Math.max(10, Math.round((effectiveDurationSec / 60) * effectiveCadence * 0.86))
      : 0;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const extractPoemBlock = (content: string): string | null => {
    const match = content.match(/```(?:poeme|poème|slam|text)?\n([\s\S]*?)```/i);
    return match ? match[1].trim() : null;
  };

  const sendToExpert = async (promptText: string, clearChatInput = false) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ExpertMessage = { role: 'user', content: trimmed };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (clearChatInput) setChatInput('');
    setIsLoading(true);

    const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();

    try {
      const res = await authFetch(
        '/api/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextHistory,
            currentText,
            mode: 'literary_expert',
            literaryContext: {
              movement,
              form,
              language: targetLanguage,
              includeMarkers,
              cadenceWpm: effectiveCadence,
              targetDurationSec: effectiveDurationSec,
            },
            apiKey: effectiveKey,
          }),
        },
        effectiveKey
      );

      const data = await safeJsonResponse<any>(res, "de l'expert littéraire");
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la consultation de l'expert littéraire.");
      }

      setMessages([
        ...nextHistory,
        { role: 'model', content: data.reply || 'Réponse reçue.' },
      ]);
    } catch (err: any) {
      const msg = err?.message || "Impossible de joindre l'assistant littéraire.";
      addToast(msg, 'error');
      setMessages([
        ...nextHistory,
        { role: 'model', content: `Erreur : ${msg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComposePoem = () => {
    const topic = themePrompt.trim() || 'la mémoire, l’oralité et l’avenir';
    const timingRule =
      effectiveDurationSec > 0
        ? ` Calibre la longueur pour une durée d’environ ${effectiveDurationSec} secondes à une cadence de ${effectiveCadence} mots/min (environ ${targetWordEstimate} mots parlés, vers courts lisibles en sous-titres smartphone 9:16).`
        : ` Calibre la métrique pour une déclamation fluide à ${effectiveCadence} mots/min.`;
    const prompt = `Compose un texte original dans le courant « ${movement} » et la forme « ${form} » (langue : ${targetLanguage}) sur le thème : « ${topic} ».${timingRule}${
      includeMarkers
        ? ' Intègre naturellement les marqueurs scéniques VoxArt ([respiration], [pause], [emphase]...[/emphase], [crescendo]...[/crescendo] ou —) pour guider l’interprétation orale.'
        : ''
    } Explique brièvement les choix stylistiques et place le poème prêt à être déclamé dans un bloc \`\`\`poeme.`;
    sendToExpert(prompt);
  };

  const handleAdaptToCadenceAndDuration = () => {
    if (!currentText.trim()) {
      addToast("Saisissez ou composez d'abord un poème dans l'éditeur avant de l'adapter.", 'info');
      return;
    }
    const targetSec = effectiveDurationSec > 0 ? effectiveDurationSec : 30;
    const targetWords = Math.max(10, Math.round((targetSec / 60) * effectiveCadence * 0.86));
    const prompt = `Adapte et rééquilibre mon poème actuel pour qu'il dure précisément ~${targetSec} secondes lorsqu'il est déclamé à une cadence de ${effectiveCadence} mots/min (soit environ ${targetWords} mots parlés au total, hors balises entre crochets), tout en préservant l'âme, le courant (« ${movement} ») et la musicalité. Découpe en vers courts (6 à 10 mots par ligne) pour un rendu optimal en sous-titres 9:16.${
      includeMarkers
        ? ' Conserve ou ajuste les marqueurs [respiration], [pause] et [emphase]...[/emphase] pour soutenir le souffle.'
        : ''
    } Place la version adaptée dans un bloc \`\`\`poeme.`;
    sendToExpert(prompt);
  };

  const handleAnalyzeCurrent = () => {
    if (!currentText.trim()) {
      addToast("Écrivez ou importez d'abord un texte dans l'éditeur pour l'analyser.", 'info');
      return;
    }
    const prompt = `Analyse mon texte actuel sur le plan littéraire (courant artistique, métrique, rimes, figures de style, musicalité orale et souffle à ${effectiveCadence} mpm). Propose ensuite une version enrichie et sublimée dans l'esprit « ${movement} » placée dans un bloc \`\`\`poeme.`;
    sendToExpert(prompt);
  };

  const handleExploreHistory = () => {
    const prompt = `Présente-moi l'histoire, les figures majeures, l'esthétique et les techniques d'écriture du courant « ${movement} », ainsi que des conseils concrets pour écrire un texte authentique dans ce style.`;
    sendToExpert(prompt);
  };

  const handleCopy = async (content: string, idx: number) => {
    const poem = extractPoemBlock(content) || content;
    const ok = await copyTextToClipboard(poem);
    if (ok) {
      setCopiedIdx(idx);
      addToast('Poème copié dans le presse-papier !', 'success');
      setTimeout(() => setCopiedIdx(null), 2000);
    }
  };

  return (
    <div className="bg-[#181825] border border-[#cba6f7]/45 rounded-2xl p-4 space-y-3.5 shadow-xl">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-[#313244]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#cba6f7]/20 border border-[#cba6f7]/40 text-[#cba6f7] flex items-center justify-center shrink-0">
            <Feather className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-[#cba6f7]">
              Assistant Expert · Littérature, Histoire & Poésie
            </h3>
            <p className="text-[11px] text-[#a6adc8]">
              Maîtrise des courants artistiques, prosodie, métrique, figures de style & slam scénique.
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'assistant littéraire"
            className="p-1.5 rounded-lg bg-[#11111b] text-[#a6adc8] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sélecteurs de courant artistique & forme littéraire */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-[#a6adc8] mb-1">
            Courant littéraire & artistique
          </label>
          <select
            value={movement}
            onChange={(e) => setMovement(e.target.value)}
            className="w-full p-2 rounded-xl bg-[#11111b] border border-[#313244] text-[11px] text-[#cdd6f4] focus:outline-none focus:border-[#cba6f7]"
          >
            {LITERARY_MOVEMENTS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-[#a6adc8] mb-1">
            Forme & métrique
          </label>
          <select
            value={form}
            onChange={(e) => setForm(e.target.value)}
            className="w-full p-2 rounded-xl bg-[#11111b] border border-[#313244] text-[11px] text-[#cdd6f4] focus:outline-none focus:border-[#cba6f7]"
          >
            {POETIC_FORMS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-[#a6adc8] mb-1">
            Langue d’écriture
          </label>
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            className="w-full p-2 rounded-xl bg-[#11111b] border border-[#313244] text-[11px] text-[#cdd6f4] focus:outline-none focus:border-[#cba6f7]"
          >
            <option value="Français">Français</option>
            <option value="Wolof et Français (bilingue)">Wolof & Français</option>
            <option value="Anglais">Anglais</option>
          </select>
        </div>
      </div>

      {/* Thème + Options */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={themePrompt}
          onChange={(e) => setThemePrompt(e.target.value)}
          placeholder="Thème, image, émotion ou consigne (ex: l'exil et la lumière du matin)..."
          className="flex-1 px-3 py-2 rounded-xl bg-[#11111b] border border-[#313244] text-xs text-[#cdd6f4] placeholder:text-[#6c7086] focus:outline-none focus:border-[#cba6f7]"
        />
        <label className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#11111b] border border-[#313244] text-[11px] text-[#cdd6f4] cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={includeMarkers}
            onChange={(e) => setIncludeMarkers(e.target.checked)}
            className="accent-[#cba6f7]"
          />
          <span>Marqueurs souffle/emphase</span>
        </label>
      </div>

      {/* Calibrage Cadence & Durée Cible */}
      <div className="p-2.5 rounded-xl bg-[#11111b] border border-[#313244] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[#f59e0b] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Calibrage Cadence & Durée</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {bgMusicDurationSec && bgMusicDurationSec >= 5 && (
              <button
                type="button"
                onClick={() => setDurationTarget(Math.round(bgMusicDurationSec))}
                className="px-2 py-0.5 rounded-md bg-[#89b4fa]/15 border border-[#89b4fa]/40 text-[#89b4fa] text-[10px] font-semibold cursor-pointer hover:bg-[#89b4fa]/25"
              >
                Caler sur musique ({formatMinutesSeconds(bgMusicDurationSec)})
              </button>
            )}
            <span className="text-[10px] font-mono text-[#a6adc8]">
              {effectiveDurationSec > 0
                ? `≈ ${targetWordEstimate} mots (${formatMinutesSeconds(effectiveDurationSec)} à ${effectiveCadence} mpm)`
                : `Cadence ${effectiveCadence} mpm · Durée libre`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-[#a6adc8] shrink-0">Cadence :</label>
            <select
              value={effectiveCadence}
              onChange={(e) => setCadence(Number(e.target.value))}
              className="flex-1 p-1.5 rounded-lg bg-[#181825] border border-[#313244] text-[11px] text-[#cdd6f4]"
            >
              {SLAM_CADENCE_PRESETS.map((p) => (
                <option key={p.id} value={p.wpm}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-[#a6adc8] shrink-0">Durée cible :</label>
            <select
              value={[0, 15, 30, 45, 60, 90, 120].includes(effectiveDurationSec) ? effectiveDurationSec : -1}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 0) setDurationTarget(v);
              }}
              className="flex-1 p-1.5 rounded-lg bg-[#181825] border border-[#313244] text-[11px] text-[#cdd6f4]"
            >
              <option value={0}>Libre (sans contrainte)</option>
              <option value={15}>15s (Short / Reel rapide)</option>
              <option value={30}>30s (Slam court 9:16)</option>
              <option value={45}>45s (Slam équilibré)</option>
              <option value={60}>1 min (60s standard)</option>
              <option value={90}>1m30 (90s développé)</option>
              <option value={120}>2 min (120s intégral)</option>
              {![0, 15, 30, 45, 60, 90, 120].includes(effectiveDurationSec) && (
                <option value={-1}>Personnalisé ({effectiveDurationSec}s)</option>
              )}
            </select>
            <input
              type="number"
              min={0}
              max={600}
              step={5}
              value={effectiveDurationSec}
              onChange={(e) => setDurationTarget(Number(e.target.value))}
              aria-label="Durée cible en secondes"
              className="w-14 p-1.5 rounded-lg bg-[#181825] border border-[#313244] text-[11px] font-mono text-[#cdd6f4] text-center"
              title="Durée en secondes (0 = libre)"
            />
          </div>
        </div>
      </div>

      {/* Boutons d'action experts */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleComposePoem}
          disabled={isLoading}
          className="px-3 py-2 rounded-xl bg-[#cba6f7] hover:bg-[#d8b4fe] text-[#11111b] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>
            {effectiveDurationSec > 0
              ? `Composer (~${effectiveDurationSec}s)`
              : 'Composer un texte'}
          </span>
        </button>

        <button
          type="button"
          onClick={handleAdaptToCadenceAndDuration}
          disabled={isLoading || !currentText.trim()}
          className="px-3 py-2 rounded-xl bg-[#11111b] border border-emerald-500/45 hover:border-emerald-400 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Adapter durée & cadence</span>
        </button>

        <button
          type="button"
          onClick={handleAnalyzeCurrent}
          disabled={isLoading || !currentText.trim()}
          className="px-3 py-2 rounded-xl bg-[#11111b] border border-[#f59e0b]/45 hover:border-[#f59e0b] text-[#f59e0b] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Analyser & Sublimer</span>
        </button>

        <button
          type="button"
          onClick={handleExploreHistory}
          disabled={isLoading}
          className="px-3 py-2 rounded-xl bg-[#11111b] border border-[#89b4fa]/45 hover:border-[#89b4fa] text-[#89b4fa] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
        >
          <History className="w-3.5 h-3.5" />
          <span>Histoire du courant</span>
        </button>
      </div>

      {/* Fil de discussion littéraire */}
      {messages.length > 0 && (
        <div className="max-h-72 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-[#11111b] border border-[#313244]">
          {messages.map((msg, idx) => {
            const poemBlock = msg.role === 'model' ? extractPoemBlock(msg.content) : null;
            return (
              <div
                key={idx}
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#313244]/70 text-[#cdd6f4] ml-6'
                    : 'bg-[#1e1e2e] border border-[#cba6f7]/25 text-[#cdd6f4] mr-2'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      msg.role === 'user' ? 'text-[#89b4fa]' : 'text-[#cba6f7]'
                    }`}
                  >
                    {msg.role === 'user' ? 'Auteur' : 'Maître Littéraire'}
                  </span>
                  {msg.role === 'model' && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, idx)}
                      className="text-[10px] text-[#a6adc8] hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="w-3 h-3 text-[#a6e3a1]" />
                          <span className="text-[#a6e3a1]">Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="whitespace-pre-wrap">{msg.content}</div>

                {poemBlock && (
                  <div className="mt-2.5 pt-2 border-t border-[#313244] flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onApplyPoem(poemBlock);
                        addToast("Poème chargé dans l'éditeur !", 'success');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#a6e3a1] hover:opacity-90 text-[#11111b] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Utiliser dans l’éditeur</span>
                    </button>

                    {onAppendPoem && currentText.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          onAppendPoem(poemBlock);
                          addToast('Strophes ajoutées à la suite du texte !', 'success');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#181825] border border-[#89b4fa]/45 text-[#89b4fa] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajouter à la suite</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-[#cba6f7] p-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Rédaction & analyse littéraire en cours...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Saisie libre de question littéraire */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendToExpert(chatInput, true);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Posez une question (rimes, alexandrins, histoire du symbolisme, figure de style...)"
          className="flex-1 px-3 py-2 rounded-xl bg-[#11111b] border border-[#313244] text-xs text-[#cdd6f4] placeholder:text-[#6c7086] focus:outline-none focus:border-[#cba6f7]"
        />
        <button
          type="submit"
          disabled={isLoading || !chatInput.trim()}
          aria-label="Envoyer à l'expert littéraire"
          className="px-3.5 py-2 rounded-xl bg-[#cba6f7] text-[#11111b] font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-45"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Demander</span>
        </button>
      </form>
    </div>
  );
};
