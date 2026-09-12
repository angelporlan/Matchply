# Idioma, tema, navegación y componentes comunes — estado actual

Área: **F27**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Visitante, invitado y usuario según página.  
**Dónde comienza:** Cabeceras, sidebar, menú de usuario y pestañas de ajustes.

## Qué hace actualmente

- **ACT-F27-01:** Ofrece español e inglés mediante diccionario de traducciones con fallback a español y, si falta la clave, su nombre.
- **ACT-F27-02:** El idioma usa cookie/localStorage y preferencia del navegador; cambiarlo refresca componentes de servidor.
- **ACT-F27-03:** El tema claro/oscuro usa clase dark, localStorage y preferencia del sistema al no haber selección guardada; se inicializa antes de hidratación.
- **ACT-F27-04:** Ajustes agrupa perfil, integraciones y cuenta con pestañas. Sidebar y menú de usuario llevan a CVs, candidaturas, ajustes, plan y administración según contexto.
- **ACT-F27-05:** Comparte controles de botón, logo, alertas, idioma y tema; el comportamiento visual objetivo está en design.md.

## Límites, diferencias y capacidades parciales

- Hay textos de perfil/investigación fijados en español y dictado es-ES; no afirmar traducción total de cada interacción.
- La existencia de clases responsive y foco no certifica accesibilidad completa: no se hizo QA de navegador en este inventario.
- La fotografía corresponde al código local leído; design.md describe también objetivos que no deben darse por implementados sin comprobar cada componente.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/lib/i18n/LanguageContext.tsx](<../../../src/lib/i18n/LanguageContext.tsx>)
- [src/lib/i18n/server.ts](<../../../src/lib/i18n/server.ts>)
- [src/lib/i18n/translations.ts](<../../../src/lib/i18n/translations.ts>)
- [src/app/layout.tsx](<../../../src/app/layout.tsx>)
- [src/components/ui/ThemeToggle.tsx](<../../../src/components/ui/ThemeToggle.tsx>)
- [src/app/dashboard/Sidebar.tsx](<../../../src/app/dashboard/Sidebar.tsx>)
- [src/components/profile/SettingsTabs.tsx](<../../../src/components/profile/SettingsTabs.tsx>)
- [src/components/account/UserMenu.tsx](<../../../src/components/account/UserMenu.tsx>)
- [design.md](<../../../design.md>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
