locals {
  parent_is_folder = var.folder_id != ""
  parent_is_org    = var.organization_id != ""
}

resource "google_project" "llmind2" {
  project_id      = var.project_id
  name            = var.project_name
  org_id          = local.parent_is_org ? var.organization_id : null
  folder_id       = local.parent_is_folder ? var.folder_id : null
  billing_account = var.billing_account
  labels          = var.project_labels

  lifecycle {
    precondition {
      condition     = local.parent_is_folder != local.parent_is_org
      error_message = "Set exactly one of organization_id or folder_id."
    }
  }
}

resource "google_project_service" "essential" {
  for_each           = var.essential_services
  project            = google_project.llmind2.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_billing_budget" "monthly_guardrail" {
  count           = var.budget_amount_eur > 0 ? 1 : 0
  billing_account = var.billing_account
  display_name    = "${var.project_name} monthly guardrail"

  budget_filter {
    projects = ["projects/${google_project.llmind2.number}"]
  }

  amount {
    specified_amount {
      currency_code = "EUR"
      units         = tostring(floor(var.budget_amount_eur))
      nanos         = floor((var.budget_amount_eur - floor(var.budget_amount_eur)) * 1000000000)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 0.8
  }

  threshold_rules {
    threshold_percent = 1.0
  }

  threshold_rules {
    threshold_percent = 1.2
  }

  depends_on = [google_project_service.essential]
}

resource "google_project_iam_audit_config" "data_access_audit" {
  count   = var.enable_data_access_audit_logs ? 1 : 0
  project = google_project.llmind2.project_id
  service = "allServices"

  audit_log_config {
    log_type = "ADMIN_READ"
  }

  audit_log_config {
    log_type = "DATA_READ"
  }

  audit_log_config {
    log_type = "DATA_WRITE"
  }
}

resource "google_project_iam_member" "workload_admins" {
  for_each = {
    for pair in setproduct(var.workload_admin_principals, var.workload_admin_roles) :
    "${pair[0]}|${pair[1]}" => {
      principal = pair[0]
      role      = pair[1]
    }
  }

  project = google_project.llmind2.project_id
  role    = each.value.role
  member  = each.value.principal

  depends_on = [google_project_service.essential]
}
