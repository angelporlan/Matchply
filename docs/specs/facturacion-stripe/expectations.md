# Expectativas de facturación

Referencia: [especificación](spec.md) y [plan](plan.md).

| ID | Escenario | Resultado requerido | Verificación |
| --- | --- | --- | --- |
| EXP-F22-01 | Catálogo mensual/anual | Solo acepta EUR 1000/month y EUR 9600/year activos y de intervalo unitario | Pruebas puras y sandbox |
| EXP-F22-02 | Trial nuevo con tarjeta | Dura 604800 segundos, factura inicial cero, cobra modalidad elegida al finalizar | Reloj Stripe sandbox |
| EXP-F22-03 | Regreso tras un trial o pago | No recibe otra prueba; abandono incompleto no consume elegibilidad | Prueba pura e integración DB |
| EXP-F22-04 | Repetición y doble clic | Un Customer y un Checkout compatible; conflicto de UUID/modalidad y concurrencia sin duplicados | Integración DB y idempotencia Stripe |
| EXP-F22-05 | Retorno de otra cuenta | Rechaza acceso a la sesión y no cambia derechos | Integración DB |
| EXP-F22-06 | Webhook repetido o antiguo | Deduplica IDs, normaliza facturas históricas y usa estado actual, sin reactivar ni cancelar otra suscripción | Prueba pura e integración firmada |
| EXP-F22-07 | Pago pendiente o fallido | No activa ni extiende período Pro; datos se conservan | Política e integración DB |
| EXP-F22-08 | Cancelación | Portal al final del período, acceso hasta su vencimiento, selección Free recalculada en transición | Sandbox de portal e integración DB |
| EXP-F22-09 | Exposición A/B | Variante estable; eventos repetidos y primer resultado no duplican conteos; primer pago positivo por cuenta atribuible sin duplicarlo en renovación o nueva suscripción | Pruebas puras e integración DB |
| EXP-F22-10 | Oferta desactivada o mal configurada | Conserva mensual heredado válido; no ofrece trial/anual inválidos; portal existente disponible | Catálogo y revisión operativa |

Las cuotas y selección de CVs se verifican en el subsistema de [planes](../planes-y-permisos/spec.md). La verificación backend no equivale a una compra de producción ni a una prueba visual completa.
