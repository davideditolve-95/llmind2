'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { icd11Api, type IcdTableRow, type PaginatedResponse } from '@/lib/api';
import { Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, Info, X, BookOpen, AlertCircle, GitMerge, ScrollText, Tags, MessageSquare, Layers, FileText, CheckCircle2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up border border-white/40">
        
        {/* Header Glassy */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-warm-100 bg-warm-50/50">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm text-white font-bold
              ${['bg-sage-500', 'bg-powder-500', 'bg-lavender-500', 'bg-warm-500'][row.level] || 'bg-slate-500'}`}>
              {row.code || row.level}
            </div>
            <div>
              <h2 className="font-black text-slate-800 tracking-tight leading-tight">{row.title_en}</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                ICD-11 Entity • Level {row.level}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-2xl transition-all shadow-sm group">
            <X className="w-5 h-5 text-slate-400 group-hover:text-slate-800" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          
          {/* Descrizione & Criteri Diagnostici Layout Integrato */}
          <div className="flex flex-col gap-8">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-sage-600">
                <BookOpen className="w-3.5 h-3.5" />
                {t('tabular.section_description')}
              </label>
              <p className="text-sm text-slate-600 leading-relaxed font-semibold bg-sage-50/50 p-6 rounded-[2rem] border border-sage-100/50">
                {row.description || <span className="text-warm-300 italic">No definition available</span>}
              </p>
            </div>

            {row.diagnostic_criteria && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-powder-600">
                  <ScrollText className="w-3.5 h-3.5" />
                  Diagnostic Criteria
                </label>
                <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200/60 shadow-inner max-h-[500px] overflow-y-auto no-scrollbar relative">
                  <div className="prose prose-sm prose-slate max-w-none prose-headings:font-black prose-headings:tracking-tight prose-p:font-medium prose-p:leading-relaxed prose-li:font-medium prose-strong:text-slate-900">
                    <ReactMarkdown>
                      {row.diagnostic_criteria.replace(/^!markdown\s*/m, '').trim()}
                    </ReactMarkdown>
                  </div>
                  {/* Subtle fade indicating more content */}
                  <div className="sticky bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Index Terms (Synonyms) */}
          {row.index_terms && row.index_terms.length > 0 && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-lavender-600">
                <Tags className="w-3.5 h-3.5" />
                Clinical Synonyms & Index Terms
              </label>
              <div className="flex flex-wrap gap-2">
                {row.index_terms.map((term, i) => (
                  <span key={i} className="px-3 py-1.5 bg-lavender-50 text-lavender-700 text-[10px] font-bold rounded-xl border border-lavender-100 uppercase tracking-tight">
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Inclusioni & Esclusioni */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {row.inclusions && row.inclusions.length > 0 && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-sage-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {t('tabular.section_inclusions')}
                </label>
                <div className="flex flex-col gap-2">
                  {row.inclusions.map((inc, i) => (
                    <div key={i} className="px-4 py-2 bg-sage-50/50 text-sage-700 text-xs font-semibold rounded-2xl border border-sage-100/50">
                      {inc}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {row.exclusions && row.exclusions.length > 0 && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-600">
                  <XCircle className="w-3.5 h-3.5" />
                  {t('tabular.section_exclusions')}
                </label>
                <div className="flex flex-col gap-2">
                  {row.exclusions.map((exc, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-red-50/30 rounded-2xl border border-red-100/50">
                      <AlertCircle className="w-3.5 h-3.5 text-red-300 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-red-800 font-semibold">{exc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Post-coordination & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {row.postcoordination_axes && row.postcoordination_axes.length > 0 && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-warm-600">
                  <Layers className="w-3.5 h-3.5" />
                  Post-coordination Availability
                </label>
                <div className="flex flex-wrap gap-1.5 p-4 bg-warm-100/30 rounded-3xl border border-warm-200/50">
                  {row.postcoordination_axes.map((axis, i) => (
                    <span key={i} className="px-2.5 py-1 bg-white shadow-sm text-slate-500 text-[9px] font-black rounded-lg border border-warm-100 uppercase">
                      {axis}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {row.coding_notes && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Clinical & Coding Notes
                </label>
                <div className="p-4 bg-slate-50 rounded-3xl border border-slate-200/50 text-xs text-slate-500 font-medium leading-relaxed italic">
                  {row.coding_notes}
                </div>
              </div>
            )}
          </div>

          {/* Diagnosi Differenziale */}
          {row.differential_diagnoses && row.differential_diagnoses.length > 0 && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-warm-600">
                <GitMerge className="w-3.5 h-3.5" />
                {t('tabular.section_differential')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {row.differential_diagnoses.map((diff, i) => (
                  <div key={i} className="p-4 bg-white rounded-2xl border border-warm-200/50 flex items-center justify-between shadow-sm group hover:border-warm-400 transition-all">
                    <span className="text-xs text-slate-700 font-bold">{diff}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!row.description && !row.inclusions && !row.exclusions && !row.diagnostic_criteria && !row.index_terms && (
            <div className="text-center py-12">
              <Info className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">No detailed metadata available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-warm-100 bg-warm-50/30 flex justify-end">
          <button onClick={onClose} className="btn-primary rounded-2xl px-8 shadow-glow-sage">
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
      <div className="flex items-center justify-center h-full bg-warm-50">
        <div className="w-10 h-10 rounded-full border-4 border-sage-200 border-t-sage-500 animate-spin" />
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
  const [level, setLevel] = useState<number | undefined>(0); // Default a Livello 0 (Capitoli)
  const [parentId, setParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; title: string }[]>([]);
  const [selectedRow, setSelectedRow] = useState<IcdTableRow | null>(null);
  const PAGE_SIZE = 50;

  // Gestione caricamento iniziale da parametri URL (Deep-Linking)
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
        // Decouple search from level filter: if searching, show all levels matching the query
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
    { value: 3, label: "Level 3 - Specifics" },
    { value: 4, label: "Level 4 - Sub-types" },
    { value: 5, label: "Level 5 - Clinical Detail" },
  ];

  const handleNavigateDown = (id: string, title: string) => {
    setParentId(id);
    setBreadcrumbs((prev) => [...prev, { id, title }]);
    setPage(1);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index));
    setParentId(target ? target.id : null);
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full bg-warm-50 page-enter overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-warm-200 px-6 py-6">
        <h1 className="section-title text-2xl font-black">{t('tabular.title')}</h1>
        <p className="section-subtitle text-slate-400 font-medium">{t('tabular.subtitle')}</p>

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('tabular.search_placeholder')}
              className="input-field pl-11 py-3 text-sm font-semibold rounded-2xl bg-warm-50/50 border-warm-100 hover:border-sage-300 focus:ring-sage-400 transition-all"
            />
          </div>

          {!parentId && (
            <select
              value={level ?? ''}
              onChange={(e) => {
                setLevel(e.target.value === '' ? undefined : Number(e.target.value));
                setPage(1);
              }}
              className="input-field w-auto min-w-[200px] font-bold text-slate-700 rounded-2xl bg-warm-50/50 border-warm-100 focus:ring-sage-400"
            >
              {levelOptions.map((opt) => (
                <option key={opt.label} value={opt.value ?? ''}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Breadcrumbs refined */}
        {(breadcrumbs.length > 0 || parentId) && (
          <div className="flex items-center gap-2 mt-4 text-xs font-bold uppercase tracking-widest no-scrollbar pb-1">
            <button
              onClick={() => handleBreadcrumbClick(-1)}
              className="text-sage-500 hover:text-sage-700 underline underline-offset-4"
            >
              Root
            </button>
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.id || idx} className="flex items-center gap-2">
                <ChevronRight className="w-3 h-3 text-warm-300" />
                <button
                  onClick={() => handleBreadcrumbClick(idx)}
                  className={clsx(
                    "max-w-[200px] truncate transition-colors",
                    idx === breadcrumbs.length - 1 ? 'text-warm-400 cursor-default' : 'text-sage-500 hover:text-sage-700'
                  )}
                >
                  {crumb.title}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results Count Bar */}
      {data && (
        <div className="px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 bg-white border-b border-warm-100">
          <span className="text-sage-600">{data.total.toLocaleString()}</span> {t('tabular.total_results')}
        </div>
      )}

      {/* Tabella con scrolling indipendente - Espansa a larghezza intera */}
      <div className="flex-1 overflow-auto bg-warm-50/10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-4 border-sage-200 border-t-sage-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-20 card max-w-sm mx-auto">
            <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-3" />
            <p className="text-red-500 font-bold mb-4">{error}</p>
            <button onClick={loadData} className="btn-primary !bg-red-500 !shadow-none">
              {t('common.retry')}
            </button>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="text-center py-20 opacity-50">
            <Info className="w-12 h-12 mx-auto mb-3 text-warm-300" />
            <p className="font-bold uppercase tracking-widest text-warm-400">{t('tabular.no_results')}</p>
          </div>
        ) : (
          <div className="flex flex-col min-w-full">
            {/* Clinical Richness Legend */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-6 py-4 bg-white/80 border-b border-warm-100 backdrop-blur-sm sticky top-0 z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-r border-warm-200 pr-8 mr-2 italic">
                Clinical Indicators
              </span>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 group">
                <div className="w-6 h-6 rounded-lg bg-powder-50 border border-powder-200 flex items-center justify-center text-powder-500 shadow-sm">
                  <ScrollText className="w-3.5 h-3.5" />
                </div>
                Diagnostic Criteria
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <div className="w-6 h-6 rounded-lg bg-sage-50 border border-sage-200 flex items-center justify-center text-sage-500 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                Inclusions
              </div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <div className="w-6 h-6 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-500 shadow-sm">
                  <XCircle className="w-3.5 h-3.5" />
                </div>
                Exclusions
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/40 border-b border-warm-100">
                  <th className="px-6 py-5 text-left text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 w-40">{t('tabular.column_code')}</th>
                  <th className="px-6 py-5 text-left text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">{t('tabular.column_title')} & Description</th>
                  <th className="px-6 py-5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 w-48">Availability</th>
                  <th className="px-6 py-5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 w-40">Taxonomy</th>
                  <th className="px-6 py-5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 w-24">LV</th>
                  <th className="px-6 py-5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 w-40">{t('tabular.column_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr 
                    key={row.id} 
                    className="group border-b border-warm-50 hover:bg-white transition-all duration-300 ease-out hover:shadow-2xl hover:z-20 relative hover:-translate-y-0.5 border-l-4 border-l-transparent hover:border-l-sage-500"
                  >
                    <td className="px-6 py-7 align-top">
                      {row.code ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-4 py-1.5 rounded-xl bg-slate-900 text-white font-mono text-[11px] font-black tracking-tight shadow-md group-hover:bg-sage-600 transition-colors">
                            {row.code}
                          </span>
                        </div>
                      ) : (
                        <span className="text-warm-300 font-mono text-[10px] uppercase font-bold tracking-widest">No Code</span>
                      )}
                    </td>
                    <td className="px-6 py-7 align-top">
                      <h3 className="font-black text-slate-900 text-base tracking-tight mb-2 group-hover:text-sage-700 transition-colors">
                        {row.title_en}
                      </h3>
                      {row.description ? (
                        <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-2 italic">
                          {row.description}
                        </p>
                      ) : (
                        <p className="text-xs text-warm-300 font-bold uppercase tracking-widest">No definition provided</p>
                      )}
                    </td>
                    
                    {/* Availability Indicators */}
                    <td className="px-6 py-7 align-top">
                      <div className="flex items-center justify-center gap-3">
                        <div title="Diagnostic Criteria" className={clsx("w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm border", 
                          row.diagnostic_criteria ? "bg-powder-50 border-powder-200 text-powder-600 scale-110 shadow-lg shadow-powder-100" : "bg-slate-50 border-slate-100 text-slate-200")}>
                          <ScrollText className="w-4 h-4" />
                        </div>
                        <div title="Inclusions" className={clsx("w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm border", 
                          row.inclusions?.length ? "bg-sage-50 border-sage-200 text-sage-600 scale-110 shadow-lg shadow-sage-100" : "bg-slate-50 border-slate-100 text-slate-200")}>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div title="Exclusions" className={clsx("w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm border", 
                          row.exclusions?.length ? "bg-red-50 border-red-200 text-red-600 scale-110 shadow-lg shadow-red-100" : "bg-slate-50 border-slate-100 text-slate-200")}>
                          <XCircle className="w-4 h-4" />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-7 align-top text-center">
                      <div className="flex flex-col items-center gap-1.5 translate-y-1">
                        <div className={clsx(
                          "px-3 py-1 rounded-full text-[10px] font-black border transition-all",
                          row.has_children ? "bg-white border-warm-200 text-slate-700 shadow-sm" : "bg-warm-50 border-transparent text-warm-300"
                        )}>
                          {row.has_children ? `${row.children_count} CHILDREN` : "LEAF NODE"}
                        </div>
                        {row.has_children && (
                          <div className="flex gap-0.5">
                            {[...Array(Math.min(3, row.children_count))].map((_, i) => (
                              <div key={i} className="w-1 h-1 rounded-full bg-sage-400" />
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-7 align-top text-center">
                      <span
                        className="inline-flex items-center justify-center w-10 h-10 rounded-2xl text-[11px] font-black shadow-inner border border-white translate-y-0.5"
                        style={{
                          background: ['#f4f7f2', '#f0f7fc', '#f7f4fb', '#faf9f7', '#fdfcfc', '#fcfdfd'][row.level] || '#faf9f7',
                          color: ['#6a8f5c', '#3d88b5', '#9882ac', '#a69782', '#b38b8b', '#8bb3b3'][row.level] || '#a69782',
                        }}
                      >
                        {row.level}
                      </span>
                    </td>
                    <td className="px-6 py-7 align-top text-center">
                      <div className="flex items-center justify-center gap-2 translate-y-0.5">
                        <button
                          onClick={() => setSelectedRow(row)}
                          className="w-10 h-10 flex items-center justify-center hover:bg-powder-500 hover:text-white rounded-2xl transition-all border border-warm-200 text-slate-400 shadow-sm bg-white"
                          title={t('tabular.view_details')}
                        >
                          <Info className="w-4.5 h-4.5" />
                        </button>
                        {row.has_children && (
                          <button
                            onClick={() => handleNavigateDown(row.id, row.title_en)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-sage-600 hover:text-white rounded-2xl transition-all border border-warm-200 text-slate-400 shadow-sm bg-white"
                            title={t('tabular.view_children')}
                          >
                            <ChevronRight className="w-4.5 h-4.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* Paginazione Refined */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between px-6 py-5 bg-white border-t border-warm-100">
          <button
            onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={page === 1}
            className="btn-secondary rounded-2xl px-6 min-w-[140px] font-black uppercase tracking-widest text-[10px]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            {t('common.previous')}
          </button>

          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {t('tabular.page')} <span className="text-sage-600">{page}</span> / <span className="text-slate-800">{data.total_pages}</span>
          </span>

          <button
            onClick={() => { setPage((p) => Math.min(data.total_pages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            disabled={page === data.total_pages}
            className="btn-secondary rounded-2xl px-6 min-w-[140px] font-black uppercase tracking-widest text-[10px]"
          >
            {t('common.next')}
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      )}

      {/* Modal Details */}
      {selectedRow && (
        <CodeDetailModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  );
}
