import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, MessageSquare, Bot, User, RefreshCw, Lightbulb, Wand2, Music2 } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface AIAgentChatProps {
  currentText: string;
  apiKey?: string;
  addToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const AIAgentChat: React.FC<AIAgentChatProps> = ({ currentText, apiKey, addToast }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content: "Wa salam ! Je suis votre agent IA (Gemini 3.8 Flash), connecté en temps réel à votre zone d'édition. Comment puis-je vous aider à sublimer votre récit, optimiser votre script ou orchestrer votre ambiance endogène ?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: query };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          currentText: currentText,
          apiKey: apiKey
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la communication avec l\'agent IA.');
      }

      setMessages([...newMessages, { role: 'model', content: data.reply }]);
    } catch (err: any) {
      console.error("Chat error:", err);
      addToast(err.message || 'Impossible de joindre l\'agent IA.', 'error');
      setMessages([...newMessages, { role: 'model', content: "Désolé, une erreur est survenue lors de la communication avec Gemini 3.8 Flash. Veuillez réessayer." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { label: "💡 Conseils de narration", prompt: "Donne-moi des conseils de narration et de rythme pour mon texte actuel." },
    { label: "✨ Optimiser mon texte", prompt: "Améliore la structure, les assonances et la force dramatique de mon texte actuel." },
    { label: "🥁 Suggérer des sons", prompt: "Quels instruments (kora, flûte peulh, riti) et bruits de nature recommandes-tu pour illustrer ce texte ?" }
  ];

  return (
    <>
      {/* Floating Toggle Button at Bottom Right */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-2.5 bg-gradient-to-r from-[#89b4fa] to-[#cba6f7] text-[#11111b] px-4 py-3.5 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 font-bold border border-white/20"
          title="Ouvrir l'Agent IA Gemini 3.8 Flash"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-[#11111b]" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#a6e3a1] rounded-full animate-pulse border border-[#11111b]" />
          </div>
          <span className="text-xs sm:text-sm tracking-wide hidden sm:inline">Assistant IA (Gemini)</span>
          <Sparkles className="w-4 h-4 text-[#11111b] animate-spin" style={{ animationDuration: '4s' }} />
        </button>
      )}

      {/* Chat Window Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[400px] h-[540px] bg-[#1e1e2e]/98 border border-[#45475a] rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#181825] border-b border-[#313244]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#89b4fa]/20 border border-[#89b4fa]/30 flex items-center justify-center text-[#89b4fa]">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#cdd6f4] flex items-center gap-1.5">
                  <span>Assistant IA VoxArt</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#89b4fa]/20 text-[#89b4fa]">Gemini 3.8</span>
                </div>
                <div className="text-[10px] text-[#a6adc8] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#a6e3a1] animate-pulse" />
                  <span>Contextuel & Connecté au texte</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-[#a6adc8] hover:text-white transition-all"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#11111b]/50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-[#cba6f7]/20 text-[#cba6f7] border border-[#cba6f7]/30' : 'bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/30'
                }`}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={`max-w-[80%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#cba6f7] text-[#11111b] font-medium rounded-tr-none'
                    : 'bg-[#313244] border border-[#45475a] text-[#cdd6f4] rounded-tl-none'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-xl bg-[#89b4fa]/20 text-[#89b4fa] border border-[#89b4fa]/30 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-[#313244] border border-[#45475a] p-3 rounded-2xl rounded-tl-none text-xs text-[#a6adc8] flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#89b4fa]" />
                  <span>Gemini rédige ses conseils...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-2 bg-[#181825]/80 border-t border-[#313244] flex gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSend(qp.prompt)}
                disabled={isLoading}
                className="shrink-0 px-2.5 py-1 rounded-full bg-[#313244] hover:bg-[#45475a] border border-[#45475a] text-[11px] text-[#cdd6f4] transition-all flex items-center gap-1"
              >
                <span>{qp.label}</span>
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-[#181825] border-t border-[#313244] flex items-center gap-2">
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
              placeholder="Demandez conseil à Gemini..."
              className="flex-1 p-2.5 rounded-xl bg-[#313244] border border-[#45475a] text-[#cdd6f4] text-xs focus:outline-none focus:border-[#89b4fa] transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="p-2.5 rounded-xl bg-[#89b4fa] hover:bg-[#b4befe] disabled:opacity-50 text-[#11111b] transition-all flex items-center justify-center shrink-0 shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
