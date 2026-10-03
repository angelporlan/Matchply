# Optimización de CV — importación de ofertas por URL

Estado: **Aprobado e implementado localmente; activación en producción pendiente**.
Decisión del usuario: 03/10/2026. Referencia histórica: [estado actual](estado-actual.md).
Seguimiento: [expectativas](expectativas.md), [plan](plan.md), [evidencias](evidencias.md).

## Objetivo y alcance

En /try y en el modal del dashboard, sustituir puesto, empresa, plataforma, descripción manual y «Pegar ejemplo» por URL + «Importar oferta». El editor conserva su formulario y contrato actuales.

El componente compartido muestra progreso, puesto, empresa, plataforma y descripción completa desplegable antes de adaptar. Los textos nuevos están en español e inglés y usan design.md. Cambiar URL invalida la oferta; cerrar cancela la observación y descarta respuestas antiguas. Try conserva creación sin oferta; dashboard conserva modos y registro de candidatura.

Tras un fallo aparece «Pegar descripción manualmente». La inferencia local de puesto/empresa permite continuar aunque OpenAI esté indisponible. Descripción utilizable: 80–120.000 caracteres. Los metadatos ausentes se identifican explícitamente.

## Contrato y servicio

POST /api/ai/offers/import recibe { url, requestId }, valida actor usuario/invitado y devuelve 202 { jobId }. requestId es UUID: mismo actor y petición generan un solo trabajo; reutilizarlo con otra URL devuelve 409. GET /api/ai/jobs/[id] comprueba propiedad y devuelve progreso/resultado.

import_offer reutiliza ai_job y ai_worker, sin tablas nuevas. Resultado: { jobTitle, company, jobDescription, url, platform, sourceMethod, sources }. Origen: direct, web_search o manual. Importación usa OPENAI_API_KEY y gpt-6-luna, independientemente del modelo de adaptación. Sin clave falla explícitamente.

1. Normalizar HTTP(S) público, sin credenciales. LinkedIn conserva identificador y elimina seguimiento; otros portales conservan parámetros funcionales.
2. Descargar con DNS validado y socket fijado a esa dirección. Validar cada redirección: 15 segundos incluyendo DNS, tres saltos, 2 MiB.
3. Cheerio extrae JobPosting/JSON-LD (arrays y @graph), selectores del portal y contenido principal; excluye navegación, cookies y recomendaciones.
4. Responses estructura con JSON Schema estricto y sin herramientas. Preserva requisitos, responsabilidades y condiciones; las descripciones aisladas conservan el texto de la fuente.
5. Sin descripción utilizable: web_search obligatorio, acceso externo activo y fuentes; segunda llamada estructura con el mismo esquema. Fuentes de la URL o redirecciones validadas; LinkedIn exige el mismo empleo.
6. Si falla, alternativa manual. No devolver datos simulados.

El servidor calcula plataforma por dominio: linkedin, infojobs, indeed, other. El editor recibe los datos por los parámetros existentes; la adaptación no descarga otra vez.

## Invariantes y límites

- INV-01: importar/revisar no crea CVs, empresas ni candidaturas. Los placeholders se crean al continuar después de obtener descripción.
- INV-02: un intento con lease caducado no publica progreso, éxito ni fallo del propietario actual.
- INV-03: solo errores transitorios del proveedor reintentan, máximo tres intentos; red acotada a 120 segundos por intento.
- INV-04: cambiar URL/cerrar no permite aplicar respuestas antiguas.
- INV-05: conservar reglas vigentes de copia, planes, optimización y candidaturas. No redefinir guardado del editor ni las discrepancias históricas ACT-F09.
- INV-06: ocho solicitudes por actor/10 minutos y límite adicional por IP invitada, con el limitador existente de la instancia web.
- INV-07: registrar método, duración, tokens y códigos; sin contenido completo, secretos ni seguimiento.

Sin navegador ni sesiones LinkedIn en servidor. Ofertas protegidas o no indexadas pueden fallar también en búsqueda.

## Activación

Publicar worker compatible, comprobar OPENAI_API_KEY sin imprimirla y después publicar web. Verificar importación en ambas vistas y logs. Sin migración. Verificaciones locales no equivalen a despliegue.

Documentación: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [web search](https://developers.openai.com/api/docs/guides/tools-web-search).
