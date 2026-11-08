/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, X, RefreshCw, Paperclip, Film, 
  Image as ImageIcon, Settings, Volume2, Copy, Check, Square, Mic, Key, ShieldCheck, AlertCircle
} from 'lucide-react';
import { copyTextToClipboard } from '../utils/clipboard';
import { useApiAuth, authFetch, apiAuthStore } from '../services/apiAuth';

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

interface AIAgentChatProps {
  currentText: string;
  apiKey?: string;
  onOpenSettings?: () => void;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onTransferToVocalStudio?: (text: string) => void;
}

export const AIAgentChat: React.FC<AIAgentChatProps> = ({ 
  currentText, 
  apiKey, 
  onOpenSettings, 
  addToast,
  onTransferToVocalStudio 
}) => {
  const { apiKey: centralizedKey, isValidKey, setApiKey: setCentralizedKey, backendStatus } = useApiAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [keyInputVal, setKeyInputVal] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<{ mimeType: string; data: string; name: string; type: 'image' | 'video' } | null>(null);
  
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronize key input value with current effective key
  useEffect(() => {
    const currentActive = centralizedKey || apiKey || '';
    if (currentActive && !keyInputVal) {
      setKeyInputVal(currentActive);
    }
  }, [centralizedKey, apiKey]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

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
      addToast(`Média "${file.name}" attaché pour analyse.`, "success");
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

    // Guaranteed key extraction from centralized state, falling back to memory/session/props
    const effectiveKey = (centralizedKey && centralizedKey.trim()) || (apiKey && apiKey.trim()) || apiAuthStore.getKey();

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
        throw new Error(data.error || 'Erreur lors de la communication avec l\'agent IA.');
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

  const handleListen = (textToListen: string, idx: number) => {
    if (speakingIndex === idx) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingIndex(null);
      return;
    }

    setSpeakingIndex(idx);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = textToListen.replace(/```[\s\S]*?```/g, '').trim() || textToListen;
      const utterance = new SpeechSynthesisUtterance(cleanText);
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

  const handleCopy = async (text: string, key: string, label = "Texte copié !") => {
    const success = await copyTextToClipboard(text);
    if (success) {
      setCopiedKey(key);
      addToast(label, "success");
      setTimeout(() => setCopiedKey(null), 2500);
    } else {
      addToast("Échec de la copie.", "error");
    }
  };

  const handleTransferToStudio = (textToTransfer: string) => {
    if (onTransferToVocalStudio) {
      onTransferToVocalStudio(textToTransfer);
      setIsOpen(false); // Close chat to reveal vocal studio
    } else {
      addToast("Studio Vocal non configuré.", "error");
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 bg-[#1e1e2e] hover:bg-[#28293d] text-[#cdd6f4] px-3.5 py-3 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 font-medium border border-[#45475a]"
          title="Ouvrir la discussion IA"
        >
          <Sparkles className="w-4 h-4 text-[#89b4fa]" />
          <span className="text-xs font-semibold">Discussion IA</span>
        </button>
      )}

      {/* Chat Window Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[94vw] sm:w-[440px] h-[580px] bg-[#1e1e2e] border border-[#45475a] rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#181825] border-b border-[#313244]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#89b4fa]" />
              <span className="text-xs font-bold text-[#cdd6f4]">Discussion IA</span>
              <span className="text-[10px] text-[#a6adc8] font-mono">Gemini Flash</span>

              {/* Centralized Key Status Badge */}
              {(isValidKey || backendStatus.hasKey) ? (
                <button
                  type="button"
                  onClick={() => setShowKeyConfig(prev => !prev)}
                  className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono hover:bg-emerald-500/25 transition-all"
                  title="Clé API active et vérifiée. Cliquez pour modifier."
                >
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>Auth ✓</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowKeyConfig(prev => !prev)}
                  className="inline-flex items-center gap-1 text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-mono hover:bg-amber-500/25 transition-all animate-pulse"
                  title="Aucune clé API configurée. Cliquez pour renseigner votre clé."
                >
                  <Key className="w-2.5 h-2.5" />
                  <span>Clé requise</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowKeyConfig(prev => !prev)}
                className={`p-1.5 rounded-lg transition-all ${
                  showKeyConfig ? 'bg-[#89b4fa]/20 text-[#89b4fa]' : 'hover:bg-white/10 text-[#a6adc8] hover:text-white'
                }`}
                title="Gérer la clé API Gemini"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-[#a6adc8] hover:text-white transition-all"
                  title="Paramètres complets"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#a6adc8] hover:text-white transition-all"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inline Centralized Key Configuration Panel */}
          {showKeyConfig && (
            <div className="p-3 bg-[#181825] border-b border-[#313244] flex flex-col gap-2 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#89b4fa]">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  <span>Gestion Centralisée de la Clé API Gemini</span>
                </span>
                <button
                  onClick={() => setShowKeyConfig(false)}
                  className="text-[#a6adc8] hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  value={keyInputVal}
                  onChange={(e) => setKeyInputVal(e.target.value)}
                  placeholder="Collez votre clé Gemini (ex: AIzaSy... ou AQ...)"
                  className="flex-1 p-2 rounded-xl bg-[#313244] text-[#cdd6f4] text-xs border border-[#45475a] focus:outline-none focus:border-[#89b4fa]"
                />
                <button
                  onClick={() => {
                    const clean = keyInputVal.trim();
                    setCentralizedKey(clean);
                    addToast(clean ? "✓ Clé API synchronisée avec succès !" : "Clé API réinitialisée", "success");
                    setShowKeyConfig(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-xs shrink-0 cursor-pointer shadow-sm transition-all"
                >
                  Valider
                </button>
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#a6adc8]">
                <span>État : {isValidKey ? '✓ Clé valide en mémoire active' : backendStatus.hasKey ? '✓ Clé serveur active' : '⚠️ Non configurée'}</span>
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#89b4fa] underline hover:text-[#b4befe]"
                >
                  Obtenir une clé gratuite
                </a>
              </div>
            </div>
          )}

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#11111b]/50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2">
                <Sparkles className="w-8 h-8 text-[#89b4fa]/60 mb-1" />
                <div className="text-xs font-bold text-[#cdd6f4]">Que souhaitez-vous explorer ?</div>
                <div className="text-[11px] text-[#a6adc8]">
                  Présentez une idée pour analyse ou demandez un script vocal formaté en un bloc avec son ton adapté.
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isolatedPrompt = msg.role === 'model' ? extractPrompt(msg.content) : null;
                const blocks = parseContentBlocks(msg.content);

                return (
                  <div
                    key={idx}
                    className={`flex gap-2.5 items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] ${
                      msg.role === 'user' ? 'bg-[#cba6f7]/20 text-[#cba6f7] border border-[#cba6f7]/30' : 'bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/30'
                    }`}>
                      {msg.role === 'user' ? 'Vous' : <Sparkles className="w-3 h-3" />}
                    </div>

                    <div className={`max-w-[85%] rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#313244] text-[#cdd6f4] p-3 rounded-tr-none'
                        : 'text-[#cdd6f4] space-y-2 w-full'
                    }`}>
                      {msg.attachment && (
                        <div className="p-1.5 rounded-lg bg-black/40 border border-white/10 flex items-center gap-1.5 text-[11px] font-mono mb-1.5">
                          {msg.attachment.type === 'video' ? <Film className="w-3.5 h-3.5 text-[#89b4fa]" /> : <ImageIcon className="w-3.5 h-3.5 text-[#a6e3a1]" />}
                          <span className="truncate text-white">{msg.attachment.name}</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        {blocks.map((b, bIdx) => {
                          const blockKey = `popup_${idx}_${bIdx}`;
                          if (b.type === 'code') {
                            const isPrompt = b.lang === 'prompt' || b.lang === 'english';
                            const isText = b.lang === 'text' || b.lang === 'script';

                            return (
                              <div key={bIdx} className="rounded-xl border border-[#45475a] bg-[#11111b] overflow-hidden my-1.5 shadow-sm">
                                <div className="flex items-center justify-between px-2.5 py-1 bg-[#1e1e2e] border-b border-[#313244] text-[10px] gap-1 flex-wrap">
                                  <span className="font-mono text-[#89b4fa] font-bold">
                                    {isPrompt ? 'PROMPT ISOLÉ' : isText ? 'SCRIPT / TEXTE VOCAL' : `BLOC / ${b.lang}`}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleCopy(b.content, blockKey, isPrompt ? "Prompt copié !" : "Texte copié !")}
                                      className="flex items-center gap-1 text-[#a6adc8] hover:text-white px-2 py-0.5 rounded bg-[#313244] hover:bg-[#45475a] font-mono"
                                      title="Copier le bloc"
                                    >
                                      {copiedKey === blockKey ? <Check className="w-3 h-3 text-[#a6e3a1]" /> : <Copy className="w-3 h-3" />}
                                      <span>{copiedKey === blockKey ? 'Copié' : 'Copier'}</span>
                                    </button>

                                    {onTransferToVocalStudio && (
                                      <button
                                        onClick={() => handleTransferToStudio(b.content)}
                                        className="flex items-center gap-1 bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] px-2 py-0.5 rounded font-bold transition-all shadow-sm"
                                        title="Coller dans le Studio Vocal et appliquer le ton"
                                      >
                                        <Mic className="w-3 h-3" />
                                        <span>🎙️ Coller dans Studio Vocal</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <pre className="p-2.5 text-[11px] font-mono text-[#a6e3a1] overflow-x-auto whitespace-pre-wrap select-all leading-relaxed">
                                  {b.content}
                                </pre>
                              </div>
                            );
                          }
                          return <div key={bIdx} className="whitespace-pre-wrap">{b.content}</div>;
                        })}

                        {msg.role === 'model' && msg.content.includes("Paramètres") && (
                          <div className="flex flex-col gap-1.5 mt-2">
                            <button
                              onClick={() => setShowKeyConfig(true)}
                              className="w-full py-1.5 px-2.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] text-[#11111b] font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>🔑 Configurer ma clé API Gemini ici</span>
                            </button>
                            {onOpenSettings && (
                              <button
                                onClick={onOpenSettings}
                                className="w-full py-1.5 px-2.5 rounded-xl bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] font-medium text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Settings className="w-3.5 h-3.5" />
                                <span>Ouvrir les Paramètres complets</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Discrete Buttons Row */}
                      {msg.role === 'model' && (
                        <div className="pt-1.5 flex items-center gap-1.5 border-t border-[#313244]/60 text-[10px] text-[#a6adc8] flex-wrap">
                          <button
                            onClick={() => handleListen(msg.content, idx)}
                            className="p-1 rounded hover:bg-[#313244] hover:text-[#cdd6f4] flex items-center gap-1"
                            title="Écouter"
                          >
                            {speakingIndex === idx ? <Square className="w-3 h-3 fill-current text-[#89b4fa]" /> : <Volume2 className="w-3 h-3" />}
                            <span>Écouter</span>
                          </button>

                          {isolatedPrompt && (
                            <button
                              onClick={() => handleCopy(isolatedPrompt, `p_${idx}`, "Prompt copié !")}
                              className="p-1 rounded hover:bg-[#313244] hover:text-[#89b4fa] flex items-center gap-1 font-medium"
                              title="Copier le prompt"
                            >
                              {copiedKey === `p_${idx}` ? <Check className="w-3 h-3 text-[#a6e3a1]" /> : <Copy className="w-3 h-3" />}
                              <span>Prompt</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleCopy(msg.content, `m_${idx}`, "Réponse copiée !")}
                            className="p-1 rounded hover:bg-[#313244] hover:text-[#cdd6f4] flex items-center gap-1"
                            title="Copier le message"
                          >
                            {copiedKey === `m_${idx}` ? <Check className="w-3 h-3 text-[#a6e3a1]" /> : <Copy className="w-3 h-3" />}
                            <span>Copier</span>
                          </button>

                          {onTransferToVocalStudio && (
                            <button
                              onClick={() => {
                                const target = isolatedPrompt || (blocks.find(b => b.type === 'code')?.content) || msg.content;
                                handleTransferToStudio(target);
                              }}
                              className="p-1 rounded hover:bg-[#313244] text-[#89b4fa] hover:text-[#b4befe] flex items-center gap-1 font-semibold"
                              title="Coller dans le Studio Vocal (Text-to-Audio) avec son ton"
                            >
                              <Mic className="w-3 h-3" />
                              <span>🎙️ Coller dans Studio Vocal</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isLoading && (
              <div className="flex gap-2.5 items-start">
                <div className="w-6 h-6 rounded-lg bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3" />
                </div>
                <div className="bg-[#313244] p-2.5 rounded-2xl rounded-tl-none text-xs text-[#a6adc8] flex items-center gap-2">
                  <RefreshCw className="w-3 h-3 animate-spin text-[#89b4fa]" />
                  <span>Analyse en cours...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment Preview */}
          {attachment && (
            <div className="px-3 py-1.5 bg-[#181825] border-t border-[#313244] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#cdd6f4]">
                {attachment.type === 'video' ? <Film className="w-3.5 h-3.5 text-[#89b4fa]" /> : <ImageIcon className="w-3.5 h-3.5 text-[#a6e3a1]" />}
                <span className="truncate font-mono text-[11px] max-w-[260px]">{attachment.name}</span>
              </div>
              <button
                onClick={() => setAttachment(null)}
                className="p-1 rounded hover:bg-white/10 text-[#a6adc8] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input Footer */}
          <div className="p-2.5 bg-[#181825] border-t border-[#313244] flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,video/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-[#a6adc8] hover:text-[#89b4fa] hover:bg-[#313244] transition-all shrink-0"
              title="Attacher un fichier"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Posez votre question ou présentez une idée..."
              className="flex-1 p-2 rounded-xl bg-[#313244] text-[#cdd6f4] text-xs focus:outline-none focus:border-[#89b4fa] border border-[#45475a]"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || (!input.trim() && !attachment)}
              className="p-2 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] disabled:opacity-40 text-[#11111b] transition-all shrink-0 shadow-md"
              title="Envoyer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
