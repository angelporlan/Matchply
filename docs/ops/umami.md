# Umami en Matchply

Umami es la medición agregada de tráfico acordada. La recogida **permanece desactivada** hasta que:

1. El contenedor esté aislado en el VPS (`umami` + `umami_db` en `docker-compose.prod.yml`).
2. `UMAMI_ENABLED=true` y `UMAMI_AEPD_CLEARED=true` tras evaluar la [guía de cookies analíticas de la AEPD](https://www.aepd.es/guias/guia-cookies-analiticas-externas.pdf).
3. El script y la API no expongan el dashboard ni credenciales de lectura.

## Despliegue

- Imagen fijada: `ghcr.io/umami-software/umami:postgresql-v2.18.1`
- Base propia (no reutilizar `nextprof_db`)
- Puerto solo en loopback: `127.0.0.1:3001`
- Conservación prevista: 12 meses (configurar retención en Umami)
- Copias: incluir el volumen `umami_postgres_data` en el backup del VPS

## Variables

Ver `.env.example`. El cliente solo recibe `NEXT_PUBLIC_UMAMI_WEBSITE_ID` y `NEXT_PUBLIC_UMAMI_SCRIPT_URL`. El token de API se usa en servidor para `/admin/traffic`.

## Qué no se envía

Correos, IDs de usuario, contenido de CVs u ofertas, perfiles. Las rutas se normalizan (`:id`) y el referente se reduce a su origen. Administración, desarrollo e impersonación no miden.

## Evaluación AEPD

Si la configuración no cumple las condiciones de medición exenta (IP truncada, sin identificadores persistentes de persona, sin cruce con cuentas, finalidad estrictamente estadística), no activar `UMAMI_AEPD_CLEARED`.
