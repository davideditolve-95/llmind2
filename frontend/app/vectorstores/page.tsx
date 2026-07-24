'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { chatApi, vectorstoreApi, type Datastore, type IcdScopeOption } from '@/lib/api';
import { ArrowPathIcon, CircleStackIcon, PlusIcon, TrashIcon, ClockIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function VectorStoresPage() {
  const router = useRouter();
  const [datastores, setDatastores] = useState<Datastore[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [icdSections, setIcdSections] = useState<IcdScopeOption[]>([]);
  const [icdChapter, setIcdChapter] = useState<IcdScopeOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  
  // Progress modal state
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [embeddingModelOverride, setEmbeddingModelOverride] = useState('');
  const [icdScope, setIcdScope] = useState<'chapter_6' | 'sections'>('chapter_6');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsTicker, setSecondsTicker] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ds, modelRes, scopeRes] = await Promise.all([
        vectorstoreApi.list(),
        chatApi.getModels(),
        vectorstoreApi.getIcdScopeOptions(),
      ]);
      const fallbackModels = ['gemma3:270m', 'gemma2:27b', 'gemma4', 'llama3.2:3b', 'qwen2.5:7b', 'all-MiniLM-L6-v2'];
      const fetchedModels = modelRes?.models && modelRes.models.length > 0 ? modelRes.models : fallbackModels;
      setDatastores(ds);
      setModels(fetchedModels);
      setIcdChapter(scopeRes?.chapter || null);
      setIcdSections(scopeRes?.sections || []);
      setModel((current) => current || modelRes?.default_model || fetchedModels[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load vector store configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Ticker for countdown re-renders
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll server status while any vector store is processing
  useEffect(() => {
    const hasProcessing = datastores.some((ds) => ds.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      vectorstoreApi.list()
        .then((ds) => setDatastores(ds))
        .catch(() => {});
    }, 2000);

    return () => clearInterval(interval);
  }, [datastores]);

  const getRemainingTime = (ds: Datastore) => {
    if (ds.status !== 'processing') return null;
    const createdTime = new Date(ds.created_at).getTime();
    const now = new Date().getTime();
    const elapsed = Math.floor((now - createdTime) / 1000);
    
    const presetId = ds.metadata_info?.preset_id || 'clinical_full';
    let totalEstimate = 30;
    if (presetId === 'clinical_full') totalEstimate = 45;
    else if (presetId === 'icd11_standard') totalEstimate = 30;
    else if (presetId === 'dsm5_cases') totalEstimate = 20;

    const remaining = totalEstimate - elapsed;
    return remaining > 0 ? remaining : 5;
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!model) {
      setError('Select the model to use for this local vector store.');
      return;
    }
    if (icdScope === 'sections' && selectedSections.length === 0) {
      setError('Select at least one ICD-11 Chapter 6 section, or use the full chapter.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const embeddingModel = embeddingModelOverride.trim() || model;
      const duplicate = findMatchingVectorStore(datastores, model, embeddingModel, icdScope, selectedSections);
      if (duplicate) {
        const shouldOverwrite = confirm(
          `Esiste già un local vector store con la stessa configurazione modello/embedding e lo stesso ambito ICD-11:\n\n"${duplicate.name}"\n\nVuoi sovrascriverlo?`
        );
        if (!shouldOverwrite) {
          setCreating(false);
          return;
        }
        await vectorstoreApi.delete(duplicate.id);
      }

      const form = new FormData();
      const dsName = name || `ICD-11 Vector Store (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      form.append('name', dsName);
      form.append('model_name', model);
      form.append('embedding_model_name', embeddingModel);
      form.append('preset_id', 'icd11_standard');
      form.append('icd_scope', icdScope);
      form.append('icd_section_ids', icdScope === 'sections' ? selectedSections.join(',') : '');

      const newDs = await vectorstoreApi.create(form);

      // Close creation modal & open progress modal
      setOpen(false);
      setActiveStoreId(newDs.id);
      setProgressModalOpen(true);
      setName('');
      setEmbeddingModelOverride('');
      setIcdScope('chapter_6');
      setSelectedSections([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create the vector store.');
    } finally {
      setCreating(false);
    }
  };

  const toggleSection = (id: string) => {
    setSelectedSections((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const activeStore = datastores.find((ds) => ds.id === activeStoreId);

  return (
    <div className="app-page space-y-6">
      <div className="hidden" aria-hidden="true">{secondsTicker}</div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CircleStackIcon className="h-7 w-7 text-primary" />
            <h1 className="app-title">Local Vector Stores (Chroma)</h1>
          </div>
          <p className="app-subtitle mt-2">
            Build offline Chroma vector stores from ICD-11 Chapter 6. Use the full chapter for broad experiments, or selected sections for smaller and cheaper local RAG runs.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <PlusIcon className="h-4 w-4" />
          New vector store
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg" /></div>
      ) : datastores.length === 0 ? (
        <div className="hero rounded-box bg-base-100 shadow-sm">
          <div className="hero-content text-center">
            <div>
              <h2 className="text-2xl font-semibold">No local vector stores yet</h2>
              <p className="mt-2 text-base-content/60">Create a focused ICD-11 Chapter 6 vector store to support offline retrieval experiments.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {datastores.map((ds) => (
            <div key={ds.id} className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow">
              <div className="card-body">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="card-title text-base font-bold">{ds.name}</h2>
                    <p className="text-xs text-base-content/60">{ds.description}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${ds.status === 'ready' ? 'badge-success text-success-content font-bold' : ds.status === 'failed' ? 'badge-error' : 'badge-warning font-bold'}`}>
                      {ds.status}
                    </span>
                    {ds.status === 'processing' && (
                      <div className="text-xs text-warning mt-1.5 font-medium flex items-center gap-1 justify-end">
                        <ClockIcon className="h-3.5 w-3.5 animate-pulse text-warning" />
                        <span>~{getRemainingTime(ds)}s left</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs space-y-1 text-base-content/80 mt-2 bg-base-200/50 p-2.5 rounded-lg border border-base-300">
                  <div>Model: <span className="font-semibold">{ds.model_name}</span></div>
                  <div>Embedding: <span className="font-semibold">{ds.metadata_info?.embedding_model || ds.model_name}</span></div>
                  <div>Chapter: <span className="font-semibold">{formatVectorStoreChapter(ds)}</span></div>
                  <div>Scope: <span className="font-semibold">{formatVectorStoreScope(ds)}</span></div>
                  <div>Chunks: <span className="font-semibold">{ds.metadata_info?.chunks || 0}</span></div>
                  {ds.metadata_info?.icd11_nodes_count !== undefined && (
                    <div>ICD-11 nodes: <span className="font-semibold">{ds.metadata_info.icd11_nodes_count}</span></div>
                  )}
                </div>
                {ds.status === 'processing' && (
                  <div className="rounded-box border border-warning/20 bg-warning/5 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold uppercase tracking-wide text-warning">
                        {formatProgressStage(ds)}
                      </span>
                      <span className="font-bold">{getProgressPercent(ds)}%</span>
                    </div>
                    <progress
                      className="progress progress-warning h-2 w-full"
                      value={getProgressPercent(ds)}
                      max={100}
                    />
                    <p className="mt-2 text-xs text-base-content/70">
                      {ds.metadata_info?.progress_message || 'Preparing the vector store.'}
                    </p>
                  </div>
                )}
                {ds.error_message && <div className="alert alert-error text-xs p-2.5">{ds.error_message}</div>}
                <div className="card-actions justify-end mt-2">
                  {ds.status === 'processing' && (
                    <button
                      className="btn btn-warning btn-xs font-bold gap-1"
                      onClick={() => {
                        setActiveStoreId(ds.id);
                        setProgressModalOpen(true);
                      }}
                    >
                      <ClockIcon className="h-3.5 w-3.5" />
                      View Progress
                    </button>
                  )}
                  {ds.status === 'ready' && <Link href={`/explorer?ds=${ds.id}`} className="btn btn-primary btn-xs font-bold">Open Explorer</Link>}
                  <button className="btn btn-error btn-outline btn-xs" onClick={() => confirm('Delete local vector store?') && vectorstoreApi.delete(ds.id).then(load)}>
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Progress & Live Estimation Modal */}
      {progressModalOpen && activeStore && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg bg-base-100 border border-base-300 shadow-2xl p-6">
            <div className="flex items-start justify-between border-b border-base-200 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-lg text-base-content flex items-center gap-2">
                  <CircleStackIcon className="h-5 w-5 text-primary" />
                  Vector Store Building Progress
                </h3>
                <p className="text-xs text-base-content/60 mt-0.5">{activeStore.name}</p>
              </div>
              <button className="btn btn-xs btn-ghost btn-circle" onClick={() => setProgressModalOpen(false)}>
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Progress Bar & Stage */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="uppercase tracking-wider text-primary">
                    {formatProgressStage(activeStore)}
                  </span>
                  <span className="text-base-content">{getProgressPercent(activeStore)}%</span>
                </div>
                
                <progress
                  className={`progress ${activeStore.status === 'ready' ? 'progress-success' : activeStore.status === 'failed' ? 'progress-error' : 'progress-primary'} h-3 w-full`}
                  value={getProgressPercent(activeStore)}
                  max={100}
                />

                <p className="text-xs text-base-content/80 font-medium leading-relaxed">
                  {activeStore.metadata_info?.progress_message || 'Initializing local vector store...'}
                </p>

                {activeStore.status === 'processing' && (
                  <div className="flex items-center justify-between pt-2 border-t border-primary/10 text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1.5">
                      <ClockIcon className="h-4 w-4 animate-spin" />
                      Estimated remaining time
                    </span>
                    <span className="font-mono text-sm">~{getRemainingTime(activeStore)} seconds</span>
                  </div>
                )}
              </div>

              {/* Configuration Summary */}
              <div className="text-xs space-y-1.5 bg-base-200/50 p-3 rounded-lg border border-base-300">
                <div className="flex justify-between">
                  <span className="text-base-content/60">Chat Model:</span>
                  <span className="font-bold text-base-content">{activeStore.model_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Embedding Engine:</span>
                  <span className="font-bold text-base-content">{activeStore.metadata_info?.embedding_model || activeStore.model_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">ICD-11 Scope:</span>
                  <span className="font-bold text-base-content">{formatVectorStoreScope(activeStore)}</span>
                </div>
              </div>

              {/* Final State Banner */}
              {activeStore.status === 'ready' && (
                <div className="alert alert-success shadow-xs flex items-center gap-3 text-xs font-bold">
                  <CheckCircleIcon className="h-5 w-5 text-success-content shrink-0" />
                  <span>🎉 Local vector store built and ready for RAG queries!</span>
                </div>
              )}

              {activeStore.status === 'failed' && (
                <div className="alert alert-error text-xs font-semibold">
                  <span>✕ Creation failed: {activeStore.error_message || 'Unknown error'}</span>
                </div>
              )}
            </div>

            <div className="modal-action mt-6 border-t border-base-200 pt-3">
              {activeStore.status === 'processing' ? (
                <button className="btn btn-outline btn-sm w-full font-bold" onClick={() => setProgressModalOpen(false)}>
                  Run in background
                </button>
              ) : (
                <div className="flex gap-2 w-full justify-end">
                  <button className="btn btn-ghost btn-sm font-bold" onClick={() => setProgressModalOpen(false)}>Close</button>
                  {activeStore.status === 'ready' && (
                    <button
                      className="btn btn-primary btn-sm font-bold"
                      onClick={() => {
                        setProgressModalOpen(false);
                        router.push(`/explorer?ds=${activeStore.id}`);
                      }}
                    >
                      Open Explorer
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Local Vector Store Modal */}
      {open && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl bg-base-100 border border-base-300">
            <h3 className="font-bold text-lg text-base-content">Create Local Vector Store</h3>
            <p className="text-xs text-base-content/60 mt-1">Configure offline Chroma vector store parameters and ICD-11 Chapter 6 scope.</p>

            <form onSubmit={create} className="space-y-4 mt-4">
              <div className="form-control">
                <label className="label font-semibold text-xs text-base-content/80">Vector Store Name</label>
                <input
                  type="text"
                  className="input input-bordered w-full text-sm"
                  placeholder="e.g. ICD-11 Psychosis Focus Store"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="form-control">
                  <label className="label font-semibold text-xs text-base-content/80">LLM Chat Model</label>
                  <select className="select select-bordered text-sm" value={model} onChange={(e) => setModel(e.target.value)}>
                    {models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label font-semibold text-xs text-base-content/80">Embedding Model Override (Optional)</label>
                  <input
                    type="text"
                    className="input input-bordered w-full text-sm"
                    placeholder="all-MiniLM-L6-v2 (default local)"
                    value={embeddingModelOverride}
                    onChange={(e) => setEmbeddingModelOverride(e.target.value)}
                  />
                </div>
              </div>

              {/* ICD-11 Scope Selection */}
              <div className="rounded-box border border-base-300 bg-base-200/40 p-4 space-y-3">
                <div className="font-bold text-xs uppercase tracking-wider text-primary">ICD-11 Chapter 6 Scope</div>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200/50 transition-colors">
                    <input
                      type="radio"
                      className="radio radio-primary radio-sm"
                      checked={icdScope === 'chapter_6'}
                      onChange={() => setIcdScope('chapter_6')}
                    />
                    <div>
                      <div className="font-bold text-xs text-base-content">Use Full Chapter 06</div>
                      <div className="text-[11px] text-base-content/60">Includes all 23 mental, behavioural or neurodevelopmental disorder categories.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200/50 transition-colors">
                    <input
                      type="radio"
                      className="radio radio-primary radio-sm"
                      checked={icdScope === 'sections'}
                      onChange={() => setIcdScope('sections')}
                    />
                    <div>
                      <div className="font-bold text-xs text-base-content">Use Selected Sections</div>
                      <div className="text-[11px] text-base-content/60">Choose specific ICD-11 Chapter 6 sub-sections for faster local RAG indexing.</div>
                    </div>
                  </label>
                </div>

                {icdScope === 'sections' && (
                  <div className="mt-3 pt-3 border-t border-base-300 max-h-48 overflow-y-auto space-y-1.5 pr-2">
                    {icdSections.map((sec) => (
                      <label key={sec.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-base-200 p-1.5 rounded">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary checkbox-xs"
                          checked={selectedSections.includes(sec.id)}
                          onChange={() => toggleSection(sec.id)}
                        />
                        <span className="font-semibold text-primary">{sec.code}</span>
                        <span className="truncate">{sec.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="alert alert-error text-xs">{error}</div>}

              <div className="modal-action pt-2">
                <button type="button" className="btn btn-ghost btn-sm font-bold" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm font-bold gap-2" disabled={creating}>
                  {creating ? <span className="loading loading-spinner loading-xs" /> : 'Create Local Vector Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function findMatchingVectorStore(
  datastores: Datastore[],
  modelName: string,
  embeddingModelName: string,
  icdScope: 'chapter_6' | 'sections',
  selectedSections: string[]
) {
  return datastores.find((store) => {
    const metaModel = store.model_name;
    const metaEmbedding = store.metadata_info?.embedding_model || store.model_name;
    const metaScope = store.metadata_info?.icd_scope;

    if (metaModel !== modelName || metaEmbedding !== embeddingModelName || metaScope !== icdScope) {
      return false;
    }

    if (icdScope === 'sections') {
      const existingSections = Array.isArray(store.metadata_info?.icd_section_ids)
        ? [...store.metadata_info.icd_section_ids].sort()
        : [];
      const sortedSections = [...selectedSections].sort();
      return existingSections.join(',') === sortedSections.join(',');
    }

    return true;
  });
}

function formatVectorStoreScope(store: Datastore) {
  const scope = store.metadata_info?.icd_scope;
  if (scope === 'sections') {
    const count = Array.isArray(store.metadata_info?.icd_section_ids)
      ? store.metadata_info.icd_section_ids.length
      : 0;
    return `${count} selected ICD-11 Chapter 6 section${count === 1 ? '' : 's'}`;
  }
  if (scope === 'chapter_6') return 'Full Chapter 06';
  return 'Legacy preset';
}

function formatVectorStoreChapter(store: Datastore) {
  const chapter = store.metadata_info?.icd_chapter;
  if (chapter?.code && chapter?.title) {
    return `${chapter.code} · ${chapter.title}`;
  }
  return 'ICD-11 Chapter 06';
}

function getProgressPercent(store: Datastore) {
  const value = Number(store.metadata_info?.progress_percent);
  if (!Number.isFinite(value)) return store.status === 'processing' ? 10 : 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatProgressStage(store: Datastore) {
  const stage = store.metadata_info?.progress_stage;
  if (!stage) return 'Processing';
  return String(stage)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
