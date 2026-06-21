# Architecture / Architettura

## Italiano

### Visione generale

L'estensione GCP aggiunge a LLMind2 un livello conversazionale gestito. L'idea non e sostituire lo stack locale, ma affiancarlo con una traiettoria cloud riproducibile: LLMind2 resta il banco di lavoro per ICD-11, casi DSM-5-TR, benchmark e analisi; Google Cloud ospita i corpora PDF, li indicizza in datastore e li espone a playbook conversazionali orientati a task di ricerca.

### Livelli di risorsa

Il livello foundation e gestito da Terraform e comprende API abilitate, bucket GCS, service account e IAM.

Il livello knowledge e gestito da manifest e script: qui vivono i corpora ICD-11 CDDR, DSM-5-TR Clinical Cases e protocolli interni LLMind2.

Il livello conversational e gestito dagli script Dialogflow: agente base, playbook di routine, playbook task-specific e esempi di conversazione.

### Topologia dei playbook

- `Clinical Intake Triage`: punto di ingresso, raccoglie la vignetta e decide il percorso
- `ICD-11 Coding Assistant`: supporta mapping verso categorie ICD-11 candidate
- `Differential Diagnosis Supervisor`: confronta ipotesi diagnostiche senza sostituire il clinico
- `Benchmark Case Reviewer`: aiuta a controllare casi estratti prima del benchmark
- `Research Protocol Navigator`: risponde su protocollo, governance e metodologia
- `Safety and Scope Guardrail`: gestisce limiti, sicurezza e rischio acuto

### Topologia dei datastore

- `icd11-cddr`: criteri, descrizioni, inclusioni, esclusioni e note differenziali ICD-11
- `dsm5-clinical-cases`: casi clinici e discussioni DSM-5-TR con licenza appropriata
- `llmind-research-protocols`: protocolli, benchmark, governance e roadmap scientifica del progetto

### Integrazione futura con LLMind2

La prima versione puo essere document-only, quindi basata su PDF e data store. Una seconda versione puo introdurre webhook tool per cercare nelle API ICD-11 locali, leggere casi benchmark, inviare valutazioni, esportare risultati sperimentali e creare tracciabilita completa fra conversazione, documento sorgente e revisione umana.

### Livello sottoagenti

Le specifiche in `subagents/` rendono il livello playbook piu facile da testare, discutere e far evolvere. Ogni sottoagente definisce ruolo, fonti, contratto di input/output, guardrail e criteri di qualita prima che quel comportamento venga implementato come playbook Dialogflow, tool o servizio webhook.

Il livello corrente include routing clinico, nosologia ICD-11, curatela dei casi DSM-5-TR, supervisione della diagnosi differenziale, metodologia benchmark e governance di sicurezza.

## Overview

The GCP extension adds a managed conversational layer around LLMind2 research assets.

The intended system shape is:

- LLMind2 remains the research workbench for local ICD-11 exploration, case review, benchmark history, and researcher-facing analysis.
- Google Cloud Storage stores curated PDF corpora.
- Agent Search data stores index the PDF corpora.
- BigQuery stores static ICD-11 and DSM-5-TR extracted records for low-cost structured agent lookup.
- Dialogflow CX Conversational Agents expose task-oriented generative playbooks.
- Playbooks use data store tools and optional webhook tools to ground answers in curated documents and LLMind2 APIs.

## Resource layers

### Foundation

Provisioned by Terraform:

- required Google APIs
- GCS bucket for PDF corpora
- service account for automation
- IAM bindings

### Knowledge layer

Provisioned by upload and data-store scripts:

- ICD-11 CDDR PDF corpus
- DSM-5-TR clinical cases corpus
- LLMind2 research protocol corpus

### Conversational layer

Provisioned by Dialogflow API scripts:

- base Dialogflow CX agent
- routine playbooks
- task playbooks
- examples for each playbook
- versioned subagent specifications for routing, nosology, DSM case curation, differential reasoning, benchmarking, and safety governance

## Playbook topology

The recommended playbook topology is:

- `Clinical Intake Triage` as the opening routine
- `ICD-11 Coding Assistant` as a task playbook
- `Differential Diagnosis Supervisor` as a task playbook
- `Benchmark Case Reviewer` as a task playbook
- `Research Protocol Navigator` as a task playbook
- `Safety and Scope Guardrail` as a reusable task playbook

## Data store topology

Recommended data stores:

- `icd11-cddr`: ICD-11 Clinical Descriptions and Diagnostic Requirements
- `dsm5-clinical-cases`: DSM-5-TR case examples and discussions
- `llmind-research-protocols`: local research protocols, benchmark rules, and governance documents

## Integration with LLMind2

The first implementation can be document-only. Later, add webhook tools for:

- searching LLMind2 ICD-11 API
- retrieving benchmark cases
- submitting benchmark evaluations
- exporting experiment summaries

## Subagent layer

The subagent specifications in `subagents/` make the playbook layer easier to test and extend. Each subagent defines role, sources, input/output contract, guardrails, and quality criteria before that behavior is implemented as a Dialogflow playbook, tool, or webhook-backed service.

The current layer includes clinical routing, ICD-11 nosology, DSM-5-TR case curation, differential diagnosis supervision, benchmark methodology, and safety governance.
