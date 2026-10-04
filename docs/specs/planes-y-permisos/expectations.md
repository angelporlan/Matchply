# Expectativas verificables

| ID | Contexto y acción | Resultado exigido | Evidencia automatizada |
| --- | --- | --- | --- |
| E-01 | Dos peticiones piden la última unidad o espacio | Solo una se admite; contador/capacidad no excede | `ai-usage-integration.test.ts`, `plans-integration.test.ts` |
| E-02 | Doble clic, entrada distinta con ID usado o respuesta perdida | Una reserva, conflicto para entrada incompatible y resultado recuperable | Ambas suites de integración |
| E-03 | Lote 50/51, saldo insuficiente o éxito parcial | Tope y saldo al admitir; solo resultados publicados consumen | `ai-usage-integration.test.ts`, `match-batch.test.ts` |
| E-04 | Worker interrumpido o intento anterior publica | Reclamación segura; intento obsoleto no publica, último fallo libera | `ai-usage-integration.test.ts` |
| E-05 | Cambio de mes, plan o límites durante trabajo | Reserva conserva autorización y periodo; no reinicia uso | Ambas suites de integración |
| E-06 | Downgrade con cinco CVs | Base y dos recientes editables; otros retenidos; reselección y escritura directa comprobadas | `plans-integration.test.ts` |
| E-07 | Demo se reclama al registrar | Resultados, consumo, reserva y exposición se conservan | `plans-integration.test.ts`, `guest-crm.integration.test.ts` |
| E-08 | Administradores publican la misma versión | Uno guarda, otro recibe conflicto; historial y auditoría completos | `plans-integration.test.ts` |
| E-09 | Cuatro claves concurrentes y 61 solicitudes entre ellas | Solo tres altas y 60 solicitudes; almacenamiento hash; lectura de secreto rechazada | `plans-integration.test.ts` |
| E-10 | Agente externo aporta evaluación | No se reserva ninguna bolsa interna | Revisión de productores y `matching-persistence.integration.test.ts` |
| E-11 | Investigación con varias llamadas, informe existente o fallo | Un resultado útil cuesta una unidad; informe reutilizado/reintento no vuelve a cobrar | `ai-usage-integration.test.ts` |
| E-12 | Uso alcanza 80 %/100 % y Pro agota cuota | Contador, motivo y renovación; texto vigente ES/EN y sin nueva compra para Pro | Helpers de presentación y QA visual |

Las pruebas de Postgres requieren URL loopback con nombre `test`. Las pruebas mutables de configuración utilizan una base distinta de las pruebas de workers. Ninguna prueba debe ejecutarse contra producción.
