CREATE TABLE electronic_billing_providers (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  provider_type text DEFAULT 'technology_provider' NOT NULL CHECK(provider_type IN ('technology_provider','direct_dian','sandbox')),
  environment text DEFAULT 'habilitation' NOT NULL CHECK(environment IN ('habilitation','production')),
  endpoint text,
  credential_reference text,
  software_id text,
  test_set_id text,
  active integer DEFAULT 1 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX electronic_billing_provider_active_uq ON electronic_billing_providers(tenant_id,active) WHERE active=1;
--> statement-breakpoint
CREATE TABLE electronic_resolutions (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  branch_id text REFERENCES branches(id),
  document_type text NOT NULL CHECK(document_type IN ('invoice','equivalent','contingency')),
  authorization_number text NOT NULL,
  prefix text NOT NULL,
  range_from integer NOT NULL,
  range_to integer NOT NULL,
  next_number integer NOT NULL,
  valid_from text NOT NULL,
  valid_until text NOT NULL,
  technical_key_reference text,
  active integer DEFAULT 1 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CHECK(range_from > 0 AND range_to >= range_from AND next_number >= range_from AND next_number <= range_to + 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX electronic_resolution_prefix_uq ON electronic_resolutions(tenant_id,prefix,document_type);
--> statement-breakpoint
CREATE TABLE electronic_documents (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  branch_id text NOT NULL REFERENCES branches(id),
  sale_id text REFERENCES sales(id),
  parent_document_id text REFERENCES electronic_documents(id),
  resolution_id text REFERENCES electronic_resolutions(id),
  provider_id text REFERENCES electronic_billing_providers(id),
  document_type text NOT NULL CHECK(document_type IN ('invoice','equivalent','credit_note','debit_note')),
  number text NOT NULL,
  issue_date text NOT NULL,
  status text DEFAULT 'draft' NOT NULL CHECK(status IN ('draft','queued','sending','accepted','accepted_with_warnings','rejected','contingency','cancelled')),
  contingency_type text,
  currency text DEFAULT 'COP' NOT NULL,
  subtotal_minor integer DEFAULT 0 NOT NULL,
  tax_minor integer DEFAULT 0 NOT NULL,
  total_minor integer DEFAULT 0 NOT NULL,
  customer_snapshot text DEFAULT '{}' NOT NULL,
  issuer_snapshot text DEFAULT '{}' NOT NULL,
  lines_snapshot text DEFAULT '[]' NOT NULL,
  cufe text,
  qr_data text,
  provider_track_id text,
  provider_status_code text,
  provider_message text,
  retry_count integer DEFAULT 0 NOT NULL,
  next_retry_at text,
  idempotency_key text NOT NULL,
  created_by text NOT NULL REFERENCES app_users(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX electronic_documents_tenant_number_uq ON electronic_documents(tenant_id,number);
--> statement-breakpoint
CREATE UNIQUE INDEX electronic_documents_idempotency_uq ON electronic_documents(tenant_id,idempotency_key);
--> statement-breakpoint
CREATE UNIQUE INDEX electronic_documents_sale_type_uq ON electronic_documents(tenant_id,sale_id,document_type) WHERE sale_id IS NOT NULL AND document_type IN ('invoice','equivalent');
--> statement-breakpoint
CREATE TABLE electronic_document_attempts (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  document_id text NOT NULL REFERENCES electronic_documents(id),
  attempt_number integer NOT NULL,
  request_payload text NOT NULL,
  response_payload text,
  http_status integer,
  result text NOT NULL CHECK(result IN ('pending','accepted','rejected','temporary_error','permanent_error')),
  error_code text,
  error_message text,
  started_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  completed_at text
);
--> statement-breakpoint
CREATE UNIQUE INDEX electronic_attempt_number_uq ON electronic_document_attempts(document_id,attempt_number);
--> statement-breakpoint
CREATE TABLE electronic_document_events (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  document_id text NOT NULL REFERENCES electronic_documents(id),
  user_id text REFERENCES app_users(id),
  event_type text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  details text DEFAULT '{}' NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX electronic_document_events_document_idx ON electronic_document_events(document_id,created_at);
--> statement-breakpoint
CREATE TABLE electronic_document_files (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  document_id text NOT NULL REFERENCES electronic_documents(id),
  file_type text NOT NULL CHECK(file_type IN ('ubl_xml','attached_document','application_response','graphic_html','graphic_pdf','provider_response')),
  storage_key text NOT NULL,
  content_type text NOT NULL,
  content_base64 text,
  checksum_sha256 text NOT NULL,
  size_bytes integer DEFAULT 0 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX electronic_document_file_type_uq ON electronic_document_files(document_id,file_type);
--> statement-breakpoint
CREATE TABLE electronic_contingencies (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  branch_id text REFERENCES branches(id),
  contingency_type text NOT NULL,
  reason text NOT NULL,
  evidence text DEFAULT '[]' NOT NULL,
  status text DEFAULT 'open' NOT NULL CHECK(status IN ('open','recovering','closed')),
  opened_by text NOT NULL REFERENCES app_users(id),
  opened_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  closed_at text
);
--> statement-breakpoint
CREATE UNIQUE INDEX electronic_contingency_open_uq ON electronic_contingencies(tenant_id,branch_id,status) WHERE status='open';
