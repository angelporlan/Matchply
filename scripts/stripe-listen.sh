#!/usr/bin/env sh
set -eu

if [ ! -f .env ]; then
  echo "Missing .env file"
  exit 1
fi

STRIPE_SECRET_KEY="$(grep '^STRIPE_SECRET_KEY=' .env | sed 's/^STRIPE_SECRET_KEY=//')"

if [ -z "$STRIPE_SECRET_KEY" ] || [ "$STRIPE_SECRET_KEY" = "sk_test_..." ]; then
  echo "Set STRIPE_SECRET_KEY in .env before starting the webhook listener."
  exit 1
fi

case "$STRIPE_SECRET_KEY" in
  sk_live_*)
    echo "STRIPE_SECRET_KEY is a live key. Local subscription tests must use a test key: sk_test_..."
    echo "Copy it from Stripe Dashboard with Test mode enabled, then restart: docker compose restart web"
    exit 1
    ;;
  sk_test_*)
    ;;
  *)
    echo "STRIPE_SECRET_KEY must start with sk_test_ for local tests."
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
  --api-key "$STRIPE_SECRET_KEY" \
  --forward-to "http://host.docker.internal:3000/api/stripe/webhook"
