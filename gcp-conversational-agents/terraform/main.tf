locals {
  required_services = toset([
    "dialogflow.googleapis.com",
    "discoveryengine.googleapis.com",
    "storage.googleapis.com",
    "bigquery.googleapis.com",
    "iam.googleapis.com",
    "serviceusage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "logging.googleapis.com"
  ])
}

resource "google_project_service" "required" {
  for_each           = local.required_services
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "clinical_corpora" {
  name                        = var.bucket_name
  location                    = var.bucket_location
  uniform_bucket_level_access = true
  force_destroy               = true

  versioning {
    enabled = var.bucket_versioning_enabled
  }

  lifecycle_rule {
    condition {
      age = var.bucket_nearline_after_days
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  dynamic "lifecycle_rule" {
    for_each = var.bucket_delete_after_days > 0 ? [1] : []
    content {
      condition {
        age = var.bucket_delete_after_days
      }
      action {
        type = "Delete"
      }
    }
  }

  labels = {
    app      = "llmind"
    workload = "conversational-agents"
    env      = "poc"
  }

  depends_on = [google_project_service.required]
}

resource "google_service_account" "automation" {
  account_id   = "llmind-agent-automation"
  display_name = "llmind Conversational Agents automation"
  description  = "Automation account for Dialogflow CX playbooks and Agent Search data store operations."

  depends_on = [google_project_service.required]
}

resource "google_bigquery_dataset" "clinical_static" {
  dataset_id                 = var.bigquery_dataset_id
  project                    = var.project_id
  location                   = var.bigquery_location
  description                = "Static LLMind2 ICD-11 and DSM-5-TR research corpus for low-cost conversational agent retrieval."
  delete_contents_on_destroy = var.bigquery_delete_contents_on_destroy

  labels = {
    app      = "llmind"
    workload = "conversational-agents"
    corpus   = "static-clinical"
    env      = "poc"
  }

  depends_on = [google_project_service.required]
}

resource "google_bigquery_table" "icd11_categories" {
  dataset_id          = google_bigquery_dataset.clinical_static.dataset_id
  table_id            = "icd11_categories"
  project             = var.project_id
  deletion_protection = var.bigquery_table_deletion_protection
  clustering          = ["chapter_code", "code_prefix", "diagnostic_family", "code"]

  schema = jsonencode([
    { name = "source_system", type = "STRING", mode = "REQUIRED" },
    { name = "corpus_version", type = "STRING", mode = "REQUIRED" },
    { name = "code", type = "STRING", mode = "REQUIRED" },
    { name = "code_prefix", type = "STRING", mode = "NULLABLE" },
    { name = "chapter_code", type = "STRING", mode = "NULLABLE" },
    { name = "name", type = "STRING", mode = "REQUIRED" },
    { name = "diagnostic_family", type = "STRING", mode = "NULLABLE" },
    { name = "description", type = "STRING", mode = "NULLABLE" },
    { name = "search_text", type = "STRING", mode = "NULLABLE" },
    { name = "source_file", type = "STRING", mode = "REQUIRED" }
  ])
}

resource "google_bigquery_table" "dsm5_cases" {
  dataset_id          = google_bigquery_dataset.clinical_static.dataset_id
  table_id            = "dsm5_cases"
  project             = var.project_id
  deletion_protection = var.bigquery_table_deletion_protection
  clustering          = ["primary_diagnostic_family", "case_number", "has_suggested_readings", "diagnosis_hash"]

  schema = jsonencode([
    { name = "source_system", type = "STRING", mode = "REQUIRED" },
    { name = "corpus_version", type = "STRING", mode = "REQUIRED" },
    { name = "case_number", type = "INTEGER", mode = "REQUIRED" },
    { name = "primary_diagnostic_family", type = "STRING", mode = "NULLABLE" },
    { name = "diagnosis_hash", type = "STRING", mode = "REQUIRED" },
    { name = "has_suggested_readings", type = "BOOLEAN", mode = "REQUIRED" },
    { name = "introduction", type = "STRING", mode = "NULLABLE" },
    { name = "discussion", type = "STRING", mode = "NULLABLE" },
    { name = "diagnosis", type = "STRING", mode = "NULLABLE" },
    { name = "source_file", type = "STRING", mode = "REQUIRED" }
  ])
}

resource "google_bigquery_table" "agent_corpus_chunks" {
  dataset_id          = google_bigquery_dataset.clinical_static.dataset_id
  table_id            = "agent_corpus_chunks"
  project             = var.project_id
  deletion_protection = var.bigquery_table_deletion_protection
  clustering          = ["corpus", "diagnostic_family", "section", "code"]

  schema = jsonencode([
    { name = "corpus", type = "STRING", mode = "REQUIRED" },
    { name = "corpus_version", type = "STRING", mode = "REQUIRED" },
    { name = "record_id", type = "STRING", mode = "REQUIRED" },
    { name = "chunk_id", type = "STRING", mode = "REQUIRED" },
    { name = "section", type = "STRING", mode = "REQUIRED" },
    { name = "code", type = "STRING", mode = "NULLABLE" },
    { name = "case_number", type = "INTEGER", mode = "NULLABLE" },
    { name = "diagnostic_family", type = "STRING", mode = "NULLABLE" },
    { name = "title", type = "STRING", mode = "NULLABLE" },
    { name = "text", type = "STRING", mode = "REQUIRED" },
    { name = "token_estimate", type = "INTEGER", mode = "NULLABLE" },
    { name = "source_file", type = "STRING", mode = "REQUIRED" }
  ])
}

resource "google_bigquery_dataset_iam_member" "automation_data_editor" {
  dataset_id = google_bigquery_dataset.clinical_static.dataset_id
  project    = var.project_id
  role       = "roles/bigquery.dataEditor"
  member     = "serviceAccount:${google_service_account.automation.email}"
}

resource "google_project_iam_member" "automation_bigquery_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.automation.email}"
}

resource "google_project_iam_member" "dialogflow_admin" {
  project = var.project_id
  role    = "roles/dialogflow.admin"
  member  = "serviceAccount:${google_service_account.automation.email}"
}

resource "google_project_iam_member" "discoveryengine_admin" {
  project = var.project_id
  role    = "roles/discoveryengine.admin"
  member  = "serviceAccount:${google_service_account.automation.email}"
}

resource "google_storage_bucket_iam_member" "automation_bucket_admin" {
  bucket = google_storage_bucket.clinical_corpora.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.automation.email}"
}

resource "google_service_account_iam_member" "optional_impersonation" {
  count              = var.automation_principal == "" ? 0 : 1
  service_account_id = google_service_account.automation.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = var.automation_principal
}
