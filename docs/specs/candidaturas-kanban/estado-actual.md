# Candidaturas, Kanban y detalle de oferta — estado actual

Área: **F12**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** PRO en páginas y acciones principales.  
**Dónde comienza:** /dashboard/kanban · /dashboard/kanban/offer/[id].

## Qué hace actualmente

- **ACT-F12-01:** Crea candidaturas con puesto, empresa, URL, plataforma y descripción; estado inicial interested.
- **ACT-F12-02:** Tablero con cinco estados: interested, applied, interview, offer y rejected. Permite arrastrar y cambiar estado desde controles.
- **ACT-F12-03:** Busca ofertas y filtra por CV vinculado/no vinculado y fecha (todas, hoy, últimos siete días, rango); ofrece densidad compacta/cómoda y orden por puntuación/fecha en interesados.
- **ACT-F12-04:** Carga el detalle bajo demanda y ofrece tanto modal como página completa. Permite editar datos básicos, vincular/desvincular CV y borrar candidatura.
- **ACT-F12-05:** El detalle presenta evaluación, resumen, riesgos, informe, fuente, evidencias a destacar y contenido de preparación cuando existen.
- **ACT-F12-06:** Puede iniciar optimización para la oferta y consultar/iniciar investigación. Estas capacidades se describen en sus fichas.
- **ACT-F12-07:** Persisten nextFollowupDate y rejectionPatternTags; la fecha se puede mostrar y actualizar por API/MCP.

## Límites, diferencias y capacidades parciales

- Guardar estado applied solo actualiza el seguimiento: no envía el CV a la empresa.
- No se encontró envío de recordatorios por la fecha nextFollowupDate ni una agenda/calendario con notificaciones.
- updateJobOfferStatus recibe una cadena sin validar el catálogo en esa acción; la API externa sí valida estados.
- updateJobOfferCv comprueba propiedad de la oferta, pero no comprueba explícitamente en esa acción la propiedad del CV recibido. No confundir las opciones de UI con una garantía de backend.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/dashboard/kanban/page.tsx](<../../../src/app/dashboard/kanban/page.tsx>)
- [src/components/kanban/KanbanBoard.tsx](<../../../src/components/kanban/KanbanBoard.tsx>)
- [src/components/kanban/JobOfferDetailsModal.tsx](<../../../src/components/kanban/JobOfferDetailsModal.tsx>)
- [src/components/kanban/JobOfferDetailsPage.tsx](<../../../src/components/kanban/JobOfferDetailsPage.tsx>)
- [src/app/dashboard/kanban/actions.ts](<../../../src/app/dashboard/kanban/actions.ts>)
- [src/db/schema.ts](<../../../src/db/schema.ts>)
- [src/app/dashboard/kanban/offer/[id]/page.tsx](<../../../src/app/dashboard/kanban/offer/[id]/page.tsx>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
