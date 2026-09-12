# Importación de PDF o texto y conversión con IA — estado actual

Área: **F06**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Usuario o invitado dentro de su límite de CVs.  
**Dónde comienza:** Modal del dashboard → editor; /api/cv/import y /api/cv/parse-pdf.

## Qué hace actualmente

- **ACT-F06-01:** Acepta PDF o texto pegado. El dashboard extrae primero el texto del PDF, prepara/reutiliza un CV destino y pasa el texto al editor mediante sessionStorage.
- **ACT-F06-02:** /api/cv/parse-pdf devuelve texto extraído por pdf-parse; /api/cv/import también puede recibir directamente un archivo o texto.
- **ACT-F06-03:** La importación IA transforma el texto a Markdown usando el modelo del plan y un prompt operativo import_cv con alternativa integrada.
- **ACT-F06-04:** Entrega texto incremental y una marca final de metadatos con cvId, o una marca de error dentro del flujo.
- **ACT-F06-05:** Al completar, crea o actualiza el destino y lo convierte en CV base y principal, desmarcando los demás en transacción.
- **ACT-F06-06:** Solo escribe fragmentos intermedios en un destino inicialmente vacío, aproximadamente cada 3 segundos; un CV reutilizado con contenido se actualiza al terminar.
- **ACT-F06-07:** Rechaza entradas sin texto extraíble, problemas de lectura y CV destino ajeno.

## Límites, diferencias y capacidades parciales

- No se identificó OCR para PDFs escaneados ni importación DOCX.
- Los límites MIME/tamaño del flujo /try no están replicados de la misma forma en las dos APIs de importación general.
- La extracción IA no garantiza fidelidad de cada dato; el resultado queda guardado automáticamente al completar.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/api/cv/import/route.ts](<../../../src/app/api/cv/import/route.ts>)
- [src/app/api/cv/parse-pdf/route.ts](<../../../src/app/api/cv/parse-pdf/route.ts>)
- [src/app/dashboard/DashboardClient.tsx](<../../../src/app/dashboard/DashboardClient.tsx>)
- [src/components/editor/EditorClient.tsx](<../../../src/components/editor/EditorClient.tsx>)
- [src/lib/ai-service.ts](<../../../src/lib/ai-service.ts>)
- [src/app/dashboard/actions.ts](<../../../src/app/dashboard/actions.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/prompt-defaults.test.ts](<../../../scripts/prompt-defaults.test.ts>)
