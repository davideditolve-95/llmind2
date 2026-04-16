'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/context';
import { chatApi } from '@/lib/api';
import {
  MessageSquare,
  HeartPulse,
  Send,
  Trash2,
  ChevronDown,
  RefreshCw,
  Bot,
  User,
  Plus,
  History,
  MoreVertical,
  Check,
  X,
  Edit2
} from 'lucide-react';
import MarkdownContent from '@/components/ui/MarkdownContent';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function ChatPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<'icd11' | 'wellbeing'>('icd11');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [models, setModels] = useState<string[]>(['gemma4']);
  const [selectedModel, setSelectedModel] = useState('gemma4');
  const [language, setLanguage] = useState('en');
  
  // Session management
  const [sessions, setSessions] = useState<{ id: string; title: string; mode: string; created_at: string }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState(uuidv4());
  const [currentTitle, setCurrentTitle] = useState('Nuova Conversazione');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Carica i modelli e le sessioni iniziali
  useEffect(() => {
    chatApi.getModels().then((res) => {
      setModels(res.models);
      setSelectedModel(res.default_model);
    }).catch(() => {});
    
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await chatApi.listSessions();
      setSessions(res);
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadSessionHistory = async (id: string) => {
    try {
      const res = await chatApi.getHistory(id);
      setCurrentSessionId(res.id);
      setCurrentTitle(res.title);
      setMode(res.mode as 'icd11' | 'wellbeing');
      setMessages(res.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content
      })));
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const startNewChat = () => {
    const newId = uuidv4();
    setCurrentSessionId(newId);
    setMessages([]);
    setCurrentTitle('Nuova Conversazione');
  };

  const handleRename = async (id: string) => {
    if (!newTitle.trim()) return;
    try {
      await chatApi.renameSession(id, newTitle.trim());
      if (id === currentSessionId) setCurrentTitle(newTitle.trim());
      loadSessions();
    } catch (err) {
      console.error('Rename error:', err);
    }
    setEditingSessionId(null);
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
    };
    const assistantMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      const stream = await chatApi.streamMessage({
        message: userMsg.content,
        session_id: currentSessionId,
        mode,
        model_name: selectedModel,
        language,
      });

      if (!stream) throw new Error('Stream non disponibile');

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.chunk) {
                fullContent += parsed.chunk;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: fullContent }
                      : m
                  )
                );
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: '[Error connecting to AI service]' }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, streaming: false } : m
        )
      );
      setIsStreaming(false);
      loadSessions(); // Ricarica per vedere il nuovo titolo o timestamp
    }
  }, [input, isStreaming, mode, selectedModel, language]);

  const clearConversation = () => {
    if (confirm('Sei sicuro di voler cancellare questa conversazione?')) {
      chatApi.clearHistory(currentSessionId).then(() => {
        startNewChat();
        loadSessions();
      }).catch(() => {});
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-warm-50 page-enter">
      {/* ─── Sidebar sinistra: Sessioni e History ───────────── */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-warm-200 flex flex-col p-0 z-10 shadow-sm relative">
        <div className="p-6 border-b border-warm-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              History
            </h2>
            <button 
              onClick={startNewChat}
              className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('chat.subtitle')}</p>
        </div>

        {/* Lista Sessioni */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 custom-scrollbar">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 opacity-30">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Loading...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="px-4 py-8 text-center opacity-30">
              <p className="text-[10px] font-black uppercase tracking-widest">No history yet</p>
            </div>
          ) : (
            sessions.map(s => (
              <div 
                key={s.id}
                onClick={() => !editingSessionId && loadSessionHistory(s.id)}
                className={clsx(
                  "group relative w-full flex flex-col gap-1 px-4 py-3 rounded-xl transition-all cursor-pointer",
                  currentSessionId === s.id ? "bg-white shadow-premium border border-warm-200 ring-1 ring-slate-900/5 translate-x-1" : "hover:bg-warm-50 border border-transparent"
                )}
              >
                {editingSessionId === s.id ? (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <input 
                      autoFocus
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRename(s.id)}
                      className="flex-1 bg-warm-100 border-none rounded-lg text-xs font-bold px-2 py-1 outline-none focus:ring-1 focus:ring-slate-400"
                    />
                    <button onClick={() => handleRename(s.id)} className="text-sage-600 hover:scale-110"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingSessionId(null)} className="text-slate-400 hover:scale-110"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className={clsx(
                        "text-xs font-bold truncate max-w-[85%]",
                        currentSessionId === s.id ? "text-slate-900" : "text-slate-600"
                      )}>{s.title}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingSessionId(s.id); setNewTitle(s.title); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white rounded-md text-slate-400"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md",
                        s.mode === 'wellbeing' ? "bg-lavender-50 text-lavender-600" : "bg-sage-50 text-sage-600"
                      )}>{s.mode}</span>
                      <span className="text-[9px] font-bold text-slate-300 uppercase italic">
                        {new Date(s.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Settings Inferiori */}
        <div className="p-4 border-t border-warm-100 bg-warm-50/50 space-y-4">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{t('chat.model_select')}</label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-white border border-warm-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none appearance-none hover:border-warm-300 transition-colors shadow-sm"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Mode</label>
              <div className="flex p-1 rounded-xl bg-warm-200/50 border border-warm-200/50 relative overflow-hidden h-9">
                <button 
                  onClick={() => setMode('icd11')}
                  className={clsx(
                    "flex-1 flex items-center justify-center rounded-lg transition-all z-10",
                    mode === 'icd11' ? "bg-white text-sage-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setMode('wellbeing')}
                  className={clsx(
                    "flex-1 flex items-center justify-center rounded-lg transition-all z-10",
                    mode === 'wellbeing' ? "bg-white text-lavender-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  <HeartPulse className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="w-20">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Lang</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-9 bg-white border border-warm-200 rounded-xl px-2 text-[10px] font-bold text-slate-700 outline-none appearance-none shadow-sm"
              >
                <option value="en">EN</option>
                <option value="it">IT</option>
              </select>
            </div>
          </div>

          <button onClick={clearConversation} className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100">
            <Trash2 className="w-3.5 h-3.5" />
            {t('chat.clear')}
          </button>
        </div>
      </div>

      {/* ─── Area chat principale ──────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header modalità */}
        <div className={clsx(
          'px-6 py-3 border-b flex items-center gap-2',
          mode === 'wellbeing' ? 'bg-lavender-50 border-lavender-200' : 'bg-sage-50 border-sage-200'
        )}>
          {mode === 'wellbeing'
            ? <HeartPulse className="w-4 h-4 text-lavender-600" />
            : <MessageSquare className="w-4 h-4 text-sage-600" />}
          <span className="text-sm font-black text-slate-900 tracking-tight">
            {currentTitle}
          </span>
          <span className="text-[10px] font-bold text-slate-400 bg-warm-100 px-2 py-0.5 rounded-md uppercase ml-2">
            {mode === 'wellbeing' ? t('chat.mode_wellbeing') : t('chat.mode_icd11')}
          </span>
          <div className="ml-auto flex items-center gap-4">
             <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{selectedModel}</span>
             <div className="h-4 w-px bg-warm-200" />
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-sage-500 animate-pulse" />
                <span className="text-[10px] font-black text-sage-600 uppercase tracking-widest">Live Session</span>
             </div>
          </div>
        </div>

        {/* Messaggi */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sage-200 to-powder-200 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-sage-600" />
              </div>
              <p className="text-slate-500 text-sm max-w-xs">
                {mode === 'wellbeing'
                  ? t('chat.placeholder_wellbeing')
                  : t('chat.placeholder_icd11')}
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={clsx('flex gap-3 max-w-3xl', msg.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
            >
              {/* Avatar */}
              <div className={clsx(
                'w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center',
                msg.role === 'user'
                  ? 'bg-sage-400'
                  : mode === 'wellbeing' ? 'bg-lavender-200' : 'bg-powder-200'
              )}>
                {msg.role === 'user'
                  ? <User className="w-4 h-4 text-white" />
                  : <Bot className={clsx('w-4 h-4', mode === 'wellbeing' ? 'text-lavender-700' : 'text-powder-700')} />}
              </div>

              {/* Bolla messaggio */}
              <div className={clsx(
                'max-w-[85%] px-5 py-4 rounded-2xl text-sm leading-relaxed shadow-soft relative overflow-hidden',
                msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
              )}>
                {msg.role === 'assistant' ? (
                  <MarkdownContent content={msg.content || (msg.streaming ? '' : '...')} className="text-inherit" />
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
                {msg.streaming && <span className="streaming-cursor block mt-2" />}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 bg-white border-t border-warm-200">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'wellbeing' ? t('chat.placeholder_wellbeing') : t('chat.placeholder_icd11')}
              rows={2}
              className="textarea-field flex-1 min-h-[56px] max-h-[200px]"
              disabled={isStreaming}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className="btn-primary h-14 px-5"
            >
              {isStreaming ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1.5">⏎ {t('chat.send')} · Shift+⏎ newline</p>
        </div>
      </div>
    </div>
  );
}
