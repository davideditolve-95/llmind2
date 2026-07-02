# Supervisor Feedback Roadmap / Roadmap Feedback Responsabile

## Italiano

### Scopo

Questo documento raccoglie le decisioni operative derivate dalla call con il responsabile e le traduce in una roadmap di prodotto per LLMind2. Il principio guida e preservare la natura scientifica della piattaforma: LLMind2 non deve essere presentato come un singolo modello, ma come ambiente di ricerca per casi clinici, pazienti, grounding DSM-5/ICD-11 e benchmark multi-modello.

### Cambiamenti di posizionamento

- LLMind2 e la piattaforma di ricerca.
- Il modello LLM e una variabile sperimentale, per esempio Gemma, Llama, Mistral o altri.
- Il runtime o provider e un livello separato, per esempio Ollama, OpenAI, GCP o endpoint custom.
- I DSM-5 Clinical Cases sono il dataset riproducibile per benchmark.
- I pazienti sono profili operativi legati all'account utente e non vanno confusi con il dataset benchmark.
- Gli agenti e la conoscenza AIFA sono estensioni sperimentali specialistiche, non il messaggio iniziale del prodotto.

### Modifiche UI iniziali implementabili senza migrazione

- Home page orientata ai pilastri: Patients, DSM-5 Clinical Cases, Benchmark Lab, Knowledge Grounding.
- Navbar con naming piu chiaro:
  - Patients
  - DSM-5 Clinical Cases
  - Benchmark Lab
  - Knowledge Bases
  - Experimental Agents
- Sezione Patients evidenziata come workspace utente.
- Sezione Case Registry rinominata in DSM-5 Clinical Cases.
- GCP Agents e AIFA Drug Knowledge spostati sotto area Experimental.

### Decisioni da discutere con David prima del push/deploy

- Eventuale migrazione o rinomina persistente di tabelle e campi.
- Politica definitiva di isolamento dati per pazienti legati all'account.
- Import massivo o conversione automatica da DSM-5 Clinical Cases a pazienti.
- Versionamento formale di dataset, prompt e benchmark protocol.
- Gestione auth in sviluppo locale rispetto a produzione.

### Rischi aperti

- Cambiare nomi di route o modelli persistenti potrebbe rompere link, dati esistenti o confrontabilita sperimentale.
- Mescolare pazienti utente e dataset benchmark renderebbe meno chiaro il disegno scientifico.
- Presentare gli agenti come funzionalita primaria potrebbe spostare il focus del paper lontano da benchmark e riproducibilita.

### Prossimi passi consigliati

1. Completare la riorganizzazione visuale senza cambiare schema.
2. Testare con dati reali: home, pazienti, DSM-5 Clinical Cases, Benchmark Lab.
3. Preparare una proposta di onboarding guidato.
4. Disegnare il contratto dati per import paziente da caso clinico.
5. Aggiornare paper e documentazione con la distinzione piattaforma/runtime/modello.

## English

### Purpose

This document captures the operational decisions derived from the supervisor call and translates them into a product roadmap for LLMind2. The guiding principle is to preserve the scientific nature of the platform: LLMind2 should not be presented as a single model, but as a research environment for clinical cases, patients, DSM-5/ICD-11 grounding, and multi-model benchmarking.

### Positioning changes

- LLMind2 is the research platform.
- The LLM is an experimental variable, such as Gemma, Llama, Mistral, or another model.
- The runtime or provider is a separate layer, such as Ollama, OpenAI, GCP, or a custom endpoint.
- DSM-5 Clinical Cases are the reproducible benchmark dataset.
- Patients are user-linked operational profiles and should not be confused with the benchmark dataset.
- Agents and AIFA knowledge are specialist experimental extensions, not the initial product message.

### Initial UI changes that do not require migration

- Home page organized around core pillars: Patients, DSM-5 Clinical Cases, Benchmark Lab, Knowledge Grounding.
- Clearer navigation naming:
  - Patients
  - DSM-5 Clinical Cases
  - Benchmark Lab
  - Knowledge Bases
  - Experimental Agents
- Patients section highlighted as the user workspace.
- Case Registry renamed to DSM-5 Clinical Cases.
- GCP Agents and AIFA Drug Knowledge moved under Experimental.

### Decisions to discuss with David before push/deploy

- Any persistent table or field renaming.
- Final user-data isolation policy for account-linked patients.
- Bulk import or automatic conversion from DSM-5 Clinical Cases to patients.
- Formal versioning for datasets, prompts, and benchmark protocols.
- Local-development authentication behavior versus production behavior.

### Open risks

- Renaming routes or persistent models may break links, existing data, or experimental comparability.
- Mixing user patients and benchmark datasets would weaken the scientific design.
- Presenting agents as a primary capability could shift the paper away from benchmarking and reproducibility.

### Recommended next steps

1. Complete visual reorganization without schema changes.
2. Test with real data: home, patients, DSM-5 Clinical Cases, Benchmark Lab.
3. Prepare a guided onboarding proposal.
4. Design the data contract for patient import from clinical cases.
5. Update the paper and documentation with the platform/runtime/model distinction.
