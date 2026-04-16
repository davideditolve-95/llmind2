'use client';

import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import Link from 'next/link';
import {
  TableCellsIcon,
  ChatBubbleLeftRightIcon,
  BeakerIcon,
  ArrowRightIcon,
  AcademicCapIcon,
  ShieldCheckIcon,
  CpuChipIcon,
  DocumentCheckIcon,
  Cog6ToothIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();

  const features = [
    {
      title: 'ICD-11 Explorer',
      description: 'Navigate through the complete ICD-11 hierarchy with diagnostic criteria and clinical metadata.',
      icon: TableCellsIcon,
      href: '/tabular',
      accent: 'indigo',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      borderHover: 'hover:border-indigo-300',
      badgeColor: 'text-indigo-600',
      tag: 'ICD-11 v2.5',
    },
    {
      title: 'Clinical AI Benchmark',
      description: 'Compare multiple LLMs on DSM-5 clinical cases with similarity metrics and detailed analysis.',
      icon: BeakerIcon,
      href: '/benchmark',
      accent: 'emerald',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      borderHover: 'hover:border-emerald-300',
      badgeColor: 'text-emerald-600',
      tag: 'DSM-5 Cases',
    },
    {
      title: 'AI Workspace',
      description: 'Interactive diagnostic assistant powered by advanced language models for differential reasoning.',
      icon: ChatBubbleLeftRightIcon,
      href: '/chat',
      accent: 'cyan',
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      borderHover: 'hover:border-cyan-300',
      badgeColor: 'text-cyan-600',
      tag: 'Differential Dx',
    },
  ];

  const stats = [
    { label: 'ICD-11 Codes', value: '80,000+', icon: TableCellsIcon, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Clinical Cases', value: '5,000+', icon: DocumentCheckIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'LLM Models', value: '12', icon: CpuChipIcon, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Avg Latency', value: '<200ms', icon: SparklesIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] page-enter overflow-hidden bg-white">

      {/* ── HERO ── Clean gradient, no confusing image */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 min-h-[70vh] flex items-center">
        {/* Accent blobs */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[100px] translate-x-1/4 translate-y-1/4" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-10 py-24 w-full">
          {/* Status pill */}
          <div className="inline-flex items-center gap-3 mb-10 px-5 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-white/70 text-[11px] font-black uppercase tracking-[0.4em]">
              Clinical Intelligence v4.2.0 · Online
            </span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tight text-white leading-[0.9] mb-8">
            LLMind2
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 text-5xl md:text-7xl mt-2">
              Clinical AI Platform
            </span>
          </h1>

          <p className="text-slate-300 text-xl md:text-2xl font-medium max-w-2xl mb-12 leading-relaxed">
            Orchestrate neural reasoning with ICD-11 ontologies for unprecedented
            diagnostic accuracy and clinical research.
          </p>

          <div className="flex flex-wrap gap-5">
            <button
              onClick={() => router.push('/chat')}
              className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg rounded-2xl shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all border-none"
            >
              <ChatBubbleLeftRightIcon className="w-6 h-6" />
              Open AI Workspace
            </button>
            <Link
              href="/benchmark/cases"
              className="inline-flex items-center gap-3 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-black text-lg rounded-2xl border border-white/20 backdrop-blur-sm transition-all"
            >
              <BeakerIcon className="w-6 h-6" />
              Run Benchmark
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20">
            {stats.map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.color} flex items-center justify-center mb-3`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="text-2xl font-black text-white">{s.value}</div>
                <div className="text-white/40 text-[11px] font-black uppercase tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURE CARDS ── */}
      <div className="bg-slate-50 py-24 px-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-indigo-600 font-black text-[11px] uppercase tracking-[0.5em] mb-3">Core Modules</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Clinical Workspaces</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f) => (
              <div
                key={f.title}
                onClick={() => router.push(f.href)}
                className={`group bg-white rounded-3xl border-2 border-slate-200 ${f.borderHover} p-8 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
              >
                {/* Tag */}
                <div className="flex items-center justify-between mb-8">
                  <div className={`px-3 py-1.5 rounded-full ${f.iconBg} ${f.iconColor} text-[10px] font-black uppercase tracking-widest`}>
                    {f.tag}
                  </div>
                </div>
                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl ${f.iconBg} ${f.iconColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">{f.title}</h3>
                <p className="text-slate-500 text-base leading-relaxed mb-8">{f.description}</p>
                <div className={`flex items-center gap-2 ${f.badgeColor} font-black text-sm uppercase tracking-wider group-hover:gap-4 transition-all`}>
                  Open module <ArrowRightIcon className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER STRIP ── */}
      <div className="bg-white border-t border-slate-200 px-10 py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <AcademicCapIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-slate-800 text-base">Scientific Registry</p>
              <p className="text-slate-400 text-xs font-medium">Collaborative Research v4.2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-slate-800 text-base">Protocol Vault</p>
              <p className="text-slate-400 text-xs font-medium">ISO-27001 Clinical Standard</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-900 text-white">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-black uppercase tracking-widest">Stable Build 4.2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
