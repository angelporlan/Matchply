# Biblioteca de CVs y panel principal — estado actual

Área: **F05**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Usuario autenticado; acciones de CV también admiten invitado.  
**Dónde comienza:** /dashboard.

## Qué hace actualmente

- **ACT-F05-01:** Lista los CVs propios con principal primero y después fecha de creación descendente. El listado usa una proyección ligera, sin cargar todo el contenido.
- **ACT-F05-02:** Crea CV base desde un Markdown de ejemplo con título, Harvard y estilos iniciales. El primero se marca principal.
- **ACT-F05-03:** Permite abrir editor, marcar principal y borrar. Al marcar principal desmarca los otros en transacción.
- **ACT-F05-04:** Al borrar el principal elige el CV restante más reciente. El borrado de CV deja a null el vínculo en ofertas por la relación de base de datos.
- **ACT-F05-05:** Distingue CV base y CV principal mediante dos banderas; no son el mismo concepto.
- **ACT-F05-06:** Prepara CVs vacíos para recibir streaming. Free reutiliza el CV existente si ya alcanzó su límite; un invitado en su límite recibe error.
- **ACT-F05-07:** Para PRO, muestra cifras de candidaturas, entrevistas y ofertas conseguidas; el total cuenta todos los estados almacenados, incluidos archivados.

## Límites, diferencias y capacidades parciales

- La tabla cv tiene createdAt, pero no un updatedAt ni un historial persistente de versiones.
- No se encontró papelera de CVs ni una acción dedicada de duplicar CV manualmente. El borrado es directo.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/dashboard/page.tsx](<../../../src/app/dashboard/page.tsx>)
- [src/app/dashboard/DashboardClient.tsx](<../../../src/app/dashboard/DashboardClient.tsx>)
- [src/app/dashboard/actions.ts](<../../../src/app/dashboard/actions.ts>)
- [src/lib/job-offer-queries.ts](<../../../src/lib/job-offer-queries.ts>)
- [src/db/schema.ts](<../../../src/db/schema.ts>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
