# Plan aprobado: prueba Pro, anual y conversión medible

Decisiones aprobadas el **4 de octubre de 2026**: [especificación](spec.md), [planes](../planes-y-permisos/spec.md), [expectativas](expectations.md).

1. Mantener mensual EUR 10 y alias Price existente; añadir anual EUR 96 y catálogo validado en servidor. Cambiar Checkout a POST autenticado y conservar GET como redirección compatible.
2. Añadir prueba con tarjeta siete días, elegibilidad persistente e historial Stripe, idempotencia y bloqueo por cuenta. Suscriptores existentes gestionan su contrato en portal.
3. Persistir Price, periodicidad, trial, acceso pagado, cancelación y primer resultado; ampliar webhook a estados y pagos actuales, con deduplicación y consulta de estado vigente. No activar acceso por una URL.
4. Registrar presentación A/B estable y eventos funcionales, con conversiones procedentes de Stripe. Compartir cuotas Pro de prueba/pago sin reinicios. El admin controla límites y copy, sin alterar Prices.
5. Actualizar SDK a 23.0.0 / API 2026-09-30.endive; conservar normalización de facturas anteriores y Node 20 de Docker. Verificar política, integración DB aislada, fixtures firmados y Stripe sandbox.
6. Activar ofertas nuevas solo con catálogo y portal comprobados. Conservar mensual heredado y datos existentes. Registrar evidencia y dejar producción pendiente de su validación y despliegue explícitos.

Backend y comprobaciones de sandbox realizados: [evidencia](evidence.md). La interfaz se integra con la implementación de planes/paywall del mismo cambio.
