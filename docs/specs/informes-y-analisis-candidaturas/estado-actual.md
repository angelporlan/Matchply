# Copia de informes y análisis de candidaturas con IA — estado actual

Área: **F15**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** PRO.  
**Dónde comienza:** Opciones de copia/análisis del Kanban.

## Qué hace actualmente

- **ACT-F15-01:** Construye un informe textual de candidaturas no archivadas, filtrado por fecha, con datos de oferta y CVs vinculados propios.
- **ACT-F15-02:** La interfaz permite copiar el informe al portapapeles en español o inglés.
- **ACT-F15-03:** Para análisis IA puede limitar a las 8 ofertas más recientes del conjunto elegido.
- **ACT-F15-04:** analyzeFailuresAction envía el texto al servicio IA, devuelve un análisis y registra auditoría.
- **ACT-F15-05:** El Kanban mantiene un panel de resultados/conversación local y vuelve a solicitar análisis a partir del contexto textual al continuar.

## Límites, diferencias y capacidades parciales

- La acción analiza el texto recibido; no exige que todas las candidaturas estén en rejected.
- No es una exportación CSV/XLSX ni un informe PDF; es texto preparado para copia/análisis.
- No se encontró almacenamiento persistente de la conversación de análisis ni recordatorios derivados del diagnóstico.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/dashboard/kanban/actions.ts](<../../../src/app/dashboard/kanban/actions.ts>)
- [src/components/kanban/KanbanBoard.tsx](<../../../src/components/kanban/KanbanBoard.tsx>)
- [src/lib/ai-service.ts](<../../../src/lib/ai-service.ts>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
