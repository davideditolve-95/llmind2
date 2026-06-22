# Changelog

Tutte le modifiche rilevanti del progetto sono raccolte in questo file. Il formato segue una struttura orientata alla ricerca: ogni voce distingue funzionalita applicative, infrastruttura scientifica, riproducibilita, documentazione e validazione.

## 2026-06-22 - LLMind2 research platform, benchmark metrics and paper automation

### Sintesi

Questa iterazione consolida LLMind2 come piattaforma di ricerca per il reasoning diagnostico assistito da LLM in salute mentale. Il lavoro ha trasformato il progetto da prototipo applicativo a base sperimentale piu robusta per attivita di dottorato: sono state rafforzate le metriche di benchmark, migliorato il paper scientifico in italiano e inglese, introdotti grafici e numeriche riproducibili, e aggiunto uno script per rigenerare automaticamente le sezioni del paper che dipendono da conteggi variabili della repository.

### Benchmark e metriche scientifiche

- Aggiunte metriche automatiche persistenti per ogni esecuzione di benchmark:
  - `label_accuracy`
  - `precision_score`
  - `recall_score`
  - `f1_score`
  - `no_diagnosis`
- Implementata una funzione deterministica e auditabile per calcolare le metriche rispetto alla diagnosi gold standard.
- Mantenuta la distinzione metodologica tra metriche automatiche e validazione esperta: le nuove metriche sono euristiche riproducibili, non giudizi clinici.
- Integrata la similarita semantica gia esistente con misure lessicali operative, utili per analisi preliminari e confronto tra modelli.
- Aggiunto il flag `no_diagnosis` per distinguere risposte astensive o vuote da errori diagnostici assertivi.
- Aggiornati i KPI aggregati per modello con:
  - accuratezza media
  - precision media
  - recall media
  - F1 medio
  - numero e tasso di risposte senza diagnosi
- Estese le serie temporali KPI con valori di accuracy e F1, oltre alla similarita.
- Aggiornati gli export benchmark in formato JSON, TXT e CSV includendo le nuove metriche.
- Centralizzata la costruzione dei KPI modello per ridurre duplicazioni tra dashboard generale e dashboard batch.

### Persistenza e schema database

- Esteso il modello SQLAlchemy `BenchmarkRun` con i campi delle nuove metriche.
- Aggiornati gli schema Pydantic usati dalle API benchmark.
- Aggiunta sincronizzazione automatica dello schema all'avvio del backend per aggiungere le nuove colonne a database gia esistenti senza richiedere reset manuale.
- Preservata la compatibilita con run storici: i campi metrici possono essere nulli per esecuzioni precedenti all'introduzione delle nuove metriche.

### Frontend benchmark

- Aggiornata la pagina `Benchmark Lab` per mostrare le nuove metriche.
- Aggiunte card KPI per:
  - accuracy
  - precision
  - recall
  - F1
  - no diagnosis
- Aggiornata la tabella dei run recenti con colonne dedicate ad accuracy e F1.
- Arricchiti i dettagli del run con badge per precision, recall, F1 e stato no-diagnosis.
- Corretta la struttura React della lista dei run usando `Fragment` con chiave stabile.
- Aggiornati i tipi TypeScript del client API per riflettere i nuovi campi restituiti dal backend.

### Paper scientifico v2

- Arricchiti i paper LaTeX in italiano e inglese con nuovi elementi quantitativi e grafici.
- Aggiunta una sezione di snapshot numerico degli artefatti:
  - categorie ICD-11 estratte
  - casi DSM-5-TR strutturati
  - chunk ICD-11
  - chunk DSM-5-TR
  - chunk agentici totali
  - playbook conversazionali
  - subagent definiti
  - PDF sorgente disponibili per datastore
- Aggiunto un grafico a barre `pgfplots` per visualizzare la distribuzione degli artefatti di corpus.
- Aggiunta una figura di architettura implementativa del prototipo locale:
  - frontend Next.js/DaisyUI
  - backend FastAPI
  - PostgreSQL
  - vector store locale
  - pipeline dati ICD API/PDF
  - LLM locali/Ollama/legacy RAG
  - benchmark engine
  - metriche
  - estensioni GCP opzionali
- Aggiornata la sezione sulle metriche automatiche per descrivere cio che il sistema implementa realmente.
- Chiarito che la top-k accuracy rimane pianificata finche non vengono salvate liste ordinate di candidati diagnostici.
- Ricompilati i PDF italiano e inglese.

### Automazione delle numeriche del paper

- Aggiunto lo script `paper/scripts/update_dynamic_sections.py`.
- Lo script rigenera automaticamente le sezioni numeriche dinamiche dei paper italiano e inglese.
- I blocchi dinamici sono delimitati da marker LaTeX dedicati:
  - `BEGIN_DYNAMIC_ARTIFACT_SNAPSHOT_IT`
  - `END_DYNAMIC_ARTIFACT_SNAPSHOT_IT`
  - `BEGIN_DYNAMIC_ARTIFACT_SNAPSHOT_EN`
  - `END_DYNAMIC_ARTIFACT_SNAPSHOT_EN`
- Lo script legge i conteggi direttamente dalla repository:
  - JSONL BigQuery corpus in `gcp-conversational-agents/generated/bigquery`
  - playbook in `gcp-conversational-agents/playbooks`
  - subagent in `gcp-conversational-agents/subagents`
  - PDF sorgente in `gcp-conversational-agents/source-pdfs`
- Supportato aggiornamento dei soli file `.tex`.
- Supportata ricompilazione automatica dei PDF con l'opzione `--compile`.

### Comandi operativi aggiunti

Aggiornare solo le sezioni dinamiche LaTeX:

```bash
python3 paper/scripts/update_dynamic_sections.py
```

Aggiornare le sezioni dinamiche e ricompilare i PDF:

```bash
python3 paper/scripts/update_dynamic_sections.py --compile
```

### Validazione eseguita

- Verificata la sintassi Python dei moduli backend modificati.
- Verificata la sintassi dello script di aggiornamento dinamico del paper.
- Eseguita build frontend Next.js con successo.
- Ricompilati i paper LaTeX in italiano e inglese con successo.
- Verificata la generazione dei PDF aggiornati.
- Verificato che lo script di aggiornamento delle numeriche sia idempotente rispetto ai conteggi attuali.

### Note metodologiche

- Le metriche automatiche implementate sono pensate per ricerca, debugging e confronto sperimentale, non per validazione clinica autonoma.
- Precision, recall e F1 sono calcolate su normalizzazione lessicale della risposta e della diagnosi gold standard; pertanto devono essere interpretate insieme a similarita semantica, rating umano e analisi qualitativa degli errori.
- Le numeriche riportate nel paper sono conteggi di artefatti riproducibili della repository, non risultati empirici di performance diagnostica.
- L'integrazione GCP rimane un'estensione opzionale di deployment e non un prerequisito per la riproducibilita scientifica locale.
