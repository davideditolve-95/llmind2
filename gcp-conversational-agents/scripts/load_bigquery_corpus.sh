#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:?Usage: load_bigquery_corpus.sh PROJECT_ID DATASET_ID [ICD_SOURCE]}"
DATASET_ID="${2:?Usage: load_bigquery_corpus.sh PROJECT_ID DATASET_ID [ICD_SOURCE]}"
ICD_SOURCE="${3:-db}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/generated/bigquery"
PYTHON_BIN="${PYTHON_BIN:-python3}"

command -v bq >/dev/null || { echo "bq is required"; exit 1; }

"${PYTHON_BIN}" "${ROOT_DIR}/scripts/prepare_bigquery_corpus.py" \
  --out "${OUT_DIR}" \
  --icd-source "${ICD_SOURCE}"

echo "Loading ICD-11 categories..."
bq load \
  --project_id="${PROJECT_ID}" \
  --source_format=NEWLINE_DELIMITED_JSON \
  --replace \
  "${DATASET_ID}.icd11_categories" \
  "${OUT_DIR}/icd11_categories.jsonl"

echo "Loading DSM-5-TR cases..."
bq load \
  --project_id="${PROJECT_ID}" \
  --source_format=NEWLINE_DELIMITED_JSON \
  --replace \
  "${DATASET_ID}.dsm5_cases" \
  "${OUT_DIR}/dsm5_cases.jsonl"

echo "Loading unified agent corpus chunks..."
bq load \
  --project_id="${PROJECT_ID}" \
  --source_format=NEWLINE_DELIMITED_JSON \
  --replace \
  "${DATASET_ID}.agent_corpus_chunks" \
  "${OUT_DIR}/agent_corpus_chunks.jsonl"

echo "BigQuery static corpus loaded into ${PROJECT_ID}.${DATASET_ID}."
