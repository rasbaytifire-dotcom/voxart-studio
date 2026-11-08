/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, Sparkles, Image as ImageIcon, Film, Volume2, 
  Save, Copy, Check, RefreshCw, Paperclip, X, Mic, RotateCcw,
  Square, Settings, FolderPlus
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard';
import { authFetch, apiAuthStore } from '../services/apiAuth';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  attachment?: {
    mimeType: string;
    data: string;
    name: string;
    type: 'image' | 'video';
  };
}

interface UnifiedStudioWorkspaceProps {
  currentText: string;
  setCurrentText: (text: string) => void;
  apiKey?: string;
  onOpenSettings?: () => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  library: Record<string, any>;
  onSaveToLibrary: (project: string, category: 'audios' | 'texts' | 'videos', name: string, data: string) => void;
  onPreviewTTS: () => void;
  onPreviewMix: () => void;
  isGenerating: boolean;
  currentAudioUrl: string | null;
  onSpeakText?: (text: string) => void;
  onTransferToVocalStudio?: (text: string) => void;
  onSwitchToStudio?: () => void;
}

export const UnifiedStudioWorkspace: React.FC<UnifiedStudioWorkspaceProps> = ({
  currentText,
  setCurrentText,
  apiKey,
  onOpenSettings,
  addToast,
  library,
  onSaveToLibrary,
  isGenerating,
  onSpeakText,
  onTransferToVocalStudio,
  onSwitchToStudio
}) => {
  // Start with clean discussion space (no verbose agent presentation wall)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<{ mimeType: string; data: string; name: string; type: 'image' | 'video' } | null>(null);
  
  // Discrete state for message actions
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  // Save Modal state
  const [selectedProject, setSelectedProject] = useState<string>(Object.keys(library)[0] || 'Projet_Principal');
  const [saveCategory, setSaveCategory] = useState<'texts' | 'audios' | 'videos'>('texts');
  const [saveItemName, setSaveItemName] = useState('Production_RidiaLArt');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [contentToSave, setContentToSave] = useState<{ type: string; title: string; data: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Extract prompt from code blocks or explicit prompt tags
  const extractPrompt = (content: string): string | null => {
    const codeMatch = content.match(/```(?:prompt|english|text)?\n([\s\S]*?)```/i);
    if (codeMatch) return codeMatch[1].trim();

    const inlineMatch = content.match(/(?:Prompt(?:\s+Image|\s+Fixe|\s+Google\s+Flow)?\s*:)\s*([^\n]+(?:\n[^\n]+)*)/i);
    if (inlineMatch) return inlineMatch[1].trim();

    return null;
  };

  interface ContentBlock {
    type: 'text' | 'code';
    lang?: string;
    content: string;
  }

  // Parse message into text segments and code blocks for clean Gemini rendering
  const parseContentBlocks = (content: string): ContentBlock[] => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const blocks: ContentBlock[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        blocks.push({ type: 'text', content: content.slice(lastIndex, match.index) });
      }
      blocks.push({ type: 'code', lang: match[1] || 'prompt', content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      blocks.push({ type: 'text', content: content.slice(lastIndex) });
    }

    return blocks.length > 0 ? blocks : [{ type: 'text', content }];
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      addToast("Veuillez importer un fichier image ou vidéo valide.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      setAttachment({
        mimeType: file.type,
        data: base64String,
        name: file.name,
        type: isVideo ? 'video' : 'image'
      });
      addToast(`Média "${file.name}" attaché pour analyse`, "success");
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend !== undefined ? textToSend : input).trim();
    if ((!query && !attachment) || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: query || (attachment ? `Analyse ce fichier ${attachment.type === 'video' ? 'vidéo' : 'image'} (${attachment.name})` : ''),
      attachment: attachment || undefined
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (textToSend === undefined) setInput('');
    setAttachment(null);
    setIsLoading(true);

    const effectiveKey = (apiKey && apiKey.trim()) || apiAuthStore.getKey();

    try {
      const res = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: newMessages,
          currentText: currentText,
          apiKey: effectiveKey
        })
      }, effectiveKey);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur de communication avec l'agent.");
      }

      setMessages([...newMessages, { role: 'model', content: data.reply }]);
    } catch (err: any) {
      console.error("Chat error:", err);
      const rawMsg = err.message || "Impossible de joindre l'agent IA.";
      const isQuota = rawMsg.includes("quota") || rawMsg.includes("RESOURCE_EXHAUSTED") || rawMsg.includes("429");
      
      const displayMsg = isQuota
        ? "⚠️ Le quota journalier gratuit de l'API Google Gemini est temporairement atteint. Vous pouvez renseigner votre propre clé API Gemini (gratuite sur aistudio.google.com) dans les Paramètres pour continuer immédiatement sans limite."
        : `Désolé, une erreur est survenue: ${rawMsg}`;
      
      addToast(isQuota ? "Quota Gemini atteint. Renseignez votre clé API dans les Paramètres." : rawMsg, 'error');
      setMessages([...newMessages, { role: 'model', content: displayMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyText = async (textToCopy: string, key: string, label = "Texte copié !") => {
    const success = await copyTextToClipboard(textToCopy);
    if (success) {
      setCopiedKey(key);
      addToast(label, "success");
      setTimeout(() => setCopiedKey(null), 2500);
    } else {
      addToast("Échec de la copie. Veuillez sélectionner et copier manuellement.", "error");
    }
  };

  const handleTransfer = (targetText: string) => {
    if (onTransferToVocalStudio) {
      onTransferToVocalStudio(targetText);
    } else {
      setCurrentText(targetText);
      addToast("Texte transféré dans le Studio Vocal !", "success");
    }
  };

  const handleListen = (textToListen: string, idx: number) => {
    if (speakingIndex === idx) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingIndex(null);
      return;
    }

    setSpeakingIndex(idx);

    if (onSpeakText) {
      const cleanText = textToListen.replace(/```[\s\S]*?```/g, '').trim() || textToListen;
      onSpeakText(cleanText);
      addToast("Écoute de la réponse en cours...", "info");
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToListen.replace(/```[\s\S]*?```/g, ''));
      utterance.lang = 'fr-FR';
      utterance.rate = 1.0;
      utterance.onend = () => setSpeakingIndex(null);
      utterance.onerror = () => setSpeakingIndex(null);
      window.speechSynthesis.speak(utterance);
    } else {
      addToast("Synthèse vocale non disponible sur cet appareil.", "error");
      setSpeakingIndex(null);
    }
  };

  const openSaveDialog = (title: string, data: string, defaultCat: 'texts' | 'audios' | 'videos') => {
    setContentToSave({ type: defaultCat, title, data });
    setSaveItemName(title.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30));
    setSaveCategory(defaultCat);
    setShowSaveModal(true);
  };

  const handleConfirmSave = () => {
    if (!contentToSave) return;
    const targetProj = selectedProject || 'Projet_Principal';
    onSaveToLibrary(targetProj, saveCategory, saveItemName || 'Production_VoxArt', contentToSave.data);
    addToast(`Élément "${saveItemName}" enregistré dans "${targetProj}" !`, "success");
    setShowSaveModal(false);
    setContentToSave(null);
  };

  const quickSuggestions = [
    {
      title: "💡 Analyser mon idée",
      desc: "Posez votre concept, l'agent l'analyse avec rigueur",
      prompt: "Voici mon idée : "
    },
    {
      title: "🎙️ Créer un script vocal",
      desc: "Conte ou texte avec indication du ton pour Text-to-Audio",
      prompt: "Rédige un conte initiatique traditionnel pour le studio vocal avec le ton adapté."
    },
    {
      title: "🎨 Créer un prompt d'image",
      desc: "Prompt cinématique pour image fixe (Anglais)",
      prompt: "Crée un prompt d'image fixe cinématique inspiré de la charte RidiaLArt pour illustrer : "
    }
  ];

  return (
    <div className="bg-[#181825] border border-[#313244] rounded-2xl flex flex-col h-[650px] shadow-2xl overflow-hidden">
      {/* Top Bar - Clean & Discrete Gemini Style */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e1e2e]/90 border-b border-[#313244]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#89b4fa]/20 border border-[#89b4fa]/30 flex items-center justify-center text-[#89b4fa]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#cdd6f4]">Discussion IA</span>
            <span className="text-[10px] text-[#a6adc8] ml-2 font-mono">Gemini Flash • RidiaLArt</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onSwitchToStudio && (
             <button
                onClick={onSwitchToStudio}
                className="p-1.5 rounded-lg hover:bg-[#313244] text-[#a6adc8] hover:text-[#89b4fa] transition-all text-xs flex items-center gap-1"
                title="Retourner au Studio Vocal"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Studio Vocal</span>
              </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setAttachment(null);
              }}
              className="p-1.5 rounded-lg hover:bg-[#313244] text-[#a6adc8] hover:text-[#cdd6f4] transition-all text-xs flex items-center gap-1"
              title="Nouvelle discussion"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Effacer</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg hover:bg-[#313244] text-[#a6adc8] hover:text-[#cdd6f4] transition-all"
              title="Paramètres de l'agent"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Discussion Messages Flow */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 max-w-lg mx-auto space-y-4 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#89b4fa]/20 to-[#cba6f7]/20 border border-[#89b4fa]/30 flex items-center justify-center text-[#89b4fa] shadow-lg">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#cdd6f4]">Que souhaitez-vous explorer ?</h3>
              <p className="text-xs text-[#a6adc8] mt-1">
                Présentez votre idée pour analyse, demandez un script vocal formaté en bloc, ou un prompt d'image/animation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full pt-1">
              {quickSuggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInput(s.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="p-2.5 rounded-xl bg-[#1e1e2e] hover:bg-[#313244] border border-[#313244] text-left transition-all group shadow-sm"
                >
                  <div className="text-[11px] font-bold text-[#cdd6f4] group-hover:text-[#89b4fa]">{s.title}</div>
                  <div className="text-[10px] text-[#6c7086] mt-0.5 line-clamp-2">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isolatedPrompt = msg.role === 'model' ? extractPrompt(msg.content) : null;
            const contentBlocks = parseContentBlocks(msg.content);

            return (
              <div 
                key={idx} 
                className={`flex gap-3 items-start animate-fadeIn ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-[#cba6f7]/20 text-[#cba6f7] border border-[#cba6f7]/30 text-xs font-bold' 
                    : 'bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/30'
                }`}>
                  {msg.role === 'user' ? 'Vous' : <Sparkles className="w-3.5 h-3.5" />}
                </div>

                {/* Message Bubble & Content */}
                <div className={`max-w-[85%] rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#313244] text-[#cdd6f4] px-4 py-2.5 rounded-tr-none'
                    : 'text-[#cdd6f4] space-y-3 w-full'
                }`}>
                  {/* Media attachment badge if any */}
                  {msg.attachment && (
                    <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2 text-xs font-mono mb-2">
                      {msg.attachment.type === 'video' ? <Film className="w-4 h-4 text-[#89b4fa]" /> : <ImageIcon className="w-4 h-4 text-[#a6e3a1]" />}
                      <span className="truncate text-white">{msg.attachment.name}</span>
                    </div>
                  )}

                  {/* Render content blocks (Text and Code/Prompt Blocks) */}
                  <div className="space-y-3">
                    {contentBlocks.map((block, bIdx) => {
                      if (block.type === 'code') {
                        const blockKey = `code_${idx}_${bIdx}`;
                        const isPromptLang = block.lang === 'prompt' || block.lang === 'english';
                        const isTextLang = block.lang === 'text' || block.lang === 'script';

                        return (
                          <div key={bIdx} className="rounded-xl border border-[#45475a] bg-[#11111b] overflow-hidden my-2 shadow-md">
                            {/* Code / Prompt Top Bar */}
                            <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e1e2e] border-b border-[#313244] text-[11px] gap-2 flex-wrap">
                              <span className="font-mono text-[#89b4fa] font-bold uppercase truncate">
                                {isPromptLang ? 'PROMPT ISOLÉ (ANGLAIS)' : isTextLang ? 'SCRIPT / TEXTE VOCAL' : `BLOC / ${block.lang}`}
                              </span>

                              <div className="flex items-center gap-1.5">
                                {/* Copy Block Button */}
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(block.content, blockKey, isPromptLang ? "Prompt copié !" : "Texte copié !")}
                                  className="flex items-center gap-1 text-[#a6adc8] hover:text-white px-2 py-1 rounded bg-[#313244] hover:bg-[#45475a] transition-all font-mono font-medium"
                                  title="Copier le bloc"
                                >
                                  {copiedKey === blockKey ? <Check className="w-3.5 h-3.5 text-[#a6e3a1]" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedKey === blockKey ? 'Copié !' : 'Copier'}</span>
                                </button>

                                {/* Direct Transfer to Vocal Studio (Text to Audio) */}
                                <button
                                  type="button"
                                  onClick={() => handleTransfer(block.content)}
                                  className="flex items-center gap-1 bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] px-2.5 py-1 rounded font-bold text-[11px] transition-all shadow-sm"
                                  title="Coller dans le Studio Vocal (Text-to-Audio) et appliquer le ton adapté"
                                >
                                  <Mic className="w-3 h-3" />
                                  <span>🎙️ Coller dans Text-to-Audio</span>
                                </button>
                              </div>
                            </div>

                            {/* Block Content */}
                            <pre className="p-3 text-xs font-mono text-[#a6e3a1] overflow-x-auto whitespace-pre-wrap select-all leading-relaxed">
                              {block.content}
                            </pre>
                          </div>
                        );
                      }
                      return (
                        <div key={bIdx} className="whitespace-pre-wrap leading-relaxed">
                          {block.content}
                        </div>
                      );
                    })}

                    {msg.role === 'model' && msg.content.includes("Paramètres") && onOpenSettings && (
                      <button
                        type="button"
                        onClick={onOpenSettings}
                        className="w-full mt-2 py-2 px-3 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>⚙️ Renseigner ma clé API Gemini dans les Paramètres</span>
                      </button>
                    )}
                  </div>

                  {/* Discrete Action Buttons Row (Gemini Style) */}
                  {msg.role === 'model' && (
                    <div className="pt-2 flex items-center gap-1.5 sm:gap-2 flex-wrap border-t border-[#313244]/60 text-[11px] text-[#a6adc8]">
                      {/* Discrete Listen button */}
                      <button
                        type="button"
                        onClick={() => handleListen(msg.content, idx)}
                        disabled={isGenerating}
                        className={`p-1.5 rounded-lg hover:bg-[#313244] transition-all flex items-center gap-1 ${
                          speakingIndex === idx ? 'text-[#89b4fa] bg-[#313244] font-bold' : 'hover:text-[#cdd6f4]'
                        }`}
                        title="Écouter la réponse"
                      >
                        {isGenerating && speakingIndex === idx ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : speakingIndex === idx ? (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">Écouter</span>
                      </button>

                      {/* Discrete Copy Prompt button if isolated prompt exists */}
                      {isolatedPrompt && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(isolatedPrompt, `prompt_${idx}`, "Prompt copié !")}
                          className="p-1.5 rounded-lg hover:bg-[#313244] hover:text-[#89b4fa] transition-all flex items-center gap-1 font-medium"
                          title="Copier le prompt isolé"
                        >
                          {copiedKey === `prompt_${idx}` ? <Check className="w-3.5 h-3.5 text-[#a6e3a1]" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>Copier le prompt</span>
                        </button>
                      )}

                      {/* Discrete Copy Full Text button */}
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.content, `full_${idx}`, "Réponse copiée !")}
                        className="p-1.5 rounded-lg hover:bg-[#313244] hover:text-[#cdd6f4] transition-all flex items-center gap-1"
                        title="Copier toute la réponse"
                      >
                        {copiedKey === `full_${idx}` ? <Check className="w-3.5 h-3.5 text-[#a6e3a1]" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{isolatedPrompt ? 'Tout copier' : 'Copier'}</span>
                      </button>

                      {/* Transfer to Vocal Studio (Text-to-Audio) */}
                      <button
                        type="button"
                        onClick={() => {
                          const targetText = isolatedPrompt || (contentBlocks.find(b => b.type === 'code')?.content) || msg.content;
                          handleTransfer(targetText);
                        }}
                        className="p-1.5 rounded-lg hover:bg-[#313244] text-[#89b4fa] hover:text-[#b4befe] font-semibold transition-all flex items-center gap-1"
                        title="Coller dans le Studio Vocal (Text-to-Audio) avec respect du ton"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>🎙️ Coller dans Text-to-Audio</span>
                      </button>

                      {/* Save to Library */}
                      <button
                        type="button"
                        onClick={() => openSaveDialog(isolatedPrompt ? "Prompt_RidiaLArt" : "Reponse_Agent", msg.content, isolatedPrompt ? 'videos' : 'texts')}
                        className="p-1.5 rounded-lg hover:bg-[#313244] hover:text-[#a6e3a1] transition-all flex items-center gap-1"
                        title="Enregistrer dans un projet"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Enregistrer</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 items-start animate-fadeIn">
            <div className="w-7 h-7 rounded-xl bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 rounded-2xl bg-[#1e1e2e] border border-[#313244] text-xs text-[#a6adc8] flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#89b4fa]" />
              <span>Analyse en cours...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Preview Chip */}
      {attachment && (
        <div className="px-4 py-2 bg-[#1e1e2e] border-t border-[#313244] flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2 text-[#cdd6f4]">
            {attachment.type === 'video' ? <Film className="w-3.5 h-3.5 text-[#89b4fa]" /> : <ImageIcon className="w-3.5 h-3.5 text-[#a6e3a1]" />}
            <span className="truncate font-mono text-[11px] max-w-[280px]">{attachment.name}</span>
          </div>
          <button 
            type="button"
            onClick={() => setAttachment(null)} 
            className="p-1 rounded hover:bg-white/10 text-[#a6adc8] hover:text-white"
            title="Retirer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Gemini Style Input Bar */}
      <div className="p-3 sm:p-4 bg-[#1e1e2e]/95 border-t border-[#313244]">
        <div className="flex items-end gap-2 bg-[#181825] border border-[#313244] focus-within:border-[#89b4fa]/70 rounded-2xl px-3 py-2 transition-all shadow-inner">
          {/* File Attachment Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl text-[#a6adc8] hover:text-[#89b4fa] hover:bg-[#313244] transition-all shrink-0 mb-0.5"
            title="Joindre une image ou vidéo à analyser"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={attachment ? "Posez une question sur ce média..." : "Posez une question ou présentez votre idée..."}
            className="flex-1 bg-transparent text-[#cdd6f4] text-xs sm:text-sm placeholder-[#6c7086] focus:outline-none resize-none max-h-32 py-1 leading-relaxed"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isLoading || (!input.trim() && !attachment)}
            className="p-2 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] disabled:opacity-30 disabled:hover:bg-[#89b4fa] transition-all shrink-0 shadow-sm mb-0.5"
            title="Envoyer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && contentToSave && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1e1e2e] border border-[#45475a] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#313244] pb-3">
              <h3 className="text-sm font-bold text-[#cdd6f4] flex items-center gap-2">
                <Save className="w-4 h-4 text-[#a6e3a1]" />
                <span>Enregistrer dans la Bibliothèque</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowSaveModal(false)} 
                className="text-[#a6adc8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#a6adc8] mb-1 font-semibold">Titre de l'enregistrement :</label>
                <input
                  type="text"
                  value={saveItemName}
                  onChange={(e) => setSaveItemName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] focus:outline-none focus:border-[#89b4fa]"
                />
              </div>

              <div>
                <label className="block text-[#a6adc8] mb-1 font-semibold">Rubrique (Catégorie) :</label>
                <select
                  value={saveCategory}
                  onChange={(e: any) => setSaveCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4]"
                >
                  <option value="texts">📚 Textes & Scripts</option>
                  <option value="videos">🎬 Prompts d'Images & Vidéos (9:16)</option>
                  <option value="audios">🎵 Pistes Audio (TTS / Mix)</option>
                </select>
              </div>

              <div>
                <label className="block text-[#a6adc8] mb-1 font-semibold">Projet Cible :</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4]"
                >
                  {Object.keys(library).length === 0 ? (
                    <option value="Projet_Principal">Projet Principal</option>
                  ) : (
                    Object.keys(library).map(proj => (
                      <option key={proj} value={proj}>{proj}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#313244]">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-[#313244] text-[#a6adc8] hover:text-white text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-4 py-2 rounded-xl bg-[#a6e3a1] text-[#11111b] font-bold text-xs hover:bg-[#b4f8c8] shadow-md"
              >
                Confirmer l'Enregistrement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
