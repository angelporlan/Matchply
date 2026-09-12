# Landing, demostraciones y descubrimiento — estado actual

Área: **F01**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** Visitante y usuario con sesión.  
**Dónde comienza:** /.

## Qué hace actualmente

- **ACT-F01-01:** Presenta optimización de CV, seguimiento, comparación Gratis/PRO, FAQ y enlaces de soporte y legales.
- **ACT-F01-02:** El CTA permite probar sin cuenta mediante /try y acceder al registro o Checkout conservando parámetros de origen, plan y destino.
- **ACT-F01-03:** Contiene demostraciones visuales del editor y Kanban, selector de volumen de candidaturas y enlaces hacia la plantilla Harvard.
- **ACT-F01-04:** La calculadora muestra 10 EUR divididos por entre 2 y 30 candidaturas; es un cálculo comercial del cliente, no una factura ni consumo medido.
- **ACT-F01-05:** La página obtiene la sesión para adaptar enlaces. Los ejemplos y animaciones no son los CVs o candidaturas del visitante.

## Límites, diferencias y capacidades parciales

- El importe de la calculadora está codificado en la interfaz; el importe real de cobro depende del Price configurado en Stripe.
- Las demostraciones no acreditan resultados laborales ni calidad real de la IA.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [src/app/page.tsx](<../../../src/app/page.tsx>)
- [src/components/landing/LandingPageClient.tsx](<../../../src/components/landing/LandingPageClient.tsx>)
- [src/components/landing/LandingHeader.tsx](<../../../src/components/landing/LandingHeader.tsx>)
- [src/lib/auth-intent.ts](<../../../src/lib/auth-intent.ts>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
