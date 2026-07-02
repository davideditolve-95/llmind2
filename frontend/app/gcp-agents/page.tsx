'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowPathIcon,
  BeakerIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  CircleStackIcon,
  ClipboardDocumentCheckIcon,
  CloudIcon,
  ExclamationTriangleIcon,
  FingerPrintIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { gcpAgentsApi, type GcpAgentDefinition, type GcpAgentsStatus } from '@/lib/api';

type AgentId =
  | 'clinical-intake'
  | 'icd11-coding'
  | 'differential-supervisor'
  | 'benchmark-reviewer'
  | 'protocol-navigator'
  | 'safety-guardrail';

interface AgentGuide {
  id: AgentId;
  name: string;
  shortName: string;
  status: 'planned' | 'ready-for-deploy';
  icon: typeof ChatBubbleLeftRightIcon;
  accent: string;
  summary: string;
  useWhen: string[];
  inputs: string[];
  outputs: string[];
  datastores: string[];
  handoff: string;
}

const agents: AgentGuide[] = [
  {
    id: 'clinical-intake',
    name: 'Clinical Intake Triage',
    shortName: 'Intake',
    status: 'ready-for-deploy',
    icon: ChatBubbleLeftRightIcon,
    accent: 'text-primary',
    summary: 'Raccoglie una vignetta clinica, identifica dati mancanti e decide quale agente specialistico deve intervenire.',
    useWhen: [
      'Hai una descrizione clinica non strutturata.',
      'Vuoi capire quali informazioni mancano prima del reasoning.',
      'Serve instradare tra ICD-11, diagnosi differenziale, benchmark o safety.',
    ],
    inputs: ['presenting concern', 'eta o fase evolutiva', 'durata', 'impairment', 'rischio', 'sostanze/farmaci', 'contesto medico'],
    outputs: ['neutral case summary', 'missing information', 'risk flags', 'recommended route', 'one best follow-up question'],
    datastores: ['BigQuery agent_corpus_chunks', 'LLMind2 research protocols'],
    handoff: 'Invia a ICD-11 Coding, Differential Supervisor, Benchmark Reviewer o Safety Guardrail.',
  },
  {
    id: 'icd11-coding',
    name: 'ICD-11 Coding Assistant',
    shortName: 'ICD-11',
    status: 'ready-for-deploy',
    icon: BookOpenIcon,
    accent: 'text-info',
    summary: 'Mappa sintomi, descrizioni e diagnosi candidate verso categorie ICD-11 con incertezza esplicita.',
    useWhen: [
      'Devi cercare categorie ICD-11 candidate.',
      'Vuoi controllare esclusioni, inclusioni e confini diagnostici.',
      'Vuoi confrontare una label DSM con la terminologia ICD-11.',
    ],
    inputs: ['clinical concept', 'candidate label', 'duration', 'functional impairment', 'exclusions already checked'],
    outputs: ['candidate categories', 'supporting features', 'features against', 'required exclusions', 'coding confidence'],
    datastores: ['BigQuery icd11_categories', 'BigQuery agent_corpus_chunks', 'GCP ICD-11 CDDR datastore'],
    handoff: 'Se emergono ipotesi concorrenti, passa al Differential Diagnosis Supervisor.',
  },
  {
    id: 'differential-supervisor',
    name: 'Differential Diagnosis Supervisor',
    shortName: 'Differential',
    status: 'ready-for-deploy',
    icon: SparklesIcon,
    accent: 'text-secondary',
    summary: 'Costruisce una diagnosi differenziale trasparente separando fatti, ipotesi, evidenze pro/contro e dati mancanti.',
    useWhen: [
      'Hai una vignetta sufficientemente ricca.',
      'Vuoi confrontare piu ipotesi diagnostiche.',
      'Serve evidenziare condizioni da non perdere e confondenti medici/sostanze.',
    ],
    inputs: ['structured vignette', 'risk status', 'course', 'medical/substance context', 'developmental and cultural context'],
    outputs: ['ranked differential table', 'must-not-miss conditions', 'exclusions to check', 'uncertainty level', 'next question'],
    datastores: ['BigQuery agent_corpus_chunks', 'ICD-11 CDDR', 'DSM-5-TR cases'],
    handoff: 'Se il caso e incompleto torna a Intake; se serve codice passa a ICD-11 Coding.',
  },
  {
    id: 'benchmark-reviewer',
    name: 'Benchmark Case Reviewer',
    shortName: 'Benchmark',
    status: 'ready-for-deploy',
    icon: ClipboardDocumentCheckIcon,
    accent: 'text-accent',
    summary: 'Controlla casi DSM estratti prima del benchmark: leakage, artefatti OCR, campi separati e gold standard.',
    useWhen: [
      'Stai preparando casi per benchmark.',
      'Vuoi verificare se Introduction, Discussion e Diagnosis sono separati.',
      'Vuoi evitare leakage della diagnosi nel prompt.',
    ],
    inputs: ['case number', 'introduction', 'discussion', 'diagnosis', 'extraction version'],
    outputs: ['readiness status', 'leakage risk', 'artifact flags', 'cleanup actions', 'human review required'],
    datastores: ['BigQuery dsm5_cases', 'BigQuery agent_corpus_chunks'],
    handoff: 'Se la diagnosi deve cambiare, richiede revisione umana prima di qualsiasi modifica.',
  },
  {
    id: 'protocol-navigator',
    name: 'Research Protocol Navigator',
    shortName: 'Protocol',
    status: 'ready-for-deploy',
    icon: BeakerIcon,
    accent: 'text-success',
    summary: 'Aiuta a navigare metodologia, roadmap di tesi, governance, metriche e minacce alla validita.',
    useWhen: [
      'Devi progettare un esperimento riproducibile.',
      'Vuoi decidere metriche, prompt versioning o leakage controls.',
      'Serve distinguere task ingegneristici da scelte metodologiche.',
    ],
    inputs: ['research question', 'dataset scope', 'model setup', 'evaluation target', 'constraints'],
    outputs: ['evaluation protocol', 'metrics', 'human review plan', 'validity threats', 'next action'],
    datastores: ['LLMind2 research protocols', 'BigQuery static corpus summaries'],
    handoff: 'Quando serve audit su casi specifici, passa al Benchmark Case Reviewer.',
  },
  {
    id: 'safety-guardrail',
    name: 'Safety and Scope Guardrail',
    shortName: 'Safety',
    status: 'ready-for-deploy',
    icon: ShieldCheckIcon,
    accent: 'text-error',
    summary: 'Gestisce rischio, privacy, uso fuori perimetro e richieste che sembrano cliniche operative.',
    useWhen: [
      'Compare rischio acuto o emergenza.',
      'La richiesta contiene dati identificativi o paziente reale.',
      'Qualcuno chiede diagnosi/trattamento o bypass della revisione umana.',
    ],
    inputs: ['risk signal', 'request type', 'identifiability', 'deployment context'],
    outputs: ['risk level', 'safe response', 'allowed research support', 'required human review'],
    datastores: ['LLMind2 governance docs', 'Safety playbook specification'],
    handoff: 'Blocca l’uso clinico diretto e riporta il flusso dentro ricerca o revisione qualificata.',
  },
];

const readiness = [
  'Terraform project/workload applicato su GCP',
  'PDF sorgente sincronizzati su GCS',
  'Corpus statico caricato in BigQuery',
  'Dialogflow agent creato',
  'Playbook caricati',
  'GCP Agent Search datastores imported',
  'Backend proxy configurato con project/location/agent id',
];

interface ChatTurn {
  role: 'user' | 'agent';
  content: string;
  meta?: string;
}

export default function GcpAgentsPage() {
  const [selected, setSelected] = useState<AgentId>('clinical-intake');
  const [backendAgents, setBackendAgents] = useState<GcpAgentDefinition[]>([]);
  const [status, setStatus] = useState<GcpAgentsStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [liveChecking, setLiveChecking] = useState(false);
  const [sessionId, setSessionId] = useState(`llmind-${Date.now()}`);
  const [languageCode, setLanguageCode] = useState('en');
  const [message, setMessage] = useState('');
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const active = agents.find((agent) => agent.id === selected) ?? agents[0];
  const backendActive = backendAgents.find((agent) => agent.id === selected);
  const canSend = Boolean(status?.configured) && !sending && message.trim().length > 0;

  const loadStatus = async (liveCheck = false) => {
    setStatusError(null);
    if (liveCheck) {
      setLiveChecking(true);
    } else {
      setLoadingStatus(true);
    }
    try {
      const [statusResponse, agentsResponse] = await Promise.all([
        gcpAgentsApi.getStatus(liveCheck),
        gcpAgentsApi.listAgents(),
      ]);
      setStatus(statusResponse);
      setBackendAgents(agentsResponse.agents);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Backend status unavailable');
    } finally {
      setLoadingStatus(false);
      setLiveChecking(false);
    }
  };

  useEffect(() => {
    loadStatus(false);
  }, []);

  const sendMessage = async () => {
    const cleanMessage = message.trim();
    if (!cleanMessage || !canSend) return;
    setSending(true);
    setChatError(null);
    setMessage('');
    setChatTurns((turns) => [...turns, { role: 'user', content: cleanMessage, meta: active.shortName }]);
    try {
      const response = await gcpAgentsApi.chat({
        agent_id: selected,
        message: cleanMessage,
        session_id: sessionId,
        language_code: languageCode,
      });
      setSessionId(response.session_id);
      setChatTurns((turns) => [
        ...turns,
        {
          role: 'agent',
          content: response.answer || 'The deployed agent returned no text response.',
          meta: response.match?.intent?.displayName ?? response.agent_id,
        },
      ]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Agent call failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="app-page space-y-6">
      <section className="hero rounded-box border border-info/20 bg-base-100 shadow-sm">
        <div className="hero-content w-full justify-between gap-8 py-8">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="badge badge-info">Experimental agents</span>
              <span className="badge badge-outline">GCP Conversational Agents</span>
              <span className="badge badge-outline">Guide + live proxy</span>
              <span className={clsx('badge', status?.configured ? 'badge-success' : 'badge-warning')}>
                {status?.configured ? 'Configured' : 'Waiting for deploy'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <CloudIcon className="h-9 w-9 text-info" />
              <h1 className="app-title">Experimental Agents Console</h1>
            </div>
            <p className="app-subtitle mt-3">
              A secondary research layer for specialist agents. It explains each GCP agent, when to use it, and how to call the deployed Dialogflow CX runtime when credentials are configured.
            </p>
          </div>
          <div className="hidden rounded-box bg-info/10 p-4 text-sm lg:block">
            <div className="font-semibold text-info">Runtime state</div>
            <div className="text-base-content/70">
              {loadingStatus ? 'Checking backend...' : status?.message ?? 'Backend status unavailable.'}
            </div>
          </div>
        </div>
      </section>

      <div className={clsx('alert', status?.configured ? 'alert-success' : 'alert-info')}>
        <ExclamationTriangleIcon className="h-5 w-5" />
        <span>
          No mock interaction is enabled here. Messages are sent only to the configured GCP agent runtime; otherwise the console explains exactly what is missing.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <aside className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Agent menu</h2>
            <p className="text-sm text-base-content/60">Choose the goal first; the selected card explains which agent should handle it.</p>
            <div className="mt-2 space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  className={clsx(
                    'btn h-auto w-full justify-start gap-3 px-3 py-3 text-left normal-case',
                    selected === agent.id ? 'btn-primary' : 'btn-ghost bg-base-200/70'
                  )}
                  onClick={() => setSelected(agent.id)}
                >
                  <agent.icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{agent.shortName}</span>
                    <span className="block truncate text-xs opacity-70">{agent.status === 'ready-for-deploy' ? 'Spec ready' : 'Planned'}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="card bg-base-100 shadow-sm">
          <div className="card-body gap-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <active.icon className={clsx('h-8 w-8', active.accent)} />
                  <div>
                    <h2 className="text-2xl font-semibold">{active.name}</h2>
                    <p className="mt-1 text-base-content/70">{active.summary}</p>
                  </div>
                </div>
              </div>
              <span className="badge badge-outline gap-2">
                <FingerPrintIcon className="h-4 w-4" />
                {active.id}
              </span>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-box bg-base-200 p-4">
                <h3 className="mb-3 font-semibold">Use this agent when</h3>
                <ul className="space-y-2">
                  {active.useWhen.map((item) => (
                    <li key={item} className="flex gap-2 text-sm">
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-box bg-base-200 p-4">
                <h3 className="mb-3 font-semibold">Expected inputs</h3>
                <div className="flex flex-wrap gap-2">
                  {active.inputs.map((item) => (
                    <span key={item} className="badge badge-outline">{item}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-box bg-base-200 p-4">
                <h3 className="mb-3 font-semibold">Expected outputs</h3>
                <div className="flex flex-wrap gap-2">
                  {active.outputs.map((item) => (
                    <span key={item} className="badge badge-primary badge-outline">{item}</span>
                  ))}
                </div>
              </div>

              <div className="rounded-box bg-base-200 p-4">
                <h3 className="mb-3 font-semibold">GCP datastore sources</h3>
                <div className="space-y-2">
                  {active.datastores.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <CircleStackIcon className="h-4 w-4 text-info" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="alert">
              <ClipboardDocumentCheckIcon className="h-5 w-5" />
              <span>{backendActive?.use_case ?? active.handoff}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="card-title">Live readiness</h2>
                <p className="text-sm text-base-content/60">
                  This panel checks whether LLMind can talk to the deployed GCP agent without exposing Google credentials in the browser.
                </p>
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => loadStatus(true)}
                disabled={liveChecking || loadingStatus}
              >
                <ArrowPathIcon className={clsx('h-4 w-4', liveChecking && 'animate-spin')} />
                Live check
              </button>
            </div>

            {statusError ? (
              <div className="alert alert-warning mt-4">
                <ExclamationTriangleIcon className="h-5 w-5" />
                <span>{statusError}</span>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="stats stats-vertical w-full bg-base-200 lg:stats-horizontal">
                  <div className="stat">
                    <div className="stat-title">Configuration</div>
                    <div className={clsx('stat-value text-lg', status?.configured ? 'text-success' : 'text-warning')}>
                      {status?.configured ? 'Ready' : 'Incomplete'}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Live agent</div>
                    <div className={clsx('stat-value text-lg', status?.online ? 'text-success' : 'text-base-content/60')}>
                      {status?.online ? 'Online' : 'Not checked'}
                    </div>
                  </div>
                </div>

                <div className="rounded-box border border-base-300 bg-base-200/60 p-4 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div><span className="font-semibold">Project:</span> {status?.project_id || 'missing'}</div>
                    <div><span className="font-semibold">Location:</span> {status?.location || 'missing'}</div>
                    <div><span className="font-semibold">Endpoint:</span> {status?.api_endpoint || 'missing'}</div>
                    <div><span className="font-semibold">Agent map:</span> {status?.agent_map_present ? 'enabled' : 'single/default agent'}</div>
                  </div>
                </div>

                {!status?.configured && (
                  <div className="rounded-box border border-warning/30 bg-warning/10 p-4">
                    <div className="font-semibold text-warning">Missing before deploy</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(status?.missing ?? []).map((item) => (
                        <span key={item} className="badge badge-warning badge-outline">{item}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="card-title">Talk to deployed agent</h2>
                <p className="text-sm text-base-content/60">
                  The selected menu agent is passed as routing context to GCP. If you configure a JSON agent map, each logical agent can use its own Dialogflow agent id.
                </p>
              </div>
              <span className="badge badge-outline">{active.name}</span>
            </div>

            <div className="mt-2 grid gap-3 md:grid-cols-[1fr_8rem]">
              <label className="form-control">
                <div className="label"><span className="label-text">Session id</span></div>
                <input
                  className="input input-bordered"
                  value={sessionId}
                  onChange={(event) => setSessionId(event.target.value)}
                  placeholder="llmind-session"
                />
              </label>
              <label className="form-control">
                <div className="label"><span className="label-text">Language</span></div>
                <input
                  className="input input-bordered"
                  value={languageCode}
                  onChange={(event) => setLanguageCode(event.target.value)}
                  placeholder="en"
                />
              </label>
            </div>

            <div className="min-h-48 rounded-box border border-base-300 bg-base-200/50 p-4">
              {chatTurns.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-center text-sm text-base-content/60">
                  No conversation yet. Configure GCP, choose an agent from the menu, then send a real request.
                </div>
              ) : (
                <div className="space-y-3">
                  {chatTurns.map((turn, index) => (
                    <div key={`${turn.role}-${index}`} className={clsx('chat', turn.role === 'user' ? 'chat-end' : 'chat-start')}>
                      <div className="chat-header text-xs opacity-70">{turn.role === 'user' ? 'You' : active.shortName} {turn.meta && `- ${turn.meta}`}</div>
                      <div className={clsx('chat-bubble whitespace-pre-wrap', turn.role === 'user' ? 'chat-bubble-primary' : 'chat-bubble-neutral')}>
                        {turn.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {chatError && (
              <div className="alert alert-error">
                <ExclamationTriangleIcon className="h-5 w-5" />
                <span>{chatError}</span>
              </div>
            )}

            <div className="join w-full">
              <textarea
                className="textarea textarea-bordered join-item min-h-24 flex-1 resize-none"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={status?.configured ? `Ask ${active.shortName}...` : 'Configure GCP before sending live messages.'}
                disabled={!status?.configured || sending}
              />
              <button className="btn btn-primary join-item h-auto" onClick={sendMessage} disabled={!canSend}>
                {sending ? <span className="loading loading-spinner loading-sm" /> : <PaperAirplaneIcon className="h-5 w-5" />}
                Send
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-6 w-6 text-success" />
            <h2 className="card-title">Deployment readiness</h2>
          </div>
          <p className="text-sm text-base-content/60">When these items are complete, the interface can switch from guide mode to live GCP interaction.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {readiness.map((item) => (
              <div key={item} className="rounded-box border border-base-300 bg-base-200/50 p-3 text-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
