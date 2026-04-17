'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import {
  HomeIcon,
  Squares2X2Icon,
  ChatBubbleLeftRightIcon,
  BeakerIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ClockIcon,
  CommandLineIcon,
  BookOpenIcon,
  InboxStackIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useState, useRef, useEffect } from 'react';
import LogModal from './LogModal';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  children?: { href: string; label: string }[];
}

const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: HomeIcon, iconColor: 'text-slate-500' },
  { href: '/tabular', label: 'ICD-11', icon: Squares2X2Icon, iconColor: 'text-indigo-500' },
  { href: '/chat', label: 'AI Chat', icon: ChatBubbleLeftRightIcon, iconColor: 'text-cyan-500' },
  { 
    href: '/benchmark', 
    label: 'Benchmark', 
    icon: BeakerIcon, 
    iconColor: 'text-emerald-500', 
    children: [
      { href: '/benchmark', label: 'Analytics' },
      { href: '/benchmark/cases', label: 'Cases' },
    ] 
  },
  { 
    href: '/legacy', 
    label: 'Legacy v1', 
    icon: ClockIcon, 
    iconColor: 'text-amber-500',
    children: [
      { href: '/legacy', label: 'Explorer Console' },
      { href: '/datastores', label: 'Knowledge Build' },
      { href: '/explorer', label: 'Custom Search' },
    ]
  },
  { href: '/settings', label: 'Settings', icon: Cog6ToothIcon, iconColor: 'text-slate-500' },
];

function DesktopDropdown({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] transition-all border',
          isActive
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 border-transparent'
        )}
      >
        <item.icon className={clsx('w-4 h-4', item.iconColor)} />
        {item.label}
        <ChevronDownIcon className={clsx('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-52 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/80 z-[200] py-2 animate-slide-up">
          {item.children!.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center px-5 py-3 text-sm font-bold transition-colors',
                pathname === child.href
                  ? 'text-indigo-700 bg-indigo-50'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { t, lang, setLang } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <nav className="sticky top-0 z-[100] bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white font-black text-[9px] shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            ICD
          </div>
          <div className="hidden sm:block">
            <span className="font-black text-xl tracking-tight text-slate-900 group-hover:text-indigo-700 transition-colors">LLMind2</span>
            <span className="block text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 leading-none">Clinical AI</span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV.map((item) => {
            if (item.children) {
              return <DesktopDropdown key={item.href} item={item} isActive={isActive(item.href)} />;
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-[0.15em] transition-all border',
                  isActive(item.href)
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800 border-transparent'
                )}
              >
                <item.icon className={clsx('w-4 h-4', isActive(item.href) ? 'text-indigo-600' : item.iconColor)} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right side — Language + Log + Mobile toggle */}
        <div className="flex items-center gap-3">
          {/* Log Monitor Toggle */}
          <button 
            onClick={() => setIsLogOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200 group"
            title="System Logs"
          >
            <CommandLineIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>

          {/* Language switcher */}
          <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
            {(['en', 'it'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all',
                  lang === l
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                    : 'text-slate-400 hover:text-slate-600'
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </div>

      <LogModal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} />

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 px-6 py-4 space-y-1 animate-slide-up">
          {NAV.map((item) => (
            item.children ? (
              <div key={item.href}>
                <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
                <div className="pl-6 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setMobileOpen(false)}
                      className={clsx(
                        'block px-3 py-2.5 rounded-xl text-sm font-bold transition-colors',
                        pathname === child.href ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors',
                  isActive(item.href) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <item.icon className={clsx('w-5 h-5', isActive(item.href) ? 'text-indigo-600' : item.iconColor)} />
                {item.label}
              </Link>
            )
          ))}
        </div>
      )}
    </nav>
  );
}
