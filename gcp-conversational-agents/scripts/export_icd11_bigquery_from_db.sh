#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/generated/bigquery"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  cat >&2 <<'EOF'
DATABASE_URL is required.

Populate ICD-11 first:
  docker compose exec backend python scripts/extract_icd11_data.py --max-level 4 --language en

Then export from the host or backend container with a reachable DATABASE_URL.
EOF
  exit 1
fi

"${PYTHON_BIN}" "${ROOT_DIR}/scripts/prepare_bigquery_corpus.py" \
  --icd-source db \
  --out "${OUT_DIR}"
