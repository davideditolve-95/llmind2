# LLMind2 - Panoramica del Progetto / Project Overview

## Italiano

### Visione generale

LLMind2 e una piattaforma di ricerca full-stack dedicata all'intelligenza artificiale clinica, alla navigazione della tassonomia ICD-11 e alla valutazione comparativa di modelli linguistici di grandi dimensioni in contesti diagnostici. Il progetto nasce con una duplice finalita: da un lato creare un prodotto realmente utilizzabile da ricercatori, clinici e studenti avanzati; dall'altro costruire un'infrastruttura metodologicamente solida su cui fondare un percorso di dottorato in AI, con particolare attenzione a riproducibilita, osservabilita sperimentale e collaborazione uomo-macchina.

La repo mostra gia un'impostazione coerente con un progetto di ricerca applicata: frontend separato dal backend, persistenza strutturata, pipeline di ingestion di fonti cliniche, benchmark multi-modello, cronologia delle conversazioni e spazio per workflow RAG. Questa combinazione rende il progetto piu vicino a una research platform che a un semplice prototipo dimostrativo.

### Problema che il progetto affronta

I sistemi LLM applicati alla salute mentale e alla diagnostica soffrono spesso di quattro limiti ricorrenti:

- mancanza di ancoraggio ontologico a sistemi diagnostici strutturati
- difficolta nel confrontare modelli diversi in modo sistematico
- assenza di dataset sperimentali curati e facilmente ispezionabili
- scarsa tracciabilita di prompt, risposte, metriche e revisioni umane

LLMind2 affronta questi limiti integrando un repository locale della conoscenza ICD-11, casi clinici DSM-5-TR strutturati, esecuzione di benchmark con piu modelli Ollama e raccolta sia di metriche automatiche sia di valutazioni manuali. In questo senso il sistema non e solo un'interfaccia per interrogare un modello, ma un ambiente sperimentale controllato.

### Obiettivi scientifici impliciti

Il progetto puo sostenere diversi filoni di ricerca, tra cui:

- ragionamento clinico assistito da ontologie diagnostiche
- benchmarking comparativo tra modelli open-weight in ambito clinico
- valutazione della relazione tra similarita semantica e giudizio umano
- studio dell'effetto dei prompt e della quantita di contesto sulla qualita diagnostica
- progettazione di sistemi multi-agente per ricerca clinica computazionale

### Moduli principali del prodotto

- esploratore ICD-11 con vista gerarchica e tabellare
- workspace conversazionale per domande su ICD-11 e ragionamento differenziale
- modulo benchmark su casi clinici DSM-5-TR
- gestione di datastore per conoscenza custom e RAG
- strato infrastrutturale per deploy locale e produzione su piattaforme tipo Coolify

### Perche questo progetto e adatto a un dottorato

Un buon progetto di dottorato ha bisogno di una base che consenta sia sviluppo prodotto sia produzione di evidenza scientifica. LLMind2 ha le proprieta giuste:

- ha una domanda scientifica credibile
- ha un perimetro tecnico abbastanza ampio da generare pubblicazioni, miglioramenti incrementali e validazioni empiriche
- permette di misurare output e non solo di mostrare demo
- puo evolvere in un ambiente multi-agente, cioe un tema fortissimo nella ricerca AI contemporanea

### Posizionamento corretto

Allo stato attuale il progetto va descritto come:

- piattaforma di ricerca clinico-informatica
- ambiente sperimentale per benchmark e reasoning support
- base per future estensioni verso auditabilita, governance e compliance

Non va invece descritto, senza ulteriore lavoro, come:

- dispositivo medico
- sistema diagnostico certificato
- soluzione gia pronta per contesti clinici regolati

Questa distinzione e importante sia per correttezza scientifica sia per futura conformita normativa.

## English

### General vision

LLMind2 is a full-stack research platform for clinical AI, ICD-11 knowledge exploration, and comparative evaluation of large language models in diagnostic contexts. The project is valuable both as a usable product for researchers and advanced practitioners and as a methodological backbone for a PhD journey in AI. Its structure already supports reproducibility, structured experimentation, and collaborative development involving both human contributors and AI agents.

The repository is organized more like a research-grade application platform than a demo. It combines a dedicated frontend, a service-oriented backend, structured persistence, ingestion pipelines for clinical sources, multi-model benchmarking, persistent chat history, and retrieval-oriented datastore capabilities. This blend is especially promising for doctoral work because it enables both software evolution and empirical study.

### Problem addressed by the platform

Many LLM systems for mental health and diagnostic support suffer from recurring limitations:

- weak grounding in formal diagnostic ontologies
- poor comparability across models
- lack of curated, inspectable experimental corpora
- insufficient traceability for prompts, responses, metrics, and human review

LLMind2 addresses these issues by integrating a local ICD-11 knowledge base, structured DSM-5-TR clinical cases, multi-model Ollama-based execution, and both automatic and human evaluation mechanisms. In this sense, the system is not merely a chat interface around an LLM, but a controlled environment for research and evaluation.

### Embedded research directions

The project can support several meaningful scientific lines of work:

- ontology-grounded clinical reasoning
- comparative benchmarking of open-weight LLMs in clinical settings
- alignment between semantic similarity metrics and expert human judgment
- influence of prompting strategy and contextual depth on diagnostic quality
- multi-agent orchestration for computational clinical research

### Main product modules

- ICD-11 explorer with hierarchical and tabular browsing
- conversational workspace for ICD-11 questions and differential reasoning
- benchmark module over DSM-5-TR clinical cases
- datastore management for custom knowledge and RAG workflows
- infrastructure layer for local and hosted deployment

### Why this is a strong PhD foundation

A solid doctoral product base must support both engineering and evidence generation. LLMind2 already has the right characteristics:

- a credible scientific problem space
- measurable outputs rather than only demonstrable interactions
- a technical breadth wide enough for iterative publications and experiments
- a natural path toward multi-agent collaboration, which is itself a major research direction in current AI

### Correct positioning

At this stage the project should be positioned as:

- a clinical informatics research platform
- an experimental environment for benchmarking and reasoning support
- a foundation for future work on governance, auditability, and compliance

It should not yet be presented as:

- a certified medical device
- a clinically approved diagnostic system
- a production-ready regulated-care solution

That distinction matters for scientific rigor and future regulatory alignment.

