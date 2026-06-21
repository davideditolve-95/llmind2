# BigQuery Static Corpus / Corpus statico BigQuery

## Italiano

ICD-11 e i casi DSM-5-TR usati da LLMind2 sono sorgenti statiche: non cambiano durante il normale ciclo di ricerca. Per questo motivo conviene estrarli una sola volta in BigQuery e usarli come datastore strutturato per gli agenti, evitando di interrogare continuamente PDF o pipeline RAG piu costose.

### Obiettivo

La pipeline crea tre tabelle:

- `icd11_categories`: categorie ICD-11 estratte dal database popolato via API, codice, prefisso, famiglia diagnostica e testo ricercabile.
- `dsm5_cases`: casi DSM-5-TR estratti con `Introduction`, `Discussion`, `Diagnosis` e hash della diagnosi gold standard.
- `agent_corpus_chunks`: tabella unificata a chunk per gli agenti conversazionali.

### Scelta di clustering

Le tabelle non sono partizionate per data perche il corpus e statico. Il partizionamento temporale aggiungerebbe complessita senza ridurre davvero i byte letti. Usiamo invece clustering:

- `icd11_categories`: `chapter_code`, `code_prefix`, `diagnostic_family`, `code`
- `dsm5_cases`: `primary_diagnostic_family`, `case_number`, `has_suggested_readings`, `diagnosis_hash`
- `agent_corpus_chunks`: `corpus`, `diagnostic_family`, `section`, `code`

Questa forma favorisce query che filtrano prima per corpus, famiglia diagnostica, sezione o codice. Gli agenti devono evitare query libere su tutto il testo quando possono usare filtri strutturati.

### Protezione del free tier

Regole operative:

- usare sempre `maximum_bytes_billed` nelle query agentiche;
- interrogare `agent_corpus_chunks` con filtro su `corpus` e, quando possibile, `diagnostic_family` o `section`;
- usare `LIMIT` per preview e retrieval iniziale;
- preferire query parametrizzate;
- non usare `SELECT *` nelle chiamate agentiche;
- non rigenerare o ricaricare il corpus durante ogni conversazione.

### Workflow

1. Applicare Terraform:

```bash
cd gcp-conversational-agents/terraform
terraform apply
```

2. Preparare i JSONL locali:

```bash
cd ..
python3 scripts/prepare_bigquery_corpus.py
```

Per ICD-11 questo comando legge di default la tabella PostgreSQL `icd11_categories`, che deve essere stata popolata da:

```bash
docker compose exec backend python scripts/extract_icd11_data.py --max-level 4 --language en
```

Solo per test offline puoi usare `--icd-source legacy-csv`; non e la pipeline primaria.

3. Caricare in BigQuery:

```bash
export DATABASE_URL="postgresql://llmind_user:llmind_pass_dev@localhost:5432/llmind_db"
./scripts/load_bigquery_corpus.sh YOUR_PROJECT_ID llmind2_static_clinical
```

Se esegui il comando dentro il container backend, usa il `DATABASE_URL` interno gia configurato. Se lo esegui dal Mac host, assicurati che Postgres sia esposto su `localhost` o passa un URL esplicito compatibile con il tuo `docker-compose`.

4. Testare una query con limite di costo:

```bash
./scripts/query_bigquery_corpus.sh YOUR_PROJECT_ID llmind2_static_clinical autism 10485760
```

Il limite `10485760` corrisponde a 10 MiB massimi fatturabili per query. In produzione puoi impostare un limite piu alto, ma sempre esplicito.

## English

ICD-11 and the DSM-5-TR cases used by LLMind2 are static sources. They should be extracted once into BigQuery and used as a structured datastore for agents, instead of repeatedly scanning PDFs or invoking heavier RAG pipelines.

### Goal

The pipeline creates three tables:

- `icd11_categories`: ICD-11 categories exported from the API-populated database table, code, prefix, diagnostic family, and searchable text.
- `dsm5_cases`: extracted DSM-5-TR cases with `Introduction`, `Discussion`, `Diagnosis`, and a gold-standard diagnosis hash.
- `agent_corpus_chunks`: unified chunk table for conversational agents.

### Clustering strategy

The tables are not date-partitioned because the corpus is static. Temporal partitioning would add complexity without materially reducing scanned bytes. Instead, the tables use clustering:

- `icd11_categories`: `chapter_code`, `code_prefix`, `diagnostic_family`, `code`
- `dsm5_cases`: `primary_diagnostic_family`, `case_number`, `has_suggested_readings`, `diagnosis_hash`
- `agent_corpus_chunks`: `corpus`, `diagnostic_family`, `section`, `code`

Agents should filter by corpus, diagnostic family, section, or code whenever possible before searching text.

### ICD-11 source

The primary ICD-11 source is the PostgreSQL `icd11_categories` table populated by `backend/scripts/extract_icd11_data.py` from the ICD-11 API container. Legacy CSV files are accepted only for local validation fallback:

```bash
python3 scripts/prepare_bigquery_corpus.py --icd-source legacy-csv
```

Production and research runs should use the default `--icd-source db`.
