CREATE TABLE mobile_devices (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  branch_id text NOT NULL REFERENCES branches(id),
  user_id text NOT NULL REFERENCES app_users(id),
  name text NOT NULL,
  platform text DEFAULT 'android' NOT NULL,
  device_identifier text NOT NULL,
  token_hash text NOT NULL,
  app_version text,
  status text DEFAULT 'active' NOT NULL CHECK(status IN ('active','blocked','revoked')),
  permissions text DEFAULT '["inventory:view","purchases:receive","orders:create","alerts:view"]' NOT NULL,
  last_seen_at text,
  last_sync_at text,
  created_by text NOT NULL REFERENCES app_users(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX mobile_devices_identifier_uq ON mobile_devices(tenant_id,device_identifier);
--> statement-breakpoint
CREATE UNIQUE INDEX mobile_devices_token_uq ON mobile_devices(token_hash);
--> statement-breakpoint
CREATE TABLE mobile_operations (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  device_id text NOT NULL REFERENCES mobile_devices(id),
  operation_id text NOT NULL,
  operation_type text NOT NULL,
  payload text NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK(status IN ('pending','applied','rejected','conflict')),
  result text,
  attempts integer DEFAULT 1 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  applied_at text
);
--> statement-breakpoint
CREATE UNIQUE INDEX mobile_operations_device_operation_uq ON mobile_operations(device_id,operation_id);
--> statement-breakpoint
CREATE TABLE mobile_orders (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  branch_id text NOT NULL REFERENCES branches(id),
  device_id text NOT NULL REFERENCES mobile_devices(id),
  user_id text NOT NULL REFERENCES app_users(id),
  customer_id text REFERENCES customers(id),
  number text NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK(status IN ('pending','confirmed','preparing','dispatched','completed','cancelled')),
  notes text,
  total_minor integer DEFAULT 0 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX mobile_orders_number_uq ON mobile_orders(tenant_id,number);
--> statement-breakpoint
CREATE TABLE mobile_order_lines (
  id text PRIMARY KEY NOT NULL,
  order_id text NOT NULL REFERENCES mobile_orders(id),
  product_id text NOT NULL REFERENCES products(id),
  quantity real NOT NULL CHECK(quantity > 0),
  unit_price_minor integer NOT NULL CHECK(unit_price_minor >= 0),
  line_total_minor integer NOT NULL CHECK(line_total_minor >= 0)
);
--> statement-breakpoint
CREATE TABLE mobile_alerts (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  branch_id text REFERENCES branches(id),
  alert_type text NOT NULL,
  severity text DEFAULT 'info' NOT NULL CHECK(severity IN ('info','warning','critical')),
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id text,
  status text DEFAULT 'open' NOT NULL CHECK(status IN ('open','acknowledged','resolved')),
  acknowledged_by text REFERENCES app_users(id),
  acknowledged_at text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX mobile_alerts_open_idx ON mobile_alerts(tenant_id,branch_id,status,created_at);
--> statement-breakpoint
CREATE TABLE tenant_backups (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  backup_type text DEFAULT 'logical' NOT NULL CHECK(backup_type IN ('logical','pre_restore')),
  status text DEFAULT 'completed' NOT NULL CHECK(status IN ('running','completed','failed','restored')),
  schema_version text NOT NULL,
  payload text NOT NULL,
  checksum_sha256 text NOT NULL,
  size_bytes integer NOT NULL,
  created_by text NOT NULL REFERENCES app_users(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  restored_at text
);
--> statement-breakpoint
CREATE INDEX tenant_backups_tenant_created_idx ON tenant_backups(tenant_id,created_at);
--> statement-breakpoint
CREATE TABLE commercial_pilots (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  contact_name text NOT NULL,
  contact_phone text,
  status text DEFAULT 'planned' NOT NULL CHECK(status IN ('planned','active','paused','completed','cancelled')),
  starts_at text NOT NULL,
  ends_at text,
  success_criteria text NOT NULL,
  observations text,
  created_by text NOT NULL REFERENCES app_users(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE training_sessions (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  pilot_id text REFERENCES commercial_pilots(id),
  title text NOT NULL,
  audience text NOT NULL,
  scheduled_at text NOT NULL,
  status text DEFAULT 'scheduled' NOT NULL CHECK(status IN ('scheduled','completed','cancelled')),
  attendance text DEFAULT '[]' NOT NULL,
  materials text DEFAULT '[]' NOT NULL,
  notes text,
  created_by text NOT NULL REFERENCES app_users(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE mobile_telemetry (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  device_id text NOT NULL REFERENCES mobile_devices(id),
  event_type text NOT NULL,
  level text DEFAULT 'info' NOT NULL CHECK(level IN ('info','warning','error')),
  payload text DEFAULT '{}' NOT NULL,
  app_version text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX mobile_telemetry_device_created_idx ON mobile_telemetry(tenant_id,device_id,created_at);
