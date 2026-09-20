# Administración de usuarios y panel de soporte — comportamiento deseado

Estado: **Aprobado para implementar**  
Responsable: Operación Matchply  
Fecha de revisión: 20 de septiembre de 2026  
Prioridad: Imprescindible

Referencia: [lo que hace actualmente](estado-actual.md). Plan de renovación del panel `/admin`.

## 1. Lo que quiero

**Quiero que esta funcionalidad…**

Convierta `/admin` en una herramienta de soporte con secciones independientes: Resumen, Usuarios, IA, Tráfico y Auditoría. Cada sección carga solo sus datos. El listado de usuarios se resuelve en PostgreSQL (búsqueda, filtros, orden y paginación). El administrador opera con el rol fresco de base de datos, no con el JWT.

**El problema que quiero resolver y para quién:**

Soporte no puede localizar cuentas, medir actividad ni conceder Pro temporal sin editar `subscriptionStatus`. El panel actual descarga todos los usuarios y hasta 1.000 eventos al navegador.

**Al terminar, la persona debe obtener/ver…**

Un listado filtrable, una ficha de usuario con conteos y actividad reciente, acciones de rol/suspensión/Pro temporal, e impersonación limitada cuando esté habilitada.

## 2. Decisiones específicas de esta funcionalidad

**Roles:** un único rol `admin`. Ve datos de cuenta necesarios para soporte (nombre, correo, id, alta, accesos, plan, estado). No ve markdown completo de CVs ni descripciones de ofertas en listados.

**Plan y Stripe:** no se edita `subscriptionStatus` a mano. El acceso Pro es la unión de suscripción Stripe válida (`active`/`trialing`) o concesión `proGrantedUntil` vigente. Stripe no borra la concesión.

**Impersonación:** sesión de soporte de 30 minutos, motivo obligatorio, cookie HttpOnly con token hasheado. Edición de CVs, perfil y candidaturas; bloqueo de facturación, credenciales, tokens y administración. Desactivable con `IMPERSONATION_ENABLED`.

## 3. Qué conservar y qué cambiar

| Referencia actual o comportamiento | Mantener / Cambiar / Eliminar / Añadir | Mi decisión y motivo |
| --- | --- | --- |
| ACT-F23-01 Conteos globales | Cambiar | Incluir trialing y concesiones en Pro; invitados aparte |
| ACT-F23-02 Lista completa en cliente | Cambiar | Filtros y paginación en PostgreSQL; ficha propia |
| ACT-F23-03 Cambio de rol | Cambiar | Autorización con rol de BD; proteger último admin activo |
| ACT-F23-04 Editar subscriptionStatus | Eliminar | Concesión temporal con motivo y vencimiento |
| ACT-F23-05 Un único cliente con todo | Cambiar | Cinco secciones / rutas; errores aislados |
| Impersonación | Añadir | Sesión de soporte revocable |
| lastLoginAt / lastSeenAt | Añadir | Actividad; nulos = desconocido |
| Suspensión | Añadir | Motivo obligatorio; producto bloqueado salvo facturación |

**Invariantes:**

- INV-01: Las acciones administrativas comprueban el rol actualizado en servidor en cada solicitud.
- INV-02: No puede quedar cero administradores activos.
- INV-03: Un fallo de analítica no impide gestionar usuarios.
- INV-04: Los listados administrativos no incluyen contenido completo de CVs ni ofertas.
- INV-05: La impersonación caducada o revocada no se reinterpreta como acción del administrador.
- INV-06: Stripe no sobrescribe `proGrantedUntil`.

**Fuera de esta versión:** borrado de cuentas, exportación masiva, acciones masivas, grabaciones de sesión y cambios comerciales en Stripe.

## 4. Quién puede usarlo y con qué límites

| Persona o plan | Puede verlo | Puede usarlo o modificarlo | Límite y qué ocurre al agotarlo |
| --- | --- | --- | --- |
| Visitante / invitado | No | No | — |
| Usuario Gratis / PRO | No el panel | — | — |
| Administrador | Sí | Sí, salvo auto-quitarse el último rol admin | Impersonación máx. 30 min |
| Durante impersonación | Producto del usuario | CVs, perfil, candidaturas, PDF, IA | Facturación y admin bloqueados |

## 5. Cómo debe funcionar

**Dónde comienza:** `/admin` con sesión de administrador activo y no suspendido.

1. El administrador abre una sección; la URL conserva filtros, orden y página.
2. El servidor autoriza con el rol de BD y carga solo esa sección.
3. En usuarios, PostgreSQL aplica búsqueda (nombre, correo, id), fechas en Europe/Madrid, rol, plan efectivo, estado y actividad.
4. La ficha muestra cuenta, origen Pro, conteos y actividad paginada.
5. Las acciones críticas (rol, suspensión, concesión, impersonación) se auditan en la misma transacción.

| Dato de entrada | Obligatorio | Formato, ejemplo ficticio y validación |
| --- | --- | --- |
| Búsqueda | No | Texto; coincidencia parcial en nombre/correo/id |
| Rango de alta | No | hoy, 7d, 30d o from/to ISO fecha Madrid |
| Motivo suspensión / Pro / impersonación | Sí | Texto ≥ 8 caracteres |
| Vencimiento Pro | Sí al conceder | Fecha futura; predeterminado 30 días |

## 6. Casos especiales y errores

| Situación | Qué debe ver la persona | Qué debe conservar/hacer el sistema |
| --- | --- | --- |
| Sin usuarios que coincidan | Estado vacío de la sección | No error global |
| JWT con rol antiguo | Acceso denegado a acciones | El layout ya usa rol de BD |
| Último admin | Error al degradar | Transacción con bloqueo |
| Cuenta suspendida | Pantalla de cuenta suspendida + portal Stripe | Producto, extensión y jobs nuevos bloqueados |
| Impersonación vencida | Error de recarga; no ejecuta la acción | Limpia cookie; no actúa como admin |
| Pestaña antigua | Formularios invalidados | Epoch de contexto en cada mutación |

## 7. Resultado esperado

| ID | Dado este contexto | Cuando ocurre esta acción | Entonces espero exactamente |
| --- | --- | --- | --- |
| CA-01 | Filtros combinados y página 2 | Recargo o abro una ficha y vuelvo | La URL restaura filtros, orden y página |
| CA-02 | Cambio de hora Europe/Madrid | Filtro «hoy» | El rango usa medianoche Madrid, sin duplicar filas |
| CA-03 | JWT dice admin y BD dice user | Llama a una acción admin | 403 / error de autorización |
| CA-04 | Un solo admin activo | Intento degradarlo | Se rechaza y el rol no cambia |
| CA-05 | Usuario suspendido | Abre el dashboard | Pantalla suspendida; portal de facturación accesible |
| CA-06 | Concesión Pro 30 días y Stripe `none` | Usa candidaturas | Acceso Pro hasta el vencimiento |
| CA-07 | Stripe pasa a `canceled` con concesión vigente | Webhook | `subscriptionStatus` canceled; concesión intacta |
| CA-08 | Impersonación de usuario | Guarda un CV | El CV es del usuario; auditoría cita al admin real |
| CA-09 | Impersonación | Abre Checkout o el panel admin | Acción bloqueada |
| CA-10 | Listado admin | Inspecciono el HTML | No hay `rawReport` ni bloques `## Experiencia` de todos los CVs |

**Cómo lo comprobaré:** suite de filtros/auth/impersonación, `typecheck`, `lint`, `build` y revisión visual móvil/escritorio, claro/oscuro y teclado.

## 8. Experiencia, datos y condiciones adicionales

- Tablas con cabecera `surface-muted`, filas ≥44 px, filtros etiquetados, temas claro/oscuro, teclado y tarjetas en móvil. Ver [design.md](../../../design.md).
- Panel en español; el producto del usuario impersonado conserva su idioma.
- `lastSeenAt` se actualiza como máximo cada cinco minutos. La impersonación no cuenta como actividad del usuario.
- Conservación: eventos ordinarios 90 días; administrativos 12 meses. Sin purga histórica en el primer despliegue.
- Feature flag: `IMPERSONATION_ENABLED`.

## 9. Revisión antes de implementar

- [x] Objetivo y resultado esperados
- [x] Qué conservar y qué cambiar
- [x] Permisos, errores y datos existentes
- [x] Criterios CA comprobables

Decisión final: **Aprobado para implementar**
