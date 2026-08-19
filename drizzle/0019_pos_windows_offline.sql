CREATE TABLE desktop_terminal_credentials (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  branch_id text NOT NULL REFERENCES branches(id),
  terminal_id text NOT NULL REFERENCES terminals(id),
  user_id text NOT NULL REFERENCES app_users(id),
  token_hash text NOT NULL,
  status text DEFAULT 'active' NOT NULL,
  catalog_version integer DEFAULT 1 NOT NULL,
  last_sync_at text,
  created_by text NOT NULL REFERENCES app_users(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX desktop_terminal_credentials_terminal_uq ON desktop_terminal_credentials(terminal_id);
--> statement-breakpoint
CREATE UNIQUE INDEX desktop_terminal_credentials_token_uq ON desktop_terminal_credentials(token_hash);
--> statement-breakpoint
CREATE TABLE desktop_sync_operations (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  terminal_id text NOT NULL REFERENCES terminals(id),
  operation_id text NOT NULL,
  entity_type text NOT NULL,
  server_entity_id text,
  status text NOT NULL,
  payload text NOT NULL,
  response text,
  attempts integer DEFAULT 1 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX desktop_sync_operations_terminal_operation_uq ON desktop_sync_operations(terminal_id,operation_id);
--> statement-breakpoint
CREATE INDEX desktop_sync_operations_status_idx ON desktop_sync_operations(tenant_id,terminal_id,status,created_at);
