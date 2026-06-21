#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:?Usage: upload_pdfs.sh PROJECT_ID BUCKET_NAME}"
BUCKET_NAME="${2:?Usage: upload_pdfs.sh PROJECT_ID BUCKET_NAME}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${ROOT_DIR}/datastores/datastore-manifest.json"

command -v jq >/dev/null || { echo "jq is required"; exit 1; }
command -v gsutil >/dev/null || { echo "gsutil is required"; exit 1; }

gcloud config set project "${PROJECT_ID}" >/dev/null

jq -c '.datastores[]' "${MANIFEST}" | while read -r DATASTORE; do
  ID="$(echo "${DATASTORE}" | jq -r '.id')"
  PREFIX="$(echo "${DATASTORE}" | jq -r '.gcs_prefix')"
  echo "Uploading files for ${ID} to gs://${BUCKET_NAME}/${PREFIX}/"

  FOUND=0
  while read -r REL_PATH; do
    ABS_PATH="${ROOT_DIR}/${REL_PATH}"
    if [[ -f "${ABS_PATH}" ]]; then
      FOUND=1
      gsutil cp "${ABS_PATH}" "gs://${BUCKET_NAME}/${PREFIX}/"
    fi
  done < <(echo "${DATASTORE}" | jq -r '.local_files[]')

  if [[ "${FOUND}" == "0" ]]; then
    echo "WARNING: no local source found for ${ID}. Add licensed PDFs or derived corpora under ${ROOT_DIR}/source-pdfs/ or backend/data/original_docs/."
  fi
done
