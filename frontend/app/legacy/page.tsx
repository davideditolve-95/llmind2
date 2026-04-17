'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { legacyApi, datastoreApi, type KnowledgePreset } from '@/lib/api';
import { 
  ChatBubbleLeftRightIcon, 
  PaperAirplaneIcon, 
  CommandLineIcon,
  BeakerIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  TableCellsIcon,
  DocumentTextIcon,
  PlayCircleIcon
} from '@heroicons/react/24/outline';
import MarkdownContent from '@/components/ui/MarkdownContent';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function LegacyExplorerPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'chat' | 'batch' | 'logs'>('chat');
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Batch State
  const [sources, setSources] = useState<KnowledgePreset[]>([]);
  const [selectedCsv, setSelectedCsv] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  // Logs State
  const [logs, setLogs] = useState<string[]>([]);
  const [pollingLogs, setPollingLogs] = useState(false);

  useEffect(() => {
    const loadSources = async () => {
      try {
        const presets = await datastoreApi.getPresets();
        // Filtriamo i preset che hanno file CSV (usati per il batch)
        const presetsWithCsv = presets.filter(p => p.files.some(f => f.toLowerCase().endsWith('.csv')));
        setSources(presetsWithCsv);
        if (presetsWithCsv.length > 0) {
          // Per ora usiamo il primo file CSV del primo preset
          const firstCsv = presetsWithCsv[0].files.find(f => f.toLowerCase().endsWith('.csv'));
          if (firstCsv) setSelectedCsv(firstCsv);
        }
      } catch (err) {
        console.error("Failed to load presets", err);
      }
    };
    loadSources();
  }, []);

  // Poll logs when on logs tab
  useEffect(() => {
    let interval: any;
    if (activeTab === 'logs') {
      const fetchLogs = async () => {
        try {
          const res = await legacyApi.getLogs(50);
          setLogs(res.logs);
        } catch (err) {
          console.error("Log fetch failed", err);
        }
      };
      fetchLogs();
      interval = setInterval(fetchLogs, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTab]);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current && activeTab === 'chat') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage: Message = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    try {
      const response = await legacyApi.ask(input);
      setMessages(prev => [...prev, { role: 'assistant', content: response.output_string, timestamp: new Date() }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Legacy Error'}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleRunBatch = async () => {
    if (!selectedCsv || batchLoading) return;
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const res = await legacyApi.runBatch(selectedCsv);
      setBatchResult(res.output_file);
      setActiveTab('logs'); // Switch to logs to see progress
    } catch (error) {
      alert("Batch run failed");
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 overflow-hidden page-enter">
      {/* Header Legacy Dashboard */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 shadow-sm flex-shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60 pointer-events-none" />
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
              <ClockIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-slate-800">Legacy Terminal</h1>
                <span className="badge badge-warning badge-sm font-black uppercase text-[9px] tracking-widest px-2">v1.0.4-LOCKED</span>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Unified v1 Infrastructure Dashboard</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
            <button 
              onClick={() => setActiveTab('chat')}
              className={clsx("flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'chat' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4" /> Console
            </button>
            <button 
              onClick={() => setActiveTab('batch')}
              className={clsx("flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'batch' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <TableCellsIcon className="w-4 h-4" /> Batch
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={clsx("flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeTab === 'logs' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <CommandLineIcon className="w-4 h-4" /> Logs
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-amber-50/80 border-b border-amber-100 px-8 py-2 flex items-center gap-3">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-600" />
            <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Interactive RAG Console Active • Fixed Retrieval Core</span>
          </div>

          <div className="flex-1 overflow-auto p-8 custom-scrollbar" ref={scrollRef}>
            <div className="max-w-4xl mx-auto space-y-8">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-slide-up">
                  <div className="w-20 h-20 rounded-[2.5rem] bg-slate-100 text-slate-300 flex items-center justify-center mb-6 shadow-inner">
                    <CommandLineIcon className="w-10 h-10" />
                  </div>
                  <h2 className="text-xl font-black text-slate-400 mb-2 uppercase tracking-tight">System Ready</h2>
                  <p className="max-w-md text-sm text-slate-400 font-medium">Original RAG pipeline. Optimized for clinical diagnostic inference via static knowledge shards.</p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={clsx("flex flex-col animate-slide-up", m.role === 'user' ? "items-end" : "items-start")}>
                    <div className={clsx("max-w-[85%] px-6 py-4 rounded-3xl shadow-sm border", m.role === 'user' ? "bg-slate-900 text-white border-slate-900 rounded-tr-none" : "bg-white text-slate-800 border-slate-200 rounded-tl-none")}>
                        <MarkdownContent content={m.content} className={m.role === 'user' ? "text-white" : "text-slate-800"} />
                    </div>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2 px-2">
                      {m.role === 'user' ? 'Scientist' : 'Legacy-v1'} • {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex flex-col items-start animate-pulse">
                  <div className="bg-white px-6 py-4 rounded-3xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-3">
                    <ArrowPathIcon className="w-4 h-4 animate-spin text-amber-500" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Retrieval Chain Active...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-8 bg-white border-t border-slate-200 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
            <div className="max-w-4xl mx-auto flex gap-4">
               <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Query the clinical archive..."
                className="flex-1 h-16 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] px-8 text-slate-800 font-bold focus:outline-none focus:border-amber-400 focus:bg-white transition-all shadow-inner"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className={clsx("w-16 h-16 rounded-full flex items-center justify-center transition-all", input.trim() && !loading ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600 hover:-translate-y-0.5" : "bg-slate-200 text-slate-400")}
              >
                <PaperAirplaneIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'batch' && (
        <div className="flex-1 p-12 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="premium-card p-10 bg-white shadow-xl rounded-[2.5rem] border border-slate-100">
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <TableCellsIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Batch Clinical Scan</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Model-based Diagnostic evaluation over dataset</p>
                  </div>
               </div>

               <div className="space-y-8">
                  <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-4">Target Case File (CSV)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sources.map(s => (
                        <button 
                          key={s.id}
                          onClick={() => setSelectedCsv(s.id)}
                          className={clsx(
                            "p-6 rounded-2xl border-2 text-left transition-all",
                            selectedCsv === s.id ? "bg-white border-indigo-500 shadow-md ring-4 ring-indigo-50" : "bg-transparent border-slate-200 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 hover:border-indigo-200"
                          )}
                        >
                           <DocumentTextIcon className="w-6 h-6 text-indigo-500 mb-2" />
                           <span className="block font-black text-xs text-slate-800 truncate mb-1">{s.name}</span>
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Format: §-Delimited CSV</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-8 rounded-3xl border border-amber-100 bg-amber-50/30">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Inference Target Model</span>
                        <span className="text-sm font-black text-slate-800">Legacy Gemma-2-27B (Quantized)</span>
                     </div>
                     <button 
                       onClick={handleRunBatch}
                       disabled={!selectedCsv || batchLoading}
                       className="btn btn-primary h-14 px-10 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-500/20 gap-3"
                     >
                        {batchLoading ? (
                          <><ArrowPathIcon className="w-5 h-5 animate-spin" /> Running Sequence...</>
                        ) : (
                          <><PlayCircleIcon className="w-6 h-6" /> Execute Scan</>
                        )}
                     </button>
                  </div>

                  {batchResult && (
                    <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                            <ExclamationTriangleIcon className="w-4 h-4" />
                         </div>
                         <p className="text-xs font-bold text-emerald-800">Sequence completed. Result saved: <b className="underline cursor-pointer">{batchResult}</b></p>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="flex-1 p-8 overflow-hidden flex flex-col">
           <div className="max-w-5xl mx-auto w-full flex-1 bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col font-mono text-[11px] border border-slate-800">
              <div className="bg-slate-800 px-6 py-3 flex items-center justify-between border-b border-slate-700">
                 <div className="flex items-center gap-2">
                    <div className="flex gap-1.5 mr-4">
                       <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                       <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                       <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                    </div>
                    <span className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">v1-SYSTEM_LOG_STREAM</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Direct Socket Hooked</span>
                 </div>
              </div>
              <div className="flex-1 p-8 overflow-auto custom-scrollbar-dark bg-slate-900/50 backdrop-blur-xl">
                 {logs.length === 0 ? (
                   <span className="text-slate-600 italic">No historical log data available...</span>
                 ) : (
                   logs.map((l, i) => (
                     <div key={i} className="mb-2 leading-relaxed">
                        <span className="text-slate-500 mr-2">[{i.toString().padStart(3, '0')}]</span>
                        <span className={clsx("font-bold", l.includes('Error') ? "text-red-400" : l.includes('Starting') ? "text-amber-400" : "text-emerald-400/80")}>
                          {l}
                        </span>
                     </div>
                   ))
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
