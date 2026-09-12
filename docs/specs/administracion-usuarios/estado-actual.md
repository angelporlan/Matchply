# Administración de usuarios y estadísticas — estado actual

Área: **F23**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Administrador reconocido en la sesión.  
**Dónde comienza:** /admin.

## Qué hace actualmente

- **ACT-F23-01:** Muestra conteos globales de usuarios registrados, invitados, CVs, ofertas y suscripciones active; excluye invitados de varios totales.
- **ACT-F23-02:** Lista usuarios registrados y permite consultar detalle con perfil, CVs y candidaturas.
- **ACT-F23-03:** Permite cambiar rol user/admin de otros usuarios; bloquea modificar el propio rol por esa acción.
- **ACT-F23-04:** Permite editar subscriptionStatus manualmente para soporte, sin operación equivalente en Stripe.
- **ACT-F23-05:** El cliente ofrece navegación entre resumen, usuarios, modelos/prompts y auditoría; las acciones administrativas llaman a verifyAdmin.

## Límites, diferencias y capacidades parciales

- La autorización administrativa usa el rol contenido en sesión; una sesión JWT puede conservar información previa hasta renovarse.
- getUserDetails devuelve la fila completa de usuario desde el servidor: merece definir proyección de campos antes de tratarlo como acceso mínimo.
- El contador de suscripciones active no incluye trialing, aunque trialing habilita PRO en la tabla de derechos.
- No se encontró borrado administrativo de usuarios desde estas acciones.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/admin/actions.ts](<../../../src/app/admin/actions.ts>)
- [src/app/admin/AdminClient.tsx](<../../../src/app/admin/AdminClient.tsx>)
- [src/app/admin/page.tsx](<../../../src/app/admin/page.tsx>)
- [src/app/admin/layout.tsx](<../../../src/app/admin/layout.tsx>)
- [src/auth.ts](<../../../src/auth.ts>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
