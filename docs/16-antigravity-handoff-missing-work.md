# LLMind2 - Handoff operativo per Antigravity

Ultimo aggiornamento: 2026-07-24

Questo documento raccoglie le modifiche ancora da completare dopo l'ultimo ciclo di lavoro su homepage, Docker, SonarQube e riorganizzazione della piattaforma. Lo scopo e permettere a un altro agente, in particolare Antigravity, di continuare senza perdere contesto.

## Aggiornamento operativo 2026-07-24

Sono state completate le seguenti attivita principali (UI alignment, Backend RAG/Services & Test Isolation):

- **UI & Alignment Appunti**:
  - Allineata la grafica frontend ai componenti standard DaisyUI.
  - Sostituite le icone grafiche di Inclusioni, Esclusioni, Criteri e Diagnosi Differenziale con **Badge/Label DaisyUI** esplicite nella vista tabellare ICD-11.
  - Evidenziati e risaltati visivamente i selettori di **Modalità (ICD-11 Mode vs Differential Mode)** nella Chat Clinica.
  - Verificata la navigazione diretta dei casi clinici DSM-5 su pagina dedicata (senza modali sovrapposte) e barra di ricerca posizionata sopra la tabella.
  - Chatbot fluttuante posizionato persistentemente in basso a destra su tutte le pagine (`layout.tsx`).

- **Backend & Architettura**:
  - Introdotto l'import **lazy-loading** per le dipendenze RAG/LangChain (`langchain_chroma`, `OllamaEmbeddings`, `PyPDF2`) in `ingestion.py`, `legacy_rag.py`, `datastore.py`, `dsm5.py`.
  - Aggiornata la classe `Settings` in `backend/app/config.py` per gestire `extra="ignore"` e prevenire fallimenti su variabili d'ambiente aggiuntive nel file `.env`.
  - Aggiunto fallback dinamico della directory dati `DATA_DIR` per l'esecuzione in ambiente di sviluppo locale fuori dai container Docker.

- **Verifiche & Test Eseguiti**:
  - `npm test -- --watchAll=false` (Frontend): **4/4 test suite passate, 12/12 test superati**.
  - `npm run build` (Next.js): **Build di produzione completata con successo (0 errori)**.
  - `python3 -m pytest backend/tests/unit/test_auth.py backend/tests/unit/test_datastore_scope.py`: **14/14 test passati (100% success rate)**.
  - `python3 -m py_compile` su tutti i router e i servizi backend: **Verifica sintassi superata**.

## Aggiornamento operativo 2026-07-02

Sono state completate le seguenti attivita del backlog:

- homepage mantenuta in forma di landing page a bande, con macrofunzionalita piu leggibili e meno testo rispetto alla versione documentale
- navbar rifattorizzata in componenti piu piccoli e riorganizzata in gruppi coerenti:
  - Home
  - Patients
  - Clinical Knowledge
  - Clinical Chat
  - Benchmark Lab
  - Experimental
  - Legacy
- sezione Clinical Knowledge consolidata: ICD-11, DSM-5, Knowledge Bases e Legacy Explorer sono nello stesso gruppo logico
- provider di login navbar allineato a Keycloak
- fallback hardcoded del secret NextAuth rimosso: ora il secret arriva da `NEXTAUTH_SECRET` o `SECRET_KEY`
- pagina Knowledge Bases ripulita da stati non usati e wording tecnico ridotto
- pagina AIFA Drug Knowledge riposizionata come knowledge source sperimentale, non funzione clinica primaria
- `backend/app/services/auth.py` rifattorizzato in helper piu piccoli, mantenendo il comportamento di sicurezza
- `backend/app/main.py` rifattorizzato in step di sincronizzazione schema separati
- test frontend aggiornati alla nuova terminologia
- test backend mirati aggiunti/aggiornati per autenticazione e datastore

Verifiche eseguite:

```text
python3 -m py_compile backend/app/main.py backend/app/services/auth.py backend/app/routers/datastore.py backend/app/services/ingestion.py backend/app/routers/benchmark.py
npm test -- --watchAll=false
npm run build
docker compose exec -T backend pytest tests/unit/test_auth.py tests/unit/test_datastore_scope.py tests/integration/test_datastore.py
```

Risultati:

```text
Frontend tests: 12 passed
Frontend build: passed
Backend targeted tests: 12 passed
Python syntax check: passed
```

Residui da non considerare chiusi:

- security hotspots SonarQube: richiedono revisione/classificazione nel dashboard SonarQube
- riduzione completa dei 376 code smell: e stata ridotta la complessita in file mirati, ma resta un backlog piu ampio
- paper v2: da aggiornare se cambiano numeriche, metriche o dataset
- eventuale verifica visuale manuale della homepage su schermi reali

## Stato attuale

La branch di lavoro corrente e:

```text
feature/research-platform-restructure
```

Sono gia state implementate le seguenti attivita:

- riorganizzazione concettuale della piattaforma intorno a pazienti, casi clinici DSM-5, benchmark e grounding ICD-11
- rinomina progressiva di `Case Registry` in `DSM-5 Clinical Cases`
- homepage semplificata in stile landing page, divisa in bande macro-funzionali
- navbar riallineata e semplificata
- integrazione SonarQube con workflow GitHub Actions
- hook locale `pre-push` per eseguire SonarQube prima del push
- correzione bug e vulnerabilita Sonar principali
- build Docker aggiornata e verificata su `http://localhost:3000`

Risultato SonarQube ultimo:

```text
Quality Gate: OK
Bugs: 0
Vulnerabilities: 0
Code smells: 376
Security hotspots: 10
Coverage: 32.3%
Duplicated lines density: 0.9%
```

Dashboard SonarQube:

```text
http://o4sn9bs961jvxn32hs18a81p.89.168.29.98.sslip.io:9000/dashboard?id=llmind2
```

## Regole importanti

- Non modificare silenziosamente prompt, benchmark, metriche o semantica sperimentale.
- Ogni modifica che cambia la comparabilita sperimentale deve essere documentata.
- Non committare credenziali o token.
- SonarQube deve continuare a usare `SONAR_TOKEN` da variabile d'ambiente o da GitHub Secret.
- Il backend locale espone l'API su porta `10000`, non `8000`.
- Il frontend locale espone la UI su porta `3000`.
- La piattaforma non deve essere presentata come un singolo modello LLM: LLMind2 e la piattaforma; Gemma, Llama, GPT ecc. sono variabili sperimentali.

## Modifiche ancora mancanti

### 1. Rifinitura homepage dopo feedback supervisor

File principale:

```text
frontend/app/page.tsx
```

La homepage e stata gia semplificata, ma va verificata visivamente e rifinita.

Obiettivo:

- deve sembrare un sito web chiaro, non un documento tecnico
- deve avere poche scritte
- deve guidare l'utente tra le macro-funzionalita
- deve essere leggibile anche da un supervisore che apre il progetto per la prima volta

Macro-bande attuali:

- Patients & Clinical Cases
- Benchmark Lab
- Clinical Knowledge
- Model Interaction

Da fare:

- verificare spaziature desktop e mobile
- rendere la parte visuale centrale piu elegante, eventualmente con un piccolo diagramma o illustrazione SVG interna
- evitare testi lunghi nelle card
- mantenere CTA chiare e coerenti
- controllare che i colori siano coerenti con DaisyUI e con il tema clinico

Criteri di accettazione:

- la home si capisce in meno di 10 secondi
- nessuna sezione sembra un paragrafo di paper
- ogni banda porta a una sezione operativa
- build Next.js passa

### 2. Revisione UX della navbar

File principale:

```text
frontend/components/ui/Navbar.tsx
```

Stato:

- navbar gia riallineata
- rimossa la doppia freccia dropdown
- la struttura e piu coerente con la separazione concettuale della piattaforma

Da fare:

- verificare visivamente larghezza e overflow su desktop
- verificare menu mobile
- controllare che i gruppi siano chiari
- ridurre complessita/nesting se possibile, per abbassare Sonar code smell

Possibile struttura desiderata:

- Home
- Patients
- Clinical Knowledge
- Clinical Chat
- Benchmark Lab
- Experimental
- Legacy

Criteri di accettazione:

- nessun wrapping brutto su desktop
- menu mobile usabile
- nessuna doppia icona dropdown
- link coerenti con le pagine esistenti

### 3. Code smell SonarQube da ridurre

Sonar non riporta piu bug o vulnerabilita, ma restano molti code smell.

Priorita:

1. complessita cognitiva nei router backend piu importanti
2. nesting eccessivo nelle pagine frontend grandi
3. duplicazioni o funzioni troppo lunghe

File segnalati come piu critici:

```text
backend/app/main.py
backend/app/routers/chat.py
backend/app/routers/datastore.py
backend/app/services/auth.py
frontend/app/benchmark/cases/page.tsx
frontend/app/gcp-agents/page.tsx
frontend/components/ui/Navbar.tsx
mobile/app/(tabs)/chat.tsx
mobile/lib/api.ts
```

Da fare:

- estrarre funzioni helper pure
- spezzare componenti React troppo grandi
- evitare refactor funzionali aggressivi se non coperti da test
- non cambiare output API senza aggiornare frontend e documentazione

Criteri di accettazione:

- Sonar resta con `0 bugs` e `0 vulnerabilities`
- Quality Gate resta `OK`
- riduzione misurabile dei code smell
- nessuna regressione visibile nella UI

### 4. Security hotspots SonarQube

Sono presenti 10 security hotspot da revisionare.

Da fare:

- aprire gli hotspot in SonarQube
- classificare ciascun hotspot come:
  - `Safe`
  - `Fixed`
  - `Accepted risk`
- documentare brevemente il razionale se viene accettato il rischio

Criteri di accettazione:

- nessun hotspot lasciato senza revisione consapevole
- nessun workaround che riduce la sicurezza reale
- nessuna credenziale hardcoded

### 5. Coverage e test

Coverage attuale:

```text
32.3%
```

Da fare:

- aggiungere test mirati sulle parti di benchmark
- aggiungere test sui servizi di autenticazione
- aggiungere test su datastore/ingestion ICD-11 scoped
- aggiungere test frontend sui componenti critici, se l'infrastruttura esistente lo consente

Priorita test:

```text
backend/app/services/auth.py
backend/app/routers/benchmark.py
backend/app/routers/datastore.py
backend/app/services/ingestion.py
frontend/components/ui/Navbar.tsx
frontend/app/page.tsx
```

Criteri di accettazione:

- coverage in crescita
- test stabili in CI
- workflow SonarQube continua a leggere coverage backend e frontend

### 6. DSM-5 Clinical Cases e Patients

Contesto:

- la sezione `Patients` deve essere evidenziata
- i pazienti devono essere legati all'account utente
- deve essere possibile importare casi dal dataset DSM-5 Clinical Cases
- `Case Registry` va sostituito ovunque con `DSM-5 Clinical Cases` oppure `Clinical Cases`

Da verificare:

- tutte le diciture UI
- breadcrumb e titoli pagina
- CTA da `DSM-5 Clinical Cases` verso `Patients`
- separazione concettuale tra paziente reale/operativo e caso benchmark

Possibili file:

```text
frontend/app/patients/page.tsx
frontend/app/benchmark/cases/page.tsx
frontend/app/benchmark/cases/[id]/page.tsx
frontend/lib/i18n/en.json
backend/app/routers/patient.py
backend/app/routers/dsm5.py
```

Criteri di accettazione:

- non compare piu `Case Registry` se non in documenti storici
- import DSM-5 -> Patients chiaro e tracciabile
- la pagina Patients e una sezione primaria della piattaforma

### 7. Benchmark come sezione autonoma

Il benchmark deve restare una parte scientifica separata, non una sottofunzione della chat.

Da fare:

- rendere piu chiaro che il benchmark usa dataset DSM-5 Clinical Cases
- distinguere sempre:
  - piattaforma LLMind2
  - runtime/provider
  - modello LLM
  - dataset
  - metrica
  - run
- verificare export CSV e metriche
- non cambiare prompt/metriche senza documentarlo

Possibili file:

```text
frontend/app/benchmark/page.tsx
frontend/app/benchmark/cases/page.tsx
frontend/app/benchmark/cases/[id]/page.tsx
backend/app/routers/benchmark.py
backend/app/models/benchmark.py
```

Criteri di accettazione:

- benchmark comprensibile senza aprire la chat
- modelli confrontabili chiaramente
- export risultati funzionante
- metriche coerenti con il paper

### 8. Onboarding e diciture

Feedback supervisor:

- rifare completamente onboarding
- correggere diciture e campi non controllati
- discutere con David prima del push per dati esistenti

Da fare:

- individuare flussi onboarding esistenti
- proporre nuovo onboarding breve:
  - cosa e LLMind2
  - scegli cosa vuoi fare
  - pazienti
  - clinical cases
  - benchmark
  - knowledge
- evitare migrazioni distruttive su dati esistenti senza approvazione

Criteri di accettazione:

- onboarding breve
- testi semplici
- nessuna modifica distruttiva a dati utente

### 9. GCP Agents e AIFA Drugs

Contesto:

- GCP conversational agents sono extra sperimentale
- non devono essere centrali nella presentazione iniziale
- AIFA medicines riguarda agenti specializzati in prescrizione medica sperimentale

Da fare:

- tenere GCP Agents in sezione `Experimental` o nella chat come estensione
- non metterli come card primaria della homepage
- verificare che AIFA Drugs sia descritto come knowledge base specialistica, non come funzione clinica certificata

File possibili:

```text
frontend/app/gcp-agents/page.tsx
frontend/app/drugs/page.tsx
frontend/components/ui/Navbar.tsx
```

Criteri di accettazione:

- agenti visibili ma secondari
- nessuna promessa clinica impropria
- wording sperimentale chiaro

### 10. ICD-11 API e Datastore

Contesto:

- la pipeline non deve usare file Excel legacy
- ICD-11 viene estratto via API/script dedicato
- datastore deve permettere scelta tra tutto il capitolo 6 o sezioni selezionate

Da verificare:

- UI datastore
- backend datastore
- sorgenti PDF/backend
- generazione fonte scoped ICD-11
- coerenza con BigQuery/GCP se presente

File possibili:

```text
frontend/app/datastores/page.tsx
backend/app/routers/datastore.py
backend/app/services/ingestion.py
backend/app/services/icd11_api.py
backend/scripts/
gcp/
terraform/
```

Criteri di accettazione:

- scelta Capitolo 6 completo vs sezioni selezionate funzionante
- nessun riferimento operativo a Excel legacy
- caricamento sorgenti datastore funzionante

### 11. Paper versione 2

Contesto:

- in `paper/` esiste `llmind1.pdf`
- sono stati creati materiali LaTeX per paper v2 in italiano e inglese
- GCP deve essere solo cenno secondario, perche non riproducibile gratuitamente/open source
- la riproducibilita deve essere spiegata come nel primo paper
- grafici, architettura e numeriche devono essere rigenerabili

Da fare:

- verificare che il paper non sia troppo software-oriented
- arricchire sezioni scientifiche
- aggiornare numeriche con script dedicato
- assicurarsi che le metriche citate siano implementate nel sistema
- aggiornare figure se cambia UI/architettura

Possibili file:

```text
paper/
scripts/
docs/
```

Criteri di accettazione:

- paper scientifico, non manuale software
- riproducibilita chiara
- GCP trattato come extra
- numeriche rigenerabili

## Comandi utili

Avvio locale:

```bash
docker compose up -d
```

Ricostruzione frontend:

```bash
docker compose up -d --build frontend
```

Build frontend fuori Docker:

```bash
cd frontend
npm run build
```

Scansione SonarQube locale/manuale:

```bash
export SONAR_TOKEN=...
RUN_TESTS=false sonar/run-analysis.sh
```

Bypass temporaneo del pre-push Sonar, solo se necessario:

```bash
SKIP_SONAR_PRE_PUSH=true git push
```

## GitHub Secrets richiesti

Impostare nel repository GitHub:

```text
SONAR_TOKEN
SONAR_HOST_URL
```

`SONAR_HOST_URL` puo puntare a:

```text
http://o4sn9bs961jvxn32hs18a81p.89.168.29.98.sslip.io:9000
```

## Attenzione a dati e credenziali

Non committare:

- token SonarQube
- password SonarQube
- credenziali GCP
- file `.env` reali
- PDF proprietari se non gia previsti dal progetto
- dump di database con dati sensibili

## Priorita consigliata per Antigravity

1. Verificare visivamente la nuova homepage e rifinirla.
2. Sistemare navbar responsive e ridurre complessita del componente.
3. Revisionare security hotspots SonarQube.
4. Ridurre i code smell piu critici senza cambiare semantica benchmark.
5. Aumentare test coverage sulle parti scientificamente sensibili.
6. Consolidare Patients e DSM-5 Clinical Cases.
7. Aggiornare paper/numeriche se cambiano metriche o dataset.

## Definition of done

Prima di consegnare:

- `npm run build` passa
- backend non ha errori di sintassi
- Docker parte con frontend su `3000` e backend su `10000`
- SonarQube resta con:
  - `Quality Gate: OK`
  - `Bugs: 0`
  - `Vulnerabilities: 0`
- nessun segreto e stato aggiunto al repository
- eventuali modifiche a benchmark, prompt o metriche sono documentate
