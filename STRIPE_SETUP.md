# Stripe subscriptions

## Variables

Configura estas variables en `.env`:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...
```

`STRIPE_PRICE_ID_PRO` debe ser el price recurrente del producto Pro de Stripe.

## Webhook

Endpoint de la app:

```text
http://localhost:3000/api/stripe/webhook
```

Eventos necesarios:

```text
checkout.session.completed
invoice.payment_succeeded
customer.subscription.updated
customer.subscription.deleted
```

En local, puedes reenviar eventos con Stripe CLI via Docker:

```bash
./scripts/stripe-listen.sh
```

Copia el `whsec_...` que devuelve Stripe CLI a `STRIPE_WEBHOOK_SECRET` y recrea el contenedor web para que Docker vuelva a leer `.env`:

```bash
docker compose up -d --force-recreate web
```

## Flujo implementado

- `/api/stripe/checkout` crea el cliente Stripe si falta y abre Checkout para el plan Pro.
- Si el usuario ya tiene una suscripcion activa o en prueba, `/api/stripe/checkout` lo envia al portal de facturacion.
- `/api/stripe/portal` abre el portal de Stripe para gestionar metodo de pago o cancelar.
- `/api/stripe/webhook` sincroniza `stripeCustomerId`, `stripeSubscriptionId` y `subscriptionStatus`.
- La app considera Pro los estados Stripe `active` y `trialing`.
