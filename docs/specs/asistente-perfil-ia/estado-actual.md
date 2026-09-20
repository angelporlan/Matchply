# Extracción, entrevista y documento profesional con IA — estado actual

Área: **F11**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Interfaz de usuario autenticado; APIs también admiten actor invitado.  
**Dónde comienza:** Modales de perfil · /api/ai/profile/extract · /api/ai/profile/interview.

## Qué hace actualmente

- **ACT-F11-01:** Puede extraer un perfil estructurado a partir de PDF, texto pegado o contenido de un CV existente.
- **ACT-F11-02:** La entrevista recibe experiencia/contexto y objetivo opcional; clasifica el perfil y genera preguntas pertinentes.
- **ACT-F11-03:** La síntesis combina texto libre y respuestas para devolver un perfil enriquecido y documento maestro.
- **ACT-F11-04:** Devuelve propuestas JSON para previsualización; los endpoints no guardan directamente user.careerProfile. La confirmación en el formulario aplica y persiste datos.
- **ACT-F11-05:** La API incluye polish_section para pulir una sección con texto y tipo; rechaza texto vacío y acciones desconocidas.
- **ACT-F11-06:** Usa el proveedor del nivel de suscripción y funciones de clasificación con alternativas heurísticas.

## Límites, diferencias y capacidades parciales

- polish_section está implementado en backend, pero no se encontró un control que lo invoque en los componentes revisados.
- La clasificación tiene categorías y heurísticas orientadas a perfiles técnicos y una alternativa no_software; no equivale a comprensión exhaustiva de todas las profesiones.
- No hay persistencia de cada sesión de preguntas/respuestas como conversación independiente.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/api/ai/profile/extract/route.ts](<../../../src/app/api/ai/profile/extract/route.ts>)
- [src/app/api/ai/profile/interview/route.ts](<../../../src/app/api/ai/profile/interview/route.ts>)
- [src/components/profile/AiProfileInterviewModal.tsx](<../../../src/components/profile/AiProfileInterviewModal.tsx>)
- [src/components/profile/CvImportProfileModal.tsx](<../../../src/components/profile/CvImportProfileModal.tsx>)
- [src/components/profile/AiPreviewModal.tsx](<../../../src/components/profile/AiPreviewModal.tsx>)
- [src/lib/ai-service.ts](<../../../src/lib/ai-service.ts>)
- [src/lib/profile-classification.ts](<../../../src/lib/profile-classification.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/profile-classification.test.ts](<../../../scripts/profile-classification.test.ts>)
