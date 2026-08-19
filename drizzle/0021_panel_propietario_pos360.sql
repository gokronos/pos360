CREATE TABLE platform_admins (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL,
  role text DEFAULT 'platform_owner' NOT NULL CHECK(role IN ('platform_owner','platform_support','platform_auditor')),
  active integer DEFAULT 1 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX platform_admins_email_uq ON platform_admins(email);
--> statement-breakpoint
CREATE TABLE saas_plans (
  id text PRIMARY KEY NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  price_minor integer DEFAULT 0 NOT NULL CHECK(price_minor >= 0),
  billing_period text DEFAULT 'monthly' NOT NULL CHECK(billing_period IN ('monthly','yearly')),
  max_branches integer DEFAULT 1 NOT NULL CHECK(max_branches > 0),
  max_users integer DEFAULT 2 NOT NULL CHECK(max_users > 0),
  max_terminals integer DEFAULT 1 NOT NULL CHECK(max_terminals > 0),
  max_products integer DEFAULT 500 NOT NULL CHECK(max_products > 0),
  offline_enabled integer DEFAULT 0 NOT NULL,
  active integer DEFAULT 1 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX saas_plans_code_uq ON saas_plans(code);
--> statement-breakpoint
CREATE TABLE tenant_subscriptions (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  plan_id text NOT NULL REFERENCES saas_plans(id),
  status text DEFAULT 'trial' NOT NULL CHECK(status IN ('trial','active','past_due','suspended','cancelled')),
  trial_ends_at text,
  current_period_start text,
  current_period_end text,
  cancel_at_period_end integer DEFAULT 0 NOT NULL,
  limit_overrides text DEFAULT '{}' NOT NULL,
  suspended_reason text,
  suspended_at text,
  updated_by text REFERENCES platform_admins(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX tenant_subscriptions_tenant_uq ON tenant_subscriptions(tenant_id);
--> statement-breakpoint
CREATE TABLE platform_support_tickets (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  number text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  priority text DEFAULT 'normal' NOT NULL CHECK(priority IN ('low','normal','high','critical')),
  status text DEFAULT 'open' NOT NULL CHECK(status IN ('open','in_progress','waiting_customer','resolved','closed')),
  assigned_to text REFERENCES platform_admins(id),
  created_by_email text NOT NULL,
  resolution text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  resolved_at text
);
--> statement-breakpoint
CREATE UNIQUE INDEX platform_support_ticket_number_uq ON platform_support_tickets(number);
--> statement-breakpoint
CREATE TABLE platform_access_grants (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  platform_admin_id text NOT NULL REFERENCES platform_admins(id),
  reason text NOT NULL,
  ticket_id text REFERENCES platform_support_tickets(id),
  status text DEFAULT 'active' NOT NULL CHECK(status IN ('active','revoked','expired')),
  expires_at text NOT NULL,
  revoked_at text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX platform_access_grants_active_idx ON platform_access_grants(platform_admin_id,tenant_id,status,expires_at);
--> statement-breakpoint
CREATE TABLE platform_audit_logs (
  id text PRIMARY KEY NOT NULL,
  platform_admin_id text NOT NULL REFERENCES platform_admins(id),
  tenant_id text REFERENCES tenants(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  reason text NOT NULL,
  metadata text DEFAULT '{}' NOT NULL,
  ip_address text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX platform_audit_logs_created_idx ON platform_audit_logs(created_at);
--> statement-breakpoint
INSERT INTO platform_admins(id,email,display_name,role) VALUES('platform_preview_owner','preview@pos360.local','Propietario POS360','platform_owner');
--> statement-breakpoint
INSERT INTO saas_plans(id,code,name,price_minor,max_branches,max_users,max_terminals,max_products,offline_enabled) VALUES
 ('plan_trial','trial','Prueba',0,1,2,1,500,0),
 ('plan_business','business','Negocio',6900000,2,8,3,5000,1),
 ('plan_professional','professional','Profesional',12900000,5,25,10,25000,1),
 ('plan_chain','chain','Cadena',24900000,25,100,50,100000,1);
--> statement-breakpoint
INSERT INTO tenant_subscriptions(id,tenant_id,plan_id,status,trial_ends_at,current_period_start,current_period_end,updated_by)
SELECT lower(hex(randomblob(16))),t.id,'plan_trial','trial',datetime('now','+14 days'),date('now'),date('now','+14 days'),'platform_preview_owner'
FROM tenants t WHERE 1 ON CONFLICT(tenant_id) DO NOTHING;
