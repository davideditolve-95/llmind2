'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { icd11Api, dsm5Api, drugsApi, type IcdTableRow, type PaginatedResponse, type DSM5CategoryCompare, type AIFADrug } from '@/lib/api';
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
  BeakerIcon,
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

  // Advanced Filters State
  const [chapters, setChapters] = useState<{ id: string; code: string; title: string }[]>([]);
  const [chapterId, setChapterId] = useState<string>('');
  const [hasCriteria, setHasCriteria] = useState<boolean | undefined>(undefined);
  const [hasInclusions, setHasInclusions] = useState<boolean | undefined>(undefined);
  const [hasExclusions, setHasExclusions] = useState<boolean | undefined>(undefined);
  const [hasDifferential, setHasDifferential] = useState<boolean | undefined>(undefined);
  const [hasItalian, setHasItalian] = useState<boolean | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    icd11Api.getChapters()
      .then(setChapters)
      .catch((err) => console.error("Error loading chapters:", err));
  }, []);

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
        level: (debouncedSearch || parentId || chapterId) ? undefined : level,
        parent_id: parentId || undefined,
        search_type: searchType,
        chapter_id: chapterId || undefined,
        has_criteria: hasCriteria,
        has_inclusions: hasInclusions,
        has_exclusions: hasExclusions,
        has_differential: hasDifferential,
        has_italian: hasItalian,
      }));
    } catch {
      setError('Unable to load ICD-11 records.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, level, page, parentId, searchType, chapterId, hasCriteria, hasInclusions, hasExclusions, hasDifferential, hasItalian]);

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

  const getActiveFiltersCount = () => {
    let count = 0;
    if (chapterId) count++;
    if (hasCriteria !== undefined) count++;
    if (hasInclusions !== undefined) count++;
    if (hasExclusions !== undefined) count++;
    if (hasDifferential !== undefined) count++;
    if (hasItalian !== undefined) count++;
    return count;
  };

  const resetAllFilters = () => {
    setChapterId('');
    setHasCriteria(undefined);
    setHasInclusions(undefined);
    setHasExclusions(undefined);
    setHasDifferential(undefined);
    setHasItalian(undefined);
    setSearch('');
    setLevel(0);
    setParentId(null);
    setBreadcrumbs([]);
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

      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body gap-4 p-5 sm:p-6">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_15rem_10rem]">
            <label className="input input-bordered flex items-center gap-2 w-full col-span-1 sm:col-span-2 lg:col-span-1">
              <MagnifyingGlassIcon className="h-4 w-4 opacity-70 text-base-content" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="grow text-base-content font-medium" placeholder={searchType === 'symptoms' ? "Search symptoms (e.g., anxiety, delusions, panic)" : "Search code, title, or term"} />
            </label>
            <select className="select select-bordered text-base-content font-medium bg-base-100" value={searchType} onChange={(e) => {
              setSearchType(e.target.value as 'standard' | 'symptoms' | 'all');
              setPage(1);
            }}>
              <option value="standard">🔍 Code & Title</option>
              <option value="symptoms">🩺 Symptoms & Criteria</option>
              <option value="all">🌐 Search All Fields</option>
            </select>
            <select className="select select-bordered text-base-content font-medium bg-base-100" value={level ?? 'all'} onChange={(e) => {
              setLevel(e.target.value === 'all' ? undefined : Number(e.target.value));
              setParentId(null);
              setBreadcrumbs([]);
              setPage(1);
            }}>
              <option value="all">All levels</option>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}
            </select>
          </div>

          {/* Advanced Filters Toggle & Reset Button */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-base-200">
            <button 
              type="button" 
              className={`btn btn-sm btn-ghost gap-1.5 font-semibold text-base-content hover:bg-base-200 ${showAdvanced ? 'btn-active bg-base-200' : ''}`}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.0} stroke="currentColor" className="w-4 h-4 text-primary">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
              {showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
              {getActiveFiltersCount() > 0 && (
                <span className="badge badge-primary badge-sm ml-1 text-primary-content">{getActiveFiltersCount()}</span>
              )}
            </button>

            {getActiveFiltersCount() > 0 && (
              <button 
                type="button" 
                className="btn btn-xs btn-outline btn-error font-bold"
                onClick={resetAllFilters}
              >
                Reset All Filters
              </button>
            )}
          </div>

          {/* Collapsible Advanced Filters Section */}
          {showAdvanced && (
            <div className="grid gap-4 mt-2 p-5 rounded-box bg-base-200 border border-base-300 shadow-inner grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {/* Chapter Filter */}
              <div className="form-control w-full">
                <span className="label-text font-bold text-base-content text-sm mb-1.5">Filter by Chapter</span>
                <select 
                  className="select select-bordered select-sm w-full bg-base-100 text-base-content font-medium" 
                  value={chapterId} 
                  onChange={(e) => {
                    setChapterId(e.target.value);
                    setParentId(null);
                    setBreadcrumbs([]);
                    setPage(1);
                  }}
                >
                  <option value="">All Chapters</option>
                  {chapters.map((chap) => (
                    <option key={chap.id} value={chap.id}>
                      {chap.code ? `${chap.code} - ` : ''}{chap.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggles for clinical features */}
              <div className="col-span-1 md:col-span-2 lg:col-span-2 grid gap-x-6 gap-y-2 grid-cols-1 sm:grid-cols-2">
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-2.5 py-1.5">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-primary checkbox-sm border-base-content/65 bg-base-100"
                      checked={hasCriteria === true}
                      onChange={(e) => {
                        setHasCriteria(e.target.checked ? true : undefined);
                        setPage(1);
                      }} 
                    />
                    <span className="label-text font-semibold text-base-content text-sm">Diagnostic Criteria available</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-2.5 py-1.5">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-primary checkbox-sm border-base-content/65 bg-base-100"
                      checked={hasInclusions === true}
                      onChange={(e) => {
                        setHasInclusions(e.target.checked ? true : undefined);
                        setPage(1);
                      }} 
                    />
                    <span className="label-text font-semibold text-base-content text-sm">Inclusions available</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-2.5 py-1.5">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-primary checkbox-sm border-base-content/65 bg-base-100"
                      checked={hasExclusions === true}
                      onChange={(e) => {
                        setHasExclusions(e.target.checked ? true : undefined);
                        setPage(1);
                      }} 
                    />
                    <span className="label-text font-semibold text-base-content text-sm">Exclusions available</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-2.5 py-1.5">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-primary checkbox-sm border-base-content/65 bg-base-100"
                      checked={hasDifferential === true}
                      onChange={(e) => {
                        setHasDifferential(e.target.checked ? true : undefined);
                        setPage(1);
                      }} 
                    />
                    <span className="label-text font-semibold text-base-content text-sm">Differential Diagnoses available</span>
                  </label>
                </div>

                <div className="form-control col-span-1 sm:col-span-2">
                  <label className="label cursor-pointer justify-start gap-2.5 py-1.5">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-primary checkbox-sm border-base-content/65 bg-base-100"
                      checked={hasItalian === true}
                      onChange={(e) => {
                        setHasItalian(e.target.checked ? true : undefined);
                        setPage(1);
                      }} 
                    />
                    <span className="label-text font-semibold text-base-content text-sm">Italian Translation available</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="breadcrumbs overflow-x-auto text-sm font-semibold text-primary/95 mt-1">
            <ul>
              <li><button className="hover:underline" onClick={() => breadcrumbTo(-1)}>Root</button></li>
              {breadcrumbs.map((b, index) => <li key={b.id}><button className="hover:underline text-base-content/90" onClick={() => breadcrumbTo(index)}>{b.title}</button></li>)}
            </ul>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="border-b border-base-200">
                <th className="w-24 text-base-content font-bold text-sm">Code</th>
                <th className="text-base-content font-bold text-sm">Title</th>
                <th className="hidden sm:table-cell text-center w-36 text-base-content font-bold text-sm">Features</th>
                <th className="hidden md:table-cell text-center w-24 text-base-content font-bold text-sm">Children</th>
                <th className="text-right w-44 text-base-content font-bold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><span className="loading loading-spinner loading-lg" /></td></tr>
              ) : data?.items.length ? data.items.map((row) => (
                <tr key={row.id}>
                  <td className="align-middle">
                    <span className="badge badge-neutral bg-base-300 text-base-content border-none font-mono text-xs font-bold py-2.5 px-2">
                      {row.code || 'No code'}
                    </span>
                  </td>
                  <td className="align-middle">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm sm:text-base text-base-content">{row.title_en}</span>
                      {row.dsm5_analogy_code && (
                        <span className="badge badge-sm border border-purple-300 text-purple-700 bg-purple-50/50 font-mono font-bold px-1.5 py-0.5 rounded">
                          DSM-5: {row.dsm5_analogy_code}
                        </span>
                      )}
                    </div>
                    <div className="line-clamp-1 max-w-xs sm:max-w-md md:max-w-lg text-xs text-base-content/85 font-medium mt-0.5">
                      {row.description || 'No description available'}
                    </div>
                    {/* Responsive feature tags for mobile view only */}
                    <div className="flex flex-wrap gap-1 mt-1.5 sm:hidden">
                      {row.inclusions?.length ? <span className="badge badge-success bg-success/15 text-success border-none badge-xs font-bold py-1">Inclusions</span> : null}
                      {row.exclusions?.length ? <span className="badge badge-error bg-error/15 text-error border-none badge-xs font-bold py-1">Exclusions</span> : null}
                      {row.differential_diagnoses?.length ? <span className="badge badge-info bg-info/15 text-info border-none badge-xs font-bold py-1">Comorbidities</span> : null}
                      {row.diagnostic_criteria ? <span className="badge badge-primary bg-primary/15 text-primary border-none badge-xs font-bold py-1">Criteria</span> : null}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell align-middle">
                    <div className="flex justify-center gap-2">
                      <div className={`tooltip ${row.inclusions?.length ? 'text-emerald-600 scale-110 font-bold' : 'text-base-content/30'}`} data-tip={row.inclusions?.length ? `Inclusions (${row.inclusions.length})` : 'No inclusions'}>
                        <PlusCircleIcon className="h-5.5 w-5.5" strokeWidth={row.inclusions?.length ? 2.5 : 1.5} />
                      </div>
                      <div className={`tooltip ${row.exclusions?.length ? 'text-rose-600 scale-110 font-bold' : 'text-base-content/30'}`} data-tip={row.exclusions?.length ? `Exclusions (${row.exclusions.length})` : 'No exclusions'}>
                        <MinusCircleIcon className="h-5.5 w-5.5" strokeWidth={row.exclusions?.length ? 2.5 : 1.5} />
                      </div>
                      <div className={`tooltip ${row.differential_diagnoses?.length ? 'text-sky-600 scale-110 font-bold' : 'text-base-content/30'}`} data-tip={row.differential_diagnoses?.length ? `Comorbidities / Diff Diagnosis (${row.differential_diagnoses.length})` : 'No comorbidities'}>
                        <ArrowsRightLeftIcon className="h-5.5 w-5.5" strokeWidth={row.differential_diagnoses?.length ? 2.5 : 1.5} />
                      </div>
                      <div className={`tooltip ${row.diagnostic_criteria ? 'text-primary scale-110 font-bold' : 'text-base-content/30'}`} data-tip={row.diagnostic_criteria ? 'Diagnostic Criteria available' : 'No diagnostic criteria'}>
                        <DocumentTextIcon className="h-5.5 w-5.5" strokeWidth={row.diagnostic_criteria ? 2.5 : 1.5} />
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell text-center align-middle font-mono font-bold text-sm text-base-content">{row.children_count}</td>
                  <td className="text-right align-middle">
                    <div className="join">
                      <button className="btn btn-sm join-item btn-ghost sm:btn-active font-semibold text-base-content hover:bg-base-200" onClick={() => setSelectedRow(row)}>
                        <EyeIcon className="h-4 w-4 text-primary" />
                        <span className="hidden sm:inline">Details</span>
                      </button>
                      <button className="btn btn-sm join-item font-semibold text-base-content" disabled={!row.has_children} onClick={() => navigateDown(row)}>
                        Open
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="py-12 text-center text-base-content font-semibold">No ICD-11 records found.</td></tr>
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
  const [comparisonData, setComparisonData] = useState<DSM5CategoryCompare | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  
  const [associatedDrugs, setAssociatedDrugs] = useState<AIFADrug[]>([]);
  const [loadingDrugs, setLoadingDrugs] = useState(false);

  useEffect(() => {
    if (row.code) {
      setLoadingDrugs(true);
      drugsApi.getByDisorder(row.code)
        .then(setAssociatedDrugs)
        .catch((err) => console.error("Error loading associated drugs:", err))
        .finally(() => setLoadingDrugs(false));
    }
  }, [row.code]);

  const handleCompare = async () => {
    if (!row.code) return;
    setLoadingComparison(true);
    setComparisonError(null);
    try {
      const data = await dsm5Api.getComparison(row.code);
      setComparisonData(data);
    } catch (err) {
      console.error(err);
      setComparisonError("Could not load DSM-5 comparison data. Please verify database seeding.");
    } finally {
      setLoadingComparison(false);
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-5xl border border-base-200 shadow-xl bg-base-100 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-primary font-bold text-primary-content">{row.code || `Level ${row.level}`}</span>
              {row.icd10_code && (
                <span className="badge border border-emerald-300 text-emerald-700 bg-emerald-50/50 font-mono font-bold px-2 py-0.5 rounded">
                  ICD-10 Code: {row.icd10_code}
                </span>
              )}
              {row.dsm5_analogy_code && (
                <span className="badge border border-purple-300 text-purple-700 bg-purple-50/50 font-mono font-bold px-2 py-0.5 rounded">
                  DSM-5 Analogy: {row.dsm5_analogy_code}
                </span>
              )}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-base-content flex flex-wrap items-center gap-3">
              <span>{row.title_en}</span>
              {row.dsm5_analogy_code && row.code && (
                <button 
                  className={`btn btn-xs btn-outline btn-secondary font-bold gap-1 border-purple-400 text-purple-700 hover:bg-purple-600 hover:border-purple-600 hover:text-white ${loadingComparison ? 'loading btn-disabled' : ''}`}
                  onClick={handleCompare}
                  disabled={loadingComparison}
                >
                  <ArrowsRightLeftIcon className="h-3 w-3" />
                  {loadingComparison ? 'Loading comparison...' : 'Compare with DSM-5'}
                </button>
              )}
            </h2>
            {row.title_it && <p className="text-sm font-semibold text-base-content/80 mt-1">{row.title_it}</p>}
          </div>
          <button className="btn btn-ghost btn-sm font-bold text-base-content hover:bg-base-200" onClick={onClose}>Close</button>
        </div>
        
        {comparisonError && (
          <div className="alert alert-error mt-4 font-semibold text-sm py-2 px-3">
            {comparisonError}
          </div>
        )}

        <div className="divider my-4" />
        <div className="space-y-5">
          <section>
            <h3 className="font-bold text-base-content text-base">Description</h3>
            <p className="mt-2 text-sm leading-6 text-base-content font-medium">{row.description || 'No description available.'}</p>
          </section>
          {row.diagnostic_criteria && (
            <section>
              <h3 className="font-bold text-base-content text-base">Diagnostic criteria</h3>
              <div className="mt-2 rounded-box bg-base-200/80 p-4 text-base-content border border-base-300 font-medium">
                <MarkdownContent content={row.diagnostic_criteria.replace(/^!markdown\s*/m, '').trim()} />
              </div>
            </section>
          )}
          <div className="grid gap-5 md:grid-cols-2 pt-2">
            <TagList title="Inclusions" values={row.inclusions} type="success" />
            <TagList title="Exclusions" values={row.exclusions} type="error" />
            <TagList title="Index terms" values={row.index_terms} type="neutral" />
            <TagList title="Differential diagnoses" values={row.differential_diagnoses} type="info" />
          </div>

          {/* Associated Drugs Section */}
          <section className="mt-6 border-t border-base-200 pt-5">
            <h3 className="font-bold text-base-content text-lg mb-3 flex items-center gap-2">
              <BeakerIcon className="h-5 w-5 text-primary" />
              <span>Medicinali AIFA Associati (Evidenze MEDI-C)</span>
            </h3>
            {loadingDrugs ? (
              <div className="flex items-center gap-2 text-sm text-base-content/60">
                <span className="loading loading-spinner loading-sm" />
                <span>Ricerca medicinali associati...</span>
              </div>
            ) : associatedDrugs.length > 0 ? (
              <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
                <table className="table table-zebra table-sm w-full">
                  <thead>
                    <tr className="bg-base-200 text-base-content font-bold">
                      <th>Principio Attivo</th>
                      <th>Nome Commerciale</th>
                      <th>Produttore</th>
                      <th>Confezione</th>
                      <th>Prezzo</th>
                      <th>Classe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {associatedDrugs.map((drug) => (
                      <tr key={drug.id} className="hover">
                        <td className="font-bold text-primary">{drug.active_ingredient}</td>
                        <td className="font-semibold text-base-content">{drug.commercial_name}</td>
                        <td className="text-xs">{drug.manufacturer || '-'}</td>
                        <td className="text-xs">{drug.packaging || '-'}</td>
                        <td className="font-mono text-xs">{drug.price ? `${drug.price.toFixed(2)} €` : '-'}</td>
                        <td>
                          <span className="badge badge-sm badge-outline font-bold">
                            {drug.category_class || 'N.D.'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-base-content/50 italic">Nessun farmaco AIFA associato trovato per questo disturbo.</p>
            )}
          </section>
        </div>
      </div>
      
      {comparisonData && (
        <ComparisonModal data={comparisonData} onClose={() => setComparisonData(null)} />
      )}
      
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

function ComparisonModal({ data, onClose }: { data: DSM5CategoryCompare; onClose: () => void }) {
  return (
    <dialog className="modal modal-open z-50">
      <div className="modal-box max-w-7xl w-11/12 border border-base-200 shadow-2xl bg-base-100 p-6 flex flex-col h-[85vh]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-base-content flex items-center gap-2">
              <span>Diagnostic Comparison</span>
              <span className="badge badge-outline border-emerald-500 text-emerald-600 font-mono text-xs px-2 py-0.5 rounded">ICD-11: {data.icd11?.code}</span>
              <span className="badge badge-outline border-purple-500 text-purple-600 font-mono text-xs px-2 py-0.5 rounded">DSM-5: {data.dsm5.code}</span>
            </h2>
            <p className="text-sm font-semibold text-base-content/75 mt-1">
              Side-by-side diagnostic criteria comparison for {data.dsm5.title}
            </p>
          </div>
          <button className="btn btn-ghost btn-sm font-bold text-base-content hover:bg-base-200" onClick={onClose}>Close Comparison</button>
        </div>
        
        <div className="divider my-3 flex-shrink-0" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto flex-grow pr-1">
          {/* ICD-11 Column */}
          <div className="card bg-emerald-50/20 border border-emerald-100 shadow-sm flex flex-col h-full rounded-box">
            <div className="bg-emerald-600/10 border-b border-emerald-100 p-4 rounded-t-box flex items-center justify-between">
              <h3 className="font-bold text-emerald-800 text-lg flex items-center gap-2">
                <span className="badge badge-sm bg-emerald-600 text-white border-none py-2 px-2.5 font-bold font-mono rounded">ICD-11</span>
                <span>{data.icd11?.title_en || 'ICD-11 Node'}</span>
              </h3>
              {data.icd11?.code && <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded">{data.icd11.code}</span>}
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-grow max-h-[55vh]">
              {data.icd11?.description && (
                <div>
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1.5">Description</h4>
                  <p className="text-sm leading-6 text-base-content font-medium">{data.icd11.description}</p>
                </div>
              )}
              
              {data.icd11?.diagnostic_criteria ? (
                <div>
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1.5">Diagnostic Criteria</h4>
                  <div className="rounded-box bg-base-100 p-4 border border-base-200 shadow-inner text-base-content font-medium">
                    <MarkdownContent content={data.icd11.diagnostic_criteria.replace(/^!markdown\s*/m, '').trim()} />
                  </div>
                </div>
              ) : (
                <div className="alert alert-warning py-3 text-sm font-semibold">
                  No diagnostic criteria available for this ICD-11 entity.
                </div>
              )}
            </div>
          </div>
          
          {/* DSM-5 Column */}
          <div className="card bg-purple-50/20 border border-purple-100 shadow-sm flex flex-col h-full rounded-box">
            <div className="bg-purple-600/10 border-b border-purple-100 p-4 rounded-t-box flex items-center justify-between">
              <h3 className="font-bold text-purple-800 text-lg flex items-center gap-2">
                <span className="badge badge-sm bg-purple-600 text-white border-none py-2 px-2.5 font-bold font-mono rounded">DSM-5</span>
                <span>{data.dsm5.title}</span>
              </h3>
              <span className="font-mono text-xs font-bold text-purple-700 bg-purple-100/80 px-2 py-1 rounded">{data.dsm5.code}</span>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-grow max-h-[55vh]">
              <div>
                <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-1.5">Chapter</h4>
                <p className="text-sm leading-6 text-base-content font-semibold">{data.dsm5.chapter}</p>
              </div>

              {data.dsm5.icd10_code && (
                <div>
                  <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-1.5">Equivalent ICD-10 Code</h4>
                  <span className="badge badge-outline border-purple-400 text-purple-700 font-mono text-xs font-bold px-2 py-1 rounded">{data.dsm5.icd10_code}</span>
                </div>
              )}
              
              <div>
                <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-1.5">Diagnostic Criteria</h4>
                {data.dsm5.diagnostic_criteria ? (
                  <div className="rounded-box bg-base-100 p-4 border border-base-200 shadow-inner text-base-content font-medium whitespace-pre-wrap leading-relaxed">
                    <MarkdownContent content={data.dsm5.diagnostic_criteria.replace(/^!markdown\s*/m, '').trim()} />
                  </div>
                ) : (
                  <div className="alert alert-info py-3 text-sm font-semibold">
                    No criteria cached. Triggering extraction from dsm5.pdf...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

function TagList({ title, values, type }: { title: string; values?: string[] | null; type: 'success' | 'error' | 'info' | 'neutral' }) {
  if (!values?.length) return null;

  const typeClasses = {
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    neutral: 'bg-slate-100 text-slate-800 border-slate-200'
  };

  return (
    <section className="bg-base-100 p-4 rounded-box border border-base-300 shadow-sm">
      <h3 className="mb-2.5 font-bold text-base-content text-sm">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value, index) => (
          <span 
            key={`${value}-${index}`} 
            className={`border text-xs font-semibold py-1 px-2.5 rounded ${typeClasses[type]}`}
          >
            {value}
          </span>
        ))}
      </div>
    </section>
  );
}
