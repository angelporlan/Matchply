# Claves personales y configuración de integraciones — estado actual

Área: **F19**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** PRO para emitir/revocar claves; ajustes según interfaz/acción.  
**Dónde comienza:** /dashboard/profile?tab=integrations.

## Qué hace actualmente

- **ACT-F19-01:** Genera o rota una clave matchply_usr_, muestra el secreto al emitirlo y almacena hash y prefijo. Revocar borra la clave almacenada.
- **ACT-F19-02:** La consola permite copiar la clave recién emitida; el valor completo no se recupera después desde el hash.
- **ACT-F19-03:** Existe migración de claves heredadas en texto claro al autenticarlas; la autenticación personal comprueba suscripción PRO.
- **ACT-F19-04:** Permite seleccionar CV para MCP y configurar experiencia, salarios, roles, ubicaciones puntuadas, reglas por experiencia, notas y RSS personalizado.
- **ACT-F19-05:** El guardado de ajustes MCP valida que el CV seleccionado sea propio y mezcla el perfil con el JSON existente.
- **ACT-F19-06:** /dashboard/integrations redirige a la pestaña de integraciones del perfil.

## Límites, diferencias y capacidades parciales

- Solo hay una clave personal activa por usuario; no se localizaron scopes diferenciados ni varias claves personales simultáneas.
- RevocarUserApiKey exige PRO, una decisión a revisar para usuarios que ya hayan perdido el plan.
- Los ajustes de perfil/MCP no son un contrato único estricto compartido por todas las vías de escritura.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/lib/api-keys.ts](<../../../src/lib/api-keys.ts>)
- [src/app/dashboard/actions.ts](<../../../src/app/dashboard/actions.ts>)
- [src/components/subscription/ApiKeyConsole.tsx](<../../../src/components/subscription/ApiKeyConsole.tsx>)
- [src/components/subscription/McpProfileConsole.tsx](<../../../src/components/subscription/McpProfileConsole.tsx>)
- [src/components/subscription/IntegrationsTabs.tsx](<../../../src/components/subscription/IntegrationsTabs.tsx>)
- [src/app/dashboard/integrations/page.tsx](<../../../src/app/dashboard/integrations/page.tsx>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/api-keys.test.ts](<../../../scripts/api-keys.test.ts>)
