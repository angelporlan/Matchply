# Criterios de aceptación de la landing

Estado: **Implementación local; comprobaciones automáticas aprobadas, QA manual parcial**. Revisión: 04/10/2026. Los criterios describen resultados esperados; su resultado y límites se registran en [evidence.md](evidence.md).

| ID | Contrato | Resultado observable |
| --- | --- | --- |
| AC-LAND-01 | REQ-LAND-01/02 | El primer HTML incluye H1 completo, beneficio, un CTA dominante, precio 10 €/mes y primer fotograma de la demo. Hero, pasos, precios y cierre tienen como máximo un CTA de conversión por sección. |
| AC-LAND-02 | REQ-LAND-03 | La demo avanza por los cuatro pasos en 12 s y conserva el PDF al terminar. Pausar, continuar, repetir y seleccionar paso funcionan; no avanza fuera de vista ni con pestaña oculta. Movimiento reducido mantiene un resultado estático y selección manual. |
| AC-LAND-03 | REQ-LAND-04, INV-LAND-01 | La tabla y FAQ muestran los límites y cuotas Gratis/PRO obtenidos de `getPlanConfig()` en esa respuesta. Con la configuración actual, Gratis admite 3 CV (1 base y 2 adaptados); variar la configuración en pruebas cambia la copy sin editarla. Invitado mantiene 3 CV/1 PDF y el seguimiento se incluye en ambos planes. |
| AC-LAND-04 | REQ-LAND-05 | Revisar 320/375/768/1024/1440 px, ES/EN y ambos temas: sin desbordamiento general, texto legible y precio visible en hero. Si la herramienta redondea el viewport, comprobar 767/769 px a ambos lados del breakpoint y registrar la diferencia. Teclado alcanza skip link, anclas, menú, CTA, demo y FAQ; Escape cierra el menú y devuelve el foco. Comprobar también zoom 200 %. |
| AC-LAND-05 | REQ-LAND-06 | En una build de producción, tres ejecuciones Lighthouse móvil con caché fría y configuración registrada arrojan mediana LCP <3 s y CLS ≤0,1. Registrar versión, CPU/red, peso JS y solicitudes; `/` no solicita IA ni PDFs para la demo. |
| AC-LAND-06 | REQ-LAND-07 | Con gates habilitados, primera visita anónima recibe cookie HttpOnly `v1:A`/`v1:B` siete días y H1 coincidente desde SSR. Visita repetida y registro posterior conservan variante; cookie inválida se reasigna solo para participantes admitidos. Una cabecera externa no fuerza la variante ni una cuenta ya autenticada recibe una asignación nueva. |
| AC-LAND-07 | REQ-LAND-08, INV-LAND-02 | Gates desactivados, DNT, admin o impersonación no generan eventos de experimento. Prefetch no asigna ni expone, pero serializa la variante existente para el siguiente render visible. Exposición requiere landing visible. Script tardío conserva eventos pendientes y los envía sin duplicar etapas; error del script no bloquea el producto. |
| AC-LAND-08 | REQ-LAND-08/09 | Tras exposición A/B, la primera descarga PDF confirmada genera un solo `first_pdf` para esa variante en esa sesión de pestaña. Descargas posteriores, remounts y recargas no lo repiten; sin exposición previa no hay `first_pdf` ni `signup` experimental. |
| AC-LAND-09 | REQ-LAND-09, INV-LAND-01 | HTTP fallido, red rota, respuesta HTML, PDF vacío o click fallido no registran descarga ni callback de éxito. Doble clic en vuelo envía una petición. 403 invitado conserva el gate al registro, sin contar conversión. Cuentas con y sin callback mantienen descarga y nombres. |
| AC-LAND-10 | Flujos, INV-LAND-01 | Visitante/invitado llega al gate `/try`, usuario registrado al dashboard; PRO dirige a registro con destino suscripción mensual, opciones de suscripción o gestión según actor. No se precarga ni se crea Checkout al mostrar la landing. Privacidad, cookies, términos y soporte siguen accesibles. |
| AC-LAND-11 | Experimento y decisiones | Al evaluar el test se adjuntan ≥14 días medidos, denominadores `exposed`, tasas `first_pdf/exposed`, secundarios y diferencia con IC95 %. Sin evidencia suficiente no se declara ganador ni se cambia el H1 por un resultado provisional. |

## Verificación

Pruebas focales: `scripts/landing-demo.test.ts`, `scripts/landing-experiment.test.ts`, `scripts/pdf-download.test.ts`, `scripts/guest-save-prompt.test.ts` y `scripts/umami.test.ts`. Ejecutar también typecheck, lint, suite y build cuando el árbol concurrente esté estable. Las pruebas puras no sustituyen el recorrido de navegador, la medición de rendimiento ni un experimento real.

QA funcional con datos sintéticos y cuenta de pruebas: visitante nuevo, invitado con/sin cuota, cuenta Gratis y PRO; demo y FAQ por teclado; navegar hasta descarga sin enviar datos reales a IA. Probar gates mediante fixtures o entorno de pruebas, sin activar medición ni pagos de producción.
