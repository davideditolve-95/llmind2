# LLMind2 Visual Test Console

Il **LLMind2 Visual Test Console** è un portale client-side leggero e autonomo sviluppato fuori dal cluster Docker. Permette ai ricercatori di connettersi direttamente all'API del backend, fornendo un'interfaccia visuale ricca e moderna per testare, diagnosticare e riprodurre i comportamenti della piattaforma.

## Caratteristiche Principali

1. **Diagnostica di Health**: Controlla lo stato di salute del backend FastAPI, verifica i modelli caricati e la latenza delle chiamate HTTP.
2. **Inference Playground**: Permette di inviare prompt clinici direttamente a Ollama impostando il modello (es. `gemma-test` o `gemma2:27b`) e visualizzando i risultati e le latenze.
3. **Embeddings (RAG)**: Testa il servizio di embedding e la connettività del vectorstore Chroma, visualizzando dimensioni e campioni di coordinate del vettore.
4. **ICD-11 Explorer**: Esegue ricerche offline sui codici clinici WHO memorizzati in PostgreSQL, supportando la ricerca avanzata per sintomi, criteri diagnostici, inclusioni ed esclusioni (proprio come la tabella tabulare Next.js).

## Requisiti

- I container di **LLMind2** devono essere in esecuzione (`docker compose up -d`).
- Un browser web moderno (Chrome, Safari, Firefox).

## Come Avviarlo

Poiché il portale risiede interamente in un file statico `index.html` ed effettua chiamate API esterne (`localhost:8000`), per evitare problemi di restrizione origin o CORS dei file locali, è consigliato servirlo tramite un semplice server HTTP locale:

### Opzione 1: Utilizzando Python (Consigliato)
Esegui questo comando dal terminale nella directory principale del progetto:
```bash
python3 -m http.server 8080 --directory test-portal
```
Quindi apri nel browser il link:
**[http://localhost:8080](http://localhost:8080)**

### Opzione 2: Utilizzando Node.js / npx
```bash
npx serve test-portal
```
Quindi apri il link visualizzato nel terminale (solitamente `http://localhost:3000` o `http://localhost:5000`).

---

## Autenticazione OIDC (Authentik / Keycloak)
Per testare gli endpoint protetti da token (come l'Inference LLM o l'elenco dei modelli RAG):
1. Esegui il login nel frontend Next.js (`http://localhost:3000`).
2. Copia il JWT token di sessione (ad esempio ispezionando il network traffic o i cookie del browser).
3. Incolla il token nella casella **"Authorization Token (Authentik JWT)"** nella barra laterale del portale di test per abilitare automaticamente l'header `Authorization: Bearer <token>` in tutte le richieste.
