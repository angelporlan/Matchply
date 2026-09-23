#!/usr/bin/env sh
set -eu

if [ ! -f .env ]; then
  echo "Missing .env file"
  exit 1
fi

read_env() {
  value=$(grep "^$1=" .env | head -n 1 | cut -d= -f2-)
  value=${value#\"}
  value=${value%\"}
  value=${value#\'}
  value=${value%\'}
  printf '%s' "$value"
}

MODE="$(read_env STRIPE_MODE)"
if [ "$MODE" = "production" ]; then
  echo "STRIPE_MODE is production. This listener must use the test key, not the live one."
  exit 1
fi

STRIPE_SECRET_KEY="$(read_env STRIPE_TEST_SECRET_KEY)"
if [ -z "$STRIPE_SECRET_KEY" ]; then
  STRIPE_SECRET_KEY="$(read_env STRIPE_SECRET_KEY)"
fi

if [ -z "$STRIPE_SECRET_KEY" ] || [ "$STRIPE_SECRET_KEY" = "sk_test_..." ]; then
  echo "Set STRIPE_TEST_SECRET_KEY in .env before starting the webhook listener."
  exit 1
fi

case "$STRIPE_SECRET_KEY" in
  sk_live_*)
    echo "The selected key is live. Local subscription tests must use STRIPE_TEST_SECRET_KEY."
    echo "Keep STRIPE_MODE=test, then recreate the web container so it reloads the environment."
    exit 1
    ;;
  sk_test_*)
    ;;
  *)
    echo "STRIPE_TEST_SECRET_KEY must start with sk_test_ for local tests."
    exit 1
    ;;
esac

TTY_FLAGS=""
if [ -t 0 ]; then
  TTY_FLAGS="-it"
fi

docker run --rm $TTY_FLAGS \
  --add-host=host.docker.internal:host-gateway \
  stripe/stripe-cli listen \
  --events checkout.session.completed,invoice.payment_succeeded,customer.subscription.updated,customer.subscription.deleted \
  --api-key "$STRIPE_SECRET_KEY" \
  --forward-to "http://host.docker.internal:3000/api/stripe/webhook"
