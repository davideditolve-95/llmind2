'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import {
  Globe,
  LayoutGrid,
  MessageSquare,
  HeartPulse,
  FlaskConical,
  ChevronDown,
  Languages,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

// Tipo per un link di navigazione
interface NavLink {
  href: string;
  labelKey: string;
  icon: React.ReactNode;
  children?: { href: string; labelKey: string }[];
}

const NAV_LINKS: NavLink[] = [
  {
    href: '/',
    labelKey: 'nav.home',
    icon: <Globe className="w-4 h-4" />,
  },
  {
    href: '/tabular',
    labelKey: 'nav.tabular',
    icon: <LayoutGrid className="w-4 h-4" />,
  },
  {
    href: '/chat',
    labelKey: 'nav.chat',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  {
    href: '/wellbeing',
    labelKey: 'nav.wellbeing',
    icon: <HeartPulse className="w-4 h-4" />,
  },
  {
    href: '/benchmark',
    labelKey: 'nav.benchmark',
    icon: <FlaskConical className="w-4 h-4" />,
    children: [
      { href: '/benchmark', labelKey: 'nav.benchmark' },
      { href: '/benchmark/cases', labelKey: 'nav.benchmark_cases' },
    ],
  },
  {
    href: '/settings',
    labelKey: 'nav.settings',
    icon: <Settings className="w-4 h-4" />,
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const { t, lang, setLang } = useI18n();
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-50 h-16 glass border-b border-warm-200/50 shadow-soft">
      <div className="h-full mx-auto px-8 flex items-center justify-between max-w-screen-2xl">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sage-400 to-sage-600 flex items-center justify-center shadow-glow-sage transition-transform group-hover:scale-110 duration-300">
            <span className="text-white text-[10px] font-black tracking-tighter">ICD</span>
          </div>
          <div>
            <span className="font-black text-slate-900 text-sm tracking-tight leading-none">ICD-11 Explorer</span>
            <br />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Intelligence Engine</span>
          </div>
        </Link>

        {/* Link di navigazione */}
        <div className="hidden md:flex items-center gap-2">
          {NAV_LINKS.map((link) =>
            link.children ? (
              <div
                key={link.href}
                className="relative"
                onMouseEnter={() => setBenchmarkOpen(true)}
                onMouseLeave={() => setBenchmarkOpen(false)}
              >
                <button
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-200',
                    isActive(link.href)
                      ? 'bg-sage-50 text-sage-600'
                      : 'text-slate-500 hover:bg-white hover:text-slate-900'
                  )}
                >
                  {link.icon}
                  {t(link.labelKey as Parameters<typeof t>[0])}
                  <ChevronDown
                    className={clsx('w-3 h-3 transition-transform duration-300', benchmarkOpen && 'rotate-180')}
                  />
                </button>

                {/* Menu dropdown - Glassified */}
                {benchmarkOpen && (
                  <div className="absolute top-full left-0 w-48 glass rounded-3xl shadow-2xl overflow-hidden animate-slide-up p-1.5 border border-white/60">
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={clsx(
                          'block px-4 py-3 text-[11px] font-bold uppercase tracking-wider rounded-2xl transition-all',
                          pathname === child.href
                            ? 'bg-sage-500 text-white shadow-md'
                            : 'text-slate-600 hover:bg-white hover:text-sage-600'
                        )}
                      >
                        {t(child.labelKey as Parameters<typeof t>[0])}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-200',
                  isActive(link.href)
                    ? 'bg-sage-50 text-sage-600'
                    : 'text-slate-500 hover:bg-white hover:text-slate-900'
                )}
              >
                {link.icon}
                {t(link.labelKey as Parameters<typeof t>[0])}
              </Link>
            )
          )}
        </div>

        {/* Selettore lingua */}
        <div className="flex items-center gap-4">
          <div className="flex p-1 rounded-2xl border border-warm-200/50 bg-warm-100/50 backdrop-blur-sm">
            <button
              onClick={() => setLang('en')}
              className={clsx(
                'px-4 py-1.5 text-[10px] font-black tracking-[0.1em] rounded-xl transition-all',
                lang === 'en'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              )}
            >
              EN
            </button>
            <button
              onClick={() => setLang('it')}
              className={clsx(
                'px-4 py-1.5 text-[10px] font-black tracking-[0.1em] rounded-xl transition-all',
                lang === 'it'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              )}
            >
              IT
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
