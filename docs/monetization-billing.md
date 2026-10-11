# Facturación y medición de conversión

La compra usa Stripe Checkout alojado: 10 EUR al mes o 96 EUR al año (20 % de ahorro), con siete días de prueba y tarjeta para cuentas elegibles. Las cuotas del plan anual y de la prueba siguen el mes natural definido por el servicio de planes; no hay una bolsa anual ni un reinicio al convertir la prueba en pago.

## Configuración

- `STRIPE_MODE=test|production` selecciona claves, webhook y precios del entorno.
- `STRIPE_*_PRICE_ID_PRO_MONTHLY` selecciona el mensual; si no está configurado, se conserva `STRIPE_*_PRICE_ID_PRO` como alias compatible.
- `STRIPE_*_PRICE_ID_PRO_ANNUAL` debe ser un Price activo EUR 9600, recurrente cada año. El mensual debe ser EUR 1000, cada mes. No se aceptan importes, intervalos ni monedas enviados por el cliente.
- `STRIPE_MONETIZATION_ENABLED=true` habilita la oferta anual y permite ofrecer trial después de sus comprobaciones adicionales. Por defecto las nuevas ofertas permanecen desactivadas; la compra mensual heredada sigue disponible si su Price es válido, sin añadir prueba. El catálogo valida cada precio y un portal por defecto activo con cancelación al final del período. Si falta un Price, solamente esa modalidad queda deshabilitada. El portal de suscriptores existentes sigue disponible con el interruptor apagado.
- `STRIPE_TRIAL_REMINDERS_VERIFIED=true` permite ofrecer los siete días de prueba únicamente después de verificar los recordatorios en el Dashboard de Stripe del entorno. Por defecto es `false`, también en local. El anual permanece disponible con catálogo y portal verificados aunque este segundo interruptor esté apagado. Un Checkout abierto con condiciones de trial incompatibles se expira antes de preparar otro.
- El precio y el cobro los gobierna Stripe. `/admin/plans` modifica límites y mensajes; no modifica Prices ni renueva, cobra o cancela suscripciones.

Antes de activar en un entorno, verificar precios, portal, recordatorios de final de prueba y eventos del webhook. No habilitar impuestos automáticos sin la configuración fiscal correspondiente. El cambio no modifica el tratamiento fiscal existente.

Los recordatorios se configuran en [Subscriptions and emails](https://dashboard.stripe.com/settings/billing/automatic), activando el correo de fin de prueba y el enlace a una página alojada por Stripe. La API pública no permite confirmar esta preferencia. Stripe no envía estos correos en sandbox; por ello las pruebas de reloj y webhook no demuestran entrega del correo y no habilitan ese interruptor. La aplicación muestra el fin de la prueba, el importe posterior y acceso al portal durante su vigencia. [Documentación de recordatorios](https://docs.stripe.com/billing/subscriptions/trials/manage-trial-compliance).

## Interfaces

`GET /api/stripe/catalog` devuelve moneda, importes, disponibilidad mensual/anual y elegibilidad de prueba para la cuenta autenticada. `POST /api/stripe/checkout` acepta `{ interval: 'monthly' | 'annual', requestId: UUID, source?: string, returnTo?: string }` y devuelve `{ url }`. Requiere sesión real y origen propio; las sesiones de soporte no pueden comprar. El GET antiguo redirige a la página de planes sin crear clientes ni sesiones.

El servicio serializa compras por cuenta, reutiliza un Checkout abierto compatible y usa claves idempotentes en Stripe. Ya suscritos o con pago pendiente van al portal para evitar una segunda suscripción. Una prueba anterior o una suscripción previa hacen que una cuenta deje de ser elegible, incluso después de cancelar. Abandonar un Checkout sin iniciar la prueba no consume esa oportunidad.

`GET /api/stripe/interval` devuelve periodicidad y precio actuales, fecha de renovación y cambio programado. `POST /api/stripe/interval` recibe `{ interval, requestId: UUID }` y programa el cambio mediante Subscription Schedules para la siguiente renovación, con sesión real, origen propio y bloqueo por cuenta. La fase actual conserva su Price y las condiciones del contrato, sin prorrateo ni factura inmediata. La fase futura cobra el Price validado de la nueva modalidad. Repetir una solicitud devuelve el cambio existente; elegir la modalidad actual retira el cambio futuro. Suscripciones con cancelación prevista, actualizaciones pendientes, artículos especiales o schedules ajenos se gestionan en el portal.

`GET /api/stripe/status?session_id=...` comprueba cliente y propietario, recupera estado actual y concilia acceso. No registra una conversión por visitar el retorno. Un cobro asíncrono pendiente sigue pendiente. La aplicación muestra fecha de trial, período pagado, cancelación programada y modalidad real.

El webhook verifica la firma del cuerpo original. Soporta Checkout, pagos de factura, creación/actualización/cancelación y prueba de suscripción. Deduplica IDs de evento en Postgres y recupera estado actual dentro del bloqueo por cuenta; no ordena por segundos de `event.created`. Un evento de una suscripción antigua no sustituye otra suscripción vigente. Los payloads de factura anteriores a la actualización de API también se normalizan.

`GET /api/monetization` ofrece presentación y límites Pro para interpolar textos. `POST /api/monetization` registra `paywall_view`, `paywall_cta`, `quota_warning` o `quota_blocked`; variante y versión las asigna el servidor. `GET /api/monetization/metrics` requiere administrador y admite `?version=1`. Los resultados son cuentas únicas con exposición y ventana de atribución de 30 días, separados por variante. La conversión trial a pago se calcula además sobre trials con al menos 14 días de antigüedad para no mezclar pruebas recientes. La primera factura positiva confirmada cuenta como conversión; una factura de prueba de cero euros no cuenta. La clave `first-paid:usuario` evita volver a contar renovaciones y nuevas suscripciones de esa cuenta, incluso en otras versiones del experimento.

## Compatibilidad y pruebas

SDK fijado en `stripe@23.0.0` y API `2026-09-30.endive`; Node 20 mínimo, ya utilizado por Docker. No se cambia automáticamente la versión predeterminada de la cuenta Stripe ni un endpoint de producción. Cuando se actualice su versión, el lector conserva compatibilidad con facturas antiguas pendientes de reenvío.

Verificación de sandbox del 4 de octubre de 2026:

- Mensual EUR 1000/month activo y portal por defecto con cancelación `at_period_end` comprobados mediante la API actual.
- Anual EUR 9600/year creado en modo test bajo el mismo producto.
- Dos Checkouts, mensual y anual, aceptaron prueba de siete días y devolvieron el mismo ID ante una repetición con idéntica clave idempotente.
- Un reloj de prueba confirmó exactamente 604800 segundos de prueba, factura inicial de cero euros y transición a `active` con factura pagada de EUR 1000 al avanzar el reloj.
- Otro reloj verificó el servicio de cambio de periodicidad: mensual y trial permanecen vigentes hasta su fin; la fase anual empieza en esa fecha y cobra una factura de test de EUR 9600. El cambio posterior a mensual queda programado en la siguiente renovación anual, conservando el período anual pagado. Repetir la primera operación no crea otro schedule.
- Checkouts abiertos, clientes y reloj de validación se eliminaron o expiraron; se conserva el Price anual de sandbox para desarrollo. No se usaron claves de producción ni dinero real.

Pruebas puras: `node --import tsx --test scripts/billing-policy.test.ts scripts/stripe-subscription.test.ts`. Cubren catálogo, lista de intervalos, facturas antiguas/nuevas, período por item, elegibilidad, cobro pendiente, detalles de suscripción y asignación A/B estable.

La integración aislada `scripts/billing.integration.test.ts` añade concurrencia, firma y deduplicación, facturas fuera de orden, fin de trial/cancelación/fallo de pago, límites de atribución, guard de recordatorios y preservación de contratos al programar periodicidad.

Fuentes oficiales: [Stripe Node 23](https://raw.githubusercontent.com/stripe/stripe-node/v23.0.0/CHANGELOG.md), [pruebas en Checkout](https://docs.stripe.com/payments/checkout/free-trials), [webhooks](https://docs.stripe.com/webhooks).
