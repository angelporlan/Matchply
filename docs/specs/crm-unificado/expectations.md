# Criterios de aceptación

| ID | Contrato | Resultado verificable |
| --- | --- | --- |
| AC-01 | REQ-01/02/03 | Las tres rutas reutilizan controles de vista, columnas, cabeceras, estrella y paginación. Guardar y recargar recupera configuración; habilitar campos conserva el orden previo. |
| AC-02 | REQ-02/09 | Vistas existentes siguen siendo de Postulaciones; nombres iguales y predeterminadas de diferentes entidades coexisten. Los presets solo admiten guardar como. |
| AC-03 | REQ-04/06, INV-03 | SQL filtra antes del límite; conteos, página y selección global coinciden. Exportación usa propiedad/IDs seleccionados y avisos de límites. |
| AC-04 | REQ-05, INV-01/02 | Dos usuarios de una empresa compartida tienen favoritos independientes. Repetir el mismo estado es seguro; IDs ajenos o lote parcialmente inválido no cambian filas. Fechas/hash se conservan. |
| AC-05 | REQ-05, INV-04 | Favoritos de Postulaciones incluye archivadas. Quitar el último favorito muestra vacío y página 1; estrella no navega y error revierte el estado. |
| AC-06 | REQ-07, INV-01 | Cambio parcial de estado conserva notas/perfil; alta modal mantiene vínculos entrantes. Empresas con postulaciones conserva su protección contra borrado. |
| AC-07 | INV-03/04 | Personas con varias empresas aparece una vez; vínculos ordenados y cargados solo para las filas obtenidas. Payloads sin contenido pesado ni imágenes binarias. |
| AC-08 | REQ-08 | Revisar las tres rutas en ambos idiomas/temas, escritorio y móvil. Escape/flechas en menús, foco del modal, estrella con espacio/Enter y filtros desde la barra. |

Verificación automatizada: `scripts/crm-views.test.ts`, `scripts/crm.integration.test.ts` y suite existente. Integración únicamente en base local cuyo nombre incluya `test`, con fixtures sintéticos y limpieza. Verificación visual en navegador con cuenta sintética temporal.
