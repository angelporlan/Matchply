# Evidencia de facturación

Fecha: **4 de octubre de 2026**. Entornos: checkout local, Postgres aislado `matchply_plans_test_20261004` y Stripe **test**. Producción no intervenida.

Referencias: [plan aprobado](plan.md), [expectativas](expectations.md), [configuración y operación](../../monetization-billing.md).

## Comprobaciones realizadas

- `node --import tsx --test scripts/billing-policy.test.ts scripts/stripe-subscription.test.ts`: **12 pruebas correctas**. Valida precios/intervalos, normalización de facturas, vigencia de prueba y pago confirmado, detalles de suscripción y reparto A/B estable.
- `scripts/billing.integration.test.ts`, con URL privada de la base aislada: **13 pruebas correctas** (suite más doce escenarios), incluyendo concurrencia, transición de selección Free y repetición posterior que conserva esa selección. Una suscripción existente en Stripe repara el estado local y lleva al portal sin crear otro Checkout. Renovación y recompra con facturas positivas conservan un único evento de primer pago por cuenta. Verifica que el guard de recordatorios bloquea trial y expira sesiones con prueba sin bloquear el anual; cambios de periodicidad conservan Price, descuentos, método de pago y detalles de factura de la fase actual hasta renovación, permiten repetición y rechazan schedules ajenos. Cancelación de trial conserva Pro hasta su fin; una prueba cancelada y un fallo de pago no conceden una segunda prueba ni un período pagado. La habilitación del primer upsell y su evento se guardan o revierten con la publicación. Stripe externo está simulado en esta suite, sin cobros.
- Política, sincronización e integración: **25 pruebas correctas**, incluidas en la suite global final de 419 sin omisiones ni fallos. Las fixtures leen la versión de configuración y experimento vigente, también después de 0036.
- `npm run typecheck`: correcto después de integrar los contratos compartidos.
- Firma construida con SDK y comprobada antes de procesar fixture; segunda entrega del mismo ID es duplicada. Un snapshot viejo de trial recibe estado `canceled` actual de Stripe; un evento de la suscripción vieja no revoca otra activa. Pago pendiente no extiende período confirmado.
- Lectura Stripe endive: Price mensual activo EUR 1000/month y configuración por defecto de portal con cancelación `at_period_end`, sin prorrateo.
- Price anual test creado bajo el mismo producto: EUR 9600/year. Dos Checkouts alojados, mensual/anual, aceptaron trial siete días y conservaron ID al repetir idéntica clave idempotente.
- TestClock: trial inicial `trialing`, duración **604800 segundos**, importe inicial pagado **0**. Avance posterior: `active`, factura `paid`, importe **1000 céntimos EUR**. Clientes/reloj de validación eliminados y sesiones abiertas expiradas.
- TestClock de periodicidad: el propio servicio programó mensual → anual al fin del trial; conservó mensual y fin de prueba, y repetir la operación devolvió el mismo cambio. Al avanzar, la suscripción pasó a `active`, Price anual, factura `paid` de **9600 céntimos EUR**. El cambio siguiente anual → mensual se programó para renovación anual sin alterar el contrato actual. Schedule, suscripción, cliente, reloj y usuario aislado de comprobación fueron eliminados.
- Local `.env` incorpora solo el anual de test y habilita la oferta anual tras esas verificaciones. Trial permanece deshabilitado por `STRIPE_TRIAL_REMINDERS_VERIFIED=false` hasta verificar la preferencia en Dashboard. La prueba no cambia Prices, webhooks, claves ni variables de producción.

## Límites de la evidencia

No había endpoints de webhook registrados en el sandbox; el listener local se mantiene como entrada y se actualizaron sus tipos de evento. La entrega HTTP externa y la cancelación visual del usuario en Stripe no se afirman realizadas. El portal se verificó por API y el handler con eventos firmados. Stripe no envía recordatorios en sandbox y su preferencia se verifica en Dashboard; el guard queda apagado. UI, build y suite global están registrados en la [evidencia general](../planes-y-permisos/evidence.md).

Versión verificada: SDK 23.0.0 y API 2026-09-30.endive mediante [release oficial](https://raw.githubusercontent.com/stripe/stripe-node/v23.0.0/CHANGELOG.md) y llamadas sandbox actuales.
