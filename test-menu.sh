#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-menu.sh
#
# Script interattivo per la suite di test e analisi statica con SonarQube.
# ─────────────────────────────────────────────────────────────────────────────

# Colori per output raffinato
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Determina la directory dello script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Stampa il banner del menu
print_banner() {
  clear
  echo -e "${PURPLE}${BOLD}"
  echo "  ████████╗███████╗███████╗████████╗    ███╗   ███╗███████╗███╗   ██╗██╗   ██╗"
  echo "  ╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝    ████╗ ████║██╔════╝████╗  ██║██║   ██║"
  echo "     ██║   █████╗  ███████╗   ██║       ██╔████╔██║█████╗  ██╔██╗ ██║██║   ██║"
  echo "     ██║   ██╔══╝  ╚════██║   ██║       ██║╚██╔╝██║██╔══╝  ██║╚██╗██║██║   ██║"
  echo "     ██║   ███████╗███████║   ██║       ██║ ╚═╝ ██║███████╗██║ ╚████║╚██████╔╝"
  echo "     ╚═╝   ╚══════╝╚══════╝   ╚═╝       ╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ "
  echo -e "                 Suite di Test & Analisi SonarQube - LLMind2${NC}"
  echo -e "  ─────────────────────────────────────────────────────────────────────────"
  echo ""
}

# Verifica lo stato di Docker
check_docker() {
  if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ ERRORE: Docker non è in esecuzione.${NC}"
    echo -e "   Avvia Docker Desktop e riprova."
    echo ""
    return 1
  fi
  return 0
}

# Mostra lo stato dei container correlati
show_status() {
  echo -e "${BOLD}Stato Servizi:${NC}"
  
  # Backend
  if docker ps --format '{{.Names}}' | grep -q "llmind_backend"; then
    echo -e "  - Backend Container:   ${GREEN}● Attivo (llmind_backend)${NC}"
  else
    echo -e "  - Backend Container:   ${RED}○ Spento (llmind_backend)${NC}"
  fi
  
  # SonarQube
  if docker ps --format '{{.Names}}' | grep -q "llmind_sonar"; then
    echo -e "  - SonarQube Server:    ${GREEN}● Attivo (llmind_sonar)${NC}"
  else
    echo -e "  - SonarQube Server:    ${RED}○ Spento (llmind_sonar)${NC}"
  fi
  
  # SonarQube DB
  if docker ps --format '{{.Names}}' | grep -q "llmind_sonar_db"; then
    echo -e "  - SonarQube DB:        ${GREEN}● Attivo (llmind_sonar_db)${NC}"
  else
    echo -e "  - SonarQube DB:        ${RED}○ Spento (llmind_sonar_db)${NC}"
  fi
  echo -e "  ─────────────────────────────────────────────────────────────────────────"
  echo ""
}

# Funzione per premere un tasto prima di tornare al menu
press_any_key() {
  echo ""
  read -n 1 -s -r -p "Premi un tasto per tornare al menu principale..."
}

# 1. Esegui test unitari del backend
run_backend_unit() {
  check_docker || { press_any_key; return; }
  echo -e "${BLUE}🧪 Esecuzione dei test unitari del backend (pytest)...${NC}"
  docker compose exec backend pytest tests/unit
  press_any_key
}

# 2. Esegui test di integrazione del backend
run_backend_integration() {
  check_docker || { press_any_key; return; }
  echo -e "${BLUE}🧪 Esecuzione dei test di integrazione del backend (pytest)...${NC}"
  docker compose exec backend pytest tests/integration
  press_any_key
}

# 3. Esegui tutti i test del backend con copertura
run_backend_all_cov() {
  check_docker || { press_any_key; return; }
  echo -e "${BLUE}📊 Esecuzione di tutti i test backend con copertura...${NC}"
  docker compose exec backend pytest --cov=app --cov-report=xml --cov-report=term-missing
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Copertura generata con successo in backend/coverage.xml nel container.${NC}"
    # Copia il report sull'host
    docker cp llmind_backend:/app/coverage.xml backend/coverage.xml 2>/dev/null
    echo -e "${GREEN}✅ Copertura copiata sull'host in backend/coverage.xml.${NC}"
  else
    echo -e "${RED}❌ Errore durante l'esecuzione dei test backend.${NC}"
  fi
  press_any_key
}

# 4. Esegui test frontend (Jest)
run_frontend_tests() {
  echo -e "${BLUE}🧪 Esecuzione dei test frontend (Jest)...${NC}"
  cd frontend
  npm run test
  cd ..
  press_any_key
}

# 5. Esegui test frontend con copertura
run_frontend_cov() {
  echo -e "${BLUE}📊 Esecuzione dei test frontend con copertura (Jest)...${NC}"
  cd frontend
  npm run test:coverage
  cd ..
  press_any_key
}

# 6. Avvia SonarQube locale in Docker
start_sonarqube() {
  check_docker || { press_any_key; return; }
  echo -e "${BLUE}🚀 Avvio di SonarQube e PostgreSQL in corso...${NC}"
  docker compose -f sonar/docker-compose.sonar.yml up -d
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Servizi SonarQube avviati.${NC}"
    echo -e "${YELLOW}ℹ️  SonarQube potrebbe richiedere fino a 60 secondi per avviarsi completamente.${NC}"
    echo -e "   Monitora l'avvio su: ${CYAN}http://localhost:9000${NC}"
  else
    echo -e "${RED}❌ Errore durante l'avvio dei servizi SonarQube.${NC}"
  fi
  press_any_key
}

# 7. Esegui analisi completa SonarQube
run_sonarqube_analysis() {
  check_docker || { press_any_key; return; }
  if [ ! -f "sonar/run-analysis.sh" ]; then
    echo -e "${RED}❌ ERRORE: Script sonar/run-analysis.sh non trovato.${NC}"
    press_any_key
    return
  fi
  
  echo -e "${BLUE}🔍 Avvio dello script di analisi SonarQube...${NC}"
  chmod +x sonar/run-analysis.sh
  ./sonar/run-analysis.sh
  press_any_key
}

# 8. Mostra metriche di copertura registrate in SonarQube
show_sonarqube_metrics() {
  echo -e "${BLUE}📊 Richiesta delle metriche di copertura a SonarQube...${NC}"
  SONAR_HOST_URL="${SONAR_HOST_URL:-http://o4sn9bs961jvxn32hs18a81p.89.168.29.98.sslip.io:9000}"
  if [ -z "${SONAR_TOKEN:-}" ]; then
    echo -e "${YELLOW}⚠️  SONAR_TOKEN non configurato. Esporta un token SonarQube prima di leggere le metriche.${NC}"
    press_any_key
    return
  fi
  RESPONSE=$(curl -s -u "$SONAR_TOKEN:" "$SONAR_HOST_URL/api/measures/component?component=llmind2&metricKeys=coverage,lines_to_cover,uncovered_lines" || echo "")
  
  if [ -z "$RESPONSE" ] || echo "$RESPONSE" | grep -q "errors"; then
    echo -e "${YELLOW}⚠️  Impossibile contattare SonarQube o progetto 'llmind2' non ancora analizzato.${NC}"
    echo -e "   Assicurati che SonarQube sia attivo su $SONAR_HOST_URL e che sia stata eseguita almeno un'analisi."
  else
    # Parsing sicuro via Python
    read -r COVERAGE LINES UNCOVERED <<< $(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    measures = {m['metric']: m['value'] for m in data.get('component', {}).get('measures', [])}
    print(f\"{measures.get('coverage', 'N/D')} {measures.get('lines_to_cover', 'N/D')} {measures.get('uncovered_lines', 'N/D')}\")
except Exception:
    print('N/D N/D N/D')
" 2>/dev/null)

    echo -e "\n${BOLD}📈 Risultati dell'Analisi SonarQube:${NC}"
    echo -e "   - Copertura Totale:   ${GREEN}${COVERAGE}%${NC}"
    echo -e "   - Righe da Coprire:   ${CYAN}${LINES}${NC}"
    echo -e "   - Righe non Coperte:  ${RED}${UNCOVERED}${NC}"
    echo -e "\n   Accedi alla dashboard completa: ${CYAN}http://localhost:9000/dashboard?id=llmind2${NC}"
  fi
  press_any_key
}

# 9. Ferma l'infrastruttura SonarQube
stop_sonarqube() {
  check_docker || { press_any_key; return; }
  echo -e "${BLUE}🛑 Spegnimento dei container SonarQube in corso...${NC}"
  docker compose -f sonar/docker-compose.sonar.yml down
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Container SonarQube spenti con successo.${NC}"
  else
    echo -e "${RED}❌ Errore durante lo spegnimento dei container SonarQube.${NC}"
  fi
  press_any_key
}

# 10. Riproduci / Testa Singoli Comportamenti (Menu Funzionale)
run_functional_menu() {
  while true; do
    clear
    echo -e "${PURPLE}${BOLD}  ████████╗███████╗███████╗████████╗    ███╗   ███╗███████╗███╗   ██╗██╗   ██╗"
    echo "  ╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝    ████╗ ████║██╔════╝████╗  ██║██║   ██║"
    echo "     ██║   █████╗  ███████╗   ██║       ██╔████╔██║█████╗  ██╔██╗ ██║██║   ██║"
    echo "     ██║   ██╔══╝  ╚════██║   ██║       ██║╚██╔╝██║██╔══╝  ██║╚██╗██║██║   ██║"
    echo "     ██║   ███████╗███████║   ██║       ██║ ╚═╝ ██║███████╗██║ ╚████║╚██████╔╝"
    echo -e "     ╚═╝   ╚══════╝╚══════╝   ╚═╝       ╚═╝     ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ ${NC}"
    echo -e "${PURPLE}${BOLD}                  Riproduzione di Singoli Comportamenti Clinici${NC}"
    echo -e "  ─────────────────────────────────────────────────────────────────────────"
    echo -e "${BOLD}  A. TEST UNITARI MIRATI (Mocked)${NC}"
    echo -e "    ${CYAN}[1]${NC} Caricamento Configurazione & Settings del Server"
    echo -e "    ${CYAN}[2]${NC} Recupero Chiavi JWKS Crittografiche (OIDC Cache)"
    echo -e "    ${CYAN}[3]${NC} Validazione Token JWT (Firma, Issuer, Scadenza)"
    echo -e "    ${CYAN}[4]${NC} Listato Modelli Disponibili su Server Ollama"
    echo -e "    ${CYAN}[5]${NC} Generazione Testo ed Inferenza LLM Sincrona/Streaming"
    echo ""
    echo -e "${BOLD}  B. TEST DI INTEGRAZIONE FLUSSI (Sandbox)${NC}"
    echo -e "    ${CYAN}[6]${NC} Endpoint Health Check & Parametri Ambientali"
    echo -e "    ${CYAN}[7]${NC} Gestione Sessioni Chat Cliniche (Creazione/Lettura)"
    echo -e "    ${CYAN}[8]${NC} Canale di Comunicazione SSE (Streaming Chat)"
    echo -e "    ${CYAN}[9]${NC} Caricamento e Registrazione Casi Clinici in DB"
    echo -e "    ${CYAN}[10]${NC} Ricerca Avanzata per Sintomi ICD-11 (CDDR)"
    echo -e "    ${CYAN}[11]${NC} Esecuzione e Calcolo Risultati dei Benchmark"
    echo ""
    echo -e "${BOLD}  C. TEST INTERATTIVI CON INPUT PERSONALIZZATI (Live)${NC}"
    echo -e "    ${CYAN}[12]${NC} Esegui Inferenza Custom (Prompt & Modello)"
    echo -e "    ${CYAN}[13]${NC} Calcola Embedding Custom (Calcolo Vettori)"
    echo -e "    ${CYAN}[14]${NC} Cerca Sintomo nel DB ICD-11"
    echo -e "  ─────────────────────────────────────────────────────────────────────────"
    echo -e "    ${RED}[0]${NC} Torna al Menu Principale"
    echo ""
    
    read -p "Opzione Funzionale > " f_choice
    case $f_choice in
      1)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Caricamento Configurazione & Settings${NC}"
        echo -e "  Questo test verifica che la classe Settings (Pydantic) carichi correttamente"
        echo -e "  tutte le variabili d'ambiente (.env) configurate sul server backend,"
        echo -e "  comprese le impostazioni OIDC, indirizzi di Ollama ed ICD-11."
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/unit/test_config.py"
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/unit/test_config.py
        press_any_key
        ;;
      2)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Recupero Chiavi JWKS Crittografiche${NC}"
        echo -e "  Questo test verifica la logica che interroga il server OIDC (Authentik/Keycloak)"
        echo -e "  per ottenere le chiavi crittografiche pubbliche (JWKS). Verifica inoltre"
        echo -e "  l'efficacia del caching locale per evitare chiamate ripetute ad ogni richiesta."
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/unit/test_auth.py -k \"test_get_jwks\""
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/unit/test_auth.py -k "test_get_jwks"
        press_any_key
        ;;
      3)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Validazione Token JWT${NC}"
        echo -e "  Verifica la validazione formale di un JSON Web Token (JWT). Copre i casi di:"
        echo -e "  - Token valido (autenticazione accettata)"
        echo -e "  - Mismatch nell'Issuer (iss non corrispondente alle attese)"
        echo -e "  - Firma scaduta (ExpiredSignatureError)"
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/unit/test_auth.py -k \"test_verify_token\""
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/unit/test_auth.py -k "test_verify_token"
        press_any_key
        ;;
      4)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Listato Modelli su Ollama${NC}"
        echo -e "  Verifica la connettività di base del servizio OllamaService interrogando l'endpoint"
        echo -e "  '/api/tags' per ottenere i modelli linguistici installati. Verifica anche il fallback"
        echo -e "  in caso di assenza temporanea o errore di connessione."
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/unit/test_ollama.py -k \"test_list_models\""
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/unit/test_ollama.py -k "test_list_models"
        press_any_key
        ;;
      5)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Generazione ed Inferenza LLM Sincrona/Streaming${NC}"
        echo -e "  Questo test verifica l'invio del prompt a Ollama e la cattura della risposta"
        echo -e "  sia in modalità sincrona ad alta latenza sia tramite SSE (Server-Sent Events) in streaming,"
        echo -e "  decodificando i chunk json prodotti dal modello."
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/unit/test_ollama.py -k \"test_run_inference or test_chat_stream\""
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/unit/test_ollama.py -k "test_run_inference or test_chat_stream"
        press_any_key
        ;;
      6)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Endpoint Health Check & Parametri${NC}"
        echo -e "  Interroga direttamente l'endpoint di stato '/health' del server FastAPI,"
        echo -e "  verificando la conformità del JSON ritornato (status, version, ollama_url)."
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/integration/test_health.py"
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/integration/test_health.py
        press_any_key
        ;;
      7)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Gestione Sessioni Chat Cliniche${NC}"
        echo -e "  Questo test di integrazione verifica che le API del backend creino correttamente nuove"
        echo -e "  sessioni di chat associate all'email dell'utente, ne consentano il recupero ed"
        echo -e "  evitino l'accesso non autorizzato ad utenti differenti (Data Isolation)."
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/integration/test_chat.py -k \"session\""
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/integration/test_chat.py -k "session"
        press_any_key
        ;;
      8)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Canale di Comunicazione SSE (Streaming Chat)${NC}"
        echo -e "  Questo test di integrazione simula una chiamata client Next-Auth verso l'endpoint"
        echo -e "  '/api/chat/{session_id}/stream' ed analizza i chunk dello stream in tempo reale,"
        echo -e "  assicurandosi che i protocolli Server-Sent Events siano conformi."
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/integration/test_chat.py -k \"test_stream_chat\""
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/integration/test_chat.py -k "test_stream_chat"
        press_any_key
        ;;
      9)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Caricamento e Registrazione Casi Clinici in DB${NC}"
        echo -e "  Verifica che l'aggiunta di nuovi casi clinici tramite le API di backend"
        echo -e "  funzioni correttamente inserendo i record nel database SQL locale e consentendone"
        echo -e "  la lettura paginata."
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/integration/test_cases.py -k \"clinical_case\""
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/integration/test_cases.py -k "clinical_case"
        press_any_key
        ;;
      10)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Ricerca Avanzata per Sintomi ICD-11${NC}"
        echo -e "  Testa le API del motore di ricerca offline ICD-11. In particolare verifica"
        echo -e "  il nuovo parametro 'search_type=symptoms' per assicurarsi che i termini vengano"
        echo -e "  cercati all'interno di descrizioni, criteri diagnostici, inclusioni ed esclusioni."
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/integration/test_cases.py -k \"symptoms\""
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/integration/test_cases.py -k "symptoms"
        press_any_key
        ;;
      11)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO: Suite Esecuzione Benchmark${NC}"
        echo -e "  Verifica l'intero workflow di benchmark scientifico dei casi clinici:"
        echo -e "  invio dei casi clinici al modello di inferenza selezionato, confronto con i codici"
        echo -e "  ICD-11 attesi, salvataggio dei log di benchmark e generazione delle metriche finali."
        echo ""
        echo -e "${YELLOW}Comando di test eseguito:${NC} pytest tests/integration/test_benchmark.py"
        echo "  ─────────────────────────────────────────────────────────────────────────"
        echo ""
        check_docker && docker compose exec backend pytest tests/integration/test_benchmark.py
        press_any_key
        ;;
      12)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO INTERATTIVO: Esegui Inferenza Custom${NC}"
        echo -e "  Consente di inviare una richiesta reale al server Ollama specificando il prompt"
        echo -e "  e il modello linguistico da utilizzare, visualizzandone i risultati in tempo reale."
        echo ""
        read -p "Inserisci il nome del modello (es. gemma-test, gemma2:27b) [predefinito: gemma-test]: " custom_model
        custom_model=${custom_model:-"gemma-test"}
        read -p "Inserisci il prompt per il modello: " custom_prompt
        if [ -z "$custom_prompt" ]; then
          echo -e "${RED}Prompt vuoto. Operazione annullata.${NC}"
          press_any_key
          continue
        fi
        echo ""
        echo -e "${YELLOW}Esecuzione in corso sul container backend...${NC}"
        echo "  ─────────────────────────────────────────────────────────────────────────"
        check_docker && docker compose exec backend python -c "
import asyncio
from app.services.ollama import ollama_service
async def test():
    r = await ollama_service.run_inference(prompt='''$custom_prompt''', model='$custom_model')
    print('RISULTATO:')
    print(r.get('content', 'Nessuna risposta generata.'))
    print(f'Latenza: {r.get(\"latency_ms\", 0)}ms')
asyncio.run(test())
"
        press_any_key
        ;;
      13)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO INTERATTIVO: Calcolo Embedding Custom${NC}"
        echo -e "  Interroga il modello linguistico per generare il vettore semantico (embedding)"
        echo -e "  di una query. Mostra i primi 5 float del vettore per verificare la compatibilità."
        echo -e "  Richiede il server Ollama con embeddings abilitati."
        echo ""
        read -p "Inserisci il nome del modello (es. gemma-test, gemma2:27b) [predefinito: gemma-test]: " emb_model
        emb_model=${emb_model:-"gemma-test"}
        read -p "Inserisci la frase da convertire in vettore: " emb_text
        if [ -z "$emb_text" ]; then
          echo -e "${RED}Testo vuoto. Operazione annullata.${NC}"
          press_any_key
          continue
        fi
        echo ""
        echo -e "${YELLOW}Chiamata OllamaEmbeddings in corso...${NC}"
        echo "  ─────────────────────────────────────────────────────────────────────────"
        check_docker && docker compose exec backend python -c "
from langchain_community.embeddings import OllamaEmbeddings
from app.config import get_settings
s = get_settings()
try:
    e = OllamaEmbeddings(model='$emb_model', base_url=s.ollama_base_url)
    vector = e.embed_query('$emb_text')
    print('VETTORE GENERATO CON SUCCESSO!')
    print(f'Dimensione totale vettore: {len(vector)}')
    print(f'Primi 5 elementi: {vector[:5]}')
except Exception as err:
    print('ERRORE RISCONTRATO:', str(err))
"
        press_any_key
        ;;
      14)
        clear
        echo -e "${BLUE}${BOLD}🔍 COMPORTAMENTO INTERATTIVO: Cerca Sintomo nel DB ICD-11${NC}"
        echo -e "  Effettua una ricerca all'interno della tabella locale 'icd11_categories'"
        echo -e "  del database PostgreSQL per trovare e listare le prime 5 categorie corrispondenti."
        echo ""
        read -p "Inserisci la parola o sintomo da cercare: " search_query
        if [ -z "$search_query" ]; then
          echo -e "${RED}Query vuota. Operazione annullata.${NC}"
          press_any_key
          continue
        fi
        echo ""
        echo -e "${YELLOW}Interrogazione database in corso...${NC}"
        echo "  ─────────────────────────────────────────────────────────────────────────"
        check_docker && docker compose exec backend python -c "
from app.database import SessionLocal
from app.models.icd11 import ICD11Category
db = SessionLocal()
try:
    q = '$search_query'
    cats = db.query(ICD11Category).filter(
        (ICD11Category.code.ilike(f'%{q}%')) |
        (ICD11Category.title_en.ilike(f'%{q}%')) |
        (ICD11Category.title_it.ilike(f'%{q}%')) |
        (ICD11Category.description.ilike(f'%{q}%'))
    ).limit(5).all()
    if not cats:
        print('Nessuna categoria trovata.')
    else:
        print(f'Trovate {len(cats)} categorie (limite visualizzazione: 5):')
        for c in cats:
            print(f' - [{c.code}] {c.title_en} (Livello {c.level})')
except Exception as err:
    print('ERRORE:', str(err))
"
        press_any_key
        ;;
      0)
        break
        ;;
      *)
        echo -e "${RED}⚠️ Opzione non valida. Riprova.${NC}"
        sleep 1
        ;;
    esac
  done
}

# Loop principale
while true; do
  print_banner
  show_status
  
  echo -e "${BOLD}Seleziona un'opzione:${NC}"
  echo -e "  ${CYAN}[1]${NC} Esegui Test Unitari Backend"
  echo -e "  ${CYAN}[2]${NC} Esegui Test Integrazione Backend"
  echo -e "  ${CYAN}[3]${NC} Esegui Tutti i Test Backend + Genera Copertura"
  echo -e "  ${CYAN}[4]${NC} Esegui Test Frontend"
  echo -e "  ${CYAN}[5]${NC} Esegui Test Frontend + Genera Copertura"
  echo -e "  ─────────────────────────────────────────────────────────────"
  echo -e "  ${CYAN}[6]${NC} Avvia Container SonarQube Locale (Docker)"
  echo -e "  ${CYAN}[7]${NC} Esegui Analisi Completa SonarQube (Backend + Frontend)"
  echo -e "  ${CYAN}[8]${NC} Mostra Metriche di Copertura di SonarQube"
  echo -e "  ${CYAN}[9]${NC} Ferma/Rimuovi Container SonarQube (Docker)"
  echo -e "  ${CYAN}[10]${NC} Riproduci / Testa Singoli Comportamenti (Menu Funzionale)"
  echo -e "  ─────────────────────────────────────────────────────────────"
  echo -e "  ${RED}[0]${NC} Esci"
  echo ""
  
  read -p "Opzione > " choice
  case $choice in
    1) run_backend_unit ;;
    2) run_backend_integration ;;
    3) run_backend_all_cov ;;
    4) run_frontend_tests ;;
    5) run_frontend_cov ;;
    6) start_sonarqube ;;
    7) run_sonarqube_analysis ;;
    8) show_sonarqube_metrics ;;
    9) stop_sonarqube ;;
    10) run_functional_menu ;;
    0) 
      echo -e "\n${GREEN}Arrivederci!${NC}\n"
      exit 0
      ;;
    *)
      echo -e "\n${RED}⚠️ Opzione non valida. Riprova.${NC}"
      sleep 1.5
      ;;
  esac
done
