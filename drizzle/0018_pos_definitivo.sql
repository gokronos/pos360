CREATE TABLE product_favorites (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  user_id text NOT NULL REFERENCES app_users(id),
  product_id text NOT NULL REFERENCES products(id),
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX product_favorites_user_product_uq ON product_favorites(user_id,product_id);
--> statement-breakpoint
CREATE TABLE pos_discount_authorizations (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  max_percent real NOT NULL CHECK(max_percent>0 AND max_percent<=100),
  authorized_by text NOT NULL REFERENCES app_users(id),
  used_by text REFERENCES app_users(id),
  sale_id text REFERENCES sales(id),
  reason text NOT NULL,
  expires_at text NOT NULL,
  used_at text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX pos_discount_authorizations_code_uq ON pos_discount_authorizations(tenant_id,code);
--> statement-breakpoint
CREATE INDEX pos_discount_authorizations_available_idx ON pos_discount_authorizations(tenant_id,code,expires_at,used_at);
--> statement-breakpoint
ALTER TABLE sale_discounts ADD authorization_id text REFERENCES pos_discount_authorizations(id);
--> statement-breakpoint
CREATE UNIQUE INDEX sale_discounts_authorization_once_uq ON sale_discounts(authorization_id) WHERE authorization_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX sale_payment_method_once_uq ON sale_payments(sale_id,method);
--> statement-breakpoint
CREATE UNIQUE INDEX sale_inventory_source_uq ON inventory_ledger(tenant_id,source_type,source_id,product_id,IFNULL(variant_id,''),movement_type) WHERE source_type='sale';
