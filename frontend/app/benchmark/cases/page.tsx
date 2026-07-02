'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { benchmarkApi, casesApi, chatApi, patientsApi, type DSM5CaseSummary, type Patient } from '@/lib/api';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  MagnifyingGlassIcon,
  CircleStackIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCases(cases.map((c) => c.id));
    } else {
      setSelectedCases([]);
    }
  };

  const isAllSelected = cases.length > 0 && selectedCases.length === cases.length;

  return (
    <div className="app-page space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-base-300 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CircleStackIcon className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-base-content sm:text-3xl">DSM-5 Clinical Cases</h1>
          </div>
          <p className="app-subtitle">
            Curate the reproducible DSM-5 Clinical Cases dataset, convert selected cases into patients, and launch benchmark batches.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:self-end">
          <Link href="/patients" className="btn btn-outline gap-1.5">
            <CircleStackIcon className="h-4 w-4" />
            Patients
          </Link>
          <Link href="/benchmark" className="btn btn-outline gap-1.5">
            <BeakerIcon className="h-4 w-4" />
            Benchmark Lab
          </Link>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-primary">Dataset role</div>
          <p className="mt-2 text-sm leading-6 text-base-content/70">These cases act as the stable benchmark corpus, separate from user-owned patient records.</p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-primary">Patient import</div>
          <p className="mt-2 text-sm leading-6 text-base-content/70">Use Convert to create a patient profile from a case when you need interactive clinical reasoning.</p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-primary">Benchmark input</div>
          <p className="mt-2 text-sm leading-6 text-base-content/70">Select reviewed cases and models to produce comparable model-evaluation runs.</p>
        </div>
      </section>

      {/* Main Two-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        
        {/* Cases List Section (Left Column) */}
        <section className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
          <div className="card-body p-6">
            
            {/* Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-base-200">
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <MagnifyingGlassIcon className="w-4 h-4 text-base-content/50" />
                </span>
                <input 
                  className="input input-bordered w-full pl-10 focus:input-primary focus:outline-none text-sm font-medium" 
                  value={search} 
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
                  placeholder="Search cases by title or content..." 
                />
              </div>
              
              <div className="flex items-center gap-2">
                <label className="label cursor-pointer justify-start gap-2 px-3 py-1.5 bg-base-200/50 rounded-lg border border-base-300 hover:bg-base-200 transition-colors">
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-primary checkbox-sm" 
                    checked={reviewedOnly} 
                    onChange={(e) => setReviewedOnly(e.target.checked)} 
                  />
                  <span className="label-text font-semibold text-xs text-base-content/85 select-none">Reviewed only</span>
                </label>
                
                <button className="btn btn-square btn-outline btn-sm border-base-300 text-base-content hover:bg-base-200" onClick={load} disabled={loading}>
                  <ArrowPathIcon className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                </button>
              </div>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="alert alert-error mb-4 flex items-center gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-error-content" />
                <span className="text-sm font-medium">{error}</span>
                <button className="btn btn-sm btn-ghost ml-auto text-xs" onClick={() => signIn('keycloak', { callbackUrl: '/benchmark/cases' })}>
                  Accedi
                </button>
              </div>
            )}

            {/* Table Area */}
            <div className="overflow-x-auto min-h-[350px]">
              <table className="table table-zebra table-md w-full">
                <thead>
                  <tr className="border-b border-base-300 text-base-content/70">
                    <th className="w-10 text-center">
                      <input 
                        type="checkbox" 
                        className="checkbox checkbox-primary checkbox-sm" 
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th className="font-bold text-xs uppercase tracking-wider pl-2">DSM-5 Case Details</th>
                    <th className="font-bold text-xs uppercase tracking-wider w-28 text-center">Status</th>
                    <th className="font-bold text-xs uppercase tracking-wider w-24 text-center">Runs</th>
                    <th className="font-bold text-xs uppercase tracking-wider w-48 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                        <span className="loading loading-spinner loading-lg text-primary" />
                        <div className="text-xs text-base-content/50 mt-2 font-medium">Loading clinical cases...</div>
                      </td>
                    </tr>
                  ) : cases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                  <div className="text-base-content/60 font-semibold text-lg">No DSM-5 Clinical Cases found</div>
                        <div className="text-xs text-base-content/40 mt-1">Try adjusting your search query or review filter.</div>
                      </td>
                    </tr>
                  ) : cases.map((item) => (
                    <tr key={item.id} className="hover:bg-base-200/40 transition-colors">
                      <td className="text-center align-middle">
                        <input 
                          type="checkbox" 
                          className="checkbox checkbox-primary checkbox-sm" 
                          checked={selectedCases.includes(item.id)} 
                          onChange={() => {
                            setSelectedCases((prev) => prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]);
                          }} 
                        />
                      </td>
                      <td className="max-w-[20rem] align-middle pl-2">
                        <Link 
                          href={`/benchmark/cases/${item.id}`} 
                          className="font-bold text-sm sm:text-base text-base-content hover:text-primary hover:underline transition-colors block truncate"
                          title={item.title}
                        >
                          {item.title}
                        </Link>
                        <span className="text-xs text-base-content/60 font-medium block truncate mt-0.5" title={item.anamnesis_preview}>
                          {item.anamnesis_preview || 'No clinical history preview.'}
                        </span>
                      </td>
                      <td className="align-middle text-center">
                        {item.is_reviewed ? (
                          <span className="badge badge-success text-success-content text-[11px] font-semibold py-1 px-2.5">Reviewed</span>
                        ) : (
                          <span className="badge badge-warning text-warning-content text-[11px] font-semibold py-1 px-2.5">Pending</span>
                        )}
                      </td>
                      <td className="align-middle text-center">
                        <span className="badge badge-ghost border-base-300 font-mono text-xs font-bold py-1 px-2">
                          {item.run_count}
                        </span>
                      </td>
                      <td className="align-middle text-right pr-4">
                        <div className="flex gap-2 justify-end">
                          <Link className="btn btn-xs btn-outline btn-neutral" href={`/benchmark/cases/${item.id}`}>
                            Open
                          </Link>
                          <button
                            className="btn btn-xs btn-primary text-primary-content font-semibold"
                            onClick={() => convertToPatient(item.id)}
                            disabled={convertingMap[item.id]}
                          >
                            {convertingMap[item.id] ? (
                              <span className="loading loading-spinner loading-[10px]" />
                            ) : (
                            'Import as patient'
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer / Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-base-200">
              <span className="text-xs text-base-content/60 font-semibold">
                {selectedCases.length > 0 ? (
                  <span className="text-primary font-bold">{selectedCases.length} case(s) selected</span>
                ) : (
                  `Showing ${cases.length} cases`
                )}
              </span>
              
              <div className="join border border-base-300 shadow-xs">
                <button 
                  className="btn btn-xs join-item bg-base-100 hover:bg-base-200 text-base-content" 
                  disabled={page <= 1} 
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </button>
                <button className="btn btn-xs join-item no-animation bg-base-50 text-base-content/80 font-semibold px-4">
                  Page {page} of {totalPages}
                </button>
                <button 
                  className="btn btn-xs join-item bg-base-100 hover:bg-base-200 text-base-content" 
                  disabled={page >= totalPages} 
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* Sidebar Controls (Right Column) */}
        <aside className="space-y-6 lg:sticky lg:top-6 h-fit">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-5">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-base-200">
                <PlayIcon className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-base-content/75">Run Batch Evaluation</h2>
              </div>
              
              <div className="text-xs font-semibold text-base-content/80 mb-3 bg-base-200/50 p-2.5 rounded border border-base-300/80">
                {selectedCases.length} case(s) selected for benchmark
              </div>
              
              <div className="form-control mb-4">
                <span className="label-text mb-2.5 font-semibold text-base-content/85">Select Models to Evaluate</span>
                <div className="space-y-2">
                  {models.map((model) => (
                    <label 
                      key={model} 
                      className="label cursor-pointer justify-start gap-3 rounded-lg bg-base-200/50 border border-base-300/80 px-3 py-2 hover:bg-base-200 transition-colors"
                    >
                      <input 
                        type="checkbox" 
                        className="checkbox checkbox-primary checkbox-xs" 
                        checked={selectedModels.includes(model)} 
                        onChange={() => {
                          setSelectedModels((prev) => prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]);
                        }} 
                      />
                      <span className="label-text text-base-content/90 font-medium text-xs truncate" title={model}>{model}</span>
                    </label>
                  ))}
                  {models.length === 0 && (
                    <div className="text-[11px] text-base-content/50 italic py-2">No LLM models online.</div>
                  )}
                </div>
              </div>

              <div className="form-control bg-base-200/50 p-3 rounded-lg border border-base-300/80 mb-4">
                <label className="label cursor-pointer justify-between p-0">
                  <span className="label-text font-semibold text-xs text-base-content/95 select-none">Include Discussion Context</span>
                  <input 
                    type="checkbox" 
                    className="toggle toggle-primary toggle-xs" 
                    checked={includeDiscussion} 
                    onChange={(e) => setIncludeDiscussion(e.target.checked)} 
                  />
                </label>
                <div className="text-[10px] text-base-content/60 mt-1.5 leading-normal">
                  Inject the clinical discussion text into the LLM context along with the patient history.
                </div>
              </div>

              <button 
                className="btn btn-primary w-full shadow-md text-primary-content font-bold mt-2" 
                disabled={running || !selectedCases.length || !selectedModels.length} 
                onClick={runBenchmark}
              >
                {running ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Start Evaluation Batch
                  </>
                )}
              </button>
            </div>
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
