# Páginas informativas, privacidad y soporte — estado actual

Área: **F28**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Público.  
**Dónde comienza:** /privacy · /terms · /cookies · enlace de soporte.

## Qué hace actualmente

- **ACT-F28-01:** Existen páginas de privacidad, términos y cookies construidas con un componente común.
- **ACT-F28-02:** Describen datos de cuenta/CV/ofertas, proveedores IA y Stripe, almacenamiento técnico, preferencias, planes y límites de la IA.
- **ACT-F28-03:** Los textos indican explícitamente que algunos detalles legales y de conservación deben confirmarse para la política operativa.
- **ACT-F28-04:** El soporte es un enlace de correo; no se encontró sistema interno de tickets.
- **ACT-F28-05:** Los datos se distribuyen en usuarios, CVs, candidaturas, perfiles, trabajos, investigaciones, fuentes y auditoría con relaciones definidas en schema.ts.

## Límites, diferencias y capacidades parciales

- Los textos de las páginas no demuestran que exista un gestor de consentimiento, exportación completa de datos, derecho de borrado automatizado o inventario legal operativo validado.
- No se auditó cumplimiento legal ni se verificó el tratamiento por proveedores externos; esta ficha describe el código local.
- No incluir credenciales ni datos reales de candidatos al rellenar ejemplos.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/privacy/page.tsx](<../../../src/app/privacy/page.tsx>)
- [src/app/terms/page.tsx](<../../../src/app/terms/page.tsx>)
- [src/app/cookies/page.tsx](<../../../src/app/cookies/page.tsx>)
- [src/components/legal/LegalPage.tsx](<../../../src/components/legal/LegalPage.tsx>)
- [src/db/schema.ts](<../../../src/db/schema.ts>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
