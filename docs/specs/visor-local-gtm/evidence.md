# Evidencia — visor local de ejecuciones GTM

Fecha: 2026-09-22

## Automatizada

- `node --import tsx --test scripts/gtm.test.ts` → 3/3 tests correctos.
- `node --import tsx --test scripts/*.test.ts` con loopback permitido → 183 correctos, 2 skips existentes, 0 fallos.
- `npm run typecheck` → correcto.
- `npm run build` → correcto; Next compiló `/gtm`, `/api/gtm/content` y
  `/api/gtm/search`.
- `git diff --check` → correcto.
- `git check-ignore -v docs/gtm/runs/...` → confirma la regla `docs/gtm/`.

## Manual/local

- `GET http://localhost:3100/gtm` sin sesión → `307` a `/login?callbackUrl=%2Fgtm`.
- `GET http://localhost:3100/api/gtm/search?q=aha` sin sesión → `403` JSON.
- La misma API con `Host: example.com` → `404`.

La suite completa escribe advertencias de conexión a una base de datos de
prueba apuntada a `127.0.0.1:1`; son fallbacks ya existentes y no afectan al
resultado de los tests.
