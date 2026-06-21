# Reverse Prompt / Prompt Inverso di Rigenerazione

## Italiano

### Scopo

Questo prompt serve a rigenerare il progetto mantenendone l'intento, la forma architetturale e la natura di piattaforma di ricerca. Non deve produrre una semplice “app simile”, ma un sistema che conservi i principi strutturali di LLMind2.

### Prompt inverso

Progetta e implementa una piattaforma full-stack chiamata LLMind2, orientata alla ricerca scientifica in intelligenza artificiale clinica. Il sistema deve integrare esplorazione della tassonomia ICD-11, ingestione e benchmarking di casi clinici DSM-5-TR, workspace conversazionale con modelli LLM e supporto a datastore per workflow RAG.

Requisiti architetturali:

- frontend in Next.js con App Router
- backend in FastAPI
- persistenza PostgreSQL
- integrazione con server Ollama esterno per inferenza e lista modelli
- integrazione con container WHO ICD-11 offline
- configurazione interamente guidata da variabili d'ambiente
- orchestrazione locale tramite Docker Compose

Requisiti funzionali:

- browsing ICD-11 gerarchico e tabulare
- ricerca full-text di categorie diagnostiche
- chat persistente con streaming SSE
- due modalita principali di conversazione: ICD-11 lookup e reasoning differenziale
- gestione di casi clinici DSM-5-TR con editing manuale
- benchmark batch multi-modello
- memorizzazione di prompt, risposta, latenza, score di similarita e valutazioni umane
- modulo datastore con preset documentali e interrogazione RAG

Vincoli di design:

- il sistema deve essere pensato come piattaforma di ricerca, non come prodotto consumer generico
- il codice deve essere leggibile, modulare e facilmente documentabile
- il dominio sperimentale deve essere persistente e auditabile
- il benchmark deve distinguere chiaramente tra dato sorgente, configurazione, output modello e valutazione
- la UI deve risultare moderna, intenzionale e credibile in ambito accademico-clinico

Requisiti metodologici:

- preservare la riproducibilita degli esperimenti
- rendere espliciti prompt e system prompt
- consentire confronti tra modelli diversi
- supportare futura estensione multi-agente

### Criteri minimi di accettazione

- l'utente puo navigare ICD-11
- l'utente puo conversare con output in streaming
- l'utente puo visualizzare e correggere i casi clinici
- l'utente puo eseguire benchmark multi-modello
- l'utente puo leggere KPI e storico delle esecuzioni
- il sistema puo essere avviato e configurato localmente

## English

### Purpose

This prompt is meant to regenerate the project while preserving its intent, architectural shape, and research-platform identity. It should not produce a merely similar app, but a system that retains the structural principles of LLMind2.

### Reverse prompt

Design and implement a full-stack platform called LLMind2 for scientific research in clinical artificial intelligence. The system must integrate ICD-11 taxonomy exploration, DSM-5-TR clinical case ingestion and benchmarking, a conversational workspace powered by LLMs, and datastore support for RAG workflows.

Architectural requirements:

- frontend in Next.js using App Router
- backend in FastAPI
- PostgreSQL persistence
- integration with an external Ollama server for inference and model listing
- integration with the offline WHO ICD-11 container
- configuration driven entirely by environment variables
- local orchestration through Docker Compose

Functional requirements:

- hierarchical and tabular ICD-11 browsing
- full-text search over diagnostic categories
- persistent chat with SSE streaming
- two main conversation modes: ICD-11 lookup and differential reasoning
- DSM-5-TR clinical case management with manual editing
- multi-model batch benchmarking
- storage of prompts, responses, latency, similarity scores, and human evaluations
- datastore module with document presets and RAG querying

Design constraints:

- the system must feel like a research platform rather than a generic consumer product
- the code should be readable, modular, and easy to document
- the experimental domain should remain persistent and auditable
- benchmarking should clearly separate source data, configuration, model output, and evaluation
- the UI should feel modern, intentional, and academically credible

Methodological requirements:

- preserve experimental reproducibility
- make prompts and system prompts explicit
- support comparisons across different models
- allow future multi-agent extension

### Minimum acceptance criteria

- users can browse ICD-11
- users can chat with streamed output
- users can inspect and correct clinical cases
- users can execute multi-model benchmarks
- users can read KPI dashboards and run history
- the system can be started and configured locally

