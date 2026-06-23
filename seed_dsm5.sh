#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# seed_dsm5.sh
#
# Esegue il seed delle categorie DSM-5 di base nel database PostgreSQL del backend.
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔══════════════════════════════════════════════════════════════╗"
# Seeding DSM-5 Categories
echo "║          ICD-11 Explorer — Seeding Categorie DSM-5           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Verifica che Docker sia in esecuzione
if ! docker info > /dev/null 2>&1; then
  echo "❌ ERRORE: Docker non è in esecuzione. Avvia Docker Desktop e riprova."
  exit 1
fi

# Verifica che il container backend sia attivo
if ! docker compose ps --services --filter status=running 2>/dev/null | grep -q "backend"; then
  echo "⚠️ Il container backend non è attivo. Avvio dei servizi..."
  docker compose up -d backend
  echo "   Attendo che il backend sia pronto..."
  sleep 5
fi

echo "🚀 Esecuzione script di seeding..."
docker compose exec backend python scripts/seed_dsm5.py

echo ""
echo "✅ Seeding DSM-5 completato!"
echo ""
