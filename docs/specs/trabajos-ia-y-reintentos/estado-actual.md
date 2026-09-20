# Trabajos IA persistentes, ejecución y reintentos — estado actual

Área: **F25**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Backend/worker; consulta del propietario por sesión.  
**Dónde comienza:** /api/ai/jobs/[id] · scripts/ai-worker.ts.

## Qué hace actualmente

- **ACT-F25-01:** Persiste trabajos evaluate y optimize_application con payload, resultado, intento y error.
- **ACT-F25-02:** Estados queued, running, completed y failed; cola PostgreSQL con lease de 5 minutos y hasta 3 intentos.
- **ACT-F25-03:** El worker reclama trabajo con bloqueo SKIP LOCKED y evita reclamar otro de un usuario con trabajo activo por esa vía.
- **ACT-F25-04:** settleAiJob espera resultado y puede reclamar directamente por ID tras 1,5 segundos por defecto si sigue en cola; espera configurada de 90 segundos por defecto.
- **ACT-F25-05:** La consulta de trabajo exige actor propietario y devuelve estado, resultado, error y fechas.
- **ACT-F25-06:** La evaluación devuelve un resultado estructurado y la optimización de candidatura genera un CV vinculado. El worker registra resultados/fallos.
- **ACT-F25-07:** Los reintentos tras fallo vuelven a queued con demora progresiva hasta el máximo.

## Límites, diferencias y capacidades parciales

- La reclamación directa por ID no aplica la misma comprobación de un trabajo activo por usuario que la reclamación normal.
- La espera nominal no es un plazo duro: cuando reclama ejecuta processAiJob de forma esperada dentro de la petición.
- No se encontró cancelación pública de trabajos ni claves de idempotencia de petición para todos los tipos. Un reintento tras escrituras parciales necesita revisión.
- Importación y optimización web por streaming no usan esta tabla de trabajos.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/lib/ai-jobs/types.ts](<../../../src/lib/ai-jobs/types.ts>)
- [src/lib/ai-jobs/queue.ts](<../../../src/lib/ai-jobs/queue.ts>)
- [src/lib/ai-jobs/process.ts](<../../../src/lib/ai-jobs/process.ts>)
- [src/lib/ai-jobs/settle.ts](<../../../src/lib/ai-jobs/settle.ts>)
- [src/app/api/ai/jobs/[id]/route.ts](<../../../src/app/api/ai/jobs/[id]/route.ts>)
- [scripts/ai-worker.ts](<../../../scripts/ai-worker.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/ai-jobs.test.ts](<../../../scripts/ai-jobs.test.ts>)
- [scripts/http-timeout.test.ts](<../../../scripts/http-timeout.test.ts>)
