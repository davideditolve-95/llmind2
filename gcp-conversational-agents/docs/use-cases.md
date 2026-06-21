# Use Cases / Casi d'uso

## Italiano

### UC-01 Triage della vignetta clinica

Obiettivo: raccogliere una descrizione strutturata senza produrre troppo presto una diagnosi finale.

Playbook principale: `Clinical Intake Triage`.

Comportamento atteso: chiedere problema principale, durata, compromissione funzionale, rischio, sostanze, contesto medico e diagnosi precedenti; identificare informazioni mancanti; instradare verso diagnosi differenziale solo quando il contesto e sufficiente; attivare il guardrail quando emergono rischio suicidario, violenza, psicosi acuta o emergenza medica.

### UC-02 Supporto alla codifica ICD-11

Obiettivo: aiutare il ricercatore a mappare sintomi o diagnosi verso categorie ICD-11 candidate.

Playbook principale: `ICD-11 Coding Assistant`.

Comportamento atteso: usare prima il datastore ICD-11, restituire categorie candidate con incertezza esplicita, distinguere categoria, inclusioni, esclusioni e note differenziali, evitare inferenze non supportate dal materiale disponibile.

### UC-03 Supervisione della diagnosi differenziale

Obiettivo: simulare un supervisore clinico che confronta ipotesi concorrenti e rende visibili le ragioni pro e contro.

Playbook principale: `Differential Diagnosis Supervisor`.

Comportamento atteso: produrre una tabella di ipotesi, evidenze confermative e disconfermative, condizioni da escludere, dati mancanti e una sola domanda di follow-up prioritaria quando il caso non e ancora sufficientemente determinato.

### UC-04 Revisione dei casi benchmark

Obiettivo: aiutare un ricercatore a controllare casi DSM-5-TR estratti prima dell'esecuzione del benchmark.

Playbook principale: `Benchmark Case Reviewer`.

Comportamento atteso: verificare presenza di anamnesi, discussione e diagnosi gold standard; segnalare artefatti di estrazione; proporre note di revisione; non modificare mai la diagnosi gold standard senza conferma umana esplicita.

### UC-05 Navigazione del protocollo di ricerca

Obiettivo: rispondere a domande su metodologia, governance, benchmark, rischi e roadmap di tesi.

Playbook principale: `Research Protocol Navigator`.

Comportamento atteso: citare il corpus protocollare quando disponibile, distinguere decisioni metodologiche da task ingegneristici, segnalare rischi residui e mantenere linguaggio adatto a documentazione scientifica.

### UC-06 Guardrail clinico e scope control

Obiettivo: impedire che il sistema venga percepito come consulente medico diretto o sostituto del giudizio clinico.

Playbook principale: `Safety and Scope Guardrail`.

Comportamento atteso: riconoscere richieste fuori perimetro, emergenze e segnali di rischio; spostare l'utente verso canali appropriati; mantenere il frame di ricerca; evitare istruzioni operative per autolesionismo, violenza o abuso di sostanze.

## UC-01 Clinical intake triage

Goal:
Collect a structured description of a clinical vignette without issuing a final diagnosis too early.

Primary playbook:
`Clinical Intake Triage`

Expected behavior:

- ask for presenting concern, duration, impairment, risk, substances, medical context, and prior diagnosis
- identify missing information
- route to differential diagnosis only when sufficient context exists
- add safety reminder when acute risk is mentioned

## UC-02 ICD-11 coding support

Goal:
Help a researcher map symptoms or diagnoses to candidate ICD-11 categories.

Primary playbook:
`ICD-11 Coding Assistant`

Expected behavior:

- use ICD-11 data store first
- return candidate codes with uncertainty
- distinguish category, inclusion, exclusion, and differential notes
- avoid overclaiming when evidence is insufficient

## UC-03 Differential diagnosis supervision

Goal:
Simulate a clinical supervisor that compares multiple hypotheses.

Primary playbook:
`Differential Diagnosis Supervisor`

Expected behavior:

- produce a hypothesis table
- list confirmatory and disconfirmatory evidence
- ask one targeted follow-up question when needed
- state provisional diagnosis only when enough information exists

## UC-04 Benchmark case review

Goal:
Support a researcher reviewing extracted DSM-5-TR cases before benchmark execution.

Primary playbook:
`Benchmark Case Reviewer`

Expected behavior:

- detect whether anamnesis, discussion, and gold standard diagnosis are present
- flag possible extraction artifacts
- propose review notes
- avoid changing the gold standard without explicit human confirmation

## UC-05 Research protocol navigation

Goal:
Answer questions about the LLMind2 research protocol and benchmark methodology.

Primary playbook:
`Research Protocol Navigator`

Expected behavior:

- cite protocol sections from the data store when possible
- explain benchmark variables and risks
- distinguish engineering tasks from methodological decisions
