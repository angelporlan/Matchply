# Expectativas verificables

| ID | Contexto | Acción | Resultado observable |
| --- | --- | --- | --- |
| AC-001 | El paquete de `angelporlandev@gmail.com` es válido y la producción está sana | Se habilita un token temporal y se importa | La respuesta devuelve éxito y los recuentos importados; la cuenta conserva sus campos de autenticación y facturación de producción |
| AC-002 | El mismo paquete se envía dos veces | Se repite la importación | No aparecen duplicados y la segunda ejecución es idempotente |
| AC-003 | El JSON incluye un campo prohibido o un trabajo `queued`/`running` | Se intenta importar | Respuesta 400 y cero cambios en producción |
| AC-004 | El UUID de un CV, empresa, oferta o cuenta colisiona con otra propiedad | Se intenta importar | Respuesta 400 y rollback de toda la transacción |
| AC-005 | Falta el token o el token no coincide | Se llama al endpoint | Respuesta 404/401 sin revelar si la operación está habilitada |
| AC-006 | El cuerpo gzip supera 8 MiB, el JSON descomprimido supera 16 MiB o no es JSON válido | Se llama al endpoint con token válido | Respuesta 413 para límites excedidos, 400 para JSON inválido y cero cambios |
| AC-007 | Hay dos importaciones de la misma cuenta simultáneas | Se envían en paralelo | Se serializan; el resultado final no duplica registros |
| AC-008 | La importación termina | Se comprueba el estado operativo | `/api/health` sigue sano, el token se elimina y no queda el paquete temporal en el host local |
| AC-009 | Un paquete JSON de 12.140.099 bytes se comprime a 4.270.148 bytes | Se valida en el cliente y en el endpoint | El cliente acepta esos tamaños; el endpoint admite gzip menor de 8 MiB y JSON menor de 16 MiB antes de validar el contrato |
| AC-010 | El proxy público devuelve 413 para un cuerpo superior a su límite | Se ejecuta el preflight antes de habilitar el token de importación | No se inicia la importación ni se modifica producción; se requiere una ruta de proxy autorizada que admita el paquete |
| AC-011 | Una entrada gzip de hasta 8 MiB se expandiría por encima de 16 MiB | Se llama al endpoint con token válido | Respuesta 413 por el límite de salida de gzip, antes de JSON o base de datos |

## Verificación

- Unitarias: validación, campos prohibidos, límites, fechas y estados.
- Integración local: importación en una base PostgreSQL aislada, repetición y rollback por conflicto.
- CI: `npm run typecheck`, `npm test`, pruebas Python de operaciones y `npm run build`.
- Producción: backup nominal previo, respuesta del endpoint, recuentos por tabla, `/api/health`, y `env-list` para confirmar que el token ya no aparece.

