'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { chatApi } from '@/lib/api';
import { 
  Settings, Activity, Cpu, Play, RefreshCw, CheckCircle, 
  XCircle, Zap, Terminal, Clock, ShieldCheck, Database
} from 'lucide-react';
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
    <div className="flex flex-col min-h-screen bg-warm-50 page-enter">
      {/* Premium Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-warm-200 px-12 py-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sage-100/20 rounded-full blur-3xl -mr-48 -mt-48" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
             <div className="w-14 h-14 rounded-3xl bg-slate-900 flex items-center justify-center shadow-2xl">
               <Settings className="w-7 h-7 text-white" />
             </div>
             <div>
               <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">
                 {t('settings.title')}
               </h1>
               <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-2 italic shadow-sm bg-white/50 inline-block px-3 py-1 rounded-full border border-warm-100">
                 {t('settings.subtitle')}
               </p>
             </div>
          </div>
        </div>
      </div>

      <div className="p-12 space-y-10 max-w-screen-2xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Colonna Sinistra: Diagnostica e Modelli */}
          <div className="lg:col-span-4 space-y-10">
            
            {/* Connection Status Card */}
            <section className="bg-white rounded-[2.5rem] border border-warm-200 shadow-premium overflow-hidden transition-all hover:shadow-3xl">
              <div className="p-8 border-b border-warm-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-sage-500" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">{t('settings.connection')}</h2>
                </div>
                <button 
                  onClick={loadDiagnostics}
                  disabled={loading}
                  className="w-10 h-10 rounded-xl bg-white border border-warm-200 flex items-center justify-center hover:bg-sage-50 hover:text-sage-600 transition-all shadow-sm active:scale-95"
                >
                  <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">{t('settings.status')}</span>
                  <div className={clsx(
                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                    health?.status === 'online' ? "bg-sage-100 text-sage-600 shadow-sm border border-sage-200" : "bg-red-50 text-red-600 border border-red-100 shadow-sm"
                  )}>
                    {health?.status === 'online' ? (
                      <><CheckCircle className="w-3 h-3 animate-pulse" /> {t('settings.status_online')}</>
                    ) : (
                      <><XCircle className="w-3 h-3" /> {t('settings.status_offline')}</>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">{t('settings.base_url')}</span>
                    <div className="bg-warm-50/80 px-4 py-3 rounded-2xl border border-warm-100 font-mono text-xs text-slate-600 shadow-inner-sm overflow-hidden text-ellipsis">
                      {health?.base_url || '—'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-sage-50/30 p-4 rounded-2xl border border-sage-100 shadow-sm">
                      <span className="text-[9px] font-black text-sage-600 uppercase tracking-widest block mb-1">{t('settings.ping')}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-slate-800">{health?.latency_ms || 0}</span>
                        <span className="text-[10px] font-bold text-slate-400">ms</span>
                      </div>
                    </div>
                    <div className="bg-powder-50/30 p-4 rounded-2xl border border-powder-100 shadow-sm">
                      <span className="text-[9px] font-black text-powder-600 uppercase tracking-widest block mb-1">Models</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-slate-800">{models.length}</span>
                        <span className="text-[10px] font-bold text-slate-400">installed</span>
                      </div>
                    </div>
                  </div>

                  {health?.error && (
                    <div className="p-4 bg-red-50 rounded-2xl border border-red-100 text-[11px] text-red-700 leading-relaxed italic">
                      {health.error}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Model Library Card */}
            <section className="bg-white rounded-[2.5rem] border border-warm-200 shadow-premium overflow-hidden transition-all hover:shadow-3xl">
              <div className="p-8 border-b border-warm-100 bg-slate-50/50 flex items-center gap-3">
                <Database className="w-5 h-5 text-powder-500" />
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">{t('settings.models')}</h2>
              </div>
              <div className="p-6 max-h-[400px] overflow-y-auto">
                <div className="space-y-2">
                  {models.map((m) => (
                    <div 
                      key={m} 
                      className={clsx(
                        "group flex items-center justify-between p-4 rounded-2xl transition-all border",
                        m === defaultModel ? "bg-sage-50 border-sage-200 shadow-sm ring-1 ring-sage-100" : "bg-white border-transparent hover:bg-warm-50 hover:border-warm-100"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={clsx(
                          "w-2 h-2 rounded-full",
                          m === defaultModel ? "bg-sage-500 animate-pulse" : "bg-slate-300"
                        )} />
                        <span className={clsx("text-xs font-bold font-mono", m === defaultModel ? "text-sage-700" : "text-slate-600")}>{m}</span>
                      </div>
                      {m === defaultModel && (
                        <span className="text-[9px] font-black text-sage-400 uppercase tracking-widest italic opacity-60">System Default</span>
                      )}
                    </div>
                  ))}
                  {models.length === 0 && (
                    <div className="text-center py-10 opacity-40">
                      <Cpu className="w-10 h-10 mx-auto mb-3" />
                      <p className="text-xs font-bold uppercase tracking-widest">No models detected</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Colonna Destra: Playground */}
          <div className="lg:col-span-8">
            <section className="bg-white h-full rounded-[3.5rem] border-2 border-warm-200 shadow-premium flex flex-col overflow-hidden">
              <div className="p-10 border-b border-warm-100 bg-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-powder-100 flex items-center justify-center text-powder-600 shadow-inner">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">{t('settings.playground')}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic leading-none">Safe sandbox inference environment</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                   <div className="flex flex-col items-end gap-1">
                     <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">{t('settings.model_to_test')}</span>
                     <select 
                       value={testModel}
                       onChange={(e) => setTestModel(e.target.value)}
                       className="bg-warm-50 border-none text-xs font-black uppercase tracking-widest text-slate-700 px-4 py-2 rounded-xl focus:ring-2 focus:ring-powder-200 transition-all outline-none"
                     >
                       {models.map(m => <option key={m} value={m}>{m}</option>)}
                     </select>
                   </div>
                </div>
              </div>

              <div className="flex-1 p-10 space-y-8 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* System Prompt */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-sage-600 uppercase tracking-widest">
                       <ShieldCheck className="w-3.5 h-3.5" />
                       {t('settings.system_prompt')}
                    </label>
                    <textarea 
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      rows={5}
                      className="textarea-field font-mono text-xs bg-slate-50 border-warm-100 focus:bg-white focus:border-sage-300 transition-all rounded-3xl p-6"
                      placeholder="e.g. You are a clinical informatics expert..."
                    />
                  </div>

                  {/* User Prompt */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-powder-600 uppercase tracking-widest">
                       <Terminal className="w-3.5 h-3.5" />
                       {t('settings.user_prompt')}
                    </label>
                    <textarea 
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      rows={5}
                      className="textarea-field font-mono text-xs bg-slate-50 border-warm-100 focus:bg-white focus:border-powder-300 transition-all rounded-3xl p-6"
                      placeholder="Insert your test message here..."
                    />
                  </div>
                </div>

                {/* Performance Metrics Bar (if response exists) */}
                {testMetrics && (
                   <div className="flex items-center gap-6 px-8 py-4 bg-slate-900 text-white rounded-[2rem] shadow-xl animate-fade-in group">
                     <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                        <Zap className="w-4 h-4 text-powder-400 group-hover:scale-110 transition-transform" />
                        <div className="flex flex-col">
                           <span className="text-[8px] font-black uppercase tracking-widest opacity-40 leading-none mb-1">Performance</span>
                           <span className="text-xs font-black text-powder-400">High Efficiency</span>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-sage-400" />
                        <div className="flex flex-col">
                           <span className="text-[8px] font-black uppercase tracking-widest opacity-40 leading-none mb-1">Inference Time</span>
                           <span className="text-xs font-black">{testMetrics.latency_ms} ms</span>
                        </div>
                     </div>
                   </div>
                )}

                {/* Output Area */}
                <div className="space-y-3 relative group">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                     {t('settings.response')}
                  </label>
                  <div className={clsx(
                    "min-h-[250px] bg-slate-50 border-2 border-dashed border-warm-200 rounded-[3rem] p-10 text-sm leading-relaxed text-slate-700 font-mono relative overflow-hidden transition-all",
                    testLoading && "animate-pulse border-powder-200"
                  )}>
                    {testLoading ? (
                      <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-40 pt-20">
                         <RefreshCw className="w-8 h-8 animate-spin" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Querying local LLM engine...</span>
                      </div>
                    ) : testResponse ? (
                      <div className="whitespace-pre-wrap">{testResponse}</div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-300 pt-24 italic">
                        The model output will appear here after the inference.
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary CTA */}
                <div className="pt-4">
                  <button 
                    onClick={handleTest}
                    disabled={testLoading || !userPrompt}
                    className="btn-primary w-full h-16 rounded-[2rem] shadow-glow-powder text-base flex items-center justify-center gap-3 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:translate-y-0"
                  >
                    {testLoading ? (
                      <><RefreshCw className="w-5 h-5 animate-spin" /> {t('benchmark.running')}</>
                    ) : (
                      <><Play className="w-5 h-5 fill-white" /> {t('settings.send_test')} ({testModel})</>
                    )}
                  </button>
                </div>
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}
