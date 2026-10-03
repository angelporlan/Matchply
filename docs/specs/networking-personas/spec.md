# Personas: CRM de networking

Estado: implementación autorizada el 03/10/2026. Contrato: plan de Personas aprobado en el chat y ampliación posterior de captura de foto. Primera versión: contactos privados, texto pegado, seguimientos internos y foto visible del contacto capturada opcionalmente, con iniciales de respaldo.

## Comportamiento

- Postulaciones → Personas, junto a Empresas. Acceso para registrados Gratis/PRO; invitados excluidos. La extensión también pasa a registrados, mientras investigación profunda/API de agentes siguen en PRO.
- Listado paginado en servidor (25), búsqueda nombre/cargo, empresa, estado, seguimientos vencidos. Sin notas extensas, conversaciones, originales, informes ni CVs en su proyección/RSC.
- Perfil con nombre obligatorio, URL LinkedIn normalizada, email, cargo/titular/tipo, ubicación, origen, objetivo, temas, notas, estado, próxima acción/fecha e idioma/tono. Vínculos múltiples con empresas (trabaja/recluta/sin confirmar) y ofertas del propietario. Alta desde listado/empresa/oferta; detalle de empresas/ofertas muestra solo contactos propios.
- Hilos LinkedIn/email/otro. Pegar hasta 120.000 caracteres, guardar original, organizar por IA en fragmentos con offsets al original. Vista editable de autor/contenido/fecha; incorporar solo selección confirmada. Consulta/copia del original e historial; alta/corrección/eliminación manual de mensajes.
- Hash por hilo para importación idéntica; confirmación transaccional única. Solapamientos ordenados se señalan para revisión; nunca se deduplican mensajes por texto aislado. Las fechas/autores no determinados se revisan. Los contenidos elegidos son fragmentos literales del original.
- Asistente: tres primeros acercamientos, respuesta, preparación y siguiente paso. Combina ficha/vínculos, hilo/oferta elegidos y opcionalmente perfil/CV. Hechos, hipótesis, recomendaciones, ganchos y preguntas separados. No inventar afinidades, experiencia, promesas ni rasgos personales. Borradores para envío manual. Seguimiento se guarda al confirmar una recomendación vigente.

## Contratos y fallos

`POST /api/ai/networking`: sesión registrada y actor válido, mismo origen, cuerpo acotado; referencias UUID a persona/hilo/importación/oferta, `requestId`, `includeCandidate`. Acciones `parse_conversation|first_contact|reply|conversation_prep|next_step`. Respuesta `202 {jobId}`; polling privado de `/api/ai/jobs/[id]` devuelve solo referencias al resultado/importación. Seis solicitudes/minuto/usuario y un trabajo queued/running/persona. Ninguna cuota de CV. Reintentos técnicos limitados a tres intentos, con lease/heartbeat y publicación condicionada al intento vigente. Un fallo permanente permite crear un nuevo intento desde UI.

Función configurable `networking`, OpenAI GPT-6 Luna por defecto para Gratis/PRO, Responses API, JSON Schema estricto, validación adicional, `store:false`, timeout y AbortSignal. Sin clave, rechazo o salida inválida: error explícito, sin resultados ficticios ni pérdida del original/historial. Los payloads de cola contienen referencias, nunca conversaciones. Cada resultado guarda selección de contexto/hash para detectar cambios.

Personas y registros derivados están asociados al usuario. FKs compuestas impiden vínculos cruzados, incluso a nivel PostgreSQL. Borrar persona elimina mensajes, hilos, originales, resultados y jobs. Quitar empresa/oferta elimina vínculos, conserva persona. Trabajos comprueban existencia y lease antes de publicar. Auditoría/métricas contienen identificadores, códigos, duración y tokens; excluyen emails, notas y mensajes.

## Extensión

Ajuste `Capturar personas`, apagado por defecto. Captura exclusivamente tarjetas visibles de `.hirer-card__hirer-information` dentro del detalle de oferta y modal de contactos abierto por el usuario. No usa clases genéricas ni abre «Mostrar todo», perfiles o mensajes. Nombre, URL, titular, grado y procedencia; máximo 20 por petición. Resumen «Yasser y otras personas» no identifica contactos.

Ingesta acepta `people?`; extensiones antiguas siguen funcionando. `/api/extension/linkedin/people` solo permite contactos de una oferta LinkedIn del usuario del token. Captura adicional y recaptura conservan análisis/CV/cartas/ediciones de oferta. Un fallo de contactos no invalida la oferta guardada. Seguimiento separado de oferta/firmas de contactos, por instalación (evita mezcla al cambiar de cuenta); escucha los ajustes modernos y heredados. Modo automático incorpora novedades con cooldown; manual necesita el botón. No se llama a IA al capturar. URL normalizada deduplica por usuario, campos vacíos se completan y se preservan ediciones manuales. Anunciante se vincula como «recluta para»; contactos de red sin evidencia de empleo quedan «sin confirmar».

El ajuste advierte de que LinkedIn prohíbe extensiones que copien perfiles y puede restringir cuentas. Lectura visible no implica permiso; alta manual disponible. [Restricciones oficiales](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions).

## Diseño y ampliaciones

Fuente visual: `design.md`, navegación neutra, alta verde, IA violeta, claro/oscuro y es/en. Tabs con navegación de teclado y etiquetas accesibles; tarjetas en móvil. Archivos adjuntos, simulación, sincronización automática de chats y notificaciones externas quedan fuera de esta versión.

## Ampliación: foto del contacto

Solicitud posterior del usuario: guardar también la imagen de la persona desde la extensión. «Capturar personas» incluye la foto de la tarjeta visible, cuando existe. No se visita el perfil para buscar fotos ni se guardan avatares genéricos o logos.

La extensión lee la URL de la imagen de la misma persona en el DOM. El worker de extensión descarga únicamente fotos de perfil HTTPS del CDN de LinkedIn (`licdn.com`), sin cookies, redirecciones ni credenciales, y las convierte en una miniatura JPEG de hasta 192 × 192 px y 48 KiB. La copia se envía después de guardar el contacto a `POST /api/extension/linkedin/people/avatar`, separada de la ingesta para mantener payloads pequeños. La URL temporal no se guarda en Matchply.

Persistencia privada: `person.avatarHash` en la proyección y `person_avatar` separado para los bytes. El endpoint exige token vigente, permiso, perfil propio y vínculo con la oferta propia. `GET /api/people/[id]/avatar` exige sesión registrada y propiedad; respuestas privadas sin caché compartida. Borrar la persona elimina su foto. No hay descarga remota en servidor; fotos y URLs de LinkedIn quedan fuera de prompts y auditoría. Los listados/RSC excluyen bytes y solo contienen la referencia al endpoint privado. La foto no modifica el contexto del asistente ni invalida sus borradores.

Listado, ficha y contactos de empresa/oferta muestran la miniatura. Sin foto o ante error de carga muestran iniciales. Un error de foto conserva contacto, historial, análisis de oferta y foto anterior; permite reintentar sin repetir en cada mutación del DOM. Las extensiones anteriores y contactos sin foto mantienen compatibilidad.

### Subida manual y edición desde la cabecera

La foto de la cabecera es un botón: al pasar el cursor o enfocarlo con teclado se oscurece y muestra un lápiz. Pulsarlo abre el selector de archivos. En dispositivos sin hover, una pequeña marca de lápiz permanece visible. No se duplica la foto en una sección adicional. Funciona también cuando solo hay iniciales.

La subida acepta JPG, PNG y WebP de hasta 10 MB y 16 megapíxeles. El navegador recorta al centro, compone transparencias sobre blanco y genera el mismo JPEG de hasta 192 × 192 px y 48 KiB que la extensión, con los mismos pasos de calidad. El original no se envía al servidor. `POST /api/people/[id]/avatar` comprueba sesión registrada, origen, propiedad, formato, dimensiones y tamaño, con límite de solicitudes y cuerpo acotado. Un fallo conserva la foto anterior y se muestra de forma accesible.

No hace falta LinkedIn ni una oferta vinculada para subir manualmente. La procedencia `person_avatar.source` distingue `manual` de `linkedin`; las fotos manuales tienen prioridad ante posteriores capturas, incluso concurrentes. La imagen queda fuera del contexto de IA y su cambio no altera el orden de contactos.

Referencias técnicas: [peticiones cross-origin de extensiones](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests), [createImageBitmap en workers](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/createImageBitmap), [OffscreenCanvas.convertToBlob](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob).
