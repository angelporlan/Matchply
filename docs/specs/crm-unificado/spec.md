# CRM unificado de Postulaciones, Empresas y Personas

Estado: implementado en desarrollo · 03/10/2026. Contrato aprobado por el usuario en esta conversación. Referencias visuales: `/dashboard/applications` y [design.md](../../../design.md).

## Contrato

- REQ-01: las tres tablas comparten selector de vistas, columnas, menús de cabecera, filtros, agrupación por página, selección, exportación y paginación. Conservar renderizadores y acciones propios de cada entidad.
- REQ-02: vistas personales con guardar, guardar como, renombrar, eliminar, predeterminar, revertir e indicador de cambios. Los presets son de solo lectura; nombres, predeterminadas, cookies y preferencias son independientes por entidad.
- REQ-03: conservar columnas, orden, anchos y posición de Acciones. Activar una columna no reordena las ya elegidas. Empresas añade Creación; Personas ofrece las siete columnas principales y los campos adicionales aprobados.
- REQ-04: todos los operadores visibles funcionan en SQL: texto, multiselección de estados/empresas, fechas relativas/rangos/presencia y comparadores numéricos. Filtrar y contar antes de paginar.
- REQ-05: estrella fija junto al checkbox, accesible con teclado y `aria-pressed`, sin abrir ficha; mutación optimista con reversión en error. Favoritos individuales/en lote y preset por sección; Postulaciones incluye archivadas.
- REQ-06: selección de página y acción explícita para todos los resultados, máximo 10.000. CSV/TSV con elección de campos, máximo 1.000 y aviso. Páginas de 10/25/50/100, por defecto 25.
- REQ-07: Personas cambia estado individual/en lote mediante actualización parcial. Alta en modal reutilizando su formulario y los vínculos de empresa/oferta. Conservar las acciones de Postulaciones y el borrado protegido de Empresas.
- REQ-08: tarjetas móviles con estrella, selección y acciones; filtros y columnas accesibles desde la barra. Compatibilidad español/inglés y claro/oscuro.
- REQ-09: migración aditiva local, conservación de IDs/configuraciones existentes y compatibilidad de importaciones antiguas. Producción queda fuera.

## Invariantes

- INV-01: identidad derivada de sesión; validar propiedad de todas las filas antes de escribir. Favorito de empresa pertenece a `user_company`, nunca al catálogo compartido.
- INV-02: marcar favoritos no cambia `updatedAt` ni el contexto/hash de IA. Usar estado explícito, de forma idempotente.
- INV-03: listados con proyecciones ligeras, sin informes, descripciones, notas privadas completas, CVs completos ni binarios. Relaciones de personas limitadas a filas de página/exportación; conteos privados sin multiplicar filas.
- INV-04: una persona aparece una vez; agrupación por conjunto de empresas ordenado. Al retirar favoritos, refrescar total y ajustar la página válida.

Interfaces: `application_view.entity`; `filters.favoritesOnly`; `setRowsFavoriteAction(entity, ids, isFavorite)`; consultas de página/IDs/exportación normalizadas por catálogo. Las acciones antiguas de vistas de Postulaciones mantienen sus firmas.

Ver [expectations.md](expectations.md), [plan.md](plan.md) y [evidence.md](evidence.md).
