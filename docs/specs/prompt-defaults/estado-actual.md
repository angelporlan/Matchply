# Configuración de IA, modelos y biblioteca de prompts — estado actual

Área: **F24**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](propuesta.md)

## Acceso y punto de entrada

**Quién lo usa:** Administrador para cambios; consumidores IA según plan.  
**Dónde comienza:** /admin → configuración IA/prompts.

## Qué hace actualmente

- **ACT-F24-01:** Configura free_provider/free_model y pro_provider/pro_model en la tabla setting; el guardado invalida caché local de configuración.
- **ACT-F24-02:** Hay clientes OpenRouter, DeepSeek y Gemini; las credenciales provienen del entorno. Los valores por defecto actuales están en models.ts y pueden ser sobrescritos en BD.
- **ACT-F24-03:** Los prompts guardan clave funcional, nombre/descripción ES/EN, color, mensajes system/user, estado activo/archivado y modo estricto.
- **ACT-F24-04:** Crear/editar/activar un prompt desactiva otros de la misma clave cuando corresponde. No permite borrar o archivar el activo.
- **ACT-F24-05:** Los contratos optimize_cv, import_cv, star_analyze y analyze_failures tienen prompts integrados si no hay una sobrescritura válida o falla su consulta.
- **ACT-F24-06:** El selector de modos de optimización muestra prompts no archivados. Las funciones nuevas de perfil, selección y outreach también contienen instrucciones propias en ai-service.ts.
- **ACT-F24-07:** El admin puede consultar información de consumo/límites de la clave OpenRouter mediante su API.

## Límites, diferencias y capacidades parciales

- La biblioteca de prompts no controla absolutamente todos los textos enviados a IA; parte está integrada directamente en servicios.
- No se realizó ninguna llamada IA ni comprobación del saldo OpenRouter. Las alternativas mock dependen de configuración y no son resultados reales.
- Los nombres de modelo configurables no prueban disponibilidad actual en el proveedor.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/admin/actions.ts](<../../../src/app/admin/actions.ts>)
- [src/app/admin/AdminClient.tsx](<../../../src/app/admin/AdminClient.tsx>)
- [src/lib/ai-service.ts](<../../../src/lib/ai-service.ts>)
- [src/lib/ai-settings.ts](<../../../src/lib/ai-settings.ts>)
- [src/lib/models.ts](<../../../src/lib/models.ts>)
- [src/lib/prompt-defaults.ts](<../../../src/lib/prompt-defaults.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/prompt-defaults.test.ts](<../../../scripts/prompt-defaults.test.ts>)

## Documentación previa conservada

- [evidence.md](evidence.md)
- [expectations.md](expectations.md)
- [spec.md](spec.md)

La documentación previa recoge decisiones y evidencia de otra revisión. Ante diferencias, esta ficha indica el comportamiento encontrado ahora; la propuesta queda pendiente de tu definición.
