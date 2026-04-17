'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { casesApi, benchmarkApi, type DSM5CaseSummary } from '@/lib/api';
import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  PlayIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  CheckIcon,
  SparklesIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

// ─── Pannello di esecuzione benchmark ────────────────────────────────────
function RunBenchmarkPanel({
  selectedCases,
  onClear,
}: {
  selectedCases: string[];
  onClear: () => void;
}) {
  const { t } = useI18n();
  const [models, setModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [includeDiscussion, setIncludeDiscussion] = useState(false);
  const [compareWithLegacy, setCompareWithLegacy] = useState(false);
  const [running, setRunning] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    import('@/lib/api').then(({ chatApi }) =>
      chatApi.getModels().then((res) => {
        setModels(res.models);
      }).catch(() => {})
    );
  }, []);

  const toggleModel = (m: string) => {
    setSelectedModels((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleRun = async () => {
    if (!selectedCases.length || (!selectedModels.length && !compareWithLegacy)) return;
    setRunning(true);
    
    // Prepare model list, including legacy if requested
    const finalModels = [...selectedModels];
    if (compareWithLegacy) {
      finalModels.push('llmind-v1 (legacy)');
    }

    try {
      await benchmarkApi.run({
        case_ids: selectedCases,
        model_names: finalModels,
        include_discussion: includeDiscussion,
        prompt_language: 'en',
      });
      setSuccess(t('benchmark.run_success'));
      setTimeout(() => { setSuccess(''); onClear(); }, 3000);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-7 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-indigo-700 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
          <PlayIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-black text-white text-sm">{t('benchmark.run_benchmark')}</p>
          <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest">{selectedCases.length} cases selected</p>
        </div>
        <button onClick={onClear} className="ml-auto text-white/50 hover:text-white text-xs font-black uppercase tracking-widest transition-colors">
          Clear ×
        </button>
      </div>
      <div className="p-6 space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">{t('benchmark.select_models')}</p>
          <div className="flex flex-wrap gap-2">
            {models.map((m) => (
              <button
                key={m}
                onClick={() => toggleModel(m)}
                className={clsx(
                  'px-4 py-2 rounded-xl font-black text-sm border-2 transition-all',
                  selectedModels.includes(m)
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-700'
                )}
              >
                {m}
              </button>
            ))}
            {models.length === 0 && <p className="text-slate-400 text-sm italic">No models available</p>}
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-slate-100">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-2 border-slate-300 accent-indigo-600"
              checked={includeDiscussion}
              onChange={(e) => setIncludeDiscussion(e.target.checked)}
            />
            <span className="text-sm font-bold text-slate-700">{t('benchmark.include_discussion')}</span>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/50 hover:bg-amber-100/50 cursor-pointer transition-colors border border-amber-100">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-2 border-amber-300 accent-amber-600"
              checked={compareWithLegacy}
              onChange={(e) => setCompareWithLegacy(e.target.checked)}
            />
            <div className="flex flex-col">
              <span className="text-sm font-black text-amber-800 uppercase tracking-tight">Benchmark vs Legacy v1</span>
              <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest">Original RAG pipeline • gemma2:27b</span>
            </div>
          </label>
        </div>

        {success && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 font-black text-sm">
            <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
            {success}
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={running || !selectedModels.length}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {running ? (
            <><ArrowPathIcon className="w-5 h-5 animate-spin" /> Running...</>
          ) : (
            <><SparklesIcon className="w-5 h-5" /> {t('benchmark.run_button')}</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────
export default function CasesPage() {
  const { t } = useI18n();
  const [cases, setCases] = useState<DSM5CaseSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCases, setSelectedCases] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await casesApi.list({
        page,
        page_size: 20,
        search: debouncedSearch || undefined,
        reviewed_only: status === 'reviewed',
      });
      setCases(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, t]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const toggleCase = (id: string) => {
    setSelectedCases((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedCases.length === cases.length && cases.length > 0) {
      setSelectedCases([]);
    } else {
      setSelectedCases(cases.map(c => c.id));
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-slate-50 page-enter relative">
      <div className="absolute inset-0 bg-[radial-gradient(at_top_left,rgba(99,102,241,0.03),transparent_50%)] pointer-events-none" />
      
      {/* Dynamic Header - Pro Clinical Design */}
      <div className="bg-white border-b border-slate-200 relative z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-10 py-12">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 mb-12">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-2xl shadow-indigo-500/30 animate-float border border-white/20">
                <BeakerIcon className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-[-0.04em] leading-none mb-2 text-slate-800 uppercase">{t('nav.benchmark_cases')}</h1>
                <div className="flex items-center gap-3">
                  <span className="h-1 w-8 bg-indigo-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.4)]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 italic text-slate-500">Clinical Logic Validation Engine</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 rounded-3xl border border-slate-100 shadow-inner">
               {[
                  { key: '', label: 'All Protocols', color: 'bg-slate-400' },
                  { key: 'reviewed', label: 'Reviewed', color: 'bg-emerald-500' },
                  { key: 'pending', label: 'Pending', color: 'bg-amber-500' }
              ].map((s) => (
                  <button
                      key={s.label}
                      onClick={() => { setStatus(s.key); setPage(1); }}
                      className={clsx(
                          "btn btn-ghost h-12 px-6 rounded-2xl transition-all normal-case font-black text-[11px] uppercase tracking-widest",
                          status === s.key ? "bg-white shadow-md text-indigo-600 border-none scale-105" : "text-slate-400 hover:text-indigo-500"
                      )}
                  >
                      <span className={clsx("w-2 h-2 rounded-full mr-3", status === s.key ? s.color : "bg-slate-200")} />
                      {s.label}
                  </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-end">
            <div className="flex-1 space-y-4 w-full">
                <div className="flex items-center gap-3 opacity-30 pl-4">
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    <span className="text-[9px] font-black uppercase tracking-[0.4em]">Search Archive Matrix</span>
                </div>
                <div className="premium-card p-1 rounded-[2.5rem] feature-glow bg-slate-50/50 backdrop-blur-md">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search cases, symptoms, or identifiers..."
                        className="input input-ghost w-full h-14 pl-10 text-lg font-bold bg-transparent focus:bg-white transition-all border-none focus:outline-none rounded-[2rem]"
                    />
                </div>
            </div>

        {/* Sticky bottom bar when cases are selected */}
      {selectedCases.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-6 animate-slide-up">
          <RunBenchmarkPanel selectedCases={selectedCases} onClear={() => setSelectedCases([])} />
        </div>
      )}
          </div>
        </div>
      </div>

      {/* Main Content Area - Full Width Optimization */}
      <div className="flex-1 flex flex-col relative z-20 overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 lg:p-12">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-8 opacity-30">
                <span className="loading loading-spinner w-20 h-20 text-indigo-600"></span>
                <span className="text-[12px] font-black uppercase tracking-[0.4em] animate-pulse">Scanning Bio-Digital Archive...</span>
              </div>
            ) : error ? (
              <div className="alert alert-error max-w-lg mx-auto rounded-[2.5rem] p-10 shadow-2xl shadow-error/20 border-none text-white font-black uppercase tracking-widest text-center italic">
                {error}
              </div>
            ) : cases.length === 0 ? (
              <div className="text-center py-48 opacity-20 flex flex-col items-center gap-6">
                 <DocumentTextIcon className="w-24 h-24" />
                 <p className="text-xl font-black uppercase tracking-widest">Archive Empty or No Matches</p>
              </div>
            ) : (
              <div className="bg-white rounded-[3rem] shadow-[0_8px_40px_rgba(0,0,0,0.04)] border border-slate-200 overflow-hidden">
                <table className="table table-lg w-full">
                  <thead>
                    <tr className="text-[11px] uppercase font-black tracking-[0.3em] text-slate-400 bg-slate-50">
                      <th className="w-16 pl-8 py-5">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-2 border-slate-300 accent-indigo-600"
                          checked={selectedCases.length === cases.length && cases.length > 0}
                          onChange={toggleAll}
                        />
                      </th>
                      <th className="py-5">Ref</th>
                      <th className="py-5">Case Definition</th>
                      <th className="py-5">Synced</th>
                      <th className="py-5">Status</th>
                      <th className="py-5 text-center">Runs</th>
                      <th className="py-5 text-right pr-8">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cases.map((c) => (
                    <tr key={c.id} className="hover:bg-indigo-50/40 transition-colors group border-b border-slate-100">
                        <td className="pl-8 py-5">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-2 border-slate-300 accent-indigo-600"
                            checked={selectedCases.includes(c.id)}
                            onChange={() => toggleCase(c.id)}
                          />
                        </td>
                        <td>
                          <div className="flex flex-col gap-1.5">
                            <span className="badge badge-neutral font-mono font-bold text-[10px] h-7 px-4 shadow-sm border-none uppercase tracking-tighter bg-slate-800 text-white">{c.case_number || 'TRX-99'}</span>
                            <span className="text-[10px] opacity-30 font-black uppercase tracking-widest pl-1">#{c.id.slice(0, 5)}</span>
                          </div>
                        </td>
                        <td className="max-w-md">
                          <div className="flex flex-col gap-2 py-6">
                            <span className="font-black text-xl text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors tracking-tight">{c.title}</span>
                            <p className="text-sm opacity-50 leading-relaxed line-clamp-2 italic font-medium max-w-sm">
                              {c.anamnesis_preview || 'No clinical preview available...'}
                            </p>
                            {c.source_page && (
                              <div className="flex items-center gap-2 mt-4">
                                <DocumentTextIcon className="w-4 h-4 opacity-30 text-indigo-500" />
                                <span className="text-[10px] opacity-40 font-black uppercase tracking-[0.2em] text-slate-600">DSM-V Clinical Source • Page {c.source_page}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                           <div className="flex flex-col gap-1">
                             <span className="text-sm font-black text-slate-700">{new Date(c.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                             <span className="text-[10px] opacity-30 font-black uppercase tracking-widest leading-none">Sync: {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                           </div>
                        </td>
                        <td>
                          {c.is_reviewed ? (
                            <div className="badge badge-success gap-2 font-black text-[11px] h-9 px-5 border-none shadow-lg shadow-emerald-500/20 text-white uppercase tracking-wider bg-emerald-500">
                              <CheckCircleIcon className="w-4 h-4" />
                              {t('cases.badge_reviewed')}
                            </div>
                          ) : (
                            <div className="badge badge-warning gap-2 font-black text-[11px] h-9 px-5 border-none shadow-lg shadow-amber-500/20 text-white uppercase tracking-wider bg-amber-500">
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                              {t('cases.badge_pending')}
                            </div>
                          )}
                        </td>
                        <td className="text-center">
                          <div className="inline-flex items-center justify-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 shadow-inner group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                             <PlayIcon className="w-5 h-5 text-indigo-500 animate-pulse" />
                             <span className="text-sm font-black text-indigo-700">{c.run_count}</span>
                          </div>
                        </td>
                        <td className="text-right pr-10">
                          <div className="flex items-center justify-end gap-3">
                             <Link 
                                href={`/benchmark/cases/${c.id}`}
                                className="btn btn-indigo btn-md btn-square shadow-xl shadow-indigo-500/20 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 bg-indigo-600 text-white border-none"
                                title="Edit Clinical Module"
                             >
                                <PencilSquareIcon className="w-5 h-5" />
                             </Link>
                             <button className="btn btn-ghost btn-md btn-square opacity-0 group-hover:opacity-40 transition-opacity hover:bg-slate-100">
                                <CheckIcon className="w-5 h-5" />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination - Unified Design */}
          {/* Add bottom padding when the floating bar is shown */}
          {selectedCases.length > 0 && <div className="h-36" />}
          {totalPages > 1 && !loading && (
            <div className="flex justify-between items-center mt-12 p-8 bg-white rounded-[3rem] border border-slate-200 shadow-sm max-w-7xl mx-auto">
              <button 
                onClick={() => setPage((p) => Math.max(1, p - 1))} 
                disabled={page === 1}
                className="btn btn-ghost btn-md gap-3 px-8 normal-case font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-indigo-50 text-slate-600"
              >
                <ChevronLeftIcon className="w-5 h-5" /> Previous
              </button>
              <span className="text-sm font-black text-slate-500">{page} / {totalPages}</span>
              <button 
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages}
                className="btn btn-ghost btn-md gap-3 px-8 normal-case font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-indigo-50 text-slate-600"
              >
                Next <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
