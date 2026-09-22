# Plan de implementación

1. ✅ Añadir el importador transaccional y el endpoint interno con token efímero, límites de tamaño, validación de contrato, bloqueo por cuenta y auditoría resumida.
2. ✅ Añadir el cliente de la skill para enviar el paquete temporal, comprimido con gzip, y eliminar el token/env files siempre, incluso tras un error.
3. ✅ Añadir pruebas unitarias y de integración para validación, merge, idempotencia, conflictos y rollback.
4. ✅ Ejecutar typecheck, tests y build; revisar que no se incluyan secretos en respuestas ni logs.
5. ✅ Desplegar por `main`, comprobar la release y hacer backup con `matchply-vps`.
6. ✅ Generar un token efímero, importarlo, retirar el token mediante `env-update` y verificar salud y recuentos. El paquete local se eliminó al finalizar.

## Recuperación

El importador usa una transacción y no borra datos. Si falla antes de confirmar, no hay cambios que restaurar. Si se detectara un error posterior, se conserva el backup nominal y se detiene la operación para revisión; no se restaura automáticamente sobre usuarios activos.
