# Optimización de CV para una oferta — estado actual

Área: **F09**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Usuario o invitado; proveedor/modelo según plan.  
**Dónde comienza:** Dashboard/editor/detalle de oferta → /api/ai/optimize.

## Qué hace actualmente

- **ACT-F09-01:** Recibe CV base propio, puesto, empresa y descripción obligatorios; también URL, plataforma, prompt y opción de añadir a Kanban.
- **ACT-F09-02:** Selecciona proveedor/modelo y prompt según configuración, incorpora nombre y contexto profesional al flujo de optimización.
- **ACT-F09-03:** Entrega Markdown incremental y guarda el resultado al completar; puede crear un CV o actualizar un destino propio indicado.
- **ACT-F09-04:** Si Free tiene su único CV y no se indica destino, reutiliza el CV base. El original puede quedar sustituido al terminar.
- **ACT-F09-05:** Las copias conservan estilos permitidos del CV de origen y reciben título Optimizado - puesto (empresa).
- **ACT-F09-06:** Si el destino es distinto del base, puede guardar contenido parcial cada 3 segundos. El resultado final se guarda sin una aceptación adicional del usuario.
- **ACT-F09-07:** Añadir a Kanban solo se aplica con permiso PRO; crea una candidatura interested vinculada si no encuentra una con ese cvId.
- **ACT-F09-08:** Hay límite de 8 solicitudes por actor cada 10 minutos, auditoría y marcadores finales de éxito/error en el stream.

## Límites, diferencias y capacidades parciales

- La intención visual de revisar antes de aplicar descrita en design.md no coincide todavía con el guardado automático de esta ruta.
- La ruta streaming y las tareas en cola no son el mismo circuito; no asumir idénticas reglas de copia, reintento o límites.
- No se ha medido la calidad real de las optimizaciones ni ejecutado proveedores en esta revisión.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/api/ai/optimize/route.ts](<../../../src/app/api/ai/optimize/route.ts>)
- [src/lib/ai-service.ts](<../../../src/lib/ai-service.ts>)
- [src/components/editor/EditorClient.tsx](<../../../src/components/editor/EditorClient.tsx>)
- [src/app/dashboard/DashboardClient.tsx](<../../../src/app/dashboard/DashboardClient.tsx>)
- [src/app/dashboard/actions.ts](<../../../src/app/dashboard/actions.ts>)
- [src/lib/profile-classification.ts](<../../../src/lib/profile-classification.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/prompt-defaults.test.ts](<../../../scripts/prompt-defaults.test.ts>)
- [scripts/subscription.test.ts](<../../../scripts/subscription.test.ts>)
