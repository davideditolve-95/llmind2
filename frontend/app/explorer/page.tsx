'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { datastoreApi, type Datastore } from '@/lib/api';
import { 
  ChatBubbleLeftRightIcon, 
  PaperAirplaneIcon, 
  CircleStackIcon,
  BeakerIcon,
  ClockIcon,
  ArrowPathIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import MarkdownContent from '@/components/ui/MarkdownContent';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function CustomExplorerContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const dsIdFromUrl = searchParams.get('ds');

  const [datastores, setDatastores] = useState<Datastore[]>([]);
  const [selectedDs, setSelectedDs] = useState<Datastore | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dsLoading, setDsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load available datastores
  useEffect(() => {
    const loadDatastores = async () => {
      try {
        setDsLoading(true);
        const list = await datastoreApi.list();
        const readyList = list.filter(d => d.status === 'ready');
        setDatastores(readyList);
        
        if (dsIdFromUrl) {
          const found = readyList.find(d => d.id === dsIdFromUrl);
          if (found) setSelectedDs(found);
        } else if (readyList.length > 0) {
          setSelectedDs(readyList[0]);
        }
      } catch (error) {
        console.error('Failed to load datastores:', error);
      } finally {
        setDsLoading(false);
      }
    };
    loadDatastores();
  }, [dsIdFromUrl]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedDs || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await datastoreApi.ask(selectedDs.id, input);
      const assistantMsg: Message = {
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown RAG error'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden page-enter">
      {/* Dynamic Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm flex-shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60" />
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
              <ChatBubbleLeftRightIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase">Custom Explorer</h1>
                <span className="badge badge-primary badge-sm font-black uppercase text-[10px] tracking-widest px-3">Biotone RAG v2</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Querying Archive:
                </span>
                {dsLoading ? (
                  <ArrowPathIcon className="w-3 h-3 animate-spin text-indigo-500" />
                ) : (
                  <div className="dropdown dropdown-hover">
                    <label tabIndex={0} className="flex items-center gap-2 cursor-pointer text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700">
                      {selectedDs?.name || 'No Datastore Selected'}
                      <ChevronDownIcon className="w-3 h-3" />
                    </label>
                    <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-2xl bg-white border border-slate-100 rounded-2xl w-64 mt-2 animate-slide-up">
                      {datastores.map((ds) => (
                        <li key={ds.id}>
                          <button 
                            onClick={() => { setSelectedDs(ds); setMessages([]); }}
                            className={clsx(
                              "flex flex-col items-start gap-1 p-3 rounded-xl",
                              selectedDs?.id === ds.id ? "bg-indigo-50" : "hover:bg-slate-50"
                            )}
                          >
                            <span className="font-black text-[11px] uppercase tracking-tight text-slate-800">{ds.name}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{ds.model_name} • {ds.metadata_info?.chunks || 0} chunks</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-6 text-right">
             <div className="flex flex-col">
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Active Inference Model</span>
               <span className="text-[11px] font-bold text-slate-600 uppercase transition-all">{selectedDs?.model_name || 'Idle'}</span>
             </div>
             <div className="w-px h-8 bg-slate-100" />
             <div className="flex flex-col">
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Engine Pipeline</span>
               <span className="text-[11px] font-bold text-slate-600">Recursive-RAG • Chroma v0.5.x</span>
             </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-auto p-8 custom-scrollbar" ref={scrollRef}>
        <div className="max-w-4xl mx-auto space-y-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-slide-up">
              <div className="w-20 h-20 rounded-[2.5rem] bg-indigo-50 text-indigo-300 flex items-center justify-center mb-6 shadow-inner">
                <CircleStackIcon className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-black text-slate-400 mb-2 uppercase tracking-tight">Archive Connection Optimized</h2>
              <p className="max-w-md text-sm text-slate-400 font-medium">
                You are now querying the <b>{selectedDs?.name}</b> datastore. 
                The system will retrieve relevant chunks and synthesize a clinical answer based on your specific document.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={clsx("flex flex-col animate-slide-up", m.role === 'user' ? "items-end" : "items-start")}>
                <div className={clsx(
                  "max-w-[85%] px-6 py-4 rounded-3xl shadow-sm border",
                  m.role === 'user' 
                    ? "bg-slate-900 text-white border-slate-900 rounded-tr-none" 
                    : "bg-white text-slate-800 border-slate-200 rounded-tl-none"
                )}>
                  <div className="prose prose-sm max-w-none prose-slate">
                    <MarkdownContent content={m.content} className={m.role === 'user' ? "text-white" : "text-slate-800"} />
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2 px-2">
                  {m.role === 'user' ? 'Scientist' : `${selectedDs?.name} (RAG)`} • {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
          {loading && (
            <div className="flex flex-col items-start animate-pulse">
              <div className="bg-white px-6 py-4 rounded-3xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-3">
                <ArrowPathIcon className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">RAG Inference Sequence in Progress...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-8 bg-white border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <BeakerIcon className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <input
              type="text"
              disabled={!selectedDs || loading}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={selectedDs ? `Ask ${selectedDs.name}...` : "Please select a datastore to start"}
              className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] pl-14 pr-32 text-slate-800 font-bold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner disabled:opacity-50"
            />
            <div className="absolute inset-y-2 right-2 flex items-center">
              <button
                onClick={handleSend}
                disabled={!input.trim() || !selectedDs || loading}
                className={clsx(
                  "h-12 px-6 rounded-[2.2rem] flex items-center gap-2 font-black uppercase text-xs tracking-widest transition-all text-white",
                  input.trim() && !loading && selectedDs
                    ? "bg-indigo-600 shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:-translate-y-0.5" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                Query
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 opacity-30">
             <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
               <span className="text-[9px] font-black uppercase tracking-widest">Cosine Similarity Match</span>
             </div>
             <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
               <span className="text-[9px] font-black uppercase tracking-widest">Vector Context Injected</span>
             </div>
             <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
               <span className="text-[9px] font-black uppercase tracking-widest">{selectedDs?.model_name || 'N/A'} LLM Backbone</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomExplorerPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <ArrowPathIcon className="w-10 h-10 animate-spin text-indigo-600" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Initializing Explorer...</span>
        </div>
      </div>
    }>
      <CustomExplorerContent />
    </Suspense>
  );
}
