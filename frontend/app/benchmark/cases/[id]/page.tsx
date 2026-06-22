'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { casesApi, patientsApi, type DSM5Case, type Patient } from '@/lib/api';
import { ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

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
    try {
      const patient = await patientsApi.convertFromCase(caseId);
      setSuccessPatient(patient);
    } catch (err: any) {
      alert(`Conversion failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <div className="app-page"><span className="loading loading-spinner loading-lg" /></div>;
  if (!caseData) return <div className="app-page"><div className="alert alert-error">Case not found.</div></div>;

  return (
    <div className="app-page space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button className="btn btn-ghost btn-sm mb-3" onClick={() => router.back()}>
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
          <h1 className="app-title">{caseData.title}</h1>
          <p className="app-subtitle mt-2">{caseData.case_number || 'Unnumbered case'} · source page {caseData.source_page || 'unknown'}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-accent" onClick={convertToPatient} disabled={converting}>
            {converting ? <span className="loading loading-spinner loading-xs" /> : 'Convert to Patient'}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <CheckCircleIcon className="h-4 w-4" />
            {saved ? 'Saved' : saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-4">
          <Field label="Title">
            <input className="input input-bordered w-full" value={caseData.title} onChange={(e) => setCaseData({ ...caseData, title: e.target.value })} />
          </Field>
          <Field label="Anamnesis">
            <textarea className="textarea textarea-bordered min-h-64 w-full" value={caseData.anamnesis} onChange={(e) => setCaseData({ ...caseData, anamnesis: e.target.value })} />
          </Field>
          <Field label="Clinical discussion">
            <textarea className="textarea textarea-bordered min-h-48 w-full" value={caseData.discussion} onChange={(e) => setCaseData({ ...caseData, discussion: e.target.value })} />
          </Field>
          <Field label="Gold standard diagnosis">
            <textarea className="textarea textarea-bordered min-h-36 w-full" value={caseData.gold_standard_diagnosis} onChange={(e) => setCaseData({ ...caseData, gold_standard_diagnosis: e.target.value })} />
          </Field>
        </section>

        <aside className="card h-fit bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Review status</h2>
            <label className="label cursor-pointer justify-start gap-3">
              <input type="checkbox" className="checkbox checkbox-primary" checked={caseData.is_reviewed} onChange={(e) => setCaseData({ ...caseData, is_reviewed: e.target.checked })} />
              <span className="label-text">Reviewed</span>
            </label>
            <label className="form-control">
              <span className="label-text mb-2">Review notes</span>
              <textarea className="textarea textarea-bordered min-h-32" value={caseData.review_notes || ''} onChange={(e) => setCaseData({ ...caseData, review_notes: e.target.value })} />
            </label>
          </div>
        </aside>
      </div>

      {/* Success Modal */}
      {successPatient && (
        <div className="modal modal-open">
          <div className="modal-box bg-base-100 border border-base-300">
            <h3 className="font-bold text-lg text-success">Conversion Successful!</h3>
            <p className="py-4 text-base-content/80">
              Clinical case successfully parsed! Patient profile created for <strong>{successPatient.name}</strong> (Age: {successPatient.age || 'N/A'}, Gender: {successPatient.gender || 'N/A'}).
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setSuccessPatient(null)}>Close</button>
              <button className="btn btn-outline" onClick={() => router.push('/patients')}>Go to Patients</button>
              <button className="btn btn-primary" onClick={() => {
                const pid = successPatient.id;
                setSuccessPatient(null);
                router.push(`/chat?patientId=${pid}`);
              }}>
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-control">
      <span className="label-text mb-2 font-medium">{label}</span>
      {children}
    </label>
  );
}
