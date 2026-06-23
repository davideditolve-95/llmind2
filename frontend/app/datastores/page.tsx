'use client';

import { FormEvent, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { chatApi, datastoreApi, type Datastore, type IcdScopeOption, type KnowledgePreset } from '@/lib/api';
import { ArrowPathIcon, CircleStackIcon, PlusIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function DatastoresPage() {
  const [datastores, setDatastores] = useState<Datastore[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [presets, setPresets] = useState<KnowledgePreset[]>([]);
  const [icdSections, setIcdSections] = useState<IcdScopeOption[]>([]);
  const [icdChapter, setIcdChapter] = useState<IcdScopeOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [preset, setPreset] = useState('');
  const [icdScope, setIcdScope] = useState<'chapter_6' | 'sections'>('chapter_6');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsTicker, setSecondsTicker] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ds, modelRes, presetRes, scopeRes] = await Promise.all([
        datastoreApi.list(),
        chatApi.getModels(),
        datastoreApi.getPresets(),
        datastoreApi.getIcdScopeOptions(),
      ]);
      setDatastores(ds);
      setModels(modelRes.models);
      setPresets(presetRes);
      setIcdChapter(scopeRes.chapter);
      setIcdSections(scopeRes.sections);
      setModel((current) => current || modelRes.default_model || modelRes.models[0] || '');
      setPreset((current) => current || presetRes[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load datastore configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Update a ticker every second to force re-render for processing datastore countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll server for status updates while any datastore is "processing"
  useEffect(() => {
    const hasProcessing = datastores.some((ds) => ds.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      datastoreApi.list()
        .then((ds) => setDatastores(ds))
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [datastores]);

  const getRemainingTime = (ds: Datastore) => {
    if (ds.status !== 'processing') return null;
    const createdTime = new Date(ds.created_at).getTime();
    const now = new Date().getTime();
    const elapsed = Math.floor((now - createdTime) / 1000);
    
    // Estimate based on preset
    const presetId = ds.metadata_info?.preset_id || 'clinical_full';
    let totalEstimate = 30; // default 30s
    if (presetId === 'clinical_full') totalEstimate = 45;
    else if (presetId === 'icd11_standard') totalEstimate = 30;
    else if (presetId === 'dsm5_cases') totalEstimate = 20;

    const remaining = totalEstimate - elapsed;
    return remaining > 0 ? remaining : 5; // minimum 5s fallback
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (icdScope === 'sections' && selectedSections.length === 0) {
      setError('Select at least one ICD-11 chapter 6 section, or use the full chapter.');
      return;
    }

    setCreating(true);
    setError(null);
    const form = new FormData();
    form.append('name', name);
    form.append('model_name', model);
    form.append('preset_id', 'icd11_standard');
    form.append('icd_scope', icdScope);
    form.append('icd_section_ids', selectedSections.join(','));
    
    // Close modal immediately so the user can see the "processing" state
    setOpen(false);

    try {
      await datastoreApi.create(form);
      setName('');
      setIcdScope('chapter_6');
      setSelectedSections([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create datastore.');
    } finally {
      setCreating(false);
    }
  };

  const toggleSection = (id: string) => {
    setSelectedSections((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  return (
    <div className="app-page space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CircleStackIcon className="h-7 w-7 text-primary" />
            <h1 className="app-title">Datastores</h1>
          </div>
          <p className="app-subtitle mt-2">Create preset-based vector stores and query them from the custom explorer.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <PlusIcon className="h-4 w-4" />
          New datastore
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
            <div><h2 className="text-2xl font-semibold">No datastores yet</h2><p className="mt-2 text-base-content/60">Create a library from one of the clinical presets.</p></div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {datastores.map((ds) => (
            <div key={ds.id} className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="card-title">{ds.name}</h2>
                    <p className="text-sm text-base-content/60">{ds.description}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${ds.status === 'ready' ? 'badge-success' : ds.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
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
                <div className="text-sm">
                  <div>Model: <span className="font-medium">{ds.model_name}</span></div>
                  <div>Chunks: <span className="font-medium">{ds.metadata_info?.chunks || 0}</span></div>
                  {ds.metadata_info?.icd11_nodes_count !== undefined && (
                    <div>ICD-11 nodes: <span className="font-medium">{ds.metadata_info.icd11_nodes_count}</span></div>
                  )}
                </div>
                {ds.error_message && <div className="alert alert-error text-sm">{ds.error_message}</div>}
                <div className="card-actions justify-end">
                  {ds.status === 'ready' && <Link href={`/explorer?ds=${ds.id}`} className="btn btn-primary btn-sm">Open</Link>}
                  <button className="btn btn-error btn-outline btn-sm" onClick={() => confirm('Delete datastore?') && datastoreApi.delete(ds.id).then(load)}>
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <dialog className={`modal ${open ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="text-lg font-semibold">Create datastore</h3>
          <form className="mt-4 space-y-4" onSubmit={create}>
            <input className="input input-bordered w-full" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            
            <div className="rounded-box border border-base-300 bg-base-200/50 p-4">
              <div className="mb-3">
                <div className="font-semibold">ICD-11 chapter 6 scope</div>
                <p className="text-sm text-base-content/60">
                  Choose whether this datastore should include the full mental, behavioural and neurodevelopmental chapter or only selected direct sections.
                </p>
              </div>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-box bg-base-100 p-3">
                  <input
                    type="radio"
                    className="radio radio-primary mt-1"
                    name="icd_scope"
                    checked={icdScope === 'chapter_6'}
                    onChange={() => setIcdScope('chapter_6')}
                  />
                  <span>
                    <span className="block font-medium">Use all chapter 6</span>
                    <span className="text-sm text-base-content/60">
                      {icdChapter ? `${icdChapter.code || 'Chapter 6'} · ${icdChapter.title}` : 'Chapter 6 will be used when ICD-11 data is available.'}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-box bg-base-100 p-3">
                  <input
                    type="radio"
                    className="radio radio-primary mt-1"
                    name="icd_scope"
                    checked={icdScope === 'sections'}
                    onChange={() => setIcdScope('sections')}
                  />
                  <span>
                    <span className="block font-medium">Use selected sections</span>
                    <span className="text-sm text-base-content/60">Useful for smaller, cheaper and more focused vector stores.</span>
                  </span>
                </label>
              </div>

              {icdScope === 'sections' && (
                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {icdSections.length === 0 ? (
                    <div className="alert alert-warning text-sm">No chapter 6 sections available. Run the ICD-11 ETL first.</div>
                  ) : (
                    icdSections.map((section) => (
                      <label key={section.id} className="flex cursor-pointer items-start gap-3 rounded-box bg-base-100 p-3">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary mt-1"
                          checked={selectedSections.includes(section.id)}
                          onChange={() => toggleSection(section.id)}
                        />
                        <span>
                          <span className="block font-medium">{section.code || 'No code'} · {section.title}</span>
                          <span className="text-sm text-base-content/60">{section.children_count} direct children</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={creating}>
                {creating && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                Create
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button onClick={() => setOpen(false)}>close</button></form>
      </dialog>
    </div>
  );
}
