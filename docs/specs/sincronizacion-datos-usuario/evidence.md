# Evidencia

## Implementación

- PR [#3](https://github.com/angelporlan/Matchply/pull/3) fusionado en `0eed07372330642fc6d0ff4c4bf83afeb6adbc33`: contrato, validación, merge transaccional, bloqueo por cuenta y auditoría resumida.
- PR [#4](https://github.com/angelporlan/Matchply/pull/4) fusionado en `278deb3d4c5b56765243755b344fecc191d2830f`: transporte gzip para que el paquete pueda atravesar el límite de 1 MiB de Nginx, manteniendo el límite de 8 MiB antes y después de descomprimir.
- CI del PR gzip: workflow `35570101484`, checks y build correctos. Despliegue de producción: workflow `35570305264`, checks, imágenes y deploy correctos.

## Sincronización de `angelporlandev@gmail.com`

Fecha: 2026-09-21. Paquete `payloadSha256=79bb7bb94375145e98e3a65d8432b1aa549e816129d3a2df06369f3460b711a1`.

La importación respondió `200` y confirmó estos recuentos:

| Recurso | Importados |
| --- | ---: |
| CV | 6 |
| Empresas | 214 |
| Iconos de empresa | 191 |
| Membresías de empresa | 214 |
| Notas de empresa | 0 |
| Ofertas | 303 |
| Vistas del tablero | 2 |
| Investigaciones terminadas | 11 |
| Runs de agentes terminados | 55 |
| Fuentes de investigación | 0 |

El paquete no contenía campos prohibidos ni trabajos pendientes. La importación se hizo dos veces durante la prueba aislada y fue idempotente; la ejecución de producción terminó con éxito en una sola transacción.

## Producción y recuperación

- Release activa: `278deb3d4c5b56765243755b344fecc191d2830f`, `legacy=false`; web y Postgres aparecen `healthy` y la aplicación responde `ready`.
- Backup previo a la importación en el VPS: `/var/backups/matchply/backup-20260921T064351282832Z`.
- Backup generado al retirar la configuración temporal: `/var/backups/matchply/backup-20260921T065947364264Z`.
- `MATCHPLY_USER_IMPORT_TOKEN` fue eliminado; `env-list` confirmó que ya no figura entre las variables activas.
- Una petición sin token al endpoint devuelve `404`, por lo que el canal queda cerrado tras la operación.
- Los ficheros locales que contenían el paquete, la respuesta y el token fueron eliminados después de verificar la operación.
