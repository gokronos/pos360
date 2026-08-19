CREATE TABLE `catalog_categories` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `parent_id` text,
  `name` text NOT NULL,
  `description` text,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `catalog_categories`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_category_tenant_parent_name_uq` ON `catalog_categories` (`tenant_id`,`parent_id`,`name`);
--> statement-breakpoint
CREATE TABLE `brands` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_tenant_name_uq` ON `brands` (`tenant_id`,`name`);
--> statement-breakpoint
CREATE TABLE `measurement_units` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `name` text NOT NULL,
  `symbol` text NOT NULL,
  `precision` integer NOT NULL DEFAULT 0,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `measurement_units_tenant_symbol_uq` ON `measurement_units` (`tenant_id`,`symbol`);
--> statement-breakpoint
CREATE TABLE `product_barcodes` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `product_id` text NOT NULL,
  `variant_id` text,
  `code` text NOT NULL,
  `kind` text NOT NULL DEFAULT 'EAN13',
  `is_primary` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_barcodes_tenant_code_uq` ON `product_barcodes` (`tenant_id`,`code`);
--> statement-breakpoint
CREATE TABLE `product_variants` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `product_id` text NOT NULL,
  `name` text NOT NULL,
  `sku` text NOT NULL,
  `attributes` text NOT NULL DEFAULT '{}',
  `price_minor` integer NOT NULL DEFAULT 0,
  `cost_minor` integer NOT NULL DEFAULT 0,
  `stock` real NOT NULL DEFAULT 0,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_tenant_sku_uq` ON `product_variants` (`tenant_id`,`sku`);
--> statement-breakpoint
CREATE TABLE `price_lists` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `name` text NOT NULL,
  `currency` text NOT NULL,
  `is_default` integer NOT NULL DEFAULT 0,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_lists_tenant_name_uq` ON `price_lists` (`tenant_id`,`name`);
--> statement-breakpoint
CREATE TABLE `product_prices` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `price_list_id` text NOT NULL,
  `product_id` text NOT NULL,
  `variant_id` text,
  `price_minor` integer NOT NULL,
  `min_quantity` real NOT NULL DEFAULT 1,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_prices_scope_uq` ON `product_prices` (`price_list_id`,`product_id`,`variant_id`,`min_quantity`);
--> statement-breakpoint
CREATE TABLE `catalog_images` (
  `id` text PRIMARY KEY NOT NULL,
  `tenant_id` text NOT NULL,
  `product_id` text NOT NULL,
  `variant_id` text,
  `url` text NOT NULL,
  `alt_text` text,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `product_type` text NOT NULL DEFAULT 'product';
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `category_id` text;
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `subcategory_id` text;
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `brand_id` text;
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `unit_id` text;
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `tax_id` text;
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `track_inventory` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `special_fields` text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `price_minor` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `products` ADD COLUMN `cost_minor` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `products` SET `price_minor`=CAST(ROUND(`price`*100) AS INTEGER),`cost_minor`=CAST(ROUND(`cost`*100) AS INTEGER);
--> statement-breakpoint
ALTER TABLE `product_presentations` ADD COLUMN `unit_id` text;
--> statement-breakpoint
ALTER TABLE `product_presentations` ADD COLUMN `sale_price_minor` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `product_presentations` SET `sale_price_minor`=CAST(ROUND(`sale_price`*100) AS INTEGER);
--> statement-breakpoint
ALTER TABLE `sales` ADD COLUMN `subtotal_minor` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `sales` ADD COLUMN `discount_minor` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `sales` ADD COLUMN `total_minor` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `sales` SET `subtotal_minor`=CAST(ROUND(`total`*100) AS INTEGER),`total_minor`=CAST(ROUND(`total`*100) AS INTEGER);
--> statement-breakpoint
ALTER TABLE `sale_lines` ADD COLUMN `unit_price_minor` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `sale_lines` ADD COLUMN `line_total_minor` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `sale_lines` SET `unit_price_minor`=CAST(ROUND(`unit_price`*100) AS INTEGER),`line_total_minor`=CAST(ROUND(`line_total`*100) AS INTEGER);
--> statement-breakpoint
ALTER TABLE `sale_payments` ADD COLUMN `amount_minor` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE `sale_payments` SET `amount_minor`=CAST(ROUND(`amount`*100) AS INTEGER);
--> statement-breakpoint
INSERT INTO `measurement_units` (`id`,`tenant_id`,`name`,`symbol`,`precision`)
SELECT 'unit_' || id,id,'Unidad','und',0 FROM `tenants`;
--> statement-breakpoint
INSERT INTO `price_lists` (`id`,`tenant_id`,`name`,`currency`,`is_default`)
SELECT 'prices_' || t.id,t.id,'Precio general',COALESCE(s.currency,'COP'),1 FROM `tenants` t LEFT JOIN `business_settings` s ON s.tenant_id=t.id;
