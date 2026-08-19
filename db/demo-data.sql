-- POS360 - Datos demostrativos reproducibles
-- Ejecute primero todas las migraciones de /drizzle y después este archivo.

INSERT OR IGNORE INTO tenants (id,name,country,status) VALUES
('tenant_demo','Minimercado La Esquina','CO','active'),
('tenant_ferreteria','Ferretería El Constructor','CO','active');

INSERT OR IGNORE INTO branches (id,tenant_id,name) VALUES
('branch_centro','tenant_demo','Sede Centro'),
('branch_norte','tenant_demo','Sede Norte'),
('branch_ferreteria','tenant_ferreteria','Sede Principal');

INSERT OR IGNORE INTO app_users (id,tenant_id,email,display_name,role,active) VALUES
('user_preview','tenant_demo','preview@pos360.local','Administrador local POS360','owner',1),
('user_admin','tenant_demo','admin@pos360.local','Administrador POS360','owner',1),
('user_cajero','tenant_demo','cajero@pos360.local','Carlos Cajero','cashier',1),
('user_bodega','tenant_demo','bodega@pos360.local','Beatriz Bodega','warehouse',1),
('user_contador','tenant_demo','contador@pos360.local','Camilo Contador','accountant',1),
('user_ferreteria','tenant_ferreteria','propietario@ferreteria.local','Propietario Ferretería','owner',1);

INSERT OR IGNORE INTO products (id,tenant_id,sku,barcode,name,category,price,cost,stock,version,active) VALUES
('prod_arroz','tenant_demo','ARR-001','7702129011002','Arroz premium 1 kg','Granos',5200,3536,80,1,1),
('prod_leche','tenant_demo','LEC-001','7702004003405','Leche entera 1 litro','Lácteos',3900,2652,48,1,1),
('prod_aceite','tenant_demo','ACE-001','7702057001113','Aceite vegetal 900 ml','Despensa',11200,7616,30,1,1),
('prod_cafe','tenant_demo','CAF-001','7702011000206','Café molido 500 g','Bebidas',18500,12580,24,1,1),
('prod_aceta','tenant_demo','DRO-001','7709991002203','Acetaminofén 500 mg','Droguería',850,578,150,1,1),
('prod_tornillo','tenant_demo','FER-00125','FER-00125','Tornillo drywall 1 pulg.','Ferretería',180,122,1000,1,1),
('prod_taladro','tenant_demo','FER-TAL-01','7700000010101','Taladro percutor 1/2 pulg.','Ferretería',289900,215000,8,1,1);

INSERT OR IGNORE INTO customers (id,tenant_id,document_type,document_number,name,phone,email,credit_limit,credit_days,active) VALUES
('customer_ana','tenant_demo','CC','1090123456','Ana Rodríguez','3001234567','ana@ejemplo.com',500000,30,1),
('customer_tienda','tenant_demo','NIT','901234567','Tienda Los Amigos','3107654321','compras@losamigos.co',2000000,45,1);

INSERT OR IGNORE INTO suppliers (id,tenant_id,document_number,name,contact_name,phone,email,payment_days,active) VALUES
('supplier_alimentos','tenant_demo','900100200','Distribuidora Nacional de Alimentos','Laura Gómez','6015550101','ventas@distribuidora.co',30,1),
('supplier_farma','tenant_demo','800300400','Laboratorios Salud Colombia','Diego Pérez','6015550202','pedidos@salud.co',45,1),
('supplier_ferre','tenant_demo','901500600','Importadora Ferretera SAS','Mónica Ruiz','6015550303','comercial@ferretera.co',30,1);

INSERT OR IGNORE INTO cash_registers (id,tenant_id,branch_id,name,active) VALUES
('register_2','tenant_demo','branch_centro','Caja 2',1),
('register_norte','tenant_demo','branch_norte','Caja Norte 1',1);

INSERT OR IGNORE INTO warehouses (id,tenant_id,branch_id,name,code,active) VALUES
('warehouse_main','tenant_demo','branch_centro','Bodega principal','BOD-01',1),
('warehouse_display','tenant_demo','branch_centro','Piso de venta','PISO-01',1),
('warehouse_north','tenant_demo','branch_norte','Bodega Norte','BOD-N01',1);

INSERT OR IGNORE INTO warehouse_stock (id,tenant_id,warehouse_id,product_id,quantity) VALUES
('ws_01','tenant_demo','warehouse_main','prod_arroz',60),
('ws_02','tenant_demo','warehouse_display','prod_arroz',20),
('ws_03','tenant_demo','warehouse_main','prod_leche',36),
('ws_04','tenant_demo','warehouse_display','prod_leche',12),
('ws_05','tenant_demo','warehouse_main','prod_aceta',120),
('ws_06','tenant_demo','warehouse_display','prod_aceta',30),
('ws_07','tenant_demo','warehouse_main','prod_taladro',6),
('ws_08','tenant_demo','warehouse_display','prod_taladro',2);

INSERT OR IGNORE INTO product_lots (id,tenant_id,warehouse_id,product_id,lot_number,expiration_date,laboratory,health_registration,quantity) VALUES
('lot_aceta_01','tenant_demo','warehouse_main','prod_aceta','AC-2026-08','2027-08-31','Laboratorios Salud Colombia','INVIMA 2023M-0012345',80),
('lot_leche_01','tenant_demo','warehouse_display','prod_leche','LEC-0826','2026-09-15','Lácteos Nacionales','RSA-001122',12);

INSERT OR IGNORE INTO product_serials (id,tenant_id,warehouse_id,product_id,serial_number,warranty_months,status) VALUES
('serial_taladro_01','tenant_demo','warehouse_main','prod_taladro','TAL-2026-0001',24,'available'),
('serial_taladro_02','tenant_demo','warehouse_main','prod_taladro','TAL-2026-0002',24,'available');

INSERT OR IGNORE INTO product_presentations (id,tenant_id,product_id,name,unit,conversion_factor,barcode,sale_price,active) VALUES
('presentation_arroz_unit','tenant_demo','prod_arroz','Unidad 1 kg','unidad',1,'7702129011002',5200,1),
('presentation_arroz_box','tenant_demo','prod_arroz','Caja x 20','caja',20,'7702129011026',98000,1),
('presentation_tornillo_100','tenant_demo','prod_tornillo','Caja x 100','caja',100,'FER-CAJA-100',16500,1);

INSERT OR IGNORE INTO user_branch_access (id,tenant_id,user_id,branch_id) VALUES
('uba_preview','tenant_demo','user_preview','branch_centro'),
('uba_admin','tenant_demo','user_admin','branch_centro'),
('uba_cajero','tenant_demo','user_cajero','branch_centro'),
('uba_bodega','tenant_demo','user_bodega','branch_centro'),
('uba_contador','tenant_demo','user_contador','branch_centro');
