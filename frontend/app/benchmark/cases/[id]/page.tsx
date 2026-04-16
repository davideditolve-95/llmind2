'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { casesApi, type DSM5Case } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeftIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  MapIcon,
  ShieldCheckIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export default function CaseDetailsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<DSM5Case | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (caseId) {
      casesApi.get(caseId).then(setCaseData).finally(() => setLoading(false));
    }
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
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-lg text-indigo-600" />
          <p className="text-slate-400 text-sm font-black uppercase tracking-widest">Loading case...</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-6">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
          <DocumentTextIcon className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Case Not Found</h2>
        <button onClick={() => router.back()} className="btn btn-ghost text-slate-500 border border-slate-200 rounded-xl">
          ← Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 page-enter">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 sticky top-0 z-20 flex items-center justify-between shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-600 hover:text-indigo-700 font-black text-sm uppercase tracking-widest transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Cases
        </button>

        {/* Case meta pills */}
        <div className="flex items-center gap-3">
          {caseData.case_number && (
            <div className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-mono font-black text-sm border border-slate-200">
              {caseData.case_number}
            </div>
          )}
          {caseData.source_page && (
            <div className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-black text-sm border border-indigo-200">
              Page {caseData.source_page}
            </div>
          )}
          <div
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm border',
              caseData.is_reviewed
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            )}
          >
            <span className={clsx('w-2 h-2 rounded-full', caseData.is_reviewed ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse')} />
            {caseData.is_reviewed ? 'Reviewed' : 'Pending Review'}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={clsx(
            'flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm border-none shadow-lg transition-all',
            saved
              ? 'bg-emerald-600 text-white shadow-emerald-200'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-200'
          )}
        >
          {saved ? (
            <><CheckCircleIcon className="w-5 h-5" /> Saved</>
          ) : saving ? (
            <><ArrowPathIcon className="w-5 h-5 animate-spin" /> Saving...</>
          ) : (
            <><PencilSquareIcon className="w-5 h-5" /> Save Changes</>
          )}
        </button>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: Main Editor ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Title */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <label className="block text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">
                Clinical Designation
              </label>
              <input
                value={caseData.title}
                onChange={(e) => setCaseData({ ...caseData, title: e.target.value })}
                className="w-full text-3xl font-black text-slate-900 bg-transparent border-none outline-none focus:outline-none placeholder:text-slate-200 leading-tight"
                placeholder="Case title..."
              />
              <div className="h-0.5 w-full bg-slate-100 mt-5 rounded-full">
                <div className="h-full w-24 bg-indigo-500 rounded-full" />
              </div>
            </div>

            {/* Anamnesis */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="w-2 h-6 rounded-full bg-indigo-500" />
                <span className="font-black text-sm text-slate-700 uppercase tracking-widest">{t('cases.section_anamnesis')}</span>
                <span className="ml-auto text-xs text-slate-400 font-medium">Clinical History</span>
              </div>
              <textarea
                value={caseData.anamnesis}
                onChange={(e) => setCaseData({ ...caseData, anamnesis: e.target.value })}
                rows={12}
                className="w-full p-8 font-mono text-base text-slate-700 bg-white border-none outline-none resize-none leading-relaxed focus:bg-indigo-50/30 transition-colors placeholder:text-slate-200"
                placeholder="Document clinical anamnesis..."
              />
            </div>

            {/* Discussion */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="w-2 h-6 rounded-full bg-emerald-500" />
                <span className="font-black text-sm text-slate-700 uppercase tracking-widest">{t('cases.section_discussion')}</span>
                <span className="ml-auto text-xs text-slate-400 font-medium">Clinical Discussion</span>
              </div>
              <textarea
                value={caseData.discussion}
                onChange={(e) => setCaseData({ ...caseData, discussion: e.target.value })}
                rows={7}
                className="w-full p-8 font-mono text-base text-slate-700 bg-white border-none outline-none resize-none leading-relaxed focus:bg-emerald-50/20 transition-colors"
              />
            </div>

            {/* Gold Standard Diagnosis */}
            <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-amber-100 bg-amber-50 flex items-center gap-3">
                <div className="w-2 h-6 rounded-full bg-amber-500" />
                <span className="font-black text-sm text-amber-800 uppercase tracking-widest">{t('cases.section_diagnosis')}</span>
                <span className="ml-auto text-xs text-amber-500 font-black uppercase tracking-widest">Gold Standard</span>
              </div>
              <textarea
                value={caseData.gold_standard_diagnosis}
                onChange={(e) => setCaseData({ ...caseData, gold_standard_diagnosis: e.target.value })}
                rows={5}
                className="w-full p-8 font-black text-base text-slate-800 bg-white border-none outline-none resize-none leading-relaxed focus:bg-amber-50/30 transition-colors"
              />
            </div>
          </div>

          {/* ── Right: Sidebar ── */}
          <div className="space-y-6">

            {/* Verification Status */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-5">Verification Status</h3>

              <label className={clsx(
                'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                caseData.is_reviewed
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              )}>
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-2 accent-emerald-600"
                  checked={caseData.is_reviewed}
                  onChange={(e) => setCaseData({ ...caseData, is_reviewed: e.target.checked })}
                />
                <div>
                  <p className={clsx('font-black text-sm', caseData.is_reviewed ? 'text-emerald-800' : 'text-slate-700')}>
                    {t('cases.mark_reviewed')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Mark this case as clinically validated</p>
                </div>
              </label>

              <div className="mt-5">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Review Observations
                </label>
                <textarea
                  value={caseData.review_notes || ''}
                  onChange={(e) => setCaseData({ ...caseData, review_notes: e.target.value })}
                  className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm focus:outline-none focus:border-indigo-300 focus:bg-white transition-all resize-none leading-relaxed"
                  rows={4}
                  placeholder="Internal review notes..."
                />
              </div>
            </div>

            {/* Metadata */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white">
              <h3 className="font-black text-xs uppercase tracking-widest text-white/40 mb-5">Metadata Context</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <MapIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white/40 text-[10px] font-black uppercase tracking-widest">Taxonomy</div>
                    <div className="text-white font-black text-sm">DSM-5-TR Linearized</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <ShieldCheckIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white/40 text-[10px] font-black uppercase tracking-widest">Consistency</div>
                    <div className="text-white font-black text-sm">Verified by IC-AI</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                    <BeakerIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white/40 text-[10px] font-black uppercase tracking-widest">Taxonomy</div>
                    <div className="text-white font-black text-sm">DSM-5-TR Clinical Cases</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
