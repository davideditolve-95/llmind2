'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { benchmarkApi, casesApi, chatApi, patientsApi, type DSM5CaseSummary, type Patient } from '@/lib/api';
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, PlayIcon } from '@heroicons/react/24/outline';

export default function CasesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [cases, setCases] = useState<DSM5CaseSummary[]>([]);
  const [convertingMap, setConvertingMap] = useState<Record<string, boolean>>({});
  const [successPatient, setSuccessPatient] = useState<Patient | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [includeDiscussion, setIncludeDiscussion] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      signIn('keycloak', { callbackUrl: '/benchmark/cases' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [caseRes, modelRes] = await Promise.all([
        casesApi.list({ page, page_size: 20, search: search || undefined, reviewed_only: reviewedOnly }),
        chatApi.getModels(),
      ]);
      setCases(caseRes.items);
      setTotalPages(caseRes.total_pages);
      setModels(modelRes.models);
    } catch (err: any) {
      const msg = err?.message || 'Errore sconosciuto';
      if (msg.includes('401') || msg.toLowerCase().includes('authenticated')) {
        setError('Sessione scaduta. Effettua di nuovo il login.');
      } else {
        setError(`Impossibile caricare i casi: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }, [page, reviewedOnly, search, status]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const convertToPatient = async (caseId: string) => {
    setConvertingMap((prev) => ({ ...prev, [caseId]: true }));
    try {
      const patient = await patientsApi.convertFromCase(caseId);
      setSuccessPatient(patient);
    } catch (err: any) {
      alert(`Conversion failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setConvertingMap((prev) => ({ ...prev, [caseId]: false }));
    }
  };

  const runBenchmark = async () => {
    if (!selectedCases.length || !selectedModels.length) return;
    setRunning(true);
    try {
      await benchmarkApi.run({
        case_ids: selectedCases,
        model_names: selectedModels,
        include_discussion: includeDiscussion,
        prompt_language: 'en',
      });
      setSelectedCases([]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="app-page space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="app-title">Clinical cases</h1>
          <p className="app-subtitle mt-2">Review extracted DSM-5-TR cases and launch controlled benchmark batches.</p>
        </div>
        <Link href="/benchmark" className="btn btn-outline">Benchmark history</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex flex-col gap-3 md:flex-row">
              <input className="input input-bordered flex-1" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search cases" />
              <label className="label cursor-pointer justify-start gap-3">
                <input type="checkbox" className="checkbox checkbox-primary" checked={reviewedOnly} onChange={(e) => setReviewedOnly(e.target.checked)} />
                <span className="label-text">Reviewed only</span>
              </label>
            </div>

            <div className="overflow-x-auto">
              {error && (
                <div className="alert alert-error mb-4 flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                  <span>{error}</span>
                  <button className="btn btn-sm btn-ghost ml-auto" onClick={() => signIn('keycloak', { callbackUrl: '/benchmark/cases' })}>
                    Accedi
                  </button>
                </div>
              )}
              <table className="table table-zebra">
                <thead><tr><th></th><th>Case</th><th>Status</th><th>Runs</th><th></th></tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="py-12 text-center"><span className="loading loading-spinner loading-lg" /></td></tr>
                  ) : cases.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-base-content/50">
                      {error ? 'Errore nel caricamento.' : 'Nessun caso clinico trovato nel database.'}
                    </td></tr>
                  ) : cases.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input type="checkbox" className="checkbox checkbox-primary" checked={selectedCases.includes(item.id)} onChange={() => {
                          setSelectedCases((prev) => prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]);
                        }} />
                      </td>
                      <td>
                        <div className="font-medium">{item.title}</div>
                        <div className="line-clamp-1 text-xs text-base-content/60">{item.anamnesis_preview}</div>
                      </td>
                      <td>{item.is_reviewed ? <span className="badge badge-success">Reviewed</span> : <span className="badge badge-warning">Pending</span>}</td>
                      <td>{item.run_count}</td>
                      <td>
                        <div className="flex gap-2">
                          <Link className="btn btn-sm" href={`/benchmark/cases/${item.id}`}>Open</Link>
                          <button
                            className="btn btn-sm btn-outline btn-accent"
                            onClick={() => convertToPatient(item.id)}
                            disabled={convertingMap[item.id]}
                          >
                            {convertingMap[item.id] ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              'Convert to Patient'
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="join self-end">
              <button className="btn join-item" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <button className="btn join-item no-animation">Page {page} / {totalPages}</button>
              <button className="btn join-item" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </section>

        <aside className="card h-fit bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title"><PlayIcon className="h-5 w-5" /> Run batch</h2>
            <div className="text-sm text-base-content/60">{selectedCases.length} cases selected</div>
            <div className="space-y-2">
              {models.map((model) => (
                <label key={model} className="label cursor-pointer justify-start gap-3 rounded-box bg-base-200 px-3">
                  <input type="checkbox" className="checkbox checkbox-primary" checked={selectedModels.includes(model)} onChange={() => {
                    setSelectedModels((prev) => prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]);
                  }} />
                  <span className="label-text">{model}</span>
                </label>
              ))}
            </div>
            <label className="label cursor-pointer justify-start gap-3">
              <input type="checkbox" className="toggle toggle-primary" checked={includeDiscussion} onChange={(e) => setIncludeDiscussion(e.target.checked)} />
              <span className="label-text">Include discussion</span>
            </label>
            <button className="btn btn-primary" disabled={running || !selectedCases.length || !selectedModels.length} onClick={runBenchmark}>
              {running ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
              Start benchmark
            </button>
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
              <Link href="/patients" className="btn btn-outline">Go to Patients</Link>
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
