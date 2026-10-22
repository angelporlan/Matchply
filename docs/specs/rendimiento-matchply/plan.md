# Plan de implementación

Contrato aprobado: [spec.md](spec.md). Verificación: [expectations.md](expectations.md).

1. Preparar baseline standalone Node20, PostgreSQL15 desechable, fixtures y perfiles CI sin skips (REQ-06).
2. Corregir promesa y limpieza de miniaturas con regresiones concurrentes (REQ-01).
3. Compartir renders PDF y aplicar deadline desde admisión; probar crash/saturación (REQ-02).
4. Eliminar diff oculto, cancelar previews y serializar polling/consumo; diferir modal debug (REQ-03/04).
5. Compartir contexto de plan en lecturas, usar Maps/Sets, proyecciones mínimas y executor transaccional en checkpoints (REQ-05).
6. Ejecutar verificaciones y comparar baseline/candidato. Registrar resultados y límites en [evidence.md](evidence.md).

Cambios pequeños y reversibles. Sin despliegue: cuando se solicite, usar el operador existente y rollback de imagen; no restaurar DB automáticamente. Sin nuevos índices ni ajustes de memoria/concurrencia en esta iteración.
