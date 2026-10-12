# Estado actual: candidaturas para ti

Implementado en local el 12 de octubre de 2026. [Contrato](spec.md), [criterios](expectations.md) y [verificación](evidence.md).

El botón secundario junto a Nueva candidatura abre un diálogo que busca con OpenAI/Luna y web search, aplica el matching existente y añade ofertas nuevas con datos y scoring a Interesado. El progreso persiste en la cola de IA.

- `src/components/applications/DiscoverOffersModal.tsx`: diálogo, recuperación y polling.
- `src/app/api/ai/offers/discover/route.ts`: admisión y última búsqueda del actor.
- `src/lib/offer-discovery/search.ts`: búsqueda, fuentes y validación.
- `src/lib/offer-discovery/service.ts`: contexto, cola, matching, deduplicación y publicación.
- `src/lib/ai-jobs/process.ts` / `queue.ts`: ejecución y protección de intentos.

Requiere configurar OpenAI y desplegar web/worker juntos. No desplegado en producción.
