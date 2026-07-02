'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { benchmarkApi, casesApi, chatApi, icd11Api } from '@/lib/api';
import {
  ArrowRightIcon,
  BeakerIcon,
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  ClipboardDocumentListIcon,
  Squares2X2Icon,
  UserIcon,
} from '@heroicons/react/24/outline';

const bands = [
  {
    href: '/patients',
    secondaryHref: '/benchmark/cases',
    label: '01',
    title: 'Patients & Clinical Cases',
    subtitle: 'Start from the clinical material.',
    text: 'Create patient workspaces, import DSM-5 Clinical Cases, and keep real exploratory work separate from benchmark datasets.',
    action: 'Open Patients',
    secondaryAction: 'DSM-5 Cases',
    icon: UserIcon,
    tone: 'from-teal-50 to-white',
  },
  {
    href: '/benchmark',
    secondaryHref: '/benchmark/cases',
    label: '02',
    title: 'Benchmark Lab',
    subtitle: 'Compare models with reproducible evidence.',
    text: 'Run controlled evaluations, preserve prompts and outputs, inspect latency and metrics, and compare different LLMs without confusing the model with the platform.',
    action: 'Open Benchmark',
    secondaryAction: 'Review Dataset',
    icon: BeakerIcon,
    tone: 'from-amber-50 to-white',
  },
  {
    href: '/tabular',
    secondaryHref: '/datastores',
    label: '03',
    title: 'Clinical Knowledge',
    subtitle: 'Ground reasoning in ICD-11, DSM-5 and curated sources.',
    text: 'Browse diagnostic taxonomies and build focused local vector stores for retrieval-augmented experiments.',
    action: 'Explore ICD-11',
    secondaryAction: 'Vector Stores',
    icon: Squares2X2Icon,
    tone: 'from-sky-50 to-white',
  },
  {
    href: '/chat',
    secondaryHref: '/gcp-agents',
    label: '04',
    title: 'Model Interaction',
    subtitle: 'Use chat and agents as experimental interfaces.',
    text: 'Talk to configured models, inspect qualitative behavior, and keep specialist conversational agents as optional extensions.',
    action: 'Open Chat',
    secondaryAction: 'Agents Console',
    icon: ChatBubbleLeftRightIcon,
    tone: 'from-emerald-50 to-white',
  },
];

const statsConfig = [
  ['ICD-11 codes', 'codes'],
  ['DSM-5 cases', 'cases'],
  ['Benchmark runs', 'runs'],
  ['Models', 'models'],
] as const;

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
    <main className="app-page space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-base-300 bg-base-100 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(20,184,166,0.18),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(14,165,233,0.14),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,253,250,0.72))]" />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_0.85fr] lg:p-10">
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="badge badge-primary badge-lg">LLMind2</span>
              <span className="badge badge-outline">Clinical AI research</span>
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight text-base-content sm:text-5xl lg:text-6xl">
              A clear workspace for clinical AI experiments.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-base-content/70 sm:text-lg">
              LLMind2 helps researchers organize clinical cases, benchmark language models, and ground model behavior
              in diagnostic knowledge. It is a platform for experiments, not the name of a single LLM.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="btn btn-primary" href="/patients">
                Start with patients
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link className="btn btn-outline" href="/benchmark">
                Go to benchmark
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-base-300 bg-white/80 p-5 shadow-sm backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-primary">System map</div>
                <h2 className="text-2xl font-black">From case to evidence</h2>
              </div>
              <CircleStackIcon className="h-10 w-10 text-primary" />
            </div>
            <div className="grid gap-3">
              <MapNode icon={ClipboardDocumentListIcon} title="Clinical material" text="Patients and DSM-5 cases" />
              <MapNode icon={Squares2X2Icon} title="Knowledge layer" text="ICD-11, DSM-5, RAG sources" />
              <MapNode icon={BeakerIcon} title="Evaluation layer" text="Prompts, outputs, metrics, review" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statsConfig.map(([label, key]) => (
          <div key={key} className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-base-content/45">{label}</div>
            <div className="mt-2 text-3xl font-black text-primary">{stats[key]}</div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="max-w-3xl">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-primary">Platform areas</div>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-base-content sm:text-4xl">
            Four bands, four things to do.
          </h2>
        </div>

        <div className="space-y-4">
          {bands.map((band) => (
            <Band key={band.title} {...band} />
          ))}
        </div>
      </section>
    </main>
  );
}

function MapNode({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ClipboardDocumentListIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-box border border-base-300 bg-base-100 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="font-black text-base-content">{title}</div>
        <div className="text-sm text-base-content/65">{text}</div>
      </div>
    </div>
  );
}

function Band({
  href,
  secondaryHref,
  label,
  title,
  subtitle,
  text,
  action,
  secondaryAction,
  icon: Icon,
  tone,
}: {
  href: string;
  secondaryHref: string;
  label: string;
  title: string;
  subtitle: string;
  text: string;
  action: string;
  secondaryAction: string;
  icon: typeof UserIcon;
  tone: string;
}) {
  return (
    <section className={`rounded-[1.5rem] border border-base-300 bg-gradient-to-r ${tone} shadow-sm`}>
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[0.22fr_0.78fr_auto] lg:items-center">
        <div className="flex items-center gap-3">
          <div className="text-4xl font-black text-primary/35">{label}</div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-base-100 text-primary shadow-sm">
            <Icon className="h-7 w-7" />
          </div>
        </div>
        <div>
          <div className="text-sm font-black uppercase tracking-[0.18em] text-primary">{subtitle}</div>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-base-content sm:text-3xl">{title}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-base-content/70 sm:text-base">{text}</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Link href={href} className="btn btn-primary">
            {action}
          </Link>
          <Link href={secondaryHref} className="btn btn-outline">
            {secondaryAction}
          </Link>
        </div>
      </div>
    </section>
  );
}
