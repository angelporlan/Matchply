# Servidor MCP y búsqueda de ofertas remotas — estado actual

Área: **F21**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Cliente MCP autenticado; permisos finales dependen de herramienta/servicio.  
**Dónde comienza:** /api/mcp.

## Qué hace actualmente

- **ACT-F21-01:** Expone JSON-RPC: initialize, tools/list, tools/call y ping, con POST/GET de transporte HTTP y cabeceras de sesión/CORS.
- **ACT-F21-02:** Publica 11 herramientas: optimizar_cv, listar_postulaciones, crear_postulacion, actualizar_estado_postulacion, buscar_ofertas_remotas, evaluar_oferta, consultar_trabajo_ia, investigar_oferta, consultar_investigacion, obtener_preferencias_mcp y obtener_cv_base.
- **ACT-F21-03:** Optimización/evaluación pueden ejecutarse mediante trabajo persistente y devolver identificación para consulta posterior; optimización genera CV y candidatura y puede añadir evaluación.
- **ACT-F21-04:** La selección de CV prioriza mcpCvId propio y después un CV base, favoreciendo principal.
- **ACT-F21-05:** La búsqueda consulta el RSS configurado o WeWorkRemotely, filtra por texto en título/empresa/categoría y devuelve hasta 5 resultados.
- **ACT-F21-06:** Si RSS falla o no hay resultados, devuelve un texto que propone al cliente buscar con sus propias herramientas; el servidor no realiza esa búsqueda web alternativa.
- **ACT-F21-07:** Admite token por Authorization y también parámetro token; compatibilidad con clave global más usuario.
- **ACT-F21-08:** /api/mcp/sse y /api/mcp/message son endpoints antiguos que responden 410 con indicación de usar /api/mcp.

## Límites, diferencias y capacidades parciales

- No es una automatización periódica de búsqueda: las herramientas deben ser invocadas por un cliente.
- El RSS personalizado usa fetch directo; no aplica el mismo validador de fuentes públicas que research/providers.
- No se probó interoperabilidad real con clientes MCP. Las acciones mutadoras pueden escribir datos sin una segunda confirmación interna del servidor.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/api/mcp/route.ts](<../../../src/app/api/mcp/route.ts>)
- [src/app/api/mcp/sse/route.ts](<../../../src/app/api/mcp/sse/route.ts>)
- [src/app/api/mcp/message/route.ts](<../../../src/app/api/mcp/message/route.ts>)
- [src/lib/ai-jobs/process.ts](<../../../src/lib/ai-jobs/process.ts>)
- [src/lib/application-service.ts](<../../../src/lib/application-service.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/ai-jobs.test.ts](<../../../scripts/ai-jobs.test.ts>)
