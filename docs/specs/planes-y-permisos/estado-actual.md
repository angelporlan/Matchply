# Planes, límites y permisos funcionales — estado actual

Área: **F04**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Invitado, Gratis, PRO y administrador.  
**Dónde comienza:** Reglas comunes aplicadas por páginas, acciones y APIs.

## Qué hace actualmente

- **ACT-F04-01:** Invitado: máximo 3 CVs; Gratis: máximo 1; PRO: sin límite de cantidad en la tabla de derechos.
- **ACT-F04-02:** La única plantilla habilitada para todos los niveles es Harvard; los nombres heredados se sustituyen por Harvard al resolver la plantilla permitida.
- **ACT-F04-03:** PRO corresponde a subscriptionStatus active o trialing. Otros estados se consideran Free; isGuest tiene prioridad sobre el estado de suscripción.
- **ACT-F04-04:** IA avanzada, Kanban, extensión LinkedIn e investigación profunda están definidos como funciones PRO.
- **ACT-F04-05:** La importación y optimización básicas pueden usar el proveedor/modelo Free. No existe un contador mensual general de optimizaciones equivalente al de investigación.
- **ACT-F04-06:** Las páginas protegidas y servicios comprueban sesión/actor y propiedad. El middleware global añade un request ID: no es quien impone toda la autorización.

## Límites, diferencias y capacidades parciales

- El rol admin no es automáticamente un plan PRO.
- Algunas rutas tienen reglas distintas: la acción de afinidad individual comprueba sesión y propiedad pero no llama a requireUserFeature.
- La bajada de plan no elimina automáticamente los CVs existentes; las nuevas creaciones quedan sujetas al límite.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/lib/subscription.ts](<../../../src/lib/subscription.ts>)
- [src/lib/permissions.ts](<../../../src/lib/permissions.ts>)
- [src/lib/actor.ts](<../../../src/lib/actor.ts>)
- [src/middleware.ts](<../../../src/middleware.ts>)
- [src/app/dashboard/kanban/actions.ts](<../../../src/app/dashboard/kanban/actions.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/subscription.test.ts](<../../../scripts/subscription.test.ts>)
- [scripts/stripe-subscription.test.ts](<../../../scripts/stripe-subscription.test.ts>)
