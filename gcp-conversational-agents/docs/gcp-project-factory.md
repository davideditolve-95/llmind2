# GCP Project Factory / Creazione progetto GCP

## Italiano

Questa guida descrive il bootstrap completo di GCP per LLMind2 Conversational Agents. Il flusso e diviso in due stati Terraform separati:

- `bootstrap/terraform`: crea il progetto GCP dedicato, collega il billing, abilita API essenziali, imposta budget, audit logging e ruoli base.
- `terraform`: crea le risorse applicative dentro il progetto, cioe bucket GCS, BigQuery, service account, IAM workload e dataset/tabelle.

La separazione e voluta: creare un progetto richiede permessi di organizzazione/folder e billing, mentre il workload puo essere gestito da un principal meno privilegiato.

### Prerequisiti

Il principal che esegue il bootstrap deve poter:

- creare progetti sotto una organization o folder;
- collegare un billing account;
- abilitare API;
- creare budget;
- assegnare IAM nel progetto appena creato.

### Bootstrap

1. Copiare l'esempio:

```bash
cd gcp-conversational-agents/bootstrap/terraform
cp terraform.tfvars.example terraform.tfvars
```

2. Modificare:

- `project_id`
- `project_name`
- `billing_account`
- esattamente uno tra `organization_id` e `folder_id`
- `budget_amount_eur`
- `workload_admin_principals`

Per il PoC il valore desiderato e `project_name = "llmind"` e, se disponibile, `project_id = "llmind"`. Il `project_id` GCP deve essere globalmente unico: se `llmind` fosse gia occupato, usa un id univoco come `llmind-poc-001` mantenendo comunque `project_name = "llmind"`.

3. Applicare bootstrap e workload:

```bash
cd ../..
./scripts/apply_gcp_foundation.sh
```

Lo script applica prima il bootstrap, poi scrive `terraform/terraform.tfvars.generated`, poi applica le risorse workload.

### Risorse create

Bootstrap:

- progetto GCP dedicato;
- billing collegato;
- API essenziali abilitate;
- budget mensile PoC con soglie 50%, 80%, 100%, 120%;
- audit logging Data Access disattivato di default per ridurre costi di logging;
- ruoli opzionali per amministratori workload.

Workload:

- bucket GCS per corpora clinici;
- service account `llmind-agent-automation`;
- dataset BigQuery statico;
- tabelle clustered per ICD-11, DSM-5-TR e chunk agentici;
- IAM per Dialogflow, Agent Search, BigQuery e Storage.

### Profilo costo minimo

Il profilo PoC usa:

- budget predefinito di 5 EUR/mese;
- bucket senza versioning;
- lifecycle GCS verso NEARLINE dopo 30 giorni;
- cancellazione automatica oggetti GCS dopo 90 giorni;
- BigQuery dataset e tabelle distruggibili da Terraform;
- Data Access audit logs disattivati di default;
- nessun Secret Manager o Monitoring API abilitati se non necessari.

### Dopo Terraform

Terraform prepara la fondazione. Le risorse conversazionali evolutive vengono create dagli script:

```bash
./scripts/sync_source_documents.sh
./scripts/upload_pdfs.sh PROJECT_ID BUCKET_NAME
./scripts/load_bigquery_corpus.sh PROJECT_ID llmind2_static_clinical
./scripts/create_dialogflow_agent.sh PROJECT_ID eu
./scripts/create_playbooks.sh PROJECT_ID eu AGENT_ID
./scripts/print_datastore_commands.sh PROJECT_ID eu BUCKET_NAME
```

## English

This guide defines the complete GCP bootstrap for LLMind2 Conversational Agents. The flow is split into two Terraform states:

- `bootstrap/terraform`: creates the dedicated GCP project, links billing, enables core APIs, configures budget, audit logging, and base IAM.
- `terraform`: creates workload resources inside the project: GCS bucket, BigQuery, service account, IAM, datasets, and tables.

This separation is intentional. Project creation needs organization/folder and billing privileges; workload management can be delegated to a less privileged principal.

### Resources

Bootstrap creates:

- dedicated GCP project;
- linked billing account;
- enabled APIs;
- monthly budget guardrail;
- Data Access audit logging disabled by default for lowest-cost PoC;
- optional workload admin IAM.

Workload creates:

- GCS clinical corpus bucket;
- `llmind-agent-automation` service account;
- static BigQuery dataset;
- clustered ICD-11, DSM-5-TR, and agent chunk tables;
- IAM for Dialogflow, Agent Search, BigQuery, and Storage.
