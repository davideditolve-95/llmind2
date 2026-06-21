# Dossier Tecnico e Priorita / Technical Review Dossier

## Italiano

### Scopo

Questo dossier raccoglie una revisione tecnica orientata al rischio, alla robustezza metodologica e alla readiness per un progetto di dottorato. Le osservazioni sono basate sulla repo attuale e sono ordinate per priorita.

### Finding P1 - Logger non definito nel router chat

Riferimento:
[backend/app/routers/chat.py](/Users/davide/Documents/repos/llmind2/backend/app/routers/chat.py:116)

Problema:
il file usa `logger.error(...)` in piu punti, ma non definisce alcun `logger` locale. In caso di eccezione durante la creazione sessione, durante il bootstrap della stream o nel recupero history, l'handler di errore puo fallire con `NameError`, mascherando l'errore originario.

Impatto:
alto, perche colpisce un percorso core del prodotto e riduce la debuggabilita.

Priorita:
immediata.

### Finding P1 - CORS permissivo con wildcard

Riferimento:
[backend/app/main.py](/Users/davide/Documents/repos/llmind2/backend/app/main.py:50)

Problema:
la configurazione CORS include `*` insieme a `allow_credentials=True`. Anche al di la del comportamento effettivo del middleware, l'intento configurativo e troppo permissivo per un sistema che gestisce contenuti clinici, benchmark e cronologie persistenti.

Impatto:
alto, sia sul piano sicurezza sia sul piano di maturita verso ambienti piu regolati.

Priorita:
immediata.

### Finding P1 - Stop benchmark globale e non isolato

Riferimento:
[backend/app/routers/benchmark.py](/Users/davide/Documents/repos/llmind2/backend/app/routers/benchmark.py:31)

Problema:
la variabile globale `_CANCEL_ALL` interrompe indiscriminatamente i job in esecuzione. In presenza di piu utenti o piu batch, un arresto puo avere effetti collaterali trasversali non desiderati.

Impatto:
alto, perche compromette affidabilita operativa e validita sperimentale.

Priorita:
immediata.

### Finding P1 - Cancellazione datastore con logica distruttiva fragile

Riferimento:
[backend/app/routers/datastore.py](/Users/davide/Documents/repos/llmind2/backend/app/routers/datastore.py:159)

Problema:
la delete rimuove `vector_path`, ma prova anche a cancellare `source_file` come se fosse un path reale. In fase di creazione, pero, `source_file` viene valorizzato come stringa separata da virgole con i nomi dei file del preset, non come path reale. Questo significa che la semantica del campo e ambigua e la logica distruttiva e fragile.

Impatto:
alto, perche puo creare comportamenti incoerenti e rende poco affidabile la gestione degli archivi di conoscenza.

Priorita:
immediata.

### Finding P2 - Reset automatico delle tabelle chat a startup

Riferimento:
[backend/app/main.py](/Users/davide/Documents/repos/llmind2/backend/app/main.py:103)

Problema:
in presenza di mismatch schema, il backend puo eseguire `DROP TABLE` sulle tabelle chat. Questa scelta e pragmatica in sviluppo, ma per un ambiente di ricerca con cronologie persistenti e potenziale valore sperimentale e rischiosa.

Impatto:
medio-alto.

Priorita:
alta, da gestire prima di usare il sistema come archivio stabile di esperimenti conversazionali.

### Finding P2 - Retry benchmark passa una sessione DB request-scoped a un task asincrono

Riferimento:
[backend/app/routers/benchmark.py](/Users/davide/Documents/repos/llmind2/backend/app/routers/benchmark.py:247)

Problema:
il retry usa `background_tasks.add_task(...)` passando `db=db`, cioe la sessione della request. Questo puo funzionare in scenari semplici, ma e architetturalmente fragile rispetto al ciclo di vita della request e puo produrre bug intermittenti.

Impatto:
medio-alto.

Priorita:
alta.

### Finding P2 - Benchmark history con pattern N+1

Riferimento:
[backend/app/routers/benchmark.py](/Users/davide/Documents/repos/llmind2/backend/app/routers/benchmark.py:297)

Problema:
per ogni run viene rieseguita una query per recuperare il caso associato. La pagina history puo degradare rapidamente con l'aumentare del dataset.

Impatto:
medio.

Priorita:
media-alta.

### Debito tecnico principale

- migrazioni schema non ancora pienamente formalizzate
- assenza di auth e ruoli
- assenza di registrazione esplicita della versione dei prompt
- osservabilita ancora limitata a log e health endpoint
- modello benchmark promettente ma non ancora supportato da experiment registry

### Priorita consigliate per rendere il progetto PhD-ready

1. correggere i bug P1 e rendere sicure le operazioni distruttive
2. introdurre controllo piu robusto dei job benchmark
3. formalizzare versionamento di prompt, dataset e campagne sperimentali
4. introdurre audit, auth e hardening minimo
5. migliorare export e analisi dei risultati

## English

### Purpose

This dossier collects a risk-oriented technical review focused on robustness, methodological integrity, and PhD readiness. The observations are based on the current repository state and ordered by priority.

### Finding P1 - Undefined logger in chat router

Reference:
[backend/app/routers/chat.py](/Users/davide/Documents/repos/llmind2/backend/app/routers/chat.py:116)

Issue:
the file calls `logger.error(...)` in multiple places but does not define a local `logger`. If an exception occurs during session creation, stream bootstrap, or history retrieval, the error handler may itself fail with `NameError`, masking the original issue.

Impact:
high, because it affects a core product flow and reduces debuggability.

Priority:
immediate.

### Finding P1 - Overly permissive CORS configuration

Reference:
[backend/app/main.py](/Users/davide/Documents/repos/llmind2/backend/app/main.py:50)

Issue:
the CORS configuration includes `*` together with `allow_credentials=True`. Beyond middleware-specific behavior, the intended access posture is too permissive for a system handling clinical content, benchmark artifacts, and persistent histories.

Impact:
high for both security and maturity toward more controlled environments.

Priority:
immediate.

### Finding P1 - Global benchmark stop not isolated by batch or user

Reference:
[backend/app/routers/benchmark.py](/Users/davide/Documents/repos/llmind2/backend/app/routers/benchmark.py:31)

Issue:
the global `_CANCEL_ALL` variable stops jobs indiscriminately. In a multi-user or multi-batch setting, one stop action can affect unrelated work.

Impact:
high because it undermines both operational reliability and experimental validity.

Priority:
immediate.

### Finding P1 - Fragile destructive datastore deletion logic

Reference:
[backend/app/routers/datastore.py](/Users/davide/Documents/repos/llmind2/backend/app/routers/datastore.py:159)

Issue:
the delete path removes `vector_path`, but also tries to delete `source_file` as if it were a real filesystem path. During creation, however, `source_file` is stored as a comma-separated string of preset filenames rather than a real path. This makes the field semantics ambiguous and the destructive logic fragile.

Impact:
high because it creates inconsistent behavior and weakens trust in knowledge-store lifecycle management.

Priority:
immediate.

### Finding P2 - Automatic chat table reset on startup

Reference:
[backend/app/main.py](/Users/davide/Documents/repos/llmind2/backend/app/main.py:103)

Issue:
when schema mismatch is detected, the backend may execute `DROP TABLE` on chat tables. This is pragmatic in development, but risky for a research environment where persistent dialog history may carry experimental value.

Impact:
medium-high.

Priority:
high, before using the system as a stable archive of conversational experiments.

### Finding P2 - Benchmark retry passes a request-scoped DB session into a background task

Reference:
[backend/app/routers/benchmark.py](/Users/davide/Documents/repos/llmind2/backend/app/routers/benchmark.py:247)

Issue:
the retry path uses `background_tasks.add_task(...)` with `db=db`, meaning it passes the request-scoped session into asynchronous background execution. This may work in simple cases but is architecturally fragile.

Impact:
medium-high.

Priority:
high.

### Finding P2 - Benchmark history has an N+1 query pattern

Reference:
[backend/app/routers/benchmark.py](/Users/davide/Documents/repos/llmind2/backend/app/routers/benchmark.py:297)

Issue:
for each run, the code executes another query to fetch the related case. History views can degrade noticeably as the dataset grows.

Impact:
medium.

Priority:
medium-high.

### Main technical debt

- schema migrations are not yet fully formalized
- authentication and roles are absent
- prompt versioning is not explicit
- observability remains limited to logs and health endpoints
- the benchmark model is promising but not yet supported by an experiment registry

### Recommended priorities to make the project PhD-ready

1. fix the P1 issues and secure destructive operations
2. introduce more robust benchmark job control
3. formalize versioning for prompts, datasets, and experiment campaigns
4. add audit, authentication, and minimum hardening
5. improve exportability and downstream result analysis

