# Funcionalidades de Matchply: estado actual y lo que quiero cambiar

Aquí tienes el inventario funcional de la aplicación y **25 fichas en español para definir cómo quieres que funcione**. Incluye experiencia de usuario, administración, extensión y procesos de fondo.

Las antiguas fichas **F19** (claves personales e integraciones API), **F20** (API externa) y **F21** (servidor MCP) se retiraron junto con su código. El plan para reintroducir esas capacidades de forma ordenada está en [future-tips.md](../future-tips.md).

Fotografía del código local: **12 de septiembre de 2026**. El análisis es estático: describe comportamiento implementado y señala funciones parciales; no certifica que proveedores, producción o todos los flujos funcionen al ejecutarlos.

## Cómo rellenarlo

1. Busca la funcionalidad en la tabla y abre **Leer estado actual**. Encontrarás qué hace, quién accede, limitaciones y referencias al código.
2. Abre **Escribir lo que quiero** y completa primero «Lo que quiero», las preguntas específicas y «Resultado esperado». Puedes escribir con tus palabras.
3. Decide qué conservar, cambiar, eliminar o añadir. Usa los identificadores ACT de la ficha para señalar un comportamiento concreto.
4. Completa permisos, pasos, errores y criterios cuando tengas clara la idea. Escribe «No aplica» donde corresponda. Un campo vacío no significa aprobación.
5. Marca «Listo para revisión» cuando quieras revisar la definición. La implementación y su validación serán un trabajo posterior.

Para una funcionalidad nueva, crea una carpeta y copia [PLANTILLA-FUNCIONALIDAD.md](PLANTILLA-FUNCIONALIDAD.md) como `spec.md`; añádela al índice. Si todavía no existe, indícalo como «No implementada» en su ficha de estado actual.

## Índice

| ID | Funcionalidad | Qué hace hoy | Tu definición futura |
| --- | --- | --- | --- |
| F01 | Landing, demostraciones y descubrimiento | [Leer estado actual](landing-y-descubrimiento/estado-actual.md) | [Escribir lo que quiero](landing-y-descubrimiento/spec.md) |
| F02 | Registro, acceso, cierre de sesión y datos de cuenta | [Leer estado actual](autenticacion-y-cuenta/estado-actual.md) | [Escribir lo que quiero](autenticacion-y-cuenta/spec.md) |
| F03 | Prueba sin cuenta y recuperación al registrarse | [Leer estado actual](prueba-invitado/estado-actual.md) | [Escribir lo que quiero](prueba-invitado/spec.md) |
| F04 | Planes, límites y permisos funcionales | [Leer estado actual](planes-y-permisos/estado-actual.md) | [Escribir lo que quiero](planes-y-permisos/spec.md) |
| F05 | Biblioteca de CVs y panel principal | [Leer estado actual](biblioteca-cvs/estado-actual.md) | [Escribir lo que quiero](biblioteca-cvs/spec.md) |
| F06 | Importación de PDF o texto y conversión con IA | [Leer estado actual](importacion-cv/estado-actual.md) | [Escribir lo que quiero](importacion-cv/spec.md) |
| F07 | Editor, formato y comparación de cambios | [Leer estado actual](editor-cv/estado-actual.md) | [Escribir lo que quiero](editor-cv/spec.md) |
| F08 | Vista previa, generación y descarga PDF | [Leer estado actual](pdf-y-exportacion/estado-actual.md) | [Escribir lo que quiero](pdf-y-exportacion/spec.md) |
| F09 | Optimización de CV para una oferta | [Leer estado actual](optimizacion-cv/estado-actual.md) | [Escribir lo que quiero](optimizacion-cv/spec.md) |
| F10 | Perfil profesional, preferencias y reglas de selección | [Leer estado actual](perfil-profesional/estado-actual.md) | [Escribir lo que quiero](perfil-profesional/spec.md) |
| F11 | Extracción, entrevista y documento profesional con IA | [Leer estado actual](asistente-perfil-ia/estado-actual.md) | [Escribir lo que quiero](asistente-perfil-ia/spec.md) |
| F12 | Candidaturas, Kanban y detalle de oferta | [Leer estado actual](candidaturas-kanban/estado-actual.md) | [Escribir lo que quiero](candidaturas-kanban/spec.md) |
| F13 | Archivo, restauración y borrado de candidaturas | [Leer estado actual](archivo-candidaturas/estado-actual.md) | [Escribir lo que quiero](archivo-candidaturas/spec.md) |
| F14 | Selección de ofertas con IA y afinidad individual | [Leer estado actual](seleccion-y-afinidad-ofertas/estado-actual.md) | [Escribir lo que quiero](seleccion-y-afinidad-ofertas/spec.md) |
| F15 | Copia de informes y análisis de candidaturas con IA | [Leer estado actual](informes-y-analisis-candidaturas/estado-actual.md) | [Escribir lo que quiero](informes-y-analisis-candidaturas/spec.md) |
| F16 | Carta de presentación, mensaje de contacto y preparación de entrevista | [Leer estado actual](cartas-contacto-y-entrevistas/estado-actual.md) | [Escribir lo que quiero](cartas-contacto-y-entrevistas/spec.md) |
| F17 | Vinculación y captura de ofertas desde Chrome | [Leer estado actual](extension-linkedin/estado-actual.md) | [Escribir lo que quiero](extension-linkedin/spec.md) |
| F18 | Investigación profunda de ofertas y empresas | [Leer estado actual](linkedin-research/estado-actual.md) | [Escribir lo que quiero](linkedin-research/propuesta.md) |
| F22 | Suscripción, Checkout y portal de facturación | [Leer estado actual](facturacion-stripe/estado-actual.md) | [Escribir lo que quiero](facturacion-stripe/spec.md) |
| F23 | Administración de usuarios y estadísticas | [Leer estado actual](administracion-usuarios/estado-actual.md) | [Escribir lo que quiero](administracion-usuarios/spec.md) |
| F24 | Configuración de IA, modelos y biblioteca de prompts | [Leer estado actual](prompt-defaults/estado-actual.md) | [Escribir lo que quiero](prompt-defaults/propuesta.md) |
| F25 | Trabajos IA persistentes, ejecución y reintentos | [Leer estado actual](trabajos-ia-y-reintentos/estado-actual.md) | [Escribir lo que quiero](trabajos-ia-y-reintentos/spec.md) |
| F26 | Auditoría, salud, límites técnicos y operación | [Leer estado actual](auditoria-y-operacion/estado-actual.md) | [Escribir lo que quiero](auditoria-y-operacion/spec.md) |
| F27 | Idioma, tema, navegación y componentes comunes | [Leer estado actual](idioma-tema-y-navegacion/estado-actual.md) | [Escribir lo que quiero](idioma-tema-y-navegacion/spec.md) |
| F28 | Páginas informativas, privacidad y soporte | [Leer estado actual](privacidad-legales-y-soporte/estado-actual.md) | [Escribir lo que quiero](privacidad-legales-y-soporte/spec.md) |

## Diferencias actuales que conviene decidir

- **CV y versiones:** Gratis reutiliza su único CV y la optimización guarda automáticamente el resultado. La comparación visual no es un historial ni una aprobación previa. Véanse [optimización](optimizacion-cv/estado-actual.md) y [editor](editor-cv/estado-actual.md).
- **Planes:** invitado admite 3 CVs y Gratis 1; al reclamar la prueba no se recorta ese conjunto. PRO corresponde a `active` o `trialing`. Véanse [prueba](prueba-invitado/estado-actual.md) y [permisos](planes-y-permisos/estado-actual.md).
- **Afinidad:** hay distintos motores que escriben puntuaciones. El modal actual puntúa, pero no aplica automáticamente las recomendaciones de archivo. Véase [selección de ofertas](seleccion-y-afinidad-ofertas/estado-actual.md).
- **Automatización:** capturar LinkedIn no inicia actualmente investigación; guardar una fecha de seguimiento no envía recordatorios; generar una carta no la envía. Véanse [extensión](extension-linkedin/estado-actual.md), [Kanban](candidaturas-kanban/estado-actual.md) y [cartas](cartas-contacto-y-entrevistas/estado-actual.md).

Son decisiones abiertas para tus plantillas, no cambios realizados ni propuestas aprobadas automáticamente.

## Decisiones generales (para rellenar)

**Objetivo principal del producto:** [POR DEFINIR]

**A quién quiero ayudar primero:** [POR DEFINIR]

**Tres cambios prioritarios, en orden:**

1. [ID de ficha y motivo]
2. [ID de ficha y motivo]
3. [ID de ficha y motivo]

**Comportamientos que no quiero perder:** [POR DEFINIR]

**Qué significará que la aplicación está lista:** [POR DEFINIR]

## Qué documento manda

- `estado-actual.md`: fotografía descriptiva con referencias a implementación. No editarla para expresar un deseo; actualizarla cuando cambie el código.
- `spec.md`: tu definición futura en las áreas nuevas. Todas empiezan en borrador.
- `propuesta.md`: tu definición futura en las dos carpetas que ya tenían especificaciones (`linkedin-research` y `prompt-defaults`). Sus archivos anteriores se conservan intactos y mantienen su idioma original.
- [design.md](../../design.md): identidad visual y criterios de interfaz. No duplicamos aquí su sistema de colores/botones. La intención visual no prueba que el flujo funcional esté implementado.
- [COBERTURA.md](COBERTURA.md): relación de páginas, rutas HTTP, acciones de servidor y scripts con las fichas.
- [VERIFICACION.md](VERIFICACION.md): alcance y comprobaciones realizadas para este inventario.

Si un deseo contradice la ficha actual, es un cambio por definir. Si contradice una especificación previa, deja escrita la decisión que quieres sustituir antes de implementarla.

## Vocabulario breve

- **Candidatura / oferta guardada:** registro de seguimiento; tener estado «Enviada» no significa que Matchply haya enviado nada al empleador.
- **CV principal:** CV destacado del usuario. **CV base:** bandera de origen; puede diferir del principal.
- **Afinidad / puntuación:** estimación de la aplicación; no es una garantía de entrevista.
- **Streaming:** el texto aparece mientras la IA lo genera.
- **Trabajo en cola:** operación persistida que ejecuta un proceso de fondo o, en algunos casos, la propia petición.
- **Criterio de aceptación (CA):** resultado observable que se comprobará para dar una definición por cumplida.
- **Invariante (INV):** comportamiento que debe mantenerse incluso ante errores o cambios.
