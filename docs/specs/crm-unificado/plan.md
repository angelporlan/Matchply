# Implementación

Contrato aprobado; implementación local concluida por fases:

1. Añadir `entity`, favoritos e índices; generar migración y aplicarla en desarrollo/base de pruebas. Mantener las vistas antiguas en `applications`.
2. Generalizar normalización y acciones de vistas por catálogo; implementar mutaciones de favorito privadas/idempotentes y estado parcial de Personas.
3. Migrar Empresas a consultas SQL paginadas; ampliar Personas con filtros/conteos/IDs y relaciones limitadas a página. Conservar proyecciones ligeras.
4. Extraer controles de Postulaciones y reutilizarlos en Empresas/Personas. Incorporar estrellas, presets, acciones en lote, CSV/TSV, modal y presentación móvil.
5. Actualizar importación compatible; verificar aislamiento, fechas/hash, nombres por entidad y retirada del último favorito.
6. Ejecutar suite, typecheck/lint/build y revisión visual; limpiar datos temporales y registrar evidencia.

Sin despliegue ni migración en producción. Para un despliegue futuro será necesaria la migración `0032_yummy_johnny_blaze.sql` junto al código.
