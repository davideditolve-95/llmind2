'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { icd11Api, type IcdTableRow, type PaginatedResponse } from '@/lib/api';
import MarkdownContent from '@/components/ui/MarkdownContent';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  PlusCircleIcon,
  MinusCircleIcon,
  ArrowsRightLeftIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const PAGE_SIZE = 50;

export default function TabularPage() {
  return (
    <Suspense fallback={<div className="app-page"><span className="loading loading-spinner loading-lg" /></div>}>
      <TabularContent />
    </Suspense>
  );
}

function TabularContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaginatedResponse<IcdTableRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState<number | undefined>(0);
  const [parentId, setParentId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; title: string }[]>([]);
  const [selectedRow, setSelectedRow] = useState<IcdTableRow | null>(null);
  const [searchType, setSearchType] = useState<'standard' | 'symptoms' | 'all'>('standard');

  useEffect(() => {
    const initialId = searchParams.get('id');
    const initialSearch = searchParams.get('search');
    const initialType = searchParams.get('search_type');
    if (initialSearch) {
      setSearch(initialSearch);
      setDebouncedSearch(initialSearch);
    }
    if (initialType === 'standard' || initialType === 'symptoms' || initialType === 'all') {
      setSearchType(initialType);
    }
    if (initialId) icd11Api.getCode(initialId).then(setSelectedRow).catch(() => {});
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await icd11Api.getCodes({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        level: (debouncedSearch || parentId) ? undefined : level,
        parent_id: parentId || undefined,
        search_type: searchType,
      }));
    } catch {
      setError('Unable to load ICD-11 records.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, level, page, parentId, searchType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const navigateDown = (row: IcdTableRow) => {
    setParentId(row.id);
    setBreadcrumbs((prev) => [...prev, { id: row.id, title: row.title_en }]);
    setPage(1);
    setSearch('');
  };

  const breadcrumbTo = (index: number) => {
    if (index < 0) {
      setParentId(null);
      setBreadcrumbs([]);
    } else {
      const next = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(next);
      setParentId(next[next.length - 1]?.id || null);
    }
    setPage(1);
  };

  return (
    <div className="app-page space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Squares2X2Icon className="h-7 w-7 text-primary" />
            <h1 className="app-title">ICD-11 Browser</h1>
          </div>
          <p className="app-subtitle mt-2">Search, filter, and inspect ICD-11 taxonomy records.</p>
        </div>
        <div className="join">
          <button className="btn join-item" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button className="btn join-item no-animation">Page {data?.page || page} / {data?.total_pages || 1}</button>
          <button className="btn join-item" disabled={!data || page >= data.total_pages || loading} onClick={() => setPage((p) => p + 1)}>
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_15rem_10rem]">
            <label className="input input-bordered flex items-center gap-2 w-full col-span-1 sm:col-span-2 lg:col-span-1">
              <MagnifyingGlassIcon className="h-4 w-4 opacity-60" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="grow" placeholder={searchType === 'symptoms' ? "Search symptoms (e.g., anxiety, delusions, panic)" : "Search code, title, or term"} />
            </label>
            <select className="select select-bordered" value={searchType} onChange={(e) => {
              setSearchType(e.target.value as 'standard' | 'symptoms' | 'all');
              setPage(1);
            }}>
              <option value="standard">🔍 Code & Title</option>
              <option value="symptoms">🩺 Symptoms & Criteria</option>
              <option value="all">🌐 Search All Fields</option>
            </select>
            <select className="select select-bordered" value={level ?? 'all'} onChange={(e) => {
              setLevel(e.target.value === 'all' ? undefined : Number(e.target.value));
              setParentId(null);
              setBreadcrumbs([]);
              setPage(1);
            }}>
              <option value="all">All levels</option>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}
            </select>
          </div>
          <div className="breadcrumbs overflow-x-auto text-sm">
            <ul>
              <li><button onClick={() => breadcrumbTo(-1)}>Root</button></li>
              {breadcrumbs.map((b, index) => <li key={b.id}><button onClick={() => breadcrumbTo(index)}>{b.title}</button></li>)}
            </ul>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card bg-base-100 shadow-sm">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th className="w-24">Code</th>
                <th>Title</th>
                <th className="hidden sm:table-cell text-center w-36">Features</th>
                <th className="hidden md:table-cell text-center w-24">Children</th>
                <th className="text-right w-44">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><span className="loading loading-spinner loading-lg" /></td></tr>
              ) : data?.items.length ? data.items.map((row) => (
                <tr key={row.id}>
                  <td className="align-middle"><span className="badge badge-outline font-mono text-xs">{row.code || 'No code'}</span></td>
                  <td className="align-middle">
                    <div className="font-medium text-sm sm:text-base">{row.title_en}</div>
                    <div className="line-clamp-1 max-w-xs sm:max-w-md md:max-w-lg text-xs text-base-content/60">{row.description || 'No description available'}</div>
                    {/* Responsive feature tags for mobile view only */}
                    <div className="flex flex-wrap gap-1 mt-1.5 sm:hidden">
                      {row.inclusions?.length ? <span className="badge badge-success badge-xs font-semibold py-1">Inclusions</span> : null}
                      {row.exclusions?.length ? <span className="badge badge-error badge-xs font-semibold py-1">Exclusions</span> : null}
                      {row.differential_diagnoses?.length ? <span className="badge badge-info badge-xs font-semibold py-1">Comorbidities</span> : null}
                      {row.diagnostic_criteria ? <span className="badge badge-primary badge-xs font-semibold py-1">Criteria</span> : null}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell align-middle">
                    <div className="flex justify-center gap-1.5">
                      <div className={`tooltip ${row.inclusions?.length ? 'text-success' : 'text-base-content/15'}`} data-tip={row.inclusions?.length ? `Inclusions (${row.inclusions.length})` : 'No inclusions'}>
                        <PlusCircleIcon className="h-5 w-5" />
                      </div>
                      <div className={`tooltip ${row.exclusions?.length ? 'text-error' : 'text-base-content/15'}`} data-tip={row.exclusions?.length ? `Exclusions (${row.exclusions.length})` : 'No exclusions'}>
                        <MinusCircleIcon className="h-5 w-5" />
                      </div>
                      <div className={`tooltip ${row.differential_diagnoses?.length ? 'text-info' : 'text-base-content/15'}`} data-tip={row.differential_diagnoses?.length ? `Comorbidities / Diff Diagnosis (${row.differential_diagnoses.length})` : 'No comorbidities'}>
                        <ArrowsRightLeftIcon className="h-5 w-5" />
                      </div>
                      <div className={`tooltip ${row.diagnostic_criteria ? 'text-primary' : 'text-base-content/15'}`} data-tip={row.diagnostic_criteria ? 'Diagnostic Criteria available' : 'No diagnostic criteria'}>
                        <DocumentTextIcon className="h-5 w-5" />
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell text-center align-middle font-mono text-sm">{row.children_count}</td>
                  <td className="text-right align-middle">
                    <div className="join">
                      <button className="btn btn-sm join-item btn-ghost sm:btn-active" onClick={() => setSelectedRow(row)}>
                        <EyeIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Details</span>
                      </button>
                      <button className="btn btn-sm join-item" disabled={!row.has_children} onClick={() => navigateDown(row)}>
                        Open
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="py-12 text-center text-base-content/60">No ICD-11 records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRow && <CodeModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  );
}

function CodeModal({ row, onClose }: { row: IcdTableRow; onClose: () => void }) {
  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-5xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="badge badge-primary">{row.code || `Level ${row.level}`}</div>
            <h2 className="mt-3 text-2xl font-semibold">{row.title_en}</h2>
            {row.title_it && <p className="text-sm text-base-content/60">{row.title_it}</p>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="divider" />
        <div className="space-y-5">
          <section>
            <h3 className="font-semibold">Description</h3>
            <p className="mt-2 text-sm leading-6 text-base-content/75">{row.description || 'No description available.'}</p>
          </section>
          {row.diagnostic_criteria && (
            <section>
              <h3 className="font-semibold">Diagnostic criteria</h3>
              <div className="mt-2 rounded-box bg-base-200 p-4">
                <MarkdownContent content={row.diagnostic_criteria.replace(/^!markdown\s*/m, '').trim()} />
              </div>
            </section>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <TagList title="Inclusions" values={row.inclusions} badge="badge-success" />
            <TagList title="Exclusions" values={row.exclusions} badge="badge-error" />
            <TagList title="Index terms" values={row.index_terms} badge="badge-neutral" />
            <TagList title="Differential diagnoses" values={row.differential_diagnoses} badge="badge-info" />
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

function TagList({ title, values, badge }: { title: string; values?: string[] | null; badge: string }) {
  if (!values?.length) return null;
  return (
    <section>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {values.map((value, index) => <span key={`${value}-${index}`} className={`badge ${badge} badge-outline`}>{value}</span>)}
      </div>
    </section>
  );
}
