# Piloto Android POS360

Este documento es la puerta de salida comercial. Ningún piloto se marca como completado sin evidencias reales.

## Preparación

- Instalar Android Studio y el SDK; definir `ANDROID_HOME` o `sdk.dir`.
- Ejecutar `npm run build`, `npm run android:sync` y `npm run android:bundle`.
- Firmar el AAB con una clave protegida y conservar una copia cifrada fuera del equipo.
- Aprovisionar cada dispositivo desde **Android y pilotos**. El token se muestra una sola vez.
- Crear una copia lógica y comprobar también la copia administrada de la base de datos.

## Matriz física obligatoria

Registrar modelo, versión Android, responsable, fecha y evidencia para cada caso:

- Inicio con token válido, inválido y revocado.
- Consulta y búsqueda de inventario con y sin conexión.
- Pedido sin conexión, cierre forzado, reinicio y sincronización posterior.
- Envío repetido del mismo pedido: debe existir una sola operación.
- Recepción total y parcial de compra; validar inventario y cuenta por pagar.
- Alertas de agotados, stock mínimo y vencimientos.
- Cambio de Wi-Fi a datos, latencia alta y corte durante sincronización.
- Batería baja, proceso terminado por Android y reinicio inesperado.
- Restauración en ambiente de ensayo; comparar conteos y valores antes/después.

## Criterios para el piloto

- Cero duplicados y cero movimientos de inventario sin trazabilidad.
- Cola local vacía después de recuperar conectividad.
- Sin errores críticos abiertos en monitoreo.
- Arqueo, inventario y pedidos coinciden con el sistema web.
- Usuarios capacitados y canal de soporte con responsable y horario definidos.
- Aceptación escrita del negocio piloto y plan de reversión documentado.

## Evidencia mínima

Adjuntar capturas o videos, identificador del dispositivo, IDs de operación, registros de monitoreo, copia usada para el ensayo, resultado firmado y observaciones. Una prueba sin evidencia queda pendiente.
