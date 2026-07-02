'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { datastoreApi, legacyApi, type KnowledgePreset } from '@/lib/api';
import MarkdownContent from '@/components/ui/MarkdownContent';
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  BeakerIcon,
  ChatBubbleBottomCenterTextIcon,
  ClockIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type LegacyTab = 'chat' | 'batch' | 'logs';

const tabs: { id: LegacyTab; label: string; icon: typeof ChatBubbleBottomCenterTextIcon }[] = [
  { id: 'chat', label: 'Interactive RAG', icon: ChatBubbleBottomCenterTextIcon },
  { id: 'batch', label: 'Batch run', icon: BeakerIcon },
  { id: 'logs', label: 'Logs', icon: DocumentTextIcon },
];

export default function LegacyPage() {
  const [tab, setTab] = useState<LegacyTab>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<KnowledgePreset[]>([]);
  const [csv, setCsv] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completedRuns, setCompletedRuns] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const loadCompletedRuns = useCallback(async () => {
    try {
      const res = await legacyApi.listRuns();
      setCompletedRuns(res.runs);
    } catch {}
  }, []);

  useEffect(() => {
    datastoreApi.getPresets()
      .then((items) => {
        setPresets(items);
        const first = items.flatMap((p) => p.files).find((f) => f.toLowerCase().endsWith('.csv'));
        if (first) setCsv(first);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load legacy presets.'));
    
    loadCompletedRuns();
  }, [loadCompletedRuns]);

  useEffect(() => {
    if (tab !== 'logs') return;
    const load = () => legacyApi.getLogs(50).then((res) => setLogs(res.logs)).catch(() => {});
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [tab]);

  // Poll completed runs every 5 seconds to show new files in real time
  useEffect(() => {
    const timer = setInterval(() => {
      loadCompletedRuns();
    }, 5000);
    return () => clearInterval(timer);
  }, [loadCompletedRuns]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ask = async () => {
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setLoading(true);
    try {
      const res = await legacyApi.ask(query);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.output_string }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Legacy request failed.');
    } finally {
      setLoading(false);
    }
  };

  const runBatch = async () => {
    if (!csv) return;
    setError(null);
    try {
      await legacyApi.runBatch(csv);
      // Passa subito al tab dei log per far vedere il progresso
      setTab('logs');
      loadCompletedRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Legacy batch failed.');
    }
  };

  const csvFiles = presets.flatMap((p) => p.files).filter((f) => f.toLowerCase().endsWith('.csv'));

  return (
    <div className="app-page space-y-6">
      <section className="hero rounded-box border border-warning/20 bg-base-100 shadow-sm">
        <div className="hero-content w-full justify-between gap-8 py-8">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="badge badge-warning">Legacy v1</span>
              <span className="badge badge-outline">Static RAG</span>
              <span className="badge badge-outline">Reproducibility</span>
            </div>
            <div className="flex items-center gap-3">
              <ArchiveBoxIcon className="h-9 w-9 text-warning" />
              <h1 className="app-title">Legacy Pipeline</h1>
            </div>
            <p className="app-subtitle mt-3">
              A preserved LLMind v1 workspace for comparison, batch reproducibility, and historical RAG behavior.
            </p>
          </div>
          <div className="hidden text-right text-sm text-base-content/60 lg:block">
            <div className="font-semibold text-base-content">Mode: archived</div>
            <div>Engine: static chunking</div>
            <div>Scope: comparison only</div>
          </div>
        </div>
      </section>

      <div className="alert alert-warning">
        <ShieldExclamationIcon className="h-5 w-5" />
        <span>
          This module intentionally preserves the old non-agent workflow. Use it for comparison and reproducibility, not for new research runs.
        </span>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="tabs tabs-boxed w-fit bg-base-100 shadow-sm">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={clsx('tab gap-2', tab === item.id && 'tab-active')}
            onClick={() => setTab(item.id)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <section className="card h-[34rem] bg-base-100 shadow-sm">
          <div className="card-body min-h-0 gap-4">
            <div className="flex items-center justify-between gap-3 border-b border-base-200 pb-3">
              <div>
                <h2 className="card-title">Interactive legacy RAG</h2>
                <p className="text-sm text-base-content/60">Ask the preserved v1 retrieval chain and compare its answers with the current agent flow.</p>
              </div>
              <ClockIcon className="h-6 w-6 text-warning" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-box bg-base-200/60 p-4">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center text-center text-sm text-base-content/60">
                  Send a query to test the legacy RAG pipeline.
                </div>
              )}
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div key={index} className={clsx('chat', message.role === 'user' ? 'chat-end' : 'chat-start')}>
                    <div className="chat-header mb-1 text-xs uppercase tracking-wide text-base-content/50">
                      {message.role === 'user' ? 'Researcher' : 'Legacy v1'}
                    </div>
                    <div className={clsx('chat-bubble max-w-3xl', message.role === 'user' ? 'chat-bubble-primary' : 'bg-base-100 text-base-content shadow-sm')}>
                      <MarkdownContent content={message.content} />
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="chat chat-start">
                    <div className="chat-bubble bg-base-100 text-base-content shadow-sm">
                      <span className="loading loading-dots loading-sm" />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            <div className="flex gap-3">
              <input
                className="input input-bordered flex-1"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && ask()}
                placeholder="Ask the legacy vector store..."
                disabled={loading}
              />
              <button className="btn btn-primary" onClick={ask} disabled={!input.trim() || loading}>
                {loading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PaperAirplaneIcon className="h-4 w-4" />}
                Send
              </button>
            </div>
          </div>
        </section>
      )}

      {tab === 'batch' && (
        <section className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title">Batch test suite</h2>
              <p className="text-sm text-base-content/60">
                Run the original batch workflow against a CSV source. Outputs remain useful as historical baselines for thesis comparisons.
              </p>
              <label className="form-control mt-4 w-full">
                <span className="label-text mb-2">CSV source</span>
                <select className="select select-bordered w-full" value={csv} onChange={(event) => setCsv(event.target.value)}>
                  {csvFiles.length === 0 ? (
                    <option value="">No legacy CSV presets available</option>
                  ) : (
                    csvFiles.map((file) => <option key={file} value={file}>{file}</option>)
                  )}
                </select>
              </label>
              <div className="card-actions mt-4">
                <button className="btn btn-primary" disabled={!csv} onClick={runBatch}>
                  <BeakerIcon className="h-4 w-4" />
                  Run legacy batch
                </button>
                <button className="btn btn-outline" onClick={() => setTab('logs')}>
                  View logs
                </button>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body">
              <h3 className="card-title text-base">Completed Batch Runs</h3>
              <p className="text-sm text-base-content/60 mb-2">
                Download output CSV files from previous or running batch executions.
              </p>
              <div className="space-y-2 max-h-[16rem] overflow-y-auto pr-1">
                {completedRuns.length === 0 ? (
                  <p className="text-xs text-base-content/50 italic py-4">No completed runs found.</p>
                ) : (
                  completedRuns.map((run) => (
                    <div key={run} className="flex items-center justify-between p-3 rounded-lg bg-base-200/50 border border-base-300 gap-2">
                      <div className="flex items-center gap-2 overflow-hidden min-w-0">
                        <DocumentTextIcon className="h-4 w-4 text-warning flex-shrink-0" />
                        <span className="text-xs truncate font-mono" title={run}>{run}</span>
                      </div>
                      <a 
                        href={legacyApi.getRunUrl(run)} 
                        download 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn btn-xs btn-primary gap-1 flex-shrink-0"
                      >
                        Download
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'logs' && (
        <section className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="card-title">Legacy log stream</h2>
                <p className="text-sm text-base-content/60">Last 50 lines, refreshed while this tab is open.</p>
              </div>
              <span className="badge badge-success badge-outline">streaming</span>
            </div>
            <div className="mt-3 max-h-[34rem] overflow-auto rounded-box bg-neutral p-4 text-xs text-neutral-content">
              {logs.length ? (
                logs.map((log, index) => (
                  <pre key={index} className="whitespace-pre-wrap border-b border-neutral-content/10 py-1 last:border-b-0">
                    <code>{log}</code>
                  </pre>
                ))
              ) : (
                <div className="text-neutral-content/60">No logs available.</div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
