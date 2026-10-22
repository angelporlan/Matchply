# Evidencias · 22/10/2026

Implementación y verificación locales. No se ha publicado en producción, activado correo ni ejecutado llamadas reales a proveedores de IA. No se modifican precios, facturación ni selección de proveedores.

## Resultado por requisito

| Requisito | Implementación y comprobación |
| --- | --- |
| REQ-01 Blog | Ocho versiones completas en `src/content/blog.ts`, cuatro fuentes originales, límites de interpretación y ejemplos ilustrativos. Prueba HTTP de las ocho páginas sin JavaScript, idioma frente a cookies/cabeceras falsas, canonical/alternates/JSON-LD, 308, 404, CTA de visitante y sitemap sin rutas privadas. QA de lectura ES/EN en escritorio y móvil, temas claro/oscuro; sin desbordamiento horizontal en móvil. |
| REQ-02 Importación | Se reutiliza el importador; la candidatura se valida por propietario y el destino vuelve al mismo detalle con «Continuar adaptación». Login conserva el retorno mediante la intención de autenticación existente. Si desaparece la oferta, se vuelve a la biblioteca y no se elimina el CV importado. Se conserva el contexto en errores/reintentos. Revisión de código y pruebas existentes de intención/claim; no se ha ejecutado una conversión con un proveedor real. |
| REQ-03 Cartas | Validador de estructura y contenido mínimo; prueba de JSON inválido, incompleto y placeholders, y prueba con proveedor simulado que confirma como máximo dos llamadas al mismo proveedor/modelo. Publicación y consumo en una transacción solo después de validar; el catch libera la reserva. La suite existente verifica reservas, publicación e idempotencia. Los errores no registran la salida del modelo ni el CV. |
| REQ-04 Seguimiento | Pruebas unitarias de cinco días de calendario en Madrid, fecha omitida/null, repetición y estados terminales. Integración PostgreSQL: replay, comando contradictorio, versión antigua, completar/posponer, propietario ajeno y respuesta explícita. QA: programar/completar en detalle y completar desde tabla; historial conservado. Lotes mantienen éxitos parciales. |
| REQ-05 Documentos | Integración PostgreSQL: deduplicación, bytes iguales tras edición/borrado, procedencia original conservada, propiedad, traslado de invitado, documento compartido entre envíos y borrado al eliminar el último, limpieza temporal sin borrar documentos frescos. HTTP: descargar, confirmar, cambiar contenido/foto, eliminar CV editable y recuperar bytes iguales desde la ruta histórica; visitante sin acceso. QA: confirmación con candidatura/PDF concretos y enlace posterior en historial. |
| REQ-06 Perfil/evidencia | Casos sintéticos ES/EN y prompts para profesiones diversas y primer empleo; categorías y preferencias antiguas se conservan. Runtime y depuración comparten prompts. Integración: añadir a la última versión, preservar preferencias, repetir sin duplicar, rechazar requisito desactualizado/ajeno e invalidar el matching anterior. Guardar no llama IA ni cambia directamente la puntuación; una nueva optimización utiliza la admisión existente con fuentes nuevas. |
| REQ-07 Medición | Hitos explícitos, cohorte de ofertas guardadas en 30 días, denominador visible y cantidad sin registro. La prueba de integración confirma que no hay respuesta antes del evento explícito. Acciones, consultas y evidencias aportadas/reutilizadas se cuentan por separado. CTA usa el evento Umami existente y la ruta pública identifica artículo/idioma, sin contenido personal. |

## Comprobaciones ejecutadas

- `npm test` con bases PostgreSQL locales aisladas y servidor HTTP de QA: **566 pruebas correctas, 0 fallos, 0 omitidas**.
- Prueba HTTP adicional de conservación con una cuenta Gratis: correcta. Matriz de clasificación ES/EN ampliada a las siete trayectorias y herramientas aisladas: diez pruebas relevantes correctas.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto, con seis avisos previos de hooks en ResearchPanel, EditorCvMenu, MarkdownEditor, ResumeSheet y useCvGenerationAnimation. Sin avisos nuevos.
- `npm run build`: correcto en una copia del checkout con artefactos de compilación aislados del servidor de desarrollo. Incluye los workers y las rutas públicas nuevas.
- `npm run db:generate`: genera 0042 y 0043. `npm run db:migrate`: aplicadas en bases locales de pruebas y en desarrollo local. Sin `db:push` ni acceso a producción.
- `git diff --check`: correcto. Proyecciones de listados revisadas: solo próxima acción y versión añadidas; bytes, informes, cartas y Markdown completo quedan fuera.

El aislamiento de administración evita mezclar sus conteos con fixtures de otros tests. Se retiraron únicamente dos registros de auditoría sembrados por migraciones en su base desechable de pruebas; no se borró auditoría de desarrollo o producción.

## Límites y operación

Estas pruebas no demuestran calidad de respuestas de modelos reales ni aumento de entrevistas. La evidencia declarada sigue requiriendo revisión de la persona. No se han realizado sesiones con candidatos reales; el protocolo está en [interview-evaluation.md](interview-evaluation.md).

La limpieza periódica depende del worker existente; no se configura un servicio nuevo. Las copias anteriores a esta funcionalidad no se reconstruyen. Las exportaciones no confirmadas caducan a los 30 días. La deduplicación conserva la procedencia de la primera exportación de esos bytes por propietario.

El paso a producción y la reversión están descritos en [release.md](release.md). Los documentos y eventos deben conservarse si se revierte el código.

Captura de la vista pública: [Blog en español, escritorio](qa/blog-es-desktop.png).
