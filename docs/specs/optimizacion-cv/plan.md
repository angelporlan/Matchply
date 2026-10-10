# Plan de implementación y activación

Fecha: 03/10/2026. Alcance: [spec.md](spec.md).

1. Servicio común en src/lib/offer-import: tipos, SSRF, downloader, extracción y Responses. EXP-01–06.
2. Cola ai_job: import_offer, deduplicación, progreso, lease, modelo fijo y reintentos. EXP-07–09.
3. API: actor, validación, cuotas y 202; polling existente con propiedad. EXP-07, EXP-16.
4. OfferUrlImport: revisión, invalidación, alternativa manual; try/dashboard y traducciones. EXP-10–15.
5. Pruebas, PostgreSQL aislado, proveedor real, navegador y checks. Registrar [evidencias](evidencias.md).
6. Producción: imagen con Cheerio 1.0.0 fijado, compatible con Node 18 de desarrollo. Worker primero, comprobar clave, web después, importación real en ambas vistas. Sin migración.

Si se revierte el worker, desactivar antes el productor web para no generar un kind desconocido. La publicación y sus verificaciones operativas todavía no se han ejecutado.

## Tres variantes — implementación 06/10/2026

1. Migración aditiva 0038 y tipos nullable; documentos anteriores compatibles.
2. Servicio único de análisis/generación/validación con fuentes congeladas y snapshots del modelo; conservar IDs internos.
3. Admitir `optimize_cv_variants` en cola, checkpoints y liquidación con lease/cuota. Retry gratuito e idempotencia.
4. Actualizar todos los consumidores al contrato 202/polling y recuperar trabajo al recargar. Transferir optimizaciones y jobs del invitado.
5. Guardado central del editor, selección y revisión por modo; PDF explícito y comparación inmutable. Quitar selector previo.
6. Pruebas unitarias, integración PostgreSQL aislado, typecheck/lint/build; verificar navegador/PDF y registrar evidencias.
7. Activación: copia de seguridad, aplicar migración con Drizzle, imagen/worker compatible primero y web después. Reversión: parar productor nuevo antes de bajar worker; conservar tablas aditivas y `cv.content` legible por web anterior. No borrar variantes durante rollback.

La rama de trabajo incluye otras funcionalidades anteriores; la activación en producción debe utilizar la release aprobada por el propietario del proyecto. No se hace merge ni se cambia producción como efecto secundario de la verificación local.

## Revisión: Equilibrado inicial y generación visible bajo demanda

1. Mantener esquema y operación única; iniciar solo Equilibrado, otros modos `idle`; admisión idempotente de un modo adicional con las mismas fuentes y cuotas.
2. Transporte SSE real para generaciones/correcciones; checkpoints de preview acotados y fenced. Exponer preview solo en detalle del trabajo propio; descartar contenido parcial ante fallos.
3. Abrir editor desde dashboard tras admisión. Mostrar preview y animación sin cambiar/guardar el documento previo; respetar movimiento reducido y bloquear edición/descarga hasta validación.
4. Diálogo accesible al pulsar un modo sin generar; cancelar no produce efectos; confirmar genera solo ese modo, luego lo selecciona. Reusar selección/guardado/retry actuales.
5. Adaptar pruebas de cuota/cola y añadir transporte SSE, modo bajo demanda, cancelación y preview. Ejecutar integración aislada, suite, tipos/lint/build y navegador con generación real. Solo local, sin migración adicional.
