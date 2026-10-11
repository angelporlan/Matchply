# Landing, demostración y conversión

Estado: **Implementado; comprobaciones automáticas y rendimiento aprobados, QA manual parcial**. Resultados y límites en [evidence.md](evidence.md).

Revisión: **04/10/2026**.

Referencias: [expectativas](expectations.md), [plan](plan.md), [evidencia](evidence.md), [diseño del producto](../../../design.md). El [inventario anterior](estado-actual.md) es una fotografía histórica.

## Objetivo y alcance

La página `/` debe permitir entender qué hace Matchply, ver una adaptación ilustrativa, conocer el precio de PRO y empezar con una oferta propia. Se prioriza al visitante que quiere adaptar un CV; las cuentas existentes conservan acceso a su espacio y a su suscripción.

La narrativa muestra experiencia real, propuesta revisable y PDF. El rediseño incluye contenido ES/EN, ambos temas, navegación accesible, una demostración ligera y preparación del test A/B. No modifica reglas de acceso, el editor, las cuotas, los endpoints PDF o el tratamiento de los proveedores de IA. La medición no se activa mediante este cambio.

## Requisitos

- **REQ-LAND-01:** El hero DEBE incluir un beneficio completo desde el HTML inicial, descripción del flujo, demostración y precio **10 €/mes**. No escribir el titular progresivamente ni prometer resultados laborales o un tiempo de adaptación sin verificar.
- **REQ-LAND-02:** Cada sección DEBE tener como máximo un CTA de conversión. Hero, «Cómo funciona» y cierre ofrecen empezar gratis; precios ofrece PRO. Navegación, FAQ y controles de la demo conservan su función sin competir como CTA comerciales.
- **REQ-LAND-03:** La demo DEBE mostrar «CV → oferta → revisión → PDF» con datos ficticios y los mismos hechos antes y después. Reproduce una vez durante 12 segundos, permite pausar, continuar, repetir y elegir paso, y se detiene fuera de vista o con la pestaña oculta. Con movimiento reducido muestra un resultado estático y conserva los controles de paso.
- **REQ-LAND-04:** Precios y FAQ DEBEN distinguir prueba sin cuenta, cuenta gratuita y PRO según los permisos reales. El seguimiento de candidaturas está incluido en Gratis. Capacidad de CV y cuotas de IA, matching e investigación para Gratis/PRO proceden de `getPlanConfig()`, sin fijar valores en la copy; los límites de invitado proceden de las constantes vigentes. La FAQ cubre prueba, precio/cancelación, hechos de la IA, ATS y privacidad.
- **REQ-LAND-05:** El contenido DEBE respetar `design.md`, ES/EN, claro/oscuro, teclado, foco visible y controles táctiles. La cabecera incluye salto al contenido, navegación por anclas y menú móvil con estado accesible y cierre con Escape.
- **REQ-LAND-06:** La landing DEBE renderizar su contenido principal en servidor y limitar las islas de cliente a interacción y medición. La demo no monta editor, PDF.js, generador PDF ni llamadas IA. Objetivos de aceptación: LCP móvil **<3 s** y CLS **≤0,1**, medidos con build de producción y condiciones registradas.
- **REQ-LAND-07:** El experimento `landing_headline_v1` DEBE cambiar únicamente el H1, repartir A/B al 50 % entre nuevos participantes visitantes/invitados y conservar la variante en `matchply_landing_headline` con valor `v1:A` o `v1:B`, HttpOnly, SameSite=Lax, Secure en producción y caducidad de siete días. La primera respuesta SSR recibe la misma asignación que la cookie; se ignoran cabeceras de variante aportadas por el visitante. Una asignación anónima previa se conserva al registrarse; no incorporar nuevas cuentas ya autenticadas al experimento.
- **REQ-LAND-08:** La medición DEBE usar los gates Umami existentes, respetar DNT y excluir administración e impersonación. Prefetch no asigna ni expone; sí conserva en el contenido SSR una variante válida existente para la navegación posterior. Exposición, primer clic, primer PDF y registro se deduplican por variante durante la sesión de pestaña mediante `sessionStorage`, con respaldo en memoria cuando el almacenamiento no esté disponible.
- **REQ-LAND-09:** `cv_downloaded` DEBE registrarse tras respuesta correcta, PDF no vacío e inicio de descarga. `first_pdf` y `signup` experimentales requieren exposición de esa variante en la misma sesión de pestaña. Preview, error, 403 o clic duplicado en vuelo no constituyen una descarga exitosa.

## Flujos e interfaces

- Visitante/invitado: «Probar gratis con mi oferta» abre `/try`; su gate existente reutiliza la prueba o lleva al dashboard si ya tiene trabajo. Cuenta registrada: «Abrir mi espacio» abre `/dashboard`.
- PRO: el visitante conserva el registro con intención de plan y destino `/dashboard/subscription?interval=monthly&source=landing-pricing`; una cuenta Gratis accede a esa pantalla para revisar las opciones; una cuenta con PRO accede a `/dashboard/subscription` para gestionarlo. El pago sigue el flujo de facturación existente y no empieza al mostrar la landing.
- Componentes de cliente: cabecera, demo, enlaces de CTA y beacon de exposición. El contenido y el H1 elegido se resuelven en servidor con idioma y actor efectivo.
- Eventos: `landing_headline_v1_{a|b}_{exposed|cta|first_pdf|signup}`. Se conservan los eventos genéricos de conversión. El payload experimental identifica variante y etapa, sin CV, oferta, email ni identificador de cuenta.
- Con la medición deshabilitada o excluida se muestra A y no se crea una asignación experimental nueva. Un fallo de almacenamiento o del script de analítica no bloquea navegación, registro ni descarga.

## Experimento y decisiones

**A:** «Adapta tu CV a cada oferta sin empezar de cero.»

**B:** «Presenta tu experiencia con un CV adaptado a cada oferta.»

Las traducciones EN mantienen el mismo contraste de beneficios. Durante la comparación se mantienen constantes precio, CTA, demo y resto del contenido.

- Métrica primaria: primeras descargas PDF confirmadas / sesiones de pestaña expuestas a cada variante. Clic y registro son métricas secundarias.
- Evaluar tras **al menos 14 días completos de medición habilitada**, con denominadores y tasas por variante y un intervalo de confianza del **95 %** de la diferencia entre tasas. Usar intervalos Wilson para cada proporción y Newcombe para la diferencia.
- No declarar ganador antes del mínimo temporal ni cuando el intervalo de la diferencia incluya cero o la muestra sea insuficiente para una decisión. Conservar A en ese caso y continuar recogiendo evidencia si la medición sigue autorizada.
- La unidad medida es la sesión de pestaña, no una persona única. Borrar almacenamiento, abrir otra pestaña o caducar la cookie permite nuevas observaciones; registrar esta limitación al interpretar el intervalo. El test queda preparado, no ejecutado por este cambio.

## Invariantes y límites

- **INV-LAND-01:** Las rutas existentes conservan propiedad, autenticación, cuotas, recuperación del invitado y gestión de suscripción. La landing no crea CVs ni candidaturas al mostrarse.
- **INV-LAND-02:** No activar `UMAMI_ENABLED`, `UMAMI_AEPD_CLEARED` ni configuración de producción. Sin gates habilitados, el producto sigue utilizable.
- **INV-LAND-03:** Mantener el original, explicar que la IA propone y evitar cifras inventadas, logos como aval, testimonios ficticios o garantías ATS/entrevistas.

Supuestos: el precio objetivo sigue siendo 10 €/mes; Harvard es la plantilla disponible. El trabajo concurrente autorizado de monetización define por defecto Gratis con 3 CV (1 base y 2 adaptados); la landing debe reflejar la configuración publicada vigente, no congelar ese total. Invitado conserva hasta 3 CV y 1 PDF. Este rediseño no publica ni modifica esa configuración. Los tiempos, accesibilidad final y mejora de conversión deben acreditarse en [evidence.md](evidence.md).
