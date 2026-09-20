# Candidaturas, tablero de postulaciones y detalle de oferta — estado actual

Área: **F12**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** PRO en páginas y acciones principales.  
**Dónde comienza:** /dashboard/applications · /dashboard/applications/offer/[id].

## Qué hace actualmente

- **ACT-F12-01:** Crea candidaturas con puesto, empresa, URL, plataforma y descripción; estado inicial interested.
- **ACT-F12-02:** La vista por defecto es una tabla CRM; el tablero con cinco estados (interested, applied, interview, offer y rejected) se mantiene como vista opcional con arrastrar y soltar.
- **ACT-F12-03:** Busca ofertas y filtra por CV vinculado/no vinculado y fecha (todas, hoy, últimos siete días, rango); ofrece densidad compacta/cómoda y orden por puntuación/fecha en interesados.
- **ACT-F12-04:** Carga el detalle bajo demanda y ofrece tanto modal como página completa. Permite editar datos básicos, vincular/desvincular CV y borrar candidatura.
- **ACT-F12-05:** El detalle presenta evaluación, resumen, riesgos, informe, fuente, evidencias a destacar y contenido de preparación cuando existen.
- **ACT-F12-06:** Puede iniciar optimización para la oferta y consultar/iniciar investigación. Estas capacidades se describen en sus fichas.
- **ACT-F12-07:** Persisten nextFollowupDate y rejectionPatternTags; la fecha se puede mostrar y actualizar desde el detalle.
- **ACT-F12-08:** La tabla ordena por columna, pagina en cliente (10/25/50/100), cambia el estado en la propia fila y ofrece acciones de fila (abrir oferta, archivar, borrar con confirmación).
- **ACT-F12-09:** Permite elegir columnas visibles, reordenarlas y guardar vistas (columnas, filtros, orden y tamaño de página) en la tabla application_view; hay presets del sistema de solo lectura y una vista predeterminada por usuario.
- **ACT-F12-10:** La selección múltiple permite archivar y cambiar estado en lote; el layout tabla/tablero se conserva en la URL (?layout=) y en localStorage.

## Límites, diferencias y capacidades parciales

- Guardar estado applied solo actualiza el seguimiento: no envía el CV a la empresa.
- No se encontró envío de recordatorios por la fecha nextFollowupDate ni una agenda/calendario con notificaciones.
- updateJobOfferStatus recibe una cadena sin validar el catálogo en esa acción.
- updateJobOfferCv comprueba propiedad de la oferta, pero no comprueba explícitamente en esa acción la propiedad del CV recibido. No confundir las opciones de UI con una garantía de backend.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/dashboard/applications/page.tsx](<../../../src/app/dashboard/applications/page.tsx>)
- [src/components/applications/ApplicationsClient.tsx](<../../../src/components/applications/ApplicationsClient.tsx>)
- [src/components/applications/ApplicationsTable.tsx](<../../../src/components/applications/ApplicationsTable.tsx>)
- [src/components/applications/ApplicationsBoardView.tsx](<../../../src/components/applications/ApplicationsBoardView.tsx>)
- [src/lib/application-views.ts](<../../../src/lib/application-views.ts>)
- [src/app/dashboard/applications/view-actions.ts](<../../../src/app/dashboard/applications/view-actions.ts>)
- [src/components/applications/JobOfferDetailsModal.tsx](<../../../src/components/applications/JobOfferDetailsModal.tsx>)
- [src/components/applications/JobOfferDetailsPage.tsx](<../../../src/components/applications/JobOfferDetailsPage.tsx>)
- [src/app/dashboard/applications/actions.ts](<../../../src/app/dashboard/applications/actions.ts>)
- [src/db/schema.ts](<../../../src/db/schema.ts>)
- [src/app/dashboard/applications/offer/[id]/page.tsx](<../../../src/app/dashboard/applications/offer/[id]/page.tsx>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/application-views.test.ts](<../../../scripts/application-views.test.ts>)
