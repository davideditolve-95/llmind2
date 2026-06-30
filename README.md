# LLMind2

## Italiano

### Descrizione

LLMind2 e una piattaforma di ricerca scientifica per l'intelligenza artificiale clinica. Il progetto integra esplorazione della tassonomia ICD-11, gestione e benchmarking di casi clinici DSM-5-TR, interazione conversazionale con modelli linguistici eseguiti via Ollama e supporto a datastore documentali per workflow retrieval-augmented generation.

La piattaforma e pensata come base per un progetto di dottorato in AI, non come semplice prototipo dimostrativo. Per questo motivo la repo combina sviluppo prodotto, metodologia sperimentale, documentazione bilingue e materiali orientati al lavoro multi-agente.

### Obiettivi del progetto

- costruire un ambiente di ricerca per reasoning clinico grounding-aware
- confrontare modelli diversi su casi strutturati e valutabili
- mantenere tracciabilita di prompt, output, metriche e revisioni umane
- supportare evoluzione futura verso governance, auditabilita e conformita

### Architettura sintetica

| Livello | Tecnologia |
|---|---|
| Frontend | Next.js 14, React, TailwindCSS |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL 16 |
| AI Runtime | Ollama esterno |
| Fonte ICD-11 | Container WHO offline |
| Infra | Docker Compose, deploy compatibile con Coolify |

### Funzionalita principali

- esplorazione ICD-11 in forma gerarchica e tabellare
- chat persistente con streaming SSE
- benchmark multi-modello su casi DSM-5-TR
- calcolo di metriche automatiche e raccolta di valutazioni manuali
- datastores custom per scenari RAG

### Avvio rapido locale

Prerequisiti:

- Docker Desktop con Compose
- Ollama in esecuzione e modello disponibile, per esempio `gemma4`
- dati sorgente DSM-5-TR disponibili in `backend/data/` quando richiesto

Passi essenziali:

1. creare `.env` a partire da `.env.example`
2. avviare lo stack con Docker Compose
3. eseguire ETL ICD-11
4. opzionalmente estrarre i casi DSM-5-TR
5. aprire frontend e backend

Endpoint locali attesi:

- frontend: `http://localhost:3000`
- backend: `http://localhost:10000`
- docs FastAPI: `http://localhost:10000/docs`

### Variabili d'ambiente chiave

- `DATABASE_URL`
- `ICD11_API_URL`
- `ICD11_CLIENT_ID`
- `ICD11_CLIENT_SECRET`
- `OLLAMA_BASE_URL`
- `OLLAMA_DEFAULT_MODEL`
- `SECRET_KEY`
- `ENVIRONMENT`
- `NEXT_PUBLIC_API_URL`

### Documentazione

Documenti principali:

- [Panoramica progetto / Project overview](docs/00-project-overview.md)
- [Manuale multi-agente / Multi-agent playbook](docs/01-multi-agent-playbook.md)
- [Manuale tecnico / Technical manual](docs/02-technical-manual.md)
- [Manuale d'uso / User manual](docs/03-user-manual.md)
- [Guida al deploy / Deployment guide](docs/04-deployment-guide.md)
- [Maturita cloud / Cloud maturity](docs/05-cloud-maturity.md)
- [Conformita AGID / AGID compliance](docs/06-agid-compliance.md)
- [Prompt inverso / Reverse prompt](docs/07-reverse-prompt.md)
- [Note di ricerca / Research notes](docs/08-research-notes.md)
- [Mappa API, modelli e flussi / API, models, and dataflow map](docs/09-api-dataflow-map.md)
- [Roadmap di tesi / Thesis roadmap](docs/10-thesis-roadmap.md)
- [Protocollo benchmark / Benchmark protocol](docs/11-benchmark-protocol.md)
- [Registro rischi / Risk register](docs/12-risk-register.md)
- [Data governance](docs/13-data-governance.md)
- [Dossier tecnico e priorita / Technical review dossier](docs/14-technical-review-dossier.md)
- [GCP Conversational Agents](gcp-conversational-agents/README.md)
- [Contributing](CONTRIBUTING.md)
- [Agents guide](AGENTS.md)

### Posizionamento corretto

LLMind2 va presentato oggi come:

- piattaforma di ricerca in AI clinica
- ambiente sperimentale per benchmarking e reasoning
- base software per tesi, pubblicazioni e collaborazione multi-agente

Non va ancora presentato come:

- dispositivo medico
- sistema clinico certificato
- piattaforma pronta per uso regolato senza ulteriore hardening

## English

### Description

LLMind2 is a scientific research platform for clinical artificial intelligence. It integrates ICD-11 taxonomy exploration, DSM-5-TR case management and benchmarking, conversational interaction with language models through Ollama, and document datastore support for retrieval-augmented workflows.

The platform is intended as the foundation for a PhD project in AI rather than as a simple demo prototype. For that reason, the repository combines product engineering, experimental methodology, bilingual documentation, and materials for multi-agent collaboration.

### Project goals

- build a research environment for clinically grounded reasoning
- compare multiple models on structured and reviewable cases
- preserve traceability of prompts, outputs, metrics, and human review
- support future evolution toward governance, auditability, and compliance

### Architecture summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, TailwindCSS |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL 16 |
| AI Runtime | External Ollama |
| ICD-11 source | Offline WHO container |
| Infrastructure | Docker Compose, Coolify-compatible deployment |

### Main capabilities

- hierarchical and tabular ICD-11 exploration
- persistent chat with SSE streaming
- multi-model benchmarking on DSM-5-TR clinical cases
- automatic metrics and human evaluation capture
- custom datastores for RAG scenarios

### Local quick start

Prerequisites:

- Docker Desktop with Compose
- Ollama running with an available model, such as `gemma4`
- DSM-5-TR source data placed in `backend/data/` when needed

Essential steps:

1. create `.env` from `.env.example`
2. start the stack with Docker Compose
3. run ICD-11 ETL
4. optionally extract DSM-5-TR cases
5. open frontend and backend

Expected local endpoints:

- frontend: `http://localhost:3000`
- backend: `http://localhost:10000`
- FastAPI docs: `http://localhost:10000/docs`

### Key environment variables

- `DATABASE_URL`
- `ICD11_API_URL`
- `ICD11_CLIENT_ID`
- `ICD11_CLIENT_SECRET`
- `OLLAMA_BASE_URL`
- `OLLAMA_DEFAULT_MODEL`
- `SECRET_KEY`
- `ENVIRONMENT`
- `NEXT_PUBLIC_API_URL`

### Documentation

Main documents:

- [Project overview / Panoramica progetto](docs/00-project-overview.md)
- [Multi-agent playbook / Manuale multi-agente](docs/01-multi-agent-playbook.md)
- [Technical manual / Manuale tecnico](docs/02-technical-manual.md)
- [User manual / Manuale d'uso](docs/03-user-manual.md)
- [Deployment guide / Guida al deploy](docs/04-deployment-guide.md)
- [Cloud maturity / Maturita cloud](docs/05-cloud-maturity.md)
- [AGID compliance / Conformita AGID](docs/06-agid-compliance.md)
- [Reverse prompt / Prompt inverso](docs/07-reverse-prompt.md)
- [Research notes / Note di ricerca](docs/08-research-notes.md)
- [API, models, and dataflow map / Mappa API, modelli e flussi](docs/09-api-dataflow-map.md)
- [Thesis roadmap / Roadmap di tesi](docs/10-thesis-roadmap.md)
- [Benchmark protocol / Protocollo benchmark](docs/11-benchmark-protocol.md)
- [Risk register / Registro rischi](docs/12-risk-register.md)
- [Data governance](docs/13-data-governance.md)
- [Technical review dossier / Dossier tecnico e priorita](docs/14-technical-review-dossier.md)
- [GCP Conversational Agents](gcp-conversational-agents/README.md)
- [Contributing](CONTRIBUTING.md)
- [Agents guide](AGENTS.md)

### Correct positioning

LLMind2 should currently be presented as:

- a clinical AI research platform
- an experimental environment for benchmarking and reasoning
- a software foundation for thesis work, publications, and multi-agent collaboration

It should not yet be presented as:

- a medical device
- a certified clinical system
- a ready-for-regulated-use platform without further hardening
