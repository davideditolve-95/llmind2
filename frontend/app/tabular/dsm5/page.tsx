'use client';

import { Fragment, Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { dsm5Api, type DSM5Category, type DSM5CategoryCompare } from '@/lib/api';
import MarkdownContent from '@/components/ui/MarkdownContent';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';

const PAGE_SIZE = 50;

export default function Dsm5ExplorerPage() {
  return (
    <Suspense fallback={<div className="app-page"><span className="loading loading-spinner loading-lg" /></div>}>
      <Dsm5ExplorerContent />
    </Suspense>
  );
}

function Dsm5ExplorerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [chapters, setChapters] = useState<string[]>([]);
  const [categories, setCategories] = useState<DSM5Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchType, setSearchType] = useState<'standard' | 'criteria' | 'all'>('standard');
  const [page, setPage] = useState(1);
  const [hasCriteria, setHasCriteria] = useState<boolean | undefined>(undefined);
  const [hasIcd10, setHasIcd10] = useState<boolean | undefined>(undefined);
  const [hasIcd11, setHasIcd11] = useState<boolean | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DSM5Category | null>(null);

  // Load Chapters on mount
  useEffect(() => {
    dsm5Api.getChapters()
      .then(setChapters)
      .catch((err) => {
        console.error("Error loading DSM-5 chapters:", err);
        setError("Could not load DSM-5 chapters.");
      });
  }, []);

  // Sync with search params on load
  useEffect(() => {
    const initialCode = searchParams.get('code');
    const initialChapter = searchParams.get('chapter');
    const initialSearch = searchParams.get('search');
    const initialType = searchParams.get('search_type');
    
    if (initialChapter) setSelectedChapter(initialChapter);
    if (initialSearch) {
      setSearch(initialSearch);
      setDebouncedSearch(initialSearch);
    }
    if (initialType === 'standard' || initialType === 'criteria' || initialType === 'all') {
      setSearchType(initialType);
    }
    
    if (initialCode) {
      dsm5Api.getCategory(initialCode)
        .then(setSelectedRow)
        .catch(() => {});
    }
  }, [searchParams]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load categories
  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dsm5Api.getCategories({
        chapter: selectedChapter || undefined,
        search: debouncedSearch || undefined,
        search_type: searchType,
        has_criteria: hasCriteria,
        has_icd10: hasIcd10,
        has_icd11: hasIcd11,
      });
      setCategories(data);
    } catch (err) {
      console.error(err);
      setError("Unable to load DSM-5 categories.");
    } finally {
      setLoading(false);
    }
  }, [selectedChapter, debouncedSearch, searchType, hasCriteria, hasIcd10, hasIcd11]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleRowDetails = async (cat: DSM5Category) => {
    setSelectedRow(cat);
    // If DSM-5 content is not yet loaded, fetching triggers the PDF extraction fallback.
    if (!hasAnyDsm5Content(cat)) {
      try {
        const fullCat = await dsm5Api.getCategory(cat.id);
        setSelectedRow(fullCat);
        // Refresh category in list
        setCategories(prev => prev.map(c => c.id === cat.id ? fullCat : c));
      } catch (err) {
        console.error("Error loading criteria details:", err);
      }
    }
  };

  const totalPages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE));
  const paginatedCategories = categories.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const groupedCategories = paginatedCategories.reduce<Record<string, Record<string, DSM5Category[]>>>((groups, category) => {
    const key = category.chapter || 'Uncategorized DSM-5 categories';
    const family = getDsm5Family(category);
    groups[key] = groups[key] || {};
    groups[key][family] = groups[key][family] || [];
    groups[key][family].push(category);
    return groups;
  }, {});

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedChapter) count++;
    if (hasCriteria !== undefined) count++;
    if (hasIcd10 !== undefined) count++;
    if (hasIcd11 !== undefined) count++;
    return count;
  };

  const resetAllFilters = () => {
    setSelectedChapter('');
    setHasCriteria(undefined);
    setHasIcd10(undefined);
    setHasIcd11(undefined);
    setSearch('');
    setSearchType('standard');
    setPage(1);
  };

  return (
    <div className="app-page space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Squares2X2Icon className="h-7 w-7 text-secondary" />
            <h1 className="app-title text-purple-900 dark:text-purple-300">DSM-5 Explorer</h1>
          </div>
          <p className="app-subtitle mt-2">Browse the American Psychiatric Association (APA) DSM-5 diagnostic categories.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="join">
            <button className="btn join-item" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button className="btn join-item no-animation">Page {page} / {totalPages}</button>
            <button className="btn join-item" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <button 
            className="btn btn-outline font-semibold"
            onClick={() => router.push('/tabular')}
          >
            Go to ICD-11 Browser
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body gap-4 p-5 sm:p-6">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_14rem_18rem]">
            <label className="input input-bordered flex items-center gap-2 w-full">
              <MagnifyingGlassIcon className="h-4 w-4 opacity-70 text-base-content" />
              <input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="grow text-base-content font-medium" 
                placeholder={searchType === 'criteria' ? 'Search diagnostic criteria (e.g., impairment, duration)' : 'Search DSM-5 code, title, chapter, or mapping'} 
              />
            </label>

            <select
              className="select select-bordered text-base-content font-medium bg-base-100 w-full"
              value={searchType}
              onChange={(e) => {
                setSearchType(e.target.value as 'standard' | 'criteria' | 'all');
                setPage(1);
              }}
            >
              <option value="standard">Code, title & mappings</option>
              <option value="criteria">Diagnostic criteria</option>
              <option value="all">All DSM-5 fields</option>
            </select>
            
            <select 
              className="select select-bordered text-base-content font-medium bg-base-100 w-full"
              value={selectedChapter}
              onChange={(e) => {
                setSelectedChapter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All DSM-5 Chapters</option>
              {chapters.map((chap, idx) => (
                <option key={idx} value={chap}>{chap}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-base-200">
            <button 
              type="button" 
              className={`btn btn-sm btn-ghost gap-1.5 font-semibold text-base-content hover:bg-base-200 ${showAdvanced ? 'btn-active bg-base-200' : ''}`}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.0} stroke="currentColor" className="w-4 h-4 text-secondary">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
              {showAdvanced ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
              {getActiveFiltersCount() > 0 && (
                <span className="badge badge-secondary badge-sm ml-1 text-secondary-content">{getActiveFiltersCount()}</span>
              )}
            </button>

            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-base-content/60">
              <span>{categories.length} matching categories</span>
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
          </div>

          {showAdvanced && (
            <div className="grid gap-4 mt-2 p-5 rounded-box bg-base-200 border border-base-300 shadow-inner grid-cols-1 md:grid-cols-3">
              <FilterCheckbox
                checked={hasCriteria === true}
                label="Diagnostic criteria available"
                onChange={(checked) => {
                  setHasCriteria(checked ? true : undefined);
                  setPage(1);
                }}
              />
              <FilterCheckbox
                checked={hasIcd11 === true}
                label="ICD-11 mapping available"
                onChange={(checked) => {
                  setHasIcd11(checked ? true : undefined);
                  setPage(1);
                }}
              />
              <FilterCheckbox
                checked={hasIcd10 === true}
                label="ICD-10 code available"
                onChange={(checked) => {
                  setHasIcd10(checked ? true : undefined);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Categories Table */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="border-b border-base-200">
                <th className="w-40 text-base-content font-bold text-sm">DSM-5 Code</th>
                <th className="text-base-content font-bold text-sm">Disorder</th>
                <th className="hidden lg:table-cell text-center w-32 text-base-content font-bold text-sm">Evidence</th>
                <th className="hidden sm:table-cell text-center w-48 text-base-content font-bold text-sm">Mappings</th>
                <th className="text-right w-36 text-base-content font-bold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <span className="loading loading-spinner loading-lg text-primary" />
                  </td>
                </tr>
              ) : paginatedCategories.length ? (
                Object.entries(groupedCategories).map(([chapter, familyGroups]) => {
                  const chapterRows = Object.values(familyGroups).flat();
                  return (
                  <Fragment key={chapter}>
                    <tr className="bg-purple-50/70">
                      <td colSpan={5} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-700">DSM-5 chapter</div>
                            <div className="font-bold text-base-content">{chapter}</div>
                          </div>
                          <span className="badge border-purple-200 bg-white text-purple-700 font-bold">
                            {chapterRows.length} categories on this page
                          </span>
                        </div>
                      </td>
                    </tr>
                    {Object.entries(familyGroups).map(([family, rows]) => (
                      <Fragment key={`${chapter}-${family}`}>
                        <tr className="bg-base-200/70">
                          <td colSpan={5} className="py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold text-base-content">{family}</div>
                              <span className="badge badge-outline badge-sm font-bold">
                                {rows.length} variant{rows.length === 1 ? '' : 's'}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="align-middle">
                          <span className="inline-flex min-w-24 justify-center rounded-xl border border-purple-300 bg-purple-50 px-3 py-2 font-mono text-sm font-black tabular-nums tracking-wide text-purple-800 shadow-sm">
                            {row.code}
                          </span>
                        </td>
                        <td className="align-middle">
                          <div className="font-semibold text-sm sm:text-base text-base-content leading-snug">{getDsm5DisplayTitle(row)}</div>
                          {(row.variant_label || row.severity) && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {row.variant_label && (
                                <span className="badge border border-purple-200 bg-purple-50 text-purple-700 badge-sm font-bold">
                                  {row.variant_label}
                                </span>
                              )}
                              {row.severity && (
                                <span className="badge border border-amber-200 bg-amber-50 text-amber-800 badge-sm font-bold">
                                  {row.severity}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="mt-2 sm:hidden">
                            <MappingGroup icd11Code={row.icd11_code} icd10Code={row.icd10_code} compact />
                            {hasAnyDsm5Content(row) && (
                              <span className="badge border border-purple-200 bg-purple-50 text-purple-700 badge-xs font-bold mt-1.5">
                                Content
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="hidden lg:table-cell align-middle text-center">
                          <ContentBadges category={row} compact />
                        </td>
                        <td className="hidden sm:table-cell align-middle">
                          <MappingGroup icd11Code={row.icd11_code} icd10Code={row.icd10_code} />
                        </td>
                        <td className="text-right align-middle">
                          <button 
                            className="btn btn-sm btn-ghost sm:btn-active font-semibold text-base-content hover:bg-base-200 gap-1.5"
                            onClick={() => handleRowDetails(row)}
                          >
                            <EyeIcon className="h-4 w-4 text-purple-700" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-base-content font-semibold">
                    No DSM-5 categories found. Try adjusting filters or search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedRow && (
        <Dsm5DetailModal 
          category={selectedRow} 
          onClose={() => setSelectedRow(null)} 
        />
      )}
    </div>
  );
}

function FilterCheckbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <div className="form-control">
      <label className="label cursor-pointer justify-start gap-2.5 py-1.5">
        <input
          type="checkbox"
          className="checkbox checkbox-secondary checkbox-sm border-base-content/65 bg-base-100"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="label-text font-semibold text-base-content text-sm">{label}</span>
      </label>
    </div>
  );
}

const DSM5_CONTENT_SECTIONS: { key: keyof DSM5Category; label: string }[] = [
  { key: 'diagnostic_criteria', label: 'Criteria' },
  { key: 'diagnostic_features', label: 'Features' },
  { key: 'prevalence', label: 'Prevalence' },
  { key: 'development_and_course', label: 'Course' },
  { key: 'risk_and_prognostic_factors', label: 'Risk' },
  { key: 'culture_related_issues', label: 'Culture' },
  { key: 'sex_gender_related_issues', label: 'Sex/Gender' },
  { key: 'functional_consequences', label: 'Function' },
  { key: 'differential_diagnosis', label: 'Differential' },
  { key: 'comorbidity', label: 'Comorbidity' },
];

function getDsm5ContentSections(category: DSM5Category) {
  return DSM5_CONTENT_SECTIONS
    .map((section) => ({ ...section, content: category[section.key] as string | null }))
    .filter((section) => Boolean(section.content?.trim()));
}

function hasAnyDsm5Content(category: DSM5Category) {
  return getDsm5ContentSections(category).length > 0;
}

const DSM5_SEVERITY_WORDS = ['Mild', 'Moderate', 'Severe', 'Profound', 'Early Remission', 'Sustained Remission', 'Partial Remission', 'Full Remission'];

function getDsm5Family(category: DSM5Category) {
  if (category.parent_category?.trim()) return category.parent_category.trim();
  if (category.title.includes(' - ')) return category.title.split(' - ', 1)[0].trim();

  const matchedSeverity = DSM5_SEVERITY_WORDS.find((word) => category.title.toLowerCase().includes(word.toLowerCase()));
  if (matchedSeverity) {
    return category.title.replace(new RegExp(matchedSeverity, 'i'), '').replace(/[-,:;()\s]+$/g, '').trim() || category.title;
  }

  return category.title;
}

function getDsm5DisplayTitle(category: DSM5Category) {
  const family = getDsm5Family(category);
  if (category.variant_label?.trim()) return family;
  if (category.title.startsWith(`${family} - `)) return family;
  return category.title;
}

function ContentBadges({ category, compact = false }: { category: DSM5Category; compact?: boolean }) {
  const sections = getDsm5ContentSections(category);
  if (!sections.length) {
    return <span className="text-xs text-base-content/35 font-medium">No content cached</span>;
  }

  const visible = compact ? sections.slice(0, 3) : sections;
  const remaining = sections.length - visible.length;

  return (
    <div className="flex flex-wrap justify-center gap-1">
      {visible.map((section) => (
        <span key={section.key} className="badge border border-purple-200 bg-purple-50 text-purple-700 badge-sm font-bold">
          {section.label}
        </span>
      ))}
      {remaining > 0 && (
        <span className="badge badge-outline badge-sm font-bold">+{remaining}</span>
      )}
    </div>
  );
}

function MappingGroup({ icd11Code, icd10Code, compact = false }: { icd11Code?: string | null; icd10Code?: string | null; compact?: boolean }) {
  if (!icd11Code && !icd10Code) {
    return <span className="text-xs text-base-content/40 font-medium">No mappings</span>;
  }

  return (
    <div className={`inline-flex flex-col rounded-xl border border-base-300 bg-base-100 shadow-sm ${compact ? 'gap-1 p-1' : 'gap-1.5 p-1.5'}`}>
      {icd11Code && <CodePair label="ICD-11" value={icd11Code} tone="icd11" compact={compact} />}
      {icd10Code && <CodePair label="ICD-10" value={icd10Code} tone="icd10" compact={compact} />}
    </div>
  );
}

function CodePair({ label, value, tone, compact = false }: { label: string; value: string; tone: 'icd10' | 'icd11'; compact?: boolean }) {
  const colors = tone === 'icd11'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
    : 'border-purple-300 bg-purple-50 text-purple-800';
  const labelColors = tone === 'icd11'
    ? 'border-emerald-200 bg-emerald-100/80 text-emerald-900'
    : 'border-purple-200 bg-purple-100/80 text-purple-900';
  const sizing = compact ? 'text-[0.68rem]' : 'text-xs';
  const labelPadding = compact ? 'px-1.5 py-1' : 'px-2 py-1.5';
  const valuePadding = compact ? 'px-2 py-1' : 'px-2.5 py-1.5';

  return (
    <span className={`inline-flex items-stretch overflow-hidden rounded-lg border ${colors} font-mono font-black whitespace-nowrap tabular-nums leading-none`}>
      <span className={`border-r ${labelPadding} ${labelColors} ${sizing}`}>{label}</span>
      <span className={`${valuePadding} tracking-wide ${sizing}`}>{value}</span>
    </span>
  );
}

function Dsm5DetailModal({ category, onClose }: { category: DSM5Category; onClose: () => void }) {
  const [comparisonData, setComparisonData] = useState<DSM5CategoryCompare | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const contentSections = getDsm5ContentSections(category);

  const handleCompare = async () => {
    if (!category.icd11_code) return;
    setLoadingComparison(true);
    setComparisonError(null);
    try {
      const data = await dsm5Api.getComparison(category.icd11_code);
      setComparisonData(data);
    } catch (err) {
      console.error(err);
      setComparisonError("Could not load ICD-11 comparison data.");
    } finally {
      setLoadingComparison(false);
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-5xl border border-base-200 shadow-xl bg-base-100 p-6 flex flex-col max-h-[90vh]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between flex-shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge border border-purple-300 text-purple-700 bg-purple-50 font-mono font-bold px-2.5 py-0.5 rounded">
                DSM-5: {category.code}
              </span>
              {category.icd11_code && (
                <span className="badge border border-emerald-300 text-emerald-700 bg-emerald-50/50 font-mono font-bold px-2 py-0.5 rounded">
                  ICD-11 Analogy: {category.icd11_code}
                </span>
              )}
            </div>
            <h2 className="mt-3 text-2xl font-bold text-base-content flex flex-wrap items-center gap-3">
              <span>{category.title}</span>
              {category.icd11_code && (
                <button 
                  className={`btn btn-xs btn-outline btn-success font-bold gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-600 hover:border-emerald-600 hover:text-white ${loadingComparison ? 'loading btn-disabled' : ''}`}
                  onClick={handleCompare}
                  disabled={loadingComparison}
                >
                  <ArrowsRightLeftIcon className="h-3 w-3" />
                  {loadingComparison ? 'Loading comparison...' : 'Compare with ICD-11'}
                </button>
              )}
            </h2>
            <p className="text-sm font-semibold text-base-content/70 mt-1">{category.chapter}</p>
            <div className="mt-3">
              <ContentBadges category={category} />
            </div>
          </div>
          <button className="btn btn-ghost btn-sm font-bold text-base-content hover:bg-base-200" onClick={onClose}>Close</button>
        </div>

        {comparisonError && (
          <div className="alert alert-error mt-4 font-semibold text-sm py-2 px-3 flex-shrink-0">
            {comparisonError}
          </div>
        )}

        <div className="divider my-4 flex-shrink-0" />
        
        <div className="space-y-5 overflow-y-auto pr-1 flex-grow">
          {category.icd10_code && (
            <section className="bg-base-200/40 border border-base-200 p-3 rounded-box flex items-center justify-between">
              <span className="text-sm font-bold text-base-content">Mapped ICD-10 Code</span>
              <span className="badge border border-purple-300 text-purple-700 bg-purple-50 font-mono font-bold py-2.5 px-2 rounded">
                {category.icd10_code}
              </span>
            </section>
          )}

          {contentSections.length ? (
            <div className="space-y-4">
              {contentSections.map((section) => (
                <section key={section.key} className="rounded-box border border-base-300 bg-base-200/55 p-4 shadow-inner">
                  <h3 className="mb-2 text-base font-bold text-base-content">{section.label}</h3>
                  <MarkdownContent
                    className="text-base-content prose-p:leading-7 prose-p:my-2 prose-li:my-1"
                    content={(section.content || '').replace(/^!markdown\s*/m, '').trim()}
                  />
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-2 flex flex-col items-center justify-center p-8 rounded-box border border-dashed border-base-300 bg-base-200/30">
              <span className="loading loading-spinner loading-md text-purple-600 mb-2" />
              <p className="text-sm text-base-content/60 font-semibold text-center">
                DSM-5 sections not loaded yet. Dynamically extracting structured content from dsm5.pdf...
              </p>
            </div>
          )}
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
  const dsm5Sections = getDsm5ContentSections(data.dsm5);

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
              
              {dsm5Sections.length ? (
                dsm5Sections.map((section) => (
                  <div key={section.key}>
                    <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-1.5">{section.label}</h4>
                    <div className="rounded-box bg-base-100 p-4 border border-base-200 shadow-inner text-base-content font-medium">
                      <MarkdownContent content={(section.content || '').replace(/^!markdown\s*/m, '').trim()} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="alert alert-info py-3 text-sm font-semibold">
                  No DSM-5 structured sections cached.
                </div>
              )}
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
