# Candidaturas para ti

Implementación solicitada el 12 de octubre de 2026. Cuotas revisadas ese mismo día a petición del usuario.

## Comportamiento

- REQ-001: La cabecera de candidaturas MUST incluir «Candidaturas para ti» junto a «Nueva candidatura», con un diálogo de búsqueda, progreso persistente y resultado en español e inglés.
- REQ-002: La búsqueda MUST usar OpenAI `gpt-6-luna`, Responses y `web_search` obligatorio con acceso a internet. MUST basarse en la experiencia y preferencias del perfil y el CV base activo, sin cargar los demás documentos completos.
- REQ-003: Las ofertas MUST tener puesto, empresa, descripción suficiente, URL pública individual y una fuente realmente consultada por la herramienta. MUST omitir ofertas cerradas, fechas inválidas, páginas de listado y fuentes ausentes. Salario, ubicación, modalidad y fechas desconocidos MUST permanecer desconocidos.
- REQ-004: MUST aplicar la rúbrica existente de matching, sus restricciones y evidencia versionada; la búsqueda y el scoring inicial usan Luna. MUST guardar conjuntamente todos los datos, el porcentaje válido y la fuente en «Interesado».
- REQ-005: MUST omitir candidaturas existentes, incluidas las archivadas, sin sobrescribirlas. MUST deduplicar LinkedIn por ID y otras fuentes por URL conservando parámetros funcionales y descartando seguimiento.
- REQ-006: La operación MUST ejecutarse en `ai_job` con límites de uso existentes, autenticación, comprobación de origen, aislamiento por usuario, lease y reintentos acotados. MUST recuperarse al abrir de nuevo el diálogo o recargar.

## Decisiones y supuestos

- DEC-001: Hasta ocho candidatos buscados/evaluados y cinco nuevas ofertas guardadas por búsqueda; umbral de 65 %, usando también la decisión `keep` de la rúbrica. Son valores iniciales de producto, expuestos en el diálogo.
- DEC-002: Disponible para actores con acceso a candidaturas y cuota de descubrimiento: 10 candidaturas nuevas al mes en Gratis y 100 en Pro. Cada oferta añadida consume una unidad; búsqueda y scoring inicial no consumen acciones generales ni matching. Invitado dispone de 10 durante su sesión.
- DEC-003: El diálogo inicia la búsqueda al pulsar «Buscar candidaturas» y explica que se añaden directamente. Cerrar continúa la ejecución. No se envían solicitudes a empleadores.
- INV-001: Ningún resultado sin scoring válido puede publicarse. Publicación, progreso final y consumo de cuota son una transacción; una repetición tras publicación devuelve el resultado anterior.
- INV-002: Un trabajador con lease caducado o intento obsoleto no puede escribir ni terminar el job. Las modificaciones del perfil/CV durante la búsqueda impiden publicar resultados basados en datos anteriores.
- INV-003: Los listados siguen usando `applicationSummaryColumns`. Los endpoints de progreso no incluyen el CV ni las descripciones completas.
- INV-004: Las consultas web no deben incluir nombre ni datos de contacto del candidato; el prompt lo establece. El CV/perfil se procesa en OpenAI con `store: false`.

## Errores y operación

Perfil insuficiente y falta de configuración se detectan antes de reservar cuota. La interfaz explica límites, fallos de búsqueda y cambios del perfil. Un fallo transitorio puede reintentarse tres veces. Las evaluaciones fallidas se omiten y se indican; si todas fallan, la búsqueda se reintenta. La cuota se libera si el trabajo termina fallido antes de publicar. Una búsqueda vacía, duplicados y ofertas descartadas no consumen cuota. La admisión reserva hasta cinco plazas, limitadas al saldo disponible; la publicación consume solo las ofertas nuevas añadidas y libera las demás.

Requiere `OPENAI_API_KEY` y el `ai_worker` actualizado. No añade tablas ni dependencias. La migración de datos 0040 publica los nuevos límites, conserva historial y contadores, y mantiene la contabilidad de trabajos admitidos antes del cambio. Las investigaciones profundas nuevas usan una acción de IA general por informe útil y están disponibles para Gratis y Pro. En producción se despliegan web y ambos workers juntos; un worker anterior no reconoce el nuevo kind. No se solicita ni se ejecuta un despliegue de producción en este cambio.

Fuentes: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [búsqueda web en Responses](https://developers.openai.com/api/docs/guides/tools-web-search).
