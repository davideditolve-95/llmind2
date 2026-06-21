#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOTSTRAP_DIR="${ROOT_DIR}/bootstrap/terraform"
WORKLOAD_DIR="${ROOT_DIR}/terraform"

BOOTSTRAP_TFVARS="${1:-${BOOTSTRAP_DIR}/terraform.tfvars}"
WORKLOAD_TFVARS="${2:-${WORKLOAD_DIR}/terraform.tfvars.generated}"

command -v terraform >/dev/null || { echo "terraform is required"; exit 1; }

if [[ ! -f "${BOOTSTRAP_TFVARS}" ]]; then
  cat >&2 <<EOF
Missing bootstrap tfvars: ${BOOTSTRAP_TFVARS}

Create it from:
  ${BOOTSTRAP_DIR}/terraform.tfvars.example
EOF
  exit 1
fi

echo "Applying GCP project bootstrap..."
terraform -chdir="${BOOTSTRAP_DIR}" init
terraform -chdir="${BOOTSTRAP_DIR}" apply -var-file="${BOOTSTRAP_TFVARS}"

echo "Writing workload tfvars hint to ${WORKLOAD_TFVARS}"
terraform -chdir="${BOOTSTRAP_DIR}" output -raw workload_tfvars_hint > "${WORKLOAD_TFVARS}"

echo "Applying LLMind2 workload resources..."
terraform -chdir="${WORKLOAD_DIR}" init
terraform -chdir="${WORKLOAD_DIR}" apply -var-file="${WORKLOAD_TFVARS}"

echo "GCP foundation and workload resources are ready."
echo "Next steps:"
echo "  cd ${ROOT_DIR}"
echo "  ./scripts/sync_source_documents.sh"
echo "  ./scripts/upload_pdfs.sh PROJECT_ID BUCKET_NAME"
echo "  ./scripts/load_bigquery_corpus.sh PROJECT_ID llmind2_static_clinical"
