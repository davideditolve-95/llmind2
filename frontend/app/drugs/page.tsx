'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { drugsApi, type AIFADrug, type PaginatedResponse } from '@/lib/api';
import {
  BeakerIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';

const PAGE_SIZE = 50;

export default function DrugsPage() {
  return (
    <Suspense fallback={<div className="app-page"><span className="loading loading-spinner loading-lg" /></div>}>
      <DrugsContent />
    </Suspense>
  );
}

function DrugsContent() {
  const [data, setData] = useState<PaginatedResponse<AIFADrug> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Filtri avanzati
  const [activeIngredient, setActiveIngredient] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [atcCode, setAtcCode] = useState('');
  const [categoryClass, setCategoryClass] = useState('');
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      const res = await drugsApi.list({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        active_ingredient: activeIngredient || undefined,
        manufacturer: manufacturer || undefined,
        atc_code: atcCode || undefined,
        category_class: categoryClass || undefined,
        min_price: minPrice,
        max_price: maxPrice,
      });
      setData(res);
    } catch (err) {
      setError('Impossibile caricare il database dei medicinali AIFA.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, activeIngredient, manufacturer, atcCode, categoryClass, minPrice, maxPrice]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetFilters = () => {
    setSearch('');
    setActiveIngredient('');
    setManufacturer('');
    setAtcCode('');
    setCategoryClass('');
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setPage(1);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (activeIngredient) count++;
    if (manufacturer) count++;
    if (atcCode) count++;
    if (categoryClass) count++;
    if (minPrice !== undefined) count++;
    if (maxPrice !== undefined) count++;
    return count;
  };

  return (
    <div className="app-page space-y-6">
      <div className="alert border border-warning/50 bg-warning/10 text-base-content rounded-box p-5 shadow-sm flex flex-col md:flex-row items-start gap-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-warning shrink-0 w-8 h-8 md:w-10 md:h-10 mt-0.5" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="flex-1 space-y-1">
          <h3 className="font-extrabold text-lg tracking-tight">
            Experimental medication knowledge
          </h3>
          <p className="text-sm font-semibold leading-relaxed">
            This section is a research-oriented AIFA knowledge browser for future specialist agents. It is not a
            medical device, does not produce valid prescriptions, and must not be used for clinical decisions.
            Medication choices require qualified medical review.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BeakerIcon className="h-7 w-7 text-primary" />
            <h1 className="app-title">AIFA Drug Knowledge</h1>
          </div>
          <p className="app-subtitle mt-2">
            Browse authorized Italian medication records as a controlled knowledge source for experimental prescription-oriented agents.
          </p>
        </div>
        <div className="join shadow-sm">
          <button className="btn join-item bg-base-100" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button className="btn join-item no-animation bg-base-100 font-bold">Pagina {data?.page || page} di {data?.total_pages || 1}</button>
          <button className="btn join-item bg-base-100" disabled={!data || page >= data.total_pages || loading} onClick={() => setPage((p) => p + 1)}>
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card bg-base-100 shadow-sm border border-base-200">
        <div className="card-body gap-4 p-5">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_15rem]">
            <label className="input input-bordered flex items-center gap-2 w-full">
              <MagnifyingGlassIcon className="h-4 w-4 opacity-70 text-base-content" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="grow text-base-content font-medium"
                placeholder="Cerca per nome commerciale, principio attivo o AIC..."
              />
            </label>
            <button
              type="button"
              className={`btn gap-2 font-semibold text-base-content ${showAdvanced ? 'btn-active bg-base-200' : 'btn-ghost border border-base-300'}`}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <FunnelIcon className="w-4 h-4 text-primary" />
              <span>Filtri Avanzati</span>
              {getActiveFiltersCount() > 0 && (
                <span className="badge badge-primary badge-sm ml-1">{getActiveFiltersCount()}</span>
              )}
            </button>
          </div>

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="grid gap-4 mt-2 p-5 rounded-box bg-base-200 border border-base-300 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <div className="form-control w-full">
                <span className="label-text font-bold text-sm mb-1.5">Principio Attivo</span>
                <input
                  type="text"
                  className="input input-bordered input-sm bg-base-100 text-base-content font-medium"
                  placeholder="Es. Fluoxetina"
                  value={activeIngredient}
                  onChange={(e) => { setActiveIngredient(e.target.value); setPage(1); }}
                />
              </div>

              <div className="form-control w-full">
                <span className="label-text font-bold text-sm mb-1.5">Produttore</span>
                <input
                  type="text"
                  className="input input-bordered input-sm bg-base-100 text-base-content font-medium"
                  placeholder="Es. DOC GENERICI"
                  value={manufacturer}
                  onChange={(e) => { setManufacturer(e.target.value); setPage(1); }}
                />
              </div>

              <div className="form-control w-full">
                <span className="label-text font-bold text-sm mb-1.5">Codice ATC</span>
                <input
                  type="text"
                  className="input input-bordered input-sm bg-base-100 text-base-content font-medium"
                  placeholder="Es. N06AB03"
                  value={atcCode}
                  onChange={(e) => { setAtcCode(e.target.value); setPage(1); }}
                />
              </div>

              <div className="form-control w-full">
                <span className="label-text font-bold text-sm mb-1.5">Classe Rimborsabilità</span>
                <select
                  className="select select-bordered select-sm bg-base-100 text-base-content font-medium"
                  value={categoryClass}
                  onChange={(e) => { setCategoryClass(e.target.value); setPage(1); }}
                >
                  <option value="">Tutte le classi</option>
                  <option value="Equivalenti">Equivalenti (Trasparenza)</option>
                  <option value="Classe A">Classe A (Reimbursed)</option>
                  <option value="Classe H">Classe H (Ospedalieri)</option>
                </select>
              </div>

              <div className="form-control w-full">
                <span className="label-text font-bold text-sm mb-1.5">Prezzo Minimo</span>
                <input
                  type="number"
                  step="0.01"
                  className="input input-bordered input-sm bg-base-100 text-base-content font-medium"
                  placeholder="0.00"
                  value={minPrice ?? ''}
                  onChange={(e) => { setMinPrice(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                />
              </div>

              <div className="form-control w-full">
                <span className="label-text font-bold text-sm mb-1.5">Prezzo Massimo</span>
                <input
                  type="number"
                  step="0.01"
                  className="input input-bordered input-sm bg-base-100 text-base-content font-medium"
                  placeholder="100.00"
                  value={maxPrice ?? ''}
                  onChange={(e) => { setMaxPrice(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                />
              </div>
            </div>
          )}

          {getActiveFiltersCount() > 0 && (
            <div className="flex justify-end pt-1">
              <button type="button" className="btn btn-xs btn-outline btn-error font-bold" onClick={resetFilters}>
                Azzera Filtri
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error font-semibold">{error}</div>}

      {/* Drugs Table */}
      <div className="card bg-base-100 shadow-sm border border-base-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr className="border-b border-base-200 bg-base-200/50">
                <th className="w-28 text-base-content font-bold text-sm">Codice AIC</th>
                <th className="text-base-content font-bold text-sm">Nome Commerciale & Confezione</th>
                <th className="text-base-content font-bold text-sm">Principio Attivo</th>
                <th className="w-32 text-base-content font-bold text-sm">Codice ATC</th>
                <th className="w-48 text-base-content font-bold text-sm">Produttore</th>
                <th className="w-28 text-right text-base-content font-bold text-sm">Prezzo</th>
                <th className="w-32 text-center text-base-content font-bold text-sm">Classe</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <span className="loading loading-spinner loading-lg text-primary" />
                  </td>
                </tr>
              ) : data?.items.length ? (
                data.items.map((drug) => (
                  <tr key={drug.id} className="hover">
                    <td className="align-middle font-mono text-xs font-bold text-base-content/80">
                      {drug.aic_code}
                    </td>
                    <td className="align-middle">
                      <div className="font-bold text-base-content text-sm sm:text-base">
                        {drug.commercial_name}
                      </div>
                      <div className="text-xs text-base-content/60 font-semibold mt-0.5">
                        {drug.packaging || 'Confezione N.D.'}
                      </div>
                    </td>
                    <td className="align-middle font-semibold text-sm text-primary">
                      {drug.active_ingredient}
                    </td>
                    <td className="align-middle font-mono text-xs font-semibold text-base-content/70">
                      {drug.atc_code || '-'}
                    </td>
                    <td className="align-middle text-xs font-semibold text-base-content/80">
                      {drug.manufacturer || '-'}
                    </td>
                    <td className="align-middle text-right font-mono font-black text-sm text-base-content">
                      {drug.price ? `${drug.price.toFixed(2)} €` : '-'}
                    </td>
                    <td className="align-middle text-center">
                      <span className={`badge badge-sm font-bold px-2 py-1 ${
                        drug.category_class === 'Classe A' ? 'badge-success bg-success/10 text-success border-success/20' :
                        drug.category_class === 'Classe H' ? 'badge-warning bg-warning/10 text-warning border-warning/20' :
                        'badge-neutral bg-base-200 text-base-content border-base-300'
                      }`}>
                        {drug.category_class || 'Equivalente'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-base-content font-semibold italic">
                    Nessun medicinale trovato con i filtri attuali.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
