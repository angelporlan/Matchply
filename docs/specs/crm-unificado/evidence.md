# Evidencia de verificación

Fecha: 03/10/2026. Entorno: checkout local, Next.js 14, PostgreSQL 15 de Docker, navegador integrado de Codex. Migración `0032_yummy_johnny_blaze.sql` aplicada en desarrollo y en `matchply_crm_test`; producción no intervenida.

## Automatizada

- Suite completa con las variables de integración apuntando a `matchply_crm_test`: 321 pruebas, todas pasan; sin omitidas.
- CRM: normalización por catálogo, operadores/rangos, orden, presets e indicador de cambios; aislamiento entre usuarios, reintentos, transacción de lote inválido, archivadas favoritas, fechas/hash IA, SQL antes de paginar, relaciones múltiples, payload ligero, página vacía, estado parcial e importación antigua. Tras ajustar la carga de relaciones por página: 10 pruebas de CRM pasan.
- `npm run typecheck`: pasa.
- `npm run lint`: pasa, únicamente advertencias ya existentes en componentes ajenos a este cambio.
- `npm run build`: compila, valida tipos y genera las 35 páginas estáticas.

## Navegador

Cuenta sintética de QA con 32 empresas/postulaciones y 31 personas, sin datos reales:

- Empresas: vista Favoritos, retirada de última fila, guardar/recargar vista, predeterminar, agrupar por página/revertir, selección de página (25) y global (32), favorito en lote, diálogo de campos y copia TSV de 32 filas más cabecera. CSV dispara la descarga y muestra confirmación; el navegador integrado no devolvió el archivo mediante su evento de descarga.
- Personas: filtro multiselección de estado con total 16, cambio parcial de una fila con total 15, guardar/recargar la misma denominación usada en Empresas y alta mediante formulario modal. Escape devuelve el foco.
- Favoritos: provocar una membresía sintética inexistente devuelve error, revierte la estrella y conserva la ruta. Estrella comprobada también con espacio del teclado.
- Postulaciones: preset Favoritos contiene la candidatura archivada y conserva estrella/estado/acciones.
- Español/inglés y claro/oscuro: textos y controles revisados; menú numérico de Empresas muestra comparadores funcionales. Revisión de las tres rutas en móvil a 390×844 con tarjetas, selección, estrella y acceso superior a filtros/columnas; búsqueda ocupa una línea completa y los menús ajustan sus límites al viewport.

Fixtures y cuenta temporal retirados tras verificar; viewport restablecido.

No se midieron cargas de 10.000 registros ni tiempos p95; los límites se validan en servidor. No se certifica una auditoría WCAG completa.

Seguimiento de Personas para invitados (2026-10-03): 322 pruebas pasan, sin fallos ni omisiones; typecheck, lint y build correctos (lint conserva avisos anteriores). Integración PostgreSQL verifica cola de IA con transporte LLM simulado, transferencia del grafo completo de propiedad, conservación de favoritos/fechas y conflictos de vistas. Navegador local: invitado ve Personas, crea contacto por modal, cambia estado, marca favorito y conserva ambos cambios tras recargar. Captura: `personas-invitado.png` en los artefactos de esta conversación. Invitado sintético retirado tras verificar. No se invocó un LLM real durante estas comprobaciones.
