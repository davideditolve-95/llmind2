output "bucket_name" {
  value = google_storage_bucket.clinical_corpora.name
}

output "automation_service_account" {
  value = google_service_account.automation.email
}

output "dialogflow_location" {
  value = var.region
}

output "pdf_upload_prefix" {
  value = "gs://${google_storage_bucket.clinical_corpora.name}/clinical-corpora/"
}

output "bigquery_dataset_id" {
  value = google_bigquery_dataset.clinical_static.dataset_id
}

output "bigquery_tables" {
  value = {
    icd11_categories    = google_bigquery_table.icd11_categories.table_id
    dsm5_cases          = google_bigquery_table.dsm5_cases.table_id
    agent_corpus_chunks = google_bigquery_table.agent_corpus_chunks.table_id
  }
}
