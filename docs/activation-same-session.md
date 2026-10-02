# Activación en la misma sesión

Rama: `feat/activation-same-session` (desde `283ddb1`).

Activación = el mismo usuario genera `cv_optimize_ai` y `cv_download_pdf` en menos de 5 minutos. El registro reclama el borrador del invitado y abre el editor.

## 1. Commits por fase

### Comprobación previa (sin commit de modelo)

`DEFAULT_FREE_MODEL` y `DEFAULT_PRO_MODEL` en `src/lib/models.ts` son `gpt-6-luna`, proveedor `openai`. `defaultAiRuntimeConfig()` en `src/lib/ai-runtime-config.ts` enruta free y pro a ese par y marca `tested.ok: true`. La tabla es `ai_runtime_config` (Drizzle `aiRuntimeConfigs`). `/api/ai/optimize` resuelve el modelo con esa config o, si no hay fila, con el fallback del código. No se cambió el modelo. No se llamó a un proveedor en vivo: hace falta una clave de OpenAI y una fila de runtime (o el fallback) para que el stream funcione.

### `6bdc38c` feat(claim): open the adapted CV after a guest claim

- `src/lib/actor.ts`
- `src/lib/claim-destination.ts`
- `src/app/auth/claim/route.ts`
- `scripts/claim-destination.test.ts`

`claimGuestDataForUser` devuelve `cvId` y `offerId`. Solo el `next` por defecto (`/dashboard` sin query ni hash) pasa al editor. Checkout y cualquier `next` explícito se respetan. Sin cookie, la redirección sigue siendo `next`.

### `378e301` feat(editor): show the adaptation diff as soon as streaming ends

- `src/components/editor/EditorClient.tsx`
- `src/components/editor/MarkdownEditor.tsx`
- `src/lib/i18n/es.ts`
- `src/lib/i18n/en.ts`

Tras el stream, si hay base, la superficie es `diff`: `split` si el ancho es ≥ 1024, si no `unified`. El CTA primario es Descargar PDF. Revertir solo existe si hay base.

### `1543ac5` feat(optimize): require only the job description

- `src/lib/offer-fields.ts`
- `src/app/api/ai/optimize/route.ts`
- `src/app/dashboard/DashboardClient.tsx`
- `src/components/editor/EditorClient.tsx`
- `src/components/editor/EditorReviewRail.tsx`
- `src/lib/i18n/es.ts`
- `src/lib/i18n/en.ts`
- `scripts/offer-fields.test.ts`

La API exige `baseCvId` y descripción. La candidatura sigue en `interested`.

### `49ad2de` feat(cv): ask before a free plan replaces its only resume

- `src/lib/free-overwrite-guard.ts`
- `src/app/dashboard/actions.ts`
- `src/app/api/ai/optimize/route.ts`
- `src/components/cv/OverwriteGuardDialog.tsx`
- `src/app/dashboard/DashboardClient.tsx`
- `src/components/editor/EditorClient.tsx`
- `src/components/applications/JobOfferDetailsPage.tsx`
- `src/components/applications/JobOfferDetailsModal.tsx`
- `src/lib/i18n/es.ts`
- `src/lib/i18n/en.ts`
- `scripts/free-overwrite-guard.test.ts`

`maxCvs` no cambia. PRO sigue en `/api/stripe/checkout?source=overwrite-guard`.

### `e332ac0` feat(guest): prompt to save the draft after the first PDF

- `src/lib/guest-save-prompt.ts`
- `src/components/cv/GuestSavePrompt.tsx`
- `src/components/editor/PdfViewer.tsx`
- `src/components/dashboard/CvCard.tsx`
- `src/lib/i18n/es.ts`
- `src/lib/i18n/en.ts`
- `scripts/guest-save-prompt.test.ts`

El segundo PDF del invitado sigue en 403 hacia `/register?source=guest-pdf`.

### `fd31b11` feat(try): adapt a pasted CV and job on one screen

- `src/app/try/page.tsx`
- `src/app/try/TryEntry.tsx`
- `src/lib/try-entry.ts`
- `src/app/try/actions.ts` (borrado)
- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/register/RegisterForm.tsx`
- `src/lib/claim-destination.ts`
- `src/components/editor/EditorClient.tsx`
- `src/lib/i18n/es.ts`
- `src/lib/i18n/en.ts`
- `scripts/try-entry.test.ts`
- `scripts/claim-destination.test.ts`

### `c246797` feat(applications): ask if the candidacy was sent after download

- `src/lib/application-sent.ts`
- `src/app/dashboard/applications/actions.ts`
- `src/components/cv/ApplicationSentPrompt.tsx`
- `src/components/editor/EditorClient.tsx`
- `src/components/editor/EditorReviewRail.tsx`
- `src/components/editor/PdfViewer.tsx`
- `src/components/applications/JobOfferDetailsPage.tsx`
- `src/app/editor/[cvId]/page.tsx`
- `src/lib/i18n/es.ts`
- `src/lib/i18n/en.ts`
- `scripts/application-sent.test.ts`

### `9e923cf` feat(analytics): track activation events and the audit funnel

- `src/lib/umami.ts`
- `src/auth.ts`
- `src/components/analytics/SignupConversionBeacon.tsx`
- `src/components/session/SessionChrome.tsx`
- `src/components/editor/PdfViewer.tsx`
- `src/components/editor/EditorClient.tsx`
- `src/app/dashboard/DashboardClient.tsx`
- `src/app/try/TryEntry.tsx`
- `src/lib/actor.ts`
- `scripts/umami.test.ts`
- `scripts/activation-funnel.sql`
- `scripts/activation-funnel.test.ts`

### `1aeb4bd` feat(email): keep activation mail behind a disabled flag

- `src/lib/activation-email.ts`
- `src/lib/activation-email-load.ts`
- `scripts/activation-emails.ts`
- `scripts/activation-email.test.ts`
- `src/app/api/email/opt-out/route.ts`
- `src/lib/application-sent.ts`
- `src/components/editor/EditorClient.tsx`
- `src/components/applications/JobOfferDetailsPage.tsx`
- `src/lib/i18n/es.ts`
- `src/lib/i18n/en.ts`
- `package.json` (`activation:emails`)

## 2. Decisiones

- `createTrialCv` se eliminó. Escribía el CV por su cuenta, parseaba el PDF con `pdf-parse` y no llamaba a `/api/ai/optimize`. Se conservó `trialCvMarkdown`.
- Revertir no tiene tabla de versiones. El botón usa el CV base de otra fila (`baseCvContent`) o el texto de esta sesión (`activationBase`). Si el plan Free pisa su único CV y se recarga la página, no hay base y el botón no aparece.
- Puesto y empresa no hacen una segunda llamada al modelo. `resolveOfferIdentity` lee una línea etiquetada en las primeras 15 líneas, o la primera línea corta sin punto. Si falla, guarda `Oferta sin título` y `Empresa sin identificar` (también con la UI en inglés). Esos campos siguen editables en la oferta.
- El aviso de sobrescritura también cubre la importación, con un texto que no dice «esta oferta». `POST /api/ai/optimize` sin `targetCvId` responde 409 `CV_OVERWRITE_CONFIRM` salvo `confirmOverwrite: true`.
- El destino del claim solo trata como «por defecto» la ruta `/dashboard` sin query ni hash. `offerId` se devuelve, pero la redirección abre `/editor/<cvId>`. Un claim con éxito y sin CV va a `/try`. Un claim sin éxito se queda en `next`.
- `/register` en frío, sin sesión y sin cookie de invitado, va a `/try`. Con sesión o con cookie se ve el formulario, para no romper `source=guest-pdf` ni el registro tras la descarga.
- En `/try`, un Free con 0 CV crea la fila y, al llegar al límite de 1, adapta esa misma fila y pasa `activationBase`. No se confirma el reemplazo de un CV que el usuario ya tenía: con CVs u ofertas, `/try` va al dashboard.
- Google del aviso post-descarga usa `signIn('google')` con el claim `source=guest-post-download`. El email abre `/register?source=guest-post-download`. No son el mismo enlace.
- «No» y «Ahora no» dejan la candidatura en `interested` y no escriben fecha. No hay recordatorio al día siguiente. «Sí» pasa a `applied` y `nextFollowupDate` es el día civil de Madrid más 5, a las 09:00. Descargar no llama a esa acción.
- El embudo lee `audit_log` (columnas `"userId"` y `"createdAt"`). Antes de borrar al invitado, el claim copia `userId`, `actorUserId` y `affectedUserId` a la cuenta nueva. Si no, el `onDelete` los dejaría a null. Optimize y download pueden ser anteriores a `user_register`.
- `signup_completed` de Google: el callback de alta escribe la cookie `matchply_signup_completed` (10 minutos, no httpOnly) dentro de un `try/catch` para que un fallo de cookie no tumbe el OAuth. El beacon del layout espera a `window.umami` hasta 5 segundos y solo entonces borra la cookie. El alta por email sigue disparando el evento en el formulario y no pone la cookie.
- `cv_downloaded` se dispara en `PdfDownloadLink` después de un blob correcto, invitado y cuenta. `CvCard` no usa ese componente y conserva su propio evento.
- `offer_pasted` se dispara una vez cuando `/try`, el modal del editor o el del dashboard guardan los parámetros de optimización. Adaptar una oferta ya guardada no cuenta como pegado.
- `diff_viewed` se dispara una vez por montaje del editor: al acabar el stream, con `?diff=1`, o al abrir Cambios.
- No se añadieron `changes_accepted` ni `application_saved`.
- Correo: no hay clave de Resend ni otro proveedor. El script no envía nada si falta cualquiera de `ACTIVATION_EMAILS_ENABLED=true`, `RESEND_API_KEY`, `ACTIVATION_EMAIL_FROM`, `NEXTAUTH_URL` (o `APP_URL`) y `NEXTAUTH_SECRET`. Con el flag apagado no consulta la base. Invitados, direcciones `@guest.matchply.local` y quien tenga `activation_email_opt_out` quedan fuera. El día 1 es la ventana de 24 a 48 horas tras el primer PDF. El seguimiento solo sale si la candidatura está en `applied` y `nextFollowupDate` cae en los últimos 7 días, una vez por oferta. El texto del correo es español. El enlace lleva `?sent=1` y abre la pregunta ya existente; no cambia el estado. La baja es `GET /api/email/opt-out` con token HMAC.

## 3. Qué no quedó verificado

- No hay herramientas de navegador. No se hizo clic en el diff, el diálogo de sobrescritura, el aviso de guardar ni «¿Ya la enviaste?».
- `npm run lint` (`next lint`) pide crear una config de ESLint y termina con código 1. El repo no tiene config. No se añadió.
- No se llamó a `gpt-6-luna`. El default del código existe; una ejecución real depende de la clave y de `ai_runtime_config`.
- Umami en local está apagado (`isUmamiCollectionEnabled` exige producción, `UMAMI_ENABLED` y `UMAMI_AEPD_CLEARED`). El HTML de `/try` monta el tracker con `enabled: false`. Los eventos no se vieron en la red.
- El alta con Google no se recorrió: no se comprobó si `cookies().set` dentro del callback de NextAuth persiste.
- El correo no se envió a Resend. Con el flag apagado el script imprime `{"sent":0,"reason":"disabled"}` y sale 0.
- `/auth/claim` sin sesión redirige a `/login?next=%2Fdashboard`. El caso «sesión sí, cookie de invitado no → dashboard» está en el test de `resolveClaimRedirect`, no en esa petición HTTP.

## 4. Lint, typecheck y tests

Segunda pasada, sobre el árbol de `0f306b0` más este informe:

- Tests de fase (`npx tsx --test` de `claim-destination`, `free-overwrite-guard`, `offer-fields`, `guest-save-prompt`, `try-entry`, `application-sent`, `umami`, `activation-funnel` y `activation-email`): 30 pruebas, 30 pasan, 0 fallos, salida 0. Duración 246 ms.
- `npm run typecheck` (`tsc --noEmit`): salida 0, sin errores.
- `CI=1 npx next lint`: salida 1. Imprime el asistente «How would you like to configure ESLint?» (Strict, Base, Cancel) y termina. No se creó `.eslintrc` ni `eslint.config.*`. ESLint no llegó a leer el código; el repo sigue sin config.
- `npm test` (`tsx --test scripts/*.test.ts`), esta pasada: 249 pruebas, 247 pasan, 2 se saltan, 0 fallos, `duration_ms` 1518.837125, salida 0.
- Embudo local (`scripts/activation-funnel.sql` contra Postgres de docker en el puerto 5433): `registered 2`, `optimized 1`, `downloaded 1`, `activated_within_5_min 0`, `activated_pct 0.0`.
- HTTP local (contenedor `nextprof_web`, no producción):
  - `GET /try` sin cookie: el payload RSC redirige a `/api/guest?redirect=/try`.
  - `GET /api/guest?redirect=/try`: 307 a `/try` y cookie `matchply_guest` (7 días). El invitado de esa prueba se borró de la base local (`DELETE 1`).
  - `GET /try` con esa cookie: 200 y el texto «Adapta tu CV» / «Adaptar mi CV» / «Descripción de la oferta».
  - `GET /auth/claim` sin sesión: 307 a `/login?next=%2Fdashboard`.

`tsconfig.tsbuildinfo` queda modificado y fuera de los commits.

## 5. Riesgos y cómo probarlos a mano

- Claim con Google y con email. Email: el formulario ya dispara `signup_completed` y el claim abre `/editor/<cvId>` si había borrador. Google: alta nueva, volver al claim y comprobar la cookie y, con Umami activo, un solo `signup_completed`. Un login de Google de una cuenta vieja no debe poner la cookie.
- Cookies limpias. `/try` crea otro invitado. El borrador anterior no viaja.
- Otro navegador. No hay cookie: el claim no mueve CV ni ofertas. Sin sesión cae en el login; con sesión y sin cookie se queda en `next` (dashboard si era el destino por defecto).
- Free con 1 CV. Adaptar debe mostrar «Tu plan gratuito guarda 1 CV…». Reemplazar pisa el CV. Pasar a PRO abre `/api/stripe/checkout?source=overwrite-guard`. Si ese CV es el base, el texto lo dice. Cancelar no escribe.
- Invitado, segundo PDF. El primero muestra el aviso no bloqueante una sola vez por `sessionStorage`. El segundo responde 403 y va a `/register?source=guest-pdf` sin consumir ese aviso.
- `/try` con CV u oferta ya creados va al dashboard. `/register` directo, sin sesión ni cookie, va a `/try`.
- «¿Ya la enviaste?». Descargar no cambia `status`. Sí → `applied` y seguimiento a 5 días (09:00 Madrid). No y Ahora no → sigue `interested` y no hay fecha. `?sent=1` solo abre la pregunta si sigue en `interested` y no se respondió en esta sesión.
- Embudo. Tras un claim, las filas `cv_optimize_ai` y `cv_download_pdf` del invitado deben tener el `userId` de la cuenta. Un invitado caducado se borra sin reasignar auditoría.
- Correo. Sin las cinco variables, `npx tsx scripts/activation-emails.ts` no llama a Resend. Para probar los dos disparos hace falta un proveedor de pruebas, el flag en true y una fila que caiga en la ventana de 24–48 h o un `nextFollowupDate` de una candidatura `applied` de los últimos 7 días.

## Pantallas

Antes: landing → `/try` → dashboard vacío → crear o importar CV → modal con puesto, empresa y descripción → editor → Ver cambios → Descargar PDF. Unas 4 pantallas y unos 6 clics.

Después: `/try` es una pantalla (CV pegado o PDF, descripción, «Adaptar mi CV»). El editor abre el diff y Descargar PDF es el botón primario. 2 pantallas, 1 envío y 1 clic de descarga, sin dashboard si el invitado no tiene CV ni candidaturas.
