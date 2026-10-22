# Verificación local — 22 de octubre de 2026

Completion gate: PASS para foto opcional y contactos adaptables (REQ-01/02/03/04/05, INV-01).

- Migración 0041 generada y aplicada al desarrollo local y a una BD aislada creada vacía. Todos los CVs existentes conservan `showPhoto=false`; las imágenes por CV permanecen en tabla separada con borrado en cascada.
- Integraciones Postgres y HTTP reales: valor predeterminado, foto de cuenta, sustitución independiente, restauración, ocultar/reactivar, propiedad, documentos de lectura, generación en curso, origen ajeno, carga excesiva, JPEG inválido y descarga PDF con/sin imagen comprobados.
- `cv-layout.test.ts` y `cv-photo-pdf.test.ts`: seis contactos cortos en tres filas, frontera exacta de media columna, entradas largas a ancho completo y mismas posiciones de fila en PDF. Las tres familias tipográficas conservan el registro de saltos.
- La revisión de varias páginas detectó y corrigió una viñeta que podía paginar por separado de su texto, generando una página casi vacía. Hay una regresión que comprueba contenido textual en todas las páginas.
- PDFs con foto, sin foto, nombre largo y varias páginas generados y renderizados con Poppler. Cabecera, recorte rectangular, texto legible, separadores y continuidad revisados visualmente.
- Editor recorrido con usuario y CV desechables en BD aislada: desactivado inicialmente, foto de cuenta al activar, persistencia tras recargar, ocultación y acceso al cambio de imagen por teclado. Papel blanco conservado en tema oscuro. La subida y restauración también se verificaron mediante HTTP; no se automatizó el selector nativo de archivos.
- `npm test` con ambas integraciones nuevas habilitadas: 422 correctas, 18 integraciones ajenas omitidas, cero fallos. `npm run typecheck` y `npm run build`: correctos. `npm run lint`: correcto con las advertencias previas de hooks. `git diff --check`: correcto.
- Caché PDF incluye hash de foto y versión de layout. Renderizador de workers recompilado y web de desarrollo reiniciada para cargarlo. Producción no modificada.

Capturas de comprobación con datos ficticios: [foto y foco de teclado](qa/editor-foto.png), [tema oscuro](qa/editor-foto-oscuro.png), [contactos en columnas](qa/contacto-columnas.png).

No se repitió un recorrido completo en inglés ni una revisión de todos los tamaños móviles. Los textos nuevos tienen ES/EN y el documento A4 mantiene su escala al cambiar el ancho disponible.
