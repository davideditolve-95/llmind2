#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh
#
# Script interattivo per avviare, gestire ed eseguire l'ETL del progetto
# ICD-11 Explorer & Clinical AI (llmind2).
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

# Funzione per stampare il banner
print_banner() {
  clear
  echo -e "${CYAN}${BOLD}"
  echo "  ██╗     ██╗     ███╗   ███╗██╗███╗   ██╗██████╗ ██████╗ "
  echo "  ██║     ██║     ████╗ ████║██║████╗  ██║██╔══██╗╚════██╗"
  echo "  ██║     ██║     ██╔████╔██║██║██╔██╗ ██║██║  ██║ █████╔╝"
  echo "  ██║     ██║     ██║╚██╔╝██║██║██║╚██╗██║██║  ██║██╔═══╝ "
  echo "  ███████╗███████╗██║ ╚═╝ ██║██║██║ ╚████║██████╔╝███████╗"
  echo "  ╚══════╝╚══════╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝ ╚══════╝"
  echo -e "       ICD-11 Explorer & Clinical AI — Gestore Progetto${NC}"
  echo -e "  ─────────────────────────────────────────────────────────────"
  echo ""
}

# Verifica che Docker sia attivo
check_docker() {
  if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ ERRORE: Docker non è in esecuzione.${NC}"
    echo -e "   Avvia Docker Desktop e riprova."
    echo ""
    read -n 1 -s -r -p "Premi un tasto per continuare..."
    return 1
  fi
  return 0
}

# Verifica e copia del file .env
check_env() {
  if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  File .env non trovato. Copio .env.example in .env...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ File .env creato. Verifica le configurazioni se necessario.${NC}"
    echo ""
  fi
}

# Attende che il container backend sia sano/attivo
wait_for_backend() {
  echo -e "${CYAN}⏳ Attesa che il container backend sia pronto...${NC}"
  for i in {1..30}; do
    if docker compose ps --services --filter status=running 2>/dev/null | grep -q "backend"; then
      echo -e "${GREEN}✅ Backend attivo e in esecuzione!${NC}"
      return 0
    fi
    sleep 2
  done
  echo -e "${YELLOW}⚠️  Il backend sta impiegando molto tempo ad avviarsi. Proseguo comunque.${NC}"
  return 0
}

# Avvio dei servizi
start_services() {
  check_docker || return 1
  check_env
  
  local rebuild=$1
  if [ "$rebuild" = "true" ]; then
    echo -e "${BLUE}🚀 Avvio dei servizi Docker con ricostruzione (--build)...${NC}"
    docker compose up --build -d
  else
    echo -e "${BLUE}🚀 Avvio dei servizi Docker in background...${NC}"
    docker compose up -d
  fi
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Servizi avviati con successo!${NC}"
    wait_for_backend
    echo -e "\n${BOLD}🔗 Link utili:${NC}"
    echo -e "   - Frontend (Next.js): ${CYAN}http://localhost:3000${NC}"
    echo -e "   - Backend API (FastAPI Docs): ${CYAN}http://localhost:10000/docs${NC}"
  else
    echo -e "${RED}❌ Errore durante l'avvio dei servizi.${NC}"
  fi
  echo ""
  read -n 1 -s -r -p "Premi un tasto per tornare al menu principale..."
}

# Arresto dei servizi
stop_services() {
  check_docker || return 1
  echo -e "${YELLOW}🛑 Arresto dei servizi Docker...${NC}"
  docker compose down
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Servizi arrestati correttamente.${NC}"
  else
    echo -e "${RED}❌ Errore durante l'arresto dei servizi.${NC}"
  fi
  echo ""
  read -n 1 -s -r -p "Premi un tasto per tornare al menu principale..."
}

# Estrazione dati ICD-11
run_icd11_etl() {
  check_docker || return 1
  if ! docker compose ps --services --filter status=running 2>/dev/null | grep -q "backend"; then
    echo -e "${YELLOW}⚠️  Il container backend non è attivo. Lo avvio...${NC}"
    docker compose up -d icd11-api backend
    wait_for_backend
  fi
  
  echo -e "${BLUE}🔬 Avvio estrazione dati gerarchia ICD-11 dal container API...${NC}"
  echo -e "${YELLOW}Nota: l'operazione potrebbe richiedere alcuni minuti a seconda del livello di profondità.${NC}"
  echo ""
  
  # Chiedi livello di profondità
  read -p "Inserisci profondità massima [1-4] (default 4): " max_level
  max_level=${max_level:-4}
  
  docker compose exec backend python scripts/extract_icd11_data.py --max-level "$max_level"
  
  echo ""
  read -n 1 -s -r -p "Premi un tasto per tornare al menu principale..."
}

# Estrazione casi DSM-5
run_dsm5_etl() {
  check_docker || return 1
  if [ -f "extract_dsm5.sh" ]; then
    echo -e "${BLUE}🔬 Avvio dello script extract_dsm5.sh...${NC}"
    ./extract_dsm5.sh
  else
    if ! docker compose ps --services --filter status=running 2>/dev/null | grep -q "backend"; then
      echo -e "${YELLOW}⚠️  Il container backend non è attivo. Lo avvio...${NC}"
      docker compose up -d backend
      wait_for_backend
    fi
    
    echo -e "${BLUE}🔬 Avvio estrazione casi clinici DSM-5 dal PDF...${NC}"
    echo ""
    read -p "Inserisci il percorso assoluto o relativo del PDF DSM-5-TR: " pdf_path
    if [ -f "$pdf_path" ]; then
      mkdir -p backend/data
      cp "$pdf_path" backend/data/dsm5tr.pdf
      docker compose exec backend python scripts/extract_dsm5_cases.py --pdf-path /app/data/dsm5tr.pdf
    else
      echo -e "${RED}❌ File PDF non trovato in $pdf_path.${NC}"
    fi
  fi
  echo ""
  read -n 1 -s -r -p "Premi un tasto per tornare al menu principale..."
}

# Mostra log
show_logs() {
  check_docker || return 1
  echo -e "${BLUE}📋 Visualizzazione dei log (Premi CTRL+C per uscire)...${NC}"
  docker compose logs -f
}

# Diagnostica DB e Auth
run_diagnostics() {
  if [ -f ".env" ]; then
    # Legge le variabili escludendo i commenti
    export $(grep -v '^#' .env | xargs)
  fi

  echo -e "${BLUE}🔍 DIAGNOSTICA DEL PROGETTO${NC}"
  echo -e "  ─────────────────────────────────────────────────────────────"
  
  # Check DB
  echo -e "${BOLD}Database PostgreSQL:${NC}"
  if [ -n "$DATABASE_URL" ]; then
    echo -e "   URL: ${CYAN}${DATABASE_URL}${NC}"
    if docker compose ps --services --filter status=running 2>/dev/null | grep -q "backend"; then
      echo -e "   Test connessione in corso..."
      if docker compose exec backend python -c "
import os
from sqlalchemy import create_engine
try:
    engine = create_engine(os.environ.get('DATABASE_URL'))
    with engine.connect() as conn:
        pass
    print('OK')
except Exception as e:
    print('ERROR:', e)
    exit(1)
" >/dev/null 2>&1; then
        echo -e "   Stato: ${GREEN}● Connessione riuscita (Online)${NC}"
      else
        echo -e "   Stato: ${RED}● Connessione fallita (Errore)${NC}"
      fi
    else
      echo -e "   Stato: ${YELLOW}● Non verificabile (il container backend deve essere attivo)${NC}"
    fi
  else
    echo -e "   Stato: ${RED}❌ DATABASE_URL non definito nel file .env${NC}"
  fi

  echo ""
  
  # Check Auth
  echo -e "${BOLD}Configurazione Autenticazione (Authentik OIDC):${NC}"
  if [ -z "$AUTHENTIK_CLIENT_ID" ] || [ "$AUTHENTIK_CLIENT_ID" = "llmind2-client-id" ] || [ -z "$AUTHENTIK_CLIENT_SECRET" ] || [ "$AUTHENTIK_CLIENT_SECRET" = "llmind2-client-secret" ]; then
    echo -e "   Stato: ${RED}⚠️ Non configurato o con valori di default${NC}"
    echo -e "   Client ID: ${YELLOW}${AUTHENTIK_CLIENT_ID}${NC}"
    echo -e "   Assicurati di configurare i client secret reali in .env per il corretto funzionamento."
  else
    echo -e "   Stato: ${GREEN}✅ Configurato correttamente${NC}"
    echo -e "   Issuer URL: ${CYAN}${AUTHENTIK_ISSUER_URL}${NC}"
    echo -e "   Client ID: ${CYAN}${AUTHENTIK_CLIENT_ID}${NC}"
  fi
  echo -e "  ─────────────────────────────────────────────────────────────"
  echo ""
  read -n 1 -s -r -p "Premi un tasto per tornare al menu principale..."
}

# Loop del menu principale
while true; do
  print_banner
  echo -e "${BOLD}Scegli un'opzione:${NC}"
  echo -e "  ${GREEN}1)${NC} Avvia il progetto (standard)"
  echo -e "  ${GREEN}2)${NC} Avvia il progetto con ricostruzione delle immagini (--build)"
  echo -e "  ${RED}3)${NC} Ferma tutti i servizi (docker compose down)"
  echo -e "  ${CYAN}4)${NC} Esegui ETL ICD-11 (Estrai gerarchia nel Database)"
  echo -e "  ${CYAN}5)${NC} Esegui ETL Casi DSM-5 (Estrai casi da PDF)"
  echo -e "  ${PURPLE}6)${NC} Mostra i log in tempo reale"
  echo -e "  ${CYAN}7)${NC} Diagnostica (Stato DB e Auth)"
  echo -e "  ${YELLOW}8)${NC} Esci"
  echo ""
  read -p "Opzione [1-8]: " opt
  
  case $opt in
    1)
      start_services "false"
      ;;
    2)
      start_services "true"
      ;;
    3)
      stop_services
      ;;
    4)
      run_icd11_etl
      ;;
    5)
      run_dsm5_etl
      ;;
    6)
      show_logs
      ;;
    7)
      run_diagnostics
      ;;
    8)
      echo -e "${GREEN}Arrivederci!${NC}"
      exit 0
      ;;
    *)
      echo -e "${RED}Opzione non valida.${NC}"
      sleep 1
      ;;
  esac
done
