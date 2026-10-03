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
