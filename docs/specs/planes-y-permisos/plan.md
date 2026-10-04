# Plan de implementación

1. Especificar reglas aprobadas, invariantes y expectativas.
2. Migrar configuración/historial, periodos/operaciones/items, selección de CVs, estado Stripe y experimento. Importar investigación previa y autorizar trabajos antiguos sin doble cargo.
3. Integrar reserva y publicación transaccional en rutas, acciones, API y workers. Revisar orden de locks, idempotencia, leases y recuperación.
4. Implementar admin, consulta privada de uso, selección de documentos, contadores/avisos y paywall común.
5. Integrar catálogo validado mensual/anual, trial, Checkout POST e idempotencia de webhooks; verificar sandbox antes de activar ofertas nuevas.
6. Ejecutar suites, lint, typecheck, build, integración Postgres aislada y revisión visual ES/EN/temas. Registrar evidencia sin credenciales.

La publicación en producción no forma parte de este cambio local. La oferta anual/trial requiere catálogo y portal verificados en cada entorno.
