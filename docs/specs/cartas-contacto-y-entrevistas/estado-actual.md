# Carta de presentación, mensaje de contacto y preparación de entrevista — estado actual

Área: **F16**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** PRO, propietario de la oferta.  
**Dónde comienza:** Página completa de oferta · /api/ai/outreach.

## Qué hace actualmente

- **ACT-F16-01:** Genera conjuntamente carta de presentación, mensaje de contacto y lista de preguntas de entrevista para una oferta.
- **ACT-F16-02:** Elige primero el CV vinculado propio, después el principal y finalmente el más reciente. Rechaza si no hay ningún CV.
- **ACT-F16-03:** Envía a IA CV, descripción, empresa, puesto y nivel de suscripción.
- **ACT-F16-04:** Guarda coverLetter, outreachMessage e interviewQuestions en la candidatura y actualiza su fecha.
- **ACT-F16-05:** La página muestra los resultados y permite copiar contenido; volver a generar reemplaza estos campos.

## Límites, diferencias y capacidades parciales

- Generar no envía email, mensajes LinkedIn ni solicitudes de empleo.
- No se encontró historial de cartas o un editor persistente dedicado para estos tres resultados en la ruta revisada.
- Si falta descripción usa un texto alternativo, por lo que la respuesta puede ser menos específica.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/api/ai/outreach/route.ts](<../../../src/app/api/ai/outreach/route.ts>)
- [src/components/kanban/JobOfferDetailsPage.tsx](<../../../src/components/kanban/JobOfferDetailsPage.tsx>)
- [src/lib/ai-service.ts](<../../../src/lib/ai-service.ts>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
