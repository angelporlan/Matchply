# Agente externo que redacta el CV

Matchply no redacta en este flujo. `POST /api/v1/agent/cvs` guarda el Markdown que le envían. El agente externo lee el perfil, el CV base y la oferta, escribe el Markdown con su propio modelo y lo vuelve a guardar.

No existe `POST /api/v1/agent/cvs/optimize`. No hay que llamar a `/api/ai/optimize`: esa ruta usa la sesión de la web, no la clave `mp_live_`.

## Qué hace el agente

1. Si la oferta ya está en Matchply, `GET /api/v1/agent/applications/{id}` (scope `applications:read`). El listado no trae `description`. Si no está, el humano pega el texto de la oferta.
2. `GET /api/v1/agent/profile` (`profile:read`).
3. `GET /api/v1/agent/cvs?limit=50` y después `GET /api/v1/agent/cvs/{id}` del CV base (`cv:read`).
4. El modelo escribe el Markdown con el system prompt de más abajo. El CV base, el `careerProfile` y la oferta van en el mensaje de usuario.
5. `POST /api/v1/agent/cvs` (`cv:write`) con `title`, `content` y `duplicateFromId` del CV base. Así se heredan plantilla, color, fuente, margen y escala. El `content` enviado sustituye al copiado. El CV nuevo no queda como base ni principal, salvo que sea el primero de la cuenta.

Base URL: `https://matchply.com` o el origen local. Cabeceras: `Authorization: Bearer mp_live_…` y `Content-Type: application/json`. La cuenta tiene que ser PRO. Scopes mínimos: `profile:read`, `cv:read`, `cv:write`. Añadir `applications:read` si la oferta ya está en Matchply.

## Contrato

### Perfil

`GET /api/v1/agent/profile` responde `200`:

```json
{
  "data": {
    "id": "uuid",
    "name": "Nombre visible",
    "email": "ada@example.com",
    "subscriptionStatus": "active",
    "scopes": ["profile:read", "cv:read", "cv:write"],
    "careerProfile": {}
  }
}
```

`careerProfile` es el JSON guardado. No es una lista de strings. Campos que el producto escribe y que sí son fuente del CV:

- `bio` y `masterDocument`: texto libre. El documento maestro es la trayectoria larga.
- `targetRoles`: `string[]`.
- `skills`: `{ name, category, proficiency, evidence? }[]`. `category` es `frontend`, `backend`, `ai_ml`, `cloud_devops`, `database` u `other`. `proficiency` es `used`, `solid` o `core`.
- `keyProjects`: `{ title, role?, techStack?, description, impact?, kind?, period? }[]`. `kind` es `experience` o `project`. No hay `name` ni `technologies`.

`preferredWorkplaces`, `salaryMin`, `englishLevel`, `scoringPreferences` y `hardConstraints` son criterios de búsqueda. No son logros ni experiencia para copiar al CV. Si `careerProfile` es `{}` o `null`, la única fuente es el CV base.

### CVs

`GET /api/v1/agent/cvs?limit=50` no incluye `content`. Devuelve `id`, `title`, `isBase`, `isPrincipal`, `templateName`, `accentColor`, `createdAt`, `updatedAt`. El servidor ordena por principal y luego por `updatedAt`.

CV base: el que tenga `isBase` y `isPrincipal`; si no hay, el `isBase` más reciente; si no hay, el `isPrincipal`.

`GET /api/v1/agent/cvs/{id}` añade `content`, `fontFamily`, `pageMargin`, `scale` y `userId`.

`POST /api/v1/agent/cvs`:

```json
{
  "title": "CV - Backend (Acme)",
  "content": "# Nombre\n\n...",
  "duplicateFromId": "uuid-del-cv-base"
}
```

`title` es obligatorio si no hay `duplicateFromId`, máximo 120 caracteres. `content` máximo 400 000 caracteres. Respuesta `200`, no `201`:

```json
{
  "data": { "id": "uuid", "title": "CV - Backend (Acme)", "isBase": false, "isPrincipal": false },
  "created": true
}
```

La respuesta no devuelve el Markdown.

### Oferta ya guardada

`GET /api/v1/agent/applications/{id}` devuelve `title`, `company`, `description`, `url` y `status`, entre otros campos operativos. No devuelve `rawReport` ni cartas. El listado `GET /api/v1/agent/applications` no incluye `description`.

### Errores

El cuerpo es `{ "error": { "code": "...", "message": "..." } }`. Casi todos los 400 salen con `code: "validation"`; el detalle está en `message`. `invalid_title` e `invalid_content` no llegan como `code`.

| HTTP | `error.code` | Qué ha pasado |
|---|---|---|
| 401 | `invalid_token` | Falta el Bearer, no es `mp_live_` más 64 hex, está revocada o caducada. El mensaje es el mismo en todos esos casos. |
| 403 | `insufficient_scope` | La clave no tiene ese permiso. |
| 403 | `forbidden` | Cuenta suspendida o invitada. |
| 403 | `subscription_required` | No es PRO, o el plan no deja crear otro CV. Un PRO no tiene tope de CVs. |
| 400 | `validation` | Título, contenido, cuerpo o identificador inválidos. Leer `message`. |
| 404 | `not_found` | El CV o la candidatura no es de esa cuenta. |
| 413 | `payload_too_large` | El cuerpo del CV supera 450 000 bytes. |
| 429 | `rate_limited` | 60 peticiones/min por IP, 120/min por clave, 40 escrituras/min por usuario. |

## Cómo lee el PDF el Markdown

Esto es lo que hace `parseCvMarkdown` y la plantilla Harvard. Lo que no está aquí, el compilador no lo exige.

- La primera línea `# Nombre` es el nombre. Se le quita la negrita. Si no hay esa línea, el PDF titula «Curriculum Vitae». No hacen falta mayúsculas. No uses «Curriculum Vitae» como título.
- El contacto solo se lee antes del primer `##`. Cada dato va separado por ` | ` y con los dos puntos dentro de la negrita: `**Email:** ada@example.com`. Si los dos puntos quedan fuera (`**Email**: ada@…`), ese dato se ignora.
- Hay icono y enlace si la etiqueta es `email` o `correo`, `teléfono` o `phone` (también vale un valor que parezca un teléfono), `ubicación` o `location`, `linkedin`, `github`, `web` o `portfolio`. «Telefono» y «Ubicacion» sin tilde no activan el icono; el texto sí se imprime. `web` y los dominios `.com`, `.dev`, `.es` y similares se abren como `https://`.
- `## Título` abre una sección. Es una sección de habilidades solo si el título contiene `habilidades`, `habilidad`, `skills`, `aptitudes`, `aptitud` o `competencias`. Si no, las viñetas se dibujan como viñetas normales.
- `### Puesto` es solo el puesto. La primera línea no vacía que sigue, y que contenga `|`, parte la empresa y la fecha. A la izquierda del `|` va la empresa, en cursiva. A la derecha, la fecha, alineada a la derecha. `**Empresa** | *2022 - Presente*` vale: el parser quita negrita y cursiva de esos dos campos.
- No pongas un párrafo entre el `###` y la línea de la empresa. Una línea sin `|` que no empiece por `**` se guarda como fecha y la empresa desaparece.
- Las viñetas son solo `- `. Un asterisco al inicio no es una viñeta.
- Dentro de una viñeta, `**negrita**` y `*cursiva*` sí se dibujan. En habilidades, el texto anterior al primer `:` es la categoría, en negrita y en el color de acento: `- **Backend:** TypeScript, PostgreSQL`.
- Una línea en blanco o `---` cierra el párrafo. Las líneas seguidas se juntan en un solo párrafo.
- Los guiones largos (`–`, `—`) pasan a `-`. Las comillas curvas pasan a comillas rectas. El nombre, el puesto, la empresa y la fecha se dibujan sin negrita aunque la escribas.

## System prompt

Las fuentes y la oferta no van aquí. Van en el mensaje de usuario.

```markdown
Eres el redactor de currículums de Matchply. Optimizas un CV para una oferta concreta. Devuelves solo el Markdown que el compilador PDF Harvard de Matchply puede dibujar.

FUENTES, EN ESTE ORDEN
1. CV base (Markdown). Es la trayectoria que hay que conservar.
2. Perfil profesional (careerProfile). Puedes incorporar una habilidad o un proyecto solo si está aquí con nombre y, si existe, evidence o description. proficiency used es uso, no dominio. kind experience es un puesto; kind project es un proyecto.
3. No uses preferredWorkplaces, salaryMin, englishLevel, scoringPreferences ni hardConstraints como si fueran experiencia.

FIDELIDAD
- No inventes empresas, puestos, fechas, tecnologías, responsabilidades, logros ni cifras.
- No conviertas un conocimiento vecino en experiencia hecha. Si la oferta pide una herramienta que no está en el CV ni en el perfil, no la añadas.
- Puedes reordenar, reformular y priorizar hechos que ya están. Puedes usar el vocabulario de la oferta solo cuando describa un hecho ya escrito.
- No borres trayectoria relevante para acortar. No añadas una sección que no tenga datos en las fuentes.

MARKDOWN QUE EL PDF ACEPTA
- Línea 1: `# Nombre`. Línea en blanco. Nada de «Curriculum Vitae».
- Contacto, antes del primer `##`, con ` | ` y los dos puntos dentro de la negrita:
  **Email:** correo | **Teléfono:** +34 600 000 000 | **Ubicación:** Ciudad, País
  **LinkedIn:** linkedin.com/in/usuario | **GitHub:** github.com/usuario | **Web:** usuario.dev
  Copia solo los datos que existan. No inventes teléfono ni URL.
- Secciones con `## `. Usa los títulos que ya traiga el CV base. Si creas habilidades, el título debe contener «Habilidades» o «Skills».
- Cada puesto, estudio o proyecto:
  ### Nombre del puesto o del título
  **Organización** | *fecha inicio - fecha fin*
  - Viñeta con un hecho ya presente.
  La línea de organización es la primera línea no vacía después del `###`. No pongas un párrafo antes. No metas la empresa ni la fecha en la línea `###`.
- Habilidades, una categoría por viñeta:
  - **Backend:** TypeScript, PostgreSQL
- Viñetas con `- `, nunca con `*`. Fechas con guion ASCII `-`, no con `–`.

ENTREGA
Responde únicamente el Markdown. Sin preámbulo, sin notas y sin cercarlo con ```.
```

Mensaje de usuario, con estas etiquetas:

```text
CV BASE:
<markdown de GET /api/v1/agent/cvs/{id}>

PERFIL PROFESIONAL:
<JSON de data.careerProfile>

OFERTA:
Título: …
Empresa: …
Descripción:
…
```

## Ejemplo mínimo que el parser dibuja bien

```markdown
# Ada Lovelace

**Email:** ada@example.com | **Teléfono:** +34 600 000 000 | **Ubicación:** Madrid, España
**LinkedIn:** linkedin.com/in/ada | **GitHub:** github.com/ada

## Experiencia Profesional

### Ingeniera de software
**Analytical Engines** | *2022 - Presente*
- Mantuve el servicio de cálculo descrito en el CV base.

## Educación

### Estudios de matemáticas
**Universidad** | *2016 - 2020*

## Habilidades

- **Backend:** TypeScript, PostgreSQL
```
