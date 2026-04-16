'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { benchmarkApi, type BenchmarkKPIs, type BenchmarkRun } from '@/lib/api';
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  FlaskConical, BarChart2, TrendingUp, Star, Clock, Cpu,
  Activity, RefreshCw, Filter, Database, Brain, Play, Terminal, 
  Clipboard, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, FileText, Code, Table
} from 'lucide-react';
import clsx from 'clsx';
import MarkdownContent from '@/components/ui/MarkdownContent';

// ─── Types ────────────────────────────────────────────────────────────────
interface BenchmarkGroup {
  batch_id: string;
  created_at: string;
  runs: BenchmarkRun[];
  isExpanded: boolean;
}

// ─── Shared Components ────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="card flex items-start gap-4 p-5 transition-all hover:shadow-md">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} shadow-sm`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">{value}</p>
        {sub && <p className="text-[10px] font-bold text-slate-400 mt-0.5 italic">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Components for History Tab ───────────────────────────────────────────
function MultiEvaluationPanel({ run, onUpdate }: { run: BenchmarkRun; onUpdate: () => void; }) {
  const { t } = useI18n();
  const [hover, setHover] = useState(0);
  const [selected, setSelected] = useState(0);
  const [evaluatorName, setEvaluatorName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selected || !evaluatorName.trim()) return;
    setSaving(true);
    try {
      await benchmarkApi.addEvaluation(run.id, { 
        evaluator_name: evaluatorName.trim(), 
        rating: selected, 
        notes 
      });
      setSelected(0);
      setEvaluatorName('');
      setNotes('');
      onUpdate();
    } catch (error) { console.error(error); } finally { setSaving(false); }
  };

  const handleDelete = async (e: React.MouseEvent, evalId: string) => {
    e.stopPropagation();
    try {
      await benchmarkApi.deleteEvaluation(run.id, evalId);
      onUpdate();
    } catch (error) { console.error(error); }
  };

  return (
    <div className="mt-6 pt-6 border-t border-warm-100">
      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
        {t('history.rate_response')} (Multi-Criteria)
      </h4>
      
      {run.evaluations && run.evaluations.length > 0 && (
        <div className="mb-6 space-y-3">
          {run.evaluations.map((ev) => (
            <div key={ev.id} className="bg-white rounded-xl p-4 border border-warm-200 shadow-sm flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-slate-700 text-sm whitespace-nowrap">{ev.evaluator_name}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} className={clsx("w-3.5 h-3.5", star <= ev.rating ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-slate-200")} />
                    ))}
                  </div>
                </div>
                {ev.notes && <p className="text-xs text-slate-500 mt-1 italic leading-relaxed">{ev.notes}</p>}
              </div>
              <button onClick={(e) => handleDelete(e, ev.id)} className="text-red-400 hover:text-red-600 transition-colors bg-red-50 p-1.5 rounded-lg ml-4">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 bg-warm-50/50 p-5 rounded-2xl border border-warm-100 shadow-inner-sm">
        <input 
          type="text" value={evaluatorName} onClick={(e) => e.stopPropagation()}
          onChange={(e) => setEvaluatorName(e.target.value)}
          placeholder="Criterion (e.g. Accuracy, Empathy, Dr. Smith)"
          className="input-field text-sm font-medium bg-white/80"
        />
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
              onClick={(e) => { e.stopPropagation(); setSelected(star); }}
              className="group transition-transform hover:scale-110 active:scale-95"
            >
              <Star className={clsx("w-7 h-7 transition-colors drop-shadow-sm", star <= (hover || selected) ? "fill-amber-400 text-amber-400" : "text-warm-200 fill-transparent")} />
            </button>
          ))}
          {selected > 0 && <span className="text-sm font-black text-amber-600 ml-2 bg-amber-50 px-2 py-0.5 rounded-full">{selected}/5</span>}
        </div>
        <textarea
          value={notes} onClick={(e) => e.stopPropagation()} onChange={(e) => setNotes(e.target.value)}
          placeholder={t('history.your_notes')} rows={2} className="textarea-field text-sm bg-white/80 transition-colors"
        />
        <button onClick={handleSave} disabled={!selected || !evaluatorName.trim() || saving}
          className="btn-primary self-start px-6 shadow-md hover:shadow-lg transition-all"
        >
          {saving ? <div className="flex items-center gap-2"><Loader className="w-4 h-4 animate-spin" />{t('common.loading')}</div> : "Add Evaluation"}
        </button>
      </div>
    </div>
  );
}

function TechnicalLog({ run }: { run: BenchmarkRun }) {
  const { t } = useI18n();
  const [copying, setCopying] = useState(false);
  const logContent = JSON.stringify(run, null, 2);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(logContent);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  return (
    <div className="mt-6 pt-6 border-t border-warm-100 bg-slate-900/5 -mx-8 px-8 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-500" />
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('history.view_log')}</h4>
        </div>
        <button onClick={handleCopy} className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors bg-white px-3 py-1 rounded-full border border-warm-200 shadow-sm">
          {copying ? <CheckCircle className="w-3 h-3 text-sage-500" /> : <Clipboard className="w-3 h-3" />}
          {copying ? "Copied!" : "Copy Full JSON"}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-2 block">System & User Prompt</span>
          <pre className="p-4 bg-slate-900 text-slate-300 rounded-xl text-[11px] font-mono overflow-auto max-h-64 shadow-inner custom-scrollbar">
            <span className="text-sage-400 font-bold mb-2 block border-b border-white/10 pb-1">SYSTEM:</span> {run.system_prompt_used || 'N/A'}\n\n
            <span className="text-powder-400 font-bold mb-2 block border-b border-white/10 pb-1">USER:</span> {run.prompt_used}
          </pre>
        </div>
        <div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-2 block">Raw Response / Error</span>
          <div className="p-4 bg-slate-900 text-slate-300 rounded-xl text-[11px] font-mono overflow-auto max-h-64 shadow-inner custom-scrollbar whitespace-pre-wrap prose-invert prose-xs">
            {run.llm_response ? <MarkdownContent content={run.llm_response} className="text-slate-300" /> : (run.status === 'failed' ? `ERROR: ${run.error_message}` : 'No response yet')}
          </div>
        </div>
      </div>
    </div>
  );
}

function RunRow({ run, onNeedsRefresh, onRetry }: { run: BenchmarkRun; onNeedsRefresh: () => void; onRetry: (id: string) => void; }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const statusConfig: Record<string, { icon: React.ReactNode; class: string; label: string }> = {
    completed: { icon: <CheckCircle className="w-3.5 h-3.5" />, class: 'badge-sage', label: t('history.status_completed') },
    failed: { icon: <XCircle className="w-3.5 h-3.5" />, class: 'badge-powder text-red-600 bg-red-50 border-red-100', label: t('history.status_failed') },
    running: { icon: <Loader className="w-3.5 h-3.5 animate-spin" />, class: 'badge-powder', label: t('history.status_running') },
    pending: { icon: <Clock className="w-3.5 h-3.5" />, class: 'badge-warm', label: t('history.status_pending') },
  };
  const status = statusConfig[run.status] || statusConfig.pending;

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRetrying(true);
    try { await benchmarkApi.retryRun(run.id); onRetry(run.id); } finally { setRetrying(false); }
  };

  return (
    <>
      <div onClick={() => setExpanded(!expanded)} className={clsx("flex items-center gap-4 py-4 px-6 cursor-pointer transition-all", expanded ? "bg-white/50" : "hover:bg-white/30")}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800 truncate">{run.case_title}</span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter italic">CASE: {run.case_number || 'N/A'}</span>
          </div>
        </div>
        <div className="w-32">
          <div className="flex items-center gap-2">
            <Brain className="w-3 h-3 text-powder-500" />
            <span className="text-[11px] font-mono font-bold text-slate-600 truncate bg-white px-2 py-0.5 rounded-lg border border-warm-200 shadow-inner-sm">{run.model_name}</span>
          </div>
        </div>
        <div className="w-24 text-right">
          {run.similarity_score != null ? (
            <span className={clsx("text-sm font-black", run.similarity_score >= 0.7 ? "text-sage-600" : run.similarity_score >= 0.4 ? "text-amber-500" : "text-red-500")}>{(run.similarity_score * 100).toFixed(1)}%</span>
          ) : <span className="text-warm-300">—</span>}
        </div>
        <div className="w-20 text-right">
           <span className="text-[10px] font-bold text-slate-400">{run.latency_ms ? `${run.latency_ms}ms` : '—'}</span>
        </div>
        <div className="w-32 flex justify-center">
          <span className={clsx('badge-premium flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold h-7', status.class)}>{status.icon} {status.label}</span>
        </div>
        <div className="w-24 flex items-center justify-end gap-2 px-2">
          <button onClick={handleRetry} disabled={retrying || run.status === 'running' || run.status === 'pending'} className="w-8 h-8 rounded-full bg-white border border-warm-200 flex items-center justify-center text-slate-400 hover:text-sage-600 hover:border-sage-200 transition-all disabled:opacity-30 shadow-sm"><Play className={clsx("w-3.5 h-3.5 fill-current", retrying && "animate-spin")} /></button>
          <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center transition-all", expanded ? "bg-sage-500 text-white rotate-180 shadow-md" : "bg-warm-100 text-slate-400")}><ChevronDown className="w-3 h-3" /></div>
        </div>
      </div>
      {expanded && (
        <div className="bg-white/80 border-y border-warm-100 p-8 space-y-8 animate-slide-down">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h5 className="flex items-center gap-2 text-[10px] font-black text-lavender-700 uppercase tracking-widest"><div className="w-1.5 h-4 bg-lavender-400 rounded-full" /> {t('history.gold_standard')}</h5>
              <div className="bg-lavender-50/50 p-5 rounded-2xl border border-lavender-100 text-sm text-slate-700 leading-relaxed shadow-inner-sm min-h-[120px]">
                {run.gold_standard_diagnosis ? <MarkdownContent content={run.gold_standard_diagnosis} /> : <span className="italic opacity-40">N/A</span>}
              </div>
            </div>
            <div className="space-y-3">
              <h5 className="flex items-center gap-2 text-[10px] font-black text-powder-700 uppercase tracking-widest"><div className="w-1.5 h-4 bg-powder-400 rounded-full" /> {t('history.llm_response')}</h5>
              <div className="bg-powder-50/50 p-5 rounded-2xl border border-powder-100 text-sm text-slate-700 leading-relaxed shadow-inner-sm min-h-[120px]">
                {run.llm_response ? <MarkdownContent content={run.llm_response} /> : <span className="italic opacity-40">N/A</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-8"><MultiEvaluationPanel run={run} onUpdate={onNeedsRefresh} /><TechnicalLog run={run} /></div>
        </div>
      )}
    </>
  );
}

function BatchInsightPanel({ batchId }: { batchId: string }) {
  const [data, setData] = useState<BenchmarkKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    benchmarkApi.getBatchKPIs(batchId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) return (
    <div className="flex items-center justify-center py-12 gap-3 opacity-40">
      <Loader className="w-5 h-5 animate-spin" />
      <span className="text-[10px] font-black uppercase tracking-widest">Calculating Batch Insights...</span>
    </div>
  );

  if (!data) return null;

  return (
    <div className="p-8 bg-slate-50/80 border-y border-warm-100 animate-slide-down space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch Performance</p>
           <p className="text-xl font-black text-slate-800">{Math.round((data.model_kpis.reduce((acc, m) => acc + (m.avg_similarity || 0), 0) / (data.model_kpis.length || 1)) * 100)}% <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Avg Sim</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch Health</p>
           <p className="text-xl font-black text-sage-600">{data.total_runs} <span className="text-[10px] text-slate-400 font-bold ml-1 uppercase">Total Completed</span></p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mean Latency</p>
           <p className="text-xl font-black text-slate-800">
             {Math.round(data.model_kpis.reduce((acc, m) => acc + (m.avg_latency_ms || 0), 0) / (data.model_kpis.length || 1))}ms
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-sm">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Batch Similarity per Model</h4>
           <div className="h-40">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={data.model_kpis.map(m => ({ name: m.model_name, Similarity: Math.round((m.avg_similarity || 0) * 100) }))}>
                 <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 'bold'}} />
                 <YAxis domain={[0, 100]} tick={{fontSize: 9}} />
                 <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                 <Bar dataKey="Similarity" fill="#87A878" radius={[6, 6, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-sm overflow-hidden flex flex-col">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Batch Model Summary</h4>
           <div className="flex-1 overflow-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-warm-100">
                   <th className="py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Model</th>
                   <th className="py-2 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Sim</th>
                   <th className="py-2 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Rating</th>
                 </tr>
               </thead>
               <tbody>
                 {data.model_kpis.map(m => (
                   <tr key={m.model_name} className="border-b border-warm-50 last:border-0">
                     <td className="py-2 text-xs font-bold text-slate-700">{m.model_name}</td>
                     <td className="py-2 text-right text-xs font-black text-sage-600">{((m.avg_similarity || 0) * 100).toFixed(1)}%</td>
                     <td className="py-2 text-right text-xs font-bold text-amber-500">{m.avg_human_rating ? m.avg_human_rating.toFixed(1) : '—'}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
}

function ExportDropdown({ batchId, label = "Export" }: { batchId?: string; label?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (format: 'csv' | 'json' | 'txt') => {
    try {
      const blob = await benchmarkApi.exportData(format, batchId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `benchmark_${batchId ? 'batch_' + batchId.slice(0, 8) : 'full'}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={clsx(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border",
          isOpen ? "bg-slate-900 border-slate-900 text-white shadow-lg lg:scale-105" : "bg-white border-warm-200 text-slate-500 hover:border-warm-300 active:scale-95"
        )}
      >
        <Download className="w-3.5 h-3.5" />
        {label}
        <ChevronDown className={clsx("w-3 h-3 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 z-50 overflow-hidden animate-slide-down origin-top-right">
          <div className="p-2 space-y-1">
            <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-sage-50 text-sage-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Table className="w-4 h-4" /></div>
              <div className="flex flex-col text-left">
                <span>Spreadsheet (CSV)</span>
                <span className="text-[9px] font-normal text-slate-400">Best for analysis in Excel</span>
              </div>
            </button>
            <button onClick={() => handleExport('json')} className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-powder-50 text-powder-600 flex items-center justify-center group-hover:scale-110 transition-transform"><Code className="w-4 h-4" /></div>
              <div className="flex flex-col text-left">
                <span>Raw Data (JSON)</span>
                <span className="text-[9px] font-normal text-slate-400">Full metadata & metadata</span>
              </div>
            </button>
            <button onClick={() => handleExport('txt')} className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-lavender-50 text-lavender-600 flex items-center justify-center group-hover:scale-110 transition-transform"><FileText className="w-4 h-4" /></div>
              <div className="flex flex-col text-left">
                <span>Audit Report (TXT)</span>
                <span className="text-[9px] font-normal text-slate-400">Clean clinical summary</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BatchGroup({ group, onNeedsRefresh, onRetry }: { group: BenchmarkGroup; onNeedsRefresh: () => void; onRetry: (id: string) => void; }) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(group.isExpanded);
  const [showInsights, setShowInsights] = useState(false);
  const completedCount = group.runs.filter(r => r.status === 'completed').length;
  const failedCount = group.runs.filter(r => r.status === 'failed').length;
  const runningCount = group.runs.filter(r => r.status === 'running' || r.status === 'pending').length;
  const avgSimilarity = group.runs.reduce((acc, r) => acc + (r.similarity_score || 0), 0) / (group.runs.filter(r => r.similarity_score != null).length || 1);

  return (
    <div className="card mb-8 p-0 overflow-hidden ring-1 ring-warm-200/50 shadow-premium transition-all hover:shadow-3xl bg-white/40">
      <div onClick={() => setIsExpanded(!isExpanded)} className="p-6 bg-white/60 backdrop-blur-md flex items-center justify-between cursor-pointer group">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform"><Activity className="w-6 h-6" /></div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">{t('history.session')}</h3>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-warm-100 px-2 py-0.5 rounded-md uppercase tracking-tighter">ID: {group.batch_id.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest"><Clock className="w-3 h-3" />{new Date(group.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-sage-600 bg-sage-50 px-2 py-0.5 rounded-full border border-sage-100">{completedCount} DONE</span>
                {failedCount > 0 && <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">{failedCount} FAIL</span>}
                {runningCount > 0 && <span className="text-[9px] font-black text-powder-600 bg-powder-50 px-2 py-0.5 rounded-full border border-powder-100 animate-pulse">{runningCount} RUN</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <ExportDropdown batchId={group.batch_id} />
           <button 
             onClick={(e) => { e.stopPropagation(); setShowInsights(!showInsights); }}
             className={clsx(
               "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               showInsights ? "bg-slate-900 text-white shadow-lg" : "bg-white border border-warm-200 text-slate-500 hover:border-warm-300 shadow-sm"
             )}
           >
             <BarChart2 className="w-3.5 h-3.5" />
             {showInsights ? "Close Insights" : "View Insights"}
           </button>
           {group.runs.length > 1 && (
             <div className="text-right pr-8 border-r border-warm-200">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Avg Similarity</span>
               <span className="text-xl font-black text-slate-800">{(avgSimilarity * 100).toFixed(1)}%</span>
             </div>
           )}
           <div className={clsx("w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-sm", isExpanded ? "bg-slate-900 text-white rotate-180" : "bg-white border border-warm-200 text-slate-400")}><ChevronDown className="w-5 h-5" /></div>
        </div>
      </div>
      {showInsights && <BatchInsightPanel batchId={group.batch_id} />}
      {isExpanded && (
        <div className="bg-warm-50/30 divide-y divide-warm-100/50">
          <div className="flex items-center gap-4 py-3 px-6 bg-slate-50/50 border-y border-warm-100">
            <div className="flex-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('history.column_case')}</div>
            <div className="w-32 text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">{t('history.column_model')}</div>
            <div className="w-24 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">{t('history.column_similarity')}</div>
            <div className="w-20 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">{t('history.column_latency')}</div>
            <div className="w-32 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans">{t('history.column_status')}</div>
            <div className="w-24 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans pr-2">Actions</div>
          </div>
          {group.runs.map(run => <RunRow key={run.id} run={run} onNeedsRefresh={onNeedsRefresh} onRetry={onRetry} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main Consolidated Page ──────────────────────────────────────────────
const MODEL_COLORS: Record<string, string> = { gemma4: '#87A878', llama3: '#B4D4E7', mistral: '#C9B8D4', default: '#D4C5B0' };
const getModelColor = (model: string) => MODEL_COLORS[model] || MODEL_COLORS.default;

export default function BenchmarkConsolidatedPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'analytics' | 'history'>('analytics');
  
  // Analytics State
  const [kpis, setKpis] = useState<BenchmarkKPIs | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [ollamaStatus, setOllamaStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // History State
  const [groups, setGroups] = useState<BenchmarkGroup[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [modelFilter, setModelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Grouping History Data
  const groupRuns = (rawRuns: BenchmarkRun[]): BenchmarkGroup[] => {
    const groupsMap = new Map<string, BenchmarkRun[]>();
    const unbatched: BenchmarkRun[] = [];
    rawRuns.forEach(run => {
      if (run.batch_id) {
        if (!groupsMap.has(run.batch_id)) groupsMap.set(run.batch_id, []);
        groupsMap.get(run.batch_id)?.push(run);
      } else unbatched.push(run);
    });
    const batchedGroups: BenchmarkGroup[] = Array.from(groupsMap.entries()).map(([id, runs]) => ({
      batch_id: id, created_at: runs[0].created_at,
      runs: runs.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      isExpanded: false
    }));
    const unbatchedGroups: BenchmarkGroup[] = unbatched.map(run => ({
      batch_id: run.id, created_at: run.created_at, runs: [run], isExpanded: false
    }));
    return [...batchedGroups, ...unbatchedGroups].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const loadData = useCallback(async () => {
    if (activeTab === 'analytics') {
      setKpiLoading(true);
      try { const res = await benchmarkApi.getKPIs(); setKpis(res); } finally { setKpiLoading(false); }
    } else {
      setHistoryLoading(historyLoading && groups.length === 0);
      try {
        const res = await benchmarkApi.getHistory({ page, page_size: 100, model_name: modelFilter || undefined, status: statusFilter || undefined });
        setGroups(groupRuns(res.items));
        setTotalRecords(res.total);
        setTotalPages(res.total_pages);
        const models = [...new Set(res.items.map((r) => r.model_name))];
        if (models.length > 0) setAvailableModels(prev => [...new Set([...prev, ...models])]);
      } finally { setHistoryLoading(false); }
    }
  }, [activeTab, page, modelFilter, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Ollama Check
  useEffect(() => {
    import('@/lib/api').then(({ chatApi }) => {
      chatApi.getModels().then(() => setOllamaStatus('online')).catch(() => setOllamaStatus('offline'));
    });
  }, []);

  // Auto-refresh History
  useEffect(() => {
    const hasActive = groups.some(g => g.runs.some(r => r.status === 'running' || r.status === 'pending'));
    if (hasActive && !refreshInterval.current) refreshInterval.current = setInterval(() => loadData(), 4000);
    else if (!hasActive && refreshInterval.current) { clearInterval(refreshInterval.current); refreshInterval.current = null; }
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
  }, [groups, loadData]);


  const barData = kpis?.model_kpis.map((m) => ({ name: m.model_name, Similarity: m.avg_similarity ? Math.round(m.avg_similarity * 100) : 0 })) || [];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-warm-50 page-enter font-sans">
      {/* Consolidated Premium Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-warm-200 px-8 py-8 z-20 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sage-100/40 rounded-full blur-3xl -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-powder-100/30 rounded-full blur-3xl -mb-32 opacity-40" />
        
        <div className="flex justify-between items-start relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
               <div className="w-10 h-10 rounded-2xl bg-sage-500 flex items-center justify-center text-white shadow-lg">
                  <Activity className="w-6 h-6" />
               </div>
               <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{t('benchmark.title')}</h1>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] ml-14 italic">{t('benchmark.subtitle')}</p>
          </div>

          <div className="flex items-center gap-4">
            <ExportDropdown label="Global Export" />
            <div className={clsx("px-5 py-2.5 rounded-2xl border flex items-center gap-3 transition-all h-10 shadow-sm", ollamaStatus === 'online' ? "bg-sage-50 border-sage-100 text-sage-600" : ollamaStatus === 'offline' ? "bg-red-50 border-red-100 text-red-600" : "bg-warm-50 border-warm-100 text-slate-400")}>
              <div className={clsx("w-2 h-2 rounded-full", ollamaStatus === 'online' ? "bg-sage-500 animate-pulse" : ollamaStatus === 'offline' ? "bg-red-500" : "bg-slate-300")} />
              <span className="text-[10px] font-black uppercase tracking-widest">{ollamaStatus === 'online' ? "Ollama Online" : ollamaStatus === 'offline' ? "Ollama Offline" : "Ollama Stat"}</span>
            </div>
          </div>
        </div>

        {/* Tab Switcher (Pill Style) */}
        <div className="mt-10 flex items-center gap-6">
           <div className="flex p-1.5 rounded-[1.4rem] border border-warm-200 bg-warm-100/50 backdrop-blur-sm shadow-inner-sm">
             <button onClick={() => setActiveTab('analytics')} className={clsx("px-8 py-2.5 text-[11px] font-black tracking-widest uppercase rounded-[1rem] transition-all", activeTab === 'analytics' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-700")}>Analytics</button>
             <button onClick={() => setActiveTab('history')} className={clsx("px-8 py-2.5 text-[11px] font-black tracking-widest uppercase rounded-[1rem] transition-all", activeTab === 'history' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-700")}>Detailed History</button>
           </div>
           
           {activeTab === 'history' && (
             <>
               <div className="flex items-center gap-3 bg-white/50 px-5 py-2.5 rounded-[1.4rem] border border-warm-200">
                 <Filter className="w-3.5 h-3.5 text-slate-400" />
                 <select value={modelFilter} onChange={(e) => { setModelFilter(e.target.value); setPage(1); }} className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none">
                    <option value="">{t('history.filter_all')}</option>
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
               </div>
               <div className="flex items-center gap-3 bg-white/50 px-5 py-2.5 rounded-[1.4rem] border border-warm-200">
                 <Activity className="w-3.5 h-3.5 text-slate-400" />
                 <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none">
                    <option value="">ALL STATUS</option>
                    <option value="completed">{t('history.status_completed')}</option>
                    <option value="failed">{t('history.status_failed')}</option>
                 </select>
               </div>
               <div className="ml-auto flex items-center gap-4">
                 <button onClick={() => loadData()} className="btn-secondary px-5 py-2.5 rounded-[1.4rem] text-[9px] font-black tracking-widest uppercase items-center flex gap-2"><RefreshCw className={clsx("w-3 h-3", historyLoading && "animate-spin")} /> Update</button>
               </div>
             </>
           )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-12 bg-warm-50/20 shadow-inner">
        {activeTab === 'analytics' ? (
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            {kpiLoading ? (
               <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-30"><Loader className="w-10 h-10 animate-spin" /><span className="text-[10px] font-black uppercase tracking-widest">Compiling Analytics...</span></div>
            ) : !kpis || kpis.total_runs === 0 ? (
               <div className="card text-center py-24 border-dashed bg-transparent border-warm-300 shadow-none">
                 <FlaskConical className="w-12 h-12 text-warm-200 mx-auto mb-6" />
                 <h3 className="text-xl font-bold text-slate-800 mb-2">{t('benchmark.no_data')}</h3>
                 <a href="/benchmark/cases" className="btn-primary inline-flex px-8 mt-4">{t('benchmark.run_benchmark')}</a>
               </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <KpiCard icon={<FlaskConical className="w-5 h-5 text-sage-600" />} label={t('benchmark.kpi_total_runs')} value={kpis.total_runs.toLocaleString()} color="bg-sage-100" />
                  <KpiCard icon={<BarChart2 className="w-5 h-5 text-powder-600" />} label={t('benchmark.kpi_total_cases')} value={kpis.total_cases.toLocaleString()} sub={`${kpis.reviewed_cases} Reviewed`} color="bg-powder-100" />
                  <KpiCard icon={<Cpu className="w-5 h-5 text-lavender-600" />} label={t('benchmark.kpi_models')} value={kpis.models_tested.length} sub={kpis.models_tested.join(', ')} color="bg-lavender-100" />
                  <KpiCard icon={<TrendingUp className="w-5 h-5 text-warm-600" />} label="Avg Similarity" value={`${Math.round(kpis.model_kpis.reduce((acc, m) => acc + (m.avg_similarity || 0), 0) / (kpis.model_kpis.length || 1) * 100)}%`} color="bg-warm-100" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="card p-8"><h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-8">{t('benchmark.chart_similarity')}</h3><ResponsiveContainer width="100%" height={260}><LineChart data={kpis.similarity_over_time}><CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" /><XAxis dataKey="date" tick={{fontSize: 10}} /><YAxis domain={[0,1]} tick={{fontSize: 10}} /><Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />{kpis.models_tested.map(m => <Line key={m} type="monotone" dataKey="similarity" stroke={getModelColor(m)} strokeWidth={3} dot={false} />)}</LineChart></ResponsiveContainer></div>
                  <div className="card p-8"><h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-8">Model Performance comparison</h3><ResponsiveContainer width="100%" height={260}><BarChart data={barData} barSize={40}><CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" /><XAxis dataKey="name" tick={{fontSize: 10}} /><YAxis domain={[0,100]} tick={{fontSize: 10}} /><Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '16px'}} /><Bar dataKey="Similarity" fill="#87A878" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer></div>
                  <div className="card p-8 col-span-1 lg:col-span-2"><h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-8">Multi-dimensional Diagnostics</h3><ResponsiveContainer width="100%" height={300}><RadarChart data={[ {subject: 'Similarity', ...Object.fromEntries(kpis.model_kpis.map(m => [m.model_name, Math.round((m.avg_similarity || 0) * 100)]))}, {subject: 'Latency', ...Object.fromEntries(kpis.model_kpis.map(m => [m.model_name, m.avg_latency_ms ? Math.max(0, 100 - m.avg_latency_ms / 100) : 0]))}, {subject: 'Ratings', ...Object.fromEntries(kpis.model_kpis.map(m => [m.model_name, Math.round((m.avg_human_rating || 0) * 20)]))} ]}><PolarGrid stroke="#e8e2d8" /><PolarAngleAxis dataKey="subject" tick={{fontSize: 11, fontWeight: 'bold'}} />{kpis.models_tested.map(m => <Radar key={m} name={m} dataKey={m} stroke={getModelColor(m)} fill={getModelColor(m)} fillOpacity={0.1} />)}<Legend /></RadarChart></ResponsiveContainer></div>
                </div>

                <div className="card p-0 overflow-hidden"><div className="p-8 border-b border-warm-100 bg-slate-50/50"><h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400">Benchmark Model Summary</h3></div><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Model</th><th className="text-right">Total Runs</th><th className="text-right">Avg Similarity</th><th className="text-right">Calculated Latency</th><th className="text-right">Rating Score</th></tr></thead><tbody>{kpis.model_kpis.map(m => <tr key={m.model_name} className="hover:bg-warm-50/50 transition-colors"><td><div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full" style={{background: getModelColor(m.model_name)}} /><span className="font-bold text-slate-700">{m.model_name}</span></div></td><td className="text-right font-black text-slate-900">{m.total_runs}</td><td className="text-right text-sage-600 font-bold">{m.avg_similarity ? `${(m.avg_similarity * 100).toFixed(1)}%` : '—'}</td><td className="text-right text-slate-500 text-xs font-bold">{m.avg_latency_ms ? `${Math.round(m.avg_latency_ms)}ms` : '—'}</td><td className="text-right">{m.avg_human_rating ? <span className="text-amber-500 font-black">{'★'.repeat(Math.round(m.avg_human_rating))} <span className="text-[10px] text-slate-400 ml-1">({m.avg_human_rating.toFixed(1)})</span></span> : '—'}</td></tr>)}</tbody></table></div></div>
              </>
            )}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-4 animate-fade-in pb-20">
            {historyLoading && groups.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-40 gap-6 opacity-30 animate-pulse"><Database className="w-12 h-12 text-warm-200" /><span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Indexing batch records...</span></div>
            ) : groups.length === 0 ? (
               <div className="card max-w-lg mx-auto py-24 text-center border-dashed bg-transparent border-warm-300 shadow-none"><Database className="w-12 h-12 mx-auto mb-6 text-warm-200" /><h3 className="text-xl font-bold text-slate-800 mb-2">{t('history.no_history')}</h3><p className="text-sm text-slate-400 italic">No runs detected in current workspace</p></div>
            ) : (
              <div className="space-y-6">
                {groups.map(group => <BatchGroup key={group.batch_id} group={group} onNeedsRefresh={() => loadData()} onRetry={loadData} />)}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-8"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary px-8 font-black text-[10px] tracking-widest uppercase disabled:opacity-30 self-start shadow-sm"><ChevronLeft className="w-4 h-4 mr-2" /> Previous</button><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Page {page} of {totalPages}</span><button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary px-8 font-black text-[10px] tracking-widest uppercase disabled:opacity-30 self-start shadow-sm">Next <ChevronRight className="w-4 h-4 ml-2" /></button></div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
