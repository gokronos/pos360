CREATE TABLE `terminals` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `branch_id` text NOT NULL,
  `register_id` text,
  `name` text NOT NULL,
  `code` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `last_seen_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`),
  FOREIGN KEY (`register_id`) REFERENCES `cash_registers`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terminals_tenant_code_uq` ON `terminals` (`tenant_id`,`code`);
