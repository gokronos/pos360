# POS360 Windows

Módulo Electron independiente de la aplicación web. Usa SQLite WAL con `synchronous=FULL`, ventas locales transaccionales, cola durable, catálogo autorizado por terminal, recibos ESC/POS con pulso de cajón y sincronización idempotente.

## Desarrollo

```bash
npm install
npm test
npm start
```

Administración genera una credencial única para una terminal mediante `POST /api/organization` con `action=desktopCredential`. El token solo se muestra una vez y se guarda localmente durante la activación.

## Distribución firmada

Configure `CSC_LINK`, `CSC_KEY_PASSWORD` y `POS360_UPDATE_URL`. Luego ejecute `npm run dist:win`. Electron Builder firma el instalador y `electron-updater` exige que el publicador coincida antes de instalar una actualización.

No se debe distribuir sin certificado de firma de código ni afirmar compatibilidad con impresora/cajón hasta probar el modelo físico configurado.
