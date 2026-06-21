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
  RESPONSE=$(curl -s -u admin:admin "http://localhost:9000/api/measures/component?component=llmind2&metricKeys=coverage,lines_to_cover,uncovered_lines" || echo "")
  
  if [ -z "$RESPONSE" ] || echo "$RESPONSE" | grep -q "errors"; then
    echo -e "${YELLOW}⚠️  Impossibile contattare SonarQube o progetto 'llmind2' non ancora analizzato.${NC}"
    echo -e "   Assicurati che SonarQube sia attivo su http://localhost:9000 e che sia stata eseguita almeno un'analisi."
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
