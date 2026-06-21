# Manuale d'Uso / User Manual

## Italiano

### A chi e rivolto

Questo manuale e pensato per ricercatori, dottorandi, collaboratori clinici e studenti avanzati che devono usare LLMind2 senza necessariamente conoscere l'intero codice sorgente. L'obiettivo non e solo spiegare dove cliccare, ma anche chiarire il significato operativo dei moduli del sistema in un contesto scientifico.

### Esperienza generale

L'applicazione e organizzata come una piattaforma di lavoro piuttosto che come una singola utility. L'utente entra in un ambiente in cui puo esplorare conoscenza ICD-11, testare modelli, correggere casi clinici, eseguire benchmark e interrogare archivi documentali specializzati.

### Modulo ICD-11

Il modulo ICD-11 serve a esplorare la classificazione diagnostica e a recuperare rapidamente informazioni su categorie, titoli, descrizioni e relazioni gerarchiche. E utile sia come supporto di studio sia come strumento di grounding durante l'analisi dei casi.

Usi tipici:

- cercare un codice o un termine clinico
- leggere metadati diagnostici associati a una categoria
- navigare dai capitoli alle sottocategorie
- confrontare la formulazione di diversi nodi tassonomici

### Modulo Chat

La chat e una superficie sperimentale che permette di usare modelli Ollama in due modalita principali:

- `icd11`: ricerca e spiegazione orientata alla classificazione
- `wellbeing`: ragionamento differenziale e consultazione clinica simulata

La cronologia e persistente, quindi le conversazioni possono essere riprese, confrontate e analizzate nel tempo. Questo e molto utile per test qualitativi, audit di prompt e costruzione di casi studio nella ricerca.

### Modulo Benchmark

Il benchmark e il cuore sperimentale della piattaforma. Qui l'utente puo:

- consultare l'elenco dei casi clinici
- aprire il dettaglio di un caso
- correggere manualmente eventuali errori di estrazione
- selezionare uno o piu modelli
- lanciare benchmark batch
- osservare KPI, latenze, similarita e rating manuali

Questo modulo va usato con disciplina metodologica. Prima di confrontare modelli, bisogna verificare:

- coerenza del dataset
- lingua del prompt
- presenza o assenza della discussione clinica
- modello effettivamente disponibile su Ollama

### Modulo Datastore

I datastore permettono di costruire basi di conoscenza specializzate, utili per retrieval e risposte contestualizzate. Sono particolarmente interessanti per la ricerca su RAG clinico e per costruire confronti tra knowledge configurations differenti.

### Flusso utente raccomandato

Per una sessione di ricerca standard, il flusso consigliato e:

1. verificare salute del backend e disponibilita dei modelli
2. esplorare ICD-11 per definire o affinare la cornice nosologica
3. aprire i casi benchmark e rivedere i testi
4. eseguire i benchmark con configurazione esplicita
5. leggere metriche e output
6. usare la chat per analisi qualitative complementari

### Buone pratiche utente

- non confrontare run eseguiti con prompt diversi senza documentarlo
- non trattare output del modello come verdetti clinici
- segnare sempre se un caso e stato revisionato manualmente
- usare la cronologia chat come materiale osservativo, non come fonte clinica definitiva

## English

### Intended audience

This manual is intended for researchers, PhD candidates, clinical collaborators, and advanced students who need to use LLMind2 without mastering the entire source code. The goal is not only to explain navigation, but also to clarify how each module should be interpreted in a scientific workflow.

### Overall experience

The application is structured as a working platform rather than a single-purpose utility. Users operate within an environment where they can explore ICD-11 knowledge, test language models, correct clinical cases, execute benchmarks, and query specialized document stores.

### ICD-11 module

The ICD-11 area is designed for structured exploration of diagnostic knowledge. It helps users retrieve categories, descriptions, metadata, and hierarchical relations. This is valuable both for study and for ontology-grounded reasoning during case analysis.

Typical uses include:

- searching for a code or clinical term
- reviewing diagnostic metadata
- navigating from chapters to subcategories
- comparing related nosological entities

### Chat module

The chat surface allows users to work with Ollama models in two primary modes:

- `icd11`: classification-oriented explanation and lookup
- `wellbeing`: differential reasoning and simulated clinical consultation

Because conversation history is persistent, dialogs can be resumed, compared, and studied over time. This is especially useful for qualitative evaluation, prompt auditing, and research case narratives.

### Benchmark module

Benchmarking is the experimental core of the platform. Here users can:

- inspect the case inventory
- open case details
- manually correct extraction issues
- select one or more models
- launch batch benchmark runs
- inspect KPIs, latency, similarity, and human ratings

This module should be used with methodological discipline. Before comparing models, users should verify:

- dataset consistency
- prompt language
- whether discussion text is included
- whether the selected model is actually available in Ollama

### Datastore module

Datastores allow the creation of specialized knowledge bases for retrieval-augmented workflows. They are particularly interesting for clinical RAG research and for experiments comparing different knowledge configurations.

### Recommended user flow

For a standard research session, a useful workflow is:

1. verify backend health and model availability
2. explore ICD-11 to refine the nosological frame
3. inspect and review benchmark cases
4. run benchmarks with an explicit configuration
5. inspect metrics and outputs
6. use chat for complementary qualitative analysis

### Good user practices

- do not compare runs produced with different prompts without documenting that difference
- do not treat model output as clinical truth
- always record whether a case has been manually reviewed
- use chat history as observational material, not definitive clinical evidence

