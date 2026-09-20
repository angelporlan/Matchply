# Copia de informes y análisis de candidaturas con IA — estado actual

Área: **F15**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** PRO.  
**Dónde comienza:** Opciones de copia/análisis del tablero de postulaciones.

## Qué hace actualmente

- **ACT-F15-01:** Construye un informe textual de candidaturas no archivadas, filtrado por fecha, con datos de oferta y CVs vinculados propios.
- **ACT-F15-02:** La interfaz permite copiar el informe al portapapeles en español o inglés.
- **ACT-F15-03:** El análisis conversacional con IA y su acción asociada se retiraron; el informe se copia al portapapeles sin pasar por el modelo.

## Límites, diferencias y capacidades parciales

- No es una exportación CSV/XLSX ni un informe PDF; es texto preparado para copia.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/dashboard/applications/actions.ts](<../../../src/app/dashboard/applications/actions.ts>)
- [src/components/applications/ApplicationsClient.tsx](<../../../src/components/applications/ApplicationsClient.tsx>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
