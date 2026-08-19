CREATE TABLE `inventory_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`warehouse_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`quantity` real DEFAULT 0 NOT NULL,
	`average_cost_minor` integer DEFAULT 0 NOT NULL,
	`minimum_stock` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_balance_scope_uq` ON `inventory_balances` (`warehouse_id`,`product_id`,IFNULL(`variant_id`,''));
--> statement-breakpoint
CREATE INDEX `inventory_balance_tenant_idx` ON `inventory_balances` (`tenant_id`,`warehouse_id`);
--> statement-breakpoint
CREATE TABLE `inventory_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`warehouse_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`user_id` text NOT NULL,
	`movement_type` text NOT NULL,
	`quantity` real NOT NULL,
	`previous_balance` real NOT NULL,
	`balance_after` real NOT NULL,
	`unit_cost_minor` integer DEFAULT 0 NOT NULL,
	`average_cost_minor` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL CHECK (length(trim(`reason`)) > 0),
	`reference` text,
	`source_type` text,
	`source_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
	FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`),
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `inventory_ledger_lookup_idx` ON `inventory_ledger` (`tenant_id`,`warehouse_id`,`product_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER `inventory_ledger_no_update` BEFORE UPDATE ON `inventory_ledger` BEGIN SELECT RAISE(ABORT, 'El kardex es inmutable'); END;
--> statement-breakpoint
CREATE TRIGGER `inventory_ledger_no_delete` BEFORE DELETE ON `inventory_ledger` BEGIN SELECT RAISE(ABORT, 'El kardex es inmutable'); END;
--> statement-breakpoint
INSERT INTO inventory_balances (id,tenant_id,warehouse_id,product_id,quantity,average_cost_minor)
SELECT lower(hex(randomblob(16))),s.tenant_id,s.warehouse_id,s.product_id,s.quantity,p.cost_minor
FROM warehouse_stock s JOIN products p ON p.id=s.product_id;
--> statement-breakpoint
INSERT INTO inventory_balances (id,tenant_id,warehouse_id,product_id,quantity,average_cost_minor)
SELECT lower(hex(randomblob(16))),p.tenant_id,w.id,p.id,p.stock,p.cost_minor
FROM products p JOIN warehouses w ON w.id=(SELECT w2.id FROM warehouses w2 WHERE w2.tenant_id=p.tenant_id ORDER BY w2.created_at LIMIT 1)
WHERE p.track_inventory=1 AND p.stock<>0 AND NOT EXISTS(SELECT 1 FROM inventory_balances b WHERE b.product_id=p.id);
--> statement-breakpoint
ALTER TABLE `sales` ADD `warehouse_id` text REFERENCES warehouses(id);
--> statement-breakpoint
ALTER TABLE `stock_transfer_lines` ADD `unit_cost_minor` integer DEFAULT 0 NOT NULL;
