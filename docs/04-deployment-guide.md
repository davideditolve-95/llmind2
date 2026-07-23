# Guida al Deploy / Deployment Guide

## Italiano

### Obiettivo del deploy

L'obiettivo del deploy di LLMind2 non e soltanto pubblicare un'applicazione, ma rendere disponibile un ambiente di ricerca stabile, osservabile e sufficientemente riproducibile. Per questo motivo il deploy va trattato come una parte della metodologia sperimentale, non come un puro dettaglio infrastrutturale.

### Ambienti previsti

Il progetto supporta in modo naturale almeno tre ambienti:

- sviluppo locale con Docker Compose
- ambiente di staging o demo interna
- ambiente di produzione research-grade, ad esempio su Coolify

### Componenti necessari

Per avere il sistema operativo servono:

- frontend Next.js
- backend FastAPI
- database PostgreSQL
- container WHO ICD-11 offline
- endpoint Ollama accessibile

### Variabili d'ambiente chiave

Le variabili piu rilevanti sono:

- `DATABASE_URL`
- `ICD11_API_URL`
- `ICD11_CLIENT_ID`
- `ICD11_CLIENT_SECRET`
- `OLLAMA_BASE_URL`
- `OLLAMA_DEFAULT_MODEL`
- `SECRET_KEY`
- `ENVIRONMENT`
- `NEXT_PUBLIC_API_URL`

### Deploy locale

Il deploy locale e utile per:

- sviluppo attivo
- validazione funzionale
- test di ingestion
- esecuzione benchmark su macchina singola

La sequenza corretta e:

1. preparare `.env` a partire da `.env.example`
2. avviare lo stack Docker
3. attendere lo stato sano dei servizi
4. popolare ICD-11 con ETL
5. opzionalmente estrarre i casi DSM-5-TR
6. verificare backend, frontend e Ollama

### Deploy su Coolify o analogo

Il deploy su piattaforme tipo Coolify e coerente con l'attuale struttura della repo. In questo caso bisogna fare attenzione a:

- valorizzare `NEXT_PUBLIC_API_URL` con l'endpoint pubblico del backend
- esporre un `OLLAMA_BASE_URL` realmente raggiungibile
- ridurre `allow_origins` nel backend agli URL reali del frontend
- proteggere `SECRET_KEY` e credenziali DB
- mantenere i container accessibili tramite la rete Docker interna e il proxy della piattaforma, senza pubblicare porte host dedicate nel `docker-compose.yml`
- usare `docker-compose.override.yml` per le sole porte di sviluppo locale (`localhost:3000` e `localhost:10000`)

### Dati e persistenza

In un progetto di ricerca i dati non sono solo “contenuto applicativo”, ma patrimonio sperimentale. Di conseguenza:

- i volumi Postgres devono essere soggetti a backup
- i casi benchmark corretti manualmente non vanno trattati come dati temporanei
- benchmark run e rating manuali devono essere considerati risultati sperimentali

### Checklist di verifica post-deploy

- il frontend e raggiungibile dal browser
- `GET /health` del backend restituisce stato sano
- `GET /api/chat/models` risponde senza errore
- gli endpoint ICD-11 rispondono
- la lista dei casi benchmark viene caricata
- la cronologia chat puo essere letta e scritta

### Raccomandazioni di hardening

Per salire di livello maturativo, il deploy dovrebbe presto includere:

- TLS obbligatorio
- autenticazione e autorizzazione
- backup automatizzati
- policy di retention
- metriche e alerting
- migrazioni DB piu formali

## English

### Deployment objective

The goal of deploying LLMind2 is not merely to publish an application, but to make available a stable, observable, and reasonably reproducible research environment. Deployment should therefore be treated as part of the experimental methodology rather than as a purely operational concern.

### Target environments

The project naturally supports at least three environments:

- local development with Docker Compose
- staging or internal demo environment
- research-grade production deployment, for example on Coolify

### Required components

The system depends on:

- Next.js frontend
- FastAPI backend
- PostgreSQL database
- offline WHO ICD-11 container
- reachable Ollama endpoint

### Key environment variables

The most relevant variables are:

- `DATABASE_URL`
- `ICD11_API_URL`
- `ICD11_CLIENT_ID`
- `ICD11_CLIENT_SECRET`
- `OLLAMA_BASE_URL`
- `OLLAMA_DEFAULT_MODEL`
- `SECRET_KEY`
- `ENVIRONMENT`
- `NEXT_PUBLIC_API_URL`

### Local deployment

Local deployment is useful for:

- active development
- functional validation
- ingestion testing
- single-machine benchmark execution

The correct sequence is:

1. prepare `.env` from `.env.example`
2. start the Docker stack
3. wait for healthy services
4. populate ICD-11 through ETL
5. optionally extract DSM-5-TR cases
6. verify backend, frontend, and Ollama

### Coolify-style deployment

The repository is already structured in a way that fits platforms such as Coolify. In this scenario, special attention should be given to:

- setting `NEXT_PUBLIC_API_URL` to the public backend endpoint
- exposing a truly reachable `OLLAMA_BASE_URL`
- narrowing backend CORS to the real frontend origins
- protecting `SECRET_KEY` and database credentials
- keeping containers reachable through the internal Docker network and the platform proxy, without publishing dedicated host ports in `docker-compose.yml`
- using `docker-compose.override.yml` only for local development ports (`localhost:3000` and `localhost:10000`)

### Data and persistence

In a research project, data is not just application content but experimental capital. Therefore:

- PostgreSQL volumes should be backed up
- manually corrected benchmark cases should not be treated as disposable
- benchmark runs and human ratings should be considered experimental results

### Post-deploy verification checklist

- frontend reachable in browser
- backend `GET /health` returns healthy
- `GET /api/chat/models` responds successfully
- ICD-11 endpoints are reachable
- benchmark case list loads
- chat history can be written and retrieved

### Hardening recommendations

To move toward a stronger operational posture, deployment should soon include:

- mandatory TLS
- authentication and authorization
- automated backups
- retention policies
- metrics and alerting
- more formal database migrations
