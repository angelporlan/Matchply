# Suscripción, Checkout y portal de facturación — estado actual

Área: **F22**
Actualización: **4 de octubre de 2026**
Método: revisión del código, pruebas puras, Postgres local aislado y API Stripe en modo test. La validación de producción sigue pendiente de despliegue explícito.

[Volver al índice](../README.md) · [Especificación aprobada](spec.md) · [Evidencia](evidence.md)

## Acceso y punto de entrada

Cuenta autenticada real para comprar o gestionar facturación; webhook firmado para conciliación. Entrada: `/dashboard/subscription` y `/api/stripe/*`. Una sesión de soporte no puede comprar en nombre de otra cuenta.

## Comportamiento implementado

- **ACT-F22-01:** Catálogo mensual EUR 10 y anual EUR 96, validado contra Prices activos, moneda EUR, recurrencia y modalidad. La mensual conserva el alias heredado. Anual y trial quedan bajo `STRIPE_MONETIZATION_ENABLED` y portal comprobado; trial exige además `STRIPE_TRIAL_REMINDERS_VERIFIED`, apagado hasta verificación en Dashboard.
- **ACT-F22-02:** POST Checkout con origen propio, UUID idempotente y bloqueo por cuenta. Crea un Customer único, reutiliza sesión compatible, expira la anterior al cambiar modalidad y admite los códigos promocionales existentes. El GET heredado solo redirige a planes.
- **ACT-F22-03:** Prueba de siete días con tarjeta, una vez por cuenta. Guarda historial de uso y consulta suscripciones Stripe previas; un Checkout abandonado sin empezar trial no consume elegibilidad. La prueba usa cuotas Pro del mes natural.
- **ACT-F22-04:** Cuentas con suscripción vigente, impago o pago pendiente acceden al portal en lugar de duplicar suscripción. El portal utiliza el Customer existente, permite cancelación al final del período y vuelve a la página de planes.
- **ACT-F22-05:** Webhook firmado deduplica eventos en Postgres, normaliza facturas de APIs antiguas y actuales, y concilia estado recuperado dentro del bloqueo por cuenta. Un evento antiguo no puede sustituir otra suscripción vigente.
- **ACT-F22-06:** Conciliación conserva Price, intervalo, fin de trial, período confirmado, cancelación programada, primera prueba y pago. Trial vigente o período confirmado vigente conceden Pro; pagos pendientes no extienden acceso. Una baja real restablece la selección inicial Free una sola vez.
- **ACT-F22-07:** El retorno verifica propiedad de Checkout y Customer, consulta estado real y muestra pendiente si aún no se ha confirmado. Visitar una URL de éxito no prueba un cobro ni genera conversión.
- **ACT-F22-08:** Paywall A/B estable por cuenta y versión, textos ES/EN configurables, modo fijo o pausa y métricas administrativas. El primer pago positivo tiene deduplicación global por cuenta; renovaciones y recompras no repiten esa conversión.

## Alcance comprobado

Catálogo mensual y portal comprobados por API Stripe test; anual de test creado y dos Checkouts idempotentes con trial verificados. Un TestClock confirmó siete días, factura inicial de cero y pago positivo posterior. Fixtures firmados y base aislada cubren concurrencia, eventos repetidos, estado fresco, propiedad y renovación/recompra. Detalles y límites de esa evidencia en [evidence.md](evidence.md).

No se han cambiado claves, Prices, configuración de webhooks ni variables de producción. La entrega HTTP externa del webhook y la cancelación visual en Stripe siguen pendientes de la verificación de ese entorno. No se activa cálculo fiscal automático ni se altera el tratamiento fiscal existente. El admin de límites no cobra, renueva ni cancela contratos Stripe.

## Fuentes de implementación

- [src/lib/billing-service.ts](../../../src/lib/billing-service.ts)
- [src/lib/billing-catalog.ts](../../../src/lib/billing-catalog.ts)
- [src/lib/billing-policy.ts](../../../src/lib/billing-policy.ts)
- [src/lib/stripe-subscription-sync.ts](../../../src/lib/stripe-subscription-sync.ts)
- [src/lib/stripe-webhook.ts](../../../src/lib/stripe-webhook.ts)
- [src/lib/monetization.ts](../../../src/lib/monetization.ts)
- [src/app/api/stripe/checkout/route.ts](../../../src/app/api/stripe/checkout/route.ts)
- [scripts/billing-policy.test.ts](../../../scripts/billing-policy.test.ts)
- [scripts/billing.integration.test.ts](../../../scripts/billing.integration.test.ts)
