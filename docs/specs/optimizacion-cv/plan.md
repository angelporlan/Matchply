# Plan de implementación y activación

Fecha: 03/10/2026. Alcance: [spec.md](spec.md).

1. Servicio común en src/lib/offer-import: tipos, SSRF, downloader, extracción y Responses. EXP-01–06.
2. Cola ai_job: import_offer, deduplicación, progreso, lease, modelo fijo y reintentos. EXP-07–09.
3. API: actor, validación, cuotas y 202; polling existente con propiedad. EXP-07, EXP-16.
4. OfferUrlImport: revisión, invalidación, alternativa manual; try/dashboard y traducciones. EXP-10–15.
5. Pruebas, PostgreSQL aislado, proveedor real, navegador y checks. Registrar [evidencias](evidencias.md).
6. Producción: imagen con Cheerio 1.0.0 fijado, compatible con Node 18 de desarrollo. Worker primero, comprobar clave, web después, importación real en ambas vistas. Sin migración.

Si se revierte el worker, desactivar antes el productor web para no generar un kind desconocido. La publicación y sus verificaciones operativas todavía no se han ejecutado.
