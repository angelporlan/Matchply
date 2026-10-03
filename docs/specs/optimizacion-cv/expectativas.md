# Expectativas comprobables

Requisitos aprobados: [spec.md](spec.md). Fecha: 03/10/2026.

| ID | Acción/contexto | Resultado esperado | Comprobación |
| --- | --- | --- | --- |
| EXP-01 | HTML con JobPosting | Estructuración Luna sin búsqueda; descripción íntegra | Fixtures y oferta real |
| EXP-02 | Página bloqueada/vacía | Búsqueda obligatoria, fuentes y esquema | Fixtures y respaldo real |
| EXP-03 | Otro identificador LinkedIn | Rechazar oferta ajena | Pruebas de fuentes y JSON-LD |
| EXP-04 | Clave ausente, rechazo o respuesta incompleta | Fallo explícito y alternativa manual | Pruebas y try sin clave |
| EXP-05 | Dirección privada, DNS o redirección privada | Sin conexión privada ni envío de URL bloqueada a IA | Pruebas del downloader |
| EXP-06 | DNS pendiente, >2 MiB o cuarta redirección | Error o cancelación acotados | Pruebas del downloader |
| EXP-07 | Doble clic/petición y otro actor | Un trabajo; resultado solo del propietario | PostgreSQL aislado y API |
| EXP-08 | Lease vencido y nuevo intento | Viejo intento no escribe ni termina | PostgreSQL aislado |
| EXP-09 | Error transitorio/permanente | Solo transitorio reintenta, máximo tres | PostgreSQL aislado |
| EXP-10 | Try/dashboard normal | Solo URL, revisión y descripción desplegable | Navegador |
| EXP-11 | Cambiar URL/cerrar observación | Descartar datos anteriores y pendientes | Navegador y AbortController |
| EXP-12 | Adaptar con importación | Editor recibe datos; sin redescarga | Navegador y contrato existente |
| EXP-13 | Crear sin oferta | CV base editable | Navegador |
| EXP-14 | Importar/revisar sin continuar | Cero CVs/candidaturas/empresas | Consulta antes de continuar |
| EXP-15 | EN/ES, escritorio/móvil y teclado | Importador sin desbordamiento; foco y anuncios | Navegador y revisión |
| EXP-16 | Actor ausente/cuota agotada | 401/429; permisos y cuotas conservados | API y limitador |

Las evidencias y limitaciones se detallan en [evidencias.md](evidencias.md).
