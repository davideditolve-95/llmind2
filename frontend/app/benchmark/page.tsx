'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { benchmarkApi, type BenchmarkKPIs, type BenchmarkRun } from '@/lib/api';
import MarkdownContent from '@/components/ui/MarkdownContent';
import { ArrowPathIcon, BeakerIcon, StarIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function BenchmarkPage() {
  const [kpis, setKpis] = useState<BenchmarkKPIs | null>(null);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [kpiRes, history] = await Promise.all([
        benchmarkApi.getKPIs(),
        benchmarkApi.getHistory({ page: 1, page_size: 30 }),
      ]);
      setKpis(kpiRes);
      setRuns(history.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addRating = async (runId: string, rating: number) => {
    await benchmarkApi.addEvaluation(runId, { evaluator_name: 'Researcher', rating });
    load();
  };

  return (
    <div className="app-page space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BeakerIcon className="h-7 w-7 text-primary" />
            <h1 className="app-title">Benchmark Lab</h1>
          </div>
          <p className="app-subtitle mt-2">Inspect model runs, automatic scores, latency, and human ratings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/benchmark/cases" className="btn btn-primary">Run new benchmark</Link>
          <button className="btn btn-outline" onClick={load} disabled={loading}>
            <ArrowPathIcon className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </button>
        </div>
      </div>

      <section className="stats stats-vertical w-full bg-base-100 shadow-sm lg:stats-horizontal">
        <div className="stat"><div className="stat-title">Cases</div><div className="stat-value">{kpis?.total_cases ?? '-'}</div></div>
        <div className="stat"><div className="stat-title">Runs</div><div className="stat-value">{kpis?.total_runs ?? '-'}</div></div>
        <div className="stat"><div className="stat-title">Reviewed</div><div className="stat-value">{kpis?.reviewed_cases ?? '-'}</div></div>
        <div className="stat"><div className="stat-title">Models</div><div className="stat-value">{kpis?.models_tested?.length ?? '-'}</div></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {kpis?.model_kpis?.map((model) => (
          <div key={model.model_name} className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title">{model.model_name}</h2>
              <div className="grid grid-cols-2 gap-3 text-sm xl:grid-cols-3">
                <Metric label="Runs" value={model.total_runs} />
                <Metric label="Similarity" value={formatScore(model.avg_similarity)} />
                <Metric label="Accuracy" value={formatPercent(model.avg_label_accuracy)} />
                <Metric label="Precision" value={formatPercent(model.avg_precision)} />
                <Metric label="Recall" value={formatPercent(model.avg_recall)} />
                <Metric label="F1" value={formatPercent(model.avg_f1)} />
                <Metric label="No diagnosis" value={`${model.no_diagnosis_count} (${formatPercent(model.no_diagnosis_rate)})`} />
                <Metric label="Latency" value={model.avg_latency_ms ? `${Math.round(model.avg_latency_ms)} ms` : '-'} />
                <Metric label="Human rating" value={model.avg_human_rating?.toFixed(2) ?? '-'} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title">Recent runs</h2>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Similarity</th>
                  <th>Accuracy</th>
                  <th>F1</th>
                  <th>Latency</th>
                  <th>Rating</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-12 text-center"><span className="loading loading-spinner loading-lg" /></td></tr>
                ) : runs.length ? runs.map((run) => (
                  <Fragment key={run.id}>
                    <tr key={run.id}>
                      <td>
                        <div className="font-medium">{run.case_title || 'Untitled case'}</div>
                        <div className="text-xs text-base-content/50">{run.case_number}</div>
                      </td>
                      <td>{run.model_name}</td>
                      <td><span className="badge badge-outline">{run.status}</span></td>
                      <td>{formatScore(run.similarity_score)}</td>
                      <td>{formatPercent(run.label_accuracy)}</td>
                      <td>{formatPercent(run.f1_score)}</td>
                      <td>{run.latency_ms ? `${run.latency_ms} ms` : '-'}</td>
                      <td>
                        <div className="rating rating-sm">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <input key={star} type="radio" name={`rating-${run.id}`} className="mask mask-star-2 bg-warning" onClick={() => addRating(run.id, star)} />
                          ))}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="join">
                          <button className="btn btn-sm join-item" onClick={() => setExpanded(expanded === run.id ? null : run.id)}>Details</button>
                          <button className="btn btn-sm join-item" onClick={() => benchmarkApi.retryRun(run.id).then(load)}>Retry</button>
                        </div>
                      </td>
                    </tr>
                    {expanded === run.id && (
                      <tr>
                        <td colSpan={9}>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-box bg-base-200 p-4">
                              <h3 className="mb-2 font-semibold">Prompt</h3>
                              <pre className="whitespace-pre-wrap text-xs">{run.prompt_used}</pre>
                            </div>
                            <div className="rounded-box bg-base-200 p-4">
                              <h3 className="mb-2 font-semibold">Response</h3>
                              <div className="mb-3 flex flex-wrap gap-2">
                                <span className="badge badge-outline">Precision {formatPercent(run.precision_score)}</span>
                                <span className="badge badge-outline">Recall {formatPercent(run.recall_score)}</span>
                                <span className="badge badge-outline">F1 {formatPercent(run.f1_score)}</span>
                                {run.no_diagnosis && <span className="badge badge-warning">No diagnosis</span>}
                              </div>
                              <MarkdownContent content={run.llm_response || 'No response'} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )) : (
                  <tr><td colSpan={9} className="py-12 text-center text-base-content/60">No benchmark runs yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="card-actions justify-end">
            <button className="btn btn-error btn-outline btn-sm" onClick={() => confirm('Purge benchmark history?') && benchmarkApi.purgeHistory().then(load)}>
              <TrashIcon className="h-4 w-4" />
              Purge history
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-box bg-base-200 p-3">
      <div className="text-xs text-base-content/60">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : value.toFixed(3);
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : `${Math.round(value * 100)}%`;
}
