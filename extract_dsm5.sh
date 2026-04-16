#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# extract_dsm5.sh
#
# Copia il PDF del DSM-5-TR nella directory montata dal container backend
# e avvia lo script di estrazione casi clinici nel container Docker.
#
# USO:
#   ./extract_dsm5.sh              # Estrazione completa (tutti i casi)
#   ./extract_dsm5.sh --dry-run    # Preview senza scrivere nel DB
#   ./extract_dsm5.sh --max-cases 10  # Solo i primi N casi (per test)
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Termina lo script in caso di errore

# ─── Configurazione ──────────────────────────────────────────────────────────
PDF_SOURCE="files/dsm5tr.pdf"
PDF_DEST="backend/data/dsm5tr.pdf"
CONTAINER_PDF_PATH="/app/data/dsm5tr.pdf"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Verifica prerequisiti ────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         ICD-11 Explorer — Estrazione Casi DSM-5-TR           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Verifica che il PDF sorgente esista
if [ ! -f "$SCRIPT_DIR/$PDF_SOURCE" ]; then
  echo "❌ ERRORE: File PDF non trovato: $SCRIPT_DIR/$PDF_SOURCE"
  echo "   Assicurati che il file dsm5tr.pdf sia in: llmind2/files/"
  exit 1
fi

echo "✅ PDF trovato: $PDF_SOURCE"

# Verifica che Docker sia in esecuzione
if ! docker info > /dev/null 2>&1; then
  echo "❌ ERRORE: Docker non è in esecuzione. Avvia Docker Desktop e riprova."
  exit 1
fi

# Verifica che il container backend sia attivo
if ! docker compose ps --services --filter status=running 2>/dev/null | grep -q "backend"; then
  echo "⚠️  Il container backend non è attivo. Avvio dei servizi..."
  docker compose up -d db backend
  echo "   Attendo che il backend sia pronto..."
  sleep 5
fi

echo "✅ Backend container attivo"

# ─── Copia del PDF nel volume montato dal container ──────────────────────────
echo ""
echo "📂 Copia del PDF in $PDF_DEST ..."
mkdir -p "$SCRIPT_DIR/backend/data"
cp "$SCRIPT_DIR/$PDF_SOURCE" "$SCRIPT_DIR/$PDF_DEST"
echo "✅ PDF copiato con successo"

# ─── Esecuzione dello script di estrazione ────────────────────────────────────
echo ""
echo "🔬 Avvio estrazione casi clinici..."
echo "   PDF: $CONTAINER_PDF_PATH"
echo ""

# Passa tutti gli argomenti aggiuntivi allo script Python
docker compose exec backend python scripts/extract_dsm5_cases.py \
  --pdf-path "$CONTAINER_PDF_PATH" \
  "$@"

echo ""
echo "✅ Estrazione completata!"
echo "   Apri http://localhost:3000/benchmark/cases per vedere i casi estratti."
echo ""
