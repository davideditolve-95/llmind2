'use client';

import { useCallback, useEffect, useState } from 'react';
import { chatApi } from '@/lib/api';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { ArrowPathIcon, Cog6ToothIcon, PlayIcon } from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const [health, setHealth] = useState<{ status: string; base_url: string; models_count: number; latency_ms: number; error?: string } | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState('');
  const [testModel, setTestModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful clinical assistant.');
  const [userPrompt, setUserPrompt] = useState('Explain your role in one paragraph.');
  const [response, setResponse] = useState('');
  const [latency, setLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, modelRes] = await Promise.all([chatApi.getHealth(), chatApi.getModels()]);
      setHealth(healthRes);
      setModels(modelRes.models);
      setDefaultModel(modelRes.default_model);
      setTestModel((current) => current || modelRes.default_model || modelRes.models[0] || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runTest = async () => {
    setTesting(true);
    setResponse('');
    setLatency(null);
    try {
      const res = await chatApi.testPrompt({ model_name: testModel, prompt: userPrompt, system_prompt: systemPrompt });
      setResponse(res.success ? res.content : res.error || 'Inference failed.');
      setLatency(res.latency_ms);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="app-page space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><Cog6ToothIcon className="h-7 w-7 text-primary" /><h1 className="app-title">Settings</h1></div>
          <p className="app-subtitle mt-2">Check Ollama connectivity, model availability, and one-shot inference behavior.</p>
        </div>
        <button className="btn btn-outline" onClick={load} disabled={loading}>
          <ArrowPathIcon className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </button>
      </div>

      <section className="stats stats-vertical w-full bg-base-100 shadow-sm lg:stats-horizontal">
        <div className="stat"><div className="stat-title">Status</div><div className="stat-value text-xl">{health?.status || '-'}</div></div>
        <div className="stat"><div className="stat-title">Latency</div><div className="stat-value">{health?.latency_ms ?? '-'}<span className="text-base"> ms</span></div></div>
        <div className="stat"><div className="stat-title">Models</div><div className="stat-value">{models.length}</div></div>
        <div className="stat"><div className="stat-title">Default</div><div className="stat-value text-xl">{defaultModel || '-'}</div></div>
      </section>

      {health?.error && <div className="alert alert-error">{health.error}</div>}

      <div className="grid items-start gap-4 lg:grid-cols-[22rem_1fr]">
        <section className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Model library</h2>
            <div className="space-y-2">
              {models.map((model) => (
                <div key={model} className="flex items-center justify-between gap-3 rounded-box bg-base-200 p-3 text-sm">
                  <span className="min-w-0 truncate">{model}</span>
                  {model === defaultModel && <span className="badge badge-primary badge-sm shrink-0">default</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card bg-base-100 shadow-sm">
          <div className="card-body gap-5">
            <div className="grid gap-4 md:grid-cols-[1fr_16rem] md:items-end">
              <div>
                <h2 className="card-title">Playground</h2>
                <p className="mt-1 text-sm text-base-content/60">Send a single prompt with a controlled system instruction.</p>
              </div>
              <label className="form-control w-full">
                <span className="label-text mb-2">Model</span>
                <select className="select select-bordered w-full" value={testModel} onChange={(e) => setTestModel(e.target.value)}>
                  {models.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
            <label className="form-control w-full">
              <span className="label-text mb-2">System prompt</span>
              <textarea className="textarea textarea-bordered min-h-40 w-full resize-y" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
            </label>
            <label className="form-control w-full">
              <span className="label-text mb-2">User prompt</span>
              <textarea className="textarea textarea-bordered min-h-40 w-full resize-y" value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} />
            </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button className="btn btn-primary w-full sm:w-fit" disabled={testing || !testModel || !userPrompt.trim()} onClick={runTest}>
                {testing ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
                Run test
              </button>
              {latency !== null && <span className="badge badge-outline">{latency} ms</span>}
            </div>

            {(response || latency !== null) && (
              <div className="rounded-box bg-base-200 p-4">
                <MarkdownContent content={response} />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
