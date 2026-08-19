CREATE TABLE sector_features (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  feature_key text NOT NULL,
  enabled integer DEFAULT 1 NOT NULL,
  config text DEFAULT '{}' NOT NULL,
  updated_by text NOT NULL REFERENCES app_users(id),
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX sector_features_tenant_key_uq ON sector_features(tenant_id,feature_key);
--> statement-breakpoint
CREATE TABLE pharmacy_product_settings (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  product_id text NOT NULL REFERENCES products(id),
  units_per_package real DEFAULT 1 NOT NULL CHECK(units_per_package >= 1),
  fraction_unit text DEFAULT 'unidad' NOT NULL,
  fraction_price_minor integer DEFAULT 0 NOT NULL CHECK(fraction_price_minor >= 0),
  fractionation_enabled integer DEFAULT 0 NOT NULL,
  requires_lot integer DEFAULT 1 NOT NULL,
  updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX pharmacy_product_settings_product_uq ON pharmacy_product_settings(tenant_id,product_id);
--> statement-breakpoint
CREATE TABLE sale_lot_allocations (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  sale_id text NOT NULL REFERENCES sales(id),
  sale_line_id text NOT NULL REFERENCES sale_lines(id),
  lot_id text NOT NULL REFERENCES product_lots(id),
  quantity real NOT NULL CHECK(quantity > 0),
  strategy text DEFAULT 'FEFO' NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX sale_lot_allocations_sale_idx ON sale_lot_allocations(tenant_id,sale_id);
--> statement-breakpoint
CREATE TABLE hardware_dispatches (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  branch_id text NOT NULL REFERENCES branches(id),
  draft_id text NOT NULL REFERENCES pos_drafts(id),
  number text NOT NULL,
  status text DEFAULT 'completed' NOT NULL,
  notes text,
  dispatched_by text NOT NULL REFERENCES app_users(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX hardware_dispatch_number_uq ON hardware_dispatches(tenant_id,number);
--> statement-breakpoint
CREATE TABLE hardware_dispatch_lines (
  id text PRIMARY KEY NOT NULL,
  dispatch_id text NOT NULL REFERENCES hardware_dispatches(id),
  product_id text NOT NULL REFERENCES products(id),
  quantity real NOT NULL CHECK(quantity > 0)
);
--> statement-breakpoint
CREATE TABLE scale_codes (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  product_id text NOT NULL REFERENCES products(id),
  prefix text DEFAULT '20' NOT NULL,
  plu text NOT NULL,
  mode text DEFAULT 'weight' NOT NULL CHECK(mode IN ('weight','price')),
  decimals integer DEFAULT 3 NOT NULL CHECK(decimals BETWEEN 0 AND 4),
  active integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX scale_codes_tenant_code_uq ON scale_codes(tenant_id,prefix,plu);
--> statement-breakpoint
CREATE TABLE sector_promotions (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  product_id text NOT NULL REFERENCES products(id),
  type text NOT NULL CHECK(type IN ('percent','fixed_price')),
  value_minor integer NOT NULL CHECK(value_minor >= 0),
  minimum_quantity real DEFAULT 1 NOT NULL,
  starts_at text NOT NULL,
  ends_at text NOT NULL,
  active integer DEFAULT 1 NOT NULL,
  created_by text NOT NULL REFERENCES app_users(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX sector_promotions_active_idx ON sector_promotions(tenant_id,product_id,active,starts_at,ends_at);
--> statement-breakpoint
CREATE TABLE sector_combos (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  product_id text NOT NULL REFERENCES products(id),
  name text NOT NULL,
  active integer DEFAULT 1 NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX sector_combos_product_uq ON sector_combos(tenant_id,product_id);
--> statement-breakpoint
CREATE TABLE sector_combo_items (
  id text PRIMARY KEY NOT NULL,
  combo_id text NOT NULL REFERENCES sector_combos(id),
  product_id text NOT NULL REFERENCES products(id),
  quantity real NOT NULL CHECK(quantity > 0)
);
--> statement-breakpoint
INSERT INTO sector_features(id,tenant_id,feature_key,enabled,config,updated_by)
SELECT lower(hex(randomblob(16))),s.tenant_id,
  CASE s.sector WHEN 'pharmacy' THEN 'pharmacy' WHEN 'hardware' THEN 'hardware' WHEN 'retail' THEN 'supermarket' ELSE 'quick_store' END,
  1,'{}',u.id
FROM business_settings s JOIN app_users u ON u.tenant_id=s.tenant_id
WHERE u.id=(SELECT x.id FROM app_users x WHERE x.tenant_id=s.tenant_id ORDER BY CASE WHEN x.role='owner' THEN 0 ELSE 1 END,x.created_at LIMIT 1)
ON CONFLICT(tenant_id,feature_key) DO NOTHING;
