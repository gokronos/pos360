CREATE TABLE `business_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `nit` text NOT NULL DEFAULT '',
  `sector` text NOT NULL DEFAULT 'retail',
  `currency` text NOT NULL DEFAULT 'COP',
  `timezone` text NOT NULL DEFAULT 'America/Bogota',
  `allow_negative_stock` integer NOT NULL DEFAULT 0,
  `receipt_format` text NOT NULL DEFAULT 'thermal_80',
  `main_branch_id` text,
  `main_warehouse_id` text,
  `main_register_id` text,
  `onboarding_completed` integer NOT NULL DEFAULT 0,
  `completed_at` text,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`main_branch_id`) REFERENCES `branches`(`id`),
  FOREIGN KEY (`main_warehouse_id`) REFERENCES `warehouses`(`id`),
  FOREIGN KEY (`main_register_id`) REFERENCES `cash_registers`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_settings_tenant_uq` ON `business_settings` (`tenant_id`);
--> statement-breakpoint
CREATE TABLE `tax_rates` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `name` text NOT NULL,
  `rate` real NOT NULL DEFAULT 0,
  `included_in_price` integer NOT NULL DEFAULT 1,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_rates_tenant_name_uq` ON `tax_rates` (`tenant_id`,`name`);
--> statement-breakpoint
INSERT INTO `business_settings` (`id`,`tenant_id`,`onboarding_completed`,`completed_at`)
SELECT 'settings_' || id,id,1,CURRENT_TIMESTAMP FROM `tenants`;
