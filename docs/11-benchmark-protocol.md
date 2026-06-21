# Protocollo Benchmark / Benchmark Protocol

## Italiano

### Obiettivo

Il benchmark di LLMind2 deve essere trattato come un esperimento controllato, non come una semplice esecuzione applicativa. Questo documento definisce il protocollo minimo consigliato per produrre risultati difendibili in tesi, articoli o presentazioni accademiche.

### Unita sperimentali

L'unita di base del benchmark e il `BenchmarkRun`, che rappresenta una singola combinazione tra:

- un caso clinico
- un modello
- una configurazione di prompt
- una scelta esplicita sul contesto incluso

### Variabili principali

#### Variabili indipendenti

- modello LLM usato
- lingua del prompt
- inclusione o esclusione della discussione clinica
- eventuale uso della pipeline legacy o RAG

#### Variabili dipendenti

- similarita semantica rispetto al gold standard
- latenza
- valutazione umana
- qualita della giustificazione clinica

### Condizioni minime da controllare

Per evitare confronti fuorvianti, ogni esperimento dovrebbe esplicitare:

- snapshot del dataset
- disponibilita effettiva del modello su Ollama
- versione del prompt
- lingua del prompt
- parametri del modello se modificati
- data e ambiente di esecuzione

### Processo consigliato

1. selezionare un insieme coerente di casi
2. verificare la revisione manuale dei casi scelti
3. scegliere i modelli da confrontare
4. fissare una configurazione unica del prompt
5. lanciare il benchmark
6. esportare e archiviare i risultati
7. aggiungere valutazioni manuali su un sottoinsieme o sull'intero corpus

### Rischi metodologici

- leakage dalla discussione clinica
- differenze tra modelli non dovute al reasoning ma alla disponibilita di contesto
- confusione tra similarita lessicale e correttezza clinica
- dati sporchi o estratti male
- drift del modello Ollama tra esecuzioni non documentate

### Raccomandazioni per la tesi

- mantenere un catalogo degli esperimenti
- assegnare un identificatore stabile a ogni prompt
- esportare run e KPI dopo ogni campagna sperimentale
- usare la valutazione umana per validare le metriche automatiche

## English

### Objective

Benchmarking in LLMind2 should be treated as a controlled experiment rather than a mere application run. This document defines the minimum recommended protocol for producing defensible results in a dissertation, paper, or academic presentation.

### Experimental units

The basic benchmark unit is the `BenchmarkRun`, representing a single combination of:

- one clinical case
- one model
- one prompt configuration
- one explicit context inclusion choice

### Main variables

#### Independent variables

- selected LLM
- prompt language
- inclusion or exclusion of discussion text
- possible use of legacy or RAG pipeline

#### Dependent variables

- semantic similarity against the gold standard
- latency
- human evaluation
- quality of clinical justification

### Minimum controlled conditions

To avoid misleading comparisons, each experiment should explicitly record:

- dataset snapshot
- actual model availability in Ollama
- prompt version
- prompt language
- model parameters if changed
- execution date and environment

### Recommended process

1. select a coherent case set
2. verify manual review status of selected cases
3. choose the models to compare
4. freeze a single prompt configuration
5. launch the benchmark
6. export and archive results
7. add human evaluations on a subset or the full corpus

### Methodological risks

- leakage from clinical discussion text
- differences driven by context availability rather than reasoning quality
- confusion between lexical similarity and clinical correctness
- noisy or poorly extracted data
- undocumented Ollama model drift across runs

### Dissertation recommendations

- maintain an experiment catalog
- assign a stable identifier to each prompt
- export runs and KPIs after each experiment campaign
- use human evaluation to validate automatic metrics

