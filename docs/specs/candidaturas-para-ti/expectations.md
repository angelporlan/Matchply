# Expectativas y verificación

| Criterio | Requisitos | Verificador |
|---|---|---|
| AC-001: Botón adyacente, diálogo accesible, progreso y resultado traducidos | REQ-001 | Revisión visual local, claves ES/EN, lint y typecheck |
| AC-002: Búsqueda obligatoria y estructuración sin añadir hechos ni URL inventada | REQ-002, REQ-003 | `scripts/offer-discovery.test.ts`: llamadas Responses simuladas, citas, vigencia, fechas y SSRF |
| AC-003: Solo entran las cinco mejores ofertas con match ≥65 y snapshot coherente | REQ-004, INV-001 | Prueba de integración con normalización real de evidencia y porcentaje visible en `applicationSummaryColumns` |
| AC-004: Una URL con tracking o un job de LinkedIn equivalente no sobrescribe ni duplica candidaturas | REQ-005 | Normalización unitaria y duplicado archivado en Postgres |
| AC-005: Doble clic/reintento y pestañas paralelas reutilizan el job; otro usuario no accede | REQ-006, INV-002 | Integración: admisión concurrente, ownership y finalización protegida |
| AC-006: Un resultado ya publicado se recupera sin volver a buscar ni cobrar | INV-001 | Integración: repetición del servicio y dispatcher real del worker |
| AC-007: Cambio de perfil o lease obsoleto bloquea publicación y un fallo libera cuota | INV-002 | Integración: cambio de perfil, lease caducado y tres intentos transitorios |
| AC-008: Un usuario gratis puede buscar con su cuota; perfil vacío no reserva cuota | REQ-006 | Integración con usuarios ficticios y configuración de planes predeterminada |
| AC-010: Gratis entrega como máximo 10 candidaturas al mes y Pro 100; saldo parcial limita el resultado | REQ-006, INV-001 | Integración: tandas de cinco, último saldo de dos/una, reservas parciales y cuota agotada |
| AC-011: Solo las ofertas añadidas consumen la bolsa discovery; informes consumen una acción general | REQ-006, INV-001 | Integración de discovery y research Gratis; snapshot de las tres bolsas |
| AC-012: Migración conserva historial, ajustes y contadores; repetirla no cambia de nuevo la versión | REQ-006 | `scripts/discovery-quota-migration.integration.test.ts` |
| AC-009: Progreso y listado no contienen CV, informes o descripciones completas | INV-003 | Integración del objeto de columnas y revisión de respuestas API |

Las respuestas simuladas prueban la integración y las reglas del producto; no prueban la cobertura de portales ni garantizan que cada oferta pública siga abierta después de la búsqueda.
