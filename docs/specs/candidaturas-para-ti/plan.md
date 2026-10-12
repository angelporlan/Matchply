# Implementación

1. Búsqueda con Responses/Luna y verificación de fuente, vigencia y URL pública (REQ-002/003).
2. Productor y consumidor `discover_offers` en la cola existente; reservas, ownership y recuperación (REQ-006).
3. Reutilizar matching con el modelo solicitado; publicar datos y evidencia en una transacción con deduplicación (REQ-004/005).
4. Botón secundario, diálogo nativo con foco contenido, polling y textos ES/EN (REQ-001).
5. Pruebas unitarias, Postgres aislado, suite, typecheck, lint, build y revisión visual.

No cambia el esquema. Rollback: retirar el botón/productor primero y permitir que el worker termine jobs en curso antes de retirar el consumidor. Despliegue: web y ai_worker en la misma versión.
