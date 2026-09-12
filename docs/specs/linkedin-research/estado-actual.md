# Investigación profunda de ofertas y empresas — estado actual

Área: **F18**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](propuesta.md)

## Acceso y punto de entrada

**Quién lo usa:** PRO.  
**Dónde comienza:** Panel de investigación · /api/research/[offerId] · herramientas MCP.

## Qué hace actualmente

- **ACT-F18-01:** Inicia investigación explícitamente desde dashboard o MCP, consulta estado y ofrece reintento de fallos.
- **ACT-F18-02:** Reserva cuota en PostgreSQL por usuario, mes UTC y oferta distinta: 10 al mes por defecto, configurable mediante RESEARCH_MONTHLY_QUOTA.
- **ACT-F18-03:** Una reserva duplicada del mismo mes reutiliza el run; las tareas activas se reutilizan. Los reintentos técnicos no crean otra reserva.
- **ACT-F18-04:** El worker ejecuta cinco especialistas: ajuste de oferta, empresa, personas, historia/noticias y verificación/riesgos, y sintetiza el informe.
- **ACT-F18-05:** Busca con Tavily y obtiene fuentes públicas con filtros de URL/red; conserva extractos, hashes y referencias de fuentes.
- **ACT-F18-06:** Presenta resumen, recomendación, score, confianza, hallazgos, riesgos, incertidumbres y siguientes pasos; actualiza también campos de evaluación de la candidatura.
- **ACT-F18-07:** Estados: not_requested, queued, running, completed, partial, failed y quota_exceeded. La interfaz consulta aproximadamente cada 4 segundos mientras procede.
- **ACT-F18-08:** El cierre depende de resultados útiles de especialistas; faltas de evidencia o errores pueden producir parcial/fallo.

## Límites, diferencias y capacidades parciales

- La ejecución real depende de worker, base de datos, Tavily y proveedor IA configurados; no se comprobaron en producción.
- La captura de la extensión no inicia actualmente esta investigación, pese al objetivo del spec histórico.
- No contacta personas ni envía mensajes. Fuentes, confianza y puntuación no garantizan veracidad absoluta.
- La cuota se reserva al solicitar; no se encontró devolución automática por fallo técnico.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/api/research/[offerId]/route.ts](<../../../src/app/api/research/[offerId]/route.ts>)
- [src/app/api/research/quota/route.ts](<../../../src/app/api/research/quota/route.ts>)
- [src/lib/research/queue.ts](<../../../src/lib/research/queue.ts>)
- [src/lib/research/quota.ts](<../../../src/lib/research/quota.ts>)
- [src/lib/research/orchestrator.ts](<../../../src/lib/research/orchestrator.ts>)
- [src/lib/research/providers.ts](<../../../src/lib/research/providers.ts>)
- [src/components/kanban/ResearchPanel.tsx](<../../../src/components/kanban/ResearchPanel.tsx>)
- [scripts/research-worker.ts](<../../../scripts/research-worker.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/research-contracts.test.ts](<../../../scripts/research-contracts.test.ts>)

## Documentación previa conservada

- [evidence.md](evidence.md)
- [expectations.md](expectations.md)
- [plan.md](plan.md)
- [spec.md](spec.md)

La documentación previa recoge decisiones y evidencia de otra revisión. Ante diferencias, esta ficha indica el comportamiento encontrado ahora; la propuesta queda pendiente de tu definición.
