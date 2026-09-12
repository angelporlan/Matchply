# Vista previa, generación y descarga PDF — estado actual

Área: **F08**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Propietario; invitado con vista previa y CTA de registro.  
**Dónde comienza:** Visor del editor · /api/pdf GET y POST.

## Qué hace actualmente

- **ACT-F08-01:** Genera PDF en servidor con PDFKit a partir del Markdown y estilos. GET usa un CV guardado propio; POST genera una vista previa desde contenido recibido.
- **ACT-F08-02:** Resuelve Harvard como plantilla permitida. Convierte la escala a tamaño base de fuente y usa las familias de fuentes del motor.
- **ACT-F08-03:** La vista previa obtiene el PDF como blob y permite reintentar ante problemas; durante streaming puede previsualizar contenido todavía en generación.
- **ACT-F08-04:** GET comprueba propiedad; download=true registra auditoría para usuarios y rechaza invitados.
- **ACT-F08-05:** Devuelve application/pdf con nombre basado en el nombre del usuario, Content-Disposition inline y cabecera no-store.
- **ACT-F08-06:** Mantiene caché local de hasta 32 PDFs por contenido y estilos; limita las peticiones PDF por actor a 60 por minuto.

## Límites, diferencias y capacidades parciales

- La descarga usa una respuesta inline: depende del visor del navegador si se abre o se guarda.
- No hay exportación DOCX ni un almacenamiento independiente de archivos PDF versionados en el flujo revisado.
- El límite de vista previa a invitados no impide guardar técnicamente el PDF recibido. No se han comparado PDFs renderizados en este inventario.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/api/pdf/route.ts](<../../../src/app/api/pdf/route.ts>)
- [src/components/editor/PdfViewer.tsx](<../../../src/components/editor/PdfViewer.tsx>)
- [src/lib/pdf-engine.ts](<../../../src/lib/pdf-engine.ts>)
- [src/lib/pdf-cache.ts](<../../../src/lib/pdf-cache.ts>)
- [src/lib/subscription.ts](<../../../src/lib/subscription.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/pdf-cache.test.ts](<../../../scripts/pdf-cache.test.ts>)
