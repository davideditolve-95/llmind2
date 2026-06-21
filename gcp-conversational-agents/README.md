# LLMind2 GCP Conversational Agents

## Italiano

Questa cartella contiene il blueprint GCP per aggiungere a LLMind2 un livello di agenti conversazionali gestiti. Il pacchetto e separato dallo stack Docker/Ollama locale per permettere due traiettorie parallele: continuare a usare LLMind2 come laboratorio di ricerca locale e, quando serve, replicare su Google Cloud un ambiente con Dialogflow CX Conversational Agents, playbook generativi, Agent Search data store e ingestione controllata di PDF clinici.

### Cosa include

- Terraform per abilitare API, creare bucket GCS, service account e permessi IAM
- project factory Terraform per creare il progetto GCP dedicato con billing, API, budget e audit logging
- specifiche JSON dei playbook per casi d'uso di AI clinica e ricerca
- specifiche dei sottoagenti per orchestration, nosologia ICD-11, curatela DSM, benchmark, diagnosi differenziale e safety
- pipeline BigQuery per usare ICD-11 e casi DSM statici come datastore strutturato a basso costo
- manifest dei datastore documentali per ICD-11, DSM-5-TR e protocolli LLMind2
- script per caricare PDF, creare l'agente Dialogflow CX, creare i playbook e preparare i comandi datastore
- esempi conversazionali e documentazione dei casi d'uso

### Disegno corrente

Lo stack e diviso in due livelli.

Il primo livello e stabile e viene gestito da Terraform: API Google Cloud, bucket per i corpora PDF, service account di automazione e ruoli minimi per Dialogflow, Agent Search e Storage.

Il secondo livello riguarda risorse applicative che evolvono piu rapidamente: playbook, strumenti conversazionali, datastore e import documentale. Per questo motivo viene gestito con script espliciti e manifest versionabili. Questa scelta rende il progetto piu leggibile per un dottorato: ogni decisione di design resta tracciabile, revisionabile e modificabile da agenti diversi senza nascondere logica critica dentro moduli Terraform opachi.

### Prerequisiti

- `gcloud` autenticato sul progetto target
- Terraform 1.6 o superiore
- `jq`
- `curl`
- progetto GCP con billing attivo
- PDF clinici disponibili localmente e con licenza d'uso adeguata

### Avvio rapido

1. Creare il progetto GCP dedicato e le risorse applicative:

```bash
cd gcp-conversational-agents/bootstrap/terraform
cp terraform.tfvars.example terraform.tfvars
# modifica billing_account e organization_id o folder_id
# project_name e project_id sono impostati a "llmind"; se project_id e occupato, usa un suffisso ma lascia project_name = "llmind"
cd ../..
./scripts/apply_gcp_foundation.sh
```

Guida dettagliata: `docs/gcp-project-factory.md`.

2. In alternativa, se il progetto GCP esiste gia, inizializzare solo Terraform workload:

```bash
cd gcp-conversational-agents/terraform
terraform init
terraform apply \
  -var="project_id=YOUR_PROJECT_ID" \
  -var="region=eu" \
  -var="bucket_name=YOUR_UNIQUE_BUCKET_NAME"
```

3. Preparare i PDF sorgente in `source-pdfs/`.

```bash
./scripts/sync_source_documents.sh
```

I nomi attesi sono dichiarati in `datastores/datastore-manifest.json`. Lo script usa i sorgenti gia presenti in `backend/data/original_docs/`: `ICD-11-CDDR.pdf` e gli estratti DSM-5-TR in TXT/CSV. Per BigQuery, invece, ICD-11 deve arrivare dal database popolato da `backend/scripts/extract_icd11_data.py`, non dai CSV legacy.

4. Caricare i PDF:

```bash
cd ..
./scripts/upload_pdfs.sh YOUR_PROJECT_ID YOUR_BUCKET_NAME
```

5. Creare l'agente Dialogflow CX:

```bash
./scripts/create_dialogflow_agent.sh YOUR_PROJECT_ID eu
```

6. Creare i playbook:

```bash
export DIALOGFLOW_AGENT_ID="YOUR_AGENT_ID"
./scripts/create_playbooks.sh YOUR_PROJECT_ID eu "$DIALOGFLOW_AGENT_ID"
```

7. Preparare i comandi per i datastore Agent Search:

```bash
./scripts/print_datastore_commands.sh YOUR_PROJECT_ID eu YOUR_BUCKET_NAME
```

8. Opzionale ma consigliato: caricare il corpus statico in BigQuery per query agentiche economiche:

```bash
docker compose exec backend python scripts/extract_icd11_data.py --max-level 4 --language en
export DATABASE_URL="postgresql://llmind_user:llmind_pass_dev@localhost:5432/llmind_db"
./scripts/load_bigquery_corpus.sh YOUR_PROJECT_ID llmind2_static_clinical
```

Il flusso corretto e: ICD-11 API/container WHO -> PostgreSQL `icd11_categories` -> BigQuery. I CSV ICD legacy non sono usati dalla pipeline primaria. Guida dettagliata: `docs/bigquery-static-corpus.md`.

### Nota clinica e di ricerca

Questo pacchetto e pensato per ricerca, prototipazione e valutazione scientifica. Non trasforma LLMind2 in un dispositivo medico, in un sistema clinico certificato o in una piattaforma pronta per dati sanitari regolati. Qualsiasi uso con dati reali o sensibili richiede revisione privacy, governance del trattamento, hardening IAM, audit logging, policy di retention, valutazione legale e procedure di supervisione umana.

## English

This folder contains the GCP deployment blueprint for adding Conversational Agents support to LLMind2.

It is intentionally isolated from the current Docker/Ollama runtime. The goal is to let the research platform keep its local stack while adding a reproducible Google Cloud path for Dialogflow CX generative playbooks, Agent Search data stores, and clinical PDF ingestion.

## What is included

- Terraform foundation for APIs, GCS buckets, service account, and IAM
- Terraform project factory for creating the dedicated GCP project with billing, APIs, budget, and audit logging
- Playbook specifications for clinical AI research use cases
- Subagent specifications for orchestration, ICD-11 nosology, DSM curation, benchmarking, differential diagnosis, and safety
- BigQuery pipeline for using static ICD-11 and DSM data as a low-cost structured datastore
- Data store manifest for ICD-11 and DSM-5-TR clinical document corpora
- Scripts to upload PDFs, create the Dialogflow CX agent, create playbooks, and prepare data store commands
- Example conversations and use-case documentation

## Current design

The stack is split into two layers:

- Terraform provisions stable cloud foundations: APIs, storage, service account, and IAM.
- Scripts call Google APIs for higher-level resources that are still evolving in Conversational Agents and Agent Search.

This is deliberate. Dialogflow CX playbooks are first-class API resources, while Agent Search data store management is currently more practical through Google APIs and `gcloud` workflows than through a single fully portable Terraform module.

## Prerequisites

- `gcloud` authenticated against the target project
- Terraform 1.6+
- `jq`
- `curl`
- a GCP project with billing enabled
- licensed clinical PDFs available locally

## Quick start

1. Initialize Terraform:

```bash
cd gcp-conversational-agents/terraform
terraform init
terraform apply \
  -var="project_id=YOUR_PROJECT_ID" \
  -var="region=eu" \
  -var="bucket_name=YOUR_UNIQUE_BUCKET_NAME"
```

2. Prepare source PDFs:

```bash
./scripts/sync_source_documents.sh
```

Expected names are defined in `datastores/datastore-manifest.json`. The script uses the existing backend sources in `backend/data/original_docs/`: `ICD-11-CDDR.pdf` and DSM-5-TR TXT/CSV extracts. The manifest uploads only final PDFs from `source-pdfs/`.
For BigQuery, ICD-11 is exported from the database populated by `backend/scripts/extract_icd11_data.py`, not from legacy CSV files.

3. Upload PDFs:

```bash
cd ..
./scripts/upload_pdfs.sh YOUR_PROJECT_ID YOUR_BUCKET_NAME
```

4. Create the Dialogflow CX agent:

```bash
./scripts/create_dialogflow_agent.sh YOUR_PROJECT_ID eu
```

5. Create playbooks:

```bash
export DIALOGFLOW_AGENT_ID="YOUR_AGENT_ID"
./scripts/create_playbooks.sh YOUR_PROJECT_ID eu "$DIALOGFLOW_AGENT_ID"
```

6. Prepare Agent Search data store commands:

```bash
./scripts/print_datastore_commands.sh YOUR_PROJECT_ID eu YOUR_BUCKET_NAME
```

## Important clinical note

This package is for research and prototyping. It does not make LLMind2 a certified clinical system or medical device. Any deployment involving sensitive or patient-derived data must add privacy review, data processing governance, IAM hardening, audit logging, retention policies, and legal review.
