# Data Governance

## Italiano

### Obiettivo

Questo documento definisce una base di governo dei dati per LLMind2. In una piattaforma di ricerca clinica, i dati non sono solo input software: sono oggetti epistemici, patrimonio sperimentale e potenziali fonti di rischio etico e normativo.

### Categorie di dati nel progetto

- tassonomia ICD-11 e relativi metadati
- casi clinici DSM-5-TR estratti o curati
- output di benchmark
- valutazioni manuali
- cronologia chat
- metadata dei datastore

### Principi di governo

- minimizzazione: usare solo i dati necessari allo scopo di ricerca
- tracciabilita: sapere da dove viene ogni dataset e ogni risultato
- reversibilita: poter ricostruire come un output e stato generato
- separazione: distinguere dati sorgente, dati derivati e valutazioni
- preservazione: non perdere correzioni manuali e risultati sperimentali

### Lifecycle raccomandato

1. acquisizione della fonte
2. normalizzazione o estrazione
3. revisione manuale
4. uso sperimentale
5. esportazione dei risultati
6. archiviazione e backup

### Metadati da aggiungere nel tempo

- versione del dataset
- provenienza della fonte
- data di estrazione
- revisore umano
- stato qualitativo del record
- campagna sperimentale associata

### Gestione dati sensibili

Anche se la repo usa materiale di ricerca e casi strutturati, l'orientamento clinico del progetto impone prudenza. In prospettiva bisogna definire chiaramente:

- livelli di sensibilita dei dati
- policy di accesso
- policy di conservazione
- policy di cancellazione

## English

### Objective

This document defines a baseline data-governance perspective for LLMind2. In a clinical research platform, data is not merely software input: it is an epistemic object, experimental capital, and a potential source of ethical and regulatory risk.

### Data categories in the project

- ICD-11 taxonomy and related metadata
- extracted or curated DSM-5-TR clinical cases
- benchmark outputs
- manual evaluations
- chat history
- datastore metadata

### Governance principles

- minimization: use only the data required for the research purpose
- traceability: know where each dataset and result comes from
- reversibility: reconstruct how an output was generated
- separation: distinguish source data, derived data, and evaluation
- preservation: do not lose manual corrections or experimental results

### Recommended lifecycle

1. source acquisition
2. normalization or extraction
3. manual review
4. experimental use
5. result export
6. archival and backup

### Metadata to add over time

- dataset version
- source provenance
- extraction date
- human reviewer
- record quality status
- associated experiment campaign

### Sensitive data handling

Even if the repository currently uses research-oriented and structured material, the clinical orientation of the platform requires caution. Over time, the project should define:

- data sensitivity levels
- access policies
- retention policies
- deletion policies

