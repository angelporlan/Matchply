# Auditoría, salud, límites técnicos y operación — estado actual

Área: **F26**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Administrador para auditoría; backend/operador para infraestructura.  
**Dónde comienza:** /admin → auditoría · /api/health · scripts y Docker.

## Qué hace actualmente

- **ACT-F26-01:** Registra eventos de cuenta, CV, ofertas, claves, investigación y otras operaciones con usuario, detalles, IP/User-Agent si hay contexto HTTP.
- **ACT-F26-02:** La inserción de auditoría se dispara sin esperar confirmación: un error de log no bloquea la operación principal.
- **ACT-F26-03:** El admin consulta los últimos 1000 eventos y estadísticas del día de registros, logins, creaciones/optimizaciones y descargas registradas.
- **ACT-F26-04:** El logger emite registros estructurados y el middleware propaga x-request-id.
- **ACT-F26-05:** /api/health ejecuta SELECT 1: responde ok o 503; no comprueba calidad IA, pagos ni actividad de workers.
- **ACT-F26-06:** Hay límites en memoria para operaciones concretas y timeout de conexiones externas; no un contador de cuota compartido para toda la IA.
- **ACT-F26-07:** Docker define web, PostgreSQL, research_worker y ai_worker; existen scripts de migración/seed, promoción de admin, pruebas, escucha Stripe y migración de fuentes LinkedIn.

## Límites, diferencias y capacidades parciales

- Este inventario no ejecuta scripts administrativos, migraciones, workers ni se conecta a producción.
- Auditoría no es un registro transaccional garantizado de cada acción. No se encontró una política implementada de retención/purga general.
- Los límites en memoria y la caché PDF se reinician con el proceso y no se comparten entre réplicas.
- Salud HTTP correcta no prueba que una investigación en cola vaya a completarse.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/lib/audit.ts](<../../../src/lib/audit.ts>)
- [src/lib/logger.ts](<../../../src/lib/logger.ts>)
- [src/lib/rate-limit.ts](<../../../src/lib/rate-limit.ts>)
- [src/middleware.ts](<../../../src/middleware.ts>)
- [src/app/api/health/route.ts](<../../../src/app/api/health/route.ts>)
- [src/app/admin/actions.ts](<../../../src/app/admin/actions.ts>)
- [docker-compose.prod.yml](<../../../docker-compose.prod.yml>)
- [src/db/index.ts](<../../../src/db/index.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/logger.test.ts](<../../../scripts/logger.test.ts>)
- [scripts/rate-limit.test.ts](<../../../scripts/rate-limit.test.ts>)
- [scripts/http-timeout.test.ts](<../../../scripts/http-timeout.test.ts>)
