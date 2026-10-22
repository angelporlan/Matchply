# Publicación y reversión

La implementación está en el checkout local. Este documento no certifica un despliegue en matchply.com.

## Orden de salida

1. Fase 1: blog ES/EN, importación contextual y validación de cartas/mensajes. Comprobar redirección, 404, idioma, CTA y recuperación de errores.
2. Fase 2: aplicar `0042_majestic_freak.sql` y `0043_ordinary_smasher.sql` con `npm run db:migrate` antes del código que utiliza las columnas/tablas. Publicar web y worker de la misma revisión. Comprobar envío, acción pendiente, historial y descarga privada.
3. Fase 3: publicar perfil generalista y aportaciones. Recalcular y regenerar siguen siendo acciones explícitas, con las fuentes actuales y el consumo mostrado por la app.
4. Fase 4: habilitar la vista del embudo ya incluida en administración y comenzar el protocolo de evaluación. La analítica existente respeta su configuración y DNT; esta entrega no la activa si está deshabilitada.

En un despliegue conjunto se mantiene el mismo orden de migraciones y publicación. Hacer copia de la base según el procedimiento operativo existente. Las migraciones son aditivas: no reescriben los estados históricos, no programan acciones retroactivas y no reconstruyen PDFs enviados anteriormente.

## Comprobación posterior

- `GET /api/health`; `/blog` devuelve 308; ambas traducciones y sitemap usan el dominio público configurado.
- Candidatura sintética: programar, posponer, completar, confirmar envío y volver a descargar el documento.
- Worker: primera limpieza tras un minuto; después cada hora, máximo 100 exportaciones por pasada. Requiere el worker existente en funcionamiento.
- Revisar errores estructurados; no habilitar correo ni cambiar proveedores, precios o facturación para probar.

## Reversión

Volver a la revisión de código anterior conservando las migraciones, exportaciones, bytes y eventos. No ejecutar migraciones destructivas ni borrar las tablas nuevas al revertir. El código anterior ignora esas tablas/columnas. Una reversión puede dejar temporalmente sin interfaz los registros nuevos, que volverán a estar disponibles al recuperar la revisión.

## Traslado de datos

`scripts/export-user-data.mjs` conserva el formato principal versión 1 y añade la extensión opcional `continuity.version = 1`. El importador admite paquetes anteriores sin esa extensión y restaura los eventos directamente, sin ejecutar transiciones. Los bytes llevan tamaño y SHA-256 verificados; la procedencia original es metadato histórico, y `cvId` mantiene el vínculo editable cuando el CV esté incluido. El importador limita el volumen de documentos y rechaza referencias o propietarios incompatibles.
