# Evidencia de implementación

Fecha: 15 de septiembre de 2026.

## Resultado

Implementados REQ-01 a REQ-08. Modelo y umbral conservados. Sin despliegue en producción ni llamadas de pago a modelos durante las pruebas.

## Verificación automática

- `MATCH_BATCH_TEST_DATABASE_URL=<URL de PostgreSQL local aislado> node --import tsx --test scripts/*.test.ts`: **163 pruebas aprobadas, 0 fallos y 0 omitidas**. Incluye pruebas del worker con IA simulada y Postgres real, persistencia, invalidación y permisos.
- `npx tsc --noEmit --incremental false`: correcto.
- `git diff --check`: correcto.
- `npm run build`: compilación final correcta, incluidas generación de páginas y comprobación de tipos.
- `npm run db:generate`: generada migración 0021 con snapshot actualizado. Se retiraron las dos columnas ya creadas por la migración manual 0020 que el generador repetía por faltar el snapshot anterior.
- `npm run db:migrate`: correcto en una base vacía de pruebas y después en PostgreSQL de desarrollo.
- `CI=1 npm run lint`: no ejecuta análisis; solicita crear configuración de ESLint. El repositorio no tiene ESLint ni eslint-config-next instalados. No se añadió una nueva política global de lint a este cambio.

## Casos cubiertos

- Idiomas sin penalización automática; preferencias explícitas C1+ y tercer idioma, negaciones, alternativas, frases con varios idiomas y migración idempotente.
- Requisitos omitidos, citas inventadas, pruebas negativas, mínimos de años alterados, tecnología obligatoria ausente y alternativa cubierta. Go como verbo no se confunde con Golang.
- Experiencia total como límite superior de experiencia especializada; valores desconocidos no se convierten en cero. Sin límites por título.
- Perfil/CV completos y hash de entradas originales, incluso más allá de recortes anteriores. Detalle vinculado al cálculo y generado una sola vez por huella.
- Cero persistido y visible; porcentajes 0–5 ya no se convierten desde una antigua escala de cinco puntos.
- JSON incompleto sin resultado ficticio; éxito parcial y errores de persistencia.
- Generaciones anteriores, fuentes editadas y trabajos con lease perdido no sobrescriben resultados vigentes.
- Triggers invalidan perfil, CV elegido y JD; cambios cosméticos de CV y CVs no elegidos no invalidan.
- Cola idempotente, concurrencia por usuario, reintentos solo de ofertas pendientes, recuperación sin datos privados, invalidación del progreso antiguo y comprobación de permisos en el worker.
- Listados mantienen proyección ligera, sin descripciones, CVs ni snapshots.

## QA local

Perfil, tablero y detalle de una oferta real revisados mediante navegador autenticado, sin guardar cambios ni ejecutar IA. Confirmado: nuevo editor de preferencias, reglas automáticas inactivas, notas antiguas pendientes de actualización y detalle sin error de esquema tras migrar.

El componente detallado se renderizó además con datos sintéticos. Su revisión visual separada quedó sin completar porque el navegador bloqueó el archivo HTML local; no se intentó eludir esa restricción. Se verificó el markup y se añadió protección frente a citas largas. Esto no equivale a una prueba visual completa de todos los tamaños y temas.

## Operación y límites

Worker `nextprof_ai_worker` arrancado en desarrollo. Las preferencias se normalizan de manera idempotente al leer/guardar; no hay un barrido de perfiles ni recálculo masivo. Los valores antiguos se conservan internamente y se ocultan como actuales hasta recalcular. Una regla explícita de C1/C2 que siga en el texto del usuario permanece activa.

Pendiente de validación posterior: calibración con respuestas reales del proveedor sobre el conjunto de ofertas originales; las regresiones usan datos sintéticos y respuestas controladas. No se afirma haber reproducido los porcentajes concretos del diagnóstico de Gemini.
