# API externa: sincronización, perfil, evaluación y CV — estado actual

Área: **F20**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Bearer personal PRO o clave global del servidor que selecciona usuario.  
**Dónde comienza:** /api/external/* · /docs/api.

## Qué hace actualmente

- **ACT-F20-01:** Autentica clave personal o clave global con correo de usuario. La clave global es una vía de compatibilidad con alcance distinto.
- **ACT-F20-02:** GET/POST applications lista y crea/actualiza candidaturas; identifica primero externalSource+externalId, luego URL y como alternativa título+empresa, dentro del usuario.
- **ACT-F20-03:** Permite sincronizar origen, vigencia, metadatos, puntuaciones, informe, riesgos, carta, contacto, preguntas y seguimiento.
- **ACT-F20-04:** PATCH cambia estado/fecha y admite expectedUpdatedAt; devuelve conflicto si la fecha leída no coincide.
- **ACT-F20-05:** POST puede recibir cvMarkdownTailored o pedir optimizeCv; si falla el CV conserva la candidatura y devuelve cvWarning.
- **ACT-F20-06:** POST applications/[id]/cv reutiliza CV vinculado salvo regenerate=true; la generación usa trabajo IA persistente.
- **ACT-F20-07:** GET/PUT profile consulta o reemplaza perfil; pesos suministrados deben ser no negativos y sumar 100. Añade versión/fecha de perfil.
- **ACT-F20-08:** GET/PUT profile/base-cv consulta, crea, actualiza o selecciona CV propio para MCP; puede marcar principal y aplica límite de creación.
- **ACT-F20-09:** POST evaluate evalúa CV/oferta en trabajo IA y devuelve JSON final, 202 con jobId si sigue pendiente o error. No envía una candidatura al empleador.

## Límites, diferencias y capacidades parciales

- La clave global permite operaciones para otro usuario indicado y no todos los endpoints aplican los mismos permisos PRO.
- El PUT de perfil reemplaza JSON, a diferencia del merge de la web; puede perder campos omitidos.
- expectedUpdatedAt se comprueba antes del UPDATE, no como compare-and-swap atómico; no garantiza excluir toda carrera concurrente.
- La coincidencia externalSource+externalId tiene índice único, pero el upsert usa búsqueda y escritura separadas; no afirmar idempotencia perfecta bajo cualquier concurrencia.
- La generación de CV puede seguir ejecutándose aunque el endpoint devuelva advertencia/error de espera; no todos los endpoints devuelven un 202 uniforme.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/lib/external-auth.ts](<../../../src/lib/external-auth.ts>)
- [src/lib/application-service.ts](<../../../src/lib/application-service.ts>)
- [src/app/api/external/applications/route.ts](<../../../src/app/api/external/applications/route.ts>)
- [src/app/api/external/applications/[id]/route.ts](<../../../src/app/api/external/applications/[id]/route.ts>)
- [src/app/api/external/applications/[id]/cv/route.ts](<../../../src/app/api/external/applications/[id]/cv/route.ts>)
- [src/app/api/external/profile/route.ts](<../../../src/app/api/external/profile/route.ts>)
- [src/app/api/external/profile/base-cv/route.ts](<../../../src/app/api/external/profile/base-cv/route.ts>)
- [src/app/api/external/evaluate/route.ts](<../../../src/app/api/external/evaluate/route.ts>)
- [src/app/docs/api/page.tsx](<../../../src/app/docs/api/page.tsx>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/application-match.test.ts](<../../../scripts/application-match.test.ts>)
- [scripts/ai-jobs.test.ts](<../../../scripts/ai-jobs.test.ts>)
