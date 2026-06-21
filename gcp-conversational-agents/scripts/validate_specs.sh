#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

command -v jq >/dev/null || { echo "jq is required"; exit 1; }

echo "Validating JSON specs..."
for FILE in \
  "${ROOT_DIR}"/config/*.json \
  "${ROOT_DIR}"/datastores/*.json \
  "${ROOT_DIR}"/playbooks/*.json \
  "${ROOT_DIR}"/subagents/*.json; do
  jq empty "${FILE}"
  echo "OK ${FILE#${ROOT_DIR}/}"
done

echo "Validating shell scripts..."
for FILE in "${ROOT_DIR}"/scripts/*.sh; do
  bash -n "${FILE}"
  echo "OK ${FILE#${ROOT_DIR}/}"
done

echo "Validating Python scripts..."
for FILE in "${ROOT_DIR}"/scripts/*.py; do
  "${PYTHON_BIN}" -m py_compile "${FILE}"
  echo "OK ${FILE#${ROOT_DIR}/}"
done

echo "All GCP Conversational Agents specs are valid."
