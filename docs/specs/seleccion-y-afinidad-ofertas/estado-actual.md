# Selección de ofertas con IA y afinidad individual — estado actual

Área: **F14**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** PRO para selección en lote; ver salvedad de acción individual.  
**Dónde comienza:** Modal de selección del tablero de postulaciones · /api/ai/curate · detalle de oferta.

## Qué hace actualmente

- **ACT-F14-01:** Evalúa las ofertas de interested con CV base/principal y perfil profesional; propone keep/archive, puntuación, motivo y habilidades destacadas.
- **ACT-F14-02:** Umbral por defecto 65; la ruta lo redondea y limita entre 0 y 100. Procesa micro-lotes de 2 con concurrencia máxima 4.
- **ACT-F14-03:** La ruta devuelve NDJSON con start, item, done o error. Las puntuaciones mayores que cero pueden persistirse ya durante la previsualización.
- **ACT-F14-04:** Aplica restricciones explícitas de idioma tras la IA: rechazo con techo de 30 y penalización con techo de 40; también afecta a resultados de alternativa.
- **ACT-F14-05:** El modal actual presenta puntuaciones y un resumen; su callback refresca el tablero. No llama a applyCuratedOffersAction ni archiva automáticamente las recomendaciones archive.
- **ACT-F14-06:** Existe evaluación individual de afinidad en detalle que guarda scoreOverall, y una acción de lote alternativa a la ruta streaming.
- **ACT-F14-07:** El modal tiene un modo simulación con puntuaciones aleatorias/heurísticas para demostración. La ruta real limita 4 solicitudes por usuario en 10 minutos.
- **ACT-F14-08:** Existe una acción de servidor applyCuratedOffersAction capaz de archivar IDs y opcionalmente mover otros a applied, pero no se localizó un consumidor en la UI actual. No envía candidaturas.

## Límites, diferencias y capacidades parciales

- La acción individual no impone explícitamente PRO aunque la página está protegida.
- El cálculo modifica puntuaciones guardadas; no debe interpretarse como una previsualización de solo lectura. El archivo de ofertas sigue siendo una operación separada.
- Selección, evaluación STAR e investigación escriben scoreOverall con contratos distintos. No hay un historial de puntuaciones independiente.
- La aplicación de IDs no vuelve a exigir que el estado siga siendo interested; un cambio concurrente requiere atención futura.
- La animación distingue aprobado/suspenso a partir de 50, mientras la decisión keep/archive usa por defecto 65; los dos indicadores no significan lo mismo.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/api/ai/curate/route.ts](<../../../src/app/api/ai/curate/route.ts>)
- [src/app/dashboard/applications/actions.ts](<../../../src/app/dashboard/applications/actions.ts>)
- [src/components/applications/CurateWithAiModal.tsx](<../../../src/components/applications/CurateWithAiModal.tsx>)
- [src/lib/ai-service.ts](<../../../src/lib/ai-service.ts>)
- [src/lib/curation-constraints.ts](<../../../src/lib/curation-constraints.ts>)
- [src/components/applications/ApplicationsClient.tsx](<../../../src/components/applications/ApplicationsClient.tsx>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/curation-constraints.test.ts](<../../../scripts/curation-constraints.test.ts>)
