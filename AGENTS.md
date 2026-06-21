# AGENTS / Guida per Agenti

## Italiano

### Scopo

Questo file e il punto di ingresso operativo per agenti AI e collaboratori tecnici che lavorano su LLMind2. Serve a ridurre il costo di onboarding e ad allineare rapidamente il lavoro al carattere scientifico del progetto.

### Identita del progetto

LLMind2 e una piattaforma di ricerca in AI clinica, non un semplice chatbot. Le aree piu sensibili sono:

- benchmark su casi clinici
- grounding ICD-11
- riproducibilita sperimentale
- documentazione e governance

### Regole di lavoro

- leggere i documenti strategici prima di fare cambiamenti sostanziali
- evitare di trattare inferenze come fatti: separare osservazioni, ipotesi e proposte
- non cambiare in modo silenzioso prompt, metriche o semantica dei benchmark
- se un cambiamento modifica la comparabilita sperimentale, documentarlo esplicitamente

### Ordine di lettura consigliato

1. `README.md`
2. `docs/00-project-overview.md`
3. `docs/01-multi-agent-playbook.md`
4. `docs/02-technical-manual.md`
5. `docs/09-api-dataflow-map.md`

### Aree della repo

- `backend/`: logica dominio, API, servizi, modelli, ETL
- `frontend/`: UI e workflow operativi
- `docs/`: base di conoscenza del progetto

### Linee guida per la scrittura del codice (AI)

Per le regole di sviluppo, test automatizzati, isolamento utente e standard grafici per gli agenti AI, fare riferimento al file di configurazione [.cursorrules](file:///.cursorrules) nella root del progetto.

### Cosa documentare sempre

- nuove API
- cambiamenti a modelli persistenti
- modifiche a prompt o benchmark
- assunzioni operative per deploy e ambienti

## English

### Purpose

This file is the operational entry point for AI agents and technical collaborators working on LLMind2. Its goal is to reduce onboarding cost and quickly align work with the scientific nature of the project.

### Project identity

LLMind2 is a clinical AI research platform, not a generic chatbot. The most sensitive areas are:

- benchmarking on clinical cases
- ICD-11 grounding
- experimental reproducibility
- documentation and governance

### Working rules

- read the strategic documents before making substantial changes
- do not treat inference as fact: separate observation, hypothesis, and proposal
- do not silently change prompts, metrics, or benchmark semantics
- if a change affects experimental comparability, document it explicitly

### Recommended reading order

1. `README.md`
2. `docs/00-project-overview.md`
3. `docs/01-multi-agent-playbook.md`
4. `docs/02-technical-manual.md`
5. `docs/09-api-dataflow-map.md`

### Repository areas

- `backend/`: domain logic, APIs, services, models, ETL
- `frontend/`: UI and operational workflows
- `docs/`: project knowledge base

### AI Coding Guidelines

For detailed rules on coding standards, automated testing, user data isolation, and UI responsive designs, refer to the [.cursorrules](file:///.cursorrules) configuration file in the project root.

### Always document

- new APIs
- changes to persistent models
- prompt or benchmark changes
- operational assumptions for deployment and environments

