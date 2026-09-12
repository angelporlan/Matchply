# Perfil profesional, preferencias y reglas de selección — estado actual

Área: **F10**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Usuario autenticado.  
**Dónde comienza:** /dashboard/profile?tab=profile.

## Qué hace actualmente

- **ACT-F10-01:** Guarda experiencia libre, rol objetivo opcional, documento maestro y criterios de puntuación de ofertas.
- **ACT-F10-02:** Campos avanzados: años de experiencia, puestos, modalidades, ubicaciones, empresas preferidas, salario mínimo/objetivo, proyectos y habilidades por categorías.
- **ACT-F10-03:** Los datos se guardan en user.careerProfile junto con preferencias de selección; el guardado mezcla campos y añade fecha de actualización.
- **ACT-F10-04:** Deriva restricciones de idioma desde curationCriteria; el parser no convierte la biografía en reglas duras aunque se le pase bio.
- **ACT-F10-05:** La fuerza del perfil es una heurística: 35 puntos por experiencia de al menos 80 caracteres, 40 por documento de al menos 120 y 25 por criterios de al menos 20.
- **ACT-F10-06:** El dictado usa SpeechRecognition del navegador en es-ES, con resultados provisionales y finales, controles de inicio/parada y mensajes de permisos/no compatibilidad.
- **ACT-F10-07:** El perfil alimenta optimización y selección de ofertas. La información aceptada de asistentes IA se aplica al formulario y se intenta guardar.

## Límites, diferencias y capacidades parciales

- El porcentaje mide campos/longitudes, no empleabilidad ni calidad profesional.
- Dictado depende de navegador y micrófono; su idioma está fijado a español. No hay un archivo de audio guardado por este componente.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/components/profile/CareerProfileForm.tsx](<../../../src/components/profile/CareerProfileForm.tsx>)
- [src/components/profile/ProfileCompletenessBar.tsx](<../../../src/components/profile/ProfileCompletenessBar.tsx>)
- [src/components/profile/DictationTextarea.tsx](<../../../src/components/profile/DictationTextarea.tsx>)
- [src/app/dashboard/actions.ts](<../../../src/app/dashboard/actions.ts>)
- [src/lib/curation-constraints.ts](<../../../src/lib/curation-constraints.ts>)
- [src/lib/profile-classification.ts](<../../../src/lib/profile-classification.ts>)
- [src/app/dashboard/profile/page.tsx](<../../../src/app/dashboard/profile/page.tsx>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/curation-constraints.test.ts](<../../../scripts/curation-constraints.test.ts>)
- [scripts/profile-classification.test.ts](<../../../scripts/profile-classification.test.ts>)
