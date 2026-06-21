#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:?Usage: create_playbooks.sh PROJECT_ID LOCATION AGENT_ID}"
LOCATION="${2:?Usage: create_playbooks.sh PROJECT_ID LOCATION AGENT_ID}"
AGENT_ID="${3:?Usage: create_playbooks.sh PROJECT_ID LOCATION AGENT_ID}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN="$(gcloud auth print-access-token)"

command -v jq >/dev/null || { echo "jq is required"; exit 1; }

for PLAYBOOK in "${ROOT_DIR}"/playbooks/*.json; do
  NAME="$(jq -r '.displayName' "${PLAYBOOK}")"
  TMP="$(mktemp)"
  jq 'del(.examples)' "${PLAYBOOK}" > "${TMP}"
  echo "Creating playbook: ${NAME}"
  curl -sS -X POST \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    "https://dialogflow.googleapis.com/v3/projects/${PROJECT_ID}/locations/${LOCATION}/agents/${AGENT_ID}/playbooks" \
    -d @"${TMP}" | tee "${ROOT_DIR}/.playbook-${NAME// /-}.response.json"
  rm -f "${TMP}"
  echo
done

echo "Playbook creation responses saved in ${ROOT_DIR}/.playbook-*.response.json"
echo "Examples are kept in the JSON specs for design review; import them manually or extend this script once your target API version is confirmed."

