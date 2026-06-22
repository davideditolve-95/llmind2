'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';
import { chatApi, patientsApi, type Patient } from '@/lib/api';
import MarkdownContent from '@/components/ui/MarkdownContent';
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

type Mode = 'icd11' | 'wellbeing';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function ChatPage() {
  const [mode, setMode] = useState<Mode>('icd11');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [models, setModels] = useState<string[]>(['gemma4']);
  const [selectedModel, setSelectedModel] = useState('gemma4');
  const [language, setLanguage] = useState('en');
  const [sessions, setSessions] = useState<{ id: string; title: string; mode: string; is_pinned: boolean; is_starred: boolean; patient_id: string | null; updated_at: string }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState(uuidv4());
  const [currentTitle, setCurrentTitle] = useState('New conversation');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Patient contextualization states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [isPristineParam, setIsPristineParam] = useState(true);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await chatApi.listSessions());
    } catch {}
  }, []);

  useEffect(() => {
    chatApi.getModels().then((res) => {
      setModels(res.models);
      setSelectedModel(res.default_model || res.models[0] || 'gemma4');
    }).catch(() => {});
    patientsApi.list().then(setPatients).catch(() => {});
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle URL query parameter ?patientId=... to auto-initiate contextualized chat
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('patientId');
    if (patientId && isPristineParam) {
      setIsPristineParam(false);
      const newId = uuidv4();
      setCurrentSessionId(newId);
      setMessages([]);
      setActivePatientId(patientId);

      patientsApi.get(patientId).then((p) => {
        setCurrentTitle(`Consulto: ${p.name}`);
        chatApi.updateSession(newId, { patient_id: patientId }).then(() => {
          loadSessions();
        });
      }).catch(() => {
        setCurrentTitle('Consulto Paziente');
      });

      // Clear search query param without reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [isPristineParam, loadSessions]);

  const startNew = () => {
    setCurrentSessionId(uuidv4());
    setMessages([]);
    setCurrentTitle('New conversation');
    setActivePatientId(null);
    setIsSidebarOpen(false);
  };

  const loadHistory = async (id: string) => {
    const history = await chatApi.getHistory(id);
    setCurrentSessionId(history.id);
    setCurrentTitle(history.title);
    setMode(history.mode as Mode);
    setMessages(history.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })));
    setActivePatientId(history.patient_id);
    setIsSidebarOpen(false);
  };

  const handlePatientChange = async (patientId: string) => {
    const cleanId = patientId === 'none' ? null : patientId;
    setActivePatientId(cleanId);
    try {
      await chatApi.updateSession(currentSessionId, { patient_id: cleanId });
      loadSessions();
    } catch (err) {
      console.error('Failed to associate patient with session:', err);
    }
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = { id: uuidv4(), role: 'user', content: input.trim() };
    const assistantMsg: Message = { id: uuidv4(), role: 'assistant', content: '', streaming: true };
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
        patient_id: activePatientId,
      });
      if (!stream) throw new Error('Stream unavailable');
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.chunk) {
              fullContent += parsed.chunk;
              setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullContent } : m));
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: 'Error connecting to AI service.' } : m));
    } finally {
      setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, streaming: false } : m));
      setIsStreaming(false);
      loadSessions();
    }
  }, [currentSessionId, input, isStreaming, language, loadSessions, mode, selectedModel, activePatientId]);

  const renameSession = async (id: string) => {
    if (!newTitle.trim()) return;
    await chatApi.updateSession(id, { title: newTitle.trim() });
    if (id === currentSessionId) setCurrentTitle(newTitle.trim());
    setRenaming(null);
    setNewTitle('');
    loadSessions();
  };

  const togglePin = async (id: string, currentPin: boolean) => {
    try {
      await chatApi.updateSession(id, { is_pinned: !currentPin });
      loadSessions();
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const toggleStar = async (id: string, currentStar: boolean) => {
    try {
      await chatApi.updateSession(id, { is_starred: !currentStar });
      loadSessions();
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const clearCurrent = async () => {
    if (!confirm('Clear this conversation?')) return;
    await chatApi.clearHistory(currentSessionId);
    startNew();
    loadSessions();
  };

  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pinnedSessions = filteredSessions.filter((s) => s.is_pinned);
  const recentSessions = filteredSessions.filter((s) => !s.is_pinned);

  const renderSessionRow = (session: typeof sessions[0]) => {
    const isActive = session.id === currentSessionId;
    return (
      <div
        key={session.id}
        className={clsx(
          'group relative mb-1.5 rounded-box p-2 transition-all duration-200 border border-transparent',
          isActive ? 'bg-base-200 border-base-300/40 text-base-content font-medium' : 'hover:bg-base-200/50 hover:text-base-content/90'
        )}
      >
        {renaming === session.id ? (
          <div className="join w-full">
            <input
              className="input input-xs input-bordered join-item w-full"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') renameSession(session.id);
                if (e.key === 'Escape') setRenaming(null);
              }}
              autoFocus
            />
            <button className="btn btn-xs btn-primary join-item" onClick={() => renameSession(session.id)}>Save</button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1">
            <button className="min-w-0 flex-1 text-left" onClick={() => loadHistory(session.id)}>
              <div className="truncate text-sm font-medium">{session.title}</div>
              <div className="text-xs text-base-content/50 capitalize">{session.mode}</div>
            </button>
            
            <div className="flex items-center gap-0.5 opacity-60 lg:opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className={clsx('btn btn-ghost btn-xs btn-circle', session.is_pinned && 'text-primary opacity-100')}
                onClick={() => togglePin(session.id, session.is_pinned)}
                title={session.is_pinned ? "Unpin chat" : "Pin chat"}
              >
                <PinIcon filled={session.is_pinned} className="h-3.5 w-3.5" />
              </button>
              <button
                className={clsx('btn btn-ghost btn-xs btn-circle', session.is_starred && 'text-warning opacity-100')}
                onClick={() => toggleStar(session.id, session.is_starred)}
                title={session.is_starred ? "Unstar chat" : "Star chat"}
              >
                <StarIconCustom filled={session.is_starred} className="h-3.5 w-3.5" />
              </button>
              <button
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => { setRenaming(session.id); setNewTitle(session.title); }}
                title="Rename chat"
              >
                <PencilSquareIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid h-[calc(100vh-4.75rem)] grid-cols-1 overflow-hidden lg:grid-cols-[20rem_1fr] relative">
      {/* Backdrop overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'border-r border-base-300 bg-base-100 transition-all duration-300 ease-in-out flex flex-col',
          // Desktop behavior
          'lg:static lg:h-full lg:w-80 lg:translate-x-0 lg:z-auto',
          // Mobile behavior
          'fixed inset-y-0 left-0 z-50 w-80 h-full shadow-2xl lg:shadow-none',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="border-b border-base-300 p-4 flex items-center justify-between gap-2">
          <button className="btn btn-primary flex-1" onClick={startNew}>
            <PlusIcon className="h-4 w-4" />
            New chat
          </button>
          <button
            className="btn btn-ghost btn-square btn-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2 border-b border-base-300 bg-base-50">
          <div className="relative">
            <input
              type="text"
              placeholder="Search chats..."
              className="input input-sm input-bordered w-full pl-8 text-sm focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg
              className="absolute left-2.5 top-2.5 h-4 w-4 text-base-content/40"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                className="absolute right-2 top-1.5 btn btn-ghost btn-xs btn-circle"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="scroll-area flex-1 overflow-auto p-3 space-y-4">
          {sessions.length === 0 ? (
            <div className="alert text-sm">No saved sessions yet.</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-6 text-sm text-base-content/50">No matches found.</div>
          ) : (
            <div className="space-y-4">
              {/* Pinned Sessions */}
              {pinnedSessions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-base-content/40 flex items-center gap-1.5">
                    <PinIcon filled={true} className="h-3 w-3 text-primary" />
                    <span>Pinned</span>
                  </div>
                  {pinnedSessions.map((session) => renderSessionRow(session))}
                </div>
              )}

              {/* Recent Sessions */}
              <div className="space-y-1">
                {pinnedSessions.length > 0 ? (
                  <div className="px-2 pt-2 mb-2 border-t border-base-200/50 text-xs font-semibold uppercase tracking-wider text-base-content/40">
                    Recent Conversations
                  </div>
                ) : null}
                {recentSessions.map((session) => renderSessionRow(session))}
              </div>
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <div className="border-b border-base-300 bg-base-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile Sidebar Toggle Button */}
              <button
                className="btn btn-ghost btn-sm btn-square lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-semibold">{currentTitle}</h1>
                <p className="text-sm text-base-content/60">Streaming clinical workspace</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="select select-bordered select-sm max-w-xs font-semibold"
                value={activePatientId || 'none'}
                onChange={(e) => handlePatientChange(e.target.value)}
                title="Select Patient Context"
              >
                <option value="none">No Patient Context</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.age !== null ? `(${p.age})` : ''}
                  </option>
                ))}
              </select>
              <div className="join">
                <button className={clsx('btn btn-sm join-item', mode === 'icd11' && 'btn-primary')} onClick={() => setMode('icd11')}>ICD-11</button>
                <button className={clsx('btn btn-sm join-item', mode === 'wellbeing' && 'btn-primary')} onClick={() => setMode('wellbeing')}>Differential</button>
              </div>
              <select className="select select-bordered select-sm" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select className="select select-bordered select-sm" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">EN</option>
                <option value="it">IT</option>
              </select>
              <button className="btn btn-ghost btn-sm" onClick={clearCurrent}><TrashIcon className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        <div className="scroll-area flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.length === 0 && (
              <div className="hero min-h-[22rem] rounded-box bg-base-100">
                <div className="hero-content text-center">
                  <div>
                    <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-primary" />
                    <h2 className="mt-4 text-2xl font-semibold">Start a clinical reasoning session</h2>
                    <p className="mt-2 text-base-content/60">Ask about ICD-11 taxonomy or describe a case for differential reasoning.</p>
                  </div>
                </div>
              </div>
            )}
            {messages.map((msg) => {
              const isThinking = msg.role === 'assistant' && msg.streaming && !msg.content;
              return (
                <div key={msg.id} className={clsx('chat', msg.role === 'user' ? 'chat-end' : 'chat-start')}>
                  <div className="chat-header text-xs">{msg.role === 'user' ? 'You' : selectedModel}</div>
                  <div className={clsx('chat-bubble max-w-3xl', msg.role === 'assistant' ? 'chat-bubble-primary' : '')}>
                    {isThinking ? (
                      <div className="flex items-center gap-2 py-1 px-1">
                        <span className="text-sm italic opacity-85">Thinking</span>
                        <span className="loading loading-dots loading-xs" />
                      </div>
                    ) : (
                      <>
                        <MarkdownContent content={msg.content || ' '} className={msg.role === 'assistant' ? 'prose-invert' : ''} />
                        {msg.streaming && <span className="streaming-cursor" />}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-base-300 bg-base-100 p-4">
          {activePatientId && (
            <div className="mx-auto max-w-4xl px-4 py-1.5 mb-2.5 rounded-lg bg-accent/15 text-accent-content text-xs font-semibold flex items-center justify-between border border-accent/25 shadow-sm">
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                Active Patient Context: <strong className="underline">{patients.find(p => p.id === activePatientId)?.name}</strong>
              </span>
              <button className="btn btn-ghost btn-xs text-xs px-1 h-auto min-h-0 text-accent-content/75 hover:text-accent-content" onClick={() => handlePatientChange('none')}>Clear Context</button>
            </div>
          )}
          <div className="mx-auto flex max-w-4xl gap-2">
            <textarea
              className="textarea textarea-bordered min-h-16 flex-1 resize-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={mode === 'icd11' ? 'Ask an ICD-11 question...' : 'Describe the clinical case...'}
              disabled={isStreaming}
            />
            <button className="btn btn-primary self-end" onClick={sendMessage} disabled={!input.trim() || isStreaming}>
              {isStreaming ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PaperAirplaneIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// Custom Icons for Pin and Star states
const PinIcon = ({ filled, className = "h-4 w-4" }: { filled: boolean; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? 0 : 1.5}
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 12V4.5a1.5 1.5 0 00-1.5-1.5h-6A1.5 1.5 0 007.5 4.5V12l-2 2v1.5h5.25v6h2.5v-6h5.25V14l-2-2z"
    />
  </svg>
);

const StarIconCustom = ({ filled, className = "h-4 w-4" }: { filled: boolean; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.5}
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.48 3.499c.195-.558.978-.558 1.173 0l2.36 6.822a1 1 0 00.95.69h7.14c.586 0 .83.753.354 1.1l-5.78 4.2a1 1 0 00-.36 1.118l2.36 6.82a1 1 0 01-1.45 1.1L12 19.24a1 1 0 00-.95 0l-5.78 4.2a1 1 0 01-1.45-1.1l2.36-6.82a1 1 0 00-.36-1.118l-5.78-4.2a1 1 0 01.35-1.1h7.14a1 1 0 00.95-.69l2.36-6.82z"
    />
  </svg>
);
