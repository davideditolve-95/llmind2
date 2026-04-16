'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { benchmarkApi, type BenchmarkKPIs, type BenchmarkRun } from '@/lib/api';
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  BeakerIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  StarIcon,
  ClockIcon,
  CpuChipIcon,
  BoltIcon,
  ArrowPathIcon,
  FunnelIcon,
  TableCellsIcon,
  LightBulbIcon,
  PlayIcon,
  CommandLineIcon,
  ClipboardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
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
    <div className="group premium-card rounded-[2.5rem] bg-white transition-all hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-2 border-slate-200/60 overflow-hidden">
      <div className="card-body flex-row items-center gap-6 p-10">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${color} shadow-2xl flex-shrink-0 transition-transform group-hover:rotate-12 group-hover:scale-110 border border-white/50`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] opacity-30 font-black uppercase tracking-[0.3em] leading-none mb-3">{label}</p>
          <p className="text-4xl font-black tracking-tight leading-none text-slate-800">{value}</p>
          {sub && (
            <div className="flex items-center gap-2 mt-4 overflow-hidden">
               <span className="w-1.5 h-1.5 rounded-full bg-slate-200 flex-shrink-0" />
               <p className="text-[12px] font-bold opacity-40 truncate italic text-slate-500">
                 {sub}
               </p>
            </div>
          )}
        </div>
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
    <div className="mt-6 pt-6 border-t border-base-200">
      <h4 className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-4">
        {t('history.rate_response')} (Multi-Criteria)
      </h4>
      
      {run.evaluations && run.evaluations.length > 0 && (
        <div className="mb-6 space-y-3">
          {run.evaluations.map((ev) => (
            <div key={ev.id} className="bg-base-100 rounded-xl p-4 border border-base-200 shadow-sm flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-sm">{ev.evaluator_name}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <StarIcon key={star} className={clsx("w-3.5 h-3.5", star <= ev.rating ? "fill-warning text-warning" : "text-base-300 fill-base-300")} />
                    ))}
                  </div>
                </div>
                {ev.notes && <p className="text-xs opacity-50 mt-1 italic leading-relaxed">{ev.notes}</p>}
              </div>
              <button onClick={(e) => handleDelete(e, ev.id)} className="btn btn-error btn-xs btn-circle btn-ghost">
                <XCircleIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner">
        <input 
          type="text" value={evaluatorName} onClick={(e) => e.stopPropagation()}
          onChange={(e) => setEvaluatorName(e.target.value)}
          placeholder="Criterion (e.g. Accuracy, Empathy, Dr. Smith)"
          className="w-full h-10 px-4 rounded-xl border-2 border-slate-200 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:border-indigo-400 transition-colors"
        />
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
              onClick={(e) => { e.stopPropagation(); setSelected(star); }}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <StarIcon className={clsx("w-7 h-7 transition-colors", star <= (hover || selected) ? "fill-amber-400 text-amber-400" : "text-slate-200 fill-transparent")} />
            </button>
          ))}
          {selected > 0 && <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-black ml-2">{selected}/5</span>}
        </div>
        <textarea
          value={notes} onClick={(e) => e.stopPropagation()} onChange={(e) => setNotes(e.target.value)}
          placeholder={t('history.your_notes')} rows={2} className="w-full p-3 rounded-xl border-2 border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:border-indigo-400 transition-colors resize-none"
        />
        <button onClick={handleSave} disabled={!selected || !evaluatorName.trim() || saving}
          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-sm self-start transition-colors"
        >
          {saving ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : "Add Evaluation"}
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
    <div className="mt-6 pt-6 border-t border-slate-200 bg-slate-50 -mx-8 px-8 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CommandLineIcon className="w-4 h-4 text-slate-400" />
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('history.view_log')}</h4>
        </div>
        <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 text-sm font-black text-slate-600 hover:text-slate-800 bg-white border border-slate-200 shadow-sm rounded-xl transition-colors">
          {copying ? <CheckCircleIcon className="w-3 h-3 text-emerald-600" /> : <ClipboardIcon className="w-3 h-3" />}
          {copying ? "Copied!" : "Copy Full JSON"}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter mb-2 block">System & User Prompt</span>
          <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-auto max-h-64 shadow-inner custom-scrollbar">
            <span className="text-emerald-400 font-bold mb-2 block border-b border-white/10 pb-1 uppercase">SYSTEM:</span> {run.system_prompt_used || 'N/A'}\n\n
            <span className="text-cyan-400 font-bold mb-2 block border-b border-white/10 pb-1 uppercase">USER:</span> {run.prompt_used}
          </pre>
        </div>
        <div>
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter mb-2 block">Raw Response / Error</span>
          <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-auto max-h-64 shadow-inner custom-scrollbar whitespace-pre-wrap">
            {run.llm_response ? <MarkdownContent content={run.llm_response} className="text-slate-100" /> : (run.status === 'failed' ? <div className="text-red-400 font-bold">ERROR: {run.error_message}</div> : 'No response yet')}
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
    completed: { icon: <CheckCircleIcon className="w-4 h-4" />, class: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: t('history.status_completed') },
    failed: { icon: <XCircleIcon className="w-4 h-4" />, class: 'bg-red-100 text-red-700 border-red-200', label: t('history.status_failed') },
    running: { icon: <ArrowPathIcon className="w-4 h-4 animate-spin" />, class: 'bg-blue-100 text-blue-700 border-blue-200', label: t('history.status_running') },
    pending: { icon: <ClockIcon className="w-4 h-4" />, class: 'bg-slate-100 text-slate-500 border-slate-200', label: t('history.status_pending') },
  };
  const status = statusConfig[run.status] || statusConfig.pending;

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRetrying(true);
    try { await benchmarkApi.retryRun(run.id); onRetry(run.id); } finally { setRetrying(false); }
  };

  return (
    <>
      <div 
        onClick={() => setExpanded(!expanded)} 
        className={clsx(
          "flex items-center gap-6 py-6 px-10 cursor-pointer transition-all border-b border-slate-100", 
          expanded ? "bg-primary/5 ring-1 ring-inset ring-primary/10" : "hover:bg-slate-50"
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold truncate text-slate-800">{run.case_title}</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] italic">Case {run.case_number || 'N/A'}</span>
              <span className="h-1 w-1 rounded-full bg-slate-200" />
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">ID: {run.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>
        <div className="w-40">
          <div className="inline-flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100 shadow-sm">
            <CpuChipIcon className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-mono font-bold truncate text-indigo-700 uppercase tracking-tight">{run.model_name}</span>
          </div>
        </div>
        <div className="w-24 text-right">
          {run.similarity_score != null ? (
            <div className="flex flex-col items-end">
              <span className={clsx("text-base font-black leading-none", run.similarity_score >= 0.7 ? "text-success" : run.similarity_score >= 0.4 ? "text-warning" : "text-error")}>
                {(run.similarity_score * 100).toFixed(1)}%
              </span>
              <span className="text-[8px] font-black opacity-20 uppercase tracking-widest mt-1">Similarity</span>
            </div>
          ) : <span className="opacity-20">—</span>}
        </div>
        <div className="w-24 text-right pr-4">
           {run.latency_ms ? (
             <div className="flex flex-col items-end">
               <span className="text-xs font-bold text-base-content/60">{run.latency_ms}ms</span>
               <span className="text-[8px] font-black opacity-20 uppercase tracking-widest mt-0.5">Latency</span>
             </div>
           ) : <span className="opacity-20">—</span>}
        </div>
        <div className="w-36 flex justify-center">
          <div className={clsx('badge badge-lg gap-2 font-black uppercase text-[10px] h-9 px-4 border shadow-sm', status.class)}>
            {status.icon} 
            {status.label}
          </div>
        </div>
        <div className="w-32 flex items-center justify-end gap-3 pr-2">
          <button 
            onClick={handleRetry} 
            disabled={retrying || run.status === 'running' || run.status === 'pending'} 
            className="btn btn-ghost btn-sm btn-circle bg-white border border-slate-200 shadow-sm hover:bg-indigo-50 hover:text-indigo-600 transition-all"
          >
            <ArrowPathIcon className={clsx("w-4 h-4", retrying && "animate-spin")} />
          </button>
          <div className={clsx(
            "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
            expanded ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 rotate-180" : "bg-slate-100 text-slate-500"
          )}>
            <ChevronDownIcon className="w-4 h-4" />
          </div>
        </div>
      </div>
      {expanded && (
        <div className="bg-slate-50 divide-y divide-slate-100 border-t border-slate-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 p-10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h5 className="flex items-center gap-2 text-[11px] font-black text-amber-600 uppercase tracking-[0.2em]">
                  <StarIcon className="w-4 h-4 fill-amber-400" />
                  {t('history.gold_standard')}
                </h5>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-sm leading-relaxed min-h-[160px]">
                <div className="prose prose-sm max-w-none prose-slate">
                  {run.gold_standard_diagnosis ? <MarkdownContent content={run.gold_standard_diagnosis} /> : <span className="italic text-slate-300">N/A</span>}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="flex items-center gap-2 text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em]">
                <LightBulbIcon className="w-4 h-4" />
                {t('history.llm_response')}
              </h5>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-sm leading-relaxed min-h-[160px]">
                <div className="prose prose-sm max-w-none prose-slate">
                  {run.llm_response ? <MarkdownContent content={run.llm_response} /> : <span className="italic text-slate-300">N/A</span>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-10 p-10">
            <MultiEvaluationPanel run={run} onUpdate={onNeedsRefresh} />
            <TechnicalLog run={run} />
          </div>
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
    <div className="flex items-center justify-center py-20 gap-4 opacity-40">
      <ArrowPathIcon className="w-6 h-6 animate-spin text-primary" />
      <span className="text-[11px] font-black uppercase tracking-[0.2em] italic">Calculating Batch Insights...</span>
    </div>
  );

  if (!data) return null;

  const avgSimOverall = data.model_kpis.reduce((acc, m) => acc + (m.avg_similarity || 0), 0) / (data.model_kpis.length || 1);

  return (
   <div className="p-10 bg-slate-50 border-y border-slate-200 animate-slide-up space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 leading-none">Batch Performance</p>
           <p className="text-3xl font-black text-slate-900 leading-none">
             {Math.round(avgSimOverall * 100)}% 
             <span className="text-[11px] text-slate-300 font-bold ml-2 uppercase tracking-tighter italic">Avg Sim</span>
           </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-lg transition-all">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 leading-none">Batch Health</p>
           <p className="text-3xl font-black text-emerald-600 leading-none">
             {data.total_runs} 
             <span className="text-[11px] text-emerald-300 font-bold ml-2 uppercase tracking-tighter italic">Runs OK</span>
           </p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-indigo-200 shadow-sm hover:shadow-lg transition-all">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 leading-none">Mean Latency</p>
           <p className="text-3xl font-black text-indigo-600 leading-none">
             {Math.round(data.model_kpis.reduce((acc, m) => acc + (m.avg_latency_ms || 0), 0) / (data.model_kpis.length || 1))}ms
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all">
           <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.22em] mb-10 flex items-center gap-2">
             <div className="w-1 h-4 bg-indigo-500 rounded-full" />
             Batch Similarity per Model
           </h4>
           <div className="h-56">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.model_kpis.map(m => ({ name: m.model_name, Similarity: Math.round((m.avg_similarity || 0) * 100) }))}>
                  <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: '900', fill: '#94a3b8'}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis domain={[0, 100]} hide />
                  <Tooltip 
                    cursor={{fill: '#eef2ff', opacity: 0.8}}
                    contentStyle={{borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px', background: 'white', color: '#1e293b'}} 
                  />
                  <Bar dataKey="Similarity" fill="#6366f1" radius={[8, 8, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-all">
           <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.22em] mb-8 flex items-center gap-2">
             <div className="w-1 h-4 bg-emerald-500 rounded-full" />
             Batch Model Summary
           </h4>
           <div className="flex-1 overflow-auto custom-scrollbar">
             <table className="table w-full text-slate-800">
               <thead>
                 <tr className="border-b border-slate-200">
                   <th className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pb-4">Model</th>
                   <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pb-4">Sim</th>
                   <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pb-4 pr-4">Human Rating</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {data.model_kpis.map(m => (
                   <tr key={m.model_name} className="hover:bg-slate-50 transition-colors">
                     <td className="font-bold text-sm text-slate-800 py-4">{m.model_name}</td>
                     <td className="text-right font-black text-emerald-600 text-sm py-4">{((m.avg_similarity || 0) * 100).toFixed(1)}%</td>
                     <td className="text-right py-4 pr-4">
                        {m.avg_human_rating ? (
                          <div className="flex items-center justify-end gap-1.5">
                             <StarIcon className="w-4 h-4 text-amber-400 fill-amber-400" />
                             <span className="font-black text-amber-600 text-sm">{m.avg_human_rating.toFixed(1)}</span>
                          </div>
                        ) : <span className="text-[10px] text-slate-300 font-black uppercase tracking-tighter italic">— No Ratings</span>}
                     </td>
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
          "flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest border-2 shadow-sm transition-all",
          isOpen ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
        )}
      >
        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
        {label}
        <ChevronDownIcon className={clsx("w-3 h-3 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 z-50 overflow-hidden animate-slide-up origin-top-right">
          <div className="p-2 space-y-1">
            <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold hover:bg-slate-50 rounded-xl transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform"><TableCellsIcon className="w-4 h-4" /></div>
              <div className="flex flex-col text-left">
                <span className="text-slate-800">Spreadsheet (CSV)</span>
                <span className="text-[9px] font-normal text-slate-400">Best for analysis in Excel</span>
              </div>
            </button>
            <button onClick={() => handleExport('json')} className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold hover:bg-slate-50 rounded-xl transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform"><CodeBracketIcon className="w-4 h-4" /></div>
              <div className="flex flex-col text-left">
                <span className="text-slate-800">Raw Data (JSON)</span>
                <span className="text-[9px] font-normal text-slate-400">Full metadata & traces</span>
              </div>
            </button>
            <button onClick={() => handleExport('txt')} className="w-full flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold hover:bg-slate-50 rounded-xl transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-110 transition-transform"><DocumentTextIcon className="w-4 h-4" /></div>
              <div className="flex flex-col text-left">
                <span className="text-slate-800">Audit Report (TXT)</span>
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
    <div className="bg-white shadow-xl border border-slate-200/60 mb-12 overflow-hidden transition-all hover:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] rounded-[3rem]">
      <div 
        onClick={() => setIsExpanded(!isExpanded)} 
        className={clsx(
          "p-10 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between cursor-pointer group relative overflow-hidden",
          isExpanded && "bg-slate-50/50"
        )}
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50 rounded-full blur-[80px] translate-x-32 -translate-y-32" />
        
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
            <BoltIcon className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-black tracking-tight text-slate-900">{t('history.session')}</h3>
              <div className="bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                <span className="text-[10px] font-mono font-black text-slate-600 uppercase tracking-widest leading-none">ID: {group.batch_id.slice(0, 8)}</span>
              </div>
            </div>
            <div className="flex items-center gap-6 mt-3">
              <span className="text-[11px] font-bold opacity-40 flex items-center gap-2 uppercase tracking-widest">
                <ClockIcon className="w-4 h-4" /> 
                {new Date(group.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
                <span className="opacity-20">|</span>
                {new Date(group.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-success/10 text-success px-2.5 py-1 rounded-full border border-success/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">{completedCount} SUCCESS</span>
                </div>
                {failedCount > 0 && (
                  <div className="flex items-center gap-1.5 bg-error/10 text-error px-2.5 py-1 rounded-full border border-error/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">{failedCount} FAILED</span>
                  </div>
                )}
                {runningCount > 0 && (
                  <div className="flex items-center gap-1.5 bg-info/10 text-info px-2.5 py-1 rounded-full border border-info/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-info animate-ping" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">{runningCount} PENDING</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 mt-6 md:mt-0 relative z-10">
           <div className="flex items-center gap-3">
             <ExportDropdown batchId={group.batch_id} />
             <button 
               onClick={(e) => { e.stopPropagation(); setShowInsights(!showInsights); }}
               className={clsx(
                 "btn btn-md gap-3 font-black uppercase tracking-widest shadow-md transition-all",
                 showInsights ? "btn-neutral" : "btn-outline border-base-300 hover:border-primary hover:text-primary"
               )}
             >
               <ChartBarIcon className="w-5 h-5" />
               {showInsights ? "Hide Analytics" : "View Analytics"}
             </button>
           </div>
           {group.runs.length > 1 && (
             <div className="text-right pl-8 border-l border-base-200 hidden xl:block">
               <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] block mb-1 leading-none">Batch Score</span>
               <div className="flex items-center gap-2">
                 <span className={clsx("text-3xl font-black leading-none", avgSimilarity >= 0.7 ? "text-success" : "text-warning")}>
                   {(avgSimilarity * 100).toFixed(1)}%
                 </span>
               </div>
             </div>
           )}
           <div className={clsx(
             "w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-base-200 shadow-inner group-hover:bg-primary/10 group-hover:text-primary", 
             isExpanded && "bg-primary text-primary-content shadow-lg shadow-primary/20 rotate-180 group-hover:bg-primary group-hover:text-primary-content"
           )}>
             <ChevronDownIcon className="w-6 h-6" />
           </div>
        </div>
      </div>
      {showInsights && <BatchInsightPanel batchId={group.batch_id} />}
      {isExpanded && (
        <div className="bg-white divide-y divide-slate-100">
          <div className="flex items-center gap-4 py-3 px-6 bg-slate-50 border-b border-slate-200 font-black text-[9px] text-slate-400 uppercase tracking-widest">
            <div className="flex-1">{t('history.column_case')}</div>
            <div className="w-32">{t('history.column_model')}</div>
            <div className="w-24 text-right">{t('history.column_similarity')}</div>
            <div className="w-20 text-right">{t('history.column_latency')}</div>
            <div className="w-32 text-center">{t('history.column_status')}</div>
            <div className="w-24 text-right pr-2">Actions</div>
          </div>
          {group.runs.map(run => <RunRow key={run.id} run={run} onNeedsRefresh={onNeedsRefresh} onRetry={onRetry} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main Consolidated Page ──────────────────────────────────────────────
const MODEL_COLORS: Record<string, string> = { gemma4: '#6366f1', llama3: '#10b981', mistral: '#f59e0b', default: '#94a3b8' };
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
  }, [activeTab, page, modelFilter, statusFilter, historyLoading, groups.length]);

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
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 page-enter">
      {/* Header — no z-index override so content scrolls freely underneath */}
      <div className="bg-white border-b border-slate-200 px-10 py-10 shadow-sm relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] -mr-64 -mt-64" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-[80px] -ml-32 -mb-32" />
        
        <div className="max-w-7xl mx-auto relative">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center shadow-2xl shadow-primary/20 flex-shrink-0 animate-float">
                <BoltIcon className="w-9 h-9" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none mb-2 bg-clip-text text-transparent bg-gradient-to-r from-base-content to-base-content/60">
                  {t('benchmark.title')}
                </h1>
                <div className="flex items-center gap-2">
                  <span className="h-0.5 w-8 bg-primary rounded-full" />
                  <p className="text-xs font-black uppercase tracking-[0.3em] opacity-40 italic">
                    {t('benchmark.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 self-end lg:self-center">
              <ExportDropdown label="Global Export" />
              <div className={clsx(
                "flex items-center gap-3 px-5 py-2.5 rounded-2xl font-black uppercase text-[11px] border shadow-sm",
                ollamaStatus === 'online' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ollamaStatus === 'offline' ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-100 text-slate-500 border-slate-200"
              )}>
                <div className={clsx("w-2.5 h-2.5 rounded-full", ollamaStatus === 'online' ? "bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" : ollamaStatus === 'offline' ? "bg-error" : "bg-base-content/40")} />
                {ollamaStatus === 'online' ? "Ollama Online" : ollamaStatus === 'offline' ? "Ollama Offline" : "Checking Status"}
              </div>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <div className="tabs tabs-boxed bg-base-200 p-1.5 border border-base-200 h-14">
              <button 
                onClick={() => setActiveTab('analytics')} 
                className={clsx("tab h-full px-8 text-[11px] font-black uppercase tracking-widest", activeTab === 'analytics' && "tab-active")}
              >
                Analytics
              </button>
              <button 
                onClick={() => setActiveTab('history')} 
                className={clsx("tab h-full px-8 text-[11px] font-black uppercase tracking-widest", activeTab === 'history' && "tab-active")}
              >
                Full History
              </button>
            </div>
            
            {activeTab === 'history' && (
              <div className="flex flex-wrap items-center gap-4 animate-slide-up">
                <div className="form-control">
                  <select 
                    value={modelFilter} 
                    onChange={(e) => { setModelFilter(e.target.value); setPage(1); }} 
                    className="select select-bordered select-sm h-14 font-black uppercase tracking-widest text-[9px] min-w-[160px]"
                  >
                    <option value="">{t('history.filter_all')}</option>
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <select 
                    value={statusFilter} 
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} 
                    className="select select-bordered select-sm h-14 font-black uppercase tracking-widest text-[9px] min-w-[160px]"
                  >
                    <option value="">ALL STATUS</option>
                    <option value="completed">{t('history.status_completed')}</option>
                    <option value="failed">{t('history.status_failed')}</option>
                  </select>
                </div>
                <button 
                  onClick={() => loadData()} 
                  className="btn btn-outline btn-sm h-14 px-6 gap-2 normal-case font-black text-[10px] uppercase tracking-widest"
                >
                  <ArrowPathIcon className={clsx("w-4 h-4", historyLoading && "animate-spin")} />
                  Refresh
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area — overflow-auto without z-index so header doesn't block */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50">
        {activeTab === 'analytics' ? (
          <div className="max-w-7xl mx-auto p-12 space-y-8 animate-slide-up">
            {kpiLoading ? (
               <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-30">
                  <ArrowPathIcon className="w-10 h-10 animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Compiling Analytics...</span>
               </div>
            ) : !kpis || kpis.total_runs === 0 ? (
               <div className="flex flex-col items-center justify-center py-40 text-center opacity-30">
                 <BeakerIcon className="w-16 h-16 mb-6" />
                 <h3 className="text-xl font-black mb-2">{t('benchmark.no_data')}</h3>
                 <button onClick={() => window.location.href='/benchmark/cases'} className="btn btn-primary btn-outline btn-md mt-4">{t('benchmark.run_benchmark')}</button>
               </div>
            ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <KpiCard icon={<BeakerIcon className="w-6 h-6" />} label={t('benchmark.kpi_total_runs')} value={kpis.total_runs.toLocaleString()} color="bg-indigo-50 text-indigo-600" />
                  <KpiCard icon={<TableCellsIcon className="w-6 h-6" />} label={t('benchmark.kpi_total_cases')} value={kpis.total_cases.toLocaleString()} sub={`${kpis.reviewed_cases} Reviewed`} color="bg-emerald-50 text-emerald-600" />
                  <KpiCard icon={<CpuChipIcon className="w-6 h-6" />} label={t('benchmark.kpi_models')} value={kpis.models_tested.length} sub={kpis.models_tested.join(', ')} color="bg-cyan-50 text-cyan-600" />
                  <KpiCard icon={<ArrowTrendingUpIcon className="w-6 h-6" />} label="Avg Similarity" value={`${Math.round(kpis.model_kpis.reduce((acc, m) => acc + (m.avg_similarity || 0), 0) / (kpis.model_kpis.length || 1) * 100)}%`} color="bg-amber-50 text-amber-600" />
                </div>
                
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="section-card">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">{t('benchmark.chart_similarity')}</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={kpis.similarity_over_time}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                          <XAxis dataKey="date" tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                          <YAxis domain={[0,1]} tick={{fontSize: 9, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', background: 'white', color: '#1e293b'}} />
                          {kpis.models_tested.map(m => <Line key={m} type="monotone" dataKey="similarity" stroke={getModelColor(m)} strokeWidth={3} dot={false} />)}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="section-card">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Model Comparison</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} barSize={40}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                           <XAxis dataKey="name" tick={{fontSize: 9, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                           <YAxis domain={[0,100]} tick={{fontSize: 9, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                           <Tooltip cursor={{fill: '#f1f5f9', opacity: 0.8}} contentStyle={{borderRadius: '16px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b'}} />
                           <Bar dataKey="Similarity" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="section-card lg:col-span-2">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Advanced Diagnostics</h3>
                    <div className="h-[340px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={[ {subject: 'Similarity', ...Object.fromEntries(kpis.model_kpis.map(m => [m.model_name, Math.round((m.avg_similarity || 0) * 100)]))}, {subject: 'Latency', ...Object.fromEntries(kpis.model_kpis.map(m => [m.model_name, m.avg_latency_ms ? Math.max(0, 100 - m.avg_latency_ms / 100) : 0]))}, {subject: 'Ratings', ...Object.fromEntries(kpis.model_kpis.map(m => [m.model_name, Math.round((m.avg_human_rating || 0) * 20)]))} ]}>
                          <PolarGrid strokeOpacity={0.15} />
                          <PolarAngleAxis dataKey="subject" tick={{fontSize: 11, fontWeight: 'bold', fill: '#64748b'}} />
                          {kpis.models_tested.map(m => <Radar key={m} name={m} dataKey={m} stroke={getModelColor(m)} fill={getModelColor(m)} fillOpacity={0.1} />)}
                          <Legend wrapperStyle={{paddingTop: '20px', textTransform: 'uppercase', fontSize: '10px', fontWeight: '900', letterSpacing: '0.1em', color: '#64748b'}} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="section-card overflow-hidden p-0">
                  <div className="p-8 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em] flex items-center gap-3">
                      <div className="w-1 h-5 bg-indigo-500 rounded-full" />
                      Global Model Performance Matrix
                    </h3>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="table table-zebra w-full text-base-content">
                      <thead className="bg-base-200/30">
                        <tr className="text-[10px] uppercase font-black opacity-40 tracking-[0.15em] border-b border-base-200 italic">
                          <th className="py-6 pl-8">Model Identifier</th>
                          <th className="text-right py-6">Execution Load</th>
                          <th className="text-right py-6">Success Rate %</th>
                          <th className="text-right py-6">Calculated Latency</th>
                          <th className="text-right py-6 pr-8">AI Reasoning Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {kpis.model_kpis.map(m => (
                          <tr key={m.model_name} className="hover:bg-indigo-50/40 transition-all group">
                            <td className="pl-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-3 h-3 rounded-full" style={{backgroundColor: getModelColor(m.model_name)}} />
                                <span className="font-black text-slate-800 group-hover:text-indigo-700 transition-colors">{m.model_name}</span>
                              </div>
                            </td>
                            <td className="text-right font-black text-base-content/60">
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-black">{m.total_runs}</span>
                                <span className="text-[8px] opacity-30 uppercase tracking-tighter">Total Iterations</span>
                              </div>
                            </td>
                            <td className="text-right">
                               <div className="flex flex-col items-end">
                                 <span className="text-base font-black text-success leading-none">
                                   {m.avg_similarity ? `${(m.avg_similarity * 100).toFixed(1)}%` : '—'}
                                 </span>
                                 <div className="w-24 h-1.5 bg-base-200 rounded-full mt-2 overflow-hidden border border-base-300">
                                   <div 
                                     className="h-full bg-success rounded-full opacity-60" 
                                     style={{width: `${(m.avg_similarity || 0) * 100}%`}} 
                                   />
                                 </div>
                               </div>
                            </td>
                            <td className="text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-mono text-sm font-bold text-base-content/40 tracking-tighter">
                                  {m.avg_latency_ms ? `${Math.round(m.avg_latency_ms)}ms` : '—'}
                                </span>
                                <span className="text-[8px] opacity-20 uppercase font-black tracking-widest mt-1">Mean Response Time</span>
                              </div>
                            </td>
                            <td className="text-right pr-8">
                              {m.avg_human_rating ? (
                                <div className="flex flex-col items-end">
                                  <div className="flex items-center justify-end gap-1.5 bg-warning/10 text-warning px-3 py-1.5 rounded-full border border-warning/10">
                                    <StarIcon className="w-4 h-4 fill-warning" />
                                    <span className="font-black leading-none text-sm">{m.avg_human_rating.toFixed(1)}</span>
                                  </div>
                                  <span className="text-[8px] opacity-20 font-black uppercase tracking-widest mt-2">Historical Average</span>
                                </div>
                              ) : <span className="text-[10px] opacity-20 font-black uppercase tracking-tighter italic">— Not Rated</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="max-w-7xl mx-auto p-12 space-y-4 animate-slide-up pb-20">
            {historyLoading && groups.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-40 gap-6 opacity-30">
                  <TableCellsIcon className="w-12 h-12 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Indexing batch records...</span>
               </div>
            ) : groups.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-40 opacity-30">
                  <TableCellsIcon className="w-16 h-16 mb-6" />
                  <h3 className="text-xl font-black mb-2">{t('history.no_history')}</h3>
                  <p className="text-sm italic">No runs detected in current workspace</p>
               </div>
            ) : (
              <div className="space-y-6">
                {groups.map(group => <BatchGroup key={group.batch_id} group={group} onNeedsRefresh={() => loadData()} onRetry={loadData} />)}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-8">
                    <button 
                      onClick={() => setPage(p => Math.max(1, p - 1))} 
                      disabled={page === 1} 
                      className="btn btn-ghost btn-sm gap-2 normal-case font-black text-[10px] tracking-widest uppercase"
                    >
                      <ChevronLeftIcon className="w-4 h-4" /> 
                      Previous
                    </button>
                    <span className="text-[10px] font-black opacity-30 uppercase tracking-widest">Page {page} of {totalPages}</span>
                    <button 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                      disabled={page === totalPages} 
                      className="btn btn-ghost btn-sm gap-2 normal-case font-black text-[10px] tracking-widest uppercase"
                    >
                      Next 
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
