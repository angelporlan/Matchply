# Reproducir la verificación

Usar copias aisladas del proyecto, Node20 y PostgreSQL15 desechable. No sobrescribir la `.next` de desarrollo ni reutilizar una base con datos reales. `zip` y `unzip` son necesarios para las pruebas existentes de empaquetado; Playwright se ejecuta con Node22 o posterior.

## Perfiles obligatorios

`INTEGRATION_TEST_DATABASE_URL` debe ser explícita, local y contener `test` en el nombre. El runner configura las variables específicas de cada suite y falla si falta configuración o queda alguna prueba omitida.

```sh
npm run typecheck -- --incremental false
npm run lint
npm test
INTEGRATION_TEST_DATABASE_URL="$INTEGRATION_DB" npm run test:integration
INTEGRATION_TEST_DATABASE_URL="$INTEGRATION_DB" npm run test:integration:single-connection
INTEGRATION_TEST_DATABASE_URL="$MIGRATION_DB" npm run test:integration:migration
python3 -m unittest discover -s scripts/deploy -p '*_test.py'
npm run build
```

Las bases de integración y migración deben estar migradas previamente con `DATABASE_URL=<base de pruebas> npm run db:migrate`. La segunda base es independiente. El perfil de una conexión ejecuta toda la suite de optimización con `DATABASE_POOL_MAX=1`, incluyendo claims, leases, reintentos y preview.

Con una aplicación standalone de pruebas arrancada, ejecutar primero `test:http`; después crear las fixtures de navegador en una base distinta de la utilizada por las integraciones que comprueban conteos globales:

```sh
INTEGRATION_TEST_DATABASE_URL="$BROWSER_DB" INTEGRATION_TEST_APP_URL=http://127.0.0.1:3100 npm run test:http
INTEGRATION_TEST_DATABASE_URL="$BROWSER_DB" npm run perf:seed
npx playwright install chromium
INTEGRATION_TEST_APP_URL=http://127.0.0.1:3100 npm run test:e2e -- --project=regression
```

La aplicación debe usar `$BROWSER_DB`. Las fixtures son tres cuentas `perf-{small,medium,large}@example.test`; su contraseña es `Performance-test-only-123`. El script solo escribe en una base de pruebas local explícita y reemplaza sus propias filas. No proporciona endpoints, bypass de autenticación ni fixtures dentro del producto.

## Mediciones

```sh
INTEGRATION_TEST_DATABASE_URL="$BROWSER_DB" PERF_BUILD=candidate npm run perf:queries
INTEGRATION_TEST_APP_URL=http://127.0.0.1:3100 PERF_BUILD=candidate PERF_SERVER_RUNTIME=Node20 PERF_SAMPLES=3 npm run perf:browser
```

Para repetir la referencia, ejecutar el mismo script de consultas sobre un checkout `d0dfcc2` y usar `PERF_BUILD=d0dfcc2`. El modo de referencia reproduce las ocho lecturas de consumo anteriores. Ambos modos omiten el coste común de autenticar al actor; no son el tiempo HTTP completo.

Consultas: 30 muestras por escenario y perfil, con una ejecución previa de calentamiento, conteo de lecturas y `EXPLAIN (ANALYZE, BUFFERS)` de SELECTs en las fixtures. Navegador: tres muestras son exploratorias; usar `PERF_SAMPLES=30` para una distribución mayor. El runner respeta el rate limit real de PDF mediante pausas entre grupos y registra separadamente documento frío/repetido y navegación cliente en escritorio.

`cold` vacía la caché HTTP de Chromium; cada `goto` carga un documento nuevo. La repetición conserva assets HTTP, y la navegación cliente conserva el Router Cache y prefetch. El proceso web y la caché de PostgreSQL permanecen calientes; no se presenta esto como arranque frío del servidor.

Ejecutar referencia y candidato secuencialmente, sin builds ni pruebas paralelas. Los resultados del navegador se adjuntan como `navigation-metrics` en el reporte JSON de Playwright. `PERF_OUTPUT_DIR` permite conservar cada ejecución por separado. CI conserva las regresiones durante 14 días; las métricas temporales no son assertions de CI.

Para investigar un caso concreto, se puede restringir con `PERF_PROFILES=small,medium`, `PERF_DEVICE=desktop`, `PERF_CACHE=cold`, `PERF_ROUTE=/dashboard` y `PERF_CLIENT_NAV=0`. `PERF_WARM_SERVER=1` realiza una navegación previa antes de medir; debe aplicarse igual a referencia y candidato. Este fue el seguimiento de diez muestras registrado tras las variaciones de la primera ejecución.

## Configuración y memoria

No se cambian límites de producción. El compose de producción declara web de 1 GiB, heap de 768 MiB, dos workers PDF con `resourceLimits` configurado en 256 MiB por worker y caché PDF de 48 MiB. Esos máximos no son reservas: aun así, su suma puede superar el cgroup y no incluye buffers/memoria nativa.

El compose del operador usa un límite web de 768 MiB y obtiene variables del entorno, por lo que no se puede asumir que ambas rutas tienen la misma configuración efectiva. Antes de desplegar, comprobar mediante el operador qué ruta y valores están activos sin imprimir secretos. Conservar pools/concurrencia hasta disponer de RSS sostenido, espera del pool y colas bajo carga representativa.

La medición local usa web de 1 GiB, heap 768 MiB, pool DB8, timeout SQL15s y dos workers PDF. PostgreSQL15 usa su configuración del laboratorio. Los logs añaden `queueWaitMs`, duración total, renders compartidos y número de conexiones en espera. La adquisición de conexiones se mide en las dos APIs de pg (promesa/callback), con contadores acotados y log si tarda ≥25ms; incluye tanto cola como establecimiento de conexión. Las consultas de laboratorio del candidato registran su media. `/api/health` conserva su respuesta simple.

## Entrega y rollback

Los commits separan miniaturas, PDF, frontend, backend y verificación. No hay migraciones nuevas. Al solicitar despliegue, usar el procedimiento existente; si aparecen errores, revertir la imagen/código correspondiente manteniendo la base. No restaurar una base de datos como rollback automático de estas optimizaciones.
