# Mappa API, Modelli e Flussi / API, Model, and Dataflow Map

## Italiano

### Scopo del documento

Questo documento serve come mappa operativa della piattaforma. E pensato per chi deve lavorare con piu agenti, fare refactor in sicurezza, preparare una tesi o spiegare a terzi come il sistema trasforma input clinici e richieste utente in dati persistenti e risultati sperimentali.

### Router principali del backend

#### Root e health

- `GET /`
- `GET /health`

Questi endpoint descrivono stato applicativo di base e disponibilita del backend.

#### ICD-11

- `GET /api/icd11/tree`
- `GET /api/icd11/node/{node_id}/children`
- `GET /api/icd11/node/{node_id}`
- `GET /api/icd11/search`
- `GET /api/icd11/codes`
- `GET /api/icd11/stats`

Questa famiglia di endpoint alimenta la navigazione tassonomica, la ricerca e la consultazione tabellare.

#### Chat

- `GET /api/chat/health`
- `POST /api/chat/test`
- `GET /api/chat/models`
- `GET /api/chat/sessions`
- `PATCH /api/chat/sessions/{session_id}`
- `POST /api/chat/stream`
- `GET /api/chat/history/{session_id}`
- `DELETE /api/chat/history/{session_id}`

La chat e una combinazione di session management, test inferenziale e streaming conversazionale persistente.

#### Casi clinici

- `GET /api/cases`
- `GET /api/cases/{case_id}`
- `PUT /api/cases/{case_id}`
- `DELETE /api/cases/{case_id}`
- `GET /api/cases/stats/summary`

Questi endpoint sostengono la revisione editoriale dei casi e l'integrita del corpus sperimentale.

#### Benchmark

- `POST /api/benchmark/run`
- `POST /api/benchmark/stop`
- `POST /api/benchmark/runs/{run_id}/retry`
- `GET /api/benchmark/history`
- `POST /api/benchmark/runs/{run_id}/evaluations`
- `DELETE /api/benchmark/runs/{run_id}/evaluations/{eval_id}`
- `DELETE /api/benchmark/history`
- `GET /api/benchmark/kpis`
- `GET /api/benchmark/batch/{batch_id}/kpis`
- `GET /api/benchmark/export`

Questa e l'area piu importante per la ricerca quantitativa.

#### Datastore

- `GET /api/datastore/presets`
- `POST /api/datastore/create`
- `GET /api/datastore/list`
- `DELETE /api/datastore/{datastore_id}`
- `POST /api/datastore/{datastore_id}/ask`

Questi endpoint supportano workflow RAG e archivi documentali custom.

#### Legacy e sistema

- `POST /api/legacy/ask`
- `POST /api/legacy/batch-run`
- `GET /api/legacy/logs`
- `GET /api/system/logs`

Sono utili per compatibilita retrospettiva, debugging e confronto con pipeline precedenti.

### Modelli persistenti principali

#### `ICD11Category`

Entita tassonomica ricca con campi diagnostici e relazioni gerarchiche.

#### `ChatSession` e `ChatMessage`

Entita per persistere il dialogo uomo-modello e renderlo riesaminabile.

#### `DSM5Case`

Entita sorgente del benchmark con anamnesi, discussione, gold standard e note di revisione.

#### `BenchmarkRun`

Entita centrale dell'esperimento: lega un caso, un modello, un prompt, una risposta e metriche associate.

#### `ManualEvaluation`

Entita che aggiunge giudizio umano a posteriori e rende il sistema metodologicamente piu forte.

#### `Datastore`

Entita di configurazione e stato per knowledge base RAG create dall'utente.

### Flussi dati principali

#### Flusso 1: popolamento ICD-11

1. il container WHO espone il contenuto ICD-11
2. gli script ETL estraggono e normalizzano i dati
3. il backend persiste i nodi in PostgreSQL
4. il frontend interroga l'albero, i dettagli e la ricerca

#### Flusso 2: casi clinici DSM-5-TR

1. un PDF o file sorgente entra in `backend/data/`
2. gli script producono dati strutturati
3. i casi vengono persistiti in `dsm5_cases`
4. l'utente corregge manualmente il testo se necessario
5. il corpus revisionato diventa base sperimentale

#### Flusso 3: benchmark

1. l'utente seleziona casi e modelli dal frontend
2. il backend crea record `pending`
3. il task asincrono costruisce i prompt
4. Ollama produce l'inferenza oppure viene usata la pipeline legacy
5. il servizio embeddings calcola la similarita
6. i risultati vengono salvati in `benchmark_runs`
7. l'utente puo aggiungere valutazioni manuali

#### Flusso 4: chat

1. l'utente apre o crea una sessione
2. il backend carica la cronologia
3. sceglie il system prompt in base alla modalita
4. invia la richiesta a Ollama
5. restituisce i token via SSE
6. salva il messaggio assistant a fine stream

### Rischi strutturali da conoscere

- benchmark stop basato su flag globale, non per-utente
- assenza di auth puo rendere difficile governare accessi e audit
- create-all a startup e reset schema chat sono pragmatici ma non ideali per ambienti fortemente controllati

## English

### Purpose of this document

This document acts as an operational map of the platform. It is designed for multi-agent collaboration, safe refactoring, thesis preparation, and technical explanation of how the system transforms clinical inputs and user requests into persisted data and experimental outputs.

### Main backend routers

#### Root and health

- `GET /`
- `GET /health`

These endpoints describe basic application state and backend reachability.

#### ICD-11

- `GET /api/icd11/tree`
- `GET /api/icd11/node/{node_id}/children`
- `GET /api/icd11/node/{node_id}`
- `GET /api/icd11/search`
- `GET /api/icd11/codes`
- `GET /api/icd11/stats`

This family of endpoints powers taxonomy navigation, search, and tabular inspection.

#### Chat

- `GET /api/chat/health`
- `POST /api/chat/test`
- `GET /api/chat/models`
- `GET /api/chat/sessions`
- `PATCH /api/chat/sessions/{session_id}`
- `POST /api/chat/stream`
- `GET /api/chat/history/{session_id}`
- `DELETE /api/chat/history/{session_id}`

The chat subsystem combines session management, inference testing, and persistent streaming conversation.

#### Clinical cases

- `GET /api/cases`
- `GET /api/cases/{case_id}`
- `PUT /api/cases/{case_id}`
- `DELETE /api/cases/{case_id}`
- `GET /api/cases/stats/summary`

These endpoints support editorial review and maintenance of the experimental corpus.

#### Benchmark

- `POST /api/benchmark/run`
- `POST /api/benchmark/stop`
- `POST /api/benchmark/runs/{run_id}/retry`
- `GET /api/benchmark/history`
- `POST /api/benchmark/runs/{run_id}/evaluations`
- `DELETE /api/benchmark/runs/{run_id}/evaluations/{eval_id}`
- `DELETE /api/benchmark/history`
- `GET /api/benchmark/kpis`
- `GET /api/benchmark/batch/{batch_id}/kpis`
- `GET /api/benchmark/export`

This is the most important area for quantitative research.

#### Datastore

- `GET /api/datastore/presets`
- `POST /api/datastore/create`
- `GET /api/datastore/list`
- `DELETE /api/datastore/{datastore_id}`
- `POST /api/datastore/{datastore_id}/ask`

These endpoints support RAG workflows and user-managed knowledge stores.

#### Legacy and system

- `POST /api/legacy/ask`
- `POST /api/legacy/batch-run`
- `GET /api/legacy/logs`
- `GET /api/system/logs`

These are useful for backward comparison, debugging, and compatibility with earlier workflows.

### Main persistent models

#### `ICD11Category`

Rich taxonomic entity with diagnostic metadata and hierarchical relations.

#### `ChatSession` and `ChatMessage`

Entities for persisting human-model dialog and enabling later inspection.

#### `DSM5Case`

Source benchmark entity with anamnesis, discussion, gold standard, and review notes.

#### `BenchmarkRun`

Central experimental entity linking a case, a model, a prompt, a response, and related metrics.

#### `ManualEvaluation`

Entity for adding human assessment and strengthening the methodological quality of the benchmark.

#### `Datastore`

Configuration and status entity for user-created RAG knowledge stores.

### Main dataflows

#### Flow 1: ICD-11 population

1. the WHO container exposes ICD-11 content
2. ETL scripts extract and normalize the data
3. the backend persists nodes into PostgreSQL
4. the frontend queries tree, detail, and search endpoints

#### Flow 2: DSM-5-TR clinical cases

1. a PDF or source file enters `backend/data/`
2. scripts generate structured output
3. cases are persisted into `dsm5_cases`
4. the user manually corrects text if necessary
5. the reviewed corpus becomes the experimental basis

#### Flow 3: benchmark

1. the user selects cases and models in the frontend
2. the backend creates `pending` run records
3. an asynchronous task builds prompts
4. Ollama or the legacy pipeline executes inference
5. the embedding service computes similarity
6. results are saved into `benchmark_runs`
7. the user may add manual evaluations

#### Flow 4: chat

1. the user opens or creates a session
2. the backend loads history
3. it selects the system prompt by mode
4. it sends the request to Ollama
5. tokens are returned through SSE
6. the assistant message is persisted at stream completion

### Structural risks worth tracking

- benchmark stop uses a global flag rather than a per-user control
- lack of authentication makes access governance and audit difficult
- startup `create_all` and chat schema reset are pragmatic but not ideal for tightly controlled environments

