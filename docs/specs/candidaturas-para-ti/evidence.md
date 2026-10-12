# Evidencia de verificación

12 de octubre de 2026. Implementado y verificado en local; producción no desplegada.

- `npm run typecheck` y `npm run build`: correctos, incluida `/api/ai/offers/discover`.
- `npm run lint`: correcto; solo avisos existentes en ResearchPanel y componentes del editor.
- `npm test`: 398 correctas, 16 integraciones omitidas por no configurar sus bases específicas, cero fallos. La prueba HTTP existente requiere acceso a localhost fuera del sandbox.
- `scripts/offer-discovery.test.ts`: seis pruebas correctas de fuentes, vigencia, URLs, búsqueda obligatoria, respuestas inválidas y traducciones.
- Integración Postgres aislada de discovery, matching, persistencia e importación: 35 correctas, sin omisiones. Incluyen porcentaje visible, duplicados archivados/LinkedIn, cuota Gratis, ownership, reintentos y recuperación tras publicar en el último intento.
- `git diff --check`: correcto.

## Conexión real

Un CV ficticio de desarrollador frontend inició la búsqueda desde el diálogo. El job terminó en el primer intento. La contabilidad confirmó dos llamadas Responses y una Decisions, todas correctas, con OpenAI y `gpt-6-luna`. Se encontró una oferta verificable; su scoring quedó por debajo del umbral y se omitió. Esto verifica la conexión real y el flujo vacío; la publicación positiva se prueba con datos controlados en Postgres.

No se enviaron solicitudes a empleadores ni se utilizó el CV de una cuenta real.

## Interfaz

El diálogo cabe sin desbordamiento horizontal en 320, 375, 768, 1024 y 1440 px. Se revisaron español/claro e inglés/oscuro, Escape, foco dentro del diálogo y retorno al activador. El resultado persistido se recupera al reabrir. No se añaden animaciones; no se comprobó zoom real de navegador al 200 %.

- [Botón junto a Nueva candidatura](qa/button-es-dark-1440.png).
- [Español/claro en móvil](qa/es-light-375.png) y [escritorio](qa/es-light-1440.png).
- [Inglés/oscuro en móvil](qa/en-dark-375.png).

## Operación

La cobertura depende de las páginas públicas y una oferta puede cerrarse después de consultarla. El porcentaje mide encaje, no probabilidad de contratación. Web y `ai_worker` deben desplegarse juntos; no hay migraciones.


## Actualización de cuotas — 12 de octubre de 2026

- «Candidaturas por IA»: 10 nuevas candidaturas al mes en Gratis, 100 en Pro; solo se consumen las publicadas, con scoring inicial incluido.
- Investigación profunda: una acción general por informe útil, también para cuentas gratuitas. Las otras cuotas conservan sus valores.
- Migración 0040 probada desde una base vacía y aplicada al desarrollo local. Conserva contadores, historial y ajustes; repetirla es inocuo. No modifica producción.
- Integraciones de discovery, investigación y migración: 29 pruebas correctas, sin omisiones. Incluyen tandas de cinco, último saldo de dos/una, cupo agotado, mes anterior, búsquedas vacías, idempotencia y reservas antiguas.
- Suite general: 399 correctas, 17 integraciones omitidas sin sus bases configuradas, cero fallos. Typecheck, lint y build correctos; solo advertencias existentes de hooks.
- Web local y ambos workers usan el nuevo código. Cuotas persistidas verificadas: Gratis 10 / Pro 100.
- Revisión visual: contador nuevo, límites visibles en tarjetas Gratis/Pro, español e inglés y presentación móvil/escritorio. [Captura de planes](../candidaturas-para-ti/qa/quota-plans-es-1440.png).
