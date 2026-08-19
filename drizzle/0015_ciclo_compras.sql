ALTER TABLE purchase_orders ADD approved_by text REFERENCES app_users(id);
--> statement-breakpoint
ALTER TABLE purchase_orders ADD approved_at text;
--> statement-breakpoint
ALTER TABLE purchase_orders ADD warehouse_id text REFERENCES warehouses(id);
--> statement-breakpoint
ALTER TABLE purchase_orders ADD total_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE purchase_order_lines ADD unit_cost_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE purchase_order_lines ADD line_total_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE purchase_order_lines ADD returned_quantity real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE purchase_receipts ADD warehouse_id text REFERENCES warehouses(id);
--> statement-breakpoint
ALTER TABLE purchase_receipts ADD total_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE payables ADD original_amount_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE payables ADD balance_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX payables_order_uq ON payables(order_id);
--> statement-breakpoint
ALTER TABLE supplier_payments ADD amount_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE purchase_returns ADD warehouse_id text REFERENCES warehouses(id);
--> statement-breakpoint
ALTER TABLE purchase_returns ADD total_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE purchase_return_lines ADD order_line_id text REFERENCES purchase_order_lines(id);
--> statement-breakpoint
ALTER TABLE purchase_return_lines ADD unit_cost_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE purchase_return_lines ADD line_total_minor integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE purchase_events (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  order_id text NOT NULL REFERENCES purchase_orders(id),
  user_id text NOT NULL REFERENCES app_users(id),
  action text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text NOT NULL,
  reference text,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX purchase_events_order_idx ON purchase_events(tenant_id,order_id,created_at);
--> statement-breakpoint
CREATE TABLE supplier_credits (
  id text PRIMARY KEY NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id),
  supplier_id text NOT NULL REFERENCES suppliers(id),
  return_id text NOT NULL REFERENCES purchase_returns(id),
  amount_minor integer NOT NULL CHECK(amount_minor>0),
  balance_minor integer NOT NULL CHECK(balance_minor>=0),
  reason text NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
UPDATE purchase_orders SET total_minor=CAST(ROUND(total*100) AS INTEGER),status=CASE WHEN status='ordered' THEN 'approved' ELSE status END;
--> statement-breakpoint
UPDATE purchase_order_lines SET unit_cost_minor=CAST(ROUND(unit_cost*100) AS INTEGER),line_total_minor=CAST(ROUND(line_total*100) AS INTEGER);
--> statement-breakpoint
UPDATE purchase_receipts SET total_minor=CAST(ROUND(total*100) AS INTEGER);
--> statement-breakpoint
UPDATE payables SET original_amount_minor=CAST(ROUND(original_amount*100) AS INTEGER),balance_minor=CAST(ROUND(balance*100) AS INTEGER);
--> statement-breakpoint
UPDATE supplier_payments SET amount_minor=CAST(ROUND(amount*100) AS INTEGER);
--> statement-breakpoint
UPDATE purchase_returns SET total_minor=CAST(ROUND(total*100) AS INTEGER);
--> statement-breakpoint
UPDATE purchase_return_lines SET unit_cost_minor=CAST(ROUND(unit_cost*100) AS INTEGER),line_total_minor=CAST(ROUND(line_total*100) AS INTEGER);
--> statement-breakpoint
CREATE TRIGGER purchase_received_quantity_guard BEFORE UPDATE OF received_quantity ON purchase_order_lines WHEN NEW.received_quantity<0 OR NEW.received_quantity>NEW.quantity BEGIN SELECT RAISE(ABORT,'La recepción supera la cantidad pendiente'); END;
--> statement-breakpoint
CREATE TRIGGER purchase_returned_quantity_guard BEFORE UPDATE OF returned_quantity ON purchase_order_lines WHEN NEW.returned_quantity<0 OR NEW.returned_quantity>NEW.received_quantity BEGIN SELECT RAISE(ABORT,'La devolución supera la cantidad recibida'); END;
