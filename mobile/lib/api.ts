import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppConfig {
  apiUrl: string;
  keycloakIssuer: string;
  clientId: string;
  clientSecret: string;
}

const DEFAULT_CONFIG: AppConfig = {
  apiUrl: 'http://10.0.2.2:10000', // Android emulator -> host Mac; web/iOS can use http://localhost:10000
  keycloakIssuer: 'https://keycloak-pw9ut4s1h3aodstrsw1gd84o.89.168.29.98.sslip.io/realms/llmind2',
  clientId: 'llmind2',
  clientSecret: 'IgYSMXAOPppB7T743zvdX2WExC3AQq92',
};

const CONFIG_KEY = 'llmind2_app_config';
const TOKEN_KEY = 'llmind2_access_token';
const USER_KEY = 'llmind2_user_info';

// Helper per ottenere la configurazione attiva
export async function getAppConfig(): Promise<AppConfig> {
  try {
    const data = await AsyncStorage.getItem(CONFIG_KEY);
    if (data) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Errore lettura config:', e);
  }
  return DEFAULT_CONFIG;
}

// Helper per salvare la configurazione
export async function saveAppConfig(config: AppConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// Helper per recuperare il token
export async function getAccessToken(): Promise<string | null> {
  return await AsyncStorage.getItem(TOKEN_KEY);
}

// Helper per salvare il token
export async function saveAccessToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

// Helper per rimuovere il token (Logout)
export async function clearAuth(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

// Salva informazioni utente
export async function saveUserInfo(userInfo: any): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(userInfo));
}

// Legge informazioni utente
export async function getUserInfo(): Promise<any | null> {
  const data = await AsyncStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
}

// Funzione base per chiamate API con gestione automatica del token di autenticazione
export async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const config = await getAppConfig();
  const token = await getAccessToken();

  const url = `${config.apiUrl.replace(/\/$/, '')}${path}`;
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Sessione scaduta o non valida, pulisci
    await clearAuth();
    throw new Error('Non autorizzato. Effettua nuovamente il login.');
  }

  if (!response.ok) {
    let errorDetail = 'Errore di rete';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.error || JSON.stringify(errorJson);
    } catch {
      try {
        errorDetail = await response.text();
      } catch {}
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

// --- AUTH API ---
export const authApi = {
  login: async (username: string, password: string): Promise<{ access_token: string }> => {
    const config = await getAppConfig();
    const tokenUrl = `${config.keycloakIssuer}/protocol/openid-connect/token`;

    const bodyParams = new URLSearchParams();
    bodyParams.append('grant_type', 'password');
    bodyParams.append('client_id', config.clientId);
    bodyParams.append('client_secret', config.clientSecret);
    bodyParams.append('username', username);
    bodyParams.append('password', password);
    bodyParams.append('scope', 'openid email profile');

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
    });

    if (!res.ok) {
      let errorMsg = 'Impossibile completare il login con Keycloak.';
      try {
        const errJson = await res.json();
        errorMsg = errJson.error_description || errJson.error || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    const data = await res.json();
    if (!data.access_token) {
      throw new Error('Token non ricevuto da Keycloak.');
    }

    await saveAccessToken(data.access_token);

    // Decodifica basica JWT per estrarre le info utente (email, nome)
    try {
      const parts = data.access_token.split('.');
      if (parts.length === 3) {
        // Base64Url decode
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
          base64 += '=';
        }
        // Utilizziamo un decode standard compatibile con JS core
        const jsonPayload = decodeURIComponent(
          escape(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          )
        );
        const userInfo = JSON.parse(jsonPayload);
        await saveUserInfo(userInfo);
      }
    } catch (jwtErr) {
      console.warn('Impossibile decodificare JWT per info utente:', jwtErr);
      await saveUserInfo({ email: username, preferred_username: username });
    }

    return { access_token: data.access_token };
  },
};

// --- PATIENTS API ---
export interface Patient {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  behaviors: string | null;
  specific_traits: string | null;
  clinical_history: string | null;
  owner_email: string;
  created_at: string;
  updated_at: string;
}

export const patientsApi = {
  list: async (search?: string): Promise<Patient[]> => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiFetch(`/api/patients${query}`);
  },
  get: async (id: string): Promise<Patient> => {
    return apiFetch(`/api/patients/${id}`);
  },
  create: async (patient: Omit<Patient, 'id' | 'owner_email' | 'created_at' | 'updated_at'>): Promise<Patient> => {
    return apiFetch('/api/patients', {
      method: 'POST',
      body: JSON.stringify(patient),
    });
  },
  update: async (id: string, patient: Partial<Patient>): Promise<Patient> => {
    return apiFetch(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patient),
    });
  },
  delete: async (id: string): Promise<{ deleted: boolean; patient_id: string }> => {
    return apiFetch(`/api/patients/${id}`, {
      method: 'DELETE',
    });
  },
  convertFromCase: async (caseId: string): Promise<Patient> => {
    return apiFetch(`/api/patients/convert-from-case/${caseId}`, {
      method: 'POST',
    });
  },
};

// --- CASES API ---
export interface DSM5CaseSummary {
  id: string;
  case_number: string;
  title: string;
  is_reviewed: boolean;
  anamnesis_preview: string;
  source_page: number | null;
  run_count: number;
  created_at: string;
}

export interface DSM5CaseResponse {
  id: string;
  case_number: string;
  title: string;
  anamnesis: string;
  gold_standard_diagnosis: string;
  is_reviewed: boolean;
  source_page: number | null;
  created_at: string;
}

export const casesApi = {
  list: async (
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    reviewedOnly: boolean = false
  ): Promise<{ items: DSM5CaseSummary[]; total: number; page: number; total_pages: number }> => {
    let query = `?page=${page}&page_size=${pageSize}`;
    if (search) query += `&search=${encodeURIComponent(search)}`;
    if (reviewedOnly) query += `&reviewed_only=true`;
    return apiFetch(`/api/cases${query}`);
  },
  get: async (id: string): Promise<DSM5CaseResponse> => {
    return apiFetch(`/api/cases/${id}`);
  },
  getStats: async (): Promise<{ total_cases: number; reviewed: number; pending_review: number }> => {
    return apiFetch('/api/cases/stats/summary');
  },
};

// --- GCP AGENTS API ---
export interface GcpAgent {
  id: string;
  name: string;
  short_name: string;
  description: string;
  use_case: string;
  datastore_scope: string[];
  expected_inputs: string[];
  expected_outputs: string[];
  status: string;
  dialogflow_agent_configured: boolean;
}

export interface GcpChatResponse {
  agent_id: string;
  session_id: string;
  answer: string;
}

export const gcpAgentsApi = {
  list: async (): Promise<{ agents: GcpAgent[] }> => {
    return apiFetch('/api/gcp-agents/agents');
  },
  getStatus: async (liveCheck: boolean = false): Promise<any> => {
    return apiFetch(`/api/gcp-agents/status?live_check=${liveCheck}`);
  },
  chat: async (
    agentId: string,
    message: string,
    sessionId?: string
  ): Promise<GcpChatResponse> => {
    return apiFetch('/api/gcp-agents/chat', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: agentId,
        message,
        session_id: sessionId,
      }),
    });
  },
};

// --- CHAT API (OLLAMA) ---
export interface ChatModel {
  name: string;
  size: number;
  format: string;
  family: string;
}

export interface ChatSession {
  id: string;
  title: string;
  mode: string;
  user_email: string;
  patient_id: string | null;
  is_active: boolean;
  is_pinned: boolean;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode: string;
  model_name: string | null;
  created_at: string;
}

export interface ChatSessionHistory {
  id: string;
  title: string;
  messages: ChatMessage[];
  mode: string;
  patient_id: string | null;
}

export const chatApi = {
  getHealth: async (): Promise<{ status: string; base_url: string; models_count: number }> => {
    return apiFetch('/api/chat/health');
  },
  getModels: async (): Promise<{ models: ChatModel[]; default_model: string }> => {
    return apiFetch('/api/chat/models');
  },
  listSessions: async (): Promise<ChatSession[]> => {
    return apiFetch('/api/chat/sessions');
  },
  updateSession: async (
    sessionId: string,
    params: { title?: string; is_pinned?: boolean; is_starred?: boolean; patient_id?: string | null }
  ): Promise<ChatSession> => {
    let query = '';
    const parts: string[] = [];
    if (params.title !== undefined) parts.push(`title=${encodeURIComponent(params.title)}`);
    if (params.is_pinned !== undefined) parts.push(`is_pinned=${params.is_pinned}`);
    if (params.is_starred !== undefined) parts.push(`is_starred=${params.is_starred}`);
    if (params.patient_id !== undefined) {
      parts.push(`patient_id=${params.patient_id === null ? 'none' : params.patient_id}`);
    }
    if (parts.length > 0) {
      query = `?${parts.join('&')}`;
    }
    return apiFetch(`/api/chat/sessions/${sessionId}${query}`, {
      method: 'PATCH',
    });
  },
  getSessionHistory: async (sessionId: string): Promise<ChatSessionHistory> => {
    return apiFetch(`/api/chat/history/${sessionId}`);
  },
  clearSessionHistory: async (sessionId: string): Promise<{ status: string }> => {
    return apiFetch(`/api/chat/history/${sessionId}`, {
      method: 'DELETE',
    });
  },
  // SSE Chat stream helper
  streamChat: async (
    params: {
      session_id: string;
      message: string;
      mode: 'icd11' | 'wellbeing';
      model_name: string;
      patient_id?: string | null;
    },
    onChunk: (chunk: string) => void,
    onError: (err: any) => void,
    onDone: () => void
  ) => {
    const config = await getAppConfig();
    const token = await getAccessToken();
    const url = `${config.apiUrl.replace(/\/$/, '')}/api/chat/stream`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Nessun stream di risposta supportato.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Mantieni l'ultima linea se non è finita con una newline
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') {
              onDone();
              return;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                onError(new Error(data.error));
              } else if (data.chunk) {
                onChunk(data.chunk);
              }
            } catch (e) {
              console.warn('Errore parsing chunk SSE:', e, dataStr);
            }
          }
        }
      }
      onDone();
    } catch (err: any) {
      onError(err);
    }
  },
};
