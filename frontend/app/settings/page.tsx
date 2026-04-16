'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { chatApi } from '@/lib/api';
import {
  Cog6ToothIcon,
  CpuChipIcon,
  ArrowPathIcon,
  PlayIcon,
  CommandLineIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  BoltIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export default function SettingsPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{
    status: string;
    base_url: string;
    models_count: number;
    latency_ms: number;
    error?: string;
  } | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState('');

  // Playground state
  const [testModel, setTestModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful clinical assistant.');
  const [userPrompt, setUserPrompt] = useState('Hello! What is your model version?');
  const [testResponse, setTestResponse] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testMetrics, setTestMetrics] = useState<{ latency_ms: number } | null>(null);

  const loadDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, modelsRes] = await Promise.all([
        chatApi.getHealth(),
        chatApi.getModels()
      ]);
      setHealth(healthRes);
      setModels(modelsRes.models);
      setDefaultModel(modelsRes.default_model);
      if (!testModel) setTestModel(modelsRes.default_model || modelsRes.models[0] || '');
    } catch (error) {
      console.error('Failed to load diagnostics', error);
    } finally {
      setLoading(false);
    }
  }, [testModel]);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const handleTest = async () => {
    if (!userPrompt || !testModel) return;
    setTestLoading(true);
    setTestResponse('');
    setTestMetrics(null);

    try {
      const res = await chatApi.testPrompt({
        model_name: testModel,
        prompt: userPrompt,
        system_prompt: systemPrompt
      });
      if (res.success) {
        setTestResponse(res.content);
        setTestMetrics({ latency_ms: res.latency_ms });
      } else {
        setTestResponse(`Error: ${res.error}`);
      }
    } catch (err: any) {
      setTestResponse(`Failed to communicate: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 page-enter relative">
      <div className="absolute inset-0 bg-[radial-gradient(at_top_right,rgba(99,102,241,0.03),transparent_50%)] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-12 md:py-20 pb-40 space-y-12 md:space-y-20 relative z-10">
        {/* Header - Pro Clinical Design */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-2xl shadow-indigo-500/20 border border-white/20">
              <Cog6ToothIcon className="w-8 h-8 md:w-11 md:h-11" />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black tracking-[-0.04em] leading-none mb-2 md:mb-3 text-slate-900">{t('settings.title')}</h1>
              <div className="flex items-center gap-3 md:gap-4">
                <span className="h-1 w-8 md:w-12 bg-indigo-600 rounded-full shadow-[0_0_12px_rgba(79,70,229,0.4)]" />
                <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.4em] text-slate-400 italic">System Integrity & Diagnostics</p>
              </div>
            </div>
          </div>
          <button 
            onClick={loadDiagnostics}
            disabled={loading}
            className="flex items-center justify-center gap-3 px-8 md:px-10 h-14 md:h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-500/20 transition-all disabled:opacity-50"
          >
            <ArrowPathIcon className={clsx("w-5 h-5", loading && "animate-spin")} />
            Sync Hardware
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
          {/* Left Column: Diagnostics & Library */}
          <div className="lg:col-span-4 space-y-8 md:space-y-12">
            {/* Connection Card */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-300 italic">Network Node</h2>
                <div className={clsx(
                  "px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest border",
                  health?.status === 'online' 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                    : "bg-red-50 text-red-700 border-red-200"
                )}>
                  {health?.status === 'online' ? '● Active' : '● Offline'}
                </div>
              </div>

              <div className="space-y-6 md:space-y-8">
                <div className="space-y-2.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Primary API Endpoint</label>
                  <div className="bg-slate-50 p-5 md:p-6 rounded-2xl border border-slate-200 font-mono text-[11px] md:text-[12px] text-indigo-600 font-bold shadow-inner truncate">
                    {health?.base_url || '---'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Latency</span>
                    <span className="text-2xl md:text-3xl font-black text-indigo-600 tracking-tighter">
                      {health?.latency_ms || 0}<small className="text-xs text-slate-300 ml-1">ms</small>
                    </span>
                  </div>
                  <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Engines</span>
                    <span className="text-2xl md:text-3xl font-black text-emerald-600 tracking-tighter">{models.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Model Library Card */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
               <div className="p-8 md:p-10 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                 <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-300 italic">Inference Library</h2>
                 <CpuChipIcon className="w-6 h-6 text-slate-200" />
               </div>
               <div className="max-h-[300px] md:max-h-[440px] overflow-y-auto custom-scrollbar p-5 md:p-6 space-y-2">
                 {models.map(m => (
                   <div key={m} className={clsx(
                     "flex items-center justify-between p-4 md:p-5 rounded-2xl transition-all border-2",
                     m === defaultModel 
                        ? "bg-indigo-50 border-indigo-200" 
                        : "bg-transparent border-transparent hover:bg-slate-50"
                   )}>
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all", 
                          m === defaultModel ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-300"
                        )}>
                            <CpuChipIcon className="w-5 h-5 md:w-6 h-6" />
                        </div>
                        <span className={clsx("text-sm font-black tracking-tight", m === defaultModel ? "text-indigo-700" : "text-slate-400")}>{m}</span>
                      </div>
                      {m === defaultModel && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20">
                             Active
                        </div>
                      )}
                   </div>
                 ))}
               </div>
            </div>
          </div>

          {/* Right Column: Playground */}
          <div className="lg:col-span-8">
             <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
                <div className="p-8 md:p-12 lg:p-16 flex flex-col gap-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-4">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-[1.5rem] bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                          <BoltIcon className="w-8 h-8 md:w-10 md:h-10" />
                      </div>
                      <div>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 mb-1">{t('settings.playground')}</h2>
                        <div className="flex items-center gap-3">
                            <span className="h-1 w-8 bg-amber-500 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.4)]" />
                            <p className="text-[10px] md:text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] italic">Clinical Inference Sandbox</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative">
                        <select 
                            value={testModel}
                            onChange={(e) => setTestModel(e.target.value)}
                            style={{ backgroundColor: '#f8fafc', color: '#1e293b' }}
                            className="w-full md:w-64 h-14 md:h-16 rounded-2xl border-2 border-slate-200 px-6 font-black uppercase text-[12px] tracking-widest focus:outline-none focus:border-amber-500 transition-all appearance-none"
                        >
                            {models.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                    <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] italic pl-2">{t('settings.system_prompt')}</label>
                      <textarea 
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full h-48 md:h-64 rounded-3xl border-2 border-slate-200 bg-slate-50 p-6 md:p-8 font-mono text-[13px] text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white transition-all shadow-inner leading-relaxed resize-none"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] italic pl-2">{t('settings.user_prompt')}</label>
                      <textarea 
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        className="w-full h-48 md:h-64 rounded-3xl border-2 border-slate-200 bg-slate-50 p-6 md:p-8 font-mono text-[13px] text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white transition-all shadow-inner leading-relaxed resize-none"
                      />
                    </div>
                  </div>

                  {testMetrics && (
                     <div className="flex items-center justify-between p-6 px-10 rounded-[2rem] bg-slate-900 border border-slate-800 shadow-2xl animate-slide-up">
                        <div className="flex items-center gap-6">
                            <CommandLineIcon className="w-8 h-8 text-amber-500" />
                            <div className="flex gap-8 md:gap-12 text-[11px] font-black uppercase tracking-[0.4em]">
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-500">Latency</span>
                                    <span className="text-white">{testMetrics.latency_ms}ms</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-500">Status</span>
                                    <span className="text-emerald-400">Node Synced</span>
                                </div>
                            </div>
                        </div>
                        <CheckCircleIcon className="w-8 h-8 text-emerald-500/20 hidden md:block" />
                     </div>
                  )}

                  <div className="bg-slate-900 rounded-[2.5rem] md:rounded-[3.5rem] p-8 md:p-12 min-h-[300px] md:min-h-[360px] flex flex-col gap-6 md:gap-8 font-mono text-base relative shadow-inner border border-slate-800 overflow-hidden">
                    <div className="absolute top-8 right-12 text-[10px] font-black uppercase text-white/5 tracking-[0.5em] italic hidden md:block">Virtual TTY Architecture</div>
                    <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
                    
                    {testLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 opacity-20">
                        <ArrowPathIcon className="w-12 h-12 md:w-16 md:h-16 animate-spin text-white" />
                        <span className="text-[12px] font-black uppercase tracking-[0.6em] animate-pulse text-white">Establishing Link...</span>
                      </div>
                    ) : testResponse ? (
                      <div className="flex-1 animate-fade-in whitespace-pre-wrap leading-relaxed custom-scrollbar overflow-y-auto pr-6 text-emerald-400 relative z-10">
                          <span className="text-amber-500 mr-4 animate-pulse">█</span>
                          {testResponse}
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-6">
                          <InformationCircleIcon className="w-12 h-12 text-white/5" />
                          <div className="text-white/10 text-[11px] font-black uppercase tracking-[0.6em] text-center">Transmission Buffer Empty</div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <button 
                      onClick={handleTest}
                      disabled={testLoading || !userPrompt}
                      className="w-full h-20 md:h-24 rounded-[2rem] md:rounded-[3rem] bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-xl shadow-amber-500/20 flex items-center justify-center gap-4 md:gap-6 transition-all disabled:opacity-40"
                    >
                      {testLoading ? (
                        <ArrowPathIcon className="w-8 h-8 animate-spin" />
                      ) : (
                        <>
                          <PlayIcon className="w-8 h-8 md:w-10 md:h-10 fill-slate-900" />
                          <span className="tracking-[0.4em] font-black uppercase text-xs md:text-sm">Execute Clinical Reasoning</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
