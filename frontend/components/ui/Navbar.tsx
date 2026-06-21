'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';
import {
  BeakerIcon,
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  CloudIcon,
  ClockIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  HomeIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import LogModal from './LogModal';

const nav = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/tabular', label: 'ICD-11', icon: Squares2X2Icon },
  {
    label: 'Chat',
    icon: ChatBubbleLeftRightIcon,
    items: [
      { href: '/chat', label: 'Local Chat', icon: ChatBubbleLeftRightIcon },
      { href: '/gcp-agents', label: 'GCP Agents', icon: CloudIcon },
    ],
  },
  {
    label: 'Benchmarks',
    icon: BeakerIcon,
    items: [
      { href: '/benchmark', label: 'Dashboard', icon: BeakerIcon },
      { href: '/benchmark/cases', label: 'Case Registry', icon: CircleStackIcon },
    ],
  },
  {
    label: 'Knowledge',
    icon: CircleStackIcon,
    items: [
      { href: '/datastores', label: 'Datastores', icon: CircleStackIcon },
      { href: '/explorer', label: 'Explorer', icon: ChatBubbleLeftRightIcon },
    ],
  },
  { href: '/legacy', label: 'Legacy', icon: ClockIcon },
  { href: '/settings', label: 'Settings', icon: Cog6ToothIcon },
];

export default function Navbar() {
  const pathname = usePathname();
  const { lang, setLang } = useI18n();
  const [openLogs, setOpenLogs] = useState(false);
  const { data: session, status } = useSession();

  const renderLinks = (isMobile: boolean) => {
    return nav.map((item) => {
      const isHome = 'href' in item && item.href === '/';
      if (status !== 'authenticated' && !isHome) {
        return null;
      }

      if ('items' in item && item.items) {
        const isSubActive = item.items.some((sub) => pathname.startsWith(sub.href));
        return (
          <li key={item.label} className={clsx(!isMobile && 'dropdown dropdown-bottom dropdown-hover')}>
            <details className={clsx(isMobile ? 'w-full' : 'w-full')}>
              <summary className={clsx(isSubActive && 'bg-base-200', 'flex items-center gap-2 px-4 py-2 rounded-lg font-medium cursor-pointer select-none')}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </summary>
              <ul className={clsx(
                isMobile ? 'pl-4 mt-1 space-y-1' : 'dropdown-content menu bg-base-100 rounded-box z-[50] w-52 p-2 shadow-lg border border-base-300'
              )}>
                {item.items.map((sub) => {
                  const active = pathname.startsWith(sub.href);
                  return (
                    <li key={sub.href}>
                      <Link
                        href={sub.href}
                        className={clsx(active && 'active', 'px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200')}
                        onClick={(e) => {
                          const details = e.currentTarget.closest('details');
                          if (details) {
                            details.removeAttribute('open');
                          }
                        }}
                      >
                        <sub.icon className="h-4 w-4" />
                        {sub.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        );
      } else if ('href' in item) {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link href={item.href} className={clsx(active && 'active', 'px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200')}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          </li>
        );
      }
      return null;
    });
  };

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-base-300 bg-base-100/95 backdrop-blur-sm transition-all duration-200">
        <div className="navbar mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3">
          <div className="navbar-start gap-3">
            <div className="dropdown lg:hidden">
              <button tabIndex={0} className="btn btn-ghost btn-square" aria-label="Open navigation">
                <span className="text-xl">☰</span>
              </button>
              <ul tabIndex={0} className="menu dropdown-content z-50 mt-3 w-64 rounded-box bg-base-100 p-2 shadow-lg border border-base-200">
                {renderLinks(true)}
              </ul>
            </div>
            <Link href="/" className="btn btn-ghost px-3 text-lg font-semibold hover:bg-transparent">
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 grid-cols-2 gap-0.5 rounded-xl bg-primary p-1.5 shadow-sm">
                  <span className="rounded bg-primary-content" />
                  <span className="rounded bg-primary-content/70" />
                  <span className="rounded bg-primary-content/70" />
                  <span className="rounded bg-primary-content" />
                </span>
                <span className="leading-none text-left">
                  <span className="block text-base font-bold tracking-tight">LLMind2</span>
                  <span className="block text-[9px] font-semibold uppercase tracking-wider text-base-content/50 mt-0.5">Clinical AI Lab</span>
                </span>
              </span>
            </Link>
          </div>
          
          <div className="navbar-center hidden lg:flex">
            <ul className="menu menu-horizontal gap-2 px-1">{renderLinks(false)}</ul>
          </div>
          
          <div className="navbar-end gap-4 flex items-center justify-end">
            <button className="btn btn-ghost btn-square hover:bg-base-200 transition-colors duration-200" onClick={() => setOpenLogs(true)} aria-label="Open logs">
              <CommandLineIcon className="h-5 w-5" />
            </button>
            
            <div className="join mr-1 border border-base-300">
              {(['en', 'it'] as const).map((l) => (
                <button key={l} className={clsx('btn btn-xs join-item font-semibold px-3 py-1', lang === l ? 'btn-primary text-primary-content' : 'bg-base-100 hover:bg-base-200')} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {status === 'authenticated' ? (
              <div className="dropdown dropdown-end flex items-center">
                <label tabIndex={0} className="btn btn-ghost btn-circle avatar placeholder hover:bg-base-200 transition-colors flex items-center justify-center">
                  <div className="bg-neutral text-neutral-content rounded-full w-10 h-10 flex items-center justify-center border-2 border-primary/20 shadow-inner">
                    <span className="text-xs font-bold uppercase">
                      {session.user?.email ? session.user.email.substring(0, 2) : 'US'}
                    </span>
                  </div>
                </label>
                <ul tabIndex={0} className="mt-3 z-[50] p-2 shadow-xl menu menu-sm dropdown-content bg-base-100 rounded-box w-56 border border-base-300">
                  <li className="px-4 py-3 text-xs font-semibold text-base-content/60 truncate">
                    {session.user?.email}
                  </li>
                  <div className="divider my-0"></div>
                  <li>
                    <button onClick={() => signOut()} className="text-red-500 hover:text-red-600 font-medium py-2">
                      Sign Out
                    </button>
                  </li>
                </ul>
              </div>
            ) : (
              <button onClick={() => signIn('authentik')} className="btn btn-primary btn-sm px-4 normal-case shadow-md text-primary-content hover:scale-105 transition-all">
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
      <LogModal isOpen={openLogs} onClose={() => setOpenLogs(false)} />
    </>
  );
}
