'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { icd11Api, type IcdTableRow, type PaginatedResponse } from '@/lib/api';
import {
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XMarkIcon,
  InformationCircleIcon,
  BookOpenIcon,
  ExclamationCircleIcon,
  ArrowsPointingInIcon,
  DocumentTextIcon,
  TagIcon,
  ChatBubbleLeftRightIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';

// ─── Modal Dettagli Clinici ──────────────────────────────────────────────
 function CodeDetailModal({
  row,
  onClose,
}: {
  row: IcdTableRow;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" />
      <div className="w-full max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col shadow-2xl bg-white border border-slate-200 animate-slide-up origin-bottom rounded-[2.5rem] relative z-10" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-10 py-8 border-b border-base-200 bg-gradient-to-r from-primary to-secondary text-primary-content relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="flex items-center gap-6 relative z-10">
            <div className={`w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-lg flex items-center justify-center text-white font-black text-xl shadow-xl border border-white/30 animate-float`}>
              {row.code || row.level}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter leading-none mb-1 shadow-sm uppercase">{row.title_en}</h2>
              <div className="flex items-center gap-2 opacity-70">
                <span className="h-0.5 w-4 bg-white rounded-full" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                  ICD-11 Entity • Level {row.level}
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-md btn-circle bg-white/10 hover:bg-white/20 border-none transition-all relative z-10">
            <XMarkIcon className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar bg-base-50/50">
          
          {/* Descrizione */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <BookOpenIcon className="w-5 h-5 opacity-40" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 italic">{t('tabular.section_description')}</span>
            </div>
            <div className="premium-card p-10 rounded-[2rem] text-lg leading-relaxed font-medium bg-white border-base-200">
              {row.description || <span className="opacity-30 italic">No definition available</span>}
            </div>
          </section>

          {/* Criteri Diagnostici */}
          {row.diagnostic_criteria && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary italic">Diagnostic Criteria</span>
              </div>
              <div className="prose prose-sm max-w-none bg-white p-10 rounded-[2rem] border border-base-200 shadow-inner overflow-y-auto max-h-[400px] custom-scrollbar">
                <ReactMarkdown>
                  {row.diagnostic_criteria.replace(/^!markdown\s*/m, '').trim()}
                </ReactMarkdown>
              </div>
            </section>
          )}

          {/* Metadata Badges (Inclusions, Exclusions, Terms) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
             {/* Inclusions */}
             {row.inclusions && row.inclusions.length > 0 && (
               <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-success" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-success italic">{t('tabular.section_inclusions')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.inclusions.map((inc, i) => (
                      <div key={i} className="badge badge-lg bg-success/10 text-success border-success/20 font-black text-[10px] h-9 px-4 rounded-xl">{inc}</div>
                    ))}
                  </div>
               </section>
             )}

             {/* Exclusions */}
             {row.exclusions && row.exclusions.length > 0 && (
               <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <ExclamationCircleIcon className="w-5 h-5 text-error" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-error italic">{t('tabular.section_exclusions')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.exclusions.map((exc, i) => (
                      <div key={i} className="badge badge-lg bg-error/10 text-error border-error/20 font-black text-[10px] h-9 px-4 rounded-xl">{exc}</div>
                    ))}
                  </div>
               </section>
             )}
          </div>

          {/* Terms */}
          {row.index_terms && row.index_terms.length > 0 && (
             <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <TagIcon className="w-5 h-5 opacity-40" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 italic">Index Terms</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.index_terms.map((term, i) => (
                    <div key={i} className="badge badge-neutral badge-md font-bold opacity-60 rounded-lg">{term}</div>
                  ))}
                </div>
             </section>
          )}

          {/* Differential Diagnosis */}
          {row.differential_diagnoses && row.differential_diagnoses.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <ArrowsPointingInIcon className="w-5 h-5 opacity-40" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 italic">{t('tabular.section_differential')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {row.differential_diagnoses.map((diff, i) => (
                  <div key={i} className="alert alert-sm bg-base-100 border border-base-200 font-bold text-xs py-4 px-6 rounded-2xl shadow-sm text-base-content/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 mr-2" />
                    {diff}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-10 py-8 border-t border-base-200 bg-white flex justify-end">
          <button onClick={onClose} className="btn btn-primary btn-lg px-12 rounded-2xl shadow-xl shadow-primary/20">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TabularPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    }>
      <TabularContent />
    </Suspense>
  );
}

function TabularContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaginatedResponse<IcdTableRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState<number | undefined>(0); 
  const [parentId, setParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; title: string }[]>([]);
  const [selectedRow, setSelectedRow] = useState<IcdTableRow | null>(null);
  const PAGE_SIZE = 50;

  useEffect(() => {
    const initialId = searchParams.get('id');
    const initialSearch = searchParams.get('search');
    
    if (initialSearch) {
      setSearch(initialSearch);
      setDebouncedSearch(initialSearch);
    }
    
    if (initialId) {
      icd11Api.getCode(initialId)
        .then(setSelectedRow)
        .catch(err => console.error("Deep-linking error:", err));
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await icd11Api.getCodes({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        level: (debouncedSearch || parentId) ? undefined : level,
        parent_id: parentId || undefined,
      });
      setData(result);
    } catch (err) {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, level, parentId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const levelOptions = [
    { value: undefined, label: t('tabular.all_levels') },
    { value: 0, label: t('tabular.level_0') },
    { value: 1, label: t('tabular.level_1') },
    { value: 2, label: t('tabular.level_2') },
    { value: 3, label: "Level 3" },
    { value: 4, label: "Level 4" },
    { value: 5, label: "Level 5" },
  ];

  const handleNavigateDown = (id: string, title: string) => {
    setParentId(id);
    setBreadcrumbs((prev) => [...prev, { id, title }]);
  };

  const handleBreadcrumbClick = (idx: number) => {
    if (idx < 0) {
      setParentId(null);
      setBreadcrumbs([]);
    } else {
      const crumb = breadcrumbs[idx];
      setParentId(crumb.id);
      setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-base-200 page-enter overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      
      {/* Header - Pro Clinical Design */}
      <div className="bg-white border-b border-base-200 px-10 py-10 relative z-20 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-content flex items-center justify-center shadow-2xl shadow-primary/30 animate-float border border-white/20">
              <Square3Stack3DIcon className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-[-0.04em] leading-none mb-2 text-base-content uppercase">{t('nav.tabular')}</h1>
              <div className="flex items-center gap-3">
                <span className="h-1 w-8 bg-primary rounded-full shadow-[0_0_12px_rgba(14,165,233,0.4)]" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 italic text-base-content">ICD-11 Master Archive Explorer</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="px-5 py-2 rounded-xl bg-primary/5 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em]">
                 Data Pool: Global
             </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 w-full">
          {/* Highlight Feature: Search & Filter */}
          <div className="premium-card p-2 rounded-[2.5rem] feature-glow bg-base-50/50 backdrop-blur-md">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1 group">
                <MagnifyingGlassIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 opacity-20 group-focus-within:opacity-100 group-focus-within:text-primary transition-all" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('tabular.search_placeholder')}
                  className="input input-ghost w-full h-16 pl-16 text-lg font-bold bg-transparent focus:bg-white transition-all border-none focus:outline-none placeholder:opacity-30 rounded-[2rem]"
                />
              </div>

              {!parentId && (
                <div className="flex items-center gap-2 p-1">
                    <div className="h-10 w-[1px] bg-base-200 hidden md:block mx-4" />
                    <select
                      value={level ?? ''}
                      onChange={(e) => {
                        setLevel(e.target.value === '' ? undefined : Number(e.target.value));
                        setPage(1);
                      }}
                      className="select select-ghost h-14 min-w-[200px] font-black uppercase text-[11px] tracking-widest bg-transparent hover:bg-white rounded-[1.5rem] focus:bg-white border-none"
                    >
                      {levelOptions.map((opt) => (
                        <option key={opt.label} value={opt.value ?? ''}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                </div>
              )}
            </div>
          </div>

          {/* Breadcrumbs - Improved spacing */}
          {(breadcrumbs.length > 0 || parentId) && (
            <div className="text-[10px] breadcrumbs mt-8 font-black uppercase tracking-[0.3em] opacity-50 pl-4">
              <ul>
                <li>
                  <button 
                    onClick={() => { setBreadcrumbs([]); setParentId(null); setPage(1); }}
                    className="hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <TagIcon className="w-3.5 h-3.5" />
                    Archive Root
                  </button>
                </li>
                {breadcrumbs.map((crumb, idx) => (
                  <li key={crumb.id || idx}>
                    <button onClick={() => handleBreadcrumbClick(idx)} className="truncate max-w-[240px] hover:text-primary transition-colors">
                      {crumb.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Main Table Area - Improved Spacing & UX */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-white/50">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-48 gap-8 opacity-40">
            <span className="loading loading-spinner w-20 h-20 text-primary"></span>
            <span className="text-[12px] font-black uppercase tracking-[0.5em] animate-pulse">Synchronizing Data...</span>
          </div>
        ) : error ? (
          <div className="text-center py-32 p-10 max-w-xl mx-auto">
            <div className="w-24 h-24 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-8 border border-error/20 shadow-2xl">
                <ExclamationCircleIcon className="w-12 h-12 text-error" />
            </div>
            <p className="text-error text-xl font-black uppercase tracking-widest mb-8">{error}</p>
            <button onClick={loadData} className="btn btn-error btn-outline h-14 px-12 rounded-[1.5rem] font-black uppercase tracking-widest border-2">
              {t('common.retry')}
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="text-center py-48 opacity-20">
            <InformationCircleIcon className="w-24 h-24 mx-auto mb-8" />
            <p className="text-lg font-black uppercase tracking-[0.4em]">{t('tabular.no_results')}</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-10 pb-40">
            {/* Metadata Legend */}
            <div className="flex items-center gap-6 py-4 mb-2 border-b border-slate-100">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Column guide:</span>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-black border border-indigo-200">Dx</span>
                <span className="text-xs text-slate-500 font-medium">Diagnostic Criteria</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-[9px] font-black border border-emerald-200">IN</span>
                <span className="text-xs text-slate-500 font-medium">Inclusion Terms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-[9px] font-black border border-red-200">EX</span>
                <span className="text-xs text-slate-500 font-medium">Exclusion Terms</span>
              </div>
              <span className="ml-auto text-[10px] text-slate-300 font-medium">Click any row to explore full clinical detail</span>
            </div>
            <table className="table table-lg w-full border-separate border-spacing-y-4">
              <thead>
                <tr className="text-[11px] uppercase font-black tracking-[0.3em] text-slate-400">
                  <th className="w-36 pl-8">{t('tabular.column_code')}</th>
                  <th>{t('tabular.column_title')}</th>
                  <th className="text-center w-64">
                    <div className="flex items-center justify-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-black border border-indigo-200">Dx</span>
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-[9px] font-black border border-emerald-200">IN</span>
                      <span className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-[9px] font-black border border-red-200">EX</span>
                    </div>
                  </th>
                  <th className="text-center w-20">Lv</th>
                  <th className="text-center w-32 pr-8">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="group border-b border-slate-100 hover:bg-indigo-50/40 transition-colors">
                    <td className="align-middle pl-10 py-6">
                      {row.code ? (
                        <div className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-800 text-white font-mono font-black text-[11px] shadow-sm">
                            {row.code}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-black italic tracking-widest">N/A</span>
                      )}
                    </td>
                    <td className="align-middle py-6">
                      <div className="flex flex-col gap-2">
                        <span className="font-black text-base text-slate-800 group-hover:text-indigo-700 transition-colors leading-none">{row.title_en}</span>
                        {row.description && (
                          <p className="text-sm text-slate-400 line-clamp-2 font-medium leading-relaxed max-w-2xl">
                            {row.description.slice(0, 120)}{row.description.length > 120 ? '…' : ''}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="align-middle">
                       <div className="flex items-center justify-center gap-3">
                          <div 
                            title="Diagnostic Criteria available"
                            className={clsx("w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-black border",
                              row.diagnostic_criteria
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-slate-50 text-slate-200 border-slate-100"
                            )}
                          >Dx</div>
                          <div 
                            title="Inclusions available"
                            className={clsx("w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-black border",
                              row.inclusions?.length
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                : "bg-slate-50 text-slate-200 border-slate-100"
                            )}
                          >IN</div>
                          <div 
                            title="Exclusions available"
                            className={clsx("w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-black border",
                              row.exclusions?.length
                                ? "bg-red-50 text-red-600 border-red-200"
                                : "bg-slate-50 text-slate-200 border-slate-100"
                            )}
                          >EX</div>
                       </div>
                    </td>
                    <td className="align-middle text-center">
                       <span className={clsx(
                         "inline-flex items-center justify-center w-9 h-9 rounded-xl font-black text-sm text-white shadow",
                         row.level === 0 ? "bg-blue-600" :
                         row.level === 1 ? "bg-emerald-600" :
                         row.level === 2 ? "bg-cyan-600" :
                         row.level === 3 ? "bg-indigo-600" :
                         row.level === 4 ? "bg-rose-600" :
                         "bg-slate-400"
                       )}>
                        {row.level}
                       </span>
                    </td>
                    <td className="align-middle text-center pr-8">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setSelectedRow(row)} 
                          className="btn btn-sm btn-ghost rounded-xl hover:bg-indigo-100 hover:text-indigo-700 text-slate-500 border border-slate-200 hover:border-indigo-200"
                          title="View Details"
                        >
                          <InformationCircleIcon className="w-5 h-5" />
                        </button>
                        {row.has_children && (
                          <button 
                            onClick={() => handleNavigateDown(row.id, row.title_en)} 
                            className="btn btn-sm btn-primary rounded-xl border-none shadow-md shadow-primary/20"
                            title="Explore children"
                          >
                            <ChevronRightIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination - Premium Sticky Footer */}
      {data && data.total_pages > 1 && !loading && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 glass border border-base-200 p-2 rounded-[2.5rem] flex items-center gap-8 shadow-2xl z-20 px-8 animate-slide-up">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-ghost btn-circle btn-md hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-10"
          >
            <ChevronLeftIcon className="h-6 w-6" />
          </button>

          <div className="text-[11px] font-black uppercase tracking-[0.4em] opacity-60">
            {t('tabular.page')} <span className="text-primary font-black px-2 text-base">{page}</span> / <span className="opacity-40">{data.total_pages}</span>
          </div>

          <button
            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
            disabled={page === data.total_pages}
            className="btn btn-ghost btn-circle btn-md hover:bg-primary/10 hover:text-primary transition-all disabled:opacity-10"
          >
            <ChevronRightIcon className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRow && (
        <CodeDetailModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  );
}
