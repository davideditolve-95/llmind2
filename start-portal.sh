#!/usr/bin/env bash
# start-portal.sh - Script per avviare il Portale di Test Visuale
# Rileva l'ambiente locale e lancia un server HTTP locale su porta 8080.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${BLUE}${BOLD}🚀 Avvio del Portale di Test Visuale (LLMind2)...${NC}"

# Determina la directory dello script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=8080

# Funzione per aprire il browser su macOS/Linux
open_browser() {
  sleep 1.5
  if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:$PORT"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v xdg-open &> /dev/null; then
      xdg-open "http://localhost:$PORT"
    fi
  fi
}

# Avvia l'apertura del browser in background
open_browser &

# Rileva ed avvia il server
if command -v python3 &> /dev/null; then
  echo -e "${GREEN}✓ Rilevato Python 3.${NC} Avvio server su http://localhost:$PORT..."
  python3 -m http.server $PORT --directory test-portal
elif command -v python &> /dev/null; then
  echo -e "${GREEN}✓ Rilevato Python.${NC} Avvio server su http://localhost:$PORT..."
  python -m SimpleHTTPServer $PORT --directory test-portal
elif command -v npx &> /dev/null; then
  echo -e "${GREEN}✓ Rilevato Node.js (npx).${NC} Avvio server su http://localhost:$PORT..."
  npx serve -l $PORT test-portal
else
  echo -e "${RED}❌ ERRORE: Nessun interprete Python o Node.js installato nel sistema.${NC}"
  echo -e "Per avviare il portale manualmente, apri direttamente il file nel browser:"
  echo -e "   file://$SCRIPT_DIR/test-portal/index.html"
  exit 1
fi
