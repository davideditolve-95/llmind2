'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { benchmarkApi, casesApi, chatApi, icd11Api } from '@/lib/api';
import {
  BeakerIcon,
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  ServerStackIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

const modules = [
  { href: '/tabular', title: 'ICD-11 Browser', text: 'Browse and inspect diagnostic taxonomy data.', icon: Squares2X2Icon },
  { href: '/chat', title: 'Clinical Chat', text: 'Run streamed ICD-11 and differential reasoning sessions.', icon: ChatBubbleLeftRightIcon },
  { href: '/benchmark', title: 'Benchmark Lab', text: 'Compare model outputs, ratings, latency, and similarity.', icon: BeakerIcon },
  { href: '/datastores', title: 'Datastores', text: 'Build and query custom RAG knowledge libraries.', icon: CircleStackIcon },
];

export default function HomePage() {
  const [stats, setStats] = useState({
    codes: '-',
    cases: '-',
    runs: '-',
    models: '-',
  });

  useEffect(() => {
    Promise.allSettled([
      icd11Api.getStats(),
      casesApi.getStats(),
      benchmarkApi.getKPIs(),
      chatApi.getModels(),
    ]).then(([icd, cases, kpis, models]) => {
      setStats({
        codes: icd.status === 'fulfilled' ? icd.value.total_codes.toLocaleString() : '-',
        cases: cases.status === 'fulfilled' ? cases.value.total_cases.toLocaleString() : '-',
        runs: kpis.status === 'fulfilled' ? kpis.value.total_runs.toLocaleString() : '-',
        models: models.status === 'fulfilled' ? models.value.models.length.toLocaleString() : '-',
      });
    });
  }, []);

  return (
    <div className="app-page space-y-6">
      <section className="hero rounded-box bg-base-100 shadow-sm">
        <div className="hero-content w-full justify-between gap-8 py-10">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="badge badge-primary">Research platform</span>
              <span className="badge badge-outline">ICD-11</span>
              <span className="badge badge-outline">Ollama</span>
            </div>
            <h1 className="app-title">LLMind2 Clinical AI Workspace</h1>
            <p className="app-subtitle mt-3">
              A compact research console for ontology exploration, clinical case benchmarking, streamed model
              interaction, and RAG datastore experiments.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link className="btn btn-primary" href="/benchmark/cases">Review cases</Link>
              <Link className="btn btn-outline" href="/chat">Open chat</Link>
            </div>
          </div>
          <ServerStackIcon className="hidden h-28 w-28 text-primary/60 lg:block" />
        </div>
      </section>

      <section className="stats stats-vertical w-full bg-base-100 shadow-sm lg:stats-horizontal">
        <div className="stat"><div className="stat-title">ICD-11 codes</div><div className="stat-value">{stats.codes}</div></div>
        <div className="stat"><div className="stat-title">Clinical cases</div><div className="stat-value">{stats.cases}</div></div>
        <div className="stat"><div className="stat-title">Benchmark runs</div><div className="stat-value">{stats.runs}</div></div>
        <div className="stat"><div className="stat-title">Models</div><div className="stat-value">{stats.models}</div></div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map((item) => (
          <Link key={item.href} href={item.href} className="card bg-base-100 shadow-sm transition hover:shadow-md">
            <div className="card-body">
              <item.icon className="h-8 w-8 text-primary" />
              <h2 className="card-title">{item.title}</h2>
              <p className="text-sm text-base-content/70">{item.text}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
