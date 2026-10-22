# Rendimiento de Matchply

Estado: aprobado por el usuario el 22/10/2026. Rama: `codex-rendimiento-matchply`, base `d0dfcc2`.

## Contrato

- REQ-01: miniaturas en espera MUST conservar una promesa estable; concurrencia máxima 2, suscriptores independientes y recursos liberados.
- REQ-02: renders PDF simultáneos iguales MUST compartir render; autorización, cuotas y exportación siguen ejecutándose por petición. El timeout de workers incluye cola y ejecución.
- REQ-03: previews, polling y lecturas de uso MUST ignorar resultados obsoletos y liberar solicitudes al desmontar. Una invalidación de consumo durante una lectura programa una lectura posterior.
- REQ-04: comparación del editor solo calcula diferencias al mostrarse. Depuración desactivada explícitamente por servidor no agrega peticiones ni descarga el modal.
- REQ-05: lecturas de uso comparten plan dentro de la petición. Checkpoints de IA usan proyecciones mínimas y el executor de su transacción; observadores de jobs leen únicamente sus campos.
- REQ-06: CI ejecuta integraciones obligatorias sin omisiones y conserva evidencia de navegador y build.

## Invariantes

INV-01: preservar API pública, diseño, ES/EN, guardado, variantes, fotos, páginas PDF y exportaciones.
INV-02: preservar propiedad, soporte, invitados, planes, cuotas, orden de locks, leases y publicación idempotente. Sin caché global de permisos.
INV-03: listados sin informes, cartas ni Markdown completo de CVs. Sin migraciones nuevas, cambios de prompts/scoring, concurrencia o límites de memoria.

El [plan anterior de navegación](../idioma-tema-y-navegacion/plan.md) contiene diagnóstico histórico: paginación SQL, navegación pendiente, carga por pestaña, imports dinámicos y cancelación de miniaturas ya existen. No se vuelven a implementar.
