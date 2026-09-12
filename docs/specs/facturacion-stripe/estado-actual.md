# Suscripción, Checkout y portal de facturación — estado actual

Área: **F22**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Usuario autenticado; webhook firmado para sincronización.  
**Dónde comienza:** /dashboard/subscription · /api/stripe/*.

## Qué hace actualmente

- **ACT-F22-01:** Presenta Gratis/PRO y dirige a Checkout o portal según estado. Usa un Price PRO configurado por entorno en modo test o production.
- **ACT-F22-02:** Checkout crea cliente Stripe si falta, crea sesión subscription y permite códigos promocionales; conserva metadatos userId, plantilla válida y origen.
- **ACT-F22-03:** Si ya es PRO y tiene subscriptionId, Checkout redirige al portal en vez de crear otra sesión de compra.
- **ACT-F22-04:** El portal se abre con el cliente del usuario y retorno al dashboard; los controles efectivos del portal dependen de su configuración en Stripe.
- **ACT-F22-05:** Webhook verifica firma con secreto configurado y maneja checkout.session.completed, invoice.payment_succeeded, customer.subscription.updated y deleted.
- **ACT-F22-06:** La sincronización guarda customerId, subscriptionId y estado. La baja elimina subscriptionId y fija canceled.
- **ACT-F22-07:** El retorno al dashboard también consulta la sesión de Checkout y sincroniza si sus metadatos pertenecen al usuario autenticado.

## Límites, diferencias y capacidades parciales

- No se verificaron precios, impuestos, portal ni productos en la cuenta Stripe; el importe mostrado en UI no prueba el Price real.
- No hay tabla de eventos Stripe procesados ni control explícito del orden de eventos en este código.
- Checkout no activa automatic_tax en esta implementación; el tratamiento de impuestos queda por definir/verificar, sin cambiarlo aquí.
- Cambiar manualmente subscriptionStatus en administración solo cambia derechos locales; no cobra ni cancela una suscripción Stripe.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/dashboard/subscription/page.tsx](<../../../src/app/dashboard/subscription/page.tsx>)
- [src/app/api/stripe/checkout/route.ts](<../../../src/app/api/stripe/checkout/route.ts>)
- [src/app/api/stripe/portal/route.ts](<../../../src/app/api/stripe/portal/route.ts>)
- [src/app/api/stripe/webhook/route.ts](<../../../src/app/api/stripe/webhook/route.ts>)
- [src/lib/stripe-subscription-sync.ts](<../../../src/lib/stripe-subscription-sync.ts>)
- [src/lib/stripe.ts](<../../../src/lib/stripe.ts>)
- [src/app/dashboard/page.tsx](<../../../src/app/dashboard/page.tsx>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/stripe-subscription.test.ts](<../../../scripts/stripe-subscription.test.ts>)
