# Pasos futuros: reintroducir la API pública y el servidor MCP

Este documento guarda el plan para volver a ofrecer integraciones externas (API pública y servidor MCP) de forma correcta, ordenada y con documentación pública sencilla.

La versión anterior se retiró del código y de las fichas porque mezclaba autenticación, permisos, documentación y lógica de negocio dentro de las rutas, y porque generaba CVs sin un contrato único ni confirmación clara. Aquí queda lo aprendido y el orden recomendado para rehacerlo.

## 1. Punto de partida

Al retirar las integraciones quedó disponible esta base reutilizable:

- `ai_job` y `src/lib/ai-jobs`: cola persistente con estados, intentos y trabajos `evaluate` y `optimize_application`. Conviene ampliarla antes de crear otra.
- `src/lib/application-service.ts`: coincidencia de candidaturas por `externalSource` + `externalId`, URL o título y empresa, y `upsertExternalApplication` ya usada por la extensión.
- `src/lib/extension-auth.ts` y `src/lib/extension-service.ts`: ejemplo de tokens con hash, caducidad, revocación y cuota, aplicable a las claves de API.
- La pestaña **Integraciones** del perfil, que hoy aloja la extensión de LinkedIn y puede crecer con nuevas integraciones.
- `src/lib/rate-limit.ts`, `src/lib/audit.ts`, `src/lib/http.ts` y `src/lib/logger.ts` para límites, auditoría, timeouts y trazas.

Campos eliminados que no deben repetirse: claves API en columnas de `user`, selección de CV exclusiva de una integración (`mcpCvId`) y perfil duplicado con dos consolas distintas.

## 2. Principios

1. **Una sola API pública**, REST y versionada. El servidor MCP es una capa encima de esa API, no una segunda implementación.
2. **El contrato manda.** Definir OpenAPI 3.1 y validar contra él antes de escribir lógica.
3. **Permisos por plan y por clave**, comprobados en el servicio, nunca solo en la ruta.
4. **Escrituras idempotentes y auditables.** Toda operación que crea o modifica datos debe poder repetirse sin duplicar y dejar traza.
5. **Los trabajos largos responden rápido.** Aceptar con `202` y `jobId`, y ofrecer un endpoint de estado uniforme.
6. **Documentación pública mínima y verificable.** Si un ejemplo no funciona copiado y pegado, no está terminado.
7. **Nada de lógica de negocio en los handlers.** Los handlers validan, autorizan y delegan.

## 3. Plan por fases

### Fase 0. Decisiones de producto (antes de programar)

- Escribir en `docs/specs` una ficha nueva con: casos de uso, quién puede usarla, plan necesario, cuotas y qué datos se leen o escriben.
- Decidir si la API es solo para uso personal (clave por usuario) o también backend a backend; si hay uso servidor a servidor, definir un modelo de servicio con scopes, no una clave global con correo.
- Decidir qué operaciones requieren confirmación humana y cuáles pueden ser automáticas.

### Fase 1. Contrato primero

- Redactar `openapi.yaml` con rutas, esquemas, errores, ejemplos y cabeceras.
- Acordar convenciones: prefijo `/api/v1`, fechas ISO 8601, importes y puntuaciones numéricas, paginación por cursor, errores con `code`, `message` y `details`.
- Definir desde el inicio: `Idempotency-Key` para POST, `If-Match` o `expectedUpdatedAt` para ediciones y `409` ante conflicto real.

### Fase 2. Claves de API

- Crear una tabla `api_key` (id, userId, nombre, prefijo, hash, scopes, último uso, caducidad, revocada en) en lugar de columnas en `user`.
- Emitir el secreto una sola vez; guardar solo hash. Permitir rotar y revocar, y mostrar el prefijo después.
- Reutilizar el patrón de la extensión: hash con `timingSafeEqual`, caducidad y auditoría. No reutilizar `guestTokenHash` ni tokens de sesión.
- Limitar por clave y por usuario; documentar cada cuota.

### Fase 3. API pública

- Implementar el servicio de negocio primero (sin HTTP) y cubrirlo con pruebas de contrato.
- Rutas sugeridas:
  - `GET /api/v1/me`
  - `GET|POST /api/v1/applications`, `GET|PATCH|DELETE /api/v1/applications/{id}`
  - `POST /api/v1/applications/{id}/cv` (optimización) y `GET /api/v1/jobs/{id}` (estado)
  - `GET|PUT /api/v1/profile` y `GET|PUT /api/v1/profile/base-cv`
- Validar entradas con un esquema único (por ejemplo Zod) derivado del contrato, para que error y documentación coincidan.
- Devolver siempre la misma forma de error, con `requestId` para soporte.
- Respetar la privacidad: nunca devolver datos de otro usuario ni aceptar correos como identificador.

### Fase 4. Trabajos de IA

- Ampliar `ai_jobs` en vez de crear otra cola.
- La ruta de optimización encola y responde `202` con `jobId`; el cliente consulta `GET /api/v1/jobs/{id}`.
- Mantener idempotencia: repetir el POST con la misma `Idempotency-Key` debe devolver el mismo trabajo.
- No bloquear la petición esperando al modelo; si se ofrece modo síncrono, debe ser explícito y con timeout.

### Fase 5. Documentación pública sencilla

Crear una página `/docs/api` estática, enlazada desde el footer, con esta estructura mínima:

1. Qué permite hacer la API y qué no.
2. Autenticación: cómo obtener una clave y ejemplo de cabecera.
3. Un ejemplo funcional por recurso, en `curl` y, si aporta, en JavaScript o Python.
4. Tabla de errores (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`) y qué hacer en cada caso.
5. Límites y cuotas por plan.
6. Changelog por versión y fecha de última revisión.
7. Contacto de soporte y estado del servicio.

Complementos recomendados, sin complicar la primera versión:

- Publicar `openapi.yaml` y renderizarlo (Swagger UI o Redoc) en la misma página.
- Añadir un botón **Copiar** en cada ejemplo.
- Un test que valide que los ejemplos del documento responden como se describe (evita que la documentación mienta).

### Fase 6. Servidor MCP

- Construirlo como cliente de la API pública; no duplicar lógica ni acceder a la base de datos por otra vía.
- Fijar la versión del protocolo y el transporte (streamable HTTP antes que SSE).
- Separar herramientas de solo lectura (`listar_postulaciones`, `consultar_trabajo_ia`) de las de escritura (`crear_postulacion`, `optimizar_cv`).
- Toda herramienta de escritura debe ser explícita en su descripción, devolver el identificador creado y poder pedir confirmación.
- Errores claros y accionables; sin mensajes internos ni trazas.
- Documentar las herramientas en la misma página pública, en una sección propia y con ejemplos.

### Fase 7. Interfaz de integraciones

- Una sola pestaña **Integraciones** en el perfil: clave API, usos recientes, revocación y estado de cada conexión.
- Nada de consolas paralelas que editen los mismos datos con reglas distintas.
- Mostrar cuota, último uso y avisos de caducidad.

### Fase 8. Pruebas y operación

- Pruebas de contrato contra `openapi.yaml`, no solo unitarias.
- Pruebas de permisos: sin clave, clave caducada, clave de otro usuario, plan Gratis y plan PRO.
- Pruebas de idempotencia y de carreras (doble POST, PATCH con versión antigua).
- Métricas y alertas: tasa de error por ruta, latencia, trabajos en cola y fallos del worker.
- Auditoría de cada escritura con usuario, clave usada y `requestId`.

### Fase 9. Despliegue

- Variables de entorno nuevas y documentadas en `.env.example`.
- Migraciones Drizzle revisadas y con plan de vuelta atrás antes de aplicar en producción.
- Aviso a los usuarios con claves antiguas si existieran; ninguna clave debe viajar en URLs.

## 4. Checklist de aceptación

- [ ] Existe una ficha de producto aprobada en `docs/specs`.
- [ ] `openapi.yaml` cubre todas las rutas, errores y ejemplos.
- [ ] Las claves se guardan con hash, caducan y se pueden revocar.
- [ ] Los permisos por plan se comprueban en el servicio, no solo en la ruta.
- [ ] Las operaciones de escritura son idempotentes y quedan auditadas.
- [ ] Los trabajos largos devuelven `202` con `jobId` y estado uniforme.
- [ ] La página `/docs/api` explica auth, un ejemplo por recurso, errores y límites.
- [ ] Los ejemplos publicados están cubiertos por una prueba automática.
- [ ] El servidor MCP usa la API pública y no duplica lógica.
- [ ] Hay límites de uso, métricas y alertas definidas.

## 5. Errores que no conviene repetir

- Autenticación y permisos distintos en cada ruta.
- Clave global que actúa como cualquier usuario indicando un correo; si se necesita servidor a servidor, usar un modelo de servicio con scopes.
- `PUT` que reemplaza el perfil completo y pierde campos omitidos; preferir `PATCH` con merge explícito.
- Búsqueda y escritura separadas para decidir si una candidatura ya existe; apoyarse en la restricción única y el upsert.
- Respuestas distintas para el mismo caso de "trabajo todavía en curso".
- Documentación escrita después del código y sin pruebas.
- Dos sitios (o dos integraciones) editando el mismo perfil con reglas distintas.
