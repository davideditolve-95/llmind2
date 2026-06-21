variable "project_id" {
  description = "GCP project id."
  type        = string
}

variable "region" {
  description = "GCP region or multi-region used by Dialogflow CX and Agent Search. Examples: eu, us, europe-west1."
  type        = string
  default     = "eu"
}

variable "bucket_name" {
  description = "Globally unique bucket name for clinical PDF corpora."
  type        = string
}

variable "bucket_location" {
  description = "Cloud Storage bucket location."
  type        = string
  default     = "EU"
}

variable "bucket_nearline_after_days" {
  description = "Move uploaded corpus documents to NEARLINE after this many days. Use a low value for PoC storage cost control."
  type        = number
  default     = 30
}

variable "bucket_delete_after_days" {
  description = "Delete uploaded corpus documents after this many days. Set to 0 to disable deletion."
  type        = number
  default     = 90
}

variable "bucket_versioning_enabled" {
  description = "Enable bucket versioning. Keep false for lowest-cost PoC."
  type        = bool
  default     = false
}

variable "bigquery_dataset_id" {
  description = "BigQuery dataset for static LLMind2 clinical corpora."
  type        = string
  default     = "llmind2_static_clinical"
}

variable "bigquery_location" {
  description = "BigQuery dataset location. Keep aligned with bucket_location for low-friction loads."
  type        = string
  default     = "EU"
}

variable "bigquery_delete_contents_on_destroy" {
  description = "Allow Terraform destroy to delete dataset contents. Useful for PoC teardown."
  type        = bool
  default     = true
}

variable "bigquery_table_deletion_protection" {
  description = "Protect BigQuery tables from deletion. Keep false for low-cost PoC teardown."
  type        = bool
  default     = false
}

variable "automation_principal" {
  description = "Optional IAM principal allowed to impersonate the automation service account, e.g. user:name@example.com."
  type        = string
  default     = ""
}
