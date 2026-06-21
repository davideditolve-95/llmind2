#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:?Usage: print_datastore_commands.sh PROJECT_ID LOCATION BUCKET_NAME}"
LOCATION="${2:?Usage: print_datastore_commands.sh PROJECT_ID LOCATION BUCKET_NAME}"
BUCKET_NAME="${3:?Usage: print_datastore_commands.sh PROJECT_ID LOCATION BUCKET_NAME}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${ROOT_DIR}/datastores/datastore-manifest.json"

command -v jq >/dev/null || { echo "jq is required"; exit 1; }

cat <<EOF
# Review current Agent Search / Discovery Engine CLI syntax for your installed gcloud version.
# These commands show the intended data-store mapping from this repo's manifest.
# Project: ${PROJECT_ID}
# Location: ${LOCATION}

EOF

jq -c '.datastores[]' "${MANIFEST}" | while read -r DATASTORE; do
  ID="$(echo "${DATASTORE}" | jq -r '.id')"
  DISPLAY="$(echo "${DATASTORE}" | jq -r '.display_name')"
  PREFIX="$(echo "${DATASTORE}" | jq -r '.gcs_prefix')"
  URI="gs://${BUCKET_NAME}/${PREFIX}/*"
  cat <<EOF
# ${DISPLAY}
# Data store id: ${ID}
# Source URI: ${URI}
gcloud discovery-engine data-stores create \\
  --project="${PROJECT_ID}" \\
  --location="${LOCATION}" \\
  --data-store="${ID}" \\
  --display-name="${DISPLAY}" \\
  --industry-vertical=GENERIC \\
  --solution-types=SOLUTION_TYPE_SEARCH

gcloud discovery-engine documents import \\
  --project="${PROJECT_ID}" \\
  --location="${LOCATION}" \\
  --data-store="${ID}" \\
  --gcs-source="${URI}" \\
  --reconciliation-mode=INCREMENTAL

EOF
done
