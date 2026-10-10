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

## Ampliación aprobada: tres variantes (06/10/2026)

Esta ampliación conserva el servicio y las expectativas de importación de ofertas. Sustituye la selección previa de un modo y el contrato de optimización del editor.

- REQ-V01: una acción MUST generar inicialmente solo Equilibrado desde CV/perfil/oferta congelados. Fiel y Máximo matching MUST permanecer sin generar hasta pulsar su botón y confirmar. Cada modo utiliza el mismo análisis y las mismas fuentes originales.
- REQ-V02: el conjunto MUST ocupar una ficha y una unidad general de IA. Equilibrado se abre primero. Generar un modo adicional no crea otra ficha/candidatura ni repite el consumo inicial.
- REQ-V03: los hechos históricos MUST conservarse. Las citas inexistentes invalidan respaldo; objetivos profesionales no son evidencia. Las sugerencias de métricas (máximo cinco) y gaps MUST quedar fuera del CV. El idioma sigue la oferta y los datos históricos se conservan.
- REQ-V04: resultados válidos MUST persistir como checkpoints. Fallos transitorios tienen tres intentos; reutilizan análisis y resultados. Cada salida inválida tiene una corrección. Fallo total libera cuota y conserva el destino anterior. Reintento explícito de modos fallidos reutiliza la cuota consumida y no modifica modos correctos.
- REQ-V05: el editor MUST permitir alternar los tres modos junto a Markdown/comparación, mantener la vista y guardar cada borrador con revisión independiente. La comparación siempre usa el origen congelado; PDF usa el modo visible. Estilos compartidos.
- REQ-V06: propiedad, permisos, CV base, transferencia de invitado y leases MUST conservarse. Los CV antiguos siguen funcionando. Listados MUST NOT cargar fuentes, análisis ni variantes.
- REQ-V07: durante la generación MUST mostrarse animación de espera y el CV rellenándose con el texto real del proveedor. La aparición progresiva solo revela texto ya recibido; también se aplica a respuestas rápidas que terminan entre consultas de estado. La vista previa incompleta MUST NOT guardarse como edición ni descargarse; solo el resultado validado se publica. Un fallo conserva el documento previo. Movimiento reducido muestra el texto recibido directamente y mantiene progreso sin animación decorativa.

### Contratos y persistencia

`cv_optimization` conserva fuentes, análisis, versión y configuración; `cv_variant` conserva contenido, estado y revisión por modo. `cv.content` refleja el modo activo; referencias nuevas son anulables para compatibilidad.

`POST /api/ai/optimize` → `202 {jobId, cvId}`; `GET /api/ai/jobs/[id]` → etapa y estados por modo. `POST /api/ai/optimize/[id]/retry` recibe `modes`, `requestId`. `GET /api/cv/[cvId]/optimization` carga el detalle. Guardado y selección comprueban optimización/mode/revisión con transacción; PDF acepta `optimizationId` y `modeId`.

Revisión solicitada por el usuario el 06/10: reemplaza la generación simultánea inicial por modos bajo demanda y recupera la animación de llenado. Los registros nuevos de Fiel/Máximo matching tienen estado `idle`. `POST /api/ai/optimize/[id]/generate` recibe un modo sin generar y `requestId`; reutiliza la operación consumida. Los modos ya disponibles se seleccionan sin confirmación ni regeneración. Cancelar el diálogo no inicia trabajos. Los conjuntos anteriores conservan sus variantes. Sin cambios destructivos ni nueva migración: el estado es texto y se asigna explícitamente al insertar. Se conserva como decisión heredada una cuota única para el conjunto. Producción sigue fuera del alcance por decisión del usuario.

El progreso del trabajo puede incluir `preview` (modo, texto y tentativa) solo para su propietario. Se almacena en el registro de variante mientras se genera, con escrituras acotadas y protegidas por lease, y se descarta ante fallo/corrección. Nunca se duplica en `ai_job.result` ni en listados.

- INV-V01: reserva/destino/admisión se realizan juntos bajo el lock de cuota del propietario. `requestId` repetido devuelve el mismo trabajo; entrada distinta devuelve conflicto.
- INV-V02: publicación, selección y guardado se serializan por propietario; el lease y el intento deben seguir vigentes. La publicación y consumo son una sola transacción.
- INV-V03: una escritura tardía de otro modo no cambia el contenido activo. Un conflicto de revisión conserva el borrador y bloquea cambio/descarga hasta recuperarlo.
- INV-V04: el reintento no consume otra unidad ni sobrescribe ediciones. La caducidad del último intento publica éxitos ya guardados, si existen.

Las validaciones comprueban estructura, placeholders, fechas, cargos, instituciones, cifras, niveles y un catálogo de tecnologías con alias. No certifican toda afirmación semántica, equivalencia o causalidad. La regla de seis viñetas y la traducción se instruyen en el prompt; no se afirman como verificación semántica automática.
