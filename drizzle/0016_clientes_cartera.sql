ALTER TABLE customers ADD commercial_name text;
--> statement-breakpoint
ALTER TABLE customers ADD price_list_id text REFERENCES price_lists(id);
--> statement-breakpoint
ALTER TABLE customers ADD credit_limit_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE customers ADD blocked integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE customers ADD block_reason text;
--> statement-breakpoint
ALTER TABLE customers ADD blocked_by text REFERENCES app_users(id);
--> statement-breakpoint
ALTER TABLE customers ADD blocked_at text;
--> statement-breakpoint
ALTER TABLE customers ADD consent_email integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE customers ADD consent_sms integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE customers ADD consent_whatsapp integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE customers ADD consent_at text;
--> statement-breakpoint
ALTER TABLE customers ADD consent_source text;
--> statement-breakpoint
ALTER TABLE customers ADD notes text;
--> statement-breakpoint
ALTER TABLE customers ADD updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL;
--> statement-breakpoint
ALTER TABLE receivables ADD original_amount_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE receivables ADD balance_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE receivables ADD branch_id text REFERENCES branches(id);
--> statement-breakpoint
ALTER TABLE customer_payments ADD amount_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE customer_addresses (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  customer_id text NOT NULL REFERENCES customers(id),
  label text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text,
  postal_code text,
  country text DEFAULT 'CO' NOT NULL,
  is_default integer DEFAULT 0 NOT NULL,
  active integer DEFAULT 1 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX customer_addresses_customer_idx ON customer_addresses(tenant_id,customer_id);
--> statement-breakpoint
CREATE TABLE credit_authorizations (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  customer_id text NOT NULL REFERENCES customers(id),
  requested_by text NOT NULL REFERENCES app_users(id),
  authorized_by text NOT NULL REFERENCES app_users(id),
  amount_minor integer NOT NULL CHECK(amount_minor>0),
  reason text NOT NULL,
  expires_at text NOT NULL,
  used_at text,
  sale_id text REFERENCES sales(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX credit_authorizations_available_idx ON credit_authorizations(tenant_id,customer_id,expires_at,used_at);
--> statement-breakpoint
CREATE TABLE customer_events (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  customer_id text NOT NULL REFERENCES customers(id),
  user_id text NOT NULL REFERENCES app_users(id),
  action text NOT NULL,
  amount_minor integer DEFAULT 0 NOT NULL,
  reason text NOT NULL,
  reference text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX customer_events_customer_idx ON customer_events(tenant_id,customer_id,created_at);
--> statement-breakpoint
UPDATE customers SET credit_limit_minor=CAST(ROUND(credit_limit*100) AS INTEGER);
--> statement-breakpoint
UPDATE receivables SET original_amount_minor=CAST(ROUND(original_amount*100) AS INTEGER),balance_minor=CAST(ROUND(balance*100) AS INTEGER);
--> statement-breakpoint
UPDATE customer_payments SET amount_minor=CAST(ROUND(amount*100) AS INTEGER);
--> statement-breakpoint
CREATE TRIGGER receivable_balance_guard BEFORE UPDATE OF balance_minor ON receivables WHEN NEW.balance_minor<0 OR NEW.balance_minor>NEW.original_amount_minor BEGIN SELECT RAISE(ABORT,'Saldo de cartera inválido'); END;
--> statement-breakpoint
CREATE TABLE customer_credits (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  customer_id text NOT NULL REFERENCES customers(id),
  sale_id text NOT NULL REFERENCES sales(id),
  amount_minor integer NOT NULL CHECK(amount_minor>0),
  balance_minor integer NOT NULL CHECK(balance_minor>=0),
  reason text NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
