import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull().default("CO"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const branches = sqliteTable("branches", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  name: text("name").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const appUsers = sqliteTable(
  "app_users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull().default("admin"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("users_tenant_email_uq").on(t.tenantId, t.email)],
);
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    name: text("name").notNull(),
    category: text("category").notNull(),
    price: real("price").notNull(),
    cost: real("cost").notNull(),
    productType: text("product_type").notNull().default("product"),
    categoryId: text("category_id"),
    subcategoryId: text("subcategory_id"),
    brandId: text("brand_id"),
    unitId: text("unit_id"),
    taxId: text("tax_id"),
    trackInventory: integer("track_inventory", { mode: "boolean" })
      .notNull()
      .default(true),
    specialFields: text("special_fields").notNull().default("{}"),
    priceMinor: integer("price_minor").notNull().default(0),
    costMinor: integer("cost_minor").notNull().default(0),
    stock: real("stock").notNull().default(0),
    version: integer("version").notNull().default(1),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("products_tenant_sku_uq").on(t.tenantId, t.sku)],
);
export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    documentType: text("document_type").notNull().default("CC"),
    documentNumber: text("document_number").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    creditLimit: real("credit_limit").notNull().default(0),
    creditDays: integer("credit_days").notNull().default(0),
    commercialName: text("commercial_name"),
    priceListId: text("price_list_id"),
    creditLimitMinor: integer("credit_limit_minor").notNull().default(0),
    blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
    blockReason: text("block_reason"),
    consentEmail: integer("consent_email", { mode: "boolean" }).notNull().default(false),
    consentSms: integer("consent_sms", { mode: "boolean" }).notNull().default(false),
    consentWhatsapp: integer("consent_whatsapp", { mode: "boolean" }).notNull().default(false),
    notes: text("notes"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("customers_tenant_document_uq").on(
      t.tenantId,
      t.documentNumber,
    ),
  ],
);
export const sales = sqliteTable(
  "sales",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id),
    customerId: text("customer_id").references(() => customers.id),
    localId: text("local_id").notNull(),
    total: real("total").notNull(),
    subtotalMinor: integer("subtotal_minor").notNull().default(0),
    discountMinor: integer("discount_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),
    status: text("status").notNull().default("completed"),
    syncStatus: text("sync_status").notNull().default("synced"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("sales_tenant_local_uq").on(t.tenantId, t.localId)],
);
export const saleLines = sqliteTable("sale_lines", {
  id: text("id").primaryKey(),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  variantId: text("variant_id"),
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  lineTotal: real("line_total").notNull(),
  unitPriceMinor: integer("unit_price_minor").notNull().default(0),
  lineTotalMinor: integer("line_total_minor").notNull().default(0),
});
export const syncEvents = sqliteTable("sync_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  nodeId: text("node_id").notNull(),
  eventType: text("event_type").notNull(),
  entityId: text("entity_id").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("applied"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const inventoryMovements = sqliteTable("inventory_movements", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  branchId: text("branch_id")
    .notNull()
    .references(() => branches.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  movementType: text("movement_type").notNull(),
  quantity: real("quantity").notNull(),
  balanceAfter: real("balance_after").notNull(),
  reason: text("reason").notNull(),
  reference: text("reference"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const inventoryBalances = sqliteTable("inventory_balances", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), warehouseId: text("warehouse_id").notNull(), productId: text("product_id").notNull(), variantId: text("variant_id"), quantity: real("quantity").notNull().default(0), averageCostMinor: integer("average_cost_minor").notNull().default(0), minimumStock: real("minimum_stock").notNull().default(0), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const inventoryLedger = sqliteTable("inventory_ledger", {
  id: text("id").primaryKey(), tenantId: text("tenant_id").notNull(), branchId: text("branch_id").notNull(), warehouseId: text("warehouse_id").notNull(), productId: text("product_id").notNull(), variantId: text("variant_id"), userId: text("user_id").notNull(), movementType: text("movement_type").notNull(), quantity: real("quantity").notNull(), previousBalance: real("previous_balance").notNull(), balanceAfter: real("balance_after").notNull(), unitCostMinor: integer("unit_cost_minor").notNull().default(0), averageCostMinor: integer("average_cost_minor").notNull().default(0), reason: text("reason").notNull(), reference: text("reference"), sourceType: text("source_type"), sourceId: text("source_id"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const cashRegisters = sqliteTable("cash_registers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  branchId: text("branch_id")
    .notNull()
    .references(() => branches.id),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});
export const terminals = sqliteTable(
  "terminals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    registerId: text("register_id").references(() => cashRegisters.id),
    name: text("name").notNull(),
    code: text("code").notNull(),
    status: text("status").notNull().default("active"),
    lastSeenAt: text("last_seen_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("terminals_tenant_code_uq").on(t.tenantId, t.code)],
);
export const cashSessions = sqliteTable("cash_sessions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  registerId: text("register_id")
    .notNull()
    .references(() => cashRegisters.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  openingAmount: real("opening_amount").notNull(),
  closingAmount: real("closing_amount"),
  expectedAmount: real("expected_amount"),
  status: text("status").notNull().default("open"),
  openedAt: text("opened_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  closedAt: text("closed_at"),
});
export const salePayments = sqliteTable("sale_payments", {
  id: text("id").primaryKey(),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id),
  method: text("method").notNull(),
  amount: real("amount").notNull(),
  amountMinor: integer("amount_minor").notNull().default(0),
  reference: text("reference"),
});
export const cashMovements = sqliteTable("cash_movements", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  sessionId: text("session_id")
    .notNull()
    .references(() => cashSessions.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  movementType: text("movement_type").notNull(),
  amount: real("amount").notNull(),
  reason: text("reason").notNull(),
  reference: text("reference"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const receivables = sqliteTable("receivables", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id),
  originalAmount: real("original_amount").notNull(),
  balance: real("balance").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("pending"),
  originalAmountMinor: integer("original_amount_minor").notNull().default(0),
  balanceMinor: integer("balance_minor").notNull().default(0),
  branchId: text("branch_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const customerPayments = sqliteTable("customer_payments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  receivableId: text("receivable_id").references(() => receivables.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  amount: real("amount").notNull(),
  amountMinor: integer("amount_minor").notNull().default(0),
  method: text("method").notNull(),
  reference: text("reference"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const customerAddresses=sqliteTable("customer_addresses",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),customerId:text("customer_id").notNull(),label:text("label").notNull(),address:text("address").notNull(),city:text("city").notNull(),state:text("state"),postalCode:text("postal_code"),country:text("country").notNull().default("CO"),isDefault:integer("is_default",{mode:"boolean"}).notNull().default(false),active:integer("active",{mode:"boolean"}).notNull().default(true)});
export const creditAuthorizations=sqliteTable("credit_authorizations",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),customerId:text("customer_id").notNull(),requestedBy:text("requested_by").notNull(),authorizedBy:text("authorized_by").notNull(),amountMinor:integer("amount_minor").notNull(),reason:text("reason").notNull(),expiresAt:text("expires_at").notNull(),usedAt:text("used_at"),saleId:text("sale_id"),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)});
export const customerEvents=sqliteTable("customer_events",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),customerId:text("customer_id").notNull(),userId:text("user_id").notNull(),action:text("action").notNull(),amountMinor:integer("amount_minor").notNull().default(0),reason:text("reason").notNull(),reference:text("reference"),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)});
export const customerCredits=sqliteTable("customer_credits",{id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),customerId:text("customer_id").notNull(),saleId:text("sale_id").notNull(),amountMinor:integer("amount_minor").notNull(),balanceMinor:integer("balance_minor").notNull(),reason:text("reason").notNull(),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)});
export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    documentNumber: text("document_number").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    paymentDays: integer("payment_days").notNull().default(30),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("suppliers_tenant_document_uq").on(
      t.tenantId,
      t.documentNumber,
    ),
  ],
);
export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id),
    number: text("number").notNull(),
    status: text("status").notNull().default("draft"),
    total: real("total").notNull(),
    notes: text("notes"),
    approvedBy: text("approved_by"),
    approvedAt: text("approved_at"),
    warehouseId: text("warehouse_id"),
    totalMinor: integer("total_minor").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("po_tenant_number_uq").on(t.tenantId, t.number)],
);
export const purchaseOrderLines = sqliteTable("purchase_order_lines", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: real("quantity").notNull(),
  receivedQuantity: real("received_quantity").notNull().default(0),
  unitCost: real("unit_cost").notNull(),
  lineTotal: real("line_total").notNull(),
  unitCostMinor: integer("unit_cost_minor").notNull().default(0),
  lineTotalMinor: integer("line_total_minor").notNull().default(0),
  returnedQuantity: real("returned_quantity").notNull().default(0),
});
export const purchaseReceipts = sqliteTable("purchase_receipts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  orderId: text("order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  reference: text("reference").notNull(),
  total: real("total").notNull(),
  warehouseId: text("warehouse_id"),
  totalMinor: integer("total_minor").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const payables = sqliteTable("payables", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  orderId: text("order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  originalAmount: real("original_amount").notNull(),
  balance: real("balance").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("pending"),
  originalAmountMinor: integer("original_amount_minor").notNull().default(0),
  balanceMinor: integer("balance_minor").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const supplierPayments = sqliteTable("supplier_payments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  payableId: text("payable_id")
    .notNull()
    .references(() => payables.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  amount: real("amount").notNull(),
  amountMinor: integer("amount_minor").notNull().default(0),
  method: text("method").notNull(),
  reference: text("reference"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const purchaseReceiptLines = sqliteTable("purchase_receipt_lines", {
  id: text("id").primaryKey(),
  receiptId: text("receipt_id")
    .notNull()
    .references(() => purchaseReceipts.id),
  orderLineId: text("order_line_id")
    .notNull()
    .references(() => purchaseOrderLines.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: real("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
  lineTotal: real("line_total").notNull(),
});
export const purchaseReturns = sqliteTable("purchase_returns", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  orderId: text("order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => suppliers.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  reference: text("reference").notNull(),
  total: real("total").notNull(),
  warehouseId: text("warehouse_id"),
  totalMinor: integer("total_minor").notNull().default(0),
  reason: text("reason").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const purchaseReturnLines = sqliteTable("purchase_return_lines", {
  id: text("id").primaryKey(),
  returnId: text("return_id")
    .notNull()
    .references(() => purchaseReturns.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: real("quantity").notNull(),
  unitCost: real("unit_cost").notNull(),
  lineTotal: real("line_total").notNull(),
  orderLineId: text("order_line_id"),
  unitCostMinor: integer("unit_cost_minor").notNull().default(0),
  lineTotalMinor: integer("line_total_minor").notNull().default(0),
});
export const purchaseEvents = sqliteTable("purchase_events", {
  id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),orderId:text("order_id").notNull(),userId:text("user_id").notNull(),action:text("action").notNull(),fromStatus:text("from_status"),toStatus:text("to_status").notNull(),reason:text("reason").notNull(),reference:text("reference"),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const supplierCredits = sqliteTable("supplier_credits", {
  id:text("id").primaryKey(),tenantId:text("tenant_id").notNull(),supplierId:text("supplier_id").notNull(),returnId:text("return_id").notNull(),amountMinor:integer("amount_minor").notNull(),balanceMinor:integer("balance_minor").notNull(),reason:text("reason").notNull(),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const userBranchAccess = sqliteTable(
  "user_branch_access",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("user_branch_access_uq").on(t.userId, t.branchId)],
);
export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    role: text("role").notNull(),
    module: text("module").notNull(),
    canView: integer("can_view", { mode: "boolean" }).notNull().default(true),
    canCreate: integer("can_create", { mode: "boolean" })
      .notNull()
      .default(false),
    canEdit: integer("can_edit", { mode: "boolean" }).notNull().default(false),
    canDelete: integer("can_delete", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [uniqueIndex("role_permission_uq").on(t.tenantId, t.role, t.module)],
);
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  userId: text("user_id").references(() => appUsers.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: text("details"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const syncConflicts = sqliteTable("sync_conflicts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  deviceId: text("device_id").notNull(),
  localVersion: integer("local_version").notNull(),
  serverVersion: integer("server_version").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  resolution: text("resolution"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  resolvedAt: text("resolved_at"),
});
export const posDrafts = sqliteTable(
  "pos_drafts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    userId: text("user_id")
      .notNull()
      .references(() => appUsers.id),
    customerId: text("customer_id").references(() => customers.id),
    number: text("number").notNull(),
    documentType: text("document_type").notNull(),
    status: text("status").notNull().default("open"),
    subtotal: real("subtotal").notNull(),
    discount: real("discount").notNull().default(0),
    total: real("total").notNull(),
    payload: text("payload").notNull(),
    notes: text("notes"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("pos_draft_number_uq").on(t.tenantId, t.number)],
);
export const saleDiscounts = sqliteTable("sale_discounts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  authorizedBy: text("authorized_by").references(() => appUsers.id),
  discountType: text("discount_type").notNull(),
  value: real("value").notNull(),
  amount: real("amount").notNull(),
  reason: text("reason"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const saleReturns = sqliteTable("sale_returns", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  saleId: text("sale_id")
    .notNull()
    .references(() => sales.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  number: text("number").notNull(),
  total: real("total").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("completed"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
export const saleReturnLines = sqliteTable("sale_return_lines", {
  id: text("id").primaryKey(),
  returnId: text("return_id")
    .notNull()
    .references(() => saleReturns.id),
  saleLineId: text("sale_line_id")
    .notNull()
    .references(() => saleLines.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: real("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  lineTotal: real("line_total").notNull(),
});
export const warehouses = sqliteTable(
  "warehouses",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    name: text("name").notNull(),
    code: text("code").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("warehouse_code_uq").on(t.tenantId, t.code)],
);
export const warehouseStock = sqliteTable(
  "warehouse_stock",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    quantity: real("quantity").notNull().default(0),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("warehouse_product_uq").on(t.warehouseId, t.productId)],
);
export const stockTransfers = sqliteTable("stock_transfers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  fromWarehouseId: text("from_warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  toWarehouseId: text("to_warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  number: text("number").notNull(),
  status: text("status").notNull().default("sent"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  receivedAt: text("received_at"),
});
export const stockTransferLines = sqliteTable("stock_transfer_lines", {
  id: text("id").primaryKey(),
  transferId: text("transfer_id")
    .notNull()
    .references(() => stockTransfers.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: real("quantity").notNull(),
});
export const stockCounts = sqliteTable("stock_counts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  warehouseId: text("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  userId: text("user_id")
    .notNull()
    .references(() => appUsers.id),
  number: text("number").notNull(),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
});
export const stockCountLines = sqliteTable("stock_count_lines", {
  id: text("id").primaryKey(),
  countId: text("count_id")
    .notNull()
    .references(() => stockCounts.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  systemQuantity: real("system_quantity").notNull(),
  countedQuantity: real("counted_quantity").notNull(),
  difference: real("difference").notNull(),
});
export const productLots = sqliteTable(
  "product_lots",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    lotNumber: text("lot_number").notNull(),
    expirationDate: text("expiration_date"),
    laboratory: text("laboratory"),
    healthRegistration: text("health_registration"),
    quantity: real("quantity").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("product_lot_uq").on(t.warehouseId, t.productId, t.lotNumber),
  ],
);
export const productSerials = sqliteTable(
  "product_serials",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    serialNumber: text("serial_number").notNull(),
    warrantyMonths: integer("warranty_months").notNull().default(0),
    status: text("status").notNull().default("available"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("product_serial_uq").on(t.tenantId, t.serialNumber)],
);
export const productPresentations = sqliteTable("product_presentations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  conversionFactor: real("conversion_factor").notNull().default(1),
  barcode: text("barcode"),
  salePrice: real("sale_price").notNull(),
  unitId: text("unit_id"),
  salePriceMinor: integer("sale_price_minor").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});
export const businessSettings = sqliteTable(
  "business_settings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    nit: text("nit").notNull().default(""),
    sector: text("sector").notNull().default("retail"),
    currency: text("currency").notNull().default("COP"),
    timezone: text("timezone").notNull().default("America/Bogota"),
    allowNegativeStock: integer("allow_negative_stock", { mode: "boolean" })
      .notNull()
      .default(false),
    receiptFormat: text("receipt_format").notNull().default("thermal_80"),
    mainBranchId: text("main_branch_id").references(() => branches.id),
    mainWarehouseId: text("main_warehouse_id").references(() => warehouses.id),
    mainRegisterId: text("main_register_id").references(() => cashRegisters.id),
    onboardingCompleted: integer("onboarding_completed", { mode: "boolean" })
      .notNull()
      .default(false),
    completedAt: text("completed_at"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("business_settings_tenant_uq").on(t.tenantId)],
);
export const taxRates = sqliteTable(
  "tax_rates",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    rate: real("rate").notNull().default(0),
    includedInPrice: integer("included_in_price", { mode: "boolean" })
      .notNull()
      .default(true),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("tax_rates_tenant_name_uq").on(t.tenantId, t.name)],
);
export const catalogCategories = sqliteTable(
  "catalog_categories",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    description: text("description"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("catalog_category_tenant_parent_name_uq").on(
      t.tenantId,
      t.parentId,
      t.name,
    ),
  ],
);
export const brands = sqliteTable(
  "brands",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    description: text("description"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("brands_tenant_name_uq").on(t.tenantId, t.name)],
);
export const measurementUnits = sqliteTable(
  "measurement_units",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    precision: integer("precision").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("measurement_units_tenant_symbol_uq").on(t.tenantId, t.symbol),
  ],
);
export const productBarcodes = sqliteTable(
  "product_barcodes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    variantId: text("variant_id"),
    code: text("code").notNull(),
    kind: text("kind").notNull().default("EAN13"),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("product_barcodes_tenant_code_uq").on(t.tenantId, t.code),
  ],
);
export const productVariants = sqliteTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    attributes: text("attributes").notNull().default("{}"),
    priceMinor: integer("price_minor").notNull().default(0),
    costMinor: integer("cost_minor").notNull().default(0),
    stock: real("stock").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("product_variants_tenant_sku_uq").on(t.tenantId, t.sku)],
);
export const priceLists = sqliteTable(
  "price_lists",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    currency: text("currency").notNull(),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("price_lists_tenant_name_uq").on(t.tenantId, t.name)],
);
export const productPrices = sqliteTable(
  "product_prices",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    priceListId: text("price_list_id")
      .notNull()
      .references(() => priceLists.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    variantId: text("variant_id").references(() => productVariants.id),
    priceMinor: integer("price_minor").notNull(),
    minQuantity: real("min_quantity").notNull().default(1),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("product_prices_scope_uq").on(
      t.priceListId,
      t.productId,
      t.variantId,
      t.minQuantity,
    ),
  ],
);
export const catalogImages = sqliteTable("catalog_images", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => tenants.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  variantId: text("variant_id").references(() => productVariants.id),
  url: text("url").notNull(),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});
