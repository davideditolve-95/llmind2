/**
 * Client API per la comunicazione col backend FastAPI.
 * Tutte le chiamate HTTP sono centralizzate qui per facilitare la manutenzione.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Tipi ──────────────────────────────────────────────────────────────────

export interface IcdNode {
  id: string;
  code: string | null;
  label: string;
  level: number;
  has_children: boolean;
  parent_id: string | null;
  children: IcdNode[];
}

export interface IcdTableRow {
  id: string;
  code: string | null;
  title_en: string;
  title_it: string | null;
  description: string | null;
  inclusions?: string[];
  exclusions?: string[];
  index_terms?: string[];
  diagnostic_criteria?: string;
  coding_notes?: string;
  postcoordination_axes?: string[];
  differential_diagnoses?: string[];
  level: number;
  has_children: boolean;
  children_count: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DSM5Case {
  id: string;
  case_number: string | null;
  title: string;
  anamnesis: string;
  discussion: string;
  gold_standard_diagnosis: string;
  source_page: number | null;
  is_reviewed: boolean;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DSM5CaseSummary {
  id: string;
  case_number: string | null;
  title: string;
  is_reviewed: boolean;
  anamnesis_preview: string;
  source_page: number | null;
  run_count: number;
  created_at: string;
}

export interface ManualEvaluation {
  id: string;
  run_id: string;
  evaluator_name: string;
  rating: number;
  notes?: string;
  created_at: string;
}

export interface BenchmarkRun {
  id: string;
  case_id: string;
  case_title: string;
  case_number: string | null;
  gold_standard_diagnosis: string | null;
  model_name: string;
  batch_id: string | null;
  prompt_used: string;
  system_prompt_used: string | null;
  llm_response: string | null;
  similarity_score: number | null;
  latency_ms: number | null;
  include_discussion: boolean;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  evaluations: ManualEvaluation[];
}

export interface BenchmarkKPIs {
  total_cases: number;
  total_runs: number;
  reviewed_cases: number;
  models_tested: string[];
  model_kpis: ModelKPI[];
  similarity_over_time: SimilarityPoint[];
  rating_distribution: RatingPoint[];
}

export interface ModelKPI {
  model_name: string;
  total_runs: number;
  avg_similarity: number | null;
  avg_latency_ms: number | null;
  avg_human_rating: number | null;
  rated_runs: number;
}

export interface SimilarityPoint {
  date: string;
  model: string;
  similarity: number;
}

export interface RatingPoint {
  stars: number;
  count: number;
}

export interface KnowledgePreset {
  id: string;
  name: string;
  description: string;
  files: string[];
}

// ─── Helper fetch ──────────────────────────────────────────────────────────

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }
  return response.json();
}

// ─── ICD-11 ────────────────────────────────────────────────────────────────

export const icd11Api = {
  getTree: (level = 2) =>
    fetchApi<IcdNode[]>(`/api/icd11/tree?level=${level}`),

  getChildren: (nodeId: string) =>
    fetchApi<IcdNode[]>(`/api/icd11/node/${nodeId}/children`),

  search: (q: string, limit = 20) =>
    fetchApi<{ id: string; code: string; title: string; description: string; level: number }[]>(
      `/api/icd11/search?q=${encodeURIComponent(q)}&limit=${limit}`
    ),
  
  getCode: (nodeId: string) =>
    fetchApi<IcdTableRow>(`/api/icd11/node/${nodeId}`),

  getCodes: (params: { page?: number; page_size?: number; search?: string; level?: number; parent_id?: string }) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    if (params.search) query.set('search', params.search);
    if (params.level !== undefined) query.set('level', String(params.level));
    if (params.parent_id) query.set('parent_id', params.parent_id);
    return fetchApi<PaginatedResponse<IcdTableRow>>(`/api/icd11/codes?${query}`);
  },

  getStats: () => fetchApi<{ total_codes: number; chapters: number; status: string }>('/api/icd11/stats'),
};

// ─── Chat ──────────────────────────────────────────────────────────────────

export const chatApi = {
  getModels: () =>
    fetchApi<{ models: string[]; default_model: string }>('/api/chat/models'),

  listSessions: () =>
    fetchApi<{ id: string; title: string; mode: string; created_at: string; updated_at: string }[]>(
      '/api/chat/sessions'
    ),

  renameSession: (sessionId: string, title: string) =>
    fetchApi<{ id: string; title: string }>(`/api/chat/sessions/${sessionId}?title=${encodeURIComponent(title)}`, {
      method: 'PATCH',
    }),

  getHistory: (sessionId: string) =>
    fetchApi<{ id: string; title: string; messages: any[]; mode: string }>(
      `/api/chat/history/${sessionId}`
    ),

  clearHistory: (sessionId: string) =>
    fetchApi(`/api/chat/history/${sessionId}`, { method: 'DELETE' }),

  getHealth: () =>
    fetchApi<{
      status: string;
      base_url: string;
      models_count: number;
      latency_ms: number;
      error?: string;
    }>('/api/chat/health'),

  testPrompt: (data: { model_name: string; prompt: string; system_prompt?: string }) =>
    fetchApi<{
      content: string;
      model: string;
      latency_ms: number;
      success: boolean;
      error?: string;
    }>('/api/chat/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Invia un messaggio e restituisce un ReadableStream per il parsing SSE.
   * Il chiamante è responsabile di leggere lo stream.
   */
  streamMessage: async (params: {
    message: string;
    session_id: string;
    mode: 'icd11' | 'wellbeing';
    model_name: string;
    language: string;
  }): Promise<ReadableStream<Uint8Array> | null> => {
    const response = await fetch(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok || !response.body) return null;
    return response.body;
  },
};

// ─── Cases ─────────────────────────────────────────────────────────────────

export const casesApi = {
  list: (params: { page?: number; page_size?: number; search?: string; reviewed_only?: boolean }) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    if (params.search) query.set('search', params.search);
    if (params.reviewed_only) query.set('reviewed_only', 'true');
    return fetchApi<{ items: DSM5CaseSummary[]; total: number; page: number; total_pages: number }>(
      `/api/cases?${query}`
    );
  },

  get: (id: string) => fetchApi<DSM5Case>(`/api/cases/${id}`),

  update: (id: string, data: Partial<DSM5Case>) =>
    fetchApi<DSM5Case>(`/api/cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => fetchApi(`/api/cases/${id}`, { method: 'DELETE' }),

  getStats: () =>
    fetchApi<{ total_cases: number; reviewed: number; pending_review: number }>(
      '/api/cases/stats/summary'
    ),
};

// ─── Benchmark ─────────────────────────────────────────────────────────────

export const benchmarkApi = {
  run: (params: {
    case_ids: string[];
    model_names: string[];
    include_discussion: boolean;
    prompt_language: string;
  }) =>
    fetchApi<{ message: string; total_runs: number }>('/api/benchmark/run', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getHistory: (params: {
    page?: number;
    page_size?: number;
    model_name?: string;
    status?: string;
  }) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    if (params.model_name) query.set('model_name', params.model_name);
    if (params.status) query.set('status', params.status);
    return fetchApi<{ items: BenchmarkRun[]; total: number; total_pages: number }>(
      `/api/benchmark/history?${query}`
    );
  },

  addEvaluation: (runId: string, data: { evaluator_name: string; rating: number; notes?: string }) =>
    fetchApi<ManualEvaluation>(`/api/benchmark/runs/${runId}/evaluations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteEvaluation: (runId: string, evalId: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/benchmark/runs/${runId}/evaluations/${evalId}`, {
      method: 'DELETE',
    }),

  getKPIs: () => fetchApi<BenchmarkKPIs>('/api/benchmark/kpis'),

  getBatchKPIs: (batchId: string) => fetchApi<BenchmarkKPIs>(`/api/benchmark/batch/${batchId}/kpis`),
  
  stop: () => fetchApi<{ message: string }>('/api/benchmark/stop', { method: 'POST' }),

  purgeHistory: () => fetchApi<{ success: boolean; message: string }>('/api/benchmark/history', { method: 'DELETE' }),

  retryRun: (runId: string) => fetchApi<{ message: string; run_id: string }>(`/api/benchmark/runs/${runId}/retry`, {
    method: 'POST',
  }),

  exportData: async (format: 'csv' | 'json' | 'txt' = 'csv', batchId?: string) => {
    const query = new URLSearchParams({ format });
    if (batchId) query.set('batch_id', batchId);
    const res = await fetch(`${API_BASE}/api/benchmark/export?${query}`);
    if (!res.ok) throw new Error('API Error');
    return res.blob();
  },
};
// ─── Legacy (v1) ──────────────────────────────────────────────────────────

export const legacyApi = {
  ask: (input_string: string) =>
    fetchApi<{ output_string: string; model: string }>('/api/legacy/ask', {
      method: 'POST',
      body: JSON.stringify({ input_string }),
    }),

  runBatch: (csv_filename: string) =>
    fetchApi<{ message: string; output_file: string }>('/api/legacy/batch-run', {
      method: 'POST',
      body: JSON.stringify({ csv_filename }),
    }),

  getLogs: (limit = 50) =>
    fetchApi<{ logs: string[] }>(`/api/legacy/logs?limit=${limit}`),
};

// ─── Datastore ─────────────────────────────────────────────────────────────

export interface Datastore {
  id: string;
  name: string;
  description: string | null;
  model_name: string;
  status: 'processing' | 'ready' | 'failed';
  error_message: string | null;
  metadata_info: any;
  created_at: string;
}

export const datastoreApi = {
  create: (formData: FormData) =>
    fetch(`${API_BASE}/api/datastore/create`, {
      method: 'POST',
      body: formData,
    }).then(res => {
      if (!res.ok) throw new Error('Action failed');
      return res.json();
    }),

  list: () => fetchApi<Datastore[]>('/api/datastore/list'),

  delete: (id: string) => fetchApi(`/api/datastore/${id}`, { method: 'DELETE' }),

  ask: (id: string, query: string) =>
    fetchApi<{ answer: string; model: string }>(`/api/datastore/${id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  getPresets: () => fetchApi<KnowledgePreset[]>('/api/datastore/presets'),
};

// ─── System ────────────────────────────────────────────────────────────────

export interface SystemLog {
  timestamp: string;
  level: string;
  name: string;
  message: string;
}

export const systemApi = {
  getLogs: () => fetchApi<{ logs: SystemLog[] }>('/api/system/logs'),
};
