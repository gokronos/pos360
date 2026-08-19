# POS360 Móvil Android

Cliente separado del núcleo web y del POS Windows. Usa Capacitor 8, caché local persistente y una cola idempotente que se reintenta cuando vuelve la conexión.

## Desarrollo

1. `npm install`
2. `npm run android:add` (solo la primera vez)
3. `npm run android:sync`
4. `npm run android:open`

Para un AAB firmado se requiere Android Studio/SDK, JDK, una upload key y Play App Signing. `npm run android:bundle` genera el bundle cuando esas dependencias están configuradas.
