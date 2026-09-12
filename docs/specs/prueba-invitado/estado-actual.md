# Prueba sin cuenta y recuperación al registrarse — estado actual

Área: **F03**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Invitado; también usuario que entra al flujo de prueba.  
**Dónde comienza:** /try · /api/guest · /auth/claim.

## Qué hace actualmente

- **ACT-F03-01:** Crea o reutiliza un usuario temporal identificado mediante cookie HTTP-only y token almacenado como hash; vigencia de 7 días.
- **ACT-F03-02:** Permite crear CV desde plantilla de ejemplo, texto pegado o PDF con texto extraíble. Esta entrada inicial no utiliza IA para convertir el contenido.
- **ACT-F03-03:** La importación PDF de prueba valida MIME, contenido y un máximo de 4 MiB por defecto, configurable por TRIAL_PDF_MAX_BYTES.
- **ACT-F03-04:** Un invitado admite hasta 3 CVs y puede abrir el editor y la vista previa. Las acciones de importación/optimización también aceptan actor invitado con sus límites.
- **ACT-F03-05:** El botón de descarga del invitado lleva a registro; GET /api/pdf con download=true responde 403 al invitado.
- **ACT-F03-06:** Al reclamar datos, transfiere CVs y candidaturas al usuario dentro de una transacción, resuelve cuál queda principal, borra el usuario temporal y limpia cookie.
- **ACT-F03-07:** Un invitado caducado se elimina cuando vuelve a pasar por creación/reclamación de su cookie.

## Límites, diferencias y capacidades parciales

- No se localizó un proceso periódico que purgue todos los invitados caducados.
- La reclamación no recorta CVs al límite Free de 1: pueden conservarse los 3 de prueba y bloquear nuevas creaciones.
- La vista previa entrega bytes PDF al navegador; el bloqueo de download=true no es una protección técnica contra guardar esos bytes.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/try/page.tsx](<../../../src/app/try/page.tsx>)
- [src/app/try/actions.ts](<../../../src/app/try/actions.ts>)
- [src/app/api/guest/route.ts](<../../../src/app/api/guest/route.ts>)
- [src/lib/actor.ts](<../../../src/lib/actor.ts>)
- [src/app/auth/claim/route.ts](<../../../src/app/auth/claim/route.ts>)
- [src/app/api/pdf/route.ts](<../../../src/app/api/pdf/route.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/subscription.test.ts](<../../../scripts/subscription.test.ts>)
