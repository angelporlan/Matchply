# Vinculación y captura de ofertas desde Chrome — estado actual

Área: **F17**  
Fecha de inventario: **12 de septiembre de 2026**  
Método: lectura estática del código local, sin ejecución funcional ni comprobación de producción.

[Volver al índice](../README.md) · [Escribir lo que quiero](spec.md)

## Acceso y punto de entrada

**Quién lo usa:** PRO; sesión de extensión con alcance linkedin:ingest.  
**Dónde comienza:** Ajustes → Integraciones → LinkedIn; popup y widget de extensión.

## Qué hace actualmente

- **ACT-F17-01:** La web genera un código de un uso, almacenado como hash, de 8 caracteres y vigencia 10 minutos; canjearlo crea una instalación con token revocable de 30 días.
- **ACT-F17-02:** La consola lista instalaciones, última actividad/captura, expiración y permite revocarlas. El popup conserva token limitado en chrome.storage.local.
- **ACT-F17-03:** La extensión observa la página LinkedIn abierta, identifica oferta y extrae puesto, empresa, URL, descripción y metadatos visibles.
- **ACT-F17-04:** Ofrece modo automático/manual, demora de captura configurable (3 segundos inicialmente), widget y captura inmediata desde popup.
- **ACT-F17-05:** El backend valida URL HTTPS de empleo LinkedIn, identidad de origen y tamaños; hace upsert por usuario/identidad LinkedIn y registra actividad.
- **ACT-F17-06:** El content script y background conservan marcadores locales de ofertas capturadas para evitar repeticiones.
- **ACT-F17-07:** Desconectar en popup elimina el token local; revocar en la web invalida la sesión de servidor.
- **ACT-F17-08:** La captura actual devuelve el ID de candidatura y NO llama a enqueueResearchForOffer, aunque existe una importación de esa función.

## Límites, diferencias y capacidades parciales

- La especificación histórica linkedin-research describía investigación automática tras captura; el código actual la separa.
- No envía CVs ni contacta personas. No es un rastreador autónomo de todas las ofertas de LinkedIn.
- Cambios del DOM de LinkedIn pueden afectar la extracción. No se ha probado la extensión conectada en esta revisión.

Estas observaciones describen esta revisión; no son una auditoría exhaustiva ni requisitos de cambio ya aprobados. Una capacidad presente solo en backend se identifica como tal.

## Fuentes de implementación

- [chrome-extension/manifest.json](<../../../chrome-extension/manifest.json>)
- [chrome-extension/content.js](<../../../chrome-extension/content.js>)
- [chrome-extension/background.js](<../../../chrome-extension/background.js>)
- [chrome-extension/popup.js](<../../../chrome-extension/popup.js>)
- [src/lib/extension-auth.ts](<../../../src/lib/extension-auth.ts>)
- [src/lib/extension-service.ts](<../../../src/lib/extension-service.ts>)
- [src/app/api/extension/linkedin/ingest/route.ts](<../../../src/app/api/extension/linkedin/ingest/route.ts>)
- [src/components/subscription/LinkedInExtensionConsole.tsx](<../../../src/components/subscription/LinkedInExtensionConsole.tsx>)
- [src/app/api/extension/pairings/route.ts](<../../../src/app/api/extension/pairings/route.ts>)
- [src/app/api/extension/pairings/[id]/route.ts](<../../../src/app/api/extension/pairings/[id]/route.ts>)
- [src/app/api/extension/status/route.ts](<../../../src/app/api/extension/status/route.ts>)
- [src/app/api/extension/pair/claim/route.ts](<../../../src/app/api/extension/pair/claim/route.ts>)

## Comprobación disponible

No se identificó una prueba específica entre los scripts de prueba revisados. Esto no verifica el comportamiento en navegador.
