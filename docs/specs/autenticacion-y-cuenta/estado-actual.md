# Registro, acceso, cierre de sesión y datos de cuenta — estado actual

Área: **F02**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Visitante para registro/login; usuario autenticado para ajustes.  
**Dónde comienza:** /login · /register · /logout · /dashboard/profile?tab=account.

## Qué hace actualmente

- **ACT-F02-01:** Registro con nombre, correo y contraseña; exige campos no vacíos y contraseña de al menos 6 caracteres. Rechaza correos ya registrados y almacena hash bcrypt.
- **ACT-F02-02:** Inicio por credenciales o Google OAuth. Google crea o reutiliza un usuario por correo; las sesiones son JWT y contienen identificador y rol.
- **ACT-F02-03:** El login por credenciales limita intentos por correo a 10 en 10 minutos mediante un contador en memoria del proceso.
- **ACT-F02-04:** Tras autenticar, /auth/claim puede transferir datos de invitado y continuar a un destino interno validado, preservando intención de plan y origen.
- **ACT-F02-05:** La cuenta permite cambiar el nombre: normaliza espacios/caracteres de control y acepta de 2 a 60 caracteres. Actualiza base de datos e intenta refrescar sesión.
- **ACT-F02-06:** Muestra correo de solo lectura, imagen de Google o iniciales, antigüedad y plan. Hay cierre de sesión y acceso a facturación.

## Límites, diferencias y capacidades parciales

- No se encontraron flujos de recuperación/cambio de contraseña, verificación de correo, MFA, cambio de email o eliminación autónoma de cuenta en las rutas revisadas.
- El límite de login es local a cada proceso. No equivale a un bloqueo distribuido entre servidores.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/auth.ts](<../../../src/auth.ts>)
- [src/app/(auth)/actions.ts](<../../../src/app/(auth)/actions.ts>)
- [src/app/(auth)/login/page.tsx](<../../../src/app/(auth)/login/page.tsx>)
- [src/app/(auth)/register/page.tsx](<../../../src/app/(auth)/register/page.tsx>)
- [src/app/(auth)/logout/page.tsx](<../../../src/app/(auth)/logout/page.tsx>)
- [src/app/auth/claim/route.ts](<../../../src/app/auth/claim/route.ts>)
- [src/lib/auth-intent.ts](<../../../src/lib/auth-intent.ts>)
- [src/lib/user-name.ts](<../../../src/lib/user-name.ts>)
- [src/components/profile/AccountSettings.tsx](<../../../src/components/profile/AccountSettings.tsx>)
- [src/app/dashboard/actions.ts](<../../../src/app/dashboard/actions.ts>)
- [src/app/api/auth/[...nextauth]/route.ts](<../../../src/app/api/auth/[...nextauth]/route.ts>)

## Comprobación disponible

Pruebas existentes relacionadas (pueden cubrir solo una parte de esta área; **no ejecutadas en este inventario**):

- [scripts/user-name.test.ts](<../../../scripts/user-name.test.ts>)
- [scripts/rate-limit.test.ts](<../../../scripts/rate-limit.test.ts>)
