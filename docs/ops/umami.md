# Umami en Matchply

Umami es la medición agregada de tráfico acordada. La recogida solo se habilita si:

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

## Embudo de producto

Los eventos usan el transporte manual y las mismas exclusiones de Umami: desactivado, Do Not Track, administrador e impersonación. Un fallo de medición no debe impedir la acción del usuario. No se cambian los gates para instrumentar el embudo.

| Evento | Cuándo | Propiedades permitidas |
| --- | --- | --- |
| `landing_viewed` | Entrada visible en `/` | Ninguna |
| `trial_started` | Entrada en `/try` | Ninguna |
| `cv_imported` / `cv_import_failed` | CV guardado/importado o fallo del intento | `method`: `pdf` o `text`; fallo: `error_code` público |
| `offer_imported` | URL importada con descripción utilizable | `method`: `url`, `domain` |
| `offer_pasted` | Primera descripción manual utilizable en el formulario | `method`: `paste`, `domain` si se proporcionó enlace |
| `offer_import_failed` | URL fallida o texto inválido al salir del campo | `method`, `domain` opcional, `error_code` público |
| `cv_optimization_started` | Inicio de optimización o generación de variante | `mode` |
| `cv_optimized` / `cv_optimization_failed` | Resultado completado o fallo observado | `mode`; fallo: `error_code` público |
| `cv_downloaded` | PDF recibido y descarga iniciada | Ninguna |
| `signup_completed` | Alta nueva por email o Google | Ninguna |

`domain` contiene únicamente el hostname del enlace, sin usuario, contraseña, ruta, query ni fragmento. Se excluyen IPs y destinos locales. El transporte descarta propiedades adicionales: nunca envía texto de CV/oferta, nombres, correos, IDs de cuenta/documento/petición ni excepciones. Los códigos se limitan al catálogo de errores públicos.

Los resultados de optimización se deduplican por petición en memoria (hasta 256 marcas), incluido un reintento por conexión perdida. Las visitas se deduplican mientras se permanece en la misma ruta y las ediciones continuas de una descripción no cuentan como nuevas ofertas. No se identifica a personas ni se añaden identificadores persistentes de analítica; una recarga o nueva pestaña puede generar otra visita/intento. Los fallos de conexión pueden recuperarse y completar: no equivalen por sí solos a trabajos de IA fallidos.

En `/admin/traffic` aparecen todos estos eventos. En Umami se pueden desglosar sus propiedades por dominio, método, modo o código. Son conteos desde su publicación, no reconstruyen cuántas personas de campañas anteriores probaron el producto. Los bloqueadores del navegador pueden impedir la medición.

Pruebas: `scripts/funnel-events.test.ts`, `scripts/landing-experiment.test.ts` y la regresión de navegador con transporte sintético aislado. En CI los flags se habilitan solo para el servidor de pruebas y el script se intercepta; no se envían eventos al servicio de producción.
