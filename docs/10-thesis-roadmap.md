# Roadmap di Tesi / Thesis Roadmap

## Italiano

### Scopo

Questo documento traduce la piattaforma LLMind2 in un possibile percorso di dottorato. L'obiettivo e fare in modo che il software non sia solo un prodotto da migliorare, ma un'infrastruttura intorno a cui costruire domande di ricerca, esperimenti, capitoli di tesi e potenziali pubblicazioni.

### Tesi possibile

Una formulazione credibile della traiettoria scientifica potrebbe essere:

“Progettazione, implementazione e valutazione di una piattaforma ontology-grounded per il reasoning clinico con large language models, con particolare attenzione a benchmarking multi-modello, valutazione human-in-the-loop e orchestrazione multi-agente.”

### Fasi consigliate

#### Fase 1: consolidamento della piattaforma

In questa fase il focus e trasformare il prototipo in ambiente sperimentale affidabile. Le priorita sono:

- chiarire contratti API e dati
- migliorare documentazione e governance
- rendere piu riproducibili benchmark e configurazioni
- ridurre bug strutturali che possono falsare i risultati

#### Fase 2: costruzione del protocollo sperimentale

Serve definire:

- quali modelli confrontare
- quali casi usare
- quali condizioni controllare
- quali metriche considerare principali e secondarie
- quali criteri usare per le valutazioni manuali

#### Fase 3: studi comparativi

Possibili studi:

- confronto tra modelli open-weight su casi clinici omogenei
- confronto con e senza discussione clinica
- confronto tra prompting in italiano e inglese
- confronto tra benchmark puro e pipeline RAG o legacy

#### Fase 4: analisi metodologica

Questa fase collega il prodotto alla tesi in modo forte:

- validita delle metriche automatiche
- robustezza rispetto al prompt
- impatto della revisione manuale dei dati
- ruolo dell'ontologia ICD-11 come vincolo epistemico

#### Fase 5: estensione multi-agente

Qui la piattaforma puo diventare anche laboratorio per:

- decomposizione del ragionamento clinico tra agenti
- audit reciproco tra agenti
- separazione tra retrieval, reasoning, critique ed evaluation agents

### Deliverable accademici possibili

- un primo paper architetturale sulla piattaforma
- un paper benchmark sui modelli
- un paper metodologico sulla relazione tra metriche automatiche e giudizio umano
- un capitolo o paper su orchestrazione multi-agente in contesto clinico

## English

### Purpose

This document translates LLMind2 into a plausible doctoral pathway. The goal is to ensure that the software is not merely an application to improve, but an infrastructure around which research questions, experiments, dissertation chapters, and publications can be built.

### Possible dissertation framing

A credible scientific trajectory could be framed as:

“Design, implementation, and evaluation of an ontology-grounded platform for clinical reasoning with large language models, with particular attention to multi-model benchmarking, human-in-the-loop evaluation, and multi-agent orchestration.”

### Recommended phases

#### Phase 1: platform consolidation

The objective here is to turn the current prototype into a reliable experimental environment. Priorities include:

- clarifying API and data contracts
- improving documentation and governance
- increasing benchmark reproducibility
- reducing structural bugs that could distort results

#### Phase 2: experimental protocol design

This phase should define:

- which models to compare
- which cases to use
- which conditions to control
- which metrics are primary or secondary
- which criteria should guide human evaluation

#### Phase 3: comparative studies

Possible studies include:

- comparison of open-weight models on homogeneous clinical cases
- comparison with and without discussion text
- comparison between Italian and English prompting
- comparison between direct benchmarking and RAG or legacy pipelines

#### Phase 4: methodological analysis

This is where the product strongly connects to the dissertation:

- validity of automatic metrics
- robustness to prompt variation
- effect of manual data review
- role of ICD-11 ontology as an epistemic constraint

#### Phase 5: multi-agent extension

The platform can then become a laboratory for:

- decomposition of clinical reasoning across agents
- mutual auditing between agents
- separation of retrieval, reasoning, critique, and evaluation agents

### Potential academic deliverables

- an architectural paper on the platform
- a benchmark-focused paper on model performance
- a methodological paper on automatic metrics versus human judgment
- a chapter or paper on multi-agent orchestration in clinical contexts

