# Implementación

1. Búsqueda con Responses/Luna y verificación de fuente, vigencia y URL pública (REQ-002/003).
2. Productor y consumidor `discover_offers` en la cola existente; reservas, ownership y recuperación (REQ-006).
3. Reutilizar matching con el modelo solicitado; publicar datos y evidencia en una transacción con deduplicación (REQ-004/005).
4. Botón secundario, diálogo nativo con foco contenido, polling y textos ES/EN (REQ-001).
5. Pruebas unitarias, Postgres aislado, suite, typecheck, lint, build y revisión visual.

No cambia el esquema. Rollback: retirar el botón/productor primero y permitir que el worker termine jobs en curso antes de retirar el consumidor. Cuotas: discovery cuenta cada oferta añadida (10 Gratis / 100 Pro al mes), reserva hasta cinco o el saldo restante y libera plazas sobrantes. Investigación profunda pasa a general. Aplicar la migración de datos 0040 y desplegar web, ai_worker y research_worker en la misma versión. Los trabajos admitidos antes del cambio mantienen su reserva original; terminar trabajos en curso antes de un rollback de código y configuración.
