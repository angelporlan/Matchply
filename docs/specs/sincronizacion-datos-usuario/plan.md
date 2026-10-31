# Plan de implementación

1. ✅ Añadir el importador transaccional y el endpoint interno con token efímero, límites de tamaño, validación de contrato, bloqueo por cuenta y auditoría resumida.
2. ✅ Añadir el cliente de la skill para enviar el paquete temporal, comprimido con gzip, y eliminar el token/env files siempre, incluso tras un error.
3. ✅ Añadir pruebas unitarias y de integración para validación, merge, idempotencia, conflictos y rollback.
4. ✅ Ejecutar typecheck, tests y build; revisar que no se incluyan secretos en respuestas ni logs.
5. ✅ Desplegar por `main`, comprobar la release y hacer backup con `matchply-vps`.
6. ✅ Generar un token efímero, importarlo, retirar el token mediante `env-update` y verificar salud y recuentos. El paquete local se eliminó al finalizar.

## Ajuste de límites de transporte (2026-10-31)

1. ✅ Separar el límite comprimido de 8 MiB del límite JSON descomprimido de 16 MiB en el endpoint y cubrir los bordes con pruebas locales (AC-006, AC-009, AC-011).
2. ✅ Actualizar el cliente privado de la skill para validar el mismo contrato antes de gzip.
3. Publicar por PR, CI y `main`; verificar el SHA y salud de producción.
4. ⛔ El preflight público devolvió 413 para un cuerpo sintético de 4,27 MB. No generar token ni backup, ni importar datos, hasta que una ruta de proxy autorizada admita el paquete (AC-010).

## Recuperación

El importador usa una transacción y no borra datos. Si falla antes de confirmar, no hay cambios que restaurar. Si se detectara un error posterior, se conserva el backup nominal y se detiene la operación para revisión; no se restaura automáticamente sobre usuarios activos.
