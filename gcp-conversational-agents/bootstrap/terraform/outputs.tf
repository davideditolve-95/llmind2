output "project_id" {
  value = google_project.llmind2.project_id
}

output "project_number" {
  value = google_project.llmind2.number
}

output "enabled_services" {
  value = sort([for service in google_project_service.essential : service.service])
}

output "workload_tfvars_hint" {
  value = <<EOT
project_id          = "${google_project.llmind2.project_id}"
region              = "eu"
bucket_name         = "${google_project.llmind2.project_id}-clinical-corpora"
bucket_location     = "EU"
bigquery_dataset_id = "llmind2_static_clinical"
bigquery_location   = "EU"
bucket_versioning_enabled           = false
bucket_nearline_after_days          = 30
bucket_delete_after_days            = 90
bigquery_delete_contents_on_destroy = true
bigquery_table_deletion_protection  = false
EOT
}
