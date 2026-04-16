'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/context';
import { chatApi } from '@/lib/api';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  TrashIcon,
  ArrowPathIcon,
  UserIcon,
  PlusIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  PencilSquareIcon,
  SparklesIcon,
  BeakerIcon,
  BookOpenIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
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
  const [currentTitle, setCurrentTitle] = useState('New Conversation');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      setShowHistory(false);
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const startNewChat = () => {
    const newId = uuidv4();
    setCurrentSessionId(newId);
    setMessages([]);
    setCurrentTitle('New Conversation');
    setShowHistory(false);
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

      if (!stream) throw new Error('Stream unavailable');

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
      loadSessions();
    }
  }, [input, isStreaming, mode, selectedModel, language, currentSessionId]);

  const clearConversation = () => {
    if (confirm('Clear this conversation?')) {
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

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const modeConfig = {
    icd11: {
      label: 'ICD-11 Assistant',
      sublabel: 'Ontology & Diagnostic Coding',
      icon: BookOpenIcon,
      color: 'bg-indigo-600',
      border: 'border-indigo-600',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      glow: 'shadow-indigo-500/20',
      placeholder: 'Enter a clinical question or ICD-11 code to explore...',
    },
    wellbeing: {
      label: 'Differential Diagnosis',
      sublabel: 'Multi-agent Differential Reasoning',
      icon: BeakerIcon,
      color: 'bg-emerald-600',
      border: 'border-emerald-600',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      glow: 'shadow-emerald-500/20',
      placeholder: 'Describe patient symptoms for differential analysis...',
    }
  };

  const activeMode = modeConfig[mode];

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 page-enter overflow-hidden">
      
      {/* ──── LEFT SIDEBAR ──── */}
      <div className="w-72 bg-slate-950 flex flex-col border-r border-white/10 flex-shrink-0 hidden lg:flex">
        
        {/* Sidebar Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg">
              <CpuChipIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-black text-sm leading-none">AI Workspace</p>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Clinical Engine v4.2</p>
            </div>
          </div>
          
          <button
            onClick={startNewChat}
            className="btn w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white border-none font-black text-sm gap-2 shadow-lg shadow-indigo-500/20"
          >
            <PlusIcon className="w-5 h-5" />
            New Consultation
          </button>
        </div>

        {/* MODE SWITCHER — primary UI element */}
        <div className="p-6 border-b border-white/10">
          <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.4em] mb-4">Reasoning Mode</p>
          <div className="flex flex-col gap-2">
            {(['icd11', 'wellbeing'] as const).map((m) => {
              const cfg = modeConfig[m];
              const Icon = cfg.icon;
              const isActive = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={clsx(
                    "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                    isActive
                      ? "bg-white/10 border-white/30 shadow-lg"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", isActive ? cfg.color : "bg-white/10")}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={clsx("text-sm font-black leading-none mb-0.5", isActive ? "text-white" : "text-white/50")}>{cfg.label}</p>
                    <p className={clsx("text-[10px] leading-none", isActive ? "text-white/60" : "text-white/25")}>{cfg.sublabel}</p>
                  </div>
                  {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Model + Language controls */}
        <div className="p-6 border-b border-white/10 space-y-4">
          <div>
            <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Neural Model</p>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{ backgroundColor: '#1e293b', color: 'white' }}
              className="w-full h-11 rounded-xl border border-white/20 font-black text-sm focus:border-indigo-400 focus:outline-none px-3"
            >
              {models.map(m => <option key={m} value={m} style={{ backgroundColor: '#0f172a' }}>{m}</option>)}
            </select>
          </div>
          <div>
            <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.4em] mb-2">Language</p>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ backgroundColor: '#1e293b', color: 'white' }}
              className="w-full h-11 rounded-xl border border-white/20 font-black text-sm focus:border-indigo-400 focus:outline-none px-3"
            >
              <option value="en" style={{ backgroundColor: '#0f172a' }}>English</option>
              <option value="it" style={{ backgroundColor: '#0f172a' }}>Italiano</option>
            </select>
          </div>
        </div>

        {/* Session History */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
          <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.4em] mb-3 px-2">Session History</p>
          {sessionsLoading ? (
            <div className="flex justify-center py-8"><span className="loading loading-spinner loading-sm text-indigo-400" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-white/20 text-[10px] uppercase font-black tracking-widest text-center py-8">No sessions yet</p>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => !editingSessionId && loadSessionHistory(s.id)}
                  className={clsx(
                    "group p-3 rounded-xl cursor-pointer transition-all",
                    currentSessionId === s.id
                      ? "bg-white/15 border border-indigo-400/40"
                      : "hover:bg-white/10 border border-transparent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    {editingSessionId === s.id ? (
                      <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          className="input input-xs bg-white/20 text-white border-indigo-400 flex-1 text-xs"
                          autoFocus
                        />
                        <button onClick={() => handleRename(s.id)}><CheckIcon className="w-3.5 h-3.5 text-indigo-400" /></button>
                        <button onClick={() => setEditingSessionId(null)}><XMarkIcon className="w-3.5 h-3.5 text-red-400" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={clsx("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded", s.mode === 'wellbeing' ? "bg-emerald-500/20 text-emerald-400" : "bg-indigo-500/20 text-indigo-400")}>
                              {s.mode === 'wellbeing' ? 'DIAG' : 'ICD-11'}
                            </span>
                          </div>
                          <p className={clsx("text-xs font-medium leading-tight truncate", currentSessionId === s.id ? "text-white" : "text-white/50")}>
                            {s.title}
                          </p>
                          <p className="text-[9px] text-white/25 mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); setEditingSessionId(s.id); setNewTitle(s.title); }} className="p-1 hover:text-white text-white/40">
                            <PencilSquareIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clear button */}
        <div className="p-4 border-t border-white/10">
          <button onClick={clearConversation} className="btn btn-ghost w-full h-10 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 text-xs font-black uppercase tracking-widest gap-2 border border-white/10 hover:border-red-500/30">
            <TrashIcon className="w-4 h-4" />
            Clear Session
          </button>
        </div>
      </div>

      {/* ──── MAIN CHAT AREA ──── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar — mode indicator + title */}
        <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <div className={clsx("w-3 h-3 rounded-full", activeMode.color, "shadow-lg")} />
            <div>
              <p className="font-black text-slate-800 text-lg leading-none">{activeMode.label}</p>
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest">{activeMode.sublabel}</p>
            </div>
            <span className={clsx("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", activeMode.badge)}>
              {isStreaming ? '● Streaming...' : '● Ready'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-300 text-[10px] font-black uppercase tracking-widest hidden md:block">Model: <span className="text-indigo-600">{selectedModel}</span></span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-16 py-10 space-y-10">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-8 py-20">
              <div className={clsx("w-28 h-28 rounded-[3rem] flex items-center justify-center shadow-2xl", activeMode.glow, activeMode.color)}>
                {mode === 'icd11' ? <BookOpenIcon className="w-14 h-14 text-white" /> : <BeakerIcon className="w-14 h-14 text-white" />}
              </div>
              <div className="space-y-3 max-w-md">
                <p className="text-3xl font-black text-slate-800 tracking-tight">{activeMode.label}</p>
                <p className="text-slate-400 font-medium text-lg leading-relaxed">{activeMode.sublabel}</p>
                <p className="text-slate-300 text-sm">{activeMode.placeholder}</p>
              </div>
              {/* Quick mode switch hint for empty state */}
              <div className="flex gap-3 mt-4">
                {(['icd11', 'wellbeing'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={clsx(
                      "flex items-center gap-2 px-5 py-3 rounded-2xl border-2 font-black text-sm transition-all",
                      mode === m
                        ? `${modeConfig[m].color} text-white border-transparent shadow-lg`
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    )}
                  >
                    {m === 'icd11' ? <BookOpenIcon className="w-4 h-4" /> : <BeakerIcon className="w-4 h-4" />}
                    {modeConfig[m].label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={clsx("flex gap-5 animate-slide-up", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                {/* Avatar */}
                <div className={clsx(
                  "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg",
                  m.role === 'user' ? "bg-slate-800 text-white" : mode === 'icd11' ? "bg-indigo-600 text-white" : "bg-emerald-600 text-white"
                )}>
                  {m.role === 'user' ? <UserIcon className="w-6 h-6" /> : <SparklesIcon className="w-6 h-6" />}
                </div>
                
                {/* Bubble */}
                <div className={clsx(
                  "max-w-[75%] rounded-3xl px-8 py-6 shadow-sm",
                  m.role === 'user'
                    ? "bg-slate-800 text-white rounded-tr-md"
                    : "bg-white text-slate-800 rounded-tl-md border border-slate-200"
                )}>
                  <div className={clsx(
                    "prose prose-base max-w-none leading-relaxed",
                    m.role === 'user' ? "prose-invert" : "prose-slate"
                  )}>
                    <MarkdownContent content={m.content} className="text-inherit text-lg" />
                    {m.streaming && <span className="streaming-cursor" />}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-slate-200 px-6 md:px-12 py-6 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            {/* Mode quick-switch — always active, works mid-conversation too */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex-shrink-0">Mode:</span>
              {(['icd11', 'wellbeing'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border-2 transition-all",
                    mode === m
                      ? m === 'icd11' ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200" : "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200"
                      : "border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:text-slate-800"
                  )}
                >
                  {m === 'icd11' ? <BookOpenIcon className="w-3.5 h-3.5" /> : <BeakerIcon className="w-3.5 h-3.5" />}
                  {m === 'icd11' ? 'ICD-11' : 'Differential Dx'}
                </button>
              ))}
            </div>

            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeMode.placeholder}
                rows={3}
                className={clsx(
                  "w-full resize-none px-7 py-5 pr-20 text-xl font-medium text-slate-800 bg-slate-50 border-2 rounded-3xl focus:outline-none focus:bg-white transition-all placeholder:text-slate-300 leading-relaxed shadow-inner",
                  mode === 'icd11'
                    ? "border-slate-200 focus:border-indigo-400 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.06)]"
                    : "border-slate-200 focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.06)]"
                )}
                disabled={isStreaming}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className={clsx(
                  "absolute bottom-4 right-4 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all border-none disabled:opacity-30",
                  mode === 'icd11'
                    ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/30 hover:scale-105"
                    : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/30 hover:scale-105"
                )}
              >
                {isStreaming
                  ? <ArrowPathIcon className="w-7 h-7 text-white animate-spin" />
                  : <PaperAirplaneIcon className="w-7 h-7 text-white -rotate-45 -translate-y-0.5 translate-x-0.5" />
                }
              </button>
            </div>
            <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.4em] text-center mt-3">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
