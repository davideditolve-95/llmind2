#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:?Usage: query_bigquery_corpus.sh PROJECT_ID DATASET_ID SEARCH_TERM [MAX_BYTES_BILLED]}"
DATASET_ID="${2:?Usage: query_bigquery_corpus.sh PROJECT_ID DATASET_ID SEARCH_TERM [MAX_BYTES_BILLED]}"
SEARCH_TERM="${3:?Usage: query_bigquery_corpus.sh PROJECT_ID DATASET_ID SEARCH_TERM [MAX_BYTES_BILLED]}"
MAX_BYTES_BILLED="${4:-10485760}"

command -v bq >/dev/null || { echo "bq is required"; exit 1; }

bq query \
  --project_id="${PROJECT_ID}" \
  --use_legacy_sql=false \
  --maximum_bytes_billed="${MAX_BYTES_BILLED}" \
  --parameter="search_term:STRING:${SEARCH_TERM}" \
  "
SELECT
  corpus,
  diagnostic_family,
  section,
  code,
  case_number,
  title,
  SUBSTR(text, 1, 900) AS text_preview
FROM \`${PROJECT_ID}.${DATASET_ID}.agent_corpus_chunks\`
WHERE LOWER(text) LIKE CONCAT('%', LOWER(@search_term), '%')
ORDER BY corpus, diagnostic_family, section
LIMIT 20
"
