# POS360 — Código fuente completo

Este paquete contiene el frontend, APIs, base de datos, migraciones, sincronización offline y datos de demostración de POS360.

## Requisitos

- Node.js 22.13 o superior.
- npm.
- Una base de datos compatible con Cloudflare D1/SQLite.
- Git es recomendable, pero no obligatorio.

## Estructura principal

- `app/`: interfaz, módulos y rutas API.
- `db/schema.ts`: definición completa de las 41 tablas.
- `db/demo-data.sql`: empresas, usuarios, productos, clientes, proveedores, bodegas, lotes, series y presentaciones de ejemplo.
- `drizzle/`: migraciones SQL en orden, desde `0000` hasta `0009`.
- `public/`: aplicación instalable, manifiesto, íconos y servicio offline.
- `scripts/`: compilación y validación.

## Instalación

```bash
npm run install:ci
npm run db:setup:local
npm run dev
```

## Preparar la base de datos

1. Cree una base D1 o SQLite vacía.
2. Ejecute en orden los archivos de la carpeta `drizzle/`, desde `0000` hasta `0009`.
3. Ejecute `db/demo-data.sql` para cargar información de prueba.
4. Configure el binding de la base de datos con el nombre `DB`.

Ejemplo conceptual con Wrangler/D1:

```bash
wrangler d1 execute SU_BASE --file=drizzle/0000_dry_fallen_one.sql
# Continúe en orden con las demás migraciones.
wrangler d1 execute SU_BASE --file=db/demo-data.sql
```

Para desarrollo local este repositorio ya automatiza el orden completo:

```bash
npm run db:migrate:local  # Solo estructura
npm run db:seed:local     # Solo demostraciones
npm run db:setup:local    # Estructura y demostraciones
```

Las rutas de la aplicación nunca crean tablas. Las migraciones se ejecutan antes de iniciar el servicio.

## Usuarios de demostración

- Propietario: `admin@pos360.local`
- Cajero: `cajero@pos360.local`
- Bodeguero: `bodega@pos360.local`
- Contador: `contador@pos360.local`

La versión actual recibe la identidad del usuario mediante el encabezado `oai-authenticated-user-email`. Para comercializarla fuera de este entorno debe conectarse un proveedor de autenticación propio y un sistema de recuperación de contraseña.

## Comandos

```bash
npm run dev          # Desarrollo
npm run build        # Compilación de producción
npm test             # Validación
npm run db:generate  # Generar migraciones después de modificar db/schema.ts
```

## Información incluida

- 41 tablas de base de datos.
- Multiempresa, sedes, usuarios, roles y permisos.
- Productos, inventario, bodegas, traslados y conteos.
- Lotes, vencimientos, series, garantías y presentaciones.
- Clientes, cartera, proveedores, compras y cuentas por pagar.
- Punto de venta, caja, descuentos, pagos combinados, devoluciones y anulaciones.
- Cotizaciones, apartados y ventas suspendidas.
- Sincronización offline y resolución de conflictos.
- Migraciones y datos de ejemplo reproducibles.

## Importante

No se incluyen contraseñas, tokens ni datos privados de la base alojada. El archivo `db/demo-data.sql` permite reconstruir una instalación segura y funcional para desarrollo.
