'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { signIn, signOut, useSession } from 'next-auth/react';
import { type ComponentType, type MouseEvent, type SVGProps, useState } from 'react';
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

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavLink = {
  href: string;
  label: string;
  icon: NavIcon;
};

type NavGroup = {
  label: string;
  icon: NavIcon;
  items: NavLink[];
};

type NavItem = NavLink | NavGroup;

const nav: NavItem[] = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/patients', label: 'Patients', icon: UserIcon },
  {
    label: 'Clinical Knowledge',
    icon: Squares2X2Icon,
    items: [
      { href: '/tabular', label: 'ICD-11 Explorer', icon: Squares2X2Icon },
      { href: '/tabular/dsm5', label: 'DSM-5 Explorer', icon: Squares2X2Icon },
      { href: '/datastores', label: 'Local Vector Stores', icon: CircleStackIcon },
    ],
  },
  {
    label: 'Clinical Chat',
    icon: ChatBubbleLeftRightIcon,
    items: [{ href: '/chat', label: 'Model Interaction', icon: ChatBubbleLeftRightIcon }],
  },
  {
    label: 'Benchmark Lab',
    icon: BeakerIcon,
    items: [
      { href: '/benchmark', label: 'Model Evaluation', icon: BeakerIcon },
      { href: '/benchmark/cases', label: 'DSM-5 Clinical Cases', icon: CircleStackIcon },
    ],
  },
  {
    label: 'Experimental',
    icon: CloudIcon,
    items: [
      { href: '/gcp-agents', label: 'Conversational Agents', icon: CloudIcon },
      { href: '/drugs', label: 'AIFA Drug Knowledge', icon: BeakerIcon },
    ],
  },
  {
    label: 'Legacy',
    icon: ClockIcon,
    items: [
      { href: '/legacy', label: 'Legacy RAG Console', icon: ClockIcon },
      { href: '/explorer', label: 'Legacy Vector Explorer', icon: ChatBubbleLeftRightIcon },
    ],
  },
];

function isGroup(item: NavItem): item is NavGroup {
  return 'items' in item;
}

function isActiveLink(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function closeParentDetails(event: MouseEvent<HTMLAnchorElement>) {
  event.currentTarget.closest('details')?.removeAttribute('open');
}

export default function Navbar() {
  const pathname = usePathname();
  const { lang, setLang } = useI18n();
  const [openLogs, setOpenLogs] = useState(false);
  const { data: session, status } = useSession();
  const visibleNav = status === 'authenticated' ? nav : nav.filter((item) => !isGroup(item) && item.href === '/');

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-base-300 bg-base-100/95 backdrop-blur-sm transition-all duration-200">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-3">
            <MobileMenu items={visibleNav} pathname={pathname} />
            <Logo />
          </div>

          <nav className="hidden min-w-0 flex-1 justify-center lg:flex" aria-label="Primary navigation">
            <ul className="menu menu-horizontal flex-nowrap items-center gap-1 px-1">
              {visibleNav.map((item) => (
                <DesktopNavItem key={item.label} item={item} pathname={pathname} />
              ))}
            </ul>
          </nav>

          <UserMenu
            email={session?.user?.email}
            isAuthenticated={status === 'authenticated'}
            lang={lang}
            onLanguageChange={setLang}
            onOpenLogs={() => setOpenLogs(true)}
          />
        </div>
      </div>
      <LogModal isOpen={openLogs} onClose={() => setOpenLogs(false)} />
    </>
  );
}

function Logo() {
  return (
    <Link href="/" className="btn btn-ghost px-2 text-lg font-semibold hover:bg-transparent sm:px-3">
      <span className="flex items-center gap-3">
        <span className="grid h-10 w-10 grid-cols-2 gap-0.5 rounded-xl bg-primary p-1.5 shadow-sm">
          <span className="rounded bg-primary-content" />
          <span className="rounded bg-primary-content/70" />
          <span className="rounded bg-primary-content/70" />
          <span className="rounded bg-primary-content" />
        </span>
        <span className="hidden leading-none text-left sm:block">
          <span className="block text-base font-bold tracking-tight">LLMind2</span>
          <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wider text-base-content/50">
            Clinical AI Lab
          </span>
        </span>
      </span>
    </Link>
  );
}

function MobileMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <div className="dropdown lg:hidden">
      <button tabIndex={0} className="btn btn-ghost btn-square" aria-label="Open navigation">
        <span className="text-xl">☰</span>
      </button>
      <ul
        tabIndex={0}
        className="menu dropdown-content z-50 mt-3 w-72 rounded-box border border-base-200 bg-base-100 p-2 shadow-lg"
      >
        {items.map((item) => (
          <MobileNavItem key={item.label} item={item} pathname={pathname} />
        ))}
      </ul>
    </div>
  );
}

function DesktopNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  if (isGroup(item)) {
    return <DesktopNavGroup group={item} pathname={pathname} />;
  }

  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        className={clsx(
          isActiveLink(pathname, item.href) && 'active',
          'flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold leading-none transition-all duration-200'
        )}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    </li>
  );
}

function DesktopNavGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const Icon = group.icon;
  const active = group.items.some((item) => isActiveLink(pathname, item.href));

  return (
    <li className="dropdown dropdown-bottom dropdown-hover">
      <details className="w-full">
        <summary
          className={clsx(
            active && 'bg-base-200',
            'nav-summary flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold leading-none lg:justify-center'
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="whitespace-nowrap">{group.label}</span>
        </summary>
        <ul className="dropdown-content menu z-[50] mt-2 w-72 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
          {group.items.map((item) => (
            <SubLink key={item.href} item={item} pathname={pathname} />
          ))}
        </ul>
      </details>
    </li>
  );
}

function MobileNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  if (!isGroup(item)) {
    return <SubLink item={item} pathname={pathname} />;
  }

  const Icon = item.icon;
  const active = item.items.some((subItem) => isActiveLink(pathname, subItem.href));

  return (
    <li>
      <details className="w-full">
        <summary
          className={clsx(
            active && 'bg-base-200',
            'nav-summary flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold'
          )}
        >
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
        </summary>
        <ul className="mt-1 space-y-1 pl-4">
          {item.items.map((subItem) => (
            <SubLink key={subItem.href} item={subItem} pathname={pathname} />
          ))}
        </ul>
      </details>
    </li>
  );
}

function SubLink({ item, pathname }: { item: NavLink; pathname: string }) {
  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        className={clsx(
          isActiveLink(pathname, item.href) && 'active',
          'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200'
        )}
        onClick={closeParentDetails}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    </li>
  );
}

function UserMenu({
  email,
  isAuthenticated,
  lang,
  onLanguageChange,
  onOpenLogs,
}: {
  email?: string | null;
  isAuthenticated: boolean;
  lang: 'en' | 'it';
  onLanguageChange: (lang: 'en' | 'it') => void;
  onOpenLogs: () => void;
}) {
  const initials = email ? email.substring(0, 2).toUpperCase() : 'US';

  return (
    <div className="ml-auto flex shrink-0 items-center justify-end">
      <div className="dropdown dropdown-bottom dropdown-end flex items-center">
        <label
          tabIndex={0}
          className="btn btn-ghost btn-circle avatar placeholder flex items-center justify-center transition-colors hover:bg-base-200"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-base-300 bg-neutral text-neutral-content shadow-inner">
            {isAuthenticated ? <span className="text-xs font-bold">{initials}</span> : <UserIcon className="h-5 w-5" />}
          </div>
        </label>

        <ul
          tabIndex={0}
          className="menu dropdown-content z-[50] mt-3 w-64 rounded-box border border-base-300 bg-base-100 p-2.5 shadow-xl"
        >
          {isAuthenticated ? <AuthenticatedMenu email={email} /> : null}
          <UtilityMenu lang={lang} onLanguageChange={onLanguageChange} onOpenLogs={onOpenLogs} />
          {isAuthenticated ? <SignOutItem /> : <SignInItem />}
        </ul>
      </div>
    </div>
  );
}

function AuthenticatedMenu({ email }: { email?: string | null }) {
  return (
    <>
      <li className="truncate px-4 py-3 text-xs font-semibold text-base-content/60">{email}</li>
      <div className="divider my-0.5" />
      <li>
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-base-content hover:bg-base-200"
        >
          <Cog6ToothIcon className="h-4.5 w-4.5 text-base-content/75" />
          Settings
        </Link>
      </li>
    </>
  );
}

function UtilityMenu({
  lang,
  onLanguageChange,
  onOpenLogs,
}: {
  lang: 'en' | 'it';
  onLanguageChange: (lang: 'en' | 'it') => void;
  onOpenLogs: () => void;
}) {
  return (
    <>
      <li>
        <button
          onClick={onOpenLogs}
          className="flex w-full items-center gap-2.5 rounded-lg px-4 py-2.5 text-left text-sm font-semibold text-base-content hover:bg-base-200"
        >
          <CommandLineIcon className="h-4.5 w-4.5 text-base-content/75" />
          Terminal / Logs
        </button>
      </li>
      <div className="my-1 rounded-lg border-y border-base-200 bg-base-200/30 px-4 py-2">
        <div className="flex items-center justify-between gap-2.5">
          <span className="text-xs font-bold uppercase text-base-content/65">Language</span>
          <div className="join border border-base-300 shadow-sm">
            {(['en', 'it'] as const).map((code) => (
              <button
                key={code}
                className={clsx(
                  'btn btn-xs join-item px-3 py-1 font-semibold',
                  lang === code ? 'btn-primary text-primary-content' : 'bg-base-100 hover:bg-base-200'
                )}
                onClick={() => onLanguageChange(code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function SignOutItem() {
  return (
    <>
      <div className="divider my-0.5" />
      <li>
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-2.5 rounded-lg px-4 py-2 text-left font-semibold text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <SignIcon />
          Sign Out
        </button>
      </li>
    </>
  );
}

function SignInItem() {
  return (
    <>
      <div className="divider my-0.5" />
      <li>
        <button
          onClick={() => signIn('keycloak')}
          className="flex w-full items-center gap-2.5 rounded-lg px-4 py-2 text-left font-semibold text-primary hover:bg-primary/5"
        >
          <SignIcon />
          Sign In
        </button>
      </li>
    </>
  );
}

function SignIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      className="h-4.5 w-4.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
      />
    </svg>
  );
}
