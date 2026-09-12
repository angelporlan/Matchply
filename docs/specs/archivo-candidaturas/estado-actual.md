# Archivo, restauración y borrado de candidaturas — estado actual

Área: **F13**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** PRO.  
**Dónde comienza:** /dashboard/kanban/archived y acciones del tablero.

## Qué hace actualmente

- **ACT-F13-01:** Archiva una oferta conservando su estado dentro de la cadena archived:estado_anterior.
- **ACT-F13-02:** El tablero principal oculta archivadas y permite archivado individual o múltiple por columna.
- **ACT-F13-03:** La página de archivadas permite buscar, filtrar por estado original/vínculo de CV, ordenar por fecha, título o empresa y paginar (9 elementos inicialmente).
- **ACT-F13-04:** Restaurar recupera el estado anterior válido; usa interested como alternativa cuando no lo reconoce.
- **ACT-F13-05:** Puede abrir detalle y borrar definitivamente una oferta. Archivar no borra su CV; eliminar oferta no elimina el CV vinculado.
- **ACT-F13-06:** Las operaciones se restringen a ofertas del usuario y revalidan panel/tablero.

## Límites, diferencias y capacidades parciales

- No hay papelera posterior al borrado definitivo de una candidatura.
- El archivo es un prefijo de status, no una fecha o bandera independiente. Hay que contemplarlo al diseñar métricas y sincronización.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/dashboard/kanban/actions.ts](<../../../src/app/dashboard/kanban/actions.ts>)
- [src/app/dashboard/kanban/archived/page.tsx](<../../../src/app/dashboard/kanban/archived/page.tsx>)
- [src/app/dashboard/kanban/archived/ArchivedOffersClient.tsx](<../../../src/app/dashboard/kanban/archived/ArchivedOffersClient.tsx>)
- [src/components/kanban/KanbanCard.tsx](<../../../src/components/kanban/KanbanCard.tsx>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
