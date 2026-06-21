# Note di Ricerca / Research Notes

## Italiano

### Valore scientifico attuale

LLMind2 non e interessante solo per quello che fa, ma per il tipo di ricerca che consente. La piattaforma mette insieme conoscenza tassonomica, casi clinici, modelli generativi, metriche automatiche e valutazioni umane. Questa combinazione e rara nei prototipi accademici e offre un terreno fertile per una tesi con sia profondita teorica sia output ingegneristico.

### Domande di ricerca plausibili

- In che misura il grounding su ICD-11 migliora accuratezza, coerenza e giustificabilita diagnostica?
- La similarita semantica e un buon proxy della valutazione umana nei casi clinici?
- L'aggiunta della sezione di discussione clinica migliora davvero la performance o introduce leakage concettuale?
- Quali modelli open-weight si comportano meglio in compiti di diagnosi differenziale strutturata?
- Quale ruolo possono avere agenti multipli nel decomporre un workflow clinico-sperimentale?

### Asset sperimentali gia presenti

- corpus ICD-11 strutturato
- casi DSM-5-TR con editing manuale
- benchmark run persistenti
- rating manuali
- cronologia chat
- datastores per ricerca RAG

### Gap metodologici da colmare

Per trasformare il progetto in infrastruttura di ricerca eccellente, conviene aggiungere:

- versionamento esplicito di prompt e system prompt
- identificazione piu formale dei modelli e delle loro varianti
- snapshot del dataset usato in ciascun esperimento
- tracciabilita dell'utente o agente che ha avviato un benchmark
- esportazione strutturata dei risultati per analisi statistiche esterne

### Possibili capitoli di tesi collegati

1. quadro teorico su reasoning clinico e grounding ontologico
2. disegno e implementazione della piattaforma
3. costruzione del corpus e data curation
4. protocollo di benchmarking multi-modello
5. confronto tra metriche automatiche e valutazioni umane
6. estensione multi-agente e implicazioni metodologiche

## English

### Current scientific value

LLMind2 is valuable not only because of what it does, but because of the kind of research it enables. The platform combines taxonomic knowledge, clinical cases, generative models, automatic metrics, and human assessment. This combination is uncommon in academic prototypes and creates fertile ground for a dissertation with both theoretical depth and engineering output.

### Plausible research questions

- To what extent does ICD-11 grounding improve diagnostic accuracy, coherence, and explainability?
- Is semantic similarity a reliable proxy for human judgment in clinical cases?
- Does adding the clinical discussion section genuinely improve performance, or does it introduce conceptual leakage?
- Which open-weight models behave best in structured differential diagnosis tasks?
- What role can multiple agents play in decomposing clinical-experimental workflows?

### Experimental assets already present

- structured ICD-11 corpus
- DSM-5-TR cases with manual editing
- persistent benchmark runs
- manual ratings
- chat history
- RAG-oriented datastores

### Methodological gaps to close

To turn the project into excellent research infrastructure, it would be useful to add:

- explicit prompt and system prompt versioning
- more formal identification of model variants
- dataset snapshots for each experiment
- traceability of the user or agent who launched each benchmark
- structured export for external statistical analysis

### Possible dissertation chapters

1. theoretical framework on clinical reasoning and ontology grounding
2. platform design and implementation
3. corpus construction and data curation
4. multi-model benchmarking protocol
5. comparison between automatic metrics and human evaluation
6. multi-agent extension and methodological implications

