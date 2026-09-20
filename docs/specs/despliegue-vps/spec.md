# Despliegue automático al VPS

Estado: implementado en testing; transición inicial de producción pendiente.

## Contrato aprobado

- REQ-001: un push a main debe validar, construir y desplegar web y ambos workers por digest. Testing solo valida; una ejecución manual sobre testing puede publicar imágenes de ensayo sin desplegar.
- REQ-002: fallos de validación, backup o preflight impiden la actualización. Un fallo de salud recupera la release anterior cuando el esquema es compatible; nunca se restaura automáticamente PostgreSQL.
- REQ-003: el acceso de CI y el acceso del operador usan claves distintas, host keys verificadas y comandos restringidos. Los secretos no entran en imágenes, Git, informes ni artefactos de Actions.
- REQ-004: el operador privado de proyecto permite diagnóstico, logs filtrados, entorno, recreación de servicios, copias y rollback. La skill no se versiona.
- INV-001: no modificar servicios, redes ni volúmenes ajenos a Matchply. No ejecutar prune global ni eliminar el volumen PostgreSQL.
- INV-002: despliegue, rollback, backup y cambios de entorno comparten un bloqueo exclusivo. No cancelar un despliegue para iniciar otro.
- INV-003: rechazar migraciones aplicadas desconocidas, históricas pendientes o destructivas. La transición histórica inicial necesita reconciliación y un procedimiento de mantenimiento explícito.

Decisiones: pausa breve aceptada; preservar el estado anterior; el usuario mantiene el control del merge testing → main. Main requiere CI y PR, sin segundo revisor obligatorio. Copias dentro del VPS, sin vigilancia permanente ni backups externos en esta fase.
