# Evidencia del diagnóstico de navegación

Revisión: 20/09/2026. Local `6861297`, árbol limpio al comenzar, Next instalado `14.2.35`. Método: lectura de código, navegación local autenticada por la sesión ya abierta, logs/estado Docker y diagnóstico restringido de producción. No se modificó aplicación, datos de negocio ni infraestructura.

## Observaciones medidas

| Entorno / comprobación | Resultado | Qué demuestra |
| --- | --- | --- |
| Local, `nextprof_web`, `Dockerfile` y compose | `npm run dev`, `NODE_ENV=development` | Hay compilación bajo demanda; no es benchmark de producción |
| Log de `/dashboard` | Compilación 9,7 s; GET RSC 11.038 ms | La compilación explica la mayor parte de esta petición local |
| Navegación CVs→Postulaciones | Primer snapshot tras clic seguía en CVs; después aparece tabla. Log compilación 5 s, GET 174 ms | Espera fría reproducida cualitativamente; no se midió duración clic→pintado |
| Entrada a Cuenta | Compilación perfil 2,4 s; GET 224 ms | Otra sección compila al visitarla |
| Cuenta→Integraciones | Cambio visual inmediato en snapshot; GET RSC adicional 135 ms | Confirma petición redundante aunque la UI ya cambia localmente |
| Contenedores locales, muestra en reposo | Web 0 % CPU, ~804,5 MiB; DB 0 %, ~59,3 MiB | No prueba saturación ni su ausencia durante navegación |
| Producción, gateway `status`/`doctor` | Web/DB activos, 0 reinicios; DB healthy; carga 0,17/0,33/0,26; 144,8 GiB libres | Sin presión general visible en esa muestra; no mide picos, SQL o pool |
| Producción, HTTPS sin sesión | `/` 200, TTFB 138 ms / total 186 ms; `/dashboard` 307 a login, TTFB 103 ms | Conectividad y ruta pública; NO navegación autenticada |
| Producción, `/api/health`, consulta inicial | 404, TTFB 178 ms | Respuesta observada en esa consulta; no identifica la build ni certifica el estado actual del endpoint |
| Producción, logs filtrados | 100 líneas no estructuradas omitidas | Sin métricas de navegación aprovechables por este canal |

Los tiempos de compilación y GET son etiquetas distintas del servidor; salvo la petición dashboard indicada, no se conoce su solapamiento. No se suman ni se presentan como tiempos finales de pantalla. No se vació caché de producción ni se reinició ningún servicio.

## Corrección sobre la versión de producción

El usuario confirma, después del diagnóstico inicial, que **producción tiene la última build**. Esta confirmación es la base del plan corregido. Se retira la conclusión de que la lentitud procede de ejecutar una versión antigua.

En la consulta inicial, el gateway informó `legacy`, SHA `9e2c6f9`, imagen `matchply-web:pre-cicd`, despliegue deshabilitado y colas no instaladas. Esos resultados se conservan como registro de lo que devolvió la herramienta, no como descripción validada del despliegue actual. El metadato de release no acreditaba el contenido ejecutado.

La inspección del commit histórico `9e2c6f9` no demuestra el comportamiento de producción y se excluye del diagnóstico causal. La investigación debe centrarse en los hallazgos del código actual y una traza autenticada. La compilación bajo demanda medida en local tampoco se extrapola a producción.

## Hallazgos confirmados en código local

Referencias relativas a la raíz del repositorio, con líneas del commit revisado:

| Evidencia | Interpretación |
| --- | --- |
| `src/app/dashboard/Sidebar.tsx:47,82,144,176` | Activo depende de `usePathname`; clic solo cierra menú; no pending local |
| `src/components/profile/SettingsTabs.tsx:44–48` | Cambia estado y hace `router.replace` |
| `src/components/applications/ApplicationsClient.tsx:208–235` | Tabla/tablero y vistas locales disparan navegación RSC |
| `src/app/dashboard/profile/page.tsx:37–59,87` | Lee todos los CV `content`, perfil y datos Premium antes del `Suspense` interior |
| `src/components/profile/CareerProfileForm.tsx:97–103` | Busca un CV base/principal entre todos los CV descargados |
| `src/app/dashboard/applications/page.tsx:31–53` | Proyecciones resumidas correctas pero sin límite ni exclusión SQL del archivo |
| `src/components/applications/ApplicationsClient.tsx:554–563,665–667` | Skeleton global hasta montaje de cliente; DnD ya es carga dinámica separada |
| `src/lib/company-service.ts:151–164` | Dos uniones antes de `COUNT(DISTINCT)`: posible expansión ofertas×notas |
| `src/app/dashboard/page.tsx:48–59` | Todos los CV y última oferta por CV sin acotar a los visibles |
| `src/lib/cv-thumbnail.ts:1–5,25–78`; `CvThumbnail.tsx:22–49` | PDF.js/PDF/canvas, caché en memoria, visibilidad y concurrencia 2; desmontar solo evita setState |
| `src/components/session/SessionChrome.tsx:7–8`; `dashboard/layout.tsx:11` | Contexto antes de hijos, relevante para entrada completa; layout se reutiliza en navegación entre hermanos |

Ya existen `loading.tsx`, `Link`, memoización de sesión/contexto por request y consultas paralelas/resumidas. Middleware solo propaga request-id; autenticación normal usa JWT. No hay LLM en el render ordinario de estas páginas. No se encontró evidencia para culpar a autenticación externa, atribuir toda demora a Postgres o afirmar que cada clic recarga el documento entero.

## Fundamento de framework

Documentación oficial de la versión 14 consultada el 20/09/2026:

- [Navegación, prefetch e History API](https://nextjs.org/docs/14/app/building-your-application/routing/linking-and-navigating): prefetch activo en producción, parcial por defecto en rutas dinámicas; layouts compartidos preservados y History API integrada con parámetros del router.
- [Loading UI y streaming](https://nextjs.org/docs/14/app/building-your-application/routing/loading-ui-and-streaming): `loading` envuelve páginas por debajo del layout; fronteras por sección permiten entregar contenido progresivamente.
- [Caché](https://nextjs.org/docs/14/app/building-your-application/caching): `force-dynamic` no elimina Router Cache cliente. Memoizar sesión dentro de una petición no cachea los resultados de páginas entre peticiones.

## Límites y cierre

Diagnóstico y plan completados. Implementación: ninguna. Sin build/tests de aplicación, ya que solo se añaden documentos. Verificación documental: `git diff --check` correcto; cuatro documentos revisados, enlaces locales sin roturas y cambios limitados a esta carpeta. Revisión independiente de coherencia realizada; corregidas las referencias de requisitos en la matriz de aceptación.

Pendiente: traza autenticada de la última build en producción/build equivalente; tiempos por consulta y pool; perfiles CPU/JS/miniaturas, payload RSC total y p95. Registrar la build medida sirve para reproducibilidad, no implica que haya que actualizar producción. Los umbrales de expectativas son propuestas, no mejoras medidas. No hay evidencia suficiente para prometer un factor concreto de aceleración.

---

# Evidencia de implementación (20/09/2026, continuación)

Commit de trabajo local no publicado. Next `14.2.35`. Implementación de las fases 1–5 en el árbol actual. No se desplegó producción.

## Builds

| Identificador | Momento | Notas |
| --- | --- | --- |
| `5ZsAjkHEbQPVAnGzWga6V` | `.next` de host antes de esta implementación | Referencia previa; no es traza autenticada |
| `rtFohWoyO5CSGIW3i_0Nn` | `npm run build` tras los cambios | Servidor `next start -p 3100`, Ready 326 ms. No se tocó el `.next` del contenedor `next dev` |

## Medición HTTP en `:3100` (sin sesión)

`AUTH_URL` apunta a `:3000`; las rutas protegidas devolvieron el HTML de login (14 267 B) por `UntrustedHost`, no el tablero. Esto solo mide red/login.

| Ruta | Estado | Tiempo | Bytes |
| --- | --- | --- | --- |
| `/` | 200 | 34 ms | 76 860 |
| `/login` | 200 | 17 ms | 14 267 |
| `/dashboard` | 200 | 35 ms | 14 267 (login) |
| `/dashboard/applications` | 200 | 103 ms | 14 267 (login) |
| `/dashboard/profile` | 200 | 46 ms | 14 267 (login) |
| `/dashboard/profile?tab=account` | 200 | 32 ms | 14 267 (login) |

## First Load JS de la build nueva

| Ruta | Size | First Load JS |
| --- | --- | --- |
| `/dashboard` | 850 B | 155 kB |
| `/dashboard/applications` | 21,6 kB | 161 kB |
| `/dashboard/profile` | 27,2 kB | 158 kB |

## Requisitos

| Requisito | Estado | Evidencia |
| --- | --- | --- |
| REQ-NAV-01 | IMPLEMENTADO, QA autenticada pendiente | Sidebar/UserMenu + `NavigationPendingProvider`; tests de umbrales y clics modificados |
| REQ-NAV-02 | IMPLEMENTADO, QA autenticada pendiente | `replaceUrlQuery` en pestañas y layout/vista; carga de Ajustes por panel |
| REQ-NAV-03 | IMPLEMENTADO, QA autenticada pendiente | Sin `hasMounted`; `loading.tsx` conservados; error de sección con reintento |
| REQ-NAV-04 | IMPLEMENTADO, sin EXPLAIN en 5.000 filas | `application-list-query.ts`; conteos de empresas preagrupados; Mis CVs excluye `cvId` nulo |
| REQ-NAV-05 | IMPLEMENTADO | Modales dinámicos; miniaturas con deduplicación y `AbortSignal` |
| REQ-NAV-06 | PARCIAL | Build y tiempos públicos registrados; falta clic→contenido autenticado y p95 |
| INV-NAV-01/02/03 | PARCIAL | Conservados en código; no se probaron dos actores ni logout en navegador |

## Criterios

| Expectativa | Resultado | Notas |
| --- | --- | --- |
| AC-NAV-01 | PARCIAL | Versión y condiciones públicas sí; no hay muestra autenticada de 30 clics |
| AC-NAV-02 | NO MEDIDO | Feedback de clic implementado; p95 no medido |
| AC-NAV-04 | NO MEDIDO EN NAVEGADOR | History API; falta capturar ausencia de RSC en DevTools |
| AC-NAV-05 | IMPLEMENTADO EN CÓDIGO | Cuenta/Integraciones no leen CVs en el servidor de su panel |
| AC-NAV-06 | IMPLEMENTADO EN CÓDIGO | Se eliminó el gate `hasMounted` |
| AC-NAV-07 | IMPLEMENTADO EN CÓDIGO | Página SQL + IDs del filtro; tope de exportación 1.000 avisado |
| AC-NAV-08 | PARCIAL | Bundle de build; cancelación de miniaturas no perfilada en CPU |
| AC-NAV-09/10 | NO MEDIDO | Código de error/reintento presente |

## Comandos

```text
npm run typecheck   # ok
npm test            # 177 pass, 2 skipped
npm run build       # ok, BUILD_ID rtFohWoyO5CSGIW3i_0Nn
npm run lint        # el proyecto no tiene ESLint configurado; next lint pide asistente. No se añadió uno.
```

No se ejecutó `db:generate` ni `db:migrate`. Sin índices nuevos.

## Residuo

- Traza autenticada clic→feedback/contenido en la build `rtFohWoyO5CSGIW3i_0Nn` (puerto 3100 requiere AUTH_URL de ese origen).
- QA de teclado, móvil y `prefers-reduced-motion`.
- EXPLAIN de Empresas y Mis CVs con 5.000 ofertas.
- Miniatura persistida en servidor no activada (DEC-NAV-04).
- No desplegar.
