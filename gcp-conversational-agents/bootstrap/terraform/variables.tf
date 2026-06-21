variable "project_id" {
  description = "Globally unique GCP project id to create for LLMind2."
  type        = string
}

variable "project_name" {
  description = "Human-readable project name."
  type        = string
  default     = "llmind"
}

variable "organization_id" {
  description = "GCP organization id. Leave empty when using folder_id."
  type        = string
  default     = ""
}

variable "folder_id" {
  description = "GCP folder id. Leave empty when using organization_id."
  type        = string
  default     = ""
}

variable "billing_account" {
  description = "Billing account id, for example 000000-000000-000000."
  type        = string
}

variable "default_region" {
  description = "Default provider region."
  type        = string
  default     = "europe-west8"
}

variable "budget_amount_eur" {
  description = "Monthly budget amount for the project. Set to 0 to skip budget creation."
  type        = number
  default     = 5
}

variable "budget_alert_emails" {
  description = "Optional email addresses to notify from the budget console workflow. Terraform budget notifications require a Pub/Sub topic; keep emails documented here for handoff."
  type        = list(string)
  default     = []
}

variable "essential_services" {
  description = "APIs enabled immediately after project creation."
  type        = set(string)
  default = [
    "serviceusage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "cloudbilling.googleapis.com",
    "iam.googleapis.com",
    "billingbudgets.googleapis.com",
    "logging.googleapis.com",
    "storage.googleapis.com",
    "bigquery.googleapis.com",
    "dialogflow.googleapis.com",
    "discoveryengine.googleapis.com"
  ]
}

variable "project_labels" {
  description = "Labels applied to the created project."
  type        = map(string)
  default = {
    app         = "llmind"
    environment = "poc"
    workload    = "clinical-ai-agents"
    managed_by  = "terraform"
  }
}

variable "enable_data_access_audit_logs" {
  description = "Enable verbose Data Access audit logs. Keep false for lowest-cost PoC; enable for regulated research environments."
  type        = bool
  default     = false
}

variable "workload_admin_principals" {
  description = "Optional IAM principals allowed to administer the LLMind2 workload after project bootstrap, e.g. user:you@example.com or group:research@example.com."
  type        = set(string)
  default     = []
}

variable "workload_admin_roles" {
  description = "Project roles granted to workload_admin_principals."
  type        = set(string)
  default = [
    "roles/serviceusage.serviceUsageAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/storage.admin",
    "roles/bigquery.admin",
    "roles/dialogflow.admin",
    "roles/discoveryengine.admin",
    "roles/logging.viewer"
  ]
}
