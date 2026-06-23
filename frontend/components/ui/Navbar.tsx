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
  UserIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import LogModal from './LogModal';

const nav = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/patients', label: 'Patients', icon: UserIcon },
  {
    label: 'Taxonomies',
    icon: Squares2X2Icon,
    items: [
      { href: '/tabular', label: 'ICD-11 Explorer', icon: Squares2X2Icon },
      { href: '/tabular/dsm5', label: 'DSM-5 Explorer', icon: Squares2X2Icon },
    ],
  },
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
          
          <div className="navbar-end flex items-center justify-end">
            <div className="dropdown dropdown-bottom dropdown-end flex items-center">
              <label tabIndex={0} className="btn btn-ghost btn-circle avatar placeholder hover:bg-base-200 transition-colors flex items-center justify-center">
                {status === 'authenticated' ? (
                  <div className="bg-neutral text-neutral-content rounded-full w-10 h-10 flex items-center justify-center border-2 border-primary/20 shadow-inner">
                    <span className="text-xs font-bold uppercase">
                      {session.user?.email ? session.user.email.substring(0, 2) : 'US'}
                    </span>
                  </div>
                ) : (
                  <div className="bg-neutral text-neutral-content rounded-full w-10 h-10 flex items-center justify-center border border-base-300 shadow-inner">
                    <UserIcon className="h-5 w-5 text-neutral-content" />
                  </div>
                )}
              </label>
              
              <ul tabIndex={0} className="mt-3 z-[50] p-2.5 shadow-xl menu menu-sm dropdown-content bg-base-100 rounded-box w-64 border border-base-300">
                {status === 'authenticated' ? (
                  <>
                    <li className="px-4 py-3 text-xs font-semibold text-base-content/60 truncate">
                      {session.user?.email}
                    </li>
                    <div className="divider my-0.5"></div>
                    
                    {/* Settings Link */}
                    <li>
                      <Link href="/settings" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-base-content hover:bg-base-200 font-semibold rounded-lg">
                        <Cog6ToothIcon className="h-4.5 w-4.5 text-base-content/75" />
                        Settings
                      </Link>
                    </li>
                  </>
                ) : null}

                {/* Terminal / Logs Button */}
                <li>
                  <button 
                    onClick={() => setOpenLogs(true)} 
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-base-content hover:bg-base-200 font-semibold rounded-lg w-full text-left"
                  >
                    <CommandLineIcon className="h-4.5 w-4.5 text-base-content/75" />
                    Terminal / Logs
                  </button>
                </li>

                {/* Language Selector */}
                <div className="px-4 py-2 border-t border-b border-base-200 my-1 bg-base-200/30 rounded-lg">
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="text-xs font-bold uppercase text-base-content/65">Language</span>
                    <div className="join border border-base-300 shadow-sm">
                      {(['en', 'it'] as const).map((l) => (
                        <button 
                          key={l} 
                          className={clsx(
                            'btn btn-xs join-item font-semibold px-3 py-1', 
                            lang === l ? 'btn-primary text-primary-content' : 'bg-base-100 hover:bg-base-200'
                          )} 
                          onClick={() => setLang(l)}
                        >
                          {l.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {status === 'authenticated' ? (
                  <>
                    <div className="divider my-0.5"></div>
                    <li>
                      <button 
                        onClick={() => signOut()} 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 font-semibold py-2 px-4 flex items-center gap-2.5 rounded-lg w-full text-left"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4.5 h-4.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                        </svg>
                        Sign Out
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <div className="divider my-0.5"></div>
                    <li>
                      <button 
                        onClick={() => signIn('authentik')} 
                        className="text-primary hover:bg-primary/5 font-semibold py-2 px-4 flex items-center gap-2.5 rounded-lg w-full text-left"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4.5 h-4.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                        Sign In
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <LogModal isOpen={openLogs} onClose={() => setOpenLogs(false)} />
    </>
  );
}
