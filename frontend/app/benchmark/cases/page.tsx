'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { casesApi, benchmarkApi, type DSM5Case, type DSM5CaseSummary } from '@/lib/api';
import Link from 'next/link';
import {
  Search, CheckCircle, Clock, BookOpen, Edit3, Play, X,
  ChevronLeft, ChevronRight, FileText, AlertCircle, RefreshCw,
  LayoutGrid
} from 'lucide-react';
import clsx from 'clsx';

// ─── Modal di editing del caso ────────────────────────────────────────────
function CaseEditModal({
  caseId,
  onClose,
  onSaved,
}: {
  caseId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [caseData, setCaseData] = useState<DSM5Case | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    casesApi.get(caseId).then(setCaseData).finally(() => setLoading(false));
  }, [caseId]);

  const handleSave = async () => {
    if (!caseData) return;
    setSaving(true);
    try {
      await casesApi.update(caseId, {
        title: caseData.title,
        anamnesis: caseData.anamnesis,
        discussion: caseData.discussion,
        gold_standard_diagnosis: caseData.gold_standard_diagnosis,
        is_reviewed: caseData.is_reviewed,
        review_notes: caseData.review_notes,
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); onSaved(); }, 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-all duration-500" onClick={onClose} />
      <div className="relative bg-white rounded-[2.5rem] shadow-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col animate-slide-up border border-white/40">

        {/* Header modal — Glassmorphism */}
        <div className="flex items-center justify-between px-10 py-7 bg-white/80 backdrop-blur-xl border-b border-warm-100 z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl bg-sage-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-sage-600" />
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">{t('cases.modal_title')}</h2>
            </div>
            {caseData && (
              <div className="flex items-center gap-3">
                {caseData.case_number && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Case ID: <span className="text-sage-600">{caseData.case_number}</span></span>}
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                {caseData.source_page && <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('cases.page_ref')} <span className="text-slate-800">{caseData.source_page}</span></span>}
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-40">
            <div className="w-12 h-12 rounded-full border-4 border-sage-100 border-t-sage-500 animate-spin" />
          </div>
        ) : caseData && (
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Sinistra — Metadati & Review Status */}
            <div className="w-80 bg-slate-50/50 border-r border-warm-100 p-8 flex flex-col gap-8 overflow-y-auto">
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 italic">Case Management</h3>
                <div className="space-y-4">
                  <div className={clsx(
                    "p-5 rounded-3xl border-2 transition-all",
                    caseData.is_reviewed ? "bg-sage-50 border-sage-200" : "bg-white border-warm-200"
                  )}>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={clsx(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                        caseData.is_reviewed ? "bg-sage-500 border-sage-500 text-white" : "bg-white border-warm-300 group-hover:border-sage-400"
                      )}>
                        {caseData.is_reviewed && <CheckCircle className="w-4 h-4" />}
                      </div>
                      <input
                        type="checkbox"
                        checked={caseData.is_reviewed}
                        onChange={(e) => setCaseData({ ...caseData, is_reviewed: e.target.checked })}
                        className="hidden"
                      />
                      <span className={clsx("text-sm font-bold", caseData.is_reviewed ? "text-sage-700" : "text-slate-500")}>
                        {t('cases.mark_reviewed')}
                      </span>
                    </label>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 italic">Review Notes</h3>
                <textarea
                  value={caseData.review_notes || ''}
                  onChange={(e) => setCaseData({ ...caseData, review_notes: e.target.value })}
                  placeholder="Insert internal review observations..."
                  rows={6}
                  className="textarea-field bg-white border-warm-200 rounded-2xl text-xs leading-relaxed focus:ring-sage-200"
                />
              </section>

              <div className="mt-auto pt-6 border-t border-warm-200 flex flex-col gap-3">
                <button onClick={handleSave} disabled={saving} className="btn-primary w-full h-14 rounded-2xl shadow-glow-sage">
                  {saved ? (
                    <span className="flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> {t('cases.saved')}</span>
                  ) : saving ? (
                    <span className="flex items-center justify-center gap-2 animate-pulse">{t('cases.saving')}...</span>
                  ) : t('cases.save')}
                </button>
                <button onClick={onClose} className="btn-ghost w-full h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400">
                  {t('common.cancel')}
                </button>
              </div>
            </div>

            {/* Main Content Destra — Narrazione Clinica */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10 bg-white">
              {/* Titolo */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 block">Clinical Title</label>
                <input
                  value={caseData.title}
                  onChange={(e) => setCaseData({ ...caseData, title: e.target.value })}
                  className="w-full text-2xl font-black text-slate-800 bg-transparent border-none focus:ring-0 p-0 placeholder:text-slate-200"
                  placeholder="Insert clinical case title..."
                />
                <div className="h-px w-20 bg-sage-500 mt-2" />
              </div>

              {/* Anamnesi */}
              <div className="group">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-sage-600 mb-3 block flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-sage-500" />
                  {t('cases.section_anamnesis')}
                </label>
                <div className="relative">
                  <textarea
                    value={caseData.anamnesis}
                    onChange={(e) => setCaseData({ ...caseData, anamnesis: e.target.value })}
                    rows={10}
                    className="textarea-field w-full min-h-[200px] border-warm-100 bg-slate-50/30 rounded-[2rem] p-8 font-mono text-sm leading-relaxed text-slate-700 focus:bg-white focus:border-sage-200 focus:shadow-xl transition-all"
                  />
                  <div className="absolute top-4 right-6 pointer-events-none">
                    <Edit3 className="w-4 h-4 text-slate-200 group-hover:text-sage-300 transition-colors" />
                  </div>
                </div>
              </div>

              {/* Discussione */}
              <div className="group">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-powder-600 mb-3 block flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-powder-500" />
                  {t('cases.section_discussion')}
                </label>
                <textarea
                  value={caseData.discussion}
                  onChange={(e) => setCaseData({ ...caseData, discussion: e.target.value })}
                  rows={6}
                  className="textarea-field w-full border-warm-100 bg-slate-50/30 rounded-[2rem] p-8 font-mono text-sm leading-relaxed text-slate-700 focus:bg-white focus:border-powder-200 focus:shadow-xl transition-all"
                />
              </div>

              {/* Gold Standard Diagnosis */}
              <div className="group">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-lavender-600 mb-3 block flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-lavender-500" />
                  {t('cases.section_diagnosis')}
                </label>
                <textarea
                  value={caseData.gold_standard_diagnosis}
                  onChange={(e) => setCaseData({ ...caseData, gold_standard_diagnosis: e.target.value })}
                  rows={5}
                  className="textarea-field w-full border-warm-100 bg-slate-50/30 rounded-[2rem] p-8 font-mono text-sm leading-bold text-slate-800 focus:bg-white focus:border-lavender-200 focus:shadow-xl transition-all"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [running, setRunning] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    import('@/lib/api').then(({ chatApi }) =>
      chatApi.getModels().then((res) => {
        setModels(res.models);
        // Rimosso auto-selection del modello di default su richiesta utente
      }).catch(() => {})
    );
  }, []);

  const toggleModel = (m: string) => {
    setSelectedModels((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleRun = async () => {
    if (!selectedCases.length || !selectedModels.length) return;
    setRunning(true);
    try {
      const res = await benchmarkApi.run({
        case_ids: selectedCases,
        model_names: selectedModels,
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
    <div className="bg-white/80 backdrop-blur-xl border border-sage-200 rounded-[2rem] p-8 shadow-glow-sage space-y-6 animate-slide-up sticky top-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-sage-500 flex items-center justify-center shadow-lg shadow-sage-200">
          <Play className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-black text-slate-800 text-sm tracking-tight">{t('benchmark.run_benchmark')}</h3>
          <p className="text-[10px] font-black tracking-widest text-sage-600 uppercase">{selectedCases.length} Selected Cases</p>
        </div>
      </div>

      {/* Selettore modelli */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 italic mb-2">{t('benchmark.select_models')}</p>
        <div className="flex flex-wrap gap-2">
          {models.map((m) => (
            <button
              key={m}
              onClick={() => toggleModel(m)}
              className={clsx(
                'px-4 py-2 rounded-xl text-xs font-bold transition-all border-2',
                selectedModels.includes(m)
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                  : 'bg-white text-slate-500 border-warm-100 hover:border-sage-400'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 bg-slate-50 rounded-2xl border border-warm-100">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className={clsx(
            "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
            includeDiscussion ? "bg-sage-500 border-sage-500 text-white" : "bg-white border-warm-300 group-hover:border-sage-400"
          )}>
            {includeDiscussion && <CheckCircle className="w-3 h-3" />}
          </div>
          <input
            type="checkbox"
            checked={includeDiscussion}
            onChange={(e) => setIncludeDiscussion(e.target.checked)}
            className="hidden"
          />
          <span className="text-[11px] font-bold text-slate-600">{t('benchmark.include_discussion')}</span>
        </label>
      </div>

      {success && (
        <div className="bg-sage-500 text-white rounded-2xl px-4 py-3 text-xs font-bold flex items-center gap-3 shadow-lg animate-fade-in">
          <CheckCircle className="w-4 h-4" />{success}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={handleRun}
          disabled={running || !selectedModels.length}
          className="btn-primary w-full h-14 rounded-2xl shadow-glow-sage text-base"
        >
          {running ? (
            <span className="flex items-center justify-center gap-2"><RefreshCw className="w-5 h-5 animate-spin" /> {t('benchmark.running')}</span>
          ) : `${t('benchmark.run_button')} (${selectedCases.length} × ${selectedModels.length})`}
        </button>
        <button onClick={onClear} className="w-full h-10 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
          Clear Selection
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
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingCase, setEditingCase] = useState<string | null>(null);
  const [selectedCases, setSelectedCases] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await casesApi.list({
        page, page_size: 20,
        search: debouncedSearch || undefined,
        reviewed_only: reviewedOnly,
      });
      setCases(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, reviewedOnly]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const toggleCase = (id: string) => {
    setSelectedCases((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-warm-50 page-enter">
      {/* ─── Sidebar filtri + run panel ─── */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-warm-200 flex flex-col p-8 gap-10 overflow-y-auto">
        <div>
          <Link 
            href="/benchmark"
            className="px-6 py-2.5 rounded-2xl bg-white border border-warm-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-warm-50 transition-all flex items-center gap-2 shadow-sm mb-8"
          >
            <LayoutGrid className="w-4 h-4 text-sage-500" />
            Dashboard
          </Link>
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center mb-4 shadow-xl">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">{t('cases.title')}</h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('cases.subtitle')}</p>
        </div>

        <div className="space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 group-focus-within:text-sage-500 transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('cases.search_placeholder')}
              className="w-full h-12 bg-slate-50 border-warm-100 border-2 rounded-2xl pl-12 pr-4 text-sm font-bold focus:bg-white focus:border-sage-500 transition-all outline-none placeholder:text-warm-300"
            />
          </div>

          <div className="p-6 bg-slate-50/50 rounded-3xl border border-warm-100">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 italic">Quick Filters</h4>
            <label className="flex items-center gap-3 cursor-pointer group mb-3">
              <div className={clsx(
                "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                reviewedOnly ? "bg-sage-500 border-sage-500 text-white" : "bg-white border-warm-300 group-hover:border-sage-400"
              )}>
                {reviewedOnly && <CheckCircle className="w-3 h-3" />}
              </div>
              <input type="checkbox" checked={reviewedOnly} onChange={(e) => setReviewedOnly(e.target.checked)} className="hidden" />
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{t('cases.filter_reviewed')}</span>
            </label>
            <div className="pt-3 border-t border-warm-100 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Database Size</span>
              <span className="text-[10px] font-black text-slate-800">{total.toLocaleString()} Cases</span>
            </div>
          </div>
        </div>

        {selectedCases.length > 0 && (
          <RunBenchmarkPanel selectedCases={selectedCases} onClear={() => setSelectedCases([])} />
        )}
      </div>

      {/* ─── Grid casi clinici ─── */}
      <div className="flex-1 overflow-y-auto p-12 bg-warm-50/30">
        {loading ? (
          <div className="flex items-center justify-center py-40">
            <div className="w-12 h-12 rounded-full border-4 border-sage-100 border-t-sage-500 animate-spin" />
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-40 bg-white rounded-[3rem] border border-warm-100 shadow-soft max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-warm-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-warm-200" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">No Cases Found</h3>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t('cases.no_cases')}</p>
          </div>
        ) : (
          <div className="max-w-[1600px] mx-auto">
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-8 mb-12">
              {cases.map((c) => (
                <div
                  key={c.id}
                  className={clsx(
                    'group relative p-8 bg-white rounded-[2.5rem] border transition-all duration-500 ease-out cursor-pointer hover:shadow-3xl hover:-translate-y-2',
                    selectedCases.includes(c.id) 
                      ? 'border-sage-500 ring-4 ring-sage-50 shadow-2xl z-10' 
                      : 'border-warm-100 shadow-soft hover:border-sage-200'
                  )}
                  onClick={() => toggleCase(c.id)}
                >
                  <div className="flex items-start justify-between gap-6 mb-6">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={clsx(
                        "mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0",
                        selectedCases.includes(c.id) ? "bg-sage-500 border-sage-500 text-white" : "bg-slate-50 border-warm-200 group-hover:border-sage-400"
                      )}>
                        {selectedCases.includes(c.id) && <CheckCircle className="w-4 h-4" />}
                      </div>
                      
                      <div className="min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 mb-2">
                          {c.case_number && (
                            <span className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-sm">
                              {c.case_number}
                            </span>
                          )}
                          <div className="h-4 w-px bg-slate-200 mx-1" />
                          <span className={clsx(
                            "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
                            c.is_reviewed ? "bg-sage-50 border-sage-100 text-sage-600" : "bg-amber-50 border-amber-100 text-amber-600"
                          )}>
                             {c.is_reviewed ? t('cases.badge_reviewed') : t('cases.badge_pending')}
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight line-clamp-1 group-hover:text-sage-700 transition-colors">
                          {c.title}
                        </h3>
                      </div>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-500">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingCase(c.id); }}
                        className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl hover:bg-sage-600 hover:scale-110 transition-all"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 rounded-3xl p-6 mb-6 border border-warm-50 group-hover:bg-white group-hover:shadow-inner transition-all duration-500">
                    <p className="text-sm font-medium text-slate-500 leading-relaxed line-clamp-3 italic">
                      {c.anamnesis_preview || <span className="italic text-slate-300">Detailed clinical anamnesis not available for this record.</span>}
                    </p>
                  </div>

                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-6">
                      {c.source_page && (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-warm-100 flex items-center justify-center">
                            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Page <span className="text-slate-800">{c.source_page}</span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-powder-100 flex items-center justify-center">
                          <Play className="w-3.5 h-3.5 text-powder-600" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Runs <span className="text-slate-800">{c.run_count}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-sage-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginazione */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm rounded-[2rem] px-8 py-4 border border-warm-100 shadow-soft">
                <button 
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                  disabled={page === 1} 
                  className="btn-secondary h-12 px-6 rounded-2xl flex items-center gap-3 group"
                >
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[11px] font-black uppercase tracking-widest">{t('common.previous')}</span>
                </button>
                
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">{t('tabular.page')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-sage-600">{page}</span>
                    <span className="text-xs font-bold text-slate-300">/</span>
                    <span className="text-base font-black text-slate-800">{totalPages}</span>
                  </div>
                </div>

                <button 
                  onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                  disabled={page === totalPages} 
                  className="btn-secondary h-12 px-6 rounded-2xl flex items-center gap-3 group"
                >
                  <span className="text-[11px] font-black uppercase tracking-widest">{t('common.next')}</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal editing */}
      {editingCase && (
        <CaseEditModal
          caseId={editingCase}
          onClose={() => setEditingCase(null)}
          onSaved={() => { setEditingCase(null); loadCases(); }}
        />
      )}
    </div>
  );
}
