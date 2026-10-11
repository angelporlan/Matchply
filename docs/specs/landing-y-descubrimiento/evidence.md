# Evidencia de implementación de la landing

Revisión: **04/10/2026**. Estado: **implementada; comprobaciones automáticas y rendimiento aprobados, QA manual parcial**. Esta ficha distingue lectura de código, pruebas ejecutadas y comprobaciones aún pendientes.

## Evidencia de código

- `src/app/page.tsx`: contenido principal en servidor, H1 completo, demo en hero, precio 10 €/mes, tres pasos, comparativa, FAQ y cierre; enlaces según actor efectivo.
- `src/lib/landing-content.ts` y `getPlanConfig()`: ES/EN, titulares A/B, objeciones y límites/cuotas de Gratis/PRO desde la configuración publicada; seguimiento también en cuenta Gratis. La configuración actual del trabajo concurrente ofrece 3 CV Gratis (1 base y 2 adaptados).
- `src/components/landing/`: demo HTML/CSS con control de reproducción, cabecera móvil accesible, beacon de exposición y enlace de CTA.
- `src/lib/landing-experiment.ts`, `landing-experiment-server.ts` y middleware: asignación 50/50 versionada, cookie privada siete días y gates de medición.
- `src/lib/umami-client.ts`: cola experimental en `sessionStorage` mientras el script no esté listo, conservada al recargar o cambiar de documento, etapas deduplicadas por pestaña y primer PDF/registro ligados a exposición previa. Solo persiste variante, etapa y ruta genérica; purga eventos al desactivar la recogida.
- `src/lib/pdf-download.ts`, visor y tarjeta CV: éxito tras respuesta/PDF/inicio de descarga, guard en vuelo, preservación de nombres y tratamiento 403 de invitado.

La ausencia de editor, renderizador PDF, canvas de partículas y llamadas IA dentro de la demo reduce trabajo previsto. Es una conclusión de lectura, no una mejora de tiempo medida.

## Verificación registrada

| Comprobación | Resultado | Alcance |
| --- | --- | --- |
| Pruebas focales finales comunicadas por el agente de atribución | **32 pruebas pasan** | Incluye salto `/try → registro → editor` antes de cargar el SDK, recarga, deduplicación, prefetch, DNT, saneado y callback `onReady` antes de configurar el cliente |
| Revisión estática de estructura/copy/gates | Implementados en código | No sustituye QA funcional o visual |
| QA navegador del agente principal | **Sin desbordamiento y un CTA por sección** | ES claro en 320/375/768/1024/1440 px exactos; EN en ambos temas y ES oscuro en 320/375/767/769/1024/1440 px, con comprobación a ambos lados del breakpoint cuando IAB redondea el viewport |
| Teclado: menú móvil y FAQ | **Comprobado por el agente principal** | Escape cierra el menú y devuelve foco; Enter abre la FAQ |
| Teclado: pausa y repetición de demo | **Comprobado por el agente principal** | Espacio pausa y Enter repite; la selección manual conserva controles de botón nativos |
| Zoom 200 % y QA de movimiento reducido | **Pendiente en navegador** | IAB no ofrece emulación de movimiento reducido y los atajos de zoom no modificaron el zoom. La rama estática y la parada del temporizador sí están cubiertas por pruebas; no se acredita la revisión visual a 200 % |
| Flujos visitante, invitado, Gratis y PRO | **Parcial: visitante comprobado; destinos según actor revisados en código** | El CTA gratuito abre `/try` y el CTA PRO abre registro conservando el destino mensual de suscripción. Faltan recorridos completos con sesiones invitado, Gratis y PRO; no se envió un registro ni se completó una compra |
| Typecheck final del árbol compartido | **Exit 0** | `npm run typecheck -- --incremental false`, repetido tras finalizar la cola de atribución y la corrección concurrente de tipos Stripe |
| Lint final del árbol compartido | **Exit 0; 8 warnings en 7 archivos** | `npm run lint`; avisos de imágenes y dependencias de hooks en componentes ajenos a la landing; ninguno en landing, PDF download ni legales |
| Suite completa final del árbol compartido | **336 pasan, 9 omitidas, 0 fallos; 345 tests** | `npm test`, fuera del sandbox para permitir servidor loopback; sin bases de integración configuradas. Duración 11,91 s; repetida después del cierre de atribución |
| Build de producción final | **Exit 0** | `npm run build` en snapshot completo aislado; incluye prebuild de workers y checks Next. Landing SSR bajo demanda, ruta 11,1 kB y First Load JS 156 kB según Next. Resumen y log conservados en `qa/` |
| Catálogo Stripe local TEST, consulta de solo lectura | **Coherente con 10 €/mes** | Price activo, EUR 1000 céntimos, intervalo `month`, `interval_count=1`, validador mensual correcto; no se crearon Checkout, pagos ni recursos y no se registran claves o IDs |
| Lighthouse móvil final | **Cumple: LCP mediana 2,709 s; CLS 0** | Tres ejecuciones completas Lighthouse 13.3.0 sobre la build final, performance 96/100 en las tres; informes conservados en `qa/performance/` |
| A/B ≥14 días y diferencia con IC95 % | **Pendiente; experimento preparado** | Sin tasas ni ganador observados |

## Condiciones y artefactos de rendimiento

Medición del 04/10/2026, 09:00 Madrid, con Lighthouse **13.3.0 completo**, categoría performance, sobre `http://127.0.0.1:3104/`. Perfil móvil 412 × 823 px, DPR 1,75, CPU ×4, red simulada con RTT 150 ms / 1638,4 Kbps. Cada ejecución usó un perfil nuevo de Chrome y almacenamiento restablecido (`disableStorageReset=false`), sin avisos de Lighthouse.

| Ejecución | LCP | CLS | Performance | Transferido total | JavaScript transferido |
| --- | --- | --- | --- | --- | --- |
| 1 | 2,818 s | 0 | 96/100 | 288.600 B | 172.964 B |
| 2 | 2,709 s | 0 | 96/100 | 288.645 B | 172.964 B |
| 3 | 2,708 s | 0 | 96/100 | 288.645 B | 172.964 B |

Mediana LCP **2,709245 s**, CLS máximo **0**: cumplen AC-LAND-05. Las tres trazas muestran 18 solicitudes, 13 de scripts y ninguna solicitud a `/api/pdf` ni `/api/ai/`. No se mide producción remota ni un recorrido autenticado con esta prueba local de laboratorio.

Artefactos conservados: [resumen](qa/performance/summary.json), `qa/performance/mobile-run-{1,2,3}.json`, sus informes HTML y ficheros de métricas. Los hashes de fuentes de la build coinciden con los archivos del árbol compartido al revisarlos; no se reutilizan cifras ni informes temporales de una build anterior.

Build del 04/10/2026, 08:57 Madrid, sobre snapshot completo `/private/tmp/matchply-landing-production-final`, Node 26.3.0. `qa/production-build-summary.json` conserva comandos, exits, duraciones y hashes de fuentes; `qa/production-build.log` conserva la salida de Next. Typecheck y lint del snapshot también pasan; se mantienen los mismos ocho avisos ajenos al rediseño. Runtime standalone local en puerto 3104 para la medición.

## Límites y cierre

La revisión independiente del 04/10/2026 ejecutó los comandos indicados sobre el árbol compartido actual, repetidos tras cerrar la corrección de atribución. Los tests no cargaron `.env` ni usaron bases de datos reales; las nueve pruebas de integración sin configuración explícita se omitieron. Typecheck, lint y suite pasan. El error de tipos anterior de facturación se corrigió en el trabajo concurrente, sin tocar esos archivos desde la landing. `git diff --check` de los archivos del rediseño, analítica, descarga, legales y especificación también pasa.

La medición local de laboratorio acredita LCP <3 s en las condiciones registradas; no acredita una mejora de conversión ni tiempos en producción remota. El experimento depende de los gates Umami, sigue sujeto a la configuración operativa y no se activa con este trabajo. `sessionStorage` cuenta sesiones de pestaña; no identifica personas únicas ni deduplica entre dispositivos/pestañas.

Mantener separados los resultados del rediseño y los cambios concurrentes ajenos de monetización. No se registra aquí ninguna modificación de producción, cobro o configuración Stripe. La captura final `qa/desktop-es-light.jpg` acredita el hero español de la build medida, con demo en su resultado final, beneficio, CTA y 10 €/mes visibles. También se conservan capturas móvil en español y escritorio en inglés oscuro.

Quedan pendientes las verificaciones visuales de zoom 200 % y movimiento reducido real, los recorridos completos con sesiones autenticadas y la evaluación del experimento después de al menos 14 días de medición habilitada. Estas limitaciones no se presentan como criterios aprobados.
