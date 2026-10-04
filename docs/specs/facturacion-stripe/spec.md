# Suscripción, Checkout y portal de facturación

Estado: **Aprobado e implementado en local**. Decisiones acordadas con el usuario el **4 de octubre de 2026**. El backend está verificado con pruebas aisladas y Stripe sandbox; producción no intervenida.

Referencias: [plan aprobado](plan.md), [expectativas verificables](expectations.md), [evidencia](evidence.md), [límites Free/Pro](../planes-y-permisos/spec.md) y [configuración operativa](../../monetization-billing.md).

## Resultado para la persona

Free permite obtener un resultado útil antes de pagar. Tras el primer CV adaptado completado, aparece una oferta Pro que se puede cerrar. Al alcanzar un límite, la aplicación explica bolsa, saldo y renovación y ofrece una mejora sin perder el resultado ni los datos existentes.

Pro cuesta **10 EUR/mes** o **96 EUR/año**, equivalente a 8 EUR/mes y ahorro del 20 %. El mensual está seleccionado inicialmente. Las personas elegibles pueden iniciar **siete días de prueba con tarjeta**, una vez por cuenta; al finalizar se cobra la modalidad elegida salvo cancelación anterior. Durante la prueba se aplican límites Pro normales, compartidos con el consumo del mes; convertir o cambiar de periodicidad no reinicia cuotas.

## Compra y ciclo de vida

- El CTA autenticado abre Checkout alojado en dos pasos de producto: oferta y confirmación. Registro, autenticación adicional y campos de pago de Stripe conservan su flujo propio. Invitados guardan su resultado al registrarse antes de comprar.
- Una cuenta con prueba previa o suscripción pagada anterior no recibe otra prueba. Abandonar una sesión sin comenzar una suscripción no consume el trial.
- Checkout permite códigos promocionales. Importes y modalidad se validan contra Prices de servidor; el cliente no puede elegir un Price arbitrario ni cambiar el importe.
- Suscriptores vigentes y cobros pendientes se dirigen al portal. Cancelar conserva acceso hasta el final del período o prueba; después aplica Free según la selección de CVs definida en planes. No se añade una garantía de reembolso ni un flujo de reembolso.
- `trialing` vigente concede Pro. `active` concede Pro cuando existe factura confirmada y período pagado vigente. Un pago asíncrono pendiente no activa ni extiende acceso. Un estado de impago conserva datos pero no otorga acceso Pro; una concesión administrativa vigente sigue siendo una fuente independiente de acceso.
- Impuestos y datos de facturación conservan la configuración Stripe existente. No se activa cálculo fiscal automático en este cambio. El portal debe permitir cancelar al final del período y gestionar facturación.

## Contratos y seguridad

`POST /api/stripe/checkout` acepta `interval: monthly|annual`, UUID de solicitud, origen funcional opcional y destino interno opcional. Requiere cuenta real y origen propio. Devuelve una URL alojada, una indisponibilidad de configuración o un conflicto recuperable. Las sesiones de soporte no pueden comprar ni gestionar facturación.

El GET legado redirige a planes sin crear recursos. Cliente, intención y Checkout se serializan por cuenta y se protegen con idempotencia. Repetir una solicitud reutiliza la sesión abierta; cambiar su modalidad con el mismo UUID es un conflicto. Cambiar de modalidad con nueva solicitud expira la sesión anterior.

La propiedad del retorno se verifica contra usuario y Customer. Visitar `checkout=success` no prueba un pago ni genera una conversión. Los webhooks firmados deduplican IDs, consultan estado Stripe vigente dentro del bloqueo por cuenta y soportan payloads de factura antiguos y actuales. Un evento de una suscripción anterior no puede cancelar ni sustituir una vigente.

## Experimento y activación

El paywall asigna A/B 50/50 estable por cuenta y versión. A destaca conservar versiones; B destaca volumen y matching. Los textos se editan en admin con variantes ES/EN; ambos grupos mantienen exactamente precios, acceso y límites iguales. Modo fijo A/B y pausa permiten controlar el experimento. Las métricas cuentan cuentas expuestas, clics, sesiones, trials y el primer pago positivo por cuenta durante 30 días; renovaciones y nuevas suscripciones de la misma cuenta no repiten esa conversión. No hay selección automática de ganador.

La oferta mensual heredada permanece disponible con un Price válido. El anual requiere `STRIPE_MONETIZATION_ENABLED=true`, catálogo válido y portal de cancelación verificado. El trial exige además `STRIPE_TRIAL_REMINDERS_VERIFIED=true`, que queda apagado hasta verificar los recordatorios en Dashboard. El anual se habilitó únicamente en local test tras las pruebas de sandbox. El alta del anual de producción, recordatorios y versión/eventos de su webhook se verifican antes de activar allí; este trabajo no publica ni cobra en producción.
