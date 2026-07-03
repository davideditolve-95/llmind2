#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:?Usage: create_dialogflow_agent.sh PROJECT_ID LOCATION}"
LOCATION="${2:?Usage: create_dialogflow_agent.sh PROJECT_ID LOCATION}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_JSON="${ROOT_DIR}/config/agent.json"
TOKEN="$(gcloud auth print-access-token)"

curl -sS -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: ${PROJECT_ID}" \
  "https://${LOCATION}-dialogflow.googleapis.com/v3/projects/${PROJECT_ID}/locations/${LOCATION}/agents" \
  -d @"${AGENT_JSON}" | tee "${ROOT_DIR}/.agent-create-response.json"

echo
echo "Saved response to ${ROOT_DIR}/.agent-create-response.json"
echo "Set DIALOGFLOW_AGENT_ID to the final segment of the returned name."

