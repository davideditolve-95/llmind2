# Manuale Tecnico / Technical Manual

## Italiano

### Architettura logica

LLMind2 adotta un'architettura a strati con separazione netta tra presentazione, servizi applicativi e persistenza. Questa scelta e corretta per un progetto di ricerca perche rende possibile evolvere i singoli moduli in modo indipendente, confrontare varianti implementative e produrre evidenza sperimentale piu pulita.

- frontend: Next.js App Router per esperienza utente, dashboard, benchmark e navigazione
- backend: FastAPI per API REST, streaming SSE e coordinamento della logica di dominio
- database: PostgreSQL per persistenza strutturata di tassonomia, chat, casi e benchmark
- AI runtime: Ollama esterno per inferenza e embeddings
- fonte nosologica: container WHO ICD-11 offline

### Architettura fisica

La distribuzione locale usa `docker-compose.yml` e prevede quattro servizi principali:

- `frontend`
- `backend`
- `db`
- `icd11-api`

Ollama e esplicitamente esterno al cluster Docker. Questa decisione ha due implicazioni importanti:

- semplifica il riuso di modelli gia presenti sulla macchina host o su un endpoint remoto
- introduce una dipendenza di rete che deve essere governata con attenzione in deploy e benchmarking

### Struttura del backend

Il backend e organizzato in moduli comprensibili e ben separati:

- `app/main.py`: bootstrap applicativo, logging, router, CORS, startup
- `app/config.py`: lettura centralizzata delle variabili d'ambiente
- `app/database.py`: engine SQLAlchemy, sessioni e dependency injection
- `app/models/`: modellazione persistente del dominio
- `app/schemas/`: contratti Pydantic di input e output
- `app/routers/`: entrypoint HTTP per ciascun sottosistema
- `app/services/`: logica di integrazione con Ollama, embeddings, ingestion e legacy RAG

### Struttura del frontend

Il frontend presenta una stratificazione sufficientemente chiara per uso scientifico:

- `frontend/app/`: pagine e route dell'interfaccia
- `frontend/components/ui/`: componenti condivisi
- `frontend/lib/api.ts`: client applicativo verso il backend
- `frontend/lib/i18n/`: internazionalizzazione inglese-italiano

L'applicazione ha gia superfici dedicate a:

- home di prodotto
- chat
- benchmark analytics
- gestione casi benchmark
- datastores
- explorer legacy e impostazioni

### Modello dati principale

Il dominio persistente ruota attorno a quattro famiglie di entita.

#### ICD-11

La tabella `icd11_categories` rappresenta la tassonomia ICD-11 locale. Ogni nodo puo avere:

- codice
- titoli in inglese e italiano
- descrizione
- livello gerarchico
- parent-child relation
- metadati clinici aggiuntivi come inclusions, exclusions, diagnostic criteria e coding notes

Questa ricchezza e molto utile in prospettiva scientifica per studi di grounding ontologico e retrieval semantico.

#### Chat

Le entita `chat_sessions` e `chat_history` permettono di:

- mantenere conversazioni persistenti
- separare modalita `icd11` e `wellbeing`
- registrare il modello usato
- salvare output e contesto per analisi successive

#### Benchmark

Il cuore sperimentale del progetto risiede in:

- `dsm5_cases`
- `benchmark_runs`
- `manual_evaluations`

Questo design consente di distinguere chiaramente:

- dato sorgente
- esecuzione del modello
- valutazione automatica
- valutazione umana

#### Datastore

La tabella `datastores` descrive archivi RAG custom con:

- nome e descrizione
- modello usato
- sorgenti documentali
- path del vector store
- stato del processo di creazione

### Pattern applicativi importanti

#### Streaming chat

La chat usa Server-Sent Events. Questo pattern e adatto a interfacce di reasoning perche consente:

- latenza percepita piu bassa
- visualizzazione progressiva del ragionamento
- esperienza piu naturale nei test qualitativi

#### Benchmark asincrono

L'esecuzione benchmark usa `BackgroundTasks`. Questo va bene in una fase research-prototype, ma va letto con realismo:

- e adeguato per batch moderati e ambiente mono-istanza
- non e ancora una coda distribuita robusta
- il flag globale di stop mostra che il disegno e ancora orientato a un solo nodo applicativo

#### Startup con auto-sincronizzazione schema

Il backend esegue `Base.metadata.create_all()` e include logica di reset per mismatch su tabelle chat legacy. Questo e pragmatico per sviluppo e migrazione rapida, ma in produzione controllata andrebbe sostituito con migrazioni piu formali e tracciabili.

### Osservazioni tecniche rilevanti

- CORS e attualmente permissivo e va ristretto in produzione
- non emerge un layer di autenticazione o autorizzazione
- la dipendenza da Ollama esterno e una forza per la flessibilita, ma un rischio per riproducibilita e disponibilita se non versionata bene
- la struttura dati benchmark e gia abbastanza matura per studi quantitativi
- l'internazionalizzazione frontend e presente, quindi la scelta di documentazione bilingue e coerente con il prodotto

### Uso corretto del sistema in ricerca

Per sfruttare bene il progetto in ambito scientifico bisogna trattare come oggetti versionabili almeno:

- prompt
- system prompt
- modelli Ollama
- configurazioni del benchmark
- snapshot dei dataset
- output dei run

In assenza di questa disciplina si rischia di avere una piattaforma bella ma sperimentalmente debole.

## English

### Logical architecture

LLMind2 adopts a layered architecture with a clear separation between presentation, application services, and persistence. This is a strong fit for a research project because it allows independent evolution of modules, controlled experimentation, and clearer attribution of system behavior.

- frontend: Next.js App Router for user experience, dashboards, and benchmark workflows
- backend: FastAPI for REST APIs, SSE streaming, and domain orchestration
- database: PostgreSQL for structured persistence
- AI runtime: external Ollama for inference and embeddings
- nosological source: offline WHO ICD-11 container

### Physical architecture

Local deployment relies on `docker-compose.yml` and includes four main services:

- `frontend`
- `backend`
- `db`
- `icd11-api`

Ollama is intentionally external to the Compose cluster. This provides flexibility for local or remote model hosting, but it also introduces an explicit network dependency that must be managed carefully for deployment and experimental reproducibility.

### Backend structure

The backend is organized into clean functional layers:

- `app/main.py`: bootstrap, logging, router registration, CORS, startup behavior
- `app/config.py`: centralized environment configuration
- `app/database.py`: SQLAlchemy engine, sessions, dependency injection
- `app/models/`: persistent domain entities
- `app/schemas/`: typed API contracts
- `app/routers/`: HTTP entrypoints by subsystem
- `app/services/`: integration logic for Ollama, embeddings, ingestion, and legacy RAG

### Frontend structure

The frontend is sufficiently modular for research-facing workflows:

- `frontend/app/`: route-level pages
- `frontend/components/ui/`: shared UI components
- `frontend/lib/api.ts`: backend client layer
- `frontend/lib/i18n/`: bilingual internationalization support

The application already exposes distinct product surfaces for home, chat, benchmark analytics, benchmark case management, datastores, legacy exploration, and settings.

### Core data model

The persistent domain is centered on four entity families.

#### ICD-11

The `icd11_categories` table stores the local ICD-11 hierarchy, including:

- code
- English and Italian titles
- descriptions
- hierarchical level
- parent-child links
- clinically relevant metadata such as inclusions, exclusions, diagnostic criteria, and coding notes

This is especially valuable for ontology grounding and structured retrieval research.

#### Chat

The `chat_sessions` and `chat_history` entities enable:

- persistent conversations
- clear separation between `icd11` and `wellbeing` modes
- recording of the selected model
- future analysis of dialog behavior over time

#### Benchmark

The research core of the project is built around:

- `dsm5_cases`
- `benchmark_runs`
- `manual_evaluations`

This model cleanly separates source data, model execution, automatic metrics, and human assessment.

#### Datastore

The `datastores` table describes custom RAG knowledge stores with:

- name and description
- chosen model
- source documents
- vector store path
- creation status

### Important application patterns

#### Streaming chat

Chat uses Server-Sent Events, which is well suited to reasoning-oriented interfaces because it lowers perceived latency and supports progressive inspection of generated output.

#### Asynchronous benchmark execution

Benchmark execution uses `BackgroundTasks`. This is appropriate for a research prototype but should be interpreted realistically:

- suitable for moderate batch loads and a single application node
- not yet a robust distributed queue
- the global stop flag indicates a single-instance operational assumption

#### Startup schema synchronization

The backend creates tables at startup and includes pragmatic recovery logic for legacy chat schema mismatches. That is useful during active iteration, but a more formal migration workflow would be preferable for controlled production research environments.

### Key technical observations

- CORS is currently permissive and should be tightened for production
- no clear authentication or authorization layer is visible
- the external Ollama dependency is flexible but must be versioned carefully for reproducibility
- the benchmark data model is already mature enough for quantitative studies
- frontend internationalization makes bilingual documentation a natural fit

### Correct research use

To use the platform rigorously in scientific work, the following should be treated as versioned experimental objects:

- prompts
- system prompts
- Ollama model identifiers
- benchmark configurations
- dataset snapshots
- run outputs

Without this discipline, the platform may remain impressive as software but weak as experimental infrastructure.

