# Editor, formato y comparación de cambios — estado actual

Área: **F07**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Propietario del CV, incluido invitado.  
**Dónde comienza:** /editor/[cvId].

## Qué hace actualmente

- **ACT-F07-01:** Ofrece modos visual, Markdown y diferencias; las diferencias pueden ser unificadas o divididas y muestran añadidos/eliminados cuando hay contenido original disponible.
- **ACT-F07-02:** El editor visual convierte entre HTML y Markdown y dispone de una barra de formato; el Markdown usa textarea con resaltado superpuesto.
- **ACT-F07-03:** Guarda el contenido automáticamente 1,5 segundos después del último cambio y muestra estado de guardado o error.
- **ACT-F07-04:** Permite cambiar título, color de acento, fuente Helvetica/Times/Courier, margen (18–72 en el control) y escala (0,6–1,4).
- **ACT-F07-05:** Muestra editor y PDF con divisor arrastrable; dispone de comportamiento adaptable al ancho de pantalla y reinicio del divisor mediante doble clic.
- **ACT-F07-06:** Puede iniciar importación u optimización desde parámetros de sessionStorage y mostrar texto generado incrementalmente.
- **ACT-F07-07:** Durante streaming deshabilita la edición visual del contenido.

## Límites, diferencias y capacidades parciales

- La comparación no constituye un historial persistente ni un sistema de aprobación por cada cambio. No se encontró aceptar/rechazar cada fragmento antes del guardado del backend.
- Los rangos de sliders son controles de interfaz; updateCvStyling no valida en servidor todos esos rangos numéricos.
- No se ha verificado por ejecución la conservación del último cambio si se cierra la página antes del debounce.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/editor/[cvId]/page.tsx](<../../../src/app/editor/[cvId]/page.tsx>)
- [src/components/editor/EditorClient.tsx](<../../../src/components/editor/EditorClient.tsx>)
- [src/components/editor/MarkdownEditor.tsx](<../../../src/components/editor/MarkdownEditor.tsx>)
- [src/lib/diff.ts](<../../../src/lib/diff.ts>)
- [src/app/dashboard/actions.ts](<../../../src/app/dashboard/actions.ts>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
