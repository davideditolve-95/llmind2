# Multi-Agent Playbook / Manuale Multi-Agente

## Italiano

### Scopo

Questo documento definisce come organizzare il lavoro di piu agenti, umani o AI, sulla stessa codebase senza generare confusione, conflitti e regressioni. In un progetto di ricerca la collaborazione non deve essere soltanto veloce: deve anche preservare la qualita epistemica del lavoro, cioe la capacita di ricostruire chi ha fatto cosa, perche, con quali ipotesi e con quali effetti sugli esperimenti.

### Principio guida

Ogni agente deve produrre non solo codice o testo, ma anche contesto riusabile. In LLMind2 questo significa che ogni intervento dovrebbe lasciare dietro di se almeno uno di questi risultati:

- una modifica software verificabile
- una decisione architetturale esplicitata
- una nota metodologica o di ricerca
- un runbook operativo
- un artefatto di handoff per l'agente successivo

### Suddivisione consigliata dei ruoli

- agente piattaforma: Docker, deployment, ambienti, backup, osservabilita
- agente backend: API FastAPI, modelli ORM, logica benchmark, ETL, servizi
- agente frontend: interfaccia Next.js, flussi utente, visualizzazione metriche, UX di ricerca
- agente ricerca: prompt, protocolli sperimentali, metriche, disegno valutativo
- agente documentazione e governance: manuali, compliance, processi, standard redazionali

### Regola di ownership

Per evitare attriti, ogni area principale della repo dovrebbe avere un owner temporaneo durante una sessione di lavoro:

- `backend/`
- `frontend/`
- `docs/`
- file infrastrutturali di root come `README.md`, `docker-compose.yml`, `.env.example`

Se due agenti devono toccare la stessa area, il primo produce un handoff esplicito e il secondo lavora solo dopo averlo letto.

### Protocollo di handoff

Ogni handoff deve contenere:

- obiettivo del lavoro appena svolto
- file toccati
- comportamento cambiato o documentato
- assunzioni fatte
- rischi aperti
- modalita di verifica
- prossima azione raccomandata

### Tipi di task adatti alla parallelizzazione

LLMind2 si presta molto bene al lavoro in parallelo su:

- documentazione e governance
- frontend e backend quando il contratto API e stabile
- benchmarking e datastores
- deploy e hardening operativo
- ricerca sperimentale e analisi risultati

Si presta meno bene, senza sincronizzazione stretta, su:

- refactor che toccano modelli e API insieme
- modifiche simultanee al sistema di prompt e ai KPI
- migrazioni schema con impatto su dati esistenti

### Standard minimo per ogni agente

Ogni agente dovrebbe:

- leggere i documenti strategici prima di modificare il codice
- evitare cambiamenti distruttivi non richiesti
- dichiarare in modo chiaro se sta lavorando in modalita ricerca, prodotto o conformita
- distinguere fatti osservati nella repo da inferenze o proposte

### Flusso di lavoro raccomandato

1. leggere `README.md`, `AGENTS.md` e i documenti di overview
2. definire il perimetro del task
3. verificare se esiste gia documentazione collegata
4. eseguire il lavoro nella propria area
5. lasciare un handoff sintetico ma completo
6. aggiornare la documentazione se il comportamento e cambiato

### Perche questo e importante in un dottorato

Nel contesto di una tesi, il valore non sta solo nel costruire il sistema, ma nel renderlo comprensibile, auditabile e riutilizzabile. Un progetto che cresce con piu agenti senza una disciplina di coordinamento perde rapidamente valore scientifico. Questo playbook serve proprio a impedire quella deriva.

## English

### Purpose

This document defines how multiple agents, human or AI, should collaborate on the same codebase without creating confusion, overlap, or regression risk. In a research project, collaboration must be not only fast but epistemically reliable: every meaningful change should remain attributable, understandable, and reproducible.

### Guiding principle

Each agent should produce not just code or prose, but reusable context. In LLMind2, that means that every intervention should leave behind at least one of the following:

- a verifiable software change
- an explicit architectural decision
- a methodological or research note
- an operational runbook
- a handoff artifact for the next agent

### Recommended role split

- platform agent: Docker, deployment, environments, backups, observability
- backend agent: FastAPI APIs, ORM models, benchmark logic, ETL, services
- frontend agent: Next.js interface, user workflows, metric visualization, research UX
- research agent: prompting, experimental protocols, metrics, evaluation design
- documentation and governance agent: manuals, compliance notes, editorial standards

### Ownership rule

To avoid collisions, each major area of the repository should have a temporary owner within a work session:

- `backend/`
- `frontend/`
- `docs/`
- root infrastructure files such as `README.md`, `docker-compose.yml`, and `.env.example`

If two agents must touch the same area, the first one should produce an explicit handoff before the second proceeds.

### Handoff protocol

Every handoff should include:

- goal of the completed work
- files touched
- behavior changed or documented
- assumptions made
- open risks
- verification method
- recommended next action

### Tasks well suited for parallel execution

LLMind2 is especially suitable for parallel work on:

- documentation and governance
- frontend and backend when the API contract is stable
- benchmarking and datastore capabilities
- deployment and operational hardening
- experimental design and result analysis

It is less suitable, without tight coordination, for:

- refactors touching both models and APIs
- simultaneous changes to prompting and KPI logic
- schema migrations affecting persisted data

### Minimum standard for every agent

Every agent should:

- read the strategic documents before changing code
- avoid destructive changes unless explicitly requested
- clearly state whether the current task is research-oriented, product-oriented, or compliance-oriented
- separate repository facts from inference and proposal

### Recommended workflow

1. read `README.md`, `AGENTS.md`, and the overview documents
2. define task scope
3. verify whether related documentation already exists
4. execute within the assigned area
5. leave a concise but complete handoff
6. update documentation if behavior changed

### Why this matters for a PhD project

In a doctoral context, value comes not only from building the system but from making it explainable, auditable, and extensible. A multi-agent project that scales without coordination quickly loses scientific reliability. This playbook is meant to prevent that outcome.

