# Perfil profesional y preferencias de matching

Estado: **Aprobado para implementar** · 15 de septiembre de 2026.

## Requisitos

- Conservar CV base, roles, periodos, habilidades con evidencia, años y objetivos. Datos declarados prevalecen ante inferencias contradictorias.
- Separar nivel de idioma y reglas. Ningún nivel declarado activa penalización automática.
- scoringPreferences versionadas: condición/efecto visibles. Penalizar limita a 40; descartar a 30. Son reglas de puntuación, no acciones de archivo.
- Reconocer criterios textuales inequívocos. Texto ambiguo y antiguas reglas por idioma del anuncio quedan inactivos y requieren revisión.
- Migración idempotente conserva niveles y texto; desactiva automatismos antiguos.
- Guardar sobre perfil combinado para conservar campos en actualizaciones parciales; solo propietario.

## Aceptación

Guardar B2 sin regla no ajusta el match. Regla C1+ activa límite ante exigencia obligatoria C1; quitarla lo desactiva. Alemán independiente del inglés. Recarga conserva reglas y avisos. UI accesible según design.md.

Contrato del evaluador: [selección y afinidad](../seleccion-y-afinidad-ofertas/spec.md).
