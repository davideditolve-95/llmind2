# Subagents / Sottoagenti

## Italiano

Questa cartella definisce una squadra di sottoagenti specializzati per LLMind2 su GCP. I file sono specifiche operative versionabili: non sostituiscono i playbook Dialogflow, ma li rendono piu governabili. Ogni sottoagente dichiara missione, fonti, contratto di input/output, guardrail e responsabilita.

### Perche usare sottoagenti

Un singolo playbook clinico tende a diventare troppo grande: triage, nosologia ICD-11, casi DSM-5-TR, benchmark, sicurezza e governance richiedono criteri diversi. Separare questi ruoli riduce confusione, facilita il testing e permette a piu agenti di sviluppo di lavorare senza pestarsi i piedi.

### Squadra proposta

- `clinical-intake-router`: raccoglie la vignetta e decide il percorso.
- `icd11-nosology-specialist`: usa ICD-11 CDDR e il database ICD-11 popolato dallo script API per categorie candidate, esclusioni e differenziali.
- `dsm5-case-curator`: controlla casi DSM estratti, leakage, artefatti e readiness benchmark.
- `differential-diagnosis-supervisor`: costruisce differenziali trasparenti con evidenze pro/contro.
- `benchmark-methodologist`: protegge validita sperimentale, metriche e riproducibilita.
- `safety-governance-officer`: gestisce rischio, privacy, scope clinico e revisione umana.

### Fonti locali

- `backend/data/original_docs/ICD-11-CDDR.pdf`
- `backend/scripts/extract_icd11_data.py`
- tabella PostgreSQL `icd11_categories`
- `backend/data/original_docs/DSM-5-TR_Clinical_Cases.txt`
- `backend/data/original_docs/DSM-5-TR_Clinical_Cases_splitted.csv`

### Regola pratica

Quando un playbook produce una risposta, deve indicare se sta lavorando da retrieval documentale, da inferenza clinica strutturata o da protocollo di ricerca. Questa distinzione e centrale per una piattaforma scientifica: consente audit, revisione umana e confronto fra modelli.

## English

This folder defines a specialist subagent team for LLMind2 on GCP. These files are versionable operational specifications: they do not replace Dialogflow playbooks, but make them easier to govern. Each subagent declares mission, sources, input/output contract, guardrails, and responsibilities.

### Why subagents

A single clinical playbook quickly becomes too broad. Intake, ICD-11 nosology, DSM-5-TR case curation, benchmarking, safety, and governance require different criteria. Separating roles reduces confusion, improves testing, and lets multiple development agents extend the system safely.

### Proposed team

- `clinical-intake-router`: collects the vignette and selects the route.
- `icd11-nosology-specialist`: uses ICD-11 CDDR and the API-extracted ICD-11 database table for candidates, exclusions, and differentials.
- `dsm5-case-curator`: checks extracted DSM cases, leakage, artifacts, and benchmark readiness.
- `differential-diagnosis-supervisor`: builds transparent differentials with evidence for and against.
- `benchmark-methodologist`: protects experimental validity, metrics, and reproducibility.
- `safety-governance-officer`: handles risk, privacy, clinical scope, and human review.
