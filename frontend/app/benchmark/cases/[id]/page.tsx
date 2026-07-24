'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { casesApi, patientsApi, type DSM5Case, type Patient } from '@/lib/api';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ShieldCheckIcon,
  PencilIcon,
  BookmarkIcon,
  CalendarIcon,
  UserIcon,
  ClockIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export default function CaseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;
  const [caseData, setCaseData] = useState<DSM5Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [converting, setConverting] = useState(false);
  const [successPatient, setSuccessPatient] = useState<Patient | null>(null);

  // Conversion progress modal state
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [conversionStage, setConversionStage] = useState('Extracting clinical presentation...');
  const [convertedPatient, setConvertedPatient] = useState<Patient | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [estimatedRemainingSeconds, setEstimatedRemainingSeconds] = useState(8);

  useEffect(() => {
    casesApi.get(caseId).then(setCaseData).finally(() => setLoading(false));
  }, [caseId]);

  const save = async () => {
    if (!caseData) return;
    setSaving(true);
    try {
      setCaseData(await casesApi.update(caseId, caseData));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  };

  const convertToPatient = async () => {
    setConverting(true);
    setConvertedPatient(null);
    setConversionProgress(10);
    setConversionStage('Parsing clinical presentation & extracting demographics with Ollama...');
    setElapsedSeconds(0);
    setEstimatedRemainingSeconds(8);
    setConversionModalOpen(true);

    const progressTimer = setInterval(() => {
      setElapsedSeconds((e) => {
        const nextElapsed = e + 1;
        if (nextElapsed <= 3) {
          setConversionStage('Parsing clinical presentation & extracting demographics with Ollama...');
        } else if (nextElapsed <= 6) {
          setConversionStage('Structuring patient traits & historical symptoms via Ollama LLM...');
        } else {
          setConversionStage('Registering patient profile & grounding ICD-11 context...');
        }
        return nextElapsed;
      });

      setEstimatedRemainingSeconds((r) => (r > 1 ? r - 1 : 1));
      setConversionProgress((p) => (p < 90 ? p + 12 : p));
    }, 1000);

    try {
      const patient = await patientsApi.convertFromCase(caseId);
      clearInterval(progressTimer);
      setConversionProgress(100);
      setEstimatedRemainingSeconds(0);
      setConversionStage('Patient profile created successfully!');
      setConvertedPatient(patient);
      setSuccessPatient(patient);
    } catch (err: any) {
      clearInterval(progressTimer);
      setConversionModalOpen(false);
      alert(`Conversion failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <div className="app-page flex justify-center py-20"><span className="loading loading-spinner loading-lg text-primary" /></div>;
  if (!caseData) return <div className="app-page"><div className="alert alert-error shadow-sm">Case not found.</div></div>;

  return (
    <div className="app-page space-y-6">
      {successPatient && (
        <div className="alert alert-success shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-6 w-6 text-success-content shrink-0" />
            <div>
              <div className="font-bold text-sm">🎉 DSM-5 Case converted to Patient successfully!</div>
              <div className="text-xs opacity-90">
                Patient profile created for <strong>{successPatient.name}</strong> (Age: {successPatient.age || 'N/A'}, Gender: {successPatient.gender || 'N/A'}).
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button className="btn btn-xs btn-neutral font-bold" onClick={() => router.push(`/chat?patientId=${successPatient.id}`)}>
              💬 Start Chat
            </button>
            <button className="btn btn-xs btn-outline font-bold" onClick={() => router.push('/patients')}>
              👤 View Patients
            </button>
            <button className="btn btn-xs btn-ghost" onClick={() => setSuccessPatient(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-base-300 pb-5">
        <div className="space-y-2">
          <button className="btn btn-ghost btn-xs -ml-2 mb-1 gap-1 text-base-content/70 hover:text-base-content" onClick={() => router.back()}>
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to DSM-5 Clinical Cases
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-neutral text-xs font-semibold px-2.5 py-1">CASE #{caseData.case_number || 'N/A'}</span>
            {caseData.is_reviewed ? (
              <span className="badge badge-success gap-1 text-xs font-medium px-2.5 py-1 text-success-content">
                <CheckCircleIcon className="h-3.5 w-3.5" /> Reviewed
              </span>
            ) : (
              <span className="badge badge-warning gap-1 text-xs font-medium px-2.5 py-1 text-warning-content">Pending Review</span>
            )}
            {caseData.source_page && (
              <span className="badge badge-ghost text-xs font-medium px-2.5 py-1 border-base-300">Source Page: {caseData.source_page}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-base-content sm:text-3xl mt-1">{caseData.title}</h1>
        </div>
        
        <div className="flex flex-wrap gap-2 lg:self-end">
          <button className="btn btn-outline btn-primary" onClick={convertToPatient} disabled={converting}>
            {converting ? <span className="loading loading-spinner loading-xs" /> : 'Import as Patient'}
          </button>
          <button className="btn btn-primary px-6" onClick={save} disabled={saving}>
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            {saved ? 'Saved' : saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Case Data (Left Column - 2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card: Title */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-5">
              <div className="flex items-center gap-2 mb-3">
                <PencilIcon className="h-5 w-5 text-primary/80" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-base-content/75">Case Title</h2>
              </div>
              <input 
                className="input input-bordered w-full text-base font-semibold focus:input-primary focus:outline-none" 
                value={caseData.title} 
                onChange={(e) => setCaseData({ ...caseData, title: e.target.value })} 
                placeholder="Enter case title..."
              />
            </div>
          </div>

          {/* Card: Anamnesis */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-5">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardDocumentListIcon className="h-5 w-5 text-primary/80" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-base-content/75">Anamnesis & Clinical History</h2>
              </div>
              <textarea 
                className="textarea textarea-bordered min-h-72 w-full leading-relaxed font-sans text-base focus:textarea-primary focus:outline-none" 
                value={caseData.anamnesis} 
                onChange={(e) => setCaseData({ ...caseData, anamnesis: e.target.value })} 
                placeholder="Provide the patient's anamnesis and clinical presentation..."
              />
            </div>
          </div>

          {/* Card: Clinical Discussion */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-5">
              <div className="flex items-center gap-2 mb-3">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary/80" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-base-content/75">Clinical Discussion</h2>
              </div>
              <textarea 
                className="textarea textarea-bordered min-h-56 w-full leading-relaxed font-sans text-base focus:textarea-primary focus:outline-none" 
                value={caseData.discussion} 
                onChange={(e) => setCaseData({ ...caseData, discussion: e.target.value })} 
                placeholder="Provide the clinical analysis or diagnostic differential discussions..."
              />
            </div>
          </div>

          {/* Card: Gold Standard Diagnosis */}
          <div className="card bg-base-100 border border-success/30 border-l-4 border-l-success shadow-sm overflow-hidden">
            <div className="card-body p-5 bg-success/5">
              <div className="flex items-center gap-2 mb-3">
                <CheckBadgeIcon className="h-5 w-5 text-success" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-success">Gold Standard Diagnosis</h2>
              </div>
              <textarea 
                className="textarea textarea-bordered min-h-36 w-full leading-relaxed font-sans text-base border-success/30 focus:border-success focus:outline-none bg-base-100" 
                value={caseData.gold_standard_diagnosis} 
                onChange={(e) => setCaseData({ ...caseData, gold_standard_diagnosis: e.target.value })} 
                placeholder="Enter the official gold standard diagnosis..."
              />
            </div>
          </div>

        </div>

        {/* Sidebar Controls & Metadata (Right Column - 1/3 width) */}
        <div className="space-y-6 lg:sticky lg:top-6 h-fit">
          
          {/* Card: Review Validation */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-5">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-base-200">
                <ShieldCheckIcon className="h-5 w-5 text-primary/80" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-base-content/75">Quality Control</h2>
              </div>
              
              <div className="form-control bg-base-200/50 p-3 rounded-lg border border-base-300/80 mb-4">
                <label className="label cursor-pointer justify-between p-0">
                  <span className="label-text font-semibold text-base-content/90">Clinical Validation Status</span>
                  <input 
                    type="checkbox" 
                    className="toggle toggle-success toggle-sm" 
                    checked={caseData.is_reviewed} 
                    onChange={(e) => setCaseData({ ...caseData, is_reviewed: e.target.checked })} 
                  />
                </label>
                <div className="text-[11px] text-base-content/60 mt-1.5 leading-normal">
                  Mark as reviewed when clinical facts and ICD-11 alignments are verified.
                </div>
              </div>

              <div className="form-control">
                <span className="label-text mb-2 font-semibold text-base-content/85">Review Notes</span>
                <textarea 
                  className="textarea textarea-bordered min-h-32 text-sm leading-relaxed focus:textarea-primary focus:outline-none" 
                  value={caseData.review_notes || ''} 
                  onChange={(e) => setCaseData({ ...caseData, review_notes: e.target.value })} 
                  placeholder="Add notes about your review (e.g. source discrepancies, interesting features)..."
                />
              </div>
            </div>
          </div>

          {/* Card: Case Metadata */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-5">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-base-200">
                <BookmarkIcon className="h-5 w-5 text-primary/80" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-base-content/75">System Information</h2>
              </div>
              
              <div className="space-y-3.5 text-xs">
                <div className="flex flex-col gap-1 pb-2 border-b border-base-200">
                  <span className="text-base-content/65 font-medium">Case UUID</span>
                  <span className="font-mono text-base-content/95 bg-base-200 px-2 py-1 rounded text-[10px] break-all select-all">{caseData.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-base-200">
                  <span className="text-base-content/65 font-medium">Case Number</span>
                  <span className="text-base-content/95 font-semibold">{caseData.case_number || 'Unnumbered'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-base-200">
                  <span className="text-base-content/65 font-medium">Source Page</span>
                  <span className="text-base-content/95 font-semibold">{caseData.source_page || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-base-200">
                  <span className="text-base-content/65 font-medium">Created At</span>
                  <span className="text-base-content/95 flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5 text-base-content/50" />
                    {caseData.created_at ? new Date(caseData.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-base-content/65 font-medium">Last Updated</span>
                  <span className="text-base-content/95 flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5 text-base-content/50" />
                    {caseData.updated_at ? new Date(caseData.updated_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Patient Conversion Progress & Estimation Modal */}
      {conversionModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg bg-base-100 border border-base-300 shadow-2xl p-6">
            <div className="flex items-start justify-between border-b border-base-200 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-primary" />
                  Patient Conversion Progress
                </h3>
                <p className="text-xs text-base-content/60 mt-0.5">{caseData.title}</p>
              </div>
              <button
                className="btn btn-xs btn-ghost btn-circle"
                onClick={() => {
                  setConversionModalOpen(false);
                  setConvertedPatient(null);
                }}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Progress Bar & Stage */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="uppercase tracking-wider text-primary">{conversionStage}</span>
                  <span className="text-base-content">{conversionProgress}%</span>
                </div>

                <progress
                  className={`progress ${convertedPatient ? 'progress-success' : 'progress-primary'} h-3 w-full`}
                  value={conversionProgress}
                  max={100}
                />

                {!convertedPatient && (
                  <div className="flex items-center justify-between pt-2 border-t border-primary/10 text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1.5">
                      <ClockIcon className="h-4 w-4 animate-spin" />
                      Ollama LLM Processing ({elapsedSeconds}s elapsed)
                    </span>
                    <span className="font-mono text-sm">~{estimatedRemainingSeconds}s remaining</span>
                  </div>
                )}
              </div>

              {/* Final State Details */}
              {convertedPatient && (
                <div className="space-y-3">
                  <div className="alert alert-success shadow-xs flex items-center gap-3 text-xs font-bold">
                    <CheckCircleIcon className="h-5 w-5 text-success-content shrink-0" />
                    <span>🎉 Patient profile generated from DSM-5 clinical case!</span>
                  </div>

                  <div className="text-xs space-y-1.5 bg-base-200/60 p-3 rounded-lg border border-base-300">
                    <div className="flex justify-between">
                      <span className="text-base-content/60">Patient Name:</span>
                      <span className="font-bold text-base-content">{convertedPatient.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-base-content/60">Age:</span>
                      <span className="font-bold text-base-content">{convertedPatient.age ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-base-content/60">Gender:</span>
                      <span className="font-bold text-base-content">{convertedPatient.gender || 'N/A'}</span>
                    </div>
                    {convertedPatient.behaviors && (
                      <div className="mt-1 pt-1 border-t border-base-300">
                        <span className="text-base-content/60 block">Clinical Presentation / Behaviors:</span>
                        <p className="font-medium text-base-content/90 mt-0.5 line-clamp-2">{convertedPatient.behaviors}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-action mt-6 border-t border-base-200 pt-3">
              {convertedPatient ? (
                <div className="flex gap-2 w-full justify-end">
                  <button
                    className="btn btn-ghost btn-sm font-bold"
                    onClick={() => {
                      setConversionModalOpen(false);
                      setConvertedPatient(null);
                    }}
                  >
                    Close
                  </button>
                  <button
                    className="btn btn-outline btn-sm font-bold"
                    onClick={() => {
                      setConversionModalOpen(false);
                      router.push('/patients');
                    }}
                  >
                    👤 View Patients
                  </button>
                  <button
                    className="btn btn-primary btn-sm font-bold gap-1.5"
                    onClick={() => {
                      setConversionModalOpen(false);
                      router.push(`/chat?patientId=${convertedPatient.id}`);
                    }}
                  >
                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                    Start Chat
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-outline btn-sm w-full font-bold"
                  onClick={() => setConversionModalOpen(false)}
                >
                  Run in background
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
