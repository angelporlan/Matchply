# Cobertura del inventario funcional

[Volver al índice](README.md)

Mapa de los puntos de entrada encontrados en el código local. Cada página, archivo de rutas HTTP y acción de servidor está asociado a una ficha. Esto comprueba cobertura de inventario, no ejecución satisfactoria, seguridad completa ni disponibilidad de proveedores.

## Páginas

| Página | Implementación | Ficha |
| --- | --- | --- |
| `/login` | [src/app/(auth)/login/page.tsx](<../../src/app/(auth)/login/page.tsx>) | [F02 Registro, acceso, cierre de sesión y datos de cuenta](autenticacion-y-cuenta/estado-actual.md) |
| `/logout` | [src/app/(auth)/logout/page.tsx](<../../src/app/(auth)/logout/page.tsx>) | [F02 Registro, acceso, cierre de sesión y datos de cuenta](autenticacion-y-cuenta/estado-actual.md) |
| `/register` | [src/app/(auth)/register/page.tsx](<../../src/app/(auth)/register/page.tsx>) | [F02 Registro, acceso, cierre de sesión y datos de cuenta](autenticacion-y-cuenta/estado-actual.md) |
| `/admin` | [src/app/admin/page.tsx](<../../src/app/admin/page.tsx>) | [F23 Administración de usuarios y estadísticas](administracion-usuarios/estado-actual.md) |
| `/cookies` | [src/app/cookies/page.tsx](<../../src/app/cookies/page.tsx>) | [F28 Páginas informativas, privacidad y soporte](privacidad-legales-y-soporte/estado-actual.md) |
| `/dashboard/integrations` | [src/app/dashboard/integrations/page.tsx](<../../src/app/dashboard/integrations/page.tsx>) | [F17 Vinculación y captura de ofertas desde Chrome](extension-linkedin/estado-actual.md) |
| `/dashboard/applications/archived` | [src/app/dashboard/applications/archived/page.tsx](<../../src/app/dashboard/applications/archived/page.tsx>) | [F13 Archivo, restauración y borrado de candidaturas](archivo-candidaturas/estado-actual.md) |
| `/dashboard/applications/offer/[id]` | [src/app/dashboard/applications/offer/[id]/page.tsx](<../../src/app/dashboard/applications/offer/[id]/page.tsx>) | [F12 Candidaturas, tablero de postulaciones y detalle de oferta](candidaturas-kanban/estado-actual.md) |
| `/dashboard/applications` | [src/app/dashboard/applications/page.tsx](<../../src/app/dashboard/applications/page.tsx>) | [F12 Candidaturas, tablero de postulaciones y detalle de oferta](candidaturas-kanban/estado-actual.md) |
| `/dashboard` | [src/app/dashboard/page.tsx](<../../src/app/dashboard/page.tsx>) | [F05 Biblioteca de CVs y panel principal](biblioteca-cvs/estado-actual.md) · [F22 Suscripción, Checkout y portal de facturación](facturacion-stripe/estado-actual.md) |
| `/dashboard/profile` | [src/app/dashboard/profile/page.tsx](<../../src/app/dashboard/profile/page.tsx>) | [F10 Perfil profesional, preferencias y reglas de selección](perfil-profesional/estado-actual.md) |
| `/dashboard/subscription` | [src/app/dashboard/subscription/page.tsx](<../../src/app/dashboard/subscription/page.tsx>) | [F22 Suscripción, Checkout y portal de facturación](facturacion-stripe/estado-actual.md) |
| `/editor/[cvId]` | [src/app/editor/[cvId]/page.tsx](<../../src/app/editor/[cvId]/page.tsx>) | [F07 Editor, formato y comparación de cambios](editor-cv/estado-actual.md) |
| `/` | [src/app/page.tsx](<../../src/app/page.tsx>) | [F01 Landing, demostraciones y descubrimiento](landing-y-descubrimiento/estado-actual.md) |
| `/privacy` | [src/app/privacy/page.tsx](<../../src/app/privacy/page.tsx>) | [F28 Páginas informativas, privacidad y soporte](privacidad-legales-y-soporte/estado-actual.md) |
| `/terms` | [src/app/terms/page.tsx](<../../src/app/terms/page.tsx>) | [F28 Páginas informativas, privacidad y soporte](privacidad-legales-y-soporte/estado-actual.md) |
| `/try` | [src/app/try/page.tsx](<../../src/app/try/page.tsx>) | [F03 Prueba sin cuenta y recuperación al registrarse](prueba-invitado/estado-actual.md) |

## Rutas HTTP

Se enumeran los métodos exportados explícitamente; los métodos implícitos del framework no se cuentan.

| Ruta | Métodos | Implementación | Ficha |
| --- | --- | --- | --- |
| `/api/ai/curate` | POST | [src/app/api/ai/curate/route.ts](<../../src/app/api/ai/curate/route.ts>) | [F14 Selección de ofertas con IA y afinidad individual](seleccion-y-afinidad-ofertas/estado-actual.md) |
| `/api/ai/jobs/[id]` | GET | [src/app/api/ai/jobs/[id]/route.ts](<../../src/app/api/ai/jobs/[id]/route.ts>) | [F25 Trabajos IA persistentes, ejecución y reintentos](trabajos-ia-y-reintentos/estado-actual.md) |
| `/api/ai/optimize` | POST | [src/app/api/ai/optimize/route.ts](<../../src/app/api/ai/optimize/route.ts>) | [F09 Optimización de CV para una oferta](optimizacion-cv/estado-actual.md) |
| `/api/ai/outreach` | POST | [src/app/api/ai/outreach/route.ts](<../../src/app/api/ai/outreach/route.ts>) | [F16 Carta de presentación, mensaje de contacto y preparación de entrevista](cartas-contacto-y-entrevistas/estado-actual.md) |
| `/api/ai/profile/extract` | POST | [src/app/api/ai/profile/extract/route.ts](<../../src/app/api/ai/profile/extract/route.ts>) | [F11 Extracción, entrevista y documento profesional con IA](asistente-perfil-ia/estado-actual.md) |
| `/api/ai/profile/interview` | POST | [src/app/api/ai/profile/interview/route.ts](<../../src/app/api/ai/profile/interview/route.ts>) | [F11 Extracción, entrevista y documento profesional con IA](asistente-perfil-ia/estado-actual.md) |
| `/api/auth/[...nextauth]` | GET, POST | [src/app/api/auth/[...nextauth]/route.ts](<../../src/app/api/auth/[...nextauth]/route.ts>) | [F02 Registro, acceso, cierre de sesión y datos de cuenta](autenticacion-y-cuenta/estado-actual.md) |
| `/api/cv/import` | POST | [src/app/api/cv/import/route.ts](<../../src/app/api/cv/import/route.ts>) | [F06 Importación de PDF o texto y conversión con IA](importacion-cv/estado-actual.md) |
| `/api/cv/parse-pdf` | POST | [src/app/api/cv/parse-pdf/route.ts](<../../src/app/api/cv/parse-pdf/route.ts>) | [F06 Importación de PDF o texto y conversión con IA](importacion-cv/estado-actual.md) |
| `/api/extension/linkedin/ingest` | OPTIONS, POST | [src/app/api/extension/linkedin/ingest/route.ts](<../../src/app/api/extension/linkedin/ingest/route.ts>) | [F17 Vinculación y captura de ofertas desde Chrome](extension-linkedin/estado-actual.md) |
| `/api/extension/pair/claim` | OPTIONS, POST | [src/app/api/extension/pair/claim/route.ts](<../../src/app/api/extension/pair/claim/route.ts>) | [F17 Vinculación y captura de ofertas desde Chrome](extension-linkedin/estado-actual.md) |
| `/api/extension/pairings/[id]` | DELETE | [src/app/api/extension/pairings/[id]/route.ts](<../../src/app/api/extension/pairings/[id]/route.ts>) | [F17 Vinculación y captura de ofertas desde Chrome](extension-linkedin/estado-actual.md) |
| `/api/extension/pairings` | GET, POST | [src/app/api/extension/pairings/route.ts](<../../src/app/api/extension/pairings/route.ts>) | [F17 Vinculación y captura de ofertas desde Chrome](extension-linkedin/estado-actual.md) |
| `/api/extension/status` | GET, OPTIONS | [src/app/api/extension/status/route.ts](<../../src/app/api/extension/status/route.ts>) | [F17 Vinculación y captura de ofertas desde Chrome](extension-linkedin/estado-actual.md) |
| `/api/guest` | GET | [src/app/api/guest/route.ts](<../../src/app/api/guest/route.ts>) | [F03 Prueba sin cuenta y recuperación al registrarse](prueba-invitado/estado-actual.md) |
| `/api/health` | GET | [src/app/api/health/route.ts](<../../src/app/api/health/route.ts>) | [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| `/api/pdf` | GET, POST | [src/app/api/pdf/route.ts](<../../src/app/api/pdf/route.ts>) | [F03 Prueba sin cuenta y recuperación al registrarse](prueba-invitado/estado-actual.md) · [F08 Vista previa, generación y descarga PDF](pdf-y-exportacion/estado-actual.md) |
| `/api/research/[offerId]` | GET, POST | [src/app/api/research/[offerId]/route.ts](<../../src/app/api/research/[offerId]/route.ts>) | [F18 Investigación profunda de ofertas y empresas](linkedin-research/estado-actual.md) |
| `/api/research/quota` | GET | [src/app/api/research/quota/route.ts](<../../src/app/api/research/quota/route.ts>) | [F18 Investigación profunda de ofertas y empresas](linkedin-research/estado-actual.md) |
| `/api/stripe/checkout` | GET | [src/app/api/stripe/checkout/route.ts](<../../src/app/api/stripe/checkout/route.ts>) | [F22 Suscripción, Checkout y portal de facturación](facturacion-stripe/estado-actual.md) |
| `/api/stripe/portal` | GET | [src/app/api/stripe/portal/route.ts](<../../src/app/api/stripe/portal/route.ts>) | [F22 Suscripción, Checkout y portal de facturación](facturacion-stripe/estado-actual.md) |
| `/api/stripe/webhook` | POST | [src/app/api/stripe/webhook/route.ts](<../../src/app/api/stripe/webhook/route.ts>) | [F22 Suscripción, Checkout y portal de facturación](facturacion-stripe/estado-actual.md) |
| `/auth/claim` | GET | [src/app/auth/claim/route.ts](<../../src/app/auth/claim/route.ts>) | [F02 Registro, acceso, cierre de sesión y datos de cuenta](autenticacion-y-cuenta/estado-actual.md) · [F03 Prueba sin cuenta y recuperación al registrarse](prueba-invitado/estado-actual.md) |

## Acciones de servidor

Las acciones pueden ser invocables sin tener un control visible que las utilice; las fichas distinguen esos casos.

| Acción | Archivo y línea en esta fotografía | Ficha |
| --- | --- | --- |
| `registerUser` | [src/app/(auth)/actions.ts](<../../src/app/(auth)/actions.ts>) (línea 9) | [F02 Registro, acceso, cierre de sesión y datos de cuenta](autenticacion-y-cuenta/estado-actual.md) |
| `getAdminStats` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 20) | [F23 Administración de usuarios y estadísticas](administracion-usuarios/estado-actual.md) |
| `getUserDetails` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 82) | [F23 Administración de usuarios y estadísticas](administracion-usuarios/estado-actual.md) |
| `getAIConfig` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 123) | [F24 Configuración de IA, modelos y biblioteca de prompts](prompt-defaults/estado-actual.md) |
| `updateAISetting` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 142) | [F24 Configuración de IA, modelos y biblioteca de prompts](prompt-defaults/estado-actual.md) |
| `savePrompt` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 168) | [F24 Configuración de IA, modelos y biblioteca de prompts](prompt-defaults/estado-actual.md) |
| `deletePrompt` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 253) | [F24 Configuración de IA, modelos y biblioteca de prompts](prompt-defaults/estado-actual.md) |
| `togglePromptActive` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 273) | [F24 Configuración de IA, modelos y biblioteca de prompts](prompt-defaults/estado-actual.md) |
| `updateUserRole` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 298) | [F23 Administración de usuarios y estadísticas](administracion-usuarios/estado-actual.md) |
| `updateUserSubscription` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 324) | [F23 Administración de usuarios y estadísticas](administracion-usuarios/estado-actual.md) |
| `togglePromptArchive` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 342) | [F24 Configuración de IA, modelos y biblioteca de prompts](prompt-defaults/estado-actual.md) |
| `getAdminAuditLogs` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 368) | [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| `getAdminAuditStats` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 385) | [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| `getOpenRouterKeyInfo` | [src/app/admin/actions.ts](<../../src/app/admin/actions.ts>) (línea 452) | [F24 Configuración de IA, modelos y biblioteca de prompts](prompt-defaults/estado-actual.md) |
| `setPrincipalCv` | [src/app/dashboard/actions.ts](<../../src/app/dashboard/actions.ts>) (línea 26) | [F05 Biblioteca de CVs y panel principal](biblioteca-cvs/estado-actual.md) |
| `createBaseCv` | [src/app/dashboard/actions.ts](<../../src/app/dashboard/actions.ts>) (línea 64) | [F05 Biblioteca de CVs y panel principal](biblioteca-cvs/estado-actual.md) |
| `deleteCv` | [src/app/dashboard/actions.ts](<../../src/app/dashboard/actions.ts>) (línea 113) | [F05 Biblioteca de CVs y panel principal](biblioteca-cvs/estado-actual.md) |
| `updateCvStyling` | [src/app/dashboard/actions.ts](<../../src/app/dashboard/actions.ts>) (línea 166) | [F07 Editor, formato y comparación de cambios](editor-cv/estado-actual.md) |
| `saveCvContent` | [src/app/dashboard/actions.ts](<../../src/app/dashboard/actions.ts>) (línea 210) | [F07 Editor, formato y comparación de cambios](editor-cv/estado-actual.md) |
| `createCvPlaceholder` | [src/app/dashboard/actions.ts](<../../src/app/dashboard/actions.ts>) (línea 318) | [F05 Biblioteca de CVs y panel principal](biblioteca-cvs/estado-actual.md) |
| `saveUserCareerProfileAction` | [src/app/dashboard/actions.ts](<../../src/app/dashboard/actions.ts>) (línea 448) | [F10 Perfil profesional, preferencias y reglas de selección](perfil-profesional/estado-actual.md) |
| `updateUserNameAction` | [src/app/dashboard/actions.ts](<../../src/app/dashboard/actions.ts>) (línea 494) | [F02 Registro, acceso, cierre de sesión y datos de cuenta](autenticacion-y-cuenta/estado-actual.md) |
| `getOwnedJobOffer` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 48) | [F12 Candidaturas, tablero de postulaciones y detalle de oferta](candidaturas-kanban/estado-actual.md) |
| `exportJobOffersReport` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 73) | [F15 Copia de informes y análisis de candidaturas con IA](informes-y-analisis-candidaturas/estado-actual.md) |
| `updateJobOfferStatus` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 241) | [F12 Candidaturas, tablero de postulaciones y detalle de oferta](candidaturas-kanban/estado-actual.md) |
| `archiveJobOffer` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 284) | [F13 Archivo, restauración y borrado de candidaturas](archivo-candidaturas/estado-actual.md) |
| `restoreArchivedJobOffer` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 325) | [F13 Archivo, restauración y borrado de candidaturas](archivo-candidaturas/estado-actual.md) |
| `archiveMultipleJobOffers` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 362) | [F13 Archivo, restauración y borrado de candidaturas](archivo-candidaturas/estado-actual.md) |
| `updateJobOfferCv` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 417) | [F12 Candidaturas, tablero de postulaciones y detalle de oferta](candidaturas-kanban/estado-actual.md) |
| `deleteJobOffer` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 451) | [F12 Candidaturas, tablero de postulaciones y detalle de oferta](candidaturas-kanban/estado-actual.md) |
| `createJobOffer` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 487) | [F12 Candidaturas, tablero de postulaciones y detalle de oferta](candidaturas-kanban/estado-actual.md) |
| `updateJobOfferDetails` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 531) | [F12 Candidaturas, tablero de postulaciones y detalle de oferta](candidaturas-kanban/estado-actual.md) |
| `analyzeFailuresAction` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 587) | [F15 Copia de informes y análisis de candidaturas con IA](informes-y-analisis-candidaturas/estado-actual.md) |
| `curateOffersWithAiAction` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 626) | [F14 Selección de ofertas con IA y afinidad individual](seleccion-y-afinidad-ofertas/estado-actual.md) |
| `evaluateSingleOfferMatchAction` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 718) | [F14 Selección de ofertas con IA y afinidad individual](seleccion-y-afinidad-ofertas/estado-actual.md) |
| `applyCuratedOffersAction` | [src/app/dashboard/applications/actions.ts](<../../src/app/dashboard/applications/actions.ts>) (línea 776) | [F14 Selección de ofertas con IA y afinidad individual](seleccion-y-afinidad-ofertas/estado-actual.md) |
| `createTrialCv` | [src/app/try/actions.ts](<../../src/app/try/actions.ts>) (línea 31) | [F03 Prueba sin cuenta y recuperación al registrarse](prueba-invitado/estado-actual.md) |

## Componentes, servicios y operación

Las fichas enlazan sus componentes y servicios principales. Este mapa adicional cubre familias de soporte y puntos de entrada fuera de páginas/API.

| Familia | Responsabilidad y ficha |
| --- | --- |
| [src/auth.ts](<../../src/auth.ts>) | [F02 Registro, acceso, cierre de sesión y datos de cuenta](autenticacion-y-cuenta/estado-actual.md) |
| [src/middleware.ts](<../../src/middleware.ts>) | [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| [src/db/schema.ts](<../../src/db/schema.ts>) | [F28 Páginas informativas, privacidad y soporte](privacidad-legales-y-soporte/estado-actual.md) |
| [src/lib/ai-jobs](<../../src/lib/ai-jobs>) | [F25 Trabajos IA persistentes, ejecución y reintentos](trabajos-ia-y-reintentos/estado-actual.md) |
| [src/lib/research](<../../src/lib/research>) | [F18 Investigación profunda de ofertas y empresas](linkedin-research/estado-actual.md) |
| [src/lib/ai-service.ts](<../../src/lib/ai-service.ts>) | [F24 Configuración de IA, modelos y biblioteca de prompts](prompt-defaults/estado-actual.md) |
| [src/lib/i18n](<../../src/lib/i18n>) | [F27 Idioma, tema, navegación y componentes comunes](idioma-tema-y-navegacion/estado-actual.md) |
| [src/components/editor](<../../src/components/editor>) | [F07 Editor, formato y comparación de cambios](editor-cv/estado-actual.md) |
| [src/components/applications](<../../src/components/applications>) | [F12 Candidaturas, tablero de postulaciones y detalle de oferta](candidaturas-kanban/estado-actual.md) |
| [src/components/profile](<../../src/components/profile>) | [F10 Perfil profesional, preferencias y reglas de selección](perfil-profesional/estado-actual.md) |
| [src/components/subscription](<../../src/components/subscription>) | [F17 Vinculación y captura de ofertas desde Chrome](extension-linkedin/estado-actual.md) |
| [src/components/landing](<../../src/components/landing>) | [F01 Landing, demostraciones y descubrimiento](landing-y-descubrimiento/estado-actual.md) |
| [src/components/ui](<../../src/components/ui>) | [F27 Idioma, tema, navegación y componentes comunes](idioma-tema-y-navegacion/estado-actual.md) |
| [chrome-extension](<../../chrome-extension>) | [F17 Vinculación y captura de ofertas desde Chrome](extension-linkedin/estado-actual.md) |
| [docker-compose.yml](<../../docker-compose.yml>) | [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| [docker-compose.prod.yml](<../../docker-compose.prod.yml>) | [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |

### Scripts del repositorio

Inventario operativo y de pruebas; no se ejecutaron por el hecho de aparecer aquí. Los scripts que modifican cuentas, datos o infraestructura no forman parte de la interfaz del usuario.

| Script | Área |
| --- | --- |
| [scripts/ai-jobs.test.ts](<../../scripts/ai-jobs.test.ts>) | [F25 Trabajos IA persistentes, ejecución y reintentos](trabajos-ia-y-reintentos/estado-actual.md) |
| [scripts/ai-worker.ts](<../../scripts/ai-worker.ts>) | [F25 Trabajos IA persistentes, ejecución y reintentos](trabajos-ia-y-reintentos/estado-actual.md) |
| [scripts/application-match.test.ts](<../../scripts/application-match.test.ts>) | [F17 Vinculación y captura de ofertas desde Chrome](extension-linkedin/estado-actual.md) |
| [scripts/curation-constraints.test.ts](<../../scripts/curation-constraints.test.ts>) | [F10 Perfil profesional, preferencias y reglas de selección](perfil-profesional/estado-actual.md) · [F14 Selección de ofertas con IA y afinidad individual](seleccion-y-afinidad-ofertas/estado-actual.md) |
| [scripts/db-tunnel.sh](<../../scripts/db-tunnel.sh>) | [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| [scripts/http-timeout.test.ts](<../../scripts/http-timeout.test.ts>) | [F25 Trabajos IA persistentes, ejecución y reintentos](trabajos-ia-y-reintentos/estado-actual.md) · [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| [scripts/logger.test.ts](<../../scripts/logger.test.ts>) | [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| [scripts/make-admin.ts](<../../scripts/make-admin.ts>) | [F23 Administración de usuarios y estadísticas](administracion-usuarios/estado-actual.md) |
| [scripts/pdf-cache.test.ts](<../../scripts/pdf-cache.test.ts>) | [F08 Vista previa, generación y descarga PDF](pdf-y-exportacion/estado-actual.md) |
| [scripts/profile-classification.test.ts](<../../scripts/profile-classification.test.ts>) | [F10 Perfil profesional, preferencias y reglas de selección](perfil-profesional/estado-actual.md) · [F11 Extracción, entrevista y documento profesional con IA](asistente-perfil-ia/estado-actual.md) |
| [scripts/prompt-defaults.test.ts](<../../scripts/prompt-defaults.test.ts>) | [F06 Importación de PDF o texto y conversión con IA](importacion-cv/estado-actual.md) · [F09 Optimización de CV para una oferta](optimizacion-cv/estado-actual.md) · [F24 Configuración de IA, modelos y biblioteca de prompts](prompt-defaults/estado-actual.md) |
| [scripts/rate-limit.test.ts](<../../scripts/rate-limit.test.ts>) | [F02 Registro, acceso, cierre de sesión y datos de cuenta](autenticacion-y-cuenta/estado-actual.md) · [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| [scripts/research-contracts.test.ts](<../../scripts/research-contracts.test.ts>) | [F18 Investigación profunda de ofertas y empresas](linkedin-research/estado-actual.md) |
| [scripts/research-worker.ts](<../../scripts/research-worker.ts>) | [F18 Investigación profunda de ofertas y empresas](linkedin-research/estado-actual.md) |
| [scripts/seed-audit-logs.ts](<../../scripts/seed-audit-logs.ts>) | [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| [scripts/seed-pro-users.ts](<../../scripts/seed-pro-users.ts>) | [F23 Administración de usuarios y estadísticas](administracion-usuarios/estado-actual.md) |
| [scripts/seed.ts](<../../scripts/seed.ts>) | [F26 Auditoría, salud, límites técnicos y operación](auditoria-y-operacion/estado-actual.md) |
| [scripts/stripe-listen.sh](<../../scripts/stripe-listen.sh>) | [F22 Suscripción, Checkout y portal de facturación](facturacion-stripe/estado-actual.md) |
| [scripts/stripe-subscription.test.ts](<../../scripts/stripe-subscription.test.ts>) | [F04 Planes, límites y permisos funcionales](planes-y-permisos/estado-actual.md) · [F22 Suscripción, Checkout y portal de facturación](facturacion-stripe/estado-actual.md) |
| [scripts/subscription.test.ts](<../../scripts/subscription.test.ts>) | [F03 Prueba sin cuenta y recuperación al registrarse](prueba-invitado/estado-actual.md) · [F04 Planes, límites y permisos funcionales](planes-y-permisos/estado-actual.md) · [F09 Optimización de CV para una oferta](optimizacion-cv/estado-actual.md) |
| [scripts/user-name.test.ts](<../../scripts/user-name.test.ts>) | [F02 Registro, acceso, cierre de sesión y datos de cuenta](autenticacion-y-cuenta/estado-actual.md) |
