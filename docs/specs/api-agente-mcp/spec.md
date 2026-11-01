# Matchply — API de agente completa y servidor MCP

Estado: contrato de Lead para Matchply - Dev. Fecha: 2026-11-01.
Repo: `/data/OpenBot/Shared/Matchply` (GitHub `angelporlan/Matchply`).
No es una migración de esquema. La tabla `application_view` ya existe.

## 1. Objetivo

Ángel quiere que cualquier agente de OpenBot opere Matchply por herramientas MCP, sin navegador. El caso de la captura es crear la vista **Matching Hoy** (columnas, filtros, orden) y, con los ids que devuelva, cambiar estados en lote.

El servidor MCP es un cliente fino de `/api/v1/agent/`. No abre Postgres, no importa Drizzle y no reimplementa filtros. Principio ya escrito en `docs/future-tips.md`.

Actúa solo como el usuario dueño del token `mp_live_…`. Prohibido un token de servicio que elija usuario por email.

## 2. Qué ya existe y se reutiliza

Auth y errores: `authenticateAgentRequest`, `handleAgent`, `readAgentBody`, `AgentApiError`, `createAuditLog`. Plan `agentApi` ya se comprueba en el servicio de auth. No añadas otro middleware.

Scopes actuales en `src/lib/agent-api/scopes.ts`: `profile:read|write`, `cv:read|write`, `applications:read|write`.

Rutas actuales, no cambiar su contrato:

| Método | Ruta | Scope |
|---|---|---|
| GET, PATCH | `/api/v1/agent/profile` | profile |
| GET, POST | `/api/v1/agent/cvs` | cv |
| GET, PUT | `/api/v1/agent/cvs/:id` | cv |
| GET, POST | `/api/v1/agent/applications` | applications |
| GET, PATCH | `/api/v1/agent/applications/:id` | applications |
| POST | `/api/v1/agent/applications/evaluations` | applications:write |

Servicios a llamar, no copiar:

- Vistas UI: `normalizeEntityConfig` (`src/lib/crm-views.ts`), `normalizeViewConfig` y `SYSTEM_VIEWS` (`src/lib/application-views.ts`), `systemCrmViews`, `createCrmView` / `updateCrmView` / `deleteCrmView` / `setDefaultCrmView` (`src/app/dashboard/applications/view-actions.ts`). Esas acciones usan sesión. No las importes desde una ruta de agente. Extrae la persistencia a `src/lib/crm-view-store.ts` y haz que las server actions deleguen en ella sin cambiar su resultado `{ success, view }` | `{ error }`.
- Filas de candidaturas: `listApplicationsPage` (`src/lib/application-list-query.ts`) con `applicationSummaryColumns`. Nunca `select()` de `job_offer`.
- Filas de empresas y personas: `listCrmPage` (`src/lib/crm-list-query.ts`).
- Estado de candidatura: `applyApplicationCommand` (`src/lib/application-continuity.ts`), source `agent_api`.
- Borrado de candidatura: `deleteOwnedApplication`.
- Favoritos: `setRowsFavorite` (`src/lib/crm-service.ts`).
- Empresas: `listCompaniesForUser`, `getOwnedCompany`, `createCompany`, `updateCompany`, `deleteCompany`, `listCompanyNotes`, `createCompanyNote`, `deleteCompanyNote`. Proyección `companyListColumns`. No leas `company_icon`.
- Personas: `listPeople`, `getPerson`, `savePerson`, `deletePerson`, `setPeopleStatus`, `linkCompany`, `linkOffer`. No leas `person_avatar`.
- Perfil y CV: `src/lib/agent-api/profile.ts` y `cvs.ts`, tal cual.

Errores de vista que ya devuelve el store de acciones: `INVALID_ENTITY`, `INVALID_NAME`, `DUPLICATE_NAME` (Postgres 23505), `NOT_FOUND`. El nombre se recorta a 60 tras trim y colapsar espacios (`view-actions.ts`). Unicidad: índice `application_view_user_name_idx` en `(userId, entity, name)`.

Estados de candidatura: `interested | applied | interview | offer | rejected | archived`. Plataformas: `linkedin | infojobs | indeed | other`. Estados de persona: `pending | contacted | conversation | keep_in_touch | closed`. Entidades: `applications | companies | people`.

Lote de evaluaciones ya admite 1..200 y exige que todos los ids sean del usuario, si no 404 y no escribe. El lote nuevo sigue esa regla.

## 3. Scopes nuevos

Añadir a `AGENT_SCOPES`, en este orden, después de los actuales:

- `views:read`, `views:write`
- `companies:read`, `companies:write`
- `people:read`, `people:write`

La UI de claves (`ApiKeysSettingsCard`) ya parte de `[...AGENT_SCOPES]`, así que una clave nueva puede llevarlos todos. No migres scopes de claves ya emitidas y no reescribas `tokenHash`. Una clave antigua sin el scope nuevo recibe 403. No hay migración Drizzle: `scopes` ya es `jsonb`.

Si hace falta una migración, paras y lo dices. No ejecutes `db:push`. No hace falta `db:generate` si el esquema no cambia.

## 4. Forma común

- Auth: `Authorization: Bearer <token>`.
- JSON. Fechas ISO 8601 como ya serializa `NextResponse.json`. No formatees "31 oct 2026".
- Éxito: `{ data, ...meta }`. Error: `{ error: { code, message } }` vía `agentErrorResponse`.
- Códigos públicos nuevos, añádelos a `VALIDATION_CODES` solo si el código interno debe salir como `validation`: `invalid_entity`, `invalid_view`, `invalid_ids`, `invalid_page`.
- Mapa de negocio: nombre duplicado de vista → 409 `conflict`. Empresa con candidaturas al borrar → 409 `conflict` (`CompanyHasApplicationsError`). Nombre de empresa duplicado en el CRM del usuario → 409 `conflict` (`CompanyNameConflictError`). Persona LinkedIn duplicada → 409 `conflict` (`PEOPLE_PROFILE_EXISTS`). No encontrado, también si el id es de otro usuario → 404 `not_found`. Scope ausente → el 403 que ya emite `requireAgentScope`.
- Escrituras: un `createAuditLog` por petición, con `apiKeyId`, sin `select()` extra para el log. Eventos: `agent_view_created|updated|deleted|default_set`, `agent_applications_status_batch`, `agent_favorites_set`, `agent_application_deleted`, `agent_company_created|updated|deleted`, `agent_company_note_created|deleted`, `agent_person_saved|deleted`, `agent_people_status_batch`, `agent_person_linked`.
- `revalidatePath` de las rutas de dashboard que ya revalidan las acciones de vista y de candidatura.
- Sin cabecera `Idempotency-Key` y sin tabla nueva. Crear vista dos veces con el mismo nombre devuelve 409. Crear candidatura conserva el upsert por `externalId`. Repetir el mismo estado es éxito.

## 5. Rutas nuevas

Handlers finos, como `src/app/api/v1/agent/applications/route.ts`. Lógica en `src/lib/agent-api/views.ts`, `companies.ts`, `people.ts` y funciones nuevas en `applications.ts`.

### 5.1 Vistas

`GET /api/v1/agent/views?entity=applications` — scope `views:read`.

`entity` obligatorio y tiene que ser una `CrmEntity`. Respuesta:

```json
{
  "data": {
    "entity": "applications",
    "saved": [
      {
        "id": "uuid",
        "entity": "applications",
        "name": "Matching Hoy",
        "isDefault": false,
        "system": false,
        "config": {},
        "createdAt": "2026-11-01T00:00:00.000Z",
        "updatedAt": "2026-11-01T00:00:00.000Z"
      }
    ],
    "system": [
      { "id": "interested", "entity": "applications", "nameKey": "applications.views.system.interested", "system": true, "config": {} }
    ]
  }
}
```

`config` guardada se vuelve a pasar por `normalizeEntityConfig` al leer. Las de sistema salen de `SYSTEM_VIEWS` o `systemCrmViews`, no de la tabla. Orden de guardadas: `isDefault desc`, `name asc`, igual que `loadCrmWorkspace`.

`POST /api/v1/agent/views` — `views:write`. Cuerpo: `{ entity, name, config, isDefault?: boolean }`. `config` se normaliza antes de insertar; la respuesta devuelve la config normalizada, no el JSON crudo. `isDefault: true` limpia la anterior dentro de la transacción con el mismo candado que `setDefaultCrmView`: `pg_advisory_xact_lock(hashtext('crm-view:' || userId || ':' || entity))`.

`GET /api/v1/agent/views/:id` — uuid del usuario. 404 si no es suya.

`PATCH /api/v1/agent/views/:id` — `{ name?, config? }`. La entidad no se cambia. Sin campos → 400 `empty_patch`. No edita vistas de sistema.

`DELETE /api/v1/agent/views/:id` — borra la fila del usuario. 404 si no existe. No borra ids de sistema.

`POST /api/v1/agent/views/:id/default` — `{ isDefault: boolean }`. `false` quita el default sin borrar la vista (`setDefault` con id null solo para esa fila: pon todas a false). `true` usa el candado y deja una sola.

`GET /api/v1/agent/views/:id/rows?page=1` — `views:read`. Carga la config guardada. `page` entero ≥ 1; si falta, 1. El tamaño de página es el de la config (`10|25|50|100`), no un query param. Candidaturas: `listApplicationsPage`. Empresas y personas: `listCrmPage`. Respuesta:

```json
{
  "data": [],
  "page": 1,
  "pageSize": 25,
  "total": 5,
  "totalPages": 1,
  "view": { "id": "uuid", "entity": "applications", "name": "Matching Hoy", "system": false }
}
```

Cada candidatura es el resumen de `applicationSummaryColumns` (incluye `isFavorite` y `scoreOverall`). No incluyas `description` ni `rawReport`. Estado público: si empieza por `archived:`, devuelve `archived`, como `publicStatus`.

`GET /api/v1/agent/views/system/rows?entity=applications&id=interested&page=1` — misma forma, `system: true`. Id desconocido → 404 `not_found`.

`POST /api/v1/agent/views/query` — `views:read`. Cuerpo `{ entity, config, page? }`. No escribe. Sirve para previsualizar antes de guardar. Normaliza y lista igual que `/rows`.

Rutas estáticas `views/system/...` y `views/query` no pueden caer en `views/[id]`.

### 5.2 Candidaturas que faltan

`POST /api/v1/agent/applications/status` — `applications:write`.

```json
{ "ids": ["uuid"], "status": "applied" }
```

1..200 ids, sin repetidos, todos uuid. Si falta uno o es de otro usuario, 404 y la transacción no deja cambios. Cada fila pasa por `applyApplicationCommand` con `{ status, source: 'agent_api' }`. Respuesta: `{ data: { updatedCount, status } }`.

`POST /api/v1/agent/favorites` — scope de escritura de la entidad (`applications:write`, `companies:write` o `people:write`).

```json
{ "entity": "applications", "ids": ["uuid"], "isFavorite": true }
```

Mismo tope de 200. Llama a `setRowsFavorite`. No subas el tope de la UI (`SELECT_ALL_ID_LIMIT` = 10000). Respuesta: `{ data: { updatedCount, isFavorite } }`.

`DELETE /api/v1/agent/applications/:id` — `applications:write`. `deleteOwnedApplication`. 404 si no es del usuario. Respuesta: `{ data: { id, deleted: true } }`.

Cambio aditivo y compatible: `toSummary` y el detalle de `getAgentApplication` incluyen `isFavorite`. El resto de campos no se quita ni se renombra.

### 5.3 Empresas

Scope `companies:read` o `companies:write`.

- `GET /api/v1/agent/companies` — lista de `listCompaniesForUser` (ficha compartida + conteos del usuario). Sin binario de icono.
- `GET /api/v1/agent/companies/:id` — `getOwnedCompany`. 404 si no está en su CRM.
- `POST /api/v1/agent/companies` — `{ name, website?, location?, sector? }` → `createCompany`.
- `PATCH /api/v1/agent/companies/:id` — `updateCompany` exige `name`. El cuerpo lleva `name` y los opcionales `website`, `location`, `sector`.
- `DELETE /api/v1/agent/companies/:id` — `deleteCompany`. Si tiene candidaturas del usuario, 409, no borres notas a medias: la función ya lo impide antes de borrar.
- `GET /api/v1/agent/companies/:id/notes`
- `POST /api/v1/agent/companies/:id/notes` — `{ content }` (máximo real `COMPANY_NOTE_MAX` = 4000).
- `DELETE /api/v1/agent/companies/notes/:noteId` — solo la nota de ese usuario.

### 5.4 Personas

Scope `people:read` o `people:write`. Superficie acotada. Sin trabajos de IA, sin borradores, sin hilos ni avatares.

- `GET /api/v1/agent/people?query&status&page` — `listPeople`. `page` por defecto 1. Tamaño fijo 25, el del servicio. No aceptes un `limit` distinto.
- `GET /api/v1/agent/people/:id` — `getPerson`. Devuelve columnas de la tabla `person` (incluyen `avatarHash`, no los bytes).
- `POST /api/v1/agent/people` — cuerpo validado por `personInput` / `PersonInput`.
- `PATCH /api/v1/agent/people/:id` — `savePerson(userId, input, id)`.
- `DELETE /api/v1/agent/people/:id` — `deletePerson`.
- `POST /api/v1/agent/people/status` — `{ ids, status }` con tope 200, luego `setPeopleStatus`. Status fuera de `PERSON_STATUSES` → 400 `invalid_status`.
- `POST /api/v1/agent/people/:id/companies` — `{ companyId, relation }` → `linkCompany`. `relation` solo `works_at | recruits_for | unconfirmed`.
- `POST /api/v1/agent/people/:id/offers` — `{ offerId }` → `linkOffer`. La oferta tiene que ser del mismo usuario; si `linkOffer` no lo comprueba, compruébalo antes y responde 404.

### 5.5 Perfil y CV

Sin rutas nuevas. El MCP las envuelve.

## 6. Caso Matching Hoy

La captura muestra la vista guardada "Matching Hoy", 5 filas, columnas de UI: estrella, MATCH, PUESTO, EMPRESA, ESTADO, CREADO, ACTUALIZADO, acciones. Eso, en config, es:

- columnas `score`, `title`, `company`, `status`, `createdAt`, `updatedAt` (MATCH es `score`; estrella, checkbox y acciones no son columnas; `actionsIndex: null`);
- las cinco filas están en estado Interesado, plataforma LinkedIn, creadas y actualizadas el 31 oct 2026;
- orden visible en Actualizado descendente;
- página 25, "Mostrando 1–5 de 5".

La config no guarda una lista de ofertas. No añadas un filtro `ids`. Para operar esas cinco, el agente lista la vista y usa los uuid devueltos.

Ejemplo de alta. Es el contrato de la captura, no una consulta ya ejecutada contra producción:

```json
{
  "entity": "applications",
  "name": "Matching Hoy",
  "config": {
    "columns": ["score", "title", "company", "status", "createdAt", "updatedAt"],
    "filters": {
      "status": "interested",
      "cv": "all",
      "date": "custom",
      "startDate": "2026-10-31",
      "endDate": "2026-10-31",
      "followup": "all",
      "excludedStatuses": [],
      "columnFilters": [
        { "column": "platform", "operator": "equals", "value": "linkedin" }
      ]
    },
    "sort": { "key": "updatedAt", "direction": "desc" },
    "pageSize": 25,
    "grouping": null,
    "columnWidths": {},
    "actionsIndex": null
  }
}
```

`normalizeViewConfig` ya acepta ese filtro de fecha y ese `columnFilter`. No escribas otro parser de fechas. El rango usa la zona del proceso, como el tablero. La prueba crea filas con timestamps conocidos; no depende de los datos reales de Ángel.

Después: `POST /applications/status` con los ids de `GET .../rows` y `"status": "applied"`.

## 7. Servidor MCP

Directorio nuevo `mcp/` en la raíz del repo. Proceso Node aparte. Una dependencia de runtime: `@modelcontextprotocol/sdk` (la estable que exporte `McpServer` y `StdioServerTransport`). No añadas Drizzle, Next ni un cliente HTTP de terceros. `fetch` nativo.

Arranque por defecto: stdio, `node mcp/dist/index.js`.

Variables:

- `MATCHPLY_API_BASE`, por defecto `https://matchply.com`, sin barra final.
- `MATCHPLY_API_TOKEN`, obligatorio. Si falta, el proceso sale con código 1 y un mensaje que no imprime el token.
- `MATCHPLY_MCP_TRANSPORT=http` solo para depuración local. Escucha `127.0.0.1` y `MATCHPLY_MCP_PORT` (8787). No lo publiques en Caddy ni en el compose de producción. El token no viaja en la URL.

Cada herramienta hace una petición a la API con el Bearer y un timeout de 20s. Traduce el JSON de error a `isError: true` con `code` y `message`. Sin stack, sin cuerpo HTML, sin el valor del token. Las de lectura llevan `readOnlyHint: true`. Las de borrado, `destructiveHint: true`.

Nombre del servidor: `matchply`. Descripciones en español, nombres en snake_case.

Lectura: `matchply_get_profile`, `matchply_list_cvs`, `matchply_get_cv`, `matchply_list_applications`, `matchply_get_application`, `matchply_list_views`, `matchply_get_view`, `matchply_query_view`, `matchply_query_system_view`, `matchply_preview_view`, `matchply_list_companies`, `matchply_get_company`, `matchply_list_company_notes`, `matchply_list_people`, `matchply_get_person`.

Escritura: `matchply_update_profile`, `matchply_create_cv`, `matchply_update_cv`, `matchply_create_application`, `matchply_update_application`, `matchply_delete_application`, `matchply_set_application_status`, `matchply_set_favorites`, `matchply_evaluate_applications`, `matchply_create_view`, `matchply_update_view`, `matchply_delete_view`, `matchply_set_default_view`, `matchply_create_company`, `matchply_update_company`, `matchply_delete_company`, `matchply_create_company_note`, `matchply_delete_company_note`, `matchply_save_person`, `matchply_delete_person`, `matchply_set_people_status`, `matchply_link_person_company`, `matchply_link_person_offer`.

`matchply_list_applications` pasa `status`, `limit`, `cursor` a la query que ya existe. `matchply_create_view` toma el JSON de la sección 6.

Un test del MCP, sin red, sustituye `fetch` y comprueba que `matchply_create_view` hace `POST /api/v1/agent/views` con ese cuerpo y el Bearer, y que un 409 se devuelve como error de herramienta sin lanzar una excepción no controlada.

`mcp/README.md` corto: para qué sirve, las dos variables, el comando stdio y un ejemplo de `matchply_create_view`. Sin token de ejemplo real. Añade el script `"mcp:build"` en `package.json` solo si el build de `mcp/` no cabe en `npm run build`. El CI ya ejecuta `npm run build`; no lo rompas. `mcp/` no entra en la imagen de producción si no hace falta para el web. No añadas un servicio al compose.

Conectar el servidor a OpenBot con `save_mcp_server` no es parte de este cambio. No pidas ni guardes el token de Ángel.

## 8. Fuera de este cambio

Optimización de CV, research, `ai_job`, PDF, iconos, avatares, facturación, admin, extensión de Chrome, mensajes o consejos de networking, página `/docs/api`, Swagger, y cualquier edición de `.env` o del VPS a mano.

## 9. Pruebas

Local, antes de la PR:

- `npm run typecheck`
- `npm run lint`
- `node --import tsx --test scripts/agent-api-guards.test.ts scripts/crm-views.test.ts scripts/agent-views-api.test.ts`
- El test nuevo del cliente MCP.

`scripts/agent-views-api.test.ts` (node:test, sin base de datos) cubre al menos:

- el cuerpo Matching Hoy sale de `normalizeViewConfig` con esas columnas, `status=interested`, rango `2026-10-31`/`2026-10-31` y filtro `platform equals linkedin`;
- nombre vacío → `invalid_name`; nombre con espacios colapsado y tope 60;
- entidad ajena a las tres → `invalid_entity`;
- lote de estados: 0 ids, 201 ids, id repetido e id no uuid → error; 200 ids distintos pasan el parser;
- estado `archived:ghost` sigue rechazado.

No hace falta un test de integración nuevo si los parsers y el cliente MCP quedan cubiertos y las funciones de lista son las ya probadas. Si añades un test con Postgres, usa el patrón de `scripts/crm.integration.test.ts` y no abras otra base.

CI en el PR a `main` ejecuta typecheck, lint, `npm test`, integración y build (`.github/workflows/ci.yml`, `pull_request` a `main`). Tiene que quedar verde. No debilites el workflow.

## 10. Entrega

- Rama desde `main` actualizado: `agent-mcp-views`.
- Un solo trabajo. Sin refactors de acompañamiento, sin comentarios narrativos, sin dependencias nuevas salvo el SDK de MCP.
- Copia este contrato a `docs/specs/api-agente-mcp/spec.md` dentro de la PR.
- PR a `main`. No hagas push directo a `main`. Título sugerido: `API de agente: vistas CRM, lotes y servidor MCP`.
- Cuando CI esté verde, completa la PR por el ciclo habitual del repo. El push a `main` dispara `Deploy to VPS`. No entres por SSH, no lances migraciones a mano y no reinicies contenedores.
- Comprueba el workflow Deploy to VPS de ese sha. Reporta la URL del run, el sha y si terminó bien. `GET /api/health` alcanza para la salud del web. Una ruta nueva sin token debe responder 401, no 404: basta eso para ver que está publicada. No pegues tokens ni cabeceras Authorization.

Respuesta a Lead (`agent-3e189b42-aefa-4eaa-929f-39162b323c3a`) con: URL de la PR, sha, comandos de prueba y su resultado, URL del deploy y el código HTTP de `GET /api/v1/agent/views` sin token. Si te bloqueas, una sola causa y la acción que lo desbloquea. No implementes una alternativa más estrecha por tu cuenta.
