# Continuidad de candidaturas y blog

Estado: contrato aprobado por el usuario el 22/10/2026. Implementado en el checkout local; verificación en `evidence.md`. Publicación productiva pendiente, con salida por fases en `release.md`.

## Requisitos

- REQ-01: Blog público ES/EN, cuatro artículos por idioma, fuentes originales, límites de interpretación, rutas por idioma y CTA a capacidades disponibles. No requiere cuenta ni IA.
- REQ-02: Importar CV desde oferta conserva su identidad y el retorno durante autenticación; errores y cancelación permiten reintentar.
- REQ-03: Outreach inválido no se publica como éxito ni consume cuota. Preserva el resultado anterior y permite reintento.
- REQ-04: Una próxima acción por candidatura; todas las transiciones interactivas comparten reglas. Completar, posponer y cancelar conservan cronología y detectan edición concurrente.
- REQ-05: Conservar bytes exactos del PDF exportado que el usuario confirma. Gratis/Pro, sin huecos de CV; temporal no confirmado 30 días. Sin reconstrucción histórica.
- REQ-06: Perfil generalista compatible con datos antiguos. Aportaciones de evidencia confirmadas, idempotentes, sin sobrescribir datos ajenos; recalcular/regenerar explícitamente.
- REQ-07: Medir oferta, revisión, envío, respuesta explícita e entrevista, con denominadores; CTA del blog sin datos personales.

## Invariantes

- INV-01: Descargar/adaptar/capturar no implica enviar. Un estado importado no demuestra un evento histórico.
- INV-02: Propiedad y actor efectivo se verifican en servidor. Listados sin PDFs, CVs completos, evidencias extensas ni informes.
- INV-03: Un fallo conserva datos previos y libera reservas aplicables. Repetición de una operación no duplica efectos.
- INV-04: Cambiar o borrar el CV no altera el documento confirmado; transferir invitado conserva el grafo nuevo.
- INV-05: No alterar precios, facturación, proveedores, ni activar correo. Sin simulador/calendario/subida de PDFs externos en v1.
- INV-06: El blog no atribuye a Matchply resultados de estudios ni promete contratación, ausencia de errores de IA o acceso al ATS.

## Decisiones

Generalista; blog en ambos idiomas; entregas por fases; seguimiento en app; copias accesibles en ambos planes. PostgreSQL para conservación; contenido editorial tipado en repositorio. Migraciones aditivas y compatibles.
