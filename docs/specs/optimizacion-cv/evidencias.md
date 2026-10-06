# Evidencias de implementación — 03/10/2026

Alcance: [spec.md](spec.md). Criterios: [expectativas.md](expectativas.md). Activación: [plan.md](plan.md).

## Comprobaciones automáticas

- `node --import tsx --test scripts/offer-import.test.ts`: **13 pruebas pasan**. JSON-LD (arrays/@graph y HTML codificado), selectores, ofertas ajenas, SSRF, DNS fijado al socket, redirecciones, tamaño, cancelación de DNS, modelo sin herramientas, búsqueda obligatoria, fuentes, rechazo, JSON incompleto, configuración ausente y política de errores transitorios del transporte/cuerpo.
- PostgreSQL local aislado: `offer_import_test_20261003`, creado con el esquema local sin filas de usuarios. Pruebas de ambas colas ejecutadas juntas: **16 pasan**, incluyendo las cuatro de importación (raíz y tres subcasos). Verifican petición simultánea, propiedad, conflicto de URL, lease caducado, resultados antiguos y tres intentos solo para errores transitorios. CI configura `OFFER_IMPORT_TEST_DATABASE_URL` para ejecutar estos casos.
- `npm test`: **271 pruebas, 268 pasan, tres omisiones por configuración de integración**. Las pruebas de cola omitidas por defecto se ejecutaron explícitamente en la base aislada. El test de persistencia de matching ajeno a este cambio mantiene su configuración propia.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; incluye `/api/ai/offers/import`.
- `npm run lint`: ejecutado, **no verificable**: `next lint` solicita crear la configuración ESLint que falta en el repositorio y termina con código 1.
- `git diff --check`: correcto.

## OpenAI y oferta reales

URL: https://www.linkedin.com/jobs/view/4465816694/.

`scripts/offer-import-smoke.ts` realizó llamadas reales a Responses con `gpt-6-luna`. La descarga pública y estructuración directa identificaron **Software Development Engineer**, **Letmino AI**. El respaldo se ejercitó haciendo fallar únicamente la descarga en el harness: la búsqueda y estructuración de Luna fueron reales, con fuente del mismo empleo, y devolvieron una descripción de 7.253 caracteres. No hubo respuestas de modelo simuladas en esta comprobación.

La revisión del HTML real detectó que LinkedIn codificaba las etiquetas en JSON-LD. Se añadió limpieza y fixture. La comprobación HTTP final con el worker devolvió la descripción limpia de **7.025 caracteres**, conservando requisitos y condiciones. La redirección española corresponde al mismo identificador.

`scripts/offer-import-api-smoke.ts` verificó HTTP + Postgres + worker reales: 401 sin actor, 400 para URL privada, 403 para origen ajeno, origen público HTTPS detrás de proxy, 202, deduplicación simultánea, 404 para otro actor y 409 al reutilizar requestId con otra URL. Ocho peticiones por actor y límite adicional por IP se comprobaron reutilizando el mismo trabajo, sin crear ocho importaciones. El almacenamiento del limitador se comparte por proceso para resistir los distintos módulos de Next y sus recargas.

Los logs registraron `sourceMethod`, duración y tokens de OpenAI. Los scripts de smoke no imprimen claves ni el contenido completo de la oferta. Cada smoke HTTP elimina sus invitados en `finally`.

## Navegador local

- Try invitado: campo URL como única entrada normal, progreso, revisión, descripción desplegable, creación sin oferta y alternativa manual funcionando sin clave en el worker. Inferencia manual comprobada con puesto y empresa explícitos.
- Dashboard invitado y cuenta registrada sintética: importación real, revisión, modos y checkbox de candidatura conservados. Cambiar URL deshabilita la adaptación y elimina los datos anteriores.
- Resultado antiguo real: cambiar URL durante «Preparando los datos», esperar a que el worker completase y comprobar que la vista mantuvo el nuevo enlace sin oferta y con adaptación deshabilitada. El trabajo terminó sin CVs ni candidaturas adicionales.
- Cuenta sintética PRO: adaptación real completada en el editor, CV guardado y candidatura con título/empresa/plataforma/URL importados. La adaptación no creó otro trabajo `import_offer`.
- Antes de continuar desde try: cero CVs, candidaturas y membresías de empresa para el invitado. Antes de adaptar en dashboard: ninguna candidatura y ningún CV adicional por importar/cancelar.
- Teclado: foco inicial en URL; Shift+Tab circular; Escape cierra y devuelve el foco al activador. Modos utilizables con Enter y selección anunciada mediante `aria-pressed`.
- Español/inglés y tema claro/oscuro comprobados. Try se verificó a 375 px sin desbordamiento; modal en disposición móvil con controles apilados y scroll interno. No se ha realizado una auditoría completa con lector de pantalla ni de todos los breakpoints de design.md.

Capturas de revisión guardadas localmente: `/private/tmp/matchply-offer-try.jpg` y `/private/tmp/matchply-offer-dashboard.jpg`.

## Producción y publicación

La skill privada de operaciones consultó estado y nombres de variables, sin leer sus valores. Release activa `dcee29018176a9855736e29b57729cec8e42c28f`, web y PostgreSQL saludables; workers en marcha. **No figura `OPENAI_API_KEY` en la configuración activa**.

No se ha hecho merge ni despliegue de este cambio. El workflow publica desde `main` y la skill exige autorización expresa para el merge. Antes de activar la web, configurar la clave mediante el canal protegido de operaciones y publicar/verificar el worker compatible. El operador versionado activa los servicios juntos; el rollout por etapas debe conservar inicialmente la imagen web vigente y actualizar el worker, antes de la release completa. No hay migraciones en este cambio.

Los datos y la base aislada creados para las pruebas se eliminan al terminar. Las verificaciones locales y del proveedor no sustituyen la comprobación posterior a publicar en ambas vistas de producción.

La revisión automática bloqueó el push. Se comprobó que `angelporlan/Matchply` es un repositorio **público** y que la cuenta activa tiene permisos de administrador. La rama está guardada localmente; publicar código, pruebas y documentación en ese remoto y hacer merge quedan pendientes de autorización. No se ha creado un PR remoto.

## Tres variantes — 06/10/2026

El bloque anterior corresponde a la importación de ofertas del 03/10. Las siguientes comprobaciones corresponden al incremento REQ-V01–06 / EXP-V01–08. En esta implementación no se ha intentado publicar ni se ha recibido un rechazo automático de aprobación.

### Implementación

- Un análisis compartido y tres generaciones independientes, con fuentes y configuración congeladas; máximo tres llamadas de generación simultáneas por trabajo. Se mantienen los IDs `optimize_honest`, `optimize_adapted` y `optimize_aggressive`.
- Cola `optimize_cv_variants`, checkpoints, admisión y reintentos idempotentes, fence por lease/intento y liquidación transaccional. Un conjunto usa un destino y una unidad. Los modos correctos sobreviven a errores parciales; el reintento no repite análisis, cuota ni modos disponibles.
- Migración aditiva Drizzle `0038_yellow_jocasta.sql`, generada y aplicada tanto a la base local como a la base aislada de pruebas. Tabla de optimización, variantes por modo/revisión y referencia nullable en CV. Los listados conservan sus proyecciones ligeras; contenido de las variantes, fuentes y análisis se cargan en el detalle del editor.
- Dashboard, editor, detalle/modal de candidatura y prueba de invitado utilizan 202 + polling. La candidatura existente se vincula al publicar, sin crear una segunda. Se retira el selector previo; la explicación indica tres versiones y una optimización.
- Guardado central serializado, revisión por modo, comparación contra la fuente congelada, selección atómica y PDF con modo explícito. Los gaps y hasta cinco sugerencias de métricas permanecen fuera del documento.
- Validación de JSON/citas, hechos de perfil frente a preferencias, placeholders, Markdown, historial, métricas, niveles y alias tecnológicos; un intento de corrección. Un error de análisis no registra fragmentos personales procedentes del parser JSON. Duración/tokens/errores se registran por modo sin contenido del CV.

### Pruebas automáticas

- `scripts/cv-optimization.test.ts`: **4 pruebas pasan**. Citas inexistentes pierden respaldo; JSON inválido genera un código sanitizado; se detectan placeholders, tecnologías/métricas/niveles inventados y datos históricos ausentes. Se prueban títulos repetidos, alias reales y exclusión de preferencias del perfil; el límite de seis viñetas pertenece solo al modo Fiel.
- `scripts/cv-optimization.integration.test.ts` contra PostgreSQL aislado `matchply_cv_variants_test_20261006`: **11 pruebas pasan**, incluidas raíz y diez subcasos. Comprueban admisión simultánea, consumo único, candidatura única, propietario, revisión CAS, guardado tardío en otra variante, fuente inmutable, fallo parcial/reintento gratuito, lease caducado, fallo total y devolución de cuota, transferencia de invitado en curso, CV de solo lectura Free y recuperación Pro, última tentativa del worker, vinculación de candidatura existente y barrera de tres generaciones simultáneas.
- Caso adicional de recuperación: borrar la candidatura después de generar los checkpoints conserva el documento previo y devuelve la reserva. La liquidación comprueba el enlace antes de modificar el destino.
- `npm test`: **369 pruebas; 355 pasan, 14 omisiones de integración sin configuración, cero fallos**. La integración de variantes omitida por defecto se ejecutó explícitamente en la base aislada.
- `npm run typecheck`, `npm run lint` y `npm run build`: **correctos**. Lint conserva avisos de hooks anteriores en ResearchPanel, EditorCvMenu, MarkdownEditor y ResumeSheet, sin errores.
- `git diff --check`: correcto.

### Proveedor, navegador y PDF

Se creó un invitado y un CV exclusivamente ficticios (Ana Pérez, `ana@example.test`). El worker local ejecutó el proveedor configurado, OpenAI `gpt-6-luna`: análisis compartido y tres variantes disponibles, Equilibrado activo al terminar. La comprobación final de Postgres registró **tres variantes listas y una unidad consumida**. Esta comprobación del proveedor no utiliza respuestas simuladas.

- Se editó Equilibrado y se alternó antes de vencer el guardado diferido. Al volver se recuperó exactamente la edición; las otras variantes conservaron su contenido. Se restauró después el documento ficticio limpio.
- La vista de comparación permanece seleccionada al alternar. El PDF solicita el modo visible y espera al guardado. Se comprobó la descarga desde Máximo matching y la confirmación posterior de la UI; el binario descargado por el navegador no se recuperó para inspección.
- `scripts/cv-optimization-pdf-smoke.ts` renderizó los contenidos reales de las tres variantes mediante el motor PDF existente. **Los tres tienen una página A4**; sus PNG se inspeccionaron visualmente, sin texto cortado, placeholders ni sugerencias de revisión en el documento. Resúmenes y prioridades diferentes conservan historial y métricas declaradas.
- Selector y textos comprobados en español/inglés, ambos temas, teclado con Enter y `aria-pressed`, y viewport de 375 px CSS sin desbordamiento horizontal; botones con altura mínima de 44 px. No se ha realizado una auditoría completa con lector de pantalla ni de todos los breakpoints.

Capturas: `/tmp/matchply-cv-variants-light.jpg`, `/tmp/matchply-cv-variants-dark.jpg`, `/tmp/matchply-cv-variants-mobile.jpg`. PDFs de revisión: `/tmp/matchply-cv-variants-pdfs/optimize_honest.pdf`, `optimize_adapted.pdf` y `optimize_aggressive.pdf`.

Se eliminaron el invitado sintético y la base aislada después de las pruebas. El worker local se reinició con el código final. Las verificaciones de hechos detectan errores concretos; no certifican semánticamente todas las afirmaciones del CV.

### Activación pendiente

La implementación está verificada y la migración aplicada **en local**. El usuario eligió expresamente **mantenerlo en local por ahora**. No se han cambiado producción, `main` ni el remoto. La rama actual contiene además 19 commits anteriores sobre planes, Stripe, extensión, cuentas y landing respecto al `origin/main` local; publicarla y fusionarla supone una release más amplia que este incremento. El rollout documentado conserva el orden: copia de seguridad, migración, worker compatible y web; queda para una futura publicación autorizada y su comprobación operativa posterior.
